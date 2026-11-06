import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, CalendarClock, ClipboardList, CreditCard, Instagram, LockKeyhole, RefreshCw, Settings, ShieldCheck, Users, Activity } from "lucide-react";
import { toast } from "sonner";
import { supabase, supabaseBanco } from "@/integrations/supabase/client";
import { ORICSTUDIO_LOGO } from "@/lib/oricstudio-logo";
import { semClinicasNaLixeira } from "@/lib/clinicas-visiveis";

export const Route = createFileRoute("/admin-oricstudio")({ component: OricStudioAdmin });

type LicencaStatus = "nao_contratado" | "pendente" | "ativo" | "suspenso" | "expirado";
type Clinica = { id: string; nome: string; status: string; plano: string };
type Licenca = { clinica_id: string; status: LicencaStatus; motivo: string | null; atualizado_em: string; expira_em: string | null; quantidade_contas_contratadas:number };
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
  const [solicitacoes,setSolicitacoes] = useState<Array<{
    id:string;clinica_id:string;quantidade_contas:number;valor_mensal_centavos:number;
    status:string;criado_em:string;referencia_pagamento:string|null;
  }>>([]);
  const [cobrancas,setCobrancas] = useState<Array<{id:number;clinica_id:string;tipo:string;criado_em:string;referencia:string|null}>>([]);
  const [pagamentos,setPagamentos] = useState<Array<{id:number;clinica_id:string;valor_centavos:number;status_mp:string;aprovado_em:string}>>([]);
  const [statusPagamento,setStatusPagamento] = useState<{
    mercado_pago_configurado:boolean;webhook_exclusivo_configurado:boolean;
    conciliacao_programada_configurada:boolean;precos_configurados:boolean;comercializacao_ativa:boolean
  }|null>(null);
  const [busca,setBusca] = useState("");
  const [alterando,setAlterando] = useState<string|null>(null);
  const [precoBase,setPrecoBase] = useState("");
  const [precoAdicional,setPrecoAdicional] = useState("");
  const [quantidadeSimulador,setQuantidadeSimulador] = useState(1);
  const [erro,setErro] = useState("");
  const [produto,setProduto] = useState<{nome:string;descricao:string;preco_centavos:number|null;preco_conta_adicional_centavos:number|null;comercializacao_ativa:boolean;disponivel_nos_planos:boolean}|null>(null);

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
          const origem=(supabaseBanco as any).from(tabela).select(colunas);
          const consulta=tabela==="clinicas" ? semClinicasNaLixeira(origem) : origem;
          const {data,error}=await consulta.order(ordenar,{ascending:tabela==="clinicas"}).range(inicio,inicio+lote-1);
          if(error)throw error;
          todas.push(...(data||[]));
          if((data||[]).length<lote)return todas;
        }
        throw new Error("Limite de consulta atingido; confirme a listagem no banco.");
      };
      const [cs,ls,hs,ps,sol,ce,pg]=await Promise.all([
        buscarTudo("clinicas","id,nome,status,plano","nome"),
        buscarTudo("oricstudio_licencas","clinica_id,status,motivo,atualizado_em,expira_em,quantidade_contas_contratadas","atualizado_em"),
        buscarTudo("oricstudio_auditoria","id,acao,clinica_id,criado_em,usuario_id,antes,depois","criado_em"),
        (supabaseBanco as any).from("oricstudio_produto").select("nome,descricao,preco_centavos,preco_conta_adicional_centavos,comercializacao_ativa,disponivel_nos_planos").eq("codigo","oricstudio").single(),
        buscarTudo("oricstudio_solicitacoes","id,clinica_id,quantidade_contas,valor_mensal_centavos,status,criado_em,referencia_pagamento","criado_em"),
        buscarTudo("oricstudio_eventos_cobranca","id,clinica_id,tipo,criado_em,referencia","criado_em"),
        buscarTudo("oricstudio_pagamentos","id,clinica_id,valor_centavos,status_mp,aprovado_em","aprovado_em")
      ]);
      if (ps.error)throw ps.error;
      setClinicas(cs);setLicencas(ls);setHistorico(hs);setProduto(ps.data);setSolicitacoes(sol);setCobrancas(ce);setPagamentos(pg);
      const status=await supabaseBanco.functions.invoke("oricstudio-checkout",{
        body:{acao:"status_configuracao"},
        headers:{"Authorization":"Bearer "+session.access_token},
      });
      setStatusPagamento(status.error?null:(status.data||null));
      setPrecoBase(ps.data.preco_centavos==null?"":(ps.data.preco_centavos/100).toFixed(2).replace(".",","));
      setPrecoAdicional(ps.data.preco_conta_adicional_centavos==null?"":(ps.data.preco_conta_adicional_centavos/100).toFixed(2).replace(".",","));
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
  function emCentavos(raw:string) {
    const normalized=raw.trim().replaceAll(".","").replace(",",".");
    if(!/^\d+(?:\.\d{1,2})?$/.test(normalized))return null;
    const result=Math.round(Number(normalized)*100);
    return Number.isSafeInteger(result)&&result>=0?result:null;
  }
  const precificacaoPronta=produto?.preco_centavos!=null && produto?.preco_conta_adicional_centavos!=null;
  const mensalidadeSimulada=precificacaoPronta
    ? produto!.preco_centavos!+Math.max(0,quantidadeSimulador-1)*produto!.preco_conta_adicional_centavos!
    : null;
  const moeda=(valor:number)=> (valor/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  async function salvarTabelaPrecos() {
    const base=emCentavos(precoBase),adicional=emCentavos(precoAdicional);
    if(base===null||adicional===null)return toast.error("Informe valores válidos, como 49,90 e 9,90.");
    if(!window.confirm("Salvar preço-base com 1 conta e valor por conta adicional? Isto NÃO ativa vendas nem cobra clientes."))return;
    setAlterando("precos");
    try {
      const {error}=await (supabaseBanco as any).from("oricstudio_produto")
        .update({preco_centavos:base,preco_conta_adicional_centavos:adicional,atualizado_em:new Date().toISOString()})
        .eq("codigo","oricstudio");
      if(error)throw error;
      toast.success("Tabela de preços salva. Comercialização permanece desativada.");
      await carregar();setAba("comercial");
    }catch(e){toast.error(e instanceof Error?e.message:"Erro ao salvar preços.");}
    finally{setAlterando(null);}
  }
  async function alterarQuantidade(clinica:Clinica,quantidade:number) {
    if(!Number.isInteger(quantidade)||quantidade<1||quantidade>100)return;
    const atual=porClinica.get(clinica.id)?.quantidade_contas_contratadas??1;
    if(quantidade===atual)return;
    const motivo=window.prompt(`Mudar o total de contas de ${clinica.nome} de ${atual} para ${quantidade}. Informe o motivo (nenhuma cobrança será realizada automaticamente):`,"");
    if(!motivo?.trim())return;
    setAlterando(clinica.id);
    try {
      const {error}=await (supabaseBanco as any).from("oricstudio_licencas")
        .update({quantidade_contas_contratadas:quantidade,motivo:motivo.trim()})
        .eq("clinica_id",clinica.id).eq("status","ativo");
      if(error)throw error;
      toast.success("Cota de contas atualizada, sem gerar cobrança.");
      await carregar();setAba("clinicas");
    }catch(e){toast.error(e instanceof Error?e.message:"Não foi possível atualizar a cota.");}
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
    <div className="rounded-xl border bg-card p-3 text-sm"><span className="font-semibold">OricStúdio — produto adicional.</span> Comercialização: {produto?.comercializacao_ativa?"ativa":"desativada"}. Valores: {produto?.preco_centavos!=null && produto?.preco_conta_adicional_centavos!=null?"configurados":"pendentes"}. Nenhuma inclusão automática nos planos do ORICSE.</div>
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
        <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-muted"><tr><th className="p-3">Clínica</th><th className="p-3">Plano atual</th><th className="p-3">Licença OricStúdio</th><th className="p-3">Contas contratadas</th><th className="p-3">Motivo / situação</th></tr></thead><tbody>{visiveis.map(c=>{const l=porClinica.get(c.id);return <tr key={c.id} className="border-t"><td className="p-3 font-medium">{c.nome}<div className="text-xs text-muted-foreground">{c.status}</div></td><td className="p-3">{c.plano}</td><td className="p-3"><select aria-label={`Licença de ${c.nome}`} disabled={alterando===c.id} className="rounded-lg border bg-background px-2 py-2" value={l?.status||"nao_contratado"} onChange={e=>void mudarStatus(c,e.target.value as LicencaStatus)}>{ESTADOS.map(s=><option key={s} value={s}>{NOMES[s]}</option>)}</select></td><td className="p-3"><input type="number" min={1} max={100} className="w-20 rounded-lg border bg-background p-2" disabled={alterando===c.id || l?.status!=="ativo"} key={`${c.id}:${l?.quantidade_contas_contratadas??1}`} defaultValue={l?.quantidade_contas_contratadas??1} aria-label={`Total de contas contratadas de ${c.nome}`} onBlur={e=>void alterarQuantidade(c,Number(e.target.value))} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}}/></td><td className="p-3 text-muted-foreground">{l?.motivo||"Nenhuma contratação registrada"}</td></tr>})}</tbody></table></div>
        <p className="text-xs text-muted-foreground">Todos os registros são carregados com paginação. O filtro de busca não altera licenças nem oculta dados armazenados.</p>
      </section>}
      {aba==="comercial" && <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">OricStúdio — Assinatura por conta</h2>
        <p className="text-sm text-muted-foreground">O sistema inclui 1 conta Instagram. A partir da segunda, acrescenta-se um valor mensal por conta adicional.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold">Mensalidade base (1 conta) — R$
            <input inputMode="decimal" placeholder="A definir" value={precoBase} onChange={e=>setPrecoBase(e.target.value)} className="mt-2 w-full rounded-lg border bg-background p-3"/>
          </label>
          <label className="space-y-2 text-sm font-semibold">Por conta adicional/mês — R$
            <input inputMode="decimal" placeholder="A definir" value={precoAdicional} onChange={e=>setPrecoAdicional(e.target.value)} className="mt-2 w-full rounded-lg border bg-background p-3"/>
          </label>
        </div>
        <button type="button" disabled={alterando==="precos"} onClick={()=>void salvarTabelaPrecos()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Salvar tabela de preços</button>
        <div className="space-y-3 rounded-xl border bg-background p-4">
          <h3 className="font-semibold">Simulador comercial</h3>
          <label className="block text-sm">Quantidade total de contas
            <input className="ml-3 w-20 rounded-lg border bg-background p-2" type="number" min={1} max={100} value={quantidadeSimulador} onChange={e=>setQuantidadeSimulador(Math.max(1,Math.min(100,Number(e.target.value)||1)))}/>
          </label>
          <p className="text-sm">1 conta inclusa + {Math.max(0,quantidadeSimulador-1)} adicionais</p>
          <p className="text-xl font-bold">Total mensal: {mensalidadeSimulada===null?"A definir":moeda(mensalidadeSimulada)}</p>
        </div>
        <p className="text-sm">Venda pública: <strong>{produto?.comercializacao_ativa?"Ativa":"Desativada"}</strong></p>
        <p className="text-sm">Inclusão automática nos planos ORICSE: <strong>{produto?.disponivel_nos_planos?"Configurada":"Nenhuma"}</strong></p>
        <div className="space-y-2">
          <h3 className="font-semibold">Solicitações de contratação ({solicitacoes.length})</h3>
          {solicitacoes.length===0
            ? <p className="text-sm text-muted-foreground">Nenhuma solicitação registrada.</p>
            : <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[560px] text-left text-xs"><thead className="bg-muted"><tr><th className="p-3">Clínica</th><th className="p-3">Contas</th><th className="p-3">Valor mensal</th><th className="p-3">Situação</th><th className="p-3">Data</th></tr></thead><tbody>
              {solicitacoes.map(item=><tr key={item.id} className="border-t">
                <td className="p-3">{clinicas.find(c=>c.id===item.clinica_id)?.nome||item.clinica_id}</td>
                <td className="p-3">{item.quantidade_contas}</td><td className="p-3">{moeda(item.valor_mensal_centavos)}</td>
                <td className="p-3">{item.status.replaceAll("_"," ")}</td><td className="p-3">{new Date(item.criado_em).toLocaleString("pt-BR")}</td>
              </tr>)}
            </tbody></table></div>}
          <p className="text-xs text-muted-foreground">Solicitações não representam pagamentos aprovados. Ativações ficam bloqueadas até a conciliação oficial.</p>
        </div>
        <p className="text-xs text-muted-foreground">Os valores só são uma tabela comercial. Não há checkout, cobrança recorrente, ativação automática ou desconto proporcional nesta etapa.</p>
      </section>}
      {aba==="auditoria" && <section className="space-y-3"><h2 className="text-lg font-semibold">Auditoria ({historico.length})</h2>{historico.length===0?<p className="rounded-lg border p-4 text-sm">Ainda não há alterações de licenças.</p>:<div className="space-y-2">{historico.slice(0,100).map(h=><div key={h.id} className="rounded-lg border bg-card p-3 text-sm"><strong>{h.acao}</strong> · {new Date(h.criado_em).toLocaleString("pt-BR")}<div className="text-xs text-muted-foreground">Clínica: {clinicas.find(c=>c.id===h.clinica_id)?.nome||h.clinica_id||"Excluída"} · Usuário: {h.usuario_id||"Sistema"}</div></div>)}</div>}</section>}
      {aba==="monitoramento" && <section className="space-y-4">
        <h2 className="text-lg font-semibold">Monitoramento financeiro OricStúdio</h2>
        <div className="rounded-xl border bg-card p-4">
          <h3 className="font-semibold">Preparação para comercialização</h3>
          {statusPagamento? <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {([
              ["Credencial Mercado Pago",statusPagamento.mercado_pago_configurado],
              ["Webhook exclusivo OricStúdio",statusPagamento.webhook_exclusivo_configurado],
              ["Segredo da conciliação automática",statusPagamento.conciliacao_programada_configurada],
              ["Tabela de preços",statusPagamento.precos_configurados],
              ["Vendas ativadas",statusPagamento.comercializacao_ativa],
            ] as const).map(([nome,ok])=><p key={nome} className="flex items-center gap-2">
              <span aria-hidden="true" className={ok?"text-emerald-600":"text-amber-600"}>{ok?"●":"○"}</span>
              {nome}: <strong>{ok?"Configurado":"Pendente"}</strong>
            </p>)}
          </div>:<p className="mt-2 text-sm text-muted-foreground">Não foi possível consultar a configuração do servidor. Não interprete como integração liberada.</p>}
          <p className="mt-3 text-xs text-muted-foreground">Esta verificação confirma a presença das configurações, não a aprovação dos webhooks ou o sucesso de uma cobrança de teste. A rotina agendada também precisa da mesma chave no GitHub Actions.</p>
        </div>
        <p className="text-xs text-muted-foreground">Dados de cobranças conciliadas, separados dos planos principais ORICSE.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Pagamentos registrados</p><p className="mt-2 text-2xl font-bold">{pagamentos.length}</p></div>
          <div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Reversões / estornos</p><p className="mt-2 text-2xl font-bold">{pagamentos.filter(p=>p.status_mp!=="approved").length}</p></div>
          <div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Eventos financeiros</p><p className="mt-2 text-2xl font-bold">{cobrancas.length}</p></div>
        </div>
        <h3 className="font-semibold">Últimos eventos de cobrança</h3>
        {cobrancas.length===0?<p className="rounded-xl border p-4 text-sm">Nenhum evento registrado.</p>
          :<div className="space-y-2">{cobrancas.slice(0,50).map(e=><div key={e.id} className="rounded-xl border bg-card p-3 text-sm">
            <strong>{e.tipo.replaceAll("_"," ")}</strong> · {clinicas.find(c=>c.id===e.clinica_id)?.nome||e.clinica_id}
            <p className="mt-1 text-xs text-muted-foreground">{new Date(e.criado_em).toLocaleString("pt-BR")}</p>
          </div>)}</div>}
        <h3 className="font-semibold">Pagamentos confirmados no sistema</h3>
        {pagamentos.length===0?<p className="rounded-xl border p-4 text-sm">Nenhum pagamento registrado.</p>
          :<div className="space-y-2">{pagamentos.slice(0,50).map(p=><div key={p.id} className="rounded-xl border bg-card p-3 text-sm">
            <strong>{moeda(p.valor_centavos)}</strong> · {clinicas.find(c=>c.id===p.clinica_id)?.nome||p.clinica_id} · {p.status_mp}
            <p className="mt-1 text-xs text-muted-foreground">{new Date(p.aprovado_em).toLocaleString("pt-BR")}</p>
          </div>)}</div>}
        <p className="text-xs text-muted-foreground">Esta tela não executa cobranças nem substitui a conciliação periódica com o Mercado Pago.</p>
      </section>}
      {(aba==="contas"||aba==="config") && <section className="rounded-xl border bg-card p-5"><div className="flex items-center gap-2"><LockKeyhole className="h-5 w-5"/><h2 className="text-lg font-semibold">{ABAS.find(a=>a.id===aba)?.nome}</h2></div><p className="mt-3 text-sm text-muted-foreground">Área administrativa reservada. Não existem contas Meta conectadas ao OricStúdio. Integração e operações são previstas para a etapa 3/5; configurações sensíveis permanecerão no servidor.</p></section>}
    </>}
  </main>;
}
