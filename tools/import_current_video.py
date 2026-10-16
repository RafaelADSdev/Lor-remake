"""Convert one explicitly identified Bink2 skin cinematic without installing tools.

RADVideo64.exe is extracted statically from the official RAD Tools archive.
Its installer is never executed. Supply local portable executable paths.
"""
from pathlib import Path
import argparse
import hashlib
import json
import struct
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
GAME = ROOT / "jogo_offline"
SOURCE = ROOT / "cliente_PC_downloads_2026-10-15/live/PatcherData/PatchableFiles/Video/Skin_Garen_Rugged_LevelUp_HQ.bk2"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--rad", required=True, type=Path)
    parser.add_argument("--ffmpeg", required=True, type=Path)
    args = parser.parse_args()
    header = SOURCE.read_bytes()[:44]
    if header[:4] != b"KB2j":
        raise ValueError("Unexpected Bink2 signature")
    fields = struct.unpack("<10I", header[4:44])
    frames, width, height, fps_n, fps_d = fields[1], fields[4], fields[5], fields[6], fields[7]
    destination = GAME / "assets/video/garen-rugged-level-up.webm"
    destination.parent.mkdir(parents=True, exist_ok=True)
    startup = subprocess.STARTUPINFO()
    startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    startup.wShowWindow = subprocess.SW_HIDE
    work = ROOT / "pesquisa/revisao_downloads_2026-10-15/video-work"
    work.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="garen-rugged-", dir=work) as folder:
        target = Path(folder) / "frame.png"
        command = [str(args.rad.resolve()), "BinkConv", str(SOURCE), str(target), "/S1", f"/E{frames}", "/Z0", "/N-1"]
        result = subprocess.Popen(command, startupinfo=startup)
        deadline = time.monotonic() + 120
        complete = False
        while time.monotonic() < deadline:
            images = sorted(Path(folder).glob("frame*.png"))
            if len(images) == frames and images[-1].read_bytes().endswith(bytes.fromhex("49454e44ae426082")):
                complete = True
                break
            if result.poll() is not None:
                break
            time.sleep(.2)
        # The converter retains its hidden progress dialog after finishing.
        # Close only the process we started, after a complete PNG sequence exists.
        closed_after_frames = False
        try:
            result.wait(timeout=3)
        except subprocess.TimeoutExpired:
            result.terminate()
            result.wait(timeout=5)
            closed_after_frames = complete
        images = sorted(Path(folder).glob("frame*.png"))
        if len(images) != frames:
            raise RuntimeError(f"RAD exit {result.returncode}; expected {frames} frames, found {len(images)}")
        # The native converter starts its sequence at frame000.png.
        subprocess.run([str(args.ffmpeg.resolve()), "-y", "-hide_banner", "-loglevel", "error",
                        "-framerate", f"{fps_n}/{fps_d}", "-start_number", "0",
                        "-i", str(Path(folder) / "frame%03d.png"),
                        "-vf", "scale=1280:-2:flags=lanczos", "-c:v", "libvpx-vp9",
                        "-crf", "30", "-b:v", "0", "-pix_fmt", "yuv420p", "-an", str(destination)],
                       check=True, timeout=120)
    manifest = {"source": str(SOURCE.relative_to(ROOT)).replace("\\", "/"),
                "sourceSha256": sha(SOURCE), "sourceBytes": SOURCE.stat().st_size,
                "sourceSignature": "KB2j", "frames": frames, "fps": fps_n / fps_d,
                "durationSeconds": frames * fps_d / fps_n, "sourceWidth": width, "sourceHeight": height,
                "character": "Garen", "skin": "Rugged", "defaultChampionCinematic": False,
                "radSha256": sha(args.rad), "ffmpegSha256": sha(args.ffmpeg),
                "radExit": result.returncode, "radClosedAfterFrames": closed_after_frames,
                "output": "assets/video/garen-rugged-level-up.webm",
                "outputSha256": sha(destination), "outputBytes": destination.stat().st_size,
                "audio": False, "notes": "Native Bink2 decoded to RGB PNG, then VP9 WebM. Skin-specific; never identify as default Garen."}
    (GAME / "research/current-video-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
