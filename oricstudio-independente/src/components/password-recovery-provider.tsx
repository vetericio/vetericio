import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { watchPasswordRecovery } from "@/lib/password-recovery";

const RecoveryContext = createContext({ validating: true, valid: false });

export function PasswordRecoveryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({ validating: true, valid: false });
  const navigate = useNavigate();
  useEffect(() => watchPasswordRecovery(supabase.auth, window.location.hash, setState, () => {
    if (!["/reset-password", "/redefinir-senha"].includes(window.location.pathname)) {
      void navigate({ to: "/reset-password", replace: true });
    }
  }), [navigate]);
  return <RecoveryContext.Provider value={state}>{children}</RecoveryContext.Provider>;
}

export function usePasswordRecovery() { return useContext(RecoveryContext); }