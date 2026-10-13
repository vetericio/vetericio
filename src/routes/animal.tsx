import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BedDouble, CalendarDays, ClipboardList, FileText, FlaskConical, Image, Pencil, Plus, ReceiptText, Scale, Scissors, Stethoscope, Syringe, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FotoAnimalDrive } from "@/components/animal/FotoAnimalDrive";
import { AgendamentosAnimal } from "@/components/animal/AgendamentosAnimal";
import { ObservacoesAnimal } from "@/components/animal/ObservacoesAnimal";

export const Route = createFileRoute("/animal")({ component: AnimalFicha });

type Tutor = {
  id: string;
  nome: string;
  telefone?: string;
  outroTelefone?: string;
  email?: string;
  cpfCnpj?: string;
  codigoPublico?: string;
  codigo?: string;
};

type Animal = {
  id: string;
  tutorId: string;
  nome: string;
  nascimento?: string;
  especie?: string;
  raca?: string;
  sexo?: string;
  cor?: string;
  pelagem?: string;
  porte?: string;
  peso?: string;
  escoreCorporal?: string;
  castrado?: string;
  microchip?: string;
  temperamentos?: string[];
  comportamento?: string;
  origem?: string;
  chegadaTutor?: string;
  tipoSanguineo?: string;
  alergias?: string;
  doencasCronicas?: string;
  medicamentosContinuos?: string;
  dieta?: string;
  restricoes?: string;
  necessidadesEspeciais?: string;
  veterinarioReferencia?: string;
  alerta?: string;
  observacoes?: string;
  criadoEm?: string;
};

type RegistroTipo = "Registros clínicos" | "Vacinas" | "Receitas" | "Exames" | "Agendamentos" | "Internações" | "Termos" | "Observações" | "Documentos" | "Galeria";
type Registro = {
  id: string;
  animalId: string;
  tipo: RegistroTipo;
  titulo: string;
  detalhe?: string;
  data: string;
  criadoEm: string;
  subtipo?: string;
  autorId?: string;
  autorNome?: string;
  autorCrmv?: string;
  atualizadoEm?: string;
};
type PesoRegistro = { id: string; animalId: string; peso: number; data: string; criadoEm: string };

const TUTORES_KEY = "oricse-tutores-v1";
const ANIMAIS_KEY = "oricse-animais-v1";
const PRONTUARIO_KEY = "oricse-prontuario-animal-v1";
const PESOS_KEY = "oricse-pesos-animal-v1";
const ABAS = ["Visão geral", "Registros clínicos", "Vacinas", "Receitas", "Exames", "Agendamentos", "Internações", "Termos", "Observações", "Documentos", "Galeria"] as const;
type Aba = typeof ABAS[number];

function ler<T>(chave: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const valor = JSON.parse(localStorage.getItem(chave) || "[]");
    return Array.isArray(valor) ? valor : [];
  } catch { return []; }
}

function idade(nascimento?: string) {
  if (!nascimento) return "Não informada";
  const n = new Date(`${nascimento}T12:00:00`);
  if (Number.isNaN(n.getTime())) return "Não informada";
  const hoje = new Date();
  let anos = hoje.getFullYear() - n.getFullYear();
  let meses = hoje.getMonth() - n.getMonth();
  if (hoje.getDate() < n.getDate()) meses--;
  if (meses < 0) { anos--; meses += 12; }
  if (anos <= 0) return `${Math.max(0, meses)} meses`;
  return meses ? `${anos}a ${meses}m` : `${anos} anos`;
}

function formatarData(data?: string) {
  if (!data) return "—";
  try { return new Intl.DateTimeFormat("pt-BR").format(new Date(`${data.slice(0,10)}T12:00:00`)); } catch { return data; }
}

function numeroPeso(valor?: string) {
  if (!valor) return NaN;
  const texto = String(valor).trim();
  // Com vírgula, os pontos são separadores de milhar. Com ponto sozinho, ele é decimal.
  return Number(texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto);
}

function formatarPeso(valor?: number | string) {
  const n = typeof valor === "number" ? valor : numeroPeso(valor);
  if (!Number.isFinite(n)) return "não informado";
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;
}
function pesoPorDigitacao(valor: string) {
  const digitos = valor.replace(/\D/g, "");
  return digitos ? (Number(digitos) / 1000).toFixed(3) : "";
}
function pesoParaCampo(valor: string) {
  const n = Number(valor);
  return Number.isFinite(n) ? n.toFixed(3).replace(".", ",") : "";
}

