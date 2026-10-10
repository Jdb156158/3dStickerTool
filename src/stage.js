import * as THREE from 'three';

export const stickerLayers = [
  { kind: 1, name: 'Gloss laminate', zh: '亮面覆膜', spec: 'PVC film · 50 µm' },
  { kind: 4, name: 'Laminate adhesive', zh: '层压粘合剂', spec: 'Clear acrylic · 15 µm' },
  { kind: 0, name: 'Printed ink', zh: '印刷油墨', spec: 'CMYK on white underbase · 10 µm' },
  { kind: 2, name: 'Holo glitter vinyl', zh: '全息闪光乙烯基', spec: 'Metallised PVC · 80 µm' },
  { kind: 5, name: 'Adhesive', zh: '粘合剂', spec: 'Permanent acrylic · 25 µm' },
  { kind: 3, name: 'Backing liner', zh: '背衬', spec: 'Silicone-coated kraft · 125 µm' },
];

const vertex = `
uniform float uTime, uBend, uPeel, uLift, uExplode;
uniform vec2 uCorner;
varying vec2 vUv;
varying vec3 vNormal, vPosition;
vec3 shape(vec3 p) {
  p.xy *= mix(1., .55, uExplode);
  p.z += sin(p.x * 1.8 + uTime * .75) * .028 + p.x * p.x * uBend;
  float d = uPeel > .001 ? max(0., dot(p.xy, uCorner) - (1.72 - uPeel)) : 0.;
  float angle = min(d * 3.4, 3.1);
  p.xy += uCorner * (sin(angle) / 3.4 - d);
  p.z += (1. - cos(angle)) / 3.4 + uLift;
  return p;
}
void main() {
  vUv = uv;
  vec3 p = shape(position);
  vec3 dx = shape(position + vec3(.003,0.,0.)) - p;
  vec3 dy = shape(position + vec3(0.,.003,0.)) - p;
  vNormal = normalize(normalMatrix * cross(dx,dy));
  vec4 mv = modelViewMatrix * vec4(p,1.);
  vPosition = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const fragment = `
