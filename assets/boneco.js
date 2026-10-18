// Boneco do Fuilá: corpo humano da Quaternius (CC0), com cabelos, capuz e roupas que seguem o corpo.
// Pele, cabelo e capuz mudam de cor na textura; camiseta, calça e tênis mudam a cor do material;
// bonés, chapéus, mochila e capa são desenhados aqui em 3D, com formas lisas.
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

const files = {};
export const loadBase = (sex = 'm') => files[sex] ??= new GLTFLoader().loadAsync(new URL(`./chars/humano-${sex}.glb`, import.meta.url).href);
const SCALE = 1 / 1.8; // o corpo tem 1,8 m; na vitrine ele fica com 1 unidade de altura

// ---------- cor na textura ----------
const TS = 512;
const texCache = new WeakMap();
// guarda os pixels originais, a luminância e a cor média de cada imagem
function texInfo(img) {
  let b = texCache.get(img);
  if (b) return b;
  const cv = document.createElement('canvas'); cv.width = cv.height = TS;
  const x = cv.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, TS, TS);
  const data = x.getImageData(0, 0, TS, TS).data;
  const n = TS * TS, lum = new Float32Array(n), hist = new Uint32Array(256);
  const avg = [0, 0, 0]; let cnt = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], bl = data[i * 4 + 2], l = 0.3 * r + 0.59 * g + 0.11 * bl;
    lum[i] = l; hist[l | 0]++;
    if (l > 60) { avg[0] += r; avg[1] += g; avg[2] += bl; cnt++; }
  }
  let acc = 0, lo = 0, hi = 255;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc < n * 0.03) lo = i; if (acc < n * 0.985) hi = i; }
  b = { data, lum, lo, hi, avg: avg.map(v => v / Math.max(1, cnt)) };
  texCache.set(img, b);
  return b;
}
const rgb = h => { const c = new THREE.Color(h); c.convertLinearToSRGB(); return [c.r * 255, c.g * 255, c.b * 255]; };
function canvasTex(src) {
  const cv = document.createElement('canvas'); cv.width = cv.height = TS;
  const t = new THREE.CanvasTexture(cv);
  t.flipY = src.flipY; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = src.wrapS; t.wrapT = src.wrapT;
  t.anisotropy = 4;
  return t;
}
// pele: multiplica para manter o tom de boca, bochecha e sombras
function tintTo(mesh, hex) {
  const b = texInfo(mesh.userData.img), out = new ImageData(TS, TS), d = b.data, o = out.data, c = rgb(hex);
  const k = [0, 1, 2].map(i => c[i] / b.avg[i]);
  for (let i = 0; i < d.length; i += 4) { o[i] = d[i] * k[0]; o[i + 1] = d[i + 1] * k[1]; o[i + 2] = d[i + 2] * k[2]; o[i + 3] = 255; }
  put(mesh, out);
}
// cabelo e capuz: troca a cor e mantém os fios e as dobras (luz da textura original)
function rampTo(mesh, hex, light = 0.3, dark = 0.62) {
  const b = texInfo(mesh.userData.img), out = new ImageData(TS, TS), o = out.data, c = rgb(hex);
  const L = c.map(v => v + (255 - v) * light), D = c.map(v => v * (1 - dark)), span = Math.max(1, b.hi - b.lo);
  for (let i = 0, p = 0; p < b.lum.length; p++, i += 4) {
    let t = (b.lum[p] - b.lo) / span; t = t < 0 ? 0 : t > 1 ? 1 : t; t = t * t * (3 - 2 * t);
    o[i] = D[0] + (L[0] - D[0]) * t; o[i + 1] = D[1] + (L[1] - D[1]) * t; o[i + 2] = D[2] + (L[2] - D[2]) * t; o[i + 3] = 255;
  }
  put(mesh, out);
}
function put(mesh, imageData) {
  const t = mesh.material.map;
  t.image.getContext('2d').putImageData(imageData, 0, 0);
  t.needsUpdate = true;
}

