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
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0f4d47" },
      { name: "author", content: "Veterício Serviços Veterinários LTDA" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap",
      },
      { rel: "manifest", href: "/manifest.webmanifest?v=8" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", type: "image/png", href: "/icon-192.png" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [autenticado, setAutenticado] = useState<boolean | null>(null);

  useEffect(() => {
    let ativo = true;

    async function validarSessao(session: any) {
      if (!session?.user?.id) {
        if (ativo) setAutenticado(false);
        return;
      }

      const { data, error } = await (supabase as any)
        .from("app_users")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!ativo) return;
      if (error) {
        console.error("Falha ao validar autorização do usuário:", error);
        setAutenticado(false);
        return;
      }

      setAutenticado(Boolean(data?.user_id));
    }

    supabase.auth.getSession().then(({ data }) => void validarSessao(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void validarSessao(session);
    });

    return () => {
      ativo = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const rotaPublica = location.pathname === "/login" || location.pathname === "/planos";
    if (autenticado === false && !rotaPublica) navigate({ to: "/login" });
  }, [autenticado, location.pathname, navigate]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
        console.error("Falha ao registrar service worker do Veterício:", error);
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {location.pathname !== "/login" && location.pathname !== "/planos" && autenticado && <Cabecalho />}

      <AlarmeAtivo />

      <Splash />

      {autenticado === null && location.pathname !== "/login" && location.pathname !== "/planos" ? <div className="min-h-screen" /> : <Outlet />}
      {location.pathname !== "/login" && location.pathname !== "/planos" && autenticado && <Rodape />}
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
