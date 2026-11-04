/**
 * Catálogo de páginas da plataforma ORICSE.
 * Endereços variáveis e páginas sensíveis são exibidos para consulta, sem renomeação global.
 * As URLs personalizadas de telas internas são atalhos: a autenticação e permissões seguem intactas.
 */
export type PaginaOricse = {
  original: string;
  nome: string;
  grupo: string;
  editavel: boolean;
  dinamica: boolean;
};

const ROTAS_CADASTRADAS: readonly PaginaOricse[] = [
  {
    "original": "/",
    "nome": "Página inicial do site",
    "grupo": "Site público",
    "editavel": false,
    "dinamica": false
  },
  {
    "original": "/planos",
    "nome": "Planos e preços",
    "grupo": "Site público",
    "editavel": false,
    "dinamica": false
  },
  {
    "original": "/contratar",
    "nome": "Contratação de planos",
    "grupo": "Site público",
    "editavel": false,
    "dinamica": false
  },
  {
    "original": "/contratacao-recebida",
    "nome": "Confirmação de contratação",
    "grupo": "Site público",
    "editavel": false,
    "dinamica": false
  },
  {
    "original": "/termos-de-uso",
    "nome": "Termos de Uso",
    "grupo": "Site público",
    "editavel": false,
    "dinamica": false
  },
  {
    "original": "/politica-de-privacidade",
    "nome": "Política de Privacidade",
    "grupo": "Site público",
    "editavel": false,
    "dinamica": false
  },
  {
    "original": "/login",
    "nome": "Entrar no sistema",
    "grupo": "Site público",
    "editavel": false,
    "dinamica": false
  },
  {
    "original": "/assinar",
    "nome": "Assinatura",
    "grupo": "Site público",
    "editavel": false,
    "dinamica": false
  },
  {
    "original": "/termos",
    "nome": "Termos (endereço legado)",
    "grupo": "Site público",
    "editavel": false,
    "dinamica": false
  },
  {
    "original": "/privacidade",
    "nome": "Privacidade (endereço legado)",
    "grupo": "Site público",
    "editavel": false,
    "dinamica": false
  },
  {
    "original": "/admin",
    "nome": "Painel administrativo",
    "grupo": "Administração ORICSE",
    "editavel": false,
    "dinamica": false
  },
  {
    "original": "/admin-cupons",
    "nome": "Gerenciador de cupons",
    "grupo": "Administração ORICSE",
    "editavel": false,
    "dinamica": false
  },
  {
    "original": "/admin-planos",
    "nome": "Administração de planos",
    "grupo": "Administração ORICSE",
    "editavel": false,
    "dinamica": false
  },
  {
    "original": "/admin-solicitacoes",
    "nome": "Solicitações de contratação",
    "grupo": "Administração ORICSE",
    "editavel": false,
    "dinamica": false
  },
  {
    "original": "/admin-conteudo",
    "nome": "Conteúdo e páginas",
    "grupo": "Administração ORICSE",
    "editavel": false,
    "dinamica": false
  },
  {
    "original": "/admin-canvas",
    "nome": "Editor visual",
    "grupo": "Administração ORICSE",
    "editavel": false,
    "dinamica": false
  },
  {
    "original": "/inicio",
    "nome": "Painel inicial",
    "grupo": "Painel e recepção",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/recepcao",
    "nome": "Recepção",
    "grupo": "Painel e recepção",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/fila-espera",
    "nome": "Fila de espera",
    "grupo": "Painel e recepção",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/tutores",
    "nome": "Tutores",
    "grupo": "Painel e recepção",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/animais",
    "nome": "Animais",
    "grupo": "Painel e recepção",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/novo-animal",
    "nome": "Novo animal",
    "grupo": "Painel e recepção",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/animal",
    "nome": "Ficha do animal",
    "grupo": "Painel e recepção",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/encaminhar",
    "nome": "Encaminhar atendimento",
    "grupo": "Painel e recepção",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/todas-agendas",
    "nome": "Todas as agendas",
    "grupo": "Painel e recepção",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/consultorio",
    "nome": "Consultório",
    "grupo": "Clínica veterinária",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/consulta",
    "nome": "Consulta veterinária",
    "grupo": "Clínica veterinária",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/anamnese",
    "nome": "Anamnese",
    "grupo": "Clínica veterinária",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/registro-clinico",
    "nome": "Registro clínico",
    "grupo": "Clínica veterinária",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/registros",
    "nome": "Registros clínicos",
    "grupo": "Clínica veterinária",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/internacao",
    "nome": "Internação",
    "grupo": "Clínica veterinária",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/medicacoes",
    "nome": "Medicações",
    "grupo": "Clínica veterinária",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/horarios-medicacoes",
    "nome": "Horários das medicações",
    "grupo": "Clínica veterinária",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/receituario",
    "nome": "Receituário",
    "grupo": "Clínica veterinária",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/curva",
    "nome": "Curvas e acompanhamento",
    "grupo": "Clínica veterinária",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/hotelzinho",
    "nome": "Hotelzinho",
    "grupo": "Hotelzinho e banho e tosa",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/agenda-hotel",
    "nome": "Agenda do hotelzinho",
    "grupo": "Hotelzinho e banho e tosa",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/banho-tosa",
    "nome": "Banho e tosa",
    "grupo": "Hotelzinho e banho e tosa",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/comandas",
    "nome": "Comandas",
    "grupo": "Financeiro e estoque",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/financeiro",
    "nome": "Financeiro",
    "grupo": "Financeiro e estoque",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/estoque",
    "nome": "Serviços, produtos e estoque",
    "grupo": "Financeiro e estoque",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/catalogo",
    "nome": "Catálogo",
    "grupo": "Financeiro e estoque",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/simulador-pagamentos",
    "nome": "Simulador de pagamentos",
    "grupo": "Financeiro e estoque",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/portal-tutores",
    "nome": "Gestão do Portal do Tutor",
    "grupo": "Portal do Tutor e CRM",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/configurar-portal-tutor",
    "nome": "Configurações do Portal do Tutor",
    "grupo": "Portal do Tutor e CRM",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/configurar-agenda-online",
    "nome": "Agenda online",
    "grupo": "Portal do Tutor e CRM",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/precos-portal",
    "nome": "Preços do Portal do Tutor",
    "grupo": "Portal do Tutor e CRM",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/configurar-pagamentos",
    "nome": "Configuração de pagamentos",
    "grupo": "Portal do Tutor e CRM",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/mercado-pago-clinica",
    "nome": "Mercado Pago da clínica",
    "grupo": "Portal do Tutor e CRM",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/crm",
    "nome": "CRM e campanhas",
    "grupo": "Portal do Tutor e CRM",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/configuracao-site",
    "nome": "Configuração do site da clínica",
    "grupo": "Portal do Tutor e CRM",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/minha-atividade",
    "nome": "Minha atividade",
    "grupo": "Equipe e configurações",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/banco-horas",
    "nome": "Banco de horas",
    "grupo": "Equipe e configurações",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/rh",
    "nome": "Recursos humanos",
    "grupo": "Equipe e configurações",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/plantoes",
    "nome": "Plantões",
    "grupo": "Equipe e configurações",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/alarmes",
    "nome": "Alarmes",
    "grupo": "Equipe e configurações",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/pendencias",
    "nome": "Pendências",
    "grupo": "Equipe e configurações",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/perfil-clinica",
    "nome": "Perfil da clínica",
    "grupo": "Equipe e configurações",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/plano-clinica",
    "nome": "Plano da clínica",
    "grupo": "Equipe e configurações",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/permissoes-equipe",
    "nome": "Permissões da equipe",
    "grupo": "Equipe e configurações",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/temas",
    "nome": "Temas e aparência",
    "grupo": "Equipe e configurações",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/sincronizacao",
    "nome": "Sincronização",
    "grupo": "Equipe e configurações",
    "editavel": true,
    "dinamica": false
  },
  {
    "original": "/pet/:slug/portal",
    "nome": "Portal do Tutor por clínica",
    "grupo": "Links por estabelecimento",
    "editavel": false,
    "dinamica": true
  },
  {
    "original": "/vet/:slug",
    "nome": "Site do veterinário por clínica",
    "grupo": "Links por estabelecimento",
    "editavel": false,
    "dinamica": true
  },
  {
    "original": "/:tipo/:slug",
    "nome": "Página pública por serviço",
    "grupo": "Links por estabelecimento",
    "editavel": false,
    "dinamica": true
  }
];