uniform sampler2D uMap;
uniform float uTime, uHolo, uGlitter, uGloss, uKind, uOpacity, uExplode;
uniform vec2 uTexel;
varying vec2 vUv;
varying vec3 vNormal, vPosition;
float rand(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
void main() {
  vec4 tex = texture2D(uMap,vUv);
  if (tex.a < .03) discard;
  vec3 n = normalize(vNormal);
  vec3 view = normalize(-vPosition);
  float phase = vUv.x * 1.05 - vUv.y * .7 + n.x * 1.6 + n.y * 1.2 + uTime * .025;
  vec3 rainbow = .55 + .45 * cos(6.283 * (phase + vec3(0.,.33,.67)));
  float sheen = pow(max(0., dot(n,normalize(view + vec3(-.65,.9,1.8)))),45.);
  vec3 color = tex.rgb;
  float edgeAlpha = min(min(texture2D(uMap,vUv+vec2(uTexel.x*3.,0.)).a, texture2D(uMap,vUv-vec2(uTexel.x*3.,0.)).a), min(texture2D(uMap,vUv+vec2(0.,uTexel.y*3.)).a, texture2D(uMap,vUv-vec2(0.,uTexel.y*3.)).a));
  float rim = 1.-smoothstep(.2,.95,edgeAlpha);
  float grain = rand(floor(vUv * 700.));
  if (uKind > 3.5) {
    bool permanent = uKind > 4.5;
    color = permanent ? vec3(.88,.87,.76) : vec3(.93,.93,.90);
    color += (grain-.5)*.065;
    float alpha = permanent ? .56 : .24;
    gl_FragColor = vec4(color,tex.a*uExplode*(alpha+rim*.24));
    return;
  }
  else if (uKind > 2.5) color = vec3(.92,.90,.85) + (grain-.5)*.045;
  else if (uKind > 1.5) color = uHolo + uGlitter > .1 ? mix(vec3(.8,.82,.86), rainbow,.48) : vec3(.96);
  else if (uKind > .5) {
    color = mix(vec3(.85,.91,.95), rainbow,.18);
    gl_FragColor = vec4(color,tex.a * uOpacity * (.08 + sheen * .42 + uExplode*(.12+rim*.35)));
    return;
  } else {
    if (!gl_FrontFacing) color = vec3(.89,.88,.85);
    float brightness = max(max(color.r,color.g),color.b);
    color = mix(color, color * (.72 + rainbow * .6), uHolo * (.28 + brightness * .25));
    vec2 cell = floor(vUv * 330.);
    float sparkle = pow(max(0.,sin(rand(cell)*80. + phase*16.)),28.) * step(.83,rand(cell+2.));
    color += sparkle * uGlitter * .45 + sheen * uGloss * .24;
  }
  gl_FragColor = vec4(color,tex.a*uOpacity);
}`;

export class StickerStage {
  constructor(container, onNext) {
    this.container = container; this.onNext = onNext;
    this.paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.layers = false; this.layerSpread = 1; this.layerYaw = 0; this.zoom = 1; this.elapsed = 0; this.bend = 0; this.peel = 0;
    this.target = { x: 0, y: 0, bend: 0, peel: 0 }; this.materials = [];
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0xffffff, 0);
    this.renderer.domElement.setAttribute('aria-label', '3D 贴纸：拖动弯曲，拖动边缘卷起，点击切换');
    this.renderer.domElement.setAttribute('role', 'img');
    container.append(this.renderer.domElement);
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(35, 1, .1, 100); this.camera.position.z = 8.4;
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.layerLabels = [...document.querySelectorAll('.layer-label')];
    this.labelPoint = new THREE.Vector3();
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(container);
    this.attachEvents(); this.last = performance.now(); this.animate = this.animate.bind(this); this.raf = requestAnimationFrame(this.animate);
  }
  setZoom(value) {
    this.zoom = Math.max(.5, Math.min(2, value));
  }
  setLayers(value) {
    this.layers = value; this.layerSpread = 1; this.layerYaw = 0;
    this.target = { x: 0, y: 0, bend: 0, peel: 0 };
  }
  moveLayers(dx, dy, spread, yaw) {
    this.layerSpread = Math.max(0, Math.min(1, spread - dy / 240));
    this.layerYaw = Math.max(-.8, Math.min(.8, yaw + dx * .005));
  }
  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    this.renderer.setSize(width, height); this.camera.aspect = width / height;
    this.camera.position.z = width < 600 ? 9.3 : 8.4;
    this.camera.updateProjectionMatrix();
  }
  setSticker(sticker, finish) {
    for (const mesh of [...this.group.children]) { mesh.geometry.dispose(); mesh.material.dispose(); this.group.remove(mesh); }
    this.textures?.forEach(t => t.dispose());
    const map = new THREE.CanvasTexture(sticker.ink || sticker.canvas), mask = new THREE.CanvasTexture(sticker.silhouette);
    this.textures = [map, mask];
    const aspect = sticker.aspect;
    const w = aspect >= 1 ? 3.55 : 3.55 * aspect, h = aspect >= 1 ? 3.55 / aspect : 3.55;
    this.stickerWidth = w;
    this.layerLabels[0].querySelector('strong').textContent = finish === 'matte' ? 'Matte laminate' : 'Gloss laminate';
    this.layerLabels[0].querySelector('em').textContent = finish === 'matte' ? '哑光覆膜' : '亮面覆膜';
    const foil = finish === 'holo' || finish === 'glitter';
    this.layerLabels[3].querySelector('strong').textContent = foil ? 'Holo glitter vinyl' : 'White vinyl';
    this.layerLabels[3].querySelector('em').textContent = foil ? '全息闪光乙烯基' : '白色乙烯基';
    this.layerLabels[3].querySelector('small').textContent = foil ? 'Metallised PVC · 80 µm' : 'Calendered PVC · 80 µm';
    this.materials = [...stickerLayers].reverse().map(({ kind }, i) => {
      const material = new THREE.ShaderMaterial({
        vertexShader: vertex, fragmentShader: fragment, side: THREE.DoubleSide, transparent: true, depthWrite: false,
        uniforms: { uMap: { value: kind === 0 ? map : mask }, uTexel: { value: new THREE.Vector2(1/sticker.canvas.width,1/sticker.canvas.height) }, uExplode: { value: 0 }, uTime: { value: this.elapsed }, uBend: { value: 0 }, uPeel: { value: 0 }, uLift: { value: i * .005 }, uCorner: { value: new THREE.Vector2(.707,.707) }, uHolo: { value: finish === 'holo' ? .72 : finish === 'glitter' ? .25 : 0 }, uGlitter: { value: finish === 'glitter' ? 1 : finish === 'holo' ? .5 : 0 }, uGloss: { value: finish === 'matte' ? .1 : 1 }, uKind: { value: kind }, uOpacity: { value: 1 } },
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 80, 80), material); mesh.renderOrder = i; this.group.add(mesh); return material;
    });
    this.peel = this.bend = 0; this.target.peel = this.target.bend = 0;
  }
  attachEvents() {
    const c = this.renderer.domElement;
    const coords = e => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * 2 - 1, y: -((e.clientY - r.top) / r.height * 2 - 1) }; };
    c.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      if (this.layers) {
        this.drag = { x: e.clientX, y: e.clientY, layers: true, spread: this.layerSpread, yaw: this.layerYaw, moved: false };
        c.setPointerCapture(e.pointerId); c.style.cursor = 'grabbing';
        return;
      }
      const p = coords(e);
      const ray = new THREE.Raycaster(); ray.setFromCamera(p, this.camera);
      const hits = ray.intersectObjects(this.group.children);
      if (!hits.length) return;
      const uv = hits[0].uv;
      const tex = this.materials[0].uniforms.uMap.value.image;
      const alpha = tex.getContext('2d').getImageData(Math.min(tex.width-1,Math.floor(uv.x*tex.width)),Math.min(tex.height-1,Math.floor((1-uv.y)*tex.height)),1,1).data[3];
      if (alpha < 25) return;
      this.drag = { x: e.clientX, y: e.clientY, edge: Math.abs(uv.x-.5) > .27 || Math.abs(uv.y-.5) > .27, moved: false };
      const corner = new THREE.Vector2(uv.x-.5,uv.y-.5).normalize();
      this.materials.forEach(m => m.uniforms.uCorner.value.copy(corner));
      c.setPointerCapture(e.pointerId); c.style.cursor = 'grabbing';
    });
    c.addEventListener('pointermove', e => {
      if (!this.drag) return;
      const dx = e.clientX-this.drag.x, dy=e.clientY-this.drag.y;
      this.drag.moved ||= Math.hypot(dx,dy)>5;
      if (this.drag.layers) {
        this.moveLayers(dx, dy, this.drag.spread, this.drag.yaw);
        return;
      }
      this.target.x = Math.max(-.7,Math.min(.7,dy*.005));
      this.target.y = Math.max(-.8,Math.min(.8,dx*.005));
      this.target.bend = Math.max(-.65,Math.min(.65,dx*.004));
      this.target.peel = this.drag.edge ? Math.min(1.8,Math.hypot(dx,dy)*.009) : 0;
    });
    const release = (e, cancel = false) => {
      if (!this.drag) return;
      if (!cancel && !this.drag.moved && !this.drag.layers) this.onNext();
      this.drag = null; this.target = { x:0,y:0,bend:0,peel:0 }; c.style.cursor = 'grab';
      if(c.hasPointerCapture(e.pointerId)) c.releasePointerCapture(e.pointerId);
    };
    c.addEventListener('pointerup', e => release(e));
    c.addEventListener('pointercancel', e => release(e,true));
    c.style.cursor = 'grab';
  }
  animate(now) {
    const dt = Math.min((now-this.last)/1000,.05); this.last=now;
    if (!this.paused && !document.hidden) this.elapsed += dt;
    const ease = 1-Math.exp(-dt*10);
    const narrow = this.container.clientWidth < 600;
    const spread = this.layers ? this.layerSpread : 0;
    const closedDistance = (narrow ? 9.3 : 8.4) / this.zoom;
    const cameraDistance = THREE.MathUtils.lerp(closedDistance, narrow ? 11.5 : 8.4, spread);
    this.camera.position.z += (cameraDistance-this.camera.position.z)*ease;
    this.bend += (this.target.bend-this.bend)*ease; this.peel += (this.target.peel-this.peel)*ease;
    const tx = this.layers ? -1.05 * spread : this.target.x + Math.sin(this.elapsed*.65)*.055;
    const ty = this.layers ? (narrow ? .1 : .22) * spread + this.layerYaw : this.target.y + Math.sin(this.elapsed*.48)*.13;
    this.group.rotation.x += (tx-this.group.rotation.x)*ease;
    this.group.rotation.y += (ty-this.group.rotation.y)*ease;
    this.group.rotation.z = Math.sin(this.elapsed*.35)*.045-.065;
    this.group.position.y = this.layers ? -.1 : Math.sin(this.elapsed*.8)*.055;
    this.group.position.x += (.65 * spread-this.group.position.x)*ease;
    this.materials.forEach((m,i) => {
      m.uniforms.uTime.value=this.elapsed; m.uniforms.uBend.value=this.bend; m.uniforms.uPeel.value=this.peel;
      const lift = THREE.MathUtils.lerp(i*.005, (i-2.5)*.9, spread);
      m.uniforms.uLift.value += (lift-m.uniforms.uLift.value)*ease;
      m.uniforms.uExplode.value += (spread-m.uniforms.uExplode.value)*ease;
    });
    this.renderer.render(this.scene,this.camera); this.raf=requestAnimationFrame(this.animate);
    if (this.layers) {
      const width=this.container.clientWidth, height=this.container.clientHeight;
      this.materials.forEach((m,i)=> {
        this.labelPoint.set(-this.stickerWidth*.5*(1-.45*m.uniforms.uExplode.value),0,m.uniforms.uLift.value).applyMatrix4(this.group.matrixWorld).project(this.camera);
        const label=this.layerLabels[5-i];
        label.style.opacity = String(Math.max(0, (m.uniforms.uExplode.value-.65)/.35));
        label.style.left=`${this.container.offsetLeft+(this.labelPoint.x+1)*width/2-12}px`;
        label.style.top=`${this.container.offsetTop+(1-this.labelPoint.y)*height/2}px`;
      });
    }
  }
}
