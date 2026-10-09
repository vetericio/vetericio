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
  head: () => ({ meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" }, { name: "theme-color", content: "#0f4d47" }, { name: "author", content: "Oricse" }], links: [{ rel: "stylesheet", href: appCss }, { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" }, { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap" }, { rel: "manifest", href: "/manifest.webmanifest?v=13" }, { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-oricse.png?v=13" }, { rel: "shortcut icon", type: "image/png", href: "/favicon-oricse.png?v=13" }, { rel: "apple-touch-icon", type: "image/png", href: "/icon-192.png?v=13" }] }),
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
  const [acessoTeste, setAcessoTeste] = useState<any>(null);

  useEffect(() => {
    let ativo = true;
    async function validarSessao(session: any) {
      if (!session?.user?.id) { if (ativo) { setAutenticado(false); setRole(null); setAcessoTeste(null); } return; }
      const { data, error } = await (supabase as any).from("app_users").select("user_id, role").eq("user_id", session.user.id).maybeSingle();
      if (!ativo) return;
      if (error || !data?.user_id) { setAutenticado(false); setRole(null); setAcessoTeste(null); return; }
      const papel = data.role || "usuario";
      setAutenticado(true);
      setRole(papel);
      if (papel === "admin") {
        setAcessoTeste(null);
        return;
      }
      const { data: acesso } = await (supabase as any).rpc("oricse_meu_acesso");
      if (!ativo) return;
      const item = Array.isArray(acesso) ? acesso[0] : acesso;
      setAcessoTeste(item || null);
    }
    supabase.auth.getSession().then(({ data }) => void validarSessao(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => void validarSessao(session));
    return () => { ativo = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const rotaPublica = location.pathname === "/login" || location.pathname === "/planos" || location.pathname === "/contratar";
    if (autenticado === false && !rotaPublica) navigate({ to: "/login" });
    if (autenticado && role === "admin" && location.pathname === "/") navigate({ to: "/admin" });
  }, [autenticado, role, location.pathname, navigate]);

  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined); }, []);

  const rotaAdmin = location.pathname.startsWith("/admin");
  const rotaPublica = location.pathname === "/login" || location.pathname === "/planos" || location.pathname === "/contratar";
  const testeExpirado = Boolean(acessoTeste?.teste_expirado);
  const testeAtivo = Boolean(acessoTeste?.teste_ativo);
  const mostrarClinico = autenticado && !rotaAdmin && !rotaPublica && !testeExpirado;
  const mostrarBloqueioTeste = autenticado && role !== "admin" && !rotaAdmin && !rotaPublica && testeExpirado;

  return <QueryClientProvider client={queryClient}>
    {mostrarClinico && <Cabecalho />}
    {mostrarClinico && <AlarmeAtivo />}
    {!rotaAdmin && <Splash />}
    {testeAtivo && mostrarClinico && <div className="mx-auto mt-3 max-w-4xl rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-center text-sm font-semibold text-primary">💚 Seu teste gratuito está ativo. {Number(acessoTeste?.dias_restantes || 0)} dia(s) restante(s).</div>}
    {autenticado === null && !rotaPublica ? <div className="min-h-screen" /> : mostrarBloqueioTeste ? <main className="flex min-h-[75vh] items-center justify-center bg-background px-4 py-10"><section className="w-full max-w-xl rounded-3xl border bg-card p-7 text-center shadow-lg"><div className="text-4xl">💚</div><h1 className="mt-4 text-3xl font-bold">Seu período de carinho com a Oricse chegou ao fim</h1><p className="mt-3 text-muted-foreground">Seus dados estão guardadinhos aqui, exatamente como você deixou. Para continuar usando a Oricse, escolha um plano e regularize sua conta.</p><div className="mt-5 rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground"><p>Nada foi apagado.</p><p className="mt-1">Enquanto a conta estiver pausada, edição, exportações, PDFs, downloads e backups ficam indisponíveis.</p></div><Link to="/planos" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground">Escolher meu plano</Link></section></main> : <Outlet />}
    {mostrarClinico && <Rodape />}
    <Toaster position="top-center" />
  </QueryClientProvider>;
}
