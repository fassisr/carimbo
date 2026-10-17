// Lê destaques-fonte.json, acha a posição de cada lugar no OpenStreetMap (Nominatim)
// e grava destaques.json, que o app baixa ao abrir. Roda no GitHub Actions.
import { readFile, writeFile } from 'node:fs/promises';

const V = 3; // mude para refazer todas as posições
const UA = 'Fuila/0.4 (+https://github.com/fassisr/carimbo)';
import { readdir } from 'node:fs/promises';
const src = JSON.parse(await readFile('destaques-fonte.json', 'utf8'));
// listas extras: qualquer arquivo .json dentro da pasta lugares/ (uma lista de lugares no mesmo formato)
try {
  for (const f of (await readdir('lugares')).filter(f => f.endsWith('.json')).sort()) {
    try {
      const j = JSON.parse(await readFile('lugares/' + f, 'utf8'));
      const list = Array.isArray(j) ? j : j.lugares || [];
      src.lugares.push(...list.filter(p => p && p.n && p.cat && p.cidade));
      console.log(`lugares/${f}: ${list.length} lugares`);
    } catch (e) { console.log(`lugares/${f}: JSON inválido, ignorado (${e.message})`); }
  }
} catch {}
// sem repetidos (mesmo nome na mesma cidade)
{ const seen = new Set(), nk = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); src.lugares = src.lugares.filter(p => { const k = nk(`${p.n}|${p.cidade}`); if (seen.has(k)) return false; seen.add(k); return true; }); }
let old = {};
try { for (const p of JSON.parse(await readFile('destaques.json', 'utf8')).lugares) old[p.chave] = p; } catch {}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'the', 'bar', 'cafe', 'rua', 'praia', 'parque', 'museu']);
const tokens = s => norm(s).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));
const AREA = new Set(['suburb', 'neighbourhood', 'city_district', 'city', 'town', 'municipality', 'quarter', 'state', 'county', 'region', 'postcode']);

async function search(q) {
  await sleep(1100); // limite de 1 pedido por segundo do Nominatim
  const u = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=10&countrycodes=br&q=' + encodeURIComponent(q);
  const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' } });
  return r.ok ? r.json() : [];
}
// Photon (komoot), outro buscador sobre os mesmos dados do OpenStreetMap; acha nomes que o Nominatim não acha
async function photon(q) {
  await sleep(1100);
  try {
    const r = await fetch('https://photon.komoot.io/api/?limit=10&q=' + encodeURIComponent(q), { headers: { 'User-Agent': UA } });
    if (!r.ok) return [];
    return (await r.json()).features.filter(f => f.properties.countrycode === 'BR').map(f => ({
      name: f.properties.name || '', display_name: [f.properties.name, f.properties.street, f.properties.city, f.properties.state].filter(Boolean).join(', '),
      lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], addresstype: f.properties.type === 'house' ? 'amenity' : f.properties.type,
      address: { road: f.properties.street, house_number: f.properties.housenumber, city: f.properties.city || f.properties.county, state: f.properties.state } }));
  } catch { return []; }
}
const UFS = { RJ: 'rio de janeiro', ES: 'espirito santo', SP: 'sao paulo', MG: 'minas gerais' };
// o resultado precisa estar na cidade (ou ao menos no estado) certo
function inPlace(r, p) {
  const all = norm(r.display_name + ' ' + Object.values(r.address || {}).join(' '));
  if (UFS[p.uf] && !all.includes(UFS[p.uf])) return false;
  return !p.cidade || all.includes(norm(p.cidade));
}
// aceita só resultados que são o próprio lugar (nome bate) ou um endereço com número;
// entre vários com o mesmo nome (redes), fica com o da rua informada
function pick(results, p) {
  const want = tokens(p.n), names = (p.busca || []).map(tokens);
  const street = tokens((p.end || '').split(',')[0]);
  const ok = results.filter(r => inPlace(r, p));
  const named = ok.filter(r => {
    if (AREA.has(r.addresstype)) return false;
    const name = tokens(r.name || r.display_name.split(',')[0]);
    return [want, ...names].some(w => w.length && w.filter(x => name.includes(x)).length / w.length >= 0.5);
  });
  const onStreet = r => street.length && street.some(w => tokens(r.address?.road || '').includes(w));
  if (named.length) return { r: named.find(onStreet) || named[0], how: 'lugar' };
  for (const r of ok) if (r.address?.house_number && onStreet(r)) return { r, how: 'endereço' };
  return null;
}

const out = [], fails = [];
for (const p of src.lugares) {
  const chave = norm(`${p.n}|${p.cidade}`);
  if (p.lat != null && p.lng != null) { out.push({ ...p, chave, geo: 'manual', v: V }); continue; }
  const o = old[chave];
  if (o && o.v === V && o.end === p.end && o.n === p.n && o.geo !== 'manual') { out.push({ ...o, ...p, chave }); continue; }
  const uf = p.uf ? `, ${p.uf}` : '';
  let found = null;
  const names = [p.n, ...(p.busca || [])];
  const tries = [
    ...names.map(n => () => search(`${n}, ${p.cidade}${uf}`)),
    () => search(`${p.n}, ${p.end}, ${p.cidade}${uf}`),
    ...names.map(n => () => photon(`${n} ${p.cidade}`)),
    () => search(`${p.end}, ${p.cidade}${uf}`),
  ];
  for (const t of tries) { found = pick(await t(), p); if (found) break; }
  if (!found) { fails.push(`${p.n} (${p.cidade})`); continue; }
  out.push({ ...p, chave, v: V, lat: +(+found.r.lat).toFixed(6), lng: +(+found.r.lon).toFixed(6), geo: found.how });
  console.log(`ok  ${p.n} (${p.cidade}) -> ${found.how}: ${found.r.display_name.slice(0, 90)}`);
}
out.forEach((p, i) => { p.id = 'd-' + p.chave.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); });
await writeFile('destaques.json', JSON.stringify({ atualizado: new Date().toISOString().slice(0, 10), lugares: out }, null, 1) + '\n');
console.log(`\n${out.length} lugares com posição; ${fails.length} sem posição encontrada:`);
for (const f of fails) console.log('  -', f);
