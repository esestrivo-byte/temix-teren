import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { VLOGE, imePriimek } from "./lib/supabase";
import Prijava from "./pages/Prijava";
import SpremeniGeslo from "./pages/SpremeniGeslo";
import Tereni from "./pages/Tereni";
import TerenPodrobno from "./pages/TerenPodrobno";
import Razpolozljivost from "./pages/Razpolozljivost";
import Ekipa from "./pages/Ekipa";

export default function App() {
  const { seja, profil, nalaganje, odjava } = useAuth();

  if (nalaganje) return <div className="center muted">Nalagam …</div>;
  if (!seja) return <Prijava />;
  if (!profil) {
    return (
      <div className="center">
        <p>Vaš račun nima profila ali je onemogočen. Obrnite se na vodjo.</p>
        <button onClick={odjava}>Odjava</button>
      </div>
    );
  }
  if (profil.mora_spremeniti_geslo) return <SpremeniGeslo prvic />;

  const vodja = profil.vloga === "vodja";
  return (
    <div className="app">
      <header className="top">
        <div className="brand">Temix <span>teren</span></div>
        <nav>
          <NavLink to="/tereni">Tereni</NavLink>
          <NavLink to="/razpolozljivost">Razpoložljivost</NavLink>
          {vodja && <NavLink to="/ekipa">Ekipa</NavLink>}
          <NavLink to="/geslo">Geslo</NavLink>
        </nav>
        <div className="who">
          <span>{imePriimek(profil)} · {VLOGE[profil.vloga]}</span>
          <button className="link" onClick={odjava}>Odjava</button>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/tereni" element={<Tereni />} />
          <Route path="/tereni/:id" element={<TerenPodrobno />} />
          <Route path="/razpolozljivost" element={<Razpolozljivost />} />
          <Route path="/ekipa" element={vodja ? <Ekipa /> : <Navigate to="/tereni" />} />
          <Route path="/geslo" element={<SpremeniGeslo />} />
          <Route path="*" element={<Navigate to="/tereni" />} />
        </Routes>
      </main>
    </div>
  );
}
