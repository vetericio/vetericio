import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, PawPrint, Save, AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/novo-animal")({ component: NovoAnimal });

type Tutor = { id: string; nome: string; telefone?: string };
type Animal = {
  id: string;
  tutorId: string;
  nome: string;
  nascimento?: string;
  especie: string;
  raca: string;
  sexo?: string;
  cor?: string;
  pelagem?: string;
  porte?: string;
  peso?: string;
  escoreCorporal?: string;
  castrado?: string;
  microchip?: string;
  temperamentos: string[];
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
  criadoEm: string;
};

const TUTORES_KEY = "oricse-tutores-v1";
const ANIMAIS_KEY = "oricse-animais-v1";

const ESPECIES = [
  ["🐶", "Cão"], ["🐱", "Gato"], ["🐰", "Coelho"], ["🐹", "Hamster"],
  ["🐭", "Rato"], ["🐹", "Porquinho-da-índia"], ["🦜", "Ave"], ["🦎", "Réptil"],
  ["🐢", "Quelônio"], ["🐍", "Serpente"], ["🐾", "Silvestre / exótico"], ["➕", "Outro"],
] as const;

const RACAS: Record<string, string[]> = {
  "Cão": ["SRD", "Akita", "American Bully", "American Staffordshire Terrier", "Basset Hound", "Beagle", "Bernese Mountain Dog", "Border Collie", "Boston Terrier", "Boxer", "Bull Terrier", "Bulldog Francês", "Bulldog Inglês", "Cane Corso", "Chihuahua", "Chow Chow", "Cocker Spaniel", "Dachshund", "Dobermann", "Fila Brasileiro", "Golden Retriever", "Husky Siberiano", "Jack Russell Terrier", "Labrador Retriever", "Lhasa Apso", "Maltês", "Pastor Alemão", "Pastor Australiano", "Pinscher", "Pit Bull", "Poodle", "Pug", "Rottweiler", "Schnauzer", "Shih-tzu", "Spitz Alemão", "Yorkshire Terrier"],
  "Gato": ["SRD", "Abissínio", "Angorá", "Bengal", "British Shorthair", "Maine Coon", "Persa", "Ragdoll", "Siamês", "Sphynx"],
  "Coelho": ["SRD", "Angorá", "Fuzzy Lop", "Holland Lop", "Lionhead", "Mini Lop", "Netherland Dwarf", "Rex"],
  "Hamster": ["SRD", "Anão Russo", "Chinês", "Roborovski", "Sírio"],
  "Rato": ["SRD", "Dumbo", "Fancy Rat", "Hairless", "Rex"],
  "Porquinho-da-índia": ["SRD", "Abissínio", "Alpaca", "Americano", "Peruano", "Sheltie", "Skinny", "Teddy"],
  "Ave": ["SRD", "Agapornis", "Calopsita", "Canário", "Papagaio", "Periquito", "Ring Neck"],
  "Réptil": ["SRD", "Bearded Dragon", "Gecko-leopardo", "Iguana", "Teiú"],
  "Quelônio": ["SRD", "Cágado", "Jabuti", "Tartaruga"],
  "Serpente": ["SRD", "Boa constrictor", "Corn Snake", "Jiboia", "Python regius"],
  "Silvestre / exótico": ["SRD"],
  "Outro": ["SRD"],
};

const TEMPERAMENTOS = ["Dócil", "Medroso", "Ansioso", "Reativo", "Agressivo", "Territorial", "Agitado", "Sociável", "Difícil contenção", "Não informado"];

function lerTutores(): Tutor[] {
  try { return JSON.parse(localStorage.getItem(TUTORES_KEY) || "[]"); } catch { return []; }
}

