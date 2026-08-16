from __future__ import annotations

from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def git_mv(src: str, dst: str) -> None:
    source = ROOT / src
    target = ROOT / dst
    if not source.exists():
        raise SystemExit(f"missing source: {src}")
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["git", "mv", src, dst], cwd=ROOT, check=True)


def replace(path: str, old: str, new: str, count: int = -1) -> None:
    file = ROOT / path
    text = file.read_text(encoding="utf-8")
    if old not in text and new not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:80]!r}")
    if old in text:
        text = text.replace(old, new, count)
        file.write_text(text, encoding="utf-8")


moves = [
    ("index.html", "web/index.html"),
    ("child.html", "web/child.html"),
    ("adult.html", "web/adult.html"),
    ("main.css", "web/css/main.css"),
    ("child.css", "web/css/child.css"),
    ("adult.css", "web/css/adult.css"),
    ("child.js", "web/js/child.js"),
    ("adult.js", "web/js/adult.js"),
    ("app.js", "archive/legacy-web/app.js"),
    ("styles.css", "archive/legacy-web/styles.css"),
    ("server.py", "server/app.py"),
    ("vendor_py", "vendor/python"),
    ("scripts/check_static.py", "tests/check_static.py"),
    ("scripts/test_server.py", "tests/test_server.py"),
    ("scripts/install-ubuntu-service.sh", "scripts/systemd/install.sh"),
    ("scripts/uninstall-ubuntu-service.sh", "scripts/systemd/uninstall.sh"),
    ("start-local.command", "scripts/launch/start-local.command"),
    ("start-local.bat", "scripts/launch/start-local.bat"),
    ("RESEARCH.md", "docs/RESEARCH.md"),
    (".nojekyll", "web/.nojekyll"),
]
for src, dst in moves:
    git_mv(src, dst)

replace("web/index.html", 'href="main.css"', 'href="css/main.css"')
replace("web/child.html", 'href="child.css"', 'href="css/child.css"')
replace("web/child.html", 'src="child.js"', 'src="js/child.js"')
replace("web/adult.html", 'href="adult.css"', 'href="css/adult.css"')
replace("web/adult.html", 'src="adult.js"', 'src="js/adult.js"')

server_path = ROOT / "server/app.py"
server = server_path.read_text(encoding="utf-8")
old_root = 'ROOT = Path(__file__).resolve().parent\nsys.path.insert(0, str(ROOT / "vendor_py"))'
new_root = 'PROJECT_ROOT = Path(__file__).resolve().parents[1]\nWEB_ROOT = PROJECT_ROOT / "web"\nsys.path.insert(0, str(PROJECT_ROOT / "vendor" / "python"))'
if old_root not in server:
    raise SystemExit("server root anchor not found")
server = server.replace(old_root, new_root, 1)
server = server.replace('raise SystemExit("QRコードライブラリを読み込めません。vendor_py を確認してください。")', 'raise SystemExit("QRコードライブラリを読み込めません。vendor/python を確認してください。")', 1)
server = re.sub(
    r'SAFE_STATIC = \{.*?\n\}\n\nsessions_lock',
    '''SAFE_STATIC = {\n    "/": "index.html",\n    "/index.html": "index.html",\n    "/child.html": "child.html",\n    "/adult.html": "adult.html",\n    "/css/main.css": "css/main.css",\n    "/css/child.css": "css/child.css",\n    "/css/adult.css": "css/adult.css",\n    "/js/child.js": "js/child.js",\n    "/js/adult.js": "js/adult.js",\n    # Backward-compatible aliases for cached HTML from the old layout.\n    "/main.css": "css/main.css",\n    "/child.css": "css/child.css",\n    "/adult.css": "css/adult.css",\n    "/child.js": "js/child.js",\n    "/adult.js": "js/adult.js",\n}\n\nsessions_lock''',
    server,
    count=1,
    flags=re.S,
)
if 'file_path = ROOT / SAFE_STATIC[path]' not in server:
    raise SystemExit("server static root anchor not found")
