// Busca uma foto livre (Wikimedia Commons, via Wikipédia) para cada destaque e grava fotos.json.
// Só aceita quando o título do artigo bate com o nome do lugar e o artigo fica perto dele.
// Uso: node scripts/fotos.mjs   (roda no GitHub Actions; respeita o limite da API com ~1 pedido/s)
import { readFileSync, writeFileSync, existsSync } from 'fs';

const UA = 'FuilaBot/1.0 (https://github.com/fassisr/carimbo)';
const API = 'https://pt.wikipedia.org/w/api.php';
const dest = JSON.parse(readFileSync('destaques.json', 'utf8')).lugares || [];
const OUT = 'fotos.json';
const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { fotos: {}, sem: {} };
const fotos = prev.fotos || {}, sem = prev.sem || {};
const REFAZ = 1000 * 60 * 60 * 24 * 90; // tenta de novo os sem foto a cada 90 dias

const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'the', 'rio', 'sao', 'paulo', 'janeiro', 'belo', 'horizonte', 'vitoria', 'brasil']);
const toks = s => norm(s).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));
function bate(nome, titulo) {
  const a = toks(nome), b = new Set(toks(titulo.replace(/\s*\(.*\)$/, '')));
  if (!a.length) return false;
  const hit = a.filter(w => b.has(w)).length;
  // nos dois sentidos: "Bar Urca" não pode virar o artigo do bairro "Urca"
  return hit / a.length >= 0.6 && hit / Math.max(1, b.size) >= 0.5 && hit >= Math.min(2, a.length);
}
async function api(params) {
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(API + '?' + new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params }), { headers: { 'User-Agent': UA } });
      if (r.status === 429) { await sleep(5000 * (t + 1)); continue; }
      if (r.ok) return await r.json();
    } catch (e) {}
    await sleep(2000 * (t + 1));
  }
  return null;
}
const meters = (a, b) => { const R = Math.PI / 180, x = (b.lng - a.lng) * R * Math.cos((a.lat + b.lat) / 2 * R), y = (b.lat - a.lat) * R; return Math.hypot(x, y) * 6371000; };

async function acha(p) {
  // 1) artigos marcados perto do lugar
  const geo = await api({ action: 'query', list: 'geosearch', gscoord: `${p.lat}|${p.lng}`, gsradius: '600', gslimit: '30' });
  let page = (geo?.query?.geosearch || []).find(g => bate(p.n, g.title));
  // 2) busca por nome + cidade, conferindo a posição quando o artigo tem coordenada
  if (!page) {
    await sleep(800);
    const s = await api({ action: 'query', generator: 'search', gsrsearch: `${p.n} ${p.cidade || ''}`, gsrlimit: '5', prop: 'coordinates' });
    page = (s?.query?.pages || []).sort((a, b) => a.index - b.index)
      .find(g => bate(p.n, g.title) && (!g.coordinates || meters(p, { lat: g.coordinates[0].lat, lng: g.coordinates[0].lon }) < 3000));
  }
  if (!page) return null;
  await sleep(800);
  const im = await api({ action: 'query', titles: page.title, prop: 'pageimages', piprop: 'thumbnail|name', pithumbsize: '800', pilicense: 'free' });
  const pg = im?.query?.pages?.[0];
  if (!pg?.thumbnail?.source || !pg.pageimage) return null;
  return { url: pg.thumbnail.source, arquivo: pg.pageimage, artigo: pg.title };
}

let novos = 0, vistos = 0;
const save = () => writeFileSync(OUT, JSON.stringify({ gerado: new Date().toISOString(), fonte: 'Wikimedia Commons via pt.wikipedia.org', fotos, sem }, null, 0) + '\n');
for (const p of dest) {
  if (!p.id || p.lat == null || fotos[p.id]) continue;
  if (sem[p.id] && Date.now() - sem[p.id] < REFAZ) continue;
  vistos++;
  const f = await acha(p);
  if (f) { fotos[p.id] = f; delete sem[p.id]; novos++; console.log('foto', p.n, '→', f.artigo); }
  else sem[p.id] = Date.now();
  if (vistos % 25 === 0) save();
  await sleep(800);
}
// tira fotos de lugares que saíram da lista
const ids = new Set(dest.map(p => p.id));
for (const id of Object.keys(fotos)) if (!ids.has(id)) delete fotos[id];
save();
console.log(`${novos} fotos novas, ${Object.keys(fotos).length} no total, ${vistos} lugares consultados`);
