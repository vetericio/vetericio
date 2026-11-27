import { useState } from "react";
import { BookOpen, ChevronDown, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

async function consultarManual(acao?: "conexao" | "disponibilidade") {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("Entre novamente para continuar.");
  const response = await fetch(`/api/ajuda/manual${acao ? "?acao=" + acao : ""}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${data.session.access_token}` },
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Entre novamente para continuar.");
    throw new Error("Não foi possível acessar o manual agora. Tente novamente em instantes.");
  }
  return response;
}

export function ManualSistemaMenu({ admin }: { admin: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [disponivel, setDisponivel] = useState<boolean | null>(null);
  const [verificando, setVerificando] = useState(false);
  async function alternar() {
    if (aberto) {
      setAberto(false);
      return;
    }
    setAberto(true);
    if (verificando || disponivel) return;
    setVerificando(true);
    try {
      const resposta = await consultarManual("disponibilidade");
      setDisponivel((await resposta.json()).disponivel === true);
    } catch {
      setDisponivel(false);
    } finally {
      setVerificando(false);
    }
  }
  const [conexao, setConexao] = useState<{ conta: string; disponivel: boolean } | null>(null);
  const [consultando, setConsultando] = useState(false);
  async function baixar() {
    if (ocupado) return;
    setOcupado(true);
    try {
      const response = await consultarManual();
      const pdf = await response.blob();
      if (pdf.type !== "application/pdf" || !pdf.size)
        throw new Error("Não foi possível abrir o PDF do manual.");
      const url = URL.createObjectURL(pdf);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Manual-ORICSE.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível baixar o manual.");
    } finally {
      setOcupado(false);
    }
  }
  async function conferir() {
    setConsultando(true);
    try {
      const resposta = await consultarManual("conexao");
      const estado = await resposta.json();
      setConexao(estado);
      setDisponivel(estado.disponivel === true);
    } catch {
      toast.error("Não foi possível conferir a conexão do manual.");
    } finally {
      setConsultando(false);
    }
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border/70">
      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => void alternar()}
        className="oricse-menu-trigger flex min-h-12 w-full items-center gap-3 px-3 text-left text-sm font-semibold"
      >
        <BookOpen className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="flex-1">Ajuda</span>
        <ChevronDown className={`h-4 w-4 ${aberto ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {aberto && (
        <div className="space-y-2 border-t px-2 py-2">
          {!disponivel && (
            <p role="status" className="px-2 text-xs text-muted-foreground">
              {verificando
                ? "Verificando manual…"
                : "O Manual do Sistema ainda não está disponível."}
            </p>
          )}
          {disponivel && (
            <button
              type="button"
              onClick={() => void baixar()}
              disabled={ocupado}
              className="oricse-menu-item flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold disabled:opacity-60"
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
              {ocupado ? "Baixando manual…" : "Manual do Sistema"}
            </button>
          )}
          {admin && (
            <div className="px-2 pb-1 text-xs">
              <button
                type="button"
                onClick={() => void conferir()}
                disabled={consultando}
                className="min-h-9 underline underline-offset-2"
              >
                {consultando ? "Conferindo…" : "Conferir conexão do manual"}
              </button>
              {conexao && (
                <div className="break-all" role="status">
                  <p>
                    {conexao.disponivel
                      ? "PDF disponível."
                      : "A conta do sistema ainda precisa de acesso ao PDF."}
                  </p>
                  {conexao.conta && <p>{conexao.conta}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
