import { useEffect, useMemo, useState } from "react";
import { FileDown, FileText, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { obterDadosReceituario } from "@/lib/receituario-contexto.functions";
import { listarModelosClinicos } from "@/lib/oricse-storage.functions";
import { enviarArquivoDrive } from "@/lib/drive.functions";

type Modelo = { id: string; nome: string; categoria: string; texto: string; versao: number };
type Contexto = Awaited<ReturnType<typeof obterDadosReceituario>>;

function preencher(texto: string, dados: Contexto) {
  const valores: Record<string,string> = {
    clinica: dados.clinicaNome || "",
    endereco_clinica: dados.clinicaEndereco || "",
    paciente: dados.animal?.nome || "",
    especie: dados.animal?.especie || "",
    raca: dados.animal?.raca || "",
    tutor: dados.tutor?.nome || "",
    data: new Date().toLocaleDateString("pt-BR"),
    // O profissional deve revisar e preencher os campos de identificação.
    veterinario: "",
    crmv: "",
  };
  const pendentes = new Set<string>();
  const resultado = texto.replace(/\{\{([a-z_]+)\}\}/g, (original, chave: string) => {
    if (!Object.prototype.hasOwnProperty.call(valores, chave)) { pendentes.add(original); return original; }
    if (!valores[chave]) { pendentes.add(original); return original; }
    return valores[chave];
  });
  return { resultado, pendentes: [...pendentes] };
}
async function criarPdf(titulo: string, conteudo: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  const largura = pdf.internal.pageSize.getWidth() - 36;
  const limite = pdf.internal.pageSize.getHeight() - 22;
  let y = 22;
  for (const linha of conteudo.split("\n")) {
    for (const parte of pdf.splitTextToSize(linha || " ", largura) as string[]) {
      if (y >= limite) { pdf.addPage(); y = 22; }
      pdf.text(parte || " ", 18, y);
      y += 6;
    }
  }
  const nome = titulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0,65) || "documento";
  return { pdf, filename: nome + ".pdf" };
}
export function ModelosClinicosAtendimento() {
  const [modelos,setModelos] = useState<Modelo[]>([]);
  const [dados,setDados] = useState<Contexto | null>(null);
  const [selecionado,setSelecionado] = useState("");
  const [conteudo,setConteudo] = useState("");
  const [carregando,setCarregando] = useState(true);
  const [emitindo,setEmitindo] = useState(false);
  const [erro,setErro] = useState("");
  const [referencia,setReferencia] = useState<{id:string;versao:number}|null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const animalId = params.get("animalId") || undefined;
        const tutorId = params.get("tutorId") || undefined;
        if (!animalId) throw new Error("Abra esta página pelo atendimento de um animal para preencher e arquivar documentos.");
        const { data: sessao } = await supabase.auth.getSession();
        if (!sessao.session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");
        const contexto = await obterDadosReceituario({data:{
          accessToken:sessao.session.access_token,
          animalId, ...(tutorId ? { tutorId } : {}),
        }});
        if (!contexto.animal?.id || !contexto.clinicaId) throw new Error("Animal e clínica não identificados.");
        const lista = await listarModelosClinicos({data:{
          accessToken:sessao.session.access_token, clinicaId:contexto.clinicaId,
        }});
        if (!ativo) return;
        setDados(contexto);
        // Receitas usam o fluxo próprio com assinatura e controles especiais.
        setModelos(lista.filter((item) => item.categoria !== "receita"));
      } catch(e) {
        if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar os modelos.");
      } finally { if (ativo) setCarregando(false); }
    })();
    return () => { ativo = false; };
  }, []);

  const modelo = useMemo(() => modelos.find((item) => item.id === selecionado), [modelos,selecionado]);
  function escolher(id: string) {
    if (modelo && conteudo !== preencher(modelo.texto, dados!).resultado && !window.confirm("Descartar as alterações deste documento?")) return;
    const m = modelos.find((item) => item.id === id);
    setSelecionado(id);
    setConteudo(m && dados ? preencher(m.texto,dados).resultado : "");
    setReferencia(m ? { id:m.id,versao:m.versao } : null);
  }
  const pendencias = useMemo(() => [...conteudo.matchAll(/\{\{[^{}]+\}\}/g)].map((m) => m[0]), [conteudo]);
  async function exportar(arquivar: boolean) {
    if (!modelo || !dados?.animal?.id || !dados.clinicaId) return;
    if (!conteudo.trim()) return toast.error("Preencha o conteúdo antes de gerar o documento.");
    if (pendencias.length) return toast.error("Preencha os campos pendentes antes de gerar: " + [...new Set(pendencias)].join(", "));
    if (conteudo.length > 25000) return toast.error("Documento acima do limite de 25 mil caracteres.");
    if (arquivar && !window.confirm("Arquivar este PDF como rascunho interno, ainda sem assinatura?")) return;
    setEmitindo(true);
    try {
      const { pdf,filename } = await criarPdf(modelo.nome,conteudo);
      if (!arquivar) {
        pdf.save(filename);
        toast.success("PDF gerado para conferência. Não é um documento assinado.");
        return;
      }
      const { data: sessao } = await supabase.auth.getSession();
      if (!sessao.session?.access_token) throw new Error("Sessão expirada.");
      const base64 = pdf.output("datauristring").split(",")[1];
      if (!base64) throw new Error("PDF não pôde ser convertido para envio.");
      const resposta = await enviarArquivoDrive({data:{
        accessToken:sessao.session.access_token,
        clinicaId:dados.clinicaId,
        categoria:"documentos",
        nome:filename,
        mimeType:"application/pdf",
        base64,
        visibilidade:"interno",
        entidadeTipo:"animal",
        entidadeId:dados.animal.id,
        metadata:{
          origem:"modelo_clinico", modeloId:referencia?.id || modelo.id,
          versaoModelo:referencia?.versao ?? modelo.versao,
          status:"rascunho_sem_assinatura",
          animalId:dados.animal.id, tutorId:dados.tutorId,
        },
      }});
      if (!resposta?.ok || !resposta.registroId) throw new Error("O armazenamento não confirmou o arquivo.");
      toast.success("Rascunho arquivado na pasta de documentos da clínica.");
      pdf.save(filename);
    } catch(e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar ou arquivar documento.");
    } finally { setEmitindo(false); }
  }

  if (carregando) return <section className="mt-4 rounded-xl border bg-card p-5 text-sm text-muted-foreground">Carregando modelos da clínica...</section>;
  if (erro) return <section className="mt-4 rounded-xl border bg-card p-5 text-sm" role="status"><ShieldAlert size={18} className="mb-2 text-amber-600"/>{erro}</section>;
  return <section className="mt-5 rounded-xl border bg-card p-4 sm:p-5">
    <div className="mb-4 flex items-start gap-2">
      <FileText size={20} className="mt-0.5 text-primary"/>
      <div><h2 className="text-lg font-semibold">Modelos da clínica</h2>
        <p className="text-sm text-muted-foreground">Paciente: <strong>{dados?.animal?.nome}</strong> · Tutor: <strong>{dados?.tutor?.nome || "Não informado"}</strong>. Confira os dados antes de gerar.</p>
      </div>
    </div>
    <label className="block text-sm font-medium">Escolher modelo
      <select value={selecionado} onChange={(e) => escolher(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3 font-normal">
        <option value="">Selecione um documento...</option>
        {modelos.map((m)=><option value={m.id} key={m.id}>{m.nome} · v{m.versao}</option>)}
      </select>
    </label>
    {!modelos.length && <p className="mt-3 text-sm text-muted-foreground">Nenhum modelo clínico disponível. O administrador ou RT pode criar modelos nas Configurações da Clínica.</p>}
    {modelo && <div className="mt-4 space-y-3">
      <label className="block text-sm font-medium">Revisar e completar documento
        <textarea rows={15} maxLength={25000} value={conteudo} onChange={(e)=>setConteudo(e.target.value)}
          className="mt-1 w-full rounded-lg border bg-background p-3 font-mono text-sm leading-relaxed"/>
      </label>
      {pendencias.length > 0 && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Campos a preencher: {[...new Set(pendencias)].join(", ")}</p>}
      <p className="text-xs text-muted-foreground">As prescrições, receitas controladas e assinaturas continuam no receituário protegido. Este fluxo arquiva apenas um PDF interno não assinado.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={emitindo || Boolean(pendencias.length)} onClick={()=>void exportar(false)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-semibold disabled:opacity-50"><FileDown size={17}/> Baixar PDF</button>
        <button type="button" disabled={emitindo || Boolean(pendencias.length)} onClick={()=>void exportar(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save size={17}/>{emitindo?"Processando...":"Arquivar rascunho"}</button>
      </div>
    </div>}
  </section>;
}