// ---------- peças desenhadas em 3D ----------
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, metalness: 0, ...o });
const dark = (c, k) => new THREE.Color(c).multiplyScalar(k);
// perfil girado em volta do eixo vertical (pontos [raio, altura])
const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
// caixa com cantos arredondados
function roundBox(w, h, d, r, seg = 6) {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg), p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3();
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(THREE.MathUtils.clamp(v.x, -hw, hw), THREE.MathUtils.clamp(v.y, -hh, hh), THREE.MathUtils.clamp(v.z, -hd, hd));
    v.sub(c).normalize().multiplyScalar(r).add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
// tubo afinando de r0 até r1
function taperTube(points, r0, r1, seg = 40, rad = 14) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, seg, 1, rad, false);
  const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const t = Math.floor(i / (rad + 1)) / seg, c = curve.getPointAt(t), r = r0 + (r1 - r0) * t;
    nn.fromBufferAttribute(n, i);
    v.copy(c).addScaledVector(nn, r); p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// medidas da cabeça a partir da linha da testa (em metros, y para cima, z para a frente)
const HEAD = { r: 0.104, h: 0.094, z: 1.13 };
// aba de boné: meia-lua grossa com bordas arredondadas, curvada para baixo dos lados
function brim(color, { w = 0.1, len = 0.075, curve = 1.6, flat = false } = {}) {
  const s = new THREE.Shape();
  s.moveTo(-w, 0);
  s.bezierCurveTo(-w, len * 0.9, -w * 0.45, len * 1.25, 0, len * 1.25);
  s.bezierCurveTo(w * 0.45, len * 1.25, w, len * 0.9, w, 0);
  s.lineTo(-w, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0025, bevelSegments: 3, curveSegments: 24 });
  g.rotateX(Math.PI / 2);
  const p = g.attributes.position;
  if (!flat) for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) - curve * x * x); }
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat(color));
}
function crown(color, h = HEAD.h) {
  // perfil de cúpula, do topo até a testa, descendo um pouco atrás das orelhas
  const pts = []; for (let i = 0; i <= 18; i++) { const a = (i / 18) * (Math.PI / 2); pts.push([Math.sin(a) * HEAD.r, Math.cos(a) * h]); }
  pts.push([HEAD.r * 1.005, -0.006]);
  const m = new THREE.Mesh(lathe(pts, 64), mat(color, { side: THREE.DoubleSide }));
  m.scale.z = HEAD.z;
  return m;
}
// o pino do Fuilá bordado na frente do boné
let logoTex = null;
function logo(size = 0.05) {
  if (!logoTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
    x.translate(64, 66); x.scale(0.17, 0.17); x.translate(-512, -526);
    x.fillStyle = '#FFC21A'; x.fill(new Path2D('M512 872C468 800 282 650 282 446a230 230 0 1 1 460 0c0 204-186 354-230 426z'));
    x.strokeStyle = '#3B2BF5'; x.lineWidth = 68; x.lineCap = x.lineJoin = 'round'; x.stroke(new Path2D('M402 452l80 80 148-150'));
    logoTex = new THREE.CanvasTexture(cv); logoTex.colorSpace = THREE.SRGBColorSpace;
  }
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
}
// põe uma peça plana na frente da copa, na altura do ângulo (0 = topo, PI/2 = testa)
const onFront = (m, ang, h = HEAD.h) => { m.position.set(0, Math.cos(ang) * h * 1.01, Math.sin(ang) * HEAD.r * HEAD.z * 1.01); m.rotation.x = -(Math.PI / 2 - ang) * 0.9; return m; };
const HATS = {
  bone([a, b], it) {
    const g = new THREE.Group();
    g.add(crown(a));
    const br = brim(b); br.position.set(0, 0.004, HEAD.r * HEAD.z * 0.9); br.rotation.x = 0.1; g.add(br);
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.008, 16, 8), mat(b)); btn.position.y = HEAD.h; g.add(btn);
    // costuras dos gomos
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 4, 64, Math.PI), mat(dark(a, 0.7)));
      s.scale.set(HEAD.r * 1.004, HEAD.h * 1.004, 0.1); s.rotation.y = i * Math.PI / 3; g.add(s);
    }
    if (it.logo) g.add(onFront(logo(0.05), 1.0));
    return g;
  },
  reto([a, b]) {
    const g = new THREE.Group();
    g.add(crown(a, HEAD.h * 1.1));
    const br = brim(dark(b, 0.85), { w: 0.11, len: 0.07, flat: true }); br.position.set(0, 0.006, HEAD.r * HEAD.z * 0.88); br.rotation.x = 0.02; g.add(br);
    const tag = new THREE.Mesh(roundBox(0.045, 0.022, 0.003, 0.0014, 3), mat('#FFC21A')); g.add(onFront(tag, 1.1, HEAD.h * 1.1));
    return g;
  },
  gorro([a, b]) {
    const g = new THREE.Group();
    g.add(crown(a, HEAD.h * 1.22));
    // barra dobrada
    const cuff = new THREE.Mesh(lathe([[HEAD.r * 1.0, -0.012], [HEAD.r * 1.06, -0.006], [HEAD.r * 1.075, 0.02], [HEAD.r * 1.04, 0.034], [HEAD.r * 0.97, 0.036]], 64), mat(dark(a, 0.9), { side: THREE.DoubleSide }));
    cuff.scale.z = HEAD.z; g.add(cuff);
    const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.026, 3), mat(b, { roughness: 1 })); pom.position.y = HEAD.h * 1.22 + 0.016; g.add(pom);
    return g;
  },
  pescador([a, b]) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(lathe([[0, HEAD.h * 1.04], [HEAD.r * 0.74, HEAD.h * 1.04], [HEAD.r * 0.86, HEAD.h], [HEAD.r * 1.02, 0.02], [HEAD.r * 1.05, -0.008], [HEAD.r * 1.14, -0.018], [HEAD.r * 1.48, -0.04], [HEAD.r * 1.54, -0.046]]), mat(a, { side: THREE.DoubleSide }));
    m.scale.z = HEAD.z; g.add(m);
    const band = new THREE.Mesh(lathe([[HEAD.r * 1.045, 0.0], [HEAD.r * 1.03, 0.022]]), mat(b, { side: THREE.DoubleSide })); band.scale.z = HEAD.z * 1.004; g.add(band);
    return g;
  },
  viseira([a, b]) {
    const g = new THREE.Group();
    const band = new THREE.Mesh(lathe([[HEAD.r * 1.0, -0.008], [HEAD.r * 1.025, 0.0], [HEAD.r * 1.02, 0.026], [HEAD.r * 0.98, 0.032]]), mat(b, { side: THREE.DoubleSide })); band.scale.z = HEAD.z; g.add(band);
    const br = brim(a); br.position.set(0, 0.004, HEAD.r * HEAD.z * 0.93); br.rotation.x = 0.1; g.add(br);
    return g;
  },
  mago() {
    const g = new THREE.Group();
    const c = '#5B3CC4';
    const br = new THREE.Mesh(lathe([[HEAD.r * 0.95, 0.01], [HEAD.r * 1.6, -0.006], [HEAD.r * 2.0, -0.018], [HEAD.r * 2.05, -0.014]]), mat(c, { side: THREE.DoubleSide })); br.scale.z = HEAD.z; g.add(br);
    const cone = new THREE.Mesh(taperTube([[0, -0.004, 0], [0, 0.09, -0.005], [0, 0.18, -0.03], [0, 0.24, -0.09], [0, 0.22, -0.15]], HEAD.r * 1.02, 0.004, 48, 32), mat(c, { side: THREE.DoubleSide }));
    cone.scale.z = HEAD.z; g.add(cone);
    const band = new THREE.Mesh(lathe([[HEAD.r * 1.03, 0.004], [HEAD.r * 0.98, 0.03]]), mat('#FFC21A', { side: THREE.DoubleSide })); band.scale.z = HEAD.z * 1.01; g.add(band);
    for (const [y, a, s] of [[0.07, 0.6, 1], [0.13, -0.9, 0.8], [0.05, -0.3, 0.7]]) {
      const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.011 * s, 0), mat('#FFE07A', { emissive: '#8a6a00' }));
      const k = 1 - y * 3.3; st.position.set(Math.sin(a) * HEAD.r * k, y, Math.cos(a) * HEAD.r * HEAD.z * k); g.add(st);
    }
    return g;
  },
  viking() {
    const g = new THREE.Group();
    const steel = mat('#9EA4B5', { metalness: 0.35, roughness: 0.4 }), bronze = mat('#B07A3A', { metalness: 0.3, roughness: 0.45 });
    const dome = crown('#9EA4B5', HEAD.h * 1.06); steel.side = THREE.DoubleSide; dome.material = steel; g.add(dome);
    bronze.side = THREE.DoubleSide; const rim = new THREE.Mesh(lathe([[HEAD.r * 1.0, -0.012], [HEAD.r * 1.05, -0.004], [HEAD.r * 1.05, 0.014], [HEAD.r * 1.01, 0.022]]), bronze); rim.scale.z = HEAD.z; g.add(rim);
    const ridge = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 48, Math.PI), bronze);
    ridge.rotation.y = Math.PI / 2; ridge.scale.set(HEAD.r * HEAD.z * 1.01, HEAD.h * 1.07, 0.1); g.add(ridge);
    for (const s of [-1, 1]) {
      g.add(new THREE.Mesh(taperTube([[s * HEAD.r * 0.85, 0.04, 0], [s * HEAD.r * 1.4, 0.07, 0.005], [s * HEAD.r * 1.7, 0.14, 0.02], [s * HEAD.r * 1.65, 0.21, 0.04]], 0.02, 0.002, 32, 16), mat('#F3E7CF', { roughness: 0.6 })));
    }
    return g;
  },
  elmo() {
    const g = new THREE.Group();
    const steel = mat('#B9BECB', { metalness: 0.4, roughness: 0.35 });
    const pts = []; for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI / 2; pts.push([Math.sin(a) * HEAD.r * 1.1, Math.cos(a) * HEAD.h * 1.15]); }
    pts.push([HEAD.r * 1.12, -0.06], [HEAD.r * 1.1, -0.15], [HEAD.r * 1.04, -0.155]);
    steel.side = THREE.DoubleSide; const m = new THREE.Mesh(lathe(pts, 64), steel); m.scale.z = HEAD.z; g.add(m);
    // fresta dos olhos e proteção do nariz
    const slit = new THREE.Mesh(roundBox(0.12, 0.012, 0.03, 0.005, 3), mat('#15131f', { roughness: 1 })); slit.position.set(0, -0.03, HEAD.r * HEAD.z * 1.09); g.add(slit);
    const nose = new THREE.Mesh(roundBox(0.012, 0.09, 0.03, 0.005, 3), steel); nose.position.set(0, -0.075, HEAD.r * HEAD.z * 1.11); g.add(nose);
    g.add(new THREE.Mesh(taperTube([[0, HEAD.h * 1.12, 0.03], [0, HEAD.h * 1.3, -0.02], [0, HEAD.h * 1.25, -0.1], [0, HEAD.h * 0.9, -0.17]], 0.018, 0.006, 32, 12), mat('#C8232C', { roughness: 1 })));
    return g;
  },
};
// altura da copa de cada chapéu (em relação a HEAD.h), para o cabelo caber dentro
const HAT_H = { reto: 1.1, gorro: 1.22, pescador: 1.04, viseira: 3, mago: 1.0, viking: 1.06, elmo: 1.15 };
// mochila presa ao osso do peito (coordenadas do corpo: y para cima, z para a frente)
function backpack([a, b], f) {
  const g = new THREE.Group(), z0 = f.back;
  const body = new THREE.Mesh(roundBox(0.28, 0.36, 0.13, 0.045), mat(a)); body.position.set(0, -0.03, z0 - 0.066); g.add(body);
  const pocket = new THREE.Mesh(roundBox(0.2, 0.14, 0.05, 0.022), mat(dark(a, 0.88))); pocket.position.set(0, -0.11, z0 - 0.14); g.add(pocket);
  const zip = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.004, 6, 40, Math.PI), mat(b)); zip.position.set(0, 0.03, z0 - 0.131); zip.scale.y = 0.5; g.add(zip);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 8, 20, Math.PI), mat(b)); loop.position.set(0, 0.15, z0 - 0.066); g.add(loop);
  for (const s of [-1, 1]) g.add(new THREE.Mesh(taperTube(f.strap.map(([x, y, z]) => [s * x, y, z]), 0.011, 0.011, 48, 8), mat(b)));
  return g;
}
// capa caída das costas, presa nos ombros
function cape([a], f) {
  const W = 18, H = 22, pos = [], idx = [];
  for (let j = 0; j <= H; j++) for (let i = 0; i <= W; i++) {
    const u = i / W - 0.5, v = j / H, w = 0.17 + v * 0.15, ang = u * (2.4 - v * 1.0);
    const x = Math.sin(ang) * w, z = f.back + 0.01 - (1 - Math.cos(ang)) * -w * 0.5 - v * v * 0.14 - 0.025 * (1 + Math.cos(u * Math.PI * 6)) * v;
    pos.push(x, f.shoulder - v * f.len, z);
  }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const p = j * (W + 1) + i; idx.push(p, p + W + 1, p + 1, p + 1, p + W + 1, p + W + 2); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat(a, { side: THREE.DoubleSide, roughness: 0.75 })));
  for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 10), mat('#FFC21A', { metalness: 0.3, roughness: 0.4 })); c.position.set(s * 0.12, f.shoulder - 0.005, f.back + 0.05); g.add(c); }
  return g;
}

