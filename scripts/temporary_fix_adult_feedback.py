from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    return text.replace(old, new, 1)


p = Path("web/adult.html")
text = p.read_text(encoding="utf-8")
text = replace_once(
    text,
    '<button id="adultHelp" type="button">採点ルール</button>',
    '<button id="adultHelp" type="button" aria-haspopup="dialog" aria-controls="adultHelpDialog" aria-expanded="false">採点ルール</button>',
    "help button semantics",
)
text = replace_once(
    text,
    '<button type="button" id="adultPhonePhoto">QRでスマホから送る</button><button type="button" id="removeAdultPhoto">画像を外す</button><p>LANモードなら、同じWi-Fiのスマホから写真を送れます。</p>',
    '<button type="button" id="adultPhonePhoto">QRでスマホから送る</button><button type="button" id="removeAdultPhoto">画像を外す</button><p id="adultPhotoStatus" class="photo-status" role="status" aria-live="polite">プロフィール写真はまだ設定されていません。</p><p>公開URLまたはLANから、スマホの写真も送れます。</p>',
    "photo status",
)
p.write_text(text, encoding="utf-8")


p = Path("web/js/adult.js")
text = p.read_text(encoding="utf-8")
text = replace_once(
    text,
    '  const cssPoints={layout:4,fontFamily:3,pageWidth:4,headingSize:4,bodySize:3,photoSize:4,pagePadding:4,sectionGap:3,cornerRadius:4,borderWidth:3,shadowSize:3,background:2,accent:2,text:2};',
    '  const cssPoints={layout:4,fontFamily:3,pageWidth:4,headingSize:4,bodySize:3,photoSize:4,pagePadding:4,sectionGap:3,cornerRadius:4,borderWidth:3,shadowSize:3,background:2,accent:2,text:2};\n  const MAX_PROFILE_DATA_URL=850000;',
    "profile size constant",
)
text = replace_once(
    text,
    "    $('#adultPhotoInput').addEventListener('change',handlePhotoUpload);$('#adultPhonePhoto').addEventListener('click',openPhonePhoto);$('#removeAdultPhoto').addEventListener('click',()=>{state.photo='';changed();showToast('写真を外しました');});",
    "    $('#adultPhotoInput').addEventListener('change',handlePhotoUpload);$('#adultPhonePhoto').addEventListener('click',openPhonePhoto);$('#removeAdultPhoto').addEventListener('click',()=>{state.photo='';changed();$('#adultPhotoInput').value='';showToast('写真を外しました');});",
    "photo bindings",
)
text = replace_once(
    text,
    "    $('#adultHelp').addEventListener('click',()=>$('#adultHelpDialog').showModal());\n    $$('[data-close]').forEach(button=>button.addEventListener('click',()=>{const dialog=$(\"#\"+button.dataset.close);if(dialog){if(dialog.id==='adultQrDialog')stopPhotoPolling();dialog.close();}}));",
    "    $('#adultHelp').addEventListener('click',openScoreHelp);\n    $$('[data-close]').forEach(button=>button.addEventListener('click',()=>{const dialog=$(\"#\"+button.dataset.close);if(dialog){if(dialog.id==='adultQrDialog')stopPhotoPolling();closeDialog(dialog);}}));\n    $('#adultHelpDialog').addEventListener('click',e=>{if(e.target===$('#adultHelpDialog'))closeDialog($('#adultHelpDialog'));});\n    $('#adultHelpDialog').addEventListener('close',()=>setHelpOpenState(false));",
    "help bindings",
)
text = replace_once(
    text,
    "  function renderPhotoControl(){const box=$('#adultPhotoPreview');box.replaceChildren();if(isSafeImageDataUrl(state.photo)){const img=document.createElement('img');img.src=state.photo;img.alt='プロフィール写真';box.append(img);}else{const span=document.createElement('span');span.textContent='PHOTO';box.append(span);}}",
    "  function renderPhotoControl(){const box=$('#adultPhotoPreview'),status=$('#adultPhotoStatus');box.replaceChildren();if(isSafeImageDataUrl(state.photo)){const img=document.createElement('img');img.src=state.photo;img.alt='プロフィール写真';box.append(img);if(status){status.textContent='✓ プロフィール写真を反映しました（HTML +5）';status.classList.add('ready');}}else{const span=document.createElement('span');span.textContent='PHOTO';box.append(span);if(status){status.textContent='プロフィール写真はまだ設定されていません。';status.classList.remove('ready');}}}",
    "photo render status",
)
old = """  async function handlePhotoUpload(event){const file=event.target.files?.[0];if(!file)return;if(!/^image\\/(png|jpeg|webp)$/i.test(file.type)||file.size>12*1024*1024){showToast('12MB以下のPNG・JPEG・WebPを選んでください');event.target.value='';return;}try{state.photo=await resizeImage(file,1200,.86);changed();showToast('写真を追加しました');}catch(_){showToast('画像を読み込めませんでした');}}
  function resizeImage(file,maxSize,quality){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const image=new Image();image.onerror=reject;image.onload=()=>{const scale=Math.min(1,maxSize/Math.max(image.width,image.height)),w=Math.max(1,Math.round(image.width*scale)),h=Math.max(1,Math.round(image.height*scale)),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(image,0,0,w,h);resolve(canvas.toDataURL('image/jpeg',quality));};image.src=String(reader.result);};reader.readAsDataURL(file);});}
"""
new = """  async function handlePhotoUpload(event){const file=event.target.files?.[0];if(!file)return;if(!/^image\\/(png|jpeg|webp)$/i.test(file.type)||file.size>12*1024*1024){showToast('12MB以下のPNG・JPEG・WebPを選んでください');event.target.value='';return;}try{const photo=await resizeProfileImage(file);applyProfilePhoto(photo,'PCから選んだ写真を反映しました');}catch(_){showToast('画像を読み込めませんでした');}}
  function loadProfileImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const image=new Image();image.onerror=reject;image.onload=()=>resolve(image);image.src=String(reader.result);};reader.readAsDataURL(file);});}
  function encodeProfileImage(image,maxSize,quality){const scale=Math.min(1,maxSize/Math.max(image.width,image.height)),w=Math.max(1,Math.round(image.width*scale)),h=Math.max(1,Math.round(image.height*scale)),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('canvas');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(image,0,0,w,h);return canvas.toDataURL('image/jpeg',quality);}
  async function resizeProfileImage(file){const image=await loadProfileImage(file),attempts=[[1000,.84],[900,.80],[800,.76],[720,.72],[640,.70],[560,.68]];let result='';for(const [maxSize,quality] of attempts){result=encodeProfileImage(image,maxSize,quality);if(result.length<=MAX_PROFILE_DATA_URL)return result;}throw new Error('too-large');}
  function applyProfilePhoto(photo,message){if(!isSafeImageDataUrl(photo)){showToast('写真データを反映できませんでした');return false;}state.photo=photo;const persisted=saveState();renderAll();showToast(persisted?message:'写真は反映しましたが、ブラウザへの保存容量が足りません');return true;}
"""
text = replace_once(text, old, new, "photo processing")
text = replace_once(
    text,
    "if(data.status==='received'&&isSafeImageDataUrl(data.photo)){state.photo=data.photo;changed();$('#adultQrStatus').textContent='写真を受け取りました。';showToast('スマホから写真を受け取りました');setTimeout(()=>{if($('#adultQrDialog').open)$('#adultQrDialog').close();},650);stopPhotoPolling();return;}",
    "if(data.status==='received'&&isSafeImageDataUrl(data.photo)){applyProfilePhoto(data.photo,'スマホから写真を受け取り、プロフィールへ反映しました');$('#adultQrStatus').textContent='写真を受け取り、プロフィールへ反映しました。';setTimeout(()=>{if($('#adultQrDialog').open)$('#adultQrDialog').close();},900);stopPhotoPolling();return;}",
    "phone photo application",
)
text = replace_once(
    text,
    "  async function ensureTransferServer(){if(transferInfo.enabled||await checkTransferServer())return true;showToast('QR機能用サーバーに接続できません。公開サーバーの設定を確認してください');return false;}",
    "  function setHelpOpenState(open){const button=$('#adultHelp');button.setAttribute('aria-expanded',String(Boolean(open)));button.classList.toggle('active',Boolean(open));button.textContent=open?'採点ルールを表示中':'採点ルール';}\n  function openScoreHelp(){const dialog=$('#adultHelpDialog');setHelpOpenState(true);try{if(typeof dialog.showModal==='function'){if(!dialog.open)dialog.showModal();}else{dialog.setAttribute('open','');}}catch(_){dialog.setAttribute('open','');}dialog.querySelector('.dialog-close')?.focus();}\n  function closeDialog(dialog){if(!dialog)return;try{if(typeof dialog.close==='function'&&dialog.open)dialog.close();else dialog.removeAttribute('open');}catch(_){dialog.removeAttribute('open');}if(dialog.id==='adultHelpDialog')setHelpOpenState(false);}\n\n  async function ensureTransferServer(){if(transferInfo.enabled||await checkTransferServer())return true;showToast('QR機能用サーバーに接続できません。公開サーバーの設定を確認してください');return false;}",
    "help functions",
)
text = replace_once(
    text,
    "  function saveState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(_){}}function loadState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');}catch(_){return{};}}",
    "  function saveState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch(_){return false;}}function loadState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');}catch(_){return{};}}",
    "save state result",
)
p.write_text(text, encoding="utf-8")


