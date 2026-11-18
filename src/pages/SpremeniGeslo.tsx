import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { supabase, sporociloNapake } from "../lib/supabase";

export default function SpremeniGeslo({ prvic = false }: { prvic?: boolean }) {
  const { profil, osvezi, odjava } = useAuth();
  const [g1, setG1] = useState("");
  const [g2, setG2] = useState("");
  const [sporocilo, setSporocilo] = useState("");
  const [napaka, setNapaka] = useState("");

  async function shrani(e: FormEvent) {
    e.preventDefault();
    setNapaka(""); setSporocilo("");
    if (g1.length < 10) return setNapaka("Geslo mora imeti vsaj 10 znakov.");
    if (g1 !== g2) return setNapaka("Gesli se ne ujemata.");
    const { error } = await supabase.auth.updateUser({ password: g1 });
    if (error) return setNapaka(sporociloNapake(error));
    if (profil?.mora_spremeniti_geslo) {
      await supabase.from("profili").update({ mora_spremeniti_geslo: false }).eq("id", profil.id);
    }
    setG1(""); setG2("");
    setSporocilo("Geslo je spremenjeno.");
    await osvezi();
  }

  const form = (
    <form className="card narrow" onSubmit={shrani}>
      <h2>{prvic ? "Nastavite svoje geslo" : "Sprememba gesla"}</h2>
      {prvic && <p className="muted">Ob prvi prijavi si nastavite svoje geslo (vsaj 10 znakov).</p>}
      <label>Novo geslo
        <input type="password" autoComplete="new-password" value={g1} onChange={(e) => setG1(e.target.value)} required />
      </label>
      <label>Ponovite geslo
        <input type="password" autoComplete="new-password" value={g2} onChange={(e) => setG2(e.target.value)} required />
      </label>
      {napaka && <p className="error">{napaka}</p>}
      {sporocilo && <p className="ok">{sporocilo}</p>}
      <button className="primary">Shrani geslo</button>
      {prvic && <button type="button" className="link" onClick={odjava}>Odjava</button>}
    </form>
  );
  return prvic ? <div className="login">{form}</div> : form;
}
