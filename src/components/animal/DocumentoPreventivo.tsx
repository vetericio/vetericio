import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { obterDocumentoPreventivo } from "@/lib/documento-preventivo.functions";
import type { DadosDocumentoPreventivo } from "@/lib/documento-preventivo-pdf";
import type { TipoPreventivo } from "@/lib/dados-preventivos";

const identificacaoVazia = {
  municipio: "", razaoSocial: "", cnpj: "", endereco: "", crmv: "", inscricaoEstadual: "",
  enderecoProfissional: "", telefoneProfissional: "", emailProfissional: "",
};
const contatos = [
  ["enderecoProfissional", "Endereço profissional"],
  ["telefoneProfissional", "Telefone profissional"],
  ["emailProfissional", "E-mail profissional"],
] as const;
const campos = [
  ["razaoSocial", "Razão social do estabelecimento"],
  ["cnpj", "CNPJ do estabelecimento"],
  ["endereco", "Endereço completo do estabelecimento"],
  ["crmv", "Registro do estabelecimento no CRMV"],
  ["inscricaoEstadual", "Inscrição estadual (quando aplicável)"],
] as const;

export function DocumentoPreventivo({ clinicaId, animalId, registroId, tipo, onClose }: {
  clinicaId: string; animalId: string; registroId: string; tipo: TipoPreventivo; onClose: () => void;
}) {
  const [dados, setDados] = useState<DadosDocumentoPreventivo | null>(null);
  const [identificacao, setIdentificacao] = useState(identificacaoVazia);
  const [comEstabelecimento, setComEstabelecimento] = useState(true);
  const [erro, setErro] = useState("");
  const [gerando, setGerando] = useState(false);
  const titulo = tipo === "vacina" ? "Atestado de vacinação" : "Comprovante de vermifugação";

  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const { data: sessao } = await supabase.auth.getSession();
        const accessToken = sessao.session?.access_token;
        if (!accessToken) throw new Error("Entre novamente para preparar o documento.");
        const resposta = await obterDocumentoPreventivo({ data: { accessToken, clinicaId, animalId, registroId, tipo } });
        if (!ativo) return;
        setIdentificacao({
          municipio: resposta.estabelecimento.municipio,
          razaoSocial: resposta.estabelecimento.nome,
          cnpj: resposta.estabelecimento.cnpj,
          endereco: resposta.estabelecimento.endereco,
          crmv: resposta.estabelecimento.crmv,
          inscricaoEstadual: resposta.estabelecimento.inscricaoEstadual,
          enderecoProfissional: resposta.profissional.endereco,
          telefoneProfissional: resposta.profissional.telefone,
          emailProfissional: resposta.profissional.email,
        });
        setDados(resposta);
      } catch (falha) {
        if (ativo) setErro(falha instanceof Error ? falha.message : "Não foi possível preparar o PDF.");
      }
    })();
    return () => { ativo = false; };
  }, [clinicaId, animalId, registroId, tipo]);

  async function baixar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dados || gerando) return;
    if (comEstabelecimento && !/^[0-9A-Z]{12}\d{2}$/i.test(identificacao.cnpj.replace(/[.\-/\s]/g, ""))) {
      setErro("Informe um CNPJ com 14 caracteres.");
      return;
    }
    if (comEstabelecimento && campos.some(([chave]) => chave !== "inscricaoEstadual" && !identificacao[chave].trim())) {
      setErro("Complete os dados de identificação do estabelecimento.");
      return;
    }
    if (!identificacao.municipio.trim() || contatos.some(([chave]) => !identificacao[chave].trim())) {
      setErro("Complete o município de emissão e os contatos profissionais.");
      return;
    }
    setGerando(true);
    setErro("");
    try {
      const { criarDocumentoPreventivoPdf } = await import("@/lib/documento-preventivo-pdf");
      const pdf = await criarDocumentoPreventivoPdf(dados, { ...identificacao, comEstabelecimento });
      pdf.save(`${tipo === "vacina" ? "atestado-vacinacao" : "comprovante-vermifugacao"}-${registroId.slice(0, 8)}.pdf`);
    } catch {
      setErro("Não foi possível gerar o PDF.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="titulo-documento-preventivo"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id="titulo-documento-preventivo" className="text-xl font-black">{titulo}</h2>
          <button type="button" aria-label="Fechar documento" className="rounded-lg p-2 hover:bg-muted" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {erro && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{erro}</p>}
        {!dados && !erro && <p role="status" className="mt-3 text-sm">Conferindo os dados do procedimento…</p>}
        {dados && (
          <form className="mt-3 space-y-4" onSubmit={baixar}>
            <p className="text-sm text-muted-foreground">
              Confira os dados de emissão e assine o PDF. Na ficha do animal, abra Documentos e anexe o arquivo assinado com o tipo <strong>{titulo}</strong>. Marque Visível no Portal do Tutor para entregar a via ao responsável.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {([["municipio", "Município e UF de emissão"], ...contatos] as const).map(([chave, rotulo]) => (
                <label key={chave} className="text-sm font-bold">
                  {rotulo}
                  <input value={identificacao[chave]} maxLength={220} required
                    type={chave === "emailProfissional" ? "email" : chave === "telefoneProfissional" ? "tel" : "text"}
                    onChange={e => setIdentificacao(atual => ({ ...atual, [chave]: e.target.value }))}
                    className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" />
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={comEstabelecimento} onChange={e => setComEstabelecimento(e.target.checked)} />
              Procedimento vinculado a estabelecimento veterinário
            </label>
            {comEstabelecimento && <div className="grid gap-3 sm:grid-cols-2">
              {campos.map(([chave, rotulo]) => (
                <label key={chave} className={`text-sm font-bold ${chave === "endereco" || chave === "razaoSocial" ? "sm:col-span-2" : ""}`}>
                  {rotulo}
                  <input value={identificacao[chave]} maxLength={220} required={chave !== "inscricaoEstadual"}
                    onChange={e => setIdentificacao(atual => ({ ...atual, [chave]: e.target.value }))}
                    className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" />
                </label>
              ))}
            </div>}
            <button type="submit" disabled={gerando}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-60">
              <Download size={16} /> {gerando ? "Gerando…" : "Baixar PDF para assinatura"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
