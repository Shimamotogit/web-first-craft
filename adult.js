(() => {
  "use strict";
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const KEY = "jibun-page-kobo-adult-v1";
  const challenges = {
    cafe:{title:"小さなカフェの紹介",goal:"初めて見る人に雰囲気と魅力を伝え、来店したくなるページを作る。",required:["店・ブランド名","特徴が伝わる一言","おすすめやこだわりの説明","行動ボタン"],examples:["静かな時間","自家焙煎","季節のお菓子"]},
    event:{title:"週末イベントの告知",goal:"日時や内容を迷わず理解でき、参加したくなる告知ページを作る。",required:["イベント名","魅力が伝わる一言","内容・日時などの情報","参加につながるボタン"],examples:["開催内容","日時・場所","参加方法"]},
    product:{title:"新しい文房具の紹介",goal:"商品の特徴と使うメリットを伝え、詳しく知りたくなるページを作る。",required:["商品名","価値が伝わる一言","特徴・使い方","詳しく見るボタン"],examples:["特徴","使い方","おすすめの人"]},
    portfolio:{title:"クリエイター作品紹介",goal:"作風と得意分野を伝え、もっと作品を見たくなるページを作る。",required:["名前・活動名","作風が伝わる一言","作品や得意分野","作品を見るボタン"],examples:["得意分野","代表作","制作するときの考え"]}
  };
  const defaults={challenge:"cafe",difficulty:"normal",title:"",lead:"",intro:"",sections:[{id:id(),title:"",text:""},{id:id(),title:"",text:""}],ctaLabel:"",ctaMessage:"",theme:"editorial",layout:"split",accent:"#c95b3e",font:"gothic",spacing:"normal",photo:"",entry:"fade",action:"message"};
  const state={...defaults,...load()};
  if(!Array.isArray(state.sections)) state.sections=defaults.sections;
  let currentStep=0, lanInfo={enabled:false,baseUrl:""}, photoPoll=null, toastTimer=0, scoreRevealed=false;

  init();
  function init(){ restore(); bind(); renderBrief(); renderSections(); render(); checkLan(); }

  function bind(){
    $$(".adult-steps [data-step]").forEach(b=>b.addEventListener("click",()=>showStep(+b.dataset.step)));
    $$("[data-next]").forEach(b=>b.addEventListener("click",()=>showStep(+b.dataset.next)));
    $$("[data-back]").forEach(b=>b.addEventListener("click",()=>showStep(+b.dataset.back)));
    $("#challengeSelect").addEventListener("change",e=>{state.challenge=e.target.value;saveRender();renderBrief();});
    $("#difficultySelect").addEventListener("change",e=>{state.difficulty=e.target.value;saveRender();renderBrief();});
    [["siteTitle","title"],["siteLead","lead"],["siteIntro","intro"],["ctaLabel","ctaLabel"],["ctaMessage","ctaMessage"]].forEach(([idn,key])=>$("#"+idn).addEventListener("input",e=>{state[key]=e.target.value;saveRender();}));
    $("#addAdultSection").addEventListener("click",()=>{ if(state.sections.length>=6){toast("セクションは6個までです");return;} state.sections.push({id:id(),title:"",text:""});renderSections();saveRender(); });
    bindChoice("#adultThemes [data-theme]","theme"); bindChoice("#adultLayouts [data-layout]","layout"); bindChoice("#entryMotion [data-entry]","entry"); bindChoice("#buttonAction [data-action]","action");
    $("#adultAccent").addEventListener("input",e=>{state.accent=e.target.value;saveRender();});
    $("#fontMood").addEventListener("change",e=>{state.font=e.target.value;saveRender();});
    $("#spacing").addEventListener("change",e=>{state.spacing=e.target.value;saveRender();});
    $("#adultPhotoInput").addEventListener("change",async e=>{const f=e.target.files&&e.target.files[0]; if(!f)return; try{state.photo=await resizeImage(f,1200,.82);renderPhoto();saveRender();}catch{toast("画像を読み込めませんでした");}});
    $("#removeAdultPhoto").addEventListener("click",()=>{state.photo="";renderPhoto();saveRender();});
    $("#adultPhonePhoto").addEventListener("click",startPhonePhoto);
    $("#revealScore").addEventListener("click",()=>{scoreRevealed=true;updateScore(true);toast("採点結果を更新しました");});
    $("#adultDownload").addEventListener("click",downloadHtml);
    $("#adultShare").addEventListener("click",shareHtml);
    $("#adultHelp").addEventListener("click",()=>$("#adultHelpDialog").showModal());
    $$('[data-close]').forEach(b=>b.addEventListener('click',()=>$("#"+b.dataset.close).close()));
    $$('[data-device]').forEach(b=>b.addEventListener('click',()=>{ $$('[data-device]').forEach(x=>x.classList.toggle('active',x===b)); $("#adultBrowser").classList.toggle('mobile',b.dataset.device==='mobile'); $("#adultBrowser").classList.toggle('desktop',b.dataset.device!=='mobile'); }));
  }

  function bindChoice(sel,key){$$(sel).forEach(b=>b.addEventListener('click',()=>{state[key]=b.dataset[key]||defaults[key];$$(sel).forEach(x=>{const yes=x===b;x.classList.toggle('selected',yes);x.setAttribute('aria-pressed',String(yes));});saveRender();}));}
  function restore(){
    $("#challengeSelect").value=state.challenge; $("#difficultySelect").value=state.difficulty;
    $("#siteTitle").value=state.title; $("#siteLead").value=state.lead; $("#siteIntro").value=state.intro; $("#ctaLabel").value=state.ctaLabel; $("#ctaMessage").value=state.ctaMessage;
    $("#adultAccent").value=state.accent; $("#fontMood").value=state.font; $("#spacing").value=state.spacing;
    restoreChoice("#adultThemes [data-theme]","theme");restoreChoice("#adultLayouts [data-layout]","layout");restoreChoice("#entryMotion [data-entry]","entry");restoreChoice("#buttonAction [data-action]","action");renderPhoto();
  }
  function restoreChoice(sel,key){$$(sel).forEach(b=>{const yes=b.dataset[key]===state[key];b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));});}

  function renderBrief(){const c=challenges[state.challenge]||challenges.cafe;const diff={easy:"必要情報を2セクションで整理",normal:"3セクション以上＋デザイン変更",hard:"4セクション以上＋複数の設計変更"}[state.difficulty];$("#briefCard").innerHTML=`<h2>${esc(c.title)}</h2><p>${esc(c.goal)}</p><p><b>${diff}</b></p><ul>${c.required.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;}

  function renderSections(){
    const wrap=$("#adultSections");wrap.replaceChildren();
    if(!state.sections.length){const p=document.createElement('p');p.textContent='セクションを追加して情報を整理しましょう。';wrap.append(p);return;}
    state.sections.forEach((sec,index)=>{const el=document.createElement('article');el.className='adult-section';el.innerHTML=`<div class="adult-section-grid"><input maxlength="28" aria-label="セクション${index+1}の見出し" placeholder="見出し" value="${attr(sec.title)}"><textarea rows="3" maxlength="180" aria-label="セクション${index+1}の本文" placeholder="本文">${esc(sec.text)}</textarea></div><div class="adult-section-actions"><button type="button" data-move="up">↑</button><button type="button" data-move="down">↓</button><button type="button" data-remove>削除</button></div>`;
      const [inp,ta]=el.querySelectorAll('input,textarea');inp.addEventListener('input',e=>{sec.title=e.target.value;saveRender();});ta.addEventListener('input',e=>{sec.text=e.target.value;saveRender();});
      el.querySelector('[data-move="up"]').disabled=index===0;el.querySelector('[data-move="down"]').disabled=index===state.sections.length-1;
      el.querySelector('[data-move="up"]').addEventListener('click',()=>moveSec(index,-1));el.querySelector('[data-move="down"]').addEventListener('click',()=>moveSec(index,1));el.querySelector('[data-remove]').addEventListener('click',()=>{state.sections.splice(index,1);renderSections();saveRender();});wrap.append(el);
    });
  }
  function moveSec(i,d){const j=i+d;if(j<0||j>=state.sections.length)return;[state.sections[i],state.sections[j]]=[state.sections[j],state.sections[i]];renderSections();saveRender();}
  function renderPhoto(){const box=$("#adultPhotoPreview");box.replaceChildren();if(state.photo){const img=new Image();img.src=state.photo;img.alt='選択したキービジュアル';box.append(img);}else{const s=document.createElement('span');s.textContent='IMAGE';box.append(s);}}
  function showStep(i){currentStep=Math.max(0,Math.min(2,i));$$('.adult-panel').forEach((p,x)=>{p.hidden=x!==currentStep;});$$('.adult-steps [data-step]').forEach((b,x)=>b.classList.toggle('active',x===currentStep));window.scrollTo({top:0,behavior:'smooth'});}
  function saveRender(){save();render();}
  function render(){ $("#adultPreview").srcdoc=buildHtml(false); updateScore(scoreRevealed); }

  function buildHtml(standalone=true){
    const c=challenges[state.challenge]||challenges.cafe,title=esc(state.title.trim()||c.title),lead=esc(state.lead.trim()||c.goal),intro=esc(state.intro.trim()||'ここに紹介文が入ります。');
    const sections=state.sections.filter(s=>s.title.trim()||s.text.trim());const secMarkup=(sections.length?sections:[{title:'セクション',text:'ここに内容を追加します。'}]).map((s,i)=>`<article class="content-card"><span>${String(i+1).padStart(2,'0')}</span><h2>${esc(s.title||'見出し')}</h2><p>${esc(s.text||'本文を追加してください。')}</p></article>`).join('');
    const image=state.photo?`<img class="hero-image" src="${attr(state.photo)}" alt="">`:`<div class="hero-image placeholder" aria-hidden="true">${esc(c.examples[0]||'IMAGE')}</div>`;
    const cta=esc(state.ctaLabel.trim()||'もっと見る'), message=escJs(state.ctaMessage.trim()||'ボタンが押されました。');
    const font={gothic:'system-ui,"Yu Gothic",sans-serif',serif:'Georgia,"Yu Mincho",serif',mono:'ui-monospace,SFMono-Regular,monospace'}[state.font]||'system-ui,sans-serif';
    const js=state.action==='none'?'':state.action==='message'?`btn.addEventListener('click',()=>{note.textContent='${message}';note.hidden=false})`:state.action==='theme'?`btn.addEventListener('click',()=>document.body.classList.toggle('alt'))`:`btn.addEventListener('click',()=>document.querySelector('.content').classList.toggle('focus'))`;
    return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>*{box-sizing:border-box}body{margin:0;color:#292724;background:#f4efe6;font-family:${font};line-height:1.7}.site{min-height:100vh;--accent:${state.accent};--space:${state.spacing==='compact'?'22px':state.spacing==='air'?'70px':'42px'}}.hero{display:grid;grid-template-columns:1.1fr .9fr;min-height:58vh}.hero-copy{display:flex;flex-direction:column;justify-content:center;padding:var(--space);background:#fff}.kicker{margin:0 0 12px;color:var(--accent);font-size:.72rem;font-weight:900;letter-spacing:.18em}.hero h1{margin:0;font-size:clamp(2.8rem,7vw,7rem);line-height:.98;letter-spacing:-.05em}.lead{margin:20px 0 0;max-width:42ch;font-size:clamp(1.05rem,2vw,1.45rem);font-weight:700}.intro{margin:20px 0 0;max-width:56ch}.hero-image{width:100%;height:100%;min-height:340px;object-fit:cover;background:var(--accent)}.hero-image.placeholder{display:grid;place-items:center;color:#fff;font-weight:900;font-size:2rem;letter-spacing:.14em}.content{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;padding:var(--space);transition:.3s}.content-card{position:relative;padding:25px;background:#fff;border-top:5px solid var(--accent)}.content-card>span{color:var(--accent);font-size:.72rem;font-weight:900}.content-card h2{margin:8px 0 6px}.content-card p{margin:0;white-space:pre-wrap}.cta{padding:0 var(--space) var(--space)}#cta{padding:13px 22px;color:#fff;background:var(--accent);border:0;font:inherit;font-weight:900;cursor:pointer}.note{display:inline-block;margin-left:12px;padding:9px 12px;background:#fff;border-left:4px solid var(--accent)}.theme-bold .hero-copy{color:#fff;background:#1f1f1f}.theme-bold .hero h1{text-transform:uppercase;text-shadow:4px 4px 0 var(--accent)}.theme-bold .content{background:#f0cb55}.theme-bold .content-card{border:4px solid #1f1f1f;box-shadow:7px 7px 0 var(--accent)}.theme-soft{background:#eee4dc}.theme-soft .hero-copy,.theme-soft .content-card{border-radius:28px}.theme-soft .hero{gap:18px;padding:18px}.theme-soft .hero-image{border-radius:28px}.theme-soft .content-card{border:0;box-shadow:0 14px 35px rgba(60,48,42,.1)}.theme-technical{background:#eaf1f2;background-image:linear-gradient(rgba(46,95,117,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(46,95,117,.09) 1px,transparent 1px);background-size:28px 28px}.theme-technical .hero-copy,.theme-technical .content-card{border:1px solid #76919c}.theme-technical .kicker,.theme-technical .content-card>span{font-family:ui-monospace,monospace}.layout-stack .hero{display:block}.layout-stack .hero-copy{min-height:52vh}.layout-stack .hero-image{height:42vh}.layout-grid .hero{min-height:0;grid-template-columns:1fr}.layout-grid .hero-copy{text-align:center}.layout-grid .lead,.layout-grid .intro{margin-left:auto;margin-right:auto}.layout-grid .hero-image{height:300px;min-height:0}.layout-grid .content{grid-template-columns:repeat(3,minmax(0,1fr))}.entry-fade{animation:fade .65s ease both}.entry-slide .hero-copy{animation:slide .65s ease both}.entry-stagger .content-card{animation:slide .55s ease both}.entry-stagger .content-card:nth-child(2){animation-delay:.1s}.entry-stagger .content-card:nth-child(3){animation-delay:.2s}.entry-stagger .content-card:nth-child(4){animation-delay:.3s}@keyframes fade{from{opacity:0}to{opacity:1}}@keyframes slide{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}.focus .content-card{opacity:.3}.focus .content-card:first-child{opacity:1;transform:scale(1.03);box-shadow:0 18px 40px rgba(0,0,0,.15)}body.alt .site{--accent:#2e5f75}body.alt{background:#dfeaed}@media(max-width:700px){.hero{grid-template-columns:1fr}.hero h1{font-size:clamp(2.7rem,14vw,5rem)}.content,.layout-grid .content{grid-template-columns:1fr}.note{display:block;margin:10px 0 0}}</style></head><body><main class="site theme-${state.theme} layout-${state.layout} entry-${state.entry}"><section class="hero"><div class="hero-copy"><p class="kicker">${esc(c.title).toUpperCase()}</p><h1>${title}</h1><p class="lead">${lead}</p><p class="intro">${intro}</p></div>${image}</section><section class="content">${secMarkup}</section><div class="cta"><button id="cta" type="button">${cta}</button><span id="note" class="note" hidden></span></div></main><script>const btn=document.getElementById('cta'),note=document.getElementById('note');${js}<\/script></body></html>`;
  }

  function score(){
    const diff=state.difficulty, requiredSections=diff==='easy'?2:diff==='normal'?3:4;let html=0,css=0,js=0;const tips=[];
    if(state.title.trim().length>=3)html+=10;else tips.push('HTML：メインタイトルを具体的にする');
    if(state.lead.trim().length>=8)html+=8;else tips.push('HTML：ひとことで価値を伝える');
    if(state.intro.trim().length>=25)html+=7;else tips.push('HTML：紹介文をもう少し具体化する');
    const validSections=state.sections.filter(s=>s.title.trim().length>=2&&s.text.trim().length>=12).length;html+=Math.min(10,Math.round(validSections/requiredSections*10));if(validSections<requiredSections)tips.push(`HTML：内容のあるセクションを${requiredSections}個まで増やす`);
    if(state.ctaLabel.trim().length>=3)html+=5;else tips.push('HTML：行動ボタンの文言を決める');
    css+=state.theme!=='editorial'?10:diff==='easy'?8:5;css+=state.layout!=='split'?9:diff==='easy'?7:4;css+=state.accent.toLowerCase()!=='#c95b3e'?7:3;css+=state.font!=='gothic'?5:2;css+=state.spacing!=='normal'?4:2;if(state.photo)css+=4;css=Math.min(35,css);if(diff!=='easy'&&state.theme==='editorial'&&state.layout==='split')tips.push('CSS：テーマかレイアウトを初期状態から変えて意図を作る');
    if(state.entry!=='none')js+=8;else if(diff==='easy')js+=4;else tips.push('JS：ページ表示の動きを設定する');
    if(state.action!=='none')js+=9;else tips.push('JS：ボタンを押した時の反応を設定する');
    if(state.ctaMessage.trim().length>=5||state.action!=='message')js+=5;else tips.push('JS：ボタン後のメッセージを入力する');
    if(state.ctaLabel.trim()&&state.action!=='none')js+=3;js=Math.min(25,js);
    if(diff==='hard'){ if(validSections<4) html=Math.max(0,html-3); if(state.photo===''&&state.font==='gothic'&&state.spacing==='normal')css=Math.max(0,css-4); if(state.entry==='fade'&&state.action==='message')js=Math.max(0,js-3); }
    return {html:Math.min(40,html),css,js,total:Math.min(100,Math.min(40,html)+css+js),tips};
  }
  function updateScore(showTips){const s=score();$("#totalScore").textContent=s.total;$("#htmlScore").textContent=`${s.html}/40`;$("#cssScore").textContent=`${s.css}/35`;$("#jsScore").textContent=`${s.js}/25`;$("#htmlMeter").value=s.html;$("#cssMeter").value=s.css;$("#jsMeter").value=s.js;$("#scoreLabel").textContent=s.total>=90?'EXCELLENT':s.total>=75?'GOOD':s.total>=55?'あと一歩':'制作中';const ul=$("#scoreTips");ul.replaceChildren();if(showTips){(s.tips.length?s.tips:['お題に必要な要素がそろっています。プレビューで最後の確認を。']).slice(0,4).forEach(t=>{const li=document.createElement('li');li.textContent=t;ul.append(li);});}}

  async function startPhonePhoto(){ if(!await ensureLan())return;openQr('スマホから画像を送る','QRをスマホで読み込み、写真を選んでください。');try{const r=await fetch('/api/photo-sessions',{method:'POST'}),d=await r.json();if(!r.ok)throw 0;showQr(d.uploadUrl);clearInterval(photoPoll);photoPoll=setInterval(async()=>{try{const rr=await fetch('/api/photo-sessions/'+encodeURIComponent(d.token),{cache:'no-store'});const dd=await rr.json();if(dd.status==='received'&&dd.photo){clearInterval(photoPoll);state.photo=dd.photo;renderPhoto();saveRender();$("#adultQrStatus").textContent='受け取りました。ダイアログを閉じて確認してください。';}}catch{}},1400);}catch{qrError();}}
  async function shareHtml(){if(!state.title.trim()){toast('タイトルを入力してから共有してください');return;}if(!await ensureLan())return;openQr('完成サイトをスマホへ送る','同じLAN内で約30分だけ共有します。');try{const r=await fetch('/api/shares',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({html:buildHtml(true),filename:safeFile(state.title)+'.html',nickname:state.title})}),d=await r.json();if(!r.ok)throw 0;showQr(d.shareUrl);$("#adultQrLink").href=d.shareUrl;$("#adultQrLink").hidden=false;}catch{qrError();}}
  function openQr(title,status){$("#adultQrTitle").textContent=title;$("#adultQrStatus").textContent=status;$("#adultQrBox").textContent='QRを準備しています…';$("#adultQrLink").hidden=true;$("#adultQrDialog").showModal();}
  function showQr(url){const img=new Image();img.alt='QRコード';img.onload=()=>$("#adultQrBox").replaceChildren(img);img.onerror=qrError;img.src='/api/qr?text='+encodeURIComponent(url)+'&t='+Date.now();$("#adultQrLink").href=url;$("#adultQrLink").hidden=false;}
  function qrError(){$("#adultQrBox").textContent='QRコードを作れませんでした';$("#adultQrStatus").textContent='ローカルサーバーを起動し直してください。';}
  async function checkLan(){try{const r=await fetch('/api/config',{cache:'no-store'});if(!r.ok)throw 0;const d=await r.json();lanInfo={enabled:!!d.enabled,baseUrl:String(d.baseUrl||'')};}catch{lanInfo={enabled:false,baseUrl:''};}return lanInfo.enabled;}
  async function ensureLan(){if(lanInfo.enabled)return true;if(await checkLan())return true;toast('QR機能は python server.py で起動した時に使えます');return false;}

  function downloadHtml(){if(!state.title.trim()){toast('タイトルを入力してから保存してください');return;}const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([buildHtml(true)],{type:'text/html;charset=utf-8'}));a.download=safeFile(state.title)+'.html';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);}
  function resizeImage(file,max,quality){return new Promise((res,rej)=>{if(!/^image\/(png|jpeg|webp)$/i.test(file.type)||file.size>12*1024*1024){rej();return;}const rd=new FileReader();rd.onerror=rej;rd.onload=()=>{const im=new Image();im.onerror=rej;im.onload=()=>{const s=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*s));c.height=Math.max(1,Math.round(im.height*s));const x=c.getContext('2d');x.drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',quality));};im.src=String(rd.result);};rd.readAsDataURL(file);});}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}}
  function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}');}catch{return {};}}
  function id(){return 's-'+Math.random().toString(36).slice(2,9)+Date.now().toString(36)}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  function attr(v){return esc(v).replace(/`/g,'&#096;');}
  function escJs(v){return String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,' ');}
  function safeFile(v){return String(v||'challenge-site').replace(/[\\/:*?"<>|\s]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50)||'challenge-site';}
  function toast(m){const t=$("#adultToast");clearTimeout(toastTimer);t.textContent=m;t.classList.add('show');toastTimer=setTimeout(()=>t.classList.remove('show'),2200);}
})();
