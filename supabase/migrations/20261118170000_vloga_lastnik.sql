-- Vloga lastnik: vidi vse (samo branje), kot administracija.
alter type public.vloga add value if not exists 'lastnik';
