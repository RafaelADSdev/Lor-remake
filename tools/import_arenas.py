"""Copy historical original textures unchanged; CSS performs the atlas projection."""
import hashlib
import json
from pathlib import Path
import shutil
import zipfile
from PIL import Image

game = Path(__file__).resolve().parents[1]
archive = game.parent / 'communitydragon_historico/arquivos'
playmats = 'assets/assetlibrary/playmats/'
sources = {
    'rift.png': playmats+'summonersrift/models/SummonersRift_TX_Color.png',
    'demacia.png': playmats+'demacia/models/Demacia_Playmat_TX_Color.png',
    'noxus.png': playmats+'noxus/models/Noxus_Playmat_TX_Color.png',
    'ionia.png': playmats+'ionia/models/Ionia_TX_Color.png',
    'freljord.png': playmats+'freljord/models/Freljord_TX_Color.png',
    'piltover.png': playmats+'piltover/models/Piltover_Playmat_TX_Color.png',
    'bilgewater.png': playmats+'bilgewater/models/Bilgewater_TX_Color.png',
    'shadowisles.png': playmats+'shadowisles/models/ShawdowIsles_TX_Color.png',
    'action-button.png': playmats+'summonersrift/materials/textures/bigbutton/OneButton_Albedo_nomip.png',
    'neutral-ui.png': playmats+'neutral_playmat/models/Playmat_Neutral_UI_Color.png',
    'cardback.png': 'assets/assetlibrary/cardbacks/textures/Summuners_rift_card_back_crispMip.png',
}
out = game/'assets/arenas'
out.mkdir(exist_ok=True)
records = []
for filename, source in sources.items():
    path = archive/source
    shutil.copyfile(path, out/filename)
    with Image.open(path) as im:
        dimensions = im.size
    records.append({'file': filename, 'source': source, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'dimensions': dimensions, 'modified': False})
(out/'sources.json').write_text(json.dumps({'scope': 'Historical CommunityDragon local archive; not a current-client runtime capture', 'files': records}, ensure_ascii=False, indent=2), encoding='utf-8')
snapshot = game/'research/arena-source-snapshot.zip'
with zipfile.ZipFile(snapshot, 'w', zipfile.ZIP_DEFLATED) as z:
    for filename in [*sources, 'sources.json']:
        z.write(out/filename, filename)
print(f'{len(records)} original resources copied unchanged; snapshot SHA-256 {hashlib.sha256(snapshot.read_bytes()).hexdigest()}')
