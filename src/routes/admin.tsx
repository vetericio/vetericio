import { oricseStorage, oricseSession } from "@/lib/oricse-storage";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeDollarSign,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
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
import { supabase, supabaseBanco } from "@/integrations/supabase/client";
import { extrairDriveFolderId } from "@/lib/drive-storage";
import { ROTAS_CATALOGO, ROTAS_EDITAVEIS, CAMINHOS_RESERVADOS } from "@/lib/admin-page-routes";
import { testarEConectarPastaDrive } from "@/lib/drive.functions";
import { garantirPastaOricse } from "@/lib/drive-default.functions";
import { enviarLogoClinica } from "@/lib/clinic-logo.functions";
import { enviarArquivoPublicoPlataforma } from "@/lib/platform-drive.functions";
import { excluirClinica } from "@/lib/admin-users.functions";
import { ClinicUsersPanel } from "@/components/admin/ClinicUsersPanel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin")({ component: Admin });

type Aba = "dashboard" | "novas" | "lixeira" | "clinicas" | "planos" | "site" | "sistema" | "paginas" | "pagamentos" | "auditoria";
type AbaClinica = "cadastro" | "situacao" | "usuarios" | "drive" | "site" | "autorizacoes";
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
  excluido_em?: string | null;
  expira_lixeira_em?: string | null;
};

type NovaClinica = Pick<Clinica, "nome" | "slug" | "tipo_publico" | "plano" | "limite_usuarios">;
type SolicitacaoClinica = {
  id: string;
  plano_nome: string;
  ciclo: string;
  valor_exibido: string | null;
  status: string;
  clinica_nome: string;
  cnpj: string;
  clinica_telefone: string;
  clinica_email: string;
  clinica_cidade: string;
  clinica_uf: string;
  clinica_endereco: string | null;
  clinica_numero: string | null;
  clinica_bairro: string | null;
  clinica_cep: string | null;
  razao_social: string | null;
  observacoes: string | null;
  plano_codigo: string;
  quantidade_usuarios: number;
  responsavel_nome: string;
  responsavel_cpf: string;
  responsavel_crmv: string;
  responsavel_crmv_uf: string;
  responsavel_email: string;
  responsavel_telefone: string;
  pagamento_provedor: string | null;
  pagamento_id: string | null;
  pagamento_aprovado_em: string | null;
  valor_total: number | null;
  promo_codigo: string | null;
  promo_valor_original: number | null;
  promo_desconto: number | null;
  promo_valor_final: number | null;
  slug_desejado: string | null;
  clinica_criada_id: string | null;
  created_at: string;
  excluido_em: string | null;
  expira_lixeira_em: string | null;
};

const CAMPOS_CLINICA = "id,nome,slug,tipo_publico,status,plano,dominio,limite_usuarios,observacoes,logo_url,created_at,ultimo_pagamento_em,proximo_pagamento_em,acesso_ate,status_financeiro,excluido_em,expira_lixeira_em";
const valorPlanoClinica = (p: Plano) => p.codigo?.endsWith("-2026") ? p.codigo : p.nome;

type AppUser = { user_id: string; username: string; role: string; email?: string | null; created_at: string };
type Vinculo = { clinica_id: string; user_id: string; papel: PapelClinica; ativo: boolean };
type DriveConfig = { modo: "oricse" | "personalizado"; root_folder_id: string | null; root_folder_url: string | null; status: string };
type StatusDominio = "rascunho" | "aguardando_dns" | "verificando" | "ativo" | "erro" | "suspenso";
type DominioClinica = {
  id: string;
  clinica_id: string;
  hostname: string;
  tipo: "oricse" | "proprio";
  status: StatusDominio;
  principal: boolean;
  publicar_site: boolean;
  dns_alvo: string;
  verificacao_tipo: "automatica" | "cname" | "txt";
  verificacao_nome: string | null;
  verificacao_valor: string | null;
  cloudflare_hostname_id: string | null;
  ssl_status: string | null;
  ultimo_erro: string | null;
  criado_em: string;
  atualizado_em: string;
};
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