function NovoAnimal() {
  const navigate = useNavigate();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const tutorId = params.get("tutorId") || "";
  const tutores = useMemo(() => lerTutores(), []);
  const tutor = tutores.find((t) => t.id === tutorId);

  const [form, setForm] = useState({
    nome: "", nascimento: "", especie: "Cão", raca: "SRD", sexo: "", cor: "", pelagem: "", porte: "", peso: "", escoreCorporal: "", castrado: "Não informado", microchip: "", temperamentos: [] as string[], comportamento: "", origem: "", chegadaTutor: "", tipoSanguineo: "", alergias: "", doencasCronicas: "", medicamentosContinuos: "", dieta: "", restricoes: "", necessidadesEspeciais: "", veterinarioReferencia: "", alerta: "", observacoes: "",
  });

  const racas = RACAS[form.especie] || ["SRD"];
  const campo = "mt-1 min-h-11 w-full rounded-xl border bg-white px-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10";

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleTemperamento(nome: string) {
    setForm((f) => ({ ...f, temperamentos: f.temperamentos.includes(nome) ? f.temperamentos.filter((x) => x !== nome) : [...f.temperamentos, nome] }));
  }

  function salvar() {
    if (!tutor) return toast.error("Tutor não encontrado. Volte e selecione o tutor novamente.");
    if (!form.nome.trim()) return toast.error("Informe o nome do animal.");
    if (!form.especie) return toast.error("Selecione a espécie.");

    const novo: Animal = { ...form, id: crypto.randomUUID(), tutorId: tutor.id, criadoEm: new Date().toISOString() };
    let lista: Animal[] = [];
    try { lista = JSON.parse(localStorage.getItem(ANIMAIS_KEY) || "[]"); } catch {}
    localStorage.setItem(ANIMAIS_KEY, JSON.stringify([novo, ...lista]));
    toast.success(`${novo.nome} cadastrado com sucesso.`);
    navigate({ to: "/tutores" });
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1200px] px-4 pb-28 pt-6 sm:px-6">
      <Link to="/tutores" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar para Tutores</Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div><div className="flex items-center gap-2"><PawPrint className="text-primary"/><h1 className="text-3xl font-black">Cadastrar animal</h1></div>{tutor && <p className="mt-1 text-sm text-muted-foreground">Tutor: <strong className="text-foreground">{tutor.nome}</strong></p>}</div>
      </div>

      {!tutor ? <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm">Tutor não encontrado. Volte à tela de tutores e use o botão <strong>Cadastrar animal</strong>.</div> : (
        <div className="mt-5 space-y-5">
          <Bloco titulo="Identificação">
            <label className="sm:col-span-2 text-sm font-semibold">Nome do animal *<input autoFocus value={form.nome} onChange={(e)=>set("nome",e.target.value)} className={campo}/></label>
            <label className="text-sm font-semibold">Nascimento<input type="date" value={form.nascimento} onChange={(e)=>set("nascimento",e.target.value)} className={campo}/></label>
            <label className="text-sm font-semibold">Espécie *<select value={form.especie} onChange={(e)=>{set("especie",e.target.value); set("raca","SRD");}} className={campo}>{ESPECIES.map(([emoji,nome])=><option key={nome} value={nome}>{emoji} {nome}</option>)}</select></label>
            <label className="text-sm font-semibold">Raça<select value={form.raca} onChange={(e)=>set("raca",e.target.value)} className={campo}>{racas.map((r)=><option key={r}>{r}</option>)}</select><span className="mt-1 block text-[11px] text-muted-foreground">SRD aparece sempre primeiro.</span></label>
            <label className="text-sm font-semibold">Sexo<select value={form.sexo} onChange={(e)=>set("sexo",e.target.value)} className={campo}><option value="">Não informado</option><option>Macho</option><option>Fêmea</option><option>Indeterminado</option></select></label>
            <label className="text-sm font-semibold">Cor<input value={form.cor} onChange={(e)=>set("cor",e.target.value)} className={campo}/></label>
            <label className="text-sm font-semibold">Microchip<input value={form.microchip} onChange={(e)=>set("microchip",e.target.value)} className={campo}/></label>
          </Bloco>

          <Bloco titulo="Características">
            <label className="text-sm font-semibold">Pelagem<input value={form.pelagem} onChange={(e)=>set("pelagem",e.target.value)} className={campo}/></label>
            <label className="text-sm font-semibold">Porte<select value={form.porte} onChange={(e)=>set("porte",e.target.value)} className={campo}><option value="">Não informado</option><option>Mini</option><option>Pequeno</option><option>Médio</option><option>Grande</option><option>Gigante</option></select></label>
            <label className="text-sm font-semibold">Peso atual (kg)<input inputMode="decimal" value={form.peso} onChange={(e)=>set("peso",e.target.value.replace(",","."))} className={campo}/></label>
            <label className="text-sm font-semibold">Escore corporal<select value={form.escoreCorporal} onChange={(e)=>set("escoreCorporal",e.target.value)} className={campo}><option value="">Não informado</option>{[1,2,3,4,5,6,7,8,9].map(n=><option key={n}>{n}/9</option>)}</select></label>
            <label className="text-sm font-semibold">Castrado?<select value={form.castrado} onChange={(e)=>set("castrado",e.target.value)} className={campo}><option>Não informado</option><option>Sim</option><option>Não</option></select></label>
            <label className="text-sm font-semibold">Origem<select value={form.origem} onChange={(e)=>set("origem",e.target.value)} className={campo}><option value="">Não informado</option><option>Adoção</option><option>Criador</option><option>Resgate</option><option>Compra</option><option>Nascido com o tutor</option><option>Outro</option></select></label>
            <label className="text-sm font-semibold">Data em que chegou ao tutor<input type="date" value={form.chegadaTutor} onChange={(e)=>set("chegadaTutor",e.target.value)} className={campo}/></label>
          </Bloco>

          <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5"><h2 className="text-sm font-black uppercase tracking-wide text-primary">Temperamento</h2><div className="mt-3 flex flex-wrap gap-2">{TEMPERAMENTOS.map((t)=><button type="button" key={t} onClick={()=>toggleTemperamento(t)} className={`rounded-full border px-3 py-2 text-sm font-semibold ${form.temperamentos.includes(t)?"border-primary bg-primary text-primary-foreground":"bg-white hover:bg-slate-50"}`}>{t}</button>)}</div><label className="mt-4 block text-sm font-semibold">Observação comportamental<textarea rows={3} value={form.comportamento} onChange={(e)=>set("comportamento",e.target.value)} className={`${campo} py-3`}/></label></section>

          <Bloco titulo="Saúde">
            <label className="text-sm font-semibold">Tipo sanguíneo<input value={form.tipoSanguineo} onChange={(e)=>set("tipoSanguineo",e.target.value)} className={campo}/></label>
            <label className="text-sm font-semibold">Veterinário de referência<input value={form.veterinarioReferencia} onChange={(e)=>set("veterinarioReferencia",e.target.value)} className={campo}/></label>
            <label className="text-sm font-semibold">Alergias<textarea rows={3} value={form.alergias} onChange={(e)=>set("alergias",e.target.value)} className={`${campo} py-3`}/></label>
            <label className="text-sm font-semibold">Doenças crônicas<textarea rows={3} value={form.doencasCronicas} onChange={(e)=>set("doencasCronicas",e.target.value)} className={`${campo} py-3`}/></label>
            <label className="text-sm font-semibold">Medicamentos de uso contínuo<textarea rows={3} value={form.medicamentosContinuos} onChange={(e)=>set("medicamentosContinuos",e.target.value)} className={`${campo} py-3`}/></label>
            <label className="text-sm font-semibold">Alimentação / dieta<textarea rows={3} value={form.dieta} onChange={(e)=>set("dieta",e.target.value)} className={`${campo} py-3`}/></label>
            <label className="text-sm font-semibold">Restrições<textarea rows={3} value={form.restricoes} onChange={(e)=>set("restricoes",e.target.value)} className={`${campo} py-3`}/></label>
            <label className="text-sm font-semibold">Necessidades especiais<textarea rows={3} value={form.necessidadesEspeciais} onChange={(e)=>set("necessidadesEspeciais",e.target.value)} className={`${campo} py-3`}/></label>
          </Bloco>

          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm sm:p-5"><div className="flex items-center gap-2 font-black"><AlertTriangle size={19}/> Alerta no atendimento</div><p className="mt-1 text-xs text-muted-foreground">Informações que precisam ficar visíveis sempre que este animal for atendido.</p><textarea rows={3} value={form.alerta} onChange={(e)=>set("alerta",e.target.value)} placeholder="Ex.: agressivo para coleta, histórico de convulsão, alergia medicamentosa..." className={`${campo} mt-3 py-3`}/></section>

          <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5"><label className="text-sm font-semibold">Observações gerais<textarea rows={4} value={form.observacoes} onChange={(e)=>set("observacoes",e.target.value)} className={`${campo} py-3`}/></label></section>

          <div className="flex justify-end gap-2"><Link to="/tutores" className="rounded-xl border px-4 py-3 font-semibold">Cancelar</Link><button type="button" onClick={salvar} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground"><Save size={17}/> Salvar animal</button></div>
        </div>
      )}
    </main>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5"><h2 className="mb-3 text-sm font-black uppercase tracking-wide text-primary">{titulo}</h2><div className="grid gap-3 sm:grid-cols-2">{children}</div></section>;
}
