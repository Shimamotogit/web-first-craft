(() => {
  "use strict";
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const STORAGE_KEY="jibun-page-kobo-adult-v3";
  const SCRIPT_URL=document.currentScript?.src||new URL("js/adult.js",window.location.href).toString();
  const APP_BASE=new URL("../",SCRIPT_URL);
  const appUrl=path=>new URL(String(path).replace(/^\/+/,""),APP_BASE).toString();
  const defaults={
    name:"",tagline:"",intro:"",favorites:["","",""],extraTitle:"",extraText:"",photo:"",photoMode:"unset",
    layout:"split",fontFamily:"sans",
    pageWidth:860,headingSize:58,bodySize:16,photoSize:250,pagePadding:44,sectionGap:24,cornerRadius:18,borderWidth:2,shadowSize:12,
    background:{r:245,g:241,b:234},accent:{r:37,g:94,b:120},text:{r:34,g:39,b:43},
    jsReveal:false,jsRoulette:false,jsPhotoZoom:false,touched:[]
  };
  const numericBounds={
    pageWidth:[520,1180],headingSize:[28,96],bodySize:[12,26],photoSize:[120,360],
    pagePadding:[12,100],sectionGap:[6,64],cornerRadius:[0,48],borderWidth:[0,8],shadowSize:[0,30]
  };
  const numericKeys=Object.keys(numericBounds);
  const textMap={profileName:"name",profileTagline:"tagline",profileIntro:"intro",extraTitle:"extraTitle",extraText:"extraText"};
  const htmlPoints={name:7,tagline:5,intro:7,favorite0:2,favorite1:2,favorite2:2,extraTitle:2,extraText:3,photoDecision:5};
  const cssPoints={layout:4,fontFamily:3,pageWidth:4,headingSize:4,bodySize:3,photoSize:4,pagePadding:4,sectionGap:3,cornerRadius:4,borderWidth:3,shadowSize:3,background:2,accent:2,text:2};
  const jsPoints={jsReveal:7,jsRoulette:7,jsPhotoZoom:6};
  const scoringKeys=new Set([...Object.keys(htmlPoints),...Object.keys(cssPoints),...Object.keys(jsPoints)]);
  const MAX_PROFILE_DATA_URL=850000;
  const state=normalizeState(loadState());
  let currentStep=0,transferInfo={enabled:false,baseUrl:""},photoToken="",photoTimer=0,toastTimer=0;

  init();

  function init(){ensureColorPickers();restoreControls();bind();setupPreviewSizing();renderAll();checkTransferServer();}

  function ensureColorPickers(){
    const labels={background:'背景',accent:'アクセント',text:'文字'};
    ['background','accent','text'].forEach(group=>{
      if($('#'+group+'Picker'))return;
      const head=$(`.rgb-card[data-rgb-group="${group}"] .rgb-card-head`);
      if(!head)return;
      const label=document.createElement('label');
      label.className='visual-color-picker';
      label.style.cssText='display:flex;align-items:center;gap:7px;font-size:.72rem;font-weight:900;white-space:nowrap;cursor:pointer';
      label.textContent='色を選ぶ';
      const picker=document.createElement('input');
      picker.id=group+'Picker';picker.type='color';picker.setAttribute('aria-label',labels[group]+'色をマウスで選ぶ');
      picker.style.cssText='width:46px;height:34px;padding:2px;border:2px solid #28333b;border-radius:7px;background:#fff;cursor:pointer';
      label.append(picker);head.append(label);
    });
  }

  function normalizeState(raw){
    const source=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    const out={...defaults};
    for(const key of ['name','tagline','intro','extraTitle','extraText'])out[key]=typeof source[key]==='string'?source[key]:defaults[key];
    out.favorites=Array.isArray(source.favorites)?[0,1,2].map(i=>typeof source.favorites[i]==='string'?source.favorites[i]:''):["","",""];
    out.layout=['split','center','offset'].includes(source.layout)?source.layout:defaults.layout;
    out.fontFamily=['sans','serif','mono'].includes(source.fontFamily)?source.fontFamily:defaults.fontFamily;
    for(const key of numericKeys){const n=Number(source[key]),[min,max]=numericBounds[key];out[key]=Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):defaults[key];}
    for(const group of ['background','accent','text']){const value=source[group]&&typeof source[group]==='object'?source[group]:{};out[group]={r:normalizeChannel(value.r,defaults[group].r),g:normalizeChannel(value.g,defaults[group].g),b:normalizeChannel(value.b,defaults[group].b)};}
    for(const key of ['jsReveal','jsRoulette','jsPhotoZoom'])out[key]=source[key]===true;
    out.touched=Array.isArray(source.touched)?[...new Set(source.touched.filter(key=>typeof key==='string'&&scoringKeys.has(key)))]:[];
    const photo=typeof source.photo==='string'?source.photo:'';
    out.photo=isSafeImageDataUrl(photo)&&photo.length<=2800000?photo:'';
    const inferredPhotoMode=out.photo?'photo':'unset';
    out.photoMode=['unset','photo','none'].includes(source.photoMode)?source.photoMode:inferredPhotoMode;
    if(out.photoMode==='photo'&&!out.photo)out.photoMode='unset';
    if(out.photoMode==='none')out.photo='';
    if(out.photoMode!=='photo')out.jsPhotoZoom=false;

    // 旧バージョンでは得点履歴がCSSだけだったため、現在すでに達成済みの値を履歴へ移行する。
    for(const key of ['name','tagline','intro','extraTitle','extraText'])if(out[key].trim())markTouched(out,key);
    out.favorites.forEach((value,index)=>{if(value.trim())markTouched(out,`favorite${index}`);});
    if(out.photoMode==='photo'||out.photoMode==='none')markTouched(out,'photoDecision');
    if(out.photoMode==='none')markTouched(out,'jsPhotoZoom');
    Object.keys(cssPoints).forEach(key=>{if(valueDiffersFromDefault(out,key))markTouched(out,key);});
    Object.keys(jsPoints).forEach(key=>{if(out[key]!==defaults[key])markTouched(out,key);});
    return out;
  }
  function normalizeChannel(value,fallback){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(255,Math.round(n))):fallback;}
  function markTouched(target,key){if(scoringKeys.has(key)&&!target.touched.includes(key))target.touched.push(key);}

  function bind(){
    $$('.adult-steps [data-step]').forEach(b=>b.addEventListener('click',()=>showStep(Number(b.dataset.step))));
    $$('[data-next]').forEach(b=>b.addEventListener('click',()=>showStep(Number(b.dataset.next))));
    $$('[data-back]').forEach(b=>b.addEventListener('click',()=>showStep(Number(b.dataset.back))));

    Object.entries(textMap).forEach(([id,key])=>$("#"+id).addEventListener('input',()=>{state[key]=$("#"+id).value;if(state[key].trim()!==defaults[key])touch(key);changed();}));
    [1,2,3].forEach((n,i)=>$("#favorite"+n).addEventListener('input',()=>{state.favorites[i]=$("#favorite"+n).value;if(state.favorites[i].trim())touch(`favorite${i}`);changed();}));

    $$('#adultLayouts [data-layout]').forEach(button=>button.addEventListener('click',()=>{state.layout=button.dataset.layout||'split';if(valueDiffersFromDefault(state,'layout'))touch('layout');selectOne('#adultLayouts [data-layout]',button);changed();}));
    $('#fontFamily').addEventListener('change',()=>{state.fontFamily=$('#fontFamily').value;if(valueDiffersFromDefault(state,'fontFamily'))touch('fontFamily');changed();});

    numericKeys.forEach(key=>{
      const input=$("#"+key),range=$(`[data-range-for="${key}"]`);
      input.addEventListener('input',()=>{setNumeric(key,input.value,input);if(range)range.value=state[key];});
      if(range)range.addEventListener('input',()=>{setNumeric(key,range.value,input);input.value=state[key];});
    });

    ['background','accent','text'].forEach(group=>{
      ['R','G','B'].forEach(channel=>{
        const input=$("#"+group+channel);input.addEventListener('input',()=>{const k=channel.toLowerCase(),v=clampNumber(input.value,0,255);state[group][k]=v;input.value=v;if(valueDiffersFromDefault(state,group))touch(group);changed();});
      });
      const picker=$("#"+group+'Picker');
      picker.addEventListener('input',()=>{const value=hexToRgb(picker.value);state[group]=value;['R','G','B'].forEach(channel=>$("#"+group+channel).value=value[channel.toLowerCase()]);if(valueDiffersFromDefault(state,group))touch(group);changed();});
    });

    ['jsReveal','jsRoulette','jsPhotoZoom'].forEach(id=>$("#"+id).addEventListener('change',()=>{state[id]=$("#"+id).checked;if(state[id]!==defaults[id])touch(id);changed();}));

    $('#adultPhotoInput').addEventListener('change',handlePhotoUpload);$('#adultPhonePhoto').addEventListener('click',openPhonePhoto);$('#adultNoPhoto').addEventListener('click',chooseNoPhoto);$('#removeAdultPhoto').addEventListener('click',resetPhotoChoice);
    $$('.device-buttons [data-device]').forEach(button=>button.addEventListener('click',()=>{$$('.device-buttons button').forEach(b=>b.classList.toggle('active',b===button));$('#adultBrowser').classList.toggle('mobile',button.dataset.device==='mobile');$('#adultBrowser').classList.toggle('desktop',button.dataset.device!=='mobile');requestAnimationFrame(updatePreviewSize);}));
    $('#adultHelp').addEventListener('click',openScoreHelp);
    $$('[data-close]').forEach(button=>button.addEventListener('click',()=>{const dialog=$("#"+button.dataset.close);if(dialog){if(dialog.id==='adultQrDialog')stopPhotoPolling();closeDialog(dialog);}}));
    $('#adultHelpDialog').addEventListener('click',e=>{if(e.target===$('#adultHelpDialog'))closeDialog($('#adultHelpDialog'));});
    $('#adultHelpDialog').addEventListener('close',()=>setHelpOpenState(false));
    $('#adultDownload').addEventListener('click',downloadHtml);$('#adultOpenLive').addEventListener('click',openLivePreview);$('#adultShare').addEventListener('click',shareHtml);
    $('#adultQrDialog').addEventListener('click',e=>{if(e.target===$('#adultQrDialog')){stopPhotoPolling();$('#adultQrDialog').close();}});
  }

  function setNumeric(key,value,input){const min=Number(input.min||'-99999'),max=Number(input.max||'99999');state[key]=clampNumber(value,min,max);input.value=state[key];if(valueDiffersFromDefault(state,key))touch(key);changed();}
  function touch(key){markTouched(state,key);}
  function selectOne(selector,selected){$$(selector).forEach(b=>{const yes=b===selected;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));});}

  function restoreControls(){
    Object.entries(textMap).forEach(([id,key])=>$("#"+id).value=state[key]||'');
    [1,2,3].forEach((n,i)=>$("#favorite"+n).value=state.favorites[i]||'');
    $$('#adultLayouts [data-layout]').forEach(b=>{const yes=b.dataset.layout===state.layout;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));});
    $('#fontFamily').value=state.fontFamily;
    numericKeys.forEach(key=>{const input=$("#"+key),range=$(`[data-range-for="${key}"]`);input.value=state[key];if(range)range.value=state[key];});
    ['background','accent','text'].forEach(group=>{['R','G','B'].forEach(channel=>$("#"+group+channel).value=state[group][channel.toLowerCase()]);$("#"+group+'Picker').value=rgbHex(state[group]);});
    ['jsReveal','jsRoulette','jsPhotoZoom'].forEach(id=>$("#"+id).checked=Boolean(state[id]));
  }

  function showStep(index){currentStep=Math.max(0,Math.min(2,index));$$('.adult-panel').forEach((panel,i)=>panel.hidden=i!==currentStep);$$('.adult-steps [data-step]').forEach((b,i)=>b.classList.toggle('active',i===currentStep));window.scrollTo({top:0,behavior:'smooth'});}
  function changed(){saveState();renderAll();}
  function renderAll(){renderPhotoControl();syncPhotoZoomAvailability();renderRgb();renderCssCode();renderPreview();score();updatePreviewSize();}

  function hasProfilePhoto(){return state.photoMode==='photo'&&isSafeImageDataUrl(state.photo);}
  function renderPhotoControl(){const box=$('#adultPhotoPreview'),status=$('#adultPhotoStatus'),noPhoto=$('#adultNoPhoto');box.replaceChildren();box.classList.toggle('no-photo',state.photoMode==='none');noPhoto.classList.toggle('selected',state.photoMode==='none');noPhoto.setAttribute('aria-pressed',String(state.photoMode==='none'));if(hasProfilePhoto()){const img=document.createElement('img');img.src=state.photo;img.alt='プロフィール写真';box.append(img);status.textContent='✓ プロフィール写真を反映しました（HTML +5）';status.classList.add('ready');}else if(state.photoMode==='none'){const span=document.createElement('span');span.textContent='NO PHOTO';box.append(span);status.textContent='✓ 「写真を載せない」を反映しました（HTML +5）';status.classList.add('ready');}else{const span=document.createElement('span');span.textContent='PHOTO';box.append(span);status.textContent=state.touched.includes('photoDecision')?'写真設定は達成済みです。必要ならもう一度選べます。':'写真を使うか「写真を載せない」を選んでください。';status.classList.toggle('ready',state.touched.includes('photoDecision'));}}
  function chooseNoPhoto(){stopPhotoPolling();state.photo='';state.photoMode='none';state.jsPhotoZoom=false;touch('photoDecision');touch('jsPhotoZoom');$('#adultPhotoInput').value='';$('#jsPhotoZoom').checked=false;changed();showToast('写真を載せない設定を反映しました');}
  function resetPhotoChoice(){stopPhotoPolling();state.photo='';state.photoMode='unset';state.jsPhotoZoom=false;$('#adultPhotoInput').value='';$('#jsPhotoZoom').checked=false;changed();showToast('写真の設定を未設定に戻しました（獲得済みの点数は残ります）');}
  function syncPhotoZoomAvailability(){const input=$('#jsPhotoZoom'),feature=$('#jsPhotoZoomFeature'),description=$('#jsPhotoZoomDescription'),hasPhoto=hasProfilePhoto();input.disabled=!hasPhoto;if(!hasPhoto&&state.jsPhotoZoom){state.jsPhotoZoom=false;input.checked=false;}feature.setAttribute('aria-disabled',String(!hasPhoto));description.textContent=state.photoMode==='none'?'「写真を載せない」設定なので、この6点は対象外として達成扱いです。':hasPhoto?'プロフィール写真をクリックすると、大きく表示して閉じられます。':state.touched.includes('jsPhotoZoom')?'写真拡大の得点は達成済みです。写真を設定すると機能をもう一度使えます。':'プロフィール写真を設定すると、この機能を選べます。';}
  function renderRgb(){['background','accent','text'].forEach(group=>{const value=rgb(state[group]);$("#"+group+'Swatch').style.background=value;$("#"+group+'Code').textContent=value;$("#"+group+'Picker').value=rgbHex(state[group]);});}
  function renderCssCode(){$('#cssCodePreview').textContent=`:root {\n  --page-width: ${state.pageWidth}px;\n  --heading-size: ${state.headingSize}px;\n  --body-size: ${state.bodySize}px;\n  --photo-size: ${state.photoSize}px;\n  --page-padding: ${state.pagePadding}px;\n  --gap: ${state.sectionGap}px;\n  --radius: ${state.cornerRadius}px;\n  --border-width: ${state.borderWidth}px;\n  --shadow-size: ${state.shadowSize}px;\n  --background: ${rgb(state.background)};\n  --accent: ${rgb(state.accent)};\n  --text: ${rgb(state.text)};\n}`;}
  function renderPreview(){$('#adultPreview').srcdoc=buildHtml(true);}
  const DESKTOP_PREVIEW_WIDTH=1240,DESKTOP_PREVIEW_HEIGHT=920,MOBILE_PREVIEW_WIDTH=390,MOBILE_PREVIEW_HEIGHT=760;
  let previewResizeObserver=null;
  function setupPreviewSizing(){const viewport=$('#adultPreviewViewport');if(typeof ResizeObserver==='function'){previewResizeObserver=new ResizeObserver(updatePreviewSize);previewResizeObserver.observe(viewport);}window.addEventListener('resize',updatePreviewSize);}
  function updatePreviewSize(){const browser=$('#adultBrowser'),viewport=$('#adultPreviewViewport'),frame=$('#adultPreview');if(!browser||!viewport||!frame)return;const mobile=browser.classList.contains('mobile'),virtualWidth=mobile?MOBILE_PREVIEW_WIDTH:DESKTOP_PREVIEW_WIDTH,virtualHeight=mobile?MOBILE_PREVIEW_HEIGHT:DESKTOP_PREVIEW_HEIGHT,available=Math.max(1,viewport.clientWidth||browser.clientWidth||virtualWidth),scale=Math.min(1,available/virtualWidth);frame.style.width=`${virtualWidth}px`;frame.style.height=`${virtualHeight}px`;frame.style.transform=`scale(${scale})`;viewport.style.height=`${Math.ceil(virtualHeight*scale)}px`;browser.dataset.virtualWidth=String(virtualWidth);browser.dataset.previewScale=scale.toFixed(4);}

  function valueDiffersFromDefault(target,key){
    if(['background','accent','text'].includes(key))return ['r','g','b'].some(channel=>target[key][channel]!==defaults[key][channel]);
    return target[key]!==defaults[key];
  }

  function score(){
    const hasEarned=key=>state.touched.includes(key),tips=[];
    let html=0;Object.entries(htmlPoints).forEach(([key,points])=>{if(hasEarned(key))html+=points;});
    if(!hasEarned('name'))tips.push('HTML：名前を入れる');
    else if(!hasEarned('tagline'))tips.push('HTML：肩書き・ひとことを入れる');
    else if(!hasEarned('intro'))tips.push('HTML：自己紹介を入れる');
    if(['favorite0','favorite1','favorite2'].some(key=>!hasEarned(key)))tips.push('HTML：好きなものを3つ試す');
    if(!hasEarned('extraTitle')||!hasEarned('extraText'))tips.push('HTML：「もっと見る」の見出しと説明を入れる');
    if(!hasEarned('photoDecision'))tips.push('HTML：写真を入れるか「写真を載せない」を選ぶ');

    let css=0;Object.entries(cssPoints).forEach(([key,points])=>{if(hasEarned(key))css+=points;});
    if(css===0)tips.push('CSS：デフォルトの数字・色・レイアウトを1つ変える');
    else if(css<45)tips.push('CSS：まだ試していない設定も変えてみる');

    let js=0;Object.entries(jsPoints).forEach(([key,points])=>{if(hasEarned(key))js+=points;});
    if(js===0)tips.push('JavaScript：使ってみたい機能を1つONにする');
    else if(js<20)tips.push('JavaScript：まだ試していない機能もONにしてみる');

    const total=html+css+js;$('#totalScore').textContent=total;$('#htmlScore').textContent=`${html}/35`;$('#cssScore').textContent=`${css}/45`;$('#jsScore').textContent=`${js}/20`;$('#htmlMeter').value=html;$('#cssMeter').value=css;$('#jsMeter').value=js;
    $('#scoreLabel').textContent=total===100?'CUSTOM MASTER':total>=70?'かなり作り込んだ':total>=45?'カスタム中':total>0?'まずは実験':'制作中';
    const list=$('#scoreTips');list.replaceChildren();(tips.length?tips:['100点！ 全部の対象項目を一度以上試しました。']).slice(0,4).forEach(t=>{const li=document.createElement('li');li.textContent=t;list.append(li);});
    return {html,css,js,total};
  }

  function buildHtml(previewMode=false){
    const name=esc(state.name.trim()||'YOUR NAME'),tagline=esc(state.tagline.trim()||'好きなことを、Webで形にする。'),intro=esc(state.intro.trim()||'ここに自己紹介を書いてみよう。CSSの数字を変えると、このページの見た目がすぐに変わります。');
    const favs=state.favorites.filter(x=>x.trim()).map(esc);
    const favoritesSection=favs.length?`<section class="favorites">${favs.map((f,i)=>`<div class="favorite"><b>LIKE ${String(i+1).padStart(2,'0')}</b><span>${f}</span></div>`).join('')}</section>`:'';
    const extraTitle=esc(state.extraTitle.trim()||'もっと知る'),extraText=esc(state.extraText.trim()||'ここに追加プロフィールを書いてみよう。');
    const font=state.fontFamily==='serif'?`"Yu Mincho","Hiragino Mincho ProN",serif`:state.fontFamily==='mono'?`ui-monospace,SFMono-Regular,Consolas,monospace`:`"Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif`;
    const hasPhoto=hasProfilePhoto(),noPhoto=state.photoMode==='none';
    const photo=hasPhoto?`<img id="profilePhoto" src="${escAttr(state.photo)}" alt="${name}のプロフィール写真">`:`<div class="photo-placeholder" id="profilePhoto">${esc((state.name.trim()||'?').slice(0,1).toUpperCase())}</div>`;
    const photoWrap=noPhoto?'':state.jsPhotoZoom&&hasPhoto?`<button class="photo-button" id="photoZoom" type="button" aria-label="写真を拡大">${photo}</button>`:`<div class="photo-wrap">${photo}</div>`;
    const featureButtons=[state.jsReveal?`<button type="button" id="revealButton">もっと見る</button>`:'',state.jsRoulette?`<button type="button" id="rouletteButton">好きなものガチャ</button>`:''].filter(Boolean).join('');
    const reveal=state.jsReveal?`<section class="extra" id="extraPanel" hidden><h2>${extraTitle}</h2><p>${extraText}</p></section>`:`<section class="extra"><h2>${extraTitle}</h2><p>${extraText}</p></section>`;
    const roulette=state.jsRoulette?`<p class="roulette-result" id="rouletteResult">${favs.length?'ボタンを押すと1つ選ぶよ':'好きなものを入力するとガチャできます'}</p>`:'';
    const script=[];
    if(state.jsReveal)script.push(`document.getElementById('revealButton').addEventListener('click',()=>{const p=document.getElementById('extraPanel');p.hidden=!p.hidden;document.getElementById('revealButton').textContent=p.hidden?'もっと見る':'とじる';});`);
    if(state.jsRoulette){const rouletteFavorites=state.favorites.filter(x=>x.trim());script.push(`const favs=${safeJson(rouletteFavorites)};let rouletteLast=-1,rouletteCount=0;document.getElementById('rouletteButton').addEventListener('click',()=>{rouletteCount+=1;if(!favs.length){document.getElementById('rouletteResult').textContent='好きなものを入力するとガチャできます';return;}let choices=favs.map((_,i)=>i).filter(i=>i!==rouletteLast);if(!choices.length)choices=[0];rouletteLast=choices[Math.floor(Math.random()*choices.length)];document.getElementById('rouletteResult').textContent='ガチャ '+rouletteCount+'回目：'+favs[rouletteLast];});`);}
    if(state.jsPhotoZoom&&hasPhoto)script.push(`const lb=document.getElementById('lightbox');document.getElementById('photoZoom').addEventListener('click',()=>lb.hidden=false);document.getElementById('lightboxClose').addEventListener('click',()=>lb.hidden=true);lb.addEventListener('click',e=>{if(e.target===lb)lb.hidden=true;});`);
    const lightbox=state.jsPhotoZoom&&hasPhoto?`<div class="lightbox" id="lightbox" hidden><button id="lightboxClose" type="button">×</button><img src="${escAttr(state.photo)}" alt="拡大したプロフィール写真"></div>`:'';
    const noScriptNotice=script.length?`<noscript><div class="script-warning"><strong>JavaScriptが無効なプレビューです。</strong><br>もっと見る・ガチャ・写真拡大を試すときは、このHTMLをWebブラウザで開いてください。</div></noscript>`:'';
    return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name} | profile</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:32px 16px;background:${rgb(state.background)};color:${rgb(state.text)};font-family:${font};font-size:${state.bodySize}px;line-height:1.75}button{font:inherit}.profile{width:min(${state.pageWidth}px,calc(100% - 8px));margin:auto;padding:${state.pagePadding}px;background:rgba(255,255,255,.72);border:${state.borderWidth}px solid currentColor;border-radius:${state.cornerRadius}px;box-shadow:${state.shadowSize}px ${state.shadowSize}px 0 rgba(0,0,0,.13)}.hero{display:flex;flex-direction:column;gap:${state.sectionGap}px}.layout-split .hero{align-items:flex-start;text-align:left}.layout-center .hero{align-items:center;text-align:center}.layout-offset .hero{align-items:flex-end;text-align:right}.layout-center .hero-copy,.layout-offset .hero-copy{width:100%}.layout-center .intro{margin-left:auto;margin-right:auto}.layout-offset .intro{margin-left:auto}.layout-center .favorites,.layout-center .extra,.layout-center .roulette-result{text-align:center}.layout-center .interaction-bar{justify-content:center}.layout-offset .favorites,.layout-offset .extra,.layout-offset .roulette-result{text-align:right}.layout-offset .interaction-bar{justify-content:flex-end}.eyebrow,.section-label{margin:0 0 5px;color:${rgb(state.accent)};font-size:.72em;font-weight:900;letter-spacing:.14em}.hero h1{margin:0;font-size:${state.headingSize}px;line-height:1.03;letter-spacing:-.045em}.tagline{margin:12px 0 0;color:${rgb(state.accent)};font-weight:900}.intro{margin:${state.sectionGap}px 0 0;max-width:70ch}.photo-wrap,.photo-button{width:${state.photoSize}px;height:${state.photoSize}px;padding:0;border:${state.borderWidth}px solid currentColor;border-radius:${state.cornerRadius}px;overflow:hidden;background:#fff}.photo-button{cursor:zoom-in}.photo-wrap img,.photo-button img,.photo-placeholder{width:100%;height:100%;object-fit:cover}.photo-placeholder{display:grid;place-items:center;background:${rgb(state.accent)};color:#fff;font-size:calc(${state.photoSize}px * .36);font-weight:900}.favorites{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:${state.sectionGap}px;margin-top:${state.sectionGap}px}.favorite,.extra{padding:calc(${state.pagePadding}px * .42);border:${state.borderWidth}px solid currentColor;border-radius:${state.cornerRadius}px;background:rgba(255,255,255,.65)}.favorite b{display:block;color:${rgb(state.accent)};font-size:.72em;letter-spacing:.1em}.favorite span{display:block;margin-top:6px;font-weight:900}.extra{margin-top:${state.sectionGap}px}.extra h2{margin:0;font-size:1.35em}.extra p:last-child{margin-bottom:0}.interaction-bar{display:flex;flex-wrap:wrap;gap:10px;margin-top:${state.sectionGap}px}.interaction-bar button{padding:10px 15px;color:#fff;background:${rgb(state.accent)};border:${state.borderWidth}px solid currentColor;border-radius:${Math.min(state.cornerRadius,18)}px;font-weight:900;cursor:pointer}.roulette-result{margin:10px 0 0;padding:9px 12px;border-left:5px solid ${rgb(state.accent)};background:rgba(255,255,255,.65);font-weight:900}.lightbox{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:30px;background:#000c}.lightbox[hidden]{display:none}.lightbox img{max-width:min(800px,90vw);max-height:80vh;border:4px solid #fff}.lightbox button{position:absolute;right:25px;top:20px;width:48px;height:48px;color:#fff;background:#222;border:2px solid #fff;border-radius:50%;font-size:24px;cursor:pointer}@media(max-width:650px){body{padding:12px 6px}.profile{padding:max(18px,calc(${state.pagePadding}px * .65))}.photo-wrap,.photo-button{width:min(${state.photoSize}px,70vw);height:min(${state.photoSize}px,70vw)}.favorites{grid-template-columns:1fr}.hero h1{font-size:min(${state.headingSize}px,15vw)}}.script-warning{margin:${state.sectionGap}px auto 0;padding:12px;max-width:70ch;background:#fff4ca;border:2px solid #9a7921;color:#3d3426}
</style></head><body><main class="profile layout-${state.layout}"><section class="hero"><div class="hero-copy"><p class="eyebrow">MY PROFILE</p><h1>${name}</h1><p class="tagline">${tagline}</p><p class="intro">${intro}</p></div>${photoWrap}</section>${favoritesSection}${featureButtons?`<div class="interaction-bar">${featureButtons}</div>`:''}${roulette}${reveal}</main>${lightbox}${noScriptNotice}${script.length?`<script>${script.join('')}<\/script>`:''}</body></html>`;
  }

  async function handlePhotoUpload(event){const input=event.target,file=input.files?.[0];if(!file)return;if(!/^image\/(png|jpeg|webp)$/i.test(file.type)||file.size>12*1024*1024){showToast('12MB以下のPNG・JPEG・WebPを選んでください');input.value='';return;}try{const photo=await resizeProfileImage(file);applyProfilePhoto(photo,'PCから選んだ写真を反映しました');}catch(_){showToast('画像を読み込めませんでした');}finally{input.value='';}}
  function loadProfileImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const image=new Image();image.onerror=reject;image.onload=()=>resolve(image);image.src=String(reader.result);};reader.readAsDataURL(file);});}
  function encodeProfileImage(image,maxSize,quality){const scale=Math.min(1,maxSize/Math.max(image.width,image.height)),w=Math.max(1,Math.round(image.width*scale)),h=Math.max(1,Math.round(image.height*scale)),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('canvas');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(image,0,0,w,h);return canvas.toDataURL('image/jpeg',quality);}
  async function resizeProfileImage(file){const image=await loadProfileImage(file),attempts=[[1000,.84],[900,.80],[800,.76],[720,.72],[640,.70],[560,.68]];let result='';for(const [maxSize,quality] of attempts){result=encodeProfileImage(image,maxSize,quality);if(result.length<=MAX_PROFILE_DATA_URL)return result;}throw new Error('too-large');}
  function applyProfilePhoto(photo,message){if(!isSafeImageDataUrl(photo)){showToast('写真データを反映できませんでした');return false;}state.photo=photo;state.photoMode='photo';touch('photoDecision');const persisted=saveState();renderAll();showToast(persisted?message:'写真は反映しましたが、ブラウザへの保存容量が足りません');return true;}

  async function openPhonePhoto(){if(!await ensureTransferServer())return;stopPhotoPolling();const dialog=$('#adultQrDialog'),box=$('#adultQrBox'),status=$('#adultQrStatus'),link=$('#adultQrLink');$('#adultQrTitle').textContent='スマホから写真を送る';box.textContent='QRを準備しています…';status.textContent='';link.hidden=true;dialog.showModal();try{const response=await fetch(appUrl('api/photo-sessions'),{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),data=await response.json();if(!response.ok)throw new Error();photoToken=data.token;setQr(box,data.uploadUrl,'写真アップロード用QRコード');link.href=data.uploadUrl;link.hidden=false;status.textContent='スマホで読み込み、写真を選んで「パソコンへ送る」を押してください。';pollPhoto();}catch(_){box.textContent='QRを作れませんでした';status.textContent='QR機能用サーバーに接続できません。公開サーバーの設定を確認してください。';}}
  function pollPhoto(){clearTimeout(photoTimer);if(!photoToken||!$('#adultQrDialog').open)return;photoTimer=setTimeout(async()=>{try{const response=await fetch(appUrl(`api/photo-sessions/${encodeURIComponent(photoToken)}`),{cache:'no-store'}),data=await response.json();if(response.status===410){$('#adultQrStatus').textContent='アップロードURLの期限が切れました。';return;}if(data.status==='received'&&isSafeImageDataUrl(data.photo)){applyProfilePhoto(data.photo,'スマホから写真を受け取り、プロフィールへ反映しました');$('#adultQrStatus').textContent='写真を受け取り、プロフィールへ反映しました。';setTimeout(()=>{if($('#adultQrDialog').open)$('#adultQrDialog').close();},900);stopPhotoPolling();return;}pollPhoto();}catch(_){pollPhoto();}},1300);}
  function stopPhotoPolling(){clearTimeout(photoTimer);photoTimer=0;photoToken='';}

  function downloadHtml(){const blob=new Blob([buildHtml(false)],{type:'text/html;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${safeFilename(state.name||'my-profile')}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);showToast('HTMLを保存しました。動く機能の確認はWebブラウザで開いてください');}
  async function createShareSession(){const response=await fetch(appUrl('api/shares'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({html:buildHtml(false),filename:`${safeFilename(state.name||'my-profile')}.html`,nickname:state.name||'profile'})}),data=await response.json();if(!response.ok)throw new Error(data.error||'share-failed');return data;}
  async function openLivePreview(){const tab=window.open('about:blank','_blank');if(!tab){showToast('新しいタブを開けません。ブラウザのポップアップ設定を確認してください');return;}try{tab.document.write('<title>準備中</title><p style="font-family:sans-serif;padding:24px">動くページを準備しています…</p>');if(!await ensureTransferServer()){tab.close();return;}const data=await createShareSession(),viewUrl=appUrl(`api/shares/${encodeURIComponent(data.token)}/view`);tab.location.replace(viewUrl);}catch(_){tab.close();showToast('動作確認ページを作れませんでした');}}
  async function shareHtml(){if(!await ensureTransferServer())return;const dialog=$('#adultQrDialog'),box=$('#adultQrBox'),status=$('#adultQrStatus'),link=$('#adultQrLink');$('#adultQrTitle').textContent='完成サイトをスマホへ';box.textContent='QRを準備しています…';status.textContent='';link.hidden=true;dialog.showModal();try{const data=await createShareSession();setQr(box,data.shareUrl,'完成サイト共有QRコード');link.href=data.shareUrl;link.hidden=false;status.textContent='スマホで読み込むと、Safariなどのブラウザで動く完成ページを開けます。';}catch(_){box.textContent='QRを作れませんでした';status.textContent='QR機能用サーバーを確認してください。';}}
  function setQr(box,url,alt){const img=new Image();img.alt=alt;img.onload=()=>box.replaceChildren(img);img.src=appUrl(`api/qr?text=${encodeURIComponent(url)}&t=${Date.now()}`);}
  async function checkTransferServer(){try{const response=await fetch(appUrl('api/config'),{cache:'no-store'});if(!response.ok)throw new Error();const data=await response.json();transferInfo={enabled:Boolean(data.enabled),baseUrl:String(data.baseUrl||'')};}catch(_){transferInfo={enabled:false,baseUrl:''};}return transferInfo.enabled;}
  function setHelpOpenState(open){const button=$('#adultHelp');button.setAttribute('aria-expanded',String(Boolean(open)));button.classList.toggle('active',Boolean(open));button.textContent=open?'採点ルールを表示中':'採点ルール';}
  function openScoreHelp(){const dialog=$('#adultHelpDialog');setHelpOpenState(true);try{if(typeof dialog.showModal==='function'){if(!dialog.open)dialog.showModal();}else{dialog.setAttribute('open','');}}catch(_){dialog.setAttribute('open','');}dialog.querySelector('.dialog-close')?.focus();}
  function closeDialog(dialog){if(!dialog)return;try{if(typeof dialog.close==='function'&&dialog.open)dialog.close();else dialog.removeAttribute('open');}catch(_){dialog.removeAttribute('open');}if(dialog.id==='adultHelpDialog')setHelpOpenState(false);}

  async function ensureTransferServer(){if(transferInfo.enabled||await checkTransferServer())return true;showToast('QR機能用サーバーに接続できません。公開サーバーの設定を確認してください');return false;}

  function rgb(c){return `rgb(${clampNumber(c.r,0,255)}, ${clampNumber(c.g,0,255)}, ${clampNumber(c.b,0,255)})`;}
  function rgbHex(c){return '#'+['r','g','b'].map(key=>clampNumber(c[key],0,255).toString(16).padStart(2,'0')).join('');}
  function hexToRgb(value){const match=/^#([0-9a-f]{6})$/i.exec(String(value||''));if(!match)return {r:0,g:0,b:0};const hex=match[1];return {r:parseInt(hex.slice(0,2),16),g:parseInt(hex.slice(2,4),16),b:parseInt(hex.slice(4,6),16)};}
  function safeJson(value){return JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');}
  function clampNumber(v,min,max){const n=Number(v);return Math.max(min,Math.min(max,Number.isFinite(n)?Math.round(n):min));}
  function isSafeImageDataUrl(value){return /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(String(value||''));}
  function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}function escAttr(v){return esc(v);}function safeFilename(v){return String(v||'my-profile').replace(/[\\/:*?"<>|\s]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'my-profile';}
  function saveState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch(_){return false;}}function loadState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');}catch(_){return{};}}
  function showToast(message){clearTimeout(toastTimer);const t=$('#adultToast');t.textContent=message;t.classList.add('show');toastTimer=setTimeout(()=>t.classList.remove('show'),2200);}
})();
