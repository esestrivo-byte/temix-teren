create or replace function zasebno.je_admin_ali_vodja()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select vloga in ('vodja','administracija','lastnik') from public.profili where id = (select auth.uid()) and aktiven), false)
$$;
revoke execute on function zasebno.je_admin_ali_vodja() from public, anon;
grant execute on function zasebno.je_admin_ali_vodja() to authenticated;

-- Prodajalec vidi tudi naslove, ki jih je sam obdelal (statistika ostane, če se teren prerazporedi).
create policy naslovi_branje_svoji on public.naslovi_terena for select to authenticated
  using (obdelal = (select auth.uid()));
create index if not exists naslovi_terena_obdelano_idx on public.naslovi_terena (obdelano);
