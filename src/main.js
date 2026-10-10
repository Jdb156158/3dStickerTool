import './style.css';
import { StickerStage, stickerLayers } from './stage.js';
import { composeSticker, finishes, loadImage } from './stickers.js';
import { removeSubjectBackground } from './background.js';
const assetBase = import.meta.env.BASE_URL;

const icons = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  play: '<path d="m8 5 11 7-11 7V5Z"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 15v5h16v-5"/>',
  sparkle: '<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const $ = selector => document.querySelector(selector);
let settings = { key: '', model: 'gpt-image-2.5-sunburst', remember: false };
try {
  const saved = JSON.parse(localStorage.getItem('sticker-lab-settings') || '{}');
  settings = { ...settings, ...saved, remember: Boolean(saved.key) };
} catch { /* Storage can be disabled in private browsing. */ }
const pack = [
  { id: 'heart', name: 'A little love', source: '/stickers/heart.png', finish: 'holo', border: 0, note: 'A little love. A lot of good energy.' },
  { id: 'cassette', name: 'Good vibrations', source: '/stickers/cassette.png', finish: 'glitter', border: 0, note: 'Press play on your happy place.' },
  { id: 'stickerlab', name: 'StickerLab', source: '/stickers/stickerlab.png', finish: 'holo', border: 0, foilInk: true },
  { id: 'stay-playful', name: 'Stay Playful', source: '/stickers/stay-playful.png', finish: 'holo', border: 0, foilInk: true },
];
let current = 0, draft = null, mode = 'local', busy = false, renderId = 0, controller = null;
let stage;

