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
      if (papel === "admin") { setAcessoTeste(null); return; }
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

  useEffect(() => {
    if (role !== "admin" || location.pathname !== "/admin") return;

    let observer: MutationObserver | null = null;
    let inputHandler: ((event: Event) => void) | null = null;
    let clickHandler: ((event: MouseEvent) => void) | null = null;

    const removerCanvas = () => {
      const canvas = document.getElementById("oricse-admin-site-canvas");
      canvas?.remove();
      const section = document.querySelector("main section") as HTMLElement | null;
      if (section?.dataset.oricseCanvas === "1") {
        section.style.display = "";
        section.style.gridTemplateColumns = "";
        section.style.gap = "";
        delete section.dataset.oricseCanvas;
      }
      if (observer) { observer.disconnect(); observer = null; }
      if (inputHandler && section) { section.removeEventListener("input", inputHandler, true); inputHandler = null; }
    };

    const montarCanvas = () => {
      removerCanvas();
      const siteButton = Array.from(document.querySelectorAll("nav button")).find((b) => (b.textContent || "").trim() === "Site e marca") as HTMLButtonElement | undefined;
      const ativo = Boolean(siteButton?.className.includes("bg-primary"));
      if (!ativo) return;

      const layout = siteButton?.closest("nav")?.parentElement?.parentElement as HTMLElement | null;
      const section = layout?.querySelector(":scope > section") as HTMLElement | null;
      if (!section || document.getElementById("oricse-admin-site-canvas")) return;

      section.dataset.oricseCanvas = "1";
      section.style.display = "grid";
      section.style.gridTemplateColumns = window.innerWidth >= 1280 ? "minmax(0, 1fr) minmax(460px, .9fr)" : "1fr";
      section.style.gap = "20px";

      const canvas = document.createElement("div");
      canvas.id = "oricse-admin-site-canvas";
      canvas.style.position = window.innerWidth >= 1280 ? "sticky" : "relative";
      canvas.style.top = "16px";
      canvas.style.alignSelf = "start";
      canvas.style.minWidth = "0";
      canvas.innerHTML = `<div style="border:1px solid #d8ddd9;border-radius:18px;background:white;box-shadow:0 1px 3px rgba(0,0,0,.08);overflow:hidden"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid #e6e8e6"><div><strong style="font-size:15px">Canvas · Página de planos</strong><div style="font-size:12px;color:#6b7280;margin-top:2px">Preview ao vivo dentro do Admin</div></div><div style="display:flex;gap:8px;align-items:center"><a href="/admin-canvas" style="display:inline-flex;align-items:center;justify-content:center;padding:9px 13px;border-radius:10px;background:#006b5b;color:white;font-size:12px;font-weight:800;text-decoration:none">Abrir canvas</a><a href="/planos" target="_blank" style="font-size:12px;font-weight:700;color:#006b5b;text-decoration:none">Abrir página ↗</a></div></div><div style="height:72vh;min-height:620px;background:#f6f4ef"><iframe id="oricse-planos-preview-frame" src="/planos?admin_preview=1" title="Preview da página de planos" style="width:100%;height:100%;border:0;background:#f6f4ef"></iframe></div></div>`;
      section.appendChild(canvas);

      const sincronizar = () => {
        const iframe = document.getElementById("oricse-planos-preview-frame") as HTMLIFrameElement | null;
        const doc = iframe?.contentDocument;
        if (!doc) return;
        const labels = Array.from(section.querySelectorAll("label"));
        const valor = (inicio: string) => {
          const label = labels.find((l) => (l.textContent || "").trim().startsWith(inicio));
          const campo = label?.querySelector("input,textarea") as HTMLInputElement | HTMLTextAreaElement | null;
          return campo?.value || "";
        };
        const h1 = doc.querySelector("main header h1") as HTMLElement | null;
        const subtitle = doc.querySelector("main header p.mt-3") as HTMLElement | null;
        const logo = doc.querySelector("main header img") as HTMLImageElement | null;
        const titulo = valor("Título da página de planos");
        const subtitulo = valor("Subtítulo");
        const botao = valor("Texto do botão");
        if (h1 && titulo) h1.textContent = titulo;
        if (subtitle && subtitulo) subtitle.textContent = subtitulo;
        if (botao) doc.querySelectorAll("article button").forEach((b) => { if (!(b.textContent || "").toLowerCase().includes("grátis")) b.textContent = botao; });
        const adminLogo = Array.from(section.querySelectorAll("img")).find((img) => (img.getAttribute("alt") || "").toLowerCase().includes("oricse")) as HTMLImageElement | undefined;
        if (logo && adminLogo?.src) logo.src = adminLogo.src;
      };

      const iframe = canvas.querySelector("iframe") as HTMLIFrameElement;
      iframe.addEventListener("load", () => setTimeout(sincronizar, 100));
      inputHandler = () => setTimeout(sincronizar, 0);
      section.addEventListener("input", inputHandler, true);
      observer = new MutationObserver(() => setTimeout(sincronizar, 0));
      observer.observe(section, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
    };

    clickHandler = () => setTimeout(montarCanvas, 50);
    document.addEventListener("click", clickHandler, true);
    setTimeout(montarCanvas, 100);

    const resize = () => setTimeout(montarCanvas, 50);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("click", clickHandler!, true);
      window.removeEventListener("resize", resize);
      removerCanvas();
    };
  }, [role, location.pathname]);

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
