export const MOTIVOS_NAO_ENVIAR_RECEITA = [
  "Tutor solicitou não receber no portal",
  "Receita será entregue apenas presencialmente",
  "Prescrição destinada somente ao uso durante internação",
  "Documento ainda está em revisão",
  "Receita será substituída ou corrigida",
  "Receita duplicada",
  "Dados do tutor ou paciente precisam de conferência",
  "Prescrição de uso interno da clínica",
  "Receita cancelada pelo médico-veterinário",
  "Restrição administrativa ou documental",
  "Outro",
] as const;

export type PreferenciaReceitaPortal = {
  enviar: boolean;
  motivo: string;
  outro: string;
};

let preferencia: PreferenciaReceitaPortal = {
  enviar: true,
  motivo: "",
  outro: "",
};

export function definirPreferenciaReceitaPortal(valor: PreferenciaReceitaPortal) {
  preferencia = { ...valor };
}

export function lerPreferenciaReceitaPortal(): PreferenciaReceitaPortal {
  return { ...preferencia };
}

export function motivoFinalReceitaPortal(valor = preferencia) {
  if (valor.enviar) return null;
  if (valor.motivo === "Outro") return valor.outro.trim() || null;
  return valor.motivo.trim() || null;
}
