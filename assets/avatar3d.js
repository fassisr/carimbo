// Personagem 3D do jogador, desenhado dentro do mapa (camada customizada do MapLibre com three.js).
// Boneco humano com itens trocáveis (assets/boneco.js), corpos e animações da Quaternius (CC0).
import * as THREE from 'three';
import { createBoneco, savedOutfit } from './boneco.js';

const CLIPS = { idle: 'Idle', walk: 'Walk', run: 'Run', cheer: 'Cheer' };
const SIZE = 24;         // altura do personagem em metros no zoom 18 (exagerado, como nos jogos)

function waitFor(fn) {
  return new Promise(res => { const t = () => { const v = fn(); v ? res(v) : setTimeout(t, 50); }; t(); });
}

const map = await waitFor(() => window.fuilaMap);
if (!map.isStyleLoaded()) await new Promise(r => map.once('load', r));

const st = { lat: null, lng: null, yaw: Math.PI, targetYaw: Math.PI, motion: 'idle', cheering: false };
const scene = new THREE.Scene();
const camera = new THREE.Camera();
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a83c9, 2.4));
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(-3, 8, 4);
scene.add(sun);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 40), new THREE.MeshBasicMaterial({ color: 0x14112b, transparent: true, opacity: 0.3, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.005;
scene.add(shadow);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.4, 48), new THREE.MeshBasicMaterial({ color: 0xffc21a, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.006;
scene.add(ring);
const holder = new THREE.Group();
scene.add(holder);

let boneco = null;

function applyMotion() { if (!st.cheering) boneco?.play(CLIPS[st.motion] || 'Idle'); }

async function loadBoneco() {
  boneco = await createBoneco();
  await boneco.wear(savedOutfit());
  holder.add(boneco.model);
  boneco.onFinished = () => { st.cheering = false; applyMotion(); };
  applyMotion();
  map.triggerRepaint();
}

let renderer = null, last = performance.now();
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
map.addLayer({
  id: 'avatar3d', type: 'custom', renderingMode: '3d',
  onAdd(m, gl) {
    renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
    renderer.autoClear = false;
  },
  render(gl, matrix) {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (st.lat == null) return;
    boneco?.update(dt);
    // gira suavemente até a direção em que está andando
    let d = st.targetYaw - st.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    st.yaw += d * Math.min(1, dt * 8);
    const pulse = 1 + 0.08 * Math.sin(now / 300);
    ring.scale.setScalar(pulse);
    const merc = maplibregl.MercatorCoordinate.fromLngLat([st.lng, st.lat], 0);
    const metres = SIZE * Math.pow(2, Math.max(-1.5, Math.min(2.5, 18 - map.getZoom())));
    const s = merc.meterInMercatorCoordinateUnits() * metres;
    holder.rotation.y = st.yaw;
    const l = new THREE.Matrix4().makeTranslation(merc.x, merc.y, merc.z)
      .scale(new THREE.Vector3(s, -s, s))
      .multiply(new THREE.Matrix4().makeRotationAxis(X, Math.PI / 2));
    camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix).multiply(l);
    renderer.resetState();
    renderer.render(scene, camera);
    // com uma tela aberta por cima, o mapa não precisa ficar se redesenhando
    if (!window.fuilaPaused) map.triggerRepaint();
  },
});

window.avatar3d = {
  setPos(lat, lng) { st.lat = lat; st.lng = lng; map.triggerRepaint(); },
  // rumo em graus, 0 = norte, sentido horário
  setHeading(deg) { st.targetYaw = Math.PI - deg * Math.PI / 180; },
  setMotion(m) { if (m !== st.motion) { st.motion = m; applyMotion(); } },
  cheer() {
    if (!boneco) return;
    st.cheering = true; boneco.play(CLIPS.cheer, { once: true, fade: 0.15 });
  },
  wear(o) { boneco?.wear(o).then(() => { applyMotion(); map.triggerRepaint(); }); },
  resume() { map.triggerRepaint(); },
};

await loadBoneco();
window.dispatchEvent(new Event('avatar3d-ready'));
