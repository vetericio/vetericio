import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, PawPrint, Search, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/tutores")({ component: Tutores });

type Tutor = {
  id: string;
  nome: string;
  nomeSocial?: string;
  pronome?: string;
  telefone: string;
  outroTelefone?: string;
  email?: string;
  tipoPessoa: "Pessoa física" | "Pessoa jurídica";
  cpfCnpj?: string;
  rg?: string;
  tipoDocumento?: string;
  nascimento?: string;
  sexo?: string;
  profissao?: string;
  origem?: string;
  contatoPreferencial?: string;
  contatoEmergenciaNome?: string;
  contatoEmergenciaTelefone?: string;
  autorizaLembretes?: boolean;
  autorizaWhatsapp?: boolean;
  autorizaEmail?: boolean;
  autorizaMarketing?: boolean;
  responsavelFinanceiroNome?: string;
  responsavelFinanceiroDocumento?: string;
  veterinarioPreferencial?: string;
  horarioPreferencial?: string;
  cep?: string;
  estado?: string;
  cidade?: string;
  bairro?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  observacoes?: string;
  criadoEm: string;
};

type AnimalResumo = {
  id: string;
  tutorId: string;
  nome: string;
};

type Modo = "procurar" | "novo";
const CHAVE = "oricse-tutores-v1";
const ANIMAIS_CHAVE = "oricse-animais-v1";
const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const vazio: Omit<Tutor, "id" | "criadoEm"> = {
  nome: "", nomeSocial: "", pronome: "", telefone: "", outroTelefone: "", email: "", tipoPessoa: "Pessoa física", cpfCnpj: "", rg: "", tipoDocumento: "", nascimento: "", sexo: "", profissao: "", origem: "", contatoPreferencial: "WhatsApp", contatoEmergenciaNome: "", contatoEmergenciaTelefone: "", autorizaLembretes: true, autorizaWhatsapp: true, autorizaEmail: false, autorizaMarketing: false, responsavelFinanceiroNome: "", responsavelFinanceiroDocumento: "", veterinarioPreferencial: "", horarioPreferencial: "", cep: "", estado: "", cidade: "", bairro: "", endereco: "", numero: "", complemento: "", observacoes: "",
};

function carregar(): Tutor[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CHAVE) || "[]"); } catch { return []; }
}
function carregarAnimais(): AnimalResumo[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(ANIMAIS_CHAVE) || "[]"); } catch { return []; }
}
function salvarLista(lista: Tutor[]) { localStorage.setItem(CHAVE, JSON.stringify(lista)); }
function soDigitos(v: string) { return v.replace(/\D/g, ""); }
function inicialNome(nome: string) { return nome.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase(); }
function mascaraTelefone(v: string) { const d=soDigitos(v).slice(0,11); if(d.length<=10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/,"($1) $2-$3").replace(/-$/,""); return d.replace(/(\d{2})(\d{5})(\d{0,4})/,"($1) $2-$3").replace(/-$/,""); }
function mascaraCep(v: string) { return soDigitos(v).slice(0,8).replace(/(\d{5})(\d{0,3})/,"$1-$2").replace(/-$/,""); }
function mascaraDocumento(v:string,tipo:Tutor["tipoPessoa"]) { const d=soDigitos(v); if(tipo==="Pessoa jurídica") return d.slice(0,14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/,"$1.$2.$3/$4-$5").replace(/[-\/.]+$/,""); return d.slice(0,11).replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/,"$1.$2.$3-$4").replace(/[-\.]+$/,""); }