// medidas de cada corpo (em metros, relativas ao osso) para encaixar chapéus, mochila e capa
const FIT = {
  m: { brow: [0, 0.118, 0.006], back: -0.185, shoulder: 0.215, len: 0.86,
    strap: [[0.08, 0.12, -0.17], [0.095, 0.215, -0.07], [0.1, 0.19, 0.09], [0.11, 0.06, 0.155], [0.16, -0.06, 0.08], [0.13, -0.17, -0.17]] },
  f: { brow: [0, 0.118, 0.008], back: -0.155, shoulder: 0.19, len: 0.82,
    strap: [[0.07, 0.11, -0.14], [0.085, 0.19, -0.06], [0.09, 0.16, 0.08], [0.115, 0.04, 0.16], [0.15, -0.07, 0.07], [0.12, -0.17, -0.14]] },
};
// cabelo do catálogo -> malhas do arquivo
const HAIR = { topete: ['Cabelo_Repartido'], chanel: ['Cabelo_Longo'], rabo: ['Cabelo_Coque'], careca: ['Cabelo_Barba'], raspado: ['Cabelo_Raspado'], barba: ['Cabelo_Raspado', 'Cabelo_Barba'] };
const ALL_HAIR = ['Cabelo_Repartido', 'Cabelo_Longo', 'Cabelo_Coque', 'Cabelo_Barba', 'Cabelo_Raspado'];