server = server.replace('file_path = ROOT / SAFE_STATIC[path]', 'file_path = WEB_ROOT / SAFE_STATIC[path]', 1)
server_path.write_text(server, encoding="utf-8")

test_path = ROOT / "tests/test_server.py"
test = test_path.read_text(encoding="utf-8")
old_import = 'ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))\nimport server as kobo  # noqa:E402'
new_import = 'ROOT=Path(__file__).resolve().parents[1]\nSERVER_DIR=ROOT/"server"\nsys.path.insert(0,str(SERVER_DIR))\nimport app as kobo  # noqa:E402'
if old_import not in test:
    raise SystemExit("test server import anchor not found")
test = test.replace(old_import, new_import, 1)
old_pages = '        for page in ("/","/child.html","/adult.html"):\n            with request(base,page) as r: assert r.status==200 and b"<!doctype html>" in r.read().lower()'
new_pages = '''        for page in ("/","/child.html","/adult.html"):\n            with request(base,page) as r: assert r.status==200 and b"<!doctype html>" in r.read().lower()\n        for asset in ("/css/main.css","/css/child.css","/css/adult.css","/js/child.js","/js/adult.js"):\n            with request(base,asset) as r: assert r.status==200 and len(r.read())>100'''
if old_pages not in test:
    raise SystemExit("test static pages anchor not found")
test = test.replace(old_pages, new_pages, 1)
test_path.write_text(test, encoding="utf-8")

check_path = ROOT / "tests/check_static.py"
check = check_path.read_text(encoding="utf-8")
check = check.replace('ROOT = Path(__file__).resolve().parents[1]\nPAGES = [ROOT / "index.html", ROOT / "child.html", ROOT / "adult.html"]\nSCRIPTS = [ROOT / "child.js", ROOT / "adult.js"]', 'ROOT = Path(__file__).resolve().parents[1]\nWEB = ROOT / "web"\nPAGES = [WEB / "index.html", WEB / "child.html", WEB / "adult.html"]\nSCRIPTS = [WEB / "js/child.js", WEB / "js/adult.js"]', 1)
check = check.replace('if clean and not (ROOT/clean).exists(): fail(f"{html.name}: missing local asset {asset}")', 'if clean and not clean.startswith("/") and not (html.parent/clean).exists(): fail(f"{html.name}: missing local asset {asset}")', 1)
check = check.replace('html=(ROOT/("child.html" if js_path.name.startswith("child") else "adult.html")).read_text(encoding="utf-8")', 'html=(WEB/("child.html" if js_path.name.startswith("child") else "adult.html")).read_text(encoding="utf-8")', 1)
check = check.replace('required=["server.py","main.css","child.css","adult.css","start-local.bat","start-local.command"]\n    for name in required:\n        if not (ROOT/name).exists(): fail(f"{name} is missing")', 'required=["server/app.py","web/css/main.css","web/css/child.css","web/css/adult.css","scripts/launch/start-local.bat","scripts/launch/start-local.command","scripts/systemd/install.sh","vendor/python/qrcode/__init__.py"]\n    for name in required:\n        if not (ROOT/name).exists(): fail(f"{name} is missing")', 1)
check = check.replace('child=(ROOT/"child.js").read_text(encoding="utf-8")\n    adult=(ROOT/"adult.js").read_text(encoding="utf-8")', 'child=(WEB/"js/child.js").read_text(encoding="utf-8")\n    adult=(WEB/"js/adult.js").read_text(encoding="utf-8")', 1)
check = check.replace('child_html=(ROOT/"child.html").read_text(encoding="utf-8")', 'child_html=(WEB/"child.html").read_text(encoding="utf-8")', 1)
check = check.replace('adult_html=(ROOT/"adult.html").read_text(encoding="utf-8")', 'adult_html=(WEB/"adult.html").read_text(encoding="utf-8")', 1)
check_path.write_text(check, encoding="utf-8")

launch_sh = ROOT / "scripts/launch/start-local.command"
launch_sh.write_text('''#!/bin/sh\nset -eu\nROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"\nif command -v python3 >/dev/null 2>&1; then\n  exec python3 "$ROOT/server/app.py"\nfi\nexec python "$ROOT/server/app.py"\n''', encoding="utf-8")

