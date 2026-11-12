import { useEffect, useMemo, useState } from "react";
import { Copy, Eye, FileDown, FilePlus2, History, Printer, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { oricseStorage, descarregarOricseStorage } from "@/lib/oricse-storage";
import { supabase } from "@/integrations/supabase/client";
import { obterDadosReceituario } from "@/lib/receituario-contexto.functions";

type Categoria = "receita" | "pedido" | "documento" | "termo";
type Versao = { numero: number; texto: string; data: string };
type Modelo = { id: string; nome: string; categoria: Categoria; texto: string; versao: number; historico: Versao[]; atualizadoEm: string };
const CHAVE = "oricse-modelos-documentos-v1";
const categorias: Record<Categoria, string> = { receita: "Receituário", pedido: "Pedido de exame", documento: "Documento clínico", termo: "Termo e consentimento" };
const campos = ["{{clinica}}", "{{endereco_clinica}}", "{{paciente}}", "{{especie}}", "{{raca}}", "{{tutor}}", "{{veterinario}}", "{{crmv}}", "{{data}}"];
const padroes: { nome: string; categoria: Categoria; texto: string }[] = [
  { nome: "Receita simples", categoria: "receita", texto: "{{clinica}}\n{{endereco_clinica}}\n\nRECEITUÁRIO VETERINÁRIO\nPaciente: {{paciente}} | Espécie: {{especie}}\nTutor: {{tutor}}\n\nPrescrição:\n\n\n{{data}}\n{{veterinario}} - CRMV {{crmv}}" },
  { nome: "Solicitação de exame", categoria: "pedido", texto: "{{clinica}}\n\nPEDIDO DE EXAME\nPaciente: {{paciente}}\nTutor: {{tutor}}\n\nExames solicitados:\n\nJustificativa clínica:\n\n{{data}}\n{{veterinario}} - CRMV {{crmv}}" },
  { nome: "Declaração de atendimento", categoria: "documento", texto: "{{clinica}}\n\nDECLARAÇÃO\nDeclaramos que {{paciente}}, sob responsabilidade de {{tutor}}, compareceu para atendimento veterinário em {{data}}.\n\n{{veterinario}} - CRMV {{crmv}}" },
  { nome: "Consentimento para procedimento", categoria: "termo", texto: "{{clinica}}\n\nTERMO DE CONSENTIMENTO\nTutor: {{tutor}}\nAnimal: {{paciente}}\n\nProcedimento proposto:\n\nRiscos, alternativas e orientações explicados:\n\nDeclaro que fui informado(a) e autorizo o procedimento descrito.\n\nData: {{data}}\nAssinatura do tutor: ____________________" },
];
function ler(): Modelo[] {
  try {
    const lista: unknown = JSON.parse(oricseStorage.getItem(CHAVE) || "[]");
    if (!Array.isArray(lista)) return [];
    return lista.filter((v): v is Modelo => Boolean(v && typeof v === "object" && typeof v.id === "string" && typeof v.nome === "string" && typeof v.texto === "string" && Object.keys(categorias).includes(v.categoria)));
  } catch { return []; }
}
function novo(base?: typeof padroes[number]): Modelo {
  return { id: crypto.randomUUID(), nome: base?.nome || "Novo modelo", categoria: base?.categoria || "documento", texto: base?.texto || "{{clinica}}\n\nTítulo do documento\n\nPaciente: {{paciente}}\nTutor: {{tutor}}\n\n{{data}}", versao: 0, historico: [], atualizadoEm: "" };
}
function escapar(valor: string) {
  return valor.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
export function ConfiguracaoModelosDocumentos({ podeGerenciar, clinica }: { podeGerenciar: boolean; clinica: string }) {
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [selecionado, setSelecionado] = useState<Modelo | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [categoria, setCategoria] = useState<Categoria | "todos">("todos");
  const [contexto, setContexto] = useState<Record<string,string>>({});
  const [preview, setPreview] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  useEffect(() => { setModelos(ler()); }, []);
  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const { data: sessao } = await supabase.auth.getSession();
        if (!sessao.session?.access_token) return;
        const dados = await obterDadosReceituario({data:{accessToken:sessao.session.access_token}});
        if (ativo) setContexto({clinica:String(dados.clinicaNome||clinica),endereco_clinica:String(dados.clinicaEndereco||""),data:new Date().toLocaleDateString("pt-BR")});
      } catch { /* A prévia continua com exemplos, sem dados pessoais. */ }
    })();
    return () => { ativo = false; };
  }, [clinica]);
  function preencher(texto: string) {
    const campos: Record<string,string> = {
      clinica, endereco_clinica:"[Endereço da clínica]",
      paciente:"[Paciente]", especie:"[Espécie]", raca:"[Raça]",
      tutor:"[Tutor]", veterinario:"[Veterinário]", crmv:"[CRMV]",
      data:new Date().toLocaleDateString("pt-BR"), ...contexto,
    };
    return texto.replace(/\{\{([a-z_]+)\}\}/g, (original, chave:string) => campos[chave] || original);
  }
  const visiveis = useMemo(() => modelos.filter((m) => categoria === "todos" || m.categoria === categoria).sort((a,b) => a.nome.localeCompare(b.nome, "pt-BR")), [modelos,categoria]);
  const alterado = selecionado && (modelos.find((m) => m.id === selecionado.id)?.texto !== selecionado.texto || modelos.find((m) => m.id === selecionado.id)?.nome !== selecionado.nome || modelos.find((m) => m.id === selecionado.id)?.categoria !== selecionado.categoria);
  function escolher(modelo: Modelo) {
    if (alterado && !window.confirm("Descartar as alterações deste modelo?")) return;
    setSelecionado({ ...modelo, historico: [...(modelo.historico || [])] });
    setPreview(false);
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
      await persistir(lista); setSelecionado(atualizado); toast.success("Modelo salvo e confirmado no servidor.");
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
      setSelecionado({ ...novo(), nome: file.name.replace(/\.(txt|md)$/i, ""), texto });
      toast.info("Arquivo carregado. Confira e clique em Salvar modelo.");
    } catch { toast.error("Não foi possível ler o arquivo."); }
  }
  function imprimir() {
    if (!selecionado) return;
    const janela = window.open("", "_blank");
    if (!janela) return toast.error("Habilite a abertura de janelas para imprimir.");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapar(selecionado.nome)}</title><style>body{font:12pt Arial,sans-serif;max-width:760px;margin:35px auto;white-space:pre-wrap;line-height:1.55;padding:12px}@media print{body{margin:15mm}}</style></head><body>${escapar(preencher(selecionado.texto))}</body></html>`;
    janela.document.write(html); janela.document.close(); janela.focus(); janela.print();
  }
  async function baixarPdf() {
    if (!selecionado) return;
    setGerandoPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit:"mm", format:"a4" });
      doc.setFont("helvetica","normal"); doc.setFontSize(11);
      const largura = doc.internal.pageSize.getWidth(), altura = doc.internal.pageSize.getHeight();
      let y=22;
      for (const linha of preencher(selecionado.texto).split("\n")) {
        const partes = doc.splitTextToSize(linha || " ", largura-36) as string[];
        for (const parte of partes) {
          if (y>altura-22) { doc.addPage(); y=22; }
          doc.text(parte || " ", 18, y); y+=6;
        }
      }
      const arquivo = selecionado.nome.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").slice(0,70)||"modelo";
      doc.save(arquivo+".pdf");
      toast.success("Prévia PDF criada. Confira antes de emitir.");
    } catch(e) { toast.error(e instanceof Error ? e.message : "Erro ao gerar PDF."); }
    finally { setGerandoPdf(false); }
  }
  return <section className="mt-5 rounded-xl border bg-background p-4" aria-label="Biblioteca de modelos">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-semibold">Biblioteca de modelos</h3><p className="mt-1 text-xs text-muted-foreground">Crie modelos da {clinica}, confira os dados conhecidos da clínica e exporte uma prévia. Os dados pessoais só serão preenchidos no fluxo clínico autorizado.</p></div>
      {podeGerenciar && <div className="flex flex-wrap gap-2">
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs font-semibold"><Upload size={15}/> Importar texto<input type="file" accept=".txt,.md,text/plain,text/markdown" className="sr-only" onChange={(e) => { void importar(e.target.files?.[0]); e.target.value = ""; }}/></label>
        <button type="button" onClick={() => escolher(novo())} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"><FilePlus2 size={15}/> Novo modelo</button>
      </div>}
    </div>
    <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
      <div className="space-y-2">
        <label className="block text-xs font-medium">Filtrar tipo<select value={categoria} onChange={(e)=>setCategoria(e.target.value as Categoria|"todos")} className="mt-1 min-h-10 w-full rounded-lg border bg-card px-2"><option value="todos">Todos os tipos</option>{Object.entries(categorias).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
        <div className="max-h-[430px] space-y-1 overflow-y-auto">
          {visiveis.map((m)=><button type="button" key={m.id} onClick={()=>escolher(m)} className={`w-full rounded-lg border p-3 text-left text-xs ${selecionado?.id===m.id?"border-primary bg-primary/5":"hover:bg-muted"}`}><span className="block font-semibold">{m.nome}</span><span className="mt-1 block text-muted-foreground">{categorias[m.categoria]} · v{m.versao}</span></button>)}
          {!visiveis.length && <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Nenhum modelo salvo nesta categoria.</p>}
        </div>
        {podeGerenciar && <div className="border-t pt-2"><p className="mb-2 text-xs font-medium text-muted-foreground">Iniciar de um modelo ORICSE</p>{padroes.map((p)=><button key={p.nome} type="button" onClick={()=>escolher(novo(p))} className="block w-full rounded-lg px-2 py-2 text-left text-xs hover:bg-muted">{p.nome}</button>)}</div>}
      </div>
      <div className="min-w-0 space-y-3">
        {!selecionado ? <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Selecione um modelo salvo ou crie um novo.</div> : <>
          <div className="grid gap-3 sm:grid-cols-[1fr_185px]">
            <label className="text-xs font-semibold">Nome do modelo<input value={selecionado.nome} disabled={!podeGerenciar} maxLength={100} onChange={(e)=>setSelecionado({...selecionado,nome:e.target.value})} className="mt-1 min-h-10 w-full rounded-lg border bg-card px-3 text-sm"/></label>
            <label className="text-xs font-semibold">Tipo<select value={selecionado.categoria} disabled={!podeGerenciar} onChange={(e)=>setSelecionado({...selecionado,categoria:e.target.value as Categoria})} className="mt-1 min-h-10 w-full rounded-lg border bg-card px-3 text-sm">{Object.entries(categorias).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
          </div>
          <label className="block text-xs font-semibold">Conteúdo do documento<textarea value={selecionado.texto} disabled={!podeGerenciar} maxLength={25000} rows={13} onChange={(e)=>setSelecionado({...selecionado,texto:e.target.value})} className="mt-1 w-full resize-y rounded-lg border bg-card p-3 font-mono text-sm leading-relaxed"/></label>
          <div className="flex flex-wrap gap-1">{campos.map((campo)=><button type="button" key={campo} disabled={!podeGerenciar} onClick={()=>setSelecionado({...selecionado,texto:selecionado.texto+" "+campo})} className="rounded-md border px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-50">{campo}</button>)}</div>
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <button type="button" onClick={()=>setPreview(v=>!v)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold"><Eye size={15}/> {preview?"Ocultar prévia":"Visualizar"}</button>
            <button type="button" onClick={imprimir} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold"><Printer size={15}/> Imprimir</button>
            <button type="button" disabled={gerandoPdf} onClick={()=>void baixarPdf()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold disabled:opacity-50"><FileDown size={15}/> {gerandoPdf?"Gerando...":"Baixar PDF"}</button>
            {podeGerenciar && <><button type="button" onClick={()=>escolher({...selecionado,id:crypto.randomUUID(),nome:selecionado.nome+" (cópia)",versao:0,historico:[],atualizadoEm:""})} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold"><Copy size={15}/> Duplicar</button>
              <button type="button" disabled={salvando} onClick={()=>void salvar()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"><Save size={15}/>{salvando?"Salvando...":"Salvar modelo"}</button>
              {modelos.some((m)=>m.id===selecionado.id) && <button type="button" disabled={salvando} onClick={()=>void excluir()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs text-destructive"><Trash2 size={15}/> Excluir</button>}</>}
          </div>
          {preview && <section className="rounded-lg border bg-card p-4"><p className="mb-3 text-xs font-semibold text-muted-foreground">Prévia demonstrativa — documento não emitido nem assinado</p><pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">{preencher(selecionado.texto)}</pre></section>}
          {selecionado.historico?.length>0 && <details className="rounded-lg border p-3"><summary className="cursor-pointer text-xs font-semibold"><History size={14} className="mr-1 inline"/> Histórico de versões ({selecionado.historico.length})</summary><div className="mt-2 space-y-2">{selecionado.historico.map((v,i)=><div key={i} className="flex items-center justify-between gap-2 text-xs"><span>Versão {v.numero} · {v.data ? new Date(v.data).toLocaleString("pt-BR") : "Data indisponível"}</span>{podeGerenciar && <button type="button" onClick={()=>{if(window.confirm("Recuperar o texto desta versão? Salve para registrar a alteração."))setSelecionado({...selecionado,texto:v.texto});}} className="font-semibold text-primary">Recuperar texto</button>}</div>)}</div></details>}
          <p className="text-xs text-muted-foreground">Prévia não equivale a emissão nem assinatura. Modelos de receitas controladas continuam sujeitos às exigências legais e ao fluxo próprio.</p>
        </>}
      </div>
    </div>
  </section>;
}
