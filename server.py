#!/usr/bin/env python3
"""LAN-only server for じぶんページ工房.

Serves the editor, receives temporary phone photo uploads, and exposes temporary
finished-page downloads. All transfer data stays in memory and expires.
"""
from __future__ import annotations

import argparse
import html
import io
import json
import mimetypes
import os
import re
import secrets
import socket
import sys
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "vendor_py"))

try:
    import qrcode
    import qrcode.image.svg
except ImportError as exc:  # pragma: no cover
    raise SystemExit("QRコードライブラリを読み込めません。vendor_py を確認してください。") from exc

PHOTO_TTL = 20 * 60
SHARE_TTL = 30 * 60
CARD_TTL = 30 * 60
MAX_JSON_BYTES = 4 * 1024 * 1024
MAX_HTML_BYTES = 3 * 1024 * 1024
SAFE_STATIC = {
    "/": "index.html",
    "/index.html": "index.html",
    "/main.css": "main.css",
    "/child.html": "child.html",
    "/child.css": "child.css",
    "/child.js": "child.js",
    "/adult.html": "adult.html",
    "/adult.css": "adult.css",
    "/adult.js": "adult.js",
    # Legacy files are kept for migration/reference and are still directly servable.
    "/styles.css": "styles.css",
    "/app.js": "app.js",
}

sessions_lock = threading.Lock()
photo_sessions: dict[str, dict] = {}
share_sessions: dict[str, dict] = {}
card_sessions: dict[str, dict] = {}


def now() -> float:
    return time.time()


def make_token() -> str:
    return secrets.token_urlsafe(18)


def cleanup_expired() -> None:
    current = now()
    with sessions_lock:
        for store in (photo_sessions, share_sessions, card_sessions):
            expired = [key for key, value in store.items() if value["expires_at"] <= current]
            for key in expired:
                del store[key]


def get_lan_ip() -> str:
    """Best-effort IPv4 address visible to devices on the same LAN."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("192.0.2.1", 80))  # TEST-NET address; no packet is sent.
        address = sock.getsockname()[0]
        sock.close()
        if address and not address.startswith("127."):
            return address
    except OSError:
        pass

    try:
        candidates = socket.gethostbyname_ex(socket.gethostname())[2]
        for address in candidates:
            if address and not address.startswith("127."):
                return address
    except OSError:
        pass
    return "127.0.0.1"


def json_bytes(payload: object) -> bytes:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def safe_filename(value: str) -> str:
    cleaned = re.sub(r"[\\/:*?\"<>|\r\n]+", "-", str(value)).strip(" .-")[:60]
    return cleaned or "じぶんページ.html"


def phone_upload_page(token: str, expires_at: float) -> str:
    remaining = max(1, int((expires_at - now()) / 60))
    token_json = json.dumps(token)
    return f"""<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#f4c95d"><title>写真を送る｜じぶんページ工房</title>
