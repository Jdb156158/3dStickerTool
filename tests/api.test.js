import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createImageForm, makeStickerApi } from '../server/api.js';
import { removeEdgeBackground } from '../src/stickers.js';

const png = Uint8Array.from([137,80,78,71,13,10,26,10]);
function input(bytes=png) { const form = new FormData(); form.set('image',new Blob([bytes],{type:'image/png'}),'photo.png'); return form; }

test('image edit request preserves file, selects transparent PNG, bounds creative prompt',async()=> {
  const form = input(); form.set('prompt','a'.repeat(2000));
  const result = await createImageForm(form);
  assert.equal(result.get('background'),'transparent'); assert.equal(result.get('n'),'1');
  assert.equal(result.get('model'),'gpt-image-2.5-sunburst');
  assert.equal(result.get('image').size,png.length);
  assert.ok(result.get('prompt').endsWith('a'.repeat(1500)));
  assert.ok(!result.get('prompt').endsWith('a'.repeat(1501)));
});
test('reject missing image, fake image, unsupported model',async()=> {
  await assert.rejects(createImageForm(new FormData()),/12 MB/);
  await assert.rejects(createImageForm(input(new TextEncoder().encode('<script>'))),/PNG/);
  const form=input();form.set('model','unknown');await assert.rejects(createImageForm(form),/模型/);
});
test('AI material choice affects generation direction',async()=> {
  const form=input();form.set('finish','matte');
  assert.match((await createImageForm(form)).get('prompt'),/soft-touch matte white vinyl/);
  form.set('finish','unknown');await assert.rejects(createImageForm(form),/材质/);
});
test('background removal keeps white details enclosed inside subject',()=> {
  const width=7,height=7,data=new Uint8ClampedArray(width*height*4).fill(255);
  for(let y=1;y<6;y++)for(let x=1;x<6;x++) { const i=(y*width+x)*4;data[i]=200;data[i+1]=10;data[i+2]=20; }
  const center=(3*width+3)*4;data[center]=data[center+1]=data[center+2]=255;
  removeEdgeBackground({width,height,data});
  assert.equal(data[3],0);assert.equal(data[center+3],255);assert.equal(data[(2*width+2)*4+3],255);
});
test('API validates auth and origin before upstream; forwards one image and maps failures',async(t)=> {
  const calls=[];let status=200;
  const server=createServer(makeStickerApi(async(url,options)=> {calls.push({url,options});return Response.json(status===200?{data:[{b64_json:'abc'}]}:{error:{code:'insufficient_quota'}},{status});}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>server.close()); const url=`http://127.0.0.1:${server.address().port}/api/sticker`;
  let res=await fetch(url,{method:'POST',body:input()});assert.equal(res.status,401);assert.equal(calls.length,0);
  res=await fetch(url,{method:'POST',headers:{Authorization:'Bearer sk-test-only-key',Origin:'https://evil.example'},body:input()});assert.equal(res.status,403);assert.equal(calls.length,0);
  res=await fetch(url,{method:'POST',headers:{Authorization:'Bearer sk-test-only-key'},body:input()});assert.equal(res.status,200);assert.equal((await res.json()).image,'data:image/png;base64,abc');
  assert.equal(calls[0].url,'https://api.openai.com/v1/images/edits');assert.equal(calls[0].options.headers.Authorization,'Bearer sk-test-only-key');
  status=429;res=await fetch(url,{method:'POST',headers:{Authorization:'Bearer sk-test-only-key'},body:input()});assert.equal(res.status,429);assert.match((await res.json()).error,/额度/);
});
