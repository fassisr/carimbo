// Boneco do Fuilá: um corpo só (esqueleto KayKit, CC0) com peças trocáveis.
// Roupas mudam a cor das faixas da textura; bonés, gorro, chapéu e mochila são desenhados aqui em 3D.
import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/loaders/GLTFLoader.js';
import * as SU from './vendor/three/utils/SkeletonUtils.js';

const CAT = window.FUILA_ITENS;
export const OUTFIT_KEY = 'fuila-visual';
export function savedOutfit() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(OUTFIT_KEY)) || {}; } catch (e) {}
  const out = { ...CAT.padrao };
  for (const k of Object.keys(out)) if (o[k] && CAT.itens[k].some(i => i.id === o[k])) out[k] = o[k];
  return out;
}
const item = (slot, id) => CAT.itens[slot].find(i => i.id === id) || CAT.itens[slot][0];

let baseP = null;
export const loadBase = () => baseP ??= new GLTFLoader().loadAsync(new URL('./chars/boneco.glb', import.meta.url).href);

// ---------- texturas: cada célula da grade 8x4 é um degradê; trocamos a cor mantendo a luz ----------
const TS = 256, CW = TS / 8, CH = TS / 4;
const baseCache = new WeakMap();
function baseData(img) {
  let b = baseCache.get(img);
  if (b) return b;
  const cv = document.createElement('canvas'); cv.width = cv.height = TS;
  const x = cv.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, TS, TS);
  const data = x.getImageData(0, 0, TS, TS);
  const range = {};
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
    let lo = 1e9, hi = -1;
    for (let y = r * CH; y < (r + 1) * CH; y++) for (let xx = c * CW; xx < (c + 1) * CW; xx++) {
      const i = (y * TS + xx) * 4, l = data.data[i] + data.data[i + 1] + data.data[i + 2];
      if (l < lo) lo = l; if (l > hi) hi = l;
    }
    range[`r${r}c${c}`] = [lo, hi];
  }
  b = { data, range };
  baseCache.set(img, b);
  return b;
}
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const ramp = h => { const c = hex(h); return [mix(c, [255, 255, 255], 0.2), mix(c, [0, 0, 0], 0.4)]; };
function paint(mesh, roles) {
  const b = baseData(mesh.userData.img);
  const out = new ImageData(new Uint8ClampedArray(b.data.data), TS, TS);
  for (const [k, h] of Object.entries(roles)) {
    if (!h) continue;
    const r = +k[1], c = +k[3], [L, D] = ramp(h), [lo, hi] = b.range[k];
    for (let y = r * CH; y < (r + 1) * CH; y++) for (let xx = c * CW; xx < (c + 1) * CW; xx++) {
      const i = (y * TS + xx) * 4, t = (b.data.data[i] + b.data.data[i + 1] + b.data.data[i + 2] - lo) / Math.max(1, hi - lo);
      out.data[i] = D[0] + (L[0] - D[0]) * t; out.data[i + 1] = D[1] + (L[1] - D[1]) * t; out.data[i + 2] = D[2] + (L[2] - D[2]) * t;
    }
  }
  const t = mesh.material.map;
  t.image.getContext('2d').putImageData(out, 0, 0);
  t.needsUpdate = true;
}

