import { useState, type FormEvent } from "react";
import { supabase, sporociloNapake, vEmail } from "../lib/supabase";

export default function Prijava() {
  const [ime, setIme] = useState("");
  const [geslo, setGeslo] = useState("");
  const [napaka, setNapaka] = useState("");
  const [poteka, setPoteka] = useState(false);

  async function prijava(e: FormEvent) {
    e.preventDefault();
    setNapaka(""); setPoteka(true);
    const { error } = await supabase.auth.signInWithPassword({ email: vEmail(ime), password: geslo });
    setPoteka(false);
    if (error) setNapaka(sporociloNapake(error));
  }

  return (
    <div className="login">
      <form className="card" onSubmit={prijava}>
        <h1>Temix <span>teren</span></h1>
        <p className="muted">Prijava za terensko ekipo</p>
        <label>Uporabniško ime
          <input autoFocus autoCapitalize="none" autoComplete="username" value={ime}
            onChange={(e) => setIme(e.target.value)} placeholder="ime.priimek" required />
        </label>
        <label>Geslo
          <input type="password" autoComplete="current-password" value={geslo}
            onChange={(e) => setGeslo(e.target.value)} required />
        </label>
        {napaka && <p className="error">{napaka}</p>}
        <button className="primary" disabled={poteka}>{poteka ? "Prijavljam …" : "Prijava"}</button>
        <p className="muted small">Pozabljeno geslo? Novo vam nastavi vodja.</p>
      </form>
    </div>
  );
}
