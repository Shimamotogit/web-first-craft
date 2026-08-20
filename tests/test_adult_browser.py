#!/usr/bin/env python3
"""Real-browser regression test for the custom/adult mode.

This catches runtime initialization errors that syntax checks cannot detect. It runs
through the same prefixed deployment shape used by /web-first-craft/ and exercises
preview, persistent scoring/help, CSS/JS changes, color pickers, local/QR photos,
share QR, and stale storage.
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
  assert(d.querySelector('#totalScore').textContent === '0', 'default state must score 0');
  assert([...d.querySelectorAll('#adultLayouts [data-layout]')].map(b=>b.textContent.trim()).join('/') === '左/中央/右寄せ', 'layout labels are not left/center/right');
  assert(Number.parseInt(preview.style.width,10) === 1240, 'desktop preview must use a wide virtual viewport');
  assert(!preview.srcdoc.includes('<section class="favorites">'), 'empty favorites must not render a preview section');
  assert(!preview.srcdoc.includes('<span>ゲーム</span>') && !preview.srcdoc.includes('<span>音楽</span>') && !preview.srcdoc.includes('<span>つくること</span>'), 'favorite examples must never become preview defaults');

  // Explicit no-photo choice earns its points permanently, even if the UI is reset later.
  d.querySelector('#adultNoPhoto').click();
  await waitFor(()=>d.querySelector('#adultPhotoStatus').textContent.includes('写真を載せない'), 'no-photo status');
  assert(d.querySelector('#htmlScore').textContent === '5/35', 'no-photo choice must score the photo decision');
  assert(d.querySelector('#jsScore').textContent === '6/20', 'no-photo choice must mark photo zoom as not applicable');
  assert(d.querySelector('#jsPhotoZoom').disabled, 'photo zoom must be disabled without a photo');
  assert(!preview.srcdoc.includes('id="profilePhoto"'), 'no-photo output must omit the profile photo');
  d.querySelector('#removeAdultPhoto').click();
  await waitFor(()=>d.querySelector('#htmlScore').textContent === '5/35' && d.querySelector('#jsScore').textContent === '6/20', 'sticky photo score after reset');
  assert(d.querySelector('#totalScore').textContent === '11', 'earned photo points must remain after resetting the photo choice');

  // Scoring help must actually open and close, and explain persistent scoring.
  d.querySelector('#adultHelp').click();
  await waitFor(()=>d.querySelector('#adultHelpDialog').open || d.querySelector('#adultHelpDialog').hasAttribute('open'), 'scoring dialog open');
  assert(d.querySelector('#adultHelp').getAttribute('aria-expanded') === 'true', 'help button state did not update');
  assert(d.querySelector('#adultHelpDialog').textContent.includes('元の値へ戻しても点数は残ります'), 'persistent score rule missing from help');
  d.querySelector('#adultHelpDialog [data-close]').click();
  await waitFor(()=>!d.querySelector('#adultHelpDialog').open && !d.querySelector('#adultHelpDialog').hasAttribute('open'), 'scoring dialog close');

  // HTML input must update both score and generated preview. Placeholder examples must never fill missing favorites.
  setInput(d.querySelector('#profileName'),'BROWSER TEST');
  setInput(d.querySelector('#profileTagline'),'CUSTOM MODE TEST');
  setInput(d.querySelector('#profileIntro'),'ブラウザで初期化とプレビュー更新を確認するテストです。');
  setInput(d.querySelector('#favorite1'),'HTML');
  await waitFor(()=>preview.srcdoc.includes('<span>HTML</span>'), 'one favorite preview');
  assert((preview.srcdoc.match(/class="favorite"/g)||[]).length === 1, 'one favorite must render exactly one card');
  assert(!preview.srcdoc.includes('<span>ゲーム</span>') && !preview.srcdoc.includes('<span>音楽</span>') && !preview.srcdoc.includes('<span>つくること</span>'), 'partial favorites must not be auto-filled');
  setInput(d.querySelector('#favorite2'),'CSS');
  setInput(d.querySelector('#favorite3'),'JavaScript');
  setInput(d.querySelector('#extraTitle'),'DETAIL TEST');
  setInput(d.querySelector('#extraText'),'もっと見る機能のテスト本文です。');
  await waitFor(()=>d.querySelector('#htmlScore').textContent === '35/35', 'HTML score update');
  await waitFor(()=>preview.srcdoc.includes('BROWSER TEST'), 'text in generated preview');
  assert(!preview.srcdoc.includes('<p class="section-label">MORE</p>'), 'generated preview must not show the MORE label');

  // Once HTML points are earned, clearing a field must not subtract them.
  setInput(d.querySelector('#profileName'),'');
  await waitFor(()=>preview.srcdoc.includes('<h1>YOUR NAME</h1>'), 'cleared name preview');
  assert(d.querySelector('#htmlScore').textContent === '35/35', 'clearing an earned HTML field must not subtract points');
  setInput(d.querySelector('#profileName'),'BROWSER TEST');

  d.querySelector('.adult-steps [data-step="1"]').click();
  await waitFor(()=>!d.querySelector('.adult-panel[data-panel="1"]').hidden, 'CSS panel');

  // The three layout choices must be visibly distinct: left, center, right.
  assert(preview.srcdoc.includes('<main class="profile layout-split">'), 'default left layout missing');
  d.querySelector('#adultLayouts [data-layout="offset"]').click();
  await waitFor(()=>preview.srcdoc.includes('<main class="profile layout-offset">'), 'right layout class');
  assert(preview.srcdoc.includes('.layout-offset .hero{align-items:flex-end;text-align:right}'), 'right layout CSS missing');
  d.querySelector('#adultLayouts [data-layout="split"]').click();
  await waitFor(()=>preview.srcdoc.includes('<main class="profile layout-split">'), 'left layout class');
  assert(preview.srcdoc.includes('.layout-split .hero{align-items:flex-start;text-align:left}'), 'left layout CSS missing');
  d.querySelector('#adultLayouts [data-layout="center"]').click();

  // A CSS setting earns points on its first non-default value; returning to default keeps the score.
  setInput(d.querySelector('#headingSize'),'72');
  await waitFor(()=>preview.srcdoc.includes('font-size:72px'), 'heading size in preview');
  const scoreWithHeadingChange=Number(d.querySelector('#cssScore').textContent.split('/')[0]);
  setInput(d.querySelector('#headingSize'),'58');
  await waitFor(()=>preview.srcdoc.includes('font-size:58px'), 'heading reset in preview');
  assert(Number(d.querySelector('#cssScore').textContent.split('/')[0]) === scoreWithHeadingChange, 'resetting an earned CSS value must keep its points');
  setInput(d.querySelector('#headingSize'),'72');

  // Visual color pickers must work with the mouse and stay synchronized with numeric RGB fields.
  assert(d.querySelectorAll('input[type="color"]').length === 3, 'three visual color pickers are required');
  setInput(d.querySelector('#backgroundPicker'),'#112233');
  await waitFor(()=>d.querySelector('#backgroundR').value === '17' && d.querySelector('#backgroundG').value === '34' && d.querySelector('#backgroundB').value === '51', 'color picker to RGB sync');
  await waitFor(()=>preview.srcdoc.includes('rgb(17, 34, 51)'), 'color picker in preview');
  setInput(d.querySelector('#backgroundPicker'),'#f5f1ea');
  await waitFor(()=>d.querySelector('#backgroundR').value === '245' && d.querySelector('#backgroundG').value === '241' && d.querySelector('#backgroundB').value === '234', 'restore background picker default');
  const cssAfterPickerReset=Number(d.querySelector('#cssScore').textContent.split('/')[0]);
  assert(cssAfterPickerReset >= scoreWithHeadingChange + 2, 'color picker points must remain after returning to the default color');

  // Change every CSS scoring target at least once; CSS must reach 45/45.
  setInput(d.querySelector('#fontFamily'),'serif','change');
  setInput(d.querySelector('#pageWidth'),'520');
  await waitFor(()=>preview.srcdoc.includes('width:min(520px'), 'minimum page width in preview');
  setInput(d.querySelector('#pageWidth'),'1180');
  await waitFor(()=>preview.srcdoc.includes('width:min(1180px'), 'maximum page width in preview');
  setInput(d.querySelector('#pageWidth'),'900');
  setInput(d.querySelector('#bodySize'),'17');
  setInput(d.querySelector('#photoSize'),'260');
  setInput(d.querySelector('#pagePadding'),'46');
  setInput(d.querySelector('#sectionGap'),'26');
  setInput(d.querySelector('#cornerRadius'),'20');
  setInput(d.querySelector('#borderWidth'),'3');
  setInput(d.querySelector('#shadowSize'),'13');
  setInput(d.querySelector('#backgroundR'),'210');
  await waitFor(()=>d.querySelector('#backgroundPicker').value.toLowerCase() === '#d2f1ea', 'RGB to color picker sync');
  setInput(d.querySelector('#accentR'),'38');
  setInput(d.querySelector('#textR'),'35');
  await waitFor(()=>d.querySelector('#cssScore').textContent === '45/45', 'all CSS controls tried');
  await waitFor(()=>preview.srcdoc.includes('rgb(210, 241, 234)'), 'RGB in preview');

  // PC file selection must be converted and applied to both previews without changing already-earned totals.
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
  assert(d.querySelector('#htmlScore').textContent === '35/35', 'HTML full score must remain');

  // JS feature selection must affect generated output and reach full JS score when prerequisites exist.
  d.querySelector('.adult-steps [data-step="2"]').click();
  for(const id of ['jsReveal','jsRoulette','jsPhotoZoom']){
    const checkbox=d.querySelector('#'+id); checkbox.checked=true; checkbox.dispatchEvent(event('change'));
  }
  await waitFor(()=>d.querySelector('#jsScore').textContent === '20/20', 'JavaScript score');
  await waitFor(()=>preview.srcdoc.includes('id="revealButton"') && preview.srcdoc.includes('id="rouletteButton"') && preview.srcdoc.includes('id="photoZoom"'), 'JavaScript features in preview');
  await waitFor(()=>d.querySelector('#totalScore').textContent === '100', 'all scoring targets tried must score 100');

  // Turning a feature back OFF removes it from output, but must not remove earned points.
  const revealToggle=d.querySelector('#jsReveal');
  revealToggle.checked=false; revealToggle.dispatchEvent(event('change'));
  await waitFor(()=>!preview.srcdoc.includes('id="revealButton"'), 'reveal feature off in preview');
  assert(d.querySelector('#jsScore').textContent === '20/20' && d.querySelector('#totalScore').textContent === '100', 'turning an earned JS feature off must keep its points');
  revealToggle.checked=true; revealToggle.dispatchEvent(event('change'));
  await waitFor(()=>preview.srcdoc.includes('id="revealButton"'), 'reveal feature restored');

  // The generated standalone HTML itself must keep working when opened in a normal browser.
  const runner=document.createElement('iframe');runner.id='generatedRunner';runner.style.display='none';document.body.append(runner);runner.srcdoc=preview.srcdoc;
  await waitFor(()=>runner.contentDocument?.querySelector('#rouletteButton'), 'standalone generated HTML');
  const rd=runner.contentDocument,rouletteButton=rd.querySelector('#rouletteButton'),rouletteResult=rd.querySelector('#rouletteResult');
  rouletteButton.click();await waitFor(()=>rouletteResult.textContent.includes('1回目'), 'roulette first click');const firstRoll=rouletteResult.textContent;
  rouletteButton.click();await waitFor(()=>rouletteResult.textContent.includes('2回目'), 'roulette second click');
  assert(rouletteResult.textContent !== firstRoll, 'roulette should visibly advance on every click');
  const revealButton=rd.querySelector('#revealButton'),extraPanel=rd.querySelector('#extraPanel');revealButton.click();assert(!extraPanel.hidden,'standalone reveal must open');revealButton.click();assert(extraPanel.hidden,'standalone reveal must close');
  assert(!rd.body.textContent.includes('MORE'), 'standalone generated HTML must not show a MORE label');
  runner.remove();

  // Remove the local photo, then exercise the full prefixed QR photo round trip. Scores stay at 100.
  d.querySelector('.adult-steps [data-step="0"]').click();
  d.querySelector('#removeAdultPhoto').click();
  await waitFor(()=>!d.querySelector('#adultPhotoPreview img'), 'photo removal');
  assert(d.querySelector('#totalScore').textContent === '100', 'removing a completed photo choice must keep earned points');
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
  assert(d.querySelector('#totalScore').textContent === '100', 'QR photo round trip must preserve full score');
  await waitFor(()=>!d.querySelector('#adultQrDialog').open, 'photo QR dialog auto close', 5000);
  d.querySelector('#adultNoPhoto').click();
  assert(d.querySelector('#totalScore').textContent === '100', 'explicit no-photo path must preserve full score');
  assert(!preview.srcdoc.includes('id="profilePhoto"'), 'full-score no-photo output must omit photo');

  // Completed HTML share must also use the prefixed public path.
  d.querySelector('.adult-steps [data-step="2"]').click();
  d.querySelector('#adultShare').click();
  await waitFor(()=>d.querySelector('#adultQrDialog').open, 'share QR dialog open');
  link = d.querySelector('#adultQrLink');
  await waitFor(()=>!link.hidden && /\/web-first-craft\/share\//.test(link.href), 'prefixed share URL');
  d.querySelector('#adultQrDialog [data-close]').click();
  await waitFor(()=>!d.querySelector('#adultQrDialog').open, 'share QR dialog close');

  // Old/corrupt localStorage must never prevent startup. Valid historic earned keys survive normalization.
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
  assert(d.querySelector('#cssScore').textContent.startsWith('8/'), 'valid saved and migrated CSS achievements were not preserved');
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
            "--virtual-time-budget=28000",
            "--dump-dom",
            url,
        ]
        proc = subprocess.run(cmd, text=True, capture_output=True, timeout=55)
        if proc.stdout:
            print(proc.stdout)
        if proc.stderr:
            print(proc.stderr, file=sys.stderr)
        if proc.returncode != 0:
            raise RuntimeError(f"browser exited with status {proc.returncode}")
        if 'data-result="PASS"' not in proc.stdout:
            raise RuntimeError("custom mode browser regression failed")
        print("OK: custom mode runtime, persistent scoring, preview, color picker, local/QR photos, share QR, stale storage")
    finally:
        httpd.shutdown()
        httpd.server_close()
        thread.join(timeout=3)
        kobo.SAFE_STATIC.pop("/" + SMOKE_NAME, None)
        SMOKE_PATH.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
