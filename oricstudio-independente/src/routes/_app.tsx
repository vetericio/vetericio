import { useEffect } from "react";
import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  AtSign,
  Bell,
  CalendarDays,
  ChartColumn,
  Clock,
  FileText,
  Images,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  MessageSquare,
  ScrollText,
  Settings,
  ShieldCheck,
  SquarePen,
  Workflow,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { PauseToggle } from "@/components/pause-toggle";
import { ThemeToggle, useApplyTheme } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { useRoles, useSession } from "@/lib/session";
import { useSettings } from "@/lib/queries";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

type NavItem = { to: string; label: string; icon: typeof Activity };

const NAV: { grupo: string; itens: NavItem[] }[] = [
  {
    grupo: "Gestão",
    itens: [
      { to: "/", label: "Visão geral", icon: LayoutDashboard },
      { to: "/contas", label: "Contas conectadas", icon: AtSign },
      { to: "/calendario", label: "Calendário", icon: CalendarDays },
    ],
  },
  {
    grupo: "Conteúdo",
    itens: [
      { to: "/criar", label: "Criar publicação", icon: SquarePen },
      { to: "/midias", label: "Mídias", icon: Images },
      { to: "/rascunhos", label: "Rascunhos", icon: FileText },
      { to: "/agendadas", label: "Agendadas", icon: Clock },
      { to: "/historico", label: "Histórico", icon: History },
    ],
  },
  {
    grupo: "Análise",
    itens: [
      { to: "/metricas", label: "Métricas", icon: ChartColumn },
      { to: "/relatorios", label: "Relatórios", icon: ScrollText },
      { to: "/comentarios", label: "Comentários", icon: MessageSquare },
    ],
  },
  {
    grupo: "Operação",
    itens: [
      { to: "/regras", label: "Regras de automação", icon: Workflow },
      { to: "/alertas", label: "Alertas", icon: Bell },
      { to: "/atividades", label: "Atividades", icon: Activity },
      { to: "/configuracoes", label: "Configurações", icon: Settings },
      { to: "/permissoes", label: "Permissões e segurança", icon: ShieldCheck },
    ],
  },
];

function AppLayout() {
  useApplyTheme();
  const { session, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-label="Carregando" />
      </div>
    );
  }

  return <Shell userId={session.user.id} email={session.user.email ?? ""} />;
}

function Shell({ userId, email }: { userId: string; email: string }) {
  const roles = useRoles(userId);
  const isAdmin = !!roles.data?.includes("admin");
  const { data: settings } = useSettings();

  return (
    <SidebarProvider>
      <AppSidebar email={email} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger aria-label="Abrir menu" />
          <div className="flex-1" />
          <PauseToggle isAdmin={isAdmin} />
          <ThemeToggle />
        </header>
        {settings?.pausa_geral ? (
          <div
            role="status"
            className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
          >
            Pausa geral ativa: nenhuma publicação ou automação está sendo executada.
          </div>
        ) : null}
        {roles.isSuccess && roles.data.length === 0 ? (
          <div className="border-b bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
            Sua conta não tem nenhum papel atribuído. Peça a um administrador para liberar seu
            acesso.
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function AppSidebar({ email }: { email: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { setOpenMobile } = useSidebar();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <span className="text-base font-semibold">Gestor Instagram</span>
      </SidebarHeader>
      <SidebarContent>
        {NAV.map((g) => (
          <SidebarGroup key={g.grupo}>
            <SidebarGroupLabel>{g.grupo}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.itens.map((item) => {
                  const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link to={item.to} onClick={() => setOpenMobile(false)}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="gap-2 border-t p-3">
        <p className="truncate text-xs text-muted-foreground" title={email}>
          {email}
        </p>
        <Button variant="outline" size="sm" onClick={signOut}>
          <LogOut className="size-4" />
          Sair
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
