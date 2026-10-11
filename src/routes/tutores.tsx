import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Search, UserPlus, PawPrint } from "lucide-react";
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

const CHAVE = "oricse-tutores-v1";

const vazio: Omit<Tutor, "id" | "criadoEm"> = {
  nome: "",
  nomeSocial: "",
  pronome: "",
  telefone: "",
  outroTelefone: "",
  email: "",
  tipoPessoa: "Pessoa física",
  cpfCnpj: "",
  rg: "",
  tipoDocumento: "",
  nascimento: "",
  sexo: "",
  profissao: "",
  origem: "",
  contatoPreferencial: "WhatsApp",
  contatoEmergenciaNome: "",
  contatoEmergenciaTelefone: "",
  autorizaLembretes: true,
  autorizaWhatsapp: true,
  autorizaEmail: false,
  autorizaMarketing: false,
  responsavelFinanceiroNome: "",
  responsavelFinanceiroDocumento: "",
  veterinarioPreferencial: "",
  horarioPreferencial: "",
  cep: "",
  estado: "",
  cidade: "",
  bairro: "",
  endereco: "",
  numero: "",
  complemento: "",
  observacoes: "",
};

function carregar(): Tutor[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CHAVE) || "[]"); } catch { return []; }
}

function salvarLista(lista: Tutor[]) {
  localStorage.setItem(CHAVE, JSON.stringify(lista));
}

