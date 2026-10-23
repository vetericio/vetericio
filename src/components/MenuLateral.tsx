import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { Activity, House, CalendarCheck, ChevronDown, LogOut, Menu, Settings, Stethoscope, Wallet, BedDouble, Lock, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DialogoTurno } from "@/components/DialogoTurno";
import { usePlantaoAtual } from "@/hooks/usePlantaoAtual";
import { permissoesDaRota, usePermissoes } from "@/hooks/usePermissoes";
import { SO_COM_PLANTAO } from "@/lib/navegacao";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const areas = [
  { titulo: "Atividade", icone: Activity, itens: [
    { to: "/minha-atividade", rotulo: "Bater ponto / Check-in", permissao: "atividade.ponto" },
    { to: "/minha-atividade", rotulo: "Minhas horas e diárias", permissao: "atividade.ponto" },
  ] },
  { titulo: "Recepção", icone: CalendarCheck, itens: [
    { to: "/recepcao", rotulo: "Painel da recepção", permissao: "recepcao.agenda" },
    { to: "/recepcao", rotulo: "Agenda e fila de espera", permissao: "recepcao.agenda" },
    { to: "/configurar-agenda-online", rotulo: "Configurar agenda online", permissao: "recepcao.agenda" },
    { to: "/tutores", rotulo: "Tutores", permissao: "recepcao.cadastros.visualizar" },
    { to: "/portal-tutores", rotulo: "Portal do tutor", permissao: "portal_tutor.gerenciar" },
    { to: "/animais", rotulo: "Animais", permissao: "recepcao.cadastros.visualizar" },
    { to: "/crm", rotulo: "CRM e lembretes", permissao: "crm.visualizar" },
  ] },
  { titulo: "Consultório", icone: Stethoscope, itens: [
    { to: "/consultorio", rotulo: "Consultas e prontuários", permissao: "consultorio.atendimentos" },
    { to: "/animais", rotulo: "Pesquisar animais", permissao: "consultorio.atendimentos" },
    { to: "/assinar", rotulo: "Assinar documento", permissao: "consultorio.receituario" },
    { to: "/receituario", rotulo: "Receituário", permissao: "consultorio.receituario" },
    { to: "/medicacoes", rotulo: "Medicações", permissao: "consultorio.medicacoes" },
  ] },
  { titulo: "Internação", icone: BedDouble, itens: [
    { to: "/internacao", rotulo: "Painel de internação", permissao: "internacao.painel" },
    { to: "/registros", rotulo: "Animais internados", permissao: "internacao.painel" },
    { to: "/anamnese", rotulo: "Anamnese", permissao: "internacao.registrar" },
    { to: "/curva", rotulo: "Curvas e parâmetros", permissao: "internacao.registrar" },
    { to: "/medicacoes", rotulo: "Medicações", permissao: "internacao.medicacoes" },
    { to: "/alarmes", rotulo: "Alarmes", permissao: "internacao.registrar" },
    { to: "/pendencias", rotulo: "Pendências", permissao: "internacao.registrar" },
    { to: "/plantoes", rotulo: "Histórico de plantões", permissao: "internacao.plantoes" },
  ] },
  { titulo: "Caixa", icone: Wallet, itens: [
    { to: "/financeiro", rotulo: "Painel financeiro", permissao: "caixa.financeiro.visualizar" },
    { to: "/comandas", rotulo: "Comandas", permissao: "caixa.comandas" },
    { to: "/estoque", rotulo: "Produtos e estoque", permissao: "estoque.catalogo.visualizar" },
  ] },
  { titulo: "Administração", icone: Settings, itens: [
    { to: "/perfil-clinica", rotulo: "Configurações", permissao: "administracao.configuracoes" },
    { to: "/configuracao-site", rotulo: "Personalizar Portal do Tutor", permissao: "administracao.site" },
    { to: "/temas", rotulo: "Temas", permissao: "administracao.temas" },
  ] },
] as const;

