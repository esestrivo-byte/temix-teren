// Upravljanje uporabnikov (samo vodja): ustvari, ponastavi geslo, (de)aktiviraj.
// Prijava poteka z uporabniškim imenom; v Supabase Auth ga shranimo kot interni e-naslov.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const DOMENA = "uporabniki.temix-teren.si";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const odgovor = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const VLOGE = ["prodajalec", "administracija", "vodja", "lastnik"];
const IME_RE = /^[a-z0-9._-]{3,40}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return odgovor({ napaka: "Dovoljen je samo POST." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const servisni = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, servisni, { auth: { persistSession: false } });

  // Kdo kliče?
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: klicatelj, error: napakaKlicatelja } = await admin.auth.getUser(token);
  if (napakaKlicatelja || !klicatelj?.user) return odgovor({ napaka: "Niste prijavljeni." }, 401);
  const { data: profil } = await admin.from("profili").select("vloga, aktiven").eq("id", klicatelj.user.id).single();
  if (!profil || profil.vloga !== "vodja" || !profil.aktiven) return odgovor({ napaka: "To lahko naredi samo vodja." }, 403);

  let telo: Record<string, unknown>;
  try { telo = await req.json(); } catch { return odgovor({ napaka: "Neveljavna zahteva." }, 400); }
  const akcija = telo.akcija;

  if (akcija === "ustvari") {
    const ime = String(telo.uporabnisko_ime ?? "").trim().toLowerCase();
    const geslo = String(telo.geslo ?? "");
    const vloga = String(telo.vloga ?? "prodajalec");
    if (!IME_RE.test(ime)) return odgovor({ napaka: "Uporabniško ime: 3–40 znakov, male črke, številke, pika, vezaj." }, 400);
    if (geslo.length < 10) return odgovor({ napaka: "Geslo mora imeti vsaj 10 znakov." }, 400);
    if (!VLOGE.includes(vloga)) return odgovor({ napaka: "Neznana vloga." }, 400);
    if (!String(telo.ime ?? "").trim() || !String(telo.priimek ?? "").trim()) return odgovor({ napaka: "Ime in priimek sta obvezna." }, 400);

    const { data: nov, error } = await admin.auth.admin.createUser({
      email: `${ime}@${DOMENA}`,
      password: geslo,
      email_confirm: true,
      user_metadata: { uporabnisko_ime: ime },
    });
    if (error || !nov.user) {
      const obstaja = /already|exists|registered/i.test(error?.message ?? "");
      return odgovor({ napaka: obstaja ? "Uporabniško ime je že zasedeno." : `Ustvarjanje ni uspelo: ${error?.message}` }, 400);
    }
    const { error: napakaProfila } = await admin.from("profili").insert({
      id: nov.user.id,
      uporabnisko_ime: ime,
      ime: String(telo.ime).trim(),
      priimek: String(telo.priimek).trim(),
      vloga,
      regija: telo.regija ? String(telo.regija) : null,
      telefon: telo.telefon ? String(telo.telefon) : null,
      mora_spremeniti_geslo: true,
    });
    if (napakaProfila) {
      await admin.auth.admin.deleteUser(nov.user.id);
      return odgovor({ napaka: `Profila ni bilo mogoče shraniti: ${napakaProfila.message}` }, 400);
    }
    return odgovor({ ok: true, id: nov.user.id });
  }

  if (akcija === "ponastavi_geslo") {
    const id = String(telo.id ?? "");
    const geslo = String(telo.geslo ?? "");
    if (geslo.length < 10) return odgovor({ napaka: "Geslo mora imeti vsaj 10 znakov." }, 400);
    const { error } = await admin.auth.admin.updateUserById(id, { password: geslo });
    if (error) return odgovor({ napaka: error.message }, 400);
    await admin.from("profili").update({ mora_spremeniti_geslo: true }).eq("id", id);
    return odgovor({ ok: true });
  }

  if (akcija === "aktivnost") {
    const id = String(telo.id ?? "");
    const aktiven = Boolean(telo.aktiven);
    if (id === klicatelj.user.id && !aktiven) return odgovor({ napaka: "Sebe ne morete onemogočiti." }, 400);
    const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: aktiven ? "none" : "876000h" });
    if (error) return odgovor({ napaka: error.message }, 400);
    await admin.from("profili").update({ aktiven }).eq("id", id);
    return odgovor({ ok: true });
  }

  return odgovor({ napaka: "Neznana akcija." }, 400);
});
