#!/usr/bin/env python3
"""
build.py — inline all local src/*.js and src/*.jsx into docs/index.html
Run: python3 build.py (legacy preview only; never overwrites the active app)
"""
import os, re

SRC_DIR = os.path.join(os.path.dirname(__file__), 'src')
ENTRY   = os.path.join(SRC_DIR, 'Awen Study Matrix.html')
OUT     = os.path.join(os.path.dirname(__file__), 'legacy-build', 'index.html')

with open(ENTRY, encoding='utf-8') as f:
    html = f.read()

def inline_js(m):
    src = m.group(2)
    path = os.path.join(SRC_DIR, src)
    with open(path, encoding='utf-8') as f:
        code = f.read()
    return f'<script>\n{code}\n</script>'

def inline_babel(m):
    src = m.group(1)
    path = os.path.join(SRC_DIR, src)
    with open(path, encoding='utf-8') as f:
        code = f.read()
    return f'<script type="text/babel">\n{code}\n</script>'

# Inline local <script src="file.js"> (data.js, i18n.js — no integrity attr)
html = re.sub(
    r'<script((?![^>]*integrity)[^>]*) src="((?!http)[^"]+\.js)"[^>]*></script>',
    inline_js,
    html
)

# Inline <script type="text/babel" src="file.jsx">
html = re.sub(
    r'<script[^>]+type=["\']text/babel["\'][^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>',
    inline_babel,
    html
)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(html)

print(f'Built → {OUT}  ({os.path.getsize(OUT)//1024}KB)')
