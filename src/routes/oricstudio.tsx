import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle, ArrowLeft, BarChart3, Bell, CalendarDays, CheckCircle2,
  Clock3, FileImage, FolderOpen, Instagram, LayoutDashboard, LockKeyhole,
  MessageCircle, Pencil, Plus, RefreshCw, Save, Settings2, ShieldCheck, Trash2, Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase, supabaseBanco } from "@/integrations/supabase/client";

export const Route = createFileRoute("/oricstudio")({
  head: () => ({ meta: [{ title: "OricStúdio — ORICSE" }] }),
  component: OricStudio,
});

type Status = "rascunho" | "aguardando_aprovacao" | "aprovado";
type Tipo = "imagem" | "carrossel" | "reels" | "story";
type Aba = "inicio" | "contas" | "publicacoes" | "calendario" | "biblioteca" | "aprovacoes" | "comentarios" | "metricas" | "alertas" | "configuracoes";
type Contexto = {
  clinica_id: string; clinica_nome: string; clinica_status: string;
  licenca_status: string; licenca_expira_em: string | null; tem_acesso: boolean;
};
type Publicacao = {
  id: string; clinica_id: string; titulo: string; legenda: string; tipo: Tipo; status: Status;
  planejado_para: string | null; criado_em: string; atualizado_em: string;
};
type Midia = { id: string; nome: string; tipo: string; criado_em: string };
type Versao = { id: number; evento: string; criado_em: string; autor_id: string | null };
type Preferencias = {
  clinica_id: string; nome_publico: string; tom_de_voz: string;
  hashtags_padrao: string; fuso_horario: string;
};
const ABAS = [
  { id: "inicio", rotulo: "Visão geral", Icone: LayoutDashboard },
  { id: "contas", rotulo: "Contas", Icone: Users },
  { id: "publicacoes", rotulo: "Publicações", Icone: FileImage },
  { id: "calendario", rotulo: "Calendário", Icone: CalendarDays },
  { id: "biblioteca", rotulo: "Biblioteca", Icone: FolderOpen },
  { id: "aprovacoes", rotulo: "Aprovações", Icone: ShieldCheck },
  { id: "comentarios", rotulo: "Comentários", Icone: MessageCircle },
  { id: "metricas", rotulo: "Métricas", Icone: BarChart3 },
  { id: "alertas", rotulo: "Alertas", Icone: Bell },
  { id: "configuracoes", rotulo: "Configurações", Icone: Settings2 },
] as const;
const STATUS: Record<Status, string> = {
  rascunho: "Rascunho", aguardando_aprovacao: "Aguardando aprovação", aprovado: "Aprovado para uso futuro",
};
const FORMATOS: Tipo[] = ["imagem", "carrossel", "reels", "story"];
function paraCampo(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function textoData(iso: string | null) {
  if (!iso) return "Sem data definida";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function chaveDia(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth()+1).padStart(2,"0")}-${String(data.getDate()).padStart(2,"0")}`;
}

function OricStudio() {
  const [aba, setAba] = useState<Aba>("inicio");
  const [modoCalendario, setModoCalendario] = useState<"mes"|"semana"|"dia">("mes");
  const [referenciaCalendario, setReferenciaCalendario] = useState(() => new Date());
  const [contexto, setContexto] = useState<Contexto | null>(null);
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([]);
  const [midias, setMidias] = useState<Midia[]>([]);
  const [preferencias, setPreferencias] = useState<Preferencias | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const requisicao = useRef(0);
  const [editorAberto, setEditorAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [legenda, setLegenda] = useState("");
  const [tipo, setTipo] = useState<Tipo>("imagem");
  const [planejado, setPlanejado] = useState("");
  const [status, setStatus] = useState<"rascunho" | "aguardando_aprovacao">("rascunho");
  const [versoes, setVersoes] = useState<Versao[]>([]);
  const [versoesId, setVersoesId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const seq = ++requisicao.current;
    setCarregando(true); setErro("");
    setContexto(null); setPublicacoes([]); setMidias([]); setPreferencias(null);
    try {
      const { data: auth, error: authErro } = await supabase.auth.getUser();
      if (authErro || !auth.user?.id) throw new Error("Entre na sua conta para consultar o OricStúdio.");
      // A clínica é escolhida no servidor, nunca por um ID recebido do navegador.
      const { data, error } = await (supabaseBanco as any).rpc("oricstudio_meu_contexto");
      if (error) throw error;
      const c = data as Contexto | null;
      if (seq !== requisicao.current) return;
      setContexto(c);
      if (!c?.tem_acesso) return;
      const [posts, arquivos, pref] = await Promise.all([
        (supabaseBanco as any).from("oricstudio_publicacoes")
          .select("id,clinica_id,titulo,legenda,tipo,status,planejado_para,criado_em,atualizado_em")
          .eq("clinica_id", c.clinica_id).order("criado_em", { ascending: false }),
        (supabaseBanco as any).from("oricstudio_midias")
          .select("id,nome,tipo,criado_em").eq("clinica_id", c.clinica_id)
          .order("criado_em", { ascending: false }),
        (supabaseBanco as any).from("oricstudio_preferencias")
          .select("clinica_id,nome_publico,tom_de_voz,hashtags_padrao,fuso_horario")
          .eq("clinica_id", c.clinica_id).maybeSingle(),
      ]);
      for (const response of [posts, arquivos, pref]) if (response.error) throw response.error;
      if (seq !== requisicao.current) return;
      setPublicacoes((posts.data || []) as Publicacao[]);
      setMidias((arquivos.data || []) as Midia[]);
      setPreferencias(pref.data || {
        clinica_id: c.clinica_id, nome_publico: c.clinica_nome,
        tom_de_voz: "Profissional e acolhedor", hashtags_padrao: "",
        fuso_horario: "America/Sao_Paulo",
      });
    } catch (e) {
      if (seq === requisicao.current) setErro(e instanceof Error ? e.message : "Não foi possível consultar o OricStúdio.");
    } finally {
      if (seq === requisicao.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    const mudou = () => { setEditorAberto(false); setEditandoId(null); void carregar(); };
    window.addEventListener("oricse:clinica-alterada", mudou);
    const { data: auth } = supabase.auth.onAuthStateChange(() => { void carregar(); });
    return () => {
      requisicao.current++;
      window.removeEventListener("oricse:clinica-alterada", mudou);
      auth.subscription.unsubscribe();
    };
  }, [carregar]);

  const planejadas = useMemo(() => publicacoes
    .filter(p => !!p.planejado_para).sort((a,b) =>
      new Date(a.planejado_para!).getTime() - new Date(b.planejado_para!).getTime()), [publicacoes]);
  const pendentes = publicacoes.filter(p => p.status === "aguardando_aprovacao");
  const calendario = useMemo(() => {
    const ref = referenciaCalendario;
    let inicio: Date;
    let quantidade: number;
    if (modoCalendario === "dia") {
      inicio = new Date(ref.getFullYear(),ref.getMonth(),ref.getDate()); quantidade = 1;
    } else if (modoCalendario === "semana") {
      inicio = new Date(ref.getFullYear(),ref.getMonth(),ref.getDate()-ref.getDay()); quantidade = 7;
    } else {
      const primeiro = new Date(ref.getFullYear(),ref.getMonth(),1);
      inicio = new Date(primeiro.getFullYear(),primeiro.getMonth(),1-primeiro.getDay());
      quantidade = 42;
    }
    return Array.from({length:quantidade},(_,i)=>new Date(inicio.getFullYear(),inicio.getMonth(),inicio.getDate()+i));
  },[modoCalendario,referenciaCalendario]);
  const publicacoesPorDia = useMemo(() => {
    const mapa = new Map<string,Publicacao[]>();
    for (const p of planejadas) {
      if(!p.planejado_para)continue;
      const dia=chaveDia(new Date(p.planejado_para));
      mapa.set(dia,[...(mapa.get(dia)||[]),p]);
    }
    return mapa;
  },[planejadas]);
  function navegarCalendario(passo:number) {
    const d=referenciaCalendario;
    setReferenciaCalendario(modoCalendario==="mes"
      ? new Date(d.getFullYear(),d.getMonth()+passo,1)
      : new Date(d.getFullYear(),d.getMonth(),d.getDate()+passo*(modoCalendario==="semana"?7:1)));
  }
  function novo() {
    setEditandoId(null); setTitulo(""); setLegenda(""); setTipo("imagem");
    setPlanejado(""); setStatus("rascunho"); setEditorAberto(true); setVersoesId(null);
    setAba("publicacoes");
  }
  function editar(p: Publicacao) {
    setEditandoId(p.id); setTitulo(p.titulo); setLegenda(p.legenda);
    setTipo(p.tipo); setPlanejado(paraCampo(p.planejado_para));
    setStatus(p.status === "aguardando_aprovacao" ? "aguardando_aprovacao" : "rascunho");
    setEditorAberto(true); setVersoesId(null); setAba("publicacoes");
  }
  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!contexto?.tem_acesso || !titulo.trim()) return;
    if (planejado && !Number.isFinite(new Date(planejado).getTime())) return toast.error("Confira a data planejada.");
    setSalvando(true);
    try {
      const dados = {
        titulo: titulo.trim(), legenda: legenda.trim(), tipo, status,
        planejado_para: planejado ? new Date(planejado).toISOString() : null,
      };
      const query = editandoId
        ? (supabaseBanco as any).from("oricstudio_publicacoes").update(dados)
            .eq("id",editandoId).eq("clinica_id", contexto.clinica_id)
        : (supabaseBanco as any).from("oricstudio_publicacoes")
            .insert({ ...dados, clinica_id: contexto.clinica_id });
      const { error } = await query;
      if (error) throw error;
      toast.success(editandoId ? "Rascunho atualizado." : "Rascunho salvo.");
      setEditorAberto(false); setEditandoId(null);
      await carregar();
      setAba("publicacoes");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar."); }
    finally { setSalvando(false); }
  }
  async function alterarStatus(p: Publicacao, proximo: Status) {
    if (!contexto?.tem_acesso || !window.confirm(`Alterar "${p.titulo}" para "${STATUS[proximo]}"? Esta ação não publica no Instagram.`)) return;
    const { error } = await (supabaseBanco as any).from("oricstudio_publicacoes")
      .update({ status: proximo }).eq("id", p.id).eq("clinica_id", contexto.clinica_id);
    if (error) return toast.error(error.message);
    toast.success("Etapa editorial atualizada. Nada foi publicado.");
    void carregar();
  }
  async function excluir(p: Publicacao) {
    if (!contexto?.tem_acesso || !window.confirm(`Excluir definitivamente o rascunho "${p.titulo}"?`)) return;
    const { error } = await (supabaseBanco as any).from("oricstudio_publicacoes")
      .delete().eq("id", p.id).eq("clinica_id", contexto.clinica_id);
    if (error) return toast.error(error.message);
    toast.success("Rascunho excluído; o evento fica na auditoria.");
    setEditorAberto(false);
    void carregar();
  }
  async function carregarVersoes(p: Publicacao) {
    const { data, error } = await (supabaseBanco as any).from("oricstudio_publicacoes_versoes")
      .select("id,evento,criado_em,autor_id")
      .eq("publicacao_id",p.id).eq("clinica_id",p.clinica_id)
      .order("criado_em",{ascending:false}).limit(30);
    if (error) return toast.error(error.message);
    setVersoes((data||[]) as Versao[]);
    setVersoesId(p.id);
  }
  async function salvarPreferencias(e: FormEvent) {
    e.preventDefault();
    if (!contexto?.tem_acesso || !preferencias) return;
    const {data:auth} = await supabase.auth.getUser();
    if (!auth.user?.id) return toast.error("Faça login novamente.");
    setSalvando(true);
    try {
      const {error} = await (supabaseBanco as any).from("oricstudio_preferencias").upsert({
        ...preferencias, clinica_id: contexto.clinica_id, atualizado_por: auth.user.id,
        atualizado_em: new Date().toISOString(),
      },{onConflict:"clinica_id"});
      if(error)throw error;
      toast.success("Preferências da clínica salvas.");
    } catch(e){toast.error(e instanceof Error?e.message:"Não foi possível salvar.");}
    finally{setSalvando(false);}
  }
  return <main className="mx-auto w-full max-w-7xl space-y-5 px-4 pb-16 pt-6 text-foreground sm:px-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><Link to="/inicio" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4"/> Voltar ao ORICSE</Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-extrabold sm:text-3xl"><Instagram className="h-8 w-8 text-primary"/> OricStúdio</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gestão de Redes Sociais para o Mercado Pet</p>
      </div>
      <button type="button" disabled={carregando} onClick={()=>void carregar()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-card px-3 text-sm"><RefreshCw className="h-4 w-4"/> Atualizar</button>
    </header>
    {carregando && <p role="status" className="rounded-xl border bg-card p-6 text-sm">Carregando a clínica e verificando a licença...</p>}
    {!carregando && erro && <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/60 bg-card p-5 text-sm text-destructive"><AlertCircle className="h-5 w-5 shrink-0"/>{erro}</div>}
    {!carregando && !erro && !contexto && <div className="rounded-xl border bg-card p-6"><p className="font-semibold">Nenhuma clínica selecionada</p><p className="mt-2 text-sm text-muted-foreground">Entre em uma clínica autorizada no ORICSE para consultar o OricStúdio.</p></div>}
    {!carregando && !erro && contexto && !contexto.tem_acesso && <section className="rounded-2xl border bg-card p-6 sm:p-8">
      <div className="flex items-center gap-2 text-primary"><LockKeyhole className="h-6 w-6"/><span className="font-semibold">Produto adicional</span></div>
      <h2 className="mt-3 text-2xl font-bold">OricStúdio para {contexto.clinica_nome}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">O OricStúdio reúne criação de rascunhos, planejamento, calendário editorial e, futuramente, gestão de publicações, comentários e métricas do Instagram.</p>
      <p className="mt-4 text-sm"><strong>Licença:</strong> {contexto.licenca_status.replaceAll("_"," ")}. A contratação ainda não está disponível; a liberação é administrada pela plataforma ORICSE.</p>
      <p className="mt-3 text-sm text-muted-foreground">Nenhum acesso foi concedido automaticamente pelo plano da clínica.</p>
    </section>}
    {!carregando && !erro && contexto?.tem_acesso && <>
      <div className="rounded-xl border bg-card px-4 py-3 text-sm"><strong>{contexto.clinica_nome}</strong><span className="ml-3 text-muted-foreground">Licença ativa · Ambiente exclusivo da clínica</span></div>
      <div className="grid items-start gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
        <nav aria-label="Navegação do OricStúdio" className="flex gap-2 overflow-x-auto pb-2 lg:sticky lg:top-4 lg:block lg:space-y-4 lg:overflow-visible lg:rounded-xl lg:border lg:bg-card lg:p-3">
          {[
            { grupo: "Gestão", itens: ["inicio", "contas", "calendario"] },
            { grupo: "Conteúdo", itens: ["publicacoes", "biblioteca", "aprovacoes"] },
            { grupo: "Análise", itens: ["metricas", "comentarios"] },
            { grupo: "Operação", itens: ["alertas", "configuracoes"] },
          ].map(({grupo,itens})=><div key={grupo} className="contents lg:block">
            <p className="mb-1 hidden px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground lg:block">{grupo}</p>
            {ABAS.filter(x=>itens.includes(x.id)).map(({id,rotulo,Icone})=><button key={id} type="button"
              onClick={()=>{setAba(id);setEditorAberto(false);}}
              aria-current={aba===id?"page":undefined}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-left text-sm font-medium lg:mt-1 lg:w-full lg:border-0 ${aba===id?"bg-primary text-primary-foreground":"bg-card hover:bg-secondary"}`}>
              <Icone className="h-4 w-4 shrink-0"/>{rotulo}</button>)}
          </div>)}
        </nav>
        <div className="min-w-0 space-y-4">
      {aba==="inicio" && <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">Visão geral</h2><button onClick={novo} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Plus className="h-4 w-4"/> Novo rascunho</button></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {([["Publicações editoriais",publicacoes.length],["Aguardando aprovação",pendentes.length],["Datas planejadas",planejadas.length],["Mídias cadastradas",midias.length]] as const)
            .map(([rotulo,valor])=><div key={rotulo} className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{rotulo}</p><p className="mt-2 text-3xl font-bold">{valor}</p></div>)}
        </div>
        <div className="rounded-xl border bg-card p-5"><h3 className="font-bold">Próximas datas do calendário editorial</h3>
          {planejadas.length===0?<p className="mt-2 text-sm text-muted-foreground">Nenhuma data foi planejada.</p>:planejadas.slice(0,5).map(p=><p key={p.id} className="mt-3 border-t pt-3 text-sm">{textoData(p.planejado_para)} · {p.titulo}</p>)}
        </div>
        <p className="text-xs text-muted-foreground">Sem integração com o Instagram nesta etapa: os indicadores acima mostram apenas dados internos do OricStúdio.</p>
      </section>}
      {aba==="publicacoes" && <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Publicações e rascunhos</h2><button onClick={novo} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Plus className="h-4 w-4"/> Criar publicação</button></div>
        {editorAberto && <form onSubmit={e=>void salvar(e)} className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
          <h3 className="text-lg font-semibold">{editandoId?"Editar rascunho":"Nova publicação editorial"}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">Título<input required maxLength={180} value={titulo} onChange={e=>setTitulo(e.target.value)} className="w-full rounded-lg border bg-background p-3"/></label>
            <label className="space-y-1 text-sm font-medium">Formato<select value={tipo} onChange={e=>setTipo(e.target.value as Tipo)} className="w-full rounded-lg border bg-background p-3">{FORMATOS.map(f=><option value={f} key={f}>{f==="imagem"?"Imagem":f==="reels"?"Reels":f==="story"?"Stories":"Carrossel"}</option>)}</select></label>
          </div>
          <label className="block space-y-1 text-sm font-medium">Legenda<textarea maxLength={2200} rows={5} value={legenda} onChange={e=>setLegenda(e.target.value)} className="w-full rounded-lg border bg-background p-3" placeholder="Texto da publicação..."/></label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">Data planejada (opcional)<input type="datetime-local" value={planejado} onChange={e=>setPlanejado(e.target.value)} className="w-full rounded-lg border bg-background p-3"/></label>
            <label className="space-y-1 text-sm font-medium">Fluxo editorial<select value={status} onChange={e=>setStatus(e.target.value as typeof status)} className="w-full rounded-lg border bg-background p-3"><option value="rascunho">Salvar rascunho</option><option value="aguardando_aprovacao">Enviar para aprovação interna</option></select></label>
          </div>
          <p className="text-xs text-muted-foreground">A data é apenas planejamento. Nenhuma publicação será enviada ou agendada no Instagram.</p>
          <div className="flex flex-wrap gap-2"><button disabled={salvando} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"><Save className="h-4 w-4"/>{salvando?"Salvando...":"Salvar"}</button><button type="button" onClick={()=>setEditorAberto(false)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button></div>
        </form>}
        {publicacoes.length===0?<p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Nenhum rascunho. Use “Criar publicação” para começar.</p>:
          <div className="grid gap-3">{publicacoes.map(p=><article key={p.id} className="rounded-xl border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold">{p.titulo}</h3><p className="mt-1 text-xs text-muted-foreground">{p.tipo} · {STATUS[p.status]} · {textoData(p.planejado_para)}</p></div><div className="flex flex-wrap gap-2">
              <button onClick={()=>editar(p)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs"><Pencil className="h-3.5 w-3.5"/> Editar</button>
              <button onClick={()=>void carregarVersoes(p)} className="rounded-lg border px-3 py-2 text-xs">Versões</button>
              <button onClick={()=>void excluir(p)} className="rounded-lg border px-3 py-2 text-xs text-destructive"><Trash2 className="h-3.5 w-3.5"/></button>
            </div></div><p className="mt-3 whitespace-pre-line text-sm">{p.legenda||"Sem legenda."}</p>
            {versoesId===p.id && <div className="mt-3 rounded-lg bg-secondary/40 p-3 text-xs"><strong>Histórico de versões</strong>{versoes.map(v=><p key={v.id} className="mt-2">{textoData(v.criado_em)} — {v.evento}</p>)}</div>}
          </article>)}</div>}
      </section>}
      {aba==="calendario" && <section className="space-y-4">
        <div><h2 className="text-xl font-bold">Calendário editorial</h2><p className="mt-1 text-sm text-muted-foreground">Planejamento interno. A publicação automática será disponibilizada na etapa 3/5.</p></div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={()=>navegarCalendario(-1)} aria-label="Período anterior" className="min-h-10 rounded-lg border px-3">‹</button>
            <button type="button" onClick={()=>setReferenciaCalendario(new Date())} className="min-h-10 rounded-lg border px-3 text-sm">Hoje</button>
            <button type="button" onClick={()=>navegarCalendario(1)} aria-label="Próximo período" className="min-h-10 rounded-lg border px-3">›</button>
            <strong className="ml-1 text-sm capitalize">{referenciaCalendario.toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}</strong>
          </div>
          <div className="flex rounded-lg border p-1">
            {(["dia","semana","mes"] as const).map(m=><button type="button" key={m} onClick={()=>setModoCalendario(m)}
              className={`rounded-md px-3 py-2 text-xs font-semibold ${modoCalendario===m?"bg-primary text-primary-foreground":"hover:bg-secondary"}`}>
              {m==="mes"?"Mês":m==="semana"?"Semana":"Dia"}</button>)}
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border bg-card p-2">
          <div className={`grid gap-1 ${modoCalendario==="dia"?"grid-cols-1":"min-w-[420px] grid-cols-7"}`}>
            {modoCalendario!=="dia"&&["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d=><div key={d} className="px-2 py-2 text-center text-xs font-bold text-muted-foreground">{d}</div>)}
            {calendario.map(d=>{
              const itens=publicacoesPorDia.get(chaveDia(d))||[];
              const fora=modoCalendario==="mes"&&d.getMonth()!==referenciaCalendario.getMonth();
              return <div key={chaveDia(d)} className={`min-h-20 rounded-lg border p-1.5 sm:min-h-28 ${fora?"opacity-45":"bg-background"}`}>
                <div className="flex items-center justify-between"><span className={`text-xs font-semibold ${chaveDia(d)===chaveDia(new Date())?"text-primary":""}`}>{d.getDate()}</span>{itens.length>0&&<span className="rounded-full bg-primary/10 px-1.5 text-[10px] text-primary">{itens.length}</span>}</div>
                {itens.slice(0,2).map(p=><button type="button" key={p.id} title={p.titulo} onClick={()=>editar(p)} className="mt-1 block w-full truncate rounded bg-secondary p-1 text-left text-[10px] hover:bg-primary/10">{p.titulo}</button>)}
                {itens.length>2&&<p className="mt-1 text-[10px] text-muted-foreground">+{itens.length-2} mais</p>}
              </div>;
            })}
          </div>
        </div>
        <div className="space-y-2"><h3 className="text-sm font-bold">Todas as datas planejadas</h3>
          {planejadas.length===0?<p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Nenhuma data planejada.</p>:planejadas.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3"><div><p className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="h-4 w-4"/>{textoData(p.planejado_para)}</p><p className="mt-1 text-sm">{p.titulo} · {STATUS[p.status]}</p></div><button type="button" onClick={()=>editar(p)} className="rounded-lg border px-3 py-2 text-sm">Editar</button></div>)}
        </div>
      </section>}
      {aba==="aprovacoes" && <section className="space-y-3"><h2 className="text-xl font-bold">Aprovações editoriais</h2>
        {pendentes.length===0?<p className="rounded-xl border bg-card p-6 text-sm">Nenhuma publicação aguardando aprovação.</p>:pendentes.map(p=><div key={p.id} className="space-y-3 rounded-xl border bg-card p-4"><h3 className="font-semibold">{p.titulo}</h3><p className="whitespace-pre-line text-sm">{p.legenda}</p><div className="flex flex-wrap gap-2"><button onClick={()=>void alterarStatus(p,"aprovado")} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"><CheckCircle2 className="h-4 w-4"/> Aprovar internamente</button><button onClick={()=>void alterarStatus(p,"rascunho")} className="rounded-lg border px-3 py-2 text-sm">Voltar para rascunho</button></div></div>)}
        <p className="text-xs text-muted-foreground">Aprovação interna não publica nem agenda o conteúdo nas redes sociais.</p>
      </section>}
      {aba==="biblioteca" && <section className="space-y-3"><h2 className="text-xl font-bold">Biblioteca de mídias</h2>
        {midias.length===0?<div className="rounded-xl border bg-card p-7"><FolderOpen className="h-9 w-9 text-muted-foreground"/><h3 className="mt-3 font-semibold">Biblioteca vazia</h3><p className="mt-2 text-sm text-muted-foreground">O armazenamento e envio de arquivos serão conectados na etapa de integração; nenhum conteúdo de outras clínicas será importado.</p></div>:midias.map(m=><div key={m.id} className="rounded-lg border bg-card p-3 text-sm">{m.nome} · {m.tipo}</div>)}
      </section>}
      {aba==="configuracoes" && preferencias && <form onSubmit={e=>void salvarPreferencias(e)} className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-xl font-bold">Identidade e tom de voz da clínica</h2>
        <label className="block space-y-1 text-sm font-semibold">Nome público<input value={preferencias.nome_publico} onChange={e=>setPreferencias({...preferencias,nome_publico:e.target.value})} maxLength={150} className="w-full rounded-lg border bg-background p-3"/></label>
        <label className="block space-y-1 text-sm font-semibold">Tom de voz<textarea rows={3} maxLength={600} value={preferencias.tom_de_voz} onChange={e=>setPreferencias({...preferencias,tom_de_voz:e.target.value})} className="w-full rounded-lg border bg-background p-3"/></label>
        <label className="block space-y-1 text-sm font-semibold">Hashtags padrão<textarea rows={2} maxLength={1000} value={preferencias.hashtags_padrao} onChange={e=>setPreferencias({...preferencias,hashtags_padrao:e.target.value})} className="w-full rounded-lg border bg-background p-3"/></label>
        <p className="text-xs text-muted-foreground">Fuso horário de referência: {preferencias.fuso_horario}. Nenhuma alteração na marca institucional ORICSE.</p>
        <button disabled={salvando} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Save className="h-4 w-4"/> Salvar preferências</button>
      </form>}
      {(["contas","comentarios","metricas","alertas"] as Aba[]).includes(aba) && <section className="rounded-xl border bg-card p-6">
        <h2 className="text-xl font-bold">{ABAS.find(a=>a.id===aba)?.rotulo}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {aba==="contas"?"Nenhuma conta conectada. Cada clínica conectará suas próprias contas profissionais na etapa 3/5.":
           aba==="comentarios"?"Comentários e respostas serão sincronizados após a conexão Meta, respeitando as permissões concedidas.":
           aba==="metricas"?"Métricas reais de alcance e interações serão apresentadas após a conexão das contas. Nenhum número será simulado.":
           "Não há alertas de publicação porque a integração com Instagram ainda não está ativa. Erros de conexão e envio serão acompanhados na etapa 3/5."}
        </p>
      </section>}
        </div>
      </div>
    </>}
  </main>;
}
