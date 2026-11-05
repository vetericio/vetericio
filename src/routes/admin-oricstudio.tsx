import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, CalendarClock, ClipboardList, CreditCard, Instagram, LockKeyhole, RefreshCw, Settings, ShieldCheck, Users, Activity } from "lucide-react";
import { toast } from "sonner";
import { supabase, supabaseBanco } from "@/integrations/supabase/client";
import { ORICSTUDIO_LOGO } from "@/lib/oricstudio-logo";

export const Route = createFileRoute("/admin-oricstudio")({ component: OricStudioAdmin });

type LicencaStatus = "nao_contratado" | "pendente" | "ativo" | "suspenso" | "expirado";
type Clinica = { id: string; nome: string; status: string; plano: string };
type Licenca = { clinica_id: string; status: LicencaStatus; motivo: string | null; atualizado_em: string; expira_em: string | null };
type Historico = { id: number; acao: string; clinica_id: string | null; criado_em: string; usuario_id: string | null; antes: unknown; depois: unknown };
const ESTADOS: LicencaStatus[] = ["nao_contratado","pendente","ativo","suspenso","expirado"];
const NOMES: Record<LicencaStatus,string> = { nao_contratado:"Não contratado",pendente:"Pendente",ativo:"Ativo",suspenso:"Suspenso",expirado:"Expirado" };
const ABAS = [
  {id:"visao",nome:"Visão geral",icon:Activity},
  {id:"clinicas",nome:"Clínicas e acessos",icon:Building2},
  {id:"comercial",nome:"Comercialização",icon:CreditCard},
  {id:"contas",nome:"Contas conectadas",icon:Users},
  {id:"monitoramento",nome:"Monitoramento",icon:CalendarClock},
  {id:"auditoria",nome:"Auditoria",icon:ShieldCheck},
  {id:"config",nome:"Configurações",icon:Settings}
] as const;
type Aba = typeof ABAS[number]["id"];

