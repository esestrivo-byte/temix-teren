# Temix teren

Spletna aplikacija za terensko (d2d) ekipo Temix: prijava z uporabniškim imenom, tereni, razpoložljivost ekipe, kasneje naročilnice s skeniranjem in obvestila administraciji.

## Sestava

- **Spletni del:** React + Vite (`src/`), deluje na telefonu in računalniku.
- **Zaledje:** Supabase projekt `temix-teren` (Frankfurt): prijava, baza z zaščito po vlogah (RLS), strežniške funkcije.
- **Baza:** `supabase/migrations/` (že uporabljeno na projektu).
- **Funkcija `uporabniki`:** `supabase/functions/uporabniki/` – vodja ustvarja račune, ponastavlja gesla, onemogoča račune.

## Vloge

| Vloga | Tereni | Razpoložljivost | Ekipa |
| --- | --- | --- | --- |
| Prodajalec | vidi svoje, spreminja status, beleži obiske naslovov | vnaša svojo (dokler ni potrjena) | – |
| Administracija | vidi vse | vidi vse | – |
| Vodja | ureja, dodeljuje, briše | vidi vse, potrjuje | ustvarja račune |
| Lastnik | vidi vse (samo branje) | vidi vse | – |

Statistiko vidi vsak: prodajalec svojo, vodja, administracija in lastnik celotno ekipo.

Prijava je z uporabniškim imenom (npr. `erik.straus`); v Supabase Auth je shranjeno kot interni naslov `ime.priimek@uporabniki.temix-teren.si`, na katerega se nikoli ne pošilja pošta. Ob prvi prijavi si uporabnik nastavi svoje geslo.

## Razvoj

```bash
npm install
npm run dev     # lokalno na http://localhost:5173
npm run build   # izdelek v dist/
```

Nastavitve so v `.env` (javni URL in publishable ključ; zaščito podatkov zagotavlja RLS v bazi).

## Objava

Aplikacija je statična stran (`dist/`). Primerna je Cloudflare Pages ali Vercel (brezplačno): povežite ta repozitorij, ukaz za gradnjo `npm run build`, mapa `dist`. Preusmeritve za podstrani so že pripravljene (`public/_redirects`, `vercel.json`).
