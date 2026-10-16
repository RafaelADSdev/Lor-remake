"""Copia a faixa já decodificada e registra a referência do banco local, sem rede."""
import hashlib
import json
import pathlib
import shutil
import struct
import wave

game = pathlib.Path(__file__).resolve().parents[1]
root = game.parent
source = root / 'audio_extraido/216316022_d50767d23b.wav'
bank = root / 'cliente_PC/live/Game/LoR_Data/StreamingAssets/Audio/GeneratedSoundBanks/Windows/MU_Patcher_stage0.bnk'
raw = bank.read_bytes()
needle = struct.pack('<I', 216316022)
assert needle in raw, 'O banco não referencia a mídia selecionada.'
destination = game / 'assets/audio'
destination.mkdir(exist_ok=True)
shutil.copyfile(source, destination / 'patcher-theme.wav')
with wave.open(str(source)) as audio:
    seconds = audio.getnframes() / audio.getframerate()
metadata = {
    'source': source.relative_to(root).as_posix(),
    'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'bank': bank.relative_to(root).as_posix(),
    'bank_sha256': hashlib.sha256(raw).hexdigest(),
    'media_id': 216316022,
    'reference_offsets': [i for i in range(len(raw)) if raw.startswith(needle, i)],
    'seconds': seconds,
    'scope': 'Faixa do banco MU_Patcher_stage0; não identificada como trilha de batalha.',
}
(destination / 'source.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Áudio local importado: {seconds:.3f}s; origem e hashes registrados.')
