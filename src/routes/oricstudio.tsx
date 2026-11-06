import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle, ArrowLeft, BarChart3, Bell, CalendarDays, CheckCircle2,
  Clock3, FileImage, FolderOpen, Instagram, LayoutDashboard, LockKeyhole,
  MessageCircle, Pencil, Plus, RefreshCw, Save, Settings2, ShieldCheck, Trash2, Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase, supabaseBanco } from "@/integrations/supabase/client";
import { ORICSTUDIO_LOGO } from "@/lib/oricstudio-logo";
import { ORICSTUDIO_PLATAFORMA_ID } from "@/lib/oricstudio-plataforma";
import { enviarArquivoDrive, excluirArquivoDrive, visualizarImagemPrivadaDrive } from "@/lib/drive.functions";
import { iniciarConexaoMetaOricStudio, listarContasMetaOricStudio, desconectarContaMetaOricStudio, statusIntegracaoMetaOricStudio, verificarContaMetaOricStudio } from "@/lib/oricstudio-meta.functions";

export const Route = createFileRoute("/oricstudio")({
  validateSearch: (search: Record<string, unknown>) => ({ ambiente: search.ambiente === "plataforma" ? "plataforma" as const : undefined }),
  head: () => ({ meta: [{ title: "OricStúdio — ORICSE" }] }),
  component: OricStudio,
});

