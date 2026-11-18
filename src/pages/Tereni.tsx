import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useProfili } from "../lib/hooks";
import {
  REGIJE, STATUSI_TERENA, datumSl, imePriimek, sporociloNapake, supabase,
  type StatusTerena, type Teren,
} from "../lib/supabase";

const prazen = {
  naziv: "", regija: "", kraj: "", tehnologija: "", velja_od: "", velja_do: "",
  prodajalec_id: "", opombe: "", naslovi: "",
};

export default function Tereni() {
  const { profil } = useAuth();
  const vodja = profil?.vloga === "vodja";
  const { profili, poId } = useProfili();
  const [tereni, setTereni] = useState<Teren[]>([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterProdajalec, setFilterProdajalec] = useState("");
  const [iskanje, setIskanje] = useState("");
  const [obrazec, setObrazec] = useState<typeof prazen | null>(null);
  const [napaka, setNapaka] = useState("");

  const nalozi = useCallback(async () => {
    const { data, error } = await supabase.from("tereni").select("*").order("posodobljeno", { ascending: false });
    if (error) setNapaka(sporociloNapake(error));
    setTereni((data as Teren[]) ?? []);
  }, []);
  useEffect(() => { nalozi(); }, [nalozi]);

  const prodajalci = profili.filter((p) => p.aktiven && (p.vloga === "prodajalec" || p.vloga === "vodja"));

  const prikazani = useMemo(() => tereni.filter((t) =>
    (!filterStatus || t.status === filterStatus) &&
    (!filterProdajalec || (filterProdajalec === "-" ? !t.prodajalec_id : t.prodajalec_id === filterProdajalec)) &&
    (!iskanje || `${t.naziv} ${t.kraj ?? ""} ${t.regija ?? ""}`.toLowerCase().includes(iskanje.toLowerCase())),
  ), [tereni, filterStatus, filterProdajalec, iskanje]);

  async function shrani(e: FormEvent) {
    e.preventDefault();
    if (!obrazec) return;
    setNapaka("");
    const { naslovi, ...polja } = obrazec;
    const zapis = {
      ...Object.fromEntries(Object.entries(polja).map(([k, v]) => [k, v === "" ? null : v])),
      status: (obrazec.prodajalec_id ? "dodeljen" : "prost") as StatusTerena,
    };
    const { data, error } = await supabase.from("tereni").insert(zapis).select("id").single();
    if (error) return setNapaka(sporociloNapake(error));
    const vrstice = naslovi.split("\n").map((s) => s.trim()).filter(Boolean);
    if (vrstice.length) {
      const { error: e2 } = await supabase.from("naslovi_terena")
        .insert(vrstice.map((naslov) => ({ teren_id: data.id, naslov })));
      if (e2) setNapaka(sporociloNapake(e2));
    }
    setObrazec(null);
    nalozi();
  }

  async function spremeniStatus(t: Teren, status: StatusTerena) {
    const { error } = await supabase.from("tereni").update({ status }).eq("id", t.id);
    if (error) return setNapaka(sporociloNapake(error));
    nalozi();
  }

  const nastavi = (k: keyof typeof prazen) => (e: { target: { value: string } }) =>
    setObrazec((o) => (o ? { ...o, [k]: e.target.value } : o));

  return (
    <section>
      <div className="head">
        <h2>{profil?.vloga === "prodajalec" ? "Moji tereni" : "Tereni"}</h2>
        {vodja && !obrazec && <button className="primary" onClick={() => setObrazec({ ...prazen })}>+ Nov teren</button>}
      </div>
      {napaka && <p className="error">{napaka}</p>}

      {obrazec && (
        <form className="card grid" onSubmit={shrani}>
          <h3 className="full">Nov teren</h3>
          <label className="full">Naziv<input value={obrazec.naziv} onChange={nastavi("naziv")} required placeholder="npr. Ljubljana Bežigrad – sever" /></label>
          <label>Regija<select value={obrazec.regija} onChange={nastavi("regija")}><option value="">—</option>{REGIJE.map((r) => <option key={r}>{r}</option>)}</select></label>
          <label>Kraj<input value={obrazec.kraj} onChange={nastavi("kraj")} /></label>
          <label>Tehnologija<select value={obrazec.tehnologija} onChange={nastavi("tehnologija")}><option value="">—</option><option>FTTH</option><option>HFC</option><option>FTTH/HFC</option></select></label>
          <label>Prodajalec<select value={obrazec.prodajalec_id} onChange={nastavi("prodajalec_id")}><option value="">(nedodeljen)</option>{prodajalci.map((p) => <option key={p.id} value={p.id}>{imePriimek(p)}</option>)}</select></label>
          <label>Velja od<input type="date" value={obrazec.velja_od} onChange={nastavi("velja_od")} /></label>
          <label>Velja do<input type="date" value={obrazec.velja_do} onChange={nastavi("velja_do")} /></label>
          <label className="full">Naslovi (en naslov v vrstico)<textarea rows={5} value={obrazec.naslovi} onChange={nastavi("naslovi")} placeholder={"Dunajska cesta 101\nDunajska cesta 103"} /></label>
          <label className="full">Opombe<textarea rows={2} value={obrazec.opombe} onChange={nastavi("opombe")} /></label>
          <div className="full actions">
            <button type="button" onClick={() => setObrazec(null)}>Prekliči</button>
            <button className="primary">Shrani teren</button>
          </div>
        </form>
      )}

      <div className="filters">
        <input placeholder="Išči naziv, kraj, regijo" value={iskanje} onChange={(e) => setIskanje(e.target.value)} />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">Vsi statusi</option>
          {Object.entries(STATUSI_TERENA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {vodja && (
          <select value={filterProdajalec} onChange={(e) => setFilterProdajalec(e.target.value)}>
            <option value="">Vsi prodajalci</option>
            <option value="-">Nedodeljeni</option>
            {prodajalci.map((p) => <option key={p.id} value={p.id}>{imePriimek(p)}</option>)}
          </select>
        )}
      </div>

      {prikazani.length === 0 ? (
        <p className="muted">{vodja ? "Ni terenov. Dodajte prvega z gumbom Nov teren." : "Trenutno nimate dodeljenih terenov."}</p>
      ) : (
        <div className="list">
          {prikazani.map((t) => (
            <div className="card row" key={t.id}>
              <div className="grow">
                <Link to={`/tereni/${t.id}`} className="title">{t.naziv}</Link>
                <div className="muted small">
                  {[t.kraj, t.regija, t.tehnologija].filter(Boolean).join(" · ") || "—"}
                  {(t.velja_od || t.velja_do) && <> · {datumSl(t.velja_od)} – {datumSl(t.velja_do)}</>}
                </div>
                {vodja && <div className="small">Prodajalec: {imePriimek(poId(t.prodajalec_id))}</div>}
              </div>
              <select className={`status s-${t.status}`} value={t.status}
                disabled={!vodja && t.prodajalec_id !== profil?.id}
                onChange={(e) => spremeniStatus(t, e.target.value as StatusTerena)}>
                {Object.entries(STATUSI_TERENA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
