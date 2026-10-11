import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Search, UserPlus, PawPrint, Users } from "lucide-react";
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

type Modo = "procurar" | "novo";

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
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || "[]");
  } catch {
    return [];
  }
}

function salvarLista(lista: Tutor[]) {
  localStorage.setItem(CHAVE, JSON.stringify(lista));
}

function soDigitos(v: string) {
  return v.replace(/\D/g, "");
}

function mascaraTelefone(v: string) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}

function mascaraCep(v: string) {
  return soDigitos(v).slice(0, 8).replace(/(\d{5})(\d{0,3})/, "$1-$2").replace(/-$/, "");
}

function mascaraDocumento(v: string, tipoPessoa: Tutor["tipoPessoa"]) {
  const d = soDigitos(v);
  if (tipoPessoa === "Pessoa jurídica") {
    return d.slice(0, 14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5").replace(/[-\/.]+$/, "");
  }
  return d.slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4").replace(/[-\.]+$/, "");
}

function Tutores() {
  const [modo, setModo] = useState<Modo>("procurar");
  const [form, setForm] = useState(vazio);
  const [tutores, setTutores] = useState<Tutor[]>(carregar);
  const [busca, setBusca] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);

  const resultados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return tutores;
    return tutores.filter((t) =>
      [t.nome, t.nomeSocial, t.telefone, t.outroTelefone, t.email, t.cpfCnpj].some((v) =>
        (v || "").toLowerCase().includes(q),
      ),
    );
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
      setForm((atual) => ({
        ...atual,
        estado: dados.uf || atual.estado,
        cidade: dados.localidade || atual.cidade,
        bairro: dados.bairro || atual.bairro,
        endereco: dados.logradouro || atual.endereco,
      }));
    } catch {
      toast.error("Não foi possível consultar o CEP agora.");
    } finally {
      setBuscandoCep(false);
    }
  }

  function cadastrar() {
    if (!form.nome.trim()) return void toast.error("Informe o nome do tutor.");
    if (!soDigitos(form.telefone).length) return void toast.error("Informe o telefone do tutor.");

    const telefone = soDigitos(form.telefone);
    const documento = soDigitos(form.cpfCnpj || "");
    const email = (form.email || "").trim().toLowerCase();
    const duplicado = tutores.find(
      (t) =>
        soDigitos(t.telefone) === telefone ||
        (documento && soDigitos(t.cpfCnpj || "") === documento) ||
        (email && (t.email || "").trim().toLowerCase() === email),
    );
    if (duplicado) return void toast.error(`Já existe um tutor semelhante: ${duplicado.nome}.`);

    const novo: Tutor = { ...form, id: crypto.randomUUID(), criadoEm: new Date().toISOString() };
    const lista = [novo, ...tutores];
    setTutores(lista);
    salvarLista(lista);
    setForm(vazio);
    setModo("procurar");
    setBusca(novo.nome);
    toast.success("Tutor cadastrado com sucesso.");
  }

  const campo = "mt-1 min-h-11 w-full rounded-xl border bg-white px-3 font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10";

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1200px] px-4 pb-28 pt-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/recepcao" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft size={18} /> Voltar para Recepção
        </Link>
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Users size={18} /> Tutores
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setModo("procurar")}
          className={`rounded-2xl border-2 p-5 text-left shadow-sm transition ${modo === "procurar" ? "border-primary bg-primary/5" : "border-border bg-white hover:border-primary/40"}`}
        >
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${modo === "procurar" ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
              <Search size={22} />
            </span>
            <div>
              <h1 className="text-xl font-black">Procurar tutor</h1>
              <p className="mt-1 text-sm text-muted-foreground">Localize um tutor já cadastrado na clínica.</p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setModo("novo")}
          className={`rounded-2xl border-2 p-5 text-left shadow-sm transition ${modo === "novo" ? "border-primary bg-primary/5" : "border-border bg-white hover:border-primary/40"}`}
        >
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${modo === "novo" ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
              <UserPlus size={22} />
            </span>
            <div>
              <h1 className="text-xl font-black">Inserir novo tutor</h1>
              <p className="mt-1 text-sm text-muted-foreground">Cadastre um novo responsável na base da clínica.</p>
            </div>
          </div>
        </button>
      </div>

      {modo === "procurar" ? (
        <section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-lg font-black">
            <Search size={20} className="text-primary" /> Procurar tutor
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Pesquise por nome, telefone, CPF/CNPJ ou e-mail.</p>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Digite para procurar..."
            className={`${campo} mt-4`}
            autoFocus
          />

          {busca.trim() && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {resultados.length === 0 ? (
                <div className="md:col-span-2 rounded-xl border border-dashed bg-slate-50 p-5 text-sm text-muted-foreground">Nenhum tutor encontrado.</div>
              ) : (
                resultados.map((t) => <TutorCard key={t.id} tutor={t} />)
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="mt-5 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b bg-primary/10 px-5 py-3 text-primary">
            <UserPlus size={19} />
            <h2 className="text-lg font-black">Inserir novo tutor</h2>
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            <Bloco titulo="Dados principais">
              <label className="sm:col-span-2 text-sm font-semibold">Nome completo *<input value={form.nome} onChange={(e) => set("nome", e.target.value)} className={campo} /></label>
              <label className="text-sm font-semibold">Nome social<input value={form.nomeSocial} onChange={(e) => set("nomeSocial", e.target.value)} className={campo} /></label>
              <label className="text-sm font-semibold">Pronome<select value={form.pronome} onChange={(e) => set("pronome", e.target.value)} className={campo}><option value="">Não informado</option><option>Ele/dele</option><option>Ela/dela</option><option>Elu/delu</option><option>Outro</option></select></label>
              <label className="text-sm font-semibold">Telefone / WhatsApp *<input value={form.telefone} onChange={(e) => set("telefone", mascaraTelefone(e.target.value))} className={campo} /></label>
              <label className="text-sm font-semibold">Outro telefone<input value={form.outroTelefone} onChange={(e) => set("outroTelefone", mascaraTelefone(e.target.value))} className={campo} /></label>
              <label className="sm:col-span-2 text-sm font-semibold">E-mail<input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={campo} /></label>
            </Bloco>

            <Bloco titulo="Documentos e perfil">
              <label className="text-sm font-semibold">Tipo de pessoa *<select value={form.tipoPessoa} onChange={(e) => set("tipoPessoa", e.target.value as Tutor["tipoPessoa"])} className={campo}><option>Pessoa física</option><option>Pessoa jurídica</option></select></label>
              <label className="text-sm font-semibold">{form.tipoPessoa === "Pessoa jurídica" ? "CNPJ" : "CPF"}<input value={form.cpfCnpj} onChange={(e) => set("cpfCnpj", mascaraDocumento(e.target.value, form.tipoPessoa))} className={campo} /></label>
              <label className="text-sm font-semibold">RG<input value={form.rg} onChange={(e) => set("rg", e.target.value)} className={campo} /></label>
              <label className="text-sm font-semibold">Tipo de documento<input value={form.tipoDocumento} onChange={(e) => set("tipoDocumento", e.target.value)} placeholder="Ex.: RG, passaporte" className={campo} /></label>
              <label className="text-sm font-semibold">Nascimento<input type="date" value={form.nascimento} onChange={(e) => set("nascimento", e.target.value)} className={campo} /></label>
              <label className="text-sm font-semibold">Sexo<select value={form.sexo} onChange={(e) => set("sexo", e.target.value)} className={campo}><option value="">Não informado</option><option>Masculino</option><option>Feminino</option><option>Outro</option><option>Prefere não informar</option></select></label>
              <label className="text-sm font-semibold">Profissão<input value={form.profissao} onChange={(e) => set("profissao", e.target.value)} className={campo} /></label>
              <label className="text-sm font-semibold">Origem do cliente<select value={form.origem} onChange={(e) => set("origem", e.target.value)} className={campo}><option value="">Não informado</option><option>Indicação</option><option>Instagram</option><option>Google</option><option>Site</option><option>Passante</option><option>Outro</option></select></label>
            </Bloco>

            <Bloco titulo="Contato e preferências">
              <label className="text-sm font-semibold">Contato preferencial<select value={form.contatoPreferencial} onChange={(e) => set("contatoPreferencial", e.target.value)} className={campo}><option>WhatsApp</option><option>Ligação</option><option>E-mail</option></select></label>
              <label className="text-sm font-semibold">Horário preferencial<input value={form.horarioPreferencial} onChange={(e) => set("horarioPreferencial", e.target.value)} placeholder="Ex.: após 18h" className={campo} /></label>
              <label className="text-sm font-semibold">Contato de emergência<input value={form.contatoEmergenciaNome} onChange={(e) => set("contatoEmergenciaNome", e.target.value)} placeholder="Nome" className={campo} /></label>
              <label className="text-sm font-semibold">Telefone de emergência<input value={form.contatoEmergenciaTelefone} onChange={(e) => set("contatoEmergenciaTelefone", mascaraTelefone(e.target.value))} className={campo} /></label>
              <label className="sm:col-span-2 text-sm font-semibold">Veterinário preferencial<input value={form.veterinarioPreferencial} onChange={(e) => set("veterinarioPreferencial", e.target.value)} className={campo} /></label>
              <div className="sm:col-span-2 grid gap-2 sm:grid-cols-2">
                <Check label="Autoriza lembretes automáticos" checked={!!form.autorizaLembretes} onChange={(v) => set("autorizaLembretes", v)} />
                <Check label="Autoriza contato por WhatsApp" checked={!!form.autorizaWhatsapp} onChange={(v) => set("autorizaWhatsapp", v)} />
                <Check label="Autoriza contato por e-mail" checked={!!form.autorizaEmail} onChange={(v) => set("autorizaEmail", v)} />
                <Check label="Autoriza campanhas/promocionais" checked={!!form.autorizaMarketing} onChange={(v) => set("autorizaMarketing", v)} />
              </div>
            </Bloco>

            <Bloco titulo="Responsável financeiro">
              <label className="text-sm font-semibold">Nome do responsável financeiro<input value={form.responsavelFinanceiroNome} onChange={(e) => set("responsavelFinanceiroNome", e.target.value)} className={campo} /></label>
              <label className="text-sm font-semibold">CPF/CNPJ do responsável<input value={form.responsavelFinanceiroDocumento} onChange={(e) => set("responsavelFinanceiroDocumento", e.target.value)} className={campo} /></label>
            </Bloco>

            <Bloco titulo="Endereço">
              <label className="text-sm font-semibold">CEP<input value={form.cep} onChange={(e) => set("cep", mascaraCep(e.target.value))} onBlur={buscarCep} className={campo} /><span className="mt-1 block text-[11px] text-muted-foreground">{buscandoCep ? "Consultando CEP..." : "Preenchimento automático ao sair do campo."}</span></label>
              <label className="text-sm font-semibold">Estado<input value={form.estado} onChange={(e) => set("estado", e.target.value)} className={campo} /></label>
              <label className="text-sm font-semibold">Cidade<input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} className={campo} /></label>
              <label className="text-sm font-semibold">Bairro<input value={form.bairro} onChange={(e) => set("bairro", e.target.value)} className={campo} /></label>
              <label className="sm:col-span-2 text-sm font-semibold">Endereço<input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} className={campo} /></label>
              <label className="text-sm font-semibold">Número<input value={form.numero} onChange={(e) => set("numero", e.target.value)} className={campo} /></label>
              <label className="text-sm font-semibold">Complemento<input value={form.complemento} onChange={(e) => set("complemento", e.target.value)} className={campo} /></label>
            </Bloco>

            <div>
              <label className="text-sm font-semibold">Observações<textarea rows={4} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} placeholder="Preferências, restrições, informações importantes para atendimento..." className={`${campo} py-3`} /></label>
              <button type="button" onClick={cadastrar} className="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground">Cadastrar tutor</button>
            </div>
          </div>
        </section>
      )}

      <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-lg font-black"><Users size={20} className="text-primary" /> Todos os tutores cadastrados</div>
            <p className="mt-1 text-sm text-muted-foreground">Base de tutores desta clínica · {tutores.length} {tutores.length === 1 ? "cadastro" : "cadastros"}</p>
          </div>
          <button type="button" onClick={() => { setModo("novo"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><UserPlus size={16} /> Inserir novo tutor</button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {tutores.length === 0 ? (
            <div className="md:col-span-2 lg:col-span-3 rounded-xl border border-dashed bg-slate-50 p-6 text-center text-sm text-muted-foreground">Nenhum tutor cadastrado nesta clínica.</div>
          ) : (
            tutores.map((t) => <TutorCard key={t.id} tutor={t} />)
          )}
        </div>
      </section>
    </main>
  );
}

function TutorCard({ tutor }: { tutor: Tutor }) {
  return (
    <article className="rounded-xl border bg-white p-4">
      <div className="font-black">{tutor.nome}</div>
      {tutor.nomeSocial && <div className="text-xs text-muted-foreground">Nome social: {tutor.nomeSocial}</div>}
      <div className="mt-2 text-sm font-medium">{tutor.telefone}</div>
      {tutor.email && <div className="mt-0.5 truncate text-xs text-muted-foreground">{tutor.email}</div>}
      {tutor.cpfCnpj && <div className="mt-0.5 text-xs text-muted-foreground">{tutor.tipoPessoa === "Pessoa jurídica" ? "CNPJ" : "CPF"}: {tutor.cpfCnpj}</div>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold">Ver cadastro</button>
        <button type="button" className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary"><PawPrint size={13} /> Cadastrar animal</button>
      </div>
    </article>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <section><h2 className="mb-2 text-sm font-black uppercase tracking-wide text-primary">{titulo}</h2><div className="grid gap-3 sm:grid-cols-2">{children}</div></section>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-center gap-2 rounded-xl border bg-slate-50 px-3 py-2 text-sm font-semibold"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />{label}</label>;
}
