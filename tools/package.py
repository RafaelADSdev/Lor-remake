"""Empacota o jogo com arquivos locais e verifica integridade do ZIP."""
import hashlib
import json
import pathlib
import zipfile

game = pathlib.Path(__file__).resolve().parents[1]
output = game.parent / 'LoR_Arena_Offline_v0.30.zip'
files = [p for p in game.rglob('*') if p.is_file()
         and not any(part in {'.git', 'test-results', 'node_modules', '__pycache__', 'tasks'}
                     for part in p.relative_to(game).parts)
         and p.name != 'manifesto.json'
         and not p.name.endswith(('.tmp', '.partial', '.log'))
         and not p.name.startswith('.debug-')]
manifest = {
    str(p.relative_to(game)).replace('\\', '/'): {
        'bytes': p.stat().st_size,
        'sha256': hashlib.sha256(p.read_bytes()).hexdigest(),
    }
    for p in files
}
(game / 'manifesto.json').write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
files.append(game / 'manifesto.json')
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for p in files:
        archive.write(p, 'jogo_offline/' + p.relative_to(game).as_posix())
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist()) == len(files)
print(f'{output}: {len(files)} arquivos, {output.stat().st_size / 1048576:.1f} MB; CRC validado.')