// ---------- peças desenhadas em 3D (no espaço do osso da cabeça / do peito) ----------
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, ...o });
// cabeça KayKit: o topo do cabelo fica ~1 unidade acima do osso e a cabeça tem ~1,1 de largura
const HEAD = { y: 0.6, r: 0.6, z: 0.04 };
function capCrown(color, h = 0.78) {
  const g = new THREE.SphereGeometry(HEAD.r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const m = new THREE.Mesh(g, mat(color)); m.scale.set(1.04, h, 1.08); return m;
}
// o pino do Fuilá bordado na frente do boné
let logoTex = null;
function logo() {
  if (!logoTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
    x.translate(64, 66); x.scale(0.17, 0.17); x.translate(-512, -526);
    x.fillStyle = '#FFC21A'; x.fill(new Path2D('M512 872C468 800 282 650 282 446a230 230 0 1 1 460 0c0 204-186 354-230 426z'));
    x.strokeStyle = '#3B2BF5'; x.lineWidth = 68; x.lineCap = x.lineJoin = 'round'; x.stroke(new Path2D('M402 452l80 80 148-150'));
    logoTex = new THREE.CanvasTexture(cv); logoTex.colorSpace = THREE.SRGBColorSpace;
  }
  return new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, roughness: 0.9, depthWrite: false }));
}
const HATS = {
  bone([a, b], it) {
    const g = new THREE.Group();
    g.add(capCrown(a, 0.86));
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 32, 1, false, -Math.PI / 2, Math.PI), mat(b));
    brim.scale.set(1.15, 1, 1.3); brim.position.set(0, 0.02, 0.5); brim.rotation.x = 0.18; g.add(brim);
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), mat(b)); btn.position.y = HEAD.r * 0.86; g.add(btn);
    if (it.logo) { const l = logo(); const f = 0.55; l.position.set(0, HEAD.r * 0.86 * Math.sin(f) + 0.01, HEAD.r * 1.08 * Math.cos(f) + 0.01); l.rotation.x = -f * 0.8; g.add(l); }
    return g;
  },
  reto([a, b]) {
    const g = new THREE.Group();
    const c = capCrown(a, 0.92); g.add(c);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.05, 0.62), mat(b, { color: new THREE.Color(b).multiplyScalar(0.8) }));
    brim.position.set(0, 0.05, 0.86); g.add(brim);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 0.04), mat('#FFC21A')); band.position.set(0, 0.32, HEAD.r * 1.04); band.rotation.x = -0.45; g.add(band);
    return g;
  },
  gorro([a, b]) {
    const g = new THREE.Group();
    g.add(capCrown(a, 1.05));
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(HEAD.r * 1.07, HEAD.r * 1.1, 0.26, 32, 1, true), mat(a, { side: THREE.DoubleSide, color: new THREE.Color(a).multiplyScalar(0.88) }));
    cuff.position.y = 0.05; g.add(cuff);
    const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), mat(b)); pom.position.y = HEAD.r * 1.05 + 0.08; g.add(pom);
    return g;
  },
  pescador([a, b]) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(HEAD.r * 0.8, HEAD.r * 1.08, 0.5, 32), mat(a)); top.position.y = 0.2; g.add(top);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(HEAD.r * 1.08, HEAD.r * 1.6, 0.22, 32, 1, true), mat(b, { side: THREE.DoubleSide })); brim.position.y = -0.08; g.add(brim);
    return g;
  },
  viseira([a, b]) {
    const g = new THREE.Group();
    const band = new THREE.Mesh(new THREE.CylinderGeometry(HEAD.r * 1.07, HEAD.r * 1.07, 0.18, 32, 1, true), mat(b, { side: THREE.DoubleSide })); band.position.y = 0.12; g.add(band);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 32, 1, false, -Math.PI / 2, Math.PI), mat(a));
    brim.scale.set(1.15, 1, 1.3); brim.position.set(0, 0.06, 0.52); brim.rotation.x = 0.12; g.add(brim);
    return g;
  },
};
function backpack([a, b]) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.3), mat(a)); g.add(body);
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.31, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(a)); lid.scale.set(1, 0.45, 0.5); lid.position.y = 0.36; g.add(lid);
  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.1), mat(b)); pocket.position.set(0, -0.14, -0.18); g.add(pocket);
  for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.05), mat(b)); st.position.set(s * 0.2, 0.02, 0.17); g.add(st); }
  return g;
}

const HAIR = { topete: 'Knight_Head', chanel: 'Rogue_Head', rabo: 'Mage_Head', careca: 'Barbarian_Head' };
const GLB_HATS = { mago: 'Mage_Hat', viking: 'Barbarian_Hat', elmo: 'Knight_Helmet' };