<style>
*{{box-sizing:border-box}}body{{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;color:#2d2a26;background:#e6dccb;font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,system-ui,sans-serif;line-height:1.7}}main{{width:min(520px,100%);padding:28px;background:#fffdf7;border:3px solid #2d2a26;border-radius:16px 22px 14px 19px;box-shadow:8px 9px 0 rgba(45,42,38,.18)}}h1{{margin:.1em 0;font-size:1.65rem}}.kicker{{margin:0;color:#a8382b;font-weight:900;letter-spacing:.12em}}.notice{{padding:12px;background:#fff4ca;border-left:5px solid #d2a52c}}label{{display:block;margin-top:20px;font-weight:900}}input{{width:100%;min-height:52px;margin-top:8px;padding:10px;background:#fff;border:2px solid #776f64;border-radius:9px}}button{{width:100%;min-height:52px;margin-top:18px;color:#fff;background:#2d2a26;border:2px solid #2d2a26;border-radius:10px;font:inherit;font-weight:900;cursor:pointer}}button:disabled{{opacity:.45}}#preview{{width:150px;height:150px;margin:18px auto 0;object-fit:cover;border:3px solid #2d2a26;border-radius:48% 52% 45% 55%}}#status{{min-height:1.7em;font-weight:900}}small{{color:#625c54}}</style></head>
<body><main><p class="kicker">SAME WI-FI PHOTO</p><h1>写真をパソコンへ送る</h1>
<p class="notice">この写真は同じLAN内の作成画面へだけ送られ、約{remaining}分でサーバーのメモリから消えます。</p>
<label for="photo">写真をとる・えらぶ</label><input id="photo" type="file" accept="image/png,image/jpeg,image/webp" capture="user">
<img id="preview" alt="選んだ写真" hidden><button id="send" type="button" disabled>この写真を送る</button>
<p id="status" role="status" aria-live="polite"></p><small>顔、名札、制服、家のまわりが写っていないか、おうちの人・先生と確認してください。</small></main>
<script>
const token={token_json};const input=document.getElementById('photo');const preview=document.getElementById('preview');const send=document.getElementById('send');const status=document.getElementById('status');let photo='';
input.addEventListener('change',async()=>{{const file=input.files&&input.files[0];if(!file)return;if(!/^image\\/(png|jpeg|webp)$/i.test(file.type)||file.size>12*1024*1024){{status.textContent='12MB以下のPNG・JPEG・WebPをえらんでください。';return}}status.textContent='写真を小さくしています…';try{{photo=await resize(file,900,.84);preview.src=photo;preview.hidden=false;send.disabled=false;status.textContent='送る準備ができました。'}}catch(e){{status.textContent='写真を読みこめませんでした。'}}}});
send.addEventListener('click',async()=>{{if(!photo)return;send.disabled=true;status.textContent='パソコンへ送っています…';try{{const response=await fetch('/api/photo-sessions/'+encodeURIComponent(token)+'/photo',{{method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify({{photo}})}});const data=await response.json();if(!response.ok)throw new Error(data.error||'failed');status.textContent='送りました。パソコンの画面を見てください。';input.disabled=true;}}catch(e){{send.disabled=false;status.textContent='送れませんでした。QRコードを作り直してください。'}}}});
function resize(file,max,quality){{return new Promise((resolve,reject)=>{{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{{const image=new Image();image.onerror=reject;image.onload=()=>{{const scale=Math.min(1,max/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const context=canvas.getContext('2d',{{alpha:false}});context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',quality));}};image.src=String(reader.result)}};reader.readAsDataURL(file)}})}}
</script></body></html>"""


def share_landing_page(token: str, item: dict) -> str:
    filename = html.escape(item["filename"])
    nickname = html.escape(item.get("nickname") or "じぶんページ")
    return f"""<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#f4c95d"><title>{nickname}を受け取る</title>
<style>*{{box-sizing:border-box}}body{{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;color:#2d2a26;background:#e6dccb;font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,system-ui,sans-serif;line-height:1.7}}main{{width:min(560px,100%);padding:30px;background:#fffdf7;border:3px solid #2d2a26;border-radius:16px 22px 14px 19px;box-shadow:8px 9px 0 rgba(45,42,38,.18)}}h1{{margin:.1em 0}}.kicker{{margin:0;color:#a8382b;font-weight:900;letter-spacing:.12em}}.actions{{display:grid;gap:12px;margin-top:24px}}a{{display:grid;place-items:center;min-height:54px;padding:10px 16px;color:#2d2a26;background:#fff;border:2px solid #2d2a26;border-radius:10px;text-align:center;text-decoration:none;font-weight:900}}a.primary{{color:#fff;background:#2d2a26}}.note{{margin-top:22px;padding:12px;background:#fff4ca;border-left:5px solid #d2a52c}}code{{word-break:break-all}}</style></head>
<body><main><p class="kicker">SAME WI-FI SHARE</p><h1>{nickname}を受け取る</h1><p>同じLAN内のパソコンから、一時的に共有されています。</p>
<div class="actions"><a class="primary" href="/api/shares/{quote(token)}/download">HTMLをこの端末に保存</a><a href="/api/shares/{quote(token)}/view" target="_blank" rel="noopener">まずページを開いて見る</a></div>
<p class="note"><strong>ファイル名：</strong> <code>{filename}</code><br>この共有URLは約30分で使えなくなります。</p></main></body></html>"""


def card_landing_page(token: str, item: dict) -> str:
    title = html.escape(item.get("title") or "作品カード")
    filename = html.escape(item["filename"])
    return f"""<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#ffd45a"><title>{title}を受け取る</title>
<style>*{{box-sizing:border-box}}body{{margin:0;min-height:100vh;display:grid;place-items:center;padding:18px;color:#322f28;background:#efe6d6;font-family:"Hiragino Maru Gothic ProN","Yu Gothic",Meiryo,system-ui,sans-serif;line-height:1.6}}main{{width:min(580px,100%);padding:24px;background:#fffdf7;border:3px solid #322f28;border-radius:18px 26px 16px 22px;box-shadow:8px 9px 0 rgba(50,47,40,.16);text-align:center}}h1{{margin:.2em 0}}.kicker{{margin:0;color:#b14f45;font-weight:900;letter-spacing:.12em}}img{{display:block;width:min(360px,100%);height:auto;margin:18px auto;border:2px solid #322f28}}a{{display:grid;place-items:center;min-height:54px;padding:10px 16px;color:#fff;background:#322f28;border:2px solid #322f28;border-radius:11px;text-decoration:none;font-weight:900}}.note{{margin:16px 0 0;padding:10px;background:#fff1ad;text-align:left;font-size:.8rem}}code{{word-break:break-all}}</style></head>
<body><main><p class="kicker">MY PAGE CARD</p><h1>{title}</h1><p>つくったページを、1まいのカードにしました。</p><img src="/api/cards/{quote(token)}/view" alt="{title}"><a href="/api/cards/{quote(token)}/download">画像を保存する</a><p class="note"><strong>ファイル名：</strong> <code>{filename}</code><br>このQRは約30分で使えなくなります。</p></main></body></html>"""


class KoboHandler(BaseHTTPRequestHandler):
    server_version = "JibunPageKobo/2.0"

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stdout.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    @property
    def base_url(self) -> str:
        return f"http://{self.server.lan_ip}:{self.server.server_port}"  # type: ignore[attr-defined]

    def send_bytes(self, body: bytes, content_type: str, status: int = 200, headers: dict | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        if headers:
            for key, value in headers.items():
                self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def send_json(self, payload: object, status: int = 200) -> None:
        self.send_bytes(json_bytes(payload), "application/json; charset=utf-8", status, {"Cache-Control": "no-store"})

    def send_html(self, markup: str, status: int = 200, extra_headers: dict | None = None) -> None:
        headers = {"Cache-Control": "no-store"}
        if extra_headers:
            headers.update(extra_headers)
        self.send_bytes(markup.encode("utf-8"), "text/html; charset=utf-8", status, headers)

    def read_json(self, limit: int = MAX_JSON_BYTES) -> dict:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as exc:
            raise ValueError("bad-length") from exc
        if length <= 0 or length > limit:
            raise ValueError("too-large")
        raw = self.rfile.read(length)
        parsed = json.loads(raw.decode("utf-8"))
        if not isinstance(parsed, dict):
            raise ValueError("bad-json")
        return parsed

    def do_HEAD(self) -> None:  # noqa: N802
        self.do_GET()

    def do_GET(self) -> None:  # noqa: N802
        cleanup_expired()
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        if path == "/api/config":
            self.send_json({"enabled": True, "baseUrl": self.base_url, "expiresMinutes": {"photo": 20, "share": 30, "card": 30}})
            return

        if path == "/api/qr":
            text = parse_qs(parsed.query).get("text", [""])[0]
            if not text or len(text) > 1024:
                self.send_json({"error": "invalid-text"}, HTTPStatus.BAD_REQUEST)
                return
            image = qrcode.make(text, image_factory=qrcode.image.svg.SvgPathImage, border=2, box_size=8)
            buffer = io.BytesIO()
            image.save(buffer)
            self.send_bytes(buffer.getvalue(), "image/svg+xml; charset=utf-8", headers={"Cache-Control": "no-store"})
            return

        photo_match = re.fullmatch(r"/api/photo-sessions/([A-Za-z0-9_-]+)", path)
        if photo_match:
            token = photo_match.group(1)
            with sessions_lock:
                item = photo_sessions.get(token)
                if not item or item["expires_at"] <= now():
                    self.send_json({"error": "expired"}, HTTPStatus.GONE)
                    return
                payload = {"status": "received" if item.get("photo") else "waiting", "expiresAt": item["expires_at"]}
                if item.get("photo"):
                    payload["photo"] = item["photo"]
                    item["photo"] = ""
            self.send_json(payload)
            return

        phone_match = re.fullmatch(r"/phone/photo/([A-Za-z0-9_-]+)", path)
        if phone_match:
            token = phone_match.group(1)
            with sessions_lock:
                item = photo_sessions.get(token)
            if not item or item["expires_at"] <= now():
                self.send_html("<h1>このQRコードは時間切れです</h1><p>パソコンで作り直してください。</p>", HTTPStatus.GONE)
                return
            self.send_html(phone_upload_page(token, item["expires_at"]), extra_headers={"Content-Security-Policy": "default-src 'self' data:; img-src 'self' data:; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'"})
            return

        share_match = re.fullmatch(r"/share/([A-Za-z0-9_-]+)", path)
        if share_match:
            token = share_match.group(1)
            with sessions_lock:
                item = share_sessions.get(token)
            if not item or item["expires_at"] <= now():
                self.send_html("<h1>この共有ページは時間切れです</h1><p>パソコンでQRコードを作り直してください。</p>", HTTPStatus.GONE)
                return
            self.send_html(share_landing_page(token, item))
            return

        share_api_match = re.fullmatch(r"/api/shares/([A-Za-z0-9_-]+)/(download|view)", path)
        if share_api_match:
            token, action = share_api_match.groups()
            with sessions_lock:
                item = share_sessions.get(token)
            if not item or item["expires_at"] <= now():
                self.send_html("<h1>共有の時間が切れました</h1>", HTTPStatus.GONE)
                return
            headers = {
                "Cache-Control": "no-store",
                "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'",
            }
            if action == "download":
                encoded = quote(item["filename"])
                headers["Content-Disposition"] = f"attachment; filename*=UTF-8''{encoded}"
            self.send_bytes(item["html"].encode("utf-8"), "text/html; charset=utf-8", headers=headers)
            return

        card_match = re.fullmatch(r"/card/([A-Za-z0-9_-]+)", path)
        if card_match:
            token = card_match.group(1)
            with sessions_lock:
                item = card_sessions.get(token)
            if not item or item["expires_at"] <= now():
                self.send_html("<h1>このカードは時間切れです</h1><p>パソコンでQRコードを作り直してください。</p>", HTTPStatus.GONE)
                return
            self.send_html(card_landing_page(token, item))
            return

        card_api_match = re.fullmatch(r"/api/cards/([A-Za-z0-9_-]+)/(download|view)", path)
        if card_api_match:
            token, action = card_api_match.groups()
            with sessions_lock:
                item = card_sessions.get(token)
            if not item or item["expires_at"] <= now():
                self.send_html("<h1>カードの時間が切れました</h1>", HTTPStatus.GONE)
                return
            headers = {"Cache-Control": "no-store"}
            if action == "download":
                headers["Content-Disposition"] = f"attachment; filename*=UTF-8''{quote(item['filename'])}"
            self.send_bytes(item["image"], "image/png", headers=headers)
            return

        if path in SAFE_STATIC:
            file_path = ROOT / SAFE_STATIC[path]
            content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
            headers = {"Cache-Control": "no-cache"}
            self.send_bytes(file_path.read_bytes(), f"{content_type}; charset=utf-8" if content_type.startswith("text/") or content_type.endswith("javascript") else content_type, headers=headers)
            return

        self.send_json({"error": "not-found"}, HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:  # noqa: N802
        cleanup_expired()
        path = unquote(urlparse(self.path).path)

        if path == "/api/photo-sessions":
            token = make_token()
            expires_at = now() + PHOTO_TTL
            with sessions_lock:
                photo_sessions[token] = {"created_at": now(), "expires_at": expires_at, "photo": ""}
            upload_url = f"{self.base_url}/phone/photo/{quote(token)}"
            self.send_json({"token": token, "uploadUrl": upload_url, "expiresAt": expires_at}, HTTPStatus.CREATED)
            return

        photo_match = re.fullmatch(r"/api/photo-sessions/([A-Za-z0-9_-]+)/photo", path)
        if photo_match:
            token = photo_match.group(1)
            try:
                payload = self.read_json()
            except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
                self.send_json({"error": "invalid-body"}, HTTPStatus.BAD_REQUEST)
                return
            photo = payload.get("photo", "")
            if not isinstance(photo, str) or not re.fullmatch(r"data:image/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+", photo) or len(photo) > 2_800_000:
                self.send_json({"error": "invalid-photo"}, HTTPStatus.BAD_REQUEST)
                return
            with sessions_lock:
                item = photo_sessions.get(token)
                if not item or item["expires_at"] <= now():
                    self.send_json({"error": "expired"}, HTTPStatus.GONE)
                    return
                item["photo"] = photo
            self.send_json({"ok": True})
            return

        if path == "/api/shares":
            try:
                payload = self.read_json(MAX_HTML_BYTES + 8192)
            except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
                self.send_json({"error": "invalid-body"}, HTTPStatus.BAD_REQUEST)
                return
            markup = payload.get("html", "")
            if not isinstance(markup, str) or not markup.lstrip().lower().startswith("<!doctype html") or len(markup.encode("utf-8")) > MAX_HTML_BYTES:
                self.send_json({"error": "invalid-html"}, HTTPStatus.BAD_REQUEST)
                return
            token = make_token()
            expires_at = now() + SHARE_TTL
            filename = safe_filename(payload.get("filename", "じぶんページ.html"))
            if not filename.lower().endswith(".html"):
                filename += ".html"
            nickname = str(payload.get("nickname", ""))[:24]
            with sessions_lock:
                share_sessions[token] = {"html": markup, "filename": filename, "nickname": nickname, "created_at": now(), "expires_at": expires_at}
            share_url = f"{self.base_url}/share/{quote(token)}"
            self.send_json({"token": token, "shareUrl": share_url, "expiresAt": expires_at}, HTTPStatus.CREATED)
            return

        if path == "/api/cards":
            try:
                payload = self.read_json(MAX_JSON_BYTES)
            except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
                self.send_json({"error": "invalid-body"}, HTTPStatus.BAD_REQUEST)
                return
            image = payload.get("image", "")
            if not isinstance(image, str):
                self.send_json({"error": "invalid-image"}, HTTPStatus.BAD_REQUEST)
                return
            match = re.fullmatch(r"data:image/png;base64,([A-Za-z0-9+/=]+)", image)
            if not match:
                self.send_json({"error": "invalid-image"}, HTTPStatus.BAD_REQUEST)
                return
            import base64
            try:
                raw = base64.b64decode(match.group(1), validate=True)
            except Exception:
                self.send_json({"error": "invalid-image"}, HTTPStatus.BAD_REQUEST)
                return
            if not raw.startswith(b"\x89PNG\r\n\x1a\n") or len(raw) > 3_000_000:
                self.send_json({"error": "invalid-image"}, HTTPStatus.BAD_REQUEST)
                return
            token = make_token()
            expires_at = now() + CARD_TTL
            filename = safe_filename(payload.get("filename", "my-page-card.png"))
            if filename.lower().endswith(".html"):
                filename = filename[:-5] + ".png"
            elif not filename.lower().endswith(".png"):
                filename += ".png"
            title = str(payload.get("title", "作品カード"))[:40]
            with sessions_lock:
                card_sessions[token] = {"image": raw, "filename": filename, "title": title, "created_at": now(), "expires_at": expires_at}
            card_url = f"{self.base_url}/card/{quote(token)}"
            self.send_json({"token": token, "cardUrl": card_url, "expiresAt": expires_at}, HTTPStatus.CREATED)
            return

        self.send_json({"error": "not-found"}, HTTPStatus.NOT_FOUND)


def main() -> None:
    parser = argparse.ArgumentParser(description="じぶんページ工房をLAN内で起動します")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "4173")))
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), KoboHandler)
    server.lan_ip = get_lan_ip()  # type: ignore[attr-defined]
    local_url = f"http://localhost:{server.server_port}"
    lan_url = f"http://{server.lan_ip}:{server.server_port}"  # type: ignore[attr-defined]
    print("\nじぶんページ工房を起動しました。")
    print(f"このパソコン: {local_url}")
    print(f"同じLANから: {lan_url}")
    print("止めるときは Ctrl+C を押してください。\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n終了します。")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
