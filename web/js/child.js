(() => {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const STORAGE_KEY = "jibun-page-kobo-child-v3";

  const defaults = {
    avatar: "🐧", avatarMode: "mark", photo: "", name: "", favorites: [],
    phrase: "よろしくね！", customPhrase: "", inputMode: "kana", kanaVisible: true,
    theme: "sun", layout: "big", decor: "doodle", frame: "tape", sticker: "star", pattern: "confetti"
  };
  const state = { ...defaults, ...loadState() };
  if (!Array.isArray(state.favorites)) state.favorites = [];
  if (state.layout === "cards") state.layout = "storybook";
  if (["stars","dots","tape","none"].includes(state.decor)) {
    state.decor = ({ stars:"stickers", dots:"doodle", tape:"scrap", none:"doodle" })[state.decor];
  }
  delete state.motion; delete state.magic;

  const kanaPages = {
    basic: [
      ["あ行","あ","い","う","え","お"], ["か行","か","き","く","け","こ"],
      ["さ行","さ","し","す","せ","そ"], ["た行","た","ち","つ","て","と"],
      ["な行","な","に","ぬ","ね","の"], ["は行","は","ひ","ふ","へ","ほ"],
      ["ま行","ま","み","む","め","も"], ["や行","や","","ゆ","","よ"],
      ["ら行","ら","り","る","れ","ろ"], ["わ行","わ","","を","","ん"]
    ],
    voiced: [
      ["が行","が","ぎ","ぐ","げ","ご"], ["ざ行","ざ","じ","ず","ぜ","ぞ"],
      ["だ行","だ","ぢ","づ","で","ど"], ["ば行","ば","び","ぶ","べ","ぼ"],
      ["ぱ行","ぱ","ぴ","ぷ","ぺ","ぽ"], ["ほか","ゔ","ー","・","　",""]
    ],
    small: [
      ["小さい","ぁ","ぃ","ぅ","ぇ","ぉ"], ["ゃゅょ","ゃ","","ゅ","","ょ"],
      ["っ","っ","","","",""], ["きごう","！","？","ー","・","　"]
    ]
  };

  const panels = $$(".kid-panel"), steps = $$(".lesson-step"), preview = $("#kidPreview");
  const nameInput = $("#kidName"), phraseInput = $("#kidPhrase"), learned = $("#learnedText"), kanaGrid = $("#kanaGrid"), toast = $("#kidToast");
  let currentStep = 0, activePadTarget = "name", kanaPage = "basic", transferInfo = { enabled:false, baseUrl:"" };
  let toastTimer = 0, previewObjectUrl = "", activePhotoToken = "", photoPollTimer = 0;
  // プレビュー生成は init() からすぐ呼ばれるため、SVGで使う写真ノードを先に初期化する。
  let currentPhotoNode = "";

  init();

  function init() {
    restoreControls(); renderKana(); bind(); applyInputMode(false); renderAll(); setKanaVisibility(state.kanaVisible !== false, false); checkTransferServer();
  }

  function bind() {
    steps.forEach(b => b.addEventListener("click", () => showStep(Number(b.dataset.step))));
    $$('[data-next]').forEach(b => b.addEventListener("click", () => showStep(Number(b.dataset.next))));
    $$('[data-back]').forEach(b => b.addEventListener("click", () => showStep(Number(b.dataset.back))));

    $$('[data-input-mode]').forEach(button => button.addEventListener("click", () => {
      state.inputMode = button.dataset.inputMode === "pc" ? "pc" : "kana";
      applyInputMode();
      if (state.inputMode === "pc") (activePadTarget === "phrase" ? phraseInput : nameInput).focus();
    }));

    $$('.kid-text-field').forEach(field => field.addEventListener("click", () => activateField(field.dataset.field || "name")));
    nameInput.addEventListener("focus", () => activateField("name"));
    phraseInput.addEventListener("focus", () => activateField("phrase"));
    nameInput.addEventListener("input", () => { state.name = [...nameInput.value].slice(0,10).join(""); nameInput.value = state.name; changed(false); });
    phraseInput.addEventListener("input", () => { state.customPhrase = [...phraseInput.value].slice(0,22).join(""); state.phrase = state.customPhrase || "よろしくね！"; $$("#phraseGrid button").forEach(b=>setSelected(b,false)); changed(false); });

    $$(".avatar").forEach(button => button.addEventListener("click", () => { state.avatar=button.dataset.avatar||"🐧"; state.avatarMode="mark"; selectOne(".avatar",button); changed(); }));
    $("#kidPhotoInput").addEventListener("change", handlePhotoUpload);
    $("#kidPhonePhotoButton").addEventListener("click", openPhonePhotoTransfer);
    $("#kidUseMarkButton").addEventListener("click", () => { state.avatarMode="mark"; changed(); showToast("マークに もどしたよ"); });

    $$("#kidFavorites button").forEach(button => button.addEventListener("click", () => {
      const value=button.dataset.value||"";
      if(state.favorites.includes(value)){state.favorites=state.favorites.filter(x=>x!==value);setSelected(button,false);}
      else if(state.favorites.length<3){state.favorites.push(value);setSelected(button,true);}
      else {showToast("すきなものは 3こまで えらべるよ");return;}
      changed();
    }));

    $$("#phraseGrid button").forEach(button => button.addEventListener("click", () => {
      state.phrase=button.dataset.value||""; state.customPhrase=""; phraseInput.value=""; selectOne("#phraseGrid button",button); changed();
    }));

    bindChoice("#kidThemes [data-theme]","theme"); bindChoice("#kidLayouts [data-layout]","layout"); bindChoice("#kidDecor [data-decor]","decor");
    bindChoice("#kidFrames [data-frame]","frame"); bindChoice("#kidStickers [data-sticker]","sticker"); bindChoice("#kidPatterns [data-pattern]","pattern");

    $("#backspaceButton").addEventListener("click",()=>{state.name=[...state.name].slice(0,-1).join("");nameInput.value=state.name;changed(false);});
    $("#clearNameButton").addEventListener("click",()=>{state.name="";nameInput.value="";changed(false);});
    $("#backspacePhraseButton").addEventListener("click",()=>{state.customPhrase=[...state.customPhrase].slice(0,-1).join("");phraseInput.value=state.customPhrase;state.phrase=state.customPhrase||"よろしくね！";if(!state.customPhrase)$$("#phraseGrid button").forEach(b=>setSelected(b,b.dataset.value===state.phrase));changed(false);});
    $("#clearPhraseButton").addEventListener("click",()=>{state.customPhrase="";state.phrase="よろしくね！";phraseInput.value="";$$("#phraseGrid button").forEach(b=>setSelected(b,b.dataset.value===state.phrase));changed(false);});

    $$('[data-kana-page]').forEach(button=>button.addEventListener("click",()=>{kanaPage=button.dataset.kanaPage||"basic";$$('[data-kana-page]').forEach(b=>b.classList.toggle("active",b===button));renderKana();}));
    $("#toggleKanaButton").addEventListener("click",()=>setKanaVisibility(!state.kanaVisible));

    $("#voiceButton").addEventListener("click",readCurrentInstruction);
    $("#makeCardButton").addEventListener("click",openCardDialog); $("#closeCardDialog").addEventListener("click",()=>$("#cardDialog").close());
    $("#downloadCardDirect").addEventListener("click",downloadCard); $("#kidDownloadHtml").addEventListener("click",downloadHtml);
    $("#cardDialog").addEventListener("click",e=>{if(e.target===$("#cardDialog"))$("#cardDialog").close();});
    $("#closePhotoDialog").addEventListener("click",closePhotoDialog); $("#photoDialog").addEventListener("click",e=>{if(e.target===$("#photoDialog"))closePhotoDialog();});
  }

  function activateField(target){
    activePadTarget=target==="phrase"?"phrase":"name";
    $$('.kid-text-field').forEach(field=>field.classList.toggle("active-field",field.dataset.field===activePadTarget));
    $("#padHint").textContent=activePadTarget==="name"?"なまえを いれてね":"ひとことを つくってね";
    if(state.inputMode==="kana" && !state.kanaVisible) setKanaVisibility(true);
  }

  function applyInputMode(persist=true){
    const pc=state.inputMode==="pc";
    nameInput.readOnly=!pc; phraseInput.readOnly=!pc;
    document.body.classList.toggle("pc-input-mode",pc);
    $$('[data-input-mode]').forEach(b=>setSelected(b,b.dataset.inputMode===state.inputMode));
    $("#nameFieldHint").textContent=pc?"PCのキーボードで いれてね":"ひらがなパッドで いれてね";
    $("#phraseFieldHint").textContent=pc?"PCのキーボードで いれてね":"ひらがなパッドで いれてね";
    if(persist) saveState();
  }

  function bindChoice(selector,key){$$(selector).forEach(button=>button.addEventListener("click",()=>{state[key]=button.dataset[key]||defaults[key];selectOne(selector,button);changed();}));}
  function selectOne(selector,selected){$$(selector).forEach(button=>setSelected(button,button===selected));}
  function setSelected(button,yes){button.classList.toggle("selected",yes);button.setAttribute("aria-pressed",String(yes));}

  function restoreControls(){
    nameInput.value=state.name||""; phraseInput.value=state.customPhrase||"";
    $$(".avatar").forEach(b=>setSelected(b,b.dataset.avatar===state.avatar));
    $$("#kidFavorites button").forEach(b=>setSelected(b,state.favorites.includes(b.dataset.value||"")));
    $$("#phraseGrid button").forEach(b=>setSelected(b,!state.customPhrase && b.dataset.value===state.phrase));
    restoreChoice("#kidThemes [data-theme]","theme");restoreChoice("#kidLayouts [data-layout]","layout");restoreChoice("#kidDecor [data-decor]","decor");
    restoreChoice("#kidFrames [data-frame]","frame");restoreChoice("#kidStickers [data-sticker]","sticker");restoreChoice("#kidPatterns [data-pattern]","pattern");
  }
  function restoreChoice(selector,key){$$(selector).forEach(b=>setSelected(b,b.dataset[key]===state[key]));}

  function renderKana(){
    kanaGrid.replaceChildren();
    const rows=kanaPages[kanaPage]||kanaPages.basic;
    // 五十音表と同じ向きにする：右端が「あ行」、その左へ「か・さ・た・な…」。
    // 各列は上から「あ・い・う・え・お」の母音順。
    kanaGrid.style.setProperty("--kana-columns",String(rows.length));
    [...rows].reverse().forEach(row=>{
      const column=document.createElement("div");
      column.className="kana-column";
      column.setAttribute("role","group");
      column.setAttribute("aria-label",row[0]);
      row.slice(1).forEach(char=>{
        if(!char){const empty=document.createElement("span");empty.className="kana-empty";empty.setAttribute("aria-hidden","true");column.append(empty);return;}
        const button=document.createElement("button");
        button.type="button";button.className="kana-char";button.textContent=char==="　"?"空":char;button.setAttribute("aria-label",char==="　"?"くうはく":char);
        button.addEventListener("click",()=>insertKana(char));column.append(button);
      });
      kanaGrid.append(column);
    });
    // 狭い画面でも最初に「あ行」が見えるよう、横スクロール位置を右端に合わせる。
    requestAnimationFrame(()=>{kanaGrid.scrollLeft=kanaGrid.scrollWidth;});
  }

  function insertKana(char){
    if(activePadTarget==="name"){
      if([...state.name].length>=10){showToast("なまえは 10もじまでだよ");return;} state.name+=char;nameInput.value=state.name;
    }else{
      if([...state.customPhrase].length>=22){showToast("ひとことは 22もじまでだよ");return;} state.customPhrase+=char;phraseInput.value=state.customPhrase;state.phrase=state.customPhrase;$$("#phraseGrid button").forEach(b=>setSelected(b,false));
    }
    changed(false);
  }

  function setKanaVisibility(visible,persist=true){state.kanaVisible=Boolean(visible);$("#kanaBody").hidden=!state.kanaVisible;$("#hiraganaDock").classList.toggle("collapsed",!state.kanaVisible);$("#toggleKanaButton").textContent=state.kanaVisible?"キーボードを かくす ▼":"キーボードを だす ▲";$("#toggleKanaButton").setAttribute("aria-expanded",String(state.kanaVisible));document.body.classList.toggle("kana-hidden",!state.kanaVisible);if(persist)saveState();}

  function showStep(index){
    currentStep=Math.max(0,Math.min(2,index));panels.forEach((panel,i)=>{panel.hidden=i!==currentStep;panel.classList.toggle("active",i===currentStep);});steps.forEach((step,i)=>{step.classList.toggle("active",i===currentStep);if(i===currentStep)step.setAttribute("aria-current","step");else step.removeAttribute("aria-current");});
    learned.innerHTML=["<b>HTML</b> は、ページの『なかみ』をつくるもの。","<b>CSS</b> は、いろ・かたち・ならべかたをきめるもの。","<b>JavaScript</b> は、ボタンをおしたことをうけとって、画面をかえることができるよ。"][currentStep];
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function changed(persist=true){renderPhotoControl();if(persist)saveState();else saveState();renderPreview();}
  function renderAll(){renderPhotoControl();renderPreview();}
  function renderPhotoControl(){const box=$("#kidPhotoPreview");box.replaceChildren();if(state.avatarMode==="photo"&&isSafeImageDataUrl(state.photo)){const img=document.createElement("img");img.src=state.photo;img.alt="えらんだ写真";box.append(img);}else{const span=document.createElement("span");span.textContent=state.avatar;box.append(span);}}
  function renderPreview(){if(previewObjectUrl)URL.revokeObjectURL(previewObjectUrl);const blob=new Blob([buildKidSvg()],{type:"image/svg+xml;charset=utf-8"});previewObjectUrl=URL.createObjectURL(blob);preview.src=previewObjectUrl;}

  function buildKidSvg(){
    const p=paletteFor(state.theme),name=esc(state.name.trim()||"なまえ"),phrase=esc(state.phrase||"よろしくね！"),favorites=state.favorites.length?state.favorites:["すきなものを えらぼう"];
    const sticker=({star:"⭐",heart:"💛",rainbow:"🌈",rocket:"🚀"})[state.sticker]||"⭐";
    const photo=state.avatarMode==="photo"&&isSafeImageDataUrl(state.photo)?state.photo:"";
    const defs=`<defs><clipPath id="photoClip" clipPathUnits="objectBoundingBox">${photoClipShape(state.frame)}</clipPath><pattern id="checks" width="56" height="56" patternUnits="userSpaceOnUse"><rect width="28" height="28" fill="${p.accent2}" opacity=".25"/><rect x="28" y="28" width="28" height="28" fill="${p.accent2}" opacity=".25"/></pattern></defs>`;
    const photoNode=photo?`<image href="${escAttr(photo)}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"/>`:`<rect width="100%" height="100%" fill="#fff"/><text x="50%" y="58%" text-anchor="middle" font-size="128">${esc(state.avatar)}</text>`;
    let content=state.layout==="storybook"?layoutStorybook(name,phrase,favorites,photoNode,p,sticker):state.layout==="stripe"?layoutNotebook(name,phrase,favorites,photoNode,p,sticker):state.layout==="poster"?layoutPoster(name,phrase,favorites,photoNode,p,sticker):layoutBig(name,phrase,favorites,photoNode,p,sticker);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">${defs}<rect width="900" height="1200" fill="${p.bg}"/>${patternSvg(state.pattern,p)}${decorSvg(state.decor,p)}${content}</svg>`;
  }

  function photoGroup(x,y,size,p,rotate=0){const o=photoContentOffset(state.frame,size);return `<g transform="translate(${x} ${y}) rotate(${rotate} ${size/2} ${size/2})">${frameSvg(state.frame,size,p)}<g clip-path="url(#photoClip)" transform="translate(${o.x} ${o.y})"><svg width="${o.size}" height="${o.size}">${currentPhotoNode}</svg></g></g>`;}
  function layoutBig(name,phrase,favorites,photoNode,p,sticker){currentPhotoNode=photoNode;const fav=favorites.slice(0,3).map((x,i)=>`<g transform="translate(${86+(i%2)*368} ${785+Math.floor(i/2)*106})"><rect width="334" height="82" rx="24" fill="${i%2?'#fff':p.accent2}" stroke="${p.ink}" stroke-width="5"/><text x="25" y="53" font-size="29" font-weight="900" fill="${p.ink}">★ ${esc(x)}</text></g>`).join("");return `<rect x="42" y="42" width="816" height="1116" rx="54" fill="${p.paper}" stroke="${p.ink}" stroke-width="7"/>${photoGroup(82,92,310,p,-2)}<text x="440" y="132" font-size="27" font-weight="900" fill="${p.accent}">MY WEB PAGE</text>${svgText(name,440,218,370,72,62,3,p.ink)}<g transform="translate(435 405)"><path d="M0 0 H355 L330 175 H20 Z" fill="${p.accent2}" stroke="${p.ink}" stroke-width="5"/>${svgText(phrase,28,60,285,44,31,3,p.ink)}</g><path d="M88 705 H810" stroke="${p.accent}" stroke-width="9" stroke-linecap="round"/><text x="88" y="754" font-size="27" font-weight="900" fill="${p.ink}">すきなもの</text>${fav}<text x="88" y="1098" font-size="21" font-weight="900" fill="${p.accent}">HTML → CSS → JavaScript で つくったよ！</text><text x="735" y="1080" font-size="86" transform="rotate(10 735 1080)">${sticker}</text>`;}
  function layoutStorybook(name,phrase,favorites,photoNode,p,sticker){currentPhotoNode=photoNode;const fav=favorites.slice(0,3).map((x,i)=>`<g transform="translate(486 ${650+i*105})"><circle cx="26" cy="26" r="26" fill="${i%2?p.accent2:p.accent}"/><text x="26" y="36" text-anchor="middle" font-size="23" fill="${i%2?p.ink:'#fff'}">★</text>${svgText(esc(x),70,35,250,38,29,2,p.ink)}</g>`).join("");return `<rect x="38" y="46" width="824" height="1108" rx="32" fill="#fffdf5" stroke="${p.ink}" stroke-width="7"/><path d="M450 65 V1135" stroke="${p.accent}" stroke-width="4" opacity=".35"/><path d="M439 70 Q450 120 461 70 V1130 Q450 1085 439 1130Z" fill="${p.accent2}" opacity=".55"/><text x="82" y="128" font-size="24" font-weight="900" fill="${p.accent}">わたしの えほん</text>${photoGroup(90,178,300,p,-3)}${svgText(name,82,555,320,65,54,3,p.ink)}<text x="490" y="130" font-size="23" font-weight="900" fill="${p.accent}">ひとこと</text><g transform="translate(485 170)"><rect width="310" height="300" rx="38" fill="${p.accent2}" stroke="${p.ink}" stroke-width="5"/>${svgText(phrase,28,80,250,52,36,4,p.ink)}</g><text x="486" y="590" font-size="25" font-weight="900" fill="${p.ink}">すきなもの</text>${fav}<g transform="translate(95 765)"><path d="M0 0 Q145 70 290 0 V190 Q145 255 0 190Z" fill="${p.accent}" opacity=".16"/><text x="145" y="135" text-anchor="middle" font-size="92">${sticker}</text></g><text x="485" y="1060" font-size="20" font-weight="900" fill="${p.accent}">じぶんで つくった WEBページ</text>`;}
  function layoutNotebook(name,phrase,favorites,photoNode,p,sticker){currentPhotoNode=photoNode;const lines=Array.from({length:18},(_,i)=>`<line x1="78" y1="${120+i*55}" x2="830" y2="${120+i*55}" stroke="${p.accent}" opacity=".18" stroke-width="3"/>`).join("");const fav=favorites.slice(0,3).map((x,i)=>`<g transform="translate(${110+(i%2)*370} ${725+Math.floor(i/2)*128}) rotate(${i%2?2:-2})"><rect width="330" height="96" rx="8" fill="${i===1?p.accent2:'#fff4a8'}" stroke="${p.ink}" stroke-width="4"/><text x="24" y="60" font-size="30" font-weight="900" fill="${p.ink}">✓ ${esc(x)}</text></g>`).join("");return `<rect x="44" y="44" width="812" height="1112" rx="18" fill="#fffdf4" stroke="${p.ink}" stroke-width="7"/>${lines}<line x1="128" y1="62" x2="128" y2="1135" stroke="#e27373" opacity=".5" stroke-width="4"/><text x="165" y="142" font-size="26" font-weight="900" fill="${p.accent}">MY WEB PAGE / じゆうちょう</text>${svgText(name,165,235,365,66,56,3,p.ink)}${photoGroup(555,130,245,p,4)}<g transform="translate(165 475) rotate(-1)"><path d="M0 0 H585 L560 150 H20 Z" fill="${p.accent2}" stroke="${p.ink}" stroke-width="4"/>${svgText(phrase,35,65,500,43,32,3,p.ink)}</g><text x="165" y="680" font-size="28" font-weight="900" fill="${p.ink}">すきなもの メモ</text>${fav}<text x="700" y="1065" font-size="90" transform="rotate(-12 700 1065)">${sticker}</text>`;}
  function layoutPoster(name,phrase,favorites,photoNode,p,sticker){currentPhotoNode=photoNode;const fav=favorites.slice(0,3).map((x,i)=>`<g transform="translate(${85+i*252} 930)"><rect width="218" height="92" rx="46" fill="${i===1?p.accent2:'#fff'}" stroke="${p.ink}" stroke-width="5"/>${svgText(esc(x),109,57,175,31,25,2,p.ink,'middle')}</g>`).join("");return `<rect x="28" y="28" width="844" height="1144" fill="${p.accent}" stroke="${p.ink}" stroke-width="8"/><path d="M28 680 L872 500 V1172 H28 Z" fill="${p.paper}"/><text x="58" y="105" font-size="25" font-weight="900" fill="#fff">THIS IS MY PAGE!</text>${svgText(name,55,205,500,82,72,3,'#fff')}${photoGroup(535,135,285,p,5)}<g transform="translate(78 600)"><rect width="650" height="190" rx="22" fill="#fff" stroke="${p.ink}" stroke-width="6"/>${svgText(phrase,36,73,575,52,38,3,p.ink)}</g><text x="82" y="885" font-size="27" font-weight="900" fill="${p.ink}">I LIKE...</text>${fav}<text x="725" y="835" font-size="105" transform="rotate(12 725 835)">${sticker}</text>`;}

  function paletteFor(theme){return ({sun:{bg:"#ffd95a",paper:"#fff8df",accent:"#d77b22",accent2:"#ffeaa1",ink:"#322f28"},sky:{bg:"#a5e2f3",paper:"#f5fcff",accent:"#267fa2",accent2:"#d8f5ff",ink:"#26373e"},forest:{bg:"#bddd9c",paper:"#f8f8e9",accent:"#477a4b",accent2:"#dceac4",ink:"#2f392c"},candy:{bg:"#ffb2c6",paper:"#fff8d9",accent:"#b44670",accent2:"#b8ece8",ink:"#3d2c36"}})[theme]||{bg:"#ffd95a",paper:"#fff8df",accent:"#d77b22",accent2:"#ffeaa1",ink:"#322f28"};}
  function patternSvg(pattern,p){if(pattern==="checks")return `<rect width="900" height="1200" fill="url(#checks)"/>`;if(pattern==="waves")return `<g fill="none" stroke="${p.accent}" stroke-width="14" opacity=".3"><path d="M0 95 Q110 15 220 95 T440 95 T660 95 T900 95"/><path d="M0 1110 Q110 1030 220 1110 T440 1110 T660 1110 T900 1110"/></g>`;if(pattern==="bold")return `<circle cx="80" cy="100" r="62" fill="${p.accent2}" opacity=".62"/><circle cx="820" cy="1090" r="115" fill="${p.accent}" opacity=".25"/><circle cx="820" cy="150" r="44" fill="${p.paper}" opacity=".55"/>`;return `<g fill="${p.accent}" opacity=".26"><circle cx="60" cy="115" r="11"/><rect x="810" y="90" width="18" height="54" rx="8" transform="rotate(25 819 117)"/><circle cx="835" cy="1020" r="13"/><path d="M55 1050 l12 28 28 12-28 12-12 28-12-28-28-12 28-12z"/><path d="M790 1040 l10 24 24 10-24 10-10 24-10-24-24-10 24-10z"/></g>`;}
  function decorSvg(decor,p){
    if(decor==="stickers")return `<g font-size="70"><text x="35" y="185" transform="rotate(-14 35 185)">🌈</text><text x="760" y="260" transform="rotate(10 760 260)">⭐</text><text x="40" y="1000" transform="rotate(9 40 1000)">💛</text><text x="760" y="1040" transform="rotate(-12 760 1040)">✨</text></g><g fill="none" stroke="${p.ink}" stroke-width="5" opacity=".5"><circle cx="95" cy="250" r="33"/><circle cx="810" cy="920" r="22"/></g>`;
    if(decor==="scrap")return `<g opacity=".9"><rect x="35" y="38" width="180" height="48" fill="#fff1a8" stroke="${p.ink}" stroke-width="2" transform="rotate(-7 35 38)"/><rect x="680" y="70" width="165" height="55" fill="#d9f0dc" stroke="${p.ink}" stroke-width="2" transform="rotate(8 680 70)"/><path d="M25 900 L175 860 L190 1045 L45 1075Z" fill="#ffd3df" stroke="${p.ink}" stroke-width="3"/><path d="M735 930 L885 905 L870 1110 L725 1088Z" fill="#c7eafa" stroke="${p.ink}" stroke-width="3"/></g>`;
    if(decor==="festival")return `<g stroke="${p.ink}" stroke-width="3"><path d="M25 95 Q450 155 875 85" fill="none"/><path d="M80 103 l45 8-28 62z" fill="#ff7b78"/><path d="M180 120 l45 5-28 62z" fill="#ffd45a"/><path d="M280 130 l45 3-25 62z" fill="#75c9e8"/><path d="M380 135 l45 0-22 62z" fill="#8fd18b"/><path d="M480 134 l45-2-20 62z" fill="#ff9fc1"/><path d="M580 125 l45-5-18 62z" fill="#ffd45a"/><path d="M680 112 l45-7-18 62z" fill="#75c9e8"/></g><g fill="${p.ink}" opacity=".35">${Array.from({length:18},(_,i)=>`<circle cx="${45+(i*47)%820}" cy="${220+(i*83)%860}" r="${5+(i%3)*3}"/>`).join("")}</g>`;
    return `<g fill="none" stroke="${p.ink}" stroke-width="8" stroke-linecap="round" opacity=".38"><path d="M40 170 q55-45 110 0 t110 0"/><path d="M650 1070 q55 45 110 0 t100 0"/><path d="M710 55 l18 32 35 5-27 23 8 36-34-19-31 20 7-36-27-22 36-5z"/><circle cx="85" cy="1085" r="34"/><path d="M72 1085 l25 0 M85 1072 l0 26"/></g>`;
  }
  function frameSvg(frame,size,p){if(frame==="circle")return `<circle cx="${size/2}" cy="${size/2}" r="${size/2-10}" fill="#fff" stroke="${p.ink}" stroke-width="8"/>`;if(frame==="stamp")return `<rect x="5" y="5" width="${size-10}" height="${size-10}" rx="6" fill="#fff" stroke="${p.ink}" stroke-width="11" stroke-dasharray="14 9"/>`;if(frame==="burst")return `<path d="${burstPath(size/2,size/2,size*.48,size*.39,18)}" fill="#fff" stroke="${p.ink}" stroke-width="7"/>`;return `<rect x="10" y="10" width="${size-20}" height="${size-20}" rx="8" fill="#fff" stroke="${p.ink}" stroke-width="7"/><rect x="${size*.28}" y="-2" width="${size*.44}" height="35" fill="#fff5c6" stroke="${p.ink}" stroke-width="2" opacity=".9" transform="rotate(-3 ${size/2} 15)"/>`;}
  function photoClipShape(frame){if(frame==="circle")return `<circle cx=".5" cy=".5" r=".48"/>`;if(frame==="burst")return `<circle cx=".5" cy=".5" r=".43"/>`;return `<rect x=".03" y=".03" width=".94" height=".94" rx=".05"/>`;}
  function photoContentOffset(frame,size){if(frame==="burst")return{x:size*.085,y:size*.085,size:size*.83};if(frame==="circle")return{x:size*.04,y:size*.04,size:size*.92};return{x:size*.055,y:size*.055,size:size*.89};}
  function burstPath(cx,cy,outer,inner,points){const pts=[];for(let i=0;i<points*2;i++){const r=i%2?inner:outer,a=-Math.PI/2+i*Math.PI/points;pts.push(`${cx+Math.cos(a)*r},${cy+Math.sin(a)*r}`);}return `M${pts.join(" L")} Z`;}
  function svgText(text,x,y,maxWidth,lineHeight,fontSize,maxLines,fill,anchor="start"){const lines=wrapChars(text,Math.max(3,Math.floor(maxWidth/(fontSize*.92))),maxLines);return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Hiragino Maru Gothic ProN,Yu Gothic,Meiryo,sans-serif" font-size="${fontSize}" font-weight="900" fill="${fill}">${lines.map((line,i)=>`<tspan x="${x}" dy="${i?lineHeight:0}">${line}</tspan>`).join("")}</text>`;}
  function wrapChars(text,perLine,maxLines){const chars=[...String(text)],lines=[];while(chars.length&&lines.length<maxLines)lines.push(esc(chars.splice(0,perLine).join("")));if(chars.length&&lines.length)lines[lines.length-1]=lines[lines.length-1].slice(0,-1)+"…";return lines.length?lines:[""];}
  function buildKidHtml(){const name=esc(state.name.trim()||"なまえ");return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}のページ</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:18px;background:#eee6d8}svg{display:block;width:min(900px,100%);height:auto;box-shadow:0 16px 40px #0002}</style></head><body>${buildKidSvg()}</body></html>`;}

  function readCurrentInstruction(){if(!("speechSynthesis" in window)){showToast("このブラウザでは よみあげが つかえません");return;}const texts=["ステップ1、HTMLのおしごと。なまえ、ひとこと、写真、すきなものをえらんで、ページのなかみをつくろう。","ステップ2、CSSのおしごと。いろ、ならべかた、かざりセットをえらんで、みためを大きくかえよう。","ステップ3、JavaScriptのおしごと。ボタンをおして、写真のわく、スタンプ、背景のもようをきりかえてしあげよう。できあがりは一枚の写真になるよ。"];speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(texts[currentStep]);u.lang="ja-JP";u.rate=.85;speechSynthesis.speak(u);}
  async function handlePhotoUpload(event){const file=event.target.files?.[0];if(!file)return;if(!/^image\/(png|jpeg|webp)$/i.test(file.type)||file.size>12*1024*1024){showToast("12MBより小さい PNG・JPEG・WebPを えらんでね");event.target.value="";return;}try{state.photo=await resizeImage(file,900,.84);state.avatarMode="photo";changed();showToast("しゃしんを いれたよ！");}catch(_){showToast("しゃしんを よみこめなかったよ");}}
  function resizeImage(file,maxSize,quality){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const image=new Image();image.onerror=reject;image.onload=()=>{const scale=Math.min(1,maxSize/Math.max(image.width,image.height)),width=Math.max(1,Math.round(image.width*scale)),height=Math.max(1,Math.round(image.height*scale));const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const ctx=canvas.getContext("2d",{alpha:false});ctx.fillStyle="#fff";ctx.fillRect(0,0,width,height);ctx.drawImage(image,0,0,width,height);resolve(canvas.toDataURL("image/jpeg",quality));};image.src=String(reader.result);};reader.readAsDataURL(file);});}
  async function openPhonePhotoTransfer(){if(!await ensureTransferServer())return;closePhotoPolling();const dialog=$("#photoDialog"),box=$("#photoQrBox"),status=$("#photoQrStatus"),link=$("#photoShareLink");box.innerHTML="<span>QRをつくっています…</span>";link.hidden=true;status.textContent="アップロード用QRをつくっています…";dialog.showModal();try{const response=await fetch("/api/photo-sessions",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}),data=await response.json();if(!response.ok)throw new Error();activePhotoToken=data.token;const img=new Image();img.alt="しゃしんをおくるQRコード";img.onload=()=>box.replaceChildren(img);img.src=`/api/qr?text=${encodeURIComponent(data.uploadUrl)}&t=${Date.now()}`;link.href=data.uploadUrl;link.hidden=false;status.textContent="スマホでQRをよんで、しゃしんをえらんで『パソコンへ送る』をおしてね。";pollPhotoSession();}catch(_){box.innerHTML="<span>QRをつくれませんでした</span>";status.textContent="QR機能に接続できません。しばらくしてからもういちどためしてね。";}}
  function pollPhotoSession(){clearTimeout(photoPollTimer);if(!activePhotoToken||!$("#photoDialog").open)return;photoPollTimer=setTimeout(async()=>{try{const response=await fetch(`/api/photo-sessions/${encodeURIComponent(activePhotoToken)}`,{cache:"no-store"}),data=await response.json();if(response.status===410){$("#photoQrStatus").textContent="QRのじかんが きれました。もういちど つくってね。";return;}if(data.status==="received"&&isSafeImageDataUrl(data.photo)){state.photo=data.photo;state.avatarMode="photo";changed();$("#photoQrStatus").textContent="しゃしんが とどいたよ！";showToast("スマホから しゃしんが とどいたよ");setTimeout(()=>{if($("#photoDialog").open)closePhotoDialog();},650);return;}pollPhotoSession();}catch(_){pollPhotoSession();}},1300);}
  function closePhotoPolling(){clearTimeout(photoPollTimer);photoPollTimer=0;activePhotoToken="";}function closePhotoDialog(){closePhotoPolling();$("#photoDialog").close();}
  async function openCardDialog(){const dialog=$("#cardDialog"),box=$("#cardQrBox"),status=$("#cardQrStatus"),link=$("#cardShareLink");dialog.showModal();box.innerHTML="<span>しゃしんを つくっています…</span>";link.hidden=true;if(!state.name.trim()){status.textContent="なまえを いれると おくれるよ。";box.innerHTML="<span>なまえを いれてね</span>";return;}try{await drawCard();}catch(_){box.innerHTML="<span>画像をつくれませんでした</span>";status.textContent="もういちどためしてね。";return;}if(!transferInfo.enabled&&!(await checkTransferServer())){status.textContent="QR機能用サーバーに接続できません。このパソコンへの保存はできます。";box.innerHTML="<span>QR機能用サーバーが必要です</span>";return;}try{const dataUrl=$("#cardCanvas").toDataURL("image/png"),response=await fetch("/api/cards",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:dataUrl,filename:`${safeFilename(state.name)}-card.png`,title:`${state.name}のカード`})}),data=await response.json();if(!response.ok)throw new Error();const img=new Image();img.alt="カードをうけとるQRコード";img.onload=()=>box.replaceChildren(img);img.src=`/api/qr?text=${encodeURIComponent(data.cardUrl)}&t=${Date.now()}`;link.href=data.cardUrl;link.hidden=false;status.textContent="スマホで よみこんで、プレビューとおなじ写真を ほぞんしてね。";}catch(_){box.innerHTML="<span>QRをつくれませんでした</span>";status.textContent="このパソコンへの画像保存はできます。";}}
  function drawCard(){return new Promise((resolve,reject)=>{const canvas=$("#cardCanvas"),ctx=canvas.getContext("2d"),blob=new Blob([buildKidSvg()],{type:"image/svg+xml;charset=utf-8"}),url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{ctx.clearRect(0,0,900,1200);ctx.drawImage(img,0,0,900,1200);URL.revokeObjectURL(url);resolve();};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("svg-render"));};img.src=url;});}
  async function downloadCard(){try{await drawCard();const a=document.createElement("a");a.href=$("#cardCanvas").toDataURL("image/png");a.download=`${safeFilename(state.name||"my-page")}-card.png`;a.click();}catch(_){showToast("画像を つくれませんでした");}}
  function downloadHtml(){if(!state.name.trim()){showToast("なまえを いれてから ほぞんしよう");return;}const blob=new Blob([buildKidHtml()],{type:"text/html;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${safeFilename(state.name)}-page.html`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
  async function checkTransferServer(){try{const response=await fetch("/api/config",{cache:"no-store"});if(!response.ok)throw new Error();const data=await response.json();transferInfo={enabled:Boolean(data.enabled),baseUrl:String(data.baseUrl||"")};}catch(_){transferInfo={enabled:false,baseUrl:""};}return transferInfo.enabled;}async function ensureTransferServer(){if(transferInfo.enabled)return true;if(await checkTransferServer())return true;showToast("QR機能に接続できません。しばらくしてからもういちどためしてね");return false;}
  function isSafeImageDataUrl(value){return /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(String(value||""));}function saveState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(_){}}function loadState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");}catch(_){return{};}}function esc(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}function escAttr(value){return esc(value);}function safeFilename(value){return String(value||"my-page").replace(/[\\/:*?"<>|\s]+/g,"-").replace(/^-+|-+$/g,"").slice(0,30)||"my-page";}function showToast(message){clearTimeout(toastTimer);toast.textContent=message;toast.classList.add("show");toastTimer=setTimeout(()=>toast.classList.remove("show"),2200);}
})();
