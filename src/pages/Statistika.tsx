import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { useProfili } from "../lib/hooks";
import { REZULTATI, imePriimek, sporociloNapake, supabase } from "../lib/supabase";

interface Obisk { id: number; rezultat: string | null; obdelal: string | null; obdelano: string }
interface Termin { prodajalec_id: string; datum: string; od: string; do: string; potrjeno: boolean }
interface TerenMin { id: number; prodajalec_id: string | null; status: string }

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dan = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const ure = (od: string, doo: string) => {
  const [a, b] = od.split(":").map(Number); const [c, e] = doo.split(":").map(Number);
  return Math.max(0, (c * 60 + e - a * 60 - b) / 60);
};
const odstotek = (a: number, b: number) => (b ? `${((a / b) * 100).toLocaleString("sl-SI", { maximumFractionDigits: 1 })} %` : "—");
const stevilo = (n: number, dec = 0) => n.toLocaleString("sl-SI", { maximumFractionDigits: dec, minimumFractionDigits: dec });

type Obdobje = "teden" | "mesec" | "prejsnji" | "30" | "meri";
function razpon(o: Obdobje, od: string, doo: string): [string, string] {
  const t = dan(new Date());
  if (o === "teden") { const m = new Date(t); m.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return [iso(m), iso(t)]; }
  if (o === "mesec") return [iso(new Date(t.getFullYear(), t.getMonth(), 1)), iso(t)];
  if (o === "prejsnji") return [iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), iso(new Date(t.getFullYear(), t.getMonth(), 0))];
  if (o === "30") { const m = new Date(t); m.setDate(t.getDate() - 29); return [iso(m), iso(t)]; }
  return [od, doo];
}

interface Vrstica { id: string; ime: string; obiski: number; narocila: number; ponovni: number; ure: number; tereni: number }

