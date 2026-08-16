#!/usr/bin/env python3
"""Integration checks for local/public QR, photo, HTML and card transfer."""
from __future__ import annotations
import base64, json, re, sys, threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote, urlparse
from urllib.error import HTTPError
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
    kobo.photo_sessions.clear();kobo.share_sessions.clear();kobo.card_sessions.clear();kobo.session_create_times.clear()
    httpd=kobo.ThreadingHTTPServer(("127.0.0.1",0),kobo.KoboHandler);httpd.lan_ip="127.0.0.1";httpd.public_base_url=""
    thread=threading.Thread(target=httpd.serve_forever,daemon=True);thread.start();base=f"http://127.0.0.1:{httpd.server_port}"
    try:
        with request(base,"/api/config") as r:
            cfg=json.load(r);assert cfg["enabled"] is True and cfg["expiresMinutes"]["card"]==30 and cfg["limits"]["activeSessions"]==kobo.MAX_ACTIVE_SESSIONS and cfg["mode"]=="local"
        with request(base,"/healthz") as r: assert json.load(r)["ok"] is True
        public_req=Request(base+"/api/config",headers={"Host":"craft.example.test","X-Forwarded-Proto":"https"})
        with urlopen(public_req,timeout=5) as r:
            public_cfg=json.load(r);assert public_cfg["baseUrl"]=="https://craft.example.test" and public_cfg["mode"]=="public"
        httpd.public_base_url="https://public.example.test"
        with request(base,"/api/photo-sessions",{}) as r:
            public_session=json.load(r);assert public_session["uploadUrl"].startswith("https://public.example.test/phone/photo/")
        httpd.public_base_url=""
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
        markup='<!doctype html><html lang="ja"><body><h1>test</h1><button id="b">open</button><script>document.getElementById("b").textContent="ok"</script></body></html>'
        with request(base,"/api/shares",{"html":markup,"filename":"test.html","nickname":"test"}) as r: share=json.load(r)
        st=urlparse(share["shareUrl"]).path.split("/")[-1]
        with request(base,f"/api/shares/{st}/view") as r:
            assert r.read().decode()==markup
            csp=r.headers.get("Content-Security-Policy","")
            assert "script-src 'unsafe-inline'" in csp and "sandbox allow-scripts" in csp and "connect-src 'none'" in csp
        with request(base,f"/api/shares/{st}/download") as r: assert r.read().decode()==markup and "attachment" in r.headers.get("Content-Disposition","")
        png=base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
        dataurl="data:image/png;base64,"+base64.b64encode(png).decode()
        with request(base,"/api/cards",{"image":dataurl,"filename":"my-card.png","title":"作品カード"}) as r: card=json.load(r)
        ct=urlparse(card["cardUrl"]).path.split("/")[-1]
        with request(base,f"/card/{ct}") as r: landing=r.read().decode();assert "画像を保存する" in landing
        with request(base,f"/api/cards/{ct}/view") as r: assert r.headers.get_content_type()=="image/png" and r.read().startswith(b"\x89PNG")
        with request(base,f"/api/cards/{ct}/download") as r: assert "attachment" in r.headers.get("Content-Disposition","")

        # Public traffic cannot evict active participant sessions when capacity is full.
        original_limit=kobo.MAX_ACTIVE_SESSIONS
        original_rate=kobo.MAX_SESSION_CREATES_PER_MINUTE
        try:
            with kobo.sessions_lock:
                kobo.photo_sessions.clear();kobo.share_sessions.clear();kobo.card_sessions.clear();kobo.session_create_times.clear()
            kobo.MAX_ACTIVE_SESSIONS=4
            kobo.MAX_SESSION_CREATES_PER_MINUTE=20
            created=[]
            for _ in range(4):
                with request(base,"/api/photo-sessions",{}) as r: created.append(json.load(r)["token"])
            try:
                request(base,"/api/photo-sessions",{})
                raise AssertionError("capacity limit did not reject a new session")
            except HTTPError as exc:
                assert exc.code==503
            with kobo.sessions_lock:
                assert set(created).issubset(kobo.photo_sessions)
                kobo.photo_sessions.clear();kobo.session_create_times.clear()
            kobo.MAX_ACTIVE_SESSIONS=20
            kobo.MAX_SESSION_CREATES_PER_MINUTE=2
            for _ in range(2):
                with request(base,"/api/photo-sessions",{}) as r: assert json.load(r)["token"]
            try:
                request(base,"/api/photo-sessions",{})
                raise AssertionError("rate limit did not reject session creation")
            except HTTPError as exc:
                assert exc.code==429
        finally:
            kobo.MAX_ACTIVE_SESSIONS=original_limit
            kobo.MAX_SESSION_CREATES_PER_MINUTE=original_rate
        print("OK: local/public URL generation, static pages, QR, gallery/camera photo, concurrent isolated sessions, sandboxed HTML share, bounded/rate-limited sessions, PNG card share")
    finally:
        httpd.shutdown();httpd.server_close();thread.join(timeout=3)
if __name__=="__main__": main()
