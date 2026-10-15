import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeDollarSign,
  Building2,
  CalendarDays,
  CreditCard,
  Database,
  ExternalLink,
  Gauge,
  Globe2,
  HardDrive,
  ImageUp,
  LogOut,
  PanelsTopLeft,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extrairDriveFolderId } from "@/lib/drive-storage";
import { testarEConectarPastaDrive } from "@/lib/drive.functions";
import { garantirPastaOricse } from "@/lib/drive-default.functions";
import { enviarLogoClinica } from "@/lib/clinic-logo.functions";
import { excluirClinica } from "@/lib/admin-users.functions";
import { ClinicUsersPanel } from "@/components/admin/ClinicUsersPanel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin")({ component: Admin });

type Aba = "dashboard" | "clinicas" | "planos" | "site" | "sistema" | "paginas";
type AbaClinica = "cadastro" | "situacao" | "usuarios" | "drive";
type PapelClinica = "rt" | "veterinario" | "auxiliar_estagiario" | "recepcao";
type StatusFinanceiro = "em_dia" | "pendente" | "atrasado" | "isento" | "teste";
type FiltroClinica = "todas" | "pagas" | "inadimplentes" | "canceladas";

type Clinica = {
  id: string;
  nome: string;
  slug: string | null;
  tipo_publico: "vet" | "pet";
  status: "ativa" | "bloqueada" | "inativa" | "cancelada";
  plano: string;
  dominio: string | null;
  limite_usuarios: number;
  observacoes: string | null;
  logo_url: string | null;
  created_at: string;
  ultimo_pagamento_em: string | null;
  proximo_pagamento_em: string | null;
  acesso_ate: string | null;
  status_financeiro: StatusFinanceiro;
};

type NovaClinica = Pick<Clinica, "nome" | "slug" | "tipo_publico" | "plano" | "limite_usuarios">;

const CAMPOS_CLINICA = "id,nome,slug,tipo_publico,status,plano,dominio,limite_usuarios,observacoes,logo_url,created_at,ultimo_pagamento_em,proximo_pagamento_em,acesso_ate,status_financeiro";

type AppUser = { user_id: string; username: string; role: string; email?: string | null; created_at: string };
type Vinculo = { clinica_id: string; user_id: string; papel: PapelClinica; ativo: boolean };
type DriveConfig = { modo: "oricse" | "personalizado"; root_folder_id: string | null; root_folder_url: string | null; status: string };
type Plano = {
  id?: string;
  codigo: string;
  nome: string;
  publico_alvo: string;
  preco: string;
  preco_mensal: string;
  preco_anual: string;
  descricao: string;
  itens: string[];
  usuarios_inclusos: number;
  dominio_incluso: boolean;
  ativo: boolean;
  ordem: number;
};

type SiteConfig = {
  marca: string;
  titulo_planos: string;
  subtitulo_planos: string;
  cta_plano: string;
  contato: string;
  logo_url?: string;
};

const ABAS: { id: Aba; nome: string; icone: typeof Gauge }[] = [
  { id: "dashboard", nome: "Visão geral", icone: Gauge },
  { id: "clinicas", nome: "Clínicas", icone: Building2 },
  { id: "planos", nome: "Planos", icone: BadgeDollarSign },
  { id: "site", nome: "Site e marca", icone: PanelsTopLeft },
  { id: "sistema", nome: "Sistema", icone: Settings },
  { id: "paginas", nome: "Páginas e URLs", icone: Globe2 },
];

const PERFIS: Record<PapelClinica, { nome: string; resumo: string; acessos: string[]; bloqueios: string[] }> = {
  rt: {
    nome: "RT",
    resumo: "Responsável Técnico com acesso geral à operação da clínica.",
    acessos: ["Módulos veterinários", "Recepção e fila", "Internação", "Financeiro e caixa", "Estoque", "Cadastros e configurações operacionais"],
    bloqueios: [],
  },
  veterinario: {
    nome: "Veterinário",
    resumo: "Acesso clínico e à recepção necessária para acompanhar o fluxo de pacientes.",
    acessos: ["Prontuários e atendimentos", "Consultório", "Internação", "Prescrições e exames", "Recepção e fila de espera"],
    bloqueios: ["Financeiro", "Caixa", "Configurações financeiras"],
  },
  auxiliar_estagiario: {
    nome: "Auxiliar / Estagiário",
    resumo: "Acesso restrito ao apoio da rotina clínica.",
    acessos: ["Internação", "Fila de espera"],
    bloqueios: ["Prontuários completos", "Prescrição", "Financeiro e caixa", "Configurações", "Recepção administrativa"],
  },
  recepcao: {
    nome: "Recepção",
    resumo: "Acesso à recepção e ao caixa, sem acesso às áreas clínicas do veterinário.",
    acessos: ["Recepção", "Fila de espera", "Agendamentos", "Cadastro de tutores e animais", "Financeiro e caixa"],
    bloqueios: ["Prontuários clínicos", "Prescrições", "Exames clínicos", "Internação clínica", "Ferramentas veterinárias"],
  },
};

const SITE_PADRAO: SiteConfig = {
  marca: "Oricse",
  titulo_planos: "Escolha o plano ideal para sua clínica",
  subtitulo_planos: "Organize atendimento, internação, prontuários, financeiro e estoque em um só sistema.",
  cta_plano: "Escolher plano",
  contato: "",
  logo_url: "",
};