type Status = "rascunho" | "aguardando_aprovacao" | "aprovado";
type Tipo = "imagem" | "carrossel" | "reels" | "story";
type Aba = "inicio" | "contas" | "publicacoes" | "calendario" | "biblioteca" | "aprovacoes" | "comentarios" | "metricas" | "alertas" | "configuracoes";
type Contexto = {
  clinica_id: string; clinica_nome: string; clinica_status: string;
  licenca_status: string; licenca_expira_em: string | null; tem_acesso: boolean; pode_editar: boolean;
};
type Publicacao = {
  id: string; clinica_id: string; titulo: string; legenda: string; tipo: Tipo; status: Status;
  planejado_para: string | null; criado_em: string; atualizado_em: string;
};
type Midia = { id: string; nome: string; tipo: string; criado_em: string; caminho_privado: string };
type ContaMeta = { id:string; clinica_id:string; instagram_user_id:string; username:string; account_type:string|null; status:string; escopos:string[]; conectado_em:string; token_expira_em:string|null };
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
  const { ambiente } = Route.useSearch();
  const modoPlataforma = ambiente === "plataforma";
  // A interface é única: apenas o provedor de dados muda entre a clínica e a ORICSE.
  const tabelaPublicacoes = modoPlataforma ? "oricstudio_sistema_publicacoes" : "oricstudio_publicacoes";
  const tabelaVersoes = modoPlataforma ? "oricstudio_sistema_versoes" : "oricstudio_publicacoes_versoes";
  const tabelaMidias = modoPlataforma ? "oricstudio_sistema_midias" : "oricstudio_midias";
  const tabelaPreferencias = modoPlataforma ? "oricstudio_sistema_preferencias" : "oricstudio_preferencias";
  const filtrarClinica = (consulta: any, id: string) => modoPlataforma ? consulta : consulta.eq("clinica_id", id);
  const [aba, setAba] = useState<Aba>("inicio");
  const [modoCalendario, setModoCalendario] = useState<"mes"|"semana"|"dia">("mes");
  const [referenciaCalendario, setReferenciaCalendario] = useState(() => new Date());
  const [contexto, setContexto] = useState<Contexto | null>(null);
  const [comercial, setComercial] = useState<{preco_base_centavos:number|null;preco_adicional_centavos:number|null;comercializacao_ativa:boolean}|null>(null);
  const [quantidadeContratacao,setQuantidadeContratacao] = useState(1);
  const [solicitando,setSolicitando] = useState(false);
  const [pedidoAberto,setPedidoAberto] = useState<{id:string;status:string;quantidade_contas:number;valor_mensal_centavos:number}|null>(null);
  const [assinatura,setAssinatura] = useState<{
    id:string;status:string;quantidade_contas:number;valor_mensal_centavos:number;
    mp_assinatura_status:string|null;cancelamento_em:string|null;ultima_conciliacao_em:string|null;
  }|null>(null);
  const [cancelandoAssinatura,setCancelandoAssinatura]=useState(false);
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([]);
  const [midias, setMidias] = useState<Midia[]>([]);
  const [contasMeta, setContasMeta] = useState<ContaMeta[]>([]);
  const [metaConfigurada, setMetaConfigurada] = useState(false);
  const [metaDiagnostico, setMetaDiagnostico] = useState<{
    instagramAppId:string; callback:string; formatoIdValido:boolean;
    configurationIdConfigurado:boolean; appSecretConfigurado:boolean; chaveCriptografiaValida:boolean;
  } | null>(null);
  const [metaCarregando, setMetaCarregando] = useState(false);
  const [metaOcupada, setMetaOcupada] = useState(false);
  const [metaErro, setMetaErro] = useState("");
  const [enviandoMidia, setEnviandoMidia] = useState(false);
  const [previas, setPrevias] = useState<Record<string,string>>({});
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
    setContexto(null); setPublicacoes([]); setMidias([]); setPreferencias(null); setContasMeta([]); setMetaErro(""); setMetaDiagnostico(null); setPedidoAberto(null); setAssinatura(null); setComercial(null);
    try {
      const { data: auth, error: authErro } = await supabase.auth.getUser();
      if (authErro || !auth.user?.id) throw new Error("Entre na sua conta para consultar o OricStúdio.");
      // O modo interno não depende da clínica selecionada. A autorização é confirmada no banco,
      // e todas as tabelas do sistema têm RLS exclusivo para administradores da plataforma.
      let c: Contexto | null;
      if (modoPlataforma) {
        const {data:admin, error} = await (supabaseBanco as any).rpc("oricstudio_eh_admin");
        if (error) throw error;
        if (admin !== true) throw new Error("Acesso exclusivo da Administração Geral do ORICSE.");
        c = {
          clinica_id: ORICSTUDIO_PLATAFORMA_ID, clinica_nome:"ORICSE",
          clinica_status:"ativa", licenca_status:"interno", licenca_expira_em:null,
          tem_acesso:true, pode_editar:true,
        };
      } else {
        // A clínica é resolvida pelo servidor; nenhum ID fornecido pelo navegador autoriza acesso.
        const {data, error} = await (supabaseBanco as any).rpc("oricstudio_meu_contexto");
        if (error) throw error;
        c = data as Contexto | null;
      }
      if (seq !== requisicao.current) return;
      setContexto(c);
      if (c && !modoPlataforma) {
        const catalogo=await (supabaseBanco as any).rpc("oricstudio_catalogo_comercial");
        if (catalogo.error) throw catalogo.error;
        if (seq!==requisicao.current) return;
        setComercial(catalogo.data || null);
        const solicitacao=await (supabaseBanco as any).from("oricstudio_solicitacoes")
          .select("id,status,quantidade_contas,valor_mensal_centavos")
          .eq("clinica_id",c.clinica_id)
          .in("status",["aguardando_checkout","pagamento_pendente"])
          .order("criado_em",{ascending:false}).limit(1).maybeSingle();
        if(solicitacao.error) throw solicitacao.error;
        if(seq!==requisicao.current)return;
        setPedidoAberto(solicitacao.data||null);
        if(c.pode_editar){
          const contrato=await (supabaseBanco as any).from("oricstudio_solicitacoes")
            .select("id,status,quantidade_contas,valor_mensal_centavos,mp_assinatura_status,cancelamento_em,ultima_conciliacao_em")
            .eq("clinica_id",c.clinica_id).eq("status","pago")
            .order("criado_em",{ascending:false}).limit(1).maybeSingle();
          if(contrato.error)throw contrato.error;
          if(seq!==requisicao.current)return;
          setAssinatura(contrato.data||null);
        }
      }
      if (!c?.tem_acesso) return;
      const [posts, arquivos, pref] = await Promise.all([
        filtrarClinica((supabaseBanco as any).from(tabelaPublicacoes)
          .select(modoPlataforma
            ? "id,titulo,legenda,tipo,status,planejado_para,criado_em,atualizado_em"
            : "id,clinica_id,titulo,legenda,tipo,status,planejado_para,criado_em,atualizado_em"),
          c.clinica_id).order("criado_em", { ascending: false }),
        filtrarClinica((supabaseBanco as any).from(tabelaMidias)
          .select("id,nome,tipo,criado_em,caminho_privado"), c.clinica_id)
          .order("criado_em", { ascending: false }),
        modoPlataforma
          ? (supabaseBanco as any).from(tabelaPreferencias)
            .select("nome_publico,tom_de_voz,hashtags_padrao,fuso_horario").eq("id","oricse").maybeSingle()
          : (supabaseBanco as any).from(tabelaPreferencias)
            .select("clinica_id,nome_publico,tom_de_voz,hashtags_padrao,fuso_horario")
            .eq("clinica_id", c.clinica_id).maybeSingle(),
      ]);
      for (const response of [posts, arquivos, pref]) if (response.error) throw response.error;
      if (seq !== requisicao.current) return;
      setPublicacoes(((posts.data || []) as Publicacao[]).map(p=>({...p,clinica_id:c.clinica_id})));
      setMidias((arquivos.data || []) as Midia[]);
      setPreferencias(pref.data ? {...pref.data,clinica_id:c.clinica_id} : {
        clinica_id: c.clinica_id, nome_publico: c.clinica_nome,
        tom_de_voz: "Profissional e acolhedor", hashtags_padrao: "",
        fuso_horario: "America/Sao_Paulo",
      });
      if (c.pode_editar) {
        setMetaCarregando(true);
        try {
          const {data:authSession}=await supabase.auth.getSession();
          const token=authSession.session?.access_token;
          if(!token)throw new Error("Sessão expirada.");
          const [accounts,configuration]=await Promise.all([
            listarContasMetaOricStudio({data:{accessToken:token,clinicaId:c.clinica_id}}),
            statusIntegracaoMetaOricStudio({data:{accessToken:token,clinicaId:c.clinica_id}}),
          ]);
          if(seq===requisicao.current) {
            setContasMeta(accounts as ContaMeta[]);
            setMetaConfigurada(configuration.configurada);
            setMetaDiagnostico(configuration.diagnostico ?? null);
          }
        } catch(e) {
          if(seq===requisicao.current) setMetaErro(e instanceof Error?e.message:"Erro ao consultar a Meta.");
        } finally {
          if(seq===requisicao.current) setMetaCarregando(false);
        }
      }
    } catch (e) {
      if (seq === requisicao.current) setErro(e instanceof Error ? e.message : "Não foi possível consultar o OricStúdio.");
    } finally {
      if (seq === requisicao.current) setCarregando(false);
    }
  }, [modoPlataforma]);

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
    if (!contexto?.pode_editar) return;
    setEditandoId(null); setTitulo(""); setLegenda(""); setTipo("imagem");
    setPlanejado(""); setStatus("rascunho"); setEditorAberto(true); setVersoesId(null);
    setAba("publicacoes");
  }
  function editar(p: Publicacao) {
    if (!contexto?.pode_editar) return;
    setEditandoId(p.id); setTitulo(p.titulo); setLegenda(p.legenda);
    setTipo(p.tipo); setPlanejado(paraCampo(p.planejado_para));
    setStatus(p.status === "aguardando_aprovacao" ? "aguardando_aprovacao" : "rascunho");
    setEditorAberto(true); setVersoesId(null); setAba("publicacoes");
  }
  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!contexto?.pode_editar || !titulo.trim()) return;
    if (planejado && !Number.isFinite(new Date(planejado).getTime())) return toast.error("Confira a data planejada.");
    setSalvando(true);
    try {
      const dados = {
        titulo: titulo.trim(), legenda: legenda.trim(), tipo, status,
        planejado_para: planejado ? new Date(planejado).toISOString() : null,
      };
      const query = editandoId
        ? filtrarClinica((supabaseBanco as any).from(tabelaPublicacoes).update(dados)
            .eq("id",editandoId), contexto.clinica_id)
        : (supabaseBanco as any).from(tabelaPublicacoes)
            .insert(modoPlataforma ? dados : { ...dados, clinica_id: contexto.clinica_id });
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
    if (!contexto?.pode_editar || !window.confirm(`Alterar "${p.titulo}" para "${STATUS[proximo]}"? Esta ação não publica no Instagram.`)) return;
    const { error } = await filtrarClinica((supabaseBanco as any).from(tabelaPublicacoes)
      .update({ status: proximo }).eq("id", p.id), contexto.clinica_id);
    if (error) return toast.error(error.message);
    toast.success("Etapa editorial atualizada. Nada foi publicado.");
    void carregar();
  }
  async function excluir(p: Publicacao) {
    if (!contexto?.pode_editar || !window.confirm(`Excluir definitivamente o rascunho "${p.titulo}"?`)) return;
    const { error } = await filtrarClinica((supabaseBanco as any).from(tabelaPublicacoes)
      .delete().eq("id", p.id), contexto.clinica_id);
    if (error) return toast.error(error.message);
    toast.success("Rascunho excluído; o evento fica na auditoria.");
    setEditorAberto(false);
    void carregar();
  }
  async function carregarVersoes(p: Publicacao) {
    const { data, error } = await filtrarClinica((supabaseBanco as any).from(tabelaVersoes)
      .select("id,evento,criado_em,autor_id")
      .eq("publicacao_id",p.id), p.clinica_id)
      .order("criado_em",{ascending:false}).limit(30);
    if (error) return toast.error(error.message);
    setVersoes((data||[]) as Versao[]);
    setVersoesId(p.id);
  }
  async function salvarPreferencias(e: FormEvent) {
    e.preventDefault();
    if (!contexto?.pode_editar || !preferencias) return;
    const {data:auth} = await supabase.auth.getUser();
    if (!auth.user?.id) return toast.error("Faça login novamente.");
    setSalvando(true);
    try {
      const valores = {
        nome_publico: preferencias.nome_publico,
        tom_de_voz: preferencias.tom_de_voz,
        hashtags_padrao: preferencias.hashtags_padrao,
        fuso_horario: preferencias.fuso_horario,
        atualizado_por: auth.user.id,
        atualizado_em: new Date().toISOString(),
      };
      const {error} = await (supabaseBanco as any).from(tabelaPreferencias).upsert(
        modoPlataforma ? {...valores,id:"oricse"} : {...valores,clinica_id:contexto.clinica_id},
        {onConflict:modoPlataforma?"id":"clinica_id"});
      if(error)throw error;
      toast.success(modoPlataforma?"Preferências da ORICSE salvas.":"Preferências da clínica salvas.");
    } catch(e){toast.error(e instanceof Error?e.message:"Não foi possível salvar.");}
    finally{setSalvando(false);}
  }

  const mensalidadeOricstudio = comercial?.preco_base_centavos != null &&
    comercial.preco_adicional_centavos != null
      ? comercial.preco_base_centavos + Math.max(0,quantidadeContratacao-1)*comercial.preco_adicional_centavos
      : null;
  function precoBRL(centavos:number) {
    return (centavos/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  }
  async function abrirCheckoutOricstudio(id:string) {
    const {data:auth}=await supabase.auth.getSession();
    const token=auth.session?.access_token;
    if(!token)throw new Error("Sua sessão expirou. Faça login novamente.");
    const checkout=await supabaseBanco.functions.invoke("oricstudio-checkout",{
      body:{acao:"checkout",solicitacao_id:id},
      headers:{"Authorization":"Bearer "+token},
    });
    if(checkout.error)throw new Error("O checkout não está disponível. Sua solicitação foi preservada.");
    const url=String(checkout.data?.checkout_url||"");
    const parsed=new URL(url);
    if(parsed.protocol!=="https:" ||
      !(parsed.hostname==="mercadopago.com.br"||parsed.hostname==="mercadopago.com"||
        parsed.hostname.endsWith(".mercadopago.com.br")||
        parsed.hostname.endsWith(".mercadopago.com")))
      throw new Error("O Mercado Pago não retornou um endereço seguro.");
    window.location.assign(url);
  }
  async function solicitarOricstudio() {
    if(!contexto||!comercial?.comercializacao_ativa||mensalidadeOricstudio===null||pedidoAberto)return;
    if(!window.confirm(`Contratar OricStúdio para ${contexto.clinica_nome}, com ${quantidadeContratacao} conta(s), por ${precoBRL(mensalidadeOricstudio)}/mês? Você será encaminhado ao Mercado Pago. O acesso só será liberado após a confirmação do pagamento.`))return;
    setSolicitando(true);
    try{
      const {data,error}=await (supabaseBanco as any).rpc("oricstudio_solicitar_contratacao",{p_quantidade:quantidadeContratacao});
      if(error)throw error;
      if(!data?.id)throw new Error("Solicitação não foi criada.");
      await abrirCheckoutOricstudio(data.id);
    }catch(e){
      toast.error(e instanceof Error?e.message:"Não foi possível abrir o checkout.");
      await carregar();
    }finally{setSolicitando(false);}
  }
  async function retomarCheckoutOricstudio() {
    if(!pedidoAberto||solicitando)return;
    setSolicitando(true);
    try{await abrirCheckoutOricstudio(pedidoAberto.id);}
    catch(e){toast.error(e instanceof Error?e.message:"Não foi possível retomar o checkout.");}
    finally{setSolicitando(false);}
  }

  async function verificarPagamentoOricstudio(solicitacaoId:string){
    if(solicitando)return;
    setSolicitando(true);
    try{
      const {data:auth}=await supabase.auth.getSession();
      const token=auth.session?.access_token;
      if(!token)throw new Error("Faça login novamente.");
      const {data,error}=await supabaseBanco.functions.invoke("oricstudio-checkout",{
        body:{acao:"verificar_assinatura",solicitacao_id:solicitacaoId},
        headers:{"Authorization":"Bearer "+token},
      });
      if(error||!data?.ok)throw new Error("Não foi possível verificar a assinatura. Consulte o suporte caso já tenha pago.");
      toast.success("Situação conferida diretamente com o Mercado Pago.");
      await carregar();
    }catch(e){toast.error(e instanceof Error?e.message:"Não foi possível conciliar.");}
    finally{setSolicitando(false);}
  }

  async function cancelarRenovacaoOricstudio(){
    if(!assinatura || !contexto?.pode_editar || cancelandoAssinatura)return;
    if(!window.confirm("Cancelar as próximas cobranças do OricStúdio nesta clínica? O acesso já pago permanece até o vencimento e a assinatura deixará de renovar automaticamente."))return;
    setCancelandoAssinatura(true);
    try{
      const {data:auth}=await supabase.auth.getSession();
      const token=auth.session?.access_token;
      if(!token)throw new Error("Entre novamente no ORICSE.");
      const {data,error}=await supabaseBanco.functions.invoke("oricstudio-checkout",{
        body:{acao:"cancelar",solicitacao_id:assinatura.id},
        headers:{"Authorization":"Bearer "+token},
      });
      if(error)throw new Error("Não foi possível confirmar o cancelamento no Mercado Pago.");
      if(!data?.ok)throw new Error(String(data?.error||"Cancelamento não confirmado."));
      toast.success("Renovação cancelada. O acesso já pago continua até a data de vencimento.");
      await carregar();
    }catch(e){toast.error(e instanceof Error?e.message:"Falha ao cancelar renovação.");}
    finally{setCancelandoAssinatura(false);}
  }

  async function conectarMeta() {
    if (!contexto?.pode_editar || metaOcupada) return;
    setMetaOcupada(true);
    try {
      const {data:auth}=await supabase.auth.getSession();
      const token=auth.session?.access_token;
      if(!token)throw new Error("Sessão expirada.");
      const result=await iniciarConexaoMetaOricStudio({data:{
        accessToken:token,clinicaId:contexto.clinica_id,
      }});
      if(!result.url.startsWith("https://www.instagram.com/oauth/authorize?"))throw new Error("Endereço de autorização inválido.");
      window.location.assign(result.url);
    } catch(e) {
      toast.error(e instanceof Error?e.message:"Falha ao iniciar conexão.");
      setMetaOcupada(false);
    }
  }

  async function verificarMeta(conta:ContaMeta) {
    if (!contexto?.pode_editar || metaOcupada) return;
    setMetaOcupada(true);
    try {
      const {data:auth}=await supabase.auth.getSession();
      const token=auth.session?.access_token;
      if(!token)throw new Error("Sessão expirada.");
      const resposta=await verificarContaMetaOricStudio({data:{
        accessToken:token,clinicaId:contexto.clinica_id,contaId:conta.id,
      }});
      toast.success(resposta.renovada?"Conexão verificada e token renovado.":"Conexão verificada com a Meta.");
      await carregar();
      setAba("contas");
    } catch(e) {
      toast.error(e instanceof Error?e.message:"Falha na verificação da conexão Meta.");
      await carregar();
      setAba("contas");
    } finally {setMetaOcupada(false);}
  }

  async function desconectarMeta(conta: ContaMeta) {
    if (!contexto?.pode_editar || metaOcupada ||
        !window.confirm(`Desconectar @${conta.username} ${modoPlataforma?"da ORICSE":"desta clínica"}? O histórico editorial permanecerá intacto.`)) return;
    setMetaOcupada(true);
    try {
      const {data:auth}=await supabase.auth.getSession();
      const token=auth.session?.access_token;
      if(!token)throw new Error("Sessão expirada.");
      await desconectarContaMetaOricStudio({data:{
        accessToken:token,clinicaId:contexto.clinica_id,contaId:conta.id,
      }});
      toast.success("Conexão local desativada. Você também pode revogar o aplicativo nas configurações da Meta.");
      await carregar();
      setAba("contas");
    } catch(e) {
      toast.error(e instanceof Error?e.message:"Falha ao desconectar.");
    } finally {setMetaOcupada(false);}
  }

  async function enviarMidia(file: File | undefined) {
    if (!file || !contexto?.pode_editar) return;
    const permitidos = new Set(["image/png","image/jpeg","image/webp","video/mp4","video/quicktime"]);
    if (!permitidos.has(file.type)) return toast.error("Escolha PNG, JPG, WebP, MP4 ou MOV.");
    if (file.size <= 0 || file.size > 12 * 1024 * 1024) {
      return toast.error("Arquivo inválido ou acima do limite de 12 MB desta versão.");
    }
    setEnviandoMidia(true);
    try {
      const {data:auth} = await supabase.auth.getSession();
      const token = auth.session?.access_token;
      if (!token) throw new Error("Faça login novamente.");
      const b64 = await new Promise<string>((resolve,reject)=>{
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
        reader.readAsDataURL(file);
      });
      const arquivo = await enviarArquivoDrive({data:{
        accessToken:token, clinicaId:contexto.clinica_id, categoria:"imagens",
        nome:file.name, mimeType:file.type, base64:b64,
        visibilidade:"interno", entidadeTipo:"oricstudio",
        metadata:{modulo:"oricstudio",uso:"biblioteca_privada"},
      }});
      if (!arquivo?.registroId) throw new Error("Upload não retornou identificação.");
      const {error} = await (supabaseBanco as any).from(tabelaMidias).insert({
        ...(modoPlataforma ? {} : {clinica_id:contexto.clinica_id}),
        nome:file.name, tipo:file.type.startsWith("video/")?"video":"imagem",
        caminho_privado:arquivo.registroId,
      });
      if(error) {
        try { await excluirArquivoDrive({data:{
          accessToken:token,clinicaId:contexto.clinica_id,registroId:arquivo.registroId,
        }}); } catch {}
        throw error;
      }
      toast.success(modoPlataforma?"Arquivo salvo na biblioteca privada da ORICSE.":"Arquivo salvo na biblioteca privada da clínica.");
      await carregar();
      setAba("biblioteca");
    } catch(e) {
      toast.error(e instanceof Error?e.message:"Falha ao enviar arquivo.");
    } finally {setEnviandoMidia(false);}
  }

  async function visualizarMidia(m: Midia) {
    if (!contexto?.tem_acesso || m.tipo !== "imagem") return;
    try {
      const {data:auth} = await supabase.auth.getSession();
      const token=auth.session?.access_token;
      if(!token)throw new Error("Faça login novamente.");
      const arquivo=await visualizarImagemPrivadaDrive({data:{
        accessToken:token,clinicaId:contexto.clinica_id,registroId:m.caminho_privado,
      }});
      setPrevias(atual=>({...atual,[m.id]:arquivo.dataUrl}));
    } catch(e) {toast.error(e instanceof Error?e.message:"Não foi possível abrir a imagem.");}
  }

  async function excluirMidia(m: Midia) {
    if (!contexto?.pode_editar || !window.confirm(`Excluir "${m.nome}" da biblioteca privada?`)) return;
    try {
      const {data:auth} = await supabase.auth.getSession();
      const token=auth.session?.access_token;
      if(!token)throw new Error("Faça login novamente.");
      await excluirArquivoDrive({data:{
        accessToken:token,clinicaId:contexto.clinica_id,registroId:m.caminho_privado,
      }});
      const {error}=await filtrarClinica((supabaseBanco as any).from(tabelaMidias)
        .delete().eq("id",m.id), contexto.clinica_id);
      if(error)throw error;
      toast.success("Mídia excluída.");
      setPrevias(atual=>{const n={...atual};delete n[m.id];return n;});
      await carregar();
    } catch(e) {toast.error(e instanceof Error?e.message:"Falha ao excluir mídia.");}
  }

  return <main className="mx-auto w-full max-w-7xl space-y-5 px-4 pb-16 pt-6 text-foreground sm:px-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><Link to={modoPlataforma?"/admin":"/inicio"} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4"/> {modoPlataforma?"Voltar à Administração Geral":"Voltar ao ORICSE"}</Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-extrabold sm:text-3xl"><img src={ORICSTUDIO_LOGO} alt="Logo oficial OricStúdio" className="h-14 w-14 rounded-xl object-contain" /> OricStúdio</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gestão de Redes Sociais para o Mercado Pet</p>
      </div>
      <button type="button" disabled={carregando} onClick={()=>void carregar()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-card px-3 text-sm"><RefreshCw className="h-4 w-4"/> Atualizar</button>
    </header>
    {carregando && <p role="status" className="rounded-xl border bg-card p-6 text-sm">{modoPlataforma?"Carregando OricStúdio da ORICSE...":"Carregando a clínica e verificando a licença..."}</p>}
    {!carregando && erro && <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/60 bg-card p-5 text-sm text-destructive"><AlertCircle className="h-5 w-5 shrink-0"/>{erro}</div>}
    {!carregando && !erro && !contexto && <div className="rounded-xl border bg-card p-6"><p className="font-semibold">Nenhuma clínica selecionada</p><p className="mt-2 text-sm text-muted-foreground">Entre em uma clínica autorizada no ORICSE para consultar o OricStúdio.</p></div>}
    {!carregando && !erro && contexto && !contexto.tem_acesso && <section className="rounded-2xl border bg-card p-6 sm:p-8">
      <div className="flex items-center gap-2 text-primary"><LockKeyhole className="h-6 w-6"/><span className="font-semibold">Produto adicional</span></div>
      <h2 className="mt-3 text-2xl font-bold">OricStúdio para {contexto.clinica_nome}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">O OricStúdio reúne criação de rascunhos, planejamento, calendário editorial e, futuramente, gestão de publicações, comentários e métricas do Instagram.</p>
      <p className="mt-4 text-sm"><strong>Licença:</strong> {contexto.licenca_status.replaceAll("_"," ")}. O acesso depende de contratação e confirmação do pagamento.</p>
      <p className="mt-3 text-sm text-muted-foreground">Nenhum acesso foi concedido automaticamente pelo plano da clínica.</p>
      <div className="mt-6 space-y-3 rounded-xl border bg-background p-4">
        <h3 className="font-semibold">Contratar OricStúdio</h3>
        {pedidoAberto && <div className="space-y-2 rounded-lg border p-3 text-sm">
          <strong>Solicitação em andamento</strong>
          <p>{pedidoAberto.quantidade_contas} conta(s) — {precoBRL(pedidoAberto.valor_mensal_centavos)}/mês</p>
          <p>Situação: {pedidoAberto.status==="pagamento_pendente"?"Aguardando confirmação do Mercado Pago":"Checkout ainda não iniciado"}.</p>
          <p className="text-xs text-muted-foreground">O retorno ao site não comprova o pagamento. A licença só será liberada após confirmação oficial.</p>
          <button type="button" onClick={()=>void retomarCheckoutOricstudio()} disabled={solicitando||!comercial?.comercializacao_ativa}
             className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Continuar pagamento</button>
          <button type="button" onClick={()=>void verificarPagamentoOricstudio(pedidoAberto.id)}
            disabled={solicitando||pedidoAberto.status!=="pagamento_pendente"}
            className="ml-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Verificar pagamento</button>
        </div>}
        <p className="text-sm text-muted-foreground">Uma conta Instagram incluída. Contas adicionais têm cobrança mensal por unidade.</p>
        <label className="block text-sm">Total de contas
          <input type="number" min={1} max={100} value={quantidadeContratacao}
            onChange={e=>setQuantidadeContratacao(Math.max(1,Math.min(100,Number(e.target.value)||1)))}
            className="ml-3 w-20 rounded-lg border bg-background p-2"/>
        </label>
        <p className="text-sm">1 conta inclusa + {quantidadeContratacao-1} adicionais</p>
        <p className="text-xl font-bold">Mensalidade: {mensalidadeOricstudio===null?"A definir":precoBRL(mensalidadeOricstudio)}</p>
        <button type="button" onClick={()=>void solicitarOricstudio()}
          disabled={!comercial?.comercializacao_ativa || mensalidadeOricstudio===null || solicitando || !!pedidoAberto}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
          {solicitando?"Registrando...":"Assinar pelo Mercado Pago"}
        </button>
        {(!comercial?.comercializacao_ativa || mensalidadeOricstudio===null) &&
          <p className="text-xs text-muted-foreground">Contratações ainda indisponíveis. O OricStúdio não gera cobranças nem libera contas sem confirmação.</p>}
      </div>
    </section>}
    {!carregando && !erro && contexto?.tem_acesso && <>
      <div className="rounded-xl border bg-card px-4 py-3 text-sm"><strong>{contexto.clinica_nome}</strong><span className="ml-3 text-muted-foreground">{modoPlataforma?"Uso interno da plataforma · Sem assinatura ou cobranças":"Licença ativa · Ambiente exclusivo da clínica"}</span></div>
      {assinatura && contexto.pode_editar && <section className="space-y-2 rounded-xl border bg-card p-4 text-sm">
        <h2 className="font-semibold">Sua assinatura OricStúdio</h2>
        <p>{assinatura.quantidade_contas} conta(s) · {precoBRL(assinatura.valor_mensal_centavos)}/mês</p>
        <p>Renovação: {assinatura.cancelamento_em?"Cancelada — sem futuras cobranças":assinatura.mp_assinatura_status==="authorized"?"Automática":assinatura.mp_assinatura_status||"Aguardando conciliação"}</p>
        <p className="text-muted-foreground">Acesso já pago até: {textoData(contexto.licenca_expira_em)}</p>
        <button type="button" onClick={()=>void verificarPagamentoOricstudio(assinatura.id)}
          disabled={solicitando} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">
          Verificar situação com o Mercado Pago
        </button>
        {!assinatura.cancelamento_em && <button type="button" onClick={()=>void cancelarRenovacaoOricstudio()}
          disabled={cancelandoAssinatura}
          className="rounded-lg border px-3 py-2 text-sm text-destructive disabled:opacity-50">
          {cancelandoAssinatura?"Cancelando...":"Cancelar renovação"}
        </button>}
      </section>}
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
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">Visão geral</h2>{contexto.pode_editar && <button onClick={novo} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Plus className="h-4 w-4"/> Novo rascunho</button>}</div>
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
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Publicações e rascunhos</h2>{contexto.pode_editar && <button onClick={novo} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Plus className="h-4 w-4"/> Criar publicação</button>}</div>
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
              {contexto.pode_editar && <button onClick={()=>editar(p)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs"><Pencil className="h-3.5 w-3.5"/> Editar</button>}
              <button onClick={()=>void carregarVersoes(p)} className="rounded-lg border px-3 py-2 text-xs">Versões</button>
              {contexto.pode_editar && <button onClick={()=>void excluir(p)} className="rounded-lg border px-3 py-2 text-xs text-destructive"><Trash2 className="h-3.5 w-3.5"/></button>}
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
        {pendentes.length===0?<p className="rounded-xl border bg-card p-6 text-sm">Nenhuma publicação aguardando aprovação.</p>:pendentes.map(p=><div key={p.id} className="space-y-3 rounded-xl border bg-card p-4"><h3 className="font-semibold">{p.titulo}</h3><p className="whitespace-pre-line text-sm">{p.legenda}</p><div className="flex flex-wrap gap-2">{contexto.pode_editar && <><button onClick={()=>void alterarStatus(p,"aprovado")} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"><CheckCircle2 className="h-4 w-4"/> Aprovar internamente</button><button onClick={()=>void alterarStatus(p,"rascunho")} className="rounded-lg border px-3 py-2 text-sm">Voltar para rascunho</button></>}</div></div>)}
        <p className="text-xs text-muted-foreground">Aprovação interna não publica nem agenda o conteúdo nas redes sociais.</p>
      </section>}
      {aba==="biblioteca" && <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-bold">Biblioteca de mídias</h2><p className="mt-1 text-sm text-muted-foreground">Arquivos privados {modoPlataforma?"da própria ORICSE":"da clínica"} no Google Drive do ORICSE.</p></div>
          {contexto.pode_editar && <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            <Plus className="h-4 w-4"/>{enviandoMidia?"Enviando...":"Adicionar mídia"}
            <input type="file" className="sr-only" disabled={enviandoMidia}
              accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime"
              onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value="";void enviarMidia(file);}} />
          </label>}
        </div>
        <p className="text-xs text-muted-foreground">Até 12 MB por arquivo nesta versão. PNG, JPEG, WebP, MP4 ou MOV. Conteúdo não é publicado automaticamente.</p>
        {midias.length===0
          ? <div className="rounded-xl border bg-card p-7"><FolderOpen className="h-9 w-9 text-muted-foreground"/>
              <h3 className="mt-3 font-semibold">Sua biblioteca está vazia</h3>
              <p className="mt-2 text-sm text-muted-foreground">Adicione imagens e vídeos para organizar o conteúdo {modoPlataforma?"da ORICSE":"da clínica"}.</p></div>
          : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {midias.map(m=><article key={m.id} className="rounded-xl border bg-card p-4">
                <div className="flex min-h-32 items-center justify-center overflow-hidden rounded-lg bg-secondary/40">
                  {previas[m.id]
                    ? <img src={previas[m.id]} alt={m.nome} className="max-h-64 w-full object-contain"/>
                    : m.tipo==="video"
                      ? <FileImage className="h-12 w-12 text-muted-foreground"/>
                      : <FolderOpen className="h-12 w-12 text-muted-foreground"/>}
                </div>
                <h3 className="mt-3 truncate text-sm font-semibold" title={m.nome}>{m.nome}</h3>
                <p className="text-xs text-muted-foreground">{m.tipo} · {textoData(m.criado_em)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.tipo==="imagem" && <button type="button" onClick={()=>void visualizarMidia(m)} className="rounded-lg border px-3 py-2 text-xs">Visualizar</button>}
                  {contexto.pode_editar && <button type="button" onClick={()=>void excluirMidia(m)} className="rounded-lg border px-3 py-2 text-xs text-destructive">Excluir</button>}
                </div>
              </article>)}
            </div>}
      </section>}
      {aba==="configuracoes" && preferencias && <form onSubmit={e=>void salvarPreferencias(e)} className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-xl font-bold">Identidade e tom de voz {modoPlataforma?"da ORICSE":"da clínica"}</h2>
        <label className="block space-y-1 text-sm font-semibold">Nome público<input value={preferencias.nome_publico} onChange={e=>setPreferencias({...preferencias,nome_publico:e.target.value})} maxLength={150} className="w-full rounded-lg border bg-background p-3"/></label>
        <label className="block space-y-1 text-sm font-semibold">Tom de voz<textarea rows={3} maxLength={600} value={preferencias.tom_de_voz} onChange={e=>setPreferencias({...preferencias,tom_de_voz:e.target.value})} className="w-full rounded-lg border bg-background p-3"/></label>
        <label className="block space-y-1 text-sm font-semibold">Hashtags padrão<textarea rows={2} maxLength={1000} value={preferencias.hashtags_padrao} onChange={e=>setPreferencias({...preferencias,hashtags_padrao:e.target.value})} className="w-full rounded-lg border bg-background p-3"/></label>
        <p className="text-xs text-muted-foreground">Fuso horário de referência: {preferencias.fuso_horario}. Nenhuma alteração na marca institucional ORICSE.</p>
        {contexto.pode_editar ? <button disabled={salvando} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Save className="h-4 w-4"/> Salvar preferências</button> : <p className="text-sm text-muted-foreground">Somente responsáveis, administradores da clínica e RTs podem editar estas preferências.</p>}
      </form>}
      {aba==="contas" && <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Contas Instagram {modoPlataforma?"da ORICSE":"da clínica"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{modoPlataforma?"Conecte apenas as contas oficiais da ORICSE, separadas das contas de clientes.":"Cada clínica autoriza suas próprias contas profissionais, sem compartilhamento com outras clínicas."}</p>
          </div>
          {contexto.pode_editar && <button type="button" onClick={()=>void conectarMeta()}
            disabled={!metaConfigurada || metaCarregando || metaOcupada}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
            <Instagram className="h-4 w-4"/>{metaOcupada?"Conectando...":"Conectar Instagram"}
          </button>}
        </div>
        {!contexto.pode_editar && <p className="rounded-xl border p-4 text-sm">A conexão é administrada pelo responsável, RT ou administrador da clínica.</p>}
        {contexto.pode_editar && !metaConfigurada && !metaCarregando &&
          <p className="rounded-xl border bg-card p-4 text-sm">A integração Meta do OricStúdio está aguardando configuração central. Nenhuma clínica precisa fornecer sua senha ao ORICSE.</p>}
        {modoPlataforma && metaDiagnostico &&
          <details className="rounded-xl border bg-card p-4 text-sm">
            <summary className="cursor-pointer font-semibold">Diagnóstico da conexão Instagram (Administração ORICSE)</summary>
            <p className="mt-3 text-muted-foreground">
              Este aplicativo usa <strong>Instagram API with Unified Login</strong>. Se aparecer
              “Solicitação inválida”, confirme primeiro a configuração abaixo — sem expor segredos.
            </p>
            <dl className="mt-3 space-y-2">
              <div><dt className="font-semibold">App ID utilizado</dt>
                <dd className="break-all font-mono">{metaDiagnostico.instagramAppId || "Não configurado"}</dd></div>
              <div><dt className="font-semibold">Redirect URI cadastrado na Meta</dt>
                <dd className="break-all font-mono">{metaDiagnostico.callback}</dd></div>
              <div><dt className="font-semibold">Formato do App ID</dt>
                <dd>{metaDiagnostico.formatoIdValido ? "Numérico válido" : "Ausente ou inválido no Cloudflare"}</dd></div>
              <div><dt className="font-semibold">Configuration ID do Login Unificado</dt>
                <dd>{metaDiagnostico.configurationIdConfigurado ? "Configurado" : "Ausente ou inválido no Cloudflare"}</dd></div>
              <div><dt className="font-semibold">App Secret</dt>
                <dd>{metaDiagnostico.appSecretConfigurado ? "Configurado" : "Ausente no Cloudflare"}</dd></div>
              <div><dt className="font-semibold">Chave de criptografia</dt>
                <dd>{metaDiagnostico.chaveCriptografiaValida ? "Válida" : "Ausente ou inválida (deve ser Base64 de 32 bytes)"}</dd></div>
            </dl>
            <p className="mt-3 text-muted-foreground">
              No Cloudflare, confira os nomes exatos: ORICSTUDIO_META_CLIENT_ID,
              ORICSTUDIO_META_CLIENT_SECRET, ORICSTUDIO_META_CONFIG_ID,
              ORICSTUDIO_META_REDIRECT_URI e ORICSTUDIO_META_ENCRYPTION_KEY.
              No painel Meta, utilize a configuração selecionada em Instagram → API setup with Unified Login.
            </p>
            <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer"
              className="mt-2 inline-block font-semibold text-primary underline">Abrir Meta for Developers</a>
          </details>}
        {metaErro && <p role="alert" className="rounded-xl border border-destructive/60 p-4 text-sm text-destructive">{metaErro}</p>}
        {metaCarregando && <p className="text-sm text-muted-foreground">Verificando conexões Meta...</p>}
        {contexto.pode_editar && contasMeta.length===0 && !metaCarregando &&
          <div className="rounded-xl border bg-card p-6"><h3 className="font-semibold">Nenhuma conta conectada</h3>
            <p className="mt-2 text-sm text-muted-foreground">Utilize o botão “Conectar Instagram” quando a integração Meta da plataforma estiver configurada.</p></div>}
        {contasMeta.map(conta=><article key={conta.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-4">
          <div><h3 className="font-semibold">@{conta.username}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{conta.account_type||"Conta profissional"} · {conta.status} · Desde {textoData(conta.conectado_em)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Token: {conta.token_expira_em? `vence ${textoData(conta.token_expira_em)}` : "validade não informada"}</p>
          </div>
          {contexto.pode_editar && conta.status!=="desconectada" &&
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={metaOcupada} onClick={()=>void verificarMeta(conta)}
                className="rounded-lg border px-3 py-2 text-xs disabled:opacity-50">Verificar conexão</button>
              <button type="button" disabled={metaOcupada} onClick={()=>void desconectarMeta(conta)}
                className="rounded-lg border px-3 py-2 text-xs text-destructive disabled:opacity-50">Desconectar</button>
            </div>}
        </article>)}
        <p className="text-xs text-muted-foreground">A conexão não autoriza publicações automáticas por si só. A fila de publicação e as permissões aprovadas pela Meta serão validadas separadamente.</p>
      </section>}
      {(["comentarios","metricas","alertas"] as Aba[]).includes(aba) && <section className="rounded-xl border bg-card p-6">
        <h2 className="text-xl font-bold">{ABAS.find(a=>a.id===aba)?.rotulo}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {aba==="comentarios"?"Comentários e respostas serão sincronizados após a conexão Meta, respeitando as permissões concedidas.":
           aba==="metricas"?"Métricas reais de alcance e interações serão apresentadas após a conexão das contas. Nenhum número será simulado.":
           "Não há alertas de publicação porque a integração com Instagram ainda não está ativa. Erros de conexão e envio serão acompanhados na etapa 3/5."}
        </p>
      </section>}
        </div>
      </div>
    </>}
  </main>;
}
