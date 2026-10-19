// Conta do jogador e dados na nuvem (Supabase). Sem configuração, window.fuilaCloud fica desligado e o app segue só no celular.
(function () {
  const cfg = window.FUILA_CFG || {};
  const off = { on: false, ready: Promise.resolve(false) };
  if (!cfg.supabaseUrl || !cfg.supabaseKey || !window.supabase) { window.fuilaCloud = off; return; }
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'fuila-auth' },
  });
  const listeners = new Set();
  const C = {
    on: true, sb, user: null,
    get anon() { return !C.user || !!C.user.is_anonymous; },
    get email() { return C.user?.email || ''; },
    onChange(fn) { listeners.add(fn); },
  };
  const ERR = {
    sem_login: 'Sem conexão com a sua conta. Tente de novo.',
    parceiro_nao_encontrado: 'Este parceiro não está mais ativo.',
    codigo_invalido: 'Esse QR não é deste lugar.',
    longe_demais: 'Você precisa estar no lugar para carimbar.',
  };
  const fail = e => { const m = String(e?.message || e || ''); const k = Object.keys(ERR).find(k => m.includes(k)); throw new Error(k ? ERR[k] : 'Não consegui falar com o servidor. Confira a internet.'); };
  sb.auth.onAuthStateChange((ev, session) => {
    const prev = C.user?.id; C.user = session?.user || null;
    if (C.user?.id !== prev) listeners.forEach(fn => { try { fn(ev); } catch (e) {} });
  });
  C.ready = (async () => {
    try {
      const { data } = await sb.auth.getSession();
      C.user = data.session?.user || null;
      if (!C.user) { const r = await sb.auth.signInAnonymously(); if (r.error) throw r.error; C.user = r.data.user; }
      return true;
    } catch (e) { console.warn('fuila cloud', e); return false; }
  })();

  // traz tudo do jogador
  C.pull = async () => {
    const [p, v, c] = await Promise.all([
      sb.from('players').select('*').maybeSingle(),
      sb.from('visits').select('place_id, place, ts, via'),
      sb.from('coupons').select('partner_id, code, oferta, at, used_at'),
    ]);
    if (p.error || v.error || c.error) fail(p.error || v.error || c.error);
    return { player: p.data, visits: v.data, coupons: c.data };
  };
  C.pushVisits = async list => {
    if (!list.length) return;
    const { error } = await sb.from('visits').upsert(list.map(x => ({ place_id: x.id, place: x.p, ts: new Date(x.ts).toISOString(), lat: x.lat ?? null, lng: x.lng ?? null, via: 'gps' })), { onConflict: 'user_id,place_id', ignoreDuplicates: true });
    if (error) fail(error);
  };
  C.savePlayer = async ({ xp, badges, char }) => {
    const { error } = await sb.from('players').upsert({ id: C.user.id, xp, badges, char, updated_at: new Date().toISOString() });
    if (error) fail(error);
  };
  C.partners = async () => {
    const { data, error } = await sb.from('partners_public').select('*');
    if (error) fail(error);
    return data || [];
  };
  C.checkinPartner = async (id, code, lat, lng) => {
    const { data, error } = await sb.rpc('checkin_parceiro', { p_id: id, p_codigo: code, p_lat: lat, p_lng: lng });
    if (error) fail(error);
    return data;
  };
  // lugares cadastrados por jogadores: cada um manda os seus; os aprovados aparecem para todos
  C.suggest = async x => {
    const { error } = await sb.from('sugestoes').upsert({ id: x.id, n: x.n, cat: x.cat, nota: x.d || null, lat: x.lat, lng: x.lng, precisao: x.acc ?? null, criado: new Date(x.at).toISOString() }, { onConflict: 'id', ignoreDuplicates: true });
    if (error) fail(error);
  };
  C.approved = async () => {
    const { data, error } = await sb.from('sugestoes').select('id, n, cat, nota, lat, lng, status');
    if (error) fail(error);
    return data || [];
  };
  C.useCoupon = async id => { const { error } = await sb.rpc('usar_cupom', { p_id: id }); if (error) fail(error); };

  // salvar a conta com e-mail (código de 6 dígitos) ou entrar numa conta que já existe
  let mode = 'link';
  C.sendCode = async email => {
    if (C.anon) {
      const r = await sb.auth.updateUser({ email });
      if (!r.error) { mode = 'link'; return; }
      if (!/already|exists|registered/i.test(r.error.message)) throw new Error(r.error.message);
    }
    const r = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (r.error) throw new Error(/rate|seconds/i.test(r.error.message) ? 'Muitos pedidos de código. Espere um pouco e tente de novo.' : r.error.message);
    mode = 'login';
  };
  C.verifyCode = async (email, token) => {
    const r = await sb.auth.verifyOtp({ email, token: token.trim(), type: mode === 'link' ? 'email_change' : 'email' });
    if (r.error) throw new Error('Código errado ou vencido.');
    C.user = r.data.user || C.user;
    return mode;
  };
  C.signOut = async () => {
    await sb.auth.signOut();
    const r = await sb.auth.signInAnonymously();
    C.user = r.data?.user || null;
  };
  window.fuilaCloud = C;
})();