function soDigitos(v: string) { return v.replace(/\D/g, ""); }
function mascaraTelefone(v: string) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}
function mascaraCep(v: string) { return soDigitos(v).slice(0, 8).replace(/(\d{5})(\d{0,3})/, "$1-$2").replace(/-$/, ""); }
function mascaraDocumento(v: string, tipoPessoa: Tutor["tipoPessoa"]) {
  const d = soDigitos(v);
  if (tipoPessoa === "Pessoa jurídica") return d.slice(0,14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5").replace(/[-\/.]+$/, "");
  return d.slice(0,11).replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4").replace(/[-\.]+$/, "");
}

function Tutores() {
  const [form, setForm] = useState(vazio);
  const [tutores, setTutores] = useState<Tutor[]>(carregar);
  const [busca, setBusca] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);

  const resultados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return tutores;
    return tutores.filter((t) => [t.nome, t.nomeSocial, t.telefone, t.outroTelefone, t.email, t.cpfCnpj].some((v) => (v || "").toLowerCase().includes(q)));
  }, [busca, tutores]);

  function set<K extends keyof typeof form>(chave: K, valor: (typeof form)[K]) {
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  async function buscarCep() {
    const cep = soDigitos(form.cep || "");
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const dados = await resposta.json();
      if (dados?.erro) return void toast.error("CEP não encontrado.");
      setForm((atual) => ({ ...atual, estado: dados.uf || atual.estado, cidade: dados.localidade || atual.cidade, bairro: dados.bairro || atual.bairro, endereco: dados.logradouro || atual.endereco }));
    } catch {
      toast.error("Não foi possível consultar o CEP agora.");
    } finally { setBuscandoCep(false); }
  }

  function cadastrar() {
    if (!form.nome.trim()) return void toast.error("Informe o nome do tutor.");
    if (!soDigitos(form.telefone).length) return void toast.error("Informe o telefone do tutor.");

    const telefone = soDigitos(form.telefone);
    const documento = soDigitos(form.cpfCnpj || "");
    const email = (form.email || "").trim().toLowerCase();
    const duplicado = tutores.find((t) => soDigitos(t.telefone) === telefone || (documento && soDigitos(t.cpfCnpj || "") === documento) || (email && (t.email || "").trim().toLowerCase() === email));
    if (duplicado) return void toast.error(`Já existe um tutor semelhante: ${duplicado.nome}.`);

    const novo: Tutor = { ...form, id: crypto.randomUUID(), criadoEm: new Date().toISOString() };
    const lista = [novo, ...tutores];
    setTutores(lista);
    salvarLista(lista);
    setForm(vazio);
    toast.success("Tutor cadastrado com sucesso.");
  }

  const campo = "mt-1 min-h-11 w-full rounded-xl border bg-white px-3 font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10";

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1200px] px-4 pb-28 pt-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/recepcao" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar para Recepção</Link>
        <div className="flex items-center gap-2 text-sm font-semibold text-primary"><UserPlus size={18}/> Cadastro de tutor</div>
      </div>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b bg-primary/10 px-5 py-3 text-primary"><UserPlus size={19}/><h1 className="text-lg font-black">Cadastrar novo tutor</h1></div>

        <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[1fr_330px]">
          <div className="space-y-5">
            <Bloco titulo="Dados principais">
              <label className="sm:col-span-2 text-sm font-semibold">Nome completo *<input value={form.nome} onChange={(e) => set("nome", e.target.value)} className={campo}/></label>
              <label className="text-sm font-semibold">Nome social<input value={form.nomeSocial} onChange={(e) => set("nomeSocial", e.target.value)} className={campo}/></label>
              <label className="text-sm font-semibold">Pronome<select value={form.pronome} onChange={(e) => set("pronome", e.target.value)} className={campo}><option value="">Não informado</option><option>Ele/dele</option><option>Ela/dela</option><option>Elu/delu</option><option>Outro</option></select></label>
              <label className="text-sm font-semibold">Telefone / WhatsApp *<input value={form.telefone} onChange={(e) => set("telefone", mascaraTelefone(e.target.value))} className={campo}/></label>
              <label className="text-sm font-semibold">Outro telefone<input value={form.outroTelefone} onChange={(e) => set("outroTelefone", mascaraTelefone(e.target.value))} className={campo}/></label>
              <label className="sm:col-span-2 text-sm font-semibold">E-mail<input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={campo}/></label>
            </Bloco>

            <Bloco titulo="Documentos e perfil">
              <label className="text-sm font-semibold">Tipo de pessoa *<select value={form.tipoPessoa} onChange={(e) => set("tipoPessoa", e.target.value as Tutor["tipoPessoa"])} className={campo}><option>Pessoa física</option><option>Pessoa jurídica</option></select></label>
              <label className="text-sm font-semibold">{form.tipoPessoa === "Pessoa jurídica" ? "CNPJ" : "CPF"}<input value={form.cpfCnpj} onChange={(e) => set("cpfCnpj", mascaraDocumento(e.target.value, form.tipoPessoa))} className={campo}/></label>
              <label className="text-sm font-semibold">RG<input value={form.rg} onChange={(e) => set("rg", e.target.value)} className={campo}/></label>
              <label className="text-sm font-semibold">Tipo de documento<input value={form.tipoDocumento} onChange={(e) => set("tipoDocumento", e.target.value)} placeholder="Ex.: RG, passaporte" className={campo}/></label>
              <label className="text-sm font-semibold">Nascimento<input type="date" value={form.nascimento} onChange={(e) => set("nascimento", e.target.value)} className={campo}/></label>
              <label className="text-sm font-semibold">Sexo<select value={form.sexo} onChange={(e) => set("sexo", e.target.value)} className={campo}><option value="">Não informado</option><option>Masculino</option><option>Feminino</option><option>Outro</option><option>Prefere não informar</option></select></label>
              <label className="text-sm font-semibold">Profissão<input value={form.profissao} onChange={(e) => set("profissao", e.target.value)} className={campo}/></label>
              <label className="text-sm font-semibold">Origem do cliente<select value={form.origem} onChange={(e) => set("origem", e.target.value)} className={campo}><option value="">Não informado</option><option>Indicação</option><option>Instagram</option><option>Google</option><option>Site</option><option>Passante</option><option>Outro</option></select></label>
            </Bloco>

            <Bloco titulo="Contato e preferências">
              <label className="text-sm font-semibold">Contato preferencial<select value={form.contatoPreferencial} onChange={(e) => set("contatoPreferencial", e.target.value)} className={campo}><option>WhatsApp</option><option>Ligação</option><option>E-mail</option></select></label>
              <label className="text-sm font-semibold">Horário preferencial<input value={form.horarioPreferencial} onChange={(e) => set("horarioPreferencial", e.target.value)} placeholder="Ex.: após 18h" className={campo}/></label>
              <label className="text-sm font-semibold">Contato de emergência<input value={form.contatoEmergenciaNome} onChange={(e) => set("contatoEmergenciaNome", e.target.value)} placeholder="Nome" className={campo}/></label>
              <label className="text-sm font-semibold">Telefone de emergência<input value={form.contatoEmergenciaTelefone} onChange={(e) => set("contatoEmergenciaTelefone", mascaraTelefone(e.target.value))} className={campo}/></label>
              <label className="sm:col-span-2 text-sm font-semibold">Veterinário preferencial<input value={form.veterinarioPreferencial} onChange={(e) => set("veterinarioPreferencial", e.target.value)} className={campo}/></label>
              <div className="sm:col-span-2 grid gap-2 sm:grid-cols-2">
                <Check label="Autoriza lembretes automáticos" checked={!!form.autorizaLembretes} onChange={(v) => set("autorizaLembretes", v)}/>
                <Check label="Autoriza contato por WhatsApp" checked={!!form.autorizaWhatsapp} onChange={(v) => set("autorizaWhatsapp", v)}/>
                <Check label="Autoriza contato por e-mail" checked={!!form.autorizaEmail} onChange={(v) => set("autorizaEmail", v)}/>
                <Check label="Autoriza campanhas/promocionais" checked={!!form.autorizaMarketing} onChange={(v) => set("autorizaMarketing", v)}/>
              </div>
            </Bloco>

            <Bloco titulo="Responsável financeiro">
              <label className="text-sm font-semibold">Nome do responsável financeiro<input value={form.responsavelFinanceiroNome} onChange={(e) => set("responsavelFinanceiroNome", e.target.value)} className={campo}/></label>
              <label className="text-sm font-semibold">CPF/CNPJ do responsável<input value={form.responsavelFinanceiroDocumento} onChange={(e) => set("responsavelFinanceiroDocumento", e.target.value)} className={campo}/></label>
            </Bloco>

            <Bloco titulo="Endereço">
              <label className="text-sm font-semibold">CEP<input value={form.cep} onChange={(e) => set("cep", mascaraCep(e.target.value))} onBlur={buscarCep} className={campo}/><span className="mt-1 block text-[11px] text-muted-foreground">{buscandoCep ? "Consultando CEP..." : "Preenchimento automático ao sair do campo."}</span></label>
              <label className="text-sm font-semibold">Estado<input value={form.estado} onChange={(e) => set("estado", e.target.value)} className={campo}/></label>
              <label className="text-sm font-semibold">Cidade<input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} className={campo}/></label>
              <label className="text-sm font-semibold">Bairro<input value={form.bairro} onChange={(e) => set("bairro", e.target.value)} className={campo}/></label>
              <label className="sm:col-span-2 text-sm font-semibold">Endereço<input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} className={campo}/></label>
              <label className="text-sm font-semibold">Número<input value={form.numero} onChange={(e) => set("numero", e.target.value)} className={campo}/></label>
              <label className="text-sm font-semibold">Complemento<input value={form.complemento} onChange={(e) => set("complemento", e.target.value)} className={campo}/></label>
            </Bloco>

            <div>
              <label className="text-sm font-semibold">Observações<textarea rows={4} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} placeholder="Preferências, restrições, informações importantes para atendimento..." className={`${campo} py-3`}/></label>
              <button type="button" onClick={cadastrar} className="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground">Cadastrar tutor</button>
            </div>
          </div>

          <aside className="lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="flex items-center gap-2 font-bold"><Search size={18}/> Consultar tutores</div>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, telefone, CPF ou e-mail" className={`${campo} mt-3 bg-white`}/>
              <div className="mt-3 max-h-[520px] space-y-2 overflow-auto pr-1">
                {resultados.length === 0 ? <p className="rounded-xl border border-dashed bg-white p-4 text-sm text-muted-foreground">Nenhum tutor encontrado.</p> : resultados.map((t) => <div key={t.id} className="rounded-xl border bg-white p-3"><div className="font-bold">{t.nome}</div>{t.nomeSocial && <div className="text-xs text-muted-foreground">Nome social: {t.nomeSocial}</div>}<div className="mt-1 text-sm">{t.telefone}</div>{t.email && <div className="truncate text-xs text-muted-foreground">{t.email}</div>}<div className="mt-2 flex gap-2"><button type="button" className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold">Ver cadastro</button><button type="button" className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary"><PawPrint size={13}/> Cadastrar animal</button></div></div>)}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <section><h2 className="mb-2 text-sm font-black uppercase tracking-wide text-primary">{titulo}</h2><div className="grid gap-3 sm:grid-cols-2">{children}</div></section>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-center gap-2 rounded-xl border bg-slate-50 px-3 py-2 text-sm font-semibold"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4"/>{label}</label>;
}
