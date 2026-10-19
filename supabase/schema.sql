-- Banco do Fuilá (Supabase). Cole tudo no SQL Editor e clique em Run. Pode rodar de novo sem problema.

-- Jogador: nível, XP, insígnias e personagem
create table if not exists public.players (
  id uuid primary key references auth.users on delete cascade default auth.uid(),
  char text,
  xp int not null default 0,
  badges jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Carimbos: um por jogador e lugar
create table if not exists public.visits (
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  place_id text not null,
  place jsonb not null default '{}',
  lat double precision,
  lng double precision,
  via text not null default 'gps',
  ts timestamptz not null default now(),
  primary key (user_id, place_id)
);

-- Parceiros: lugares que pagam por visita nova. O "segredo" vai no QR do balcão.
create table if not exists public.partners (
  id text primary key default ('p-' || substr(md5(random()::text), 1, 8)),
  n text not null,
  cat text not null check (cat in ('cafe', 'bar', 'doce', 'verde', 'cultura', 'comida')),
  lat double precision not null,
  lng double precision not null,
  endereco text,
  cidade text,
  uf text,
  d text,
  oferta text not null,
  logo text,
  ativo boolean not null default true,
  segredo text not null default upper(substr(md5(random()::text), 1, 6)),
  criado_em timestamptz not null default now()
);

-- Cupons liberados na primeira visita a um parceiro
create table if not exists public.coupons (
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  partner_id text not null references public.partners on delete cascade,
  code text not null,
  oferta text not null,
  at timestamptz not null default now(),
  used_at timestamptz,
  primary key (user_id, partner_id)
);

alter table public.players enable row level security;
alter table public.visits enable row level security;
alter table public.partners enable row level security;
alter table public.coupons enable row level security;

drop policy if exists "dono" on public.players;
create policy "dono" on public.players for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "ver os meus" on public.visits;
create policy "ver os meus" on public.visits for select using (user_id = auth.uid());
-- carimbo de lugar comum vem direto do app; carimbo de parceiro só pela função checkin_parceiro
create or replace function public.e_parceiro(p text) returns boolean
  language sql stable security definer set search_path = public as $$ select exists (select 1 from public.partners where id = p) $$;
drop policy if exists "carimbar lugar comum" on public.visits;
create policy "carimbar lugar comum" on public.visits for insert
  with check (user_id = auth.uid() and not public.e_parceiro(place_id));

drop policy if exists "ver os meus" on public.coupons;
create policy "ver os meus" on public.coupons for select using (user_id = auth.uid());

-- Lista pública de parceiros, sem o segredo
create or replace view public.partners_public as
  select id, n, cat, lat, lng, endereco, cidade, uf, d, oferta, logo from public.partners where ativo;
grant select on public.partners_public to anon, authenticated;

-- Check-in num parceiro: confere o código do QR e a distância, carimba e libera o cupom
create or replace function public.checkin_parceiro(p_id text, p_codigo text, p_lat double precision, p_lng double precision)
returns json language plpgsql security definer set search_path = public as $$
declare
  pt public.partners;
  dist double precision;
  c public.coupons;
begin
  if auth.uid() is null then raise exception 'sem_login'; end if;
  select * into pt from public.partners where id = p_id and ativo;
  if not found then raise exception 'parceiro_nao_encontrado'; end if;
  if upper(trim(p_codigo)) <> pt.segredo then raise exception 'codigo_invalido'; end if;
  dist := 2 * 6371000 * asin(sqrt(power(sin(radians(pt.lat - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(pt.lat)) * power(sin(radians(pt.lng - p_lng) / 2), 2)));
  if dist > 200 then raise exception 'longe_demais'; end if;
  insert into public.visits (user_id, place_id, place, lat, lng, via)
    values (auth.uid(), pt.id, json_build_object('n', pt.n, 'cat', pt.cat, 'lat', pt.lat, 'lng', pt.lng, 'city', pt.cidade, 'addr', pt.endereco, 'parceiro', true, 'oferta', pt.oferta, 'logo', pt.logo), p_lat, p_lng, 'qr')
    on conflict do nothing;
  insert into public.coupons (user_id, partner_id, code, oferta)
    values (auth.uid(), pt.id, 'FUI-' || upper(substr(md5(random()::text), 1, 4)), pt.oferta)
    on conflict do nothing;
  select * into c from public.coupons where user_id = auth.uid() and partner_id = pt.id;
  return json_build_object('code', c.code, 'oferta', c.oferta, 'at', c.at, 'used_at', c.used_at);
end $$;
grant execute on function public.checkin_parceiro to authenticated;

-- Marca um cupom como usado (no caixa)
create or replace function public.usar_cupom(p_id text)
returns timestamptz language sql security definer set search_path = public as $$
  update public.coupons set used_at = coalesce(used_at, now()) where user_id = auth.uid() and partner_id = p_id returning used_at;
$$;
grant execute on function public.usar_cupom to authenticated;

-- Quantas visitas novas cada parceiro recebeu (para cobrar e para o painel do lojista)
create or replace view public.visitas_por_parceiro as
  select p.id, p.n, p.cidade, count(v.*) as visitas_novas, max(v.ts) as ultima
  from public.partners p left join public.visits v on v.place_id = p.id
  group by p.id, p.n, p.cidade;
revoke all on public.visitas_por_parceiro from anon, authenticated;

-- Lugares cadastrados pelos jogadores. Cada um vê os seus; os aprovados aparecem para todos.
-- Para aprovar: Table Editor > sugestoes > mude status para 'aprovado' (ou 'recusado').
create table if not exists public.sugestoes (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  n text not null check (char_length(n) between 2 and 60),
  cat text not null check (cat in ('cafe', 'bar', 'doce', 'verde', 'cultura', 'comida')),
  nota text check (nota is null or char_length(nota) <= 120),
  lat double precision not null,
  lng double precision not null,
  precisao int,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  criado timestamptz not null default now()
);
alter table public.sugestoes enable row level security;
drop policy if exists "ver os meus e os aprovados" on public.sugestoes;
create policy "ver os meus e os aprovados" on public.sugestoes for select using (user_id = auth.uid() or status = 'aprovado');
drop policy if exists "sugerir" on public.sugestoes;
-- até 3 por dia por jogador, e sempre como pendente
create policy "sugerir" on public.sugestoes for insert with check (
  user_id = auth.uid() and status = 'pendente'
  and (select count(*) from public.sugestoes s where s.user_id = auth.uid() and s.criado > now() - interval '1 day') < 3
);