$('#app').innerHTML = `
  <header class="header">
    <a class="brand" href="${assetBase}" aria-label="Sticker Lab 首页"><img class="brand-sticker" src="${assetBase}stickers/stickerlab.png" alt="StickerLab" width="2016" height="768" draggable="false" /><span class="brand-trademark" aria-hidden="true">®</span></a>
    <span class="header-caption">Small things. Big personality.</span>
    <div class="header-actions"><button class="button primary" id="open-create">${icon('plus')}<span>Create a sticker</span></button><button class="icon-button" id="open-settings" aria-label="API 设置" title="API 设置">${icon('settings')}<span class="key-dot ${settings.key ? 'connected' : ''}"></span></button></div>
  </header>
  <main class="workspace">
    <div class="intro"><span class="eyebrow"><span class="live-dot"></span> THE STICKER PLAYGROUND</span><h1>A little more<br><span>playful.</span><span class="little-star">✳</span></h1><p>Pick it up. Give it a little wiggle.<br>Make something that's yours.</p></div>
    <div class="edition"><span>VOLUME 001</span><span>THE GOOD STUFF COLLECTION</span></div>
    <div id="stage" class="stage"></div>
    <div class="stage-shadow"></div>
    <img class="fallback-image" id="fallback" alt="当前贴纸" hidden />
    <ol class="layer-labels" aria-hidden="true">${stickerLayers.map((layer,i)=>`<li class="layer-label"><div><div class="layer-title"><i>${String(i+1).padStart(2,'0')}</i><strong>${layer.name}</strong><em>${layer.zh}</em></div><small>${layer.spec}</small></div><b class="layer-leader"></b></li>`).join('')}</ol>
    <div class="sticker-caption"><span class="caption-index" id="caption-index">01 / 02</span><h2 id="sticker-name">A little love</h2><p id="sticker-finish">Rainbow foil · gloss laminate</p></div>
    <div class="gesture-note"><span class="gesture-doodle">↗</span><span>go on, give it a drag</span></div>
    <div class="zoom-controls" role="group" aria-label="贴纸缩放"><button id="zoom-out" aria-label="缩小贴纸" title="缩小">−</button><button id="zoom-reset" aria-label="重置贴纸大小" title="重置为 100%">100%</button><button id="zoom-in" aria-label="放大贴纸" title="放大">+</button></div>
    <div class="stage-hint"><span>DRAG TO FLEX</span><b>·</b><span>PULL AN EDGE TO PEEL</span><b>·</b><span>TAP TO SWITCH</span></div>
  </main>
  <footer class="bottom-bar"><span class="footer-note">Made to make you smile.<span class="tiny-star">✳</span></span>
    <nav class="dock" aria-label="贴纸与预览控制"><div id="sticker-rail" class="sticker-rail"></div><button class="thumb add-thumb" id="dock-create" aria-label="上传自己的图片" title="上传自己的图片">${icon('plus')}</button><span class="dock-divider"></span><button class="icon-button tool" id="layers" aria-label="展开图层" aria-pressed="false" title="展开图层 (L)">${icon('layers')}</button><button class="icon-button tool" id="pause" aria-label="暂停动画" aria-pressed="false" title="暂停动画 (空格)">${icon('pause')}</button></nav>
    <button class="download-button" id="download" aria-label="Download PNG">${icon('download')}<span>Download PNG</span></button>
  </footer>
  <div class="overlay" id="create-overlay" hidden>
    <section class="create-panel" role="dialog" aria-modal="true" aria-labelledby="create-title">
      <div class="panel-header"><div><span class="eyebrow">MAKE IT YOURS</span><h2 id="create-title">Your next favorite sticker.</h2><p>把喜欢的图片，变成一张有个性的贴纸。</p></div><button class="icon-button" id="close-create" aria-label="关闭创建面板">${icon('close')}</button></div>
      <div class="mode-tabs" role="tablist" aria-label="生成方式"><button id="local-mode" role="tab" aria-selected="true">${icon('layers')} Instant sticker <small>本地制作</small></button><button id="ai-mode" role="tab" aria-selected="false">${icon('sparkle')} AI remix <small>AI 重绘</small></button></div>
      <button class="drop-zone" id="drop-zone"><span id="drop-empty"><span class="upload-circle">${icon('upload')}</span><strong>Drop a little inspiration.</strong><span>点击上传或拖入图片</span><small>PNG, JPG, WEBP · up to 12 MB</small></span><img id="upload-preview" hidden alt="上传图片预览"/><span id="change-image" hidden>更换图片 ${icon('plus')}</span></button>
      <input id="file-input" type="file" accept="image/png,image/jpeg,image/webp" hidden />
      <div class="field-heading"><label>Pick a finish <span>选择材质</span></label><span class="micro">A LITTLE EXTRA SHINE</span></div>
      <div class="finishes" id="finish-options">${Object.entries(finishes).map(([id, f]) => `<button class="finish-option ${id === 'holo' ? 'selected' : ''}" data-finish="${id}" aria-pressed="${id === 'holo'}"><span class="material-swatch ${id}"></span><strong>${f.name}</strong><small>${f.zh}</small></button>`).join('')}</div>
      <div class="local-options"><div class="range-label"><label for="border">Die-cut border <span>白边宽度</span></label><output id="border-value">12 px</output></div><input type="range" id="border" min="0" max="32" value="12"/><label class="check-row"><input type="checkbox" id="remove-bg" checked/><span>AI subject cutout · 本地主体抠图<small>IMG.LY · 无需 Key，图片不上传。首次下载模型约 80 MB，另需运行资源；透明 PNG 可关闭。</small></span></label></div>
      <div class="ai-options" hidden><label for="prompt">Give it some personality <span>补充描述，可选</span></label><textarea id="prompt" maxlength="1500" placeholder="例如：变成软乎乎的 3D 玩偶，保留主体颜色…"></textarea><p class="ai-disclosure">点击生成后，图片和描述经本站服务转发至 OpenAI，使用你的 Key 计费。通常需要 30–120 秒。</p><button class="text-button" id="configure-key">${icon('settings')}<span>配置自己的 API Key</span>${icon('arrow')}</button></div>
      <div class="panel-status" id="create-status" role="status" aria-live="polite"></div>
      <button class="button primary generate-button" id="generate" disabled>${icon('sparkle')}<span>Make my sticker</span>${icon('arrow')}</button>
      <button class="text-button cancel-generation" id="cancel-generation" hidden>取消等待</button>
      <p class="privacy-note" id="privacy-note">本地制作在浏览器完成，图片不会上传。</p>
    </section>
  </div>
  <div class="overlay settings-overlay" id="settings-overlay" hidden>
    <form class="settings-panel" id="settings-form" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div class="panel-header"><div><span class="eyebrow">YOUR KEY. YOUR CREATIONS.</span><h2 id="settings-title">AI settings</h2><p>使用自己的 OpenAI API Key 体验 AI 重绘。</p></div><button type="button" class="icon-button" id="close-settings" aria-label="关闭设置">${icon('close')}</button></div>
      <label for="api-key">API Key</label><div class="password-field"><input type="password" id="api-key" placeholder="sk-…" autocomplete="off" spellcheck="false"/><button type="button" id="toggle-key">显示</button></div>
      <label for="model">Image model <span>图片模型</span></label><select id="model"><option value="gpt-image-2.5-sunburst">GPT Image 2.5 Sunburst</option><option value="gpt-image-2.5-flare">GPT Image 2.5 Flare</option><option value="gpt-image-1.5">GPT Image 1.5</option></select>
      <label class="check-row"><input type="checkbox" id="remember-key"/><span>在这台设备上记住 Key<small>保存在此浏览器本地；公用设备请勿勾选。</small></span></label>
      <div class="settings-note">Key 仅用于转发你的生成请求，服务端不落盘保存。未勾选记住时，刷新页面即清除。ChatGPT 订阅不包含 API 用量。</div>
      <div class="settings-actions"><button type="button" class="button secondary" id="clear-key">清除 Key</button><button type="submit" class="button primary">Save settings ${icon('check')}</button></div>
    </form>
  </div>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
`;

