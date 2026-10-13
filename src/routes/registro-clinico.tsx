import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BedDouble, Check, ChevronDown, ChevronUp, ClipboardPlus, FileText, FlaskConical, PawPrint, Save, Scissors, Stethoscope } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/registro-clinico")({ component: RegistroClinico });

type Animal = { id: string; tutorId: string; nome: string; especie?: string; raca?: string; peso?: string };
type Tutor = { id: string; nome: string; telefone?: string; outroTelefone?: string };
type RegistroProntuario = { id: string; animalId: string; tipo: "Registros clínicos"; titulo: string; detalhe?: string; data: string; criadoEm: string; subtipo?: "Consulta" | "Cirurgia / Procedimentos"; dados?: unknown };
type RegistroPlantao = { animal?: string; especie?: string; peso?: string; criadoEm?: string; alimentacao?: string; comportamento?: string; fezes?: string; mucosas?: string; urina?: string; vomito?: string; temperatura?: string; fc?: string; fr?: string; pas?: string; glicemia?: string; observacoes?: string; medicacoes?: { nome?: string; quantidade?: string; via?: string; duracao?: string }[] };
type Plantao = { id?: string; data?: string; turno?: string; criadoEm?: string; registros?: RegistroPlantao[] };
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

const ANIMAIS_KEY = "oricse-animais-v1";
const TUTORES_KEY = "oricse-tutores-v1";
const PRONTUARIO_KEY = "oricse-prontuario-animal-v1";
const PESOS_KEY = "oricse-pesos-animal-v1";
const PLANTOES_KEY = "veterico-plantoes-v1";

const NORMAIS_ESPECIE = {
  cão: { temperatura: "37,5–39,2 °C", fc: "60–160 bpm", fr: "10–30 mpm", pas: "100–160 mmHg", glicemia: "70–120 mg/dL" },
  gato: { temperatura: "38,0–39,2 °C", fc: "140–220 bpm", fr: "20–40 mpm", pas: "100–160 mmHg", glicemia: "70–150 mg/dL" },
};
function normaisPara(especie?: string) { return /gato|fel/i.test(especie || "") ? NORMAIS_ESPECIE.gato : NORMAIS_ESPECIE.cão; }

const SISTEMAS: Record<string, string[]> = {
  Digestivo: ["Anorexia", "Hiporexia", "Apetite caprichoso", "Polifagia", "Êmese", "Diarreia", "Melena", "Hematoquezia", "Muco nas fezes", "Tenesmo", "Polidipsia"],
  Geniturinário: ["Hematúria", "Disúria", "Estrangúria", "Polaciúria", "Poliúria", "Oligúria", "Anúria", "Noctúria", "Secreção genital"],
  Locomotor: ["Claudicação", "Dor", "Paresia", "Paralisia", "Dificuldade para levantar", "Dificuldade para saltar", "Dificuldade para vencer obstáculos"],
  Tegumentar: ["Prurido", "Alopecia", "Lesões de pele", "Eritema", "Descamação", "Ferida", "Nódulo", "Secreção", "Desidratação"],
  Oftalmológico: ["Secreção ocular", "Blefaroespasmo", "Epífora", "Hiperemia", "Opacidade", "Dor ocular", "Alteração visual"],
  Respiratório: ["Tosse", "Espirros", "Secreção nasal", "Dispneia", "Taquipneia", "Ruído respiratório", "Intolerância ao exercício"],
  Neurológico: ["Convulsão", "Head tilt", "Andar em círculos", "Ataxia", "Tremor", "Nistagmo", "Alteração de consciência", "Paresia"],
  Cardiovascular: ["Síncope", "Cansaço", "Intolerância ao exercício", "Cianose", "Edema", "Tosse associada ao esforço"],
  "Endócrino / metabólico": ["Poliúria", "Polidipsia", "Polifagia", "Perda de peso", "Ganho de peso", "Fraqueza", "Alteração de pelagem"],
  Hematológico: ["Palidez", "Petéquias", "Equimoses", "Sangramento", "Fraqueza", "Icterícia"],
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
] as const;

