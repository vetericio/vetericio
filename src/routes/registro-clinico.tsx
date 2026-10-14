import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, ClipboardPlus, FileText, FlaskConical, PawPrint, Plus, Save, Scissors, ShoppingCart, Stethoscope, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { codigoPublicoTutor } from "@/lib/codigo-tutor";
import {
  COMANDAS_KEY,
  LANCAMENTOS_FINANCEIROS_KEY,
  type Comanda,
  type ItemComanda as ItemComandaPersistida,
  dataLocalISO,
  lerComandas,
  parseValorMonetario,
  proximoNumeroComanda,
  registrarLancamentoComanda,
  salvarComandas,
} from "@/lib/comandas";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/registro-clinico")({ component: RegistroClinico });

type Animal = { id: string; tutorId: string; nome: string; especie?: string; raca?: string; sexo?: string; peso?: string };
type Tutor = { id: string; nome: string; telefone?: string; outroTelefone?: string; codigoPublico?: string; codigo_publico?: string; codigo?: string };
type RegistroProntuario = { id: string; animalId: string; tipo: "Registros clínicos"; titulo: string; detalhe?: string; data: string; criadoEm: string; subtipo?: "Consulta" | "Cirurgia / Procedimentos"; dados?: unknown };
type SimNao = "" | "Sim" | "Não";
type OlhoValores = { od: string; oe: string };
type OftalmoForm = { schirmer: OlhoValores; fluoresceina: OlhoValores; jones: OlhoValores; rosaBengala: OlhoValores; lissaminaVerde: OlhoValores; pio: OlhoValores; equipamentoTonometria: string; reflexoPupilarDireto: OlhoValores; reflexoPupilarConsensual: OlhoValores; deambulacao: OlhoValores };
type ConsultaForm = {
  acessoRua: SimNao; contatoAnimais: SimNao; ambiente: string; moradia: string; ventilacao: string; apetite: string; exposicoes: string[]; vacinacao: string; vermifugacao: string; dieta: string; doencasPrevias: string; medicamentosRecentes: string; alergias: string; queixa: string;
  sistemas: Record<string, { sinais: string[]; observacoes: string }>;
  oftalmo: OftalmoForm;
  peso: string; temperatura: string; fc: string; fr: string; pas: string; glicemia: string; mucosas: string; hidratacao: string; dor: string; exameGeral: string; suspeitas: string; examesSolicitados: string; medicacoes: string; conduta: string; retorno: string;
};
type ProcedimentoForm = { tipo: string; indicacao: string; equipe: string; anestesia: string; achados: string; materiais: string; intercorrencias: string; posOperatorio: string; observacoes: string };
type ItemCatalogo = { id: string; tipo: "servico" | "produto"; nome: string; preco: number | string; categoria?: string | null };
type ItemComanda = { id: string; catalogoId?: string; nome: string; tipo: "servico" | "produto" | "exame"; quantidade: number; valorUnitario: string; automatico?: boolean; precoConfigurado: boolean };
type StatusPagamento = "Pago" | "Pendente";
type FormaPagamento = "Pix" | "Dinheiro" | "Cartão de débito" | "Cartão de crédito" | "App" | "Plano de saúde" | "Outros";

const ANIMAIS_KEY = "oricse-animais-v1";
const TUTORES_KEY = "oricse-tutores-v1";
const PRONTUARIO_KEY = "oricse-prontuario-animal-v1";
const PESOS_KEY = "oricse-pesos-animal-v1";
const LANCAMENTOS_KEY = LANCAMENTOS_FINANCEIROS_KEY;

const NORMAIS_ESPECIE = {
  cão: { temperatura: "37,5–39,2 °C", fc: "60–160 bpm", fr: "10–30 mpm", pas: "100–160 mmHg", glicemia: "70–120 mg/dL" },
  gato: { temperatura: "38,0–39,2 °C", fc: "140–220 bpm", fr: "20–40 mpm", pas: "100–160 mmHg", glicemia: "70–150 mg/dL" },
};
function idadeAnimal(nascimento?: string) {
  if (!nascimento) return "";
  const n = new Date(`${nascimento.slice(0,10)}T12:00:00`);
  if (Number.isNaN(n.getTime())) return "";
  const h = new Date();
  let anos = h.getFullYear() - n.getFullYear();
  let meses = h.getMonth() - n.getMonth();
  if (h.getDate() < n.getDate()) meses--;
  if (meses < 0) { anos--; meses += 12; }
  if (anos <= 0) return `${Math.max(0, meses)} meses`;
  return meses ? `${anos}a ${meses}m` : `${anos} anos`;
}
function normaisPara(especie?: string) { return /gato|fel/i.test(especie || "") ? NORMAIS_ESPECIE.gato : NORMAIS_ESPECIE.cão; }

const COMUM = ["Sem alterações aparentes", "Não avaliado"];
const SINAIS_FEMEA = new Set(["Edema vulvar", "Secreção vaginal", "Cio irregular", "Pseudociese"]);
const SINAIS_MACHO = new Set(["Aumento de volume testicular", "Secreção prepucial", "Criptorquidismo"]);

const SISTEMAS: Record<string, string[]> = {
  Digestivo: ["Anorexia", "Hiporexia", "Apetite caprichoso", "Polifagia", "Êmese", "Regurgitação", "Diarreia", "Melena", "Hematoquezia", "Muco nas fezes", "Tenesmo", "Constipação", "Obstipação", "Disfagia", "Odinofagia", "Halitose", "Sialorreia", "Distensão abdominal", "Dor abdominal", "Prolapso retal", "Borborigmos", "Perda de peso", ...COMUM],
  Geniturinário: ["Hematúria", "Disúria", "Estrangúria", "Polaciúria", "Poliúria", "Oligúria", "Anúria", "Noctúria", "Incontinência urinária", "Gotejamento urinário", "Retenção urinária", "Urina turva/odor forte", "Dor lombar", "Secreção genital", "Aumento de volume testicular", "Secreção prepucial", "Criptorquidismo", "Edema vulvar", "Secreção vaginal", "Cio irregular", "Pseudociese", ...COMUM],
  Locomotor: ["Claudicação", "Dor", "Rigidez", "Relutância à manipulação", "Crepitação", "Edema articular", "Atrofia muscular", "Deformidade", "Instabilidade articular", "Dor à palpação de coluna", "Dificuldade para levantar", "Dificuldade para saltar", "Dificuldade para vencer obstáculos", "Paresia", "Paralisia", "Alteração proprioceptiva", "Unha quebrada", ...COMUM],
  Tegumentar: ["Prurido", "Alopecia", "Lesões de pele", "Eritema", "Descamação", "Ferida", "Nódulo", "Secreção", "Crostas", "Pústulas", "Pápulas", "Comedões", "Hiperqueratose", "Hiperpigmentação", "Liquenificação", "Ectoparasitas", "Mau odor", "Massa cutânea", "Alteração de cicatriz", "Desidratação", ...COMUM],
  Oftalmológico: ["Secreção ocular", "Secreção mucopurulenta", "Blefaroespasmo", "Epífora", "Hiperemia", "Opacidade", "Dor ocular", "Alteração visual", "Anisocoria", "Miose", "Midríase", "Protrusão de terceira pálpebra", "Quemose", "Edema corneano", "Úlcera corneana", "Uveíte", "Exoftalmia", "Enoftalmia", "Fotofobia", ...COMUM],
  Respiratório: ["Tosse", "Espirros", "Secreção nasal", "Dispneia", "Taquipneia", "Ruído respiratório", "Ortopneia", "Respiração abdominal", "Respiração de boca aberta", "Estridor", "Sibilo", "Estertor", "Epistaxe", "Apneia", "Cianose", "Colapso de traqueia", "Intolerância ao exercício", ...COMUM],
  Neurológico: ["Convulsão", "Head tilt", "Andar em círculos", "Ataxia", "Tremor", "Nistagmo", "Alteração de consciência", "Alteração de comportamento", "Déficit proprioceptivo", "Déficit de nervos cranianos", "Alterações pupilares", "Dor cervical", "Dor toracolombar", "Queda", "Paresia", "Tetraparesia", "Paraplegia", "Incontinência neurológica", ...COMUM],
  Cardiovascular: ["Síncope", "Cansaço", "Intolerância ao exercício", "Cianose", "Edema", "Tosse associada ao esforço", "Sopro", "Arritmia", "Pulso fraco", "Pulso irregular", "Distensão jugular", "Ascite", "Efusão pleural", "Taquicardia", "Bradicardia", "Extremidades frias", "TPC aumentado", ...COMUM],
  "Endócrino / metabólico": ["Poliúria", "Polidipsia", "Polifagia", "Perda de peso", "Ganho de peso", "Fraqueza", "Letargia", "Intolerância ao calor", "Intolerância ao frio", "Hiperglicemia", "Hipoglicemia", "Aumento abdominal", "Obesidade", "Perda de massa muscular", "Alteração de pelagem", "Alteração de pigmentação", ...COMUM],
  Hematológico: ["Palidez", "Petéquias", "Equimoses", "Sangramento", "Sangramento gengival", "Epistaxe", "Hemoglobinúria", "Fraqueza", "Icterícia", "Linfonodomegalia", "Esplenomegalia", "Febre recorrente", ...COMUM],
  Otológico: ["Otalgia", "Prurido auricular", "Head shaking", "Cerúmen excessivo", "Secreção", "Mau odor", "Eritema", "Edema de conduto", "Inclinação de cabeça", "Surdez", ...COMUM],
  "Odontológico / oral": ["Cálculo dental", "Gengivite", "Periodontite", "Fratura dentária", "Mobilidade dentária", "Lesão oral", "Massa oral", "Halitose", "Sialorreia", "Dor oral", "Dificuldade de apreensão", ...COMUM],
  Outros: [],
};

