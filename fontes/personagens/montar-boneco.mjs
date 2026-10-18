// Monta assets/chars/boneco.glb: um esqueleto (do Rogue KayKit) com todas as peças trocáveis
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, dedup, resample } from '@gltf-transform/functions';
// uso: npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions && node fontes/personagens/montar-boneco.mjs
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const C = new URL('./', import.meta.url).pathname, OUT = new URL('../../assets/chars/boneco.glb', import.meta.url).pathname;
const doc = await io.read(C + 'rogue.glb');
const R = doc.getRoot();
const base = { scene: R.listScenes()[0], skin: R.listNodes().find(n => n.getName() === 'Rogue_Body').getSkin(), rig: R.listNodes().find(n => n.getName() === 'Rig') };
const bone = name => R.listNodes().find(n => n.getName() === name && base.skin.listJoints().includes(n));
R.listMaterials()[0].setName('m_rogue');
const KEEP = JSON.parse(process.env.KEEP || '{"mage":["Mage_Head","Mage_Hat"],"knight":["Knight_Head","Knight_Helmet"],"barbarian":["Barbarian_Head","Barbarian_Hat"],"rogue_hooded":["Rogue_Head_Hooded"]}');
for (const [c, names] of Object.entries(KEEP)) {
  const src = await io.read(C + c + '.glb');
  src.getRoot().listMaterials().forEach(m => m.setName('m_' + c));
  const before = new Set(R.listNodes());
  const sceneBefore = new Set(R.listScenes());
  mergeDocuments(doc, src);
  const added = R.listNodes().filter(n => !before.has(n));
  for (const n of added) {
    if (!names.includes(n.getName())) continue;
    const parent = added.find(p => p.listChildren().includes(n));
    parent?.removeChild(n);
    if (n.getSkin()) { const sk = n.getSkin(); const js = sk.listJoints(); js.forEach(j => sk.removeJoint(j)); js.forEach(j => sk.addJoint(bone(j.getName()))); base.rig.addChild(n); }
    else bone(parent.getName()).addChild(n);
  }
  for (const s of R.listScenes()) if (!sceneBefore.has(s)) s.dispose();
  for (const a of R.listAnimations().slice(6)) a.dispose();
  for (const n of added) if (!names.includes(n.getName())) n.dispose();
}
// buffers num só
const buf = R.listBuffers()[0];
for (const b of R.listBuffers().slice(1)) { for (const a of R.listAccessors()) if (a.getBuffer() === b) a.setBuffer(buf); b.dispose(); }
await doc.transform(resample(), prune(), dedup());
await io.write(OUT, doc);
console.log('ok', R.listNodes().filter(n => n.getMesh()).map(n => n.getName()), R.listMaterials().map(m => m.getName()), R.listAnimations().length, R.listSkins().length);
