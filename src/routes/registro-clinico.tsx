import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BedDouble, ChevronDown, ChevronUp, ClipboardPlus, HeartPulse, PawPrint, Save, Scissors, Stethoscope } from "lucide-react";
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
type OftalmoForm = {
  schirmer: OlhoValores;
  fluoresceina: OlhoValores;
  jones: OlhoValores;
  rosaBengala: OlhoValores;
  lissaminaVerde: OlhoValores;
  pio: OlhoValores;
  equipamentoTonometria: string;
  reflexoPupilarDireto: OlhoValores;
  reflexoPupilarConsensual: OlhoValores;
  deambulacao: OlhoValores;
};

type ConsultaForm = {
  acessoRua: SimNao;
  contatoAnimais: SimNao;
  ambiente: string;
  moradia: string;
  ventilacao: string;
  apetite: string;
  exposicoes: string[];
  vacinacao: string;
  vermifugacao: string;
  dieta: string;
  doencasPrevias: string;
  medicamentosRecentes: string;
  alergias: string;
  queixa: string;
  sistemas: Record<string, { sinais: string[]; observacoes: string }>;
  oftalmo: OftalmoForm;
  peso: string;
  temperatura: string;
  fc: string;
  fr: string;
  pas: string;
  glicemia: string;
  mucosas: string;
  hidratacao: string;
  ecc: string;
  dor: string;
  exameGeral: string;
  suspeitas: string;
  examesSolicitados: string;
  medicacoes: string;
  conduta: string;
  retorno: string;
};

type ProcedimentoForm = {
  tipo: string;
  indicacao: string;
  equipe: string;
  anestesia: string;
  achados: string;
  materiais: string;
  intercorrencias: string;
  posOperatorio: string;
  observacoes: string;
};

const ANIMAIS_KEY = "oricse-animais-v1";
const TUTORES_KEY = "oricse-tutores-v1";
const PRONTUARIO_KEY = "oricse-prontuario-animal-v1";
const PLANTOES_KEY = "veterico-plantoes-v1";

const SISTEMAS: Record<string, string[]> = {
  "Digestivo": ["Anorexia", "Hiporexia", "Apetite caprichoso", "Polifagia", "Êmese", "Diarreia", "Melena", "Hematoquezia", "Muco nas fezes", "Tenesmo", "Polidipsia"],
  "Geniturinário": ["Hematúria", "Disúria", "Estrangúria", "Polaciúria", "Poliúria", "Oligúria", "Anúria", "Noctúria", "Secreção genital"],
  "Locomotor": ["Claudicação", "Dor", "Paresia", "Paralisia", "Dificuldade para levantar", "Dificuldade para saltar", "Dificuldade para vencer obstáculos"],
  "Tegumentar": ["Prurido", "Alopecia", "Lesões de pele", "Eritema", "Descamação", "Ferida", "Nódulo", "Secreção", "Desidratação"],
  "Oftalmológico": ["Secreção ocular", "Blefaroespasmo", "Epífora", "Hiperemia", "Opacidade", "Dor ocular", "Alteração visual"],
  "Respiratório": ["Tosse", "Espirros", "Secreção nasal", "Dispneia", "Taquipneia", "Ruído respiratório", "Intolerância ao exercício"],
  "Neurológico": ["Convulsão", "Head tilt", "Andar em círculos", "Ataxia", "Tremor", "Nistagmo", "Alteração de consciência", "Paresia"],
  "Cardiovascular": ["Síncope", "Cansaço", "Intolerância ao exercício", "Cianose", "Edema", "Tosse associada ao esforço"],
  "Endócrino / metabólico": ["Poliúria", "Polidipsia", "Polifagia", "Perda de peso", "Ganho de peso", "Fraqueza", "Alteração de pelagem"],
  "Hematológico": ["Palidez", "Petéquias", "Equimoses", "Sangramento", "Fraqueza", "Icterícia"],
  "Outros": [],
};

const vazioOlho = (): OlhoValores => ({ od: "", oe: "" });
function oftalmoVazio(): OftalmoForm {
  return {
    schirmer: vazioOlho(), fluoresceina: vazioOlho(), jones: vazioOlho(), rosaBengala: vazioOlho(), lissaminaVerde: vazioOlho(), pio: vazioOlho(), equipamentoTonometria: "",
    reflexoPupilarDireto: vazioOlho(), reflexoPupilarConsensual: vazioOlho(), deambulacao: vazioOlho(),
  };
}

