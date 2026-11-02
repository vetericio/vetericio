import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import {
  BarChart3,
  BedDouble,
  CalendarCheck,
  ChevronDown,
  Clock3,
  Lock,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Scissors,
  Settings,
  Stethoscope,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DialogoTurno } from "@/components/DialogoTurno";
import { usePlantaoAtual } from "@/hooks/usePlantaoAtual";
import { permissoesDaRota, usePermissoes } from "@/hooks/usePermissoes";
import { SO_COM_PLANTAO } from "@/lib/navegacao";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type MenuRoute =
  | "/recepcao"
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
  | "/financeiro"
  | "/comandas"
  | "/estoque"
  | "/rh"
  | "/minha-atividade"
  | "/banco-horas"
  | "/perfil-clinica"
  | "/plano-clinica"
  | "/permissoes-equipe"
  | "/configurar-portal-tutor"
  | "/temas";

type ItemMenu = {
  to?: MenuRoute;
  rotulo: string;
  permissao?: string;
  emBreve?: boolean;
  abaHotel?: string;
  separador?: "consultorio" | "internacao";
};

type AreaMenu = {
  titulo: string;
  icone: typeof CalendarCheck;
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
      {to:"/banho-tosa",abaHotel:"novo",rotulo:"Novo agendamento",permissao:"hotelzinho.visualizar"},
      {to:"/banho-tosa",abaHotel:"fila",rotulo:"Fila de serviços",permissao:"hotelzinho.visualizar"},
      {to:"/banho-tosa",abaHotel:"servicos",rotulo:"Serviços e preços",permissao:"hotelzinho.visualizar"},
      {to:"/banho-tosa",abaHotel:"historico",rotulo:"Histórico",permissao:"hotelzinho.visualizar"},
    ],
  },
  {
    titulo: "Gestão de clientes",
    icone: Users,
    itens: [
      { to: "/crm", rotulo: "Retornos, vacinas e aniversários", permissao: "crm.visualizar" },
      { to: "/crm", rotulo: "Avisos e atualizações para tutores", permissao: "crm.enviar" },
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
    titulo: "Relatórios",
    icone: BarChart3,
    itens: [{ rotulo: "Módulo em preparação", emBreve: true }],
  },
  {
    titulo: "RH",
    icone: Clock3,
    itens: [
      { to: "/minha-atividade", rotulo: "Check-in / check-out", permissao: "atividade.ponto" },
      { to: "/banco-horas", rotulo: "Minhas horas e diárias", permissao: "atividade.ponto" },
      { to: "/rh", abaHotel: "comissoes", rotulo: "Comissões", permissao: "equipe.pagamentos.visualizar" },
      { to: "/rh", abaHotel: "equipe", rotulo: "Remuneração da equipe", permissao: "equipe.pagamentos.visualizar" },
      { to: "/rh", abaHotel: "pagamentos", rotulo: "Pagamento da equipe", permissao: "equipe.pagamentos.visualizar" },
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
        to: "/configurar-portal-tutor",
        rotulo: "Portal do tutor",
        permissao: "administracao.site",
      },
      { to: "/temas", rotulo: "Temas", permissao: "administracao.temas" },
    ],
  },
];

