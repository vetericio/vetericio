import { oricseStorage, oricseSession } from "@/lib/oricse-storage";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, PawPrint, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabaseBanco } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { codigoPublicoTutor } from "@/lib/codigo-tutor";
import { RACAS as RACAS_COMPLETAS } from "@/data/racas";
import { nomeRacaBrasil } from "@/data/racas-brasil";

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

type AnimalForm = Omit<Animal, "id" | "tutorId" | "criadoEm">;

const TUTORES_KEY = "oricse-tutores-v1";
const ANIMAIS_KEY = "oricse-animais-v1";
const PESOS_KEY = "oricse-pesos-animal-v1";
const SRD = "SRD (Sem Raça Definida)";

const ESPECIES = [
  ["🐶", "Cão"], ["🐱", "Gato"], ["🐰", "Coelho"], ["🐹", "Hamster"],
  ["🐭", "Rato"], ["🐹", "Porquinho-da-índia"], ["🦜", "Ave"], ["🦎", "Réptil"],
  ["🐢", "Quelônio"], ["🐍", "Serpente"], ["🐾", "Silvestre / exótico"], ["➕", "Outro"],
] as const;

const CORES = [
  "Não informado", "Branco", "Preto", "Cinza", "Azul / cinza-azulado", "Marrom", "Chocolate", "Caramelo", "Bege", "Creme", "Amarelo / dourado", "Ruivo / vermelho", "Canela", "Fulvo", "Preto e branco", "Preto e caramelo", "Preto e marrom", "Branco e marrom", "Branco e caramelo", "Branco e cinza", "Tricolor", "Tigrado", "Rajado / tabby", "Escaminha / tortie", "Calico", "Merle", "Arlequim", "Sable", "Agouti", "Albino", "Outro",
];

const PELAGENS: Record<string, string[]> = {
  "Cão": ["Não informado", "Curta", "Média", "Longa", "Lisa", "Ondulada", "Encaracolada", "Dura / áspera", "Dupla", "Densa", "Sedosa", "Lanosa", "Sem pelo / hairless", "Outra"],
  "Gato": ["Não informado", "Curta", "Semilonga", "Longa", "Lisa", "Densa", "Dupla", "Sedosa", "Lanosa", "Encaracolada / Rex", "Sem pelo / hairless", "Outra"],
  "Coelho": ["Não informado", "Curta", "Média", "Longa", "Lisa", "Rex / aveludada", "Angorá / lanosa", "Densa", "Outra"],
  "Hamster": ["Não informado", "Curta", "Longa", "Lisa", "Satin", "Rex", "Sem pelo / hairless", "Outra"],
  "Rato": ["Não informado", "Lisa / padrão", "Rex", "Double Rex", "Satin", "Sem pelo / hairless", "Outra"],
  "Porquinho-da-índia": ["Não informado", "Curta / lisa", "Rosetas / Abissínio", "Longa", "Peruana", "Sheltie", "Teddy", "Rex", "Skinny / sem pelo", "Outra"],
  "Ave": ["Não informado", "Plumagem normal", "Plumagem curta", "Plumagem longa", "Plumagem densa", "Plumagem reduzida", "Sem penas / parcialmente sem penas", "Outra"],
  "Réptil": ["Não informado", "Escamas lisas", "Escamas rugosas", "Escamas granulares", "Escamas espinhosas", "Outra"],
  "Quelônio": ["Não informado", "Carapaça lisa", "Carapaça rugosa", "Outra"],
  "Serpente": ["Não informado", "Escamas lisas", "Escamas quilhadas", "Outra"],
  "Silvestre / exótico": ["Não informado", "Pelos curtos", "Pelos médios", "Pelos longos", "Sem pelo", "Penas", "Escamas", "Carapaça", "Outro"],
  "Outro": ["Não informado", "Outro"],
};

