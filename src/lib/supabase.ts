import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
);

// Prijava je z uporabniškim imenom; Supabase Auth ga hrani kot interni e-naslov.
export const DOMENA_UPORABNIKOV = "uporabniki.temix-teren.si";
export const vEmail = (uporabniskoIme: string) =>
  `${uporabniskoIme.trim().toLowerCase()}@${DOMENA_UPORABNIKOV}`;

export type Vloga = "prodajalec" | "administracija" | "vodja" | "lastnik";
export type StatusTerena = "prost" | "dodeljen" | "v_delu" | "zakljucen";

export interface Profil {
  id: string;
  uporabnisko_ime: string;
  ime: string;
  priimek: string;
  vloga: Vloga;
  regija: string | null;
  telefon: string | null;
  aktiven: boolean;
  mora_spremeniti_geslo: boolean;
}

export interface Teren {
  id: number;
  naziv: string;
  regija: string | null;
  kraj: string | null;
  naslovi: string | null;
  tehnologija: string | null;
  velja_od: string | null;
  velja_do: string | null;
  prodajalec_id: string | null;
  status: StatusTerena;
  opombe: string | null;
  posodobljeno: string;
}

export interface NaslovTerena {
  id: number;
  teren_id: number;
  naslov: string;
  obdelan: boolean;
  rezultat: string | null;
  opomba: string | null;
  obdelal: string | null;
  obdelano: string | null;
}

export interface Razpolozljivost {
  id: number;
  prodajalec_id: string;
  datum: string;
  od: string;
  do: string;
  regija: string | null;
  opomba: string | null;
  potrjeno: boolean;
}

export const STATUSI_TERENA: Record<StatusTerena, string> = {
  prost: "Prost",
  dodeljen: "Dodeljen",
  v_delu: "V delu",
  zakljucen: "Zaključen",
};

export const REZULTATI: Record<string, string> = {
  ni_doma: "Ni doma",
  ni_interesa: "Ni interesa",
  pustil_ponudbo: "Pustil ponudbo",
  ponovni_obisk: "Ponovni obisk",
  naroceno: "Naročeno",
  drugo: "Drugo",
};

export const VLOGE: Record<Vloga, string> = {
  prodajalec: "Prodajalec",
  administracija: "Administracija",
  vodja: "Vodja",
  lastnik: "Lastnik",
};

export const REGIJE = [
  "Osrednjeslovenska", "Gorenjska", "Goriška", "Obalno-kraška", "Primorsko-notranjska",
  "Jugovzhodna Slovenija", "Posavska", "Zasavska", "Savinjska", "Koroška", "Podravska", "Pomurska",
];

export const imePriimek = (p?: Pick<Profil, "ime" | "priimek"> | null) => (p ? `${p.ime} ${p.priimek}` : "—");

export const datumSl = (d?: string | null) => {
  if (!d) return "—";
  const [y, m, dd] = d.slice(0, 10).split("-");
  return `${Number(dd)}. ${Number(m)}. ${y}`;
};

export const sporociloNapake = (e: unknown) => {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/Invalid login credentials/i.test(m)) return "Napačno uporabniško ime ali geslo.";
  if (/banned/i.test(m)) return "Račun je onemogočen. Obrnite se na vodjo.";
  if (/row-level security|permission denied/i.test(m)) return "Za to nimate pravic.";
  return m;
};
