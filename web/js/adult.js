(() => {
  "use strict";
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const STORAGE_KEY="jibun-page-kobo-adult-v3";
  const SCRIPT_URL=document.currentScript?.src||new URL("js/adult.js",window.location.href).toString();
  const APP_BASE=new URL("../",SCRIPT_URL);
  const appUrl=path=>new URL(String(path).replace(/^\/+/,""),APP_BASE).toString();
  const defaults={
    name:"",tagline:"",intro:"",favorites:["","",""],extraTitle:"",extraText:"",photo:"",
    layout:"split",fontFamily:"sans",
    pageWidth:860,headingSize:58,bodySize:16,photoSize:250,pagePadding:44,sectionGap:24,cornerRadius:18,borderWidth:2,shadowSize:12,
    background:{r:245,g:241,b:234},accent:{r:37,g:94,b:120},text:{r:34,g:39,b:43},
    jsReveal:false,jsRoulette:false,jsPhotoZoom:false,touched:[]
  };
  const state=normalizeState({...defaults,...loadState()});
  let currentStep=0,transferInfo={enabled:false,baseUrl:""},photoToken="",photoTimer=0,toastTimer=0;
  const numericKeys=["pageWidth","headingSize","bodySize","photoSize","pagePadding","sectionGap","cornerRadius","borderWidth","shadowSize"];
  const textMap={profileName:"name",profileTagline:"tagline",profileIntro:"intro",extraTitle:"extraTitle",extraText:"extraText"};
  const cssPoints={layout:4,fontFamily:3,pageWidth:4,headingSize:4,bodySize:3,photoSize:4,pagePadding:4,sectionGap:3,cornerRadius:4,borderWidth:3,shadowSize:3,background:2,accent:2,text:2};
  const MAX_PROFILE_DATA_URL=850000;

  init();

  function init(){restoreControls();bind();renderAll();checkTransferServer();}

  function normalizeState(raw){
    const out={...defaults,...raw};
    out.favorites=Array.isArray(raw.favorites)?[raw.favorites[0]||"",raw.favorites[1]||"",raw.favorites[2]||""]:["","",""];
    out.background={...defaults.background,...(raw.background||{})};out.accent={...defaults.accent,...(raw.accent||{})};out.text={...defaults.text,...(raw.text||{})};
    out.touched=Array.isArray(raw.touched)?raw.touched:[];
    numericKeys.forEach(k=>out[k]=Number.isFinite(Number(out[k]))?Number(out[k]):defaults[k]);
    return out;
  }

  function bind(){
    $$('.adult-steps [data-step]').forEach(b=>b.addEventListener('click',()=>showStep(Number(b.dataset.step))));
    $$('[data-next]').forEach(b=>b.addEventListener('click',()=>showStep(Number(b.dataset.next))));
    $$('[data-back]').forEach(b=>b.addEventListener('click',()=>showStep(Number(b.dataset.back))));

    Object.entries(textMap).forEach(([id,key])=>$("#"+id).addEventListener('input',()=>{state[key]=$("#"+id).value;changed();}));
    [1,2,3].forEach((n,i)=>$("#favorite"+n).addEventListener('input',()=>{state.favorites[i]=$("#favorite"+n).value;changed();}));

    $$('#adultLayouts [data-layout]').forEach(button=>button.addEventListener('click',()=>{state.layout=button.dataset.layout||'split';touch('layout');selectOne('#adultLayouts [data-layout]',button);changed();}));
    $('#fontFamily').addEventListener('change',()=>{state.fontFamily=$('#fontFamily').value;touch('fontFamily');changed();});

    numericKeys.forEach(key=>{
      const input=$("#"+key),range=$(`[data-range-for="${key}"]`);
      input.addEventListener('input',()=>{setNumeric(key,input.value,input);if(range)range.value=state[key];});
      if(range)range.addEventListener('input',()=>{setNumeric(key,range.value,input);input.value=state[key];});
    });

    ['background','accent','text'].forEach(group=>['R','G','B'].forEach(channel=>{
      const input=$("#"+group+channel);input.addEventListener('input',()=>{const k=channel.toLowerCase(),v=clampNumber(input.value,0,255);state[group][k]=v;input.value=v;touch(group);changed();});
    }));

    ['jsReveal','jsRoulette','jsPhotoZoom'].forEach(id=>$("#"+id).addEventListener('change',()=>{state[id]=$("#"+id).checked;changed();}));

    $('#adultPhotoInput').addEventListener('change',handlePhotoUpload);$('#adultPhonePhoto').addEventListener('click',openPhonePhoto);$('#removeAdultPhoto').addEventListener('click',()=>{state.photo='';changed();$('#adultPhotoInput').value='';showToast('写真を外しました');});
    $$('.device-buttons [data-device]').forEach(button=>button.addEventListener('click',()=>{$$('.device-buttons button').forEach(b=>b.classList.toggle('active',b===button));$('#adultBrowser').classList.toggle('mobile',button.dataset.device==='mobile');$('#adultBrowser').classList.toggle('desktop',button.dataset.device!=='mobile');}));
    $('#adultHelp').addEventListener('click',openScoreHelp);
    $$('[data-close]').forEach(button=>button.addEventListener('click',()=>{const dialog=$("#"+button.dataset.close);if(dialog){if(dialog.id==='adultQrDialog')stopPhotoPolling();closeDialog(dialog);}}));
    $('#adultHelpDialog').addEventListener('click',e=>{if(e.target===$('#adultHelpDialog'))closeDialog($('#adultHelpDialog'));});
    $('#adultHelpDialog').addEventListener('close',()=>setHelpOpenState(false));
    $('#adultDownload').addEventListener('click',downloadHtml);$('#adultShare').addEventListener('click',shareHtml);
    $('#adultQrDialog').addEventListener('click',e=>{if(e.target===$('#adultQrDialog')){stopPhotoPolling();$('#adultQrDialog').close();}});
  }

  function setNumeric(key,value,input){const min=Number(input.min||'-99999'),max=Number(input.max||'99999');state[key]=clampNumber(value,min,max);input.value=state[key];touch(key);changed();}
  function touch(key){if(!state.touched.includes(key))state.touched.push(key);}
  function selectOne(selector,selected){$$(selector).forEach(b=>{const yes=b===selected;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));});}

  function restoreControls(){
    Object.entries(textMap).forEach(([id,key])=>$("#"+id).value=state[key]||'');
    [1,2,3].forEach((n,i)=>$("#favorite"+n).value=state.favorites[i]||'');
    $$('#adultLayouts [data-layout]').forEach(b=>{const yes=b.dataset.layout===state.layout;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));});
    $('#fontFamily').value=state.fontFamily;
    numericKeys.forEach(key=>{const input=$("#"+key),range=$(`[data-range-for="${key}"]`);input.value=state[key];if(range)range.value=state[key];});
    ['background','accent','text'].forEach(group=>['R','G','B'].forEach(channel=>$("#"+group+channel).value=state[group][channel.toLowerCase()]));
    ['jsReveal','jsRoulette','jsPhotoZoom'].forEach(id=>$("#"+id).checked=Boolean(state[id]));
  }

  function showStep(index){currentStep=Math.max(0,Math.min(2,index));$$('.adult-panel').forEach((panel,i)=>panel.hidden=i!==currentStep);$$('.adult-steps [data-step]').forEach((b,i)=>b.classList.toggle('active',i===currentStep));window.scrollTo({top:0,behavior:'smooth'});}
  function changed(){saveState();renderAll();}
  function renderAll(){renderPhotoControl();renderRgb();renderCssCode();renderPreview();score();}

  function renderPhotoControl(){const box=$('#adultPhotoPreview'),status=$('#adultPhotoStatus');box.replaceChildren();if(isSafeImageDataUrl(state.photo)){const img=document.createElement('img');img.src=state.photo;img.alt='プロフィール写真';box.append(img);if(status){status.textContent='✓ プロフィール写真を反映しました（HTML +5）';status.classList.add('ready');}}else{const span=document.createElement('span');span.textContent='PHOTO';box.append(span);if(status){status.textContent='プロフィール写真はまだ設定されていません。';status.classList.remove('ready');}}}
  function renderRgb(){['background','accent','text'].forEach(group=>{const value=rgb(state[group]);$("#"+group+'Swatch').style.background=value;$("#"+group+'Code').textContent=value;});}
  function renderCssCode(){$('#cssCodePreview').textContent=`:root {\n  --page-width: ${state.pageWidth}px;\n  --heading-size: ${state.headingSize}px;\n  --body-size: ${state.bodySize}px;\n  --photo-size: ${state.photoSize}px;\n  --page-padding: ${state.pagePadding}px;\n  --gap: ${state.sectionGap}px;\n  --radius: ${state.cornerRadius}px;\n  --border-width: ${state.borderWidth}px;\n  --shadow-size: ${state.shadowSize}px;\n  --background: ${rgb(state.background)};\n  --accent: ${rgb(state.accent)};\n  --text: ${rgb(state.text)};\n}`;}
  function renderPreview(){$('#adultPreview').srcdoc=buildHtml(true);}

  function score(){
    let html=0;const tips=[];
    if(state.name.trim())html+=7;else tips.push('HTML：名前を入れる');
    if(state.tagline.trim())html+=5;else tips.push('HTML：肩書き・ひとことを入れる');
    if(state.intro.trim().length>=12)html+=7;else tips.push('HTML：自己紹介をもう少し書く');
    html+=state.favorites.filter(x=>x.trim()).length*2;
    if(state.favorites.filter(x=>x.trim()).length<3)tips.push('HTML：好きなものを3つ入れる');
    if(state.extraTitle.trim()&&state.extraText.trim())html+=5;else tips.push('HTML：「もっと見る」用の内容を用意する');
    if(isSafeImageDataUrl(state.photo))html+=5;else tips.push('HTML：プロフィール写真を入れる');

    let css=0;Object.entries(cssPoints).forEach(([key,points])=>{if(state.touched.includes(key))css+=points;});
    if(css<20)tips.push('CSS：pxの数字やRGBをいくつか変えて違いを見る');
    else if(css<45)tips.push('CSS：まだ触っていない設定も試してみる');

    let js=0;
    if(state.jsReveal)js+=(state.extraTitle.trim()&&state.extraText.trim())?7:3;
    if(state.jsRoulette)js+=state.favorites.filter(x=>x.trim()).length>=2?7:3;
    if(state.jsPhotoZoom)js+=isSafeImageDataUrl(state.photo)?6:2;
    if(!state.jsReveal&&!state.jsRoulette&&!state.jsPhotoZoom)tips.push('JavaScript：使ってみたい機能を1つ選ぶ');
    else if(js<20)tips.push('JavaScript：選んだ機能に必要な内容をそろえる');

    const total=html+css+js;$('#totalScore').textContent=total;$('#htmlScore').textContent=`${html}/35`;$('#cssScore').textContent=`${css}/45`;$('#jsScore').textContent=`${js}/20`;$('#htmlMeter').value=html;$('#cssMeter').value=css;$('#jsMeter').value=js;
    $('#scoreLabel').textContent=total>=90?'CUSTOM MASTER':total>=70?'かなり作り込んだ':total>=45?'カスタム中':total>0?'まずは実験':'制作中';
    const list=$('#scoreTips');list.replaceChildren();(tips.length?tips:['100点！ 数字をもう一度変えて、どこが変わるか説明してみよう。']).slice(0,4).forEach(t=>{const li=document.createElement('li');li.textContent=t;list.append(li);});
    return {html,css,js,total};
  }

  function buildHtml(previewMode=false){
    const name=esc(state.name.trim()||'YOUR NAME'),tagline=esc(state.tagline.trim()||'好きなことを、Webで形にする。'),intro=esc(state.intro.trim()||'ここに自己紹介を書いてみよう。CSSの数字を変えると、このページの見た目がすぐに変わります。');
    const favs=state.favorites.filter(x=>x.trim()).map(esc);while(favs.length<3)favs.push(['ゲーム','音楽','つくること'][favs.length]);
    const extraTitle=esc(state.extraTitle.trim()||'もっと知る'),extraText=esc(state.extraText.trim()||'ここに追加プロフィールを書いてみよう。');
    const font=state.fontFamily==='serif'?`"Yu Mincho","Hiragino Mincho ProN",serif`:state.fontFamily==='mono'?`ui-monospace,SFMono-Regular,Consolas,monospace`:`"Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif`;
    const photo=isSafeImageDataUrl(state.photo)?`<img id="profilePhoto" src="${escAttr(state.photo)}" alt="${name}のプロフィール写真">`:`<div class="photo-placeholder" id="profilePhoto">${esc((state.name.trim()||'?').slice(0,1).toUpperCase())}</div>`;
    const photoWrap=state.jsPhotoZoom&&isSafeImageDataUrl(state.photo)?`<button class="photo-button" id="photoZoom" type="button" aria-label="写真を拡大">${photo}</button>`:`<div class="photo-wrap">${photo}</div>`;
    const featureButtons=[state.jsReveal?`<button type="button" id="revealButton">もっと見る</button>`:'',state.jsRoulette?`<button type="button" id="rouletteButton">好きなものガチャ</button>`:''].filter(Boolean).join('');
    const reveal=state.jsReveal?`<section class="extra" id="extraPanel" hidden><p class="section-label">MORE</p><h2>${extraTitle}</h2><p>${extraText}</p></section>`:`<section class="extra"><p class="section-label">MORE</p><h2>${extraTitle}</h2><p>${extraText}</p></section>`;
    const roulette=state.jsRoulette?`<p class="roulette-result" id="rouletteResult">ボタンを押すと1つ選ぶよ</p>`:'';
    const script=[];
    if(state.jsReveal)script.push(`document.getElementById('revealButton').addEventListener('click',()=>{const p=document.getElementById('extraPanel');p.hidden=!p.hidden;document.getElementById('revealButton').textContent=p.hidden?'もっと見る':'とじる';});`);
    if(state.jsRoulette)script.push(`const favs=${safeJson(state.favorites.filter(x=>x.trim()).length?state.favorites.filter(x=>x.trim()):['ゲーム','音楽','つくること'])};document.getElementById('rouletteButton').addEventListener('click',()=>{document.getElementById('rouletteResult').textContent='今日のおすすめ：'+favs[Math.floor(Math.random()*favs.length)];});`);
    if(state.jsPhotoZoom&&isSafeImageDataUrl(state.photo))script.push(`const lb=document.getElementById('lightbox');document.getElementById('photoZoom').addEventListener('click',()=>lb.hidden=false);document.getElementById('lightboxClose').addEventListener('click',()=>lb.hidden=true);lb.addEventListener('click',e=>{if(e.target===lb)lb.hidden=true;});`);
    const lightbox=state.jsPhotoZoom&&isSafeImageDataUrl(state.photo)?`<div class="lightbox" id="lightbox" hidden><button id="lightboxClose" type="button">×</button><img src="${escAttr(state.photo)}" alt="拡大したプロフィール写真"></div>`:'';
    return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name} | profile</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:32px 16px;background:${rgb(state.background)};color:${rgb(state.text)};font-family:${font};font-size:${state.bodySize}px;line-height:1.75}button{font:inherit}.profile{width:min(${state.pageWidth}px,calc(100% - 8px));margin:auto;padding:${state.pagePadding}px;background:rgba(255,255,255,.72);border:${state.borderWidth}px solid currentColor;border-radius:${state.cornerRadius}px;box-shadow:${state.shadowSize}px ${state.shadowSize}px 0 rgba(0,0,0,.13)}.hero{display:grid;gap:${state.sectionGap}px;align-items:center}.layout-split .hero{grid-template-columns:minmax(0,1fr) auto}.layout-center .hero{display:flex;flex-direction:column;text-align:center}.layout-offset .hero{grid-template-columns:auto minmax(0,1fr)}.layout-offset .hero-copy{transform:translateY(34px)}.eyebrow,.section-label{margin:0 0 5px;color:${rgb(state.accent)};font-size:.72em;font-weight:900;letter-spacing:.14em}.hero h1{margin:0;font-size:${state.headingSize}px;line-height:1.03;letter-spacing:-.045em}.tagline{margin:12px 0 0;color:${rgb(state.accent)};font-weight:900}.intro{margin:${state.sectionGap}px 0 0;max-width:70ch}.photo-wrap,.photo-button{width:${state.photoSize}px;height:${state.photoSize}px;padding:0;border:${state.borderWidth}px solid currentColor;border-radius:${state.cornerRadius}px;overflow:hidden;background:#fff}.photo-button{cursor:zoom-in}.photo-wrap img,.photo-button img,.photo-placeholder{width:100%;height:100%;object-fit:cover}.photo-placeholder{display:grid;place-items:center;background:${rgb(state.accent)};color:#fff;font-size:calc(${state.photoSize}px * .36);font-weight:900}.favorites{display:grid;grid-template-columns:repeat(3,1fr);gap:${state.sectionGap}px;margin-top:${state.sectionGap}px}.favorite,.extra{padding:calc(${state.pagePadding}px * .42);border:${state.borderWidth}px solid currentColor;border-radius:${state.cornerRadius}px;background:rgba(255,255,255,.65)}.favorite b{display:block;color:${rgb(state.accent)};font-size:.72em;letter-spacing:.1em}.favorite span{display:block;margin-top:6px;font-weight:900}.extra{margin-top:${state.sectionGap}px}.extra h2{margin:0;font-size:1.35em}.extra p:last-child{margin-bottom:0}.interaction-bar{display:flex;flex-wrap:wrap;gap:10px;margin-top:${state.sectionGap}px}.interaction-bar button{padding:10px 15px;color:#fff;background:${rgb(state.accent)};border:${state.borderWidth}px solid currentColor;border-radius:${Math.min(state.cornerRadius,18)}px;font-weight:900;cursor:pointer}.roulette-result{margin:10px 0 0;padding:9px 12px;border-left:5px solid ${rgb(state.accent)};background:rgba(255,255,255,.65);font-weight:900}.lightbox{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:30px;background:#000c}.lightbox[hidden]{display:none}.lightbox img{max-width:min(800px,90vw);max-height:80vh;border:4px solid #fff}.lightbox button{position:absolute;right:25px;top:20px;width:48px;height:48px;color:#fff;background:#222;border:2px solid #fff;border-radius:50%;font-size:24px;cursor:pointer}@media(max-width:650px){body{padding:12px 6px}.profile{padding:max(18px,calc(${state.pagePadding}px * .65))}.layout-split .hero,.layout-offset .hero{grid-template-columns:1fr}.layout-offset .hero-copy{transform:none}.photo-wrap,.photo-button{width:min(${state.photoSize}px,70vw);height:min(${state.photoSize}px,70vw)}.favorites{grid-template-columns:1fr}.hero h1{font-size:min(${state.headingSize}px,15vw)}}
</style></head><body><main class="profile layout-${state.layout}"><section class="hero"><div class="hero-copy"><p class="eyebrow">MY PROFILE</p><h1>${name}</h1><p class="tagline">${tagline}</p><p class="intro">${intro}</p></div>${photoWrap}</section><section class="favorites">${favs.slice(0,3).map((f,i)=>`<div class="favorite"><b>LIKE ${String(i+1).padStart(2,'0')}</b><span>${f}</span></div>`).join('')}</section>${featureButtons?`<div class="interaction-bar">${featureButtons}</div>`:''}${roulette}${reveal}</main>${lightbox}${script.length?`<script>${script.join('')}<\/script>`:''}</body></html>`;
  }

  async function handlePhotoUpload(event){const file=event.target.files?.[0];if(!file)return;if(!/^image\/(png|jpeg|webp)$/i.test(file.type)||file.size>12*1024*1024){showToast('12MB以下のPNG・JPEG・WebPを選んでください');event.target.value='';return;}try{const photo=await resizeProfileImage(file);applyProfilePhoto(photo,'PCから選んだ写真を反映しました');}catch(_){showToast('画像を読み込めませんでした');}}
  function loadProfileImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const image=new Image();image.onerror=reject;image.onload=()=>resolve(image);image.src=String(reader.result);};reader.readAsDataURL(file);});}
  function encodeProfileImage(image,maxSize,quality){const scale=Math.min(1,maxSize/Math.max(image.width,image.height)),w=Math.max(1,Math.round(image.width*scale)),h=Math.max(1,Math.round(image.height*scale)),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('canvas');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(image,0,0,w,h);return canvas.toDataURL('image/jpeg',quality);}
  async function resizeProfileImage(file){const image=await loadProfileImage(file),attempts=[[1000,.84],[900,.80],[800,.76],[720,.72],[640,.70],[560,.68]];let result='';for(const [maxSize,quality] of attempts){result=encodeProfileImage(image,maxSize,quality);if(result.length<=MAX_PROFILE_DATA_URL)return result;}throw new Error('too-large');}
  function applyProfilePhoto(photo,message){if(!isSafeImageDataUrl(photo)){showToast('写真データを反映できませんでした');return false;}state.photo=photo;const persisted=saveState();renderAll();showToast(persisted?message:'写真は反映しましたが、ブラウザへの保存容量が足りません');return true;}

  async function openPhonePhoto(){if(!await ensureTransferServer())return;stopPhotoPolling();const dialog=$('#adultQrDialog'),box=$('#adultQrBox'),status=$('#adultQrStatus'),link=$('#adultQrLink');$('#adultQrTitle').textContent='スマホから写真を送る';box.textContent='QRを準備しています…';status.textContent='';link.hidden=true;dialog.showModal();try{const response=await fetch(appUrl('api/photo-sessions'),{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),data=await response.json();if(!response.ok)throw new Error();photoToken=data.token;setQr(box,data.uploadUrl,'写真アップロード用QRコード');link.href=data.uploadUrl;link.hidden=false;status.textContent='スマホで読み込み、写真を選んで「パソコンへ送る」を押してください。';pollPhoto();}catch(_){box.textContent='QRを作れませんでした';status.textContent='QR機能用サーバーに接続できません。公開サーバーの設定を確認してください。';}}
  function pollPhoto(){clearTimeout(photoTimer);if(!photoToken||!$('#adultQrDialog').open)return;photoTimer=setTimeout(async()=>{try{const response=await fetch(appUrl(`api/photo-sessions/${encodeURIComponent(photoToken)}`),{cache:'no-store'}),data=await response.json();if(response.status===410){$('#adultQrStatus').textContent='アップロードURLの期限が切れました。';return;}if(data.status==='received'&&isSafeImageDataUrl(data.photo)){applyProfilePhoto(data.photo,'スマホから写真を受け取り、プロフィールへ反映しました');$('#adultQrStatus').textContent='写真を受け取り、プロフィールへ反映しました。';setTimeout(()=>{if($('#adultQrDialog').open)$('#adultQrDialog').close();},900);stopPhotoPolling();return;}pollPhoto();}catch(_){pollPhoto();}},1300);}
  function stopPhotoPolling(){clearTimeout(photoTimer);photoTimer=0;photoToken='';}

  function downloadHtml(){const blob=new Blob([buildHtml(false)],{type:'text/html;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${safeFilename(state.name||'my-profile')}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
  async function shareHtml(){if(!await ensureTransferServer())return;const dialog=$('#adultQrDialog'),box=$('#adultQrBox'),status=$('#adultQrStatus'),link=$('#adultQrLink');$('#adultQrTitle').textContent='完成サイトをスマホへ';box.textContent='QRを準備しています…';status.textContent='';link.hidden=true;dialog.showModal();try{const response=await fetch(appUrl('api/shares'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({html:buildHtml(false),filename:`${safeFilename(state.name||'my-profile')}.html`,nickname:state.name||'profile'})}),data=await response.json();if(!response.ok)throw new Error();setQr(box,data.shareUrl,'完成サイト共有QRコード');link.href=data.shareUrl;link.hidden=false;status.textContent='スマホで読み込むと、完成ページを開いてHTMLを保存できます。';}catch(_){box.textContent='QRを作れませんでした';status.textContent='QR機能用サーバーを確認してください。';}}
  function setQr(box,url,alt){const img=new Image();img.alt=alt;img.onload=()=>box.replaceChildren(img);img.src=appUrl(`api/qr?text=${encodeURIComponent(url)}&t=${Date.now()}`);}
  async function checkTransferServer(){try{const response=await fetch(appUrl('api/config'),{cache:'no-store'});if(!response.ok)throw new Error();const data=await response.json();transferInfo={enabled:Boolean(data.enabled),baseUrl:String(data.baseUrl||'')};}catch(_){transferInfo={enabled:false,baseUrl:''};}return transferInfo.enabled;}
  function setHelpOpenState(open){const button=$('#adultHelp');button.setAttribute('aria-expanded',String(Boolean(open)));button.classList.toggle('active',Boolean(open));button.textContent=open?'採点ルールを表示中':'採点ルール';}
  function openScoreHelp(){const dialog=$('#adultHelpDialog');setHelpOpenState(true);try{if(typeof dialog.showModal==='function'){if(!dialog.open)dialog.showModal();}else{dialog.setAttribute('open','');}}catch(_){dialog.setAttribute('open','');}dialog.querySelector('.dialog-close')?.focus();}
  function closeDialog(dialog){if(!dialog)return;try{if(typeof dialog.close==='function'&&dialog.open)dialog.close();else dialog.removeAttribute('open');}catch(_){dialog.removeAttribute('open');}if(dialog.id==='adultHelpDialog')setHelpOpenState(false);}

  async function ensureTransferServer(){if(transferInfo.enabled||await checkTransferServer())return true;showToast('QR機能用サーバーに接続できません。公開サーバーの設定を確認してください');return false;}

  function rgb(c){return `rgb(${clampNumber(c.r,0,255)}, ${clampNumber(c.g,0,255)}, ${clampNumber(c.b,0,255)})`;}
  function safeJson(value){return JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');}
  function clampNumber(v,min,max){const n=Number(v);return Math.max(min,Math.min(max,Number.isFinite(n)?Math.round(n):min));}
  function isSafeImageDataUrl(value){return /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(String(value||''));}
  function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}function escAttr(v){return esc(v);}function safeFilename(v){return String(v||'my-profile').replace(/[\\/:*?"<>|\s]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'my-profile';}
  function saveState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch(_){return false;}}function loadState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');}catch(_){return{};}}
  function showToast(message){clearTimeout(toastTimer);const t=$('#adultToast');t.textContent=message;t.classList.add('show');toastTimer=setTimeout(()=>t.classList.remove('show'),2200);}
})();
