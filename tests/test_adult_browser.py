#!/usr/bin/env python3
"""Real-browser regression test for the custom/adult mode.

This catches runtime initialization errors that syntax checks cannot detect. It runs
through the same prefixed deployment shape used by /web-first-craft/ and exercises
preview, score/help, CSS/JS changes, local/QR photos, share QR, and stale storage.
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
<title>custom mode browser regression</title>
<pre id="result">RUNNING</pre>
<iframe id="frame" src="adult.html" style="width:1200px;height:900px"></iframe>
<script>
const out = document.getElementById('result');
const STORAGE_KEY = 'jibun-page-kobo-adult-v3';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, label, timeout=9000) {
  const start = performance.now();
  while (performance.now() - start < timeout) {
    try { if (fn()) return; } catch (_) {}
    await sleep(80);
  }
  throw new Error('timeout: ' + label);
}
function assert(cond, message) { if (!cond) throw new Error(message); }
function event(type){ return new Event(type,{bubbles:true}); }
function setInput(el,value,type='input'){ el.value=value; el.dispatchEvent(event(type)); }
async function waitFrameReady(frame,label,searchMarker=''){
  await waitFor(()=>{
    try{
      const url=new URL(frame.contentWindow.location.href);
      const preview=frame.contentDocument?.querySelector('#adultPreview');
      return url.pathname.endsWith('/adult.html') && (!searchMarker || url.search.includes(searchMarker)) && Boolean(preview?.srcdoc);
    }catch(_){return false;}
  }, label + ' ready', 12000);
}
(async () => {
  const frame = document.getElementById('frame');
  await waitFrameReady(frame,'adult.html');
  let d = frame.contentDocument;
  assert(d, 'adult document unavailable');

  // Runtime initialization: preview and score must be populated on first load.
  await waitFor(()=>d.querySelector('#adultPreview')?.srcdoc, 'initial preview');
  let preview = d.querySelector('#adultPreview');
  assert(preview.srcdoc.includes('MY PROFILE'), 'initial preview HTML missing');
  assert(d.querySelector('#scoreTips')?.children.length > 0, 'initial scoring did not render');

  // Scoring help must actually open and close.
  d.querySelector('#adultHelp').click();
  await waitFor(()=>d.querySelector('#adultHelpDialog').open || d.querySelector('#adultHelpDialog').hasAttribute('open'), 'scoring dialog open');
  assert(d.querySelector('#adultHelp').getAttribute('aria-expanded') === 'true', 'help button state did not update');
  d.querySelector('#adultHelpDialog [data-close]').click();
  await waitFor(()=>!d.querySelector('#adultHelpDialog').open && !d.querySelector('#adultHelpDialog').hasAttribute('open'), 'scoring dialog close');

  // HTML input must update both score and generated preview.
  setInput(d.querySelector('#profileName'),'BROWSER TEST');
  setInput(d.querySelector('#profileTagline'),'CUSTOM MODE TEST');
  setInput(d.querySelector('#profileIntro'),'ブラウザで初期化とプレビュー更新を確認するテストです。');
  setInput(d.querySelector('#favorite1'),'HTML');
  setInput(d.querySelector('#favorite2'),'CSS');
  setInput(d.querySelector('#favorite3'),'JavaScript');
  setInput(d.querySelector('#extraTitle'),'MORE TEST');
  setInput(d.querySelector('#extraText'),'もっと見る機能のテスト本文です。');
  await waitFor(()=>Number(d.querySelector('#htmlScore').textContent.split('/')[0]) >= 30, 'HTML score update');
  await waitFor(()=>preview.srcdoc.includes('BROWSER TEST'), 'text in generated preview');

  // CSS controls must change live preview and score.
  d.querySelector('.adult-steps [data-step="1"]').click();
  await waitFor(()=>!d.querySelector('.adult-panel[data-panel="1"]').hidden, 'CSS panel');
  setInput(d.querySelector('#headingSize'),'72');
  setInput(d.querySelector('#backgroundR'),'210');
  d.querySelector('#adultLayouts [data-layout="center"]').click();
  await waitFor(()=>preview.srcdoc.includes('font-size:72px'), 'heading size in preview');
  await waitFor(()=>preview.srcdoc.includes('rgb(210, 241, 234)'), 'RGB in preview');
  assert(Number(d.querySelector('#cssScore').textContent.split('/')[0]) > 0, 'CSS score did not increase');

  // PC file selection must be converted and applied to both previews.
  d.querySelector('.adult-steps [data-step="0"]').click();
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

  // JS feature selection must affect generated output and reach full JS score when prerequisites exist.
  d.querySelector('.adult-steps [data-step="2"]').click();
  for(const id of ['jsReveal','jsRoulette','jsPhotoZoom']){
    const checkbox=d.querySelector('#'+id); checkbox.checked=true; checkbox.dispatchEvent(event('change'));
  }
  await waitFor(()=>d.querySelector('#jsScore').textContent === '20/20', 'JavaScript score');
  await waitFor(()=>preview.srcdoc.includes('id="revealButton"') && preview.srcdoc.includes('id="rouletteButton"') && preview.srcdoc.includes('id="photoZoom"'), 'JavaScript features in preview');

  // Remove the local photo, then exercise the full prefixed QR photo round trip.
  d.querySelector('.adult-steps [data-step="0"]').click();
  d.querySelector('#removeAdultPhoto').click();
  await waitFor(()=>!d.querySelector('#adultPhotoPreview img'), 'photo removal');
  d.querySelector('#adultPhonePhoto').click();
  await waitFor(()=>d.querySelector('#adultQrDialog').open, 'QR dialog open');
  let link = d.querySelector('#adultQrLink');
  await waitFor(()=>!link.hidden && /\/web-first-craft\/phone\/photo\//.test(link.href), 'prefixed QR upload URL');
  const token = link.href.split('/phone/photo/')[1].split(/[?#]/)[0];
  const photo = 'data:image/png;base64,' + png64;
  const appBase = new URL('.', location.href);
  let response = await fetch(new URL('api/photo-sessions/' + encodeURIComponent(token) + '/photo', appBase), {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({photo})
  });
  assert(response.ok, 'QR photo POST failed: ' + response.status);
  await waitFor(()=>d.querySelector('#adultPhotoPreview img'), 'QR photo applied', 11000);
  assert(d.querySelector('#adultPhotoStatus').textContent.includes('反映'), 'QR photo status missing');
  await waitFor(()=>preview.srcdoc.includes('data:image/png;base64,'), 'QR photo in generated preview');
  await waitFor(()=>!d.querySelector('#adultQrDialog').open, 'photo QR dialog auto close', 5000);

  // Completed HTML share must also use the prefixed public path.
  d.querySelector('.adult-steps [data-step="2"]').click();
  d.querySelector('#adultShare').click();
  await waitFor(()=>d.querySelector('#adultQrDialog').open, 'share QR dialog open');
  link = d.querySelector('#adultQrLink');
  await waitFor(()=>!link.hidden && /\/web-first-craft\/share\//.test(link.href), 'prefixed share URL');
  d.querySelector('#adultQrDialog [data-close]').click();
  await waitFor(()=>!d.querySelector('#adultQrDialog').open, 'share QR dialog close');

  // Old/corrupt localStorage must never prevent startup. Reload with deliberately bad types/ranges.
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    name:123, tagline:null, intro:{bad:true}, favorites:[1,null,{}], extraTitle:[], extraText:false,
    layout:'broken', fontFamily:'broken', pageWidth:'not-a-number', headingSize:9999, bodySize:-50,
    background:null, accent:{r:'bad',g:999,b:-20}, text:'bad',
    jsReveal:'true', jsRoulette:1, jsPhotoZoom:null, touched:[null,'pageWidth','unknown'], photo:'not-an-image'
  }));
  frame.src='adult.html?stale-state=1';
  await waitFrameReady(frame,'stale-state','stale-state=1');
  d=frame.contentDocument;
  await waitFor(()=>d.querySelector('#adultPreview')?.srcdoc, 'preview after stale state');
  preview=d.querySelector('#adultPreview');
  assert(preview.srcdoc.includes('MY PROFILE'), 'stale state broke preview');
  assert(d.querySelector('#profileName').value === '', 'invalid saved name was not normalized');
  assert(Number(d.querySelector('#headingSize').value) === 96, 'numeric maximum was not clamped');
  assert(Number(d.querySelector('#bodySize').value) === 12, 'numeric minimum was not clamped');
  assert(!d.querySelector('#adultPhotoPreview img'), 'invalid saved photo was not discarded');
  assert(d.querySelector('#scoreTips').children.length > 0, 'scoring failed after stale state');

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
            "--virtual-time-budget=26000",
            "--dump-dom",
            url,
        ]
        proc = subprocess.run(cmd, text=True, capture_output=True, timeout=50)
        if proc.stdout:
            print(proc.stdout)
        if proc.stderr:
            print(proc.stderr, file=sys.stderr)
        if proc.returncode != 0:
            raise RuntimeError(f"browser exited with status {proc.returncode}")
        if 'data-result="PASS"' not in proc.stdout:
            raise RuntimeError("custom mode browser regression failed")
        print("OK: custom mode runtime, HTML/CSS/JS preview, score help, local/QR photos, share QR, stale storage")
    finally:
        httpd.shutdown()
        httpd.server_close()
        thread.join(timeout=3)
        kobo.SAFE_STATIC.pop("/" + SMOKE_NAME, None)
        SMOKE_PATH.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