// prende um grupo a um osso usando os eixos do corpo (y para cima, z para a frente) na pose original do arquivo
function bindOf(skel, bone) { return skel.boneInverses[skel.bones.indexOf(bone)].clone().invert(); }
function attachTo(skel, bone, group, offset, tilt = 0) {
  const rel = new THREE.Quaternion().setFromRotationMatrix(bindOf(skel, bone)).invert();
  group.rotation.x = tilt;
  const holder = new THREE.Group(); holder.add(group);
  holder.quaternion.copy(rel);
  holder.position.set(...offset).applyQuaternion(rel);
  holder.traverse(x => { x.frustumCulled = false; });
  bone.add(holder);
  holder.updateMatrixWorld(true);
  return holder;
}
// com chapéu, o cabelo de cima é apertado para dentro da copa (o que cai abaixo da aba continua aparecendo)
function squashHair(mesh, hat, fit) {
  const geo = mesh.geometry, P = geo.attributes.position;
  if (!geo.userData.orig) { const o = new Float32Array(P.count * 3); for (let i = 0; i < P.count; i++) o.set([P.getX(i), P.getY(i), P.getZ(i)], i * 3); geo.userData.orig = o; }
  const orig = geo.userData.orig, done = () => { (P.data || P).needsUpdate = true; geo.computeBoundingSphere(); };
  if (!hat) { for (let i = 0; i < P.count; i++) P.setXYZ(i, orig[i * 3], orig[i * 3 + 1], orig[i * 3 + 2]); return done(); }
  const skel = mesh.skeleton, head = skel.bones.find(b => b.name === 'Head');
  const toHead = skel.boneInverses[skel.bones.indexOf(head)];
  // matriz do chapéu dentro do osso da cabeça
  const inner = hat.children[0];
  const H = new THREE.Matrix4().compose(hat.position, hat.quaternion, new THREE.Vector3(1, 1, 1)).multiply(new THREE.Matrix4().makeRotationX(inner.rotation.x));
  const Hi = H.clone().invert(), back = toHead.clone().invert().multiply(H), fwd = Hi.clone().multiply(toHead);
  const v = new THREE.Vector3(), { r, h, z } = fit;
  for (let i = 0; i < P.count; i++) {
    v.fromArray(orig, i * 3).applyMatrix4(fwd);
    if (v.y > -0.012) {
      const e = Math.hypot(v.x / r, Math.max(0, v.y) / h, v.z / (r * z));
      if (e > 0.93) { const k = 0.93 / e; v.x *= k; v.z *= k; if (v.y > 0) v.y *= k; }
    }
    v.applyMatrix4(back); P.setXYZ(i, v.x, v.y, v.z);
  }
  done();
}

