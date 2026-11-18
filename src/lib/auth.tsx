import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, type Profil } from "./supabase";

interface AuthStanje {
  seja: Session | null;
  profil: Profil | null;
  nalaganje: boolean;
  osvezi: () => Promise<void>;
  odjava: () => Promise<void>;
}

const Ctx = createContext<AuthStanje>(null as unknown as AuthStanje);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [seja, setSeja] = useState<Session | null>(null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [nalaganje, setNalaganje] = useState(true);

  const naloziProfil = useCallback(async (s: Session | null) => {
    if (!s) { setProfil(null); return; }
    const { data } = await supabase.from("profili").select("*").eq("id", s.user.id).single();
    setProfil((data as Profil) ?? null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSeja(data.session);
      await naloziProfil(data.session);
      setNalaganje(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSeja(s);
      setTimeout(() => naloziProfil(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [naloziProfil]);

  const osvezi = useCallback(() => naloziProfil(seja), [naloziProfil, seja]);
  const odjava = useCallback(async () => { await supabase.auth.signOut(); setProfil(null); }, []);

  return <Ctx.Provider value={{ seja, profil, nalaganje, osvezi, odjava }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