export function MenuLateral({ fixo, aoMudarFixo }: { fixo: boolean; aoMudarFixo: (fixo: boolean) => void }) {
  const [aberto, setAberto] = useState(false);
  const [expandido, setExpandido] = useState<string | null>("Atividade");
  const [turnoAberto, setTurnoAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const { plantao } = usePlantaoAtual();
  const { carregando: carregandoPermissoes, pode, podeAlguma, bloqueadaPeloPlano } = usePermissoes();
  const podeGerenciarPlantao = carregandoPermissoes || pode("internacao.plantoes");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (carregandoPermissoes) return;
    const exigidas = permissoesDaRota(location.pathname);
    if (!exigidas || podeAlguma(exigidas)) return;
    const plano = exigidas.some((codigo) => bloqueadaPeloPlano(codigo));
    toast.error(plano ? "Este recurso não está incluído no plano atual da clínica." : "Seu usuário não tem permissão para acessar esta área.");
    void navigate({ to: "/inicio", replace: true });
  }, [bloqueadaPeloPlano, carregandoPermissoes, location.pathname, navigate, podeAlguma]);

  async function sair() {
    if (saindo) return;
    setSaindo(true);
    const { error } = await supabase.auth.signOut();
    setSaindo(false);
    if (error) { toast.error("Não foi possível sair: " + error.message); return; }
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

  const navegacao = (menuFixo = false) => <>
    <nav aria-label="Áreas do sistema" className="mt-5 space-y-1.5">
      <Link to="/inicio" onClick={() => setAberto(false)} className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 text-sm font-semibold ${location.pathname==="/inicio"?"bg-primary/10 text-primary border-primary/30":"bg-secondary/40 hover:bg-secondary"}`}><House className="h-5 w-5"/><span>Início</span></Link>
      {areas.map(area => {
        const itensVisiveis = carregandoPermissoes
          ? area.itens
          : area.itens.filter((item) => pode(item.permissao) || bloqueadaPeloPlano(item.permissao));
        if (itensVisiveis.length === 0) return null;
        const Icone = area.icone;
        const ativo = itensVisiveis.some(item => item.to === location.pathname && pode(item.permissao));
        const abertoGrupo = expandido === area.titulo;
        return <div key={area.titulo} className="overflow-hidden rounded-xl border border-border/70">
          <button type="button" aria-expanded={abertoGrupo} onClick={() => setExpandido(abertoGrupo ? null : area.titulo)}
            className={`flex min-h-12 w-full items-center gap-3 px-3 text-left text-sm font-semibold transition-colors ${ativo ? "bg-primary/10 text-primary" : "bg-secondary/40 hover:bg-secondary"}`}>
            <Icone className="h-5 w-5 shrink-0" />
            <span className="flex-1">{area.titulo}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${abertoGrupo ? "rotate-180" : ""}`} />
          </button>
          {abertoGrupo && <div className="space-y-1 bg-background p-2">
            {itensVisiveis.map((item,i) => {
              const bloqueioPlano = !carregandoPermissoes && bloqueadaPeloPlano(item.permissao);
              if (bloqueioPlano) return <button key={item.to+i} type="button" aria-disabled="true" onClick={() => toast.info("Recurso disponível somente em um plano que inclua esta funcionalidade.")}
                className="flex w-full cursor-not-allowed items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-left text-sm text-muted-foreground opacity-55">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{item.rotulo}</span>
                <span className="text-[10px] font-bold uppercase tracking-wide">Plano</span>
              </button>;
              const bloqueadoPlantao = !plantao && (SO_COM_PLANTAO.includes(item.to) && !(area.titulo === "Consultório" && item.to === "/medicacoes"));
              if (bloqueadoPlantao) return <button key={item.to+i} type="button" disabled={!podeGerenciarPlantao} onClick={() => { if (!podeGerenciarPlantao) return; setAberto(false); setTurnoAberto(true); }}
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60">
                {item.rotulo}<span className="block text-[11px]">{podeGerenciarPlantao ? "Abrir plantão clínico primeiro" : "Aguarde um responsável iniciar o plantão"}</span>
              </button>;
              return <Link key={item.to+i} to={item.to} onClick={() => setAberto(false)}
                className={`block min-h-10 rounded-lg px-3 py-2.5 text-sm transition-colors ${location.pathname===item.to ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
                {item.rotulo}
              </Link>;
            })}
          </div>}
        </div>;
      })}
      <button type="button" disabled={saindo} onClick={sair}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border/70 px-3 text-left text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50">
        <LogOut className="h-5 w-5" />{saindo ? "Saindo..." : "Sair da conta"}
      </button>
    </nav>
    <button type="button" onClick={() => alterarModo(!menuFixo)} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold hover:bg-secondary">
      {menuFixo ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
      {menuFixo ? "Usar menu por três riscos" : "Fixar menu na lateral"}
    </button>
  </>;

  return <>
    {fixo && <aside className="oricse-menu-lateral fixed inset-y-0 left-0 z-40 w-16 border-r bg-card p-2 shadow-xl lg:w-80 lg:overflow-y-auto lg:p-4">
      <div className="hidden items-center gap-2 px-1 lg:flex"><Menu className="h-5 w-5 text-primary"/><h2 className="font-bold">Menu</h2></div>
      <div className="hidden lg:block">{navegacao(true)}</div>
      <nav aria-label="Atalhos fixos do sistema" className="flex h-full flex-col items-center gap-2 lg:hidden">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl text-primary"><Menu className="h-5 w-5" /></span>
        <Link to="/inicio" aria-label="Início" title="Início" className={`flex h-11 w-11 items-center justify-center rounded-xl border ${location.pathname==="/inicio"?"border-primary bg-primary text-primary-foreground":"border-border/70 hover:bg-secondary"}`}><House className="h-5 w-5"/></Link>
        {areas.map((area) => {
          const itensVisiveis = carregandoPermissoes
            ? area.itens
            : area.itens.filter((item) => pode(item.permissao) || bloqueadaPeloPlano(item.permissao));
          if (itensVisiveis.length === 0) return null;
          const Icone = area.icone;
          const ativo = itensVisiveis.some((item) => item.to === location.pathname && pode(item.permissao));
          return <button key={area.titulo} type="button" aria-label={`Abrir ${area.titulo}`} title={area.titulo} onClick={() => abrirAreaCompacta(area.titulo)}
            className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${ativo ? "border-primary bg-primary text-primary-foreground" : "border-border/70 hover:bg-secondary"}`}>
            <Icone className="h-5 w-5" />
          </button>;
        })}
        <button type="button" aria-label="Usar menu por três riscos" title="Usar menu por três riscos" onClick={() => alterarModo(false)} className="mt-auto flex h-11 w-11 items-center justify-center rounded-xl border border-border/70 hover:bg-secondary">
          <PanelLeftClose className="h-5 w-5" />
        </button>
      </nav>
    </aside>}
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        <button type="button" aria-label="Abrir menu lateral" className={`absolute left-3 top-3 z-30 flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm hover:bg-secondary ${fixo ? "hidden" : ""}`}>
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 overflow-y-auto">
        <SheetHeader><SheetTitle>Menu</SheetTitle></SheetHeader>
        {navegacao(false)}
      </SheetContent>
    </Sheet>
    <DialogoTurno aberto={turnoAberto} onFechar={() => setTurnoAberto(false)} />
  </>;
}
