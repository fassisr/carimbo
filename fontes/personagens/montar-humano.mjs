// Monta assets/chars/humano-m.glb e humano-f.glb: corpo humano da Quaternius (CC0) com cabelos, capuz,
// roupas geradas a partir do próprio corpo (camiseta, calça, tênis) e as animações básicas.
// As fontes ficam no ramo fontes-personagens (pasta base/ e glb/). Uso:
//   npm i @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 gl-matrix
//   node fontes/personagens/montar-humano.mjs <pasta com Male.glb e Female.glb> <pasta glb do ramo> <saída>
//   depois, para cada arquivo: gltf-transform resize --width 512 --height 512 e gltf-transform webp --quality 88
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, dedup, resample, unpartition, weld } from '@gltf-transform/functions';
import { mat4 } from 'gl-matrix';

const [BASE, GLB, OUT] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const HAIR = `${GLB}/universal-base-characters/Universal Base Characters[Standard]/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)`;
const PARTS = `${GLB}/modular-character-outfits-fantasy/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Modular Parts`;
const ANIM = `${GLB}/universal-animation-library/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb`;
const CLIPS = { Idle_Loop: 'Idle', Walk_Loop: 'Walk', Jog_Fwd_Loop: 'Run', Jump_Start: 'Cheer', Dance_Loop: 'Dance' };

