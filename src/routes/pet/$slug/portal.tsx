import { destinoPortalLegado, urlPortalDoTutor } from "@/lib/portal-tutor-url";
import { orientacaoSenhaPortal, senhaPortalValida } from "../../../../supabase/functions/_shared/portal-password";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PortalClinicContact, type CanaisClinica } from "@/components/PortalClinicContact";
import { PortalTutorOtherServices } from "@/components/PortalTutorOtherServices";
import { RodapeInstitucional } from "@/components/RodapeInstitucional";
import "./portal-tutor-area.css";
import { dataDoRotulo, dataPreventivaBR } from "@/lib/dados-preventivos";
import { pendenciasDosPets, type FonteCuidados } from "@/lib/portal-pet-care";
import { prepararFotoDoPet } from "@/lib/portal-pet-photo";
import { ArrowLeft, Camera, CalendarDays, CheckCircle2, ChevronRight, Download, FileText, HeartPulse, Loader2, LockKeyhole, LogOut, PawPrint, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase, supabaseBanco } from "@/integrations/supabase/client";
import { baixarDocumentoPortal } from "@/lib/portal-document.functions";
import { loadPublicClinicSite } from "@/lib/public-clinic-site";
import { clinicSitePresets, clinicSiteTemplates, normalizeClinicSiteConfig, type ClinicSiteTemplate } from "@/lib/clinic-site";

export const Route = createFileRoute("/pet/$slug/portal")({ component: PortalTutorRoute });

function PortalTutorRoute() {
  return <RedirecionarPortalLegado />;
}

export function RedirecionarPortalLegado() {
  const [invalido, setInvalido] = useState(false);
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    const destino = destinoPortalLegado(pathname, search, hash);
    if (destino) window.location.replace(destino);
    else setInvalido(true);
  }, []);
  return <main className="min-h-screen bg-[#faf7f4] p-8 text-center text-[#312530]">{invalido ? "Endereço do Portal do Tutor inválido." : "Abrindo o Portal do Tutor…"}</main>;
}

type ClinicaPublica={nome:string;slug:string;logo_url:string|null};
type CoresPortal={primaryColor:string;secondaryColor:string;backgroundColor:string;textColor:string};
type TemaPortal={modelo:ClinicSiteTemplate;cores:CoresPortal};
function estiloTemaPortal(tema:TemaPortal|null):CSSProperties|undefined{
  if(!tema)return undefined;
  return {
    "--portal-primary":tema.cores.primaryColor,
    "--portal-secondary":tema.cores.secondaryColor,
    "--portal-bg":tema.cores.backgroundColor,
    "--portal-ink":tema.cores.textColor,
  } as CSSProperties;
}

type Contexto={clinica_id:string;clinica_nome:string;clinica_slug:string;clinica_logo_url:string|null;tutor_id:string;tutor_nome:string;tutor_telefone:string|null;tutor_email:string|null;usuario:string};
type Animal={id:string;nome:string;especie:string;raca:string;sexo:string;nascimento:string|null;peso_kg:number|null;foto_url:string|null};
type DadosAplicacao = {
  fabricante?: string | null; dose?: string | null; fabricacao?: string | null; validade?: string | null;
  hora_aplicacao?: string | null; local_aplicacao?: string | null;
  veterinario_nome?: string | null; veterinario_crmv?: string | null; veterinario_uf?: string | null;
  alvo_vacinacao?: string | null; principio_ativo?: string | null; via?: string | null;
};
type Vacina=DadosAplicacao&{id:string;animal_id:string;nome:string;aplicada_em:string|null;reforco_em:string|null;lote:string|null;observacoes:string|null};
type Vermifugo=DadosAplicacao&{id:string;animal_id:string;nome:string;administrado_em:string|null;proxima_dose_em:string|null;lote:string|null;observacoes:string|null};
type Exame={id:string;animal_id:string;titulo:string;tipo:string;realizado_em:string|null;resultado_resumo:string|null;drive_arquivo_id:string|null};
type Documento={id:string;animal_id:string;titulo:string;tipo:string;data_documento:string|null;observacoes:string|null;drive_arquivo_id:string|null};
type Receita={id:string;animal_id:string;tipo:"normal"|"especial";numero:string|null;titulo:string;emitida_em:string;drive_arquivo_id:string|null};
type Agenda={id:string;nome:string;responsavel:string;modalidade:string;tipo:string;pagamento_modo_valor?:string|null;pagamento_valor?:number|null;pagamento_descricao?:string|null};
type Horario={inicio:string;fim:string;rotulo:string};
type Agendamento={id:string;agenda_id:string|null;animal_id:string|null;inicio:string;fim:string;estado:string;tipo:string;observacoes:string|null};
type Comanda={id:string;animal_id:string;numero:number;status:"Aberta"|"Finalizada";origem:string;aberta_em:string;finalizada_em:string|null;itens:Array<{id:string;descricao:string;quantidade:number;valorUnitario:number}>;pagamentos:Array<{id:string;valor:number;formaPagamento:string;data:string}>;total:number;total_pago:number;saldo:number};
const secoesPortal = [
  { id: "resumo", nome: "Visão Geral", emoji: "🏠" },
  { id: "pet", nome: "Meu pet", emoji: "🐾" },
  { id: "agenda", nome: "Agenda", emoji: "📅" },
  { id: "documentos", nome: "Documentos", emoji: "📄" },
  { id: "exames", nome: "Exames", emoji: "🔬" },
  { id: "receitas", nome: "Receitas", emoji: "📝" },
  { id: "vacinas", nome: "Vacinas", emoji: "💉" },
  { id: "vermifugos", nome: "Vermífugos", emoji: "🛡️" },
  { id: "comanda", nome: "Financeiro", emoji: "💳" },
  { id: "contato", nome: "Fale com a clínica", emoji: "💬" },
  { id: "perfil", nome: "Meu perfil", emoji: "👤" },
] as const;

type Secao = (typeof secoesPortal)[number]["id"];
function secaoDoEndereco(query: URLSearchParams): Secao {
  return secoesPortal.find(({ id }) => id === query.get("secao"))?.id ?? "resumo";
}

type TipoArquivo="documento"|"exame"|"receita";
type DesafioRecuperacao={desafioId:string;expiraEm:string;pergunta:string;alternativas:Array<{id:string;nome:string}>};

function dadosDemoAlvorada(clinica:ClinicaPublica,usuario:string){
  const animais:Animal[]=[
    {id:"demo-lua",nome:"Lua",especie:"Gato",raca:"SRD",sexo:"Fêmea",nascimento:"2023-03-15",peso_kg:4.2,foto_url:null},
    {id:"demo-thor",nome:"Thor",especie:"Cão",raca:"Golden Retriever",sexo:"Macho",nascimento:"2021-08-10",peso_kg:28,foto_url:null},
    {id:"demo-mel",nome:"Mel",especie:"Cão",raca:"Shih-tzu",sexo:"Fêmea",nascimento:"2024-01-20",peso_kg:6.4,foto_url:null},
    {id:"demo-nina",nome:"Nina",especie:"Gato",raca:"Persa",sexo:"Fêmea",nascimento:"2022-11-02",peso_kg:3.8,foto_url:null},
  ];
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const emQuinzeDias = new Date();
  emQuinzeDias.setDate(emQuinzeDias.getDate() + 15);
  const vacinas:Vacina[]=[
    {id:"demo-vacina-lua",animal_id:"demo-lua",nome:"V4 felina",aplicada_em:"2026-03-12",reforco_em:dataIso(),lote:"ALV-2026-04",observacoes:"Aplicação registrada pela equipe Alvorada."},
    {id:"demo-vacina-thor",animal_id:"demo-thor",nome:"Antirrábica",aplicada_em:"2026-05-08",reforco_em:dataIso(emQuinzeDias),lote:"ALV-2026-11",observacoes:null},
    {id:"demo-vacina-mel",animal_id:"demo-mel",nome:"V10",aplicada_em:"2026-06-20",reforco_em:"2027-06-20",lote:"ALV-2026-18",observacoes:null},
  ];
  const vermifugos:Vermifugo[]=[
    {id:"demo-vermifugo-lua",animal_id:"demo-lua",nome:"Vermífugo felino",administrado_em:"2026-09-15",proxima_dose_em:dataIso(ontem),lote:"VER-ALV-09",observacoes:"Administrado conforme orientação veterinária."},
    {id:"demo-vermifugo-thor",animal_id:"demo-thor",nome:"Vermífugo cães adultos",administrado_em:"2026-10-02",proxima_dose_em:"2027-01-02",lote:"VER-ALV-10",observacoes:null},
  ];
  const exames:Exame[]=[
    {id:"demo-exame-lua",animal_id:"demo-lua",titulo:"Hemograma completo",tipo:"Laboratório",realizado_em:"2026-10-18",resultado_resumo:"Sem alterações relevantes no exame de demonstração.",drive_arquivo_id:null},
    {id:"demo-exame-thor",animal_id:"demo-thor",titulo:"Ultrassonografia abdominal",tipo:"Imagem",realizado_em:"2026-10-29",resultado_resumo:"Laudo disponível para consulta no portal.",drive_arquivo_id:null},
    {id:"demo-exame-mel",animal_id:"demo-mel",titulo:"Avaliação cardiológica",tipo:"Cardiologia",realizado_em:"2026-11-03",resultado_resumo:"Avaliação de rotina realizada na clínica.",drive_arquivo_id:null},
  ];
  const documentos:Documento[]=[
    {id:"demo-doc-lua",animal_id:"demo-lua",titulo:"Carteira de saúde da Lua",tipo:"Carteira de saúde",data_documento:"2026-03-12",observacoes:"Documento demonstrativo.",drive_arquivo_id:null},
    {id:"demo-doc-thor",animal_id:"demo-thor",titulo:"Atestado de saúde do Thor",tipo:"Atestado",data_documento:"2026-10-29",observacoes:"Apto para hospedagem.",drive_arquivo_id:null},
    {id:"demo-doc-mel",animal_id:"demo-mel",titulo:"Carteira de vacinação da Mel",tipo:"Cartão de vacinação",data_documento:"2026-06-20",observacoes:null,drive_arquivo_id:null},
  ];
  const receitas:Receita[]=[
    {id:"demo-receita-lua",animal_id:"demo-lua",tipo:"normal",numero:"ALV-2026-104",titulo:"Orientações pós-consulta",emitida_em:"2026-10-18T14:30:00-03:00",drive_arquivo_id:null},
    {id:"demo-receita-thor",animal_id:"demo-thor",tipo:"normal",numero:"ALV-2026-118",titulo:"Receita veterinária",emitida_em:"2026-10-29T10:00:00-03:00",drive_arquivo_id:null},
  ];
  const agendas:Agenda[]=[{id:"demo-agenda-consulta",nome:"Consultas",responsavel:"Dra. Luciana Alves",modalidade:"livre",tipo:"Consulta"},{id:"demo-agenda-retorno",nome:"Vacinação e retornos",responsavel:"Dr. Marcelo Costa",modalidade:"livre",tipo:"Retorno"}];
  const agendamentos:Agendamento[]=[{id:"demo-marcacao-thor",agenda_id:"demo-agenda-consulta",animal_id:"demo-thor",inicio:"2026-11-16T09:30:00-03:00",fim:"2026-11-16T10:00:00-03:00",estado:"confirmado",tipo:"Consulta de acompanhamento",observacoes:"Retorno demonstrativo."},{id:"demo-marcacao-lua",agenda_id:"demo-agenda-retorno",animal_id:"demo-lua",inicio:"2026-11-21T14:00:00-03:00",fim:"2026-11-21T14:30:00-03:00",estado:"solicitado",tipo:"Vacinação",observacoes:null}];
  const comandas:Comanda[]=[{id:"demo-comanda-thor",animal_id:"demo-thor",numero:1024,status:"Aberta",origem:"Recepção",aberta_em:"2026-11-11T09:00:00-03:00",finalizada_em:null,itens:[{id:"demo-item-consulta",descricao:"Consulta veterinária",quantidade:1,valorUnitario:150},{id:"demo-item-exame",descricao:"Exame de imagem",quantidade:1,valorUnitario:220}],pagamentos:[],total:370,total_pago:0,saldo:370},{id:"demo-comanda-lua",animal_id:"demo-lua",numero:1018,status:"Finalizada",origem:"Portal do Tutor",aberta_em:"2026-10-18T14:00:00-03:00",finalizada_em:"2026-10-18T15:00:00-03:00",itens:[{id:"demo-item-vacina",descricao:"Vacinação V4",quantidade:1,valorUnitario:95}],pagamentos:[{id:"demo-pagamento-vacina",valor:95,formaPagamento:"Pix",data:"2026-10-18"}],total:95,total_pago:95,saldo:0}];
  return {contexto:{clinica_id:"alvorada-demo",clinica_nome:clinica.nome,clinica_slug:clinica.slug,clinica_logo_url:clinica.logo_url,tutor_id:"tutor-demo-alvorada",tutor_nome:"Mariana Oliveira",tutor_telefone:"(31) 99999-0000",tutor_email:"mariana.demo@alvorada.oricse.com.br",usuario:usuario.trim()||"Demonstração"} satisfies Contexto,animais,vacinas,vermifugos,exames,documentos,receitas,agendas,agendamentos,comandas};
}