p = Path("web/css/adult.css")
text = p.read_text(encoding="utf-8")
text = replace_once(
    text,
    '.adult-header>button{justify-self:end;padding:8px 11px;background:#fff;border:2px solid #242a31;font-weight:900;cursor:pointer}',
    '.adult-header>button{justify-self:end;padding:8px 11px;background:#fff;border:2px solid #242a31;font-weight:900;cursor:pointer;transition:.15s}.adult-header>button.active,.adult-header>button[aria-expanded="true"]{color:#fff;background:#203b52;box-shadow:3px 3px 0 #e5ad37;transform:translate(-1px,-1px)}',
    "help active css",
)
text = replace_once(
    text,
    '.photo-area p{margin:7px 3px 0;font-size:.67rem}',
    '.photo-area p{margin:7px 3px 0;font-size:.67rem}.photo-area .photo-status{margin-top:10px;padding:7px 9px;background:#ece5da;border-left:4px solid #8d857a;font-weight:900}.photo-area .photo-status.ready{color:#164d35;background:#e3f3e8;border-left-color:#2f7d55}',
    "photo status css",
)
text = replace_once(
    text,
    'dialog{width:min(650px,calc(100% - 30px));padding:0;border:0;background:transparent}',
    'dialog{width:min(650px,calc(100% - 30px));padding:0;border:0;background:transparent}dialog[open]{animation:adultDialogIn .16s ease-out}@keyframes adultDialogIn{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}',
    "dialog feedback css",
)
p.write_text(text, encoding="utf-8")


p = Path("tests/check_static.py")
text = p.read_text(encoding="utf-8")
anchor = '''    for marker in ("pageWidth", "headingSize", "backgroundR", "backgroundG", "backgroundB", "jsReveal", "jsRoulette", "jsPhotoZoom"):\n        if f'id="{marker}"' not in adult_html:\n            fail(f"adult custom lab is missing {marker}")\n'''
addition = anchor + '''    for marker in ("adultPhotoStatus", "adultHelpDialog"):\n        if f'id="{marker}"' not in adult_html:\n            fail(f"adult mode feedback UI is missing {marker}")\n    for marker in ("applyProfilePhoto", "MAX_PROFILE_DATA_URL", "openScoreHelp", "setHelpOpenState"):\n        if marker not in adult:\n            fail(f"adult mode feedback behavior is missing {marker}")\n'''
text = replace_once(text, anchor, addition, "adult feedback static guards")
p.write_text(text, encoding="utf-8")
