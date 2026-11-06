import { createContext, useContext } from "react";

type ClinicasAtivasState = {
  quantidade: number | null;
};

/** A única contagem exibida de clínicas fora da lixeira. */
export const ClinicasAtivasContext = createContext<ClinicasAtivasState>({ quantidade: null });

export function useQuantidadeClinicasAtivas() {
  return useContext(ClinicasAtivasContext).quantidade;
}
