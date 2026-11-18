import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { useProfili } from "../lib/hooks";
import { REGIJE, VLOGE, imePriimek, sporociloNapake, supabase, type Profil, type Vloga } from "../lib/supabase";

function nakljucnoGeslo() {
  const z = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const r = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(r, (n) => z[n % z.length]).join("");
}
const brezSumnikov = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

async function klici(telo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("uporabniki", { body: telo });
  if (error) {
    let sporocilo = error.message;
    try { sporocilo = (await (error as { context?: Response }).context?.json())?.napaka ?? sporocilo; } catch { /* */ }
    throw new Error(sporocilo);
  }
  return data;
}

export default function Ekipa() {
  const { profil: jaz } = useAuth();
  const { profili, nalozi } = useProfili();
  const [nov, setNov] = useState({ ime: "", priimek: "", uporabnisko_ime: "", vloga: "prodajalec" as Vloga, regija: "", telefon: "" });
  const [napaka, setNapaka] = useState("");
  const [geslo, setGeslo] = useState<{ ime: string; geslo: string } | null>(null);
  const [poteka, setPoteka] = useState(false);

  const predlagaj = (ime: string, priimek: string) => [brezSumnikov(ime), brezSumnikov(priimek)].filter(Boolean).join(".");

  async function ustvari(e: FormEvent) {
    e.preventDefault();
    setNapaka(""); setGeslo(null); setPoteka(true);
    const g = nakljucnoGeslo();
    try {
      await klici({ akcija: "ustvari", ...nov, geslo: g });
      setGeslo({ ime: nov.uporabnisko_ime, geslo: g });
      setNov({ ime: "", priimek: "", uporabnisko_ime: "", vloga: "prodajalec", regija: "", telefon: "" });
      nalozi();
    } catch (err) { setNapaka(sporociloNapake(err)); }
    setPoteka(false);
  }

  async function ponastavi(p: Profil) {
    if (!confirm(`Nastavim novo začasno geslo za ${imePriimek(p)}?`)) return;
    setNapaka(""); setGeslo(null);
    const g = nakljucnoGeslo();
    try { await klici({ akcija: "ponastavi_geslo", id: p.id, geslo: g }); setGeslo({ ime: p.uporabnisko_ime, geslo: g }); }
    catch (err) { setNapaka(sporociloNapake(err)); }
  }

  async function aktivnost(p: Profil) {
    if (p.aktiven && !confirm(`Onemogočim račun ${imePriimek(p)}? Prijava ne bo več mogoča.`)) return;
    setNapaka("");
    try { await klici({ akcija: "aktivnost", id: p.id, aktiven: !p.aktiven }); nalozi(); }
    catch (err) { setNapaka(sporociloNapake(err)); }
  }

  async function posodobi(p: Profil, polja: Partial<Profil>) {
    const { error } = await supabase.from("profili").update(polja).eq("id", p.id);
    if (error) setNapaka(sporociloNapake(error));
    nalozi();
  }

  return (
    <section>
      <h2>Ekipa</h2>
      {napaka && <p className="error">{napaka}</p>}
      {geslo && (
        <div className="card notice">
          <b>Začasno geslo za {geslo.ime}:</b> <code>{geslo.geslo}</code>
          <p className="small">Sporočite ga osebno ali po SMS. Ob prvi prijavi si bo uporabnik nastavil svoje geslo. Gesla kasneje ne boste več videli.</p>
        </div>
      )}

      <form className="card grid" onSubmit={ustvari}>
        <h3 className="full">Nov član ekipe</h3>
        <label>Ime<input value={nov.ime} required onChange={(e) => setNov({ ...nov, ime: e.target.value, uporabnisko_ime: predlagaj(e.target.value, nov.priimek) })} /></label>
        <label>Priimek<input value={nov.priimek} required onChange={(e) => setNov({ ...nov, priimek: e.target.value, uporabnisko_ime: predlagaj(nov.ime, e.target.value) })} /></label>
        <label>Uporabniško ime<input value={nov.uporabnisko_ime} required pattern="[a-z0-9._\-]{3,40}" onChange={(e) => setNov({ ...nov, uporabnisko_ime: e.target.value.toLowerCase() })} /></label>
        <label>Vloga<select value={nov.vloga} onChange={(e) => setNov({ ...nov, vloga: e.target.value as Vloga })}>{Object.entries(VLOGE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Regija<select value={nov.regija} onChange={(e) => setNov({ ...nov, regija: e.target.value })}><option value="">—</option>{REGIJE.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label>Telefon<input value={nov.telefon} onChange={(e) => setNov({ ...nov, telefon: e.target.value })} /></label>
        <div className="full actions"><button className="primary" disabled={poteka}>{poteka ? "Ustvarjam …" : "Ustvari račun"}</button></div>
      </form>

      <div className="list">
        {profili.map((p) => (
          <div key={p.id} className={`card row ${p.aktiven ? "" : "inactive"}`}>
            <div className="grow">
              <div className="title">{imePriimek(p)} {!p.aktiven && <span className="badge">onemogočen</span>}</div>
              <div className="small muted">{p.uporabnisko_ime}{p.telefon ? ` · ${p.telefon}` : ""}</div>
            </div>
            <select value={p.vloga} disabled={p.id === jaz?.id} onChange={(e) => posodobi(p, { vloga: e.target.value as Vloga })}>
              {Object.entries(VLOGE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={p.regija ?? ""} onChange={(e) => posodobi(p, { regija: e.target.value || null })}>
              <option value="">Regija —</option>{REGIJE.map((r) => <option key={r}>{r}</option>)}
            </select>
            <button onClick={() => ponastavi(p)}>Novo geslo</button>
            {p.id !== jaz?.id && <button className={p.aktiven ? "danger" : ""} onClick={() => aktivnost(p)}>{p.aktiven ? "Onemogoči" : "Omogoči"}</button>}
          </div>
        ))}
      </div>
    </section>
  );
}