// roupas: o arquivo traz as linhas de corte (barra, gola, mangas, sola) na pose original;
// cada pixel é recortado ou pintado da cor do detalhe conforme a posição dele nessa pose
const CUT_GLSL = {
  Camiseta: `
    vec3 sh = vec3(sign(vBind.x) * uC.sh.x, uC.sh.yz), ax = vec3(sign(vBind.x) * uC.el.x, uC.el.yz) - sh;
    float t = dot(vBind - sh, ax) / dot(ax, ax);
    float cy = uC.collar - uC.collarK * max(0., vBind.z) + 0.7 * max(0., length(vec2(vBind.x, vBind.z + 0.02)) - 0.07);
    if (vBind.y < uC.hem || t > uC.sleeve || vBind.y > cy) discard;
    trimW = max(step(cy - uC.band, vBind.y), step(uC.sleeve - uC.band / length(ax), t));`,
  Calca: `if (vBind.y < uC.cuff) discard;`,
  Tenis: `if (vBind.y > uC.top) discard; trimW = step(vBind.y, uC.sole);`,
};
function clothMaterial(m, name, cut) {
  const u = { value: new THREE.Color('#ffffff') };
  m.userData.trim = u;
  const c = { value: { hem: 0, collar: 9, collarK: 0, sleeve: 9, band: 0, cuff: -9, sole: -9, top: 9, sh: new THREE.Vector3(), el: new THREE.Vector3(1, 0, 0), ...cut } };
  if (cut.sh) { c.value.sh = new THREE.Vector3(...cut.sh); c.value.el = new THREE.Vector3(...cut.el); }
  m.onBeforeCompile = sh => {
    sh.uniforms.uTrim = u; sh.uniforms.uC = c;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBind;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec3 uTrim; varying vec3 vBind;
      struct Cut { float hem; float collar; float collarK; float sleeve; float band; float cuff; float sole; float top; vec3 sh; vec3 el; };
      uniform Cut uC;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float trimW = 0.;
      ${CUT_GLSL[name] || ''}
      diffuseColor.rgb = mix(diffuseColor.rgb, uTrim * vColor.rgb, trimW);
      if (!gl_FrontFacing) diffuseColor.rgb *= 0.55;`);
  };
  m.customProgramCacheKey = () => 'roupa-' + name;
}

async function bodyParts(sex) {
  const g = await loadBase(sex);
  const scene = SU.clone(g.scene);
  const meshes = {}, bones = {};
  scene.traverse(o => {
    if (o.isBone) bones[o.name] = o;
    if (!o.isMesh) return;
    // malhas com duas partes (camiseta e detalhe) vêm dentro de um grupo com o nome da peça
    const name = o.parent && o.parent.isGroup && o.parent !== scene ? o.parent.name : o.name;
    (meshes[name] ??= []).push(o);
    o.frustumCulled = false;
    o.material = o.material.clone();
    if (o.material.map && /Corpo|Cabelo|Sobrancelha|Capuz/.test(name)) { o.userData.img = o.material.map.image; o.material.map = canvasTex(o.material.map); }
    if (o.geometry.attributes.color) o.material.vertexColors = true;
    if (o.userData.corte) clothMaterial(o.material, name, o.userData.corte);
    if (/Cabelo/.test(name)) o.geometry = o.geometry.clone(); // o cabelo muda de forma embaixo do chapéu
  });
  // pose do arquivo guardada para encaixar as peças sempre do mesmo jeito
  scene.updateMatrixWorld(true);
  return { scene, meshes, bones, animations: g.animations, sex };
}

export async function createBoneco() {
  const model = new THREE.Group();
  const parts = {};
  let cur = null, outfit = null, mixer = null, actions = {}, playing = null, onFinished = null, tok = 0;
  const extras = [];
  async function setBody(sex) {
    if (cur?.sex === sex) return;
    parts[sex] ??= await bodyParts(sex);
    const was = playing?.getClip().name;
    if (cur) { mixer.stopAllAction(); model.remove(cur.scene); }
    cur = parts[sex];
    cur.scene.scale.setScalar(SCALE);
    model.add(cur.scene);
    mixer = new THREE.AnimationMixer(cur.scene);
    mixer.addEventListener('finished', e => onFinished?.(e));
    actions = {}; for (const c of cur.animations) actions[c.name] = mixer.clipAction(c);
    playing = null; if (was) api.play(was, { fade: 0 });
  }
  const show = (name, on) => cur.meshes[name]?.forEach(m => { m.visible = on; });
  const each = (name, f) => cur.meshes[name]?.forEach(f);
  async function wear(o) {
    const my = ++tok;
    outfit = { ...o };
    const sex = item('corpo', o.corpo).tipo || 'm';
    await setBody(sex);
    if (my !== tok) return; // trocaram de novo enquanto carregava
    for (const e of extras.splice(0)) { e.removeFromParent(); e.traverse(x => { x.geometry?.dispose(); x.material?.dispose?.(); }); }
    const hat = item('chapeu', o.chapeu), shirt = item('camisa', o.camisa), back = item('costas', o.costas);
    const skin = item('pele', o.pele).cores[0], hair = item('corCabelo', o.corCabelo).cores[0];
    const pants = item('calca', o.calca).cores[0], shoes = item('tenis', o.tenis).cores[0];
    each('Corpo', m => tintTo(m, skin));
    each('Sobrancelha', m => rampTo(m, hair, 0.1, 0.7));
    const hooded = hat.tipo === 'capuz';
    const want = new Set(HAIR[o.cabelo] || HAIR.topete);
    for (const n of ALL_HAIR) {
      const on = want.has(n) && (!hooded || n === 'Cabelo_Barba');
      show(n, on); if (on) each(n, m => rampTo(m, hair));
    }
    show('Capuz', hooded); if (hooded) each('Capuz', m => rampTo(m, hat.cores[0], 0.25, 0.7));
    const color = (name, base, det) => each(name, m => { m.material.color.set(base); m.material.userData.trim?.value.set(det); });
    color('Camiseta', shirt.cores[0], shirt.cores[1] || shirt.cores[0]);
    color('Calca', pants, pants);
    color('Tenis', shoes, new THREE.Color(shoes).getHSL({}).l > 0.85 ? '#C9C9D3' : '#F4F4F6');
    const f = FIT[sex], skel = cur.meshes.Corpo[0].skeleton;
    let hatHolder = null;
    if (HATS[hat.tipo]) extras.push(hatHolder = attachTo(skel, cur.bones.Head, HATS[hat.tipo](hat.cores || [], hat), f.brow, -0.24));
    for (const n of ALL_HAIR) each(n, m => squashHair(m, hatHolder, { ...HEAD, h: HEAD.h * (HAT_H[hat.tipo] || 1) }));
    if (back.tipo === 'mochila') extras.push(attachTo(skel, cur.bones.spine_03, backpack(back.cores, f), [0, 0, 0]));
    if (back.tipo === 'capa') extras.push(attachTo(skel, cur.bones.spine_03, cape(back.cores, f), [0, 0, 0]));
  }
  const api = {
    model, wear,
    get outfit() { return outfit; },
    get animations() { return cur?.animations || []; },
    get meshes() { return cur?.meshes; }, get bones() { return cur?.bones; },
    // animações: cada corpo tem as suas; quem usa só pede pelo nome
    play(name, { once = false, fade = 0.25 } = {}) {
      const a = actions[name]; if (!a) return null;
      if (playing === a && !once) return a;
      a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = false;
      a.fadeIn(fade).play(); if (playing && playing !== a) playing.fadeOut(fade);
      playing = a; return a;
    },
    update(dt) { mixer?.update(dt); },
    // pose parada de uma animação (fotos)
    pose(name, t) { const a = actions[name]; if (!a) return; mixer.stopAllAction(); a.reset().play(); a.time = t; mixer.update(0); playing = a; },
    set onFinished(f) { onFinished = f; },
  };
  return api;
}

// ---------- vitrine: o boneco numa tela própria (tela de Visual, miniaturas e retrato do HUD) ----------
const FRAMES = {
  full: { fov: 28, pos: [0, 0.6, 3.1], at: [0, 0.5, 0] },
  face: { fov: 20, pos: [0, 0.94, 0.95], at: [0, 0.91, 0] },
  back: { fov: 24, pos: [0, 0.8, 1.6], at: [0, 0.68, 0] },
};
export function stage(canvas, { rotate = true, framing = 'full' } = {}) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(Math.min(2, devicePixelRatio));
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff, 0x8a83c9, 2.0));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(-2, 6, 6); sc.add(sun);
  const back = new THREE.DirectionalLight(0xc9c2ff, 1.2); back.position.set(3, 2, -4); sc.add(back);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
  let b = null, raf = 0, last = performance.now(), yaw = 0.35, dragging = false, px = 0, fr = framing;
  const W0 = canvas.width, H0 = canvas.height; // telas fora da página guardam o tamanho original
  function frame() {
    const w = canvas.clientWidth || W0, h = canvas.clientHeight || H0;
    r.setSize(w, h, false); cam.aspect = w / h;
    const f = FRAMES[fr]; cam.fov = f.fov; cam.position.set(...f.pos); cam.lookAt(...f.at);
    cam.updateProjectionMatrix();
  }
  const ready = createBoneco().then(x => {
    b = x; sc.add(b.model);
    b.onFinished = () => b.play('Idle');
    return b;
  });
  let queue = Promise.resolve();
  function tick() {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (b) { if (rotate && !dragging) yaw += dt * 0.45; b.model.rotation.y = yaw; b.update(dt); }
    r.render(sc, cam);
    raf = requestAnimationFrame(tick);
  }
  canvas.addEventListener('pointerdown', e => { dragging = true; px = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (dragging) { yaw += (e.clientX - px) / 70; px = e.clientX; } });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.style.touchAction = 'pan-y';
  frame();
  const wear = o => (queue = queue.then(() => ready).then(() => b.wear(o)).then(() => { b.play('Idle'); }).catch(e => console.error(e)));
  return {
    ready,
    wear,
    cheer() { b?.play('Cheer', { once: true, fade: 0.15 }); },
    start() { cancelAnimationFrame(raf); last = performance.now(); fr = framing; frame(); tick(); },
    stop() { cancelAnimationFrame(raf); },
    // foto parada (miniaturas e retrato)
    async snap(o, { framing: f = 'face', yaw: y = 0.3 } = {}) {
      await wear(o); fr = f; b.model.rotation.y = y; b.pose('Idle', 0.4); frame(); r.render(sc, cam);
      return canvas.toDataURL('image/png');
    },
  };
}
window.fuilaBoneco = { stage, savedOutfit, OUTFIT_KEY };
window.dispatchEvent(new Event('boneco-ready'));
