(() => {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const STORAGE_KEY = "jibun-page-kobo-child-v1";

  const defaults = {
    avatar: "🐧",
    name: "",
    favorites: [],
    phrase: "よろしくね！",
    customPhrase: "",
    theme: "sun",
    layout: "big",
    decor: "stars",
    motion: "pop",
    magic: "heart"
  };
  const state = { ...defaults, ...loadState() };
  if (!Array.isArray(state.favorites)) state.favorites = [];

  const kanaPages = {
    basic: [..."あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんー"],
    voiced: [..."がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ"],
    small: ["ぁ","ぃ","ぅ","ぇ","ぉ","ゃ","ゅ","ょ","っ","ゔ","・","　"]
  };

  const panels = $$(".kid-panel");
  const steps = $$(".lesson-step");
  const preview = $("#kidPreview");
  const nameOutput = $("#kidName");
  const phraseOutput = $("#kidPhrase");
  const learned = $("#learnedText");
  const kanaGrid = $("#kanaGrid");
  const toast = $("#kidToast");
  let currentStep = 0;
  let activePadTarget = "name";
  let kanaPage = "basic";
  let lanInfo = { enabled: false, baseUrl: "" };
  let toastTimer = 0;

  init();

  function init() {
    restoreControls();
    renderKana();
    bind();
    renderAll();
    checkLan();
  }

  function bind() {
    steps.forEach((button) => button.addEventListener("click", () => showStep(Number(button.dataset.step))));
    $$("[data-next]").forEach((button) => button.addEventListener("click", () => showStep(Number(button.dataset.next))));
    $$("[data-back]").forEach((button) => button.addEventListener("click", () => showStep(Number(button.dataset.back))));

    $$(".avatar").forEach((button) => button.addEventListener("click", () => {
      state.avatar = button.dataset.avatar || "🐧";
      selectOne(".avatar", button);
      changed();
    }));

    $$("#kidFavorites button").forEach((button) => button.addEventListener("click", () => {
      const value = button.dataset.value || "";
      if (state.favorites.includes(value)) {
        state.favorites = state.favorites.filter((item) => item !== value);
        button.classList.remove("selected");
        button.setAttribute("aria-pressed", "false");
      } else if (state.favorites.length < 3) {
        state.favorites.push(value);
        button.classList.add("selected");
        button.setAttribute("aria-pressed", "true");
      } else {
        showToast("すきなものは 3こまで えらべるよ");
        return;
      }
      changed();
    }));

    $$("#phraseGrid button").forEach((button) => button.addEventListener("click", () => {
      state.phrase = button.dataset.value || "";
      state.customPhrase = "";
      phraseOutput.textContent = "ことば";
      selectOne("#phraseGrid button", button);
      changed();
    }));

    bindChoice("#kidThemes [data-theme]", "theme");
    bindChoice("#kidLayouts [data-layout]", "layout");
    bindChoice("#kidDecor [data-decor]", "decor");
    bindChoice("#kidMotions [data-motion]", "motion");
    bindChoice("#kidMagic [data-magic]", "magic");

    $$(".pad-target[data-target]").forEach((button) => button.addEventListener("click", () => {
      activePadTarget = button.dataset.target === "kidPhrase" ? "phrase" : "name";
      $$(".pad-target[data-target]").forEach((item) => {
        const yes = item === button;
        item.classList.toggle("active", yes);
        item.setAttribute("aria-pressed", String(yes));
      });
      $("#padHint").textContent = activePadTarget === "name" ? "なまえを いれてね" : "ひとことを つくってね";
    }));

    $("#backspaceButton").addEventListener("click", () => {
      state.name = [...state.name].slice(0, -1).join("");
      changed();
    });
    $("#clearNameButton").addEventListener("click", () => {
      state.name = "";
      changed();
    });
    $("#backspacePhraseButton").addEventListener("click", () => {
      state.customPhrase = [...state.customPhrase].slice(0, -1).join("");
      state.phrase = state.customPhrase || "よろしくね！";
      if (!state.customPhrase) $$("#phraseGrid button").forEach((button) => setSelected(button, button.dataset.value === state.phrase));
      changed();
    });
    $("#clearPhraseButton").addEventListener("click", () => {
      state.customPhrase = "";
      state.phrase = "よろしくね！";
      $$("#phraseGrid button").forEach((button) => setSelected(button, button.dataset.value === state.phrase));
      changed();
    });

    $$("[data-kana-page]").forEach((button) => button.addEventListener("click", () => {
      kanaPage = button.dataset.kanaPage || "basic";
      $$("[data-kana-page]").forEach((b) => b.classList.toggle("active", b === button));
      renderKana();
    }));

    $("#voiceButton").addEventListener("click", readCurrentInstruction);
    $("#makeCardButton").addEventListener("click", openCardDialog);
    $("#closeCardDialog").addEventListener("click", () => $("#cardDialog").close());
    $("#downloadCardDirect").addEventListener("click", downloadCard);
    $("#kidDownloadHtml").addEventListener("click", downloadHtml);
    $("#cardDialog").addEventListener("click", (event) => { if (event.target === $("#cardDialog")) $("#cardDialog").close(); });
  }

  function bindChoice(selector, key) {
    $$(selector).forEach((button) => button.addEventListener("click", () => {
      state[key] = button.dataset[key] || defaults[key];
      selectOne(selector, button);
      changed();
    }));
  }

  function selectOne(selector, selected) {
    $$(selector).forEach((button) => {
      const yes = button === selected;
      button.classList.toggle("selected", yes);
      button.setAttribute("aria-pressed", String(yes));
    });
  }

  function restoreControls() {
    nameOutput.textContent = state.name || "なまえ";
    phraseOutput.textContent = state.customPhrase || "ことば";
    $$(".avatar").forEach((b) => setSelected(b, b.dataset.avatar === state.avatar));
    $$("#kidFavorites button").forEach((b) => setSelected(b, state.favorites.includes(b.dataset.value || "")));
    $$("#phraseGrid button").forEach((b) => setSelected(b, b.dataset.value === state.phrase));
    restoreChoice("#kidThemes [data-theme]", "theme");
    restoreChoice("#kidLayouts [data-layout]", "layout");
    restoreChoice("#kidDecor [data-decor]", "decor");
    restoreChoice("#kidMotions [data-motion]", "motion");
    restoreChoice("#kidMagic [data-magic]", "magic");
  }

  function restoreChoice(selector, key) {
    $$(selector).forEach((b) => setSelected(b, b.dataset[key] === state[key]));
  }

  function setSelected(button, yes) {
    button.classList.toggle("selected", yes);
    button.setAttribute("aria-pressed", String(yes));
  }

  function renderKana() {
    kanaGrid.replaceChildren();
    kanaPages[kanaPage].forEach((char) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = char === "　" ? "空" : char;
      button.setAttribute("aria-label", char === "　" ? "くうはく" : char);
      button.addEventListener("click", () => {
        if (activePadTarget === "name") {
          if ([...state.name].length >= 10) { showToast("なまえは 10もじまでだよ"); return; }
          state.name += char;
        } else {
          if ([...state.customPhrase].length >= 22) { showToast("ひとことは 22もじまでだよ"); return; }
          state.customPhrase += char;
          state.phrase = state.customPhrase;
          $$("#phraseGrid button").forEach((button) => setSelected(button, false));
        }
        changed();
      });
      kanaGrid.append(button);
    });
  }

  function showStep(index) {
    currentStep = Math.max(0, Math.min(2, index));
    panels.forEach((panel, i) => {
      panel.hidden = i !== currentStep;
      panel.classList.toggle("active", i === currentStep);
    });
    steps.forEach((step, i) => {
      step.classList.toggle("active", i === currentStep);
      if (i === currentStep) step.setAttribute("aria-current", "step"); else step.removeAttribute("aria-current");
    });
    const notes = [
      "<b>HTML</b> は、ページの『なかみ』をつくるもの。",
      "<b>CSS</b> は、いろ・かたち・ならべかたをきめるもの。",
      "<b>JavaScript</b> は、ページに『うごき』をつけるもの。"
    ];
    learned.innerHTML = notes[currentStep];
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function changed() {
    nameOutput.textContent = state.name || "なまえ";
    phraseOutput.textContent = state.customPhrase || "ことば";
    saveState();
    renderPreview();
  }

  function renderAll() {
    nameOutput.textContent = state.name || "なまえ";
    phraseOutput.textContent = state.customPhrase || "ことば";
    renderPreview();
  }

  function renderPreview() {
    preview.srcdoc = buildKidHtml(false);
  }

  function buildKidHtml(standalone = true) {
    const name = escapeHtml(state.name.trim() || "なまえ");
    const phrase = escapeHtml(state.phrase || "よろしくね！");
    const avatar = escapeHtml(state.avatar);
    const favorites = state.favorites.length ? state.favorites : ["すきなもの"];
    const favMarkup = favorites.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    const magicScript = buildMagicScript(state.magic);
    const title = standalone ? `${name}のページ` : "つくっているページ";
    return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:22px;color:#322f28;font-family:"Hiragino Maru Gothic ProN","Yu Gothic",Meiryo,system-ui,sans-serif;overflow-x:hidden}.page{position:relative;width:min(720px,100%);min-height:520px;padding:clamp(24px,6vw,52px);overflow:hidden;border:4px solid #322f28;box-shadow:9px 10px 0 rgba(50,47,40,.16);cursor:pointer;user-select:none}.hero{position:relative;z-index:2}.avatar{display:grid;place-items:center;width:150px;height:150px;font-size:5.5rem;background:#fff;border:4px solid #322f28}.name{margin:18px 0 5px;font-size:clamp(2.2rem,8vw,5rem);line-height:1;word-break:break-all}.phrase{margin:0;font-size:clamp(1.05rem,3vw,1.5rem);font-weight:900}.label{margin:34px 0 8px;font-size:.78rem;font-weight:900;letter-spacing:.08em}.favorites{position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:9px;margin:0;padding:0;list-style:none}.favorites li{padding:8px 13px;background:#fff;border:3px solid #322f28;font-weight:900}.hint{position:relative;z-index:2;margin:30px 0 0;font-size:.72rem;font-weight:900;opacity:.7}.theme-sun{background:#ffe369}.theme-sky{background:linear-gradient(#99ddf3 0 68%,#dff8ff 68%)}.theme-forest{background:#cbe5ae;background-image:radial-gradient(#65935c 2px,transparent 2px);background-size:25px 25px}.theme-candy{background:linear-gradient(135deg,#ffb3c4 0 33%,#fff0a6 33% 66%,#afe6e5 66%)}.layout-big .avatar{border-radius:46% 54% 45% 55%;transform:rotate(-4deg)}.layout-big .name{font-size:clamp(3rem,10vw,6rem)}.layout-cards{display:grid;grid-template-columns:180px 1fr;align-items:center;gap:25px}.layout-cards .hero{grid-column:1/3;display:grid;grid-template-columns:170px 1fr;gap:22px;align-items:center}.layout-cards .name{margin-top:0}.layout-cards .label,.layout-cards .favorites,.layout-cards .hint{grid-column:1/3}.layout-cards .avatar{border-radius:20px}.layout-stripe{background-color:#fff7e3;background-image:repeating-linear-gradient(0deg,transparent 0 46px,rgba(60,120,160,.18) 46px 49px)}.layout-stripe::before{content:"";position:absolute;left:42px;top:0;bottom:0;border-left:4px solid rgba(222,85,85,.42)}.layout-stripe .hero,.layout-stripe .label,.layout-stripe .favorites,.layout-stripe .hint{margin-left:44px}.decor-stars::after{content:"★  ✦  ★";position:absolute;right:22px;top:18px;font-size:2rem;transform:rotate(8deg)}.decor-dots::after{content:"● ● ● ● ●";position:absolute;right:18px;bottom:16px;letter-spacing:7px;color:rgba(50,47,40,.38)}.decor-tape::after{content:"";position:absolute;right:35px;top:22px;width:100px;height:28px;background:rgba(255,255,255,.65);border:1px solid rgba(50,47,40,.2);transform:rotate(8deg)}.motion-pop{animation:pop .55s cubic-bezier(.2,1.5,.4,1) both}.motion-float .avatar{animation:float 2.5s ease-in-out infinite}.motion-spin .avatar{animation:spin .8s ease-out both}@keyframes pop{from{opacity:0;transform:scale(.75) rotate(-2deg)}to{opacity:1;transform:none}}@keyframes float{50%{transform:translateY(-12px) rotate(3deg)}}@keyframes spin{from{transform:rotate(-200deg) scale(.3)}to{transform:rotate(0) scale(1)}}.spark{position:fixed;z-index:9;pointer-events:none;font-size:2rem;animation:spark .9s ease-out forwards}@keyframes spark{to{transform:translate(var(--x),-100px) rotate(30deg);opacity:0}}@keyframes jump{50%{transform:translateY(-22px) scale(1.08)}}@media(max-width:540px){body{padding:8px}.page{min-height:540px;padding:24px 20px}.layout-cards{display:block}.layout-cards .hero{display:block}.layout-cards .label,.layout-cards .favorites,.layout-cards .hint{grid-column:auto}.layout-stripe .hero,.layout-stripe .label,.layout-stripe .favorites,.layout-stripe .hint{margin-left:25px}.layout-stripe::before{left:25px}.avatar{width:120px;height:120px;font-size:4.2rem}}
</style></head><body><main id="page" class="page theme-${state.theme} layout-${state.layout} decor-${state.decor} motion-${state.motion}" aria-label="${name}のじこしょうかいページ"><section class="hero"><div class="avatar" aria-hidden="true">${avatar}</div><div><h1 class="name">${name}</h1><p class="phrase">${phrase}</p></div></section><p class="label">すきなもの</p><ul class="favorites">${favMarkup}</ul><p class="hint">このページを おしてみてね！</p></main>${magicScript}</body></html>`;
  }

  function buildMagicScript(magic) {
    if (magic === "none") return "";
    if (magic === "heart") return `<script>document.getElementById('page').addEventListener('click',e=>{for(let i=0;i<5;i++){const s=document.createElement('span');s.className='spark';s.textContent='💛';s.style.left=(e.clientX-10)+'px';s.style.top=(e.clientY-10)+'px';s.style.setProperty('--x',((Math.random()-.5)*150)+'px');document.body.append(s);setTimeout(()=>s.remove(),950)}})<\/script>`;
    if (magic === "color") return `<script>const p=document.getElementById('page');const c=['#ffe369','#9fddf2','#cbe5ae','#ffb3c4','#c8b7ef'];let i=0;p.addEventListener('click',()=>{i=(i+1)%c.length;p.style.background=c[i]})<\/script>`;
    return `<script>const p=document.getElementById('page');p.addEventListener('click',()=>{p.style.animation='jump .5s ease';setTimeout(()=>p.style.animation='',520)})<\/script>`;
  }

  function readCurrentInstruction() {
    if (!("speechSynthesis" in window)) {
      showToast("このブラウザでは よみあげが つかえません");
      return;
    }
    const texts = [
      "ステップ1、HTMLのおしごと。ページになにをのせるか、なかみをつくろう。マークとなまえと、すきなものをえらんでね。",
      "ステップ2、CSSのおしごと。ページのいろ、ならべかた、かざりをえらんで、みためをかえよう。",
      "ステップ3、JavaScriptのおしごと。ページがでてくるうごきと、おしたときにおこることをえらぼう。"
    ];
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(texts[currentStep]);
    utterance.lang = "ja-JP";
    utterance.rate = 0.85;
    speechSynthesis.speak(utterance);
  }

  async function openCardDialog() {
    drawCard();
    const dialog = $("#cardDialog");
    dialog.showModal();
    const box = $("#cardQrBox");
    const status = $("#cardQrStatus");
    const link = $("#cardShareLink");
    box.innerHTML = "<span>QRをつくっています…</span>";
    link.hidden = true;
    if (!state.name.trim()) {
      status.textContent = "なまえを いれると カードをおくれるよ。";
      box.innerHTML = "<span>なまえを いれてね</span>";
      return;
    }
    if (!lanInfo.enabled && !(await checkLan())) {
      status.textContent = "QRは python server.py で起動したときにつかえるよ。このパソコンへの保存はできます。";
      box.innerHTML = "<span>LANモードで QRがつかえます</span>";
      return;
    }
    try {
      const canvas = $("#cardCanvas");
      const dataUrl = canvas.toDataURL("image/png");
      const response = await fetch("/api/cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: dataUrl, filename: `${safeFilename(state.name)}-card.png`, title: `${state.name}のカード` }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "failed");
      const img = new Image();
      img.alt = "カードをうけとるQRコード";
      img.onload = () => { box.replaceChildren(img); };
      img.onerror = () => { box.innerHTML = "<span>QRをだせませんでした</span>"; };
      img.src = `/api/qr?text=${encodeURIComponent(data.cardUrl)}&t=${Date.now()}`;
      link.href = data.cardUrl;
      link.hidden = false;
      status.textContent = "おなじWi-Fiのスマホで よみこんで、画像をほぞんしてね。";
    } catch (error) {
      box.innerHTML = "<span>QRをつくれませんでした</span>";
      status.textContent = "このパソコンへの画像保存はできます。";
    }
  }

  function drawCard() {
    const canvas = $("#cardCanvas");
    const ctx = canvas.getContext("2d");
    const palettes = {
      sun: ["#ffe369", "#fff9e7", "#d79a28"],
      sky: ["#9fddf2", "#f2fbff", "#2f83a1"],
      forest: ["#cbe5ae", "#f6faef", "#58824f"],
      candy: ["#ffb3c4", "#fff7d9", "#bc5270"]
    };
    const [bg, paper, accent] = palettes[state.theme] || palettes.sun;
    ctx.clearRect(0, 0, 900, 1200);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 900, 1200);
    ctx.fillStyle = "rgba(50,47,40,.18)"; roundRect(ctx, 74, 83, 770, 1040, 30); ctx.fill();
    ctx.fillStyle = paper; roundRect(ctx, 55, 60, 770, 1040, 30); ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = "#322f28"; roundRect(ctx, 55, 60, 770, 1040, 30); ctx.stroke();
    ctx.save(); ctx.translate(105, 125); ctx.rotate(-0.06); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 250, 250); ctx.lineWidth = 7; ctx.strokeStyle = "#322f28"; ctx.strokeRect(0, 0, 250, 250); ctx.font = "150px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(state.avatar, 125, 135); ctx.restore();
    ctx.fillStyle = accent; ctx.font = "900 28px sans-serif"; ctx.textAlign = "left"; ctx.fillText("MY WEB PAGE", 390, 160);
    ctx.fillStyle = "#322f28"; ctx.font = "900 64px sans-serif"; wrapText(ctx, state.name || "なまえ", 390, 230, 350, 72, 2);
    ctx.font = "900 31px sans-serif"; wrapText(ctx, state.phrase || "よろしくね！", 390, 330, 350, 42, 2);
    ctx.fillStyle = accent; ctx.fillRect(110, 430, 620, 6);
    ctx.fillStyle = "#322f28"; ctx.font = "900 28px sans-serif"; ctx.fillText("すきなもの", 110, 500);
    const favorites = state.favorites.length ? state.favorites : ["すきなものを えらぼう"];
    favorites.forEach((fav, i) => {
      const y = 550 + i * 105;
      ctx.fillStyle = i % 2 ? "#fff" : bg;
      roundRect(ctx, 110, y, 620, 76, 18); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = "#322f28"; roundRect(ctx, 110, y, 620, 76, 18); ctx.stroke();
      ctx.fillStyle = "#322f28"; ctx.font = "900 30px sans-serif"; ctx.fillText(`★  ${fav}`, 140, y + 50);
    });
    ctx.fillStyle = "#322f28"; ctx.font = "800 22px sans-serif"; ctx.fillText("HTML → CSS → JavaScript でつくったよ！", 110, 935);
    ctx.fillStyle = accent; ctx.font = "900 24px sans-serif"; ctx.fillText("じぶんページ工房", 110, 1010);
    ctx.save(); ctx.translate(710, 1000); ctx.rotate(0.12); ctx.font = "72px sans-serif"; ctx.fillText("★", 0, 0); ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 99) {
    const chars = [...String(text)];
    let line = ""; let lines = []; 
    for (const char of chars) {
      const test = line + char;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = char; } else { line = test; }
    }
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  }

  function downloadCard() {
    drawCard();
    const a = document.createElement("a");
    a.href = $("#cardCanvas").toDataURL("image/png");
    a.download = `${safeFilename(state.name || "my-page")}-card.png`;
    a.click();
  }

  function downloadHtml() {
    if (!state.name.trim()) { showToast("なまえを いれてから ほぞんしよう"); return; }
    const blob = new Blob([buildKidHtml(true)], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${safeFilename(state.name)}-page.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function checkLan() {
    try {
      const response = await fetch("/api/config", { cache: "no-store" });
      if (!response.ok) throw new Error("no");
      const data = await response.json();
      lanInfo = { enabled: Boolean(data.enabled), baseUrl: String(data.baseUrl || "") };
    } catch (_) {
      lanInfo = { enabled: false, baseUrl: "" };
    }
    return lanInfo.enabled;
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch (_) { return {}; }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }

  function safeFilename(value) {
    return String(value || "my-page").replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "my-page";
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }
})();