function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('visible'), 3200); }
const dialogFocus = new Map();
function openDialog(id) { dialogFocus.set(id, document.activeElement); $(id).hidden = false; $(id).querySelector('button,input').focus(); }
function closeDialog(id) { $(id).hidden = true; dialogFocus.get(id)?.focus(); }
function openCreate() { openDialog('#create-overlay'); }
function openSettings() { $('#api-key').type = 'password'; $('#toggle-key').textContent = '显示'; $('#api-key').value = settings.key; $('#model').value = settings.model; $('#remember-key').checked = settings.remember; openDialog('#settings-overlay'); }
$('#open-create').onclick = $('#dock-create').onclick = openCreate;
$('#open-settings').onclick = $('#configure-key').onclick = openSettings;
$('#close-create').onclick = () => closeDialog('#create-overlay');
$('#close-settings').onclick = () => closeDialog('#settings-overlay');
for (const id of ['#create-overlay', '#settings-overlay']) $(id).addEventListener('click', e => { if(e.target === $(id)) closeDialog(id); });

function renderRail() {
  $('#sticker-rail').replaceChildren(...pack.map((sticker, i) => {
    const button = document.createElement('button'); button.className = `thumb ${current === i ? 'active' : ''}`;
    button.setAttribute('aria-label', sticker.name); button.setAttribute('aria-current', current === i ? 'true' : 'false'); button.title = sticker.name;
    const img = document.createElement('img'); img.src = sticker.result?.url || (sticker.source.startsWith('/stickers/') ? assetBase + sticker.source.slice(1) : sticker.source); img.alt = ''; img.draggable = false;
    button.append(img); button.onclick = () => showSticker(i); return button;
  }));
}
async function showSticker(index) {
  current = (index + pack.length) % pack.length; const sticker = pack[current]; const id = ++renderId;
  $('#sticker-name').textContent = sticker.name;
  $('#caption-index').textContent = `${String(current+1).padStart(2,'0')} / ${String(pack.length).padStart(2,'0')}`;
  $('#sticker-finish').textContent = finishes[sticker.finish].description;
  $('#download').disabled = true;
  renderRail();
  try {
    sticker.result ||= await composeSticker(sticker.source.startsWith('/stickers/') ? assetBase + sticker.source.slice(1) : sticker.source, { border: sticker.border, finish: sticker.finish, removeBg: sticker.removeBg, foilInk: sticker.foilInk });
    if(id !== renderId) return;
    if (stage) stage.setSticker(sticker.result, sticker.finish);
    else { $('#fallback').src = sticker.result.url; $('#fallback').hidden = false; }
    $('#download').disabled = false; renderRail();
  } catch(error) { toast(error.message); }
}
try { stage = new StickerStage($('#stage'), () => showSticker(current+1)); }
catch { toast('当前设备使用静态预览，仍可制作和下载贴纸。'); $('#layers').disabled = $('#pause').disabled = true; }
$('#pause').setAttribute('aria-pressed', String(stage?.paused || false));
$('#pause').innerHTML = icon(stage?.paused ? 'play' : 'pause');
function updateZoom(value) {
  if (!stage || stage.layers) return;
  stage.setZoom(value);
  $('#zoom-reset').textContent = `${Math.round(stage.zoom * 100)}%`;
  $('#zoom-out').disabled = stage.zoom <= .5;
  $('#zoom-in').disabled = stage.zoom >= 2;
}
$('.zoom-controls').hidden = !stage;
$('#zoom-out').onclick = () => updateZoom(stage.zoom - .1);
$('#zoom-in').onclick = () => updateZoom(stage.zoom + .1);
$('#zoom-reset').onclick = () => updateZoom(1);
$('#stage').addEventListener('wheel', e => {
  if (!stage || stage.layers || e.ctrlKey || e.metaKey) return;
  e.preventDefault();
  const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? $('#stage').clientHeight : 1);
  updateZoom(stage.zoom * Math.exp(-Math.max(-200, Math.min(200, delta)) * .002));
}, { passive: false });
$('#layers').onclick = () => {
  stage.setLayers(!stage.layers); $('#layers').setAttribute('aria-pressed',String(stage.layers));
  $('.workspace').classList.toggle('show-layers',stage.layers); $('.layer-labels').setAttribute('aria-hidden',String(!stage.layers));
  $('.zoom-controls').hidden = stage.layers;
  $('.stage-hint').innerHTML = stage.layers ? '<span>左右拖动旋转</span><b>·</b><span>向下拖动合起 / 向上展开</span>' : '<span>DRAG TO FLEX</span><b>·</b><span>PULL AN EDGE TO PEEL</span><b>·</b><span>TAP TO SWITCH</span>';
};
$('#pause').onclick = () => {
  stage.paused = !stage.paused; $('#pause').setAttribute('aria-pressed',String(stage.paused));
  $('#pause').setAttribute('aria-label',stage.paused ? '播放动画' : '暂停动画'); $('#pause').innerHTML = icon(stage.paused ? 'play' : 'pause');
};
$('#download').onclick = () => {
  const sticker = pack[current]; if(!sticker.result) return;
  sticker.result.canvas.toBlob(blob => {
    if (!blob) { toast('导出失败，请重试。'); return; }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `${sticker.name.replace(/[^\p{L}\p{N}\-_ ]/gu,'').slice(0,60) || 'sticker'}.png`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast('已开始下载透明 PNG。');
  }, 'image/png');
};

