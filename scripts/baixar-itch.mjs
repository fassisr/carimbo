// Baixa os pacotes gratuitos (CC0) da Quaternius no itch.io. Roda no GitHub Actions.
// Uso: node scripts/baixar-itch.mjs <slug> [<slug>...]  → salva zips em ./itch/<slug>/
import { mkdirSync, writeFileSync } from 'fs';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
let cookies = {};
const cookieHdr = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
async function req(url, opt = {}) {
  const r = await fetch(url, { redirect: 'manual', ...opt, headers: { 'User-Agent': UA, Cookie: cookieHdr(), ...(opt.headers || {}) } });
  for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); cookies[kv.slice(0, i)] = kv.slice(i + 1); }
  return r;
}
{ const b = await (await fetch('https://static.itch.io/bundle.min.js', { headers: { 'User-Agent': UA } })).text();
  for (const m of b.matchAll(/\/file\//g)) console.log('bundle', b.slice(m.index - 700, m.index + 500).replace(/\s+/g, ' '));
  const g = b.indexOf('GameDownload'); console.log('bundleGD', b.slice(g, g + 2500).replace(/\s+/g, ' ')); }
for (const slug of process.argv.slice(2)) try {
  const base = `https://quaternius.itch.io/${slug}`;
  const page = await (await req(base)).text();
  const csrf = page.match(/name="csrf_token" value="([^"]+)"/)?.[1];
  console.log(slug, 'csrf', !!csrf);
  const du = await (await req(base + '/download_url', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }, body: new URLSearchParams({ csrf_token: csrf }) })).json();
  console.log('download page', du.url);
  const key = du.url.match(/download\/([^/?]+)/)?.[1];
  const dl = await (await req(du.url)).text();
  const ups = [];
  for (const m of dl.matchAll(/data-upload_id="(\d+)"/g)) {
    const seg = dl.slice(m.index, m.index + 1500);
    const name = seg.match(/class="name"[^>]*title="([^"]+)"/)?.[1] || seg.match(/<strong class="name"[^>]*>([^<]+)/)?.[1] || ('arquivo-' + m[1]);
    const size = seg.match(/class="file_size"[^>]*>(?:<span>)?([^<]+)/)?.[1] || '';
    if (!ups.some(u => u.id === m[1])) ups.push({ id: m[1], name, size });
  }
  const i1 = dl.indexOf('data-upload_id'); console.log('botao', dl.slice(i1 - 600, i1 + 600).replace(/\s+/g, ' '));
  for (const m of dl.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) { const t = m[1]; for (const w of ['GameDownload', 'UploadList', 'download_key', 'key']) { const i = t.indexOf(w); if (i >= 0) { console.log('script', w, t.slice(Math.max(0, i - 300), i + 700).replace(/\s+/g, ' ')); break; } } }
  const keyJs = dl.match(/"key":"([^"]+)"/)?.[1] || dl.match(/key:\s*"([^"]+)"/)?.[1];
  if (keyJs) console.log('keyJs', keyJs);
  console.log('uploads', JSON.stringify(ups));
  if (!ups.length) console.log('pagina', dl.replace(/\s+/g, ' ').slice(0, 3000));
  mkdirSync(`itch/${slug}`, { recursive: true });
  for (const u of ups) {
    const kk = (dl.match(/"key":"([^"]+)"/)?.[1]) || decodeURIComponent(key);
    const j = await (await req(`${base}/file/${u.id}?source=game_download&key=${encodeURIComponent(kk)}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }, body: new URLSearchParams({ csrf_token: csrf }) })).json();
    if (!j.url) { console.log('sem url', u.name, JSON.stringify(j)); continue; }
    const r = await fetch(j.url, { headers: { 'User-Agent': UA } });
    const buf = Buffer.from(await r.arrayBuffer());
    writeFileSync(`itch/${slug}/${u.name}`, buf);
    console.log('baixou', u.name, buf.length);
  }
} catch (e) { console.log('erro', slug, e.message); }
