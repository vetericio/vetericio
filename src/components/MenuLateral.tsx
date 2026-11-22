import { urlPortalDoTutor } from "@/lib/portal-tutor-url";
import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import {
  BarChart3,
  BedDouble,
  CalendarCheck,
  ChevronDown,
  Clock3,
  Lock,
  Instagram,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Scissors,
  Search,
  Settings,
  ShoppingCart,
  Stethoscope,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DialogoTurno } from "@/components/DialogoTurno";
import { usePlantaoAtual } from "@/hooks/usePlantaoAtual";
import { permissoesDaRota, usePermissoes } from "@/hooks/usePermissoes";
import { CRM_EM_PREPARACAO, ORICSTUDIO_EM_PREPARACAO, SO_COM_PLANTAO } from "@/lib/navegacao";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { obterAutorClinico } from "@/lib/perfil-clinico";

type MenuRoute =
  | "/recepcao"
  | "/busca-inteligente"
  | "/todas-agendas"
  | "/hotelzinho"
  | "/agenda-hotel"
  | "/banho-tosa"
  | "/horarios-medicacoes"
  | "/configurar-agenda-online"
  | "/tutores"
  | "/animais"
  | "/consultorio"
  | "/assinar"
  | "/receituario"
  | "/medicacoes"
  | "/internacao"
  | "/registros"
  | "/anamnese"
  | "/curva"
  | "/alarmes"
  | "/pendencias"
  | "/plantoes"
  | "/crm"
  | "/oricstudio"
  | "/venda-expressa"
  | "/orcamento-venda-expressa"
  | "/financeiro"
  | "/comandas"
  | "/estoque"
  | "/rh"
  | "/minha-atividade"
  | "/banco-horas"
  | "/perfil-clinica"
  | "/migracao-assistida"
  | "/plano-clinica"
  | "/permissoes-equipe"
  | "/portal-tutores"
  | "/temas";

type ItemMenu = {
  to?: MenuRoute;
  rotulo: string;
  descricao?: string;
  destaque?: "venda" | "orcamento";
  permissao?: string;
  emBreve?: boolean;
  moduloEmPreparacao?: boolean;
  portalOficial?: boolean;
  abaHotel?: string;
  separador?: "consultorio" | "internacao" | "trabalho" | "comissoes";
  grupoRh?: "trabalho" | "comissoes";
};

type AreaMenu = {
  titulo: string;
  icone: typeof CalendarCheck;
  emPreparacao?: boolean;
  itens: ItemMenu[];
};