export async function createBoneco() {
  const g = await loadBase();
  const model = SU.clone(g.scene);
  model.scale.setScalar(1 / 2.3);
  const meshes = {}, bones = {};
  model.traverse(o => {
    if (o.isBone) bones[o.name] = o;
    if (!o.isMesh) return;
    meshes[o.name] = o;
    o.userData.img = o.material.map.image;
    const cv = document.createElement('canvas'); cv.width = cv.height = TS;
    const t = new THREE.CanvasTexture(cv); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter;
    o.material = o.material.clone(); o.material.map = t;
    o.frustumCulled = false;
  });
  const extras = [];
  let outfit = null;
  function wear(o) {
    outfit = { ...o };
    for (const e of extras.splice(0)) { e.removeFromParent(); e.traverse(x => { x.geometry?.dispose(); x.material?.dispose(); }); }
    const hat = item('chapeu', o.chapeu), shirt = item('camisa', o.camisa), back = item('costas', o.costas);
    const skin = item('pele', o.pele).cores[0], hair = item('corCabelo', o.corCabelo).cores[0];
    const body = {
      r0c0: skin, r2c5: skin, r0c1: hair,
      r1c0: shirt.cores[0], r1c1: shirt.cores[0], r0c6: shirt.cores[1],
      r1c7: item('calca', o.calca).cores[0], r2c3: item('tenis', o.tenis).cores[0],
    };
    // cabelo (ou capuz, que já vem com a cabeça)
    const head = hat.tipo === 'capuz' ? 'Rogue_Head_Hooded' : HAIR[o.cabelo] || 'Knight_Head';
    for (const n of [...Object.values(HAIR), 'Rogue_Head_Hooded']) if (meshes[n]) meshes[n].visible = n === head;
    for (const n of Object.values(GLB_HATS)) if (meshes[n]) meshes[n].visible = GLB_HATS[hat.tipo] === n;
    if (meshes.Rogue_Cape) meshes.Rogue_Cape.visible = back.tipo === 'capa';
    for (const [n, m] of Object.entries(meshes)) {
      if (!m.visible) continue;
      const roles = { ...body };
      if (n === 'Rogue_Head_Hooded') roles.r1c1 = hat.cores[0];
      if (n === 'Mage_Head') roles.r1c1 = shirt.cores[1];
      if (n === 'Rogue_Cape') roles.r1c1 = back.cores[0];
      if (GLB_HATS[hat.tipo] === n) { delete roles.r1c1; delete roles.r1c0; delete roles.r0c6; }
      paint(m, roles);
    }
    if (HATS[hat.tipo]) {
      const h = HATS[hat.tipo](hat.cores, hat);
      h.position.set(0, HEAD.y, HEAD.z);
      h.traverse(x => { x.frustumCulled = false; });
      bones.head.add(h); extras.push(h);
    }
    if (back.tipo === 'mochila') {
      const p = backpack(back.cores);
      // o osso do peito não está alinhado com o corpo: converte "atrás das costas" para o espaço dele
      model.updateMatrixWorld(true);
      const rel = model.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(bones.chest.getWorldQuaternion(new THREE.Quaternion())).invert();
      p.quaternion.copy(rel);
      p.position.set(0, -0.05, -0.4).applyQuaternion(rel);
      bones.chest.add(p); extras.push(p);
    }
  }
  return { model, animations: g.animations, wear, get outfit() { return outfit; }, meshes, bones };
}

// ---------- vitrine: o boneco numa tela própria (tela de Visual, miniaturas e retrato do HUD) ----------
const FRAMES = {
  full: { fov: 28, pos: [0, 0.62, 3.6], at: [0, 0.5, 0] },
  face: { fov: 21, pos: [0, 0.92, 2.7], at: [0, 0.8, 0] },
  back: { fov: 22, pos: [0, 0.7, 2.9], at: [0, 0.6, 0] },
};
export function stage(canvas, { rotate = true, framing = 'full' } = {}) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(Math.min(2, devicePixelRatio));
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff, 0x8a83c9, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.6); sun.position.set(-2, 6, 6); sc.add(sun);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  let b = null, mixer = null, idle = null, raf = 0, last = performance.now(), yaw = 0.35, dragging = false, px = 0, fr = framing;
  const W0 = canvas.width, H0 = canvas.height; // telas fora da página guardam o tamanho original
  function frame() {
    const w = canvas.clientWidth || W0, h = canvas.clientHeight || H0;
    r.setSize(w, h, false); cam.aspect = w / h;
    const f = FRAMES[fr]; cam.fov = f.fov; cam.position.set(...f.pos); cam.lookAt(...f.at);
    cam.updateProjectionMatrix();
  }
  const ready = createBoneco().then(x => {
    b = x; sc.add(b.model);
    mixer = new THREE.AnimationMixer(b.model);
    idle = mixer.clipAction(b.animations.find(a => a.name === 'Idle')); idle.play();
    mixer.addEventListener('finished', () => { mixer.stopAllAction(); idle.reset().play(); });
    return b;
  });
  function tick() {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (b) { if (rotate && !dragging) yaw += dt * 0.45; b.model.rotation.y = yaw; mixer.update(dt); }
    r.render(sc, cam);
    raf = requestAnimationFrame(tick);
  }
  canvas.addEventListener('pointerdown', e => { dragging = true; px = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (dragging) { yaw += (e.clientX - px) / 70; px = e.clientX; } });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.style.touchAction = 'pan-y';
  frame();
  return {
    ready,
    wear: async o => { await ready; b.wear(o); },
    cheer() { if (!b) return; const a = mixer.clipAction(b.animations.find(x => x.name === 'Cheer')); a.setLoop(THREE.LoopOnce, 1); mixer.stopAllAction(); a.reset().play(); },
    start() { cancelAnimationFrame(raf); last = performance.now(); fr = framing; frame(); tick(); },
    stop() { cancelAnimationFrame(raf); },
    // foto parada (miniaturas e retrato)
    async snap(o, { framing: f = 'face', yaw: y = 0.3 } = {}) {
      await ready; b.wear(o); fr = f; b.model.rotation.y = y; idle.time = 0.3; mixer.update(0); frame(); r.render(sc, cam);
      return canvas.toDataURL('image/png');
    },
  };
}
window.fuilaBoneco = { stage, savedOutfit, OUTFIT_KEY };
window.dispatchEvent(new Event('boneco-ready'));