async function build(sex) {
  const doc = await io.read(`${BASE}/${sex === 'm' ? 'Male' : 'Female'}.glb`);
  const R = doc.getRoot(), scene = R.listScenes()[0];
  const arm = scene.listChildren().find(n => n.getName() === 'Armature');
  const bodyNode = arm.listChildren().find(n => n.getMesh() && n.getMesh().listPrimitives()[0].getAttribute('POSITION').getCount() > 5000);
  bodyNode.setName('Corpo'); bodyNode.getMesh().setName('Corpo');
  const skin = bodyNode.getSkin(), joints = skin.listJoints(), J = joints.map(j => j.getName());
  const byName = n => joints[J.indexOf(n)];
  for (const n of arm.listChildren()) if (n.getMesh() && n !== bodyNode) { const nm = /Eyebrows/.test(n.getName()) ? 'Sobrancelha' : 'Olhos'; n.setName(nm); n.getMesh().setName(nm); }

  // ---------- peças de outros arquivos ligadas a este esqueleto ----------
  async function attach(file, name) {
    const src = await io.read(file);
    const map = mergeDocuments(doc, src);
    const sn = src.getRoot().listNodes().find(n => n.getMesh() && n.getSkin());
    const node = map.get(sn), oldSkin = node.getSkin();
    const sk = doc.createSkin(name).setInverseBindMatrices(oldSkin.getInverseBindMatrices()).setSkeleton(byName('root'));
    for (const j of oldSkin.listJoints()) sk.addJoint(byName(j.getName()));
    node.setSkin(sk).setName(name); node.getMesh().setName(name);
    arm.addChild(node);
    for (const s of R.listScenes()) if (s !== scene) s.dispose();
    return node;
  }
  const hairs = { Hair_SimpleParted: 'Cabelo_Repartido', Hair_Long: 'Cabelo_Longo', Hair_Buns: 'Cabelo_Coque', Hair_Beard: 'Cabelo_Barba',
    [sex === 'm' ? 'Hair_Buzzed' : 'Hair_BuzzedFemale']: 'Cabelo_Raspado' };
  for (const [f, n] of Object.entries(hairs)) await attach(`${HAIR}/${f}.glb`, n);
  await attach(`${PARTS}/${sex === 'm' ? 'Male' : 'Female'}_Ranger_Head_Hood.glb`, 'Capuz');

  // ---------- roupas geradas do corpo ----------
  const ibm = skin.getInverseBindMatrices();
  const jp = {}; J.forEach((n, i) => { const m = mat4.invert([], ibm.getElement(i, [])); jp[n] = [m[12], m[13], m[14]]; });
  const prim = bodyNode.getMesh().listPrimitives()[0];
  const A = k => prim.getAttribute(k);
  const P = A('POSITION'), N = A('NORMAL'), JO = A('JOINTS_0'), WE = A('WEIGHTS_0'), UV = A('TEXCOORD_0');
  const nv = P.getCount(), idx = prim.getIndices().getArray();
  const pos = [], nor = [], dom = [], jw = [], ww = [], uv = [];
  for (let i = 0; i < nv; i++) {
    pos.push(P.getElement(i, [])); nor.push(N.getElement(i, [])); uv.push(UV.getElement(i, []));
    const j = JO.getElement(i, []), w = WE.getElement(i, []); jw.push(j); ww.push(w);
    let k = 0; for (let q = 1; q < 4; q++) if (w[q] > w[k]) k = q; dom.push(J[j[k]]);
  }
  // solda vértices repetidos nas costuras de UV
  const key = p => p.map(x => Math.round(x * 1e5)).join(',');
  const wid = [], wpos = [], wmap = new Map();
  for (let i = 0; i < nv; i++) { const k = key(pos[i]); if (!wmap.has(k)) { wmap.set(k, wpos.length); wpos.push(pos[i]); } wid.push(wmap.get(k)); }
  const NW = wpos.length;
  const wnor = Array.from({ length: NW }, () => [0, 0, 0]); for (let i = 0; i < nv; i++) for (let a = 0; a < 3; a++) wnor[wid[i]][a] += nor[i][a];
  wnor.forEach(n => { const l = Math.hypot(...n) || 1; n[0] /= l; n[1] /= l; n[2] /= l; });
  const wdom = []; for (let i = 0; i < nv; i++) wdom[wid[i]] ??= dom[i];
  const tris = []; for (let t = 0; t < idx.length; t += 3) tris.push([idx[t], idx[t + 1], idx[t + 2]]);

  const g = jp; const ax = (v, a, b) => { const d = [0, 1, 2].map(i => jp[b][i] - jp[a][i]), l = Math.hypot(...d); return ((v[0] - jp[a][0]) * d[0] + (v[1] - jp[a][1]) * d[1] + (v[2] - jp[a][2]) * d[2]) / (l * l); };
  const side = v => v[0] >= 0 ? 'l' : 'r';
  // linhas de corte das roupas (no corpo em pose T). O app recorta cada peça nelas pixel a pixel,
  // por isso as malhas vão um pouco além e o corpo só some onde a roupa certamente cobre.
  const CUT = { hem: g.pelvis[1] - 0.015, collar: g.neck_01[1] - 0.012, collarK: 0.55, sleeve: 0.48, cuff: g.foot_l[1] + 0.05, shoe: g.foot_l[1] + 0.075, sole: 0.026,
    sh: jp.upperarm_l, el: jp.lowerarm_l, band: 0.014 };
  const hemY = CUT.hem, waistY = g.spine_01[1] + 0.035;
  const collarY = v => CUT.collar - CUT.collarK * Math.max(0, v[2]) + 0.7 * Math.max(0, Math.hypot(v[0], v[2] + 0.02) - 0.07);
  const inShirt = (w, m) => { const v = wpos[w], d = wdom[w], s = side(v);
    if (/upperarm/.test(d)) return ax(v, 'upperarm_' + s, 'lowerarm_' + s) < CUT.sleeve - m * 4;
    if (v[1] > collarY(v) - m) return false;
    if (/spine|clavicle/.test(d)) return true;
    if (d === 'pelvis' || /thigh/.test(d)) return v[1] > hemY + m;
    return false; };
  const inPants = (w, m) => { const v = wpos[w], d = wdom[w];
    if (d === 'pelvis' || /thigh/.test(d)) return true;
    if (/calf/.test(d)) return v[1] > CUT.cuff + m;
    if (d === 'spine_01') return v[1] < waistY;
    return false; };
  const inShoes = (w, m) => { const v = wpos[w], d = wdom[w]; return /foot|ball/.test(d) || (/calf/.test(d) && v[1] < CUT.shoe - m); };

  const nbr = Array.from({ length: NW }, () => new Set());
  for (const t of tris) { const a = wid[t[0]], b = wid[t[1]], c = wid[t[2]]; nbr[a].add(b).add(c); nbr[b].add(a).add(c); nbr[c].add(a).add(b); }
  const regionTris = set => tris.filter(t => t.every(i => set.has(wid[i])));
  const grow = (set, n) => { let s = new Set(set); for (let k = 0; k < n; k++) { const s2 = new Set(s); for (const w of s) for (const x of nbr[w]) s2.add(x); s = s2; } return s; };
  const shrink = (set, n) => { let s = new Set(set); for (let k = 0; k < n; k++) s = new Set([...s].filter(w => [...nbr[w]].every(x => s.has(x)))); return s; };
  const setOf = f => new Set([...Array(NW).keys()].filter(f));
  const S = { shirt: setOf(w => inShirt(w, -0.03)), pants: setOf(w => inPants(w, -0.03)), shoes: setOf(w => inShoes(w, -0.03)) };

  function shell(name, region, { off, smooth = 12, rim = false, trim, sole, drape, hem, flat, extras }) {
    const T = regionTris(region);
    const used = [...new Set(T.flatMap(t => t.map(i => wid[i])))];
    const local = new Map(used.map((w, i) => [w, i]));
    const nb = used.map(w => [...nbr[w]].filter(x => local.has(x)).map(x => local.get(x)));
    const o = used.map(w => typeof off === 'function' ? off(wpos[w]) : off);
    let p = used.map((w, i) => wpos[w].map((x, a) => x + wnor[w][a] * o[i]));
    const TL = T.map(t => t.map(i => local.get(wid[i])));
    // borda: arestas que pertencem a um só triângulo, juntadas em laços
    const ec = new Map(); const ek = (a, b) => a < b ? a + '_' + b : b + '_' + a;
    for (const [a, b, c] of TL) for (const [x, y] of [[a, b], [b, c], [c, a]]) { const k = ek(x, y); ec.set(k, (ec.get(k) || 0) + 1); }
    const bedges = []; for (const [a, b, c] of TL) for (const [x, y] of [[a, b], [b, c], [c, a]]) if (ec.get(ek(x, y)) === 1) bedges.push([x, y]);
    const loops = []; { const nextOf = new Map(bedges.map(([x, y]) => [x, y])); const seen = new Set();
      for (const [x] of bedges) { if (seen.has(x)) continue; const L = []; let c = x; while (c != null && !seen.has(c)) { seen.add(c); L.push(c); c = nextOf.get(c); } loops.push(L); } }
    // Taubin: alisa sem encolher
    const step = (q, f) => q.map((v, i) => { if (!nb[i].length) return v; const m = [0, 0, 0]; for (const j of nb[i]) for (let a = 0; a < 3; a++) m[a] += q[j][a]; return v.map((x, a) => x + f * (m[a] / nb[i].length - x)); });
    for (let k = 0; k < smooth; k++) { p = step(p, 0.5); p = step(p, -0.53); }
    // o tecido cai reto do ponto mais alto da frente (peito) em vez de colar na barriga
    if (drape) p = p.map((v, i) => {
      if (wnor[used[i]][2] < 0.2) return v;
      let z = v[2];
      for (const q of p) { const dy = q[1] - v[1]; if (dy > 0 && dy < drape && Math.abs(q[0] - v[0]) < 0.025 && q[2] > 0) z = Math.max(z, q[2] - 0.12 * dy); }
      return [v[0], v[1], z];
    });
    // nada fica para dentro do corpo
    p = p.map((v, i) => { const w = used[i], n = wnor[w], d = [0, 1, 2].reduce((s, a) => s + (v[a] - wpos[w][a]) * n[a], 0), min = o[i] * 0.6; return d < min ? v.map((x, a) => x + n[a] * (min - d)) : v; });
    // bordas retas: alisa cada laço ao longo dele mesmo; a barra fica numa altura só
    const hemLoop = hem ? loops.reduce((lo, L) => (!lo || L.reduce((s, v) => s + p[v][1], 0) / L.length < lo.reduce((s, v) => s + p[v][1], 0) / lo.length ? L : lo), null) : null;
    for (const L of loops) {
      for (let k = 0; k < 25; k++) { const q = L.map(v => p[v].slice()); L.forEach((v, j) => { const a = q[(j + L.length - 1) % L.length], b = q[(j + 1) % L.length]; p[v] = p[v].map((x, t) => x + 0.5 * ((a[t] + b[t]) / 2 - x)); }); }
      if (L === hemLoop) { const y = L.reduce((s, v) => s + p[v][1], 0) / L.length; for (const v of L) p[v] = [p[v][0], y, p[v][2]]; }
    }
    if (flat) p = p.map(v => v[1] < 0.012 ? [v[0], -0.004, v[2]] : v);
    // sombra nas dobras: compara com uma versão bem alisada
    let pa = p; for (let k = 0; k < 6; k++) pa = step(pa, 0.6);
    // normais
    const nn = used.map(() => [0, 0, 0]);
    for (const [a, b, c] of TL) { const e1 = p[b].map((x, k) => x - p[a][k]), e2 = p[c].map((x, k) => x - p[a][k]); const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; for (const v of [a, b, c]) for (let k = 0; k < 3; k++) nn[v][k] += n[k]; }
    nn.forEach(n => { const l = Math.hypot(...n) || 1; n[0] /= l; n[1] /= l; n[2] /= l; });
    const ao = p.map((v, i) => { const d = [0, 1, 2].reduce((s, a) => s + (pa[i][a] - v[a]) * nn[i][a], 0); return Math.max(0.55, Math.min(1, 1 - d * 25)); });
    // um vértice por vértice soldado, pesos copiados do corpo
    const first = new Map(); for (let i = 0; i < nv; i++) if (local.has(wid[i]) && !first.has(wid[i])) first.set(wid[i], i);
    const VP = [], VN = [], VJ = [], VW = [], VC = [];
    used.forEach((w, i) => { const s = first.get(w); VP.push(...p[i]); VN.push(...nn[i]); VJ.push(...jw[s]); VW.push(...ww[s]); const c = Math.round(ao[i] * 255); VC.push(c, c, c, 255); });
    // faixa de outra cor (gola e mangas, sola do tênis): peso por vértice, a cor é escolhida no app
    const tw = used.map(() => 0);
    const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    if (trim) {
      const pts = loops.filter(L => trim(L.map(i => p[i]))).flat().map(v => p[v]);
      p.forEach((v, i) => { let d = 9; for (const q of pts) d = Math.min(d, Math.hypot(v[0] - q[0], v[1] - q[1], v[2] - q[2])); tw[i] = 1 - ss(trim.band - 0.005, trim.band + 0.005, d); });
    }
    if (sole) used.forEach((w, i) => { tw[i] = 1 - ss(sole - 0.003, sole + 0.003, wpos[w][1]); });
    const VT = [...tw];
    const tri = [...TL.flat()];
    // aba para dentro na borda (dá espessura ao tecido)
    if (rim) {
      for (const [x, y] of bedges) {
        const mk = v => { const w = used[v]; VP.push(...p[v].map((q, a) => q - nn[v][a] * 0.007)); VN.push(...nn[v].map(q => -q * 0.3)); const s = first.get(w); VJ.push(...jw[s]); VW.push(...ww[s]); VC.push(110, 110, 110, 255); VT.push(tw[v]); return VP.length / 3 - 1; };
        const xi = mk(x), yi = mk(y);
        tri.push(y, x, xi, y, xi, yi);
      }
    }
    const acc = (type, arr, C) => doc.createAccessor().setType(type).setArray(new C(arr));
    const mesh = doc.createMesh(name);
    const attrs = { POSITION: acc('VEC3', VP, Float32Array), NORMAL: acc('VEC3', VN, Float32Array), JOINTS_0: acc('VEC4', VJ, Uint8Array), WEIGHTS_0: acc('VEC4', VW, Float32Array), COLOR_0: acc('VEC4', VC, Uint8Array).setNormalized(true) };
    const pr = doc.createPrimitive().setIndices(acc('SCALAR', tri, Uint32Array)).setMaterial(doc.createMaterial(name).setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.92).setMetallicFactor(0).setDoubleSided(true));
    for (const [a, v] of Object.entries(attrs)) pr.setAttribute(a, v);
    mesh.addPrimitive(pr);
    arm.addChild(doc.createNode(name).setMesh(mesh).setSkin(skin).setExtras({ corte: extras || {} }));
    console.log(sex, name, used.length, 'vértices', loops.length, 'bordas');
  }
  const flareY = 0.36;
  shell('Camiseta', grow(S.shirt, 1), { off: v => 0.016 + Math.max(0, hemY + 0.1 - v[1]) * 0.06, smooth: 16, drape: 0.25, extras: { hem: CUT.hem, collar: CUT.collar, collarK: CUT.collarK, sleeve: CUT.sleeve, sh: CUT.sh, el: CUT.el, band: CUT.band } });
  shell('Calca', grow(S.pants, 1), { off: v => v[1] > hemY + 0.02 ? 0.006 : 0.014 + Math.max(0, flareY - v[1]) * 0.05, smooth: 16, extras: { cuff: CUT.cuff } });
  shell('Tenis', grow(S.shoes, 1), { off: v => 0.012 + Math.max(0, 0.04 - v[1]) * 0.15, smooth: 18, flat: true, extras: { sole: CUT.sole, top: CUT.shoe } });
  // o corpo embaixo das roupas sai (economiza e evita pele atravessando o tecido)
  const hidden = setOf(w => inShirt(w, 0.012) || inPants(w, 0.012) || inShoes(w, 0.012));
  const keep = tris.filter(t => !t.every(i => hidden.has(wid[i]))).flat();
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(keep)));

  // ---------- animações ----------
  const an = await io.read(ANIM);
  const amap = mergeDocuments(doc, an);
  for (const s of R.listScenes()) if (s !== scene) s.dispose();
  const animNodes = an.getRoot().listNodes().map(n => amap.get(n));
  for (const a of R.listAnimations()) {
    if (!CLIPS[a.getName()]) { for (const x of [...a.listChannels(), ...a.listSamplers()]) x.dispose(); a.dispose(); continue; }
    a.setName(CLIPS[a.getName()]);
    for (const c of a.listChannels()) {
      const t = c.getTargetNode(), path = c.getTargetPath(), n = t?.getName();
      // só rotações (e a altura do quadril): cada corpo mantém o tamanho dos próprios ossos
      if (!J.includes(n) || path === 'scale' || (path === 'translation' && n !== 'pelvis')) { c.getSampler().dispose(); c.dispose(); continue; }
      c.setTargetNode(byName(n));
    }
  }
  for (const n of animNodes) n?.dispose();
  // limpa: atributos que o app não usa, mapas de rugosidade, sobras dos arquivos juntados
  for (const m of R.listMeshes()) for (const p of m.listPrimitives()) for (const s of p.listSemantics()) if (/COLOR_[12]|TEXCOORD_1/.test(s) || (s === 'COLOR_0' && !/Camiseta|Calca|Tenis/.test(m.getName()))) p.setAttribute(s, null);
  for (const m of R.listMaterials()) { m.setMetallicRoughnessTexture(null); m.setMetallicFactor(0); if (!/Camiseta|Calca|Tenis/.test(m.getName())) m.setRoughnessFactor(0.8); }
  await doc.transform(resample(), dedup(), prune());
  // dados de animação que ninguém usa mais (o prune não pega os que sobraram das animações descartadas)
  for (const a of R.listAccessors()) if (doc.getGraph().listParents(a).every(p => p.propertyType === 'Root' || (p.propertyType === 'AnimationSampler' && !doc.getGraph().listParents(p).some(q => q.propertyType === 'Animation')))) a.dispose();
  await doc.transform(unpartition());
  await io.write(`${OUT}/humano-${sex}.glb`, doc);
  console.log(sex, 'ok', R.listMeshes().map(m => m.getName()).join(', '), R.listAnimations().map(a => a.getName()).join(', '));
}
await build('m');
await build('f');
