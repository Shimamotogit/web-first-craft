from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    return text.replace(old, new, 1)


# child.js: derive app root from the loaded script URL.
p = Path("web/js/child.js")
text = p.read_text(encoding="utf-8")
text = replace_once(
    text,
    '  const STORAGE_KEY = "jibun-page-kobo-child-v3";\n  const APP_BASE = new URL(".", window.location.href);\n  const appUrl = path => new URL(String(path).replace(/^\\/+/, ""), APP_BASE).toString();',
    '  const STORAGE_KEY = "jibun-page-kobo-child-v3";\n  const SCRIPT_URL = document.currentScript?.src || new URL("js/child.js", window.location.href).toString();\n  const APP_BASE = new URL("../", SCRIPT_URL);\n  const appUrl = path => new URL(String(path).replace(/^\\/+/, ""), APP_BASE).toString();',
    "child app base",
)
p.write_text(text, encoding="utf-8")

# adult.js: same robust app root for its QR photo flow.
p = Path("web/js/adult.js")
text = p.read_text(encoding="utf-8")
text = replace_once(
    text,
    '  const STORAGE_KEY="jibun-page-kobo-adult-v3";\n  const APP_BASE=new URL(".",window.location.href);\n  const appUrl=path=>new URL(String(path).replace(/^\\/+/,""),APP_BASE).toString();',
    '  const STORAGE_KEY="jibun-page-kobo-adult-v3";\n  const SCRIPT_URL=document.currentScript?.src||new URL("js/adult.js",window.location.href).toString();\n  const APP_BASE=new URL("../",SCRIPT_URL);\n  const appUrl=path=>new URL(String(path).replace(/^\\/+/,""),APP_BASE).toString();',
    "adult app base",
)
p.write_text(text, encoding="utf-8")

# server/app.py: compress phone photos to a proxy-safe payload and improve send errors.
p = Path("server/app.py")
text = p.read_text(encoding="utf-8")
text = replace_once(
    text,
    "async function choosePhoto(source){{const file=source.files&&source.files[0];if(!file)return;if(!/^image\\\\/(png|jpeg|webp)$/i.test(file.type)||file.size>12*1024*1024){{status.textContent='12MB以下のPNG・JPEG・WebPをえらんでください。';source.value='';return}}status.textContent='写真を小さくしています…';try{{photo=await resize(file,900,.84);preview.src=photo;preview.hidden=false;send.disabled=false;status.textContent='送る準備ができました。'}}catch(e){{status.textContent='写真を読みこめませんでした。'}}}}",
    "const MAX_TRANSFER_DATA_URL=850000;\nasync function choosePhoto(source){{const file=source.files&&source.files[0];if(!file)return;if(!/^image\\\\/(png|jpeg|webp)$/i.test(file.type)||file.size>12*1024*1024){{status.textContent='12MB以下のPNG・JPEG・WebPをえらんでください。';source.value='';return}}status.textContent='写真を送れるサイズにしています…';send.disabled=true;try{{photo=await resizeForTransfer(file);preview.src=photo;preview.hidden=false;send.disabled=false;status.textContent='送る準備ができました。'}}catch(e){{photo='';preview.hidden=true;status.textContent='写真を読みこめませんでした。別の写真をえらんでください。'}}}}",
    "phone choose photo",
)
text = replace_once(
    text,
    "const data=await response.json();if(!response.ok)throw new Error(data.error||'failed');status.textContent='送りました。パソコンの画面を見てください。';input.disabled=true;cameraInput.disabled=true;}}catch(e){{send.disabled=false;status.textContent='送れませんでした。QRコードを作り直してください。'}}}});",
    "let data={{}};try{{data=await response.json();}}catch(_e){{}}if(!response.ok){{if(response.status===413)throw new Error('too-large');if(response.status===410)throw new Error('expired');throw new Error(data.error||'failed');}}status.textContent='送りました。パソコンの画面を見てください。';input.disabled=true;cameraInput.disabled=true;}}catch(e){{send.disabled=false;status.textContent=e.message==='expired'?'QRコードの時間が切れました。パソコンで作り直してください。':e.message==='too-large'?'写真が大きすぎました。別の写真をえらんでください。':'送れませんでした。通信を確認して、もういちどためしてください。';}}}});",
    "phone send errors",
)
old_resize = "function resize(file,max,quality){{return new Promise((resolve,reject)=>{{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{{const image=new Image();image.onerror=reject;image.onload=()=>{{const scale=Math.min(1,max/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const context=canvas.getContext('2d',{{alpha:false}});context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',quality));}};image.src=String(reader.result)}};reader.readAsDataURL(file)}})}}"
new_resize = "function loadImage(file){{return new Promise((resolve,reject)=>{{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{{const image=new Image();image.onerror=reject;image.onload=()=>resolve(image);image.src=String(reader.result)}};reader.readAsDataURL(file)}})}}\nfunction encodeImage(image,max,quality){{const scale=Math.min(1,max/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const context=canvas.getContext('2d',{{alpha:false}});if(!context)throw new Error('canvas');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',quality)}}\nasync function resizeForTransfer(file){{const image=await loadImage(file);const attempts=[[900,.84],[900,.76],[800,.74],[720,.72],[640,.70],[560,.68]];let result='';for(const [max,quality] of attempts){{result=encodeImage(image,max,quality);if(result.length<=MAX_TRANSFER_DATA_URL)return result;}}throw new Error('too-large')}}"
text = replace_once(text, old_resize, new_resize, "phone adaptive resize")
p.write_text(text, encoding="utf-8")