function iconFor(tipo: Aba) {
  if (tipo === "Vacinas") return Syringe;
  if (tipo === "Receitas") return ReceiptText;
  if (tipo === "Exames") return FlaskConical;
  if (tipo === "Agendamentos") return CalendarDays;
  if (tipo === "Internações") return BedDouble;
  if (tipo === "Documentos" || tipo === "Termos") return FileText;
  if (tipo === "Galeria") return Image;
  return ClipboardList;
}

function AnimalFicha() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const animalId = params.get("animalId") || "";
  const animais = useMemo(() => ler<Animal>(ANIMAIS_KEY), []);
  const tutores = useMemo(() => ler<Tutor>(TUTORES_KEY), []);
  const animal = animais.find((a) => a.id === animalId);
  const tutor = tutores.find((t) => t.id === animal?.tutorId);
  const [aba, setAba] = useState<Aba>("Visão geral");
  const [registros, setRegistros] = useState<Registro[]>(() => ler<Registro>(PRONTUARIO_KEY));
  const [pesos, setPesos] = useState<PesoRegistro[]>(() => ler<PesoRegistro>(PESOS_KEY));
  const [modalTipo, setModalTipo] = useState<RegistroTipo | null>(null);
  const [modalPeso, setModalPeso] = useState(false);
  const [pesoNovo, setPesoNovo] = useState("");
  const [dataPeso, setDataPeso] = useState(() => new Date().toISOString().slice(0, 10));
  const [titulo, setTitulo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));

  const registrosAnimal = useMemo(() => registros.filter((r) => r.animalId === animalId).sort((a,b) => `${b.data}${b.criadoEm}`.localeCompare(`${a.data}${a.criadoEm}`)), [registros, animalId]);
  const pesosAnimal = useMemo(() => pesos.filter((p) => p.animalId === animalId).sort((a,b) => `${b.data}${b.criadoEm}`.localeCompare(`${a.data}${a.criadoEm}`)), [pesos, animalId]);
  const codigoTutor = tutor?.codigoPublico || tutor?.codigo || "";
  const pesoAtual = pesosAnimal[0] || (animal?.peso && Number.isFinite(numeroPeso(animal.peso)) ? { id: "cadastro", animalId, peso: numeroPeso(animal.peso), data: animal.criadoEm?.slice(0,10) || "", criadoEm: animal.criadoEm || "" } : null);
  const historicoPeso = pesosAnimal.length ? pesosAnimal.slice(1) : [];

  function abrirNovo(tipo: RegistroTipo) {
    if (tipo === "Agendamentos" && animal) {
      window.location.href = `/encaminhar?tutorId=${encodeURIComponent(animal.tutorId)}&animalId=${encodeURIComponent(animal.id)}`;
      return;
    }
    if (tipo === "Observações") {
      setAba("Observações");
      return;
    }
    setModalTipo(tipo);
    setTitulo(""); setDetalhe(""); setData(new Date().toISOString().slice(0,10));
  }

  function salvarRegistro() {
    if (!animal || !modalTipo) return;
    if (!titulo.trim()) return void toast.error("Informe o título do registro.");
    const novo: Registro = { id: crypto.randomUUID(), animalId: animal.id, tipo: modalTipo, titulo: titulo.trim(), detalhe: detalhe.trim(), data, criadoEm: new Date().toISOString() };
    const lista = [novo, ...registros];
    setRegistros(lista);
    localStorage.setItem(PRONTUARIO_KEY, JSON.stringify(lista));
    setModalTipo(null);
    toast.success(`${modalTipo} adicionado.`);
  }

  function salvarPeso() {
    if (!animal) return;
    const n = numeroPeso(pesoNovo);
    if (!Number.isFinite(n) || n <= 0) return void toast.error("Informe um peso válido.");
    const novo: PesoRegistro = { id: crypto.randomUUID(), animalId: animal.id, peso: n, data: dataPeso, criadoEm: new Date().toISOString() };
    const lista = [novo, ...pesos];
    setPesos(lista);
    localStorage.setItem(PESOS_KEY, JSON.stringify(lista));
    setModalPeso(false);
    setPesoNovo("");
    toast.success(`Peso de ${formatarPeso(n)} registrado.`);
  }

  if (!animal) return <main className="mx-auto max-w-5xl px-4 py-8"><Link to="/animais" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar</Link><div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">Animal não encontrado.</div></main>;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1760px] px-3 pb-28 pt-4 sm:px-5">
      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:block"><div className="sticky top-4 overflow-hidden rounded-2xl border bg-white shadow-sm"><nav className="p-2">{ABAS.map((nome) => { const Icon = iconFor(nome); const ativo = aba === nome; return <button key={nome} type="button" onClick={() => setAba(nome)} className={`relative mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${ativo ? "bg-emerald-50 text-emerald-800" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}>{ativo && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-emerald-700"/>}<Icon size={18} className={ativo ? "text-emerald-700" : "text-muted-foreground"}/><span>{nome}</span></button>; })}</nav></div></aside>

        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3"><Link to="/animais" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Animais</Link><Link to="/novo-animal" search={{ animalId: animal.id } as never} className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-bold"><Pencil size={16}/> Editar animal</Link></div>

          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="grid gap-5 p-4 lg:grid-cols-[1.5fr_1fr] lg:p-5">
              <div className="flex items-start gap-4"><FotoAnimalDrive animalId={animal.id} nome={animal.nome}/><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-3xl font-black">{animal.nome}</h1>{animal.alerta && <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-bold text-destructive">⚠ {animal.alerta}</span>}</div><div className="mt-2 grid gap-x-5 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-3"><span><strong className="text-foreground">Espécie:</strong> {animal.especie || "—"}</span><span><strong className="text-foreground">Raça:</strong> {animal.raca || "—"}</span><span><strong className="text-foreground">Sexo:</strong> {animal.sexo || "—"}</span><span><strong className="text-foreground">Idade:</strong> {idade(animal.nascimento)}</span><span><strong className="text-foreground">Peso:</strong> {pesoAtual ? formatarPeso(pesoAtual.peso) : "—"}</span><span><strong className="text-foreground">Castrado:</strong> {animal.castrado || "—"}</span><span><strong className="text-foreground">Microchip:</strong> {animal.microchip || "—"}</span><span><strong className="text-foreground">Cor:</strong> {animal.cor || "—"}</span><span><strong className="text-foreground">Tipo sanguíneo:</strong> {animal.tipoSanguineo || "—"}</span></div></div></div>
              <div className="rounded-2xl border bg-muted/20 p-4"><div className="flex items-center gap-2 text-sm font-black"><UserRound size={17} className="text-primary"/> Tutor</div><div className="mt-2 text-lg font-black">{tutor?.nome || "Tutor não encontrado"} {codigoTutor && <span className="ml-1 font-mono text-sm text-primary">{codigoTutor}</span>}</div><div className="mt-1 text-sm text-muted-foreground">{[tutor?.telefone, tutor?.outroTelefone].filter(Boolean).join(" · ") || "Sem telefone"}</div>{tutor?.email && <div className="mt-1 truncate text-sm text-muted-foreground">{tutor.email}</div>}{tutor && <Link to="/tutores" className="mt-3 inline-flex rounded-lg border bg-white px-3 py-2 text-xs font-bold">Ver cadastro do tutor</Link>}</div>
            </div>
            <div className="flex overflow-x-auto border-t bg-muted/10 px-2 lg:hidden">{ABAS.map((nome) => <button key={nome} type="button" onClick={() => setAba(nome)} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-bold ${aba === nome ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{nome}</button>)}</div>
          </section>

          {aba === "Visão geral" ? <div className="mt-4 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <Painel titulo="Resumo clínico"><Info rotulo="Alergias" valor={animal.alergias}/><Info rotulo="Doenças crônicas" valor={animal.doencasCronicas}/><Info rotulo="Medicamentos contínuos" valor={animal.medicamentosContinuos}/><Info rotulo="Dieta" valor={animal.dieta}/><Info rotulo="Restrições" valor={animal.restricoes}/><Info rotulo="Necessidades especiais" valor={animal.necessidadesEspeciais}/></Painel>
              <Painel titulo="Histórico de peso" acao={() => setModalPeso(true)}><div className="py-2 text-center"><Scale className="mx-auto mb-2 text-primary/35"/><div className="text-xs font-black uppercase tracking-wider text-muted-foreground">Peso atual</div><div className="mt-1 text-2xl font-black">{pesoAtual ? formatarPeso(pesoAtual.peso) : "não informado"}</div>{pesoAtual?.data && <div className="mt-1 text-xs text-muted-foreground">{formatarData(pesoAtual.data)}</div>}</div><div className="mt-4 border-t pt-3"><div className="mb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">Histórico de pesos</div>{historicoPeso.length ? <div className="space-y-1.5">{historicoPeso.map((p) => <div key={p.id} className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">{formatarData(p.data)}</span><strong>{formatarPeso(p.peso)}</strong></div>)}</div> : <div className="text-sm text-muted-foreground">Nenhum peso anterior registrado.</div>}</div></Painel>
              <Painel titulo="Próximos agendamentos" acao={() => abrirNovo("Agendamentos")}><div className="text-sm text-muted-foreground">Abra a aba Agendamentos para consultar o histórico completo e marcar um novo horário.</div></Painel>
            </aside>
            <section className="space-y-3">{(["Registros clínicos", "Vacinas", "Exames", "Receitas", "Observações", "Documentos", "Galeria"] as RegistroTipo[]).map((tipo) => <ResumoSecao key={tipo} tipo={tipo} registros={registrosAnimal.filter((r) => r.tipo === tipo).slice(0,2)} onAdd={tipo === "Registros clínicos" ? undefined : tipo === "Observações" ? () => setAba("Observações") : () => abrirNovo(tipo)} onOpen={() => setAba(tipo as Aba)} animalId={animal.id}/>)}</section>
          </div> : aba === "Registros clínicos" ? <RegistrosClinicos animalId={animal.id} registros={registrosAnimal.filter((r) => r.tipo === "Registros clínicos")}/> : aba === "Agendamentos" ? <AgendamentosAnimal animalId={animal.id} tutorId={animal.tutorId}/> : aba === "Observações" ? <ObservacoesAnimal animalId={animal.id} registros={registros} onChange={setRegistros}/> : <SecaoCompleta aba={aba} registros={registrosAnimal.filter((r) => r.tipo === aba)} onAdd={() => abrirNovo(aba as RegistroTipo)}/>} 

          {modalTipo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onMouseDown={(e) => { if (e.currentTarget === e.target) setModalTipo(null); }}><div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">{animal.nome}</p><h2 className="text-2xl font-black">Adicionar em {modalTipo}</h2></div><button type="button" onClick={() => setModalTipo(null)} className="rounded-lg p-2 hover:bg-muted"><X/></button></div><div className="mt-5 space-y-4"><label className="block text-sm font-bold">Data<input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3"/></label><label className="block text-sm font-bold">Título<input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={modalTipo === "Vacinas" ? "Ex.: V10" : modalTipo === "Exames" ? "Ex.: Hemograma" : "Título do registro"} className="mt-1 min-h-11 w-full rounded-xl border px-3"/></label><label className="block text-sm font-bold">Detalhes<textarea value={detalhe} onChange={(e) => setDetalhe(e.target.value)} rows={5} className="mt-1 w-full rounded-xl border p-3"/></label></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setModalTipo(null)} className="rounded-xl border px-4 py-2.5 font-bold">Cancelar</button><button type="button" onClick={salvarRegistro} className="rounded-xl bg-primary px-5 py-2.5 font-bold text-primary-foreground">Salvar</button></div></div></div>}

          {modalPeso && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onMouseDown={(e) => { if (e.currentTarget === e.target) setModalPeso(false); }}><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-primary">{animal.nome}</p><h2 className="text-2xl font-black">Adicionar peso</h2></div><button type="button" onClick={() => setModalPeso(false)} className="rounded-lg p-2 hover:bg-muted"><X/></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Peso (kg)<input autoFocus inputMode="numeric" value={pesoParaCampo(pesoNovo)} onChange={(e) => setPesoNovo(pesoPorDigitacao(e.target.value))} placeholder="0,000" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label><label className="text-sm font-bold">Data<input type="date" value={dataPeso} onChange={(e) => setDataPeso(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label></div><p className="mt-3 text-xs text-muted-foreground">Digite somente números: 1290 vira 1,290 kg; 12 vira 0,012 kg.</p><button type="button" onClick={salvarPeso} className="mt-5 w-full rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground">Salvar peso</button></div></div>}
        </div>
      </div>
    </main>
  );
}

function Painel({ titulo, acao, children }: { titulo: string; acao?: () => void; children: React.ReactNode }) { return <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex items-center justify-between border-b bg-muted/20 px-4 py-3"><h3 className="font-black">{titulo}</h3>{acao && <button type="button" onClick={acao} className="inline-flex items-center gap-1 text-xs font-bold text-primary"><Plus size={14}/> Adicionar</button>}</div><div className="p-4">{children}</div></section>; }
function Info({ rotulo, valor }: { rotulo: string; valor?: string }) { return <div className="mb-3 last:mb-0"><div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{rotulo}</div><div className="mt-0.5 text-sm">{valor || "Não informado"}</div></div>; }
function ListaMini({ registros, vazio }: { registros: Registro[]; vazio: string }) { return registros.length ? <div className="space-y-2">{registros.map((r) => r.tipo === "Registros clínicos" ? <Link key={r.id} to="/consulta" search={{ animalId: r.animalId, registroId: r.id } as never} className="block rounded-xl border p-3 transition hover:border-primary hover:bg-primary/[0.025]"><div className="text-xs text-muted-foreground">{formatarData(r.data)}</div><div className="font-bold">{r.titulo}</div><div className="mt-1 text-[11px] font-bold text-primary">Abrir consulta →</div></Link> : <div key={r.id} className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">{formatarData(r.data)}</div><div className="font-bold">{r.titulo}</div></div>)}</div> : <div className="py-5 text-center text-sm text-muted-foreground">{vazio}</div>; }
function ResumoSecao({ tipo, registros, onAdd, onOpen, animalId }: { tipo: RegistroTipo; registros: Registro[]; onAdd?: () => void; onOpen: () => void; animalId: string }) { const Icon = iconFor(tipo as Aba); return <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2.5"><button type="button" onClick={onOpen} className="flex items-center gap-2 font-black"><Icon size={16} className="text-primary"/>{tipo}</button>{tipo === "Registros clínicos" ? <Link to="/registro-clinico" search={{ animalId } as never} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground"><Plus size={13}/> Adicionar</Link> : onAdd && <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground"><Plus size={13}/> Adicionar</button>}</div><div className="p-3"><ListaMini registros={registros} vazio={`Nenhum registro em ${tipo.toLowerCase()}.`}/></div></section>; }
function SecaoCompleta({ aba, registros, onAdd }: { aba: Aba; registros: Registro[]; onAdd: () => void }) { const Icon = iconFor(aba); return <section className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3"><div className="flex items-center gap-2"><Icon size={19} className="text-primary"/><h2 className="text-xl font-black">{aba}</h2></div><button type="button" onClick={onAdd} className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"><Plus size={15}/> Adicionar</button></div><div className="p-4">{registros.length ? <div className="space-y-3">{registros.map((r) => <article key={r.id} className="rounded-xl border p-4"><div className="font-black">{r.titulo}</div><div className="mt-0.5 text-xs text-muted-foreground">{formatarData(r.data)}</div>{r.detalhe && <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{r.detalhe}</p>}</article>)}</div> : <div className="py-14 text-center text-muted-foreground"><Icon className="mx-auto mb-3 opacity-30" size={34}/><p>Nenhum registro em {aba.toLowerCase()}.</p></div>}</div></section>; }
function RegistrosClinicos({ animalId, registros }: { animalId: string; registros: Registro[] }) { return <section className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b bg-muted/20 px-4 py-4"><div className="flex items-center gap-2"><ClipboardList size={20} className="text-primary"/><h2 className="text-xl font-black">Registros clínicos</h2></div><p className="mt-1 text-sm text-muted-foreground">Escolha o tipo de registro. Cada fluxo mostra apenas o que você precisa preencher.</p></div><div className="p-4 sm:p-5"><div className="grid gap-3 md:grid-cols-3"><RegistroCard icon={BedDouble} titulo="Internação" texto="Histórico dos plantões finalizados deste animal." to={`/registro-clinico?animalId=${encodeURIComponent(animalId)}`}/><RegistroCard icon={Stethoscope} titulo="Consulta" texto="Tutor, queixa, sistemas, exame clínico e conduta." to={`/registro-clinico?animalId=${encodeURIComponent(animalId)}`}/><RegistroCard icon={Scissors} titulo="Cirurgia / Procedimentos" texto="Procedimento, equipe, anestesia, achados e pós-operatório." to={`/registro-clinico?animalId=${encodeURIComponent(animalId)}`}/></div>{registros.length > 0 && <div className="mt-6"><div className="mb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">Últimos registros</div><div className="space-y-2">{registros.map((r) => <Link key={r.id} to="/consulta" search={{ animalId, registroId: r.id } as never} className="block rounded-xl border p-3 transition hover:border-primary hover:bg-primary/[0.025]"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{r.titulo}</strong><span className="text-xs text-muted-foreground">{formatarData(r.data)}</span></div>{r.detalhe && <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{r.detalhe}</p>}<div className="mt-2 text-[11px] font-black text-primary">Abrir registro →</div></Link>)}</div></div>}</div></section>; }
function RegistroCard({ icon: Icon, titulo, texto, to }: { icon: typeof Stethoscope; titulo: string; texto: string; to: string }) { return <a href={to} className="rounded-2xl border-2 bg-white p-4 transition hover:border-primary hover:shadow-sm"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={20}/></div><div className="mt-3 font-black">{titulo}</div><p className="mt-1 text-sm text-muted-foreground">{texto}</p><div className="mt-3 text-xs font-black text-primary">Abrir →</div></a>; }
