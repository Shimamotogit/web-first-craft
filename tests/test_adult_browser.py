#!/usr/bin/env python3
"""Real-browser smoke test for the custom/adult mode.

This catches runtime initialization errors that syntax checks cannot detect. It runs
through the same prefixed deployment shape used by /web-first-craft/.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))
import app as kobo  # noqa: E402

SMOKE_NAME = "__adult_browser_smoke.html"
SMOKE_PATH = ROOT / "web" / SMOKE_NAME
PREFIX = "/web-first-craft"

SMOKE_HTML = r'''<!doctype html>
<meta charset="utf-8">
<title>custom mode browser smoke</title>
<pre id="result">RUNNING</pre>
<iframe id="frame" src="adult.html" style="width:1200px;height:900px"></iframe>
<script>
const out = document.getElementById('result');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, label, timeout=8000) {
  const start = performance.now();
  while (performance.now() - start < timeout) {
    try { if (fn()) return; } catch (_) {}
    await sleep(80);
  }
  throw new Error('timeout: ' + label);
}
function assert(cond, message) { if (!cond) throw new Error(message); }
function event(type){ return new Event(type,{bubbles:true}); }
(async () => {
  const frame = document.getElementById('frame');
  await new Promise((resolve,reject)=>{
    if(frame.contentDocument && frame.contentDocument.readyState === 'complete') return resolve();
    frame.addEventListener('load',resolve,{once:true});
    setTimeout(()=>reject(new Error('adult.html load timeout')),8000);
  });
  const d = frame.contentDocument;
  assert(d, 'adult document unavailable');

  // Runtime initialization: preview and score must be populated on first load.
  await waitFor(()=>d.querySelector('#adultPreview')?.srcdoc, 'initial preview');
  const preview = d.querySelector('#adultPreview');
  assert(preview.srcdoc.includes('MY PROFILE'), 'initial preview HTML missing');
  assert(d.querySelector('#scoreTips')?.children.length > 0, 'initial scoring did not render');

  // Scoring help must actually open and close.
  d.querySelector('#adultHelp').click();
  await waitFor(()=>d.querySelector('#adultHelpDialog').open || d.querySelector('#adultHelpDialog').hasAttribute('open'), 'scoring dialog open');
  assert(d.querySelector('#adultHelp').getAttribute('aria-expanded') === 'true', 'help button state did not update');
  d.querySelector('#adultHelpDialog [data-close]').click();
  await waitFor(()=>!d.querySelector('#adultHelpDialog').open && !d.querySelector('#adultHelpDialog').hasAttribute('open'), 'scoring dialog close');

  // Basic input must update both score and generated preview.
  const name = d.querySelector('#profileName');
  name.value = 'BROWSER TEST';
  name.dispatchEvent(event('input'));
  await waitFor(()=>Number(d.querySelector('#totalScore').textContent) >= 7, 'score update');
  await waitFor(()=>preview.srcdoc.includes('BROWSER TEST'), 'text in generated preview');

  // PC file selection must be converted and applied to both previews.
  const png64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2mGQAAAAASUVORK5CYII=';
  const bytes = Uint8Array.from(atob(png64), c => c.charCodeAt(0));
  const file = new File([bytes], 'profile.png', {type:'image/png'});
  const transfer = new DataTransfer();
  transfer.items.add(file);
  const input = d.querySelector('#adultPhotoInput');
  input.files = transfer.files;
  input.dispatchEvent(event('change'));
  await waitFor(()=>d.querySelector('#adultPhotoPreview img'), 'PC photo preview');
  assert(d.querySelector('#adultPhotoStatus').textContent.includes('反映'), 'PC photo status missing');
  await waitFor(()=>preview.srcdoc.includes('data:image/jpeg;base64,'), 'PC photo in generated preview');

  d.querySelector('#removeAdultPhoto').click();
  await waitFor(()=>!d.querySelector('#adultPhotoPreview img'), 'photo removal');

  // QR flow: create session from adult.js, upload through prefixed API, wait for polling.
  d.querySelector('#adultPhonePhoto').click();
  await waitFor(()=>d.querySelector('#adultQrDialog').open, 'QR dialog open');
  const link = d.querySelector('#adultQrLink');
  await waitFor(()=>!link.hidden && /\/web-first-craft\/phone\/photo\//.test(link.href), 'prefixed QR upload URL');
  const token = link.href.split('/phone/photo/')[1].split(/[?#]/)[0];
  const photo = 'data:image/png;base64,' + png64;
  const appBase = new URL('.', location.href);
  const response = await fetch(new URL('api/photo-sessions/' + encodeURIComponent(token) + '/photo', appBase), {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({photo})
  });
  assert(response.ok, 'QR photo POST failed: ' + response.status);
  await waitFor(()=>d.querySelector('#adultPhotoPreview img'), 'QR photo applied', 10000);
  assert(d.querySelector('#adultPhotoStatus').textContent.includes('反映'), 'QR photo status missing');
  await waitFor(()=>preview.srcdoc.includes('data:image/png;base64,'), 'QR photo in generated preview');

  out.textContent = 'PASS';
  document.body.dataset.result = 'PASS';
})().catch(err => {
  out.textContent = 'FAIL: ' + (err && err.stack ? err.stack : err);
  document.body.dataset.result = 'FAIL';
});
</script>
'''


def browser_executable() -> str:
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        path = shutil.which(name)
        if path:
            return path
    raise RuntimeError("Chrome/Chromium not found; custom mode browser test cannot run")


def main() -> None:
    SMOKE_PATH.write_text(SMOKE_HTML, encoding="utf-8")
    kobo.SAFE_STATIC["/" + SMOKE_NAME] = SMOKE_NAME
    kobo.photo_sessions.clear()
    kobo.share_sessions.clear()
    kobo.card_sessions.clear()
    kobo.session_create_times.clear()

    httpd = kobo.ThreadingHTTPServer(("127.0.0.1", 0), kobo.KoboHandler)
    httpd.lan_ip = "127.0.0.1"
    httpd.public_base_url = f"http://127.0.0.1:{httpd.server_port}{PREFIX}"
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{httpd.server_port}{PREFIX}/{SMOKE_NAME}"
    try:
        cmd = [
            browser_executable(),
            "--headless",
            "--no-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--disable-background-networking",
            "--virtual-time-budget=16000",
            "--dump-dom",
            url,
        ]
        proc = subprocess.run(cmd, text=True, capture_output=True, timeout=35)
        if proc.stdout:
            print(proc.stdout)
        if proc.stderr:
            print(proc.stderr, file=sys.stderr)
        if proc.returncode != 0:
            raise RuntimeError(f"browser exited with status {proc.returncode}")
        if 'data-result="PASS"' not in proc.stdout:
            raise RuntimeError("custom mode browser smoke failed")
        print("OK: custom mode runtime, preview, score help, PC photo, prefixed QR photo flow")
    finally:
        httpd.shutdown()
        httpd.server_close()
        thread.join(timeout=3)
        kobo.SAFE_STATIC.pop("/" + SMOKE_NAME, None)
        SMOKE_PATH.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
