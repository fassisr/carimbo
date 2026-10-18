// Escolhe os Destaques Fuilá pela nota do Google: só fica dourado quem tem nota alta e muitas avaliações.
// Roda uma vez por mês no GitHub Actions com a chave GOOGLE_MAPS_KEY (Places API New).
// Pelas regras do Google a nota não é guardada nem mostrada: gravamos só a lista de escolhidos (destaques-top.json).
import { readFile, writeFile } from 'node:fs/promises';

const KEY = process.env.GOOGLE_MAPS_KEY;
const MIN_NOTA = +(process.env.MIN_NOTA || 4.5);
const MIN_AVALIACOES = +(process.env.MIN_AVALIACOES || 200);
if (!KEY) { console.log('Sem GOOGLE_MAPS_KEY: nada a fazer.'); process.exit(0); }

const { lugares } = JSON.parse(await readFile('destaques.json', 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const meters = (a, b) => {
  const r = x => x * Math.PI / 180, dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

const chaves = [], semNota = [];
let erros = 0;
for (const p of lugares) {
  await sleep(120);
  try {
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.location' },
      body: JSON.stringify({ textQuery: `${p.n}, ${p.cidade}`, languageCode: 'pt-BR', maxResultCount: 1,
        locationBias: { circle: { center: { latitude: p.lat, longitude: p.lng }, radius: 800 } } }),
    });
    if (!r.ok) { erros++; console.log(`erro ${r.status} em ${p.n}: ${(await r.text()).slice(0, 200)}`); if (r.status === 403 || r.status === 401) break; continue; }
    const g = (await r.json()).places?.[0];
    if (!g || !g.location || meters(p, { lat: g.location.latitude, lng: g.location.longitude }) > 1500) { semNota.push(p.n); continue; }
    const ok = (g.rating || 0) >= MIN_NOTA && (g.userRatingCount || 0) >= MIN_AVALIACOES;
    if (ok) chaves.push(p.chave);
    console.log(`${ok ? 'DESTAQUE' : '        '} ${p.n} (${p.cidade})`);
  } catch (e) { erros++; console.log(`falhou ${p.n}: ${e.message}`); }
}
if (erros > lugares.length / 3) { console.log('Muitos erros; mantenho a lista anterior.'); process.exit(1); }
await writeFile('destaques-top.json', JSON.stringify({
  _comentario: 'Lugares que aparecem como Destaque Fuilá (dourados). Gerado pela nota do Google; os outros continuam no mapa como paradas comuns.',
  fonte: 'google', atualizado: new Date().toISOString().slice(0, 10), criterio: `nota >= ${MIN_NOTA} e >= ${MIN_AVALIACOES} avaliações`, chaves,
}, null, 1) + '\n');
console.log(`\n${chaves.length} destaques de ${lugares.length}; ${semNota.length} não achados no Google.`);
