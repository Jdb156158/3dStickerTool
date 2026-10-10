export const MODELS = ['gpt-image-2.5-sunburst', 'gpt-image-2.5-flare', 'gpt-image-1.5'];
const MAX_BODY = 16 * 1024 * 1024;

export async function createImageForm(form) {
  const file = form.get('image');
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size || file.size > 12 * 1024 * 1024) {
    throw new Error('请上传不超过 12 MB 的图片。');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!png && !jpg && !webp) throw new Error('仅支持 PNG、JPEG 和 WebP 图片。');
  const model = form.get('model') || MODELS[0];
  if (!MODELS.includes(model)) throw new Error('请选择支持的图片模型。');
  const note = String(form.get('prompt') || '').trim().slice(0, 1500);
  const material = {
    holo: 'glossy laminate with a narrow iridescent holographic edge',
    glitter: 'glossy laminate with colorful glitter particles along the edge',
    gloss: 'clear glossy laminate on white vinyl, without glitter or rainbow foil',
    matte: 'soft-touch matte white vinyl, without glitter, rainbow foil or shiny reflections',
  }[form.get('finish') || 'holo'];
  if (!material) throw new Error('请选择支持的贴纸材质。');
  const output = new FormData();
  output.set('image', new Blob([bytes], { type: png ? 'image/png' : jpg ? 'image/jpeg' : 'image/webp' }), png ? 'input.png' : jpg ? 'input.jpg' : 'input.webp');
  output.set('model', model);
  output.set('size', '1024x1024');
  output.set('quality', 'medium');
  output.set('background', 'transparent');
  output.set('output_format', 'png');
  output.set('n', '1');
  output.set('prompt', `Transform the main subject in the supplied image into ONE premium collectible die-cut sticker. Preserve the subject's recognizable identity, pose and key details. Render it as a polished, playful 3D clay or resin illustration with rounded volume, vivid colors and soft studio lighting. Isolate the subject on a truly transparent background, no square backdrop, no checkerboard. Add a clean thick white die-cut border following the silhouette. Material: ${material}. Keep the entire sticker inside the image with at least 8 percent transparent padding. Front-facing sticker artwork, no perspective mockup, no hands holding it, no external cast shadow. Do not add words or logos unless present in the reference. Additional creative direction: ${note || 'Keep the character charming and expressive.'}`);
  return output;
}

export function makeStickerApi(fetchImage = fetch) {
  return async function handler(req, res, next) {
    if (req.url?.split('?')[0] !== '/api/sticker') return next?.();
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
    if (req.method !== 'POST') return send(405, { error: '请使用 POST 请求。' });
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) return send(403, { error: '不允许跨站请求。' });
    const auth = req.headers.authorization || '';
    if (!/^Bearer [^\s]{10,}$/.test(auth)) return send(401, { error: '请先在设置中填写自己的 OpenAI API Key。' });
    if (!req.headers['content-type']?.startsWith('multipart/form-data;')) return send(400, { error: '图片请求格式不正确。' });
    let form;
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY) return send(413, { error: '图片过大，请选择 12 MB 以内的图片。' });
        chunks.push(chunk);
      }
      const incoming = await new Request('http://localhost/api/sticker', { method: 'POST', headers: { 'content-type': req.headers['content-type'] }, body: Buffer.concat(chunks) }).formData();
      form = await createImageForm(incoming);
    } catch (error) { return send(400, { error: error.message }); }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180_000);
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    try {
      const upstream = await fetchImage('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: auth }, body: form, signal: controller.signal });
      const result = await upstream.json();
      if (!upstream.ok) {
        const messages = { 401: 'Key 无效或已失效，请检查 API 设置。', 403: '当前账号无权使用所选模型，请检查模型权限或组织验证。', 429: '额度不足或请求过于频繁，请检查 OpenAI 账单后重试。' };
        return send(upstream.status, { error: messages[upstream.status] || '生成未完成，请检查图片和描述后重试。', code: result.error?.code });
      }
      const image = result.data?.[0]?.b64_json;
      if (!image) return send(502, { error: '服务没有返回图片，请重试。' });
      send(200, { image: `data:image/png;base64,${image}` });
    } catch (error) {
      if (!res.destroyed) send(502, { error: error.name === 'AbortError' ? '生成等待超时，请稍后重试。' : '无法连接图片服务，请检查网络后重试。' });
    } finally { clearTimeout(timer); }
  };
}
export const stickerApi = makeStickerApi();