const vazioOlho = (): OlhoValores => ({ od: "", oe: "" });
function oftalmoVazio(): OftalmoForm { return { schirmer:vazioOlho(), fluoresceina:vazioOlho(), jones:vazioOlho(), rosaBengala:vazioOlho(), lissaminaVerde:vazioOlho(), pio:vazioOlho(), equipamentoTonometria:"", reflexoPupilarDireto:vazioOlho(), reflexoPupilarConsensual:vazioOlho(), deambulacao:vazioOlho() }; }
function ler<T>(chave:string):T[]{ if(typeof window==="undefined")return[]; try{const v=JSON.parse(localStorage.getItem(chave)||"[]"); return Array.isArray(v)?v:[]}catch{return[]} }
function normalizar(v?:string){ return (v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim(); }
function hoje(){ return new Date().toISOString().slice(0,10); }
function dataBR(v?:string){ if(!v)return"—"; const [a,m,d]=v.slice(0,10).split("-"); return a&&m&&d?`${d}/${m}/${a}`:v; }
function pesoValido(valor: string) {
  const numero = Number(String(valor).trim().replace(",", "."));
  return Number.isFinite(numero) && numero > 0 ? numero.toFixed(3) : "";
}

function formConsultaVazio():ConsultaForm { return { acessoRua:"", contatoAnimais:"", ambiente:"", moradia:"", ventilacao:"", apetite:"", exposicoes:[], vacinacao:"", vermifugacao:"", dieta:"", doencasPrevias:"", medicamentosRecentes:"", alergias:"", queixa:"", sistemas:Object.fromEntries(Object.keys(SISTEMAS).map(s=>[s,{sinais:[],observacoes:""}])), oftalmo:oftalmoVazio(), peso:"", temperatura:"", fc:"", fr:"", pas:"", glicemia:"", mucosas:"", hidratacao:"", dor:"", exameGeral:"", suspeitas:"", examesSolicitados:"", medicacoes:"", conduta:"", retorno:"" }; }

function RegistroClinico(){
  const navigate=useNavigate();
  const params=new URLSearchParams(typeof window!=="undefined"?window.location.search:"");
  const animalId=params.get("animalId")||"";
  const animais=useMemo(()=>ler<Animal>(ANIMAIS_KEY),[]);
  const tutores=useMemo(()=>ler<Tutor>(TUTORES_KEY),[]);
  const animal=animais.find(a=>a.id===animalId);
  const tutor=tutores.find(t=>t.id===animal?.tutorId);
  const [modo,setModo]=useState<""|"internacao"|"consulta"|"procedimento">("");
  const [etapa,setEtapa]=useState(1);
  const [consulta,setConsulta]=useState<ConsultaForm>(formConsultaVazio);
  const [procedimento,setProcedimento]=useState<ProcedimentoForm>({tipo:"",indicacao:"",equipe:"",anestesia:"",achados:"",materiais:"",intercorrencias:"",posOperatorio:"",observacoes:""});
  const [aberto,setAberto]=useState<string|null>(null);
  const [data,setData]=useState(hoje());
  const chaveRascunho=`oricse-rascunho-consulta-${animalId}`;

  useEffect(()=>{ if(!animalId)return; try{const salvo=localStorage.getItem(chaveRascunho); if(salvo){const bruto=JSON.parse(salvo); setConsulta({...formConsultaVazio(),...bruto,oftalmo:{...oftalmoVazio(),...(bruto.oftalmo||{})}})}}catch{} },[animalId]);
  useEffect(()=>{ if(!animalId||modo!=="consulta")return; const t=window.setTimeout(()=>localStorage.setItem(chaveRascunho,JSON.stringify(consulta)),250); return()=>window.clearTimeout(t); },[consulta,modo,animalId]);

  const internacoes=useMemo(()=>{ if(!animal)return[] as {plantao:Plantao;registro:RegistroPlantao}[]; const nome=normalizar(animal.nome), especie=normalizar(animal.especie), itens:{plantao:Plantao;registro:RegistroPlantao}[]=[]; ler<Plantao>(PLANTOES_KEY).forEach(plantao=>(plantao.registros||[]).forEach(r=>{const mesmoNome=normalizar(r.animal)===nome; const mesmaEspecie=!especie||!normalizar(r.especie)||normalizar(r.especie).includes(especie)||especie.includes(normalizar(r.especie)); if(mesmoNome&&mesmaEspecie)itens.push({plantao,registro:r})})); return itens.sort((a,b)=>String(b.plantao.criadoEm||b.plantao.data||"").localeCompare(String(a.plantao.criadoEm||a.plantao.data||""))); },[animal]);

  if(!animal)return <main className="mx-auto max-w-4xl px-4 py-8"><Link to="/animais" className="text-sm text-muted-foreground">← Voltar</Link><div className="mt-5 rounded-2xl border p-6">Animal não encontrado.</div></main>;

  const toggleExposicao=(nome:string)=>setConsulta(f=>({...f,exposicoes:f.exposicoes.includes(nome)?f.exposicoes.filter(x=>x!==nome):[...f.exposicoes,nome]}));
  const toggleSinal=(sistema:string,sinal:string)=>setConsulta(f=>({...f,sistemas:{...f.sistemas,[sistema]:{...f.sistemas[sistema],sinais:f.sistemas[sistema].sinais.includes(sinal)?f.sistemas[sistema].sinais.filter(x=>x!==sinal):[...f.sistemas[sistema].sinais,sinal]}}}));
  const setOftalmoPar=(chave:keyof Omit<OftalmoForm,"equipamentoTonometria">,olho:keyof OlhoValores,valor:string)=>setConsulta(f=>({...f,oftalmo:{...f.oftalmo,[chave]:{...f.oftalmo[chave],[olho]:valor}}}));
  const examesSelecionados=consulta.examesSolicitados.split(" · ").map(x=>x.trim()).filter(Boolean);
  const toggleExame=(nome:string)=>setConsulta(f=>{const atuais=f.examesSolicitados.split(" · ").map(x=>x.trim()).filter(Boolean); const novos=atuais.includes(nome)?atuais.filter(x=>x!==nome):[...atuais,nome]; return {...f,examesSolicitados:novos.join(" · ")}});

  function etapaPreenchida(n:number){
    if(n===1)return Boolean(consulta.acessoRua||consulta.contatoAnimais||consulta.ambiente||consulta.moradia||consulta.ventilacao||consulta.apetite||consulta.exposicoes.length||consulta.vacinacao||consulta.vermifugacao||consulta.dieta||consulta.doencasPrevias||consulta.medicamentosRecentes||consulta.alergias);
    if(n===2)return Boolean(consulta.queixa.trim());
    if(n===3)return Object.values(consulta.sistemas).some(x=>x.sinais.length||x.observacoes.trim())||Object.values(consulta.oftalmo).some(v=>typeof v==="string"?v.trim():Object.values(v).some(x=>x.trim()));
    if(n===4)return Boolean(consulta.peso||consulta.temperatura||consulta.fc||consulta.fr||consulta.pas||consulta.glicemia||consulta.mucosas||consulta.hidratacao||consulta.dor||consulta.exameGeral);
    if(n===5)return Boolean(consulta.suspeitas||consulta.conduta||consulta.retorno);
    return Boolean(consulta.examesSolicitados||consulta.medicacoes);
  }

  function salvarConsulta(){
    if(!consulta.queixa.trim())return void toast.error("Informe a queixa principal.");
    const o=consulta.oftalmo;
    const linhaPar=(rotulo:string,p:OlhoValores,unidade="")=>(p.od||p.oe)?`${rotulo}: ${[p.od&&`OD ${p.od}${unidade}`,p.oe&&`OE ${p.oe}${unidade}`].filter(Boolean).join(" · ")}`:"";
    const oft=[linhaPar("Schirmer",o.schirmer," mm/min"),linhaPar("Fluoresceína",o.fluoresceina),linhaPar("Teste de Jones",o.jones),linhaPar("Rosa Bengala",o.rosaBengala),linhaPar("Lissamina Verde",o.lissaminaVerde),linhaPar("PIO",o.pio," mmHg"),o.equipamentoTonometria&&`Equipamento de tonometria: ${o.equipamentoTonometria}`,linhaPar("Reflexo pupilar direto",o.reflexoPupilarDireto),linhaPar("Reflexo pupilar consensual",o.reflexoPupilarConsensual),linhaPar("Deambulação",o.deambulacao)].filter(Boolean) as string[];
    const sistemas=Object.entries(consulta.sistemas).map(([s,v])=>{const p=[v.sinais.join(", "),v.observacoes].filter(Boolean); if(s==="Oftalmológico"&&oft.length)p.push(oft.join(" · ")); return [s,p.join(". ")] as const}).filter(([,t])=>t.trim());
    const detalhe=[
      `Queixa principal: ${consulta.queixa.trim()}`,
      `Tutor relata: ${[consulta.acessoRua&&`acesso à rua: ${consulta.acessoRua}`,consulta.contatoAnimais&&`contato com outros animais: ${consulta.contatoAnimais}`,consulta.ambiente&&`ambiente: ${consulta.ambiente}`,consulta.moradia&&`moradia: ${consulta.moradia}`,consulta.ventilacao&&`ventilação: ${consulta.ventilacao}`,consulta.apetite&&`apetite: ${consulta.apetite}`,consulta.exposicoes.length&&`exposição: ${consulta.exposicoes.join(", ")}`,consulta.vacinacao&&`vacinação: ${consulta.vacinacao}`,consulta.vermifugacao&&`vermifugação: ${consulta.vermifugacao}`,consulta.dieta&&`dieta: ${consulta.dieta}`,consulta.doencasPrevias&&`doenças prévias: ${consulta.doencasPrevias}`,consulta.medicamentosRecentes&&`medicamentos: ${consulta.medicamentosRecentes}`,consulta.alergias&&`alergias: ${consulta.alergias}`].filter(Boolean).join(" · ")||"sem informações adicionais"}`,
      ...(sistemas.length?["Observações por sistema:",...sistemas.map(([s,v])=>`- ${s}: ${v}`)]:[]),
      `Exame clínico: ${[consulta.peso&&`peso ${consulta.peso} kg`,consulta.temperatura&&`T ${consulta.temperatura} °C`,consulta.fc&&`FC ${consulta.fc}`,consulta.fr&&`FR ${consulta.fr}`,consulta.pas&&`PAS ${consulta.pas}`,consulta.glicemia&&`glicemia ${consulta.glicemia}`,consulta.mucosas&&`mucosas ${consulta.mucosas}`,consulta.hidratacao&&`hidratação ${consulta.hidratacao}`,consulta.dor&&`dor ${consulta.dor}`,consulta.exameGeral].filter(Boolean).join(" · ")||"não informado"}`,
      consulta.suspeitas&&`Hipóteses / suspeitas: ${consulta.suspeitas}`,
      consulta.conduta&&`Conduta / orientações: ${consulta.conduta}`,
      consulta.retorno&&`Retorno: ${consulta.retorno}`,
      consulta.medicacoes&&`Medicações / receita: ${consulta.medicacoes}`,
      consulta.examesSolicitados&&`Exames solicitados: ${consulta.examesSolicitados}`,
    ].filter(Boolean).join("\n");
    const pesoConsulta = consulta.peso.trim() ? pesoValido(consulta.peso) : "";
    if (consulta.peso.trim() && !pesoConsulta) return void toast.error("Informe um peso válido em kg.");
    const consultaSalva = { ...consulta, peso: pesoConsulta || animal.peso || "" };
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
    toast.success("Consulta salva no prontuário do animal.");
    navigate({to:"/animal",search:{animalId:animal.id} as never});
  }

  function salvarProcedimento(){ if(!procedimento.tipo.trim())return void toast.error("Informe a cirurgia ou procedimento."); const detalhe=[procedimento.indicacao&&`Indicação: ${procedimento.indicacao}`,procedimento.equipe&&`Equipe: ${procedimento.equipe}`,procedimento.anestesia&&`Anestesia / sedação: ${procedimento.anestesia}`,procedimento.achados&&`Achados: ${procedimento.achados}`,procedimento.materiais&&`Materiais / técnica: ${procedimento.materiais}`,procedimento.intercorrencias&&`Intercorrências: ${procedimento.intercorrencias}`,procedimento.posOperatorio&&`Pós-operatório: ${procedimento.posOperatorio}`,procedimento.observacoes&&`Observações: ${procedimento.observacoes}`].filter(Boolean).join("\n"); const atual=ler<RegistroProntuario>(PRONTUARIO_KEY); const novo:RegistroProntuario={id:crypto.randomUUID(),animalId:animal.id,tipo:"Registros clínicos",titulo:procedimento.tipo.trim(),detalhe,data,criadoEm:new Date().toISOString(),subtipo:"Cirurgia / Procedimentos",dados:procedimento}; localStorage.setItem(PRONTUARIO_KEY,JSON.stringify([novo,...atual])); toast.success("Procedimento salvo no prontuário."); navigate({to:"/animal",search:{animalId:animal.id} as never}); }

  return <main className="mx-auto min-h-screen w-full max-w-[1500px] px-3 pb-28 pt-3 sm:px-5">
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
        <div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-primary"><PawPrint size={22}/></div><div className="min-w-0"><div className="flex flex-wrap items-baseline gap-x-2"><h1 className="text-2xl font-black leading-none">{animal.nome}</h1><span className="text-xs font-bold uppercase tracking-wide text-primary">Registro clínico</span></div><p className="mt-1 truncate text-sm text-muted-foreground">{animal.especie||"Espécie não informada"}{animal.raca?` · ${animal.raca}`:""} · Tutor: <strong className="text-foreground">{tutor?.nome||"—"}</strong>{tutor?.telefone?` · ${tutor.telefone}`:""}</p></div></div>
        <Link to="/animal" search={{animalId:animal.id} as never} className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-bold"><ArrowLeft size={16}/> Ficha do animal</Link>
      </div>
      <div className="grid border-t sm:grid-cols-3">
        <ModoButton ativo={modo==="internacao"} icon={BedDouble} titulo="Internação" onClick={()=>setModo("internacao")}/>
        <ModoButton ativo={modo==="consulta"} icon={Stethoscope} titulo="Consulta" onClick={()=>{setModo("consulta");setEtapa(1);setConsulta(f=>({...f,peso:animal.peso||f.peso}))}}/>
        <ModoButton ativo={modo==="procedimento"} icon={Scissors} titulo="Cirurgia / Procedimentos" onClick={()=>setModo("procedimento")}/>
      </div>
    </section>

    {!modo&&<div className="mt-4 rounded-2xl border border-dashed bg-white/70 px-5 py-10 text-center"><ClipboardPlus className="mx-auto text-primary/40" size={36}/><h2 className="mt-3 text-lg font-black">O que você quer registrar?</h2><p className="mt-1 text-sm text-muted-foreground">Escolha uma das opções acima para começar.</p></div>}

    {modo==="internacao"&&<section className="mt-4 rounded-2xl border bg-white shadow-sm"><Cabecalho titulo="Internações" subtitulo="Histórico automático dos plantões finalizados deste animal."/><div className="p-3 sm:p-4">{internacoes.length?<div className="space-y-3">{internacoes.map(({plantao,registro},i)=><article key={`${plantao.id||i}-${registro.criadoEm||i}`} className="rounded-xl border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><strong>Plantão {dataBR(plantao.data)}</strong>{plantao.turno&&<span className="ml-2 text-sm text-muted-foreground">{plantao.turno}</span>}</div>{registro.peso&&<span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{registro.peso} kg</span>}</div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{registro.temperatura&&<Dado label="Temperatura" valor={`${registro.temperatura} °C`}/>} {registro.fc&&<Dado label="FC" valor={registro.fc}/>} {registro.fr&&<Dado label="FR" valor={registro.fr}/>} {registro.pas&&<Dado label="PAS" valor={registro.pas}/>} {registro.glicemia&&<Dado label="Glicemia" valor={registro.glicemia}/>} {registro.alimentacao&&<Dado label="Alimentação" valor={registro.alimentacao}/>} {registro.urina&&<Dado label="Urina" valor={registro.urina}/>} {registro.fezes&&<Dado label="Fezes" valor={registro.fezes}/>}</div>{registro.observacoes&&<p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/30 p-3 text-sm">{registro.observacoes}</p>}</article>)}</div>:<Vazio texto={`Nenhuma internação finalizada encontrada para ${animal.nome}.`}/>}</div></section>}

    {modo==="consulta"&&<section className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="grid lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="border-b bg-emerald-50/35 lg:border-b-0 lg:border-r">
          <div className="flex gap-2 overflow-x-auto p-2 lg:block lg:space-y-1 lg:p-3">{ETAPAS.map(item=><button key={item.n} onClick={()=>setEtapa(item.n)} className={`flex min-w-[150px] items-center gap-3 rounded-xl px-3 py-2.5 text-left transition lg:min-w-0 lg:w-full ${etapa===item.n?"bg-primary text-primary-foreground shadow-sm":"hover:bg-white"}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${etapa===item.n?"bg-white/20":"bg-white text-primary"}`}>{etapaPreenchida(item.n)?<Check size={14}/>:item.n}</span><span className="min-w-0"><span className="block text-sm font-black">{item.titulo}</span><span className={`hidden text-[11px] lg:block ${etapa===item.n?"text-white/75":"text-muted-foreground"}`}>{item.subtitulo}</span></span></button>)}</div>
        </aside>
        <div className="min-w-0">
          <div className="border-b px-4 py-3"><p className="text-xs font-black uppercase tracking-wider text-primary">Etapa {etapa} de 6</p><h2 className="mt-0.5 text-xl font-black">{ETAPAS[etapa-1].titulo}</h2><p className="text-sm text-muted-foreground">{ETAPAS[etapa-1].subtitulo}</p></div>
          <div className="p-4 sm:p-5">
            {etapa===1&&<EtapaTutor consulta={consulta} setConsulta={setConsulta} toggleExposicao={toggleExposicao}/>} 
            {etapa===2&&<Textarea grande label="Queixa principal *" value={consulta.queixa} onChange={v=>setConsulta({...consulta,queixa:v})} placeholder="Ex.: Tutor relata vômitos desde ontem, redução do apetite e apatia..."/>}
            {etapa===3&&<div className="space-y-2">{Object.entries(SISTEMAS).map(([sistema,sinais])=>{const item=consulta.sistemas[sistema]; const oftTem=sistema==="Oftalmológico"&&Object.entries(consulta.oftalmo).some(([,v])=>typeof v==="string"?v.trim():Object.values(v).some(x=>x.trim())); const tem=Boolean(item.sinais.length||item.observacoes.trim()||oftTem); const abertoAgora=aberto===sistema; return <div key={sistema} className={`overflow-hidden rounded-xl border ${tem?"border-primary/35 bg-primary/[0.02]":""}`}><button type="button" onClick={()=>setAberto(abertoAgora?null:sistema)} className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"><div className="flex items-center gap-2"><strong>{sistema}</strong>{tem&&<span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">preenchido</span>}</div>{abertoAgora?<ChevronUp size={17}/>:<ChevronDown size={17}/>}</button>{abertoAgora&&<div className="border-t p-3"><div className="flex flex-wrap gap-2">{sinais.length?sinais.map(sinal=><Chip key={sinal} ativo={item.sinais.includes(sinal)} onClick={()=>toggleSinal(sistema,sinal)}>{sinal}</Chip>):<span className="text-xs text-muted-foreground">Use o campo de observações.</span>}</div><textarea value={item.observacoes} onChange={e=>setConsulta(f=>({...f,sistemas:{...f.sistemas,[sistema]:{...item,observacoes:e.target.value}}}))} rows={3} placeholder="Observações deste sistema..." className="mt-3 w-full rounded-xl border p-3 text-sm outline-none focus:border-primary"/>{sistema==="Oftalmológico"&&<OftalmoCampos consulta={consulta} setConsulta={setConsulta} setOftalmoPar={setOftalmoPar}/>}</div>}</div>})}</div>}
            {etapa===4&&<><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Input label="Peso (kg)" value={consulta.peso} onChange={v=>setConsulta({...consulta,peso:v})}/><Input label="Temperatura (°C)" value={consulta.temperatura} onChange={v=>setConsulta({...consulta,temperatura:v})}/><Input label="FC (bpm)" value={consulta.fc} onChange={v=>setConsulta({...consulta,fc:v})}/><Input label="FR (mpm)" value={consulta.fr} onChange={v=>setConsulta({...consulta,fr:v})}/><Input label="PAS (mmHg)" value={consulta.pas} onChange={v=>setConsulta({...consulta,pas:v})}/><Input label="Glicemia (mg/dL)" value={consulta.glicemia} onChange={v=>setConsulta({...consulta,glicemia:v})}/><Select label="Mucosas" value={consulta.mucosas} onChange={v=>setConsulta({...consulta,mucosas:v})} opcoes={["Rosadas","Pálidas","Hiperêmicas","Ictéricas","Cianóticas","Congestas","Secas","Úmidas","Alteradas - outras"]}/><Input label="Hidratação" value={consulta.hidratacao} onChange={v=>setConsulta({...consulta,hidratacao:v})}/><Select label="Dor" value={consulta.dor} onChange={v=>setConsulta({...consulta,dor:v})} opcoes={["Ausente","Leve","Moderada","Intensa","Não avaliável"]}/><p className="md:col-span-5 text-xs font-medium text-muted-foreground">Referência normal para {animal?.especie || "cão"}: temperatura {normaisPara(animal?.especie).temperatura} · FC {normaisPara(animal?.especie).fc} · FR {normaisPara(animal?.especie).fr} · PAS {normaisPara(animal?.especie).pas} · glicemia {normaisPara(animal?.especie).glicemia}</p></div><div className="mt-3"><Textarea label="Exame físico / avaliação geral" value={consulta.exameGeral} onChange={v=>setConsulta({...consulta,exameGeral:v})}/></div></>}
            {etapa===5&&<><div className="grid gap-4 md:grid-cols-2"><Textarea grande label="Hipóteses / suspeitas" value={consulta.suspeitas} onChange={v=>setConsulta({...consulta,suspeitas:v})}/><Textarea grande label="Conduta / orientações" value={consulta.conduta} onChange={v=>setConsulta({...consulta,conduta:v})}/></div><div className="mt-4 max-w-lg"><Input label="Retorno" value={consulta.retorno} onChange={v=>setConsulta({...consulta,retorno:v})} placeholder="Ex.: 7 dias ou antes se piorar"/></div></>}
            {etapa===6&&<div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-2xl border bg-violet-50/35 p-4 sm:p-5"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><FileText size={22}/></div><div><h3 className="text-lg font-black">Receita</h3><p className="text-sm text-muted-foreground">Registre a prescrição desta consulta ou abra o receituário completo.</p></div></div><div className="mt-4"><Textarea label="Medicações / tratamento" value={consulta.medicacoes} onChange={v=>setConsulta({...consulta,medicacoes:v})} placeholder="Ex.: Dipirona 500 mg — administrar..."/></div><Link to="/receituario" search={{animalId:animal.id,tutorId:tutor?.id||""} as never} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-700 px-4 text-sm font-black text-white">Abrir receituário</Link></section>
              <section className="rounded-2xl border bg-sky-50/40 p-4 sm:p-5"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><FlaskConical size={22}/></div><div><h3 className="text-lg font-black">Pedido de exame</h3><p className="text-sm text-muted-foreground">Selecione um ou mais exames. Eles ficam vinculados a esta consulta.</p></div></div><div className="mt-4 flex flex-wrap gap-2">{EXAMES_OPCOES.map(nome=><Chip key={nome} ativo={examesSelecionados.includes(nome)} onClick={()=>toggleExame(nome)}>{nome}</Chip>)}</div><div className="mt-4"><Textarea label="Outros exames / observações" value={consulta.examesSolicitados} onChange={v=>setConsulta({...consulta,examesSolicitados:v})} placeholder="Você também pode complementar manualmente o pedido..."/></div></section>
            </div>}
          </div>
          <div className="sticky bottom-0 flex flex-wrap items-end justify-between gap-3 border-t bg-white/95 px-4 py-3 backdrop-blur sm:px-5"><label className="text-xs font-bold">Data da consulta<input type="date" value={data} onChange={e=>setData(e.target.value)} className="mt-1 block min-h-10 rounded-xl border bg-white px-3 text-sm font-normal"/></label><div className="ml-auto flex gap-2">{etapa>1&&<button onClick={()=>setEtapa(etapa-1)} className="rounded-xl border px-4 py-2.5 text-sm font-bold">Anterior</button>}{etapa<6?<button onClick={()=>setEtapa(etapa+1)} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground">Próximo</button>:<button onClick={salvarConsulta} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground"><Save size={16}/> Salvar consulta</button>}</div></div>
        </div>
      </div>
    </section>}

    {modo==="procedimento"&&<section className="mt-4 rounded-2xl border bg-white shadow-sm"><Cabecalho titulo="Cirurgia / Procedimentos" subtitulo="Registro objetivo do procedimento e do pós-operatório."/><div className="p-4 sm:p-5"><div className="grid gap-3 md:grid-cols-2"><Input label="Cirurgia / procedimento *" value={procedimento.tipo} onChange={v=>setProcedimento({...procedimento,tipo:v})}/><Input label="Equipe" value={procedimento.equipe} onChange={v=>setProcedimento({...procedimento,equipe:v})}/><Textarea label="Indicação" value={procedimento.indicacao} onChange={v=>setProcedimento({...procedimento,indicacao:v})}/><Textarea label="Anestesia / sedação" value={procedimento.anestesia} onChange={v=>setProcedimento({...procedimento,anestesia:v})}/><Textarea label="Achados" value={procedimento.achados} onChange={v=>setProcedimento({...procedimento,achados:v})}/><Textarea label="Materiais / técnica" value={procedimento.materiais} onChange={v=>setProcedimento({...procedimento,materiais:v})}/><Textarea label="Intercorrências" value={procedimento.intercorrencias} onChange={v=>setProcedimento({...procedimento,intercorrencias:v})}/><Textarea label="Pós-operatório" value={procedimento.posOperatorio} onChange={v=>setProcedimento({...procedimento,posOperatorio:v})}/></div><div className="mt-3"><Textarea label="Observações" value={procedimento.observacoes} onChange={v=>setProcedimento({...procedimento,observacoes:v})}/></div><div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t pt-4"><label className="text-sm font-bold">Data<input type="date" value={data} onChange={e=>setData(e.target.value)} className="mt-1 block min-h-10 rounded-xl border bg-white px-3 font-normal"/></label><button onClick={salvarProcedimento} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-primary-foreground"><Save size={17}/> Salvar registro</button></div></div></section>}
  </main>;
}

