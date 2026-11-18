-- Faza 1: uporabniki in vloge, tereni, naslovi terenov, razpoložljivost + RLS.
-- (Uporabljeno na projektu temix-teren 18. 11. 2026.)

create type public.vloga as enum ('prodajalec','administracija','vodja');
create type public.status_terena as enum ('prost','dodeljen','v_delu','zakljucen');

create table public.profili (
  id uuid primary key references auth.users(id) on delete cascade,
  uporabnisko_ime text not null unique check (uporabnisko_ime ~ '^[a-z0-9._-]{3,40}$'),
  ime text not null,
  priimek text not null,
  vloga public.vloga not null default 'prodajalec',
  regija text,
  telefon text,
  aktiven boolean not null default true,
  mora_spremeniti_geslo boolean not null default false,
  ustvarjeno timestamptz not null default now()
);

-- Pomožne funkcije v zasebni shemi (ni izpostavljena API-ju)
create schema if not exists zasebno;
revoke all on schema zasebno from public, anon;
grant usage on schema zasebno to authenticated;

create function zasebno.moja_vloga() returns public.vloga language sql stable security definer set search_path = '' as $$
  select vloga from public.profili where id = (select auth.uid()) and aktiven $$;
create function zasebno.je_vodja() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select vloga = 'vodja' from public.profili where id = (select auth.uid()) and aktiven), false) $$;
create function zasebno.je_admin_ali_vodja() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select vloga in ('vodja','administracija') from public.profili where id = (select auth.uid()) and aktiven), false) $$;
create function zasebno.je_aktiven() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select aktiven from public.profili where id = (select auth.uid())), false) $$;

create table public.tereni (
  id bigint generated always as identity primary key,
  naziv text not null,
  regija text,
  kraj text,
  naslovi text,
  tehnologija text check (tehnologija in ('FTTH','HFC','FTTH/HFC')),
  velja_od date,
  velja_do date,
  prodajalec_id uuid references public.profili(id) on delete set null,
  status public.status_terena not null default 'prost',
  opombe text,
  ustvaril uuid references public.profili(id) on delete set null default auth.uid(),
  ustvarjeno timestamptz not null default now(),
  posodobljeno timestamptz not null default now(),
  check (velja_do is null or velja_od is null or velja_do >= velja_od)
);
create index on public.tereni (prodajalec_id);
create index tereni_ustvaril_idx on public.tereni (ustvaril);

create table public.naslovi_terena (
  id bigint generated always as identity primary key,
  teren_id bigint not null references public.tereni(id) on delete cascade,
  naslov text not null,
  obdelan boolean not null default false,
  rezultat text check (rezultat in ('ni_doma','ni_interesa','ponovni_obisk','naroceno','drugo')),
  opomba text,
  obdelal uuid references public.profili(id) on delete set null,
  obdelano timestamptz
);
create index on public.naslovi_terena (teren_id);
create index on public.naslovi_terena (obdelal);

create table public.razpolozljivost (
  id bigint generated always as identity primary key,
  prodajalec_id uuid not null references public.profili(id) on delete cascade default auth.uid(),
  datum date not null,
  od time not null,
  "do" time not null,
  regija text,
  opomba text,
  potrjeno boolean not null default false,
  ustvarjeno timestamptz not null default now(),
  check ("do" > od)
);
create index on public.razpolozljivost (prodajalec_id, datum);

-- Sprožilci
create function zasebno.nastavi_posodobljeno() returns trigger language plpgsql set search_path = '' as $$
begin new.posodobljeno = now(); return new; end $$;
create trigger tereni_posodobljeno before update on public.tereni for each row execute function zasebno.nastavi_posodobljeno();

create function zasebno.zascita_profila() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if; -- strežniške funkcije
  if not zasebno.je_vodja() and (new.vloga is distinct from old.vloga or new.aktiven is distinct from old.aktiven or new.uporabnisko_ime is distinct from old.uporabnisko_ime) then
    raise exception 'Samo vodja lahko spremeni vlogo, uporabniško ime ali aktivnost.';
  end if;
  if new.mora_spremeniti_geslo and not old.mora_spremeniti_geslo and not zasebno.je_vodja() then
    raise exception 'Ni dovoljeno.';
  end if;
  return new;
end $$;
create trigger profili_zascita before update on public.profili for each row execute function zasebno.zascita_profila();

