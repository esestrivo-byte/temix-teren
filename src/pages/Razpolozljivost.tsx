import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { useProfili } from "../lib/hooks";
import { REGIJE, imePriimek, sporociloNapake, supabase, type Razpolozljivost as Vnos } from "../lib/supabase";

const DNEVI = ["pon", "tor", "sre", "čet", "pet", "sob", "ned"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function ponedeljek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const ura = (t: string) => t.slice(0, 5);

export default function Razpolozljivost() {
  const { profil } = useAuth();
  const pregled = profil?.vloga === "vodja" || profil?.vloga === "administracija";
  const vodja = profil?.vloga === "vodja";
  const { profili } = useProfili();
  const [zacetek, setZacetek] = useState(() => ponedeljek(new Date()));
  const [vnosi, setVnosi] = useState<Vnos[]>([]);
  const [napaka, setNapaka] = useState("");
  const [nov, setNov] = useState({ datum: iso(new Date()), od: "09:00", do: "17:00", regija: profil?.regija ?? "", opomba: "" });

  const dnevi = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(zacetek); d.setDate(d.getDate() + i); return d;
  }), [zacetek]);
  const konec = dnevi[6];

  const nalozi = useCallback(async () => {
    const { data, error } = await supabase.from("razpolozljivost").select("*")
      .gte("datum", iso(zacetek)).lte("datum", iso(konec)).order("datum").order("od");
    if (error) setNapaka(sporociloNapake(error));
    setVnosi((data as Vnos[]) ?? []);
  }, [zacetek, konec]);
  useEffect(() => { nalozi(); }, [nalozi]);

  function premakni(tedni: number) {
    const d = new Date(zacetek); d.setDate(d.getDate() + 7 * tedni); setZacetek(d);
  }

  async function dodaj(e: FormEvent) {
    e.preventDefault();
    setNapaka("");
    if (nov.do <= nov.od) return setNapaka("Konec mora biti po začetku.");
    const { error } = await supabase.from("razpolozljivost").insert({
      datum: nov.datum, od: nov.od, do: nov.do, regija: nov.regija || null, opomba: nov.opomba || null,
    });
    if (error) return setNapaka(sporociloNapake(error));
    const d = new Date(nov.datum);
    if (d < zacetek || d > konec) setZacetek(ponedeljek(d)); else nalozi();
  }

  async function izbrisi(v: Vnos) {
    const { error } = await supabase.from("razpolozljivost").delete().eq("id", v.id);
    if (error) return setNapaka(sporociloNapake(error));
    nalozi();
  }

  async function potrdi(v: Vnos) {
    const { error } = await supabase.from("razpolozljivost").update({ potrjeno: !v.potrjeno }).eq("id", v.id);
    if (error) return setNapaka(sporociloNapake(error));
    nalozi();
  }

  const ljudje = pregled
    ? profili.filter((p) => p.aktiven && p.vloga !== "administracija")
    : profili.filter((p) => p.id === profil?.id);

  return (
    <section>
      <div className="head">
        <h2>Razpoložljivost</h2>
        <div className="weeknav">
          <button onClick={() => premakni(-1)}>‹</button>
          <span>{dnevi[0].getDate()}. {dnevi[0].getMonth() + 1}. – {konec.getDate()}. {konec.getMonth() + 1}. {konec.getFullYear()}</span>
          <button onClick={() => premakni(1)}>›</button>
          <button onClick={() => setZacetek(ponedeljek(new Date()))}>Ta teden</button>
        </div>
      </div>
      {napaka && <p className="error">{napaka}</p>}

      <form className="card grid" onSubmit={dodaj}>
        <h3 className="full">Kdaj lahko delam</h3>
        <label>Dan<input type="date" value={nov.datum} onChange={(e) => setNov({ ...nov, datum: e.target.value })} required /></label>
        <label>Regija<select value={nov.regija} onChange={(e) => setNov({ ...nov, regija: e.target.value })}><option value="">—</option>{REGIJE.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label>Od<input type="time" value={nov.od} onChange={(e) => setNov({ ...nov, od: e.target.value })} required /></label>
        <label>Do<input type="time" value={nov.do} onChange={(e) => setNov({ ...nov, do: e.target.value })} required /></label>
        <label className="full">Opomba<input value={nov.opomba} onChange={(e) => setNov({ ...nov, opomba: e.target.value })} placeholder="npr. imam avto, lahko tudi izven LJ" /></label>
        <div className="full actions"><button className="primary">Dodaj termin</button></div>
      </form>

      <div className="week-wrap">
        <table className="week">
          <thead>
            <tr>
              <th>{pregled ? "Prodajalec" : ""}</th>
              {dnevi.map((d, i) => <th key={i} className={iso(d) === iso(new Date()) ? "today" : ""}>{DNEVI[i]} {d.getDate()}. {d.getMonth() + 1}.</th>)}
            </tr>
          </thead>
          <tbody>
            {ljudje.map((p) => (
              <tr key={p.id}>
                <th>{imePriimek(p)}</th>
                {dnevi.map((d, i) => (
                  <td key={i}>
                    {vnosi.filter((v) => v.prodajalec_id === p.id && v.datum === iso(d)).map((v) => (
                      <div key={v.id} className={`slot ${v.potrjeno ? "confirmed" : ""}`} title={v.opomba ?? ""}>
                        <b>{ura(v.od)}–{ura(v.do)}</b>
                        {v.regija && <span>{v.regija}</span>}
                        {v.opomba && <span className="muted">{v.opomba}</span>}
                        <div className="slot-actions">
                          {vodja && <button className="link" onClick={() => potrdi(v)}>{v.potrjeno ? "Prekliči potrditev" : "Potrdi"}</button>}
                          {(vodja || (v.prodajalec_id === profil?.id && !v.potrjeno)) && <button className="link" onClick={() => izbrisi(v)}>Izbriši</button>}
                        </div>
                      </div>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">Zeleni termini so potrjeni s strani vodje in jih prodajalec ne more več spreminjati.</p>
    </section>
  );
}
