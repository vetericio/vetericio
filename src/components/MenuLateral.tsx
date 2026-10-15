import { useState } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { Activity, CalendarCheck, ChevronDown, LogOut, Menu, Settings, Stethoscope, Wallet, BedDouble } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DialogoTurno } from "@/components/DialogoTurno";
import { usePlantaoAtual } from "@/hooks/usePlantaoAtual";
import { SO_COM_PLANTAO } from "@/lib/navegacao";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const areas = [
  { titulo: "Atividade", icone: Activity, itens: [
    { to: "/minha-atividade", rotulo: "Bater ponto / Check-in" },
    { to: "/minha-atividade", rotulo: "Minhas horas e diárias" },
  ] },
  { titulo: "Recepção", icone: CalendarCheck, itens: [
    { to: "/recepcao", rotulo: "Painel da recepção" },
    { to: "/recepcao", rotulo: "Agenda e fila de espera" },
    { to: "/tutores", rotulo: "Tutores" },
    { to: "/animais", rotulo: "Animais" },
  ] },
  { titulo: "Consultório", icone: Stethoscope, itens: [
    { to: "/consultorio", rotulo: "Consultas e prontuários" },
    { to: "/animais", rotulo: "Pesquisar animais" },
    { to: "/assinar", rotulo: "Assinar documento" },
    { to: "/receituario", rotulo: "Receituário" },
    { to: "/medicacoes", rotulo: "Medicações" },
  ] },
  { titulo: "Internação", icone: BedDouble, itens: [
    { to: "/internacao", rotulo: "Painel de internação" },
    { to: "/registros", rotulo: "Animais internados" },
    { to: "/anamnese", rotulo: "Anamnese" },
    { to: "/curva", rotulo: "Curvas e parâmetros" },
    { to: "/medicacoes", rotulo: "Medicações" },
    { to: "/alarmes", rotulo: "Alarmes" },
    { to: "/pendencias", rotulo: "Pendências" },
    { to: "/plantoes", rotulo: "Histórico de plantões" },
  ] },
  { titulo: "Caixa", icone: Wallet, itens: [
    { to: "/financeiro", rotulo: "Painel financeiro" },
    { to: "/comandas", rotulo: "Comandas" },
    { to: "/estoque", rotulo: "Produtos e estoque" },
  ] },
  { titulo: "Administração", icone: Settings, itens: [
    { to: "/perfil-clinica", rotulo: "Perfil da clínica" },
    { to: "/configuracao-site", rotulo: "Site da clínica" },
    { to: "/temas", rotulo: "Temas" },
  ] },
] as const;

export function MenuLateral() {
  const [aberto, setAberto] = useState(false);
  const [expandido, setExpandido] = useState<string | null>("Atividade");
  const [turnoAberto, setTurnoAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const { plantao } = usePlantaoAtual();
  const navigate = useNavigate();
  const location = useLocation();

  async function sair() {
    if (saindo) return;
    setSaindo(true);
    const { error } = await supabase.auth.signOut();
    setSaindo(false);
    if (error) { toast.error("Não foi possível sair: " + error.message); return; }
    setAberto(false);
    void navigate({ to: "/" });
  }

  return <>
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        <button type="button" aria-label="Abrir menu lateral" className="absolute left-3 top-3 z-30 flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm hover:bg-secondary">
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 overflow-y-auto">
        <SheetHeader><SheetTitle>Menu</SheetTitle></SheetHeader>
        <nav aria-label="Áreas do sistema" className="mt-5 space-y-1.5">
          {areas.map(area => {
            const Icone = area.icone;
            const ativo = area.itens.some(item => item.to === location.pathname);
            const abertoGrupo = expandido === area.titulo;
            return <div key={area.titulo} className="overflow-hidden rounded-xl border border-border/70">
              <button type="button" aria-expanded={abertoGrupo} onClick={() => setExpandido(abertoGrupo ? null : area.titulo)}
                className={`flex min-h-12 w-full items-center gap-3 px-3 text-left text-sm font-semibold transition-colors ${ativo ? "bg-primary/10 text-primary" : "bg-secondary/40 hover:bg-secondary"}`}>
                <Icone className="h-5 w-5 shrink-0" />
                <span className="flex-1">{area.titulo}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${abertoGrupo ? "rotate-180" : ""}`} />
              </button>
              {abertoGrupo && <div className="space-y-1 bg-background p-2">
                {area.itens.map((item,i) => {
                  const bloqueado = !plantao && (SO_COM_PLANTAO.includes(item.to) && !(area.titulo === "Consultório" && item.to === "/medicacoes"));
                  if (bloqueado) return <button key={item.to+i} type="button" onClick={() => { setAberto(false); setTurnoAberto(true); }}
                    className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-secondary">
                    {item.rotulo}<span className="block text-[11px]">Abrir plantão clínico primeiro</span>
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
      </SheetContent>
    </Sheet>
    <DialogoTurno aberto={turnoAberto} onFechar={() => setTurnoAberto(false)} />
  </>;
}