create function zasebno.zascita_terena() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not zasebno.je_vodja() and (new.prodajalec_id is distinct from old.prodajalec_id or new.naziv is distinct from old.naziv
     or new.naslovi is distinct from old.naslovi or new.velja_od is distinct from old.velja_od or new.velja_do is distinct from old.velja_do
     or new.regija is distinct from old.regija or new.kraj is distinct from old.kraj or new.tehnologija is distinct from old.tehnologija) then
    raise exception 'Teren lahko ureja samo vodja; prodajalec lahko spremeni le status in opombe.';
  end if;
  return new;
end $$;
create trigger tereni_zascita before update on public.tereni for each row execute function zasebno.zascita_terena();

revoke execute on all functions in schema zasebno from public, anon;
grant execute on function zasebno.moja_vloga(), zasebno.je_vodja(), zasebno.je_admin_ali_vodja(), zasebno.je_aktiven() to authenticated;

-- RLS
alter table public.profili enable row level security;
alter table public.tereni enable row level security;
alter table public.naslovi_terena enable row level security;
alter table public.razpolozljivost enable row level security;

create policy profili_branje on public.profili for select to authenticated using ((select zasebno.je_aktiven()));
create policy profili_urejanje on public.profili for update to authenticated
  using (id = (select auth.uid()) or (select zasebno.je_vodja())) with check (id = (select auth.uid()) or (select zasebno.je_vodja()));
create policy profili_vnos on public.profili for insert to authenticated with check ((select zasebno.je_vodja()));
create policy profili_brisanje on public.profili for delete to authenticated using ((select zasebno.je_vodja()));

create policy tereni_branje on public.tereni for select to authenticated
  using ((select zasebno.je_admin_ali_vodja()) or (prodajalec_id = (select auth.uid()) and (select zasebno.je_aktiven())));
create policy tereni_vnos on public.tereni for insert to authenticated with check ((select zasebno.je_vodja()));
create policy tereni_urejanje on public.tereni for update to authenticated
  using ((select zasebno.je_vodja()) or (prodajalec_id = (select auth.uid()) and (select zasebno.je_aktiven())))
  with check ((select zasebno.je_vodja()) or prodajalec_id = (select auth.uid()));
create policy tereni_brisanje on public.tereni for delete to authenticated using ((select zasebno.je_vodja()));

create policy naslovi_branje on public.naslovi_terena for select to authenticated
  using ((select zasebno.je_admin_ali_vodja()) or exists (select 1 from public.tereni t where t.id = teren_id and t.prodajalec_id = (select auth.uid())));
create policy naslovi_vnos on public.naslovi_terena for insert to authenticated
  with check ((select zasebno.je_vodja()) or exists (select 1 from public.tereni t where t.id = teren_id and t.prodajalec_id = (select auth.uid())));
create policy naslovi_urejanje on public.naslovi_terena for update to authenticated
  using ((select zasebno.je_vodja()) or exists (select 1 from public.tereni t where t.id = teren_id and t.prodajalec_id = (select auth.uid())))
  with check ((select zasebno.je_vodja()) or exists (select 1 from public.tereni t where t.id = teren_id and t.prodajalec_id = (select auth.uid())));
create policy naslovi_brisanje on public.naslovi_terena for delete to authenticated using ((select zasebno.je_vodja()));

create policy razp_branje on public.razpolozljivost for select to authenticated
  using ((select zasebno.je_admin_ali_vodja()) or prodajalec_id = (select auth.uid()));
create policy razp_vnos on public.razpolozljivost for insert to authenticated
  with check ((prodajalec_id = (select auth.uid()) and (select zasebno.je_aktiven()) and potrjeno = false) or (select zasebno.je_vodja()));
create policy razp_urejanje on public.razpolozljivost for update to authenticated
  using ((prodajalec_id = (select auth.uid()) and potrjeno = false) or (select zasebno.je_vodja()))
  with check ((prodajalec_id = (select auth.uid()) and potrjeno = false) or (select zasebno.je_vodja()));
create policy razp_brisanje on public.razpolozljivost for delete to authenticated
  using ((prodajalec_id = (select auth.uid()) and potrjeno = false) or (select zasebno.je_vodja()));

revoke all on public.profili, public.tereni, public.naslovi_terena, public.razpolozljivost from anon;

create extension if not exists pg_net with schema extensions;
