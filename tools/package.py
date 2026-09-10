"""Package the game for a double-click offline launch. Standard library only."""
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
OUT = DIST / 'downloads'
OUT.mkdir(parents=True, exist_ok=True)

html = (DIST / 'index.html').read_text(encoding='utf-8')
css = (DIST / 'style.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>')
for name in ['physics.js', 'renderer.js', 'world.js', 'game.js']:
    code = (DIST / name).read_text(encoding='utf-8').replace('</script', '<\\/script')
    html = html.replace(f'<script src="{name}"></script>', '<script>\n' + code + '\n</script>')
assert not re.search(r'<(?:script|link)[^>]+(?:src|href)="(?!data:)', html)
standalone = OUT / 'pet-racing.html'
standalone.write_text(html, encoding='utf-8')

sources = [ROOT / 'README.md', ROOT / 'tests/run.cjs', ROOT / 'tools/package.py']
sources.extend(DIST / name for name in ['index.html', 'style.css', 'physics.js', 'renderer.js', 'world.js', 'game.js'])
archive = OUT / 'pet-racing-source.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as output:
    for source in sources:
        output.write(source, source.relative_to(ROOT))
    output.write(standalone, 'pet-racing.html')
with zipfile.ZipFile(archive) as check:
    assert check.testzip() is None
    assert check.read('pet-racing.html') == standalone.read_bytes()
print(f'Offline game: {standalone} ({standalone.stat().st_size:,} bytes)')
print(f'Source archive: {archive} ({archive.stat().st_size:,} bytes)')