function dataIso(data=new Date()){return `${data.getFullYear()}-${String(data.getMonth()+1).padStart(2,"0")}-${String(data.getDate()).padStart(2,"0")}`;}
function dataBr(v?:string|null){if(!v)return"Não informado";const d=new Date(v.length===10?`${v}T12:00:00`:v);return Number.isNaN(d.getTime())?v:d.toLocaleDateString("pt-BR");}
function dataHora(v:string){return new Date(v).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});}
function dinheiro(v:number){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
function emojiDoPet(especie = "") {
  const nome = (especie || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (/cao|cachorr|canin/.test(nome)) return "🐶";
  if (/gat|felin/.test(nome)) return "🐱";
  if (/ave|passar|papagai/.test(nome)) return "🐦";
  if (/coelh|lagomorf/.test(nome)) return "🐰";
  return "🐾";
}
function estado(v:string){return v==="confirmado"?"Confirmado":v==="solicitado"?"Aguardando aprovação":v==="reservado"?"Reservado":v;}

export function PortalTutorClinica({slugDaClinica}:{slugDaClinica:string}){
  const slug=slugDaClinica;
  const router = useRouter();
  const tituloSecao = useRef<HTMLHeadingElement>(null);
  const [enviandoFoto, setEnviandoFoto] = useState<string | null>(null);
  const [fontesCuidados, setFontesCuidados] = useState<{ vacinas: FonteCuidados; vermifugos: FonteCuidados }>({
    vacinas: "carregando", vermifugos: "carregando",
  });
  const [extrasPublicos,setExtrasPublicos]=useState<{opcoes:Record<string,unknown>;promocoes?:Array<{titulo:string;descricao:string;cupom:string;desconto_percentual:number}>}>({opcoes:{}});
  const [portalConfig,setPortalConfig]=useState<{mensagem_boas_vindas?:string;telefone_publico?:string;whatsapp_publico?:string;instrucoes_agendamento?:string;exibir_agendamento?:boolean;exibir_documentos?:boolean;nome_exibicao?:string;logo_clinica_url?:string;logo_cabecalho_url?:string;titulo_cabecalho?:string;subtitulo_cabecalho?:string;canais_contato?:CanaisClinica}>({});
  const [clinica,setClinica]=useState<ClinicaPublica|null>(null);const [temaPortal,setTemaPortal]=useState<TemaPortal|null>(null);const [carregandoClinica,setCarregandoClinica]=useState(true);const [carregando,setCarregando]=useState(true);const [contexto,setContexto]=useState<Contexto|null>(null);const [modoDemoAlvorada,setModoDemoAlvorada]=useState(false);
  const [usuario,setUsuario]=useState("");const [senha,setSenha]=useState("");const [login,setLogin]=useState(false);const [modoAtivar,setModoAtivar]=useState(false);const [token,setToken]=useState("");const [novaSenha,setNovaSenha]=useState("");const [repeteSenha,setRepeteSenha]=useState("");const [ativando,setAtivando]=useState(false);const [modoRecuperar,setModoRecuperar]=useState(false);const [cpfRecuperacao,setCpfRecuperacao]=useState("");const [nascimentoRecuperacao,setNascimentoRecuperacao]=useState("");const [desafioRecuperacao,setDesafioRecuperacao]=useState<DesafioRecuperacao|null>(null);const [animalResposta,setAnimalResposta]=useState("");const [senhaRecuperacao,setSenhaRecuperacao]=useState("");const [repeteSenhaRecuperacao,setRepeteSenhaRecuperacao]=useState("");const [recuperando,setRecuperando]=useState(false);
  const [animais,setAnimais]=useState<Animal[]>([]);const [animalId,setAnimalId]=useState("");const [secao,setSecao]=useState<Secao>("resumo");const [vacinas,setVacinas]=useState<Vacina[]>([]);const [vermifugos,setVermifugos]=useState<Vermifugo[]>([]);const [exames,setExames]=useState<Exame[]>([]);const [documentos,setDocumentos]=useState<Documento[]>([]);const [receitas,setReceitas]=useState<Receita[]>([]);const [agendas,setAgendas]=useState<Agenda[]>([]);const [agendamentos,setAgendamentos]=useState<Agendamento[]>([]);const [comandas,setComandas]=useState<Comanda[]>([]);
  const [estadoAgendas, setEstadoAgendas] = useState<"carregando" | "pronto" | "erro">("carregando");
  const [estadoMarcacoes, setEstadoMarcacoes] = useState<"carregando" | "pronto" | "erro">("carregando");
  const [estadoAvisos, setEstadoAvisos] = useState<"carregando" | "pronto" | "parcial" | "erro">("carregando");
  const [erroHorarios, setErroHorarios] = useState(false);
  const [agendaId,setAgendaId]=useState("");const [pagando,setPagando]=useState<string|null>(null);const [adiantamentos,setAdiantamentos]=useState<Record<string,string>>({});const [dataAgenda,setDataAgenda]=useState(dataIso);const [horarios,setHorarios]=useState<Horario[]>([]);const [horario,setHorario]=useState("");const [obs,setObs]=useState("");const [carregandoHorarios,setCarregandoHorarios]=useState(false);const [agendando,setAgendando]=useState(false);const [baixando,setBaixando]=useState<string|null>(null);
  const [telefone,setTelefone]=useState("");const [email,setEmail]=useState("");const [salvandoPerfil,setSalvandoPerfil]=useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const codigo = hash.get("ativar") || query.get("ativar");
    const usuarioDoLink = hash.get("usuario") || query.get("usuario");
    if (codigo) {
      setToken(codigo);
      setModoAtivar(true);
    }
    if (query.get("recuperar") === "1") {
      setModoRecuperar(true);
      setModoAtivar(false);
    }
    if (usuarioDoLink) setUsuario(usuarioDoLink);

    function lerNavegacao() {
      const parametros = new URLSearchParams(window.location.search);
      setSecao(secaoDoEndereco(parametros));
      setAnimalId(parametros.get("animal") || "");
    }
    lerNavegacao();
    window.addEventListener("popstate", lerNavegacao);
    return () => window.removeEventListener("popstate", lerNavegacao);
  }, [slug]);
  useEffect(()=>{let vivo=true;setCarregandoClinica(true);void(async()=>{
    // O site e o portal compartilham exatamente a mesma fonte de identidade.
    // O modelo escolhido na vitrine é transmitido explicitamente por URL,
    // sem depender de cookies, do referer ou de dados de outra clínica.
    const [clinicaResp,site] = await Promise.all([
      (supabaseBanco as any).rpc("oricse_clinica_publica_portal",{p_slug:slug}),
      loadPublicClinicSite(slug).catch(error=>{console.warn("Tema público indisponível:",error);return null;}),
    ]);
    if(!vivo)return;
    const registro=Array.isArray(clinicaResp.data)?clinicaResp.data[0]:null;
    if(!clinicaResp.error&&registro?.clinica_id&&registro?.clinica_slug===slug)
      setClinica({nome:registro.clinica_nome,slug:registro.clinica_slug,logo_url:registro.clinica_logo_url||null});
    else setClinica(null);

    const publicado=site&&clinicSiteTemplates.includes(site.template as ClinicSiteTemplate)
      ? site.template as ClinicSiteTemplate : "essencial";
    const solicitado=typeof window!=="undefined" ? new URLSearchParams(window.location.search).get("modelo") : null;
    const modelo=slug==="alvorada"&&clinicSiteTemplates.includes(solicitado as ClinicSiteTemplate)
      ? solicitado as ClinicSiteTemplate : publicado;
    const configuracao=site?normalizeClinicSiteConfig(site.config):null;
    const cores:CoresPortal=slug==="alvorada"||!configuracao
      ? clinicSitePresets[modelo]
      : {
          primaryColor:configuracao.primaryColor,secondaryColor:configuracao.secondaryColor,
          backgroundColor:configuracao.backgroundColor,textColor:configuracao.textColor,
        };
    setTemaPortal({modelo,cores});
    setCarregandoClinica(false);
  })().catch(error=>{console.error("Não foi possível carregar o Portal do Tutor:",error);if(vivo){setClinica(null);setCarregandoClinica(false);}});
  return()=>{vivo=false};},[slug]);

  useEffect(()=>{let ativo=true;void(async()=>{const {data}=await (supabaseBanco as any).rpc("oricse_portal_config_publica",{p_slug:slug});if(ativo&&data)setPortalConfig(data);})();return()=>{ativo=false};},[slug]);
  useEffect(()=>{let ativo=true;void(async()=>{const {data}=await (supabaseBanco as any).rpc("oricse_portal_extras_publicas",{p_slug:slug});if(ativo&&data)setExtrasPublicos(data);})();return()=>{ativo=false};},[slug]);
  const versaoCarregamento = useRef(0);
  const carregar=useCallback(async(atualizar = false)=>{
    const versao = ++versaoCarregamento.current;
    if (!atualizar) setCarregando(true);
    try{
      const{data:ctxData,error:ctxError}=await supabaseBanco.rpc("oricse_portal_meu_contexto");if(ctxError)throw ctxError;const ctx=ctxData?.[0] as Contexto|undefined;
      if (!ctx?.tutor_id || ctx.clinica_slug !== slug) {
        throw new Error("Esta conta não tem acesso ao portal desta clínica.");
      }
      const { data: pets, error: erroPets } = await supabaseBanco.from("oricse_animais")
        .select("id,nome,especie,raca,sexo,nascimento,peso_kg,foto_url")
        .eq("clinica_id", ctx.clinica_id).eq("tutor_id", ctx.tutor_id).order("nome");
      if (erroPets) throw erroPets;
      if (versao !== versaoCarregamento.current) return;
      if (!atualizar) {
        setFontesCuidados({ vacinas: "carregando", vermifugos: "carregando" });
        setVacinas([]);setVermifugos([]);setExames([]);setDocumentos([]);setReceitas([]);setEstadoAgendas("carregando");setEstadoMarcacoes("carregando");setEstadoAvisos("carregando");setAgendas([]);setAgendamentos([]);setComandas([]);setAgendaId("");
      }
      const lista = (pets || []) as Animal[];
      setAnimais(lista);
      setAnimalId(at => lista.some(x => x.id === at) ? at : (lista[0]?.id || ""));
      setTelefone(ctx.tutor_telefone || "");
      setEmail(ctx.tutor_email || "");
      setContexto(ctx);
      setCarregando(false);
      void carregarCuidados(ctx).catch(erro => {
        if (versao !== versaoCarregamento.current) return;
        console.error("Falha ao consultar os cuidados dos pets:", erro);
        setFontesCuidados(atual => ({
          vacinas: atual.vacinas === "carregando" ? "indisponivel" : atual.vacinas,
          vermifugos: atual.vermifugos === "carregando" ? "indisponivel" : atual.vermifugos,
        }));
      });
      void carregarAgendas(ctx);
      void carregarComplementos(ctx);
    } catch (erro) {
      if (versao !== versaoCarregamento.current) return;
      if (!atualizar) {
        setContexto(null);
        setAnimais([]);
      }
      throw erro;
    } finally {
      if (versao === versaoCarregamento.current) setCarregando(false);
    }

    async function carregarCuidados(ctx: Contexto) {
      const vacinasColunas = "id,animal_id,nome,aplicada_em,reforco_em,lote,observacoes";
      const vermifugosColunas = "id,animal_id,nome,administrado_em,proxima_dose_em,lote,observacoes";
      const dadosAplicacao = "fabricante,dose,fabricacao,validade,hora_aplicacao,local_aplicacao,veterinario_nome,veterinario_crmv,veterinario_uf";
      const [vacinasBanco, vermifugosBanco, vacinasLegadas, vermifugosLegados] = await Promise.all([
        supabaseBanco.from("oricse_portal_vacinas").select(`${vacinasColunas},${dadosAplicacao},alvo_vacinacao`, { count: "exact" }).eq("clinica_id", ctx.clinica_id).eq("visivel_tutor", true),
        supabaseBanco.from("oricse_portal_vermifugos").select(`${vermifugosColunas},${dadosAplicacao},principio_ativo,via`, { count: "exact" }).eq("clinica_id", ctx.clinica_id).eq("visivel_tutor", true),
        supabase.from("oricse_portal_vacinas").select(vacinasColunas).eq("clinica_id", ctx.clinica_id).eq("visivel_tutor", true),
        supabase.from("oricse_portal_vermifugos").select(vermifugosColunas).eq("clinica_id", ctx.clinica_id).eq("visivel_tutor", true),
      ]);
      if (versao !== versaoCarregamento.current) return;
      const unir = <T extends { id: string }>(legados: T[], atuais: T[]) =>
        [...new Map([...legados, ...atuais].map(registro => [registro.id, registro])).values()];
      setVacinas(unir(vacinasLegadas.data || [], vacinasBanco.data || []));
      setVermifugos(unir(vermifugosLegados.data || [], vermifugosBanco.data || []));
      const situacao = (
        banco: { error: unknown; count: number | null; data: unknown[] | null },
        legado: { error: unknown },
      ): FonteCuidados => {
        if (banco.error && legado.error) return "indisponivel";
        if (banco.error || legado.error || (banco.count ?? 0) > (banco.data?.length ?? 0)) return "parcial";
        return "completa";
      };
      setFontesCuidados({
        vacinas: situacao(vacinasBanco, vacinasLegadas),
        vermifugos: situacao(vermifugosBanco, vermifugosLegados),
      });
    }

    async function carregarAgendas(ctx: Contexto) {
      try {
        const { data, error } = await supabaseBanco.rpc("oricse_portal_agendas");
        if (versao !== versaoCarregamento.current) return;
        if (error) throw error;
        const lista = data || [];
        setAgendas(lista);
        setAgendaId(atual => lista.some(agenda => agenda.id === atual) ? atual : (lista[0]?.id || ""));
        setEstadoAgendas("pronto");
      } catch {
        if (versao === versaoCarregamento.current) setEstadoAgendas("erro");
      }

      const colunas = "id,agenda_id,animal_id,inicio,fim,estado,tipo,observacoes";
      const [banco, legado] = await Promise.allSettled([
        supabaseBanco.from("oricse_agendamentos_online").select(colunas)
          .eq("clinica_id", ctx.clinica_id).eq("tutor_id", ctx.tutor_id).order("inicio"),
        supabase.from("oricse_agendamentos_online").select(colunas)
          .eq("clinica_id", ctx.clinica_id).eq("tutor_id", ctx.tutor_id).order("inicio"),
      ]);
      if (versao !== versaoCarregamento.current) return;
      const fontes = [legado, banco];
      const registros = fontes.flatMap(resultado =>
        resultado.status === "fulfilled" ? (resultado.value.data || []) as Agendamento[] : []);
      setEstadoMarcacoes(fontes.some(resultado =>
        resultado.status === "rejected" || resultado.value.error) ? "erro" : "pronto");
      const unicos = new Map(registros.map(item => [item.id, item]));
      setAgendamentos([...unicos.values()].sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio)));
    }

    async function carregarComplementos(ctx: Contexto) {
      try {
      const [e,d,r,c,docsCanonicos,comandasBanco,examesBanco,receitasBanco]=await Promise.all([
        (supabase as any).from("oricse_portal_exames").select("id,animal_id,titulo,tipo,realizado_em,resultado_resumo,drive_arquivo_id").eq("clinica_id",ctx.clinica_id).eq("visivel_tutor",true).order("realizado_em",{ascending:false,nullsFirst:false}),
        (supabase as any).from("oricse_portal_documentos").select("id,animal_id,titulo,tipo,data_documento,observacoes,drive_arquivo_id").eq("clinica_id",ctx.clinica_id).eq("visivel_tutor",true).order("data_documento",{ascending:false,nullsFirst:false}),
        (supabase as any).from("oricse_portal_receitas").select("id,animal_id,tipo,numero,titulo,emitida_em,drive_arquivo_id").eq("clinica_id",ctx.clinica_id).eq("visivel_tutor",true).order("emitida_em",{ascending:false}),
        (supabase as any).from("oricse_portal_comandas").select("id,animal_id,numero,status,origem,aberta_em,finalizada_em,itens,pagamentos,total,total_pago,saldo").eq("clinica_id",ctx.clinica_id).order("aberta_em",{ascending:false}),
        supabaseBanco.from("oricse_portal_documentos")
          .select("id,animal_id,titulo,tipo,data_documento,observacoes,drive_arquivo_id")
          .eq("clinica_id",ctx.clinica_id).eq("visivel_tutor",true)
          .order("data_documento",{ascending:false,nullsFirst:false}),
        supabaseBanco.from("oricse_portal_comandas")
          .select("id,animal_id,numero,status,origem,aberta_em,finalizada_em,itens,pagamentos,total,total_pago,saldo")
          .eq("clinica_id",ctx.clinica_id).eq("tutor_id",ctx.tutor_id).eq("visivel_tutor",true)
          .order("aberta_em",{ascending:false}),
        supabaseBanco.from("oricse_portal_exames")
          .select("id,animal_id,titulo,tipo,realizado_em,resultado_resumo,drive_arquivo_id")
          .eq("clinica_id",ctx.clinica_id).eq("visivel_tutor",true)
          .order("realizado_em",{ascending:false,nullsFirst:false}),
        supabaseBanco.from("oricse_portal_receitas")
          .select("id,animal_id,tipo,numero,titulo,emitida_em,drive_arquivo_id")
          .eq("clinica_id",ctx.clinica_id).eq("tutor_id",ctx.tutor_id).eq("visivel_tutor",true)
          .order("emitida_em",{ascending:false}),
      ]);
      if (versao !== versaoCarregamento.current) return;
      if(docsCanonicos.error) console.warn("Documentos canônicos indisponíveis:",docsCanonicos.error.message);
      const unicos = new Map<string,Documento>();
      for(const item of [...(d.data||[]),...(docsCanonicos.data||[])] as Documento[]) unicos.set(item.id,item);
      setExames([...new Map<string, Exame>([...(e.data || []), ...(examesBanco.data || [])]
        .map(item => [item.id, item as Exame])).values()]);
      setDocumentos([...unicos.values()]);
      setReceitas([...new Map<string, Receita>([...(r.data || []), ...(receitasBanco.data || [])]
        .map(item => [item.id, item as Receita])).values()]);
      const fontesAvisos = [d, e, r, docsCanonicos, examesBanco, receitasBanco];
      setEstadoAvisos(fontesAvisos.every(fonte => fonte.error) ? "erro"
        : fontesAvisos.some(fonte => fonte.error) ? "parcial" : "pronto");
      setComandas([...new Map<string, Comanda>([...(c.data || []), ...(comandasBanco.data || [])]
        .map(item => [item.id, item as Comanda])).values()]);
      } catch (erro) {
        if (versao === versaoCarregamento.current) setEstadoAvisos("erro");
        console.error("Falha ao carregar dados complementares do portal:", erro);
      }
    }
  },[slug]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "INITIAL_SESSION" && sessao) {
        // O cliente libera o lock de autenticação ao sair do callback.
        timer = setTimeout(() => {
          void carregar().catch(erro => {
            console.error("Falha ao restaurar sessão do portal:", erro);
          });
        }, 0);
      } else if (evento === "SIGNED_OUT" || evento === "INITIAL_SESSION") {
        clearTimeout(timer);
        ++versaoCarregamento.current;
        setContexto(null);
        setAnimais([]);
        setCarregando(false);
      }
    });
    return () => {
      clearTimeout(timer);
      ++versaoCarregamento.current;
      data.subscription.unsubscribe();
    };
  }, [carregar]);
  useEffect(() => {
    setHorario("");
    setHorarios([]);
    setErroHorarios(false);
    if (!contexto || !agendaId || !dataAgenda) {
      setCarregandoHorarios(false);
      return;
    }
    if (modoDemoAlvorada) {
      const dia = `${dataAgenda}T`;
      const lista = [
        { inicio: `${dia}09:00:00-03:00`, fim: `${dia}09:30:00-03:00`, rotulo: "09:00" },
        { inicio: `${dia}10:30:00-03:00`, fim: `${dia}11:00:00-03:00`, rotulo: "10:30" },
        { inicio: `${dia}14:00:00-03:00`, fim: `${dia}14:30:00-03:00`, rotulo: "14:00" },
      ];
      setHorarios(lista);
      setHorario(lista[0].inicio);
      setCarregandoHorarios(false);
      return;
    }
    let ativo = true;
    setCarregandoHorarios(true);
    void (async () => {
      try {
        const { data, error } = await supabaseBanco.rpc("oricse_portal_horarios_disponiveis", {
          p_agenda_id: agendaId, p_data: dataAgenda,
        });
        if (!ativo) return;
        if (error) throw error;
        setHorarios(data || []);
        setHorario(data?.[0]?.inicio || "");
      } catch {
        if (ativo) setErroHorarios(true);
      } finally {
        if (ativo) setCarregandoHorarios(false);
      }
    })();
    return () => { ativo = false; };
  }, [contexto, agendaId, dataAgenda, modoDemoAlvorada]);

  const animal = animais.find(a => a.id === animalId) || animais[0] || null;
  const navegacao = secoesPortal.filter(({ id }) =>
    (id !== "pet" || animais.length > 0) &&
    (id !== "agenda" || portalConfig.exibir_agendamento !== false) &&
    (id !== "documentos" || portalConfig.exibir_documentos !== false));
  const secaoAtual = navegacao.find(({ id }) => id === secao) ?? navegacao[0];

  function navegar(destino: Secao, novoAnimalId = destino === "resumo" ? "" : animal?.id || "") {
    const url = new URL(window.location.href);
    if (destino === "resumo") url.searchParams.delete("secao");
    else url.searchParams.set("secao", destino);
    if (novoAnimalId) url.searchParams.set("animal", novoAnimalId);
    else url.searchParams.delete("animal");
    const endereco = url.pathname + url.search + url.hash;
    if (endereco !== window.location.pathname + window.location.search + window.location.hash) {
      void router.navigate({
        to: "/$alias",
        params: { alias: "portaldotutor" },
        search: Object.fromEntries(url.searchParams),
        hash: url.hash.slice(1),
        resetScroll: false,
        hashScrollIntoView: false,
      });
    }
    setSecao(destino);
    setAnimalId(novoAnimalId);
    if (destino !== secaoAtual.id) {
      requestAnimationFrame(() => {
        const titulo = tituloSecao.current;
        if (!titulo) return;
        titulo.focus({ preventScroll: true });
        if (titulo.getBoundingClientRect().top < 64) titulo.scrollIntoView({ block: "start", behavior: "instant" });
      });
    }
  }

  const vacinasAnimal=useMemo(()=>vacinas.filter(v=>v.animal_id===animal?.id),[vacinas,animal?.id]);const vermifugosAnimal=useMemo(()=>vermifugos.filter(v=>v.animal_id===animal?.id),[vermifugos,animal?.id]);const examesAnimal=useMemo(()=>exames.filter(e=>e.animal_id===animal?.id),[exames,animal?.id]);const docsAnimal=useMemo(()=>documentos.filter(d=>d.animal_id===animal?.id),[documentos,animal?.id]);const receitasAnimal=useMemo(()=>receitas.filter(r=>r.animal_id===animal?.id),[receitas,animal?.id]);const marcacoesAnimal=useMemo(()=>agendamentos.filter(a=>a.animal_id===animal?.id),[agendamentos,animal?.id]);const comandasAnimal=useMemo(()=>comandas.filter(c=>c.animal_id===animal?.id),[comandas,animal?.id]);const agenda=agendas.find(a=>a.id===agendaId)||null;

  async function entrar(e:React.FormEvent){e.preventDefault();if(slug.trim().toLowerCase()==="alvorada"){const demo=dadosDemoAlvorada(clinica as ClinicaPublica,usuario);setModoDemoAlvorada(true);setContexto(demo.contexto);setTelefone(demo.contexto.tutor_telefone||"");setEmail(demo.contexto.tutor_email||"");setAnimais(demo.animais);setFontesCuidados({vacinas:"completa",vermifugos:"completa"});setVacinas(demo.vacinas);setVermifugos(demo.vermifugos);setExames(demo.exames);setDocumentos(demo.documentos);setReceitas(demo.receitas);setAgendas(demo.agendas);setEstadoAgendas("pronto");setEstadoMarcacoes("pronto");setEstadoAvisos("pronto");setAgendamentos(demo.agendamentos);setComandas(demo.comandas);setAnimalId(at=>demo.animais.some(a=>a.id===at)?at:demo.animais[0].id);setAgendaId(demo.agendas[0].id);setSenha("");setCarregando(false);return;}setLogin(true);try{const{data,error}=await supabase.functions.invoke("oricse-portal-login",{body:{slug,usuario,senha}});if(error||!data?.access_token||!data?.refresh_token){const resposta=error instanceof FunctionsHttpError?await error.context.json().catch(()=>null):data;throw new Error(resposta?.error||"Não foi possível entrar.");}const r=await supabase.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});if(r.error)throw r.error;setSenha("");await carregar();}catch(err){toast.error(err instanceof Error?err.message:"Não foi possível entrar.");}finally{setLogin(false);}}
  async function ativar(e: React.FormEvent) {
    e.preventDefault();
    const codigo = token.trim();
    if (!/^(?:[a-z]{2}[0-9]{2}|[0-9a-f]{48})$/i.test(codigo)) {
      toast.error("Informe o código de ativação enviado pela clínica.");
      return;
    }
    if (!senhaPortalValida(novaSenha)) {
      toast.error(orientacaoSenhaPortal);
      return;
    }
    if (novaSenha !== repeteSenha) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setAtivando(true);
    try {
      const { data, error } = await supabase.functions.invoke("oricse-portal-activate", {
        body: { slug, usuario, token: codigo, senha: novaSenha },
      });
      const resposta = error instanceof FunctionsHttpError
        ? await error.context.json().catch(() => null)
        : data;
      if (error || !data?.ok) {
        throw new Error(resposta?.error || "Não foi possível ativar o acesso.");
      }
      toast.success("Acesso ativado. Entre com a senha criada.");
      setModoAtivar(false);
      setToken("");
      setNovaSenha("");
      setRepeteSenha("");
      history.replaceState({}, "", location.pathname);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível ativar o acesso.");
    } finally {
      setAtivando(false);
    }
  }
  async function iniciarRecuperacao(e: React.FormEvent) {
    e.preventDefault();
    const cpf = cpfRecuperacao.replace(/\D/g, "");
    if (!usuario.trim() || cpf.length !== 11 || !nascimentoRecuperacao) {
      toast.error("Informe seu @, CPF e data de nascimento.");
      return;
    }
    setRecuperando(true);
    try {
      const { data, error } = await supabase.functions.invoke("oricse-portal-reset-start", {
        body: { slug, usuario, cpf, nascimento: nascimentoRecuperacao },
      });
      const resposta = error instanceof FunctionsHttpError
        ? await error.context.json().catch(() => null) : data;
      if (error || !data?.ok) throw new Error(resposta?.error || "Não foi possível validar os dados.");
      setDesafioRecuperacao(data as DesafioRecuperacao);
      setAnimalResposta("");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível iniciar a redefinição.");
    } finally {
      setRecuperando(false);
    }
  }
  async function concluirRecuperacao(e:React.FormEvent){e.preventDefault();if(!desafioRecuperacao||!animalResposta)return void toast.error("Escolha qual é o seu pet.");if(!senhaPortalValida(senhaRecuperacao))return void toast.error(orientacaoSenhaPortal);if(senhaRecuperacao!==repeteSenhaRecuperacao)return void toast.error("As senhas não coincidem.");setRecuperando(true);try{const{data,error}=await supabase.functions.invoke("oricse-portal-reset-complete",{body:{desafioId:desafioRecuperacao.desafioId,animalId:animalResposta,senha:senhaRecuperacao}});if(error||!data?.ok)throw new Error(data?.error||"Não foi possível redefinir a senha.");toast.success("Senha redefinida. Entre com seu usuário e a nova senha.");setModoRecuperar(false);setDesafioRecuperacao(null);setAnimalResposta("");setSenhaRecuperacao("");setRepeteSenhaRecuperacao("");history.replaceState({},"",location.pathname);}catch(err){toast.error(err instanceof Error?err.message:"Não foi possível redefinir a senha.");}finally{setRecuperando(false);}}
  function voltarRecuperacao(){setModoRecuperar(false);setDesafioRecuperacao(null);setAnimalResposta("");setSenhaRecuperacao("");setRepeteSenhaRecuperacao("");history.replaceState({},"",location.pathname);}
  async function sair(){if(!modoDemoAlvorada)await supabase.auth.signOut();setModoDemoAlvorada(false);setContexto(null);setAnimais([]);}
  async function salvarPerfil(){setSalvandoPerfil(true);try{const{error}=await(supabase as any).rpc("oricse_portal_atualizar_perfil",{p_telefone:telefone,p_email:email});if(error)throw error;setContexto(atual=>atual?{...atual,tutor_telefone:telefone,tutor_email:email}:atual);toast.success("Dados atualizados.");}catch(e){toast.error(e instanceof Error?e.message:"Não foi possível salvar.");}finally{setSalvandoPerfil(false);}}
  async function agendar() {
    if (!animal || !agendaId || !horario) return;
    if (modoDemoAlvorada) {
      toast.info("Agendamento demonstrativo.");
      return;
    }
    setAgendando(true);
    try {
      const { data, error } = await supabaseBanco.rpc("oricse_portal_criar_agendamento", {
        p_agenda_id: agendaId, p_animal_id: animal.id, p_inicio: horario,
        ...(obs ? { p_observacoes: obs } : {}),
      });
      if (error) throw new Error(error.message);
      toast.success(data?.[0]?.estado === "confirmado" ? "Agendamento confirmado." : "Solicitação enviada.");
      setHorario("");
      setHorarios([]);
      setObs("");
      await carregar(true);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível agendar.");
    } finally {
      setAgendando(false);
    }
  }
  async function pagarAgenda(){if(!animal||!agenda||!horario)return;setPagando("agenda");try{const{data,error}=await supabase.functions.invoke("oricse-portal-pagamentos?action=agenda",{body:{agenda_id:agenda.id,animal_id:animal.id,inicio:horario,observacoes:obs||null,slug}});if(error||!data?.checkout_url)throw new Error(data?.error||"Não foi possível abrir o pagamento.");window.location.assign(data.checkout_url);}catch(e){toast.error(e instanceof Error?e.message:"Não foi possível abrir o pagamento.");setPagando(null);}}
  async function pagarComanda(comanda:Comanda){setPagando(comanda.id);try{const texto=String(adiantamentos[comanda.id]||"").replace(/[^0-9,]/g,"").replace(",",".");const informado=Number(texto);const valor_centavos=Number.isFinite(informado)&&informado>0?Math.round(informado*100):Math.round(Number(comanda.saldo)*100);const{data,error}=await supabase.functions.invoke("oricse-portal-pagamentos?action=comanda",{body:{comanda_id:comanda.id,valor_centavos,slug}});if(error||!data?.checkout_url)throw new Error(data?.error||"Não foi possível abrir o pagamento.");window.location.assign(data.checkout_url);}catch(e){toast.error(e instanceof Error?e.message:"Não foi possível abrir o pagamento.");setPagando(null);}}
  async function abrirArquivo(id:string,tipo:TipoArquivo){const chave=`${tipo}:${id}`;setBaixando(chave);try{const{data:sessao}=await supabase.auth.getSession();const accessToken=sessao.session?.access_token;if(!accessToken)throw new Error("Sua sessão expirou. Entre novamente.");const arquivo=await baixarDocumentoPortal({data:{accessToken,documentoId:id,tipo}});const binario=atob(arquivo.base64);const bytes=new Uint8Array(binario.length);for(let i=0;i<binario.length;i++)bytes[i]=binario.charCodeAt(i);const url=URL.createObjectURL(new Blob([bytes],{type:arquivo.mimeType}));const aba=window.open(url,"_blank","noopener,noreferrer");if(!aba){const link=document.createElement("a");link.href=url;link.download=arquivo.nome;link.click();}setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){toast.error(e instanceof Error?e.message:"Não foi possível abrir o arquivo.");}finally{setBaixando(null);}}

  async function enviarFotoDoPet(arquivo: File, petId: string) {
    if (enviandoFoto) return;
    const versao = versaoCarregamento.current;
    setEnviandoFoto(petId);
    try {
      const foto = await prepararFotoDoPet(arquivo);
      if (versao !== versaoCarregamento.current) return;
      if (!modoDemoAlvorada) {
        const { error } = await supabaseBanco.rpc("oricse_portal_salvar_foto_animal", { p_animal_id: petId, p_foto: foto });
        if (error) throw new Error(error.message);
      }
      if (versao !== versaoCarregamento.current) return;
      setAnimais(atuais => atuais.map(pet => pet.id === petId ? { ...pet, foto_url: foto } : pet));
      toast.success(modoDemoAlvorada ? "Foto atualizada nesta demonstração." : "Foto do pet atualizada.");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar a foto.");
    } finally {
      setEnviandoFoto(null);
    }
  }

  if(carregandoClinica)return <TelaCarregando/>;if(!clinica)return <main className="mx-auto max-w-lg p-10 text-center"><h1 className="text-2xl font-bold">Portal indisponível</h1><p className="mt-2 text-muted-foreground">Clínica não encontrada.</p><Link to="/" className="mt-4 inline-block underline">Voltar</Link></main>;
  if(!contexto)return <Login tema={temaPortal} clinica={clinica} extras={extrasPublicos} portalConfig={portalConfig} modoAtivar={modoAtivar} setModoAtivar={setModoAtivar} modoRecuperar={modoRecuperar} setModoRecuperar={setModoRecuperar} usuario={usuario} setUsuario={setUsuario} senha={senha} setSenha={setSenha} token={token} setToken={setToken} novaSenha={novaSenha} setNovaSenha={setNovaSenha} repeteSenha={repeteSenha} setRepeteSenha={setRepeteSenha} cpfRecuperacao={cpfRecuperacao} setCpfRecuperacao={setCpfRecuperacao} nascimentoRecuperacao={nascimentoRecuperacao} setNascimentoRecuperacao={setNascimentoRecuperacao} desafioRecuperacao={desafioRecuperacao} animalResposta={animalResposta} setAnimalResposta={setAnimalResposta} senhaRecuperacao={senhaRecuperacao} setSenhaRecuperacao={setSenhaRecuperacao} repeteSenhaRecuperacao={repeteSenhaRecuperacao} setRepeteSenhaRecuperacao={setRepeteSenhaRecuperacao} entrar={entrar} ativar={ativar} iniciarRecuperacao={iniciarRecuperacao} concluirRecuperacao={concluirRecuperacao} voltarRecuperacao={voltarRecuperacao} login={login} ativando={ativando} recuperando={recuperando}/>;if(carregando)return <TelaCarregando/>;

  const naVisaoGeral = secaoAtual.id === "resumo";
  const petsPorId = new Map(animais.map(pet => [pet.id, pet]));
  const pendencias = naVisaoGeral || secaoAtual.id === "pet" ? pendenciasDosPets(
    naVisaoGeral ? animais : animal ? [animal] : [],
    vacinas.map(registro => ({ ...registro, realizado: registro.aplicada_em, proximo: registro.reforco_em })),
    vermifugos.map(registro => ({ ...registro, realizado: registro.administrado_em, proximo: registro.proxima_dose_em })),
    comandas, fontesCuidados, dataIso(),
  ) : [];
  const avisosClinica = extrasPublicos.opcoes.mostrar_avisos !== false
    ? String(extrasPublicos.opcoes.aviso_importante || "").trim() : "";
  const avisosDosPets = naVisaoGeral ? [
    ...(portalConfig.exibir_documentos === false ? [] : documentos.map(d => ({
      ...d, secao: "documentos" as const, categoria: "Documento", data: d.data_documento,
    }))),
    ...exames.map(e => ({ ...e, secao: "exames" as const, categoria: "Exame", data: e.realizado_em })),
    ...receitas.map(r => ({ ...r, secao: "receitas" as const, categoria: "Receita", data: r.emitida_em })),
  ].filter(item => petsPorId.has(item.animal_id))
    .sort((a, b) => (b.data || "").localeCompare(a.data || "")) : [];
  const marcacoes = agendamentos.filter(item => !item.animal_id || petsPorId.has(item.animal_id));
  const carregandoCuidados = Object.values(fontesCuidados).includes("carregando");
  const cuidadosIncompletos = Object.values(fontesCuidados).some(fonte => fonte === "parcial" || fonte === "indisponivel");
  const nomeClinica = portalConfig.nome_exibicao || contexto.clinica_nome;
  const logoClinica = portalConfig.logo_clinica_url || contexto.clinica_logo_url || portalConfig.logo_cabecalho_url;
  const siteClinica = new URL("/", urlPortalDoTutor(slug)).href;
  const temNovidades = Boolean(
    (extrasPublicos.opcoes.mostrar_banner !== false && extrasPublicos.opcoes.banner_titulo) ||
    (extrasPublicos.opcoes.mostrar_promocoes !== false && extrasPublicos.promocoes?.length) ||
    (extrasPublicos.opcoes.mostrar_servico !== false && extrasPublicos.opcoes.destaque_servico) ||
    extrasPublicos.opcoes.chamada_promocional,
  );

  return (
    <main className="portal-tutor-live portal-area" data-site-template={temaPortal?.modelo} style={estiloTemaPortal(temaPortal)}>
      <header className="portal-area-header">
        <div className="portal-area-container portal-area-header-inner">
          <div className="portal-area-brand">
            <span className="portal-area-clinic-mark">
              {logoClinica ? <img src={logoClinica} alt="" /> : <PawPrint size={22} aria-hidden="true" />}
            </span>
            <div className="min-w-0">
              <p className="portal-area-brand-title">Portal do Tutor</p>
              <p className="portal-area-muted text-sm break-words">{nomeClinica}</p>
            </div>
          </div>
          <div className="portal-area-header-actions">
            <a href={siteClinica} className="portal-area-header-action"><ArrowLeft size={17} aria-hidden="true" /> <span>Site da clínica</span></a>
            <button type="button" className="portal-area-header-action" onClick={sair}><LogOut size={17} aria-hidden="true" /> <span>Sair</span></button>
          </div>
        </div>
      </header>
      <div className="portal-area-container portal-area-layout">
        <nav className="portal-area-nav" aria-label="Seções do Portal do Tutor">
          {navegacao.map(({ id, nome, emoji }) => (
            <button key={id} type="button" aria-current={secaoAtual.id === id ? "page" : undefined} onClick={() => navegar(id)}>
              <span className="portal-area-emoji" aria-hidden="true">{emoji}</span><span>{nome}</span>
            </button>
          ))}
        </nav>
        <label className="portal-area-mobile-nav">
          <span>Seções</span>
          <select value={secaoAtual.id} onChange={e => navegar(e.target.value as Secao)}>
            {navegacao.map(({ id, nome, emoji }) => <option key={id} value={id}>{emoji} {nome}</option>)}
          </select>
        </label>
        <div className="portal-area-content">
          {modoDemoAlvorada && <p className="portal-area-demo">Demonstração · Dados fictícios</p>}
          <div className="portal-area-section-heading">
            <h1 ref={tituloSecao} tabIndex={-1}>{secaoAtual.id === "pet" ? animal?.nome : secaoAtual.nome}</h1>
            {animal && !naVisaoGeral && secaoAtual.id !== "contato" && secaoAtual.id !== "perfil" && (
              <label className="portal-area-pet-select">
                <span>Pet selecionado</span>
                <select value={animal.id} onChange={e => navegar(secaoAtual.id, e.target.value)}>
                  {animais.map(pet => <option key={pet.id} value={pet.id}>{emojiDoPet(pet.especie)} {pet.nome}</option>)}
                </select>
              </label>
            )}
          </div>
          {secaoAtual.id === "contato" ? (
            <div className="space-y-4">
              <PortalClinicContact canais={portalConfig.canais_contato || {}} />
              <div className="portal-area-clinic-info">{extrasPublicos.opcoes?.mostrar_horarios!==false&&Boolean(extrasPublicos.opcoes?.horario_atendimento)&&<p className="mb-3 text-sm text-slate-600">Horário de atendimento: {String(extrasPublicos.opcoes.horario_atendimento)}</p>}{Boolean(extrasPublicos.opcoes?.endereco_publico)&&<p className="mb-3 text-sm text-slate-600">Endereço: {String(extrasPublicos.opcoes.endereco_publico)}</p>}{extrasPublicos.opcoes?.mostrar_instagram!==false&&Boolean(extrasPublicos.opcoes?.instagram)&&<p className="mb-3 text-sm text-slate-600">Instagram: {String(extrasPublicos.opcoes.instagram)}</p>}{Boolean(extrasPublicos.opcoes?.facebook)&&<p className="mb-3 text-sm text-slate-600">Facebook: {String(extrasPublicos.opcoes.facebook)}</p>}{(portalConfig.telefone_publico || portalConfig.whatsapp_publico) && <p className="text-sm">Contato {extrasPublicos.opcoes?.mostrar_contato !== false ? portalConfig.telefone_publico : ""}{extrasPublicos.opcoes?.mostrar_whatsapp !== false && portalConfig.whatsapp_publico && " · WhatsApp " + portalConfig.whatsapp_publico}</p>}</div>
            </div>
          ) : secaoAtual.id === "perfil" ? (
            <section className="rounded-2xl border bg-white p-5 sm:p-6"><p className="text-sm portal-area-muted">{contexto.tutor_nome} · {contexto.usuario}</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><Campo rotulo="Telefone" valor={telefone} onChange={setTelefone}/><Campo rotulo="E-mail" valor={email} onChange={setEmail} type="email"/></div><div className="mt-5 flex flex-wrap gap-2"><button disabled={salvandoPerfil} onClick={salvarPerfil} className="min-h-11 rounded-xl bg-[#702a43] px-5 py-3 font-bold text-white disabled:opacity-50">{salvandoPerfil?"Salvando...":"Salvar"}</button></div></section>
          ) : !animal && !naVisaoGeral && secaoAtual.id !== "agenda" ? (
            <section className="portal-area-empty">
              <PawPrint size={25} aria-hidden="true" />
              <h2>Nenhum pet vinculado</h2>
              <button type="button" className="portal-area-text-action" onClick={() => navegar("contato")}>Fale com a clínica</button>
            </section>
          ) : (
            <div className="space-y-4">
              {naVisaoGeral && (
                <>
                  {portalConfig.exibir_agendamento !== false && (
                    <Lista titulo="Agendas e agendamentos" vazio="">
                      <h3 className="text-sm font-semibold">Agendas disponíveis</h3>
                      {agendas.length ? (
                        <div className="portal-area-shortcuts">
                          {agendas.map(item => (
                            <Resumo key={item.id} titulo={item.nome} valor={item.responsavel || "Ver horários"} emoji="📅"
                              onClick={() => {
                                if (agendaId !== item.id) {
                                  setHorario("");
                                  setHorarios([]);
                                  setAgendaId(item.id);
                                }
                                navegar("agenda");
                              }} />
                          ))}
                        </div>
                      ) : <p className="portal-area-muted text-sm" role="status">
                        {estadoAgendas === "carregando" ? "Carregando agendas…" : estadoAgendas === "erro"
                          ? "Não foi possível carregar as agendas." : "Nenhuma agenda publicada pela clínica."}
                      </p>}
                      <h3 className="pt-2 text-sm font-semibold">Agendamentos dos pets</h3>
                      <ListaMarcacoes itens={marcacoes} estado={estadoMarcacoes} agendas={agendas}
                        nomeDoPet={id => petsPorId.get(id)?.nome}
                        onAbrir={id => navegar("agenda", id)} />
                    </Lista>
                  )}
                  <Lista titulo="Avisos" vazio="">
                    {avisosClinica && <p className="portal-area-notice whitespace-pre-wrap text-sm">{avisosClinica}</p>}
                    {estadoAvisos === "carregando" && <p className="portal-area-muted text-sm" role="status">Carregando avisos dos pets…</p>}
                    {(estadoAvisos === "erro" || estadoAvisos === "parcial") && (
                      <p className="portal-area-muted text-sm" role="status">Parte dos avisos está indisponível no momento.</p>
                    )}
                    {avisosDosPets.map(item => (
                      <button key={`${item.secao}-${item.id}`} type="button" className="portal-area-avisos-row portal-area-activity"
                        onClick={() => navegar(item.secao, item.animal_id)}>
                        <span><strong className="block">{item.titulo}</strong>
                          <small>{item.categoria} · {petsPorId.get(item.animal_id)?.nome}{item.data && ` · ${dataBr(item.data)}`}</small>
                        </span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </button>
                    ))}
                    {!avisosClinica && avisosDosPets.length === 0 && estadoAvisos === "pronto" && (
                      <p className="portal-area-muted text-sm">Nenhum aviso disponível.</p>
                    )}
                  </Lista>
                </>
              )}
              {secaoAtual.id === "pet" && animal && (
                  <section className="portal-area-pet">
                    <span className="portal-area-pet-photo">
                      {animal.foto_url ? <img src={animal.foto_url} alt="" /> : <span aria-hidden="true">{emojiDoPet(animal.especie)}</span>}
                    </span>
                    <div className="min-w-0">
                      <h2>{animal.nome}</h2>
                      <p className="portal-area-muted">{[animal.especie, animal.raca, animal.sexo].filter(Boolean).join(" · ")}</p>
                    </div>
                    <label className="portal-area-photo-button">
                      <Camera size={17} aria-hidden="true" />
                      <span>{enviandoFoto === animal.id ? "Enviando…" : animal.foto_url ? "Trocar foto" : "Adicionar foto"}</span>
                      <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp"
                        aria-label={`${animal.foto_url ? "Trocar" : "Adicionar"} foto de ${animal.nome}`}
                        disabled={enviandoFoto !== null}
                        onChange={e => {
                          const arquivo = e.currentTarget.files?.[0];
                          e.currentTarget.value = "";
                          if (arquivo) void enviarFotoDoPet(arquivo, animal.id);
                        }} />
                    </label>
                  </section>
              )}
              {(naVisaoGeral || secaoAtual.id === "pet") && (
                  <section className="portal-area-list portal-area-care" aria-labelledby="portal-cuidados">
                    <h2 id="portal-cuidados"><span aria-hidden="true">🐾</span> Atenção aos cuidados</h2>
                    <p className="portal-area-muted mt-1 text-sm">Vacinas e vermífugos em atraso ou com prazo nos próximos 15 dias.</p>
                    {carregandoCuidados && <p className="portal-area-muted mt-2 text-sm" role="status">Consultando registros dos pets…</p>}
                    {cuidadosIncompletos && <p className="portal-area-muted mt-2 text-sm">Parte dos registros está indisponível no momento.</p>}
                    {pendencias.length > 0 ? (
                      <ul className="portal-area-care-list">
                        {pendencias.map(item => (
                          <li key={item.id}>
                            <button type="button" className="portal-area-care-row" onClick={() => navegar(item.secao, item.animal.id)}>
                              <span className="portal-area-care-icon" aria-hidden="true">{item.secao === "vacinas" ? "💉" : item.secao === "vermifugos" ? "🛡️" : "💳"}</span>
                              <span className="portal-area-care-detail">
                                <strong>{item.titulo}</strong>
                                <small>{item.animal.nome}{item.data ? ` · ${dataBr(item.data)}` : item.saldo ? ` · ${dinheiro(item.saldo)}` : ""}</small>
                              </span>
                              <span className="portal-area-care-status" data-status={item.status}>{item.status}</span>
                              <ChevronRight size={17} aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : !carregandoCuidados && !cuidadosIncompletos && (
                      <p className="portal-area-muted mt-2 text-sm">Nenhum cuidado atrasado ou com prazo nos próximos 15 dias.</p>
                    )}
                  </section>
              )}
              {naVisaoGeral && (
                <Lista titulo="Meus animais" vazio="Nenhum pet vinculado.">
                  {animais.length > 0 && <div className="portal-area-shortcuts">
                    {animais.map(pet => (
                      <Resumo key={pet.id} titulo={pet.nome} valor={pet.especie || "Abrir ficha"} emoji={emojiDoPet(pet.especie)}
                        foto={pet.foto_url} onClick={() => navegar("pet", pet.id)} />
                    ))}
                  </div>}
                </Lista>
              )}
              {secaoAtual.id === "pet" && (
                <>
                  <div className="portal-area-shortcuts">
                    {portalConfig.exibir_agendamento !== false && <Resumo titulo="Agenda" valor="Agendamentos e horários" emoji="📅" onClick={() => navegar("agenda")} />}
                    {portalConfig.exibir_documentos !== false && <Resumo titulo="Documentos" valor="Laudos e arquivos" emoji="📄" onClick={() => navegar("documentos")} />}
                    <Resumo titulo="Vacinas" valor="Carteira e reforços" emoji="💉" onClick={() => navegar("vacinas")} />
                  </div>
                  {(examesAnimal.length > 0 || receitasAnimal.length > 0) && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {examesAnimal.length > 0 && <Lista titulo="Últimos exames" vazio="">{[...examesAnimal]
                        .sort((a,b) => (b.realizado_em || "").localeCompare(a.realizado_em || "")).slice(0,3).map(item => (
                          <button key={item.id} type="button" className="portal-area-activity" onClick={() => navegar("exames")}>
                            <span>{item.titulo}</span><small>{dataBr(item.realizado_em)}</small><ChevronRight size={16} aria-hidden="true" />
                          </button>
                        ))}</Lista>}
                      {receitasAnimal.length > 0 && <Lista titulo="Últimas receitas" vazio="">{[...receitasAnimal]
                        .sort((a,b) => b.emitida_em.localeCompare(a.emitida_em)).slice(0,3).map(item => (
                          <button key={item.id} type="button" className="portal-area-activity" onClick={() => navegar("receitas")}>
                            <span>{item.titulo}</span><small>{dataBr(item.emitida_em)}</small><ChevronRight size={16} aria-hidden="true" />
                          </button>
                        ))}</Lista>}
                    </div>
                  )}
                </>
              )}
              {naVisaoGeral && (
                <>
                  {temNovidades && <details className="portal-area-details"><summary>Novidades da clínica</summary><div className="pt-4">{extrasPublicos.opcoes?.mostrar_banner!==false&&Boolean(extrasPublicos.opcoes?.banner_titulo)&&<section className="mb-4 rounded-2xl border p-6" style={{backgroundColor:/^#[0-9a-fA-F]{6}$/.test(String(extrasPublicos.opcoes.cor_destaque||""))?String(extrasPublicos.opcoes.cor_destaque)+"20":"#e5f4ef"}}><h2 className="text-xl font-black">{String(extrasPublicos.opcoes.banner_titulo)}</h2><p className="mt-1">{String(extrasPublicos.opcoes.banner_subtitulo||"")}</p>{/^https:\/\//.test(String(extrasPublicos.opcoes.banner_link||""))&&<a className="mt-3 inline-block rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white" href={String(extrasPublicos.opcoes.banner_link)} target="_blank" rel="noopener noreferrer">Saiba mais</a>}</section>}{extrasPublicos.opcoes?.mostrar_promocoes!==false&&Boolean(extrasPublicos.promocoes?.length)&&<section className="mb-4 rounded-xl border bg-white p-4"><h2 className="mb-3 font-bold">Promoções da clínica</h2><div className="grid gap-3 sm:grid-cols-2">{(extrasPublicos.promocoes||[]).map((p,i)=><div key={i} className="rounded-lg border p-3"><strong>{p.titulo}</strong><p className="text-sm">{p.descricao}</p><p className="mt-1 text-sm font-semibold">{p.desconto_percentual}% de desconto{p.cupom?" · Cupom: "+p.cupom:""}</p></div>)}</div></section>}{extrasPublicos.opcoes?.mostrar_servico!==false&&Boolean(extrasPublicos.opcoes?.destaque_servico)&&<section className="mb-4 rounded-xl border bg-white p-4"><h2 className="font-bold">Serviço em destaque</h2><p className="text-sm">{String(extrasPublicos.opcoes.destaque_servico)}</p></section>}{Boolean(extrasPublicos.opcoes?.chamada_promocional)&&<p className="mb-4 rounded-lg bg-emerald-50 p-3 text-center font-semibold text-emerald-900">{String(extrasPublicos.opcoes.chamada_promocional)}</p>}</div></details>}
                  {portalConfig.exibir_agendamento !== false && (
                    <details className="portal-area-details"><summary>Outros serviços</summary>
                      <PortalTutorOtherServices mostrarTitulo={false} onNavigate={id => navegar(id === "contato" ? "contato" : id === "financeiro" ? "comanda" : "agenda")} />
                    </details>
                  )}
                </>
              )}
  {secaoAtual.id==="agenda"&&portalConfig.exibir_agendamento!==false&&<div className="space-y-4"><div className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">Novo agendamento</h2>{!animal && <p className="portal-area-muted mt-2 text-sm">Para agendar, peça à clínica para vincular seu pet.</p>}{portalConfig.instrucoes_agendamento && <p className="mt-2 text-sm portal-area-muted">{portalConfig.instrucoes_agendamento}</p>}{Boolean(extrasPublicos.opcoes.politica_cancelamento) && <details className="portal-area-details mt-3"><summary>Política de cancelamento</summary><p className="mt-2 text-sm">{String(extrasPublicos.opcoes.politica_cancelamento)}</p></details>}{agendas.length?<div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Agenda<select value={agendaId} onChange={e=>{setHorario("");setHorarios([]);setAgendaId(e.target.value);}} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">{agendas.map(a=><option key={a.id} value={a.id}>{a.nome}{a.responsavel?` · ${a.responsavel}`:""}</option>)}</select></label><label className="text-sm font-bold">Data<input type="date" min={dataIso()} value={dataAgenda} onChange={e=>{setHorario("");setHorarios([]);setDataAgenda(e.target.value);}} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label><div className="sm:col-span-2"><p className="text-sm font-bold">Horários livres</p><div className="mt-2 flex flex-wrap gap-2 rounded-xl border bg-slate-50 p-2">{carregandoHorarios?<span role="status" className="p-2 text-sm">Carregando horários…</span>:erroHorarios?<span role="alert" className="p-2 text-sm">Não foi possível consultar os horários. Selecione outra data ou tente novamente.</span>:horarios.length?horarios.map(h=><button key={h.inicio} onClick={()=>setHorario(h.inicio)} className={`rounded-lg px-3 py-2 text-sm font-bold ${horario===h.inicio?"bg-[#702a43] text-white":"border bg-white"}`}>{h.rotulo}</button>):<span className="p-2 text-sm text-slate-500">Nenhum horário disponível nesta data. Selecione outro dia.</span>}</div></div><label className="sm:col-span-2 text-sm font-bold">Observação<textarea value={obs} onChange={e=>setObs(e.target.value)} rows={3} maxLength={1000} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label></div>:<p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">{estadoAgendas === "carregando" ? "Carregando agendas…" : estadoAgendas === "erro" ? "Não foi possível carregar as agendas. Atualize a página para tentar novamente." : "A clínica ainda não publicou agendas para atendimento online."}</p>}{agenda?.modalidade==="pagamento"?<div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><strong className="block">Pagamento online seguro</strong><p className="mt-2 font-semibold">Ao iniciar o pagamento, o horário fica reservado para você por 15 minutos. Se o pagamento não for confirmado nesse prazo, a reserva expira e o horário volta a ficar disponível.</p><p className="mt-1">{agenda.pagamento_descricao||"Confirme o horário após o pagamento."} {agenda.pagamento_valor?"Valor: "+dinheiro(Number(agenda.pagamento_valor))+".":""}</p><button disabled={!animal||!horario||pagando==="agenda"} onClick={pagarAgenda} className="mt-3 flex items-center gap-2 rounded-xl bg-[#702a43] px-5 py-3 font-bold text-white disabled:opacity-40"><CheckCircle2 size={16}/>{pagando==="agenda"?"Abrindo pagamento...":"Pagar e confirmar horário"}</button></div>:agendas.length>0&&<button disabled={!animal||!horario||agendando} onClick={agendar} className="mt-4 flex items-center gap-2 rounded-xl bg-[#702a43] px-5 py-3 font-bold text-white disabled:opacity-40"><CheckCircle2 size={16}/>{agendando?"Agendando...":agenda?.modalidade==="livre"?"Confirmar":"Enviar solicitação"}</button>}</div><Lista titulo="Meus agendamentos" vazio=""><ListaMarcacoes itens={marcacoesAnimal} estado={estadoMarcacoes} agendas={agendas} /></Lista></div>}
  {secaoAtual.id==="documentos"&&portalConfig.exibir_documentos!==false&&<Lista titulo="Documentos, laudos e atestados" vazio="Nenhum documento liberado.">{docsAnimal.map(d=><div key={d.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{d.titulo}</strong><p className="text-xs text-slate-500">{d.tipo} · {dataBr(d.data_documento)}</p>{d.observacoes&&<p className="mt-2 text-sm">{d.observacoes}</p>}</div>{d.drive_arquivo_id&&<BotaoArquivo id={d.id} tipo="documento" baixando={baixando} onAbrir={abrirArquivo}/>}</div></div>)}</Lista>}
  {secaoAtual.id==="exames"&&<Lista titulo="Exames" vazio="Nenhum exame liberado.">{examesAnimal.map(e=><div key={e.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{e.titulo}</strong><p className="text-xs text-slate-500">{e.tipo} · {dataBr(e.realizado_em)}</p>{e.resultado_resumo&&<p className="mt-2 whitespace-pre-wrap text-sm">{e.resultado_resumo}</p>}</div>{e.drive_arquivo_id&&<BotaoArquivo id={e.id} tipo="exame" baixando={baixando} onAbrir={abrirArquivo} rotulo="Abrir PDF"/>}</div></div>)}</Lista>}
  {secaoAtual.id==="receitas"&&<Lista titulo="Receitas" vazio="Nenhuma receita disponível.">{receitasAnimal.map(r=><div key={r.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{r.titulo}</strong><p className="text-xs text-slate-500">{r.tipo==="especial"?"Controle especial":"Receita normal"} · {dataHora(r.emitida_em)}{r.numero?` · Nº ${r.numero}`:""}</p></div>{r.drive_arquivo_id&&<BotaoArquivo id={r.id} tipo="receita" baixando={baixando} onAbrir={abrirArquivo} rotulo="Abrir PDF"/>}</div></div>)}</Lista>}
  {secaoAtual.id==="vacinas"&&<><Lista titulo="Documentos de vacinação em PDF" vazio="Nenhum documento de vacinação em PDF liberado.">{docsAnimal.filter(d=>["Atestado de vacinação", "Cartão de vacinação", "Carteira de vacinação", "Carteira de saúde"].includes(d.tipo)).map(d=><div key={d.id} className="flex justify-between rounded-xl border p-4"><strong>{d.titulo}</strong>{d.drive_arquivo_id&&<BotaoArquivo id={d.id} tipo="documento" baixando={baixando} onAbrir={abrirArquivo} rotulo="Abrir PDF"/>}</div>)}</Lista><Lista titulo="Cartão de vacinas e reforços" vazio="Nenhuma vacina ou cartão liberado.">{vacinasAnimal.map(v=><div key={v.id} className="rounded-xl border p-4"><div className="flex justify-between gap-2"><strong>{v.nome}</strong>{v.reforco_em&&<span className="rounded-full bg-[#702a43]/10 px-2 py-1 text-xs font-bold text-[#702a43]">Reforço {dataBr(v.reforco_em)}</span>}</div><p className="text-xs text-slate-500">Aplicada {dataBr(v.aplicada_em)}{v.lote?` · Lote ${v.lote}`:""}</p><DadosDoAto dados={v} />{v.observacoes&&<p className="mt-2 text-sm">{v.observacoes}</p>}</div>)}</Lista></>}
  {secaoAtual.id==="vermifugos"&&<><Lista titulo="Comprovantes em PDF" vazio="Nenhum comprovante em PDF liberado.">
    {docsAnimal.filter(d => d.tipo === "Comprovante de vermifugação" && d.drive_arquivo_id).map(d => (
      <div key={d.id} className="flex justify-between gap-3 rounded-xl border p-4">
        <strong>{d.titulo}</strong><BotaoArquivo id={d.id} tipo="documento" baixando={baixando} onAbrir={abrirArquivo} rotulo="Abrir PDF" />
      </div>
    ))}
  </Lista><Lista titulo="Vermífugos e próximas doses" vazio="Nenhuma vermifugação liberada pela clínica.">{vermifugosAnimal.map(v=><div key={v.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{v.nome}</strong>{v.proxima_dose_em&&<span className="rounded-full bg-[#702a43]/10 px-2 py-1 text-xs font-bold text-[#702a43]">Próxima dose: {dataBr(v.proxima_dose_em)}</span>}</div><p className="mt-1 text-xs text-slate-500">Administrado: {dataBr(v.administrado_em)}{v.lote?` · Lote ${v.lote}`:""}</p><DadosDoAto dados={v} />{v.observacoes&&<p className="mt-2 whitespace-pre-wrap text-sm">{v.observacoes}</p>}</div>)}</Lista></>}
  {secaoAtual.id==="comanda"&&<Lista titulo="Comandas abertas e finalizadas" vazio="Nenhuma comanda disponível.">{comandasAnimal.map(c=><article key={c.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-3"><div><strong>Comanda #{String(c.numero).padStart(5,"0")}</strong><p className="text-xs text-slate-500">{c.origem} · aberta em {dataHora(c.aberta_em)}{c.finalizada_em?` · finalizada em ${dataHora(c.finalizada_em)}`:""}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${c.status==="Aberta"?"bg-amber-100 text-amber-900":"bg-emerald-100 text-emerald-800"}`}>{c.status}</span></div><div className="mt-3 space-y-1">{(c.itens||[]).map(i=><div key={i.id} className="flex justify-between gap-3 text-sm"><span>{i.quantidade}× {i.descricao}</span><strong>{dinheiro(i.quantidade*i.valorUnitario)}</strong></div>)}</div><div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-center"><div><small className="text-slate-500">Total</small><strong className="block">{dinheiro(c.total)}</strong></div><div><small className="text-slate-500">Pago</small><strong className="block">{dinheiro(c.total_pago)}</strong></div><div><small className="text-slate-500">Saldo</small><strong className="block">{dinheiro(c.saldo)}</strong></div></div>{Number(c.saldo)>0&&<div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-sm font-bold">Pagar pelo Portal do Tutor</p><p className="mt-1 text-xs text-slate-600">Você pode quitar o saldo ou informar um adiantamento.</p><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input value={adiantamentos[c.id]||""} onChange={e=>setAdiantamentos(atual=>({...atual,[c.id]:e.target.value}))} inputMode="decimal" placeholder={"Valor livre · saldo "+dinheiro(c.saldo)} className="min-h-10 flex-1 rounded-lg border bg-white px-3 text-sm"/><button disabled={pagando===c.id} onClick={()=>void pagarComanda(c)} className="min-h-10 rounded-lg bg-[#702a43] px-4 text-sm font-bold text-white disabled:opacity-50">{pagando===c.id?"Abrindo...":"Pagar online"}</button></div></div>}</article>)}</Lista>}
            </div>
          )}
        </div>
      </div>
      <RodapeInstitucional linkMarca />
    </main>
  );
}

function TelaCarregando(){return <main className="flex min-h-screen items-center justify-center bg-[#faf7f4]"><Loader2 className="animate-spin"/></main>}
function Campo({rotulo,valor,onChange,type="text",inputMode,placeholder}:{rotulo:string;valor:string;onChange:(v:string)=>void;type?:string;inputMode?:React.HTMLAttributes<HTMLInputElement>["inputMode"];placeholder?:string}){return <label className="text-sm font-bold">{rotulo}<input type={type} value={valor} inputMode={inputMode} placeholder={placeholder} onChange={e=>onChange(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label>}
function Resumo({ titulo, valor, emoji, foto, onClick }: { titulo: string; valor: string; emoji: string; foto?: string | null; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="portal-area-shortcut">
      <span className="portal-area-shortcut-icon" aria-hidden="true">{foto ? <img src={foto} alt="" loading="lazy" /> : emoji}</span>
      <span className="min-w-0"><strong className="block">{titulo}</strong><small className="portal-area-muted">{valor}</small></span>
      <ChevronRight size={17} aria-hidden="true" />
    </button>
  );
}

function DadosDoAto({ dados }: { dados: DadosAplicacao }) {
  const fabricacao = dataDoRotulo(dados.fabricacao || "");
  const validade = dataDoRotulo(dados.validade || "");
  const valores = [
    ["Vacinação contra", dados.alvo_vacinacao], ["Princípio ativo", dados.principio_ativo],
    ["Dose", dados.dose], ["Via", dados.via], ["Fabricante", dados.fabricante],
    ["Fabricação", fabricacao && dataPreventivaBR(fabricacao)], ["Validade", validade && dataPreventivaBR(validade)],
    ["Horário", dados.hora_aplicacao?.slice(0, 5)], ["Local", dados.local_aplicacao],
    ["Veterinário", dados.veterinario_nome && [dados.veterinario_nome, dados.veterinario_crmv && `CRMV-${dados.veterinario_uf || ""} ${dados.veterinario_crmv}`].filter(Boolean).join(" · ")],
  ].filter(([, valor]) => Boolean(valor));
  return valores.length > 0 && <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
    {valores.map(([rotulo, valor]) => <div key={rotulo} className="flex flex-wrap gap-x-1">
      <dt className="font-semibold">{rotulo}</dt><dd>{valor}</dd>
    </div>)}
  </dl>;
}

function ListaMarcacoes({ itens, estado: situacao, agendas, nomeDoPet, onAbrir }: {
  itens: Agendamento[];
  estado: "carregando" | "pronto" | "erro";
  agendas: Agenda[];
  nomeDoPet?: (id: string) => string | undefined;
  onAbrir?: (id: string) => void;
}) {
  const agendasPorId = new Map(agendas.map(item => [item.id, item]));
  return (
    <div className="space-y-2">
      {situacao === "carregando" && <p className="portal-area-muted text-sm" role="status">Carregando agendamentos…</p>}
      {situacao === "erro" && <p className="portal-area-muted text-sm" role="status">Parte dos agendamentos está indisponível no momento.</p>}
      {situacao === "pronto" && itens.length === 0 && <p className="portal-area-muted text-sm">Nenhum agendamento registrado.</p>}
      {itens.map(item => {
        const agenda = item.agenda_id ? agendasPorId.get(item.agenda_id) : undefined;
        const petId = item.animal_id;
        const nome = petId ? nomeDoPet?.(petId) : undefined;
        const conteudo = <>
          <span>
            <strong className="block">{item.tipo}</strong>
            <small className="portal-area-muted">{[nome, dataHora(item.inicio), agenda?.responsavel].filter(Boolean).join(" · ")}</small>
          </span>
          <span className="portal-area-care-status">{estado(item.estado)}</span>
        </>;
        return petId && nome && onAbrir ? (
          <button key={item.id} type="button" className="portal-area-activity portal-area-marcacao"
            onClick={() => onAbrir(petId)}>{conteudo}<ChevronRight size={16} aria-hidden="true" /></button>
        ) : <div key={item.id} className="portal-area-activity portal-area-marcacao">{conteudo}</div>;
      })}
    </div>
  );
}

function Lista({ titulo, vazio, children }: { titulo: string; vazio: string; children: ReactNode }) {
  const tem = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="portal-area-list">
    <h2>{titulo}</h2>
    <div className="mt-3 space-y-2">{tem ? children : <p className="portal-area-muted py-2 text-sm">{vazio}</p>}</div>
  </section>;
}
function BotaoArquivo({id,tipo,baixando,onAbrir,rotulo="Abrir arquivo"}:{id:string;tipo:TipoArquivo;baixando:string|null;onAbrir:(id:string,tipo:TipoArquivo)=>Promise<void>;rotulo?:string}){const chave=`${tipo}:${id}`;return <button disabled={baixando===chave} onClick={()=>void onAbrir(id,tipo)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border px-3 text-xs font-bold text-[#702a43] disabled:opacity-50">{baixando===chave?<Loader2 size={14} className="animate-spin"/>:<Download size={14}/>} {rotulo}</button>}
function Login(props:{
  tema:TemaPortal|null;
  clinica:ClinicaPublica;
  extras:{opcoes?:Record<string,unknown>;promocoes?:Array<{titulo:string;descricao:string;cupom:string;desconto_percentual:number}>};
  portalConfig:{mensagem_boas_vindas?:string;telefone_publico?:string;whatsapp_publico?:string;nome_exibicao?:string;logo_clinica_url?:string;logo_cabecalho_url?:string;titulo_cabecalho?:string;subtitulo_cabecalho?:string};
  modoAtivar:boolean;setModoAtivar:(v:boolean)=>void;
  modoRecuperar:boolean;setModoRecuperar:(v:boolean)=>void;
  usuario:string;setUsuario:(v:string)=>void;senha:string;setSenha:(v:string)=>void;
  token:string;setToken:(v:string)=>void;novaSenha:string;setNovaSenha:(v:string)=>void;repeteSenha:string;setRepeteSenha:(v:string)=>void;
  cpfRecuperacao:string;setCpfRecuperacao:(v:string)=>void;nascimentoRecuperacao:string;setNascimentoRecuperacao:(v:string)=>void;
  desafioRecuperacao:DesafioRecuperacao|null;animalResposta:string;setAnimalResposta:(v:string)=>void;
  senhaRecuperacao:string;setSenhaRecuperacao:(v:string)=>void;repeteSenhaRecuperacao:string;setRepeteSenhaRecuperacao:(v:string)=>void;
  entrar:(e:React.FormEvent)=>void;ativar:(e:React.FormEvent)=>void;iniciarRecuperacao:(e:React.FormEvent)=>void;concluirRecuperacao:(e:React.FormEvent)=>void;voltarRecuperacao:()=>void;
  login:boolean;ativando:boolean;recuperando:boolean;
}){
  const p=props;
  const clinicName=p.portalConfig.nome_exibicao||p.clinica.nome;
  const clinicLogo=p.portalConfig.logo_clinica_url||p.clinica.logo_url||p.portalConfig.logo_cabecalho_url;
  const clinicSite = new URL("/", urlPortalDoTutor(p.clinica.slug)).href;
  const acessoEstendido=p.modoAtivar||p.modoRecuperar;
  return <main data-visual-id="portal-tutor-login" className="portal-tutor-live portal-tutor-login-screen" data-clinic-slug={p.clinica.slug} data-site-template={p.tema?.modelo}
    data-portal-auth-mode={acessoEstendido?"extended":"login"} style={estiloTemaPortal(p.tema)}>
    <div className="portal-login-topbar">
      <a className="portal-login-back-link" href={clinicSite}><ArrowLeft size={17}/> Retornar para o site da clínica</a>
      <span className="portal-login-top-caption"><span className="portal-premium-live-dot"/> ÁREA EXCLUSIVA PARA TUTORES</span>
    </div>
    <div data-visual-id="portal-tutor-login-grid" className="portal-one-screen-grid">
      <div className="portal-one-screen-left">
        <section data-visual-id="portal-tutor-login-brand" className="portal-one-screen-brand" aria-label="Clínica e Portal do Tutor">
          <div className="portal-one-screen-logo-white">
            {clinicLogo
              ? <img src={clinicLogo} alt={`Logo ${clinicName}`} className="portal-one-screen-clinic-logo"/>
              : <strong className="portal-one-screen-fallback">{clinicName}</strong>}
          </div>
          <div className="portal-one-screen-product-name">
            <div className="portal-one-screen-product-signature">
              <h1 className="sr-only">Portal do Tutor</h1>
              <img
                data-visual-id="portal-tutor-login-logo"
                src="/portal-do-tutor-marca-limpa-cortada.png"
                alt="Portal do Tutor — tudo do seu pet em um só lugar, e bem organizado."
                className="portal-one-screen-product-logo"
              />
            </div>
          </div>
        </section>
        <p data-visual-id="portal-tutor-login-welcome" className="portal-one-screen-welcome"><PawPrint size={17}/> {p.portalConfig.mensagem_boas_vindas||"Bem-vindo ao Portal do Tutor!"}</p>
        <section data-visual-id="portal-tutor-login-about" className="portal-one-screen-about" aria-label="O que você encontra aqui">
          <div className="portal-one-screen-about-overline"><HeartPulse size={16}/> CUIDADO EM CADA DETALHE</div>
          <h2>O cuidado com seu pet, <em>sempre por perto.</em></h2>
          <p className="portal-one-screen-description">
            Agende atendimentos, consulte documentos e acompanhe a saúde do seu pet em um único lugar.
          </p>
          <div className="portal-one-screen-features">
            <div><span><CalendarDays size={20}/></span><strong>Agendamentos</strong></div>
            <div><span><FileText size={20}/></span><strong>Documentos</strong></div>
            <div><span><HeartPulse size={20}/></span><strong>Saúde do pet</strong></div>
          </div>
        </section>
      </div>
      <section data-visual-id="portal-tutor-login-panel" className="portal-one-screen-login-panel" aria-label="Acesso ao Portal do Tutor">
        <div data-visual-id="portal-tutor-login-heading" className="portal-one-screen-login-heading">
          <span className="portal-one-screen-auth-mark"><LockKeyhole size={22}/></span>
          <div>
            <span className="portal-one-screen-auth-eyebrow">ACESSO PRIVATIVO</span>
            <h2>{p.modoRecuperar?"Recuperar acesso":p.modoAtivar?"Ativar primeiro acesso":"Acesso do tutor"}</h2>
          </div>
        </div>
        <p data-visual-id="portal-tutor-login-description" className="portal-one-screen-login-lead">Suas informações e os cuidados com seu pet, em segurança.</p>
        <div className="portal-one-screen-form">
        {p.modoRecuperar ? (
          <><p className="text-sm text-slate-500">Confirme seus dados e reconheça um pet vinculado a esta clínica.</p>
          {!p.desafioRecuperacao ? (
            <form onSubmit={p.iniciarRecuperacao} className="mt-5 space-y-4">
              <Campo rotulo="Usuário do portal (@)" valor={p.usuario} onChange={p.setUsuario} placeholder="@tut.seunome"/>
              <Campo rotulo="CPF" valor={p.cpfRecuperacao} onChange={p.setCpfRecuperacao} inputMode="numeric" placeholder="Somente números"/>
              <Campo rotulo="Data de nascimento" valor={p.nascimentoRecuperacao} onChange={p.setNascimentoRecuperacao} type="date"/>
              <button disabled={p.recuperando} className="w-full rounded-xl bg-[#702a43] py-3 font-bold text-white disabled:opacity-50">{p.recuperando?"Validando...":"Continuar"}</button>
            </form>
          ) : (
            <form onSubmit={p.concluirRecuperacao} className="mt-5 space-y-4">
              <fieldset><legend className="text-sm font-bold">{p.desafioRecuperacao.pergunta}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{p.desafioRecuperacao.alternativas.map((alternativa)=><button key={alternativa.id} type="button" onClick={()=>p.setAnimalResposta(alternativa.id)} className={"rounded-xl border px-4 py-3 text-left font-bold transition "+(p.animalResposta===alternativa.id?"border-[#702a43] bg-slate-100 ring-2 ring-[#303842]/20":"bg-white hover:border-slate-400")}>{alternativa.nome}</button>)}</div></fieldset>
              <Campo rotulo="Nova senha" valor={p.senhaRecuperacao} onChange={p.setSenhaRecuperacao} type="password"/>
              <p className="text-xs text-muted-foreground">{orientacaoSenhaPortal}</p>
              <Campo rotulo="Repita a nova senha" valor={p.repeteSenhaRecuperacao} onChange={p.setRepeteSenhaRecuperacao} type="password"/>
              <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Por segurança, nenhuma senha antiga é exibida ou recuperada.</p>
              <button disabled={p.recuperando||!p.animalResposta} className="w-full rounded-xl bg-[#702a43] py-3 font-bold text-white disabled:opacity-50">{p.recuperando?"Redefinindo...":"Salvar nova senha"}</button>
            </form>
          )}
          <button onClick={p.voltarRecuperacao} className="mt-4 w-full text-sm font-bold text-[#702a43]">Voltar para o acesso</button></>
        ) : p.modoAtivar ? (
          <><form onSubmit={p.ativar} className="mt-5 space-y-4"><Campo rotulo="Usuário" valor={p.usuario} onChange={p.setUsuario}/><Campo rotulo="Código de ativação" valor={p.token} onChange={p.setToken} placeholder="Ex.: SD45"/><Campo rotulo="Crie sua senha" valor={p.novaSenha} onChange={p.setNovaSenha} type="password"/><p className="text-xs text-muted-foreground">{orientacaoSenhaPortal}</p><Campo rotulo="Repita a senha" valor={p.repeteSenha} onChange={p.setRepeteSenha} type="password"/><button disabled={p.ativando} className="w-full rounded-xl bg-[#702a43] py-3 font-bold text-white disabled:opacity-50">{p.ativando?"Ativando...":"Ativar acesso"}</button></form><button onClick={()=>p.setModoAtivar(false)} className="mt-4 w-full text-sm font-bold text-[#702a43]">Já tenho acesso</button></>
        ) : (
          <><form onSubmit={p.entrar} className="mt-5 space-y-4"><Campo rotulo="Usuário" valor={p.usuario} onChange={p.setUsuario}/><Campo rotulo="Senha" valor={p.senha} onChange={p.setSenha} type="password"/><button data-visual-id="portal-tutor-login-submit" disabled={p.login} className="portal-one-screen-submit mt-[11px] w-full rounded-xl bg-[#702a43] py-3 font-bold text-white disabled:opacity-50">{p.login?"Entrando...":"Entrar"}</button></form><div className="mt-4 grid gap-2 sm:grid-cols-2"><button onClick={()=>p.setModoAtivar(true)} className="text-sm font-bold text-[#702a43]">Ativar primeiro acesso</button><button onClick={()=>p.setModoRecuperar(true)} className="text-sm font-bold text-[#702a43]">Esqueci minha senha</button></div></>
        )}
        </div>
        <p data-visual-id="portal-tutor-login-safety" className="portal-one-screen-safety"><ShieldCheck size={15}/> Acesso individual e informações protegidas.</p>
      </section>
    </div>
  </main>;
}

/**
 * Prévia segura do login padrão para o Canva administrativo.
 * Utiliza o mesmo componente e CSS do Portal real, sem tocar em contas,
 * autenticação, tutores ou dados de clínicas.
 */
export function PortalTutorLoginPreview() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [modoAtivar, setModoAtivar] = useState(false);
  const [modoRecuperar, setModoRecuperar] = useState(false);
  const [token, setToken] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [repeteSenha, setRepeteSenha] = useState("");
  const [cpfRecuperacao, setCpfRecuperacao] = useState("");
  const [nascimentoRecuperacao, setNascimentoRecuperacao] = useState("");
  const [animalResposta, setAnimalResposta] = useState("");
  const [senhaRecuperacao, setSenhaRecuperacao] = useState("");
  const [repeteSenhaRecuperacao, setRepeteSenhaRecuperacao] = useState("");
  const somentePrevia = (event: React.FormEvent) => {
    event.preventDefault();
    toast.info("Esta é a prévia visual. O acesso real é feito no site da clínica.");
  };
  return <Login
    tema={null}
    clinica={{ nome:"Clínica de demonstração", slug:"alvorada", logo_url:null }}
    extras={{}}
    portalConfig={{ nome_exibicao:"Clínica de demonstração", mensagem_boas_vindas:"Bem-vindo ao Portal do Tutor!" }}
    modoAtivar={modoAtivar} setModoAtivar={setModoAtivar}
    modoRecuperar={modoRecuperar} setModoRecuperar={setModoRecuperar}
    usuario={usuario} setUsuario={setUsuario} senha={senha} setSenha={setSenha}
    token={token} setToken={setToken} novaSenha={novaSenha} setNovaSenha={setNovaSenha} repeteSenha={repeteSenha} setRepeteSenha={setRepeteSenha}
    cpfRecuperacao={cpfRecuperacao} setCpfRecuperacao={setCpfRecuperacao}
    nascimentoRecuperacao={nascimentoRecuperacao} setNascimentoRecuperacao={setNascimentoRecuperacao}
    desafioRecuperacao={null} animalResposta={animalResposta} setAnimalResposta={setAnimalResposta}
    senhaRecuperacao={senhaRecuperacao} setSenhaRecuperacao={setSenhaRecuperacao}
    repeteSenhaRecuperacao={repeteSenhaRecuperacao} setRepeteSenhaRecuperacao={setRepeteSenhaRecuperacao}
    entrar={somentePrevia} ativar={somentePrevia}
    iniciarRecuperacao={somentePrevia} concluirRecuperacao={somentePrevia}
    voltarRecuperacao={() => setModoRecuperar(false)}
    login={false} ativando={false} recuperando={false}
  />;
}