launch_bat = ROOT / "scripts/launch/start-local.bat"
launch_bat.write_text('''@echo off\nchcp 65001 > nul\nset "ROOT=%~dp0..\\.."\npushd "%ROOT%"\nwhere py >nul 2>nul\nif %errorlevel%==0 (\n  py -3 server\\app.py\n) else (\n  python server\\app.py\n)\npopd\npause\n''', encoding="utf-8")

install_path = ROOT / "scripts/systemd/install.sh"
install = install_path.read_text(encoding="utf-8")
install = install.replace('ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"', 'ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"', 1)
install = install.replace('if [[ ! -f "$ROOT/server.py" ]]; then\n  echo "server.py が見つかりません: $ROOT/server.py" >&2', 'if [[ ! -f "$ROOT/server/app.py" ]]; then\n  echo "server/app.py が見つかりません: $ROOT/server/app.py" >&2', 1)
install = install.replace('ExecStart="$PYTHON" "$ROOT/server.py" --host 0.0.0.0 --port $PORT', 'ExecStart="$PYTHON" "$ROOT/server/app.py" --host 0.0.0.0 --port $PORT', 1)
install_path.write_text(install, encoding="utf-8")

readme_path = ROOT / "README.md"
readme = readme_path.read_text(encoding="utf-8")
for old, new in [
    ('python3 server.py', 'python3 server/app.py'),
    ('`start-local.bat`', '`scripts/launch/start-local.bat`'),
    ('`./start-local.command`', '`./scripts/launch/start-local.command`'),
    ('bash scripts/install-ubuntu-service.sh', 'bash scripts/systemd/install.sh'),
    ('bash scripts/uninstall-ubuntu-service.sh', 'bash scripts/systemd/uninstall.sh'),
    ('node --check child.js', 'node --check web/js/child.js'),
    ('node --check adult.js', 'node --check web/js/adult.js'),
    ('python3 -m py_compile server.py', 'python3 -m py_compile server/app.py'),
    ('python3 scripts/check_static.py', 'python3 tests/check_static.py'),
    ('python3 scripts/test_server.py', 'python3 tests/test_server.py'),
    ('`vendor_py/qrcode-LICENSE.txt`', '`vendor/python/qrcode-LICENSE.txt`'),
]:
    readme = readme.replace(old, new)
structure = '''## ディレクトリ構成\n\n役割ごとに分離しています。ルート直下にはプロジェクト情報だけを置きます。\n\n```text\nweb-first-craft/\n├── web/                  # ブラウザへ配信する現行フロントエンド\n│   ├── index.html\n│   ├── child.html\n│   ├── adult.html\n│   ├── css/\n│   └── js/\n├── server/               # LANサーバー / QR / 一時共有\n│   └── app.py\n├── tests/                # 静的構造・LAN転送の自動テスト\n├── scripts/\n│   ├── launch/           # 手動起動用ランチャー\n│   └── systemd/          # Ubuntu常駐サービスの登録・削除\n├── vendor/python/        # 同梱Python依存（qrcode）\n├── docs/                 # 調査・設計資料\n├── archive/legacy-web/   # 現在は使わない旧実装\n├── .github/workflows/    # CI / GitHub Pages\n├── README.md\n├── SECURITY.md\n└── LICENSE\n```\n\n`web/` だけが静的サイトの公開対象です。`archive/` は参考用で、LANサーバーやGitHub Pagesからは配信しません。\n\n'''
readme = re.sub(r'## 主なファイル\n.*?(?=## ライセンス)', structure, readme, count=1, flags=re.S)
readme_path.write_text(readme, encoding="utf-8")

for forbidden in ("index.html", "child.html", "adult.html", "server.py", "child.js", "adult.js", "main.css", "child.css", "adult.css", "app.js", "styles.css", "vendor_py"):
    if (ROOT / forbidden).exists():
        raise SystemExit(f"root cleanup failed: {forbidden}")

Path(__file__).unlink()
print("Repository reorganized into web/server/tests/scripts/vendor/docs/archive")
