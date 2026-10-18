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
for (const slug of process.argv.slice(2)) {
  const base = `https://quaternius.itch.io/${slug}`;
  const page = await (await req(base)).text();
  const csrf = page.match(/name="csrf_token" value="([^"]+)"/)?.[1];
  console.log(slug, 'csrf', !!csrf);
  const du = await (await req(base + '/download_url', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }, body: new URLSearchParams({ csrf_token: csrf }) })).json();
  console.log('download page', du.url);
  const key = du.url.match(/download\/([^/?]+)/)?.[1];
  const dl = await (await req(du.url)).text();
  const ups = [...dl.matchAll(/data-upload_id="(\d+)"[\s\S]*?class="name"[^>]*title="([^"]+)"[\s\S]*?class="file_size"[^>]*><span>([^<]+)/g)].map(m => ({ id: m[1], name: m[2], size: m[3] }));
  console.log('uploads', JSON.stringify(ups));
  mkdirSync(`itch/${slug}`, { recursive: true });
  for (const u of ups) {
    const j = await (await req(`${base}/file/${u.id}?source=game_download&key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }, body: new URLSearchParams({ csrf_token: csrf }) })).json();
    if (!j.url) { console.log('sem url', u.name, JSON.stringify(j)); continue; }
    const r = await fetch(j.url, { headers: { 'User-Agent': UA } });
    const buf = Buffer.from(await r.arrayBuffer());
    writeFileSync(`itch/${slug}/${u.name}`, buf);
    console.log('baixou', u.name, buf.length);
  }
}