/**
 * Descoberta automática no build: Vite encontra os arquivos de rotas sem
 * precisar importar seus componentes nem executar código de páginas.
 * Uma página .tsx nova aparecerá no editor e em Páginas e URLs no mesmo deploy.
 * Metadados humanos são preservados para as páginas já conhecidas.
 */
const arquivosDeRotas = import.meta.glob("../routes/**/*.{ts,tsx}");

function caminhoDoArquivo(arquivo: string): string | null {
  let relativo = arquivo.replace(/^\.\.\/routes\//, "").replace(/\.(tsx|ts)$/, "");
  if (relativo === "__root" || relativo === "$alias" ||
      relativo.startsWith("api/") || relativo.startsWith("-")) return null;
  relativo = relativo.replace(/\/index$/, "").replace(/\./g, "/");
  if (relativo === "index") return "/";
  return "/" + relativo.split("/").map(parte =>
    parte.startsWith("$") ? ":" + parte.slice(1) : parte
  ).join("/");
}

function textoLegivel(caminho: string): string {
  if (caminho === "/") return "Página inicial";
  const parte = caminho.split("/").filter(Boolean).filter(x => !x.startsWith(":")).at(-1) || caminho;
  return parte.split("-").map(p => p ? p[0].toLocaleUpperCase("pt-BR") + p.slice(1) : "").join(" ");
}

function metadadosNovos(original: string): PaginaOricse {
  const dinamica = original.includes(":");
  const administrativa = /^\/admin(?:-|\/|$)/.test(original);
  const portal = /^\/(?:pet|vet)\//.test(original);
  const publica = ["/", "/login", "/planos", "/contratar", "/contratacao-recebida",
    "/termos-de-uso", "/politica-de-privacidade", "/assinar", "/termos", "/privacidade"].includes(original);
  return {
    original,
    nome: textoLegivel(original),
    grupo: dinamica || portal ? "Links por estabelecimento" :
      administrativa ? "Administração ORICSE" :
      publica ? "Site público" : "Novas páginas",
    editavel: !dinamica && !administrativa && !publica,
    dinamica
  };
}

const cadastroPorRota = new Map(ROTAS_CADASTRADAS.map(p => [p.original, p]));
const rotasDescobertas = Array.from(new Set(
  Object.keys(arquivosDeRotas).map(caminhoDoArquivo).filter((p): p is string => Boolean(p))
));
export const ROTAS_CATALOGO: readonly PaginaOricse[] = rotasDescobertas
  .map(original => cadastroPorRota.get(original) || metadadosNovos(original))
  .sort((a,b) => {
    const ia = ROTAS_CADASTRADAS.findIndex(r => r.original === a.original);
    const ib = ROTAS_CADASTRADAS.findIndex(r => r.original === b.original);
    return ia !== -1 && ib !== -1 ? ia - ib :
      ia !== -1 ? -1 : ib !== -1 ? 1 : a.original.localeCompare(b.original,"pt-BR");
  });

export const ROTAS_EDITAVEIS = ROTAS_CATALOGO.filter((r) => r.editavel);
export const ORIGINAIS_EDITAVEIS = new Set(ROTAS_EDITAVEIS.map((r) => r.original));
export const CAMINHOS_RESERVADOS = new Set([
  ...ROTAS_CATALOGO.map((r) => r.original),
  "/api", "/pet", "/vet", "/admin", "/admin-canvas", "/admin-cupons", "/admin-planos",
  "/admin-conteudo", "/admin-solicitacoes", "/configuracoes"
]);