function limparSlug(valor: string) {
  return valor.replace(/@/g, "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9._-]/g, "");
}

function dataInput(valor: string | null | undefined) {
  return valor ? valor.slice(0, 10) : "";
}

function dataBR(valor: string | null | undefined) {
  if (!valor) return "Não informado";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor;
  return d.toLocaleDateString("pt-BR");
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

function Admin() {
  const [aba, setAba] = useState<Aba>("dashboard");
  const [abaClinica, setAbaClinica] = useState<AbaClinica>("cadastro");
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [selecionada, setSelecionada] = useState<Clinica | null>(null);
  const [novaClinica, setNovaClinica] = useState<NovaClinica | null>(null);
  const [criandoClinica, setCriandoClinica] = useState(false);
  const [erroNovaClinica, setErroNovaClinica] = useState("");
  const [buscaClinica, setBuscaClinica] = useState("");
  const [filtroClinica, setFiltroClinica] = useState<FiltroClinica>("todas");
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [cupons, setCupons] = useState<any[]>(() => { try { return JSON.parse(window.localStorage.getItem("vetericio-cupons") || "[]"); } catch { return []; } });
  const [site, setSite] = useState<SiteConfig>(SITE_PADRAO);
  const [rotasEditadas, setRotasEditadas] = useState<Record<string,string>>({});
  const [salvandoRotas, setSalvandoRotas] = useState(false);
  const [drive, setDrive] = useState<DriveConfig | null>(null);
  const [arquivosDrive, setArquivosDrive] = useState(0);
  const [pasta, setPasta] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [excluindoClinica, setExcluindoClinica] = useState(false);
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState("");
  const [logoArquivo, setLogoArquivo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [salvandoLogo, setSalvandoLogo] = useState(false);
  const [enviandoLogoClinica, setEnviandoLogoClinica] = useState(false);

  const clinicasFiltradas = useMemo(() => {
    const q = buscaClinica.trim().toLowerCase();
    let lista = clinicas;
    if (filtroClinica === "pagas") lista = lista.filter((c) => c.status === "ativa" && c.status_financeiro === "em_dia");
    else if (filtroClinica === "inadimplentes") lista = lista.filter((c) => c.status !== "cancelada" && (c.status_financeiro === "pendente" || c.status_financeiro === "atrasado"));
    else if (filtroClinica === "canceladas") lista = lista.filter((c) => c.status === "cancelada");
    if (!q) return lista;
    return lista.filter((c) => [c.nome, c.slug, c.plano, c.status, c.status_financeiro].filter(Boolean).some((x) => String(x).toLowerCase().includes(q)));
  }, [clinicas, buscaClinica, filtroClinica]);

  const usuariosDaClinica = useMemo(() => {
    if (!selecionada) return [];
    return vinculos
      .filter((v) => v.clinica_id === selecionada.id)
      .map((v) => ({ vinculo: v, usuario: usuarios.find((u) => u.user_id === v.user_id) }));
  }, [vinculos, usuarios, selecionada]);

  async function tokenAtual() {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error("Sessão expirada.");
    return data.session.access_token;
  }

  async function carregarTudo() {
    const [c, u, v, p, cfg, arqs] = await Promise.all([
      (supabase as any).from("clinicas").select(CAMPOS_CLINICA).order("nome"),
      (supabase as any).from("app_users").select("user_id,username,role,email,created_at").order("username"),
      (supabase as any).from("clinica_usuarios").select("clinica_id,user_id,papel,ativo"),
      (supabase as any).from("oricse_planos").select("id,codigo,nome,publico_alvo,preco,preco_mensal,preco_anual,descricao,itens,usuarios_inclusos,dominio_incluso,ativo,ordem").order("ordem"),
      (supabase as any).from("oricse_config").select("valor").eq("chave", "site_publico").maybeSingle(),
      (supabase as any).from("drive_arquivos").select("id", { count: "exact", head: true }),
    ]);
    if (c.error) toast.error("Não foi possível carregar as clínicas.");
    if (u.error) toast.error(`Não foi possível carregar os usuários: ${u.error.message}`);
    if (v.error) toast.error(`Não foi possível carregar os vínculos das clínicas: ${v.error.message}`);
    setClinicas(c.data || []);
    setUsuarios(u.data || []);
    setVinculos(v.data || []);
    setPlanos((p.data || []).map((x: any) => ({
      ...x,
      preco_mensal: x.preco_mensal || x.preco || "",
      preco_anual: x.preco_anual || "",
      itens: Array.isArray(x.itens) ? x.itens : [],
    })));
    setSite({ ...SITE_PADRAO, ...(cfg.data?.valor || {}) });
    setArquivosDrive(arqs.count || 0);
    if (selecionada) {
      const atual = (c.data || []).find((x: Clinica) => x.id === selecionada.id);
      if (atual) setSelecionada(atual);
    }
  }

  async function carregarDrive(id: string) {
    const buscar = async () => {
      const { data } = await (supabase as any).from("clinica_drive_config").select("modo,root_folder_id,root_folder_url,status").eq("clinica_id", id).maybeSingle();
      return data as DriveConfig | null;
    };
    let data = await buscar();
    if (!data || (data.modo === "oricse" && !data.root_folder_id)) {
      try {
        await garantirPastaOricse({ data: { accessToken: await tokenAtual(), clinicaId: id } });
        data = await buscar();
      } catch (e) {
        console.error("Falha ao preparar pasta padrão da clínica:", e);
      }
    }
    setDrive(data || { modo: "oricse", root_folder_id: null, root_folder_url: null, status: "pendente" });
    setPasta(data?.modo === "personalizado" ? data.root_folder_url || data.root_folder_id || "" : "");
  }

  useEffect(() => { void carregarTudo(); }, []);
  useEffect(() => { if (selecionada) void carregarDrive(selecionada.id); }, [selecionada?.id]);
  useEffect(() => () => { if (logoPreview) URL.revokeObjectURL(logoPreview); }, [logoPreview]);

  function abrirNovaClinica() {
    const plano = planos.find((p) => p.ativo);
    setErroNovaClinica("");
    setNovaClinica({ nome: "", slug: "", tipo_publico: "vet", plano: plano?.nome || "", limite_usuarios: plano?.usuarios_inclusos || 1 });
  }

  async function cadastrarClinica(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!novaClinica || criandoClinica) return;
    setErroNovaClinica("");

    const nome = novaClinica.nome.trim();
    const slug = limparSlug(novaClinica.slug || "");
    const limiteUsuarios = Number(novaClinica.limite_usuarios);
    if (!nome) return setErroNovaClinica("Informe o nome da clínica.");
    if (!slug || !/[a-z0-9]/.test(slug)) return setErroNovaClinica("Informe um nome válido para o link público.");
    if (clinicas.some((c) => c.slug?.toLowerCase() === slug)) return setErroNovaClinica("Este nome de link já está em uso. Escolha outro para esta clínica.");
    if (!planos.some((p) => p.ativo && p.nome === novaClinica.plano)) return setErroNovaClinica("Selecione um plano ativo para a clínica.");
    if (!Number.isSafeInteger(limiteUsuarios) || limiteUsuarios < 1) return setErroNovaClinica("O limite de usuários deve ser um número inteiro maior que zero.");

    setCriandoClinica(true);
    try {
      const { data, error } = await (supabase as any).from("clinicas").insert({
        nome,
        slug,
        tipo_publico: novaClinica.tipo_publico,
        plano: novaClinica.plano,
        limite_usuarios: limiteUsuarios,
        status: "ativa",
      }).select(CAMPOS_CLINICA).single();
      if (error) throw error;
      if (!data?.id) throw new Error("Não foi possível confirmar o cadastro da clínica.");

      const criada = data as Clinica;
      setClinicas((lista) => [...lista.filter((c) => c.id !== criada.id), criada].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
      setBuscaClinica("");
      setFiltroClinica("todas");
      setDrive(null);
      setPasta("");
      setSelecionada(criada);
      setAba("clinicas");
      setAbaClinica("cadastro");
      setNovaClinica(null);
      toast.success("Clínica cadastrada. Você já pode adicionar os usuários.");
    } catch (e) {
      const erro = e as { code?: string; message?: string };
      setErroNovaClinica(erro.code === "23505"
        ? "Este nome de link já está em uso. Escolha outro para esta clínica."
        : erro.code === "42501"
          ? "Sua conta não tem permissão para cadastrar clínicas. Use o administrador da plataforma."
          : (erro.message || "Não foi possível cadastrar a clínica. Tente novamente."));
    } finally {
      setCriandoClinica(false);
    }
  }

  const renderNovaClinica = () => (
    <Dialog open={Boolean(novaClinica)} onOpenChange={(aberto) => { if (!aberto && !criandoClinica) setNovaClinica(null); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl" onEscapeKeyDown={(e) => { if (criandoClinica) e.preventDefault(); }} onPointerDownOutside={(e) => { if (criandoClinica) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Adicionar clínica</DialogTitle>
          <DialogDescription>Cadastre uma clínica, veterinário ou pet shop com sua própria conta e usuários.</DialogDescription>
        </DialogHeader>
        {novaClinica && <form onSubmit={cadastrarClinica} className="mt-2 space-y-5">
          <fieldset disabled={criandoClinica} className="grid gap-4 disabled:opacity-60">
            <label className="text-sm font-semibold">Nome da clínica
              <input autoFocus required maxLength={180} value={novaClinica.nome} onChange={(e) => setNovaClinica({ ...novaClinica, nome: e.target.value })} autoComplete="organization" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/>
            </label>
            <label className="text-sm font-semibold">Tipo de parceiro
              <select value={novaClinica.tipo_publico} onChange={(e) => setNovaClinica({ ...novaClinica, tipo_publico: e.target.value as NovaClinica["tipo_publico"] })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">
                <option value="vet">Veterinário / clínica veterinária</option>
                <option value="pet">Pet shop</option>
              </select>
            </label>
            <label className="text-sm font-semibold">Link público
              <div className="mt-1 flex min-h-11 flex-wrap items-center gap-x-1 rounded-xl border px-3 font-normal">
                <span className="text-muted-foreground">oricse.com/{novaClinica.tipo_publico}/</span>
                <input required maxLength={100} value={novaClinica.slug || ""} onChange={(e) => setNovaClinica({ ...novaClinica, slug: limparSlug(e.target.value) })} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="nomedaclinica" className="min-h-10 min-w-0 flex-1 bg-transparent outline-none"/>
              </div>
              <p className="mt-1 text-xs font-normal text-muted-foreground">Escolha um nome único, sem espaços. O link identifica esta clínica.</p>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Plano
                <select required value={novaClinica.plano} onChange={(e) => { const plano = planos.find((p) => p.nome === e.target.value); setNovaClinica({ ...novaClinica, plano: e.target.value, limite_usuarios: plano?.usuarios_inclusos || 1 }); }} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">
                  <option value="" disabled>Selecione um plano</option>
                  {planos.filter((p) => p.ativo).map((p) => <option key={p.codigo} value={p.nome}>{p.nome}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold">Limite de usuários
                <input required type="number" min={1} step={1} value={novaClinica.limite_usuarios || ""} onChange={(e) => setNovaClinica({ ...novaClinica, limite_usuarios: Number(e.target.value) })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/>
              </label>
            </div>
          </fieldset>
          {!planos.some((p) => p.ativo) && <p className="text-sm text-muted-foreground">Ative um plano na aba Planos para cadastrar novas clínicas.</p>}
          {erroNovaClinica && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erroNovaClinica}</p>}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <button type="button" disabled={criandoClinica} onClick={() => setNovaClinica(null)} className="min-h-11 rounded-xl border px-4 py-2.5 font-semibold disabled:opacity-60">Cancelar</button>
            <button type="submit" disabled={criandoClinica || !planos.some((p) => p.ativo)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-60"><Plus size={17}/>{criandoClinica ? "Cadastrando..." : "Cadastrar clínica"}</button>
          </div>
        </form>}
      </DialogContent>
    </Dialog>
  );

  async function salvarClinica() {
    if (!selecionada) return;
    setOcupado(true);
    try {
      const { error } = await (supabase as any).from("clinicas").update({
        nome: selecionada.nome.trim(),
        slug: limparSlug(selecionada.slug || ""),
        tipo_publico: selecionada.tipo_publico || "vet",
        status: selecionada.status,
        plano: selecionada.plano,
        dominio: selecionada.dominio?.trim() || null,
        limite_usuarios: Math.max(1, Number(selecionada.limite_usuarios) || 1),
        observacoes: selecionada.observacoes?.trim() || null,
        logo_url: selecionada.logo_url?.trim() || null,
        ultimo_pagamento_em: selecionada.ultimo_pagamento_em || null,
        proximo_pagamento_em: selecionada.proximo_pagamento_em || null,
        acesso_ate: selecionada.acesso_ate || null,
        status_financeiro: selecionada.status_financeiro,
        updated_at: new Date().toISOString(),
      }).eq("id", selecionada.id);
      if (error) throw error;
      await carregarTudo();
      toast.success("Clínica atualizada.");
    } catch (e) { const erro = e as { code?: string; message?: string }; toast.error(erro.code === "23505" ? "Este nome já está em uso por outra clínica ou parceiro." : (erro.message || "Não foi possível salvar a clínica.")); }
    finally { setOcupado(false); }
  }

  async function confirmarExclusaoClinica() {
    if (!selecionada || confirmacaoExclusao !== "APAGAR") return;
    setOcupado(true);
    try {
      const r = await excluirClinica({ data: { accessToken: await tokenAtual(), clinicaId: selecionada.id, confirmacao: "APAGAR" } });
      setExcluindoClinica(false);
      setConfirmacaoExclusao("");
      setSelecionada(null);
      await carregarTudo();
      toast.success(`Clínica "${r.nome}" excluída.`);
    } catch (e) { toast.error((e as Error).message || "Não foi possível excluir a clínica."); }
    finally { setOcupado(false); }
  }

  async function arquivoEmBase64(file: File): Promise<string> {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const valor = String(reader.result || "");
        resolve(valor.includes(",") ? valor.split(",")[1] : valor);
      };
      reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      reader.readAsDataURL(file);
    });
  }

  async function enviarLogoDaClinica(file?: File) {
    if (!selecionada || !file) return;
    const permitidos = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!permitidos.includes(file.type)) return toast.error("Use PNG, JPG, WEBP ou SVG.");
    if (file.size > 5 * 1024 * 1024) return toast.error("A logo deve ter no máximo 5 MB.");
    setEnviandoLogoClinica(true);
    try {
      if (!drive?.root_folder_id) {
        await garantirPastaOricse({ data: { accessToken: await tokenAtual(), clinicaId: selecionada.id } });
        await carregarDrive(selecionada.id);
      }
      const resultado = await enviarLogoClinica({
        data: {
          accessToken: await tokenAtual(), clinicaId: selecionada.id, fileName: file.name,
          mimeType: file.type as "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml",
          base64: await arquivoEmBase64(file),
        },
      });
      setSelecionada({ ...selecionada, logo_url: resultado.logoUrl });
      await carregarTudo();
      toast.success("Logo salva na pasta Logo do Drive da clínica.");
    } catch (e) { toast.error((e as Error).message || "Não foi possível enviar a logo."); }
    finally { setEnviandoLogoClinica(false); }
  }

  async function atualizarVinculo(v: Vinculo, mudancas: Partial<Vinculo>) {
    const { error } = await (supabase as any).from("clinica_usuarios").update(mudancas).eq("clinica_id", v.clinica_id).eq("user_id", v.user_id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await carregarTudo();
  }

  function alterarPlano(i: number, mudancas: Partial<Plano>) {
    setPlanos((lista) => lista.map((p, j) => j === i ? { ...p, ...mudancas } : p));
  }

  function adicionarPlano() {
    const maiorOrdem = planos.reduce((maior, plano) => Math.max(maior, Number(plano.ordem) || 0), 0);
    setPlanos((lista) => [...lista, {
      codigo: `novo-plano-${Date.now().toString(36)}`,
      nome: "Novo plano",
      publico_alvo: "",
      preco: "",
      preco_mensal: "",
      preco_anual: "",
      descricao: "",
      itens: [],
      usuarios_inclusos: 1,
      dominio_incluso: false,
      ativo: false,
      ordem: maiorOrdem + 1,
    }]);
  }

  async function removerPlano(plano: Plano, indice: number) {
    if (!plano.id) {
      setPlanos((lista) => lista.filter((_, i) => i !== indice));
      return;
    }
    const clinicasUsando = clinicas.filter((clinica) => clinica.plano === plano.nome);
    if (clinicasUsando.length > 0) return toast.error(`${clinicasUsando.length} clínica(s) ainda usam o plano “${plano.nome}”.`);
    if (!window.confirm(`Excluir permanentemente o plano “${plano.nome}”?`)) return;
    const { error } = await (supabase as any).from("oricse_planos").delete().eq("id", plano.id);
    if (error) return toast.error(error.message);
    await carregarTudo();
  }

  async function salvarPlanos() {
    window.localStorage.setItem("vetericio-cupons", JSON.stringify(cupons));
    setOcupado(true);
    try {
      for (const p of planos) {
        const { error } = await (supabase as any).from("oricse_planos").upsert({
          ...(p.id ? { id: p.id } : {}),
          codigo: p.codigo,
          nome: p.nome,
          publico_alvo: p.publico_alvo,
          preco: p.preco_mensal || p.preco,
          preco_mensal: p.preco_mensal || p.preco,
          preco_anual: p.preco_anual || null,
          descricao: p.descricao, itens: p.itens, usuarios_inclusos: Number(p.usuarios_inclusos) || 1,
          dominio_incluso: p.dominio_incluso, ativo: p.ativo, ordem: p.ordem, updated_at: new Date().toISOString(),
        }, { onConflict: "codigo" });
        if (error) throw error;
      }
      await carregarTudo();
      toast.success("Planos atualizados na página pública.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setOcupado(false); }
  }

  async function salvarSite() {
    const { error } = await (supabase as any).from("oricse_config").upsert({ chave: "site_publico", valor: site, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success("Textos públicos atualizados.");
  }

  function escolherLogo(file?: File) {
    if (!file) return;
    const permitidos = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!permitidos.includes(file.type)) return toast.error("Use PNG, JPG, WEBP ou SVG.");
    if (file.size > 5 * 1024 * 1024) return toast.error("A logo deve ter no máximo 5 MB.");
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoArquivo(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function salvarLogoSite() {
    if (!logoArquivo) return toast.error("Escolha uma imagem primeiro.");
    setSalvandoLogo(true);
    try {
      const extensao = logoArquivo.name.split(".").pop()?.toLowerCase() || "png";
      const caminho = `site/logo-publica.${extensao}`;
      const { error: uploadError } = await supabase.storage.from("oricse-branding").upload(caminho, logoArquivo, { upsert: true, contentType: logoArquivo.type, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("oricse-branding").getPublicUrl(caminho);
      const novaConfig = { ...site, logo_url: `${data.publicUrl}?v=${Date.now()}` };
      const { error } = await (supabase as any).from("oricse_config").upsert({ chave: "site_publico", valor: novaConfig, updated_at: new Date().toISOString() });
      if (error) throw error;
      setSite(novaConfig);
      setLogoArquivo(null);
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoPreview(null);
      toast.success("Logo do site atualizada.");
    } catch (e) { toast.error((e as Error).message || "Não foi possível salvar a logo."); }
    finally { setSalvandoLogo(false); }
  }

  async function restaurarLogoPadrao() {
    const novaConfig = { ...site, logo_url: "" };
    const { error } = await (supabase as any).from("oricse_config").upsert({ chave: "site_publico", valor: novaConfig, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    setSite(novaConfig);
    setLogoArquivo(null);
    setLogoPreview(null);
  }

  async function conectarDrive() {
    if (!selecionada) return;
    if (!pasta.trim()) return usarPadrao();
    const folderId = extrairDriveFolderId(pasta);
    if (!folderId) return toast.error("Informe uma pasta válida do Google Drive.");
    setOcupado(true);
    try {
      await testarEConectarPastaDrive({ data: { accessToken: await tokenAtual(), clinicaId: selecionada.id, folderId, folderUrl: pasta } });
      await carregarDrive(selecionada.id);
      toast.success("Drive personalizado conectado.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setOcupado(false); }
  }

  async function usarPadrao() {
    if (!selecionada) return;
    setOcupado(true);
    try {
      await garantirPastaOricse({ data: { accessToken: await tokenAtual(), clinicaId: selecionada.id } });
      await carregarDrive(selecionada.id);
      toast.success("Pasta da clínica pronta no Drive da ORICSE.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setOcupado(false); }
  }

  async function sair() {
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  function abrirFiltro(filtro: FiltroClinica) {
    setSelecionada(null);
    setBuscaClinica("");
    setFiltroClinica(filtro);
    setAba("clinicas");
  }

  const renderDashboard = () => {
    const pagas = clinicas.filter((c) => c.status === "ativa" && c.status_financeiro === "em_dia").length;
    const inadimplentes = clinicas.filter((c) => c.status !== "cancelada" && (c.status_financeiro === "pendente" || c.status_financeiro === "atrasado")).length;
    const canceladas = clinicas.filter((c) => c.status === "cancelada").length;
    const ativos = vinculos.filter((v) => v.ativo).length;
    const cards = [
      { rotulo: "Total de clínicas", valor: clinicas.length, Icone: Building2 },
      { rotulo: "Ativas e pagas", valor: pagas, Icone: ShieldCheck, filtro: "pagas" as FiltroClinica },
      { rotulo: "Não pagaram", valor: inadimplentes, Icone: CreditCard, filtro: "inadimplentes" as FiltroClinica },
      { rotulo: "Canceladas", valor: canceladas, Icone: CalendarDays, filtro: "canceladas" as FiltroClinica },
      { rotulo: "Usuários vinculados", valor: ativos, Icone: Users },
      { rotulo: "Arquivos no Drive", valor: arquivosDrive, Icone: HardDrive },
    ];
    return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(({ rotulo, valor, Icone, filtro }) => filtro ? <button key={rotulo} type="button" onClick={() => abrirFiltro(filtro)} className="text-left"><Card className="h-full transition hover:border-primary"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">{rotulo}</p><p className="mt-1 text-3xl font-bold">{valor}</p><p className="mt-2 text-xs font-semibold text-primary">Ver clínicas</p></div><Icone className="text-primary" size={26}/></div></Card></button> : <Card key={rotulo}><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">{rotulo}</p><p className="mt-1 text-3xl font-bold">{valor}</p></div><Icone className="text-primary" size={26}/></div></Card>)}</div></div>;
  };

  const renderCadastroClinica = () => !selecionada ? null : <Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Cadastro</h2><p className="text-sm text-muted-foreground">Dados gerais e configuração comercial da clínica.</p></div><button disabled={ocupado} onClick={salvarClinica} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground"><Save size={17}/> Salvar</button></div><div className="mt-5 grid gap-4 md:grid-cols-2">
    <label className="text-sm font-semibold">Nome<input value={selecionada.nome} onChange={(e) => setSelecionada({ ...selecionada, nome: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label>
    <label className="text-sm font-semibold">Tipo de parceiro<select value={selecionada.tipo_publico || "vet"} onChange={(e) => setSelecionada({ ...selecionada, tipo_publico: e.target.value as Clinica["tipo_publico"] })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"><option value="vet">Veterinário / clínica veterinária</option><option value="pet">Pet shop</option></select></label>
    <label className="text-sm font-semibold md:col-span-2">Link público<div className="mt-1 flex min-h-11 items-center rounded-xl border px-3 font-normal"><span className="whitespace-nowrap text-muted-foreground">oricse.com/{selecionada.tipo_publico || "vet"}/</span><input value={selecionada.slug || ""} onChange={(e) => setSelecionada({ ...selecionada, slug: limparSlug(e.target.value) })} className="min-w-0 flex-1 bg-transparent outline-none" placeholder="nomedaclinica"/></div><p className="mt-1 text-xs font-normal text-muted-foreground">Nome único, sem espaços. Ex.: /{selecionada.tipo_publico || "vet"}/vetericio</p></label>
    <label className="text-sm font-semibold">Plano<select value={selecionada.plano} onChange={(e) => { const p = planos.find((x) => x.nome === e.target.value); setSelecionada({ ...selecionada, plano: e.target.value, limite_usuarios: p?.usuarios_inclusos || selecionada.limite_usuarios }); }} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">{planos.map((p) => <option key={p.codigo}>{p.nome}</option>)}</select></label>
    <label className="text-sm font-semibold">Status<select value={selecionada.status} onChange={(e) => setSelecionada({ ...selecionada, status: e.target.value as Clinica["status"] })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"><option value="ativa">Ativa</option><option value="bloqueada">Bloqueada</option><option value="inativa">Inativa</option><option value="cancelada">Cancelada</option></select></label>
    <label className="text-sm font-semibold">Limite de usuários<input type="number" min={1} value={selecionada.limite_usuarios} onChange={(e) => setSelecionada({ ...selecionada, limite_usuarios: Number(e.target.value) })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label>
    <label className="text-sm font-semibold">Domínio<input value={selecionada.dominio || ""} onChange={(e) => setSelecionada({ ...selecionada, dominio: e.target.value })} placeholder="www.suaclinica.com.br" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label>
    <div className="md:col-span-2"><p className="text-sm font-semibold">Logo da clínica</p><div className="mt-2 flex flex-wrap items-center gap-4 rounded-xl border p-4">{selecionada.logo_url ? <img src={selecionada.logo_url} alt="Logo da clínica" className="h-24 w-40 object-contain"/> : <div className="flex h-24 w-40 items-center justify-center rounded-lg bg-slate-50 text-xs text-muted-foreground">Sem logo</div>}<label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 font-semibold"><ImageUp size={17}/>{enviandoLogoClinica ? "Enviando..." : "Enviar logo"}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" disabled={enviandoLogoClinica} onChange={(e) => void enviarLogoDaClinica(e.target.files?.[0])}/></label></div></div>
    <label className="text-sm font-semibold md:col-span-2">Observações internas<textarea value={selecionada.observacoes || ""} onChange={(e) => setSelecionada({ ...selecionada, observacoes: e.target.value })} rows={4} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"/></label>
     </div>
     <div className="mt-8 rounded-xl border border-red-300 bg-red-50 p-4"><h3 className="font-bold text-red-700">Zona de perigo</h3><p className="mt-1 text-sm text-red-700">Excluir esta clínica remove definitivamente seus dados e acessos.</p><button type="button" disabled={ocupado} onClick={() => { setConfirmacaoExclusao(""); setExcluindoClinica(true); }} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white"><Trash2 size={17}/> Excluir clínica</button></div>
     <Dialog open={excluindoClinica} onOpenChange={(aberto) => { if (!ocupado) { setExcluindoClinica(aberto); if (!aberto) setConfirmacaoExclusao(""); } }}><DialogContent><DialogHeader><DialogTitle className="text-red-700">Excluir "{selecionada.nome}"?</DialogTitle><DialogDescription>Leia os avisos antes de continuar.</DialogDescription></DialogHeader>
       <ol className="list-decimal space-y-2 pl-5 text-sm"><li><strong>Esta ação é irreversível.</strong> Não existe como desfazer ou recuperar a clínica depois.</li><li><strong>Dados apagados:</strong> usuários, tutores, catálogo, comissões e configurações da clínica serão removidos, e as contas de acesso exclusivas dela serão excluídas.</li><li><strong>Arquivos no Google Drive não são apagados</strong>, mas o vínculo com a pasta será perdido. Remova-os manualmente se necessário.</li></ol>
       <label className="text-sm font-semibold">Digite <span className="font-mono text-red-700">APAGAR</span> para confirmar<input value={confirmacaoExclusao} onChange={(e) => setConfirmacaoExclusao(e.target.value)} autoComplete="off" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label>
       <div className="flex justify-end gap-2"><button type="button" disabled={ocupado} onClick={() => { setExcluindoClinica(false); setConfirmacaoExclusao(""); }} className="rounded-xl border px-4 py-2.5 font-semibold">Cancelar</button><button type="button" disabled={ocupado || confirmacaoExclusao !== "APAGAR"} onClick={() => void confirmarExclusaoClinica()} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white disabled:opacity-40"><Trash2 size={17}/> Excluir definitivamente</button></div>
     </DialogContent></Dialog></Card>;

  const renderSituacao = () => !selecionada ? null : <Card><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><CreditCard size={20}/><h2 className="text-xl font-bold">Situação da conta</h2></div><p className="mt-1 text-sm text-muted-foreground">Controle administrativo, pagamentos e período de acesso.</p></div><button disabled={ocupado} onClick={salvarClinica} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground"><Save size={17}/> Salvar</button></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    <div className="rounded-xl border bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conta criada em</p><p className="mt-2 text-lg font-bold">{dataBR(selecionada.created_at)}</p></div>
    <label className="text-sm font-semibold">Situação financeira<select value={selecionada.status_financeiro} onChange={(e) => setSelecionada({ ...selecionada, status_financeiro: e.target.value as StatusFinanceiro })} className="mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"><option value="em_dia">Em dia</option><option value="pendente">Pendente</option><option value="atrasado">Atrasado</option><option value="isento">Isento</option><option value="teste">Período de teste</option></select></label>
    <label className="text-sm font-semibold">Último pagamento<input type="date" value={dataInput(selecionada.ultimo_pagamento_em)} onChange={(e) => setSelecionada({ ...selecionada, ultimo_pagamento_em: e.target.value || null })} className="mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"/></label>
    <label className="text-sm font-semibold">Próximo pagamento<input type="date" value={dataInput(selecionada.proximo_pagamento_em)} onChange={(e) => setSelecionada({ ...selecionada, proximo_pagamento_em: e.target.value || null })} className="mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"/></label>
    <label className="text-sm font-semibold md:col-span-2">Acesso liberado até<input type="date" value={dataInput(selecionada.acesso_ate)} onChange={(e) => setSelecionada({ ...selecionada, acesso_ate: e.target.value || null })} className="mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"/></label>
    <div className="rounded-xl border p-4 md:col-span-2"><p className="text-sm font-semibold">Resumo</p><p className="mt-2 text-sm text-muted-foreground">Plano: <strong className="text-foreground">{selecionada.plano}</strong> · Status: <strong className="text-foreground">{selecionada.status}</strong> · Acesso até: <strong className="text-foreground">{dataBR(selecionada.acesso_ate)}</strong></p></div>
  </div></Card>;

  const renderUsuariosClinica = () => !selecionada ? null : <ClinicUsersPanel clinica={{ id: selecionada.id, nome: selecionada.nome, limite_usuarios: selecionada.limite_usuarios }} usuariosDaClinica={usuariosDaClinica as any} perfis={PERFIS} onAtualizarVinculo={atualizarVinculo} onRefresh={carregarTudo} />;

  const renderDriveClinica = () => !selecionada ? null : <Card><div className="flex items-center gap-2"><Database size={20}/><h2 className="text-xl font-bold">Google Drive · {selecionada.nome}</h2></div><p className="mt-1 text-sm text-muted-foreground">A ORICSE cria uma pasta própria para cada clínica. Se necessário, você pode conectar uma pasta personalizada.</p><div className="mt-4 rounded-xl border bg-slate-50 p-4"><div className="text-sm font-semibold">Destino atual</div><div className="mt-1 text-lg font-bold">{drive?.modo === "personalizado" ? "Drive personalizado" : "Drive da ORICSE"}</div><div className="text-xs text-muted-foreground">Status: {drive?.status || "pendente"}</div>{drive?.root_folder_url && <a href={drive.root_folder_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary underline">Abrir pasta <ExternalLink size={14}/></a>}</div><label className="mt-4 block text-sm font-semibold">Pasta personalizada<input value={pasta} onChange={(e) => setPasta(e.target.value)} placeholder="Cole o link de uma pasta do Google Drive" className="mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"/></label><div className="mt-3 flex flex-wrap gap-2"><button disabled={ocupado} onClick={conectarDrive} className="rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60">Testar e conectar</button><button disabled={ocupado} onClick={usarPadrao} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-semibold"><RefreshCcw size={17}/> Usar Drive da ORICSE</button></div></Card>;

  const renderClinicas = () => {
    if (selecionada) return <div className="space-y-5"><button onClick={() => setSelecionada(null)} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 font-semibold"><ArrowLeft size={17}/> Voltar para clínicas</button><Card><div className="flex flex-wrap items-center gap-4"><div className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-xl bg-slate-50">{selecionada.logo_url ? <img src={selecionada.logo_url} alt="" className="h-full w-full object-contain"/> : <Building2 size={30} className="text-muted-foreground"/>}</div><div className="min-w-0 flex-1"><h2 className="truncate text-2xl font-bold">{selecionada.nome}</h2><p className="mt-1 text-sm text-muted-foreground">@{selecionada.slug || "sem-usuario"} · {selecionada.plano} · {selecionada.status}</p></div></div><div className="mt-5 flex flex-wrap gap-2 border-t pt-4">{[
      ["cadastro", "Cadastro", Building2], ["situacao", "Situação da conta", CreditCard], ["usuarios", "Usuários", Users], ["drive", "Drive", Database],
    ].map(([id, nome, Icone]: any) => <button key={id} onClick={() => setAbaClinica(id)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${abaClinica === id ? "bg-primary text-primary-foreground" : "border bg-white"}`}><Icone size={16}/>{nome}</button>)}</div></Card>{abaClinica === "cadastro" && renderCadastroClinica()}{abaClinica === "situacao" && renderSituacao()}{abaClinica === "usuarios" && renderUsuariosClinica()}{abaClinica === "drive" && renderDriveClinica()}</div>;

    return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Clínicas</h2><p className="mt-1 text-sm text-muted-foreground">Selecione uma clínica para abrir a administração completa da conta.</p></div><button type="button" onClick={abrirNovaClinica} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground"><Plus size={18}/> Adicionar clínica</button></div><div className="flex flex-wrap items-center gap-2">{[["todas", "Todas"], ["pagas", "Ativas e pagas"], ["inadimplentes", "Não pagaram"], ["canceladas", "Canceladas"]].map(([id, nome]) => <button key={id} onClick={() => setFiltroClinica(id as FiltroClinica)} className={`rounded-full px-3 py-2 text-sm font-semibold ${filtroClinica === id ? "bg-primary text-primary-foreground" : "border bg-white"}`}>{nome}</button>)}</div><div className="relative max-w-2xl"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20}/><input value={buscaClinica} onChange={(e) => setBuscaClinica(e.target.value)} placeholder="Procurar por nome, @usuário, plano ou status" className="min-h-12 w-full rounded-2xl border bg-white pl-12 pr-4 shadow-sm outline-none focus:border-primary"/></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{clinicasFiltradas.map((c) => <button key={c.id} onClick={() => { setSelecionada(c); setAbaClinica("cadastro"); }} className="group rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:border-primary"><div className="flex items-start gap-4"><div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50">{c.logo_url ? <img src={c.logo_url} alt="" className="h-full w-full object-contain"/> : <Building2 size={26} className="text-muted-foreground"/>}</div><div className="min-w-0"><h3 className="truncate text-lg font-bold group-hover:text-primary">{c.nome}</h3><p className="mt-1 text-sm text-muted-foreground">@{c.slug || "sem-usuario"}</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{c.plano}</span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{c.status}</span></div></div></div><div className="mt-4 border-t pt-3 text-xs text-muted-foreground">Conta criada em {dataBR(c.created_at)}{c.acesso_ate ? ` · acesso até ${dataBR(c.acesso_ate)}` : ""}</div></button>)}{clinicasFiltradas.length === 0 && <Card className="sm:col-span-2 xl:col-span-3"><div className="py-8 text-center text-muted-foreground">Nenhuma clínica encontrada.</div></Card>}</div></div>;
  };

  const renderPlanos = () => <div className="space-y-5"><div className="rounded-2xl border bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Cupons</h2><p className="text-sm text-muted-foreground">Cadastre o nome interno, o código e exatamente quais planos aceitam cada desconto.</p></div><button type="button" onClick={()=>setCupons((x)=>[...x,{nome:"",codigo:"",tipo:"percentual",valor:0,planos:[],inicio:"",validade:"",limitePorCpf:"",recorrencia:"periodo",ativo:true}])} className="rounded-xl border px-3 py-2 font-semibold">+ Novo cupom</button></div><div className="mt-4 space-y-3">{cupons.map((c:any,i:number)=><div key={i} className="rounded-xl border p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Nome do cupom<input value={c.nome||""} onChange={e=>setCupons(x=>x.map((v,j)=>j===i?{...v,nome:e.target.value}:v))} placeholder="Nome interno para identificar a campanha" className="mt-1 w-full rounded-xl border px-3 py-2"/></label><label className="text-sm font-semibold">Código do cupom<input value={c.codigo} onChange={e=>setCupons(x=>x.map((v,j)=>j===i?{...v,codigo:e.target.value.toUpperCase()}:v))} placeholder="Código que a clínica digita" className="mt-1 w-full rounded-xl border px-3 py-2 uppercase"/></label></div><div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-sm font-semibold">Tipo<select value={c.tipo} onChange={e=>setCupons(x=>x.map((v,j)=>j===i?{...v,tipo:e.target.value}:v))} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="percentual">Percentual (%)</option><option value="fixo">Valor fixo (R$)</option></select></label><label className="text-sm font-semibold">Valor<input type="number" min="0" value={c.valor} onChange={e=>setCupons(x=>x.map((v,j)=>j===i?{...v,valor:Number(e.target.value)}:v))} className="mt-1 w-full rounded-xl border px-3 py-2"/></label><label className="text-sm font-semibold">Usos por CPF/CNPJ<input type="number" min="1" value={c.limitePorCpf||""} onChange={e=>setCupons(x=>x.map((v,j)=>j===i?{...v,limitePorCpf:e.target.value}:v))} placeholder="Sem limite" className="mt-1 w-full rounded-xl border px-3 py-2"/></label></div><fieldset className="mt-4"><legend className="text-sm font-semibold">Planos que podem usar este cupom</legend><div className="mt-2 flex flex-wrap gap-2">{planos.filter(p=>p.ativo).map(p=><label key={p.codigo} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><input type="checkbox" checked={(c.planos||[]).includes(p.nome)} onChange={e=>setCupons(x=>x.map((v,j)=>j===i?{...v,planos:e.target.checked?[...(v.planos||[]),p.nome]:(v.planos||[]).filter((nome:string)=>nome!==p.nome)}:v))}/>{p.nome}</label>)}</div></fieldset><div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-sm font-semibold">Início<input type="date" value={c.inicio||""} onChange={e=>setCupons(x=>x.map((v,j)=>j===i?{...v,inicio:e.target.value}:v))} className="mt-1 w-full rounded-xl border px-3 py-2"/></label><label className="text-sm font-semibold">Validade<input type="date" value={c.validade||""} onChange={e=>setCupons(x=>x.map((v,j)=>j===i?{...v,validade:e.target.value}:v))} className="mt-1 w-full rounded-xl border px-3 py-2"/></label><label className="flex items-end gap-2 text-sm font-semibold"><input type="checkbox" checked={c.ativo} onChange={e=>setCupons(x=>x.map((v,j)=>j===i?{...v,ativo:e.target.checked}:v))}/> Ativo</label></div></div>)}</div></div><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Planos da Oricse</h2><p className="text-sm text-muted-foreground">O conteúdo salvo aqui aparece na página pública de planos.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={adicionarPlano} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 font-semibold"><Plus size={17}/> Adicionar plano</button><a href="/planos" target="_blank" className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 font-semibold">Ver página <ExternalLink size={16}/></a><button disabled={ocupado} onClick={salvarPlanos} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground"><Save size={17}/> Salvar</button></div></div>{planos.map((p, i) => <Card key={p.id || p.codigo}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-bold">{p.nome}</h3><p className="text-xs uppercase tracking-wide text-muted-foreground">{p.codigo}</p></div><div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={p.ativo} onChange={(e) => alterarPlano(i, { ativo: e.target.checked })}/> Publicado</label><button type="button" onClick={() => void removerPlano(p, i)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"><Trash2 size={16}/> Remover</button></div></div><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold md:col-span-2">Nome<input value={p.nome} onChange={(e) => alterarPlano(i, { nome: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label><label className="text-sm font-semibold">Mensal<input value={p.preco_mensal || p.preco} onChange={(e) => alterarPlano(i, { preco: e.target.value, preco_mensal: e.target.value })} placeholder="Ex.: R$ 49,90 ou Gr?tis" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label><label className="text-sm font-semibold">Anual<input value={p.preco_anual} onChange={(e) => alterarPlano(i, { preco_anual: e.target.value })} placeholder="Ex.: R$ 499,00 ou Gr?tis" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label><label className="text-sm font-semibold md:col-span-2">Bom para<input value={p.publico_alvo} onChange={(e) => alterarPlano(i, { publico_alvo: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label><label className="text-sm font-semibold md:col-span-2">Descrição<textarea value={p.descricao} onChange={(e) => alterarPlano(i, { descricao: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"/></label><label className="text-sm font-semibold">Usuários inclusos<input type="number" min={1} value={p.usuarios_inclusos} onChange={(e) => alterarPlano(i, { usuarios_inclusos: Number(e.target.value) })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label><label className="flex items-end gap-2 pb-3 text-sm font-semibold"><input type="checkbox" checked={p.dominio_incluso} onChange={(e) => alterarPlano(i, { dominio_incluso: e.target.checked })}/> Domínio próprio incluído</label><label className="text-sm font-semibold md:col-span-2">Recursos · um por linha<textarea value={p.itens.join("\n")} onChange={(e) => alterarPlano(i, { itens: e.target.value.split("\n").filter(Boolean) })} rows={6} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"/></label></div></Card>)}</div>;

  const renderSite = () => <div className="space-y-5"><Card><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><Globe2 size={21}/><h2 className="text-xl font-bold">Site e marca</h2></div><p className="mt-1 text-sm text-muted-foreground">Textos gerais usados nas páginas públicas da Oricse.</p></div><button onClick={salvarSite} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground"><Save size={17}/> Salvar</button></div><div className="mt-5 grid gap-4"><label className="text-sm font-semibold">Marca<input value={site.marca} onChange={(e) => setSite({ ...site, marca: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label><label className="text-sm font-semibold">Título da página de planos<input value={site.titulo_planos} onChange={(e) => setSite({ ...site, titulo_planos: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label><label className="text-sm font-semibold">Subtítulo<textarea value={site.subtitulo_planos} onChange={(e) => setSite({ ...site, subtitulo_planos: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"/></label><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Texto do botão<input value={site.cta_plano} onChange={(e) => setSite({ ...site, cta_plano: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label><label className="text-sm font-semibold">Contato comercial<input value={site.contato} onChange={(e) => setSite({ ...site, contato: e.target.value })} placeholder="WhatsApp, e-mail ou link" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label></div></div></Card><Card><h3 className="font-bold">Logo usada no site</h3><div className="mt-4 flex flex-wrap items-center gap-5 rounded-xl bg-[#f6f4ef] p-4"><img src={logoPreview || site.logo_url || "/oricse-logo.png"} alt="Oricse" className="max-h-32 max-w-[260px] object-contain"/><div className="flex flex-wrap gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-white px-4 py-2.5 font-semibold"><ImageUp size={17}/> Escolher logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => escolherLogo(e.target.files?.[0])}/></label><button disabled={!logoArquivo || salvandoLogo} onClick={salvarLogoSite} className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-50">Salvar logo</button><button onClick={restaurarLogoPadrao} className="rounded-xl border bg-white px-4 py-2.5 font-semibold">Restaurar padrão</button></div></div></Card></div>;

  const ROTAS_EDITAVEIS = [
    {original:"/recepcao",nome:"Recepção"},
    {original:"/estoque",nome:"Serviços, produtos e estoque"},
    {original:"/financeiro",nome:"Financeiro"},
    {original:"/comandas",nome:"Comandas"},
    {original:"/minha-atividade",nome:"Minha atividade"}
  ];
  async function carregarRotas() {
    const {data,error}=await (supabase as any).from("oricse_rotas_personalizadas").select("rota_original,rota_publica");
    if(error)return toast.error(error.message);
    setRotasEditadas(Object.fromEntries(ROTAS_EDITAVEIS.map(r=>[r.original,data?.find((d:any)=>d.rota_original===r.original)?.rota_publica||r.original])));
  }
  async function salvarRota(original:string) {
    const nova=(rotasEditadas[original]||original).trim().toLowerCase();
    if(!/^\/[a-z0-9-]+$/.test(nova))return toast.error("Use / seguido de letras minúsculas, números ou hífens.");
    const reservadas=["/admin","/login","/","/cadastro","/configuracoes"];
    if((reservadas.includes(nova)&&nova!==original)||ROTAS_EDITAVEIS.some(r=>r.original===nova&&r.original!==original))return toast.error("Este endereço já está reservado.");
    if(ROTAS_EDITAVEIS.some(r=>r.original!==original&&rotasEditadas[r.original]===nova))return toast.error("Endereço repetido em outra página.");
    setSalvandoRotas(true);
    const {data:user}=await supabase.auth.getUser();
    const {error}=await (supabase as any).from("oricse_rotas_personalizadas").upsert({rota_original:original,rota_publica:nova,atualizado_por:user.user?.id},{onConflict:"rota_original"});
    setSalvandoRotas(false);
    if(error)return toast.error(error.message);
    toast.success("Endereço salvo para toda a plataforma.");
  }
  const renderPaginas = () => <Card>
    <div className="flex items-center gap-2"><Globe2 size={20}/><h2 className="text-xl font-bold">Páginas e URLs</h2></div>
    <p className="mt-2 text-sm text-muted-foreground">Configure um endereço público para cada página. Os endereços originais permanecem funcionando. O novo endereço encaminha para a página correspondente.</p>
    <div className="mt-5 space-y-3">{ROTAS_EDITAVEIS.map(r=><div key={r.original} className="grid gap-2 rounded-xl border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
      <div><p className="font-semibold">{r.nome}</p><p className="text-xs text-muted-foreground">Original: {r.original}</p></div>
      <label className="text-xs font-semibold">Endereço personalizado<input value={rotasEditadas[r.original]??r.original} onChange={e=>setRotasEditadas(prev=>({...prev,[r.original]:e.target.value}))} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"/></label>
      <button disabled={salvandoRotas} onClick={()=>salvarRota(r.original)} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">Salvar</button>
    </div>)}</div>
  </Card>;

  const renderSistema = () => <Card><div className="flex items-center gap-2"><Settings size={20}/><h2 className="text-xl font-bold">Sistema</h2></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">Banco de dados</p><p className="mt-1 font-bold text-emerald-700">Conectado</p></div><div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">Marca</p><p className="mt-1 font-bold">ORICSE</p></div><div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">Planos cadastrados</p><p className="mt-1 font-bold">{planos.length}</p></div><div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">Drive</p><p className="mt-1 font-bold">{arquivosDrive} arquivo(s) indexado(s)</p></div></div></Card>;

  return <main className="min-h-screen bg-[#f6f4ef] text-slate-900"><div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6"><header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5"><div className="flex items-center gap-3"><img src={site.logo_url || "/oricse-logo.png"} alt="Oricse" className="h-14 w-14 object-contain"/><div><p className="text-sm font-semibold text-primary">ORICSE ADMIN</p><h1 className="text-2xl font-bold sm:text-3xl">Gestão da plataforma</h1></div></div><button onClick={sair} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 font-semibold"><LogOut size={18}/> Sair</button></header><div className="mt-5 grid gap-5 lg:grid-cols-[230px_1fr]"><aside><nav className="sticky top-4 grid gap-1 rounded-2xl border bg-white p-2 shadow-sm">{ABAS.map(({ id, nome, icone: Icone }) => <button key={id} onClick={() => { setAba(id); if (id !== "clinicas") setSelecionada(null); if(id==="paginas") void carregarRotas(); if (id === "clinicas" && aba !== "clinicas") setFiltroClinica("todas"); }} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${aba === id ? "bg-primary text-primary-foreground" : "hover:bg-slate-100"}`}><Icone size={18}/>{nome}</button>)}</nav></aside><section>{aba === "dashboard" && renderDashboard()}{aba === "clinicas" && renderClinicas()}{aba === "planos" && renderPlanos()}{aba === "site" && renderSite()}{aba === "sistema" && renderSistema()}{aba === "paginas" && renderPaginas()}</section></div></div>{renderNovaClinica()}</main>;
}
