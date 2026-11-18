import { useCallback, useEffect, useState } from "react";
import { supabase, type Profil } from "./supabase";

export function useProfili() {
  const [profili, setProfili] = useState<Profil[]>([]);
  const nalozi = useCallback(async () => {
    const { data } = await supabase.from("profili").select("*").order("ime");
    setProfili((data as Profil[]) ?? []);
  }, []);
  useEffect(() => { nalozi(); }, [nalozi]);
  return { profili, nalozi, poId: (id?: string | null) => profili.find((p) => p.id === id) };
}