let selectedFinish = 'holo';
$('#finish-options').addEventListener('click', e => {
  const button = e.target.closest('[data-finish]'); if(!button || busy) return;
  selectedFinish = button.dataset.finish;
  document.querySelectorAll('.finish-option').forEach(b => { const on = b === button; b.classList.toggle('selected',on); b.setAttribute('aria-pressed',String(on)); });
});
$('#border').oninput = () => $('#border-value').textContent = `${$('#border').value} px`;
function setMode(next) {
  if(busy) return;
  mode=next; $('#local-mode').setAttribute('aria-selected',String(mode==='local')); $('#ai-mode').setAttribute('aria-selected',String(mode==='ai'));
  $('.local-options').hidden = mode !== 'local'; $('.ai-options').hidden = mode !== 'ai';
  $('#generate span').textContent = mode==='ai' ? 'Generate AI sticker' : 'Make my sticker';
  $('#privacy-note').textContent = mode==='ai' ? '生成费用由你的 OpenAI 账户承担。' : '本地制作在浏览器完成，图片不会上传。';
  $('#create-status').textContent='';
}
$('#local-mode').onclick = () => setMode('local'); $('#ai-mode').onclick = () => setMode('ai');
if (__STATIC_DEMO__) {
  $('#ai-mode').disabled = true;
  $('#ai-mode').title = 'GitHub Pages 演示版不提供 AI 重绘服务器';
  $('#open-settings').hidden = true;
  $('#privacy-note').innerHTML = 'GitHub Pages · 仅本地制作，无需 Key。<a href="https://github.com/Jdb156158/3dStickerTool">Source / 源码</a> · <a href="' + assetBase + 'licenses/IMG-LY-AGPL-3.0.txt">IMG.LY license</a>';
}
$('#drop-zone').onclick = () => { if(!busy) $('#file-input').click(); };
let uploadVersion = 0;
async function acceptFile(file) {
  if(!file || busy) return;
  const version = ++uploadVersion;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)) { toast('请选择 PNG、JPEG 或 WebP 图片。'); return; }
  if(file.size>12*1024*1024) { toast('图片不能超过 12 MB。'); return; }
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    if(image.width*image.height>40_000_000) throw new Error('图片分辨率太大，请缩小至 4000 万像素以内。');
    if(version !== uploadVersion) { URL.revokeObjectURL(url); return; }
    if(draft) URL.revokeObjectURL(draft.url);
    draft = {file,url}; $('#upload-preview').src=url; $('#upload-preview').hidden=false; $('#drop-empty').hidden=true; $('#change-image').hidden=false;
    $('#drop-zone').classList.add('has-image'); $('#generate').disabled=false; $('#create-status').textContent='';
  } catch(error) { URL.revokeObjectURL(url); toast(error.message); }
}
$('#file-input').onchange = e => { acceptFile(e.target.files[0]); e.target.value=''; };
$('#drop-zone').ondragover = e => { e.preventDefault(); $('#drop-zone').classList.add('drag-over'); };
$('#drop-zone').ondragleave = () => $('#drop-zone').classList.remove('drag-over');
$('#drop-zone').ondrop = e => { e.preventDefault(); $('#drop-zone').classList.remove('drag-over'); acceptFile(e.dataTransfer.files[0]); };

