export const finishes = {
  holo: { name: 'Holographic', zh: '镭射', description: 'Rainbow foil · gloss laminate', strength: 0.48 },
  glitter: { name: 'Glitter', zh: '闪粉', description: 'Sparkle vinyl · gloss laminate', strength: 0.28 },
  gloss: { name: 'Glossy', zh: '亮面', description: 'White vinyl · gloss laminate', strength: 0 },
  matte: { name: 'Matte', zh: '哑光', description: 'White vinyl · soft-touch finish', strength: 0 },
};

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片无法读取，请尝试另一张 PNG、JPEG 或 WebP。'));
    image.src = src;
  });
}

function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

// Only edge-connected pixels are removed, so white details inside the subject survive.
export function removeEdgeBackground(imageData, tolerance = 42) {
  const { width: w, height: h, data } = imageData;
  const samples = [0, w - 1, (h - 1) * w, w * h - 1].map(i => Array.from(data.slice(i * 4, i * 4 + 3)));
  const seen = new Uint8Array(w * h), queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  const add = i => {
    if (seen[i]) return;
    seen[i] = 1;
    const k = i * 4;
    if (data[k + 3] < 8 || samples.some(s => Math.hypot(data[k] - s[0], data[k + 1] - s[1], data[k + 2] - s[2]) < tolerance)) queue[tail++] = i;
  };
  for (let x = 0; x < w; x++) { add(x); add((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { add(y * w); add(y * w + w - 1); }
  while (head < tail) {
    const i = queue[head++]; data[i * 4 + 3] = 0;
    if (i % w > 0) add(i - 1);
    if (i % w < w - 1) add(i + 1);
    if (i >= w) add(i - w);
    if (i < w * (h - 1)) add(i + w);
  }
  return imageData;
}

// Select whole letter faces bounded by dark ink, not individual coloured pixels.
export function separateFoilInk(imageData) {
  const { data, width, height } = imageData;
  const count = width * height, seen = new Uint8Array(count), windows = new Uint8Array(count);
  const queue = new Int32Array(count);
  const bright = i => data[i * 4 + 3] > 30 && Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) > 100;
  for (let start = 0; start < count; start++) {
    if (seen[start] || !bright(start)) continue;
    let head = 0, tail = 1, coloured = 0, exterior = false;
    queue[0] = start; seen[start] = 1;
    while (head < tail) {
      const i = queue[head++], k = i * 4, x = i % width, y = Math.floor(i / width);
      if (Math.max(data[k], data[k + 1], data[k + 2]) - Math.min(data[k], data[k + 1], data[k + 2]) > 30) coloured++;
      if (!x || !y || x === width - 1 || y === height - 1) exterior = true;
      for (const next of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1]) {
        if (next < 0) continue;
        if (data[next * 4 + 3] < 30) exterior = true;
        if (!seen[next] && bright(next)) { seen[next] = 1; queue[tail++] = next; }
      }
    }
    if (!exterior && tail >= Math.max(8, count * .00008) && coloured / tail > .1) {
      for (let j = 0; j < tail; j++) windows[queue[j]] = 1;
    }
  }
  for (let i = 0; i < count; i++) {
    if (windows[i]) data[i * 4 + 3] = 0;
  }
  return imageData;
}

export async function composeSticker(src, { border = 12, finish = 'holo', removeBg = false, foilInk = false } = {}) {
  const image = await loadImage(src);
  const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
  const source = canvas(Math.round(image.width * scale), Math.round(image.height * scale));
  const ctx = source.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, source.width, source.height);
  let pixels = ctx.getImageData(0, 0, source.width, source.height);
  if (removeBg) { pixels = removeEdgeBackground(pixels); ctx.putImageData(pixels, 0, 0); }
  let minX = source.width, minY = source.height, maxX = -1, maxY = -1, transparent = 0;
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    const alpha = pixels.data[(y * source.width + x) * 4 + 3];
    if (alpha > 30) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    if (alpha < 30) transparent++;
  }
  if (maxX < 0) throw new Error('移除背景后图片为空，请关闭纯色背景移除。');
  const cw = maxX - minX + 1, ch = maxY - minY + 1, pad = Math.max(24, border + 14);
  const art = canvas(cw + pad * 2, ch + pad * 2), a = art.getContext('2d');
  if (transparent < source.width * source.height * 0.005) {
    a.beginPath(); a.roundRect(pad, pad, cw, ch, Math.min(cw, ch) * 0.08); a.clip();
  }
  a.drawImage(source, minX, minY, cw, ch, pad, pad, cw, ch);
  const silhouette = canvas(art.width, art.height), s = silhouette.getContext('2d');
  for (let i = 0; i < 48; i++) { const angle = i * Math.PI / 24; s.drawImage(art, Math.cos(angle) * border, Math.sin(angle) * border); }
  s.drawImage(art, 0, 0); s.globalCompositeOperation = 'source-in';
  s.fillStyle = '#fff'; s.fillRect(0, 0, art.width, art.height);
  const output = canvas(art.width, art.height), o = output.getContext('2d');
  o.drawImage(silhouette, 0, 0);
  if (finish === 'holo' || finish === 'glitter') {
    o.globalCompositeOperation = 'source-in';
    const gradient = o.createLinearGradient(0, 0, art.width, art.height);
    ['#bddfff', '#efc9ff', '#fff2bb', '#b1f1e7', '#d8c1ff', '#ffd4dd'].forEach((c, i) => gradient.addColorStop(i / 5, c));
    o.fillStyle = gradient; o.fillRect(0, 0, art.width, art.height);
    o.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 4800; i++) {
      const x = ((i * 127.73) % art.width), y = ((i * i * 17.13) % art.height);
      o.fillStyle = i % 2 ? 'rgba(255,255,255,.65)' : 'rgba(125,141,207,.2)';
      o.fillRect(x, y, 1.4, 1.4);
    }
  }
  o.globalCompositeOperation = 'source-over';
  if (border > 3) {
    const white = canvas(art.width, art.height), w = white.getContext('2d');
    for (let i = 0; i < 32; i++) { const angle = i * Math.PI / 16; w.drawImage(art, Math.cos(angle) * border * 0.62, Math.sin(angle) * border * 0.62); }
    w.globalCompositeOperation = 'source-in'; w.fillStyle = '#fff'; w.fillRect(0, 0, art.width, art.height); o.drawImage(white, 0, 0);
  }
  o.drawImage(art, 0, 0);
  let ink;
  if (foilInk) {
    ink = canvas(output.width, output.height);
    ink.getContext('2d').putImageData(separateFoilInk(o.getImageData(0, 0, output.width, output.height)), 0, 0);
  }
  return { canvas: output, ink, silhouette, url: output.toDataURL('image/png'), aspect: output.width / output.height };
}
