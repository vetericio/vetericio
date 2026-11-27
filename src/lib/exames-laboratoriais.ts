import { oricseStorage } from "@/lib/oricse-storage";
import {
  referenciasComAjustes,
  referenciasVazias,
  type ReferenciasExames,
} from "./exames-laboratoriais-catalogo";

export * from "./exames-laboratoriais-catalogo";
export const CHAVE_REFERENCIAS_EXAMES = "veterico-referencias-exames-v2";

export function carregarReferenciasExames(): ReferenciasExames {
  try {
    if (typeof window === "undefined") return referenciasVazias();
    return referenciasComAjustes(
      JSON.parse(oricseStorage.getItem(CHAVE_REFERENCIAS_EXAMES) ?? "{}"),
    );
  } catch {
    return referenciasVazias();
  }
}

export function salvarReferenciasExames(referencias: ReferenciasExames): boolean {
  try {
    if (typeof window === "undefined") return false;
    oricseStorage.setItem(CHAVE_REFERENCIAS_EXAMES, JSON.stringify(referencias));
    return true;
  } catch {
    return false;
  }
}
