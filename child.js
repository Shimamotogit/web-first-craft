(() => {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const STORAGE_KEY = "jibun-page-kobo-child-v2";

  const defaults = {
    avatar: "🐧",
    avatarMode: "mark",
    photo: "",
    name: "",
    favorites: [],
    phrase: "よろしくね！",
    customPhrase: "",
    theme: "sun",
    layout: "big",
    decor: "stars",
    frame: "tape",
    sticker: "star",
    pattern: "confetti",
    kanaVisible: true
  };
  const state = { ...defaults, ...loadState() };
  if (!Array.isArray(state.favorites)) state.favorites = [];
  // Older child drafts had motion/magic. They are intentionally ignored now.
  delete state.motion;
  delete state.magic;

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
  let previewObjectUrl = "";
  let activePhotoToken = "";
  let photoPollTimer = 0;

  init();

  function init() {
    restoreControls();
    renderKana();
    bind();
    renderAll();
    setKanaVisibility(state.kanaVisible !== false, false);
    checkLan();
  }

  function bind() {
    steps.forEach((button) => button.addEventListener("click", () => showStep(Number(button.dataset.step))));
    $$("[data-next]").forEach((button) => button.addEventListener("click", () => showStep(Number(button.dataset.next))));
    $$("[data-back]").forEach((button) => button.addEventListener("click", () => showStep(Number(button.dataset.back))));

    $$(".avatar").forEach((button) => button.addEventListener("click", () => {
      state.avatar = button.dataset.avatar || "🐧";
      state.avatarMode = "mark";
      selectOne(".avatar", button);
      changed();
    }));

    $("#kidPhotoInput").addEventListener("change", handlePhotoUpload);
    $("#kidPhonePhotoButton").addEventListener("click", openPhonePhotoTransfer);
    $("#kidUseMarkButton").addEventListener("click", () => {
      state.avatarMode = "mark";
      changed();
      showToast("マークに もどしたよ");
    });

    $$("#kidFavorites button").forEach((button) => button.addEventListener("click", () => {
      const value = button.dataset.value || "";
      if (state.favorites.includes(value)) {
        state.favorites = state.favorites.filter((item) => item !== value);
        setSelected(button, false);
      } else if (state.favorites.length < 3) {
        state.favorites.push(value);
        setSelected(button, true);
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
    bindChoice("#kidFrames [data-frame]", "frame");
    bindChoice("#kidStickers [data-sticker]", "sticker");
    bindChoice("#kidPatterns [data-pattern]", "pattern");

    $$(".pad-target[data-target]").forEach((button) => button.addEventListener("click", () => {
      activePadTarget = button.dataset.target === "kidPhrase" ? "phrase" : "name";
      $$(".pad-target[data-target]").forEach((item) => {
        const yes = item === button;
        item.classList.toggle("active", yes);
        item.setAttribute("aria-pressed", String(yes));
      });
      $("#padHint").textContent = activePadTarget === "name" ? "なまえを いれてね" : "ひとことを つくってね";
      if (!state.kanaVisible) setKanaVisibility(true);
    }));

    $("#backspaceButton").addEventListener("click", () => { state.name = [...state.name].slice(0, -1).join(""); changed(); });
    $("#clearNameButton").addEventListener("click", () => { state.name = ""; changed(); });
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
    $("#toggleKanaButton").addEventListener("click", () => setKanaVisibility(!state.kanaVisible));

    $("#voiceButton").addEventListener("click", readCurrentInstruction);
    $("#makeCardButton").addEventListener("click", openCardDialog);
    $("#closeCardDialog").addEventListener("click", () => $("#cardDialog").close());
    $("#downloadCardDirect").addEventListener("click", downloadCard);
    $("#kidDownloadHtml").addEventListener("click", downloadHtml);
    $("#cardDialog").addEventListener("click", (event) => { if (event.target === $("#cardDialog")) $("#cardDialog").close(); });

    $("#closePhotoDialog").addEventListener("click", closePhotoDialog);
    $("#photoDialog").addEventListener("click", (event) => { if (event.target === $("#photoDialog")) closePhotoDialog(); });
  }

  function bindChoice(selector, key) {
    $$(selector).forEach((button) => button.addEventListener("click", () => {
      state[key] = button.dataset[key] || defaults[key];
      selectOne(selector, button);
      changed();
    }));
  }

  function selectOne(selector, selected) {
    $$(selector).forEach((button) => setSelected(button, button === selected));
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
    restoreChoice("#kidFrames [data-frame]", "frame");
    restoreChoice("#kidStickers [data-sticker]", "sticker");
    restoreChoice("#kidPatterns [data-pattern]", "pattern");
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
          $$("#phraseGrid button").forEach((b) => setSelected(b, false));
        }
        changed();
      });
      kanaGrid.append(button);
    });
  }

  function setKanaVisibility(visible, persist = true) {
    state.kanaVisible = Boolean(visible);
    $("#kanaBody").hidden = !state.kanaVisible;
    $("#hiraganaDock").classList.toggle("collapsed", !state.kanaVisible);
    $("#toggleKanaButton").textContent = state.kanaVisible ? "キーボードを かくす ▼" : "キーボードを だす ▲";
    $("#toggleKanaButton").setAttribute("aria-expanded", String(state.kanaVisible));
    document.body.classList.toggle("kana-hidden", !state.kanaVisible);
    if (persist) saveState();
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
      "<b>JavaScript</b> は、ボタンをおしたときにページをかえることもできるよ。"
    ];
    learned.innerHTML = notes[currentStep];
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function changed() {
    nameOutput.textContent = state.name || "なまえ";
    phraseOutput.textContent = state.customPhrase || "ことば";
    renderPhotoControl();
    saveState();
    renderPreview();
  }

  function renderAll() {
    renderPhotoControl();
    renderPreview();
  }

  function renderPhotoControl() {
    const box = $("#kidPhotoPreview");
    box.replaceChildren();
    if (state.avatarMode === "photo" && isSafeImageDataUrl(state.photo)) {
      const img = document.createElement("img");
      img.src = state.photo;
      img.alt = "えらんだ写真";
      box.append(img);
    } else {
      const span = document.createElement("span");
      span.textContent = state.avatar;
      box.append(span);
    }
  }

  function renderPreview() {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    const blob = new Blob([buildKidSvg()], { type: "image/svg+xml;charset=utf-8" });
    previewObjectUrl = URL.createObjectURL(blob);
    preview.src = previewObjectUrl;
  }

  function buildKidSvg() {
    const p = paletteFor(state.theme);
    const name = esc(state.name.trim() || "なまえ");
    const phrase = esc(state.phrase || "よろしくね！");
    const favorites = state.favorites.length ? state.favorites : ["すきなものを えらぼう"];
    const photo = state.avatarMode === "photo" && isSafeImageDataUrl(state.photo) ? state.photo : "";
    const sticker = ({ star: "⭐", heart: "💛", rainbow: "🌈", rocket: "🚀" })[state.sticker] || "⭐";
    const bgPattern = patternSvg(state.pattern, p);
    const decor = decorSvg(state.decor, p);
    const defs = `<defs><clipPath id="photoClip" clipPathUnits="objectBoundingBox">${photoClipShape(state.frame)}</clipPath><pattern id="checks" width="56" height="56" patternUnits="userSpaceOnUse"><rect width="28" height="28" fill="${p.accent2}" opacity=".22"/><rect x="28" y="28" width="28" height="28" fill="${p.accent2}" opacity=".22"/></pattern></defs>`;
    const photoNode = photo
      ? `<image href="${escAttr(photo)}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"/>`
      : `<rect width="100%" height="100%" fill="#fff"/><text x="50%" y="56%" text-anchor="middle" font-size="128">${esc(state.avatar)}</text>`;

    let content = "";
    if (state.layout === "cards") {
      content = layoutCards(name, phrase, favorites, photoNode, p, sticker);
    } else if (state.layout === "stripe") {
      content = layoutNotebook(name, phrase, favorites, photoNode, p, sticker);
    } else if (state.layout === "poster") {
      content = layoutPoster(name, phrase, favorites, photoNode, p, sticker);
    } else {
      content = layoutBig(name, phrase, favorites, photoNode, p, sticker);
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
      ${defs}<rect width="900" height="1200" fill="${p.bg}"/>${bgPattern}${content}${decor}
    </svg>`;
  }

  function layoutBig(name, phrase, favorites, photoNode, p, sticker) {
    const fav = favorites.slice(0, 3).map((x, i) => `<g transform="translate(${90 + (i%2)*365} ${760 + Math.floor(i/2)*116})"><rect width="330" height="88" rx="26" fill="${i%2 ? '#fff' : p.accent2}" stroke="${p.ink}" stroke-width="5"/><text x="26" y="56" font-size="31" font-weight="900" fill="${p.ink}">★ ${esc(x)}</text></g>`).join("");
    return `<rect x="42" y="42" width="816" height="1116" rx="54" fill="${p.paper}" stroke="${p.ink}" stroke-width="7"/>
      <g transform="translate(82 92)">${frameSvg(state.frame, 310, 310, p)}<g clip-path="url(#photoClip)" transform="translate(${photoContentOffset(state.frame,310).x} ${photoContentOffset(state.frame,310).y})" width="${photoContentOffset(state.frame,310).size}" height="${photoContentOffset(state.frame,310).size}"><svg width="${photoContentOffset(state.frame,310).size}" height="${photoContentOffset(state.frame,310).size}">${photoNode}</svg></g></g>
      <text x="440" y="135" font-size="28" font-weight="900" fill="${p.accent}">MY WEB PAGE</text>
      ${svgText(name, 440, 220, 370, 74, 64, 3, p.ink)}
      ${svgText(phrase, 440, 465, 350, 42, 31, 3, p.ink)}
      <path d="M88 690 H810" stroke="${p.accent}" stroke-width="9" stroke-linecap="round"/>
      <text x="90" y="740" font-size="27" font-weight="900" fill="${p.ink}">すきなもの</text>${fav}
      <text x="88" y="1095" font-size="22" font-weight="900" fill="${p.accent}">HTML → CSS → JavaScript で つくったよ！</text>
      <text x="735" y="1080" font-size="86" transform="rotate(10 735 1080)">${sticker}</text>`;
  }

  function layoutCards(name, phrase, favorites, photoNode, p, sticker) {
    const fav = favorites.slice(0, 3).map((x, i) => `<g transform="translate(${72+i*258} 840)"><rect width="228" height="190" rx="28" fill="${[p.accent2,'#fff',p.accent2][i]}" stroke="${p.ink}" stroke-width="6"/><text x="114" y="78" text-anchor="middle" font-size="40">${['★','●','✦'][i]}</text>${svgText(esc(x), 114, 132, 185, 34, 27, 2, p.ink, 'middle')}</g>`).join("");
    return `<rect x="38" y="38" width="824" height="1124" rx="24" fill="${p.paper}" stroke="${p.ink}" stroke-width="7"/>
      <rect x="68" y="68" width="764" height="180" rx="24" fill="${p.accent}"/><text x="100" y="125" font-size="26" font-weight="900" fill="#fff">MY WEB PAGE</text>${svgText(name,100,205,650,62,54,2,'#fff')}
      <g transform="translate(78 300)">${frameSvg(state.frame, 350, 350, p)}<g clip-path="url(#photoClip)" transform="translate(${photoContentOffset(state.frame,350).x} ${photoContentOffset(state.frame,350).y})"><svg width="${photoContentOffset(state.frame,350).size}" height="${photoContentOffset(state.frame,350).size}">${photoNode}</svg></g></g>
      <g transform="translate(480 330)"><rect width="320" height="300" rx="38" fill="${p.accent2}" stroke="${p.ink}" stroke-width="5"/><text x="28" y="54" font-size="22" font-weight="900" fill="${p.accent}">ひとこと</text>${svgText(phrase,28,116,260,48,34,4,p.ink)}<text x="235" y="265" font-size="66">${sticker}</text></g>
      <text x="74" y="790" font-size="28" font-weight="900" fill="${p.ink}">すきなものカード</text>${fav}
      <text x="72" y="1112" font-size="21" font-weight="900" fill="${p.accent}">じぶんで えらんで つくった WEBページ</text>`;
  }

  function layoutNotebook(name, phrase, favorites, photoNode, p, sticker) {
    const lines = Array.from({length:18},(_,i)=>`<line x1="78" y1="${120+i*55}" x2="830" y2="${120+i*55}" stroke="${p.accent}" opacity=".18" stroke-width="3"/>`).join('');
    const fav = favorites.slice(0,3).map((x,i)=>`<g transform="translate(${110+(i%2)*370} ${720+Math.floor(i/2)*130}) rotate(${i%2?2:-2})"><rect width="330" height="100" rx="8" fill="${i===1?p.accent2:'#fff4a8'}" stroke="${p.ink}" stroke-width="4"/><text x="24" y="62" font-size="31" font-weight="900" fill="${p.ink}">✓ ${esc(x)}</text></g>`).join('');
    return `<rect x="44" y="44" width="812" height="1112" rx="18" fill="#fffdf4" stroke="${p.ink}" stroke-width="7"/>${lines}<line x1="128" y1="62" x2="128" y2="1135" stroke="#e27373" opacity=".5" stroke-width="4"/>
      <text x="165" y="142" font-size="27" font-weight="900" fill="${p.accent}">MY WEB PAGE / じゆうちょう</text>${svgText(name,165,235,380,68,58,3,p.ink)}
      <g transform="translate(555 130) rotate(4)">${frameSvg(state.frame, 245, 245, p)}<g clip-path="url(#photoClip)" transform="translate(${photoContentOffset(state.frame,245).x} ${photoContentOffset(state.frame,245).y})"><svg width="${photoContentOffset(state.frame,245).size}" height="${photoContentOffset(state.frame,245).size}">${photoNode}</svg></g></g>
      <g transform="translate(165 475) rotate(-1)"><path d="M0 0 H585 L560 150 H20 Z" fill="${p.accent2}" stroke="${p.ink}" stroke-width="4"/>${svgText(phrase,35,65,500,43,32,3,p.ink)}</g>
      <text x="165" y="680" font-size="28" font-weight="900" fill="${p.ink}">すきなもの メモ</text>${fav}<text x="700" y="1065" font-size="90" transform="rotate(-12 700 1065)">${sticker}</text>`;
  }

  function layoutPoster(name, phrase, favorites, photoNode, p, sticker) {
    const fav = favorites.slice(0,3).map((x,i)=>`<g transform="translate(${85+i*252} 930)"><rect width="218" height="92" rx="46" fill="${i===1?p.accent2:'#fff'}" stroke="${p.ink}" stroke-width="5"/>${svgText(esc(x),109,57,175,31,25,2,p.ink,'middle')}</g>`).join('');
    return `<rect x="28" y="28" width="844" height="1144" fill="${p.accent}" stroke="${p.ink}" stroke-width="8"/><path d="M28 680 L872 500 V1172 H28 Z" fill="${p.paper}"/>
      <text x="58" y="105" font-size="25" font-weight="900" fill="#fff">THIS IS MY PAGE!</text>${svgText(name,55,205,520,82,72,3,'#fff')}
      <g transform="translate(535 135) rotate(5)">${frameSvg(state.frame, 285, 285, p)}<g clip-path="url(#photoClip)" transform="translate(${photoContentOffset(state.frame,285).x} ${photoContentOffset(state.frame,285).y})"><svg width="${photoContentOffset(state.frame,285).size}" height="${photoContentOffset(state.frame,285).size}">${photoNode}</svg></g></g>
      <g transform="translate(78 600)"><rect width="650" height="190" rx="22" fill="#fff" stroke="${p.ink}" stroke-width="6"/>${svgText(phrase,36,73,575,52,38,3,p.ink)}</g>
      <text x="82" y="885" font-size="27" font-weight="900" fill="${p.ink}">I LIKE...</text>${fav}<text x="725" y="835" font-size="105" transform="rotate(12 725 835)">${sticker}</text>`;
  }

  function paletteFor(theme) {
    return ({
      sun: { bg:"#ffd95a", paper:"#fff8df", accent:"#d77b22", accent2:"#ffeaa1", ink:"#322f28" },
      sky: { bg:"#a5e2f3", paper:"#f5fcff", accent:"#267fa2", accent2:"#d8f5ff", ink:"#26373e" },
      forest: { bg:"#bddd9c", paper:"#f8f8e9", accent:"#477a4b", accent2:"#dceac4", ink:"#2f392c" },
      candy: { bg:"#ffb2c6", paper:"#fff8d9", accent:"#b44670", accent2:"#b8ece8", ink:"#3d2c36" }
    })[theme] || { bg:"#ffd95a", paper:"#fff8df", accent:"#d77b22", accent2:"#ffeaa1", ink:"#322f28" };
  }

  function patternSvg(pattern, p) {
    if (pattern === "checks") return `<rect width="900" height="1200" fill="url(#checks)"/>`;
    if (pattern === "waves") return `<path d="M0 100 Q110 20 220 100 T440 100 T660 100 T880 100 M0 1100 Q110 1020 220 1100 T440 1100 T660 1100 T880 1100" fill="none" stroke="${p.accent}" stroke-width="14" opacity=".28"/>`;
    if (pattern === "bold") return `<circle cx="80" cy="100" r="58" fill="${p.accent2}" opacity=".55"/><circle cx="820" cy="1090" r="110" fill="${p.accent}" opacity=".20"/><circle cx="790" cy="95" r="34" fill="#fff" opacity=".45"/>`;
    return `<g fill="${p.accent}" opacity=".34"><circle cx="70" cy="75" r="8"/><circle cx="820" cy="110" r="12"/><circle cx="50" cy="1080" r="10"/><path d="M790 1040 l10 24 24 10-24 10-10 24-10-24-24-10 24-10z"/></g>`;
  }

  function decorSvg(decor, p) {
    if (decor === "dots") return `<g fill="${p.ink}" opacity=".22">${[0,1,2,3,4].map(i=>`<circle cx="${735+i*24}" cy="1125" r="7"/>`).join('')}</g>`;
    if (decor === "tape") return `<g opacity=".75"><rect x="70" y="34" width="145" height="42" fill="#fff" stroke="${p.ink}" stroke-width="2" transform="rotate(-5 70 34)"/><rect x="690" y="1095" width="145" height="42" fill="#fff" stroke="${p.ink}" stroke-width="2" transform="rotate(6 690 1095)"/></g>`;
    if (decor === "stars") return `<text x="770" y="80" font-size="38" fill="${p.ink}" transform="rotate(7 770 80)">★ ✦</text>`;
    return "";
  }

  function frameSvg(frame, size, p) {
    if (frame === "circle") return `<circle cx="${size/2}" cy="${size/2}" r="${size/2-10}" fill="#fff" stroke="${p.ink}" stroke-width="8"/>`;
    if (frame === "stamp") return `<rect x="5" y="5" width="${size-10}" height="${size-10}" rx="6" fill="#fff" stroke="${p.ink}" stroke-width="11" stroke-dasharray="14 9"/>`;
    if (frame === "burst") return `<path d="${burstPath(size/2,size/2,size*.48,size*.39,18)}" fill="#fff" stroke="${p.ink}" stroke-width="7"/>`;
    return `<rect x="10" y="10" width="${size-20}" height="${size-20}" rx="8" fill="#fff" stroke="${p.ink}" stroke-width="7"/><rect x="${size*.28}" y="-2" width="${size*.44}" height="35" fill="#fff5c6" stroke="${p.ink}" stroke-width="2" opacity=".9" transform="rotate(-3 ${size/2} 15)"/>`;
  }

  function photoClipShape(frame) {
    if (frame === "circle") return `<circle cx=".5" cy=".5" r=".48"/>`;
    if (frame === "burst") return `<circle cx=".5" cy=".5" r=".43"/>`;
    return `<rect x=".03" y=".03" width=".94" height=".94" rx=".05"/>`;
  }

  function photoContentOffset(frame, size) {
    if (frame === "burst") return { x: size*.085, y:size*.085, size:size*.83 };
    if (frame === "circle") return { x:size*.04, y:size*.04, size:size*.92 };
    return { x:size*.055, y:size*.055, size:size*.89 };
  }

  function burstPath(cx, cy, outer, inner, points) {
    const pts=[];
    for(let i=0;i<points*2;i++){
      const r=i%2?inner:outer, a=-Math.PI/2 + i*Math.PI/points;
      pts.push(`${cx+Math.cos(a)*r},${cy+Math.sin(a)*r}`);
    }
    return `M${pts.join(' L')} Z`;
  }

  function svgText(text, x, y, maxWidth, lineHeight, fontSize, maxLines, fill, anchor="start") {
    const lines = wrapChars(text, Math.max(3, Math.floor(maxWidth / (fontSize * .92))), maxLines);
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Hiragino Maru Gothic ProN,Yu Gothic,Meiryo,sans-serif" font-size="${fontSize}" font-weight="900" fill="${fill}">${lines.map((line,i)=>`<tspan x="${x}" dy="${i?lineHeight:0}">${line}</tspan>`).join('')}</text>`;
  }

  function wrapChars(text, perLine, maxLines) {
    const chars=[...String(text)]; const lines=[];
    while(chars.length && lines.length<maxLines) lines.push(esc(chars.splice(0,perLine).join('')));
    if(chars.length && lines.length) lines[lines.length-1]=lines[lines.length-1].slice(0,-1)+'…';
    return lines.length?lines:[""];
  }

  function buildKidHtml() {
    const name = esc(state.name.trim() || "なまえ");
    return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}のページ</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:18px;background:#eee6d8}svg{display:block;width:min(900px,100%);height:auto;box-shadow:0 16px 40px #0002}</style></head><body>${buildKidSvg()}</body></html>`;
  }

  function readCurrentInstruction() {
    if (!("speechSynthesis" in window)) { showToast("このブラウザでは よみあげが つかえません"); return; }
    const texts = [
      "ステップ1、HTMLのおしごと。写真やマーク、なまえ、すきなものをえらんで、ページのなかみをつくろう。",
      "ステップ2、CSSのおしごと。いろ、ならべかた、かざりをえらんで、みためを大きくかえよう。",
      "ステップ3、JavaScriptのおしごと。ボタンをおすとページの見た目がかわるよ。写真のわく、スタンプ、もようをえらんでしあげよう。"
    ];
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(texts[currentStep]);
    utterance.lang = "ja-JP";
    utterance.rate = 0.85;
    speechSynthesis.speak(utterance);
  }

  async function handlePhotoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type) || file.size > 12 * 1024 * 1024) {
      showToast("12MBより小さい PNG・JPEG・WebPを えらんでね");
      event.target.value = "";
      return;
    }
    try {
      state.photo = await resizeImage(file, 900, .84);
      state.avatarMode = "photo";
      changed();
      showToast("しゃしんを いれたよ！");
    } catch (_) { showToast("しゃしんを よみこめなかったよ"); }
  }

  function resizeImage(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
          const width = Math.max(1, Math.round(image.width * scale));
          const height = Math.max(1, Math.round(image.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d", { alpha:false });
          ctx.fillStyle="#fff"; ctx.fillRect(0,0,width,height); ctx.drawImage(image,0,0,width,height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  async function openPhonePhotoTransfer() {
    if (!await ensureLan()) return;
    closePhotoPolling();
    const dialog=$("#photoDialog"), box=$("#photoQrBox"), status=$("#photoQrStatus"), link=$("#photoShareLink");
    box.innerHTML="<span>QRをつくっています…</span>"; link.hidden=true; status.textContent="アップロード用QRをつくっています…"; dialog.showModal();
    try {
      const response=await fetch("/api/photo-sessions",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
      const data=await response.json(); if(!response.ok) throw new Error();
      activePhotoToken=data.token;
      const img=new Image(); img.alt="しゃしんをおくるQRコード"; img.onload=()=>box.replaceChildren(img); img.src=`/api/qr?text=${encodeURIComponent(data.uploadUrl)}&t=${Date.now()}`;
      link.href=data.uploadUrl; link.hidden=false; status.textContent="スマホでQRをよんで、しゃしんをえらんで『パソコンへ送る』をおしてね。";
      pollPhotoSession();
    } catch (_) { box.innerHTML="<span>QRをつくれませんでした</span>"; status.textContent="server.py で起動しているか確認してね。"; }
  }

  function pollPhotoSession() {
    clearTimeout(photoPollTimer);
    if (!activePhotoToken || !$("#photoDialog").open) return;
    photoPollTimer=setTimeout(async()=>{
      try {
        const response=await fetch(`/api/photo-sessions/${encodeURIComponent(activePhotoToken)}`,{cache:"no-store"});
        const data=await response.json();
        if(response.status===410){$("#photoQrStatus").textContent="QRのじかんが きれました。もういちど つくってね。";return;}
        if(data.status==="received" && isSafeImageDataUrl(data.photo)){
          state.photo=data.photo; state.avatarMode="photo"; changed(); $("#photoQrStatus").textContent="しゃしんが とどいたよ！"; showToast("スマホから しゃしんが とどいたよ");
          setTimeout(()=>{if($("#photoDialog").open) closePhotoDialog();},650); return;
        }
        pollPhotoSession();
      } catch (_) { pollPhotoSession(); }
    },1300);
  }

  function closePhotoPolling(){ clearTimeout(photoPollTimer); photoPollTimer=0; activePhotoToken=""; }
  function closePhotoDialog(){ closePhotoPolling(); $("#photoDialog").close(); }

  async function openCardDialog() {
    const dialog = $("#cardDialog");
    const box = $("#cardQrBox");
    const status = $("#cardQrStatus");
    const link = $("#cardShareLink");
    dialog.showModal(); box.innerHTML = "<span>しゃしんを つくっています…</span>"; link.hidden = true;
    if (!state.name.trim()) { status.textContent = "なまえを いれると おくれるよ。"; box.innerHTML = "<span>なまえを いれてね</span>"; return; }
    try { await drawCard(); } catch (_) { box.innerHTML="<span>画像をつくれませんでした</span>"; status.textContent="もういちどためしてね。"; return; }
    if (!lanInfo.enabled && !(await checkLan())) { status.textContent = "QRは python server.py で起動したときにつかえるよ。このパソコンへの保存はできます。"; box.innerHTML = "<span>LANモードで QRがつかえます</span>"; return; }
    try {
      const dataUrl = $("#cardCanvas").toDataURL("image/png");
      const response = await fetch("/api/cards", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ image:dataUrl, filename:`${safeFilename(state.name)}-card.png`, title:`${state.name}のカード` }) });
      const data=await response.json(); if(!response.ok) throw new Error();
      const img=new Image(); img.alt="カードをうけとるQRコード"; img.onload=()=>box.replaceChildren(img); img.src=`/api/qr?text=${encodeURIComponent(data.cardUrl)}&t=${Date.now()}`;
      link.href=data.cardUrl; link.hidden=false; status.textContent="おなじWi-Fiのスマホで よみこんで、プレビューとおなじ写真を ほぞんしてね。";
    } catch (_) { box.innerHTML="<span>QRをつくれませんでした</span>"; status.textContent="このパソコンへの画像保存はできます。"; }
  }

  function drawCard() {
    return new Promise((resolve, reject) => {
      const canvas=$("#cardCanvas"), ctx=canvas.getContext("2d");
      const blob=new Blob([buildKidSvg()],{type:"image/svg+xml;charset=utf-8"}); const url=URL.createObjectURL(blob); const img=new Image();
      img.onload=()=>{ctx.clearRect(0,0,900,1200);ctx.drawImage(img,0,0,900,1200);URL.revokeObjectURL(url);resolve();};
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("svg-render"));}; img.src=url;
    });
  }

  async function downloadCard() {
    try { await drawCard(); const a=document.createElement("a"); a.href=$("#cardCanvas").toDataURL("image/png"); a.download=`${safeFilename(state.name||"my-page")}-card.png`; a.click(); }
    catch (_) { showToast("画像を つくれませんでした"); }
  }

  function downloadHtml() {
    if (!state.name.trim()) { showToast("なまえを いれてから ほぞんしよう"); return; }
    const blob=new Blob([buildKidHtml()],{type:"text/html;charset=utf-8"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`${safeFilename(state.name)}-page.html`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  }

  async function checkLan() {
    try { const response=await fetch("/api/config",{cache:"no-store"}); if(!response.ok) throw new Error(); const data=await response.json(); lanInfo={enabled:Boolean(data.enabled),baseUrl:String(data.baseUrl||"")}; }
    catch (_) { lanInfo={enabled:false,baseUrl:""}; }
    return lanInfo.enabled;
  }
  async function ensureLan(){ if(lanInfo.enabled) return true; if(await checkLan()) return true; showToast("QRは python server.py で きどうすると つかえるよ"); return false; }

  function isSafeImageDataUrl(value){ return /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(String(value||"")); }
  function saveState(){ try{ localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }catch(_){} }
  function loadState(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");}catch(_){return{};} }
  function esc(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
  function escAttr(value){return esc(value);}
  function safeFilename(value){return String(value||"my-page").replace(/[\\/:*?"<>|\s]+/g,"-").replace(/^-+|-+$/g,"").slice(0,30)||"my-page";}
  function showToast(message){clearTimeout(toastTimer);toast.textContent=message;toast.classList.add("show");toastTimer=setTimeout(()=>toast.classList.remove("show"),2200);}
})();