const TIPOS_SANGUINEOS: Record<string, string[]> = {
  "Cão": ["Não informado", "DEA 1 positivo", "DEA 1 negativo", "DEA 3 positivo", "DEA 3 negativo", "DEA 4 positivo", "DEA 4 negativo", "DEA 5 positivo", "DEA 5 negativo", "DEA 7 positivo", "DEA 7 negativo", "Dal positivo", "Dal negativo", "Kai 1 positivo", "Kai 1 negativo", "Kai 2 positivo", "Kai 2 negativo", "Outro / painel completo"],
  "Gato": ["Não informado", "Tipo A", "Tipo B", "Tipo AB", "Mik positivo", "Mik negativo", "Outro / painel ampliado"],
};

const TEMPERAMENTOS = ["Dócil", "Medroso", "Ansioso", "Reativo", "Agressivo", "Territorial", "Agitado", "Sociável", "Difícil contenção", "Não informado"];

const FORM_VAZIO: AnimalForm = {
  nome: "", nascimento: "", especie: "Cão", raca: SRD, sexo: "", cor: "", pelagem: "", porte: "", peso: "", escoreCorporal: "", castrado: "Não informado", microchip: "", temperamentos: [], comportamento: "", origem: "", chegadaTutor: "", tipoSanguineo: "", alergias: "", doencasCronicas: "", medicamentosContinuos: "", dieta: "", restricoes: "", necessidadesEspeciais: "", veterinarioReferencia: "", alerta: "", observacoes: "",
};

function lerTutores(): Tutor[] {
  try { return JSON.parse(oricseStorage.getItem(TUTORES_KEY) || "[]"); } catch { return []; }
}

function lerAnimais(): Animal[] {
  try { return JSON.parse(oricseStorage.getItem(ANIMAIS_KEY) || "[]"); } catch { return []; }
}

function ordenarRacas(racas: string[]) {
  const finais = ["Mestiço", "Outra raça", "Outra raça / variedade", "Não informado"];
  const srd = racas.filter((r) => r === SRD);
  const meio = racas.filter((r) => r !== SRD && !finais.includes(r)).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  const fim = finais.filter((r) => racas.includes(r));
  return [...srd, ...meio, ...fim];
}

function pesoExibicao(valor?: string) {
  if (!valor) return "";
  const normalizado = valor.replace(",", ".");
  const numero = Number(normalizado);
  if (!Number.isFinite(numero)) return "";
  return numero.toFixed(3).replace(".", ",");
}

function pesoPorDigitacao(valorDigitado: string) {
  const digitos = valorDigitado.replace(/\D/g, "");
  if (!digitos) return "";
  const numero = Number(digitos) / 1000;
  return numero.toFixed(3);
}

