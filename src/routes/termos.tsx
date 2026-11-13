import { toast } from "sonner";
import { obterModeloDocumentoEmissao, obterNomePdfPadraoTermos } from "@/lib/configuracoes-clinica.functions";
import { salvarCopiaPdfPadrao, tokenConfiguracoesClinica } from "@/lib/configuracoes-clinica-ui";
import { ModelosClinicosAtendimento } from "@/components/ModelosClinicosAtendimento";
import { preencherTextoDocumento, valoresModeloDocumento } from "@/lib/modelos-documentos";
import { oricseStorage } from "@/lib/oricse-storage";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, FilePlus2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/termos")({ component: Termos });
const CHAVE = "vetericio-termos-clinica";
const PADROES = ["Termo de consentimento", "Termo de responsabilidade", "Autorização para procedimento", "Outro termo"];

function Termos() {
  const [modelos, setModelos] = useState<string[]>(PADROES);
  const [selecionado, setSelecionado] = useState("");
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [padrao, setPadrao] = useState<Awaited<ReturnType<typeof obterModeloDocumentoEmissao>> | null>(null);
  useEffect(() => {
    let ativo = true;
    void (async () => {
      const accessToken = await tokenConfiguracoesClinica();
      const { clinicaId } = await obterNomePdfPadraoTermos({ data: { accessToken } });
      const configuracao = await obterModeloDocumentoEmissao({ data: { accessToken, clinicaId, tipo: "termo" } });
      if (ativo) setPadrao(configuracao);
    })().catch((erro: Error) => { if (ativo) toast.error(erro.message); });
    return () => { ativo = false; };
  }, []);
  useEffect(() => { try { const salvo = JSON.parse(oricseStorage.getItem(CHAVE) || "[]"); if (Array.isArray(salvo)) setModelos([...PADROES, ...salvo.map((x: { nome?: string }) => x.nome).filter((nome): nome is string => Boolean(nome))]); } catch { /* padrões permanecem */ } }, []);
  const adicionar = () => { const nome = window.prompt("Nome do termo"); if (!nome?.trim()) return; setModelos((m) => [...m, nome.trim()]); setSelecionado(nome.trim()); setTexto(""); };
  const abrir = (nome: string) => { setSelecionado(nome); setTexto(`TERMO: ${nome.toUpperCase()}\n\nIdentificação do tutor: ______________________________\nIdentificação do animal: _____________________________\n\nDeclaro estar ciente e de acordo com as informações deste termo:\n\n`);
    if (padrao?.modelo.texto) setTexto(preencherTextoDocumento(padrao.modelo.texto, valoresModeloDocumento(padrao.identidade, {
      paciente: "", tutor: "", data: new Date().toLocaleDateString("pt-BR"),
    })));
  };
  async function salvarPdf() {
    if (!selecionado || !texto.trim() || !padrao || ocupado) return;
    if (/\{\{[a-z_]+\}\}/.test(texto)) {
      toast.error("Preencha os campos pendentes no texto do termo.");
      return;
    }
    setOcupado(true);
    try {
      const { criarPdfComModelo, prepararPapelDocumento } = await import("@/lib/modelos-documentos-pdf");
      const papel = await prepararPapelDocumento(padrao.identidade, padrao.modelo);
      const pdf = await criarPdfComModelo({ titulo: selecionado, conteudo: texto, papel });
      pdf.save("termo-clinico.pdf");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível gerar o termo.");
    } finally { setOcupado(false); }
  }
  const importar = (arquivo: File | undefined) => { if (!arquivo) return; const leitor = new FileReader(); leitor.onload = () => { const nome = arquivo.name.replace(/\.[^.]+$/, ""); setModelos((m) => [...m, nome]); setSelecionado(nome); setTexto(String(leitor.result || "")); const existentes = JSON.parse(oricseStorage.getItem(CHAVE) || "[]"); oricseStorage.setItem(CHAVE, JSON.stringify([...existentes, { nome, texto: String(leitor.result || "") }])); }; leitor.readAsText(arquivo); };
  return <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-28 pt-6 sm:px-6"><PdfPadraoDaClinica /><ModelosClinicosAtendimento/><Link to="/consultorio" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar</Link><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-wider text-primary">Consultório</p><h1 className="text-3xl font-bold">Termos e documentos</h1><p className="mt-1 text-muted-foreground">Escolha um termo, edite os dados e gere o PDF.</p></div><div className="flex gap-2"><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-semibold hover:bg-secondary"><Upload size={18}/> Enviar modelo<input type="file" accept=".txt,.md" className="hidden" onChange={e => importar(e.target.files?.[0])}/></label><button type="button" onClick={adicionar} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"><FilePlus2 size={18}/> Adicionar termo</button></div></div><section className="mt-7 rounded-2xl border bg-card p-5"><label className="block text-sm font-semibold">Selecione o termo<select value={selecionado} onChange={e => abrir(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 font-normal"><option value="">Escolha um modelo...</option>{modelos.map((m, i) => <option key={`${m}-${i}`} value={m}>{m}</option>)}</select></label></section>{selecionado && <section className="mt-5 rounded-2xl border bg-card p-5"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Editando: {selecionado}</h2><button type="button" onClick={() => { setSelecionado(""); setTexto(""); }} className="rounded-lg p-2 hover:bg-secondary"><X size={18}/></button></div><textarea value={texto} onChange={e => setTexto(e.target.value)} rows={18} className="mt-4 w-full rounded-xl border bg-background p-4 font-normal leading-relaxed" placeholder="Digite o conteúdo do termo..."/><button type="button" onClick={() => void salvarPdf()} disabled={ocupado || !padrao} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground"><Download size={18}/> Salvar como PDF</button></section>}</main>;
}

function PdfPadraoDaClinica() {
  const [pdf, setPdf] = useState<Awaited<ReturnType<typeof obterNomePdfPadraoTermos>> | null>(null);
  const [baixando, setBaixando] = useState(false);
  useEffect(() => {
    let ativo = true;
    tokenConfiguracoesClinica()
      .then((accessToken) => obterNomePdfPadraoTermos({ data: { accessToken } }))
      .then((dados) => { if (ativo) setPdf(dados); })
      .catch(() => {});
    return () => { ativo = false; };
  }, []);
  if (!pdf?.nome) return null;
  async function baixar(clinicaId: string) {
    setBaixando(true);
    try {
      await salvarCopiaPdfPadrao(clinicaId);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBaixando(false);
    }
  }
  return (
    <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
      <div className="min-w-0">
        <h2 className="font-semibold">PDF padrão da clínica</h2>
        <p className="break-all text-sm text-muted-foreground">{pdf.nome}</p>
      </div>
      <button type="button" disabled={baixando} onClick={() => void baixar(pdf.clinicaId)}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-semibold hover:bg-muted disabled:opacity-50">
        <Download size={16} /> {baixando ? "Baixando…" : "Baixar PDF padrão"}
      </button>
    </section>
  );
}