function Tutores() {
  const [modo,setModo]=useState<Modo>("procurar");
  const [form,setForm]=useState(vazio);
  const [tutores,setTutores]=useState<Tutor[]>(carregar);
  const [animais]=useState<AnimalResumo[]>(carregarAnimais);
  const [busca,setBusca]=useState("");
  const [letra,setLetra]=useState("TODOS");
  const [buscandoCep,setBuscandoCep]=useState(false);

  const tutoresOrdenados=useMemo(()=>[...tutores].sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR",{sensitivity:"base"})),[tutores]);
  const letrasDisponiveis=useMemo(()=>new Set(tutoresOrdenados.map(t=>inicialNome(t.nome)).filter(Boolean)),[tutoresOrdenados]);
  const tutoresPorLetra=useMemo(()=>letra==="TODOS"?tutoresOrdenados:tutoresOrdenados.filter(t=>inicialNome(t.nome)===letra),[letra,tutoresOrdenados]);
  const gruposAlfabeticos=useMemo(()=>{ const m=new Map<string,Tutor[]>(); tutoresPorLetra.forEach(t=>{const i=inicialNome(t.nome)||"#"; m.set(i,[...(m.get(i)||[]),t]);}); return Array.from(m.entries()).sort(([a],[b])=>a.localeCompare(b,"pt-BR")); },[tutoresPorLetra]);
  const resultados=useMemo(()=>{ const q=busca.trim().toLowerCase(); if(!q) return tutoresOrdenados; return tutoresOrdenados.filter(t=>[t.nome,t.nomeSocial,t.telefone,t.outroTelefone,t.email,t.cpfCnpj].some(v=>(v||"").toLowerCase().includes(q))); },[busca,tutoresOrdenados]);

  function set<K extends keyof typeof form>(k:K,v:(typeof form)[K]) { setForm(f=>({...f,[k]:v})); }
  async function buscarCep(){ const cep=soDigitos(form.cep||""); if(cep.length!==8)return; setBuscandoCep(true); try{ const r=await fetch(`https://viacep.com.br/ws/${cep}/json/`); const d=await r.json(); if(d?.erro)return void toast.error("CEP não encontrado."); setForm(f=>({...f,estado:d.uf||f.estado,cidade:d.localidade||f.cidade,bairro:d.bairro||f.bairro,endereco:d.logradouro||f.endereco})); }catch{toast.error("Não foi possível consultar o CEP agora.");}finally{setBuscandoCep(false);} }
  function cadastrar(){ if(!form.nome.trim()) return void toast.error("Informe o nome do tutor."); if(!soDigitos(form.telefone).length) return void toast.error("Informe o telefone do tutor."); const telefone=soDigitos(form.telefone), documento=soDigitos(form.cpfCnpj||""), email=(form.email||"").trim().toLowerCase(); const duplicado=tutores.find(t=>soDigitos(t.telefone)===telefone||(documento&&soDigitos(t.cpfCnpj||"")===documento)||(email&&(t.email||"").trim().toLowerCase()===email)); if(duplicado)return void toast.error(`Já existe um tutor semelhante: ${duplicado.nome}.`); const novo:Tutor={...form,id:crypto.randomUUID(),criadoEm:new Date().toISOString()}; const lista=[novo,...tutores]; setTutores(lista); salvarLista(lista); setForm(vazio); setModo("procurar"); setBusca(novo.nome); setLetra("TODOS"); toast.success("Tutor cadastrado com sucesso."); }

  const campo="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10";

  return <main className="mx-auto min-h-screen w-full max-w-[1200px] px-4 pb-28 pt-6 sm:px-6">
    <div className="mb-6"><Link to="/recepcao" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar para Recepção</Link><div className="mt-4 flex items-center gap-2"><Users size={23} className="text-primary"/><h1 className="text-3xl font-black">Tutores</h1></div></div>

    <div className="inline-flex w-full rounded-2xl border bg-white p-1 shadow-sm sm:w-auto">
      <button type="button" onClick={()=>setModo("procurar")} className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold sm:flex-none ${modo==="procurar"?"bg-primary text-primary-foreground":"text-muted-foreground"}`}><Search size={17}/> Buscar tutor</button>
      <button type="button" onClick={()=>setModo("novo")} className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold sm:flex-none ${modo==="novo"?"bg-primary text-primary-foreground":"text-muted-foreground"}`}><UserPlus size={17}/> Novo tutor</button>
    </div>

    {modo==="procurar" ? <section className="mt-5 rounded-2xl border bg-white p-4 shadow-sm sm:p-5"><div className="relative"><Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por nome, telefone, CPF/CNPJ ou e-mail" className="min-h-12 w-full rounded-xl border bg-white pl-11 pr-4 outline-none focus:border-primary"/></div>{busca.trim()&&<div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{resultados.length?resultados.map(t=><TutorCard key={t.id} tutor={t} animais={animais}/>):<div className="rounded-xl border border-dashed bg-slate-50 p-5 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">Nenhum tutor encontrado.</div>}</div>}</section> : <section className="mt-5 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="space-y-5 p-4 sm:p-5">
      <Bloco titulo="Dados principais"><label className="sm:col-span-2 text-sm font-semibold">Nome completo *<input value={form.nome} onChange={e=>set("nome",e.target.value)} className={campo}/></label><label className="text-sm font-semibold">Nome social<input value={form.nomeSocial} onChange={e=>set("nomeSocial",e.target.value)} className={campo}/></label><label className="text-sm font-semibold">Pronome<select value={form.pronome} onChange={e=>set("pronome",e.target.value)} className={campo}><option value="">Não informado</option><option>Ele/dele</option><option>Ela/dela</option><option>Elu/delu</option><option>Outro</option></select></label><label className="text-sm font-semibold">Telefone / WhatsApp *<input value={form.telefone} onChange={e=>set("telefone",mascaraTelefone(e.target.value))} className={campo}/></label><label className="text-sm font-semibold">Outro telefone<input value={form.outroTelefone} onChange={e=>set("outroTelefone",mascaraTelefone(e.target.value))} className={campo}/></label><label className="sm:col-span-2 text-sm font-semibold">E-mail<input type="email" value={form.email} onChange={e=>set("email",e.target.value)} className={campo}/></label></Bloco>
      <Bloco titulo="Documentos e perfil"><label className="text-sm font-semibold">Tipo de pessoa *<select value={form.tipoPessoa} onChange={e=>set("tipoPessoa",e.target.value as Tutor["tipoPessoa"])} className={campo}><option>Pessoa física</option><option>Pessoa jurídica</option></select></label><label className="text-sm font-semibold">{form.tipoPessoa==="Pessoa jurídica"?"CNPJ":"CPF"}<input value={form.cpfCnpj} onChange={e=>set("cpfCnpj",mascaraDocumento(e.target.value,form.tipoPessoa))} className={campo}/></label><label className="text-sm font-semibold">RG<input value={form.rg} onChange={e=>set("rg",e.target.value)} className={campo}/></label><label className="text-sm font-semibold">Nascimento<input type="date" value={form.nascimento} onChange={e=>set("nascimento",e.target.value)} className={campo}/></label><label className="text-sm font-semibold">Sexo<select value={form.sexo} onChange={e=>set("sexo",e.target.value)} className={campo}><option value="">Não informado</option><option>Masculino</option><option>Feminino</option><option>Outro</option></select></label><label className="text-sm font-semibold">Profissão<input value={form.profissao} onChange={e=>set("profissao",e.target.value)} className={campo}/></label></Bloco>
      <Bloco titulo="Contato e preferências"><label className="text-sm font-semibold">Contato preferencial<select value={form.contatoPreferencial} onChange={e=>set("contatoPreferencial",e.target.value)} className={campo}><option>WhatsApp</option><option>Ligação</option><option>E-mail</option></select></label><label className="text-sm font-semibold">Horário preferencial<input value={form.horarioPreferencial} onChange={e=>set("horarioPreferencial",e.target.value)} className={campo}/></label><label className="text-sm font-semibold">Contato de emergência<input value={form.contatoEmergenciaNome} onChange={e=>set("contatoEmergenciaNome",e.target.value)} className={campo}/></label><label className="text-sm font-semibold">Telefone de emergência<input value={form.contatoEmergenciaTelefone} onChange={e=>set("contatoEmergenciaTelefone",mascaraTelefone(e.target.value))} className={campo}/></label></Bloco>
      <Bloco titulo="Endereço"><label className="text-sm font-semibold">CEP<input value={form.cep} onChange={e=>set("cep",mascaraCep(e.target.value))} onBlur={buscarCep} className={campo}/><span className="text-[11px] text-muted-foreground">{buscandoCep?"Consultando CEP...":"Preenchimento automático ao sair do campo."}</span></label><label className="text-sm font-semibold">Estado<input value={form.estado} onChange={e=>set("estado",e.target.value)} className={campo}/></label><label className="text-sm font-semibold">Cidade<input value={form.cidade} onChange={e=>set("cidade",e.target.value)} className={campo}/></label><label className="text-sm font-semibold">Bairro<input value={form.bairro} onChange={e=>set("bairro",e.target.value)} className={campo}/></label><label className="sm:col-span-2 text-sm font-semibold">Endereço<input value={form.endereco} onChange={e=>set("endereco",e.target.value)} className={campo}/></label></Bloco>
      <label className="text-sm font-semibold">Observações<textarea rows={4} value={form.observacoes} onChange={e=>set("observacoes",e.target.value)} className={`${campo} py-3`}/></label><div className="flex justify-end gap-2"><button type="button" onClick={()=>setModo("procurar")} className="rounded-xl border px-4 py-3 font-semibold">Cancelar</button><button type="button" onClick={cadastrar} className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">Salvar tutor</button></div>
    </div></section>}

    <section className="mt-6 rounded-2xl border bg-white p-4 shadow-sm sm:p-5"><h2 className="flex items-center gap-2 text-lg font-black"><Users size={20} className="text-primary"/> Tutores cadastrados <span className="text-sm text-muted-foreground">({tutores.length})</span></h2><div className="mt-4 flex flex-wrap gap-1.5"><button type="button" onClick={()=>setLetra("TODOS")} className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${letra==="TODOS"?"bg-primary text-primary-foreground":"bg-white"}`}>Todos</button>{ALFABETO.map(l=><button key={l} type="button" disabled={!letrasDisponiveis.has(l)} onClick={()=>setLetra(l)} className={`h-8 min-w-8 rounded-lg border text-sm font-bold ${letra===l?"bg-primary text-primary-foreground":"bg-white"} disabled:opacity-25`}>{l}</button>)}</div>{tutores.length===0?<div className="mt-4 rounded-xl border border-dashed bg-slate-50 p-7 text-center"><p className="text-sm text-muted-foreground">Nenhum tutor cadastrado ainda.</p><button type="button" onClick={()=>setModo("novo")} className="mt-3 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Cadastrar tutor</button></div>:<div className="mt-5 space-y-5">{gruposAlfabeticos.map(([i,lista])=><div key={i}><div className="mb-2 text-xl font-black text-primary">{i}</div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{lista.map(t=><TutorCard key={t.id} tutor={t} animais={animais}/>)}</div></div>)}</div>}</section>
  </main>;
}

function TutorCard({tutor,animais}:{tutor:Tutor;animais:AnimalResumo[]}){
  const pets=animais.filter(a=>a.tutorId===tutor.id).map(a=>a.nome).filter(Boolean);
  return <article className="flex h-full min-w-0 flex-col rounded-xl border bg-white p-3 text-sm shadow-sm">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-snug">
        <strong className="font-black">{tutor.nome}</strong>
        <span className="text-muted-foreground">·</span>
        <span className="whitespace-nowrap">{tutor.telefone}</span>
        {tutor.outroTelefone&&<><span className="text-muted-foreground">·</span><span className="whitespace-nowrap">{tutor.outroTelefone}</span></>}
        {tutor.email&&<><span className="text-muted-foreground">·</span><span className="min-w-0 truncate text-muted-foreground">{tutor.email}</span></>}
      </div>
      <div className="mt-2 flex min-w-0 items-center gap-1.5 border-t pt-2">
        <PawPrint size={14} className={pets.length?"shrink-0 text-primary":"shrink-0 text-muted-foreground"}/>
        <span className={`min-w-0 truncate ${pets.length?"font-semibold text-primary":"text-muted-foreground"}`}>{pets.length?pets.join(" / "):"Sem pet cadastrado"}</span>
      </div>
    </div>
    <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
      <button type="button" className="flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold">Ver cadastro</button>
      <a href={`/novo-animal?tutorId=${encodeURIComponent(tutor.id)}`} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary"><PawPrint size={13}/> Cadastrar animal</a>
    </div>
  </article>;
}
function Bloco({titulo,children}:{titulo:string;children:React.ReactNode}){ return <section><h2 className="mb-2 text-sm font-black uppercase tracking-wide text-primary">{titulo}</h2><div className="grid gap-3 sm:grid-cols-2">{children}</div></section>; }