type GrupoAba = "Operação" | "Produto e conteúdo" | "Controle";
type ItemMenuAdmin = {
  id: string;
  nome: string;
  icone: typeof Gauge;
  grupo: GrupoAba;
  rota?: "/admin-cupons" | "/admin-conteudo" | "/admin-oricstudio";
};
const ABAS: ItemMenuAdmin[] = [
  { id: "dashboard", nome: "Visão geral", icone: Gauge, grupo: "Operação" },
  { id: "novas", nome: "Clínicas novas", icone: ClipboardCheck, grupo: "Operação" },
  { id: "lixeira", nome: "Lixeira · 360 dias", icone: Trash2, grupo: "Operação" },
  { id: "clinicas", nome: "Clínicas e equipe", icone: Building2, grupo: "Operação" },
  { id: "planos", nome: "Planos e cupons", icone: BadgeDollarSign, grupo: "Operação" },
  { id: "pagamentos", nome: "Financeiro, taxas e repasses", icone: CreditCard, grupo: "Operação" },
  { id: "oricstudio", nome: "OricStúdio", icone: ImageUp, grupo: "Produto e conteúdo", rota: "/admin-oricstudio" },
  { id: "conteudo", nome: "Conteúdo público", icone: PanelsTopLeft, grupo: "Produto e conteúdo", rota: "/admin-conteudo" },
  { id: "site", nome: "Marca, sites e domínios", icone: PanelsTopLeft, grupo: "Produto e conteúdo" },
  { id: "paginas", nome: "Páginas e URLs", icone: Globe2, grupo: "Produto e conteúdo" },
  { id: "auditoria", nome: "Controle e auditoria", icone: ShieldCheck, grupo: "Controle" },
  { id: "sistema", nome: "Sistema e integrações", icone: Settings, grupo: "Controle" },
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

function normalizarHostname(valor: string) {
  return valor.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
}

function hostnameValido(valor: string) {
  return /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(valor);
}

function rotuloStatusDominio(status: StatusDominio) {
  return ({
    rascunho: "Aguardando ativação",
    aguardando_dns: "Aguardando DNS",
    verificando: "Verificando domínio",
    ativo: "Ativo",
    erro: "Precisa de atenção",
    suspenso: "Suspenso",
  } as Record<StatusDominio, string>)[status];
}

function classeStatusDominio(status: StatusDominio) {
  return status === "ativo"
    ? "bg-emerald-50 text-emerald-700"
    : status === "erro" || status === "suspenso"
      ? "bg-red-50 text-red-700"
      : "bg-amber-50 text-amber-800";
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

function dataHoraBR(valor: string | null | undefined) {
  if (!valor) return "Ainda não atualizado";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

function Admin() {
  const [aba, setAba] = useState<Aba>("dashboard");
  const [abaClinica, setAbaClinica] = useState<AbaClinica>("cadastro");
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoClinica[]>([]);
  const [clinicasLixeira, setClinicasLixeira] = useState<Clinica[]>([]);
  const [processandoLixeira,setProcessandoLixeira]=useState<string|null>(null);
  const [carregandoSolicitacoes, setCarregandoSolicitacoes] = useState(true);
  const [erroSolicitacoes, setErroSolicitacoes] = useState("");
  const [preparandoSolicitacao, setPreparandoSolicitacao] = useState<string | null>(null);
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState<SolicitacaoClinica | null>(null);
  const [salvandoSolicitacao, setSalvandoSolicitacao] = useState(false);
  const [ativandoSolicitacao, setAtivandoSolicitacao] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<Clinica | null>(null);
  const [novaClinica, setNovaClinica] = useState<NovaClinica | null>(null);
  const [criandoClinica, setCriandoClinica] = useState(false);
  const [erroNovaClinica, setErroNovaClinica] = useState("");
  const [buscaClinica, setBuscaClinica] = useState("");
  const [filtroClinica, setFiltroClinica] = useState<FiltroClinica>("todas");
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [funcionalidades, setFuncionalidades] = useState<{codigo:string;nome:string;grupo:string;ordem:number}[]>([]);
  const [permissoesPlanos, setPermissoesPlanos] = useState<Record<string,Record<string,boolean>>>({});
  const [salvandoPermissoes, setSalvandoPermissoes] = useState<string | null>(null);
  const [excecoesClinica, setExcecoesClinica] = useState<Record<string,string>>({});
  const [salvandoExcecao, setSalvandoExcecao] = useState<string | null>(null);
  const [site, setSite] = useState<SiteConfig>(SITE_PADRAO);
  const [rotasEditadas, setRotasEditadas] = useState<Record<string,string>>({});
  const [salvandoRotas, setSalvandoRotas] = useState(false);
  const [rotasSalvas, setRotasSalvas] = useState<Record<string,string>>({});
  const [buscaRotas, setBuscaRotas] = useState("");
  const [buscaPaginasSite, setBuscaPaginasSite] = useState("");
  const [grupoPaginasSite, setGrupoPaginasSite] = useState("todas");
  const [grupoRotas, setGrupoRotas] = useState("todas");
  const [somenteEditaveis, setSomenteEditaveis] = useState(false);
  const [carregandoRotas, setCarregandoRotas] = useState(false);
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
  const [gradeTaxas, setGradeTaxas] = useState<{ modalidades: TaxaModalidade[]; segmentos: TaxaSegmento[]; comissoes: TaxaComissao[] }>({ modalidades: [], segmentos: [], comissoes: [] });
  const [salvandoTaxas, setSalvandoTaxas] = useState(false);
  const [dominiosClinica, setDominiosClinica] = useState<DominioClinica[]>([]);
  const [novoDominio, setNovoDominio] = useState("");
  const [incluirWww, setIncluirWww] = useState(true);
  const [salvandoDominio, setSalvandoDominio] = useState(false);

  const clinicasFiltradas = useMemo(() => {
    const q = buscaClinica.trim().toLowerCase();
    let lista = clinicas;
    if (filtroClinica === "pagas") lista = lista.filter((c) => c.status === "ativa" && c.status_financeiro === "em_dia");
    else if (filtroClinica === "inadimplentes") lista = lista.filter((c) => c.status !== "cancelada" && (c.status_financeiro === "pendente" || c.status_financeiro === "atrasado"));
    else if (filtroClinica === "canceladas") lista = lista.filter((c) => c.status === "cancelada");
    if (!q) return lista;
    return lista.filter((c) => [c.nome, c.slug, c.plano, c.status, c.status_financeiro].filter(Boolean).some((x) => String(x).toLowerCase().includes(q)));
  }, [clinicas, buscaClinica, filtroClinica]);

  const solicitacoesEmAberto = useMemo(
    () => solicitacoes.filter((item) => item.status !== "ativada"),
    [solicitacoes],
  );
  const solicitacoesPagas = useMemo(
    () => solicitacoes.filter((item) => Boolean(item.pagamento_aprovado_em) && item.status !== "ativada"),
    [solicitacoes],
  );
  const solicitacoesProntas = useMemo(
    () => solicitacoes.filter((item) => Boolean(item.clinica_criada_id) && item.status !== "ativada"),
    [solicitacoes],
  );

  const dominiosDaClinica = useMemo(
    () => selecionada ? dominiosClinica.filter((dominio) => dominio.clinica_id === selecionada.id) : [],
    [dominiosClinica, selecionada?.id],
  );

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
    const [c, u, v, p, cfg, arqs, taxas, dom] = await Promise.all([
      (supabaseBanco as any).from("clinicas").select(CAMPOS_CLINICA).order("nome"),
      (supabase as any).from("app_users").select("user_id,username,role,email,created_at").order("username"),
      (supabase as any).from("clinica_usuarios").select("clinica_id,user_id,papel,ativo"),
      (supabase as any).from("oricse_planos").select("id,codigo,nome,publico_alvo,preco,preco_mensal,preco_anual,descricao,itens,usuarios_inclusos,dominio_incluso,ativo,ordem").order("ordem"),
      (supabase as any).from("oricse_config").select("valor").eq("chave", "site_publico").maybeSingle(),
      (supabase as any).from("drive_arquivos").select("id", { count: "exact", head: true }),
      (supabaseBanco as any).rpc("oricse_listar_grade_taxas_pagamento"),
      (supabase as any).from("oricse_dominios_clinica").select("id,clinica_id,hostname,tipo,status,principal,publicar_site,dns_alvo,verificacao_tipo,verificacao_nome,verificacao_valor,cloudflare_hostname_id,ssl_status,ultimo_erro,criado_em,atualizado_em").order("principal", { ascending: false }).order("hostname"),
    ]);
    if (c.error) toast.error("Não foi possível carregar as clínicas.");
    if (u.error) toast.error(`Não foi possível carregar os usuários: ${u.error.message}`);
    if (v.error) toast.error(`Não foi possível carregar os vínculos das clínicas: ${v.error.message}`);
    if (dom.error) toast.error(`Não foi possível carregar os domínios das clínicas: ${dom.error.message}`);
    setClinicas((c.data || []).filter((x:Clinica)=>!x.excluido_em));
    setClinicasLixeira((c.data || []).filter((x:Clinica)=>Boolean(x.excluido_em)));
    setUsuarios(u.data || []);
    setVinculos(v.data || []);
    setDominiosClinica((dom.data || []) as DominioClinica[]);
    setPlanos((p.data || []).map((x: any) => ({
      ...x,
      preco_mensal: x.preco_mensal || x.preco || "",
      preco_anual: x.preco_anual || "",
      itens: Array.isArray(x.itens) ? x.itens : [],
    })));
    setSite({ ...SITE_PADRAO, ...(cfg.data?.valor || {}) });
    setArquivosDrive(arqs.count || 0);
    if (taxas.error) {
      toast.error("Não foi possível carregar a grade de pagamentos.");
    } else {
      const dados = taxas.data || {};
      setGradeTaxas({
        modalidades: Array.isArray(dados.modalidades) ? dados.modalidades.map((item: any) => ({
          ...item,
          mp_percentual: Number(item.mp_percentual || 0),
          mp_fixo_centavos: Number(item.mp_fixo_centavos || 0),
          prazo_recebimento_dias: Number(item.prazo_recebimento_dias || 0),
          parcelas: Number(item.parcelas || 1),
        })) : [],
        segmentos: Array.isArray(dados.segmentos) ? dados.segmentos.map((item: any) => ({
          ...item,
          oricse_percentual: Number(item.oricse_percentual || 0),
        })) : [],
        comissoes: Array.isArray(dados.comissoes) ? dados.comissoes.map((item: any) => ({
          ...item,
          prazo_recebimento_dias: Number(item.prazo_recebimento_dias || 0),
          parcelas: Number(item.parcelas || 1),
          oricse_percentual: Number(item.oricse_percentual || 0),
          ativo: Boolean(item.ativo),
        })) : [],
      });
    }
    if (selecionada) {
      const atual = (c.data || []).find((x: Clinica) => x.id === selecionada.id);
      if (atual) setSelecionada(atual);
    }
    setUltimaAtualizacao(new Date().toISOString());
  }

  async function salvarGradeTaxas(clinicaId: string | null, modalidades: TaxaModalidade[], segmentos: TaxaSegmento[]) {
    if (!modalidades.length || !segmentos.length) return void toast.error("A grade ainda não foi carregada.");
    const linhasInvalidas = modalidades.some((linha) =>
      !linha.descricao?.trim()
      || !Number.isFinite(Number(linha.mp_percentual))
      || Number(linha.mp_percentual) < 0 || Number(linha.mp_percentual) >= 100
      || !Number.isSafeInteger(Number(linha.mp_fixo_centavos)) || Number(linha.mp_fixo_centavos) < 0
    ) || segmentos.some((linha) =>
      !Number.isFinite(Number(linha.oricse_percentual))
      || Number(linha.oricse_percentual) < 0 || Number(linha.oricse_percentual) >= 100
    );
    if (linhasInvalidas) return void toast.error("Revise as taxas antes de salvar.");

    setSalvandoTaxas(true);
    const { error } = await (supabaseBanco as any).rpc("oricse_salvar_grade_taxas_pagamento", {
      p_clinica_id: clinicaId,
      p_modalidades: modalidades.map((linha) => ({
        modalidade: linha.modalidade,
        prazo_recebimento_dias: Number(linha.prazo_recebimento_dias),
        parcelas: Number(linha.parcelas),
        descricao: linha.descricao.trim(),
        mp_percentual: Number(linha.mp_percentual),
        mp_fixo_centavos: Number(linha.mp_fixo_centavos),
        ativo: Boolean(linha.ativo),
        fonte: linha.fonte || "manual",
        fonte_url: linha.fonte_url || null,
        referencia_verificada_em: linha.referencia_verificada_em || null,
      })),
      p_segmentos: segmentos.map((linha) => ({
        segmento: linha.segmento,
        oricse_percentual: Number(linha.oricse_percentual),
        ativo: Boolean(linha.ativo),
      })),
    });
    setSalvandoTaxas(false);
    if (error) return toast.error(error.message);
    toast.success(clinicaId ? "Condições exclusivas da clínica salvas." : "Tabela geral de pagamentos salva.");
    await carregarTudo();
  }

  async function salvarComissoesOricse(clinicaId: string | null, comissoes: TaxaComissao[]) {
    if (!comissoes.length) return void toast.error("Selecione ao menos um segmento para configurar.");
    const invalidas = comissoes.some((linha) =>
      !Number.isFinite(Number(linha.oricse_percentual))
      || Number(linha.oricse_percentual) < 0
      || Number(linha.oricse_percentual) >= 100
    );
    if (invalidas) return void toast.error("Revise as comissões antes de salvar.");

    setSalvandoTaxas(true);
    const { error } = await (supabaseBanco as any).rpc("oricse_salvar_comissoes_oricse", {
      p_clinica_id: clinicaId,
      p_comissoes: comissoes.map((linha) => ({
        segmento: linha.segmento,
        modalidade: linha.modalidade,
        prazo_recebimento_dias: Number(linha.prazo_recebimento_dias),
        parcelas: Number(linha.parcelas),
        oricse_percentual: Number(linha.oricse_percentual),
        ativo: Boolean(linha.ativo),
      })),
    });
    setSalvandoTaxas(false);
    if (error) return toast.error(error.message);
    toast.success(clinicaId ? "Comissões exclusivas da clínica salvas." : "Comissões gerais ORICSE salvas.");
    await carregarTudo();
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

  async function carregarSolicitacoes() {
    setCarregandoSolicitacoes(true);
    setErroSolicitacoes("");
    const todas: SolicitacaoClinica[] = [];
    try {
      // Auditoria: nenhum status pode ser excluído (inclui pendentes, cancelados e isentos).
      // Paginação evita ocultar registros quando ultrapassam o limite padrão da API.
      const lote = 500;
      for(let inicio=0;inicio<100000;inicio+=lote) {
        const { data, error } = await (supabaseBanco as any)
          .from("oricse_contratacoes")
          .select("id,plano_nome,plano_codigo,quantidade_usuarios,ciclo,valor_exibido,status,clinica_nome,razao_social,cnpj,clinica_telefone,clinica_email,clinica_cep,clinica_endereco,clinica_numero,clinica_bairro,clinica_cidade,clinica_uf,observacoes,responsavel_nome,responsavel_cpf,responsavel_crmv,responsavel_crmv_uf,responsavel_email,responsavel_telefone,pagamento_provedor,pagamento_id,pagamento_aprovado_em,valor_total,promo_codigo,promo_valor_original,promo_desconto,promo_valor_final,slug_desejado,clinica_criada_id,created_at,excluido_em,expira_lixeira_em")
          .order("created_at",{ascending:false})
          .order("id",{ascending:false})
          .range(inicio,inicio+lote-1);
        if(error) throw error;
        todas.push(...(data||[]));
        if((data||[]).length<lote) break;
      }
      setSolicitacoes(todas);
    } catch(error) {
      const mensagem=error instanceof Error?error.message:String(error);
      setErroSolicitacoes("Não foi possível consultar todas as solicitações. "+mensagem);
      toast.error("Falha ao carregar solicitações. Não confunda erro de consulta com lista vazia.");
    } finally {
      setCarregandoSolicitacoes(false);
    }
  }

  function editarSolicitacao(campo: keyof SolicitacaoClinica, valor: string) {
    setSolicitacaoSelecionada(atual => atual ? {...atual,[campo]:valor} : atual);
  }

  async function salvarRevisaoSolicitacao(item: SolicitacaoClinica) {
    if(!item.clinica_nome.trim() || !item.slug_desejado?.trim()) {
      toast.error("Nome e identificador da clínica são obrigatórios.");return false;
    }
    const slug=limparSlug(item.slug_desejado);
    if(!slug || slug.length<3) {toast.error("Identificador inválido.");return false;}
    const campos = {
      clinica_nome:item.clinica_nome.trim(),slug_desejado:slug,
      razao_social:item.razao_social?.trim()||null,
      clinica_telefone:item.clinica_telefone?.trim()||"",
      clinica_email:item.clinica_email?.trim()||"",
      clinica_cep:item.clinica_cep?.trim()||null,
      clinica_endereco:item.clinica_endereco?.trim()||null,
      clinica_numero:item.clinica_numero?.trim()||null,
      clinica_bairro:item.clinica_bairro?.trim()||null,
      clinica_cidade:item.clinica_cidade?.trim()||"",
      clinica_uf:item.clinica_uf?.trim()||"",
      responsavel_nome:item.responsavel_nome?.trim()||"",
      responsavel_crmv:item.responsavel_crmv?.trim()||"",
      responsavel_crmv_uf:item.responsavel_crmv_uf?.trim()||"",
      responsavel_email:item.responsavel_email?.trim()||"",
      responsavel_telefone:item.responsavel_telefone?.trim()||"",
      observacoes:item.observacoes?.trim()||null,
      updated_at:new Date().toISOString()
    };
    setSalvandoSolicitacao(true);
    try {
      const {error}=await (supabaseBanco as any).from("oricse_contratacoes").update(campos).eq("id",item.id);
      if(error) throw error;
      setSolicitacaoSelecionada({...item,...campos});
      await carregarSolicitacoes();
      toast.success("Dados revisados e salvos na solicitação.");
      return true;
    }catch(error){
      toast.error(error instanceof Error?error.message:"Não foi possível salvar a revisão.");
      return false;
    }finally{setSalvandoSolicitacao(false);}
  }

  async function iniciarAnaliseSolicitacao(item: SolicitacaoClinica) {
    const { error } = await (supabaseBanco as any)
      .from("oricse_contratacoes")
      .update({ status: "em_analise", updated_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) return toast.error("Não foi possível iniciar a análise.");
    toast.success("Solicitação movida para análise.");
    await carregarSolicitacoes();
  }

  function pedidoIsentoValido(item: SolicitacaoClinica) {
    return Number(item.valor_total)===0 && Boolean(item.promo_codigo) &&
      Number(item.promo_valor_original)>0 &&
      Number(item.promo_desconto)>=Number(item.promo_valor_original) &&
      Number(item.promo_valor_final)===0;
  }

  async function prepararClinicaSolicitada(item: SolicitacaoClinica, confirmar=true) {
    if (!pedidoIsentoValido(item) && (!item.pagamento_id || !item.pagamento_aprovado_em)) {
      toast.error("É necessário confirmar o pagamento ou a isenção integral.");
      return;
    }
    if (confirmar && !window.confirm(`Criar o espaço de ${item.clinica_nome} bloqueado até sua autorização final?`)) return;
    setPreparandoSolicitacao(item.id);
    try {
      const { error } = await (supabaseBanco as any).rpc("oricse_admin_preparar_clinica", { p_contratacao: item.id });
      if (error) throw error;
      toast.success("Espaço criado. Revise a configuração antes de liberar o funcionamento.");
      await Promise.all([carregarTudo(), carregarSolicitacoes()]);
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível preparar a clínica.");
    } finally {
      setPreparandoSolicitacao(null);
    }
  }

  async function abrirConfiguracaoDaSolicitacao(item: SolicitacaoClinica) {
    if (!item.clinica_criada_id) return toast.error("A clínica ainda não foi criada.");
    let clinica = clinicas.find((atual) => atual.id === item.clinica_criada_id);
    if (!clinica) {
      const {data,error}=await (supabaseBanco as any).from("clinicas").select(CAMPOS_CLINICA).eq("id",item.clinica_criada_id).maybeSingle();
      if(error||!data) return toast.error("Não foi possível carregar a clínica criada: "+(error?.message||"Registro não encontrado."));
      clinica=data as Clinica;
      setClinicas(anteriores=>anteriores.some(x=>x.id===clinica!.id)?anteriores:[...anteriores,clinica!]);
    }
    setSelecionada(clinica);
    setAbaClinica("situacao");
    setAba("clinicas");
  }

  async function moverParaLixeira(tipo:"solicitacao"|"clinica",id:string,nome:string) {
    if (!window.confirm(`Excluir "${nome}" da lista principal e enviar para a Lixeira por até 360 dias? Os registros relacionados serão preservados para restauração.`)) return;
    setProcessandoLixeira(id);
    try {
      const {error}=await (supabaseBanco as any).rpc("oricse_admin_lixeira_mover",{p_tipo:tipo,p_id:id});
      if(error)throw error;
      toast.success("Enviado à Lixeira por até 360 dias.");
      setSolicitacaoSelecionada(null);setSelecionada(null);
      await Promise.all([carregarTudo(),carregarSolicitacoes()]);
    }catch(e){toast.error(e instanceof Error?e.message:"Falha ao enviar para a Lixeira.");}
    finally{setProcessandoLixeira(null);}
  }
  async function restaurarDaLixeira(tipo:"solicitacao"|"clinica",id:string) {
    setProcessandoLixeira(id);
    try{
      const {error}=await (supabaseBanco as any).rpc("oricse_admin_lixeira_restaurar",{p_tipo:tipo,p_id:id});
      if(error)throw error;
      toast.success("Registro restaurado. A clínica permanece bloqueada até autorização.");
      await Promise.all([carregarTudo(),carregarSolicitacoes()]);
    }catch(e){toast.error(e instanceof Error?e.message:"Falha ao restaurar.");}
    finally{setProcessandoLixeira(null);}
  }
  async function excluirSolicitacaoDaFila(item:SolicitacaoClinica) {
    await moverParaLixeira("solicitacao",item.id,item.clinica_nome);
  }

  async function autorizarFuncionamento(item: SolicitacaoClinica) {
    const clinica = clinicas.find((atual) => atual.id === item.clinica_criada_id);
    if (!clinica) return toast.error("Prepare o espaço da clínica antes de autorizar.");
    if (!window.confirm(`Autorizar o funcionamento de ${clinica.nome}? A clínica passará a ter acesso ao sistema.`)) return;
    setAtivandoSolicitacao(item.id);
    try {
      const financeira = pedidoIsentoValido(item) ? "isento" : item.pagamento_aprovado_em ? "em_dia" : "teste";
      const { error: clinicaError } = await (supabaseBanco as any)
        .from("clinicas")
        .update({ status: "ativa", status_financeiro: financeira, updated_at: new Date().toISOString() })
        .eq("id", clinica.id);
      if (clinicaError) throw clinicaError;
      const { error: solicitacaoError } = await (supabaseBanco as any)
        .from("oricse_contratacoes")
        .update({ status: "ativada", updated_at: new Date().toISOString() })
        .eq("id", item.id);
      if (solicitacaoError) throw solicitacaoError;
      toast.success("Funcionamento autorizado.");
      await Promise.all([carregarTudo(), carregarSolicitacoes()]);
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível autorizar a clínica.");
    } finally {
      setAtivandoSolicitacao(null);
    }
  }

  useEffect(() => { void carregarTudo(); void carregarSolicitacoes(); }, []);
  useEffect(() => { if (selecionada) void carregarDrive(selecionada.id); }, [selecionada?.id]);
  useEffect(() => () => { if (logoPreview) URL.revokeObjectURL(logoPreview); }, [logoPreview]);

  function abrirNovaClinica() {
    const plano = planos.find((p) => p.ativo && p.codigo.endsWith("-2026")) || planos.find((p) => p.ativo);
    setErroNovaClinica("");
    setNovaClinica({ nome: "", slug: "", tipo_publico: "vet", plano: plano ? valorPlanoClinica(plano) : "", limite_usuarios: plano?.usuarios_inclusos || 1 });
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
    if (!planos.some((p) => p.ativo && valorPlanoClinica(p) === novaClinica.plano)) return setErroNovaClinica("Selecione um plano ativo para a clínica.");
    if (!Number.isSafeInteger(limiteUsuarios) || limiteUsuarios < 1) return setErroNovaClinica("O limite de usuários deve ser um número inteiro maior que zero.");

    setCriandoClinica(true);
    try {
      const { data, error } = await (supabaseBanco as any).from("clinicas").insert({
        nome,
        slug,
        tipo_publico: novaClinica.tipo_publico,
        plano: novaClinica.plano,
        limite_usuarios: limiteUsuarios,
        status: "ativa",
      }).select(CAMPOS_CLINICA).single();
      if (error) throw error;
      if (!data?.id) throw new Error("Não foi possível confirmar o cadastro da clínica.");

      const { error: erroEndereco } = await (supabase as any).from("oricse_dominios_clinica").insert({
        clinica_id: data.id,
        hostname: `${slug}.oricse.com.br`,
        tipo: "oricse",
        status: "rascunho",
        principal: true,
        publicar_site: true,
        dns_alvo: "sites.oricse.com.br",
        verificacao_tipo: "automatica",
      });
      if (erroEndereco) throw erroEndereco;

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
                <select required value={novaClinica.plano} onChange={(e) => { const plano = planos.find((p) => valorPlanoClinica(p) === e.target.value); setNovaClinica({ ...novaClinica, plano: e.target.value, limite_usuarios: plano?.usuarios_inclusos || 1 }); }} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">
                  <option value="" disabled>Selecione um plano</option>
                  {planos.filter((p) => p.ativo).map((p) => <option key={p.codigo} value={valorPlanoClinica(p)}>{p.nome}{p.codigo.endsWith("-2026") ? " · Atual" : " · Legado"}</option>)}
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
      const { error } = await (supabaseBanco as any).from("clinicas").update({
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
      const {error}=await (supabaseBanco as any).rpc("oricse_admin_lixeira_mover",{p_tipo:"clinica",p_id:selecionada.id});
      if(error)throw error;
      const r={nome:selecionada.nome};
      setExcluindoClinica(false);
      setConfirmacaoExclusao("");
      setSelecionada(null);
      await carregarTudo();
      toast.success(`Clínica "${r.nome}" enviada à Lixeira por 360 dias.`);
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
      const { error: logoPersistError } = await (supabaseBanco as any).from("clinicas").update({ logo_url: resultado.logoUrl, updated_at: new Date().toISOString() }).eq("id", selecionada.id);
      if (logoPersistError) throw logoPersistError;
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
      const accessToken = await tokenAtual();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("Não foi possível ler a imagem."));
        reader.readAsDataURL(logoArquivo);
      });
      const upload = await enviarArquivoPublicoPlataforma({ data: { accessToken, nome: logoArquivo.name, mimeType: logoArquivo.type || "image/png", base64 } });
      const novaConfig = { ...site, logo_url: upload.url };
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

  const abrirPainel = (destino: Aba) => {
    setAba(destino);
    if (destino === "paginas") void carregarRotas();
    if (destino === "clinicas") setFiltroClinica("todas");
  };

  const abrirClinicaNoAdmin = (clinica: Clinica, destino: AbaClinica = "cadastro") => {
    setSelecionada(clinica);
    setAbaClinica(destino);
    setAba("clinicas");
  };

  const renderDashboard = () => {
    const clinicasAtivas = clinicas.filter((c) => c.status === "ativa").length;
    const pagas = clinicas.filter((c) => c.status === "ativa" && c.status_financeiro === "em_dia").length;
    const inadimplentes = clinicas.filter((c) => c.status !== "cancelada" && (c.status_financeiro === "pendente" || c.status_financeiro === "atrasado")).length;
    const emTeste = clinicas.filter((c) => c.status_financeiro === "teste").length;
    const canceladas = clinicas.filter((c) => c.status === "cancelada").length;
    const usuariosAtivos = vinculos.filter((v) => v.ativo).length;
    const usuariosSemClinica = usuarios.filter((usuario) => !vinculos.some((vinculo) => vinculo.user_id === usuario.user_id && vinculo.ativo)).length;
    const dominiosPendentes = dominiosClinica.filter((dominio) => ["rascunho", "aguardando_dns", "verificando", "erro", "suspenso"].includes(dominio.status));
    const clinicaDoDominioPendente = clinicas.find((clinica) => clinica.id === dominiosPendentes[0]?.clinica_id);

    const cards = [
      { rotulo: "Clínicas em operação", valor: clinicasAtivas, detalhe: "Base ativa no sistema", Icone: Building2, acao: () => abrirPainel("clinicas") },
      { rotulo: "Aberturas na fila", valor: solicitacoesEmAberto.length, detalhe: "Precisam de decisão", Icone: ClipboardCheck, acao: () => abrirPainel("novas") },
      { rotulo: "Contas em atenção", valor: inadimplentes + emTeste, detalhe: inadimplentes ? inadimplentes + " em atraso ou pendentes" : emTeste + " em período de teste", Icone: CreditCard, acao: () => abrirPainel("clinicas") },
      { rotulo: "Domínios para revisar", valor: dominiosPendentes.length, detalhe: "Publicação, DNS ou SSL", Icone: Globe2, acao: () => clinicaDoDominioPendente ? abrirClinicaNoAdmin(clinicaDoDominioPendente, "site") : abrirPainel("site") },
    ];

    const pendencias = [
      solicitacoesEmAberto.length > 0 ? { titulo: "Solicitações de abertura", descricao: solicitacoesEmAberto.length + " clínica(s) aguardando análise, preparação ou liberação.", botao: "Abrir clínicas novas", acao: () => abrirPainel("novas"), Icone: ClipboardCheck } : null,
      inadimplentes > 0 ? { titulo: "Situação financeira", descricao: inadimplentes + " clínica(s) estão pendentes ou em atraso e precisam de revisão.", botao: "Ver clínicas", acao: () => abrirPainel("clinicas"), Icone: CreditCard } : null,
      emTeste > 0 ? { titulo: "Períodos de teste", descricao: emTeste + " clínica(s) estão em teste e exigem acompanhamento antes da continuidade.", botao: "Revisar contas", acao: () => abrirPainel("clinicas"), Icone: Clock3 } : null,
      dominiosPendentes.length > 0 ? { titulo: "Domínios e publicação", descricao: dominiosPendentes.length + " endereço(s) precisam de configuração, DNS, SSL ou revisão.", botao: "Revisar domínio", acao: () => clinicaDoDominioPendente ? abrirClinicaNoAdmin(clinicaDoDominioPendente, "site") : abrirPainel("site"), Icone: Globe2 } : null,
      usuariosSemClinica > 0 ? { titulo: "Usuários sem clínica ativa", descricao: usuariosSemClinica + " usuário(s) não possuem vínculo ativo com uma clínica.", botao: "Abrir equipe", acao: () => abrirPainel("clinicas"), Icone: Users } : null,
    ].filter(Boolean) as Array<{ titulo: string; descricao: string; botao: string; acao: () => void; Icone: typeof Gauge }>;

    const atalhos = [
      { titulo: "Planos e autorizações", descricao: "Matriz de recursos, limites e exceções por clínica.", Icone: BadgeDollarSign, acao: () => window.location.assign("/admin-planos") },
      { titulo: "Conteúdo público", descricao: "Ajuste textos, planos e a jornada de contratação.", Icone: PanelsTopLeft, acao: () => window.location.assign("/admin-conteudo") },
      { titulo: "Páginas e URLs", descricao: "Consulte e mantenha o catálogo de rotas da plataforma.", Icone: Globe2, acao: () => abrirPainel("paginas") },
    ];

    return <div className="space-y-5">
      {erroSolicitacoes && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-900">{erroSolicitacoes}</div>}
      <section className="rounded-2xl border border-primary/15 bg-[#fffaf7] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Administração geral</p>
            <h2 className="mt-1 text-2xl font-black">Visão geral da plataforma</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Tenha as decisões mais importantes em um só lugar: abertura de clínicas, acesso, financeiro, presença digital e operação do produto.</p>
          </div>
          <div className="rounded-xl border bg-white px-4 py-3 text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Última atualização</p>
            <p className="mt-1 text-sm font-black">{dataHoraBR(ultimaAtualizacao)}</p>
            <button type="button" onClick={() => { void carregarTudo(); void carregarSolicitacoes(); }} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"><RefreshCcw size={13}/> Atualizar painel</button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ rotulo, valor, detalhe, Icone, acao }) => <button key={rotulo} type="button" onClick={acao} className="rounded-xl border bg-white p-4 text-left transition hover:border-primary hover:shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-muted-foreground">{rotulo}</p><p className="mt-2 text-3xl font-black">{valor}</p></div><Icone size={21} className="text-primary"/></div>
            <p className="mt-2 text-xs text-muted-foreground">{detalhe}</p>
          </button>)}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Fila de decisão</p><h3 className="mt-1 text-xl font-black">O que precisa da sua atenção</h3><p className="mt-1 text-sm text-muted-foreground">Pendências que podem impedir abertura, acesso, cobrança ou publicação.</p></div>
            <button type="button" onClick={() => abrirPainel("auditoria")} className="text-sm font-bold text-primary hover:underline">Abrir controle</button>
          </div>
          <div className="mt-5 divide-y rounded-xl border">
            {pendencias.length ? pendencias.map(({ titulo, descricao, botao, acao, Icone }) => <div key={titulo} className="flex flex-wrap items-center gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icone size={19}/></span>
              <div className="min-w-[180px] flex-1"><p className="font-bold">{titulo}</p><p className="mt-0.5 text-sm text-muted-foreground">{descricao}</p></div>
              <button type="button" onClick={acao} className="min-h-10 rounded-lg border bg-white px-3 text-sm font-bold hover:bg-slate-50">{botao}</button>
            </div>) : <div className="p-7 text-center"><ShieldCheck className="mx-auto text-emerald-600" size={24}/><p className="mt-3 font-bold">Nenhuma prioridade administrativa agora</p><p className="mt-1 text-sm text-muted-foreground">Novas contratações, domínios e contas que exigirem decisão aparecerão aqui.</p></div>}
          </div>
        </Card>

        <Card>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Atalhos de gestão</p>
          <h3 className="mt-1 text-xl font-black">Ferramentas da plataforma</h3>
          <div className="mt-4 grid gap-2">
            {atalhos.map(({ titulo, descricao, Icone, acao }) => <button key={titulo} type="button" onClick={acao} className="flex items-start gap-3 rounded-xl border p-3 text-left transition hover:border-primary hover:bg-[#fffaf7]">
              <Icone size={18} className="mt-0.5 shrink-0 text-primary"/><span><span className="block text-sm font-bold">{titulo}</span><span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{descricao}</span></span>
            </button>)}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Clientes e equipe</p><p className="mt-2 text-3xl font-black">{clinicas.length}</p><p className="text-sm text-muted-foreground">clínica(s) cadastrada(s) · {usuariosAtivos} vínculo(s) ativo(s)</p><button type="button" onClick={() => abrirPainel("clinicas")} className="mt-4 text-sm font-bold text-primary hover:underline">Gerenciar clínicas e usuários</button></Card>
        <Card><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Assinaturas</p><p className="mt-2 text-3xl font-black">{pagas}</p><p className="text-sm text-muted-foreground">conta(s) ativa(s) e em dia · {canceladas} cancelada(s)</p><button type="button" onClick={() => abrirPainel("clinicas")} className="mt-4 text-sm font-bold text-primary hover:underline">Ver situações de conta</button></Card>
        <Card><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Produto e catálogo</p><p className="mt-2 text-3xl font-black">{ROTAS_CATALOGO.length}</p><p className="text-sm text-muted-foreground">página(s) catalogada(s) · {planos.length} plano(s) configurado(s)</p><button type="button" onClick={() => abrirPainel("paginas")} className="mt-4 text-sm font-bold text-primary hover:underline">Administrar páginas e URLs</button></Card>
      </div>
    </div>;
  };

  const renderCadastroClinica = () => !selecionada ? null : <Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Cadastro</h2><p className="text-sm text-muted-foreground">Dados gerais e configuração comercial da clínica.</p></div><button disabled={ocupado} onClick={salvarClinica} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground"><Save size={17}/> Salvar</button></div><div className="mt-5 grid gap-4 md:grid-cols-2">
    <label className="text-sm font-semibold">Nome<input value={selecionada.nome} onChange={(e) => setSelecionada({ ...selecionada, nome: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label>
    <label className="text-sm font-semibold">Tipo de parceiro<select value={selecionada.tipo_publico || "vet"} onChange={(e) => setSelecionada({ ...selecionada, tipo_publico: e.target.value as Clinica["tipo_publico"] })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"><option value="vet">Veterinário / clínica veterinária</option><option value="pet">Pet shop</option></select></label>
    <label className="text-sm font-semibold md:col-span-2">Nome do endereço ORICSE<div className="mt-1 flex min-h-11 items-center rounded-xl border px-3 font-normal"><span className="whitespace-nowrap text-muted-foreground">https://</span><input value={selecionada.slug || ""} onChange={(e) => setSelecionada({ ...selecionada, slug: limparSlug(e.target.value) })} className="min-w-0 flex-1 bg-transparent outline-none" placeholder="nomedaclinica"/><span className="whitespace-nowrap text-muted-foreground">.oricse.com.br</span></div><p className="mt-1 text-xs font-normal text-muted-foreground">Nome único, sem espaços. Salve e acesse “Site e domínios” para publicar o endereço ou conectar o domínio próprio.</p></label>
    <label className="text-sm font-semibold">Plano<select value={selecionada.plano} onChange={(e) => { const p = planos.find((x) => valorPlanoClinica(x) === e.target.value); setSelecionada({ ...selecionada, plano: e.target.value, limite_usuarios: p?.usuarios_inclusos || selecionada.limite_usuarios }); }} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">{planos.map((p) => <option key={p.codigo} value={valorPlanoClinica(p)}>{p.nome}{p.codigo.endsWith("-2026") ? " · Atual" : " · Legado"}</option>)}</select></label>
    <label className="text-sm font-semibold">Status<select value={selecionada.status} onChange={(e) => setSelecionada({ ...selecionada, status: e.target.value as Clinica["status"] })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"><option value="ativa">Ativa</option><option value="bloqueada">Bloqueada</option><option value="inativa">Inativa</option><option value="cancelada">Cancelada</option></select></label>
    <label className="text-sm font-semibold">Limite de usuários<input type="number" min={1} value={selecionada.limite_usuarios} onChange={(e) => setSelecionada({ ...selecionada, limite_usuarios: Number(e.target.value) })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label>
    <div className="rounded-xl border bg-slate-50 p-3 text-sm md:self-end"><p className="font-semibold">Domínios e site público</p><p className="mt-1 text-xs text-muted-foreground">Gerenciados exclusivamente por você em “Site e domínios”.</p></div>
    <div className="md:col-span-2"><p className="text-sm font-semibold">Logo da clínica</p><div className="mt-2 flex flex-wrap items-center gap-4 rounded-xl border p-4">{selecionada.logo_url ? <img src={selecionada.logo_url} alt="Logo da clínica" className="h-24 w-40 object-contain"/> : <div className="flex h-24 w-40 items-center justify-center rounded-lg bg-slate-50 text-xs text-muted-foreground">Sem logo</div>}<label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 font-semibold"><ImageUp size={17}/>{enviandoLogoClinica ? "Enviando..." : "Enviar logo"}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" disabled={enviandoLogoClinica} onChange={(e) => void enviarLogoDaClinica(e.target.files?.[0])}/></label></div></div>
    <label className="text-sm font-semibold md:col-span-2">Observações internas<textarea value={selecionada.observacoes || ""} onChange={(e) => setSelecionada({ ...selecionada, observacoes: e.target.value })} rows={4} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"/></label>
     </div>
     <div className="mt-8 rounded-xl border border-red-300 bg-red-50 p-4"><h3 className="font-bold text-red-700">Zona de perigo</h3><p className="mt-1 text-sm text-red-700">Excluir esta clínica remove definitivamente seus dados e acessos.</p><button type="button" disabled={ocupado} onClick={() => { setConfirmacaoExclusao(""); setExcluindoClinica(true); }} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white"><Trash2 size={17}/> Excluir clínica</button></div>
     <Dialog open={excluindoClinica} onOpenChange={(aberto) => { if (!ocupado) { setExcluindoClinica(aberto); if (!aberto) setConfirmacaoExclusao(""); } }}><DialogContent><DialogHeader><DialogTitle className="text-red-700">Excluir "{selecionada.nome}"?</DialogTitle><DialogDescription>Leia os avisos antes de continuar.</DialogDescription></DialogHeader>
       <ol className="list-decimal space-y-2 pl-5 text-sm"><li><strong>Esta ação é irreversível.</strong> Não existe como desfazer ou recuperar a clínica depois.</li><li><strong>Dados apagados:</strong> usuários, tutores, catálogo, comissões e configurações da clínica serão removidos, e as contas de acesso exclusivas dela serão excluídas.</li><li><strong>Arquivos no Google Drive não são apagados</strong>, mas o vínculo com a pasta será perdido. Remova-os manualmente se necessário.</li></ol>
       <label className="text-sm font-semibold">Digite <span className="font-mono text-red-700">APAGAR</span> para confirmar<input value={confirmacaoExclusao} onChange={(e) => setConfirmacaoExclusao(e.target.value)} autoComplete="off" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label>
       <div className="flex justify-end gap-2"><button type="button" disabled={ocupado} onClick={() => { setExcluindoClinica(false); setConfirmacaoExclusao(""); }} className="rounded-xl border px-4 py-2.5 font-semibold">Cancelar</button><button type="button" disabled={ocupado || confirmacaoExclusao !== "APAGAR"} onClick={() => void confirmarExclusaoClinica()} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white disabled:opacity-40"><Trash2 size={17}/> Enviar à Lixeira</button></div>
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

  async function sincronizarEnderecoOricse() {
    if (!selecionada) return;
    const slug = limparSlug(selecionada.slug || "");
    if (!slug || !/[a-z0-9]/.test(slug)) return void toast.error("Defina e salve um nome válido para o endereço ORICSE primeiro.");

    const hostname = slug + ".oricse.com.br";
    const atual = dominiosDaClinica.find((dominio) => dominio.tipo === "oricse");
    if (atual?.status === "ativo" && atual.hostname !== hostname) {
      return void toast.error("Este endereço já está ativo. Troque o endereço somente depois de migrar o DNS.");
    }

    setSalvandoDominio(true);
    try {
      const dados = {
        hostname,
        principal: true,
        publicar_site: true,
        dns_alvo: "sites.oricse.com.br",
        verificacao_tipo: "automatica",
        atualizado_em: new Date().toISOString(),
      };
      const resposta = atual
        ? await (supabase as any).from("oricse_dominios_clinica").update(dados).eq("id", atual.id)
        : await (supabase as any).from("oricse_dominios_clinica").insert({
            ...dados,
            clinica_id: selecionada.id,
            tipo: "oricse",
            status: "rascunho",
          });
      if (resposta.error) throw resposta.error;
      await carregarTudo();
      toast.success("Endereço ORICSE preparado para publicação.");
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível preparar o endereço ORICSE.");
    } finally {
      setSalvandoDominio(false);
    }
  }

  async function adicionarDominioProprio() {
    if (!selecionada) return;
    const hostname = normalizarHostname(novoDominio);
    if (!hostnameValido(hostname)) return void toast.error("Informe um domínio válido, por exemplo suaclinica.com.br.");
    if (hostname.endsWith(".oricse.com.br") || hostname === "oricse.com.br") return void toast.error("Use o endereço ORICSE para subdomínios da plataforma.");

    const hostnames = [hostname];
    if (incluirWww && !hostname.startsWith("www.")) hostnames.push("www." + hostname);

    setSalvandoDominio(true);
    try {
      const { error } = await (supabase as any).from("oricse_dominios_clinica").insert(hostnames.map((item, indice) => ({
        clinica_id: selecionada.id,
        hostname: item,
        tipo: "proprio",
        status: "aguardando_dns",
        principal: indice === 0,
        publicar_site: true,
        dns_alvo: "sites.oricse.com.br",
        verificacao_tipo: "cname",
      })));
      if (error) throw error;
      const { error: clinicaError } = await (supabaseBanco as any).from("clinicas").update({
        dominio: hostname,
        updated_at: new Date().toISOString(),
      }).eq("id", selecionada.id);
      if (clinicaError) throw clinicaError;
      setNovoDominio("");
      await carregarTudo();
      toast.success("Domínio próprio incluído. Agora aponte o DNS indicado.");
    } catch (e) {
      const erro = e as { code?: string; message?: string };
      toast.error(erro.code === "23505" ? "Esse domínio já está vinculado a outra clínica." : (erro.message || "Não foi possível incluir o domínio."));
    } finally {
      setSalvandoDominio(false);
    }
  }

  async function alterarPublicacaoDominio(dominio: DominioClinica, publicar_site: boolean) {
    setSalvandoDominio(true);
    try {
      const { error } = await (supabase as any).from("oricse_dominios_clinica").update({
        publicar_site,
        atualizado_em: new Date().toISOString(),
      }).eq("id", dominio.id);
      if (error) throw error;
      await carregarTudo();
      toast.success(publicar_site ? "Site público liberado neste domínio." : "Site público pausado neste domínio.");
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível alterar a publicação.");
    } finally {
      setSalvandoDominio(false);
    }
  }

  const renderSiteDominiosClinica = () => {
    if (!selecionada) return null;
    const enderecoOricse = dominiosDaClinica.find((dominio) => dominio.tipo === "oricse");
    const dominiosProprios = dominiosDaClinica.filter((dominio) => dominio.tipo === "proprio");
    const plano = planos.find((item) => valorPlanoClinica(item) === selecionada.plano);
    const enderecoSugerido = selecionada.slug ? limparSlug(selecionada.slug) + ".oricse.com.br" : "defina-o-no-cadastro.oricse.com.br";

    return <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><Globe2 size={21}/><h2 className="text-2xl font-bold">Site e domínios</h2></div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Você administra os endereços públicos desta clínica. O site público e o Portal do Tutor usam o mesmo domínio; o sistema ORICSE continua protegido e centralizado.</p>
          </div>
          <span className={"rounded-full px-3 py-1.5 text-xs font-bold " + (plano?.dominio_incluso ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700")}>{plano?.dominio_incluso ? "Domínio próprio incluído no plano" : "Domínio próprio controlado pelo plano"}</span>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Endereço ORICSE</p><h3 className="mt-1 text-xl font-bold">Subdomínio da clínica</h3></div>
            <span className={"rounded-full px-2.5 py-1 text-xs font-bold " + classeStatusDominio(enderecoOricse?.status || "rascunho")}>{rotuloStatusDominio(enderecoOricse?.status || "rascunho")}</span>
          </div>
          <div className="mt-5 rounded-xl border bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Endereço que será publicado</p>
            <p className="mt-2 break-all text-lg font-bold">https://{enderecoOricse?.hostname || enderecoSugerido}</p>
            <p className="mt-2 text-sm text-muted-foreground">O nome vem do campo “Nome do endereço ORICSE” no cadastro da clínica.</p>
          </div>
          <button type="button" disabled={salvandoDominio || !selecionada.slug} onClick={() => void sincronizarEnderecoOricse()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-50"><Save size={17}/>{enderecoOricse ? "Sincronizar endereço" : "Preparar endereço ORICSE"}</button>
          <p className="mt-3 text-xs text-muted-foreground">A ativação pública acontece quando a zona <strong>oricse.com.br</strong> estiver conectada à infraestrutura ORICSE.</p>
        </Card>

        <Card>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Domínio da clínica</p>
          <h3 className="mt-1 text-xl font-bold">Usar domínio próprio</h3>
          <p className="mt-2 text-sm text-muted-foreground">Ex.: suaclinica.com.br. A clínica mantém a própria marca; você mantém a operação e a publicação centralizadas na ORICSE.</p>
          <label className="mt-5 block text-sm font-semibold">Domínio
            <input value={novoDominio} onChange={(e) => setNovoDominio(normalizarHostname(e.target.value))} placeholder="suaclinica.com.br" autoCapitalize="none" autoCorrect="off" spellCheck={false} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/>
          </label>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={incluirWww} onChange={(e) => setIncluirWww(e.target.checked)} className="h-4 w-4"/> Incluir também www.{normalizarHostname(novoDominio) || "suaclinica.com.br"}</label>
          <button type="button" disabled={salvandoDominio || !novoDominio} onClick={() => void adicionarDominioProprio()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 py-2.5 font-semibold disabled:opacity-50"><Plus size={17}/> Adicionar domínio próprio</button>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="text-xl font-bold">Domínios configurados</h3><p className="mt-1 text-sm text-muted-foreground">Cada endereço é validado separadamente. Domínio raiz e www são registros distintos para garantir certificado SSL e redirecionamento corretos.</p></div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold">{dominiosDaClinica.length} {dominiosDaClinica.length === 1 ? "endereço" : "endereços"}</span>
        </div>
        <div className="mt-5 overflow-x-auto rounded-xl border">
          <table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Endereço</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">DNS / SSL</th><th className="px-4 py-3">Site</th></tr></thead>
          <tbody>{dominiosDaClinica.map((dominio) => <tr key={dominio.id} className="border-t align-top"><td className="px-4 py-4"><p className="font-bold">{dominio.hostname}</p><p className="mt-1 text-xs text-muted-foreground">{dominio.tipo === "oricse" ? "Endereço ORICSE" : dominio.principal ? "Domínio principal da clínica" : "Alias www"}</p></td><td className="px-4 py-4"><span className={"inline-flex rounded-full px-2.5 py-1 text-xs font-bold " + classeStatusDominio(dominio.status)}>{rotuloStatusDominio(dominio.status)}</span>{dominio.ultimo_erro && <p className="mt-2 max-w-xs text-xs text-red-700">{dominio.ultimo_erro}</p>}</td><td className="px-4 py-4"><p className="font-mono text-xs">{dominio.verificacao_tipo === "automatica" ? "Infraestrutura ORICSE" : "CNAME → " + dominio.dns_alvo}</p><p className="mt-1 text-xs text-muted-foreground">{dominio.ssl_status ? "SSL: " + dominio.ssl_status : "SSL será emitido após a validação"}</p></td><td className="px-4 py-4"><label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={dominio.publicar_site} disabled={salvandoDominio} onChange={(e) => void alterarPublicacaoDominio(dominio, e.target.checked)} className="h-4 w-4"/> Publicado</label></td></tr>)}
          {dominiosDaClinica.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum endereço preparado para esta clínica.</td></tr>}</tbody></table>
        </div>
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-bold">Próxima etapa de infraestrutura</p><p className="mt-1">Após conectar <strong>oricse.com.br</strong> ao Cloudflare, os subdomínios ORICSE serão ativados por wildcard. Para domínio próprio, a clínica aponta o CNAME informado e a ORICSE valida o domínio antes de publicar.</p></div>
      </Card>
    </div>;
  };


  function statusSolicitacao(item: SolicitacaoClinica) {
    const nomes: Record<string, string> = {
      pagamento_aprovado: "Pagamento confirmado",
      isento_aguardando_aprovacao: "Cupom 100% · Aguardando auditoria",
      teste_aguardando_ativacao: "Teste aguardando revisão",
      em_analise: "Em análise",
      em_configuracao: "Em configuração",
      ativada: "Funcionamento autorizado",
    };
    return nomes[item.status] || item.status.replaceAll("_", " ");
  }

  function classeSolicitacao(status: string) {
    if (status === "ativada") return "bg-emerald-50 text-emerald-700";
    if (status === "pagamento_aprovado") return "bg-sky-50 text-sky-700";
    if (status === "em_analise" || status === "em_configuracao" || status === "isento_aguardando_aprovacao") return "bg-amber-50 text-amber-800";
    return "bg-slate-100 text-slate-700";
  }

  const renderAutorizacaoCriacao = () => {
    const item=solicitacaoSelecionada;
    if(!item) return null;
    const criada=Boolean(item.clinica_criada_id);
    const financeiraValida=pedidoIsentoValido(item)||Boolean(item.pagamento_id&&item.pagamento_aprovado_em);
    const elegivel=!criada&&financeiraValida&&["pagamento_aprovado","em_analise","isento_aguardando_aprovacao"].includes(item.status);
    const editor=(nome:string,campo:keyof SolicitacaoClinica,limite=180)=><label className="text-sm font-semibold">{nome}<input value={String(item[campo]??"")} maxLength={limite} onChange={e=>editarSolicitacao(campo,e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 font-normal"/></label>;
    return <Dialog open={Boolean(item)} onOpenChange={aberto=>{if(!aberto&&!salvandoSolicitacao&&!preparandoSolicitacao)setSolicitacaoSelecionada(null);}}>
      <DialogContent className="max-h-[94dvh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Autorização para criar clínica</DialogTitle>
          <DialogDescription>Dados preenchidos automaticamente pela contratação. Revise antes de criar o espaço. A clínica ficará bloqueada até a autorização final de funcionamento.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="rounded-xl border bg-slate-50 p-4 text-sm">
            <p><b>Pedido:</b> {item.id}</p><p><b>Status:</b> {statusSolicitacao(item)}</p>
            <p><b>Plano:</b> {item.plano_nome} · {item.ciclo} · {item.quantidade_usuarios||0} usuários</p>
            <p><b>Valor final:</b> {Number(item.valor_total||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p>
            <p><b>Pagamento:</b> {pedidoIsentoValido(item)?"Cupom 100% ("+item.promo_codigo+"), sem cobrança":item.pagamento_aprovado_em?"Confirmado em "+dataBR(item.pagamento_aprovado_em):"Não confirmado"}</p>
            <p><b>CNPJ:</b> {item.cnpj||"Não informado"}</p>
            <p><b>CPF do responsável:</b> {item.responsavel_cpf||"Não informado"}</p>
          </div>
          <section className="space-y-3"><h3 className="font-extrabold">Dados da clínica</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {editor("Nome da clínica", "clinica_nome")}
              {editor("Identificador @", "slug_desejado",100)}
              {editor("Razão social","razao_social")}
              {editor("Telefone","clinica_telefone",30)}
              {editor("E-mail","clinica_email")}
              {editor("CEP","clinica_cep",12)}
              {editor("Endereço","clinica_endereco")}
              {editor("Número","clinica_numero",30)}
              {editor("Bairro","clinica_bairro")}
              {editor("Cidade","clinica_cidade")}
              {editor("UF","clinica_uf",2)}
            </div>
          </section>
          <section className="space-y-3"><h3 className="font-extrabold">Responsável técnico</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {editor("Nome","responsavel_nome")}
              {editor("CRMV","responsavel_crmv",30)}
              {editor("UF do CRMV","responsavel_crmv_uf",2)}
              {editor("E-mail","responsavel_email")}
              {editor("Telefone","responsavel_telefone",30)}
            </div>
          </section>
          <label className="block text-sm font-semibold">Observações da contratação
            <textarea value={item.observacoes||""} rows={3} onChange={e=>editarSolicitacao("observacoes",e.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal"/>
          </label>
          {!elegivel&&<p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">{criada?"O espaço já foi criado. Revise a clínica existente antes da liberação.":"A criação ainda não está autorizada: é necessário concluir a contratação, confirmar o pagamento ou validar uma isenção integral."}</p>}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <button type="button" onClick={()=>void excluirSolicitacaoDaFila(item)} className="min-h-11 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-700 hover:bg-red-50"><Trash2 className="mr-1 inline-block h-4 w-4"/> Excluir</button>
            <button type="button" onClick={()=>setSolicitacaoSelecionada(null)} className="min-h-11 rounded-xl border px-4 text-sm font-bold">Fechar</button>
            {!criada&&<button type="button" disabled={salvandoSolicitacao||Boolean(preparandoSolicitacao)} onClick={()=>void salvarRevisaoSolicitacao(item)} className="min-h-11 rounded-xl border px-4 text-sm font-bold disabled:opacity-50">{salvandoSolicitacao?"Salvando...":"Salvar revisão"}</button>}
            {elegivel&&<button type="button" disabled={salvandoSolicitacao||Boolean(preparandoSolicitacao)} onClick={()=>void (async()=>{if(!window.confirm("Confirmar auditoria e autorizar a CRIAÇÃO do espaço bloqueado? Isso NÃO libera o funcionamento."))return;const ok=await salvarRevisaoSolicitacao(item);if(!ok)return;await prepararClinicaSolicitada(item,false);setSolicitacaoSelecionada(null);})()} className="min-h-11 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50">{preparandoSolicitacao?"Criando...":"Autorizar criação da clínica"}</button>}
            {criada&&<button type="button" onClick={()=>{setSolicitacaoSelecionada(null);abrirConfiguracaoDaSolicitacao(item);}} className="min-h-11 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">Revisar clínica criada</button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>;
  };

  const renderLixeira = () => {
    const pedidos=solicitacoes.filter(item=>Boolean(item.excluido_em));
    const todos=[...pedidos.map(item=>({tipo:"solicitacao" as const,id:item.id,nome:item.clinica_nome,excluido:item.excluido_em!,expira:item.expira_lixeira_em,status:item.status})),...clinicasLixeira.map(item=>({tipo:"clinica" as const,id:item.id,nome:item.nome,excluido:item.excluido_em!,expira:item.expira_lixeira_em||null,status:item.status}))].sort((a,b)=>b.excluido.localeCompare(a.excluido));
    return <div className="space-y-4">
      <div><h2 className="text-2xl font-black">Lixeira</h2><p className="mt-1 text-sm text-muted-foreground">Itens excluídos ficam fora das listas principais. Recuperação disponível por até 360 dias.</p></div>
      <Card><p className="font-semibold">{todos.length} item(ns) na Lixeira</p></Card>
      {todos.length===0&&<Card><p className="text-sm text-muted-foreground">A Lixeira está vazia.</p></Card>}
      {todos.map(item=><Card key={item.tipo+item.id}><div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-black">{item.nome}</p><p className="text-sm text-muted-foreground">{item.tipo==="clinica"?"Clínica":"Solicitação"} · Excluído em {dataHoraBR(item.excluido)}</p><p className="text-sm font-semibold text-amber-800">Recuperável até {dataBR(item.expira)}</p><p className="text-xs text-muted-foreground">Identificador: {item.id}</p></div>
        <button type="button" disabled={processandoLixeira===item.id||Boolean(item.expira&&new Date(item.expira).getTime()<Date.now())} onClick={()=>void restaurarDaLixeira(item.tipo,item.id)} className="rounded-xl border px-4 py-3 font-semibold disabled:opacity-50">Restaurar</button>
      </div></Card>)}
    </div>;
  };

  const renderClinicasNovas = () => {
    const indicadores = [
      { rotulo: "Total de solicitações", valor: solicitacoes.filter(item=>!item.excluido_em).length, Icone: ClipboardCheck, cor: "text-primary" },
      { rotulo: "Planos pagos", valor: solicitacoesPagas.length, Icone: CheckCircle2, cor: "text-emerald-700" },
      { rotulo: "Prontas para liberação", valor: solicitacoesProntas.length, Icone: Building2, cor: "text-amber-700" },
    ];

    return <div className="space-y-5">
      <section className="rounded-2xl border border-primary/15 bg-[#fffaf7] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Central de entrada</p>
            <h2 className="mt-1 text-2xl font-black">Clínicas novas</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Acompanhe cada contratação do pagamento à liberação. A clínica só passa a funcionar depois da sua autorização final.</p>
          </div>
          <button type="button" onClick={() => void carregarSolicitacoes()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-bold hover:bg-slate-50">
            <RefreshCcw size={16}/> Atualizar solicitações
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {indicadores.map(({ rotulo, valor, Icone, cor }) => <div key={rotulo} className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-muted-foreground">{rotulo}</p><Icone size={19} className={cor}/></div>
            <p className="mt-2 text-3xl font-black">{valor}</p>
          </div>)}
        </div>
      </section>

      <section className="space-y-3">
        {carregandoSolicitacoes ? <Card><p className="py-6 text-center text-sm text-muted-foreground">Carregando solicitações...</p></Card>
          : erroSolicitacoes ? <Card><p role="alert" className="p-5 font-semibold text-red-800">Não foi possível carregar o histórico. Verifique sua sessão administrativa e tente novamente.</p></Card>
          : solicitacoes.filter(item=>!item.excluido_em).length === 0 ? <Card><div className="py-8 text-center"><Clock3 className="mx-auto text-muted-foreground"/><h3 className="mt-3 font-bold">Nenhuma solicitação registrada</h3><p className="mt-1 text-sm text-muted-foreground">A consulta retornou zero registros, sem filtro de status.</p></div></Card>
          : solicitacoes.filter(item=>!item.excluido_em).map((item) => {
            const criada = clinicas.find((clinica) => clinica.id === item.clinica_criada_id);
            const podePreparar = (item.status === "pagamento_aprovado" || item.status === "em_analise" || item.status === "isento_aguardando_aprovacao") && (Boolean(item.pagamento_id && item.pagamento_aprovado_em) || pedidoIsentoValido(item)) && !item.clinica_criada_id;
            const podeAutorizar = Boolean(criada) && item.status !== "ativada";

            return <article key={item.id} className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={"rounded-full px-2.5 py-1 text-xs font-bold " + classeSolicitacao(item.status)}>{statusSolicitacao(item)}</span>
                    <span className="text-xs text-muted-foreground">Solicitada em {dataBR(item.created_at)}</span>
                  </div>
                  <button type="button" onClick={()=>setSolicitacaoSelecionada(item)} className="mt-3 block text-left focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" aria-label={`Auditar e autorizar criação de ${item.clinica_nome}`}><span className="text-xl font-black underline-offset-4 hover:underline">{item.clinica_nome}</span>{item.slug_desejado && <span className="block text-sm font-semibold text-primary">@{item.slug_desejado}</span>}</button>
                  <p className="mt-1 text-sm text-muted-foreground">{item.plano_nome} · {item.ciclo} · {item.valor_exibido || "Valor não informado"}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Etapa atual</p>
                  <p className="mt-1 text-sm font-black">{item.clinica_criada_id ? "Configuração e liberação" : item.status === "em_analise" ? "Revisar pagamento e dados" : "Triagem inicial"}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                <div className="rounded-xl border bg-slate-50 p-4 text-sm"><p className="font-bold">Clínica</p><p className="mt-2">{item.clinica_email || "E-mail não informado"}</p><p>{item.clinica_telefone || "Telefone não informado"}</p><p>{[item.clinica_cidade, item.clinica_uf].filter(Boolean).join("/") || "Local não informado"}</p></div>
                <div className="rounded-xl border bg-slate-50 p-4 text-sm"><p className="font-bold">Responsável</p><p className="mt-2">{item.responsavel_nome || "Não informado"}</p><p>{item.responsavel_email || "E-mail não informado"}</p><p>{item.responsavel_crmv ? "CRMV " + item.responsavel_crmv + (item.responsavel_crmv_uf ? "/" + item.responsavel_crmv_uf : "") : "CRMV não informado"}</p></div>
                <div className="rounded-xl border bg-slate-50 p-4 text-sm"><p className="font-bold">Pagamento</p><p className="mt-2">{item.pagamento_aprovado_em ? "Confirmado em " + dataBR(item.pagamento_aprovado_em) : pedidoIsentoValido(item) ? "Cupom integral: R$ 0,00 — sem cobrança" : item.status === "teste_aguardando_ativacao" ? "Período de teste" : "Aguardando confirmação"}</p><p className="text-xs text-muted-foreground">{item.pagamento_id ? (item.pagamento_provedor || "Pagamento") + " · " + item.pagamento_id : "Sem identificador de pagamento"}</p></div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
                <button type="button" onClick={()=>setSolicitacaoSelecionada(item)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-bold hover:bg-slate-50"><ClipboardCheck size={16}/> Auditar / autorizar criação</button>
                {(item.status === "pagamento_aprovado" || item.status === "teste_aguardando_ativacao" || item.status === "isento_aguardando_aprovacao") && <button type="button" onClick={() => void iniciarAnaliseSolicitacao(item)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-bold hover:bg-slate-50"><Search size={16}/> Iniciar análise</button>}
                {podePreparar && <button type="button" disabled={preparandoSolicitacao === item.id} onClick={() => void prepararClinicaSolicitada(item)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"><Building2 size={16}/>{preparandoSolicitacao === item.id ? "Preparando..." : "Preparar espaço da clínica"}</button>}
                {criada && <button type="button" onClick={() => abrirConfiguracaoDaSolicitacao(item)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-bold hover:bg-slate-50"><Settings size={16}/> Revisar plano e acesso</button>}
                {podeAutorizar && <button type="button" disabled={ativandoSolicitacao === item.id} onClick={() => void autorizarFuncionamento(item)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><ShieldCheck size={16}/>{ativandoSolicitacao === item.id ? "Autorizando..." : "Autorizar funcionamento"}</button>}
                {item.status === "ativada" && <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700"><CheckCircle2 size={16}/> Funcionamento autorizado</span>}
              </div>
            </article>;
          })}
      </section>
    </div>;
  };

  const renderClinicas = () => {
    if (selecionada) return <div className="space-y-5"><button onClick={() => setSelecionada(null)} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 font-semibold"><ArrowLeft size={17}/> Voltar para clínicas</button><Card><div className="flex flex-wrap items-center gap-4"><div className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-xl bg-slate-50">{selecionada.logo_url ? <img src={selecionada.logo_url} alt="" className="h-full w-full object-contain"/> : <Building2 size={30} className="text-muted-foreground"/>}</div><div className="min-w-0 flex-1"><h2 className="truncate text-2xl font-bold">{selecionada.nome}</h2><p className="mt-1 text-sm text-muted-foreground">@{selecionada.slug || "sem-usuario"} · {selecionada.plano} · {selecionada.status}</p></div></div><div className="mt-5 flex flex-wrap gap-2 border-t pt-4">{[
      ["cadastro", "Cadastro", Building2], ["situacao", "Situação da conta", CreditCard], ["usuarios", "Usuários", Users], ["drive", "Drive", Database], ["site", "Site e domínios", Globe2], ["autorizacoes", "Autorizações", Settings],
    ].map(([id, nome, Icone]: any) => <button key={id} onClick={() => { setAbaClinica(id);  }} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${abaClinica === id ? "bg-primary text-primary-foreground" : "border bg-white"}`}><Icone size={16}/>{nome}</button>)}</div></Card>{abaClinica === "cadastro" && renderCadastroClinica()}{abaClinica === "situacao" && renderSituacao()}{abaClinica === "usuarios" && renderUsuariosClinica()}{abaClinica === "drive" && renderDriveClinica()}{abaClinica === "site" && renderSiteDominiosClinica()}{abaClinica === "autorizacoes" && renderAutorizacoesClinica()}</div>;

    return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Clínicas e equipe</h2><p className="mt-1 text-sm text-muted-foreground">Cada conta é administrada por aqui: cadastro, usuários, plano, situação financeira, site, domínio e autorizações.</p></div><button type="button" onClick={abrirNovaClinica} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground"><Plus size={18}/> Adicionar clínica</button></div><div className="flex flex-wrap items-center gap-2">{[["todas", "Todas"], ["pagas", "Ativas e pagas"], ["inadimplentes", "Não pagaram"], ["canceladas", "Canceladas"]].map(([id, nome]) => <button key={id} onClick={() => setFiltroClinica(id as FiltroClinica)} className={`rounded-full px-3 py-2 text-sm font-semibold ${filtroClinica === id ? "bg-primary text-primary-foreground" : "border bg-white"}`}>{nome}</button>)}</div><div className="relative max-w-2xl"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20}/><input value={buscaClinica} onChange={(e) => setBuscaClinica(e.target.value)} placeholder="Procurar por nome, @usuário, plano ou status" className="min-h-12 w-full rounded-2xl border bg-white pl-12 pr-4 shadow-sm outline-none focus:border-primary"/></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{clinicasFiltradas.map((c) => <button key={c.id} onClick={() => { setSelecionada(c); setAbaClinica("cadastro"); }} className="group rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:border-primary"><div className="flex items-start gap-4"><div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50">{c.logo_url ? <img src={c.logo_url} alt="" className="h-full w-full object-contain"/> : <Building2 size={26} className="text-muted-foreground"/>}</div><div className="min-w-0"><h3 className="truncate text-lg font-bold group-hover:text-primary">{c.nome}</h3><p className="mt-1 text-sm text-muted-foreground">@{c.slug || "sem-usuario"}</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{c.plano}</span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{c.status}</span></div></div></div><div className="mt-4 border-t pt-3 text-xs text-muted-foreground">Conta criada em {dataBR(c.created_at)}{c.acesso_ate ? ` · acesso até ${dataBR(c.acesso_ate)}` : ""}</div></button>)}{clinicasFiltradas.length === 0 && <Card className="sm:col-span-2 xl:col-span-3"><div className="py-8 text-center text-muted-foreground">Nenhuma clínica encontrada.</div></Card>}</div></div>;
  };

  async function carregarExcecoesClinica(clinicaId:string) {
    const [recursos, excecoes] = await Promise.all([
      (supabase as any).from("oricse_funcionalidades").select("codigo,nome,grupo,ordem").eq("ativo",true).order("ordem"),
      (supabase as any).from("oricse_clinica_autorizacoes").select("funcionalidade_codigo,decisao").eq("clinica_id",clinicaId)
    ]);
    if(recursos.error||excecoes.error) return toast.error("Não foi possível carregar autorizações especiais.");
    setFuncionalidades(recursos.data||[]);
    setExcecoesClinica(Object.fromEntries((excecoes.data||[]).map((x:any)=>[x.funcionalidade_codigo,x.decisao])));
  }
  async function alterarExcecaoClinica(codigo:string,decisao:string) {
    if(!selecionada)return;
    setSalvandoExcecao(codigo);
    const query=(supabase as any).from("oricse_clinica_autorizacoes");
    const {error}=decisao==="plano"
      ?await query.delete().eq("clinica_id",selecionada.id).eq("funcionalidade_codigo",codigo)
      :await query.upsert({clinica_id:selecionada.id,funcionalidade_codigo:codigo,decisao},{onConflict:"clinica_id,funcionalidade_codigo"});
    setSalvandoExcecao(null);
    if(error)return toast.error("Não foi possível salvar autorização: "+error.message);
    setExcecoesClinica(prev=>({...prev,[codigo]:decisao==="plano"?"":decisao}));
    toast.success("Autorização da clínica atualizada.");
  }
  // A antiga tabela oricse_clinica_autorizacoes não é a fonte de verdade.
  // Exceções são editadas exclusivamente na matriz central de planos.
  const renderAutorizacoesClinica=()=> <Card>
    <h3 className="text-xl font-bold">Autorizações de {selecionada?.nome || "clínica"}</h3>
    <p className="mt-2 text-sm text-muted-foreground">
      Liberações e bloqueios especiais desta clínica devem ser configurados no
      Gerenciador Geral de Planos, na seção Exceções por clínica.
      A matriz é compartilhada por todos os administradores e aplicada na operação.
    </p>
    <Link to="/admin-planos" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
      <ShieldCheck size={17}/> Gerenciar autorizações no plano
    </Link>
  </Card>;

  async function carregarFuncionalidades() {
    const [recursos,permissoes]=await Promise.all([
      (supabase as any).from("oricse_funcionalidades").select("codigo,nome,grupo,ordem").eq("ativo",true).order("ordem"),
      (supabase as any).from("oricse_plano_funcionalidades").select("plano_id,funcionalidade_codigo,permitido")
    ]);
    if(recursos.error||permissoes.error){toast.error("Não foi possível carregar permissões dos planos.");return;}
    setFuncionalidades(recursos.data||[]);
    const mapa:Record<string,Record<string,boolean>>={};
    for(const p of permissoes.data||[]){(mapa[p.plano_id]??={})[p.funcionalidade_codigo]=p.permitido;}
    setPermissoesPlanos(mapa);
  }
  async function salvarPermissoesPlano(plano:Plano) {
    if(!plano.id)return toast.error("Salve o plano antes de configurar seus acessos.");
    setSalvandoPermissoes(plano.id);
    const dados=funcionalidades.map(f=>({plano_id:plano.id,funcionalidade_codigo:f.codigo,permitido:!!permissoesPlanos[plano.id!]?.[f.codigo]}));
    const {error}=await (supabase as any).from("oricse_plano_funcionalidades").upsert(dados,{onConflict:"plano_id,funcionalidade_codigo"});
    setSalvandoPermissoes(null);
    if(error)return toast.error("Erro ao salvar permissões: "+error.message);
    toast.success("Permissões do plano salvas.");
  }
  const renderMatrizPlano=(p:Plano)=> {
    const grupos = new Map<string, typeof funcionalidades>();
    for (const funcionalidade of funcionalidades) {
      const grupo = funcionalidade.grupo?.trim() || "Outros recursos";
      const chave = grupo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const nome = chave.includes("atividade") ? "Atividade" : chave.includes("recepc") ? "Recepção" : chave.includes("consult") ? "Consultório" : chave.includes("intern") ? "Internação" : chave.includes("caixa") || chave.includes("financ") ? "Caixa e financeiro" : chave.includes("estoque") ? "Estoque" : chave.includes("equipe") ? "Equipe" : chave.includes("crm") || chave.includes("relacion") ? "CRM e relacionamento" : chave.includes("admin") ? "Administração" : chave.includes("site") || chave.includes("portal") ? "Site e portal" : grupo;
      grupos.set(nome, [...(grupos.get(nome) || []), funcionalidade]);
    }
    const selecionadas = permissoesPlanos[p.id || ""] || {};
    const atualizarGrupo = (itens: typeof funcionalidades, permitido: boolean) => {
      if (!p.id) return;
      setPermissoesPlanos(old => ({
        ...old,
        [p.id!]: {
          ...old[p.id!],
          ...Object.fromEntries(itens.map(f => [f.codigo, permitido])),
        },
      }));
    };
    return <div className="mt-5 rounded-xl border bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h4 className="font-bold">Permissões reais do plano</h4><p className="text-xs text-muted-foreground">Recursos agrupados por módulo. Selecione um módulo inteiro ou escolha funções individuais. Somente recursos cadastrados e ativos aparecem aqui.</p></div>
        <button type="button" disabled={!p.id||salvandoPermissoes===p.id} onClick={()=>void salvarPermissoesPlano(p)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Salvar permissões</button>
      </div>
      <div className="mt-4 space-y-3">
        {Array.from(grupos.entries()).map(([grupo,itens]) => {
          const habilitadas = itens.filter(f => !!selecionadas[f.codigo]).length;
          const todas = habilitadas === itens.length;
          return <details key={grupo} className="group overflow-hidden rounded-xl border bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-90">▸</span><span className="font-semibold">Módulo {grupo}</span></span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-muted-foreground">{habilitadas} de {itens.length}</span>
                <label className="flex items-center gap-2 text-xs font-medium" onClick={e=>e.stopPropagation()}>
                  <input type="checkbox" disabled={!p.id} checked={todas} ref={element=>{if(element)element.indeterminate=habilitadas>0&&!todas;}} onChange={e=>atualizarGrupo(itens,e.target.checked)} aria-label={`Selecionar todas as funções de ${grupo}`}/>
                  Todas
                </label>
              </span>
            </summary>
            <div className="grid gap-2 border-t p-3 sm:grid-cols-2">
              {itens.map(f=><label key={f.codigo} className="flex items-start gap-2 rounded-lg border bg-slate-50 p-3 text-sm">
                <input type="checkbox" className="mt-1" disabled={!p.id} checked={!!(p.id&&selecionadas[f.codigo])} onChange={e=>{if(!p.id)return;setPermissoesPlanos(old=>({...old,[p.id!]:{...old[p.id!],[f.codigo]:e.target.checked}}));}}/>
                <span><span className="font-semibold">{f.nome}</span><span className="block text-xs text-muted-foreground">{f.codigo}</span></span>
              </label>)}
            </div>
          </details>;
        })}
        {grupos.size === 0 && <p className="rounded-lg border bg-white p-4 text-sm text-muted-foreground">Nenhuma funcionalidade ativa cadastrada. Verifique o catálogo de funcionalidades no banco de dados.</p>}
      </div>
    </div>;
  };

  // O catálogo de acessos tem um único editor oficial: /admin-planos.
  // O editor antigo desta aba concorria com a matriz e poderia sobrescrever
  // decisões recém-salvas por outro administrador.
  const renderPlanos = () => <Card>
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Planos e cupons</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Gerencie os planos, limites e autorizações de cada clínica. Os cupons e condições comerciais ficam disponíveis logo abaixo, no mesmo núcleo de gestão.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link to="/admin-planos"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">
          <BadgeDollarSign size={19}/> Abrir gerenciador geral de planos
        </Link>
        <Link to="/admin-cupons"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-background px-5 py-3 text-sm font-bold">
          <BadgeDollarSign size={19}/> Abrir gerenciador de cupons
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        Caminho: Admin Geral → Planos e cupons → Gerenciador geral ou Gerenciador de cupons.
        As clínicas visualizam seu próprio plano em Configurações → Meu plano.
      </p>
    </div>
  </Card>;

  const renderSite = () => <div className="space-y-5">
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><PanelsTopLeft size={20}/><h3 className="text-xl font-bold">Páginas do sistema · Editor visual</h3></div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Todas as páginas reais do ORICSE ficam aqui e em Páginas e URLs, usando o mesmo catálogo automático. Novas páginas criadas no código aparecem nas duas áreas assim que a atualização do sistema é publicada.</p>
        </div>
        <a href="/admin-canvas" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
          <PanelsTopLeft size={17}/> Abrir editor visual
        </a>
      </div>
      <div className="mt-5 flex flex-wrap gap-3 rounded-xl border bg-[#FBF8F6] p-4 text-sm">
        <div><strong className="text-lg">{ROTAS_CATALOGO.length}</strong><span className="ml-2 text-muted-foreground">páginas identificadas</span></div>
        <span className="hidden text-muted-foreground sm:inline">·</span>
        <span className="text-muted-foreground">Lista sincronizada com Páginas e URLs</span>
        <button type="button" onClick={()=>window.location.reload()} className="ml-auto inline-flex items-center gap-1 font-semibold text-[#703047] hover:underline"><RefreshCcw size={15}/> Atualizar lista</button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
        <label className="relative block">
          <Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-muted-foreground"/>
          <input value={buscaPaginasSite} onChange={e=>setBuscaPaginasSite(e.target.value)}
            aria-label="Pesquisar páginas do site e sistema" placeholder="Pesquisar por página, módulo ou endereço…"
            className="min-h-11 w-full rounded-xl border bg-white pl-10 pr-3 text-sm"/>
        </label>
        <select value={grupoPaginasSite} onChange={e=>setGrupoPaginasSite(e.target.value)}
          aria-label="Filtrar grupo de páginas" className="min-h-11 rounded-xl border bg-white px-3 text-sm">
          <option value="todas">Todas as áreas</option>
          {Array.from(new Set(ROTAS_CATALOGO.map(r=>r.grupo))).map(g=><option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div className="mt-5 max-h-[640px] space-y-2 overflow-y-auto pr-1">
        {ROTAS_CATALOGO.filter(r=>(grupoPaginasSite==="todas"||r.grupo===grupoPaginasSite) &&
          (!buscaPaginasSite.trim()||([r.nome,r.original,r.grupo].join(" ").toLocaleLowerCase("pt-BR")).includes(buscaPaginasSite.trim().toLocaleLowerCase("pt-BR"))))
          .map(r=><div key={r.original} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 hover:border-[#D6AEBE]">
            <div className="min-w-0">
              <p className="font-bold text-[#381724]">{r.nome}</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{r.original}</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.grupo}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {r.dinamica?<span className="rounded-lg border bg-slate-50 px-3 py-2 text-xs font-semibold text-muted-foreground">Link específico por clínica</span>:r.original==="/admin-canvas"?<span className="rounded-lg border bg-slate-50 px-3 py-2 text-xs font-semibold text-muted-foreground">Você já está no editor visual desta área</span>:<>
                <a href={r.original} target="_blank" rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold hover:bg-slate-50"><ExternalLink size={15}/> Abrir</a>
                <a href={"/admin-canvas?pagina="+encodeURIComponent(r.original)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#703047] px-3 text-xs font-bold text-white hover:bg-[#552037]">
                  <PanelsTopLeft size={15}/> Editar visualmente
                </a>
              </>}
            </div>
          </div>)}
        {!ROTAS_CATALOGO.some(r=>(grupoPaginasSite==="todas"||r.grupo===grupoPaginasSite) &&
          (!buscaPaginasSite.trim()||([r.nome,r.original,r.grupo].join(" ").toLocaleLowerCase("pt-BR")).includes(buscaPaginasSite.trim().toLocaleLowerCase("pt-BR"))))&&
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma página encontrada. Altere a pesquisa.</div>}
      </div>
      <div className="mt-5 border-t pt-4">
        <button type="button" onClick={()=>{setAba("paginas");void carregarRotas();}} className="inline-flex items-center gap-2 text-sm font-semibold text-[#703047] hover:underline"><Globe2 size={16}/> Gerenciar endereços em Páginas e URLs</button>
      </div>
    </Card>
<Card><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><Globe2 size={21}/><h2 className="text-xl font-bold">Site e marca</h2></div><p className="mt-1 text-sm text-muted-foreground">Textos gerais usados nas páginas públicas da Oricse.</p></div><button onClick={salvarSite} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground"><Save size={17}/> Salvar</button></div><div className="mt-5 grid gap-4"><label className="text-sm font-semibold">Marca<input value={site.marca} onChange={(e) => setSite({ ...site, marca: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label><label className="text-sm font-semibold">Título da página de planos<input value={site.titulo_planos} onChange={(e) => setSite({ ...site, titulo_planos: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label><label className="text-sm font-semibold">Subtítulo<textarea value={site.subtitulo_planos} onChange={(e) => setSite({ ...site, subtitulo_planos: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"/></label><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Texto do botão<input value={site.cta_plano} onChange={(e) => setSite({ ...site, cta_plano: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label><label className="text-sm font-semibold">Contato comercial<input value={site.contato} onChange={(e) => setSite({ ...site, contato: e.target.value })} placeholder="WhatsApp, e-mail ou link" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label></div></div></Card><Card><h3 className="font-bold">Logo usada no site</h3><div className="mt-4 flex flex-wrap items-center gap-5 rounded-xl bg-[#f6f4ef] p-4"><img src={logoPreview || site.logo_url || "/oricse-logo-oryx.svg?v=15"} alt="Oricse" className="max-h-32 max-w-[260px] object-contain"/><div className="flex flex-wrap gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-white px-4 py-2.5 font-semibold"><ImageUp size={17}/> Escolher logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => escolherLogo(e.target.files?.[0])}/></label><button disabled={!logoArquivo || salvandoLogo} onClick={salvarLogoSite} className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-50">Salvar logo</button><button onClick={restaurarLogoPadrao} className="rounded-xl border bg-white px-4 py-2.5 font-semibold">Restaurar padrão</button></div></div></Card>
</div>;

  // O catálogo é compartilhado com o resolvedor de URLs personalizadas:
  // páginas administrativas e endereços com parâmetro são somente leitura.
  async function carregarRotas() {
    setCarregandoRotas(true);
    try {
      const {data,error}=await (supabase as any)
        .from("oricse_rotas_personalizadas")
        .select("rota_original,rota_publica");
      if(error)throw error;
      const atuais=Object.fromEntries(ROTAS_EDITAVEIS.map(r=>[
        r.original,
        String(data?.find((d:any)=>d.rota_original===r.original)?.rota_publica||r.original)
      ]));
      setRotasEditadas(atuais);
      setRotasSalvas(atuais);
    } catch(error) {
      toast.error(error instanceof Error?error.message:"Não foi possível carregar as URLs.");
    } finally {
      setCarregandoRotas(false);
    }
  }

  async function salvarRota(original:string,valorForcado?:string) {
    const editavel=ROTAS_EDITAVEIS.some(r=>r.original===original);
    if(!editavel)return toast.error("Esta página tem endereço protegido e não pode ser alterada.");
    const nova=String(valorForcado??rotasEditadas[original]??original).trim().toLowerCase();
    if(!/^\/[a-z0-9-]{1,64}$/.test(nova))
      return toast.error("Use / seguido de 1 a 64 letras minúsculas, números ou hífens.");
    if(nova!==original&&CAMINHOS_RESERVADOS.has(nova))
      return toast.error("Esse endereço já pertence a uma página existente no sistema.");
    if(ROTAS_EDITAVEIS.some(r=>r.original!==original&&
       String(rotasEditadas[r.original]??rotasSalvas[r.original]??r.original).trim().toLowerCase()===nova))
      return toast.error("Esse endereço foi usado em outra página.");
    setSalvandoRotas(true);
    try {
      const {data:user,error:erroUser}=await supabase.auth.getUser();
      if(erroUser||!user.user?.id)throw new Error("Sua sessão expirou. Entre novamente no sistema.");
      const {error}=await (supabase as any).from("oricse_rotas_personalizadas")
        .upsert({rota_original:original,rota_publica:nova,atualizado_por:user.user.id},{onConflict:"rota_original"});
      if(error)throw error;
      setRotasEditadas(prev=>({...prev,[original]:nova}));
      setRotasSalvas(prev=>({...prev,[original]:nova}));
      toast.success(nova===original?"Endereço original restaurado.":"Novo endereço salvo para toda a plataforma.");
    }catch(error){
      toast.error(error instanceof Error?error.message:"Não foi possível salvar este endereço.");
    }finally{
      setSalvandoRotas(false);
    }
  }

  const gruposDisponiveis=Array.from(new Set(ROTAS_CATALOGO.map(r=>r.grupo)));
  const buscaNormalizada=buscaRotas.trim().toLocaleLowerCase("pt-BR");
  const rotasVisiveis=ROTAS_CATALOGO.filter(r=>
    (grupoRotas==="todas"||r.grupo===grupoRotas)&&
    (!somenteEditaveis||r.editavel)&&
    (!buscaNormalizada||([r.nome,r.original,r.grupo].join(" ").toLocaleLowerCase("pt-BR")).includes(buscaNormalizada))
  );
  const gruposVisiveis=gruposDisponiveis.filter(grupo=>rotasVisiveis.some(r=>r.grupo===grupo));

  const renderPaginas = () => <div className="space-y-5">
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Globe2 size={22}/><h2 className="text-2xl font-bold tracking-tight">Páginas e URLs</h2></div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Consulte todas as páginas do ORICSE e crie atalhos para as telas internas. O endereço original continua funcionando.
            A personalização é global, mas os dados e as permissões permanecem separados por clínica.
          </p>
        </div>
        <button type="button" onClick={()=>void carregarRotas()} disabled={carregandoRotas||salvandoRotas}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
          <RefreshCcw size={16} className={carregandoRotas?"animate-spin":""}/> Atualizar URLs
        </button>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-[#FBF8F6] p-4"><p className="text-xs text-muted-foreground">Páginas catalogadas</p><p className="mt-1 text-2xl font-black">{ROTAS_CATALOGO.length}</p></div>
        <div className="rounded-xl border bg-[#FBF8F6] p-4"><p className="text-xs text-muted-foreground">Com atalho editável</p><p className="mt-1 text-2xl font-black">{ROTAS_EDITAVEIS.length}</p></div>
        <div className="col-span-2 rounded-xl border bg-[#FBF8F6] p-4 sm:col-span-1"><p className="text-xs text-muted-foreground">Endereços personalizados</p><p className="mt-1 text-2xl font-black">{ROTAS_EDITAVEIS.filter(r=>(rotasSalvas[r.original]||r.original)!==r.original).length}</p></div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-center">
        <label className="relative block">
          <Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-muted-foreground"/>
          <input value={buscaRotas} onChange={e=>setBuscaRotas(e.target.value)}
            aria-label="Pesquisar páginas e URLs" placeholder="Buscar página, módulo ou endereço…"
            className="min-h-11 w-full rounded-xl border bg-white pl-10 pr-4 text-sm"/>
        </label>
        <select value={grupoRotas} onChange={e=>setGrupoRotas(e.target.value)}
          aria-label="Filtrar área do sistema" className="min-h-11 rounded-xl border bg-white px-3 text-sm">
          <option value="todas">Todas as áreas</option>
          {gruposDisponiveis.map(g=><option key={g} value={g}>{g}</option>)}
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={somenteEditaveis} onChange={e=>setSomenteEditaveis(e.target.checked)}
            className="h-4 w-4 accent-[#703047]"/> Apenas editáveis
        </label>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Mostrando {rotasVisiveis.length} página(s). URLs administrativas, públicas e com parâmetros específicos são exibidas para consulta, sem alteração de endereço.</p>
    </Card>
    {gruposVisiveis.map(grupo=><section key={grupo} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <header className="flex items-center justify-between gap-4 border-b bg-[#FBF8F6] px-5 py-4">
        <h3 className="font-bold text-[#381724]">{grupo}</h3>
        <span className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-muted-foreground">{rotasVisiveis.filter(r=>r.grupo===grupo).length} página(s)</span>
      </header>
      <div className="divide-y">
        {rotasVisiveis.filter(r=>r.grupo===grupo).map(r=>{
          const valor=rotasEditadas[r.original]??r.original;
          const salvo=rotasSalvas[r.original]??r.original;
          const mudou=valor.trim().toLowerCase()!==salvo;
          return <div key={r.original} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] lg:items-center">
            <div className="min-w-0">
              <p className="break-words font-bold">{r.nome}</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{r.original}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                {r.editavel?<span className="font-semibold text-emerald-700">Atalho personalizável</span>:<span className="font-semibold text-slate-500">{r.dinamica?"URL com identificador da clínica":"Endereço fixo"}</span>}
                {!r.dinamica&&<a href={r.editavel?salvo:r.original} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[#703047] hover:underline"><ExternalLink size={13}/> Abrir página</a>}
              </div>
            </div>
            {r.editavel?<div className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-xs font-semibold">
                Endereço personalizado
                <input value={valor} onChange={e=>setRotasEditadas(prev=>({...prev,[r.original]:e.target.value}))}
                  aria-label={"Endereço personalizado de "+r.nome}
                  spellCheck={false} maxLength={65} className="mt-1.5 min-h-11 w-full rounded-xl border bg-white px-3 font-mono text-sm"/>
              </label>
              <button type="button" disabled={salvandoRotas||carregandoRotas||!mudou} onClick={()=>void salvarRota(r.original)}
                className="min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-40">
                {salvandoRotas?"Salvando…":mudou?"Salvar":"Salvo"}
              </button>
              {salvo!==r.original&&<button type="button" disabled={salvandoRotas||carregandoRotas}
                onClick={()=>void salvarRota(r.original,r.original)}
                className="min-h-11 rounded-xl border px-3 text-xs font-semibold hover:bg-slate-50">Restaurar</button>}
            </div>:<div className="rounded-xl border border-dashed bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
              {r.dinamica?"O endereço é gerado para cada clínica ou profissional e não pode ser alterado globalmente.":"Endereço preservado para segurança, links públicos e integrações."}
            </div>}
          </div>
        })}
      </div>
    </section>)}
    {!rotasVisiveis.length&&<Card><p className="py-6 text-center text-sm text-muted-foreground">Nenhuma página corresponde aos filtros. Experimente outra busca.</p></Card>}
  </div>;

  const renderAuditoria = () => {
    const dominiosPendentes = dominiosClinica.filter((dominio) => ["rascunho", "aguardando_dns", "verificando", "erro", "suspenso"].includes(dominio.status));
    const clinicaComDominioPendente = clinicas.find((clinica) => clinica.id === dominiosPendentes[0]?.clinica_id);
    const emTeste = clinicas.filter((clinica) => clinica.status_financeiro === "teste").length;
    const emAtencao = clinicas.filter((clinica) => clinica.status_financeiro === "pendente" || clinica.status_financeiro === "atrasado").length;
    const usuariosSemClinica = usuarios.filter((usuario) => !vinculos.some((vinculo) => vinculo.user_id === usuario.user_id && vinculo.ativo)).length;
    const controles = [
      { titulo: "Abertura de clínicas", numero: solicitacoesEmAberto.length, descricao: "Contratações e testes que aguardam análise, preparação ou liberação.", acao: () => abrirPainel("novas"), botao: "Abrir fila" },
      { titulo: "Situação de contas", numero: emAtencao + emTeste, descricao: "Contas em atraso, pendentes ou em período de teste.", acao: () => abrirPainel("clinicas"), botao: "Revisar contas" },
      { titulo: "Domínios e publicação", numero: dominiosPendentes.length, descricao: "Endereços em rascunho, DNS, SSL, verificação ou erro.", acao: () => clinicaComDominioPendente ? abrirClinicaNoAdmin(clinicaComDominioPendente, "site") : abrirPainel("site"), botao: "Abrir domínios" },
      { titulo: "Vínculos de equipe", numero: usuariosSemClinica, descricao: "Usuários sem vínculo ativo com uma clínica.", acao: () => abrirPainel("clinicas"), botao: "Gerenciar equipe" },
    ];

    return <div className="space-y-5">
      <section className="rounded-2xl border border-primary/15 bg-[#fffaf7] p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Governança da plataforma</p>
        <h2 className="mt-1 text-2xl font-black">Controle e auditoria</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Centralize os pontos que exigem decisão administrativa. Os registros detalhados continuam nos módulos de clínicas, planos e financeiro; aqui você enxerga o que pode travar a operação.</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {controles.map(({ titulo, numero, descricao, acao, botao }) => <Card key={titulo}>
          <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{titulo}</p><p className="mt-2 text-3xl font-black">{numero}</p></div><ShieldCheck className={numero > 0 ? "text-primary" : "text-emerald-600"} size={22}/></div>
          <p className="mt-2 min-h-10 text-sm text-muted-foreground">{descricao}</p>
          <button type="button" onClick={acao} className="mt-4 text-sm font-bold text-primary hover:underline">{botao}</button>
        </Card>)}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Roteiro de liberação</p>
          <h3 className="mt-1 text-xl font-black">Antes de colocar uma clínica para funcionar</h3>
          <ol className="mt-5 space-y-4">
            <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground">1</span><span><strong>Confirme a contratação.</strong><span className="block text-sm text-muted-foreground">Verifique dados, plano e confirmação do pagamento ou período de teste.</span></span></li>
            <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground">2</span><span><strong>Prepare o espaço.</strong><span className="block text-sm text-muted-foreground">Crie a clínica bloqueada e revise plano, limites, usuários e marca.</span></span></li>
            <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground">3</span><span><strong>Revise os acessos.</strong><span className="block text-sm text-muted-foreground">Aplique o plano e confira autorizações especiais antes da liberação.</span></span></li>
            <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground">4</span><span><strong>Autorize o funcionamento.</strong><span className="block text-sm text-muted-foreground">Só então a clínica recebe acesso operacional ao ORICSE.</span></span></li>
          </ol>
        </Card>

        <Card>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Alçadas administrativas</p>
          <h3 className="mt-1 text-xl font-black">Onde cada controle é administrado</h3>
          <div className="mt-5 space-y-3 text-sm">
            <div className="rounded-xl border bg-slate-50 p-4"><p className="font-bold">Clínicas e usuários</p><p className="mt-1 text-muted-foreground">Dados cadastrais, situação da conta, equipe, Drive, site, domínios e autorizações.</p></div>
            <div className="rounded-xl border bg-slate-50 p-4"><p className="font-bold">Planos e acessos</p><p className="mt-1 text-muted-foreground">Limites, matriz de recursos e exceções individuais por clínica.</p></div>
            <div className="rounded-xl border bg-slate-50 p-4"><p className="font-bold">Financeiro da plataforma</p><p className="mt-1 text-muted-foreground">Taxas, comissões ORICSE, regras de repasse e simulador.</p></div>
            <div className="rounded-xl border bg-slate-50 p-4"><p className="font-bold">Produto e conteúdo</p><p className="mt-1 text-muted-foreground">Conteúdo público, marca, páginas, URLs e configuração dos sites.</p></div>
          </div>
        </Card>
      </div>
    </div>;
  };

  const renderSistema = () => {
    const dominiosComProblema = dominiosClinica.filter((dominio) => ["erro", "suspenso"].includes(dominio.status)).length;
    return <div className="space-y-5">
      <section className="rounded-2xl border border-primary/15 bg-[#fffaf7] p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Infraestrutura e catálogo</p>
        <h2 className="mt-1 text-2xl font-black">Sistema e integrações</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Acompanhe os cadastros administrativos que sustentam a plataforma. Configurações financeiras permanecem exclusivas do Admin Geral.</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><p className="text-sm text-muted-foreground">Clínicas cadastradas</p><p className="mt-1 text-3xl font-black">{clinicas.length}</p><p className="mt-1 text-xs text-muted-foreground">Base de clientes ORICSE</p></Card>
        <Card><p className="text-sm text-muted-foreground">Planos configurados</p><p className="mt-1 text-3xl font-black">{planos.length}</p><p className="mt-1 text-xs text-muted-foreground">Oferta comercial ativa e histórica</p></Card>
        <Card><p className="text-sm text-muted-foreground">Páginas catalogadas</p><p className="mt-1 text-3xl font-black">{ROTAS_CATALOGO.length}</p><p className="mt-1 text-xs text-muted-foreground">Rotas públicas e internas mapeadas</p></Card>
        <Card><p className="text-sm text-muted-foreground">Arquivos no Drive</p><p className="mt-1 text-3xl font-black">{arquivosDrive}</p><p className="mt-1 text-xs text-muted-foreground">Itens indexados na plataforma</p></Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Mapa operacional</p>
          <h3 className="mt-1 text-xl font-black">Áreas administradas por este painel</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => abrirPainel("novas")} className="rounded-xl border p-4 text-left hover:border-primary"><p className="font-bold">Entrada e ativação</p><p className="mt-1 text-sm text-muted-foreground">Contratações, testes e liberação de clínicas.</p></button>
            <button type="button" onClick={() => abrirPainel("clinicas")} className="rounded-xl border p-4 text-left hover:border-primary"><p className="font-bold">Clientes e equipe</p><p className="mt-1 text-sm text-muted-foreground">Contas, usuários, acessos, marca e domínio.</p></button>
            <button type="button" onClick={() => window.location.assign("/admin-planos")} className="rounded-xl border p-4 text-left hover:border-primary"><p className="font-bold">Oferta e permissões</p><p className="mt-1 text-sm text-muted-foreground">Planos, limites e matriz de funcionalidades.</p></button>
            <button type="button" onClick={() => abrirPainel("pagamentos")} className="rounded-xl border p-4 text-left hover:border-primary"><p className="font-bold">Financeiro</p><p className="mt-1 text-sm text-muted-foreground">Taxas, comissões, repasses e simulações.</p></button>
          </div>
        </Card>

        <Card>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Integridade administrativa</p>
          <h3 className="mt-1 text-xl font-black">Pontos para acompanhar</h3>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border bg-slate-50 p-4"><span><strong>Domínios com erro ou suspensos</strong><span className="mt-0.5 block text-sm text-muted-foreground">Exigem revisão de publicação, DNS ou SSL.</span></span><strong className={dominiosComProblema ? "text-primary" : "text-emerald-700"}>{dominiosComProblema}</strong></div>
            <div className="flex items-center justify-between gap-3 rounded-xl border bg-slate-50 p-4"><span><strong>Solicitações sem conclusão</strong><span className="mt-0.5 block text-sm text-muted-foreground">Entradas que ainda não foram autorizadas.</span></span><strong className={solicitacoesEmAberto.length ? "text-primary" : "text-emerald-700"}>{solicitacoesEmAberto.length}</strong></div>
            <div className="flex items-center justify-between gap-3 rounded-xl border bg-slate-50 p-4"><span><strong>Atualização administrativa</strong><span className="mt-0.5 block text-sm text-muted-foreground">Dados carregados nesta sessão.</span></span><strong className="text-sm">{dataHoraBR(ultimaAtualizacao)}</strong></div>
          </div>
          <button type="button" onClick={() => { void carregarTudo(); void carregarSolicitacoes(); }} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-bold hover:bg-slate-50"><RefreshCcw size={16}/> Atualizar informações</button>
        </Card>
      </div>
    </div>;
  };

  const renderPagamentos = () => (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Financeiro da plataforma</p>
        <h2 className="mt-1 text-2xl font-black">Financeiro, taxas e repasses</h2>
        <p className="mt-1 max-w-4xl text-sm text-muted-foreground">A taxa do Mercado Pago é descontada primeiro. A comissão ORICSE incide apenas sobre o saldo restante, por segmento, e o simulador mostra o líquido antes da cobrança.</p>
      </div>
      <PainelTaxasPagamento
        clinicas={clinicas}
        grade={gradeTaxas}
        salvando={salvandoTaxas}
        onSalvarTudo={async (clinicaId, modalidades, segmentos, comissoes) => {
          await salvarGradeTaxas(clinicaId, modalidades, segmentos);
          await salvarComissoesOricse(clinicaId, comissoes);
        }}
      />
    </div>
  );

  return (
    <main className="min-h-screen bg-[#f6f4ef] text-slate-900">
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
          <div className="flex items-center gap-3">
            <img src={site.logo_url || "/oricse-logo-oryx.svg?v=15"} alt="Oricse" className="h-14 w-14 object-contain"/>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">ORICSE ADMIN</p>
              <h1 className="text-2xl font-black sm:text-3xl">Central de gestão</h1>
              <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">Operação, aprovações e configuração da plataforma.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="min-w-[220px] rounded-xl border bg-white px-3 py-1.5 text-left">
              <span className="block text-[10px] font-black uppercase tracking-wide text-muted-foreground">Abrir uma clínica</span>
              <select value={selecionada?.id || ""} onChange={(event) => { const clinica = clinicas.find((item) => item.id === event.target.value) || null; setSelecionada(clinica); if (clinica) setAba("clinicas"); }} className="w-full bg-transparent text-sm font-bold outline-none">
                <option value="">Todas as clínicas ORICSE</option>
                {clinicas.map((clinica) => <option key={clinica.id} value={clinica.id}>{clinica.nome}</option>)}
              </select>
            </label>
            <a href="/inicio" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><PanelsTopLeft size={17}/> Sistema</a>
            <button type="button" onClick={sair} className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-bold hover:bg-slate-50"><LogOut size={17}/> Sair</button>
          </div>
        </header>

        <div className="mt-6 grid gap-6 xl:grid-cols-[270px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-4 xl:self-start">
            <nav aria-label="Navegação administrativa" className="rounded-2xl border bg-white p-3 shadow-sm">
              <div className="border-b px-2 pb-4 pt-1">
                <p className="text-sm font-black">Administração ORICSE</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Comece pelas clínicas novas e siga o fluxo de aprovação.</p>
              </div>

              {(["Operação", "Produto e conteúdo", "Controle"] as GrupoAba[]).map((grupo) => (
                <div key={grupo} className="mt-4">
                  <p className="px-2 text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">{grupo}</p>
                  <div className="mt-1 grid gap-1">
                    {ABAS.filter((item) => item.grupo === grupo).map(({ id, nome, icone: Icone, rota }) => {
                      const ativa = !rota && aba === id;
                      return <button key={id} type="button" onClick={() => {
                        if (rota) { window.location.assign(rota); return; }
                        abrirPainel(id as Aba);
                      }} aria-current={ativa ? "page" : undefined} className={"flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition " + (ativa ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-700 hover:bg-slate-100")}>
                        <Icone size={18}/>
                        <span className="min-w-0 flex-1">{nome}</span>
                        {id === "novas" && solicitacoesEmAberto.length > 0 && <span className={"rounded-full px-2 py-0.5 text-xs " + (ativa ? "bg-white/20 text-white" : "bg-primary/10 text-primary")}>{solicitacoesEmAberto.length}</span>}
                      </button>;
                    })}
                  </div>
                </div>
              ))}

              <button type="button" onClick={() => setAba("novas")} className="mt-5 flex w-full items-center gap-3 rounded-xl border border-primary/20 bg-[#fff8f4] p-3 text-left hover:bg-[#fff3eb]">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><ClipboardCheck size={18}/></span>
                <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-primary">Próxima ação</span><span className="block text-xs text-slate-600">Liberar clínicas prontas</span></span>
                <span className="rounded-full bg-white px-2 py-1 text-sm font-black text-primary">{solicitacoesProntas.length}</span>
              </button>
            </nav>
          </aside>

          <section className="min-w-0">
            {aba === "dashboard" && renderDashboard()}
            {aba === "novas" && renderClinicasNovas()}
            {aba === "lixeira" && renderLixeira()}
            {aba === "clinicas" && renderClinicas()}
            {aba === "planos" && renderPlanos()}
            {aba === "site" && renderSite()}
            {aba === "sistema" && renderSistema()}
            {aba === "paginas" && renderPaginas()}
            {aba === "pagamentos" && renderPagamentos()}
            {aba === "auditoria" && renderAuditoria()}
          </section>
        </div>
      </div>
      {renderNovaClinica()}
      {renderAutorizacaoCriacao()}
    </main>
  );
}

type TaxaModalidade = {
  id?: string; clinica_id?: string | null;
  modalidade: "pix" | "cartao_debito" | "cartao_credito" | "saldo_mercado_pago" | "boleto";
  prazo_recebimento_dias: number; parcelas: number; descricao: string; mp_percentual: number;
  mp_fixo_centavos: number; ativo: boolean; fonte: string; fonte_url?: string | null;
  referencia_verificada_em?: string | null; updated_at?: string;
};
type TaxaSegmento = {
  id?: string; clinica_id?: string | null;
  segmento: "clinica" | "banho_tosa" | "hotelzinho" | "pet_shop" | "portal_tutor";
  oricse_percentual: number; ativo: boolean; updated_at?: string;
};
type TaxaComissao = {
  id?: string; clinica_id?: string | null;
  segmento: TaxaSegmento["segmento"];
  modalidade: TaxaModalidade["modalidade"];
  prazo_recebimento_dias: number; parcelas: number;
  oricse_percentual: number; ativo: boolean; updated_at?: string;
};
const SEGMENTOS_TAXAS: Record<TaxaSegmento["segmento"], string> = {
  clinica: "Clínica veterinária", banho_tosa: "Banho e tosa", hotelzinho: "Hotelzinho", pet_shop: "Pet shop", portal_tutor: "Portal do Tutor",
};
const PRAZOS_TAXAS: Record<number, string> = { 0: "Na hora", 3: "Até 3 dias", 7: "Em 7 dias", 14: "Em 14 dias", 30: "Em 30 dias" };
const SEGMENTOS_DISPONIVEIS = Object.keys(SEGMENTOS_TAXAS) as TaxaSegmento["segmento"][];
function moedaCentavos(valor: number) { return (Math.max(0, valor) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function percentual(valor: number) { return Number(valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%"; }
function dataReferencia(valor?: string | null) {
  if (!valor) return "sem data";
  const data = new Date(valor.slice(0, 10) + "T12:00:00");
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleDateString("pt-BR");
}
function chaveTaxa(linha: Pick<TaxaModalidade, "modalidade" | "prazo_recebimento_dias" | "parcelas">) {
  return [linha.modalidade, linha.prazo_recebimento_dias, linha.parcelas].join(":");
}

function PainelTaxasPagamento({ clinicas, grade, salvando, onSalvarTudo }: {
  clinicas: Clinica[];
  grade: { modalidades: TaxaModalidade[]; segmentos: TaxaSegmento[]; comissoes: TaxaComissao[] };
  salvando: boolean;
  onSalvarTudo: (clinicaId: string | null, modalidades: TaxaModalidade[], segmentos: TaxaSegmento[], comissoes: TaxaComissao[]) => Promise<void>;
}) {
  const [clinicaId, setClinicaId] = useState<string>("");
  const [prazo, setPrazo] = useState(0);
  const [linhas, setLinhas] = useState<TaxaModalidade[]>([]);
  const [segmentosLegado, setSegmentosLegado] = useState<TaxaSegmento[]>([]);
  const [comissoes, setComissoes] = useState<TaxaComissao[]>([]);
  const [segmentosSelecionados, setSegmentosSelecionados] = useState<TaxaSegmento["segmento"][]>(SEGMENTOS_DISPONIVEIS);
  const [valorSimulacao, setValorSimulacao] = useState("100,00");
  const [chaveSimulacao, setChaveSimulacao] = useState("pix:0:1");
  const [segmentoSimulacao, setSegmentoSimulacao] = useState<TaxaSegmento["segmento"]>("clinica");
  const [modoTaxasSimulacao, setModoTaxasSimulacao] = useState<"reter" | "repassar">("reter");

  const globais = useMemo(() => grade.modalidades.filter((linha) => !linha.clinica_id), [grade.modalidades]);
  const segmentosGlobais = useMemo(() => grade.segmentos.filter((linha) => !linha.clinica_id), [grade.segmentos]);
  const comissoesGlobais = useMemo(() => grade.comissoes.filter((linha) => !linha.clinica_id), [grade.comissoes]);
  const temExcecao = useMemo(() => Boolean(clinicaId) && (
    grade.modalidades.some((linha) => linha.clinica_id === clinicaId)
    || grade.comissoes.some((linha) => linha.clinica_id === clinicaId)
  ), [clinicaId, grade.modalidades, grade.comissoes]);

  useEffect(() => {
    const excecoesModalidades = clinicaId ? grade.modalidades.filter((linha) => linha.clinica_id === clinicaId) : [];
    const excecoesSegmentos = clinicaId ? grade.segmentos.filter((linha) => linha.clinica_id === clinicaId) : [];
    const excecoesComissoes = clinicaId ? grade.comissoes.filter((linha) => linha.clinica_id === clinicaId) : [];
    setLinhas(globais.map((global) => ({
      ...(excecoesModalidades.find((linha) => chaveTaxa(linha) === chaveTaxa(global)) || global),
      clinica_id: clinicaId || null,
    })));
    setSegmentosLegado(segmentosGlobais.map((global) => ({
      ...(excecoesSegmentos.find((linha) => linha.segmento === global.segmento) || global),
      clinica_id: clinicaId || null,
    })));
    setComissoes(comissoesGlobais.map((global) => ({
      ...(excecoesComissoes.find((linha) => linha.segmento === global.segmento && chaveTaxa(linha) === chaveTaxa(global)) || global),
      clinica_id: clinicaId || null,
    })));
  }, [clinicaId, globais, segmentosGlobais, comissoesGlobais, grade.modalidades, grade.segmentos, grade.comissoes]);

  const linhasVisiveis = useMemo(() => linhas
    .filter((linha) => linha.modalidade !== "cartao_credito" || linha.prazo_recebimento_dias === prazo)
    .sort((a, b) => {
      const ordem: Record<string, number> = { pix: 1, cartao_debito: 2, cartao_credito: 3, saldo_mercado_pago: 4, boleto: 5 };
      if (ordem[a.modalidade] !== ordem[b.modalidade]) return ordem[a.modalidade] - ordem[b.modalidade];
      return a.parcelas - b.parcelas;
    }), [linhas, prazo]);

  useEffect(() => {
    if (!linhasVisiveis.some((linha) => chaveTaxa(linha) === chaveSimulacao)) {
      const primeira = linhasVisiveis[0] || { modalidade: "pix" as const, prazo_recebimento_dias: 0, parcelas: 1 };
      setChaveSimulacao(chaveTaxa(primeira));
    }
  }, [linhasVisiveis, chaveSimulacao]);

  const clinicaSelecionada = clinicas.find((clinica) => clinica.id === clinicaId);
  const linhaSimulada = linhas.find((linha) => chaveTaxa(linha) === chaveSimulacao) || linhasVisiveis[0];
  const comissaoSimulada = comissoes.find((linha) => linha.segmento === segmentoSimulacao && chaveTaxa(linha) === chaveSimulacao);
  const valorInformado = Math.round(Number(valorSimulacao.replace(/\./g, "").replace(",", ".")) * 100) || 0;
  const percentualMp = Number(linhaSimulada?.mp_percentual || 0) / 100;
  const fixoMp = Number(linhaSimulada?.mp_fixo_centavos || 0);
  const percentualOricse = comissaoSimulada?.ativo ? Number(comissaoSimulada.oricse_percentual || 0) / 100 : 0;
  const calcularTaxas = (valorCobrado: number) => {
    const mercadoPago = Math.min(valorCobrado, Math.round(valorCobrado * percentualMp) + fixoMp);
    const saldoAposMercadoPago = Math.max(0, valorCobrado - mercadoPago);
    const oricse = Math.round(saldoAposMercadoPago * percentualOricse);
    return { mercadoPago, oricse, liquido: Math.max(0, valorCobrado - mercadoPago - oricse) };
  };
  let valorCobradoTutor = valorInformado;
  if (modoTaxasSimulacao === "repassar" && valorInformado > 0) {
    valorCobradoTutor = Math.max(valorInformado, Math.ceil((valorInformado / Math.max(0.01, 1 - percentualOricse) + fixoMp) / Math.max(0.01, 1 - percentualMp)));
    while (calcularTaxas(valorCobradoTutor).liquido < valorInformado) valorCobradoTutor += 1;
  }
  const taxasCalculadas = calcularTaxas(valorCobradoTutor);
  const descontoMp = taxasCalculadas.mercadoPago;
  const comissaoOricse = taxasCalculadas.oricse;
  const liquido = taxasCalculadas.liquido;
  const taxaRepassada = Math.max(0, valorCobradoTutor - valorInformado);
  const taxaFinal = valorCobradoTutor > 0 ? ((descontoMp + comissaoOricse) / valorCobradoTutor) * 100 : 0;
  const referencia = globais.find((linha) => linha.fonte_url)?.referencia_verificada_em;
  const todosSelecionados = segmentosSelecionados.length === SEGMENTOS_DISPONIVEIS.length;

  function atualizarLinha(chave: string, campos: Partial<TaxaModalidade>) {
    setLinhas((atuais) => atuais.map((linha) => chaveTaxa(linha) === chave ? { ...linha, ...campos } : linha));
  }
  function atualizarComissaoEmLote(chave: string, campos: Partial<TaxaComissao>) {
    setComissoes((atuais) => atuais.map((linha) => (
      segmentosSelecionados.includes(linha.segmento) && chaveTaxa(linha) === chave
        ? { ...linha, ...campos }
        : linha
    )));
  }
  function alternarSegmento(segmento: TaxaSegmento["segmento"]) {
    setSegmentosSelecionados((atuais) => {
      if (atuais.includes(segmento)) return atuais.length === 1 ? atuais : atuais.filter((item) => item !== segmento);
      return [...atuais, segmento];
    });
  }
  function restaurarTudo() {
    setLinhas(globais.map((linha) => ({ ...linha, clinica_id: clinicaId || null })));
    setComissoes(comissoesGlobais.map((linha) => ({ ...linha, clinica_id: clinicaId || null })));
  }
  function regrasSelecionadas(chave: string) {
    return comissoes.filter((linha) => segmentosSelecionados.includes(linha.segmento) && chaveTaxa(linha) === chave);
  }
  function gruposAplicacao(chave: string) {
    const grupos = new Map<string, { percentual: number; ativo: boolean; segmentos: TaxaSegmento["segmento"][] }>();
    comissoes.filter((linha) => chaveTaxa(linha) === chave).forEach((linha) => {
      const id = [Number(linha.oricse_percentual).toFixed(4), linha.ativo ? "ativo" : "inativo"].join(":");
      const grupo = grupos.get(id) || { percentual: Number(linha.oricse_percentual), ativo: linha.ativo, segmentos: [] };
      grupo.segmentos.push(linha.segmento);
      grupos.set(id, grupo);
    });
    return Array.from(grupos.values()).sort((a, b) => b.segmentos.length - a.segmentos.length);
  }

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="grid gap-4 border-b bg-gradient-to-r from-[#fff8f3] to-white p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Pagamentos e repasses</p>
          <h3 className="mt-1 text-xl font-black">Uma configuração por forma de pagamento</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Em cada linha você vê a taxa de referência do Mercado Pago e define a comissão ORICSE. Escolha as áreas no topo antes de editar o percentual: o valor será aplicado somente nelas.</p>
        </div>
        <div className="rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm shadow-sm">
          <p className="font-bold">Referência pública Mercado Pago</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Conferida em {dataReferencia(referencia)} · Link / Checkout online</p>
          <a className="mt-2 inline-flex font-semibold text-primary underline underline-offset-2" href="https://www.mercadopago.com.br/ferramentas-para-vender/link-de-pagamento" target="_blank" rel="noreferrer">Ver fonte oficial</a>
        </div>
      </div>
      <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold">Aplicar para
            <select value={clinicaId} onChange={(event) => setClinicaId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 font-normal">
              <option value="">Todas as clínicas — tabela geral</option>
              {clinicas.map((clinica) => <option key={clinica.id} value={clinica.id}>{clinica.nome}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold">Prazo do crédito
            <select value={prazo} onChange={(event) => setPrazo(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 font-normal">
              <option value={0}>Receber na hora</option><option value={14}>Receber em 14 dias</option><option value={30}>Receber em 30 dias</option>
            </select>
          </label>
        </div>
        <div className="rounded-xl border bg-slate-50 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Condição aplicada</p>
          <p className="mt-1 font-bold">{clinicaSelecionada ? clinicaSelecionada.nome : "Tabela geral ORICSE"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{clinicaSelecionada ? (temExcecao ? "Condições próprias desta clínica" : "Sem exceção: herda a tabela geral") : "Base para todas as clínicas"}</p>
        </div>
      </div>
    </section>

    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Áreas aplicáveis</p>
          <h3 className="mt-1 text-lg font-black">Onde você quer mudar a comissão agora?</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Exemplo: marque <strong>Clínica veterinária</strong> e <strong>Hotelzinho</strong>; no PIX, preencha 8%. Depois marque as demais áreas e defina outro percentual no mesmo PIX.</p>
        </div>
        <button type="button" onClick={() => setSegmentosSelecionados(todosSelecionados ? [SEGMENTOS_DISPONIVEIS[0]] : SEGMENTOS_DISPONIVEIS)} className="rounded-lg border px-3 py-2 text-sm font-bold text-primary hover:bg-slate-50">{todosSelecionados ? "Deixar só Clínica" : "Selecionar todas"}</button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {SEGMENTOS_DISPONIVEIS.map((segmento) => {
          const ativo = segmentosSelecionados.includes(segmento);
          return <button key={segmento} type="button" onClick={() => alternarSegmento(segmento)} className={ativo ? "rounded-full bg-primary px-3 py-2 text-sm font-bold text-primary-foreground shadow-sm" : "rounded-full border bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:border-primary/40"}>{ativo ? "✓ " : ""}{SEGMENTOS_TAXAS[segmento]}</button>;
        })}
      </div>
    </section>

    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h3 className="font-black">Taxas e comissão por condição</h3><p className="mt-1 text-sm text-muted-foreground">A edição de Comissão ORICSE afeta apenas as áreas marcadas acima. A coluna ao lado mostra, com clareza, como cada regra ficará distribuída.</p></div>
        <button type="button" onClick={restaurarTudo} className="rounded-lg border px-3 py-2 text-sm font-bold hover:bg-slate-50">Restaurar valores salvos</button>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border">
        <table className="min-w-[1120px] w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr>
            <th className="px-4 py-3">Meio / condição</th><th className="px-4 py-3">Recebimento</th><th className="px-4 py-3">Mercado Pago</th><th className="px-4 py-3">Comissão ORICSE</th><th className="px-4 py-3">Áreas aplicáveis</th><th className="px-4 py-3">Ativa</th>
          </tr></thead>
          <tbody className="divide-y">{linhasVisiveis.map((linha) => {
            const chave = chaveTaxa(linha);
            const selecionadas = regrasSelecionadas(chave);
            const valores = selecionadas.map((regra) => Number(regra.oricse_percentual));
            const valorUnico = valores.length > 0 && valores.every((valor) => valor === valores[0]) ? valores[0] : null;
            const todasAtivas = selecionadas.length > 0 && selecionadas.every((regra) => regra.ativo);
            const ativas = selecionadas.filter((regra) => regra.ativo).length;
            const grupos = gruposAplicacao(chave);
            return <tr key={chave} className={!linha.ativo ? "bg-slate-50 text-slate-400" : ""}>
              <td className="px-4 py-3 align-top font-semibold">{linha.descricao}</td>
              <td className="px-4 py-3 align-top text-muted-foreground">{PRAZOS_TAXAS[linha.prazo_recebimento_dias]}</td>
              <td className="px-4 py-3 align-top">
                <div className="relative max-w-28"><input aria-label="Taxa Mercado Pago" type="number" min="0" max="99.99" step="0.01" value={linha.mp_percentual} onChange={(event) => atualizarLinha(chave, { mp_percentual: Number(event.target.value) })} className="min-h-10 w-full rounded-lg border px-3 pr-7 text-right font-bold"/><span className="absolute right-2 top-2.5 text-muted-foreground">%</span></div>
                <div className="relative mt-2 max-w-28"><span className="absolute left-2 top-2.5 text-xs text-muted-foreground">R$</span><input aria-label="Taxa fixa Mercado Pago" type="number" min="0" step="0.01" value={(Number(linha.mp_fixo_centavos || 0) / 100).toFixed(2)} onChange={(event) => atualizarLinha(chave, { mp_fixo_centavos: Math.round(Number(event.target.value || 0) * 100) })} className="min-h-10 w-full rounded-lg border px-3 pl-8 text-right font-bold"/></div>
                <span className="mt-2 inline-flex rounded-full bg-[#f9eee8] px-2 py-1 text-[11px] font-bold text-primary">{linha.fonte === "referencia_publica_mercado_pago" ? "Oficial MP" : "Condição própria"}</span>
              </td>
              <td className="px-4 py-3 align-top">
                <div className="relative max-w-36"><input aria-label="Comissão ORICSE" type="number" min="0" max="99.99" step="0.01" value={valorUnico ?? ""} placeholder={valorUnico === null ? "Valores diferentes" : ""} onChange={(event) => atualizarComissaoEmLote(chave, { oricse_percentual: Number(event.target.value || 0) })} className="min-h-10 w-full rounded-lg border px-3 pr-7 text-right font-black"/><span className="absolute right-2 top-2.5 text-muted-foreground">%</span></div>
                <p className="mt-2 max-w-40 text-xs leading-4 text-muted-foreground">Aplicar em: <strong>{segmentosSelecionados.map((segmento) => SEGMENTOS_TAXAS[segmento]).join(", ")}</strong></p>
              </td>
              <td className="px-4 py-3 align-top">
                <div className="flex max-w-md flex-wrap gap-1.5">{grupos.map((grupo) => <div key={[grupo.percentual,grupo.ativo,grupo.segmentos.join("-")].join(":")} className={grupo.ativo ? "rounded-lg border border-primary/15 bg-[#fff8f3] px-2 py-1.5" : "rounded-lg border bg-slate-50 px-2 py-1.5 opacity-60"}><span className="mr-1 text-xs font-black text-primary">{percentual(grupo.percentual)}</span>{grupo.segmentos.map((segmento) => <span key={segmento} className="mr-1 inline-block rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{SEGMENTOS_TAXAS[segmento]}</span>)}</div>)}</div>
              </td>
              <td className="px-4 py-3 align-top"><label className="flex items-center gap-2"><input aria-label="Comissão ativa" type="checkbox" checked={todasAtivas} onChange={(event) => atualizarComissaoEmLote(chave, { ativo: event.target.checked })} className="mt-1 h-4 w-4 accent-primary"/><span className="text-xs text-muted-foreground">{ativas}/{selecionadas.length} selecionadas</span></label></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-sm text-muted-foreground">{clinicaSelecionada ? (temExcecao ? "Você está editando uma condição exclusiva desta clínica." : "Ao salvar, será criada uma condição exclusiva para esta clínica.") : "Esta é a tabela padrão aplicada quando a clínica não possui exceção."}</p>
        <button type="button" disabled={salvando || !linhas.length || !comissoes.length} onClick={() => void onSalvarTudo(clinicaId || null, linhas, segmentosLegado, comissoes)} className="rounded-xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground disabled:opacity-50">{salvando ? "Salvando configuração..." : "Salvar configuração de pagamentos"}</button>
      </div>
    </section>

    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Como o cálculo funciona</p>
      <h3 className="mt-1 text-lg font-black">O provedor recebe primeiro; a ORICSE recebe sobre o saldo</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3"><span className="text-xs font-bold text-muted-foreground">1. Venda</span><p className="mt-1 font-black">Valor bruto</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><span className="text-xs font-bold text-muted-foreground">2. Mercado Pago</span><p className="mt-1 font-black">Taxa do meio</p></div>
        <div className="rounded-xl bg-[#fff4ef] p-3"><span className="text-xs font-bold text-primary">3. ORICSE</span><p className="mt-1 font-black">Comissão por área</p></div>
      </div>
    </section>

    <section className="rounded-2xl border-2 border-primary/15 bg-[#fffaf7] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Simulador de repasse</p>
          <h3 className="mt-1 text-xl font-black">Defina quem absorve as taxas</h3>
          <p className="mt-1 text-sm text-muted-foreground">Simule a cobrança final e o líquido da clínica antes de salvar a regra.</p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-black text-primary">{modoTaxasSimulacao === "reter" ? "Clínica absorve taxas" : "Tutor paga o repasse"}</span>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2" role="radiogroup" aria-label="Responsável pelas taxas">
        <button type="button" role="radio" aria-checked={modoTaxasSimulacao === "reter"} onClick={() => setModoTaxasSimulacao("reter")} className={`rounded-2xl border p-4 text-left transition ${modoTaxasSimulacao === "reter" ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-white hover:border-primary/40"}`}>
          <span className="block text-sm font-black">Reter as taxas</span>
          <span className={`mt-1 block text-sm ${modoTaxasSimulacao === "reter" ? "text-primary-foreground/85" : "text-muted-foreground"}`}>O tutor paga o valor informado. Mercado Pago e ORICSE são descontados do repasse da clínica.</span>
        </button>
        <button type="button" role="radio" aria-checked={modoTaxasSimulacao === "repassar"} onClick={() => setModoTaxasSimulacao("repassar")} className={`rounded-2xl border p-4 text-left transition ${modoTaxasSimulacao === "repassar" ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-white hover:border-primary/40"}`}>
          <span className="block text-sm font-black">Repassar as taxas</span>
          <span className={`mt-1 block text-sm ${modoTaxasSimulacao === "repassar" ? "text-primary-foreground/85" : "text-muted-foreground"}`}>A clínica define quanto quer receber; o sistema calcula o total que o tutor pagará.</span>
        </button>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)]">
        <div className="grid content-start gap-3">
          <label className="text-sm font-bold">{modoTaxasSimulacao === "reter" ? "Valor final do serviço" : "Valor líquido desejado pela clínica"}<input inputMode="decimal" value={valorSimulacao} onChange={(event) => setValorSimulacao(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 font-bold"/></label>
          <label className="text-sm font-bold">Como o cliente paga<select value={chaveSimulacao} onChange={(event) => setChaveSimulacao(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 font-normal">{linhasVisiveis.filter((linha) => linha.ativo).map((linha) => <option key={chaveTaxa(linha)} value={chaveTaxa(linha)}>{linha.descricao}</option>)}</select></label>
          <label className="text-sm font-bold">Área da venda<select value={segmentoSimulacao} onChange={(event) => setSegmentoSimulacao(event.target.value as TaxaSegmento["segmento"])} className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 font-normal">{SEGMENTOS_DISPONIVEIS.map((segmento) => <option key={segmento} value={segmento}>{SEGMENTOS_TAXAS[segmento]}</option>)}</select></label>
        </div>
        <dl className="space-y-2 rounded-2xl bg-white p-5 text-sm shadow-sm">
          <div className="flex justify-between gap-3"><dt>{modoTaxasSimulacao === "reter" ? "Valor final para o tutor" : "Líquido desejado pela clínica"}</dt><dd className="font-bold">{moedaCentavos(valorInformado)}</dd></div>
          <div className="flex justify-between gap-3"><dt>Tutor pagará</dt><dd className="font-black">{moedaCentavos(valorCobradoTutor)}</dd></div>
          {modoTaxasSimulacao === "repassar" && <div className="flex justify-between gap-3 rounded-lg bg-amber-50 px-2 py-1 text-amber-900"><dt>Repasse das taxas</dt><dd className="font-black">+ {moedaCentavos(taxaRepassada)}</dd></div>}
          <div className="flex justify-between gap-3"><dt>Mercado Pago ({percentual(linhaSimulada?.mp_percentual || 0)})</dt><dd className="font-bold text-rose-700">− {moedaCentavos(descontoMp)}</dd></div>
          <div className="flex justify-between gap-3"><dt>ORICSE ({percentual(comissaoSimulada?.oricse_percentual || 0)})</dt><dd className="font-bold text-rose-700">− {moedaCentavos(comissaoOricse)}</dd></div>
          <div className="mt-2 flex justify-between gap-3 border-t pt-3 text-base"><dt className="font-black">Líquido da clínica</dt><dd className="font-black text-emerald-700">{moedaCentavos(liquido)}</dd></div>
          <div className="flex justify-between gap-3 text-xs text-muted-foreground"><dt>Taxa efetiva final</dt><dd className="font-bold">{percentual(taxaFinal)}</dd></div>
        </dl>
      </div>
    </section>
  </div>;
}

