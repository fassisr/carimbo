// Lê destaques-fonte.json, acha a posição de cada lugar no OpenStreetMap (Nominatim)
// e grava destaques.json, que o app baixa ao abrir. Roda no GitHub Actions.
import { readFile, writeFile } from 'node:fs/promises';

const UA = 'Fuila/0.3 (+https://github.com/fassisr/carimbo)';
const src = JSON.parse(await readFile('destaques-fonte.json', 'utf8'));
let old = {};
try { for (const p of JSON.parse(await readFile('destaques.json', 'utf8')).lugares) old[p.chave] = p; } catch {}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'the', 'bar', 'cafe', 'rua', 'praia', 'parque', 'museu']);
const tokens = s => norm(s).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));
const AREA = new Set(['suburb', 'neighbourhood', 'city_district', 'city', 'town', 'municipality', 'quarter', 'state', 'county', 'region', 'postcode']);

async function search(q) {
  await sleep(1100); // limite de 1 pedido por segundo do Nominatim
  const u = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=br&q=' + encodeURIComponent(q);
  const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' } });
  return r.ok ? r.json() : [];
}
// aceita só resultados que são o próprio lugar (nome bate) ou um endereço com número
function pick(results, p) {
  const want = tokens(p.n);
  for (const r of results) {
    const name = tokens(r.name || r.display_name.split(',')[0]);
    const hit = want.length ? want.filter(w => name.includes(w)).length / want.length : 0;
    if (hit >= 0.5 && !AREA.has(r.addresstype)) return { r, how: 'lugar' };
  }
  for (const r of results) if (r.address?.house_number) return { r, how: 'endereço' };
  return null;
}

const out = [], fails = [];
for (const p of src.lugares) {
  const chave = norm(`${p.n}|${p.cidade}`);
  if (old[chave] && old[chave].end === p.end && old[chave].n === p.n) { out.push({ ...old[chave], ...p, chave }); continue; }
  const uf = p.uf ? `, ${p.uf}` : '';
  let found = null;
  for (const q of [`${p.n}, ${p.cidade}${uf}`, `${p.n}, ${p.end}, ${p.cidade}${uf}`, `${p.end}, ${p.cidade}${uf}`]) {
    found = pick(await search(q), p);
    if (found) break;
  }
  if (!found) { fails.push(`${p.n} (${p.cidade})`); continue; }
  out.push({ ...p, chave, lat: +(+found.r.lat).toFixed(6), lng: +(+found.r.lon).toFixed(6), geo: found.how });
  console.log(`ok  ${p.n} (${p.cidade}) -> ${found.how}: ${found.r.display_name.slice(0, 90)}`);
}
out.forEach((p, i) => { p.id = 'd-' + p.chave.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); });
await writeFile('destaques.json', JSON.stringify({ atualizado: new Date().toISOString().slice(0, 10), lugares: out }, null, 1) + '\n');
console.log(`\n${out.length} lugares com posição; ${fails.length} sem posição encontrada:`);
for (const f of fails) console.log('  -', f);
