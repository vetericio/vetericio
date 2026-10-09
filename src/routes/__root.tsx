import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { Cabecalho } from "@/components/Cabecalho";
import { Splash } from "@/components/Splash";
import { AlarmeAtivo } from "@/components/AlarmeAtivo";
import { Rodape } from "@/components/Rodape";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md text-center"><h1 className="text-7xl font-bold text-foreground">404</h1><h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2><div className="mt-6"><Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Voltar</Link></div></div></div>;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md text-center"><h1 className="text-xl font-semibold">Esta página não carregou</h1><div className="mt-6"><button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Tentar novamente</button></div></div></div>;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({ meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" }, { name: "theme-color", content: "#0f4d47" }, { name: "author", content: "Oricse" }], links: [{ rel: "stylesheet", href: appCss }, { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" }, { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap" }, { rel: "manifest", href: "/manifest.webmanifest?v=10" }, { rel: "icon", type: "image/png", href: "/favicon.png" }, { rel: "apple-touch-icon", type: "image/png", href: "/icon-192.png" }] }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) { return <html lang="pt-BR"><head><HeadContent /></head><body>{children}<Scripts /></body></html>; }

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [autenticado, setAutenticado] = useState<boolean | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    async function validarSessao(session: any) {
      if (!session?.user?.id) { if (ativo) { setAutenticado(false); setRole(null); } return; }
      const { data, error } = await (supabase as any).from("app_users").select("user_id, role").eq("user_id", session.user.id).maybeSingle();
      if (!ativo) return;
      if (error || !data?.user_id) { setAutenticado(false); setRole(null); return; }
      setAutenticado(true); setRole(data.role || "usuario");
    }
    supabase.auth.getSession().then(({ data }) => void validarSessao(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => void validarSessao(session));
    return () => { ativo = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const rotaPublica = location.pathname === "/login" || location.pathname === "/planos";
    if (autenticado === false && !rotaPublica) navigate({ to: "/login" });
    if (autenticado && role === "admin" && location.pathname === "/") navigate({ to: "/admin" });
  }, [autenticado, role, location.pathname, navigate]);

  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined); }, []);

  const rotaAdmin = location.pathname.startsWith("/admin");
  const rotaPublica = location.pathname === "/login" || location.pathname === "/planos";
  const mostrarClinico = autenticado && !rotaAdmin && !rotaPublica;

  return <QueryClientProvider client={queryClient}>
    {mostrarClinico && <Cabecalho />}
    {mostrarClinico && <AlarmeAtivo />}
    {!rotaAdmin && <Splash />}
    {autenticado === null && !rotaPublica ? <div className="min-h-screen" /> : <Outlet />}
    {mostrarClinico && <Rodape />}
    <Toaster position="top-center" />
  </QueryClientProvider>;
}
