import { useDemoAlvorada } from "@/lib/demo-alvorada-context";
import { AVISO_DEMO_DOCUMENTOS } from "@/lib/demo-alvorada";
import { useEffect, useMemo, useState } from "react";
import { Copy, Eye, FileDown, FilePlus2, History, Printer, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { oricseStorage, descarregarOricseStorage } from "@/lib/oricse-storage";
import { supabase } from "@/integrations/supabase/client";
import { obterModelosDocumentoClinica } from "@/lib/configuracoes-clinica.functions";
import { DOCUMENTOS, extrairCorpoModeloClinico, formatarDataExtensoDocumento } from "@/lib/modelos-documentos";
import { PaginasPrevia } from "@/components/PadroesDocumentosClinica";
import { type jsPDF } from "jspdf";

type Categoria = "receita" | "pedido" | "documento" | "termo";
type Versao = { numero: number; texto: string; data: string };
type Modelo = { id: string; nome: string; categoria: Categoria; texto: string; versao: number; historico: Versao[]; atualizadoEm: string };
const CHAVE = "oricse-modelos-documentos-v1";
const categorias: Record<Categoria, string> = { receita: "Receituário", pedido: "Pedido de exame", documento: "Documento clínico", termo: "Termo e consentimento" };
const campos = ["{{paciente}}", "{{tutor}}", "{{data}}", "{{especie}}", "{{raca}}", "{{veterinario}}"];
const padroes: { nome: string; categoria: Categoria; texto: string }[] = [
  { nome: "Receita simples", categoria: "receita", texto: DOCUMENTOS.receita.exemplo },
  { nome: "Solicitação de exames", categoria: "pedido", texto: DOCUMENTOS.pedido.exemplo },
  { nome: "Declaração de atendimento", categoria: "documento", texto: DOCUMENTOS.documento.exemplo },
  { nome: "Termo inicial de ciência", categoria: "termo", texto: DOCUMENTOS.termo.exemplo },
];
function ler(): Modelo[] {
  try {
    const lista: unknown = JSON.parse(oricseStorage.getItem(CHAVE) || "[]");
    if (!Array.isArray(lista)) return [];
    return lista.filter((v): v is Modelo => Boolean(v && typeof v === "object" && typeof v.id === "string" && typeof v.nome === "string" && typeof v.texto === "string" && Object.keys(categorias).includes(v.categoria)));
  } catch { return []; }
}
function novo(base?: typeof padroes[number]): Modelo {
  return { id: crypto.randomUUID(), nome: base?.nome || "Documento clínico", categoria: base?.categoria || "documento", texto: base?.texto || DOCUMENTOS.documento.exemplo, versao: 0, historico: [], atualizadoEm: "" };
}
export function ConfiguracaoModelosDocumentos({ podeGerenciar, clinica, clinicaId }: { podeGerenciar: boolean; clinica: string; clinicaId: string }) {
  const demoAlvorada = useDemoAlvorada();
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [selecionado, setSelecionado] = useState<Modelo | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [categoria, setCategoria] = useState<Categoria | "todos">("todos");
  const [identidade, setIdentidade] = useState<Awaited<ReturnType<typeof obterModelosDocumentoClinica>> | null>(null);
  const [pdfPrevia, setPdfPrevia] = useState<jsPDF | null>(null);
  const [erroPrevia, setErroPrevia] = useState("");
  const [preview, setPreview] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  useEffect(() => { setModelos(ler()); }, []);
  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const { data: sessao } = await supabase.auth.getSession();
        const accessToken = sessao.session?.access_token;
        if (!accessToken) return;
        const resultado = await obterModelosDocumentoClinica({ data: { accessToken, clinicaId } });
        if (ativo) setIdentidade(resultado);
      } catch {
        // Dados da clínica não são inventados. Erros aparecem na prévia do PDF.
      }
    })();
    return () => { ativo = false; };
  }, [clinicaId]);
  function preencher(texto: string) {
    const dados: Record<string,string> = {
      clinica: identidade?.identidade.nome || clinica,
      endereco_clinica: identidade?.identidade.endereco || "[Endereço da clínica]",
      paciente:"Luna", especie:"Canina", raca:"SRD",
      tutor:"Marina Exemplo", veterinario:"Dra. Ana Exemplo", crmv:"MG fictício",
      data:formatarDataExtensoDocumento(new Date().toLocaleDateString("pt-BR")),
    };
    return texto.replace(/\{\{([a-z_]+)\}\}/g, (original, chave:string) => dados[chave] || original);
  }
  const visiveis = useMemo(() => modelos.filter((m) => categoria === "todos" || m.categoria === categoria).sort((a,b) => a.nome.localeCompare(b.nome, "pt-BR")), [modelos,categoria]);
  const alterado = selecionado && (modelos.find((m) => m.id === selecionado.id)?.texto !== selecionado.texto || modelos.find((m) => m.id === selecionado.id)?.nome !== selecionado.nome || modelos.find((m) => m.id === selecionado.id)?.categoria !== selecionado.categoria);
  function escolher(modelo: Modelo) {
    if (alterado && !window.confirm("Descartar as alterações deste modelo?")) return;
    setSelecionado({ ...modelo, texto: extrairCorpoModeloClinico(modelo.texto), historico: [...(modelo.historico || [])] });
    setPreview(false);
    setPdfPrevia(null);
  }
  async function persistir(proximos: Modelo[]) {
    oricseStorage.setItem(CHAVE, JSON.stringify(proximos));
    await descarregarOricseStorage(); // Não confirmar antes de receber o OK do servidor.
    setModelos(proximos);
  }
  async function salvar() {
    if (!selecionado || !podeGerenciar) return;
    const nome = selecionado.nome.trim(), texto = selecionado.texto.trim();
    if (!nome || nome.length > 100 || !texto || texto.length > 25000) return toast.error("Informe nome (até 100 caracteres) e conteúdo (até 25 mil).");
    if (modelos.length >= 80 && !modelos.some((m) => m.id === selecionado.id)) return toast.error("Limite de 80 modelos por clínica.");
    setSalvando(true);
    try {
      const anterior = modelos.find((m) => m.id === selecionado.id);
      const atualizado: Modelo = { ...selecionado, nome, texto, versao: (anterior?.versao || 0) + 1, atualizadoEm: new Date().toISOString(), historico: anterior ? [...(anterior.historico || []), { numero: anterior.versao, texto: anterior.texto, data: anterior.atualizadoEm }].slice(-10) : [] };
      const lista = anterior ? modelos.map((m) => m.id === atualizado.id ? atualizado : m) : [...modelos, atualizado];
      await persistir(lista); setSelecionado(atualizado); toast.success("Texto do modelo salvo e confirmado no servidor.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível confirmar o salvamento."); }
    finally { setSalvando(false); }
  }
  async function excluir() {
    if (!selecionado || !podeGerenciar || !modelos.some((m) => m.id === selecionado.id)) return;
    if (!window.confirm("Excluir este modelo? Documentos já emitidos não serão alterados.")) return;
    setSalvando(true);
    try { await persistir(modelos.filter((m) => m.id !== selecionado.id)); setSelecionado(null); toast.success("Modelo excluído."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível excluir."); }
    finally { setSalvando(false); }
  }
  async function importar(file?: File) {
    if (!file || !podeGerenciar) return;
    if (!/\.(txt|md)$/i.test(file.name) || file.size > 100000) return toast.error("Envie somente .txt ou .md, com até 100 KB.");
    if (alterado && !window.confirm("Descartar as alterações atuais antes de importar?")) return;
    try {
      const texto = await file.text();
      if (texto.length > 25000) return toast.error("O texto deve ter até 25 mil caracteres.");
      const categoriaBase = categoria !== "todos" ? padroes.find(item => item.categoria === categoria) : undefined;
      setSelecionado({ ...novo(categoriaBase), texto });
      toast.info("Texto importado para o corpo. Confira e salve.");
    } catch { toast.error("Não foi possível ler o arquivo."); }
  }
  async function gerarPdfModelo(modelo: Modelo): Promise<jsPDF> {
    if (!identidade) throw new Error("Os dados da clínica ainda não foram carregados. Atualize esta tela.");
    const { prepararPapelDocumento, criarPdfComModelo } = await import("@/lib/modelos-documentos-pdf");
    const papel = await prepararPapelDocumento(identidade.identidade, identidade.modelos[modelo.categoria]);
    const corpo = preencher(extrairCorpoModeloClinico(modelo.texto));
    return criarPdfComModelo({
      titulo: categorias[modelo.categoria],
      conteudo: corpo,
      papel,
      demonstrativo: true,
      identificacao: {
        paciente: {
          nome: "Luna", especie: "Canina", raca: "SRD", idade: "4 anos", peso: "11 kg",
          sexo: "Feminino", pelagem: "Caramelo", castrado: "Sim",
        },
        tutor: {
          nome: "Marina Exemplo", cpf: "CPF fictício", nascimento: "15/05/1992",
          telefone: "Telefone fictício", endereco: "Endereço de exemplo",
        },
      },
      assinatura: [
        [identidade.identidade.municipio, new Date().toLocaleDateString("pt-BR")].filter(Boolean).join(", "),
        "Dra. Ana Exemplo · CRMV-MG fictício",
      ],
    });
  }
  useEffect(() => {
    if (!preview || !selecionado || !identidade) {
      setPdfPrevia(null);
      return;
    }
    let ativo = true;
    setPdfPrevia(null);
    setErroPrevia("");
    const timer = window.setTimeout(() => {
      void gerarPdfModelo(selecionado).then(pdf => { if (ativo) setPdfPrevia(pdf); })
        .catch(e => { if (ativo) setErroPrevia(e instanceof Error ? e.message : "Falha na prévia."); });
    }, 350);
    return () => { ativo = false; window.clearTimeout(timer); };
  }, [preview, selecionado, identidade]);
  async function imprimir() {
    if (demoAlvorada) return void toast.info(AVISO_DEMO_DOCUMENTOS);
    if (!selecionado) return;
    const janela = window.open("", "_blank");
    if (!janela) return void toast.error("Permita a abertura de janelas para imprimir.");
    try {
      const pdf = await gerarPdfModelo(selecionado);
      pdf.autoPrint();
      janela.location.href = URL.createObjectURL(pdf.output("blob"));
    } catch (e) {
      janela.close();
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir a impressão.");
    }
  }
  async function baixarPdf() {
    if (demoAlvorada) return void toast.info(AVISO_DEMO_DOCUMENTOS);
    if (!selecionado) return;
    setGerandoPdf(true);
    try {
      const pdf = await gerarPdfModelo(selecionado);
      const arquivo = selecionado.nome.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").slice(0,70)||"modelo";
      pdf.save("previa-"+arquivo+".pdf");
      toast.success("Prévia com cabeçalho e identificação padronizados.");
    } catch(e) { toast.error(e instanceof Error ? e.message : "Erro ao gerar PDF."); }
    finally { setGerandoPdf(false); }
  }
  return <section className="mt-5 rounded-xl border bg-background p-4" aria-label="Biblioteca de modelos">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-semibold">Editor de modelos clínicos</h3>
        <p className="mt-1 text-sm text-muted-foreground">Edite somente o corpo do texto. O ORICSE monta automaticamente a logo, o cabeçalho, os dados do paciente e do tutor e o rodapé.</p>
      </div>
      {podeGerenciar && <div className="flex flex-wrap gap-2">
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs font-semibold"><Upload size={15}/> Importar texto<input type="file" accept=".txt,.md,text/plain,text/markdown" className="sr-only" onChange={(e) => { void importar(e.target.files?.[0]); e.target.value = ""; }}/></label>
        <button type="button" onClick={() => escolher(novo(categoria === "todos" ? undefined : padroes.find(item => item.categoria === categoria)))} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"><FilePlus2 size={15}/> Novo texto</button>
      </div>}
    </div>
    <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
      <div className="space-y-2">
        <label className="block text-xs font-medium">Filtrar tipo<select value={categoria} onChange={(e)=>setCategoria(e.target.value as Categoria|"todos")} className="mt-1 min-h-10 w-full rounded-lg border bg-card px-2"><option value="todos">Todos os tipos</option>{Object.entries(categorias).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
        <div className="max-h-[430px] space-y-1 overflow-y-auto">
          {visiveis.map((m)=><button type="button" key={m.id} onClick={()=>escolher(m)} className={`w-full rounded-lg border p-3 text-left text-xs ${selecionado?.id===m.id?"border-primary bg-primary/5":"hover:bg-muted"}`}><span className="block font-semibold">{m.nome}</span><span className="mt-1 block text-muted-foreground">{categorias[m.categoria]} · v{m.versao}</span></button>)}
          {!visiveis.length && <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Nenhum modelo salvo nesta categoria.</p>}
        </div>
        {podeGerenciar && <div className="border-t pt-2"><p className="mb-2 text-xs font-medium text-muted-foreground">Textos-base do ORICSE</p>{padroes.map((p)=><button key={p.nome} type="button" onClick={()=>escolher(novo(p))} className="block w-full rounded-lg px-2 py-2 text-left text-xs hover:bg-muted">{p.nome}</button>)}</div>}
      </div>
      <div className="min-w-0 space-y-3">
        {!selecionado ? <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Escolha um texto-base do ORICSE ou um modelo salvo. Você editará somente o corpo do documento.</div> : <>
          <div className="rounded-xl border bg-muted/30 px-4 py-3">
            <p className="font-semibold">{selecionado.nome}</p>
            <p className="mt-1 text-xs text-muted-foreground">{categorias[selecionado.categoria]} · Cabeçalho, identidade, paciente, tutor e assinatura padronizados.</p>
          </div>
          <label className="block text-sm font-semibold">Corpo do documento
            <span className="mt-1 block text-xs font-normal text-muted-foreground">Somente este texto é editável. Os campos com chaves são preenchidos com os dados do atendimento.</span>
            <textarea value={selecionado.texto} disabled={!podeGerenciar} maxLength={25000} rows={13} onChange={(e)=>setSelecionado({...selecionado,texto:e.target.value})}
              className="mt-2 w-full resize-y rounded-xl border bg-card p-4 font-sans text-sm leading-7 focus-visible:outline-2 focus-visible:outline-primary"
              placeholder={DOCUMENTOS[selecionado.categoria].exemplo}/>
          </label>
          <div className="flex flex-wrap gap-1">{campos.map((campo)=><button type="button" key={campo} disabled={!podeGerenciar} onClick={()=>setSelecionado({...selecionado,texto:selecionado.texto+(selecionado.texto.endsWith(" ")||!selecionado.texto?"":" ")+campo})} className="rounded-md border px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-50">{campo}</button>)}</div>
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <button type="button" onClick={()=>setPreview(v=>!v)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold"><Eye size={15}/> {preview?"Ocultar prévia":"Visualizar"}</button>
            <button type="button" onClick={imprimir} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold"><Printer size={15}/> Imprimir</button>
            <button type="button" disabled={demoAlvorada || gerandoPdf} onClick={()=>void baixarPdf()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold disabled:opacity-50"><FileDown size={15}/> {gerandoPdf?"Gerando...":"Baixar PDF"}</button>
            {podeGerenciar && <><button type="button" onClick={()=>escolher({...selecionado,id:crypto.randomUUID(),nome:selecionado.nome+" (cópia)",versao:0,historico:[],atualizadoEm:""})} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold"><Copy size={15}/> Duplicar</button>
              <button type="button" disabled={salvando} onClick={()=>void salvar()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"><Save size={15}/>{salvando?"Salvando...":"Salvar modelo"}</button>
              {modelos.some((m)=>m.id===selecionado.id) && <button type="button" disabled={salvando} onClick={()=>void excluir()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs text-destructive"><Trash2 size={15}/> Excluir</button>}</>}
          </div>
          {preview && <section className="rounded-xl border bg-card p-4">
            <p className="mb-3 text-sm font-semibold">Documento completo, com dados fictícios</p>
            <p className="mb-3 text-xs text-muted-foreground">A prévia mostra exatamente o cabeçalho e os quadros padronizados, com o tema escolhido nas configurações da clínica. Não é uma emissão nem uma assinatura.</p>
            {erroPrevia && <p role="alert" className="text-sm text-destructive">{erroPrevia}</p>}
            {!pdfPrevia && !erroPrevia && <p role="status" className="text-sm text-muted-foreground">Montando prévia do documento…</p>}
            {pdfPrevia && <PaginasPrevia pdf={pdfPrevia} />}
          </section>}
          {selecionado.historico?.length>0 && <details className="rounded-lg border p-3"><summary className="cursor-pointer text-xs font-semibold"><History size={14} className="mr-1 inline"/> Histórico de versões ({selecionado.historico.length})</summary><div className="mt-2 space-y-2">{selecionado.historico.map((v,i)=><div key={i} className="flex items-center justify-between gap-2 text-xs"><span>Versão {v.numero} · {v.data ? new Date(v.data).toLocaleString("pt-BR") : "Data indisponível"}</span>{podeGerenciar && <button type="button" onClick={()=>{if(window.confirm("Recuperar o texto desta versão? Salve para registrar a alteração."))setSelecionado({...selecionado,texto:v.texto});}} className="font-semibold text-primary">Recuperar texto</button>}</div>)}</div></details>}
          <p className="text-xs text-muted-foreground">Prévia não equivale a emissão nem assinatura. O texto-base de termos é provisório e deve ser revisado pelo responsável técnico antes do uso. Receitas controladas seguem o fluxo próprio.</p>
        </>}
      </div>
    </div>
  </section>;
}
