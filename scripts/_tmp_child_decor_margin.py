from pathlib import Path

child_path = Path('web/js/child.js')
test_path = Path('tests/check_static.py')
child = child_path.read_text(encoding='utf-8')
test = test_path.read_text(encoding='utf-8')

safe = '<clipPath id="decorSafeZone"><rect x="0" y="0" width="900" height="88"/><rect x="0" y="1112" width="900" height="88"/><rect x="0" y="88" width="52" height="1024"/><rect x="848" y="88" width="52" height="1024"/></clipPath>'
if safe not in child:
    raise SystemExit('safe zone not found')
child = child.replace(safe, '', 1)
child = child.replace('data-decor-zone="edge" clip-path="url(#decorSafeZone)"', 'data-decor-zone="border"', 1)
child = child.replace('背景もよう → 本文 → 外周かざり。かざりは安全な外周帯にclipして、写真や文字を隠さない。', '背景もよう → 本文 → ふちかざり。かざり専用の余白は作らず、カードのふちに直接重ねる。', 1)

old = '''    for marker in ("decorSafeZone", 'data-decor-zone="edge"', 'clip-path="url(#decorSafeZone)"'):
        if marker not in child:
            fail(f"child decoration safe-edge behavior is missing {marker}")
'''
new = '''    if "decorSafeZone" in child or 'clip-path="url(#decorSafeZone)"' in child:
        fail("child decoration must not reserve a dedicated safe-edge margin")
    if 'data-decor-zone="border"' not in child:
        fail("child decoration must sit directly on the existing card border")
'''
if old not in test:
    raise SystemExit('old static check not found')
test = test.replace(old, new, 1)
test = test.replace('while the safe-edge clip prevents overlap', 'without reserving a decoration-only margin', 1)
test = test.replace('child safe-edge decorations', 'child border decorations without reserved margin', 1)

child_path.write_text(child, encoding='utf-8')
test_path.write_text(test, encoding='utf-8')