const areas: AreaMenu[] = [
  {
    titulo: "Recepção",
    icone: CalendarCheck,
    itens: [
      { to: "/recepcao", rotulo: "Painel da recepção", permissao: "recepcao.agenda" },
      { to: "/todas-agendas", rotulo: "Todas as agendas", permissao: "recepcao.agenda" },
    ],
  },
  {
    titulo: "Busca Inteligente",
    icone: Search,
    itens: [
      { to: "/busca-inteligente", rotulo: "Buscar tutor ou animal", permissao: "recepcao.cadastros.visualizar" },
    ],
  },
  {
    titulo: "Clínica veterinária",
    icone: Stethoscope,
    itens: [
      { rotulo: "Consultório", separador: "consultorio" },
      {
        to: "/consultorio",
        rotulo: "Consultas e prontuários",
        permissao: "consultorio.atendimentos",
      },
      { to: "/animais", rotulo: "Pesquisar animais", permissao: "consultorio.atendimentos" },
      { to: "/assinar", rotulo: "Assinar documento", permissao: "consultorio.receituario" },
      { to: "/receituario", rotulo: "Receituário", permissao: "consultorio.receituario" },
      { to: "/medicacoes", rotulo: "Medicações", permissao: "consultorio.medicacoes" },
      { rotulo: "Internação", separador: "internacao" },
      { to: "/internacao", rotulo: "Painel de internação", permissao: "internacao.painel" },
      { to: "/registros", rotulo: "Animais internados", permissao: "internacao.painel" },
      { to: "/anamnese", rotulo: "Anamnese", permissao: "internacao.registrar" },
      { to: "/curva", rotulo: "Curvas e parâmetros", permissao: "internacao.registrar" },
      { to: "/horarios-medicacoes", rotulo: "Horários das medicações", permissao: "internacao.medicacoes" },
      { to: "/alarmes", rotulo: "Alarmes", permissao: "internacao.registrar" },
      { to: "/pendencias", rotulo: "Pendências", permissao: "internacao.registrar" },
      { to: "/plantoes", rotulo: "Histórico de plantões", permissao: "internacao.plantoes" },
    ],
  },
  {
    titulo: "Hotelzinho",
    icone: BedDouble,
    itens: [
      { to: "/hotelzinho", abaHotel: "painel", rotulo: "Painel do hotel", permissao: "hotelzinho.visualizar" },
      { to: "/agenda-hotel", rotulo: "Agenda do hotel", permissao: "hotelzinho.visualizar" },
      { to: "/hotelzinho", abaHotel: "reservas", rotulo: "Reservas", permissao: "hotelzinho.visualizar" },
      { to: "/hotelzinho", abaHotel: "checkin", rotulo: "Check-in", permissao: "hotelzinho.visualizar" },
      { to: "/hotelzinho", abaHotel: "hospedes", rotulo: "Hóspedes ativos", permissao: "hotelzinho.visualizar" },
      { to: "/hotelzinho", abaHotel: "cuidados", rotulo: "Rotina e cuidados", permissao: "hotelzinho.visualizar" },
      { to: "/hotelzinho", abaHotel: "extras", rotulo: "Acrescentar item à estadia", permissao: "hotelzinho.visualizar" },
      { to: "/hotelzinho", abaHotel: "tutores", rotulo: "Atualizações para tutores", permissao: "hotelzinho.visualizar" },
      { to: "/hotelzinho", abaHotel: "checkout", rotulo: "Check-out", permissao: "hotelzinho.visualizar" },
      { to: "/hotelzinho", abaHotel: "acomodacoes", rotulo: "Acomodações", permissao: "hotelzinho.visualizar" },
    ],
  },
  {
    titulo: "Banho e tosa",
    icone: Scissors,
    itens: [
      {to:"/banho-tosa",abaHotel:"painel",rotulo:"Painel do banho e tosa",permissao:"hotelzinho.visualizar"},
      {to:"/banho-tosa",abaHotel:"agenda",rotulo:"Agenda",permissao:"hotelzinho.visualizar"},
      {to:"/banho-tosa",abaHotel:"fila",rotulo:"Fila de serviços",permissao:"hotelzinho.visualizar"},
      {to:"/banho-tosa",abaHotel:"historico",rotulo:"Histórico",permissao:"hotelzinho.visualizar"},
    ],
  },
  {
    titulo: "Gestão de clientes",
    icone: Users,
    emPreparacao: CRM_EM_PREPARACAO,
    itens: [
      { to: "/crm", rotulo: "Retornos, cuidados e campanhas", permissao: "crm.visualizar" },
    ],
  },
  {
    titulo: "Financeiro",
    icone: Wallet,
    itens: [
      { to: "/financeiro", rotulo: "Painel financeiro", permissao: "caixa.financeiro.visualizar" },
      { to: "/comandas", rotulo: "Comandas", permissao: "caixa.comandas" },
    ],
  },
  {
    titulo: "Estoque e produtos",
    icone: Package,
    itens: [
      { to: "/estoque", rotulo: "Produtos e estoque", permissao: "estoque.catalogo.visualizar" },
    ],
  },
  {
    titulo: "Venda Expressa",
    icone: ShoppingCart,
    itens: [
      {
        to: "/venda-expressa",
        rotulo: "Abrir PDV (Fazer venda)",
        descricao: "Registra a venda no caixa e baixa o estoque.",
        destaque: "venda",
        permissao: "caixa.comandas",
      },
      {
        to: "/orcamento-venda-expressa",
        rotulo: "Fazer orçamento (Não faz vendas)",
        descricao: "Não registra no caixa e não baixa o estoque.",
        destaque: "orcamento",
        permissao: "caixa.comandas",
      },
    ],
  },
  {
    titulo: "Meu OricStúdio",
    icone: Instagram,
    emPreparacao: ORICSTUDIO_EM_PREPARACAO,
    itens: [{ to: "/oricstudio", rotulo: "Gestão de redes sociais" }],
  },
  {
    titulo: "Relatórios",
    icone: BarChart3,
    itens: [{ rotulo: "Módulo em preparação", emBreve: true }],
  },
  {
    titulo: "RH",
    icone: Clock3,
    itens: [
      { rotulo: "Trabalho", separador: "trabalho" },
      { to: "/minha-atividade", rotulo: "Check-in / check-out", permissao: "atividade.ponto", grupoRh: "trabalho" },
      { to: "/banco-horas", rotulo: "Minhas horas e diárias", permissao: "atividade.ponto", grupoRh: "trabalho" },
      { to: "/rh", abaHotel: "pagamentos", rotulo: "Jornada", permissao: "equipe.pagamentos.visualizar", grupoRh: "trabalho" },
      { rotulo: "Comissões", separador: "comissoes" },
      { to: "/rh", abaHotel: "comissoes", rotulo: "Comissões da equipe", permissao: "equipe.pagamentos.visualizar", grupoRh: "comissoes" },
      { to: "/rh", abaHotel: "equipe", rotulo: "Comissões por colaborador", permissao: "equipe.pagamentos.visualizar", grupoRh: "comissoes" },
    ],
  },
  {
    titulo: "Configurações",
    icone: Settings,
    itens: [
      {
        to: "/perfil-clinica",
        rotulo: "Configurações da clínica",
        permissao: "administracao.configuracoes",
      },
      {
        to: "/migracao-assistida",
        rotulo: "Migração Assistida",
        permissao: "administracao.configuracoes",
      },
      {
        to: "/plano-clinica",
        rotulo: "Meu plano e funcionalidades",
        permissao: "administracao.configuracoes",
      },
      {
        to: "/permissoes-equipe",
        rotulo: "Permissões da equipe",
        permissao: "administracao.permissoes",
      },
      {
        to: "/portal-tutores",
        rotulo: "Acesso ao Portal do Tutor",
        permissao: "portal_tutor.gerenciar",
      },
      {
        portalOficial: true,
        rotulo: "Portal do Tutor",
        permissao: "administracao.site",
      },
      { to: "/temas", rotulo: "Temas", permissao: "administracao.temas" },
      {
        rotulo: "Assinatura ICP-Brasil",
        permissao: "administracao.configuracoes",
        emBreve: true,
        moduloEmPreparacao: true,
      },
      {
        rotulo: "Módulo Fiscal",
        permissao: "administracao.configuracoes",
        emBreve: true,
        moduloEmPreparacao: true,
      },
      {
        rotulo: "Programa de Fidelidade",
        permissao: "administracao.configuracoes",
        emBreve: true,
        moduloEmPreparacao: true,
      },
    ],
  },
];

