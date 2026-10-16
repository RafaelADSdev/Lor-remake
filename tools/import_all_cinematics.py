"""Convert the complete local Bink2 inventory using already extracted tools.

No installer, downloader, license interaction, or global process termination.
Restarting preserves outputs whose hashes and full decoded frame counts match.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import argparse
import hashlib
import json
import os
import re
import struct
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
GAME = ROOT / "jogo_offline"
INDEX = ROOT / "assets_extraidos_atualizados_2026-10-15/card-animations/video-index.json"
MANIFEST = GAME / "research/cinematic-library-manifest.json"
DATA = GAME / "cinematic-library-data.js"
WORK = ROOT / "pesquisa/revisao_downloads_2026-10-15/video-work/all-cinematics"
PNG_END = bytes.fromhex("49454e44ae426082")
CONVERSION_DESCRIPTION = "RAD RGB image sequence → FFmpeg VP9 WebM, 960px width, CRF31; existing PNG-derived Garen preserved at 1280px"


def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def hidden():
    if os.name != "nt":
        return {}
    startup = subprocess.STARTUPINFO()
    startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    startup.wShowWindow = subprocess.SW_HIDE
    return {"startupinfo": startup, "creationflags": subprocess.CREATE_NO_WINDOW}


def metadata(record):
    stem = Path(record["source"]).stem
    candidates = record["mapping"]["candidates"]
    primary = next((c for c in candidates if c.get("collectible")), None)
    raw_character = record.get("characterFromFilename") or ""
    character = (primary or {}).get("namePt") or raw_character or None
    stage = 3 if re.search(r"(?:Azir|Nasus|Renekton|Xerath)2_", stem) else 2
    skin = record.get("skinFromFilename") or None
    # The source index intentionally maps S009 Lux to Lux: Illuminated.
    label = character or ("Evento: Rei Destruído" if record["classification"] == "event" else "Evolução genérica")
    if record["classification"] == "generic":
        generic_variant = ("Noxus" if "Noxus" in stem else "Piltover e Zaun" if "PiltoverZaun" in stem
                           else "O Caminho dos Campeões" if "Tpoc" in stem else "Universal")
        label += " · " + generic_variant
    if skin:
        label += " · " + re.sub(r"([a-z])([A-Z])", r"\1 \2", skin).replace("_", " ")
    label += " · Nível " + str(stage) if record["classification"] != "event" else ""
    slug = re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")
    existing_garen = stem == "Skin_Garen_Rugged_LevelUp_HQ"
    video = "assets/video/garen-rugged-level-up.webm" if existing_garen else f"assets/video/library/{slug}.webm"
    return {
        "id": slug, "name": label, "character": character, "skin": skin,
        "kind": record["classification"], "codes": sorted({c["cardCode"] for c in candidates}),
        "championCodes": sorted({c["cardCode"] for c in candidates if c.get("collectible")}),
        "source": record["source"], "duration": record["durationSeconds"], "video": video,
        "level": stage,
        "defaultChampionCinematic": record["classification"] == "champion-cinematic" and not skin and stage == 2,
        "mappingMethod": record["mapping"]["method"],
        **({"audio": "garen-rugged-level-up"} if existing_garen else {}),
    }


def validate(ffmpeg, path, expected_frames, duration):
    result = subprocess.run([str(ffmpeg), "-hide_banner", "-loglevel", "error", "-xerror",
                             "-threads", "2", "-i", str(path), "-map", "0:v:0", "-an",
                             "-fps_mode", "passthrough", "-progress", "pipe:1", "-f", "null", "-"],
                            capture_output=True, text=True, timeout=180, **hidden())
    if result.returncode:
        raise RuntimeError(f"Full decode failed: {result.stderr[-1600:]}")
    frames = [int(v) for v in re.findall(r"^frame=(\d+)$", result.stdout, re.M)]
    times = [int(v) / 1_000_000 for v in re.findall(r"^out_time_us=(\d+)$", result.stdout, re.M)]
    if not frames or frames[-1] != expected_frames:
        raise RuntimeError(f"Decoded {frames[-1:]}; expected {expected_frames}")
    if not times or abs(times[-1] - duration) > .08:
        raise RuntimeError(f"Decoded duration {times[-1:]}; expected {duration}")
    return {"decodedFrames": frames[-1], "decodedDuration": times[-1], "fullDecodePassed": True}


def complete_png(path):
    try:
        with path.open("rb") as stream:
            stream.seek(-8, 2)
            return stream.read(8) == PNG_END
    except (OSError, ValueError):
        return False


def complete_image(path):
    if path.suffix == ".png":
        return complete_png(path)
    try:
        with path.open("rb") as stream:
            header = stream.read(6)
        return header[:2] == b"BM" and struct.unpack("<I", header[2:])[0] == path.stat().st_size
    except (OSError, ValueError, struct.error):
        return False


def encode_sequence(folder, staged, record, ffmpeg):
    images = sorted(list(folder.glob("frame*.png")) + list(folder.glob("frame*.bmp")))
    digits = len(re.search(r"(\d+)$", images[0].stem).group(1))
    pattern = folder / (f"frame%0{digits}d" + images[0].suffix)
    result = subprocess.run([str(ffmpeg), "-y", "-hide_banner", "-loglevel", "error", "-threads", "2",
                    "-framerate", f"{record['fpsNumerator']}/{record['fpsDenominator']}", "-start_number", "0",
                    "-i", str(pattern), "-vf", "scale=960:-2:flags=lanczos",
                    "-c:v", "libvpx-vp9", "-threads", "2", "-row-mt", "1", "-deadline", "realtime",
                    "-cpu-used", "5", "-crf", "31", "-b:v", "0", "-pix_fmt", "yuv420p", "-an", str(staged)],
                   capture_output=True, text=True, timeout=240, **hidden())
    if result.returncode:
        raise RuntimeError(f"FFmpeg exit {result.returncode}: {result.stderr[-2000:]}")


def convert(record, args, previous):
    started = time.monotonic()
    entry = metadata(record)
    source = ROOT / record["source"]
    target = GAME / entry["video"]
    digest = sha(source)
    if digest != record["sha256"]:
        raise RuntimeError("Source differs from preserved inventory")
    with source.open("rb") as stream:
        header = stream.read(44)
    words = struct.unpack("<10I", header[4:44])
    if header[:4] != b"KB2j" or words[1] != record["frames"]:
        raise RuntimeError("Bink2 header/frame count differs from inventory")
    source_audio_tracks = words[9]
    details = {"sourceSha256": digest, "sourceBytes": source.stat().st_size,
               "sourceFrames": record["frames"], "sourceWidth": record["width"], "sourceHeight": record["height"],
               "fpsNumerator": record["fpsNumerator"], "fpsDenominator": record["fpsDenominator"],
               "sourceAudioTracks": source_audio_tracks, "outputContainsAudio": False}
    if target.exists() and (previous.get("sourceSha256") == digest and previous.get("outputSha256") == sha(target)
                            or entry["video"] == "assets/video/garen-rugged-level-up.webm"):
        details.update(validate(args.ffmpeg, target, record["frames"], entry["duration"]))
        return {**entry, **details, "outputBytes": target.stat().st_size, "outputSha256": sha(target),
                "radExit": previous.get("radExit"), "reusedValidatedOutput": True}
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=entry["id"] + "-", dir=WORK) as folder:
        folder = Path(folder)
        proc = subprocess.Popen([str(args.rad), "BinkConv", str(source), str(folder / "frame.bmp"),
                                 "/S1", f"/E{record['frames']}", "/Z0", "/N-1"], **hidden())
        complete = False
        deadline = time.monotonic() + args.decode_timeout
        try:
            while time.monotonic() < deadline:
                frames = list(folder.glob("frame*.bmp"))
                if len(frames) == record["frames"] and all(complete_image(path) for path in frames):
                    complete = True
                    break
                if proc.poll() is not None:
                    break
                time.sleep(.3)
        finally:
            try:
                proc.wait(timeout=.5)
            except subprocess.TimeoutExpired:
                # Only this owned helper: all frames are complete, or the operation timed out.
                proc.terminate()
                proc.wait(timeout=10)
        if not complete:
            raise RuntimeError(f"RAD exit {proc.returncode}; incomplete sequence {len(list(folder.glob('frame*.bmp')))}/{record['frames']}")
        staged = folder / "converted.webm"
        encode_sequence(folder, staged, record, args.ffmpeg)
        details.update(validate(args.ffmpeg, staged, record["frames"], entry["duration"]))
        staged.replace(target)
    return {**entry, **details, "outputBytes": target.stat().st_size, "outputSha256": sha(target),
            "radExit": proc.returncode, "radClosedAfterCompleteFrames": complete,
            "conversionSeconds": round(time.monotonic() - started, 2)}


def save(records, errors, inventory, tool_info):
    ordered = sorted(records.values(), key=lambda item: item["id"])
    manifest = {"schemaVersion": 1, "inventorySource": str(INDEX.relative_to(ROOT)).replace("\\", "/"),
                "tools": tool_info, "summary": {"sourceVideos": len(inventory), "validatedVideos": len(ordered),
                "failedVideos": len(errors), "outputBytes": sum(r["outputBytes"] for r in ordered),
                "decodedFrames": sum(r["decodedFrames"] for r in ordered),
                "clipsWithExternalAudio": sum(bool(r.get("audio")) for r in ordered),
                "mappedChampionDefaults": sum(r["defaultChampionCinematic"] and bool(r["championCodes"]) for r in ordered)},
                "limitations": ["Only original video pixels are converted; surrounding Unity intro/outro prefabs are separate.",
                                "Card attribution comes from the preserved filename mapping; missing mappings remain unmapped.",
                                "Only Garen Rugged has independently recovered audio; all other converted clips currently play silently.",
                                "RAD retains its completion dialog; its owned helper is closed after complete frames exist. Nonzero helper exits are not proof of successful conversion; full FFmpeg decode is required.",
                                "Skin and generic clips are never champion defaults."],
                "videos": ordered, "errors": errors}
    MANIFEST.parent.mkdir(exist_ok=True)
    staged_manifest = MANIFEST.with_suffix(".json.tmp")
    staged_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    staged_manifest.replace(MANIFEST)
    public = [{k: v for k, v in r.items() if k in {"id", "name", "character", "skin", "kind", "codes", "championCodes", "source", "duration", "video", "audio", "level", "defaultChampionCinematic", "mappingMethod", "poster"}} for r in ordered]
    staged_data = DATA.with_suffix(".js.tmp")
    staged_data.write_text("/* Generated from validated local Bink2 conversions. */\nwindow.CINEMATIC_LIBRARY = " + json.dumps(public, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    staged_data.replace(DATA)


def build_posters(ffmpeg, records):
    for entry in records.values():
        output = GAME / f"assets/video/posters/{entry['id']}.jpg"
        output.parent.mkdir(parents=True, exist_ok=True)
        # Fiddlesticks stays behind a dark door until the final reveal.
        fraction = .9 if entry["id"] == "s098-fiddlesticks-levelup-hq" else .45
        poster_time = entry["duration"] * fraction
        subprocess.run([str(ffmpeg), "-y", "-hide_banner", "-loglevel", "error", "-ss", str(poster_time),
                        "-i", str(GAME / entry["video"]), "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "3", str(output)],
                       check=True, timeout=30, **hidden())
        entry["poster"] = str(output.relative_to(GAME)).replace("\\", "/")
        entry["posterTimeSeconds"] = round(poster_time, 6)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rad", required=True, type=Path)
    parser.add_argument("--ffmpeg", required=True, type=Path)
    parser.add_argument("--workers", type=int, default=2, choices=(1, 2))
    parser.add_argument("--decode-timeout", type=int, default=180)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--posters-only", action="store_true", help="Generate posters for the validated manifest without rerunning conversions")
    args = parser.parse_args()
    args.rad, args.ffmpeg = args.rad.resolve(strict=True), args.ffmpeg.resolve(strict=True)
    inventory = json.loads(INDEX.read_text(encoding="utf-8"))["videos"]
    WORK.mkdir(parents=True, exist_ok=True)
    saved = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    previous = {r["id"]: r for r in saved.get("videos", [])}
    if args.posters_only:
        fresh_metadata = {metadata(record)["id"]: metadata(record) for record in inventory}
        for identifier, entry in previous.items():
            entry.update(fresh_metadata[identifier])
        saved["tools"]["conversion"] = CONVERSION_DESCRIPTION
        build_posters(args.ffmpeg, previous)
        save(previous, saved.get("errors", {}), inventory, saved["tools"])
        print(f"Generated {len(previous)} posters")
        return
    # Keep previously validated records in the incremental manifest while a
    # resumed invocation revalidates them. A failed revalidation removes them.
    records, errors = dict(previous), {}
    tool_info = {"radSha256": sha(args.rad), "ffmpegSha256": sha(args.ffmpeg),
                 "conversion": CONVERSION_DESCRIPTION,
                 "concurrency": args.workers}
    selected = inventory[:args.limit] if args.limit else inventory
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        pending = {executor.submit(convert, record, args, previous.get(metadata(record)["id"], {})): record for record in selected}
        for future in as_completed(pending):
            record = pending[future]
            identifier = metadata(record)["id"]
            try:
                records[identifier] = future.result()
                print(f"OK {len(records)}/{len(selected)} {identifier}", flush=True)
            except Exception as error:
                records.pop(identifier, None)
                errors[identifier] = str(error)
                print(f"ERROR {identifier}: {error}", flush=True)
            save(records, errors, inventory, tool_info)
    if errors:
        raise SystemExit(f"{len(errors)} conversions failed; see {MANIFEST}")
    build_posters(args.ffmpeg, records)
    save(records, errors, inventory, tool_info)


if __name__ == "__main__":
    main()