const EXAMES_OPCOES = [
  "Hemograma completo", "Bioquímica sérica", "Urina tipo 1", "Urocultura", "Ultrassonografia abdominal", "Radiografia", "Ecocardiograma", "Eletrocardiograma", "Pressão arterial", "Teste rápido", "Citologia", "Histopatológico", "Coprológico", "Dosagem hormonal", "Hemogasometria", "Coagulograma", "Sorologia", "PCR",
];

const ETAPAS = [
  { n: 1, titulo: "Tutor / rotina", subtitulo: "Histórico e ambiente" },
  { n: 2, titulo: "Queixa principal", subtitulo: "Motivo da consulta" },
  { n: 3, titulo: "Por sistema", subtitulo: "Sinais e observações" },
  { n: 4, titulo: "Exame clínico", subtitulo: "Parâmetros e avaliação" },
  { n: 5, titulo: "Conduta", subtitulo: "Hipóteses e orientações" },
  { n: 6, titulo: "Receita e exames", subtitulo: "Prescrição e solicitações" },
  { n: 7, titulo: "Lançamento da comanda", subtitulo: "Itens e valores a cobrar" },
] as const;

const vazioOlho = (): OlhoValores => ({ od: "", oe: "" });
function oftalmoVazio(): OftalmoForm { return { schirmer:vazioOlho(), fluoresceina:vazioOlho(), jones:vazioOlho(), rosaBengala:vazioOlho(), lissaminaVerde:vazioOlho(), pio:vazioOlho(), equipamentoTonometria:"", reflexoPupilarDireto:vazioOlho(), reflexoPupilarConsensual:vazioOlho(), deambulacao:vazioOlho() }; }
function ler<T>(chave:string):T[]{ if(typeof window==="undefined")return[]; try{const v=JSON.parse(localStorage.getItem(chave)||"[]"); return Array.isArray(v)?v:[]}catch{return[]} }
function normalizar(v?:string){ return (v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim(); }
function sinalPermitidoParaSexo(sinal: string, sexo?: string) {
  const sexoNormalizado = normalizar(sexo);
  if (/macho|masculino/.test(sexoNormalizado)) return !SINAIS_FEMEA.has(sinal);
  if (/femea|femin/.test(sexoNormalizado)) return !SINAIS_MACHO.has(sinal);
  return true;
}
function hoje(){ return dataLocalISO(); }
function pesoValido(valor: string) {
  const numero = Number(String(valor).trim().replace(",", "."));
  return Number.isFinite(numero) && numero > 0 ? numero.toFixed(3) : "";
}
function numeroMoeda(valor: string) { const numero=parseValorMonetario(valor); return valor.trim()!==""&&Number.isFinite(numero)&&numero>=0?numero:null; }
function moeda(valor: number) { return valor.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function valorCampo(valor: number | string | null | undefined) { const numero=Number(valor); return Number.isFinite(numero)?numero.toFixed(2).replace(".",","):""; }

function formConsultaVazio():ConsultaForm { return { acessoRua:"", contatoAnimais:"", ambiente:"", moradia:"", ventilacao:"", apetite:"", exposicoes:[], vacinacao:"", vermifugacao:"", dieta:"", doencasPrevias:"", medicamentosRecentes:"", alergias:"", queixa:"", sistemas:Object.fromEntries(Object.keys(SISTEMAS).map(s=>[s,{sinais:[],observacoes:""}])), oftalmo:oftalmoVazio(), peso:"", temperatura:"", fc:"", fr:"", pas:"", glicemia:"", mucosas:"", hidratacao:"", dor:"", exameGeral:"", suspeitas:"", examesSolicitados:"", medicacoes:"", conduta:"", retorno:"" }; }

function RegistroClinico(){
  const navigate=useNavigate();
  const params=new URLSearchParams(typeof window!=="undefined"?window.location.search:"");
  const animalId=params.get("animalId")||"";
  const animais=useMemo(()=>ler<Animal>(ANIMAIS_KEY),[]);
  const tutores=useMemo(()=>ler<Tutor>(TUTORES_KEY),[]);
  const animal=animais.find(a=>a.id===animalId);
  const tutor=tutores.find(t=>t.id===animal?.tutorId);
  const [modo,setModo]=useState<""|"consulta"|"procedimento">(()=>{ const tipo=params.get("tipo"); return tipo==="consulta"||tipo==="procedimento"?tipo:""; });
  const [etapa,setEtapa]=useState(1);
  const [consulta,setConsulta]=useState<ConsultaForm>(()=>({...formConsultaVazio(),peso:animal?.peso||""}));
  const [procedimento,setProcedimento]=useState<ProcedimentoForm>({tipo:"",indicacao:"",equipe:"",anestesia:"",achados:"",materiais:"",intercorrencias:"",posOperatorio:"",observacoes:""});
  const [aberto,setAberto]=useState<string|null>(null);
  const [data,setData]=useState(hoje());
  const [catalogo,setCatalogo]=useState<ItemCatalogo[]>([]);
  const [catalogoCarregando,setCatalogoCarregando]=useState(true);
  const [catalogoAviso,setCatalogoAviso]=useState("");
  const [itemCatalogoId,setItemCatalogoId]=useState("");
  const [itensComanda,setItensComanda]=useState<ItemComanda[]>([]);
  const [pagamentoAberto,setPagamentoAberto]=useState(false);
  const [formaPagamento,setFormaPagamento]=useState<FormaPagamento|"">("");
  const [outroPagamento,setOutroPagamento]=useState("");
  const [responsavel,setResponsavel]=useState({id:"",nome:"Equipe clínica"});
  const chaveRascunho=`oricse-rascunho-consulta-${animalId}`;

  useEffect(()=>{let ativo=true; async function carregarResponsavel(){try{const {data,error}=await supabase.auth.getUser();if(error)throw error;if(!data.user)throw new Error("Sessão não encontrada.");const {data:perfil,error:erroPerfil}=await supabase.from("app_users").select("username,email").eq("user_id",data.user.id).maybeSingle();if(erroPerfil)throw erroPerfil;if(ativo)setResponsavel({id:data.user.id,nome:perfil?.username?`@${perfil.username}`:perfil?.email||data.user.email||data.user.id});}catch(error){console.error("Não foi possível identificar o responsável pelo atendimento:",error);}}void carregarResponsavel();return()=>{ativo=false};},[]);
  useEffect(()=>{ if(!animalId)return; try{const salvo=localStorage.getItem(chaveRascunho); if(salvo){const bruto=JSON.parse(salvo); setConsulta({...formConsultaVazio(),...bruto,peso:animal?.peso||bruto.peso||"",oftalmo:{...oftalmoVazio(),...(bruto.oftalmo||{})}})}}catch{} },[animalId]);
  useEffect(()=>{ if(!animalId||modo!=="consulta")return; const t=window.setTimeout(()=>localStorage.setItem(chaveRascunho,JSON.stringify(consulta)),250); return()=>window.clearTimeout(t); },[consulta,modo,animalId]);
  useEffect(()=>{ let ativo=true; async function carregarCatalogo(){ try{ const {data:auth}=await supabase.auth.getUser(); const userId=auth.user?.id; if(!userId)throw new Error("Sessão não encontrada."); const [{data:usuario},{data:vinculo}]=await Promise.all([(supabase as any).from("app_users").select("role").eq("user_id",userId).maybeSingle(),(supabase as any).from("clinica_usuarios").select("clinica_id").eq("user_id",userId).eq("ativo",true).limit(1).maybeSingle()]); let clinicaId=vinculo?.clinica_id||""; if(!clinicaId&&usuario?.role==="admin"){ const {data:clinicas,error}=await (supabase as any).from("clinicas").select("id").eq("status","ativa").order("nome").limit(1); if(error)throw error; clinicaId=clinicas?.[0]?.id||""; } if(!clinicaId)throw new Error("Nenhuma clínica vinculada ao atendimento."); const {data:itens,error}=await (supabase as any).from("clinica_catalogo_itens").select("id,tipo,nome,preco,categoria").eq("clinica_id",clinicaId).eq("ativo",true).order("nome"); if(error)throw error; if(ativo){setCatalogo(itens||[]);setCatalogoAviso("");} }catch(error){if(ativo)setCatalogoAviso((error as Error).message||"Não foi possível carregar serviços e produtos.");}finally{if(ativo)setCatalogoCarregando(false);} } void carregarCatalogo(); return()=>{ativo=false}; },[]);
  useEffect(()=>{ if(etapa!==7||modo!=="consulta")return; const exames=consulta.examesSolicitados.split(" · ").map(nome=>nome.trim()).filter(Boolean); const automaticos=["Consulta",...exames]; setItensComanda(atuais=>{ const idsNovos=new Set(automaticos.map(nome=>`automatico-${normalizar(nome)}`)); const manuais=atuais.filter(item=>!item.automatico); const atualizados=automaticos.map(nome=>{ const id=`automatico-${normalizar(nome)}`; const existente=atuais.find(item=>item.id===id); const nomeNormalizado=normalizar(nome); const itemCatalogo=catalogo.find(item=>normalizar(item.nome)===nomeNormalizado)||(nome==="Consulta"?catalogo.find(item=>/^consulta( clinica| veterinaria)?$/.test(normalizar(item.nome))):undefined); return { id, catalogoId:itemCatalogo?.id||existente?.catalogoId, nome:itemCatalogo?.nome||nome, tipo:nome==="Consulta"?"servico":"exame", quantidade:existente?.quantidade||1, valorUnitario:existente?.valorUnitario||(itemCatalogo?valorCampo(itemCatalogo.preco):""), automatico:true, precoConfigurado:Boolean(itemCatalogo)||Boolean(existente?.precoConfigurado) } as ItemComanda; }); return [...atualizados,...manuais.filter(item=>!idsNovos.has(item.id))]; }); },[etapa,modo,consulta.examesSolicitados,catalogo]);


  if(!animal)return <main className="mx-auto max-w-4xl px-4 py-8"><Link to="/animais" className="text-sm text-muted-foreground">← Voltar</Link><div className="mt-5 rounded-2xl border p-6">Animal não encontrado.</div></main>;

  const toggleExposicao=(nome:string)=>setConsulta(f=>({...f,exposicoes:f.exposicoes.includes(nome)?f.exposicoes.filter(x=>x!==nome):[...f.exposicoes,nome]}));
  const toggleSinal=(sistema:string,sinal:string)=>setConsulta(f=>({...f,sistemas:{...f.sistemas,[sistema]:{...f.sistemas[sistema],sinais:f.sistemas[sistema].sinais.includes(sinal)?f.sistemas[sistema].sinais.filter(x=>x!==sinal):[...f.sistemas[sistema].sinais,sinal]}}}));
  const setOftalmoPar=(chave:keyof Omit<OftalmoForm,"equipamentoTonometria">,olho:keyof OlhoValores,valor:string)=>setConsulta(f=>({...f,oftalmo:{...f.oftalmo,[chave]:{...f.oftalmo[chave],[olho]:valor}}}));
  const examesSelecionados=consulta.examesSolicitados.split(" · ").map(x=>x.trim()).filter(Boolean);
  const toggleExame=(nome:string)=>setConsulta(f=>{const atuais=f.examesSolicitados.split(" · ").map(x=>x.trim()).filter(Boolean); const novos=atuais.includes(nome)?atuais.filter(x=>x!==nome):[...atuais,nome]; return {...f,examesSolicitados:novos.join(" · ")}});
  const totalComanda=itensComanda.reduce((total,item)=>total+(numeroMoeda(item.valorUnitario)||0)*item.quantidade,0);
  const itensSemPreco=itensComanda.filter(item=>numeroMoeda(item.valorUnitario)===null);
  function adicionarItemCatalogo(){ const item=catalogo.find(cadastrado=>cadastrado.id===itemCatalogoId); if(!item)return; setItensComanda(atuais=>{ const existente=atuais.find(linha=>linha.catalogoId===item.id); return existente?atuais.map(linha=>linha.id===existente.id?{...linha,quantidade:linha.quantidade+1}:linha):[...atuais,{id:crypto.randomUUID(),catalogoId:item.id,nome:item.nome,tipo:item.tipo,quantidade:1,valorUnitario:valorCampo(item.preco),precoConfigurado:true}]; }); setItemCatalogoId(""); }
  function atualizarItemComanda(id:string,campo:"quantidade"|"valorUnitario",valor:string){ setItensComanda(atuais=>atuais.map(item=>item.id===id?{...item,[campo]:campo==="quantidade"?Math.max(1,Math.floor(Number(valor)||1)):valor}:item)); }
  function removerItemComanda(id:string){ setItensComanda(atuais=>atuais.filter(item=>item.id!==id)); }

  function etapaPreenchida(n:number){
    if(n===1)return Boolean(consulta.acessoRua||consulta.contatoAnimais||consulta.ambiente||consulta.moradia||consulta.ventilacao||consulta.apetite||consulta.exposicoes.length||consulta.vacinacao||consulta.vermifugacao||consulta.dieta||consulta.doencasPrevias||consulta.medicamentosRecentes||consulta.alergias);
    if(n===2)return Boolean(consulta.queixa.trim());
    if(n===3)return Object.values(consulta.sistemas).some(x=>x.sinais.length||x.observacoes.trim())||Object.values(consulta.oftalmo).some(v=>typeof v==="string"?v.trim():Object.values(v).some(x=>x.trim()));
    if(n===4)return Boolean(consulta.peso||consulta.temperatura||consulta.fc||consulta.fr||consulta.pas||consulta.glicemia||consulta.mucosas||consulta.hidratacao||consulta.dor||consulta.exameGeral);
    if(n===5)return Boolean(consulta.suspeitas||consulta.conduta||consulta.retorno);
    if(n===6)return Boolean(consulta.examesSolicitados||consulta.medicacoes);
    return itensComanda.length>0&&itensSemPreco.length===0;
  }

  function abrirPagamento(){ if(!consulta.queixa.trim())return void toast.error("Informe a queixa principal."); if(!itensComanda.length)return void toast.error("Adicione pelo menos um item à comanda."); if(itensSemPreco.length)return void toast.error("Preencha o valor de todos os itens da comanda."); salvarConsulta("Pendente","A definir"); }
  function confirmarPagamento(){ if(!formaPagamento)return void toast.error("Selecione como foi pago."); if(formaPagamento==="Outros"&&!outroPagamento.trim())return void toast.error("Especifique a forma de pagamento."); salvarConsulta("Pago",formaPagamento==="Outros"?outroPagamento.trim():formaPagamento); }

  function salvarConsulta(statusPagamento:StatusPagamento="Pendente",pagamento="A definir"){
    if(!consulta.queixa.trim())return void toast.error("Informe a queixa principal.");
    if(!itensComanda.length)return void toast.error("Adicione pelo menos um item à comanda.");
    if(itensSemPreco.length)return void toast.error("Preencha o valor de todos os itens da comanda.");
    const pesoConsulta = consulta.peso.trim() ? pesoValido(consulta.peso) : "";
    if (consulta.peso.trim() && !pesoConsulta) return void toast.error("Informe um peso válido em kg.");
    const consultaSalva = { ...consulta, peso: pesoConsulta || animal.peso || "" };
    const o=consulta.oftalmo;
    const linhaPar=(rotulo:string,p:OlhoValores,unidade="")=>(p.od||p.oe)?`${rotulo}: ${[p.od&&`OD ${p.od}${unidade}`,p.oe&&`OE ${p.oe}${unidade}`].filter(Boolean).join(" · ")}`:"";
    const oft=[linhaPar("Schirmer",o.schirmer," mm/min"),linhaPar("Fluoresceína",o.fluoresceina),linhaPar("Teste de Jones",o.jones),linhaPar("Rosa Bengala",o.rosaBengala),linhaPar("Lissamina Verde",o.lissaminaVerde),linhaPar("PIO",o.pio," mmHg"),o.equipamentoTonometria&&`Equipamento de tonometria: ${o.equipamentoTonometria}`,linhaPar("Reflexo pupilar direto",o.reflexoPupilarDireto),linhaPar("Reflexo pupilar consensual",o.reflexoPupilarConsensual),linhaPar("Deambulação",o.deambulacao)].filter(Boolean) as string[];
    const sistemas=Object.entries(consulta.sistemas).map(([s,v])=>{const p=[v.sinais.join(", "),v.observacoes].filter(Boolean); if(s==="Oftalmológico"&&oft.length)p.push(oft.join(" · ")); return [s,p.join(". ")] as const}).filter(([,t])=>t.trim());
    const detalhe=[
      `Queixa principal: ${consulta.queixa.trim()}`,
      `Tutor relata: ${[consulta.acessoRua&&`acesso à rua: ${consulta.acessoRua}`,consulta.contatoAnimais&&`contato com outros animais: ${consulta.contatoAnimais}`,consulta.ambiente&&`ambiente: ${consulta.ambiente}`,consulta.moradia&&`moradia: ${consulta.moradia}`,consulta.ventilacao&&`ventilação: ${consulta.ventilacao}`,consulta.apetite&&`apetite: ${consulta.apetite}`,consulta.exposicoes.length&&`exposição: ${consulta.exposicoes.join(", ")}`,consulta.vacinacao&&`vacinação: ${consulta.vacinacao}`,consulta.vermifugacao&&`vermifugação: ${consulta.vermifugacao}`,consulta.dieta&&`dieta: ${consulta.dieta}`,consulta.doencasPrevias&&`doenças prévias: ${consulta.doencasPrevias}`,consulta.medicamentosRecentes&&`medicamentos: ${consulta.medicamentosRecentes}`,consulta.alergias&&`alergias: ${consulta.alergias}`].filter(Boolean).join(" · ")||"sem informações adicionais"}`,
      ...(sistemas.length?["Observações por sistema:",...sistemas.map(([s,v])=>`- ${s}: ${v}`)]:[]),
      `Exame clínico: ${[consultaSalva.peso&&`peso ${consultaSalva.peso} kg`,consulta.temperatura&&`T ${consulta.temperatura} °C`,consulta.fc&&`FC ${consulta.fc}`,consulta.fr&&`FR ${consulta.fr}`,consulta.pas&&`PAS ${consulta.pas}`,consulta.glicemia&&`glicemia ${consulta.glicemia}`,consulta.mucosas&&`mucosas ${consulta.mucosas}`,consulta.hidratacao&&`hidratação ${consulta.hidratacao}`,consulta.dor&&`dor ${consulta.dor}`,consulta.exameGeral].filter(Boolean).join(" · ")||"não informado"}`,
      consulta.suspeitas&&`Hipóteses / suspeitas: ${consulta.suspeitas}`,
      consulta.conduta&&`Conduta / orientações: ${consulta.conduta}`,
      consulta.retorno&&`Retorno: ${consulta.retorno}`,
      consulta.medicacoes&&`Medicações / receita: ${consulta.medicacoes}`,
      consulta.examesSolicitados&&`Exames solicitados: ${consulta.examesSolicitados}`,
    ].filter(Boolean).join("\n");
    if (!responsavel.id) {
      return void toast.error(
        "Não foi possível identificar o usuário responsável. Atualize a página ou entre novamente.",
      );
    }
    const valorTotalComanda = Math.round((totalComanda + Number.EPSILON) * 100) / 100;
    const comandasAnteriores = lerComandas();
    const criadaEm = new Date().toISOString();
    const itensPersistidos: ItemComandaPersistida[] = itensComanda.map((item) => ({
      id: item.id,
      descricao: item.nome,
      quantidade: item.quantidade,
      valorUnitario:
        Math.round(((numeroMoeda(item.valorUnitario) || 0) + Number.EPSILON) * 100) / 100,
      criadoEm: criadaEm,
      criadoPor: responsavel.nome,
      tipo: item.tipo === "exame" ? "avulso" : item.tipo,
    }));
    const pagamentoInicial =
      statusPagamento === "Pago" && valorTotalComanda > 0
        ? {
            id: crypto.randomUUID(),
            valor: valorTotalComanda,
            formaPagamento: pagamento,
            data: criadaEm,
            registradoPor: responsavel.nome,
          }
        : null;
    const novaComanda: Comanda = {
      id: crypto.randomUUID(),
      numero: proximoNumeroComanda(comandasAnteriores),
      status: "Aberta",
      origem: "Consultório",
      tutorId: tutor?.id || animal.tutorId,
      tutorNome: tutor?.nome || "Tutor não informado",
      animalId: animal.id,
      animalNome: animal.nome,
      abertaEm: criadaEm,
      abertaPor: responsavel.nome,
      abertaPorId: responsavel.id,
      itens: itensPersistidos,
      pagamentos: pagamentoInicial ? [pagamentoInicial] : [],
    };
    const comandasArmazenadas = localStorage.getItem(COMANDAS_KEY);
    const lancamentosArmazenados = localStorage.getItem(LANCAMENTOS_KEY);
    try {
      salvarComandas([novaComanda, ...comandasAnteriores]);
      if (pagamentoInicial) {
        registrarLancamentoComanda({
          id: `comanda-pagamento-${pagamentoInicial.id}`,
          tipo: "Entrada",
          descricao: `Pagamento da comanda #${String(novaComanda.numero).padStart(5, "0")} · ${animal.nome}`,
          categoria: "Pagamento de comanda",
          valor: pagamentoInicial.valor,
          data: dataLocalISO(new Date(pagamentoInicial.data)),
          formaPagamento: pagamentoInicial.formaPagamento,
          tutor: novaComanda.tutorNome,
          tutorId: novaComanda.tutorId,
          animalId: animal.id,
          status: "Pago",
          comandaId: novaComanda.id,
          registradoPor: responsavel.nome,
        });
      } else if (statusPagamento === "Pendente" && valorTotalComanda > 0) {
        registrarLancamentoComanda({
          id: `comanda-pendente-${novaComanda.id}`,
          tipo: "Entrada",
          descricao: `Saldo da comanda #${String(novaComanda.numero).padStart(5, "0")} · ${animal.nome}`,
          categoria: "Pagamento de comanda",
          valor: valorTotalComanda,
          data: dataLocalISO(new Date(criadaEm)),
          formaPagamento: "A definir",
          tutor: novaComanda.tutorNome,
          tutorId: novaComanda.tutorId,
          animalId: animal.id,
          status: "Pendente",
          comandaId: novaComanda.id,
          registradoPor: responsavel.nome,
        });
      }
    } catch (error) {
      console.error("Não foi possível registrar a comanda da consulta:", error);
      try {
        if (comandasArmazenadas === null) localStorage.removeItem(COMANDAS_KEY);
        else localStorage.setItem(COMANDAS_KEY, comandasArmazenadas);
        window.dispatchEvent(new Event("oricse-comandas-atualizadas"));
        if (lancamentosArmazenados === null) localStorage.removeItem(LANCAMENTOS_KEY);
        else localStorage.setItem(LANCAMENTOS_KEY, lancamentosArmazenados);
      } catch (erroRestauracao) {
        console.error("Não foi possível restaurar os dados após falha ao registrar a comanda:", erroRestauracao);
      }
      return void toast.error("Não foi possível registrar a comanda. Tente novamente.");
    }
    if (pesoConsulta) {
      const listaAnimais = ler<Animal>(ANIMAIS_KEY);
      const pesoAnterior = pesoValido(animal.peso || "");
      localStorage.setItem(ANIMAIS_KEY, JSON.stringify(listaAnimais.map(item => item.id === animal.id ? { ...item, peso: pesoConsulta } : item)));
      if (pesoAnterior !== pesoConsulta) {
        const historico = ler<{id:string;animalId:string;peso:number;data:string;criadoEm:string}>(PESOS_KEY);
        const novoPeso = { id: crypto.randomUUID(), animalId: animal.id, peso: Number(pesoConsulta), data, criadoEm: new Date().toISOString() };
        localStorage.setItem(PESOS_KEY, JSON.stringify([novoPeso, ...historico]));
      }
    }
    const atual=ler<RegistroProntuario>(PRONTUARIO_KEY);
    const novo:RegistroProntuario={id:crypto.randomUUID(),animalId:animal.id,tipo:"Registros clínicos",titulo:"Consulta",detalhe,data,criadoEm:new Date().toISOString(),subtipo:"Consulta",dados:consultaSalva};
    localStorage.setItem(PRONTUARIO_KEY,JSON.stringify([novo,...atual]));
    localStorage.removeItem(chaveRascunho);
    setPagamentoAberto(false);
    toast.success(
      statusPagamento === "Pago"
        ? `Consulta salva e pagamento registrado na comanda #${String(novaComanda.numero).padStart(5, "0")}.`
        : `Consulta salva e comanda #${String(novaComanda.numero).padStart(5, "0")} deixada pendente.`,
    );
    navigate({to:"/animal",search:{animalId:animal.id} as never});
  }

  function salvarProcedimento(){ if(!procedimento.tipo.trim())return void toast.error("Informe a cirurgia ou procedimento."); const detalhe=[procedimento.indicacao&&`Indicação: ${procedimento.indicacao}`,procedimento.equipe&&`Equipe: ${procedimento.equipe}`,procedimento.anestesia&&`Anestesia / sedação: ${procedimento.anestesia}`,procedimento.achados&&`Achados: ${procedimento.achados}`,procedimento.materiais&&`Materiais / técnica: ${procedimento.materiais}`,procedimento.intercorrencias&&`Intercorrências: ${procedimento.intercorrencias}`,procedimento.posOperatorio&&`Pós-operatório: ${procedimento.posOperatorio}`,procedimento.observacoes&&`Observações: ${procedimento.observacoes}`].filter(Boolean).join("\n"); const atual=ler<RegistroProntuario>(PRONTUARIO_KEY); const novo:RegistroProntuario={id:crypto.randomUUID(),animalId:animal.id,tipo:"Registros clínicos",titulo:procedimento.tipo.trim(),detalhe,data,criadoEm:new Date().toISOString(),subtipo:"Cirurgia / Procedimentos",dados:procedimento}; localStorage.setItem(PRONTUARIO_KEY,JSON.stringify([novo,...atual])); toast.success("Procedimento salvo no prontuário."); navigate({to:"/animal",search:{animalId:animal.id} as never}); }

  const abrirConsulta=()=>{setModo("consulta");setEtapa(1);setConsulta(f=>({...f,peso:animal.peso||f.peso}))};

  return <main className="mx-auto min-h-screen w-full max-w-[1500px] px-3 pb-28 pt-3 sm:px-5 sm:pt-4">
    <section className="rounded-xl border bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><PawPrint size={24}/></div>
          <div className="flex min-w-0 flex-1 flex-wrap items-stretch gap-y-3">
            <div className="min-w-0 pr-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Registro clínico</p>
              <div className="flex items-baseline gap-2">
                <h1 className="break-words text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{animal.nome}</h1>
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">#{String((animal as {codigo?:string}).codigo||animal.id).slice(0,8)}</span>
              </div>
            </div>
            <div className="min-w-0 self-center border-l px-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Espécie · Raça</p>
              <p className="mt-0.5 text-sm font-semibold">{animal.especie||"Não informada"}{animal.raca?` · ${animal.raca}`:""}</p>
            </div>
            <div className="min-w-0 self-center border-l px-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Sexo · Idade</p>
              <p className="mt-0.5 text-sm font-semibold">{[animal.sexo,idadeAnimal((animal as {nascimento?:string}).nascimento)].filter(Boolean).join(" · ")||"—"}</p>
            </div>
            <div className="min-w-0 self-center border-l px-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Tutor</p>
              <p className="mt-0.5 text-sm font-semibold">{tutor?.nome||"Não informado"}{tutor && codigoPublicoTutor(tutor) && <span className="ml-2 font-mono text-[11px] font-semibold text-primary">{codigoPublicoTutor(tutor)}</span>}</p>
            </div>
            <div className="min-w-0 self-center border-l px-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Contato</p>
              <p className="mt-0.5 break-all text-sm font-semibold">{[tutor?.telefone,(tutor as {email?:string}|undefined)?.email].filter(Boolean).join("  ·  ")||"—"}</p>
            </div>
          </div>
        </div>
        <Link to="/animal" search={{animalId:animal.id} as never} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border bg-white px-3 text-xs font-semibold transition-colors hover:border-primary/40 hover:bg-primary/5"><ArrowLeft size={15}/> Ficha do animal</Link>
      </div>
    </section>

    {!modo?<section aria-labelledby="tipo-atendimento-titulo" className="mx-auto mt-7 max-w-4xl sm:mt-10">
      <div className="mb-5 text-center sm:mb-6">
        <h2 id="tipo-atendimento-titulo" className="text-xl font-bold tracking-tight sm:text-2xl">Novo registro clínico</h2>
        <p className="mt-2 text-sm text-muted-foreground">Escolha o atendimento que deseja registrar no prontuário.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <AtendimentoCard icon={Stethoscope} titulo="Consulta" descricao="Anamnese, exame clínico, conduta, receita e solicitação de exames." acao="Iniciar consulta" onClick={abrirConsulta}/>
        <AtendimentoCard icon={Scissors} titulo="Cirurgia / Procedimento" descricao="Indicação, equipe, anestesia, achados e cuidados pós-operatórios." acao="Registrar procedimento" onClick={()=>setModo("procedimento")}/>
      </div>
    </section>:<div role="group" aria-label="Tipo de atendimento" className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border bg-white p-2 shadow-sm">
      <ModoButton ativo={modo==="consulta"} icon={Stethoscope} titulo="Consulta" onClick={abrirConsulta}/>
      <ModoButton ativo={modo==="procedimento"} icon={Scissors} titulo="Cirurgia / Procedimento" onClick={()=>setModo("procedimento")}/>
    </div>}

    {modo==="consulta"&&<section className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="grid lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="border-b bg-secondary/35 lg:border-b-0 lg:border-r">
          <div className="flex gap-2 overflow-x-auto p-2 lg:block lg:space-y-1 lg:p-3">{ETAPAS.map(item=><button key={item.n} onClick={()=>setEtapa(item.n)} className={`flex min-w-[150px] items-center gap-3 rounded-xl px-3 py-2.5 text-left transition lg:min-w-0 lg:w-full ${etapa===item.n?"bg-primary text-primary-foreground shadow-sm":"hover:bg-white"}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${etapa===item.n?"bg-white/20":"bg-white text-primary"}`}>{etapaPreenchida(item.n)?<Check size={14}/>:item.n}</span><span className="min-w-0"><span className="block text-sm font-black">{item.titulo}</span><span className={`hidden text-[11px] lg:block ${etapa===item.n?"text-white/75":"text-muted-foreground"}`}>{item.subtitulo}</span></span></button>)}</div>
        </aside>
        <div className="min-w-0">
          <div className="border-b px-4 py-3"><p className="text-xs font-black uppercase tracking-wider text-primary">Etapa {etapa} de 7</p><h2 className="mt-0.5 text-xl font-black">{ETAPAS[etapa-1].titulo}</h2><p className="text-sm text-muted-foreground">{ETAPAS[etapa-1].subtitulo}</p></div>
          <div className="p-4 sm:p-5">
            {etapa===1&&<EtapaTutor consulta={consulta} setConsulta={setConsulta} toggleExposicao={toggleExposicao}/>}
            {etapa===2&&<Textarea grande label="Queixa principal *" value={consulta.queixa} onChange={v=>setConsulta({...consulta,queixa:v})} placeholder="Ex.: Tutor relata vômitos desde ontem, redução do apetite e apatia..."/>}
            {etapa===3&&<div className="space-y-2">{Object.entries(SISTEMAS).map(([sistema,sinais])=>{const item=consulta.sistemas[sistema]; const sinaisVisiveis=sinais.filter(sinal=>sinalPermitidoParaSexo(sinal,animal.sexo)); const oftTem=sistema==="Oftalmológico"&&Object.entries(consulta.oftalmo).some(([,v])=>typeof v==="string"?v.trim():Object.values(v).some(x=>x.trim())); const tem=Boolean(item.sinais.length||item.observacoes.trim()||oftTem); const abertoAgora=aberto===sistema; return <div key={sistema} className={`overflow-hidden rounded-xl border-l-4 border-primary ${tem?"border-primary/35 bg-primary/[0.02]":"border-border"}`}><button type="button" onClick={()=>setAberto(abertoAgora?null:sistema)} className="flex w-full items-center justify-between gap-3 bg-primary/[0.07] px-4 py-3.5 text-left transition-colors hover:bg-primary/[0.11]"><div className="flex items-center gap-2"><strong className="text-base font-extrabold tracking-tight text-foreground sm:text-lg">{sistema}</strong>{tem&&<span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">preenchido</span>}</div>{abertoAgora?<ChevronUp size={17}/>:<ChevronDown size={17}/>}</button>{abertoAgora&&<div className="border-t p-3"><div className="flex flex-wrap gap-2">{sinaisVisiveis.length?sinaisVisiveis.map(sinal=><Chip key={sinal} ativo={item.sinais.includes(sinal)} onClick={()=>toggleSinal(sistema,sinal)}>{sinal}</Chip>):<span className="text-xs text-muted-foreground">Use o campo de observações.</span>}</div><textarea value={item.observacoes} onChange={e=>setConsulta(f=>({...f,sistemas:{...f.sistemas,[sistema]:{...item,observacoes:e.target.value}}}))} rows={3} placeholder="Observações deste sistema..." className="mt-3 w-full rounded-xl border p-3 text-sm outline-none focus:border-primary"/>{sistema==="Oftalmológico"&&<OftalmoCampos consulta={consulta} setConsulta={setConsulta} setOftalmoPar={setOftalmoPar}/>}</div>}</div>})}</div>}
            {etapa===4&&<>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Input label="Peso (kg)" value={consulta.peso} onChange={v=>setConsulta({...consulta,peso:v})}/>
                <Input label="Temperatura (°C)" value={consulta.temperatura} onChange={v=>setConsulta({...consulta,temperatura:v})}/>
                <Input label="FC (bpm)" value={consulta.fc} onChange={v=>setConsulta({...consulta,fc:v})}/>
                <Input label="FR (mpm)" value={consulta.fr} onChange={v=>setConsulta({...consulta,fr:v})}/>
                <Input label="PAS (mmHg)" value={consulta.pas} onChange={v=>setConsulta({...consulta,pas:v})}/>
                <Input label="Glicemia (mg/dL)" value={consulta.glicemia} onChange={v=>setConsulta({...consulta,glicemia:v})}/>
              </div>
              <section className="mt-4 rounded-2xl border border-primary/25 bg-primary/[0.035] p-4">
                <h3 className="text-sm font-black text-foreground">Avaliação clínica</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Select label="Mucosas" value={consulta.mucosas} onChange={v=>setConsulta({...consulta,mucosas:v})} opcoes={["Normocoradas","Hipocoradas","Hiperêmicas","Ictéricas","Cianóticas","Congestas","Hemorrágicas","Pigmentadas","Ressecadas","Úmidas","Não avaliadas","Outras alterações"]}/>
                  <Input label="Hidratação" value={consulta.hidratacao} onChange={v=>setConsulta({...consulta,hidratacao:v})}/>
                  <Select label="Dor" value={consulta.dor} onChange={v=>setConsulta({...consulta,dor:v})} opcoes={["Ausente","Leve","Moderada","Intensa","Não avaliável"]}/>
                </div>
              </section>
              <p className="mt-3 text-xs font-medium text-muted-foreground">Referência normal para {animal?.especie || "cão"}: temperatura {normaisPara(animal?.especie).temperatura} · FC {normaisPara(animal?.especie).fc} · FR {normaisPara(animal?.especie).fr} · PAS {normaisPara(animal?.especie).pas} · glicemia {normaisPara(animal?.especie).glicemia}</p>
              <div className="mt-3"><Textarea label="Exame físico / avaliação geral" value={consulta.exameGeral} onChange={v=>setConsulta({...consulta,exameGeral:v})}/></div>
            </>}
            {etapa===5&&<><div className="grid gap-4 md:grid-cols-2"><Textarea grande label="Hipóteses / suspeitas" value={consulta.suspeitas} onChange={v=>setConsulta({...consulta,suspeitas:v})}/><Textarea grande label="Conduta / orientações" value={consulta.conduta} onChange={v=>setConsulta({...consulta,conduta:v})}/></div><div className="mt-4 max-w-lg"><Input label="Retorno" value={consulta.retorno} onChange={v=>setConsulta({...consulta,retorno:v})} placeholder="Ex.: 7 dias ou antes se piorar"/></div></>}
            {etapa===6&&<div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-2xl border bg-violet-50/35 p-4 sm:p-5"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><FileText size={22}/></div><div><h3 className="text-lg font-black">Receita</h3><p className="text-sm text-muted-foreground">Registre a prescrição desta consulta ou abra o receituário completo.</p></div></div><div className="mt-4"><Textarea label="Medicações / tratamento" value={consulta.medicacoes} onChange={v=>setConsulta({...consulta,medicacoes:v})} placeholder="Ex.: Dipirona 500 mg — administrar..."/></div><Link to="/receituario" search={{animalId:animal.id,tutorId:tutor?.id||""} as never} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-700 px-4 text-sm font-black text-white">Abrir receituário</Link></section>
              <section className="rounded-2xl border bg-sky-50/40 p-4 sm:p-5"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><FlaskConical size={22}/></div><div><h3 className="text-lg font-black">Pedido de exame</h3><p className="text-sm text-muted-foreground">Selecione um ou mais exames. Eles ficam vinculados a esta consulta.</p></div></div><div className="mt-4 flex flex-wrap gap-2">{EXAMES_OPCOES.map(nome=><Chip key={nome} ativo={examesSelecionados.includes(nome)} onClick={()=>toggleExame(nome)}>{nome}</Chip>)}</div><div className="mt-4"><Textarea label="Outros exames / observações" value={consulta.examesSolicitados} onChange={v=>setConsulta({...consulta,examesSolicitados:v})} placeholder="Você também pode complementar manualmente o pedido..."/></div></section>
            </div>}
            {etapa===7&&<div className="space-y-5">
              <section className="rounded-2xl border border-primary/20 bg-primary/[0.035] p-4 sm:p-5"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShoppingCart size={22}/></div><div><h3 className="text-lg font-black">Comanda desta consulta</h3><p className="text-sm text-muted-foreground">A consulta e os exames solicitados entram automaticamente. Confira os valores e acrescente o que mais será cobrado.</p></div></div><div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"><select value={itemCatalogoId} onChange={e=>setItemCatalogoId(e.target.value)} disabled={catalogoCarregando} className="min-h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-primary"><option value="">{catalogoCarregando?"Carregando serviços e produtos...":"Adicionar serviço ou produto"}</option>{catalogo.map(item=><option key={item.id} value={item.id}>{item.nome} · {moeda(Number(item.preco)||0)}</option>)}</select><button type="button" onClick={adicionarItemCatalogo} disabled={!itemCatalogoId} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground disabled:opacity-50"><Plus size={17}/> Adicionar</button></div>{catalogoAviso&&<p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">{catalogoAviso} Você ainda pode preencher os valores manualmente.</p>}</section>
              <section className="overflow-hidden rounded-2xl border"><div className="hidden grid-cols-[minmax(0,1fr)_90px_150px_130px_44px] gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-black uppercase tracking-wide text-muted-foreground sm:grid"><span>Item</span><span>Qtd.</span><span>Valor unitário</span><span>Subtotal</span><span/></div>{itensComanda.length?itensComanda.map(item=>{const unitario=numeroMoeda(item.valorUnitario)||0;return <div key={item.id} className="grid gap-3 border-b p-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_90px_150px_130px_44px] sm:items-center"><div className="min-w-0"><div className="font-bold">{item.nome}</div><div className="mt-1 flex flex-wrap gap-1"><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">{item.tipo}</span>{item.automatico&&<span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">automático</span>}{!item.precoConfigurado&&<span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">preço não cadastrado</span>}</div></div><label className="text-xs font-bold text-muted-foreground sm:text-transparent">Quantidade<input aria-label={`Quantidade de ${item.nome}`} type="number" min="1" step="1" value={item.quantidade} onChange={e=>atualizarItemComanda(item.id,"quantidade",e.target.value)} className="mt-1 min-h-10 w-full rounded-xl border bg-white px-3 text-sm font-normal text-foreground outline-none focus:border-primary sm:mt-0"/></label><label className="text-xs font-bold text-muted-foreground sm:text-transparent">Valor unitário<input aria-label={`Valor de ${item.nome}`} inputMode="decimal" value={item.valorUnitario} onChange={e=>atualizarItemComanda(item.id,"valorUnitario",e.target.value)} placeholder="0,00" className={`mt-1 min-h-10 w-full rounded-xl border bg-white px-3 text-sm font-normal text-foreground outline-none focus:border-primary sm:mt-0 ${numeroMoeda(item.valorUnitario)===null?"border-amber-400":""}`}/></label><div><span className="text-xs font-bold text-muted-foreground sm:hidden">Subtotal</span><strong className="mt-1 block sm:mt-0">{moeda(unitario*item.quantidade)}</strong></div><button type="button" onClick={()=>removerItemComanda(item.id)} aria-label={`Remover ${item.nome}`} className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-rose-50 hover:text-rose-600"><Trash2 size={17}/></button></div>}):<div className="p-8 text-center text-sm text-muted-foreground">Nenhum item na comanda.</div>}</section>
              <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-950 p-5 text-white"><div><p className="text-xs font-bold uppercase tracking-wide text-white/60">Total da comanda</p><p className="mt-1 text-3xl font-black">{moeda(totalComanda)}</p></div><div className="text-right text-sm text-white/70"><p>{tutor?.nome||"Tutor não informado"}</p><p>{animal.nome}</p></div></section>
            </div>}
          </div>
          <div className="sticky bottom-0 flex flex-wrap items-end justify-between gap-3 border-t bg-white/95 px-4 py-3 backdrop-blur sm:px-5"><label className="text-xs font-bold">Data da consulta<input type="date" value={data} onChange={e=>setData(e.target.value)} className="mt-1 block min-h-10 rounded-xl border bg-white px-3 text-sm font-normal"/></label><div className="ml-auto flex gap-2">{etapa>1&&<button onClick={()=>setEtapa(etapa-1)} className="rounded-xl border px-4 py-2.5 text-sm font-bold">Anterior</button>}{etapa<7?<button onClick={()=>setEtapa(etapa+1)} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground">{etapa===6?"Ir para a comanda":"Próximo"}</button>:<button onClick={abrirPagamento} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground"><Save size={16}/> Finalizar consulta e lançar</button>}</div></div>
        </div>
      </div>
    </section>}

    {modo==="procedimento"&&<section className="mt-4 rounded-2xl border bg-white shadow-sm"><Cabecalho titulo="Cirurgia / Procedimento" subtitulo="Registro objetivo do procedimento e do pós-operatório."/><div className="p-4 sm:p-5"><div className="grid gap-3 md:grid-cols-2"><Input label="Cirurgia / procedimento *" value={procedimento.tipo} onChange={v=>setProcedimento({...procedimento,tipo:v})}/><Input label="Equipe" value={procedimento.equipe} onChange={v=>setProcedimento({...procedimento,equipe:v})}/><Textarea label="Indicação" value={procedimento.indicacao} onChange={v=>setProcedimento({...procedimento,indicacao:v})}/><Textarea label="Anestesia / sedação" value={procedimento.anestesia} onChange={v=>setProcedimento({...procedimento,anestesia:v})}/><Textarea label="Achados" value={procedimento.achados} onChange={v=>setProcedimento({...procedimento,achados:v})}/><Textarea label="Materiais / técnica" value={procedimento.materiais} onChange={v=>setProcedimento({...procedimento,materiais:v})}/><Textarea label="Intercorrências" value={procedimento.intercorrencias} onChange={v=>setProcedimento({...procedimento,intercorrencias:v})}/><Textarea label="Pós-operatório" value={procedimento.posOperatorio} onChange={v=>setProcedimento({...procedimento,posOperatorio:v})}/></div><div className="mt-3"><Textarea label="Observações" value={procedimento.observacoes} onChange={v=>setProcedimento({...procedimento,observacoes:v})}/></div><div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t pt-4"><label className="text-sm font-bold">Data<input type="date" value={data} onChange={e=>setData(e.target.value)} className="mt-1 block min-h-10 rounded-xl border bg-white px-3 font-normal"/></label><button onClick={salvarProcedimento} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-primary-foreground"><Save size={17}/> Salvar registro</button></div></div></section>}
    {pagamentoAberto&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" onMouseDown={e=>{if(e.currentTarget===e.target)setPagamentoAberto(false)}}><section role="dialog" aria-modal="true" aria-label="Forma de pagamento" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wide text-primary">Finalizar atendimento</p><h2 className="mt-1 text-2xl font-black">Como foi pago?</h2><p className="mt-1 text-sm text-muted-foreground">Total da comanda: <strong className="text-foreground">{moeda(totalComanda)}</strong></p></div><button type="button" onClick={()=>setPagamentoAberto(false)} aria-label="Fechar" className="rounded-xl p-2 text-muted-foreground hover:bg-muted"><X size={20}/></button></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{(["Pix","Dinheiro","Cartão de débito","Cartão de crédito","App","Plano de saúde","Outros"] as FormaPagamento[]).map(opcao=><button key={opcao} type="button" aria-pressed={formaPagamento===opcao} onClick={()=>setFormaPagamento(opcao)} className={`min-h-12 rounded-xl border px-3 text-sm font-black transition ${formaPagamento===opcao?"border-primary bg-primary text-primary-foreground":"bg-white hover:border-primary/50"}`}>{opcao.replace("Cartão de ","")}</button>)}</div>{formaPagamento==="Outros"&&<label className="mt-4 block text-sm font-bold">Especifique a forma de pagamento<input autoFocus value={outroPagamento} onChange={e=>setOutroPagamento(e.target.value)} placeholder="Ex.: transferência, cortesia..." className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 font-normal outline-none focus:border-primary"/></label>}<div className="mt-6 grid gap-2 border-t pt-4 sm:grid-cols-[auto_1fr_1fr]"><button type="button" onClick={()=>setPagamentoAberto(false)} className="min-h-11 rounded-xl border px-4 text-sm font-bold">Cancelar</button><button type="button" onClick={()=>salvarConsulta("Pendente","A definir")} className="min-h-11 rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-black text-amber-900">Deixar pendente</button><button type="button" onClick={confirmarPagamento} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground">Confirmar pagamento</button></div></section></div>}
  </main>;
}

function EtapaTutor({consulta,setConsulta,toggleExposicao}:{consulta:ConsultaForm;setConsulta:React.Dispatch<React.SetStateAction<ConsultaForm>>;toggleExposicao:(x:string)=>void}){return <><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><SimNaoCampo label="Tem acesso à rua?" value={consulta.acessoRua} onChange={v=>setConsulta({...consulta,acessoRua:v})}/><SimNaoCampo label="Contato com outros animais?" value={consulta.contatoAnimais} onChange={v=>setConsulta({...consulta,contatoAnimais:v})}/><Select label="Ambiente" value={consulta.ambiente} onChange={v=>setConsulta({...consulta,ambiente:v})} opcoes={["Casa","Apartamento","Sítio / chácara","Canil / gatil","Outro"]}/><Select label="Moradia" value={consulta.moradia} onChange={v=>setConsulta({...consulta,moradia:v})} opcoes={["Interno","Externo","Misto","Não informado"]}/><Select label="Ventilação" value={consulta.ventilacao} onChange={v=>setConsulta({...consulta,ventilacao:v})} opcoes={["Boa","Regular","Ruim","Não informado"]}/><Select label="Apetite" value={consulta.apetite} onChange={v=>setConsulta({...consulta,apetite:v})} opcoes={["Normal","Reduzido","Ausente","Aumentado","Seletivo"]}/><Input label="Vacinação" value={consulta.vacinacao} onChange={v=>setConsulta({...consulta,vacinacao:v})}/><Input label="Vermifugação" value={consulta.vermifugacao} onChange={v=>setConsulta({...consulta,vermifugacao:v})}/></div><div className="mt-4"><div className="mb-2 text-sm font-bold">Exposição</div><div className="flex flex-wrap gap-2">{["Fumaça","Poeira","Produtos químicos","Queimadas","Plantas","Lixo","Animais silvestres"].map(x=><Chip key={x} ativo={consulta.exposicoes.includes(x)} onClick={()=>toggleExposicao(x)}>{x}</Chip>)}</div></div><div className="mt-4 grid gap-3 md:grid-cols-2"><Textarea label="Dieta / alimentação" value={consulta.dieta} onChange={v=>setConsulta({...consulta,dieta:v})}/><Textarea label="Doenças prévias" value={consulta.doencasPrevias} onChange={v=>setConsulta({...consulta,doencasPrevias:v})}/><Textarea label="Medicamentos recentes" value={consulta.medicamentosRecentes} onChange={v=>setConsulta({...consulta,medicamentosRecentes:v})}/><Textarea label="Alergias conhecidas" value={consulta.alergias} onChange={v=>setConsulta({...consulta,alergias:v})}/></div></>}
function AtendimentoCard({icon:Icon,titulo,descricao,acao,onClick}:{icon:typeof Stethoscope;titulo:string;descricao:string;acao:string;onClick:()=>void}){
  return <button type="button" onClick={onClick} aria-label={acao} className="group flex h-full w-full flex-col rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:rounded-3xl sm:p-7">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><Icon size={28}/></div>
    <h3 className="mt-5 text-xl font-bold tracking-tight">{titulo}</h3>
    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{descricao}</p>
    <div className="mt-6 flex w-full items-center justify-between gap-3 border-t pt-4 text-sm font-semibold text-primary"><span>{acao}</span><ArrowRight size={19} className="shrink-0 transition-transform group-hover:translate-x-1"/></div>
  </button>;
}
function ModoButton({ativo,icon:Icon,titulo,onClick}:{ativo:boolean;icon:typeof Stethoscope;titulo:string;onClick:()=>void}){
  return <button type="button" aria-pressed={ativo} onClick={onClick} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${ativo?"bg-primary text-primary-foreground":"bg-white text-muted-foreground hover:bg-primary/5 hover:text-primary"}`}><Icon size={18} className="shrink-0"/><span>{titulo}</span></button>;
}
function Cabecalho({titulo,subtitulo}:{titulo:string;subtitulo:string}){return <div className="border-b bg-muted/20 px-4 py-3"><h2 className="flex items-center gap-2 text-lg font-black"><ClipboardPlus size={18} className="text-primary"/>{titulo}</h2><p className="mt-0.5 text-xs text-muted-foreground">{subtitulo}</p></div>}
function Input({label,value,onChange,placeholder}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string}){return <label className="block text-sm font-bold">{label}<input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="mt-1 min-h-10 w-full rounded-xl border bg-white px-3 font-normal outline-none focus:border-primary"/></label>}
function Textarea({label,value,onChange,placeholder,grande}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;grande?:boolean}){return <label className="block text-sm font-bold">{label}<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={grande?7:3} className="mt-1 w-full rounded-xl border bg-white p-3 font-normal outline-none focus:border-primary"/></label>}
function Select({label,value,onChange,opcoes}:{label:string;value:string;onChange:(v:string)=>void;opcoes:string[]}){return <label className="block text-sm font-bold">{label}<select value={value} onChange={e=>onChange(e.target.value)} className="mt-1 min-h-10 w-full rounded-xl border bg-white px-3 font-normal"><option value="">Selecione</option>{opcoes.map(x=><option key={x}>{x}</option>)}</select></label>}
function SimNaoCampo({label,value,onChange}:{label:string;value:SimNao;onChange:(v:SimNao)=>void}){return <div><div className="text-sm font-bold">{label}</div><div className="mt-1 flex gap-2">{(["Sim","Não"] as SimNao[]).map(x=><button key={x} type="button" onClick={()=>onChange(x)} className={`min-h-10 flex-1 rounded-xl border px-3 text-sm font-bold ${value===x?"border-primary bg-primary/10 text-primary":"bg-white"}`}>{x}</button>)}</div></div>}
function Chip({ativo,onClick,children}:{ativo:boolean;onClick:()=>void;children:React.ReactNode}){return <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${ativo?"border-primary bg-primary text-primary-foreground":"bg-white hover:border-primary/50"}`}>{children}</button>}

function OftalmoCampos({consulta,setConsulta,setOftalmoPar}:{consulta:ConsultaForm;setConsulta:React.Dispatch<React.SetStateAction<ConsultaForm>>;setOftalmoPar:(chave:keyof Omit<OftalmoForm,"equipamentoTonometria">,olho:keyof OlhoValores,valor:string)=>void}){return <div className="mt-4 rounded-xl border bg-slate-50/50 p-3"><div className="mb-3"><h4 className="font-black">Exames oftalmológicos</h4><p className="text-xs text-muted-foreground">OD e OE. Preencha somente o que foi realizado.</p></div><div className="overflow-x-auto"><div className="min-w-[650px]"><div className="grid grid-cols-[170px_1fr_1fr] gap-2 border-b pb-2 text-xs font-black uppercase text-muted-foreground"><div>Teste</div><div>OD</div><div>OE</div></div><OftEntrada label="Schirmer" od={consulta.oftalmo.schirmer.od} oe={consulta.oftalmo.schirmer.oe} unidade="mm/min" onOd={v=>setOftalmoPar("schirmer","od",v)} onOe={v=>setOftalmoPar("schirmer","oe",v)}/><OftSelect label="Fluoresceína" od={consulta.oftalmo.fluoresceina.od} oe={consulta.oftalmo.fluoresceina.oe} opcoes={["Positivo","Negativo","Não realizado"]} onOd={v=>setOftalmoPar("fluoresceina","od",v)} onOe={v=>setOftalmoPar("fluoresceina","oe",v)}/><OftSelect label="Teste de Jones" od={consulta.oftalmo.jones.od} oe={consulta.oftalmo.jones.oe} opcoes={["Positivo","Negativo","Não realizado"]} onOd={v=>setOftalmoPar("jones","od",v)} onOe={v=>setOftalmoPar("jones","oe",v)}/><OftSelect label="Rosa Bengala" od={consulta.oftalmo.rosaBengala.od} oe={consulta.oftalmo.rosaBengala.oe} opcoes={["Positivo","Negativo","Não realizado"]} onOd={v=>setOftalmoPar("rosaBengala","od",v)} onOe={v=>setOftalmoPar("rosaBengala","oe",v)}/><OftSelect label="Lissamina Verde" od={consulta.oftalmo.lissaminaVerde.od} oe={consulta.oftalmo.lissaminaVerde.oe} opcoes={["Positivo","Negativo","Não realizado"]} onOd={v=>setOftalmoPar("lissaminaVerde","od",v)} onOe={v=>setOftalmoPar("lissaminaVerde","oe",v)}/><OftEntrada label="PIO" od={consulta.oftalmo.pio.od} oe={consulta.oftalmo.pio.oe} unidade="mmHg" onOd={v=>setOftalmoPar("pio","od",v)} onOe={v=>setOftalmoPar("pio","oe",v)}/></div></div><div className="mt-3 max-w-xl"><Input label="Equipamento de tonometria" value={consulta.oftalmo.equipamentoTonometria} onChange={v=>setConsulta(f=>({...f,oftalmo:{...f.oftalmo,equipamentoTonometria:v}}))}/></div><div className="mt-4 border-t pt-3"><h4 className="font-black">Reflexos e respostas</h4><div className="mt-2 overflow-x-auto"><div className="min-w-[650px]"><OftSelect label="Reflexo pupilar direto" od={consulta.oftalmo.reflexoPupilarDireto.od} oe={consulta.oftalmo.reflexoPupilarDireto.oe} opcoes={["Presente","Reduzido","Ausente","Não realizado"]} onOd={v=>setOftalmoPar("reflexoPupilarDireto","od",v)} onOe={v=>setOftalmoPar("reflexoPupilarDireto","oe",v)}/><OftSelect label="Reflexo pupilar consensual" od={consulta.oftalmo.reflexoPupilarConsensual.od} oe={consulta.oftalmo.reflexoPupilarConsensual.oe} opcoes={["Presente","Reduzido","Ausente","Não realizado"]} onOd={v=>setOftalmoPar("reflexoPupilarConsensual","od",v)} onOe={v=>setOftalmoPar("reflexoPupilarConsensual","oe",v)}/><OftSelect label="Deambulação" od={consulta.oftalmo.deambulacao.od} oe={consulta.oftalmo.deambulacao.oe} opcoes={["Normal","Alterada","Ausente","Não realizado"]} onOd={v=>setOftalmoPar("deambulacao","od",v)} onOe={v=>setOftalmoPar("deambulacao","oe",v)}/></div></div></div></div>}
function OftEntrada({label,od,oe,unidade,onOd,onOe}:{label:string;od:string;oe:string;unidade:string;onOd:(v:string)=>void;onOe:(v:string)=>void}){const campo=(valor:string,onChange:(v:string)=>void)=><div className="relative"><input value={valor} onChange={e=>onChange(e.target.value)} className="min-h-10 w-full rounded-xl border bg-white px-3 pr-16 text-sm"/><span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{unidade}</span></div>; return <div className="grid grid-cols-[170px_1fr_1fr] items-center gap-2 border-b py-2"><div className="text-sm font-semibold">{label}</div>{campo(od,onOd)}{campo(oe,onOe)}</div>}
function OftSelect({label,od,oe,opcoes,onOd,onOe}:{label:string;od:string;oe:string;opcoes:string[];onOd:(v:string)=>void;onOe:(v:string)=>void}){const campo=(valor:string,onChange:(v:string)=>void)=><select value={valor} onChange={e=>onChange(e.target.value)} className="min-h-10 w-full rounded-xl border bg-white px-2 text-sm"><option value="">Selecione</option>{opcoes.map(x=><option key={x}>{x}</option>)}</select>; return <div className="grid grid-cols-[170px_1fr_1fr] items-center gap-2 border-b py-2"><div className="text-sm font-semibold">{label}</div>{campo(od,onOd)}{campo(oe,onOe)}</div>}
