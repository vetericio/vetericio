import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, ClipboardList, FileText, FlaskConical, Image, PawPrint, Pencil, Plus, ReceiptText, Scale, Syringe, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
type Registro = { id: string; animalId: string; tipo: RegistroTipo; titulo: string; detalhe?: string; data: string; criadoEm: string };

const TUTORES_KEY = "oricse-tutores-v1";
const ANIMAIS_KEY = "oricse-animais-v1";
const PRONTUARIO_KEY = "oricse-prontuario-animal-v1";
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
  try { return new Intl.DateTimeFormat("pt-BR").format(new Date(`${data}T12:00:00`)); } catch { return data; }
}

function iconFor(tipo: Aba) {
  if (tipo === "Vacinas") return Syringe;
  if (tipo === "Receitas") return ReceiptText;
  if (tipo === "Exames") return FlaskConical;
  if (tipo === "Agendamentos") return CalendarDays;
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
  const [modalTipo, setModalTipo] = useState<RegistroTipo | null>(null);
  const [titulo, setTitulo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));

  const registrosAnimal = useMemo(() => registros.filter((r) => r.animalId === animalId).sort((a,b) => b.data.localeCompare(a.data)), [registros, animalId]);
  const codigoTutor = tutor?.codigoPublico || tutor?.codigo || "";

  function abrirNovo(tipo: RegistroTipo) {
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

  if (!animal) return <main className="mx-auto max-w-5xl px-4 py-8"><Link to="/animais" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar</Link><div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">Animal não encontrado.</div></main>;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1550px] px-3 pb-28 pt-4 sm:px-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link to="/animais" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Animais</Link>
        <Link to="/novo-animal" search={{ animalId: animal.id } as never} className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-bold"><Pencil size={16}/> Editar animal</Link>
      </div>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="grid gap-5 p-4 lg:grid-cols-[1.5fr_1fr] lg:p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-3xl">🐾</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h1 className="text-3xl font-black">{animal.nome}</h1>{animal.alerta && <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-bold text-destructive">⚠ {animal.alerta}</span>}</div>
              <div className="mt-2 grid gap-x-5 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
                <span><strong className="text-foreground">Espécie:</strong> {animal.especie || "—"}</span>
                <span><strong className="text-foreground">Raça:</strong> {animal.raca || "—"}</span>
                <span><strong className="text-foreground">Sexo:</strong> {animal.sexo || "—"}</span>
                <span><strong className="text-foreground">Idade:</strong> {idade(animal.nascimento)}</span>
                <span><strong className="text-foreground">Peso:</strong> {animal.peso ? `${animal.peso} kg` : "—"}</span>
                <span><strong className="text-foreground">Castrado:</strong> {animal.castrado || "—"}</span>
                <span><strong className="text-foreground">Microchip:</strong> {animal.microchip || "—"}</span>
                <span><strong className="text-foreground">Cor:</strong> {animal.cor || "—"}</span>
                <span><strong className="text-foreground">Tipo sanguíneo:</strong> {animal.tipoSanguineo || "—"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-sm font-black"><UserRound size={17} className="text-primary"/> Tutor</div>
            <div className="mt-2 text-lg font-black">{tutor?.nome || "Tutor não encontrado"} {codigoTutor && <span className="ml-1 font-mono text-sm text-primary">{codigoTutor}</span>}</div>
            <div className="mt-1 text-sm text-muted-foreground">{[tutor?.telefone, tutor?.outroTelefone].filter(Boolean).join(" · ") || "Sem telefone"}</div>
            {tutor?.email && <div className="mt-1 truncate text-sm text-muted-foreground">{tutor.email}</div>}
            {tutor && <Link to="/tutores" className="mt-3 inline-flex rounded-lg border bg-white px-3 py-2 text-xs font-bold">Ver cadastro do tutor</Link>}
          </div>
        </div>

        <div className="flex overflow-x-auto border-t bg-muted/10 px-2">
          {ABAS.map((nome) => <button key={nome} type="button" onClick={() => setAba(nome)} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-bold ${aba === nome ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{nome}</button>)}
        </div>
      </section>

      {aba === "Visão geral" ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Painel titulo="Resumo clínico">
              <Info rotulo="Alergias" valor={animal.alergias}/><Info rotulo="Doenças crônicas" valor={animal.doencasCronicas}/><Info rotulo="Medicamentos contínuos" valor={animal.medicamentosContinuos}/><Info rotulo="Dieta" valor={animal.dieta}/><Info rotulo="Restrições" valor={animal.restricoes}/><Info rotulo="Necessidades especiais" valor={animal.necessidadesEspeciais}/>
            </Painel>
            <Painel titulo="Histórico de peso" acao={() => abrirNovo("Registros clínicos")}><div className="py-6 text-center text-sm text-muted-foreground"><Scale className="mx-auto mb-2 opacity-40"/>Peso atual: <strong className="text-foreground">{animal.peso ? `${animal.peso} kg` : "não informado"}</strong></div></Painel>
            <Painel titulo="Próximos agendamentos" acao={() => abrirNovo("Agendamentos")}><ListaMini registros={registrosAnimal.filter((r) => r.tipo === "Agendamentos").slice(0,3)} vazio="Nenhum agendamento registrado."/></Painel>
          </aside>

          <section className="space-y-3">
            {(["Registros clínicos", "Vacinas", "Exames", "Receitas", "Observações", "Documentos", "Galeria"] as RegistroTipo[]).map((tipo) => <ResumoSecao key={tipo} tipo={tipo} registros={registrosAnimal.filter((r) => r.tipo === tipo).slice(0,2)} onAdd={() => abrirNovo(tipo)} onOpen={() => setAba(tipo as Aba)}/>)}
          </section>
        </div>
      ) : (
        <SecaoCompleta aba={aba} registros={registrosAnimal.filter((r) => r.tipo === aba)} onAdd={() => abrirNovo(aba as RegistroTipo)}/>
      )}

      {modalTipo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onMouseDown={(e) => { if (e.currentTarget === e.target) setModalTipo(null); }}>
        <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">{animal.nome}</p><h2 className="text-2xl font-black">Adicionar em {modalTipo}</h2></div><button type="button" onClick={() => setModalTipo(null)} className="rounded-lg p-2 hover:bg-muted"><X/></button></div>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-bold">Data<input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3"/></label>
            <label className="block text-sm font-bold">Título<input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={modalTipo === "Vacinas" ? "Ex.: V10" : modalTipo === "Exames" ? "Ex.: Hemograma" : "Título do registro"} className="mt-1 min-h-11 w-full rounded-xl border px-3"/></label>
            <label className="block text-sm font-bold">Detalhes<textarea value={detalhe} onChange={(e) => setDetalhe(e.target.value)} rows={5} className="mt-1 w-full rounded-xl border p-3"/></label>
          </div>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setModalTipo(null)} className="rounded-xl border px-4 py-2.5 font-bold">Cancelar</button><button type="button" onClick={salvarRegistro} className="rounded-xl bg-primary px-5 py-2.5 font-bold text-primary-foreground">Salvar</button></div>
        </div>
      </div>}
    </main>
  );
}