export function MenuLateral({
  fixo,
  aoMudarFixo,
}: {
  fixo: boolean;
  aoMudarFixo: (fixo: boolean) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [expandido, setExpandido] = useState<string | null>("Recepção");
  const [turnoAberto, setTurnoAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const { plantao } = usePlantaoAtual();
  const {
    carregando: carregandoPermissoes,
    pode,
    podeAlguma,
    bloqueadaPeloPlano,
    adminGlobal,
  } = usePermissoes();
  const podeGerenciarPlantao = carregandoPermissoes || pode("internacao.plantoes");
  const navigate = useNavigate();
  const location = useLocation();

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
          (item) => item.emBreve ||
            (!!item.permissao && (adminGlobal || pode(item.permissao) || (item.to === "/rh" && pode("equipe.pagamentos.gerenciar")) || bloqueadaPeloPlano(item.permissao))),
        );
    // Separadores só aparecem quando existem links visíveis no respectivo bloco.
    if (area.titulo !== "Clínica veterinária") return visiveis;
    const rotasConsultorio = new Set(["/consultorio", "/animais", "/assinar", "/receituario", "/medicacoes"]);
    const existeConsultorio = visiveis.some(item => item.to && rotasConsultorio.has(item.to));
    const existeInternacao = visiveis.some(item => item.to && !rotasConsultorio.has(item.to));
    return area.itens.filter(item => item.separador
      ? (item.separador === "consultorio" ? existeConsultorio : existeInternacao)
      : visiveis.includes(item));
  };

  const navegacao = (menuFixo = false) => (
    <>
      <nav aria-label="Áreas do sistema" className="mt-5 space-y-1.5">
        {areas.map((area) => {
          const itens = itensVisiveis(area);
          if (itens.length === 0) return null;
          const Icone = area.icone;
          const ativo = itens.some(
            (item) => item.to === location.pathname && !!item.permissao && pode(item.permissao),
          );
          const abertoGrupo = expandido === area.titulo;
          return (
            <div key={area.titulo} className="overflow-hidden rounded-xl border border-border/70">
              <button
                type="button"
                aria-expanded={abertoGrupo}
                onClick={() => setExpandido(abertoGrupo ? null : area.titulo)}
                className={`flex min-h-12 w-full items-center gap-3 px-3 text-left text-sm font-semibold transition-colors ${ativo ? "bg-primary/10 text-primary" : "bg-secondary/40 hover:bg-secondary"}`}
              >
                <Icone className="h-5 w-5 shrink-0" />
                <span className="flex-1">{area.titulo}</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${abertoGrupo ? "rotate-180" : ""}`}
                />
              </button>
              {abertoGrupo && (
                <div className={area.titulo === "Gestão de clientes" ? "bg-background py-1" : "space-y-1 bg-background p-2"}>
                  {itens.map((item, i) => {
                    const chave = (item.to || item.rotulo) + i;
                    if (item.separador) return (
                      <div key={chave} role="presentation" className={`flex items-center gap-2 px-2 pb-1 pt-3 ${item.separador === "internacao" ? "mt-3 border-t border-border/80" : ""}`}>
                        {item.separador === "consultorio" ? <Stethoscope className="h-4 w-4 text-primary" /> : <BedDouble className="h-4 w-4 text-primary" />}
                        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{item.rotulo}</span>
                      </div>
                    );
                    if (item.emBreve)
                      return (
                        <div
                          key={chave}
                          aria-disabled="true"
                          className="flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground"
                        >
                          <span className="flex-1">{item.rotulo}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wide">
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
                          aria-disabled="true"
                          onClick={() =>
                            toast.info(
                              "Recurso disponível somente em um plano que inclua esta funcionalidade.",
                            )
                          }
                          className="flex w-full cursor-not-allowed items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-left text-sm text-muted-foreground opacity-55"
                        >
                          <Lock className="h-3.5 w-3.5 shrink-0" />
                          <span className="flex-1">{item.rotulo}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wide">
                            Plano
                          </span>
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
                          className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {item.rotulo}
                          <span className="block text-[11px]">
                            {podeGerenciarPlantao
                              ? "Abrir plantão clínico primeiro"
                              : "Aguarde um responsável iniciar o plantão"}
                          </span>
                        </button>
                      );
                    if (!item.to) return null;
                    return (
                      <Link
                        key={chave}
                        to={item.to}
                        hash={item.abaHotel || undefined}
                        onClick={() => setAberto(false)}
                        className={area.titulo === "Gestão de clientes"
                          ? "flex min-h-10 items-center px-5 py-2 pl-12 text-sm transition-colors hover:bg-secondary/60 focus-visible:bg-secondary focus-visible:outline-none"
                          : `block min-h-10 rounded-lg px-3 py-2.5 text-sm transition-colors ${location.pathname === item.to && (!item.abaHotel || location.hash.replace(/^#/, "") === item.abaHotel || (item.abaHotel === "painel" && !location.hash)) ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                      >
                        {item.rotulo}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        <button
          type="button"
          disabled={saindo}
          onClick={sair}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border/70 px-3 text-left text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          <LogOut className="h-5 w-5" />
          {saindo ? "Saindo..." : "Sair da conta"}
        </button>
      </nav>
      <button
        type="button"
        onClick={() => alterarModo(!menuFixo)}
        className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold hover:bg-secondary"
      >
        {menuFixo ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        {menuFixo ? "Usar menu por três riscos" : "Fixar menu na lateral"}
      </button>
    </>
  );

  return (
    <>
      {fixo && (
        <aside className="oricse-menu-lateral fixed inset-y-0 left-0 z-40 w-16 border-r bg-card p-2 shadow-xl lg:w-80 lg:overflow-y-auto lg:p-4">
          <div className="hidden items-center gap-2 px-1 lg:flex">
            <Menu className="h-5 w-5 text-primary" />
            <h2 className="font-bold">Menu</h2>
          </div>
          <div className="hidden lg:block">{navegacao(true)}</div>
          <nav
            aria-label="Atalhos fixos do sistema"
            className="flex h-full flex-col items-center gap-2 lg:hidden"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl text-primary">
              <Menu className="h-5 w-5" />
            </span>
            {areas.map((area) => {
              const itens = itensVisiveis(area);
              if (itens.length === 0) return null;
              const Icone = area.icone;
              const ativo = itens.some(
                (item) => item.to === location.pathname && !!item.permissao && pode(item.permissao),
              );
              return (
                <button
                  key={area.titulo}
                  type="button"
                  aria-label={`Abrir ${area.titulo}`}
                  title={area.titulo}
                  onClick={() => abrirAreaCompacta(area.titulo)}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${ativo ? "border-primary bg-primary text-primary-foreground" : "border-border/70 hover:bg-secondary"}`}
                >
                  <Icone className="h-5 w-5" />
                </button>
              );
            })}
            <button
              type="button"
              aria-label="Usar menu por três riscos"
              title="Usar menu por três riscos"
              onClick={() => alterarModo(false)}
              className="mt-auto flex h-11 w-11 items-center justify-center rounded-xl border border-border/70 hover:bg-secondary"
            >
              <PanelLeftClose className="h-5 w-5" />
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
        <SheetContent side="left" className="w-80 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          {navegacao(false)}
        </SheetContent>
      </Sheet>
      <DialogoTurno aberto={turnoAberto} onFechar={() => setTurnoAberto(false)} />
    </>
  );
}
