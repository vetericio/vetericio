import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, FileCheck2, FileDown, FileText, LoaderCircle, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  obterContratoPublico,
  obterDownloadContrato,
  salvarArquivoContrato,
  salvarDadosContrato,
} from "@/lib/contratos.functions";
import {
  baixarPdfContrato,
  extrairCamposContrato,
  gerarPdfContrato,
  lerArquivoComoDataUri,
  nomeSeguroContrato,
  rotuloCampoContrato,
} from "@/lib/contratos-pdf";

export const Route = createFileRoute("/contrato/$token")({ component: ContratoPublico });

type Contrato = {
  id: string;
  titulo: string;
  conteudo: string;
  status: string;
  pessoaNome: string | null;
  dados: Record<string, string>;
  templatePdfBase64: string | null;
  templatePdfUrl: string | null;
  expiraEm: string | null;
  campos: string[];
};

function ContratoPublico() {
  const { token } = Route.useParams();
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [dados, setDados] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [enviandoAssinado, setEnviandoAssinado] = useState(false);
  const [erro, setErro] = useState("");
  const [pdfGerado, setPdfGerado] = useState(false);
  const [pdfEmBranco, setPdfEmBranco] = useState("");

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    void obterContratoPublico({ data: { token } })
      .then((resposta) => {
        if (!ativo) return;
        const item = resposta.contrato as Contrato;
        setContrato(item);
        setDados(item.dados || {});
        setPdfGerado(item.status === "preenchido" || item.status === "assinado");
      })
      .catch((error: unknown) => {
        if (ativo)
          setErro(error instanceof Error ? error.message : "Não foi possível abrir este contrato.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [token]);

  const campos = useMemo(
    () => (contrato?.campos || (contrato ? extrairCamposContrato(contrato.conteudo) : [])).filter((campo) => campo !== "data_contrato"),
    [contrato],
  );
  const nomePessoa = dados.representante_legal || dados.razao_social_nome || contrato?.pessoaNome || "Pessoa";

  async function gerarEbaixar() {
    if (!contrato) return;
    const vazios = campos.filter((campo) => !String(dados[campo] || "").trim());
    if (vazios.length) {
      toast.error("Preencha todos os campos antes de gerar o PDF.");
      return;
    }
    setSalvando(true);
    try {
      await salvarDadosContrato({
        data: {
          token,
          pessoaNome: nomePessoa,
          pessoaEmail: dados.email || "",
          dados,
        },
      });
      const dataUri = await gerarPdfContrato(
        contrato.titulo,
        contrato.conteudo,
        dados,
        contrato.templatePdfBase64 || contrato.templatePdfUrl,
      );
      baixarPdfContrato(dataUri, `${nomeSeguroContrato(nomePessoa)} - Em branco.pdf`);
      setPdfEmBranco(dataUri);
      await salvarArquivoContrato({
        data: { token, tipo: "em_branco", base64: dataUri, mimeType: "application/pdf" },
      });
      setPdfGerado(true);
      setContrato({ ...contrato, status: "preenchido", pessoaNome: nomePessoa, dados });
      toast.success("PDF gerado. Assine no gov.br e envie a versão assinada aqui.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o PDF.");
    } finally {
      setSalvando(false);
    }
  }

  async function baixarVersaoEmBranco() {
    if (pdfEmBranco) {
      baixarPdfContrato(pdfEmBranco, `${nomeSeguroContrato(nomePessoa)} - Em branco.pdf`);
      return;
    }
    try {
      const resposta = await obterDownloadContrato({
        data: { token, tipo: "em_branco" },
      });
      baixarPdfContrato(
        "data:application/pdf;base64," + resposta.base64,
        nomeSeguroContrato(nomePessoa) + " - Em branco.pdf",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível baixar o PDF.");
    }
  }

  async function enviarAssinado(arquivo: File | undefined) {
    if (!arquivo) return;
    if (arquivo.type !== "application/pdf") {
      toast.error("Envie somente um PDF assinado.");
      return;
    }
    setEnviandoAssinado(true);
    try {
      const base64 = await lerArquivoComoDataUri(arquivo);
      await salvarArquivoContrato({
        data: { token, tipo: "assinado", base64, mimeType: "application/pdf" },
      });
      setContrato((atual) => (atual ? { ...atual, status: "assinado" } : atual));
      toast.success("Contrato assinado recebido com sucesso.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível receber o PDF assinado.",
      );
    } finally {
      setEnviandoAssinado(false);
    }
  }

  if (carregando) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f8f5f2] text-sm text-[#6d5961]">
        <LoaderCircle className="animate-spin" size={24} />
      </main>
    );
  }

  if (erro || !contrato) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f8f5f2] px-4">
        <section className="w-full max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">
          <FileText className="mx-auto text-[#702a43]" size={32} />
          <h1 className="mt-4 text-2xl font-black text-[#4a1826]">Contrato indisponível</h1>
          <p className="mt-2 text-sm text-[#6d5961]">{erro || "Este link não está disponível."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f5f2] px-4 py-8 text-[#341421] sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9b6072]">
            ORICSE · Contratos
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-[#4a1826] sm:text-4xl">
            {contrato.titulo}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#6d5961]">
            Preencha seus dados. O documento será gerado em PDF para baixar, assinar no gov.br e
            enviar de volta.
          </p>
        </header>

        <section className="mt-7 rounded-3xl border bg-white p-5 shadow-sm sm:p-8">
          <div className="rounded-2xl bg-[#faf2f4] p-4 text-sm text-[#5d3c47]">
            <strong>Como funciona:</strong> preencher → baixar “Em branco” → assinar no gov.br →
            enviar “Assinado”.
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {campos.map((campo) => (
              <label key={campo} className="text-sm font-bold text-[#4a1826]">
                {rotuloCampoContrato(campo)}
                <input
                  required
                  value={dados[campo] || ""}
                  type={
                    campo.toLowerCase().includes("data")
                      ? "date"
                      : campo.toLowerCase().includes("email")
                        ? "email"
                        : "text"
                  }
                  onChange={(event) =>
                    setDados((atual) => ({ ...atual, [campo]: event.target.value }))
                  }
                  className="mt-1 min-h-11 w-full rounded-xl border border-[#e5d5da] bg-white px-3 font-normal outline-none focus:border-[#702a43] focus:ring-2 focus:ring-[#702a43]/10"
                />
              </label>
            ))}
          </div>

          <button
            type="button"
            disabled={salvando || contrato.status === "assinado"}
            onClick={() => void gerarEbaixar()}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#702a43] px-5 font-black text-white disabled:opacity-50"
          >
            <FileDown size={18} />
            {salvando ? "Gerando PDF…" : "OK — gerar PDF para assinatura"}
          </button>

          {pdfGerado && (
            <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3 text-emerald-950">
                <CheckCircle2 className="mt-0.5 shrink-0" size={21} />
                <div>
                  <p className="font-black">PDF em branco gerado</p>
                  <p className="mt-1 text-sm leading-6">
                    Assine esse arquivo no gov.br e envie a versão assinada abaixo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void baixarVersaoEmBranco()}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-sm font-black text-emerald-900 hover:bg-emerald-50"
              >
                <FileDown size={18} /> Baixar PDF em branco novamente
              </button>
              <label className="mt-3 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-sm font-black text-emerald-900 hover:bg-emerald-50">
                <Upload size={18} />
                {enviandoAssinado
                  ? "Enviando PDF…"
                  : contrato.status === "assinado"
                    ? "Enviar outra versão assinada"
                    : "Enviar PDF assinado"}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  disabled={enviandoAssinado}
                  onChange={(event) => {
                    void enviarAssinado(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {contrato.status === "assinado" && (
                <p className="mt-3 flex items-center justify-center gap-2 text-sm font-bold text-emerald-800">
                  <FileCheck2 size={17} /> Versão assinada recebida.
                </p>
              )}
            </section>
          )}
        </section>

        <footer className="mt-5 text-center text-xs text-[#8a747c]">
          Este link é individual e expira conforme a validade definida pela ORICSE.
        </footer>
      </div>
    </main>
  );
}
