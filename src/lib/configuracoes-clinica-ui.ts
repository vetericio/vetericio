import { supabase } from "@/integrations/supabase/client";
import { baixarPdfPadraoTermos } from "@/lib/configuracoes-clinica.functions";

export async function tokenConfiguracoesClinica() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sessão expirada. Entre novamente.");
  return data.session.access_token;
}

export async function salvarCopiaPdfPadrao(clinicaId: string) {
  const accessToken = await tokenConfiguracoesClinica();
  const { nome, base64 } = await baixarPdfPadraoTermos({ data: { accessToken, clinicaId } });
  const bytes = Uint8Array.from(atob(base64), (caractere) => caractere.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
