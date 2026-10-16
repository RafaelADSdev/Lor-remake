"""Package the source coin-transfer curve and render the recovered shield silhouette."""
from pathlib import Path
import hashlib
import json
import math
import shutil
import zlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps
from import_current_motion import Clip

GAME = Path(__file__).resolve().parents[1]
ROOT = GAME.parent
SOURCE = ROOT / "assets_extraidos_atualizados_2026-10-15/attack-token"
EXTRA = ROOT / "assets_extraidos_atualizados_2026-10-15/initiative"
OUT = GAME / "assets/arenas/token"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    provenance = json.loads((EXTRA / "sources.json").read_text(encoding="utf-8"))
    for item in provenance["initiativeChain"]:
        for export in item["exports"]:
            assert digest(SOURCE / export["file"]) == export["sha256"]
    for export in provenance["shield"]["exports"]:
        assert digest(EXTRA / export["file"]) == export["sha256"]
    pid = -4523325567422316303
    clip = Clip(json.loads((SOURCE / f"AnimationClip_{pid}.json").read_text(encoding="utf-8")))
    data = clip.tracks({zlib.crc32(b"RootPos"): "RootPos"})
    assert len(data["tracks"]) == 1 and data["tracks"][0]["path"] == "RootPos"
    assert all(math.isfinite(x) for channel in data["tracks"][0]["channels"].values() for sample in channel for x in sample)
    # Fit the gold circular sockets in the shipped native housing, in sprite pixels.
    housing = GAME / "assets/arenas/hud/action-dock.png"
    pixels = np.array(Image.open(housing).convert("RGBA"))
    sockets = []
    for y0, y1 in [(pixels.shape[0]-70, pixels.shape[0]), (0, 70)]:
        part = pixels[y0:y1, 100:174]
        gold = (part[:,:,0] > 120) & (part[:,:,1] > 60) & (part[:,:,1] < 220) & (part[:,:,2] < 150) & (part[:,:,3] > 80)
        y, x = np.nonzero(gold); x = x+100; y = y+y0
        fit = np.linalg.lstsq(np.column_stack([2*x, 2*y, np.ones(len(x))]), x*x+y*y, rcond=None)[0]
        cx, cy = fit[:2]; radius = math.sqrt(fit[2] + cx*cx + cy*cy)
        residual = float(np.std(np.sqrt((x-cx)**2 + (y-cy)**2) - radius))
        assert residual < 2 and 27 < radius < 33
        sockets.append({"center": [float(cx), float(cy)], "radius": radius, "fitResidual": residual})
    data["socketProjection"] = {"spriteSize": [pixels.shape[1], pixels.shape[0]], "sockets": sockets, "housingSha256": digest(housing)}
    (GAME / "initiative-token-data.js").write_text("window.INITIATIVE_TOKEN_DATA = " + json.dumps(data, separators=(",", ":")) + ";\n", encoding="utf-8")
    shutil.copyfile(OUT / "defense.png", OUT / "initiative.png")
    # The original shield alpha supplies the contour; the steel/brass finish is a browser adaptation.
    shield = ImageOps.grayscale(Image.open(EXTRA / "shield.png").convert("RGB"))
    shield = shield.point(lambda value: 255 if value >= 22 else 0).filter(ImageFilter.GaussianBlur(.5)).resize((132, 140), Image.Resampling.LANCZOS)
    inside = shield.filter(ImageFilter.MinFilter(5))
    base = Image.open(OUT / "defense.png").convert("RGBA")
    draw = ImageDraw.Draw(base)
    draw.ellipse((43, 43, 213, 213), fill=(61, 77, 89, 255))
    trim = Image.new("RGBA", shield.size, (216, 196, 143, 255)); trim.putalpha(shield)
    body = Image.new("RGBA", shield.size, (139, 169, 186, 255)); body.putalpha(inside)
    trim.alpha_composite(body)
    base.alpha_composite(trim, (62, 55))
    base.save(OUT / "defense-shield.png")
    evidence = json.loads((GAME / "research/rea-initiative-inventory.json").read_text(encoding="utf-8-sig"))
    manifest = {**provenance, "reaEvidence": evidence["evidence_id"], "snapshotSha256": evidence["subject"]["digest"]["sha256"],
                "transfer": {"pathId": str(pid), "duration": data["duration"], "path": "RootPos", "positionStart": data["tracks"][0]["channels"]["position"][0], "positionEnd": data["tracks"][0]["channels"]["position"][-1],
                "projection": "Native normalized vertical progress, Z arc, X flip and scale; endpoints mapped to DOM sockets; reverse direction mirrored."},
                "derived": {name: digest(OUT / name) for name in ["initiative.png", "defense-shield.png"]},
                "socketProjection": data["socketProjection"],
                "shieldRendering": "Original shield-alpha contour and native medallion rim; opaque steel fill and brass trim adapted for browser legibility."}
    (OUT / "initiative-sources.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("Imported native 1s coin flight: Y +29 to -29, X rotation 0 to -360 degrees, native depth and scale; rendered shield contour.")


if __name__ == "__main__":
    main()