function EtapaTutor({consulta,setConsulta,toggleExposicao}:{consulta:ConsultaForm;setConsulta:React.Dispatch<React.SetStateAction<ConsultaForm>>;toggleExposicao:(x:string)=>void}){return <><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><SimNaoCampo label="Tem acesso à rua?" value={consulta.acessoRua} onChange={v=>setConsulta({...consulta,acessoRua:v})}/><SimNaoCampo label="Contato com outros animais?" value={consulta.contatoAnimais} onChange={v=>setConsulta({...consulta,contatoAnimais:v})}/><Select label="Ambiente" value={consulta.ambiente} onChange={v=>setConsulta({...consulta,ambiente:v})} opcoes={["Casa","Apartamento","Sítio / chácara","Canil / gatil","Outro"]}/><Select label="Moradia" value={consulta.moradia} onChange={v=>setConsulta({...consulta,moradia:v})} opcoes={["Interno","Externo","Misto","Não informado"]}/><Select label="Ventilação" value={consulta.ventilacao} onChange={v=>setConsulta({...consulta,ventilacao:v})} opcoes={["Boa","Regular","Ruim","Não informado"]}/><Select label="Apetite" value={consulta.apetite} onChange={v=>setConsulta({...consulta,apetite:v})} opcoes={["Normal","Reduzido","Ausente","Aumentado","Seletivo"]}/><Input label="Vacinação" value={consulta.vacinacao} onChange={v=>setConsulta({...consulta,vacinacao:v})}/><Input label="Vermifugação" value={consulta.vermifugacao} onChange={v=>setConsulta({...consulta,vermifugacao:v})}/></div><div className="mt-4"><div className="mb-2 text-sm font-bold">Exposição</div><div className="flex flex-wrap gap-2">{["Fumaça","Poeira","Produtos químicos","Queimadas","Plantas","Lixo","Animais silvestres"].map(x=><Chip key={x} ativo={consulta.exposicoes.includes(x)} onClick={()=>toggleExposicao(x)}>{x}</Chip>)}</div></div><div className="mt-4 grid gap-3 md:grid-cols-2"><Textarea label="Dieta / alimentação" value={consulta.dieta} onChange={v=>setConsulta({...consulta,dieta:v})}/><Textarea label="Doenças prévias" value={consulta.doencasPrevias} onChange={v=>setConsulta({...consulta,doencasPrevias:v})}/><Textarea label="Medicamentos recentes" value={consulta.medicamentosRecentes} onChange={v=>setConsulta({...consulta,medicamentosRecentes:v})}/><Textarea label="Alergias conhecidas" value={consulta.alergias} onChange={v=>setConsulta({...consulta,alergias:v})}/></div></>}
function ModoButton({ativo,icon:Icon,titulo,onClick}:{ativo:boolean;icon:typeof Stethoscope;titulo:string;onClick:()=>void}){return <button onClick={onClick} className={`flex min-h-12 items-center justify-center gap-2 border-t px-3 text-sm font-black first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0 ${ativo?"bg-primary text-primary-foreground":"bg-white hover:bg-emerald-50"}`}><Icon size={17}/>{titulo}</button>}
function Cabecalho({titulo,subtitulo}:{titulo:string;subtitulo:string}){return <div className="border-b bg-muted/20 px-4 py-3"><h2 className="flex items-center gap-2 text-lg font-black"><ClipboardPlus size={18} className="text-primary"/>{titulo}</h2><p className="mt-0.5 text-xs text-muted-foreground">{subtitulo}</p></div>}
function Input({label,value,onChange,placeholder}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string}){return <label className="block text-sm font-bold">{label}<input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="mt-1 min-h-10 w-full rounded-xl border bg-white px-3 font-normal outline-none focus:border-primary"/></label>}
function Textarea({label,value,onChange,placeholder,grande}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;grande?:boolean}){return <label className="block text-sm font-bold">{label}<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={grande?7:3} className="mt-1 w-full rounded-xl border bg-white p-3 font-normal outline-none focus:border-primary"/></label>}
function Select({label,value,onChange,opcoes}:{label:string;value:string;onChange:(v:string)=>void;opcoes:string[]}){return <label className="block text-sm font-bold">{label}<select value={value} onChange={e=>onChange(e.target.value)} className="mt-1 min-h-10 w-full rounded-xl border bg-white px-3 font-normal"><option value="">Selecione</option>{opcoes.map(x=><option key={x}>{x}</option>)}</select></label>}
function SimNaoCampo({label,value,onChange}:{label:string;value:SimNao;onChange:(v:SimNao)=>void}){return <div><div className="text-sm font-bold">{label}</div><div className="mt-1 flex gap-2">{(["Sim","Não"] as SimNao[]).map(x=><button key={x} type="button" onClick={()=>onChange(x)} className={`min-h-10 flex-1 rounded-xl border px-3 text-sm font-bold ${value===x?"border-primary bg-primary/10 text-primary":"bg-white"}`}>{x}</button>)}</div></div>}
function Chip({ativo,onClick,children}:{ativo:boolean;onClick:()=>void;children:React.ReactNode}){return <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${ativo?"border-primary bg-primary text-primary-foreground":"bg-white hover:border-primary/50"}`}>{children}</button>}
function Dado({label,valor}:{label:string;valor:string}){return <div className="rounded-lg bg-muted/30 px-3 py-2"><div className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-0.5 text-sm font-bold">{valor}</div></div>}
function Vazio({texto}:{texto:string}){return <div className="py-12 text-center text-sm text-muted-foreground"><BedDouble className="mx-auto mb-2 opacity-25" size={34}/>{texto}</div>}

function OftalmoCampos({consulta,setConsulta,setOftalmoPar}:{consulta:ConsultaForm;setConsulta:React.Dispatch<React.SetStateAction<ConsultaForm>>;setOftalmoPar:(chave:keyof Omit<OftalmoForm,"equipamentoTonometria">,olho:keyof OlhoValores,valor:string)=>void}){return <div className="mt-4 rounded-xl border bg-slate-50/50 p-3"><div className="mb-3"><h4 className="font-black">Exames oftalmológicos</h4><p className="text-xs text-muted-foreground">OD e OE. Preencha somente o que foi realizado.</p></div><div className="overflow-x-auto"><div className="min-w-[650px]"><div className="grid grid-cols-[170px_1fr_1fr] gap-2 border-b pb-2 text-xs font-black uppercase text-muted-foreground"><div>Teste</div><div>OD</div><div>OE</div></div><OftEntrada label="Schirmer" od={consulta.oftalmo.schirmer.od} oe={consulta.oftalmo.schirmer.oe} unidade="mm/min" onOd={v=>setOftalmoPar("schirmer","od",v)} onOe={v=>setOftalmoPar("schirmer","oe",v)}/><OftSelect label="Fluoresceína" od={consulta.oftalmo.fluoresceina.od} oe={consulta.oftalmo.fluoresceina.oe} opcoes={["Positivo","Negativo","Não realizado"]} onOd={v=>setOftalmoPar("fluoresceina","od",v)} onOe={v=>setOftalmoPar("fluoresceina","oe",v)}/><OftSelect label="Teste de Jones" od={consulta.oftalmo.jones.od} oe={consulta.oftalmo.jones.oe} opcoes={["Positivo","Negativo","Não realizado"]} onOd={v=>setOftalmoPar("jones","od",v)} onOe={v=>setOftalmoPar("jones","oe",v)}/><OftSelect label="Rosa Bengala" od={consulta.oftalmo.rosaBengala.od} oe={consulta.oftalmo.rosaBengala.oe} opcoes={["Positivo","Negativo","Não realizado"]} onOd={v=>setOftalmoPar("rosaBengala","od",v)} onOe={v=>setOftalmoPar("rosaBengala","oe",v)}/><OftSelect label="Lissamina Verde" od={consulta.oftalmo.lissaminaVerde.od} oe={consulta.oftalmo.lissaminaVerde.oe} opcoes={["Positivo","Negativo","Não realizado"]} onOd={v=>setOftalmoPar("lissaminaVerde","od",v)} onOe={v=>setOftalmoPar("lissaminaVerde","oe",v)}/><OftEntrada label="PIO" od={consulta.oftalmo.pio.od} oe={consulta.oftalmo.pio.oe} unidade="mmHg" onOd={v=>setOftalmoPar("pio","od",v)} onOe={v=>setOftalmoPar("pio","oe",v)}/></div></div><div className="mt-3 max-w-xl"><Input label="Equipamento de tonometria" value={consulta.oftalmo.equipamentoTonometria} onChange={v=>setConsulta(f=>({...f,oftalmo:{...f.oftalmo,equipamentoTonometria:v}}))}/></div><div className="mt-4 border-t pt-3"><h4 className="font-black">Reflexos e respostas</h4><div className="mt-2 overflow-x-auto"><div className="min-w-[650px]"><OftSelect label="Reflexo pupilar direto" od={consulta.oftalmo.reflexoPupilarDireto.od} oe={consulta.oftalmo.reflexoPupilarDireto.oe} opcoes={["Presente","Reduzido","Ausente","Não realizado"]} onOd={v=>setOftalmoPar("reflexoPupilarDireto","od",v)} onOe={v=>setOftalmoPar("reflexoPupilarDireto","oe",v)}/><OftSelect label="Reflexo pupilar consensual" od={consulta.oftalmo.reflexoPupilarConsensual.od} oe={consulta.oftalmo.reflexoPupilarConsensual.oe} opcoes={["Presente","Reduzido","Ausente","Não realizado"]} onOd={v=>setOftalmoPar("reflexoPupilarConsensual","od",v)} onOe={v=>setOftalmoPar("reflexoPupilarConsensual","oe",v)}/><OftSelect label="Deambulação" od={consulta.oftalmo.deambulacao.od} oe={consulta.oftalmo.deambulacao.oe} opcoes={["Normal","Alterada","Ausente","Não realizado"]} onOd={v=>setOftalmoPar("deambulacao","od",v)} onOe={v=>setOftalmoPar("deambulacao","oe",v)}/></div></div></div></div>}
function OftEntrada({label,od,oe,unidade,onOd,onOe}:{label:string;od:string;oe:string;unidade:string;onOd:(v:string)=>void;onOe:(v:string)=>void}){const campo=(valor:string,onChange:(v:string)=>void)=><div className="relative"><input value={valor} onChange={e=>onChange(e.target.value)} className="min-h-10 w-full rounded-xl border bg-white px-3 pr-16 text-sm"/><span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{unidade}</span></div>; return <div className="grid grid-cols-[170px_1fr_1fr] items-center gap-2 border-b py-2"><div className="text-sm font-semibold">{label}</div>{campo(od,onOd)}{campo(oe,onOe)}</div>}
function OftSelect({label,od,oe,opcoes,onOd,onOe}:{label:string;od:string;oe:string;opcoes:string[];onOd:(v:string)=>void;onOe:(v:string)=>void}){const campo=(valor:string,onChange:(v:string)=>void)=><select value={valor} onChange={e=>onChange(e.target.value)} className="min-h-10 w-full rounded-xl border bg-white px-2 text-sm"><option value="">Selecione</option>{opcoes.map(x=><option key={x}>{x}</option>)}</select>; return <div className="grid grid-cols-[170px_1fr_1fr] items-center gap-2 border-b py-2"><div className="text-sm font-semibold">{label}</div>{campo(od,onOd)}{campo(oe,onOe)}</div>}
