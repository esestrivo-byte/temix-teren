-- Nov izid obiska: pustil ponudbo
alter table public.naslovi_terena drop constraint if exists naslovi_terena_rezultat_check;
alter table public.naslovi_terena add constraint naslovi_terena_rezultat_check
  check (rezultat in ('ni_doma','ni_interesa','pustil_ponudbo','ponovni_obisk','naroceno','drugo'));
