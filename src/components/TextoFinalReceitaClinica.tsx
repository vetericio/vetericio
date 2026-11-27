import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import {
  obterModelosDocumentoClinica,
  salvarModeloDocumentoClinica,
} from "@/lib/configuracoes-clinica.functions";
import { tokenConfiguracoesClinica } from "@/lib/configuracoes-clinica-ui";
import { limparOrientacoesPadraoReceita } from "@/lib/modelos-documentos";

export function TextoFinalReceitaClinica({ clinicaId }: { clinicaId: string }) {
  const [texto, setTexto] = useState("");
  const [salvo, setSalvo] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    tokenConfiguracoesClinica()
      .then((accessToken) => obterModelosDocumentoClinica({ data: { accessToken, clinicaId } }))
      .then((resposta) => {
        if (!ativo) return;
        const atual = limparOrientacoesPadraoReceita(resposta.modelos.receita.texto);
        setTexto(atual);
        setSalvo(atual);
      })
      .catch((e: Error) => {
        if (ativo) setErro(e.message);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [clinicaId]);

  async function salvar() {
    if (salvando || texto === salvo) return;
    setSalvando(true);
    try {
      const accessToken = await tokenConfiguracoesClinica();
      const resposta = await obterModelosDocumentoClinica({ data: { accessToken, clinicaId } });
      const modelo = { ...resposta.modelos.receita, texto: limparOrientacoesPadraoReceita(texto) };
      await salvarModeloDocumentoClinica({
        data: { accessToken, clinicaId, tipo: "receita", modelo },
      });
      setTexto(modelo.texto);
      setSalvo(modelo.texto);
      toast.success("Texto final da receita salvo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o texto final.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="mb-2 text-lg font-semibold">Texto final da receita</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Este texto entra automaticamente após a prescrição e as orientações individuais, antes da
        data e da assinatura/carimbo. Deixe em branco para não incluir texto final.
      </p>
      {carregando ? (
        <p role="status" className="text-sm">
          Carregando configuração…
        </p>
      ) : erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : (
        <>
          <label className="block text-sm font-semibold">
            Texto padrão da clínica
            <textarea
              rows={6}
              maxLength={25000}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background p-3 font-normal"
            />
          </label>
          <button
            type="button"
            disabled={salvando || texto === salvo}
            onClick={() => void salvar()}
            className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Save size={16} /> {salvando ? "Salvando…" : "Salvar texto final"}
          </button>
        </>
      )}
    </section>
  );
}
