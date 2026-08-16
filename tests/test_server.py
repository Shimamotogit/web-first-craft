#!/usr/bin/env python3
"""Integration checks for LAN QR/photo/HTML/card transfer using stdlib only."""
from __future__ import annotations
import base64, json, re, sys, threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen
ROOT=Path(__file__).resolve().parents[1]
SERVER_DIR=ROOT/"server"
sys.path.insert(0,str(SERVER_DIR))
import app as kobo  # noqa:E402

def request(base,path,payload=None):
    data=None if payload is None else json.dumps(payload,ensure_ascii=False).encode("utf-8")
    headers={"Content-Type":"application/json"} if data is not None else {}
    return urlopen(Request(base+path,data=data,headers=headers),timeout=5)

def main():
    kobo.photo_sessions.clear();kobo.share_sessions.clear();kobo.card_sessions.clear()
    httpd=kobo.ThreadingHTTPServer(("127.0.0.1",0),kobo.KoboHandler);httpd.lan_ip="127.0.0.1"
    thread=threading.Thread(target=httpd.serve_forever,daemon=True);thread.start();base=f"http://127.0.0.1:{httpd.server_port}"
    try:
        with request(base,"/api/config") as r:
            cfg=json.load(r);assert cfg["enabled"] is True and cfg["expiresMinutes"]["card"]==30
        for page in ("/","/child.html","/adult.html"):
            with request(base,page) as r: assert r.status==200 and b"<!doctype html>" in r.read().lower()
        for asset in ("/css/main.css","/css/child.css","/css/adult.css","/js/child.js","/js/adult.js"):
            with request(base,asset) as r: assert r.status==200 and len(r.read())>100
        with request(base,"/api/qr?text="+quote(base+"/card/example")) as r:
            qr=r.read();assert r.headers.get_content_type()=="image/svg+xml" and b"<svg" in qr
        with request(base,"/api/photo-sessions",{}) as r: session=json.load(r)
        token=session["token"]
        with request(base,f"/phone/photo/{token}") as r:
            phone_page=r.read().decode()
            gallery_tag=re.search(r'<input id="photo"[^>]*>',phone_page).group(0)
            camera_tag=re.search(r'<input id="cameraPhoto"[^>]*>',phone_page).group(0)
            assert "capture=" not in gallery_tag and 'capture="user"' in camera_tag
            assert 'id="back"' in phone_page and '← もどる' in phone_page and "history.back()" in phone_page
        photo="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2mGQAAAAASUVORK5CYII="
        with request(base,f"/api/photo-sessions/{token}/photo",{"photo":photo}) as r: assert json.load(r)["ok"] is True
        with request(base,f"/api/photo-sessions/{token}") as r: assert json.load(r)["status"]=="received"

        # Multiple PCs/users: tokens are unique and one user cannot consume another user's photo.
        def create_photo_session(_):
            with request(base,"/api/photo-sessions",{}) as r: return json.load(r)["token"]
        with ThreadPoolExecutor(max_workers=8) as pool:
            concurrent_tokens=list(pool.map(create_photo_session,range(8)))
        assert len(set(concurrent_tokens))==len(concurrent_tokens)
        token_a,token_b=concurrent_tokens[:2]
        with request(base,f"/api/photo-sessions/{token_a}/photo",{"photo":photo}) as r: assert json.load(r)["ok"] is True
        with request(base,f"/api/photo-sessions/{token_b}") as r: assert json.load(r)["status"]=="waiting"
        with request(base,f"/api/photo-sessions/{token_a}") as r: assert json.load(r)["status"]=="received"
        markup='<!doctype html><html lang="ja"><body><h1>test</h1></body></html>'
        with request(base,"/api/shares",{"html":markup,"filename":"test.html","nickname":"test"}) as r: share=json.load(r)
        st=urlparse(share["shareUrl"]).path.split("/")[-1]
        with request(base,f"/api/shares/{st}/download") as r: assert r.read().decode()==markup and "attachment" in r.headers.get("Content-Disposition","")
        png=base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
        dataurl="data:image/png;base64,"+base64.b64encode(png).decode()
        with request(base,"/api/cards",{"image":dataurl,"filename":"my-card.png","title":"作品カード"}) as r: card=json.load(r)
        ct=urlparse(card["cardUrl"]).path.split("/")[-1]
        with request(base,f"/card/{ct}") as r: landing=r.read().decode();assert "画像を保存する" in landing
        with request(base,f"/api/cards/{ct}/view") as r: assert r.headers.get_content_type()=="image/png" and r.read().startswith(b"\x89PNG")
        with request(base,f"/api/cards/{ct}/download") as r: assert "attachment" in r.headers.get("Content-Disposition","")
        print("OK: static pages, QR, gallery/camera photo, concurrent isolated sessions, HTML share, PNG card share")
    finally:
        httpd.shutdown();httpd.server_close();thread.join(timeout=3)
if __name__=="__main__": main()