function NovoAnimal() {
  const navigate = useNavigate();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const tutorIdParam = params.get("tutorId") || "";
  const animalId = params.get("animalId") || "";

  const [tutor,setTutor]=useState<Tutor|null>(null);
  const [animalExistente,setAnimalExistente]=useState<Animal|null>(null);
  const [clinicaId,setClinicaId]=useState("");
  const [carregando,setCarregando]=useState(true);
  const [form,setForm]=useState<AnimalForm>(FORM_VAZIO);
  const editando=Boolean(animalId);
  useEffect(()=>{let ativo=true;(async()=>{try{
   const {data:{user}}=await supabaseBanco.auth.getUser();
   if(!user)throw Error("Faça login novamente.");
   const {data:vinculo,error}=await supabaseBanco.from("clinica_usuarios").select("clinica_id").eq("user_id",user.id).eq("ativo",true).limit(1).maybeSingle();
   if(error||!vinculo?.clinica_id)throw Error("Clínica não identificada.");
   const {data,error:rpcError}=await (supabaseBanco as any).rpc("oricse_animal_cadastro_tela",{p_clinica:vinculo.clinica_id,p_tutor:tutorIdParam||null,p_animal:animalId||null});
   if(rpcError)throw rpcError;
   if(!ativo)return;
   setClinicaId(vinculo.clinica_id);
   setTutor(data?.tutor||null);
   if(data?.animal){setAnimalExistente(data.animal);setForm({...FORM_VAZIO,...data.animal,peso:data.animal.peso==null?"":String(data.animal.peso),temperamentos:data.animal.temperamentos||[]});}
  }catch(e){if(ativo)toast.error(e instanceof Error?e.message:"Não foi possível consultar o tutor no Supabase");}
  finally{if(ativo)setCarregando(false)}})();return()=>{ativo=false};},[tutorIdParam,animalId]);

  const racasInternacionais = RACAS_COMPLETAS[form.especie] || [SRD, "Outra raça / variedade", "Não informado"];
  const racas = useMemo(() => ordenarRacas(racasInternacionais.map((r) => nomeRacaBrasil(form.especie, r))), [form.especie, racasInternacionais]);
  const pelagens = PELAGENS[form.especie] || ["Não informado", "Outro"];
  const tiposSanguineos = TIPOS_SANGUINEOS[form.especie] || ["Não se aplica / não informado"];
  const campo = "mt-1 min-h-11 w-full rounded-xl border bg-white px-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10";

  function set<K extends keyof AnimalForm>(key: K, value: AnimalForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function trocarEspecie(especie: string) {
    setForm((f) => ({ ...f, especie, raca: SRD, pelagem: "", tipoSanguineo: "" }));
  }

  function toggleTemperamento(nome: string) {
    setForm((f) => ({ ...f, temperamentos: f.temperamentos.includes(nome) ? f.temperamentos.filter((x) => x !== nome) : [...f.temperamentos, nome] }));
  }

  async function salvar() {
    if(!tutor||!clinicaId)return toast.error("Tutor não identificado no Supabase.");
    if(!form.nome.trim()||!form.especie)return toast.error("Nome e espécie são obrigatórios.");
    const {error}=await (supabaseBanco as any).rpc("oricse_animal_salvar_tela",{p_clinica:clinicaId,p_tutor:tutor.id,p_animal:animalId||null,p_dados:form});
    if(error)return toast.error(error.message);
    toast.success(editando?"Animal atualizado no Supabase.":"Animal cadastrado no ORICSE.");
    navigate({to:"/tutores"});
  }
  return (
    <main className="mx-auto min-h-screen w-full max-w-[1200px] px-4 pb-28 pt-6 sm:px-6">
      <Link to="/tutores" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar para Tutores</Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><PawPrint className="text-primary"/><h1 className="text-3xl font-black">{editando ? "Editar animal" : "Cadastrar animal"}</h1></div>
          {tutor && <p className="mt-1 text-sm text-muted-foreground">Tutor: <strong className="text-foreground">{tutor.nome}</strong>{codigoPublicoTutor(tutor) && <span className="ml-2 font-mono font-semibold text-primary">{codigoPublicoTutor(tutor)}</span>}</p>}
        </div>
      </div>

      {carregando ? <div className="mt-5 rounded-xl border p-5">Carregando tutor do Supabase…</div> : !tutor || (animalId && !animalExistente) ? <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm">{animalId && !animalExistente ? "Animal não encontrado." : <>Tutor não encontrado. Volte à tela de tutores e use o botão <strong>Cadastrar animal</strong>.</>}</div> : (
        <div className="mt-5 space-y-5">
          <Bloco titulo="Identificação">
            <label className="sm:col-span-2 text-sm font-semibold">Nome do animal *<input autoFocus value={form.nome} onChange={(e) => set("nome", e.target.value)} className={campo}/></label>
            <label className="text-sm font-semibold">Nascimento<input type="date" value={form.nascimento} onChange={(e) => set("nascimento", e.target.value)} className={campo}/></label>
            <label className="text-sm font-semibold">Espécie *<select value={form.especie} onChange={(e) => trocarEspecie(e.target.value)} className={campo}>{ESPECIES.map(([emoji, nome]) => <option key={nome} value={nome}>{emoji} {nome}</option>)}</select></label>
            <label className="text-sm font-semibold">Raça<input list="racas-disponiveis" value={form.raca} onChange={(e) => set("raca", e.target.value)} placeholder="Digite o nome brasileiro ou internacional" autoComplete="off" className={campo}/><datalist id="racas-disponiveis">{racas.map((r) => <option key={r} value={r}/>)}</datalist><span className="mt-1 block text-[11px] text-muted-foreground">Busque pelo nome brasileiro ou internacional. {SRD} aparece sempre primeiro.</span></label>
            <label className="text-sm font-semibold">Sexo<select value={form.sexo} onChange={(e) => set("sexo", e.target.value)} className={campo}><option value="">Não informado</option><option>Macho</option><option>Fêmea</option><option>Indeterminado</option></select></label>
            <label className="text-sm font-semibold">Cor<select value={form.cor} onChange={(e) => set("cor", e.target.value)} className={campo}><option value="">Selecione</option>{CORES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
            <label className="text-sm font-semibold">Microchip<input value={form.microchip} onChange={(e) => set("microchip", e.target.value)} className={campo}/></label>
          </Bloco>

          <Bloco titulo="Características">
            <label className="text-sm font-semibold">{form.especie === "Ave" ? "Plumagem" : form.especie === "Réptil" || form.especie === "Serpente" ? "Escamas" : form.especie === "Quelônio" ? "Carapaça" : "Pelagem"}<select value={form.pelagem} onChange={(e) => set("pelagem", e.target.value)} className={campo}><option value="">Selecione</option>{pelagens.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
            <label className="text-sm font-semibold">Porte<select value={form.porte} onChange={(e) => set("porte", e.target.value)} className={campo}><option value="">Não informado</option><option>Mini</option><option>Pequeno</option><option>Médio</option><option>Grande</option><option>Gigante</option></select></label>
            <label className="text-sm font-semibold">Peso atual (kg)<input inputMode="numeric" value={pesoExibicao(form.peso)} onChange={(e) => set("peso", pesoPorDigitacao(e.target.value))} placeholder="0,000" className={campo}/><span className="mt-1 block text-[11px] text-muted-foreground">Digite apenas os números. O peso é preenchido da direita para a esquerda e sempre fica com 3 casas decimais. Ex.: 13500 → 13,500 kg.</span></label>
            <label className="text-sm font-semibold">Escore corporal<select value={form.escoreCorporal} onChange={(e) => set("escoreCorporal", e.target.value)} className={campo}><option value="">Não informado</option><option value="1/5 — Muito magro">1/5 — Muito magro</option><option value="2/5 — Magro">2/5 — Magro</option><option value="3/5 — Ideal">3/5 — Ideal</option><option value="4/5 — Sobrepeso">4/5 — Sobrepeso</option><option value="5/5 — Obeso">5/5 — Obeso</option></select></label>
            <label className="text-sm font-semibold">Castrado?<select value={form.castrado} onChange={(e) => set("castrado", e.target.value)} className={campo}><option>Não informado</option><option>Sim</option><option>Não</option></select></label>
            <label className="text-sm font-semibold">Origem<select value={form.origem} onChange={(e) => set("origem", e.target.value)} className={campo}><option value="">Não informado</option><option>Adoção</option><option>Criador</option><option>Resgate</option><option>Compra</option><option>Nascido com o tutor</option><option>Outro</option></select></label>
            <label className="text-sm font-semibold">Data em que chegou ao tutor<input type="date" value={form.chegadaTutor} onChange={(e) => set("chegadaTutor", e.target.value)} className={campo}/></label>
          </Bloco>

          <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5"><h2 className="text-sm font-black uppercase tracking-wide text-primary">Temperamento</h2><div className="mt-3 flex flex-wrap gap-2">{TEMPERAMENTOS.map((t) => <button type="button" key={t} onClick={() => toggleTemperamento(t)} className={`rounded-full border px-3 py-2 text-sm font-semibold ${form.temperamentos.includes(t) ? "border-primary bg-primary text-primary-foreground" : "bg-white hover:bg-slate-50"}`}>{t}</button>)}</div><label className="mt-4 block text-sm font-semibold">Observação comportamental<textarea rows={3} value={form.comportamento} onChange={(e) => set("comportamento", e.target.value)} className={`${campo} py-3`}/></label></section>

          <Bloco titulo="Saúde">
            <label className="text-sm font-semibold">Tipo sanguíneo<select value={form.tipoSanguineo} onChange={(e) => set("tipoSanguineo", e.target.value)} className={campo}><option value="">Selecione</option>{tiposSanguineos.map((t) => <option key={t} value={t}>{t}</option>)}</select>{(form.especie === "Cão" || form.especie === "Gato") && <span className="mt-1 block text-[11px] text-muted-foreground">Opções ajustadas automaticamente à espécie selecionada.</span>}</label>
            <label className="text-sm font-semibold">Veterinário de referência<input value={form.veterinarioReferencia} onChange={(e) => set("veterinarioReferencia", e.target.value)} className={campo}/></label>
            <label className="text-sm font-semibold">Alergias<textarea rows={3} value={form.alergias} onChange={(e) => set("alergias", e.target.value)} className={`${campo} py-3`}/></label>
            <label className="text-sm font-semibold">Doenças crônicas<textarea rows={3} value={form.doencasCronicas} onChange={(e) => set("doencasCronicas", e.target.value)} className={`${campo} py-3`}/></label>
            <label className="text-sm font-semibold">Medicamentos de uso contínuo<textarea rows={3} value={form.medicamentosContinuos} onChange={(e) => set("medicamentosContinuos", e.target.value)} className={`${campo} py-3`}/></label>
            <label className="text-sm font-semibold">Alimentação / dieta<textarea rows={3} value={form.dieta} onChange={(e) => set("dieta", e.target.value)} className={`${campo} py-3`}/></label>
            <label className="text-sm font-semibold">Restrições<textarea rows={3} value={form.restricoes} onChange={(e) => set("restricoes", e.target.value)} className={`${campo} py-3`}/></label>
            <label className="text-sm font-semibold">Necessidades especiais<textarea rows={3} value={form.necessidadesEspeciais} onChange={(e) => set("necessidadesEspeciais", e.target.value)} className={`${campo} py-3`}/></label>
          </Bloco>

          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm sm:p-5"><div className="flex items-center gap-2 font-black"><AlertTriangle size={19}/> Alerta no atendimento</div><p className="mt-1 text-xs text-muted-foreground">Informações que precisam ficar visíveis sempre que este animal for atendido.</p><textarea rows={3} value={form.alerta} onChange={(e) => set("alerta", e.target.value)} placeholder="Ex.: agressivo para coleta, histórico de convulsão, alergia medicamentosa..." className={`${campo} mt-3 py-3`}/></section>

          <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5"><label className="text-sm font-semibold">Observações gerais<textarea rows={4} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} className={`${campo} py-3`}/></label></section>

          <div className="flex flex-wrap justify-end gap-2"><Link to="/tutores" className="rounded-xl border px-4 py-3 font-semibold">Cancelar</Link><button type="button" onClick={salvar} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground"><Save size={17}/> {editando ? "Salvar alterações" : "Salvar animal"}</button></div>
        </div>
      )}
    </main>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5"><h2 className="mb-3 text-sm font-black uppercase tracking-wide text-primary">{titulo}</h2><div className="grid gap-3 sm:grid-cols-2">{children}</div></section>;
}