export default function Statistika() {
  const { profil } = useAuth();
  const vse = profil?.vloga !== "prodajalec";
  const { profili } = useProfili();
  const [obdobje, setObdobje] = useState<Obdobje>("mesec");
  const [mojOd, setMojOd] = useState(iso(new Date()));
  const [mojDo, setMojDo] = useState(iso(new Date()));
  const [izbran, setIzbran] = useState("");
  const [obiski, setObiski] = useState<Obisk[]>([]);
  const [termini, setTermini] = useState<Termin[]>([]);
  const [tereni, setTereni] = useState<TerenMin[]>([]);
  const [napaka, setNapaka] = useState("");
  const [hover, setHover] = useState<number | null>(null);
  const okvir = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = okvir.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const [od, doo] = razpon(obdobje, mojOd, mojDo);

  const nalozi = useCallback(async () => {
    setNapaka("");
    const doKonca = new Date(doo); doKonca.setDate(doKonca.getDate() + 1);
    const [a, b, c] = await Promise.all([
      supabase.from("naslovi_terena").select("id, rezultat, obdelal, obdelano")
        .not("obdelano", "is", null).gte("obdelano", `${od}T00:00:00`).lt("obdelano", `${iso(doKonca)}T00:00:00`).limit(20000),
      supabase.from("razpolozljivost").select("prodajalec_id, datum, od, do, potrjeno").gte("datum", od).lte("datum", doo),
      supabase.from("tereni").select("id, prodajalec_id, status"),
    ]);
    const e = a.error || b.error || c.error;
    if (e) setNapaka(sporociloNapake(e));
    setObiski((a.data as Obisk[]) ?? []);
    setTermini((b.data as Termin[]) ?? []);
    setTereni((c.data as TerenMin[]) ?? []);
  }, [od, doo]);
  useEffect(() => { nalozi(); }, [nalozi]);

  // Kdo je v obsegu: prodajalec samo sebe; vodja/lastnik/administracija vse ali izbranega.
  const fokus = vse ? izbran : profil?.id ?? "";
  const v = (id: string | null) => !fokus || id === fokus;
  const fObiski = obiski.filter((o) => v(o.obdelal));
  const fTermini = termini.filter((t) => t.potrjeno && v(t.prodajalec_id));
  const fTereni = tereni.filter((t) => (t.status === "dodeljen" || t.status === "v_delu") && v(t.prodajalec_id));

  const skupaj = {
    obiski: fObiski.length,
    narocila: fObiski.filter((o) => o.rezultat === "naroceno").length,
    ponovni: fObiski.filter((o) => o.rezultat === "ponovni_obisk").length,
    ure: fTermini.reduce((s, t) => s + ure(t.od, t.do), 0),
    tereni: fTereni.length,
  };

  // Po dnevih
  const dnevi = useMemo(() => {
    const out: { datum: string; obiski: number; narocila: number }[] = [];
    const z = new Date(od), k = new Date(doo);
    for (let d = new Date(z); d <= k && out.length < 92; d.setDate(d.getDate() + 1)) out.push({ datum: iso(d), obiski: 0, narocila: 0 });
    const idx = new Map(out.map((x, i) => [x.datum, i]));
    for (const o of fObiski) {
      const i = idx.get(iso(new Date(o.obdelano)));
      if (i !== undefined) { out[i].obiski++; if (o.rezultat === "naroceno") out[i].narocila++; }
    }
    return out;
  }, [fObiski, od, doo]);

  // Po rezultatih
  const poRezultatih = Object.entries(REZULTATI).map(([k, ime]) => ({ k, ime, n: fObiski.filter((o) => o.rezultat === k).length }));

  // Po prodajalcih
  const vrstice: Vrstica[] = useMemo(() => {
    const ljudje = profili.filter((p) => p.vloga === "prodajalec" || p.vloga === "vodja");
    return ljudje.map((p) => {
      const o = obiski.filter((x) => x.obdelal === p.id);
      return {
        id: p.id, ime: imePriimek(p),
        obiski: o.length,
        narocila: o.filter((x) => x.rezultat === "naroceno").length,
        ponovni: o.filter((x) => x.rezultat === "ponovni_obisk").length,
        ure: termini.filter((t) => t.potrjeno && t.prodajalec_id === p.id).reduce((s, t) => s + ure(t.od, t.do), 0),
        tereni: tereni.filter((t) => t.prodajalec_id === p.id && (t.status === "dodeljen" || t.status === "v_delu")).length,
      };
    }).filter((r) => r.obiski || r.ure || r.tereni || profili.find((p) => p.id === r.id)?.aktiven)
      .sort((a, b) => b.narocila - a.narocila || b.obiski - a.obiski);
  }, [profili, obiski, termini, tereni]);

  const max = Math.max(1, ...dnevi.map((d) => d.obiski));
  const H = 220, pad = { l: 32, r: 8, t: 12, b: 26 };
  const bw = (W - pad.l - pad.r) / Math.max(1, dnevi.length);
  const y = (n: number) => pad.t + (H - pad.t - pad.b) * (1 - n / max);
  const korak = max <= 5 ? 1 : Math.ceil(max / 4);
  const oznake = Array.from({ length: Math.floor(max / korak) + 1 }, (_, i) => i * korak);
  const vsakih = Math.ceil(dnevi.length / Math.max(3, Math.floor(W / 70)));
  const h = hover !== null ? dnevi[hover] : null;

  return (
    <section>
      <div className="head">
        <h2>{vse ? "Statistika ekipe" : "Moja statistika"}</h2>
      </div>

      <div className="filters">
        <div className="seg">
          {([["teden", "Ta teden"], ["mesec", "Ta mesec"], ["prejsnji", "Prejšnji mesec"], ["30", "Zadnjih 30 dni"], ["meri", "Po meri"]] as [Obdobje, string][]).map(([k, t]) => (
            <button key={k} className={obdobje === k ? "on" : ""} onClick={() => setObdobje(k)}>{t}</button>
          ))}
        </div>
        {obdobje === "meri" && <>
          <input type="date" value={mojOd} onChange={(e) => setMojOd(e.target.value)} aria-label="Od" />
          <input type="date" value={mojDo} onChange={(e) => setMojDo(e.target.value)} aria-label="Do" />
        </>}
        {vse && (
          <select value={izbran} onChange={(e) => setIzbran(e.target.value)}>
            <option value="">Vsa ekipa</option>
            {vrstice.map((r) => <option key={r.id} value={r.id}>{r.ime}</option>)}
          </select>
        )}
      </div>
      {napaka && <p className="error">{napaka}</p>}

      <div className="kpis">
        <div className="kpi"><span>Naročila</span><b>{stevilo(skupaj.narocila)}</b><small>konverzija {odstotek(skupaj.narocila, skupaj.obiski)}</small></div>
        <div className="kpi"><span>Obiskani naslovi</span><b>{stevilo(skupaj.obiski)}</b><small>{stevilo(skupaj.ponovni)} za ponovni obisk</small></div>
        <div className="kpi"><span>Ure na terenu</span><b>{stevilo(skupaj.ure, 1)}</b><small>potrjena razpoložljivost</small></div>
        <div className="kpi"><span>Naročila na uro</span><b>{skupaj.ure ? stevilo(skupaj.narocila / skupaj.ure, 2) : "—"}</b><small>aktivni tereni: {stevilo(skupaj.tereni)}</small></div>
      </div>

      <div className="card">
        <h3 className="flush">Obiski po dnevih</h3>
        <p className="small muted">Temnejši del stolpca so obiski, ki so se končali z naročilom.</p>
        {skupaj.obiski === 0 && <p className="muted">V tem obdobju še ni zabeleženih obiskov.</p>}
        {(
          <div className="chart" ref={okvir}>
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Obiski in naročila po dnevih" onMouseLeave={() => setHover(null)}>
              {oznake.map((n) => (
                <g key={n}>
                  <line x1={pad.l} x2={W - pad.r} y1={y(n)} y2={y(n)} className="grid" />
                  <text x={pad.l - 6} y={y(n) + 4} textAnchor="end" className="axis">{n}</text>
                </g>
              ))}
              {dnevi.map((d, i) => {
                const x = pad.l + i * bw + Math.min(2, bw * 0.1), w = Math.max(2, bw - Math.min(4, bw * 0.2));
                return (
                  <g key={d.datum} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
                    <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
                    {d.obiski > 0 && <rect x={x} y={y(d.obiski)} width={w} height={y(0) - y(d.obiski)} rx={Math.min(3, w / 2)} className={`bar ${hover === i ? "hl" : ""}`} />}
                    {d.narocila > 0 && <rect x={x} y={y(d.narocila)} width={w} height={y(0) - y(d.narocila)} rx={Math.min(3, w / 2)} className="bar2" />}
                    {i % vsakih === 0 && <text x={x + w / 2} y={H - 8} textAnchor="middle" className="axis">{Number(d.datum.slice(8))}. {Number(d.datum.slice(5, 7))}.</text>}
                  </g>
                );
              })}
              <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} className="base" />
            </svg>
            {h && (
              <div className="tip" style={{ left: `${((pad.l + (hover! + 0.5) * bw) / W) * 100}%` }}>
                <b>{Number(h.datum.slice(8))}. {Number(h.datum.slice(5, 7))}. {h.datum.slice(0, 4)}</b>
                <span>Obiski: {h.obiski}</span><span>Naročila: {h.narocila}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="flush">Izid obiskov</h3>
        <div className="bars">
          {poRezultatih.map((r) => (
            <div className="hbar" key={r.k}>
              <span>{r.ime}</span>
              <div className="track"><div className={`fill ${r.k === "naroceno" ? "strong" : ""}`} style={{ width: `${skupaj.obiski ? (r.n / skupaj.obiski) * 100 : 0}%` }} /></div>
              <b>{r.n}</b>
              <small>{odstotek(r.n, skupaj.obiski)}</small>
            </div>
          ))}
        </div>
      </div>

      {vse && (
        <div className="card">
          <h3 className="flush">Po prodajalcih</h3>
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Prodajalec</th><th>Naročila</th><th>Obiski</th><th>Konverzija</th><th>Ponovni</th><th>Ure</th><th>Nar./uro</th><th>Tereni</th></tr></thead>
              <tbody>
                {vrstice.map((r) => (
                  <tr key={r.id} className={izbran === r.id ? "sel" : ""} onClick={() => setIzbran(izbran === r.id ? "" : r.id)}>
                    <td>{r.ime}</td><td><b>{r.narocila}</b></td><td>{r.obiski}</td><td>{odstotek(r.narocila, r.obiski)}</td>
                    <td>{r.ponovni}</td><td>{stevilo(r.ure, 1)}</td><td>{r.ure ? stevilo(r.narocila / r.ure, 2) : "—"}</td><td>{r.tereni}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">Klik na vrstico prikaže statistiko samo za tega prodajalca.</p>
        </div>
      )}
      <p className="small muted">Naročila se zaenkrat štejejo iz obiskov z izidom »Naročeno«. Ko bodo v aplikaciji naročilnice, se bodo štela oddana in potrjena naročila.</p>
    </section>
  );
}