function OricStudioAdmin() {
  const navigate = useNavigate();
  const [autorizado,setAutorizado] = useState<boolean|null>(null);
  const [carregando,setCarregando] = useState(true);
  const [aba,setAba] = useState<Aba>("visao");
  const [clinicas,setClinicas] = useState<Clinica[]>([]);
  const [licencas,setLicencas] = useState<Licenca[]>([]);
  const [historico,setHistorico] = useState<Historico[]>([]);
  const [busca,setBusca] = useState("");
  const [alterando,setAlterando] = useState<string|null>(null);
  const [erro,setErro] = useState("");
  const [produto,setProduto] = useState<{nome:string;descricao:string;preco_centavos:number|null;comercializacao_ativa:boolean;disponivel_nos_planos:boolean}|null>(null);

  async function carregar() {
    setCarregando(true); setErro("");
    try {
      const {data:{session}}=await supabase.auth.getSession();
      if (!session?.user?.id) {setAutorizado(false);void navigate({to:"/login"});return;}
      const {data:perfil,error:perfilErro}=await (supabase as any).from("app_users").select("role").eq("user_id",session.user.id).maybeSingle();
      if (perfilErro) throw perfilErro;
      if (perfil?.role !== "admin") {setAutorizado(false);void navigate({to:"/inicio"});return;}
      setAutorizado(true);
      const buscarTudo = async (tabela:string,colunas:string,ordenar:string) => {
        const todas:any[]=[];
        const lote=500;
        for (let inicio=0;inicio<100000;inicio+=lote) {
          const {data,error}=await (supabaseBanco as any).from(tabela).select(colunas).order(ordenar,{ascending:tabela==="clinicas"}).range(inicio,inicio+lote-1);
          if(error)throw error;
          todas.push(...(data||[]));
          if((data||[]).length<lote)return todas;
        }
        throw new Error("Limite de consulta atingido; confirme a listagem no banco.");
      };
      const [cs,ls,hs,ps]=await Promise.all([
        buscarTudo("clinicas","id,nome,status,plano","nome"),
        buscarTudo("oricstudio_licencas","clinica_id,status,motivo,atualizado_em,expira_em","atualizado_em"),
        buscarTudo("oricstudio_auditoria","id,acao,clinica_id,criado_em,usuario_id,antes,depois","criado_em"),
        (supabaseBanco as any).from("oricstudio_produto").select("nome,descricao,preco_centavos,comercializacao_ativa,disponivel_nos_planos").eq("codigo","oricstudio").single()
      ]);
      if (ps.error)throw ps.error;
      setClinicas(cs);setLicencas(ls);setHistorico(hs);setProduto(ps.data);
    } catch(e) {
      const mensagem=e instanceof Error?e.message:String(e);
      setErro("Falha ao consultar os dados. Nenhuma clínica foi ocultada: "+mensagem);
      toast.error("Não foi possível carregar a administração do OricStúdio.");
    } finally {setCarregando(false);}
  }

  useEffect(()=>{void carregar();},[]);
  const porClinica=useMemo(()=>new Map(licencas.map(l=>[l.clinica_id,l])),[licencas]);
  const visiveis=useMemo(()=>clinicas.filter(c=>c.nome.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR"))),[clinicas,busca]);
  const ativos=licencas.filter(l=>l.status==="ativo").length;
  async function mudarStatus(clinica:Clinica,novo:LicencaStatus) {
    const antes=porClinica.get(clinica.id)?.status||"nao_contratado";
    if(antes===novo)return;
    if (!window.confirm("Alterar OricStúdio de "+clinica.nome+" de "+NOMES[antes]+" para "+NOMES[novo]+"?"))return;
    const motivo=window.prompt("Motivo da alteração (obrigatório para auditoria):","");
    if(!motivo?.trim())return toast.error("Informe o motivo da alteração.");
    setAlterando(clinica.id);
    try {
      const {error}=await (supabaseBanco as any).from("oricstudio_licencas").upsert({clinica_id:clinica.id,status:novo,motivo:motivo.trim()},{onConflict:"clinica_id"});
      if(error)throw error;
      toast.success("Licença atualizada e registrada na auditoria.");
      await carregar();
      setAba("clinicas");
    } catch(e){toast.error(e instanceof Error?e.message:"Não foi possível salvar.");}
    finally{setAlterando(null);}
  }
  if(autorizado===false) return <div className="p-8">Acesso restrito à Administração Geral.</div>;
  return <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 text-foreground">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-1"><Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4"/> Administração Geral</Link>
      <h1 className="flex items-center gap-2 text-2xl font-bold"><img src={ORICSTUDIO_LOGO} alt="Logo oficial OricStúdio" className="h-12 w-12 rounded-lg object-contain" /> OricStúdio</h1>
      <p className="text-sm text-muted-foreground">Gestão de Redes Sociais para o Mercado Pet · Administração central</p></div>
      <button onClick={()=>void carregar()} disabled={carregando} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCw className="h-4 w-4"/> Atualizar</button>
    </header>
    <div className="rounded-xl border bg-card p-3 text-sm"><span className="font-semibold">Produto em preparação.</span> Sem comercialização ativa, preço não definido e sem inclusão automática nos planos do ORICSE.</div>
    <nav className="flex flex-wrap gap-2" aria-label="Páginas do OricStúdio">{ABAS.map(({id,nome,icon:Icon})=><button type="button" key={id} onClick={()=>setAba(id)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${aba===id?"bg-primary text-primary-foreground":"bg-card hover:bg-accent"}`}><Icon className="h-4 w-4"/>{nome}</button>)}</nav>
    {erro && <div role="alert" className="rounded-lg border border-destructive p-4 text-sm text-destructive">{erro}</div>}
    {carregando && <p className="text-sm text-muted-foreground">Consultando informações...</p>}
    {!carregando && !erro && <>
      {aba==="visao" && <section className="grid gap-3 sm:grid-cols-3">
        {[["Clínicas cadastradas",clinicas.length],["Licenças ativas",ativos],["Sem licença ativa",clinicas.length-ativos]].map(([titulo,valor])=><div key={titulo} className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{titulo}</p><p className="mt-1 text-3xl font-bold">{valor}</p></div>)}
        <div className="sm:col-span-3 rounded-xl border bg-card p-5"><h2 className="font-semibold">Etapa 1/5 — Administração Geral</h2><p className="mt-2 text-sm text-muted-foreground">O controle das licenças fica centralizado aqui. Nenhuma clínica obtém acesso automaticamente. A construção do aplicativo para cada clínica é a etapa 2/5.</p></div>
      </section>}
      {aba==="clinicas" && <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Clínicas e acessos ({clinicas.length})</h2><input className="min-w-52 rounded-lg border bg-background p-2 text-sm" placeholder="Buscar clínica" value={busca} onChange={e=>setBusca(e.target.value)} /></div>
        <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-muted"><tr><th className="p-3">Clínica</th><th className="p-3">Plano atual</th><th className="p-3">Licença OricStúdio</th><th className="p-3">Motivo / situação</th></tr></thead><tbody>{visiveis.map(c=>{const l=porClinica.get(c.id);return <tr key={c.id} className="border-t"><td className="p-3 font-medium">{c.nome}<div className="text-xs text-muted-foreground">{c.status}</div></td><td className="p-3">{c.plano}</td><td className="p-3"><select aria-label={`Licença de ${c.nome}`} disabled={alterando===c.id} className="rounded-lg border bg-background px-2 py-2" value={l?.status||"nao_contratado"} onChange={e=>void mudarStatus(c,e.target.value as LicencaStatus)}>{ESTADOS.map(s=><option key={s} value={s}>{NOMES[s]}</option>)}</select></td><td className="p-3 text-muted-foreground">{l?.motivo||"Nenhuma contratação registrada"}</td></tr>})}</tbody></table></div>
        <p className="text-xs text-muted-foreground">Todos os registros são carregados com paginação. O filtro de busca não altera licenças nem oculta dados armazenados.</p>
      </section>}
      {aba==="comercial" && <section className="rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">Comercialização</h2><p className="mt-2 text-sm">Preço: <strong>{produto?.preco_centavos==null?"A definir":(produto.preco_centavos/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong></p><p className="mt-1 text-sm">Venda pública: <strong>{produto?.comercializacao_ativa?"Ativa":"Desativada"}</strong></p><p className="mt-1 text-sm">Inclusão nos planos: <strong>{produto?.disponivel_nos_planos?"Configurada":"Nenhuma"}</strong></p><p className="mt-3 text-sm text-muted-foreground">Preços e condições comerciais serão definidos na etapa 4/5. Nenhuma cobrança foi criada.</p></section>}
      {aba==="auditoria" && <section className="space-y-3"><h2 className="text-lg font-semibold">Auditoria ({historico.length})</h2>{historico.length===0?<p className="rounded-lg border p-4 text-sm">Ainda não há alterações de licenças.</p>:<div className="space-y-2">{historico.slice(0,100).map(h=><div key={h.id} className="rounded-lg border bg-card p-3 text-sm"><strong>{h.acao}</strong> · {new Date(h.criado_em).toLocaleString("pt-BR")}<div className="text-xs text-muted-foreground">Clínica: {clinicas.find(c=>c.id===h.clinica_id)?.nome||h.clinica_id||"Excluída"} · Usuário: {h.usuario_id||"Sistema"}</div></div>)}</div>}</section>}
      {(aba==="contas"||aba==="monitoramento"||aba==="config") && <section className="rounded-xl border bg-card p-5"><div className="flex items-center gap-2"><LockKeyhole className="h-5 w-5"/><h2 className="text-lg font-semibold">{ABAS.find(a=>a.id===aba)?.nome}</h2></div><p className="mt-3 text-sm text-muted-foreground">Área administrativa reservada. Não existem contas Meta conectadas ao OricStúdio. Integração e operações são previstas para a etapa 3/5; configurações sensíveis permanecerão no servidor.</p></section>}
    </>}
  </main>;
}
