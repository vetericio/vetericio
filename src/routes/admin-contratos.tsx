import { createFileRoute } from "@tanstack/react-router";
import { Check, Clipboard, FilePlus2, FileText, Link2, RefreshCw, Upload, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  cancelarContrato,
  criarLinkContrato,
  criarModeloContrato,
  listarContratos,
  listarModelosContratos,
  obterDownloadContratoAdmin,
} from "@/lib/contratos.functions";
import { lerArquivoComoDataUri, rotuloCampoContrato } from "@/lib/contratos-pdf";

export const Route = createFileRoute("/admin-contratos")({ component: AdminContratos });

type Modelo = {
  id: string;
  titulo: string;
  descricao: string;
  conteudo: string;
  campos: string[];
  created_at: string;
};
type Contrato = {
  id: string;
  modelo_titulo: string;
  status: string;
  pessoa_nome: string | null;
  pessoa_email: string | null;
  expira_em: string | null;
  created_at: string;
};

function dataHora(valor: string | null) {
  if (!valor) return "—";
  const data = new Date(valor);
  return Number.isNaN(data.getTime())
    ? valor
    : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function AdminContratos() {
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [conteudo, setConteudo] = useState(
    "Eu, {{nome}}, data de nascimento {{data_nascimento}}, declaro que...\n\nAssinatura: ______________________________________",
  );
  const [templatePdfBase64, setTemplatePdfBase64] = useState<string | null>(null);
  const [templatePdfNome, setTemplatePdfNome] = useState("");
  const [linkGerado, setLinkGerado] = useState("");

  async function tokenAdmin() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Faça login novamente para gerenciar contratos.");
    return token;
  }

  async function carregar() {
    setCarregando(true);
    try {
      const accessToken = await tokenAdmin();
      const [modelosResp, contratosResp] = await Promise.all([
        listarModelosContratos({ data: { accessToken } }),
        listarContratos({ data: { accessToken } }),
      ]);
      setModelos(modelosResp.modelos as Modelo[]);
      setContratos(contratosResp.contratos as Contrato[]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível carregar os contratos.",
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function salvarModelo(event: FormEvent) {
    event.preventDefault();
    setSalvando(true);
    try {
      const accessToken = await tokenAdmin();
      await criarModeloContrato({
        data: { accessToken, titulo, descricao, conteudo, templatePdfBase64 },
      });
      toast.success("Modelo de contrato salvo.");
      setTitulo("");
      setDescricao("");
      setConteudo(
        "Eu, {{nome}}, data de nascimento {{data_nascimento}}, declaro que...\n\nAssinatura: ______________________________________",
      );
      setTemplatePdfBase64(null);
      setTemplatePdfNome("");
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o modelo.");
    } finally {
      setSalvando(false);
    }
  }

  async function gerarLink(modeloId: string) {
    try {
      const accessToken = await tokenAdmin();
      const resposta = await criarLinkContrato({
        data: { accessToken, modeloId, validadeDias: 30 },
      });
      const link = window.location.origin + "/contrato/" + resposta.token;
      setLinkGerado(link);
      await navigator.clipboard?.writeText(link);
      toast.success("Link gerado e copiado.");
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o link.");
    }
  }

  async function copiar(link: string) {
    await navigator.clipboard?.writeText(link);
    toast.success("Link copiado.");
  }

  async function cancelar(id: string) {
    if (!window.confirm("Cancelar este link de contrato?")) return;
    try {
      const accessToken = await tokenAdmin();
      await cancelarContrato({ data: { accessToken, contratoId: id } });
      toast.success("Link cancelado.");
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível cancelar o link.");
    }
  }

  async function baixarVersao(contratoId: string, tipo: "em_branco" | "assinado") {
    try {
      const accessToken = await tokenAdmin();
      const resposta = await obterDownloadContratoAdmin({
        data: { accessToken, contratoId, tipo },
      });
      window.open(resposta.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível preparar o download.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f4ef] px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
              Administração ORICSE
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Contratos</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Crie um modelo com campos, envie um link e receba o documento preenchido e assinado.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void carregar()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-bold"
          >
            <RefreshCw size={16} /> Atualizar
          </button>
        </header>

        {linkGerado && (
          <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black">Link pronto para enviar</p>
                <p className="mt-1 break-all font-mono text-sm">{linkGerado}</p>
              </div>
              <button
                type="button"
                onClick={() => setLinkGerado("")}
                aria-label="Fechar link"
                className="rounded-lg p-2 hover:bg-emerald-100"
              >
                <X size={17} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => void copiar(linkGerado)}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-3 py-2 text-xs font-bold text-white"
            >
              <Clipboard size={14} /> Copiar novamente
            </button>
          </section>
        )}

        <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
          <form onSubmit={salvarModelo} className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FilePlus2 size={21} />
              </div>
              <div>
                <h2 className="text-xl font-black">Novo modelo</h2>
                <p className="text-sm text-muted-foreground">Use campos entre chaves duplas.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4">
              <label className="text-sm font-bold">
                Título
                <input
                  required
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal"
                  placeholder="Contrato do programa beta"
                />
              </label>
              <label className="text-sm font-bold">
                Descrição
                <input
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal"
                  placeholder="Contrato enviado para participantes"
                />
              </label>
              <label className="text-sm font-bold">
                Conteúdo do documento
                <textarea
                  required
                  value={conteudo}
                  onChange={(e) => setConteudo(e.target.value)}
                  rows={16}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-3 font-mono text-sm font-normal leading-6"
                />
              </label>
              <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold hover:bg-muted">
                <Upload size={16} /> Importar texto (.txt/.md)
                <input
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  className="hidden"
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0];
                    if (!arquivo) return;
                    const leitor = new FileReader();
                    leitor.onload = () => setConteudo(String(leitor.result || ""));
                    leitor.readAsText(arquivo);
                  }}
                />
              </label>
              <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-bold text-primary hover:bg-primary/10">
                <Upload size={16} />
                {templatePdfNome ? `PDF do modelo: ${templatePdfNome}` : "Anexar PDF do modelo"}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0];
                    if (!arquivo) return;
                    if (arquivo.size > 2_500_000) {
                      toast.error("O PDF do modelo deve ter até 2,5 MB.");
                      return;
                    }
                    void lerArquivoComoDataUri(arquivo).then((dataUri) => {
                      setTemplatePdfBase64(dataUri);
                      setTemplatePdfNome(arquivo.name);
                    });
                  }}
                />
              </label>
              <p className="rounded-xl bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                Exemplo: <code>{"{{nome}}"}</code>, <code>{"{{data_nascimento}}"}</code>,{" "}
                <code>{"{{cpf}}"}</code>. A pessoa verá um campo para cada marcador.
              </p>
              <button
                disabled={salvando}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-black text-primary-foreground disabled:opacity-50"
              >
                {salvando ? "Salvando…" : "Salvar modelo"}
              </button>
            </div>
          </form>

          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText size={21} />
              </div>
              <div>
                <h2 className="text-xl font-black">Modelos disponíveis</h2>
                <p className="text-sm text-muted-foreground">
                  Gere links individuais com validade de 30 dias.
                </p>
              </div>
            </div>
            {carregando ? (
              <p className="mt-6 text-sm text-muted-foreground">Carregando…</p>
            ) : modelos.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                Ainda não há modelos. Crie o primeiro ao lado.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {modelos.map((modelo) => (
                  <article key={modelo.id} className="rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black">{modelo.titulo}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {modelo.descricao || "Sem descrição"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void gerarLink(modelo.id)}
                        className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-black text-primary-foreground"
                      >
                        <Link2 size={14} /> Gerar link
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {modelo.campos.map((campo) => (
                        <span
                          key={campo}
                          className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary"
                        >
                          {rotuloCampoContrato(campo)}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Check size={21} />
            </div>
            <div>
              <h2 className="text-xl font-black">Links enviados</h2>
              <p className="text-sm text-muted-foreground">Acompanhe preenchimento e assinatura.</p>
            </div>
          </div>
          {carregando ? (
            <p className="mt-6 text-sm text-muted-foreground">Carregando…</p>
          ) : contratos.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
              Nenhum link foi gerado ainda.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-3">Pessoa</th>
                    <th className="px-3 py-3">Modelo</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Criado</th>
                    <th className="px-3 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contratos.map((contrato) => (
                    <tr key={contrato.id}>
                      <td className="px-3 py-3 font-bold">
                        {contrato.pessoa_nome || "Aguardando preenchimento"}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {contrato.pessoa_email || ""}
                        </span>
                      </td>
                      <td className="px-3 py-3">{contrato.modelo_titulo}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-muted px-2 py-1 text-xs font-bold">
                          {contrato.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {dataHora(contrato.created_at)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void baixarVersao(contrato.id, "em_branco")}
                            className="rounded-lg border px-3 py-2 text-xs font-bold"
                          >
                            Em branco
                          </button>
                          {contrato.status === "assinado" && (
                            <button
                              type="button"
                              onClick={() => void baixarVersao(contrato.id, "assinado")}
                              className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                            >
                              Assinado
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void cancelar(contrato.id)}
                            disabled={contrato.status === "cancelado"}
                            className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40"
                          >
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
