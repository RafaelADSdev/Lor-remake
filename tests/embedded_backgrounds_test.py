"""Decode the actual embedded images independently of a browser or file URL bridge."""
import base64
import hashlib
import io
import json
from pathlib import Path
import unittest
from PIL import Image, ImageChops, ImageStat

GAME = Path(__file__).resolve().parents[1]
FOLDER = GAME / 'assets/arenas/backgrounds'

class EmbeddedBackgroundsTest(unittest.TestCase):
    def test_all_native_boards_are_complete_opaque_and_visible(self):
        rows = json.loads((FOLDER / 'sources.json').read_text(encoding='utf-8'))
        self.assertEqual(len(rows), 12)
        for row in rows:
            with self.subTest(region=row['key']):
                script = (FOLDER / row['file']).read_text(encoding='utf-8')
                uri = json.loads(script.splitlines()[-1].split(' = ', 1)[1].removesuffix(';'))
                raw = base64.b64decode(uri.split(',', 1)[1], validate=True)
                self.assertEqual(hashlib.sha256(raw).hexdigest(), row['imageSha256'])
                board = Image.open(io.BytesIO(raw)); board.load()
                self.assertEqual(board.mode, 'RGB')
                self.assertEqual(board.size, (row['width'], row['height']))
                self.assertEqual(board.size, (1600, 500))
                source = Image.open(GAME / row['source']).convert('RGBA')
                original = Image.new('RGB', source.size, '#0b1e20'); original.paste(source, mask=source.getchannel('A'))
                error = sum(ImageStat.Stat(ImageChops.difference(original, board)).mean) / 3
                self.assertLess(error, 3, 'image retains the native arena artwork')
                for x in (.35, .5, .65):
                    for y in (.15, .4, .65):
                        self.assertGreater(sum(board.getpixel((int(x*board.width), int(y*board.height)))), 70)
                if row['key'] == 'piltover':
                    proof = Image.new('RGB', (1600, 1000))
                    proof.paste(board.transpose(Image.Transpose.ROTATE_180), (0, 0)); proof.paste(board, (0, 500))
                    out = GAME / 'test-results'; out.mkdir(exist_ok=True)
                    proof.save(out / 'recurso-mapa-piltover-v20.jpg', quality=96)

if __name__ == '__main__':
    unittest.main()
