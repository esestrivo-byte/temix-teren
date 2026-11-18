import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useProfili } from "../lib/hooks";
import {
  REGIJE, REZULTATI, STATUSI_TERENA, datumSl, imePriimek, sporociloNapake, supabase,
  type NaslovTerena, type StatusTerena, type Teren,
} from "../lib/supabase";

export default function TerenPodrobno() {
  const { id } = useParams();
  const nav = useNavigate();
  const { profil } = useAuth();
  const vodja = profil?.vloga === "vodja";
  const { profili, poId } = useProfili();
  const [teren, setTeren] = useState<Teren | null>(null);
  const [naslovi, setNaslovi] = useState<NaslovTerena[]>([]);
  const [urejanje, setUrejanje] = useState<Teren | null>(null);
  const [noviNaslovi, setNoviNaslovi] = useState("");
  const [napaka, setNapaka] = useState("");
  const [ni, setNi] = useState(false);

  const nalozi = useCallback(async () => {
    const [{ data: t }, { data: n }] = await Promise.all([
      supabase.from("tereni").select("*").eq("id", id).maybeSingle(),
      supabase.from("naslovi_terena").select("*").eq("teren_id", id).order("id"),
    ]);
    if (!t) setNi(true);
    setTeren(t as Teren);
    setNaslovi((n as NaslovTerena[]) ?? []);
  }, [id]);
  useEffect(() => { nalozi(); }, [nalozi]);

  const mojTeren = teren?.prodajalec_id === profil?.id;
  const lahkoVnasa = vodja || mojTeren;

  async function shraniTeren(e: FormEvent) {
    e.preventDefault();
    if (!urejanje) return;
    const { id: _id, posodobljeno: _p, ...polja } = urejanje;
    const zapis = Object.fromEntries(Object.entries(polja).map(([k, v]) => [k, v === "" ? null : v]));
    const { error } = await supabase.from("tereni").update(zapis).eq("id", urejanje.id);
    if (error) return setNapaka(sporociloNapake(error));
    setUrejanje(null);
    nalozi();
  }

  async function izbrisi() {
    if (!teren || !confirm(`Izbrišem teren »${teren.naziv}« z vsemi naslovi?`)) return;
    const { error } = await supabase.from("tereni").delete().eq("id", teren.id);
    if (error) return setNapaka(sporociloNapake(error));
    nav("/tereni");
  }

  async function dodajNaslove() {
    const vrstice = noviNaslovi.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!vrstice.length || !teren) return;
    const { error } = await supabase.from("naslovi_terena").insert(vrstice.map((naslov) => ({ teren_id: teren.id, naslov })));
    if (error) return setNapaka(sporociloNapake(error));
    setNoviNaslovi("");
    nalozi();
  }

  async function zabelezi(n: NaslovTerena, rezultat: string) {
    const { error } = await supabase.from("naslovi_terena").update({
      rezultat: rezultat || null,
      obdelan: !!rezultat,
      obdelal: rezultat ? profil?.id : null,
      obdelano: rezultat ? new Date().toISOString() : null,
    }).eq("id", n.id);
    if (error) return setNapaka(sporociloNapake(error));
    nalozi();
  }

  async function opomba(n: NaslovTerena, opomba: string) {
    if (opomba === (n.opomba ?? "")) return;
    const { error } = await supabase.from("naslovi_terena").update({ opomba: opomba || null }).eq("id", n.id);
    if (error) setNapaka(sporociloNapake(error));
  }

  if (ni) return <section><p>Terena ni ali do njega nimate dostopa.</p><Link to="/tereni">← Nazaj na terene</Link></section>;
  if (!teren) return <p className="muted">Nalagam …</p>;

  const obdelani = naslovi.filter((n) => n.obdelan).length;
  const narocila = naslovi.filter((n) => n.rezultat === "naroceno").length;
  const u = urejanje;
  const set = (k: keyof Teren) => (e: { target: { value: string } }) => setUrejanje((o) => (o ? { ...o, [k]: e.target.value } : o));

  return (
    <section>
      <Link to="/tereni" className="small">← Nazaj na terene</Link>
      {napaka && <p className="error">{napaka}</p>}

      {!u ? (
        <div className="card">
          <div className="head">
            <h2>{teren.naziv}</h2>
            <span className={`badge s-${teren.status}`}>{STATUSI_TERENA[teren.status]}</span>
          </div>
          <dl className="dl">
            <dt>Prodajalec</dt><dd>{imePriimek(poId(teren.prodajalec_id))}</dd>
            <dt>Kraj, regija</dt><dd>{[teren.kraj, teren.regija].filter(Boolean).join(", ") || "—"}</dd>
            <dt>Tehnologija</dt><dd>{teren.tehnologija ?? "—"}</dd>
            <dt>Velja</dt><dd>{datumSl(teren.velja_od)} – {datumSl(teren.velja_do)}</dd>
            <dt>Napredek</dt><dd>{obdelani} / {naslovi.length} naslovov obdelanih · {narocila} naročil</dd>
            {teren.opombe && <><dt>Opombe</dt><dd className="pre">{teren.opombe}</dd></>}
          </dl>
          {vodja && (
            <div className="actions">
              <button onClick={izbrisi} className="danger">Izbriši</button>
              <button onClick={() => setUrejanje({ ...teren })}>Uredi teren</button>
            </div>
          )}
        </div>
      ) : (
        <form className="card grid" onSubmit={shraniTeren}>
          <h3 className="full">Urejanje terena</h3>
          <label className="full">Naziv<input value={u.naziv} onChange={set("naziv")} required /></label>
          <label>Regija<select value={u.regija ?? ""} onChange={set("regija")}><option value="">—</option>{REGIJE.map((r) => <option key={r}>{r}</option>)}</select></label>
          <label>Kraj<input value={u.kraj ?? ""} onChange={set("kraj")} /></label>
          <label>Tehnologija<select value={u.tehnologija ?? ""} onChange={set("tehnologija")}><option value="">—</option><option>FTTH</option><option>HFC</option><option>FTTH/HFC</option></select></label>
          <label>Prodajalec<select value={u.prodajalec_id ?? ""} onChange={set("prodajalec_id")}><option value="">(nedodeljen)</option>{profili.filter((p) => p.aktiven && (p.vloga === "prodajalec" || p.vloga === "vodja")).map((p) => <option key={p.id} value={p.id}>{imePriimek(p)}</option>)}</select></label>
          <label>Velja od<input type="date" value={u.velja_od ?? ""} onChange={set("velja_od")} /></label>
          <label>Velja do<input type="date" value={u.velja_do ?? ""} onChange={set("velja_do")} /></label>
          <label>Status<select value={u.status} onChange={(e) => setUrejanje({ ...u, status: e.target.value as StatusTerena })}>{Object.entries(STATUSI_TERENA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="full">Opombe<textarea rows={3} value={u.opombe ?? ""} onChange={set("opombe")} /></label>
          <div className="full actions">
            <button type="button" onClick={() => setUrejanje(null)}>Prekliči</button>
            <button className="primary">Shrani</button>
          </div>
        </form>
      )}

      <h3>Naslovi ({naslovi.length})</h3>
      {naslovi.length === 0 && <p className="muted">Na terenu še ni naslovov.</p>}
      <div className="list">
        {naslovi.map((n) => (
          <div className={`card row addr ${n.obdelan ? "done" : ""}`} key={n.id}>
            <div className="grow">
              <div className="title">{n.naslov}</div>
              {lahkoVnasa ? (
                <input className="small-input" placeholder="Opomba (npr. pridi po 17h)" defaultValue={n.opomba ?? ""}
                  onBlur={(e) => opomba(n, e.target.value)} />
              ) : n.opomba && <div className="small muted">{n.opomba}</div>}
              {n.obdelano && <div className="small muted">{imePriimek(poId(n.obdelal))}, {datumSl(n.obdelano)}</div>}
            </div>
            <select value={n.rezultat ?? ""} disabled={!lahkoVnasa} onChange={(e) => zabelezi(n, e.target.value)}>
              <option value="">Ni obiskano</option>
              {Object.entries(REZULTATI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        ))}
      </div>

      {lahkoVnasa && (
        <div className="card">
          <label>Dodaj naslove (en naslov v vrstico)
            <textarea rows={3} value={noviNaslovi} onChange={(e) => setNoviNaslovi(e.target.value)} />
          </label>
          <div className="actions"><button className="primary" onClick={dodajNaslove}>Dodaj</button></div>
        </div>
      )}
    </section>
  );
}