function ler<T>(chave: string): T[] {
  if (typeof window === "undefined") return [];
  try { const v = JSON.parse(localStorage.getItem(chave) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}

function normalizar(v?: string) {
  return (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function hoje() { return new Date().toISOString().slice(0, 10); }
function dataBR(v?: string) { if (!v) return "—"; const [a,m,d] = v.slice(0,10).split("-"); return a && m && d ? `${d}/${m}/${a}` : v; }

function formConsultaVazio(): ConsultaForm {
  return {
    acessoRua: "", contatoAnimais: "", ambiente: "", moradia: "", ventilacao: "", apetite: "", exposicoes: [], vacinacao: "", vermifugacao: "", dieta: "", doencasPrevias: "", medicamentosRecentes: "", alergias: "", queixa: "",
    sistemas: Object.fromEntries(Object.keys(SISTEMAS).map((s) => [s, { sinais: [], observacoes: "" }])),
    oftalmo: oftalmoVazio(),
    peso: "", temperatura: "", fc: "", fr: "", pas: "", glicemia: "", mucosas: "", hidratacao: "", ecc: "", dor: "", exameGeral: "", suspeitas: "", examesSolicitados: "", medicacoes: "", conduta: "", retorno: "",
  };
}

function RegistroClinico() {
  const navigate = useNavigate();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const animalId = params.get("animalId") || "";
  const animais = useMemo(() => ler<Animal>(ANIMAIS_KEY), []);
  const tutores = useMemo(() => ler<Tutor>(TUTORES_KEY), []);
  const animal = animais.find((a) => a.id === animalId);
  const tutor = tutores.find((t) => t.id === animal?.tutorId);
  const [modo, setModo] = useState<"" | "internacao" | "consulta" | "procedimento">("");
  const [consulta, setConsulta] = useState<ConsultaForm>(formConsultaVazio);
  const [procedimento, setProcedimento] = useState<ProcedimentoForm>({ tipo: "", indicacao: "", equipe: "", anestesia: "", achados: "", materiais: "", intercorrencias: "", posOperatorio: "", observacoes: "" });
  const [aberto, setAberto] = useState<string | null>(null);
  const [data, setData] = useState(hoje());

  const chaveRascunho = `oricse-rascunho-consulta-${animalId}`;
  useEffect(() => {
    if (!animalId) return;
    try {
      const salvo = localStorage.getItem(chaveRascunho);
      if (salvo) {
        const bruto = JSON.parse(salvo);
        setConsulta({ ...formConsultaVazio(), ...bruto, oftalmo: { ...oftalmoVazio(), ...(bruto.oftalmo || {}) } });
      }
    } catch { /* ignora */ }
  }, [animalId]);
  useEffect(() => {
    if (!animalId || modo !== "consulta") return;
    const t = window.setTimeout(() => localStorage.setItem(chaveRascunho, JSON.stringify(consulta)), 250);
    return () => window.clearTimeout(t);
  }, [consulta, modo, animalId]);

  const internacoes = useMemo(() => {
    if (!animal) return [] as { plantao: Plantao; registro: RegistroPlantao }[];
    const nome = normalizar(animal.nome);
    const especie = normalizar(animal.especie);
    const itens: { plantao: Plantao; registro: RegistroPlantao }[] = [];
    ler<Plantao>(PLANTOES_KEY).forEach((plantao) => (plantao.registros || []).forEach((r) => {
      const mesmoNome = normalizar(r.animal) === nome;
      const mesmaEspecie = !especie || !normalizar(r.especie) || normalizar(r.especie).includes(especie) || especie.includes(normalizar(r.especie));
      if (mesmoNome && mesmaEspecie) itens.push({ plantao, registro: r });
    }));
    return itens.sort((a,b) => String(b.plantao.criadoEm || b.plantao.data || "").localeCompare(String(a.plantao.criadoEm || a.plantao.data || "")));
  }, [animal]);

  if (!animal) return <main className="mx-auto max-w-4xl px-4 py-8"><Link to="/animais" className="text-sm text-muted-foreground">← Voltar</Link><div className="mt-5 rounded-2xl border p-6">Animal não encontrado.</div></main>;

  function toggleExposicao(nome: string) { setConsulta((f) => ({ ...f, exposicoes: f.exposicoes.includes(nome) ? f.exposicoes.filter((x) => x !== nome) : [...f.exposicoes, nome] })); }
  function toggleSinal(sistema: string, sinal: string) { setConsulta((f) => ({ ...f, sistemas: { ...f.sistemas, [sistema]: { ...f.sistemas[sistema], sinais: f.sistemas[sistema].sinais.includes(sinal) ? f.sistemas[sistema].sinais.filter((x) => x !== sinal) : [...f.sistemas[sistema].sinais, sinal] } } })); }
  function setOftalmoPar(chave: keyof Omit<OftalmoForm, "equipamentoTonometria">, olho: keyof OlhoValores, valor: string) {
    setConsulta((f) => ({ ...f, oftalmo: { ...f.oftalmo, [chave]: { ...f.oftalmo[chave], [olho]: valor } } }));
  }

  function salvarConsulta() {
    if (!consulta.queixa.trim()) return void toast.error("Informe a queixa principal.");
    const o = consulta.oftalmo;
    const linhaPar = (rotulo: string, p: OlhoValores, unidade = "") => (p.od || p.oe) ? `${rotulo}: ${[p.od && `OD ${p.od}${unidade}`, p.oe && `OE ${p.oe}${unidade}`].filter(Boolean).join(" · ")}` : "";
    const oftalmoPreenchidos = [
      linhaPar("Schirmer", o.schirmer, " mm/min"),
      linhaPar("Fluoresceína", o.fluoresceina),
      linhaPar("Teste de Jones", o.jones),
      linhaPar("Rosa Bengala", o.rosaBengala),
      linhaPar("Lissamina Verde", o.lissaminaVerde),
      linhaPar("PIO", o.pio, " mmHg"),
      o.equipamentoTonometria && `Equipamento de tonometria: ${o.equipamentoTonometria}`,
      linhaPar("Reflexo pupilar direto", o.reflexoPupilarDireto),
      linhaPar("Reflexo pupilar consensual", o.reflexoPupilarConsensual),
      linhaPar("Deambulação", o.deambulacao),
    ].filter(Boolean) as string[];
    const sistemasPreenchidos = Object.entries(consulta.sistemas)
      .map(([sistema, v]) => {
        const partes = [v.sinais.join(", "), v.observacoes].filter(Boolean);
        if (sistema === "Oftalmológico" && oftalmoPreenchidos.length) partes.push(oftalmoPreenchidos.join(" · "));
        return [sistema, partes.join(". ")] as const;
      })
      .filter(([, texto]) => texto.trim());
    const detalhe = [
      `Queixa principal: ${consulta.queixa.trim()}`,
      `Tutor relata: ${[
        consulta.acessoRua && `acesso à rua: ${consulta.acessoRua}`,
        consulta.contatoAnimais && `contato com outros animais: ${consulta.contatoAnimais}`,
        consulta.ambiente && `ambiente: ${consulta.ambiente}`,
        consulta.moradia && `moradia: ${consulta.moradia}`,
        consulta.ventilacao && `ventilação: ${consulta.ventilacao}`,
        consulta.apetite && `apetite: ${consulta.apetite}`,
        consulta.exposicoes.length && `exposição: ${consulta.exposicoes.join(", ")}`,
        consulta.vacinacao && `vacinação: ${consulta.vacinacao}`,
        consulta.vermifugacao && `vermifugação: ${consulta.vermifugacao}`,
        consulta.dieta && `dieta: ${consulta.dieta}`,
        consulta.doencasPrevias && `doenças prévias: ${consulta.doencasPrevias}`,
        consulta.medicamentosRecentes && `medicamentos: ${consulta.medicamentosRecentes}`,
        consulta.alergias && `alergias: ${consulta.alergias}`,
      ].filter(Boolean).join(" · ") || "sem informações adicionais"}`,
      ...(sistemasPreenchidos.length ? ["Observações por sistema:", ...sistemasPreenchidos.map(([s,v]) => `- ${s}: ${v}`)] : []),
      `Exame clínico: ${[
        consulta.peso && `peso ${consulta.peso} kg`, consulta.temperatura && `T ${consulta.temperatura} °C`, consulta.fc && `FC ${consulta.fc}`, consulta.fr && `FR ${consulta.fr}`, consulta.pas && `PAS ${consulta.pas}`, consulta.glicemia && `glicemia ${consulta.glicemia}`, consulta.mucosas && `mucosas ${consulta.mucosas}`, consulta.hidratacao && `hidratação ${consulta.hidratacao}`, consulta.ecc && `ECC ${consulta.ecc}`, consulta.dor && `dor ${consulta.dor}`, consulta.exameGeral,
      ].filter(Boolean).join(" · ") || "não informado"}`,
      consulta.suspeitas && `Hipóteses / suspeitas: ${consulta.suspeitas}`,
      consulta.examesSolicitados && `Exames solicitados: ${consulta.examesSolicitados}`,
      consulta.medicacoes && `Medicações: ${consulta.medicacoes}`,
      consulta.conduta && `Conduta: ${consulta.conduta}`,
      consulta.retorno && `Retorno: ${consulta.retorno}`,
    ].filter(Boolean).join("\n");
    const atual = ler<RegistroProntuario>(PRONTUARIO_KEY);
    const novo: RegistroProntuario = { id: crypto.randomUUID(), animalId: animal.id, tipo: "Registros clínicos", titulo: "Consulta", detalhe, data, criadoEm: new Date().toISOString(), subtipo: "Consulta", dados: consulta };
    localStorage.setItem(PRONTUARIO_KEY, JSON.stringify([novo, ...atual]));
    localStorage.removeItem(chaveRascunho);
    toast.success("Consulta salva no prontuário do animal.");
    navigate({ to: "/animal", search: { animalId: animal.id } as never });
  }

  function salvarProcedimento() {
    if (!procedimento.tipo.trim()) return void toast.error("Informe a cirurgia ou procedimento.");
    const detalhe = [
      procedimento.indicacao && `Indicação: ${procedimento.indicacao}`,
      procedimento.equipe && `Equipe: ${procedimento.equipe}`,
      procedimento.anestesia && `Anestesia / sedação: ${procedimento.anestesia}`,
      procedimento.achados && `Achados: ${procedimento.achados}`,
      procedimento.materiais && `Materiais / técnica: ${procedimento.materiais}`,
      procedimento.intercorrencias && `Intercorrências: ${procedimento.intercorrencias}`,
      procedimento.posOperatorio && `Pós-operatório: ${procedimento.posOperatorio}`,
      procedimento.observacoes && `Observações: ${procedimento.observacoes}`,
    ].filter(Boolean).join("\n");
    const atual = ler<RegistroProntuario>(PRONTUARIO_KEY);
    const novo: RegistroProntuario = { id: crypto.randomUUID(), animalId: animal.id, tipo: "Registros clínicos", titulo: procedimento.tipo.trim(), detalhe, data, criadoEm: new Date().toISOString(), subtipo: "Cirurgia / Procedimentos", dados: procedimento };
    localStorage.setItem(PRONTUARIO_KEY, JSON.stringify([novo, ...atual]));
    toast.success("Procedimento salvo no prontuário.");
    navigate({ to: "/animal", search: { animalId: animal.id } as never });
  }

  return <main className="mx-auto min-h-screen w-full max-w-[1280px] px-4 pb-28 pt-5 sm:px-6">
    <Link to="/animal" search={{ animalId: animal.id } as never} className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={17}/> Voltar para {animal.nome}</Link>
    <div className="mt-4 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-primary">Registro clínico</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-black"><PawPrint className="text-primary"/> {animal.nome}</h1><p className="mt-1 text-sm text-muted-foreground">Tutor: <strong className="text-foreground">{tutor?.nome || "—"}</strong>{tutor?.telefone ? ` · ${tutor.telefone}` : ""}</p></div>{modo && <button type="button" onClick={() => setModo("")} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">Trocar tipo de registro</button>}</div>

    {!modo && <section className="mt-6 grid gap-4 md:grid-cols-3">
      <TipoCard icon={BedDouble} titulo="Internação" texto="Histórico gerado automaticamente ao finalizar um plantão." onClick={() => setModo("internacao")}/>
      <TipoCard icon={Stethoscope} titulo="Consulta" texto="Anamnese, queixa, sistemas, exame clínico e conduta em fluxo guiado." onClick={() => setModo("consulta")}/>
      <TipoCard icon={Scissors} titulo="Cirurgia / Procedimentos" texto="Registre procedimento, equipe, anestesia, achados e pós-operatório." onClick={() => setModo("procedimento")}/>
    </section>}

    {modo === "internacao" && <section className="mt-6 rounded-2xl border bg-white shadow-sm"><Cabecalho titulo="Internação" subtitulo="Os dados abaixo vêm do histórico de plantões finalizados."/>
      <div className="p-4">{internacoes.length ? <div className="space-y-3">{internacoes.map(({plantao, registro}, i) => <article key={`${plantao.id || i}-${registro.criadoEm || i}`} className="rounded-2xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-black">Plantão {dataBR(plantao.data)}{plantao.turno ? ` · ${plantao.turno}` : ""}</div><div className="text-xs text-muted-foreground">Registro de internação arquivado</div></div>{registro.peso && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{registro.peso} kg</span>}</div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">{registro.temperatura && <Dado label="Temperatura" valor={`${registro.temperatura} °C`}/>} {registro.fc && <Dado label="FC" valor={registro.fc}/>} {registro.fr && <Dado label="FR" valor={registro.fr}/>} {registro.pas && <Dado label="PAS" valor={registro.pas}/>} {registro.glicemia && <Dado label="Glicemia" valor={registro.glicemia}/>} {registro.alimentacao && <Dado label="Alimentação" valor={registro.alimentacao}/>} {registro.urina && <Dado label="Urina" valor={registro.urina}/>} {registro.fezes && <Dado label="Fezes" valor={registro.fezes}/>}</div>{registro.observacoes && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-muted/30 p-3 text-sm">{registro.observacoes}</p>}</article>)}</div> : <div className="py-12 text-center text-muted-foreground"><BedDouble className="mx-auto mb-3 opacity-30" size={38}/><p>Nenhuma internação finalizada encontrada para {animal.nome}.</p><p className="mt-1 text-xs">Quando um plantão desse animal for finalizado, ele aparecerá aqui automaticamente.</p></div>}</div>
    </section>}

    {modo === "consulta" && <div className="mt-6 space-y-4">
      <section className="rounded-2xl border bg-white shadow-sm"><Cabecalho titulo="Consulta" subtitulo="Preencha por blocos. O rascunho é salvo automaticamente enquanto você digita."/><div className="p-4 sm:p-5">
        <BlocoNumero numero="1" titulo="O que o tutor relata" descricao="Informações de rotina e histórico trazidas pelo responsável.">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <SimNaoCampo label="Tem acesso à rua?" value={consulta.acessoRua} onChange={(v) => setConsulta({...consulta, acessoRua:v})}/>
            <SimNaoCampo label="Contato com outros animais?" value={consulta.contatoAnimais} onChange={(v) => setConsulta({...consulta, contatoAnimais:v})}/>
            <Select label="Ambiente" value={consulta.ambiente} onChange={(v) => setConsulta({...consulta, ambiente:v})} opcoes={["Casa", "Apartamento", "Sítio / chácara", "Canil / gatil", "Outro"]}/>
            <Select label="Moradia" value={consulta.moradia} onChange={(v) => setConsulta({...consulta, moradia:v})} opcoes={["Interno", "Externo", "Misto", "Não informado"]}/>
            <Select label="Ventilação" value={consulta.ventilacao} onChange={(v) => setConsulta({...consulta, ventilacao:v})} opcoes={["Boa", "Regular", "Ruim", "Não informado"]}/>
            <Select label="Apetite" value={consulta.apetite} onChange={(v) => setConsulta({...consulta, apetite:v})} opcoes={["Normal", "Reduzido", "Ausente", "Aumentado", "Seletivo"]}/>
            <Input label="Vacinação" value={consulta.vacinacao} onChange={(v) => setConsulta({...consulta, vacinacao:v})}/>
            <Input label="Vermifugação" value={consulta.vermifugacao} onChange={(v) => setConsulta({...consulta, vermifugacao:v})}/>
          </div>
          <div className="mt-4"><div className="mb-2 text-sm font-bold">Exposição</div><div className="flex flex-wrap gap-2">{["Fumaça", "Poeira", "Produtos químicos", "Queimadas", "Plantas", "Lixo", "Animais silvestres"].map((x) => <Chip key={x} ativo={consulta.exposicoes.includes(x)} onClick={() => toggleExposicao(x)}>{x}</Chip>)}</div></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2"><Textarea label="Dieta / alimentação" value={consulta.dieta} onChange={(v) => setConsulta({...consulta,dieta:v})}/><Textarea label="Doenças prévias" value={consulta.doencasPrevias} onChange={(v) => setConsulta({...consulta,doencasPrevias:v})}/><Textarea label="Medicamentos recentes" value={consulta.medicamentosRecentes} onChange={(v) => setConsulta({...consulta,medicamentosRecentes:v})}/><Textarea label="Alergias conhecidas" value={consulta.alergias} onChange={(v) => setConsulta({...consulta,alergias:v})}/></div>
        </BlocoNumero>

        <BlocoNumero numero="2" titulo="Queixa principal" descricao="Escreva com as palavras importantes do tutor. Não precisa organizar tudo agora."><Textarea grande label="Queixa principal *" value={consulta.queixa} onChange={(v) => setConsulta({...consulta,queixa:v})} placeholder="Ex.: Tutor relata vômitos desde ontem, redução do apetite e apatia..."/></BlocoNumero>

        <BlocoNumero numero="3" titulo="Observações por sistema" descricao="Abra apenas os sistemas relevantes. Marque sinais rápidos e acrescente detalhes se precisar.">
          <div className="space-y-2">{Object.entries(SISTEMAS).map(([sistema,sinais]) => {
            const item = consulta.sistemas[sistema];
            const oftalmoTemAlgo = sistema === "Oftalmológico" && Object.entries(consulta.oftalmo).some(([, valor]) => typeof valor === "string" ? valor.trim() : Object.values(valor).some((v) => v.trim()));
            const temAlgo = item.sinais.length || item.observacoes.trim() || oftalmoTemAlgo;
            const estaAberto = aberto === sistema;
            return <div key={sistema} className={`overflow-hidden rounded-xl border ${temAlgo ? "border-primary/40 bg-primary/[0.025]" : "bg-white"}`}>
              <button type="button" onClick={() => setAberto(estaAberto ? null : sistema)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"><div><span className="font-black">{sistema}</span>{temAlgo && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">preenchido</span>}</div>{estaAberto ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}</button>
              {estaAberto && <div className="border-t px-4 py-4">
                <div className="flex flex-wrap gap-2">{sinais.length ? sinais.map((sinal) => <Chip key={sinal} ativo={item.sinais.includes(sinal)} onClick={() => toggleSinal(sistema,sinal)}>{sinal}</Chip>) : <span className="text-xs text-muted-foreground">Use o campo de observações para este sistema.</span>}</div>
                <textarea value={item.observacoes} onChange={(e) => setConsulta((f) => ({...f, sistemas:{...f.sistemas,[sistema]:{...item,observacoes:e.target.value}}}))} rows={3} placeholder="Observações deste sistema..." className="mt-3 w-full rounded-xl border p-3 text-sm outline-none focus:border-primary"/>
                {sistema === "Oftalmológico" && <OftalmoCampos consulta={consulta} setConsulta={setConsulta} setOftalmoPar={setOftalmoPar}/>} 
              </div>}
            </div>;
          })}</div>
        </BlocoNumero>

        <BlocoNumero numero="4" titulo="Exame clínico" descricao="Parâmetros essenciais primeiro; detalhes livres ficam no final."><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Input label="Peso (kg)" value={consulta.peso} onChange={(v)=>setConsulta({...consulta,peso:v})}/><Input label="Temperatura (°C)" value={consulta.temperatura} onChange={(v)=>setConsulta({...consulta,temperatura:v})}/><Input label="FC (bpm)" value={consulta.fc} onChange={(v)=>setConsulta({...consulta,fc:v})}/><Input label="FR (mpm)" value={consulta.fr} onChange={(v)=>setConsulta({...consulta,fr:v})}/><Input label="PAS (mmHg)" value={consulta.pas} onChange={(v)=>setConsulta({...consulta,pas:v})}/><Input label="Glicemia (mg/dL)" value={consulta.glicemia} onChange={(v)=>setConsulta({...consulta,glicemia:v})}/><Input label="Mucosas" value={consulta.mucosas} onChange={(v)=>setConsulta({...consulta,mucosas:v})}/><Input label="Hidratação" value={consulta.hidratacao} onChange={(v)=>setConsulta({...consulta,hidratacao:v})}/><Input label="ECC" value={consulta.ecc} onChange={(v)=>setConsulta({...consulta,ecc:v})}/><Input label="Dor" value={consulta.dor} onChange={(v)=>setConsulta({...consulta,dor:v})}/></div><div className="mt-3"><Textarea label="Exame físico / avaliação geral" value={consulta.exameGeral} onChange={(v)=>setConsulta({...consulta,exameGeral:v})}/></div></BlocoNumero>

        <BlocoNumero numero="5" titulo="Conduta" descricao="Feche a consulta com o que foi pensado, solicitado e orientado."><div className="grid gap-3 md:grid-cols-2"><Textarea label="Hipóteses / suspeitas" value={consulta.suspeitas} onChange={(v)=>setConsulta({...consulta,suspeitas:v})}/><Textarea label="Exames solicitados" value={consulta.examesSolicitados} onChange={(v)=>setConsulta({...consulta,examesSolicitados:v})}/><Textarea label="Medicações / tratamento" value={consulta.medicacoes} onChange={(v)=>setConsulta({...consulta,medicacoes:v})}/><Textarea label="Conduta / orientações" value={consulta.conduta} onChange={(v)=>setConsulta({...consulta,conduta:v})}/></div><div className="mt-3 max-w-md"><Input label="Retorno" value={consulta.retorno} onChange={(v)=>setConsulta({...consulta,retorno:v})} placeholder="Ex.: 7 dias ou antes se piorar"/></div></BlocoNumero>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3 rounded-2xl border bg-muted/20 p-4"><label className="text-sm font-bold">Data da consulta<input type="date" value={data} onChange={(e)=>setData(e.target.value)} className="mt-1 block min-h-11 rounded-xl border bg-white px-3 font-normal"/></label><button type="button" onClick={salvarConsulta} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-6 font-black text-primary-foreground"><Save size={18}/> Salvar consulta</button></div>
      </div></section>
    </div>}

    {modo === "procedimento" && <section className="mt-6 rounded-2xl border bg-white shadow-sm"><Cabecalho titulo="Cirurgia / Procedimentos" subtitulo="Registro objetivo do procedimento e do pós-operatório."/><div className="space-y-4 p-4 sm:p-5"><div className="grid gap-3 md:grid-cols-2"><Input label="Cirurgia / procedimento *" value={procedimento.tipo} onChange={(v)=>setProcedimento({...procedimento,tipo:v})}/><Input label="Equipe" value={procedimento.equipe} onChange={(v)=>setProcedimento({...procedimento,equipe:v})}/><Textarea label="Indicação" value={procedimento.indicacao} onChange={(v)=>setProcedimento({...procedimento,indicacao:v})}/><Textarea label="Anestesia / sedação" value={procedimento.anestesia} onChange={(v)=>setProcedimento({...procedimento,anestesia:v})}/><Textarea label="Achados" value={procedimento.achados} onChange={(v)=>setProcedimento({...procedimento,achados:v})}/><Textarea label="Materiais / técnica" value={procedimento.materiais} onChange={(v)=>setProcedimento({...procedimento,materiais:v})}/><Textarea label="Intercorrências" value={procedimento.intercorrencias} onChange={(v)=>setProcedimento({...procedimento,intercorrencias:v})}/><Textarea label="Pós-operatório" value={procedimento.posOperatorio} onChange={(v)=>setProcedimento({...procedimento,posOperatorio:v})}/></div><Textarea label="Observações" value={procedimento.observacoes} onChange={(v)=>setProcedimento({...procedimento,observacoes:v})}/><div className="flex flex-wrap items-end justify-between gap-3"><label className="text-sm font-bold">Data<input type="date" value={data} onChange={(e)=>setData(e.target.value)} className="mt-1 block min-h-11 rounded-xl border bg-white px-3 font-normal"/></label><button type="button" onClick={salvarProcedimento} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-6 font-black text-primary-foreground"><Save size={18}/> Salvar registro</button></div></div></section>}
  </main>;
}

function OftalmoCampos({ consulta, setConsulta, setOftalmoPar }: { consulta: ConsultaForm; setConsulta: React.Dispatch<React.SetStateAction<ConsultaForm>>; setOftalmoPar: (chave: keyof Omit<OftalmoForm, "equipamentoTonometria">, olho: keyof OlhoValores, valor: string) => void }) {
  return <div className="mt-5 rounded-xl border bg-slate-50/50 p-3 sm:p-4">
    <div className="mb-3"><h4 className="font-black">Exames oftalmológicos</h4><p className="mt-0.5 text-xs text-muted-foreground">OD (olho direito) e OE (olho esquerdo). Preencha apenas os testes realizados.</p></div>
    <div className="overflow-x-auto"><div className="min-w-[680px]">
      <div className="grid grid-cols-[180px_1fr_1fr] gap-2 border-b pb-2 text-xs font-black uppercase tracking-wide text-muted-foreground"><div>Teste</div><div>OD</div><div>OE</div></div>
      <OftalmoLinhaEntrada label="Schirmer" od={consulta.oftalmo.schirmer.od} oe={consulta.oftalmo.schirmer.oe} unidade="mm/min" onOd={(v)=>setOftalmoPar("schirmer","od",v)} onOe={(v)=>setOftalmoPar("schirmer","oe",v)}/>
      <OftalmoLinhaSelect label="Fluoresceína" od={consulta.oftalmo.fluoresceina.od} oe={consulta.oftalmo.fluoresceina.oe} opcoes={["Positivo","Negativo","Não realizado"]} onOd={(v)=>setOftalmoPar("fluoresceina","od",v)} onOe={(v)=>setOftalmoPar("fluoresceina","oe",v)}/>
      <OftalmoLinhaSelect label="Teste de Jones" od={consulta.oftalmo.jones.od} oe={consulta.oftalmo.jones.oe} opcoes={["Positivo","Negativo","Não realizado"]} onOd={(v)=>setOftalmoPar("jones","od",v)} onOe={(v)=>setOftalmoPar("jones","oe",v)}/>
      <OftalmoLinhaSelect label="Rosa Bengala" od={consulta.oftalmo.rosaBengala.od} oe={consulta.oftalmo.rosaBengala.oe} opcoes={["Positivo","Negativo","Não realizado"]} onOd={(v)=>setOftalmoPar("rosaBengala","od",v)} onOe={(v)=>setOftalmoPar("rosaBengala","oe",v)}/>
      <OftalmoLinhaSelect label="Lissamina Verde" od={consulta.oftalmo.lissaminaVerde.od} oe={consulta.oftalmo.lissaminaVerde.oe} opcoes={["Positivo","Negativo","Não realizado"]} onOd={(v)=>setOftalmoPar("lissaminaVerde","od",v)} onOe={(v)=>setOftalmoPar("lissaminaVerde","oe",v)}/>
      <OftalmoLinhaEntrada label="PIO" od={consulta.oftalmo.pio.od} oe={consulta.oftalmo.pio.oe} unidade="mmHg" onOd={(v)=>setOftalmoPar("pio","od",v)} onOe={(v)=>setOftalmoPar("pio","oe",v)}/>
    </div></div>
    <div className="mt-3 max-w-xl"><Input label="Equipamento de tonometria (opcional)" value={consulta.oftalmo.equipamentoTonometria} onChange={(v)=>setConsulta((f)=>({...f,oftalmo:{...f.oftalmo,equipamentoTonometria:v}}))}/></div>
    <div className="mt-5 border-t pt-4"><h4 className="font-black">Reflexos e respostas</h4><div className="mt-3 overflow-x-auto"><div className="min-w-[680px]"><div className="grid grid-cols-[260px_1fr_1fr] gap-2 border-b pb-2 text-xs font-black uppercase tracking-wide text-muted-foreground"><div>Avaliação</div><div>OD</div><div>OE</div></div>
      <OftalmoLinhaSelect largo label="Reflexo pupilar direto" od={consulta.oftalmo.reflexoPupilarDireto.od} oe={consulta.oftalmo.reflexoPupilarDireto.oe} opcoes={["Presente","Reduzido","Ausente","Não realizado"]} onOd={(v)=>setOftalmoPar("reflexoPupilarDireto","od",v)} onOe={(v)=>setOftalmoPar("reflexoPupilarDireto","oe",v)}/>
      <OftalmoLinhaSelect largo label="Reflexo pupilar consensual" od={consulta.oftalmo.reflexoPupilarConsensual.od} oe={consulta.oftalmo.reflexoPupilarConsensual.oe} opcoes={["Presente","Reduzido","Ausente","Não realizado"]} onOd={(v)=>setOftalmoPar("reflexoPupilarConsensual","od",v)} onOe={(v)=>setOftalmoPar("reflexoPupilarConsensual","oe",v)}/>
      <OftalmoLinhaSelect largo label="Deambulação" od={consulta.oftalmo.deambulacao.od} oe={consulta.oftalmo.deambulacao.oe} opcoes={["Normal","Alterada","Ausente","Não realizado"]} onOd={(v)=>setOftalmoPar("deambulacao","od",v)} onOe={(v)=>setOftalmoPar("deambulacao","oe",v)}/>
    </div></div></div>
  </div>;
}

function TipoCard({ icon: Icon, titulo, texto, onClick }: { icon: typeof HeartPulse; titulo: string; texto: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="group rounded-2xl border-2 bg-white p-5 text-left shadow-sm transition hover:border-primary hover:shadow-md"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={22}/></div><div className="mt-4 text-xl font-black">{titulo}</div><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{texto}</p><div className="mt-4 text-sm font-black text-primary">Abrir →</div></button>; }
function Cabecalho({ titulo, subtitulo }: { titulo: string; subtitulo: string }) { return <div className="border-b bg-muted/20 px-4 py-4 sm:px-5"><h2 className="flex items-center gap-2 text-xl font-black"><ClipboardPlus size={20} className="text-primary"/>{titulo}</h2><p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p></div>; }
function BlocoNumero({ numero, titulo, descricao, children }: { numero: string; titulo: string; descricao: string; children: React.ReactNode }) { return <section className="mt-5 rounded-2xl border bg-white p-4 first:mt-0 sm:p-5"><div className="mb-4 flex items-start gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-black text-primary-foreground">{numero}</div><div><h3 className="font-black">{titulo}</h3><p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p></div></div>{children}</section>; }
function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v:string)=>void; placeholder?: string }) { return <label className="block text-sm font-bold">{label}<input value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 font-normal outline-none focus:border-primary"/></label>; }
function Textarea({ label, value, onChange, placeholder, grande }: { label:string; value:string; onChange:(v:string)=>void; placeholder?:string; grande?:boolean }) { return <label className="block text-sm font-bold">{label}<textarea value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} rows={grande?5:3} className="mt-1 w-full rounded-xl border bg-white p-3 font-normal outline-none focus:border-primary"/></label>; }
function Select({ label, value, onChange, opcoes }: { label:string; value:string; onChange:(v:string)=>void; opcoes:string[] }) { return <label className="block text-sm font-bold">{label}<select value={value} onChange={(e)=>onChange(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 font-normal"><option value="">Selecione</option>{opcoes.map((x)=><option key={x}>{x}</option>)}</select></label>; }
function SimNaoCampo({ label, value, onChange }: { label:string; value:SimNao; onChange:(v:SimNao)=>void }) { return <div><div className="text-sm font-bold">{label}</div><div className="mt-1 flex gap-2">{(["Sim","Não"] as SimNao[]).map((x)=><button key={x} type="button" onClick={()=>onChange(x)} className={`min-h-11 flex-1 rounded-xl border px-3 text-sm font-bold ${value===x?"border-primary bg-primary/10 text-primary":"bg-white"}`}>{x}</button>)}</div></div>; }
function Chip({ ativo, onClick, children }: { ativo:boolean; onClick:()=>void; children:React.ReactNode }) { return <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${ativo?"border-primary bg-primary text-primary-foreground":"bg-white hover:border-primary/50"}`}>{children}</button>; }
function Dado({ label, valor }: { label:string; valor:string }) { return <div className="rounded-xl bg-muted/30 px-3 py-2"><div className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-0.5 font-bold">{valor}</div></div>; }
function OftalmoLinhaEntrada({ label, od, oe, unidade, onOd, onOe }: { label:string; od:string; oe:string; unidade:string; onOd:(v:string)=>void; onOe:(v:string)=>void }) { const campoOlho=(valor:string,onChange:(v:string)=>void)=><div className="relative"><input inputMode="decimal" value={valor} onChange={(e)=>onChange(e.target.value)} className="min-h-11 w-full rounded-xl border bg-white px-3 pr-20 text-sm outline-none focus:border-primary"/><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unidade}</span></div>; return <div className="grid grid-cols-[180px_1fr_1fr] items-center gap-2 border-b py-2 last:border-b-0"><div className="text-sm font-semibold">{label}</div>{campoOlho(od,onOd)}{campoOlho(oe,onOe)}</div>; }
function OftalmoLinhaSelect({ label, od, oe, opcoes, onOd, onOe, largo }: { label:string; od:string; oe:string; opcoes:string[]; onOd:(v:string)=>void; onOe:(v:string)=>void; largo?:boolean }) { const cls=largo?"grid-cols-[260px_1fr_1fr]":"grid-cols-[180px_1fr_1fr]"; const campoOlho=(valor:string,onChange:(v:string)=>void)=><select value={valor} onChange={(e)=>onChange(e.target.value)} className="min-h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-primary"><option value="">Selecione</option>{opcoes.map((x)=><option key={x}>{x}</option>)}</select>; return <div className={`grid ${cls} items-center gap-2 border-b py-2 last:border-b-0`}><div className="text-sm font-semibold">{label}</div>{campoOlho(od,onOd)}{campoOlho(oe,onOe)}</div>; }