// As quatro áreas principais ficam visíveis. As demais mantêm todos os
// mesmos links e permissões, mas são agrupadas em "Mais opções".
const ordemPrincipal = ["Recepção", "Busca Inteligente", "Clínica veterinária", "Banho e tosa", "Hotelzinho", "Venda Expressa", "Meu OricStúdio"];
const titulosPrincipais = new Set(ordemPrincipal);
const areasPrincipais = ordemPrincipal.map((titulo) => areas.find((area) => area.titulo === titulo)!)
  .filter(Boolean);
const areasOpcionais = areas.filter((area) => !titulosPrincipais.has(area.titulo));

export function MenuLateral({
  fixo,
  aoMudarFixo,
}: {
  fixo: boolean;
  aoMudarFixo: (fixo: boolean) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [expandido, setExpandido] = useState<string | null>("Recepção");
  const [maisOpcoesAberto, setMaisOpcoesAberto] = useState(false);
  const [turnoAberto, setTurnoAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [profissional, setProfissional] = useState<{ id: string; nome: string } | null>(null);
  const { plantao } = usePlantaoAtual();
  const {
    carregando: carregandoPermissoes,
    pode,
    podeAlguma,
    bloqueadaPeloPlano,
    adminGlobal,
    clinicaNome,
    clinicaSlug,
    usuarioId,
  } = usePermissoes();
  const podeGerenciarPlantao = carregandoPermissoes || pode("internacao.plantoes");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!usuarioId) return;
    let ativo = true;
    void obterAutorClinico().then(({ id, nome }) => {
      if (ativo && id === usuarioId) setProfissional({ id, nome });
    }).catch(() => {
      if (ativo) setProfissional(null);
    });
    return () => { ativo = false; };
  }, [usuarioId]);

  useEffect(() => {
    if (areasOpcionais.some((area) => area.itens.some((item) => item.to === location.pathname))) {
      setMaisOpcoesAberto(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (carregandoPermissoes) return;
    const exigidas = permissoesDaRota(location.pathname);
    if (!exigidas || podeAlguma(exigidas)) return;
    const plano = exigidas.some((codigo) => bloqueadaPeloPlano(codigo));
    toast.error(
      plano
        ? "Este recurso não está incluído no plano atual da clínica."
        : "Seu usuário não tem permissão para acessar esta área.",
    );
    void navigate({ to: "/inicio", replace: true });
  }, [bloqueadaPeloPlano, carregandoPermissoes, location.pathname, navigate, podeAlguma]);

  async function sair() {
    if (saindo) return;
    setSaindo(true);
    const { error } = await supabase.auth.signOut();
    setSaindo(false);
    if (error) {
      toast.error("Não foi possível sair: " + error.message);
      return;
    }
    setAberto(false);
    void navigate({ to: "/" });
  }

  const alterarModo = (proximo: boolean) => {
    aoMudarFixo(proximo);
    setAberto(false);
  };

  const abrirAreaCompacta = (area: string) => {
    setExpandido(area);
    setAberto(true);
  };

  const itensVisiveis = (area: AreaMenu) => {
    const visiveis = carregandoPermissoes
      ? area.itens
      : area.itens.filter(
          (item) => (item.to === "/busca-inteligente" && (adminGlobal || pode("recepcao.cadastros.visualizar") || pode("consultorio.atendimentos"))) ||
            (item.emBreve && !item.permissao) || item.to === "/oricstudio" || item.to === "/venda-expressa" ||
            (!!item.permissao && (adminGlobal || pode(item.permissao) || (item.to === "/rh" && pode("equipe.pagamentos.gerenciar")) || bloqueadaPeloPlano(item.permissao))),
        );
    // Mostrar títulos de bloco somente quando o usuário pode acessar ao menos um item.
    if (area.titulo === "RH") {
      const gruposVisiveis = new Set(visiveis.map((item) => item.grupoRh).filter(Boolean));
      return area.itens.filter((item) => item.separador
        ? gruposVisiveis.has(item.separador as "trabalho" | "comissoes")
        : visiveis.includes(item));
    }
    if (area.titulo !== "Clínica veterinária") return visiveis;
    const rotasConsultorio = new Set(["/consultorio", "/animais", "/assinar", "/receituario", "/medicacoes"]);
    const existeConsultorio = visiveis.some(item => item.to && rotasConsultorio.has(item.to));
    const existeInternacao = visiveis.some(item => item.to && !rotasConsultorio.has(item.to));
    return area.itens.filter(item => item.separador
      ? (item.separador === "consultorio" ? existeConsultorio : existeInternacao)
      : visiveis.includes(item));
  };

  // Desenho original de cada seção, sem modificar seus botões ou links.
  const renderArea = (area: AreaMenu) => {
          const itens = itensVisiveis(area);
          if (itens.length === 0) return null;
          const Icone = area.icone;
          if (area.titulo === "Busca Inteligente") return (
            <Link key={area.titulo} to="/busca-inteligente" onClick={() => setAberto(false)}
              data-current={location.pathname === "/busca-inteligente" || undefined}
              className="oricse-menu-trigger flex min-h-12 items-center gap-3 rounded-xl border border-border/70 px-3 text-left text-sm font-semibold transition-colors">
              <Search className="h-5 w-5 shrink-0" />
              <span className="flex-1">Busca Inteligente</span>
              <ChevronDown className="-rotate-90 h-4 w-4" />
            </Link>
          );
          if (area.emPreparacao) return (
            <div key={area.titulo} className="flex min-h-12 items-center gap-3 rounded-xl border border-dashed border-border px-3 py-2.5">
              <Icone className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm font-semibold">
                {area.titulo}
                <span className="block text-[11px] font-normal text-muted-foreground">Módulo em preparação</span>
              </span>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Em breve</span>
            </div>
          );
          const ativo = itens.some(
            (item) => item.to === location.pathname && (item.to === "/oricstudio" || item.to === "/venda-expressa" || (!!item.permissao && pode(item.permissao))),
          );
          const abertoGrupo = expandido === area.titulo;
          return (
            <div key={area.titulo} className="overflow-hidden rounded-xl border border-border/70">
              <button
                type="button"
                aria-expanded={abertoGrupo}
                onClick={() => setExpandido(abertoGrupo ? null : area.titulo)}
                className="oricse-menu-trigger flex min-h-12 w-full items-center gap-3 px-3 text-left text-sm font-semibold transition-colors"
                data-current={ativo || undefined}
              >
                <Icone className="h-5 w-5 shrink-0" />
                <span className="flex-1">{area.titulo}</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${abertoGrupo ? "rotate-180" : ""}`}
                />
              </button>
              {abertoGrupo && (
                <div className={`oricse-menu-panel ${area.titulo === "Gestão de clientes" ? "py-1" : "space-y-1 p-2"}`}>
                  {itens.map((item, i) => {
                    const chave = (item.to || item.rotulo) + i;
                    if (item.separador) {
                      const SeparadorIcone = item.separador === "consultorio" ? Stethoscope
                        : item.separador === "internacao" ? BedDouble
                        : item.separador === "trabalho" ? Clock3 : Wallet;
                      const comDivisor = item.separador === "internacao" || item.separador === "comissoes";
                      return (
                        <div key={chave} role="presentation"
                          className={`flex items-center gap-2 px-2 pb-2 pt-3 ${comDivisor ? "mt-3 border-t border-border/80" : ""}`}>
                          <SeparadorIcone className="h-4 w-4 text-primary" />
                          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{item.rotulo}</span>
                        </div>
                      );
                    }
                    if (item.emBreve)
                      return (
                        <div
                          key={chave}
                          aria-disabled="true"
                          className="flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground"
                        >
                          <span className="min-w-0 flex-1">
                            {item.rotulo}
                            {item.moduloEmPreparacao && (
                              <span className="block text-[11px]">Módulo em preparação</span>
                            )}
                          </span>
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide">
                            Em breve
                          </span>
                        </div>
                      );
                    const bloqueioPlano =
                      !carregandoPermissoes &&
                      !!item.permissao &&
                      bloqueadaPeloPlano(item.permissao);
                    if (bloqueioPlano)
                      return (
                        <button
                          key={chave}
                          type="button"
                          onClick={() => { setAberto(false); navigate({ to: "/planos" }); toast.info("Faça um upgrade do plano ORICSE para liberar este recurso."); }}
                          className="oricse-menu-item flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-left text-sm text-muted-foreground"
                        >
                          <span className="flex-1">{item.rotulo}</span>
                          <Lock className="h-4 w-4 shrink-0" aria-label="Recurso não incluído no plano" />
                        </button>
                      );
                    const bloqueadoPlantao =
                      !!item.to &&
                      !plantao &&
                      SO_COM_PLANTAO.includes(item.to) &&
                      !(area.titulo === "Clínica veterinária" && item.to === "/medicacoes");
                    if (bloqueadoPlantao)
                      return (
                        <button
                          key={chave}
                          type="button"
                          disabled={!podeGerenciarPlantao}
                          onClick={() => {
                            if (!podeGerenciarPlantao) return;
                            setAberto(false);
                            setTurnoAberto(true);
                          }}
                          className="oricse-menu-item w-full rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground disabled:cursor-not-allowed"
                        >
                          {item.rotulo}
                          <span className="block text-[11px]">
                            {podeGerenciarPlantao
                              ? "Abrir plantão clínico primeiro"
                              : "Aguarde um responsável iniciar o plantão"}
                          </span>
                        </button>
                      );
                    if (item.portalOficial) {
                      const slug = clinicaSlug.trim();
                      const classe = "oricse-menu-item block min-h-10 rounded-lg px-3 py-2.5 text-sm transition-colors";
                      if (carregandoPermissoes || !slug) {
                        return <button key={chave} type="button" disabled={carregandoPermissoes}
                          className={`${classe} w-full text-left text-muted-foreground`}
                          onClick={() => toast.info("Selecione uma clínica com Portal do Tutor.")}>
                          {item.rotulo}
                        </button>;
                      }
                      const href = urlPortalDoTutor(slug);
                      return <a key={chave} href={href} onClick={() => setAberto(false)}
                        className={classe}>{item.rotulo}</a>;
                    }
                    if (!item.to) return null;
                    return (
                      <Link
                        key={chave}
                        to={item.to}
                        hash={item.abaHotel || undefined}
                        onClick={() => setAberto(false)}
                        data-destaque={item.destaque}
                        data-current={location.pathname === item.to && (!item.abaHotel || location.hash.replace(/^#/, "") === item.abaHotel || (item.abaHotel === "painel" && !location.hash)) || undefined}
                        className={area.titulo === "Gestão de clientes"
                          ? "oricse-menu-item flex min-h-10 items-center px-5 py-2 pl-12 text-sm transition-colors"
                          : "oricse-menu-item block min-h-10 rounded-lg px-3 py-2.5 text-sm transition-colors"}
                      >
                        <span className="block font-semibold">{item.rotulo}</span>
                        {item.descricao && <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{item.descricao}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
  };

  // Um único logotipo: a marca original do topo também é o atalho ao Início.
  const logoNoTopo = (
    <Link
      to="/inicio"
      aria-label="Oricse: ir para o Início"
      title="Ir para o Início"
      onClick={() => setAberto(false)}
      className="oricse-menu-marca mx-auto grid w-fit max-w-full shrink-0 place-items-center rounded-xl p-1 transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:px-3"
    >
      <span
        role="img"
        aria-label="Oricse"
        className="oricse-menu-marca-imagem aspect-[360/212] w-28 max-w-full"
      />
    </Link>
  );

  const navegacao = () => (
    <>
      <nav aria-label="Áreas do sistema" className="mt-5 space-y-1.5">
        {areasPrincipais.map(renderArea)}
        <div className="overflow-hidden rounded-xl border border-border/70">
            <button
              type="button"
              aria-expanded={maisOpcoesAberto}
              aria-controls="oricse-menu-mais-opcoes"
              onClick={() => setMaisOpcoesAberto((atual) => !atual)}
              className="oricse-menu-trigger flex min-h-12 w-full items-center gap-3 px-3 text-left text-sm font-semibold transition-colors"
            >
              <Settings className="h-5 w-5 shrink-0" />
              <span className="flex-1">Mais opções</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${maisOpcoesAberto ? "rotate-180" : ""}`} />
            </button>
            {maisOpcoesAberto && (
              <div id="oricse-menu-mais-opcoes" className="oricse-menu-panel ml-5 space-y-2 border-l-[3px] border-border py-3 pl-3 pr-2">
                {areasOpcionais.map(renderArea)}
                <button
                  type="button"
                  disabled={saindo}
                  onClick={sair}
                  className="oricse-menu-item mt-2 flex min-h-12 w-full items-center gap-3 rounded-xl border border-border/70 px-3 text-left text-sm font-semibold text-destructive disabled:cursor-not-allowed"
                >
                  <LogOut className="h-5 w-5 shrink-0" />
                  {saindo ? "Saindo..." : "Sair da conta"}
                </button>
              </div>
            )}
          </div>
      </nav>
    </>
  );

  const nomeProfissional = profissional?.id === usuarioId ? profissional.nome : "";
  const identificacao = (nomeProfissional || clinicaNome) && (
    <div className="ml-auto w-1/2 min-w-0 shrink-0 rounded-lg border border-current/15 bg-current/5 px-1.5 py-1.5 text-right text-[9px] leading-[1.2] [overflow-wrap:anywhere]">
      {nomeProfissional && <p className="line-clamp-2 text-balance font-semibold" title={nomeProfissional}>{nomeProfissional}</p>}
      {clinicaNome && <p className="line-clamp-2 text-balance text-muted-foreground" title={clinicaNome}>{clinicaNome}</p>}
    </div>
  );

  return (
    <>
      {fixo && (
        <aside className="oricse-menu oricse-menu-lateral fixed inset-y-0 left-0 z-40 flex w-16 flex-col border-r p-2 shadow-xl lg:block lg:w-80 lg:overflow-y-auto lg:p-4">
          {logoNoTopo}
          <div className="mt-3 hidden items-center gap-2 px-1 lg:flex">
            <button
              type="button"
              onClick={() => alterarModo(false)}
              aria-label="Usar menu por três riscos"
              title="Usar menu por três riscos"
              className="oricse-menu-item group flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-2 text-left font-bold transition-colors hover:bg-current/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Menu className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <span>Menu</span>
              <PanelLeftClose className="h-3.5 w-3.5 opacity-45 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </button>
            {identificacao}
          </div>
          <div className="hidden lg:block">{navegacao()}</div>
          <nav
            aria-label="Atalhos fixos do sistema"
            className="mt-2 flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto pb-1 [&>*]:shrink-0 lg:hidden"
          >
            <button
              type="button"
              onClick={() => alterarModo(false)}
              aria-label="Usar menu por três riscos"
              title="Usar menu por três riscos"
              className="oricse-menu-item flex h-11 w-11 items-center justify-center rounded-xl text-primary transition-colors hover:bg-current/5 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            {areasPrincipais.map((area) => {
              const itens = itensVisiveis(area);
              if (itens.length === 0) return null;
              const Icone = area.icone;
              const ativo = itens.some(
                (item) => item.to === location.pathname && (item.to === "/oricstudio" || item.to === "/venda-expressa" || (!!item.permissao && pode(item.permissao))),
              );
              return (
                <button
                  key={area.titulo}
                  type="button"
                  aria-label={area.emPreparacao ? `${area.titulo} · Em breve` : `Abrir ${area.titulo}`}
                  title={area.emPreparacao ? `${area.titulo} · Em breve` : area.titulo}
                  onClick={() => area.titulo === "Busca Inteligente" ? void navigate({ to: "/busca-inteligente" }) : abrirAreaCompacta(area.titulo)}
                  data-current={(ativo && !area.emPreparacao) || undefined}
                  className="oricse-menu-item flex h-11 w-11 items-center justify-center rounded-xl border border-border/70 transition-colors"
                >
                  <Icone className="h-5 w-5" />
                </button>
              );
            })}
            <button
                type="button"
                aria-label="Abrir Mais opções"
                title="Mais opções"
                onClick={() => { setMaisOpcoesAberto(true); setExpandido(null); setAberto(true); }}
                className="oricse-menu-item flex h-11 w-11 items-center justify-center rounded-xl border border-border/70"
              >
                <Settings className="h-5 w-5" />
              </button>
          </nav>
        </aside>
      )}
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Abrir menu lateral"
            className={`fixed left-3 top-3 z-50 flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm hover:bg-secondary ${fixo ? "hidden" : ""}`}
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="oricse-menu w-80 overflow-y-auto">
          {logoNoTopo}
          <SheetHeader className="mt-3 flex-row items-center gap-2 space-y-0 pr-7">
            <SheetTitle className="oricse-menu-title shrink-0" asChild>
              <button
                type="button"
                onClick={() => alterarModo(true)}
                aria-label="Fixar menu na lateral"
                title="Fixar menu na lateral"
                className="oricse-menu-item group flex min-h-11 items-center gap-2 rounded-lg px-2 text-left font-bold transition-colors hover:bg-current/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Menu className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <span>Menu</span>
                <PanelLeftOpen className="h-3.5 w-3.5 opacity-45 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              </button>
            </SheetTitle>
            {identificacao}
          </SheetHeader>
          {navegacao()}
        </SheetContent>
      </Sheet>
      <DialogoTurno aberto={turnoAberto} onFechar={() => setTurnoAberto(false)} />
    </>
  );
}