# test_server.py: complete the prefixed phone photo round trip.
p = Path("tests/test_server.py")
text = p.read_text(encoding="utf-8")
old = '''        sub_token=sub_session["token"]\n        with request(base,f"/my-site/phone/photo/{sub_token}") as r:\n            sub_phone=r.read().decode();assert 'const basePath="/my-site"' in sub_phone\n        with request(base,"/my-site/") as r: assert r.status==200 and b"<!doctype html>" in r.read().lower()\n'''
new = '''        sub_token=sub_session["token"]\n        with request(base,f"/my-site/phone/photo/{sub_token}") as r:\n            sub_phone=r.read().decode();assert 'const basePath="/my-site"' in sub_phone and "MAX_TRANSFER_DATA_URL=850000" in sub_phone\n        sub_photo="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2mGQAAAAASUVORK5CYII="\n        with request(base,f"/my-site/api/photo-sessions/{sub_token}/photo",{"photo":sub_photo}) as r: assert json.load(r)["ok"] is True\n        with request(base,f"/my-site/api/photo-sessions/{sub_token}") as r:\n            received=json.load(r);assert received["status"]=="received" and received["photo"]==sub_photo\n        with request(base,"/my-site/") as r: assert r.status==200 and b"<!doctype html>" in r.read().lower()\n'''
text = replace_once(text, old, new, "subpath end-to-end photo test")
p.write_text(text, encoding="utf-8")

# Deployment docs: Nginx should accept the app's JSON/image payloads.
p = Path("docs/public-deployment.md")
text = p.read_text(encoding="utf-8")
old = '''location ^~ /my-site/ {\n    proxy_pass http://127.0.0.1:4173;\n    proxy_set_header Host $host;\n    proxy_set_header X-Forwarded-Proto $scheme;\n    proxy_set_header X-Real-IP $remote_addr;\n}\n'''
new = '''location ^~ /my-site/ {\n    # 写真・カード送信をNginx側で小さすぎる上限に止められないようにする。\n    client_max_body_size 4m;\n\n    proxy_pass http://127.0.0.1:4173;\n    proxy_set_header Host $host;\n    proxy_set_header X-Forwarded-Proto $scheme;\n    proxy_set_header X-Real-IP $remote_addr;\n}\n'''
text = replace_once(text, old, new, "nginx body limit")
text = text.replace(
    '設定後は `https://zovira.jp/my-site/api/config` で確認できます。',
    '設定後は `https://zovira.jp/my-site/api/config` で確認できます。`/web-first-craft/` で公開する場合は、同じ設定の `/my-site` を `/web-first-craft` に置き換えてください。',
)
p.write_text(text, encoding="utf-8")
