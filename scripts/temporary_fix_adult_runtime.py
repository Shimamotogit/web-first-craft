from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    return text.replace(old, new, 1)


path = Path("web/js/adult.js")
text = path.read_text(encoding="utf-8")

old_constants = '''  const state=normalizeState({...defaults,...loadState()});
  let currentStep=0,transferInfo={enabled:false,baseUrl:""},photoToken="",photoTimer=0,toastTimer=0;
  const numericKeys=["pageWidth","headingSize","bodySize","photoSize","pagePadding","sectionGap","cornerRadius","borderWidth","shadowSize"];
  const textMap={profileName:"name",profileTagline:"tagline",profileIntro:"intro",extraTitle:"extraTitle",extraText:"extraText"};
  const cssPoints={layout:4,fontFamily:3,pageWidth:4,headingSize:4,bodySize:3,photoSize:4,pagePadding:4,sectionGap:3,cornerRadius:4,borderWidth:3,shadowSize:3,background:2,accent:2,text:2};
  const MAX_PROFILE_DATA_URL=850000;
'''
new_constants = '''  const numericBounds={
    pageWidth:[520,1180],headingSize:[28,96],bodySize:[12,26],photoSize:[120,360],
    pagePadding:[12,100],sectionGap:[6,64],cornerRadius:[0,48],borderWidth:[0,8],shadowSize:[0,30]
  };
  const numericKeys=Object.keys(numericBounds);
  const textMap={profileName:"name",profileTagline:"tagline",profileIntro:"intro",extraTitle:"extraTitle",extraText:"extraText"};
  const cssPoints={layout:4,fontFamily:3,pageWidth:4,headingSize:4,bodySize:3,photoSize:4,pagePadding:4,sectionGap:3,cornerRadius:4,borderWidth:3,shadowSize:3,background:2,accent:2,text:2};
  const MAX_PROFILE_DATA_URL=850000;
  const state=normalizeState(loadState());
  let currentStep=0,transferInfo={enabled:false,baseUrl:""},photoToken="",photoTimer=0,toastTimer=0;
'''
text = replace_once(text, old_constants, new_constants, "initialization order")

old_normalize = '''  function normalizeState(raw){
    const out={...defaults,...raw};
    out.favorites=Array.isArray(raw.favorites)?[raw.favorites[0]||"",raw.favorites[1]||"",raw.favorites[2]||""]:["","",""];
    out.background={...defaults.background,...(raw.background||{})};out.accent={...defaults.accent,...(raw.accent||{})};out.text={...defaults.text,...(raw.text||{})};
    out.touched=Array.isArray(raw.touched)?raw.touched:[];
    numericKeys.forEach(k=>out[k]=Number.isFinite(Number(out[k]))?Number(out[k]):defaults[k]);
    return out;
  }
'''
new_normalize = '''  function normalizeState(raw){
    const source=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    const out={...defaults};
    for(const key of ['name','tagline','intro','extraTitle','extraText'])out[key]=typeof source[key]==='string'?source[key]:defaults[key];
    out.favorites=Array.isArray(source.favorites)?[0,1,2].map(i=>typeof source.favorites[i]==='string'?source.favorites[i]:''):["","",""];
    out.layout=['split','center','offset'].includes(source.layout)?source.layout:defaults.layout;
    out.fontFamily=['sans','serif','mono'].includes(source.fontFamily)?source.fontFamily:defaults.fontFamily;
    for(const key of numericKeys){const n=Number(source[key]),[min,max]=numericBounds[key];out[key]=Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):defaults[key];}
    for(const group of ['background','accent','text']){const value=source[group]&&typeof source[group]==='object'?source[group]:{};out[group]={r:normalizeChannel(value.r,defaults[group].r),g:normalizeChannel(value.g,defaults[group].g),b:normalizeChannel(value.b,defaults[group].b)};}
    for(const key of ['jsReveal','jsRoulette','jsPhotoZoom'])out[key]=source[key]===true;
    out.touched=Array.isArray(source.touched)?[...new Set(source.touched.filter(key=>typeof key==='string'&&Object.prototype.hasOwnProperty.call(cssPoints,key)))]:[];
    const photo=typeof source.photo==='string'?source.photo:'';
    out.photo=isSafeImageDataUrl(photo)&&photo.length<=2800000?photo:'';
    return out;
  }
  function normalizeChannel(value,fallback){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(255,Math.round(n))):fallback;}
'''
text = replace_once(text, old_normalize, new_normalize, "state normalization")

old_upload = "  async function handlePhotoUpload(event){const file=event.target.files?.[0];if(!file)return;if(!/^image\\/(png|jpeg|webp)$/i.test(file.type)||file.size>12*1024*1024){showToast('12MB以下のPNG・JPEG・WebPを選んでください');event.target.value='';return;}try{const photo=await resizeProfileImage(file);applyProfilePhoto(photo,'PCから選んだ写真を反映しました');}catch(_){showToast('画像を読み込めませんでした');}}"
new_upload = "  async function handlePhotoUpload(event){const input=event.target,file=input.files?.[0];if(!file)return;if(!/^image\\/(png|jpeg|webp)$/i.test(file.type)||file.size>12*1024*1024){showToast('12MB以下のPNG・JPEG・WebPを選んでください');input.value='';return;}try{const photo=await resizeProfileImage(file);applyProfilePhoto(photo,'PCから選んだ写真を反映しました');}catch(_){showToast('画像を読み込めませんでした');}finally{input.value='';}}"
text = replace_once(text, old_upload, new_upload, "photo upload reset")

path.write_text(text, encoding="utf-8")
