from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
child_path = ROOT / "child.js"
server_path = ROOT / "server.py"
test_path = ROOT / "scripts" / "test_server.py"

child = child_path.read_text(encoding="utf-8")
server = server_path.read_text(encoding="utf-8")
test = test_path.read_text(encoding="utf-8")

# 1) Keep page-level decoration behind the actual profile content/photo.
old_svg = '${defs}<rect width="900" height="1200" fill="${p.bg}"/>${patternSvg(state.pattern,p)}${content}${decorSvg(state.decor,p)}</svg>`;'
new_svg = '${defs}<rect width="900" height="1200" fill="${p.bg}"/>${patternSvg(state.pattern,p)}${decorSvg(state.decor,p)}${content}</svg>`;'
if old_svg not in child and new_svg not in child:
    raise SystemExit("child SVG layer anchor not found")
child = child.replace(old_svg, new_svg, 1)

# 2) Phone picker: gallery and camera must be independent choices.
# server.py contains this CSS inside an f-string, so literal braces are doubled.
old_css = 'label{{display:block;margin-top:20px;font-weight:900}}input{{width:100%;min-height:52px;margin-top:8px;padding:10px;background:#fff;border:2px solid #776f64;border-radius:9px}}'
new_css = 'label{{display:block;font-weight:900}}.photo-source-grid{{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px}}.photo-source{{position:relative;display:grid;place-items:center;min-height:62px;padding:10px 12px;background:#fff;border:2px solid #776f64;border-radius:11px;text-align:center;cursor:pointer}}.photo-source:first-child{{background:#fff4ca}}.photo-source:last-child{{background:#dff6ff}}.photo-source input{{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden}}@media(max-width:420px){{.photo-source-grid{{grid-template-columns:1fr}}}}'
if old_css not in server and new_css not in server:
    raise SystemExit("phone page CSS anchor not found")
server = server.replace(old_css, new_css, 1)

old_picker = '<label for="photo">写真をとる・えらぶ</label><input id="photo" type="file" accept="image/png,image/jpeg,image/webp" capture="user">'
new_picker = '<div class="photo-source-grid"><label class="photo-source">🖼 写真フォルダから選ぶ<input id="photo" type="file" accept="image/png,image/jpeg,image/webp"></label><label class="photo-source">📷 カメラで撮る<input id="cameraPhoto" type="file" accept="image/png,image/jpeg,image/webp" capture="user"></label></div>'
if old_picker not in server and new_picker not in server:
    raise SystemExit("phone picker anchor not found")
server = server.replace(old_picker, new_picker, 1)

old_vars = "const token={token_json};const input=document.getElementById('photo');const preview=document.getElementById('preview');const send=document.getElementById('send');const status=document.getElementById('status');let photo='';"
new_vars = "const token={token_json};const input=document.getElementById('photo');const cameraInput=document.getElementById('cameraPhoto');const preview=document.getElementById('preview');const send=document.getElementById('send');const status=document.getElementById('status');let photo='';"
if old_vars not in server and new_vars not in server:
    raise SystemExit("phone JS vars anchor not found")
server = server.replace(old_vars, new_vars, 1)

old_change = "input.addEventListener('change',async()=>{{const file=input.files&&input.files[0];if(!file)return;if(!/^image\\\\/(png|jpeg|webp)$/i.test(file.type)||file.size>12*1024*1024){{status.textContent='12MB以下のPNG・JPEG・WebPをえらんでください。';return}}status.textContent='写真を小さくしています…';try{{photo=await resize(file,900,.84);preview.src=photo;preview.hidden=false;send.disabled=false;status.textContent='送る準備ができました。'}}catch(e){{status.textContent='写真を読みこめませんでした。'}}}});"
new_change = "async function choosePhoto(source){{const file=source.files&&source.files[0];if(!file)return;if(!/^image\\\\/(png|jpeg|webp)$/i.test(file.type)||file.size>12*1024*1024){{status.textContent='12MB以下のPNG・JPEG・WebPをえらんでください。';source.value='';return}}status.textContent='写真を小さくしています…';try{{photo=await resize(file,900,.84);preview.src=photo;preview.hidden=false;send.disabled=false;status.textContent='送る準備ができました。'}}catch(e){{status.textContent='写真を読みこめませんでした。'}}}}\ninput.addEventListener('change',()=>choosePhoto(input));cameraInput.addEventListener('change',()=>choosePhoto(cameraInput));"
if old_change not in server and new_change not in server:
    raise SystemExit("phone change handler anchor not found")
server = server.replace(old_change, new_change, 1)

old_sent = "status.textContent='送りました。パソコンの画面を見てください。';input.disabled=true;"
new_sent = "status.textContent='送りました。パソコンの画面を見てください。';input.disabled=true;cameraInput.disabled=true;"
if old_sent not in server and new_sent not in server:
    raise SystemExit("phone sent anchor not found")
server = server.replace(old_sent, new_sent, 1)

# 3) Integration test: gallery picker has no capture, camera picker does,
# and simultaneous clients receive independent random sessions.
if "import base64, json, sys, threading" in test:
    test = test.replace("import base64, json, sys, threading", "import base64, json, re, sys, threading\nfrom concurrent.futures import ThreadPoolExecutor", 1)

old_page_test = "        with request(base,f\"/phone/photo/{token}\") as r: assert 'capture=\"user\"' in r.read().decode()"
new_page_test = '''        with request(base,f"/phone/photo/{token}") as r:\n            phone_page=r.read().decode()\n            gallery_tag=re.search(r'<input id="photo"[^>]*>',phone_page).group(0)\n            camera_tag=re.search(r'<input id="cameraPhoto"[^>]*>',phone_page).group(0)\n            assert "capture=" not in gallery_tag and 'capture="user"' in camera_tag'''
if old_page_test not in test and new_page_test not in test:
    raise SystemExit("phone page test anchor not found")
test = test.replace(old_page_test, new_page_test, 1)

isolation_anchor = '        with request(base,f"/api/photo-sessions/{token}") as r: assert json.load(r)["status"]=="received"\n'
isolation_code = '''        with request(base,f"/api/photo-sessions/{token}") as r: assert json.load(r)["status"]=="received"\n\n        # Multiple PCs/users: tokens are unique and one user cannot consume another user's photo.\n        def create_photo_session(_):\n            with request(base,"/api/photo-sessions",{}) as r: return json.load(r)["token"]\n        with ThreadPoolExecutor(max_workers=8) as pool:\n            concurrent_tokens=list(pool.map(create_photo_session,range(8)))\n        assert len(set(concurrent_tokens))==len(concurrent_tokens)\n        token_a,token_b=concurrent_tokens[:2]\n        with request(base,f"/api/photo-sessions/{token_a}/photo",{"photo":photo}) as r: assert json.load(r)["ok"] is True\n        with request(base,f"/api/photo-sessions/{token_b}") as r: assert json.load(r)["status"]=="waiting"\n        with request(base,f"/api/photo-sessions/{token_a}") as r: assert json.load(r)["status"]=="received"\n'''
if isolation_code not in test:
    if isolation_anchor not in test:
        raise SystemExit("photo isolation test anchor not found")
    test = test.replace(isolation_anchor, isolation_code, 1)

test = test.replace('print("OK: static pages, QR, phone photo, HTML share, PNG card share")', 'print("OK: static pages, QR, gallery/camera photo, concurrent isolated sessions, HTML share, PNG card share")', 1)

child_path.write_text(child, encoding="utf-8")
server_path.write_text(server, encoding="utf-8")
test_path.write_text(test, encoding="utf-8")
print("Patched decoration layering, phone gallery picker, and concurrent-session checks")