function Painel({ titulo, acao, children }: { titulo: string; acao?: () => void; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex items-center justify-between border-b bg-muted/20 px-4 py-3"><h3 className="font-black">{titulo}</h3>{acao && <button type="button" onClick={acao} className="inline-flex items-center gap-1 text-xs font-bold text-primary"><Plus size={14}/> Adicionar</button>}</div><div className="p-4">{children}</div></section>;
}
function Info({ rotulo, valor }: { rotulo: string; valor?: string }) { return <div className="mb-3 last:mb-0"><div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{rotulo}</div><div className="mt-0.5 text-sm">{valor || "Não informado"}</div></div>; }
function ListaMini({ registros, vazio }: { registros: Registro[]; vazio: string }) { return registros.length ? <div className="space-y-2">{registros.map((r) => <div key={r.id} className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">{formatarData(r.data)}</div><div className="font-bold">{r.titulo}</div></div>)}</div> : <div className="py-5 text-center text-sm text-muted-foreground">{vazio}</div>; }
function ResumoSecao({ tipo, registros, onAdd, onOpen }: { tipo: RegistroTipo; registros: Registro[]; onAdd: () => void; onOpen: () => void }) {
  const Icon = iconFor(tipo as Aba);
  return <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2.5"><button type="button" onClick={onOpen} className="flex items-center gap-2 font-black"><Icon size={16} className="text-primary"/>{tipo}</button><button type="button" onClick={onAdd} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground"><Plus size={13}/> Adicionar</button></div><div className="p-3"><ListaMini registros={registros} vazio={`Nenhum registro em ${tipo.toLowerCase()}.`}/></div></section>;
}
function SecaoCompleta({ aba, registros, onAdd }: { aba: Aba; registros: Registro[]; onAdd: () => void }) {
  const Icon = iconFor(aba);
  return <section className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3"><div className="flex items-center gap-2"><Icon size={19} className="text-primary"/><h2 className="text-xl font-black">{aba}</h2></div><button type="button" onClick={onAdd} className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"><Plus size={15}/> Adicionar</button></div><div className="p-4">{registros.length ? <div className="space-y-3">{registros.map((r) => <article key={r.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-black">{r.titulo}</div><div className="mt-0.5 text-xs text-muted-foreground">{formatarData(r.data)}</div></div></div>{r.detalhe && <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{r.detalhe}</p>}</article>)}</div> : <div className="py-14 text-center text-muted-foreground"><Icon className="mx-auto mb-3 opacity-30" size={34}/><p>Nenhum registro em {aba.toLowerCase()}.</p></div>}</div></section>;
}