function setBusy(value) {
  busy=value; $('#generate').disabled = value || !draft; $('#generate').classList.toggle('loading',value);
  for(const el of document.querySelectorAll('.create-panel input,.create-panel textarea,.create-panel .finish-option,.mode-tabs button,#drop-zone')) el.disabled=value;
  $('#cancel-generation').hidden = !value || mode!=='ai';
}
$('#generate').onclick = async () => {
  if(!draft || busy) return;
  if(mode==='ai' && !settings.key) { openSettings(); return; }
  setBusy(true); $('#create-status').classList.remove('error');
  $('#create-status').textContent = mode==='ai' ? '正在重绘你的贴纸，请稍候…' : '正在裁切和覆膜…';
  const input = draft, finish=selectedFinish, border=mode==='ai' ? 0 : Number($('#border').value), removeBg=mode==='local' && $('#remove-bg').checked;
  let source = input.url, cutoutUrl;
  try {
    if(mode==='ai') {
      controller=new AbortController();
      const form = new FormData(); form.set('image',input.file); form.set('model',settings.model); form.set('finish',finish); form.set('prompt',$('#prompt').value);
      const response=await fetch('/api/sticker',{method:'POST',headers:{Authorization:`Bearer ${settings.key}`},body:form,signal:controller.signal});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error || '生成失败，请稍后重试。');
      if(typeof result.image !== 'string' || !result.image.startsWith('data:image/png;base64,')) throw new Error('返回图片格式不正确。');
      source=result.image;
    }
    if (removeBg) {
      $('#create-status').textContent = '正在加载本地 AI 抠图，首次需要下载模型…';
      const cutout = await removeSubjectBackground(input.file, message => { $('#create-status').textContent = message; });
      cutoutUrl = URL.createObjectURL(cutout); source = cutoutUrl;
    }
    const result = await composeSticker(source,{finish,border});
    const name=input.file.name.replace(/\.[^.]+$/,'').slice(0,45) || 'My sticker';
    pack.push({id:crypto.randomUUID(),name,source:result.url,finish,border:0,result});
    await showSticker(pack.length-1); closeDialog('#create-overlay');
    $('#create-status').textContent=''; toast(mode==='ai' ? '你的 AI 贴纸完成了，拖动试试看！' : '贴纸做好了，拖动试试看！');
  } catch(error) {
    $('#create-status').classList.add('error'); $('#create-status').textContent=error.name==='AbortError' ? '已取消等待。已发送的 API 请求仍可能计费。' : error.message;
  } finally { if (cutoutUrl) URL.revokeObjectURL(cutoutUrl); controller=null; setBusy(false); }
};
$('#cancel-generation').onclick = () => controller?.abort();
$('#toggle-key').onclick=()=> { const input=$('#api-key'); input.type=input.type==='password'?'text':'password'; $('#toggle-key').textContent=input.type==='password'?'显示':'隐藏'; };
$('#settings-form').onsubmit=e=> {
  e.preventDefault(); settings={key:$('#api-key').value.trim(),model:$('#model').value,remember:$('#remember-key').checked};
  try {
    localStorage.removeItem('sticker-lab-settings');
    if(settings.remember) localStorage.setItem('sticker-lab-settings',JSON.stringify({key:settings.key,model:settings.model}));
  } catch { toast('浏览器禁止存储，Key 仅在本次页面中保留。'); }
  $('.key-dot').classList.toggle('connected',Boolean(settings.key));
  $('#configure-key span').textContent=settings.key ? 'API Key 已配置 · 修改设置' : '配置自己的 API Key';
  closeDialog('#settings-overlay'); toast('设置已保存。');
};
$('#clear-key').onclick=()=> {
  settings.key='';settings.remember=false;$('#api-key').value='';$('#remember-key').checked=false;
  try { localStorage.removeItem('sticker-lab-settings'); } catch { /* In-memory key is still cleared. */ }
  $('.key-dot').classList.remove('connected');$('#configure-key span').textContent='配置自己的 API Key';toast('API Key 已清除。');
};
document.addEventListener('keydown',e=> {
  const activeDialog = !$('#settings-overlay').hidden ? $('#settings-overlay') : !$('#create-overlay').hidden ? $('#create-overlay') : null;
  if(activeDialog) {
    if(e.key==='Escape') closeDialog(`#${activeDialog.id}`);
    if(e.key==='Tab') {
      const controls=[...activeDialog.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select')].filter(x=>x.getClientRects().length);
      const first=controls[0],last=controls.at(-1);
      if(e.shiftKey && document.activeElement===first) {e.preventDefault();last.focus();}
      else if(!e.shiftKey && document.activeElement===last) {e.preventDefault();first.focus();}
    }
    return;
  }
  if(e.target.closest('input,textarea,select,button,a')) return;
  if(e.key==='ArrowRight') showSticker(current+1);
  if(e.key==='ArrowLeft') showSticker(current-1);
  if(e.key.toLowerCase()==='l' && stage) $('#layers').click();
  if(e.code==='Space' && stage) {e.preventDefault();$('#pause').click();}
});
showSticker(0);
