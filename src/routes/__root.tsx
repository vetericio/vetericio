import { oricseStorage } from "@/lib/oricse-storage";
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
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import premiumCss from "../themes-premium.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { RockDecoracao } from "@/components/RockDecoracao";
import { AlarmeAtivo } from "@/components/AlarmeAtivo";
import { Rodape } from "@/components/Rodape";
import { NatalVivoDecoracao } from "@/components/NatalVivoDecoracao";
import { supabase, supabaseBanco, supabaseConfigurado } from "@/integrations/supabase/client";
import { hidratarOricseStorage, limparMemoriaOricse } from "@/lib/oricse-storage";
import { migrarCodigosTutoresLocais } from "@/lib/codigo-tutor";
import { aplicarTema, carregarCor, carregarTema } from "@/lib/tema";
import {
  TenantContext,
  hostDaPagina,
  slugDaRota,
  type ClinicPortalInfo,
} from "@/lib/tenant-context";

// O cabeçalho clínico inicia sincronizações e dependências próprias. Mantê-lo
// fora do bundle inicial deixa login, início e administração responsivos.
const Cabecalho = lazy(() =>
  import("@/components/Cabecalho").then((module) => ({ default: module.Cabecalho })),
);
const VisualPageRuntime = lazy(() =>
  import("@/components/VisualPageRuntime").then((module) => ({
    default: module.VisualPageRuntime,
  })),
);

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Voltar
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    const erro = error instanceof Error ? error : new Error(String(error));
    reportLovableError(erro, { boundary: "tanstack_root_error_component" });
  }, [error]);
  useEffect(() => {
    // A troca de versão pode deixar o HTML aberto apontando para chunks já
    // removidos no deploy. A antiga proteção usava memória em JS e era perdida
    // no reload, impedindo uma recuperação confiável no Firefox e em PWAs.
    const url = new URL(window.location.href);
    if (url.searchParams.has("oricse_recovery")) return;
    url.searchParams.set("oricse_recovery", "1");
    url.searchParams.set("oricse_build", String(Date.now()));
    void (async () => {
      try {
        const registros =
          "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistrations() : [];
        await Promise.all(registros.map((registro) => registro.unregister()));
        if ("caches" in window) {
          const chaves = await caches.keys();
          await Promise.all(chaves.map((chave) => caches.delete(chave)));
        }
      } catch (erroRecuperacao) {
        console.warn("Não foi possível limpar o cache do ORICSE:", erroRecuperacao);
      }
      window.location.replace(url.toString());
    })();
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Esta página não carregou</h1>
        <div className="mt-6">
          <button
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.delete("oricse_recovery");
              window.history.replaceState(null, "", url.toString());
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Tentar novamente
          </button>
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
      { name: "theme-color", content: "#4A1826" },
      { name: "author", content: "Oricse" },
      { name: "description", content: "Sistema de gestão para clínicas veterinárias e petshops." },
      { property: "og:site_name", content: "Oricse" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:image", content: "https://oricse.vetericio.workers.dev/oricse-logo-oryx.svg" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: premiumCss },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap",
      },
      { rel: "manifest", href: "/manifest.webmanifest?v=13" },
      { rel: "canonical", href: "https://oricse.vetericio.workers.dev/" },
      { rel: "icon", type: "image/svg+xml", href: "/oricse-logo-oryx.svg?v=14" },
      { rel: "shortcut icon", type: "image/svg+xml", href: "/oricse-logo-oryx.svg?v=14" },
      { rel: "apple-touch-icon", type: "image/png", href: "/icon-192.png?v=13" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
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
  const [role, setRole] = useState<string | null>(null);
  const [acessoTeste, setAcessoTeste] = useState<any>(null);
  const [acessoAssinatura, setAcessoAssinatura] = useState<any>(null);
  const [portal, setPortal] = useState<ClinicPortalInfo | null>(null);
  const [portalLoading, setPortalLoading] = useState(true);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [acessoPortalNegado, setAcessoPortalNegado] = useState(false);
  const [slugClinicaAtual, setSlugClinicaAtual] = useState("");
  const [dadosDriveProntos, setDadosDriveProntos] = useState(false);
  const [menuFixo, setMenuFixo] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data: sessao } = await supabase.auth.getSession();
      if (!sessao.session?.user || !ativo) return;
      const { data, error } = await (supabaseBanco as any)
        .from("oricse_preferencias_usuario")
        .select("menu_lateral_fixo")
        .eq("user_id", sessao.session.user.id)
        .maybeSingle();
      if (!error && ativo) setMenuFixo(Boolean(data?.menu_lateral_fixo));
    })();
    return () => {
      ativo = false;
    };
  }, [autenticado]);

  const alterarMenuFixo = async (fixo: boolean) => {
    setMenuFixo(fixo);
    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao.session?.user) return;
    const { error } = await (supabaseBanco as any).from("oricse_preferencias_usuario").upsert({
      user_id: sessao.session.user.id,
      menu_lateral_fixo: fixo,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      setMenuFixo(!fixo);
      toast.error("Não foi possível salvar a preferência do menu.");
    }
  };

  // As rotas canônicas não redirecionam para seus aliases. O alias serve
  // como atalho para a rota original e preserva links internos já existentes.

  useEffect(() => {
    let ativo = true;
    async function resolverPortal() {
      const slug = slugDaRota(location.pathname);
      const host = hostDaPagina();
      const hostDaPlataforma =
        host === "oricse.com" ||
        host === "www.oricse.com" ||
        host === "localhost" ||
        host === "127.0.0.1" ||
        host.endsWith(".lovable.app") ||
        host.endsWith(".workers.dev");
      // Nas telas internas do domínio da plataforma não existe portal para
      // resolver. Evitar essa RPC remove uma espera de rede de cada troca de
      // página e libera a validação de sessão imediatamente.
      if (!slug && hostDaPlataforma) {
        if (ativo) {
          setPortal(null);
          setPortalError(null);
          setPortalLoading(false);
        }
        return;
      }
      try {
        const { data, error } = await supabase.rpc("oricse_clinica_publica_portal", {
          p_host: host || undefined,
          p_slug: slug || undefined,
        });
        if (error) throw error;
        const clinica = data?.[0];
        if (!ativo) return;
        if (clinica) {
          setPortal(clinica);
          setPortalError(null);
        } else {
          setPortal(null);
          setPortalError(
            slug || !hostDaPlataforma
              ? "O endereço ainda não está vinculado a uma clínica ativa."
              : null,
          );
        }
      } catch (error) {
        console.error("Não foi possível resolver o domínio da clínica:", error);
        if (!ativo) return;
        setPortal(null);
        setPortalError(
          slug || !hostDaPlataforma
            ? "Não foi possível carregar este endereço. Confirme a configuração do site e tente novamente."
            : null,
        );
      } finally {
        if (ativo) setPortalLoading(false);
      }
    }
    setPortalLoading(true);
    void resolverPortal();
    return () => {
      ativo = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    if (portalLoading) return;
    if (!supabaseConfigurado) {
      setAutenticado(false);
      setRole(null);
      setAcessoTeste(null);
      setAcessoPortalNegado(false);
      return;
    }

    let ativo = true;
    async function validarSessao(session: any) {
      if (!session?.user?.id) {
        if (ativo) {
          setAutenticado(false);
          setRole(null);
          setAcessoTeste(null);
          setAcessoPortalNegado(false);
          setSlugClinicaAtual("");
        }
        return;
      }
      const { data, error } = await (supabase as any)
        .from("app_users")
        .select("user_id, role")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!ativo) return;
      if (error || !data?.user_id) {
        setAutenticado(false);
        setRole(null);
        setAcessoTeste(null);
        setAcessoPortalNegado(false);
        return;
      }
      const papel = data.role || "usuario";
      setAcessoPortalNegado(false);
      if (papel !== "admin") {
        try {
          const { data: contexto, error: erroContexto } = await supabase.rpc(
            "oricse_contexto_clinica_atual",
          );
          if (erroContexto) throw erroContexto;
          const clinica = contexto?.[0];
          if (!clinica?.clinica_id)
            throw new Error("Este usuário ainda não está vinculado a uma clínica.");
          setSlugClinicaAtual(clinica.clinica_slug || "");
          if (typeof clinica.clinica_nome === "string")
            migrarCodigosTutoresLocais(clinica.clinica_nome);
          if (portal && clinica.clinica_id !== portal.clinica_id) {
            setAcessoPortalNegado(true);
          } else if (portal) {
            const { data: permitido, error: erroAcesso } = await supabase.rpc(
              "oricse_usuario_pode_acessar_portal",
              { p_clinica_id: portal.clinica_id },
            );
            if (erroAcesso) throw erroAcesso;
            setAcessoPortalNegado(!permitido);
          }
        } catch (error) {
          console.error("Não foi possível validar o acesso à clínica:", error);
          setAcessoPortalNegado(true);
        }
      }
      if (!ativo) return;
      setAutenticado(true);
      setRole(papel);
      if (papel === "admin") {
        setAcessoTeste(null);
        setSlugClinicaAtual("");
        return;
      }
      const [acessoResp, assinaturaResp] = await Promise.all([
        (supabase as any).rpc("oricse_meu_acesso"),
        (supabase as any).rpc("oricse_meu_status_assinatura"),
      ]);
      if (!ativo) return;
      const item = Array.isArray(acessoResp.data) ? acessoResp.data[0] : acessoResp.data;
      const assinatura = Array.isArray(assinaturaResp.data) ? assinaturaResp.data[0] : assinaturaResp.data;
      setAcessoTeste(item || null);
      setAcessoAssinatura(assinatura || null);
    }
    supabase.auth.getSession().then(({ data }) => void validarSessao(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => void validarSessao(session),
    );
    return () => {
      ativo = false;
      listener.subscription.unsubscribe();
    };
  }, [portal?.clinica_id, portalLoading]);

  useEffect(() => {
    let ativo = true;
    if (!autenticado) {
      limparMemoriaOricse();
      setDadosDriveProntos(false);
      return () => {
        ativo = false;
      };
    }
    // A conta da plataforma não pertence a uma clínica específica. Não existe
    // estado operacional global para hidratar; tentar carregá-lo deixava o
    // admin preso indefinidamente em “Sincronizando os dados”.
    if (role === "admin") {
      setDadosDriveProntos(true);
      return () => {
        ativo = false;
      };
    }
    setDadosDriveProntos(false);
    void hidratarOricseStorage(true)
      .then(() => {
        if (ativo) setDadosDriveProntos(true);
      })
      .catch((error) => {
        console.error("Não foi possível carregar os dados do Google Drive:", error);
        if (ativo) setDadosDriveProntos(false);
      });
    return () => {
      ativo = false;
    };
  }, [autenticado, role]);

  useEffect(() => {
    // O tema pertence ao app inteiro. Reaplicá-lo após a hidratação do estado
    // da clínica e nas trocas de rota evita que uma tela ou montagem do rodapé
    // o substitua pelo tema padrão.
    if (!autenticado || !dadosDriveProntos || role === "admin") return;
    aplicarTema(carregarTema(), carregarCor());
  }, [autenticado, dadosDriveProntos, role, location.pathname]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("visual_editor") && autenticado === true && role === "admin") return;
    if (/^\/pet\/[^/]+(?:\/portal)?\/?$/.test(location.pathname)) return;
    const rotaPublica =
      ["/", "/login", "/planos", "/contratar", "/contratacao-recebida", "/termos-de-uso", "/politica-de-privacidade", "/demo-portal-tutor"].includes(location.pathname) ||
      location.pathname.startsWith("/vet/") ||
      /^\/pet\/[^/]+(?:\/portal)?\/?$/.test(location.pathname);
    const rotaAdmin = location.pathname.startsWith("/admin");
    if (autenticado === false && !rotaPublica && !rotaAdmin) navigate({ to: "/login" });
    if (autenticado && acessoPortalNegado) return;
    if (
      autenticado &&
      (location.pathname === "/login" ||
        location.pathname.startsWith("/vet/") ||
        (portal && location.pathname === "/"))
    ) {
      if (role === "admin") navigate({ to: "/inicio" });
      else if (slugClinicaAtual && location.pathname.startsWith("/vet/"))
        navigate({ to: "/inicio" });
      else if (slugClinicaAtual && location.pathname === "/login")
        navigate({ to: `/vet/${slugClinicaAtual}` as never });
      else if (role !== "admin") navigate({ to: "/inicio" });
    }
  }, [
    autenticado,
    acessoPortalNegado,
    role,
    slugClinicaAtual,
    portal,
    location.pathname,
    navigate,
  ]);

  // O administrador usa o catálogo React nativo em Site e marca.
  // O iframe antigo de planos foi removido: não deve alterar o layout do Admin.

  useEffect(() => {
    if (location.pathname !== "/consultorio" && location.pathname !== "/recepcao") return;

    const normalizar = (valor?: string | null) =>
      (valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const localizarAnimalId = (aside: HTMLElement) => {
      const titulo = normalizar(aside.querySelector("h3")?.textContent)
        .replace(/^[^a-z0-9]+/i, "")
        .trim();
      const tutorTexto =
        Array.from(aside.querySelectorAll("p"))
          .find((p) => (p.textContent || "").trim().startsWith("Tutor:"))
          ?.textContent?.replace(/^Tutor:\s*/i, "") || "";
      const tutorNormalizado = normalizar(tutorTexto);

      try {
        const tutores = JSON.parse(oricseStorage.getItem("oricse-tutores-v1") || "[]") as any[];
        const animais = JSON.parse(oricseStorage.getItem("oricse-animais-v1") || "[]") as any[];
        const tutor = tutores.find((item: any) => normalizar(item?.nome) === tutorNormalizado);
        if (!tutor) return "";
        const animal = animais.find(
          (item: any) =>
            String(item?.tutorId || item?.tutor_id || "") === String(tutor.id) &&
            titulo.includes(normalizar(item?.nome)),
        );
        return animal?.id ? String(animal.id) : "";
      } catch {
        return "";
      }
    };

    const aprimorarPainelAnimal = () => {
      const botaoOriginal = Array.from(document.querySelectorAll("aside button")).find(
        (botao) => (botao.textContent || "").trim() === "Abrir cadastro e prontuário",
      ) as HTMLButtonElement | undefined;
      const botaoIniciar =
        botaoOriginal ||
        (Array.from(document.querySelectorAll("aside button")).find(
          (botao) => (botao.textContent || "").trim() === "Iniciar atendimento",
        ) as HTMLButtonElement | undefined);
      if (!botaoIniciar) return;
      const aside = botaoIniciar.closest("aside") as HTMLElement | null;
      if (!aside) return;

      botaoIniciar.textContent = "Iniciar atendimento";
      botaoIniciar.className =
        "flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground";
      botaoIniciar.onclick = () => {
        const animalId = localizarAnimalId(aside);
        if (!animalId) {
          window.alert("Este agendamento ainda não está vinculado a um animal cadastrado.");
          return;
        }
        navigate({ to: "/animal", search: { animalId } as never });
      };

      let acoes = aside.querySelector(
        "[data-oricse-atendimento-acoes='1']",
      ) as HTMLDivElement | null;
      if (!acoes) {
        acoes = document.createElement("div");
        acoes.dataset["oricseAtendimentoAcoes"] = "1";
        acoes.className = "flex gap-2";
        botaoIniciar.parentElement?.insertBefore(acoes, botaoIniciar);
        acoes.appendChild(botaoIniciar);
      }

      let finalizar = acoes.querySelector(
        "[data-oricse-finalizar='1']",
      ) as HTMLButtonElement | null;
      if (!finalizar) {
        finalizar = document.createElement("button");
        finalizar.type = "button";
        finalizar.dataset["oricseFinalizar"] = "1";
        finalizar.textContent = "Finalizar atendimento";
        finalizar.className =
          "flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700";
        acoes.appendChild(finalizar);
      }

      finalizar.onclick = () => {
        const nomeAnimal = normalizar(aside.querySelector("h3")?.textContent);
        const tutorTexto =
          Array.from(aside.querySelectorAll("p"))
            .find((p) => (p.textContent || "").trim().startsWith("Tutor:"))
            ?.textContent?.replace(/^Tutor:\s*/i, "") || "";
        const tutor = normalizar(tutorTexto);
        const candidatos = Array.from(document.querySelectorAll("button")).filter(
          (botao) =>
            (botao.textContent || "").trim() === "Finalizar atendimento" && botao !== finalizar,
        ) as HTMLButtonElement[];
        const alvo =
          candidatos.find((botao) => {
            const texto = normalizar(botao.parentElement?.textContent);
            return (
              texto &&
              nomeAnimal.split(" ").some((parte) => parte.length > 2 && texto.includes(parte)) &&
              (!tutor || texto.includes(tutor))
            );
          }) || candidatos[0];
        if (!alvo) {
          window.alert("Não foi possível localizar este atendimento na agenda.");
          return;
        }
        const fechar = aside.querySelector(
          "button:not([data-oricse-finalizar='1'])",
        ) as HTMLButtonElement | null;
        fechar?.click();
        setTimeout(() => alvo.click(), 0);
      };
    };

    const observer = new MutationObserver(() => aprimorarPainelAnimal());
    observer.observe(document.body, { childList: true, subtree: true });
    aprimorarPainelAnimal();
    return () => observer.disconnect();
  }, [location.pathname, navigate]);

  useEffect(() => {
    const recuperarModuloExpirado = (event: Event | PromiseRejectionEvent) => {
      const motivo = event instanceof PromiseRejectionEvent ? event.reason : event;
      const mensagem = motivo instanceof Error ? motivo.message : String(motivo ?? "");
      if (!/dynamically imported module|vite:preloaderror/i.test(mensagem)) return;
      event.preventDefault?.();
      const url = new URL(window.location.href);
      if (url.searchParams.has("oricse_module_retry")) return;
      url.searchParams.set("oricse_module_retry", "1");
      url.searchParams.set("oricse_build", String(Date.now()));
      void navigator.serviceWorker
        ?.getRegistrations()
        .then((registros) => Promise.all(registros.map((registro) => registro.unregister())))
        .finally(() => window.location.replace(url.toString()));
    };

    window.addEventListener("vite:preloadError", recuperarModuloExpirado);
    window.addEventListener("unhandledrejection", recuperarModuloExpirado);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js?v=13", { scope: "/" }).catch(() => undefined);
    return () => {
      window.removeEventListener("vite:preloadError", recuperarModuloExpirado);
      window.removeEventListener("unhandledrejection", recuperarModuloExpirado);
    };
  }, []);

  const rotaAdmin = location.pathname.startsWith("/admin");
  const rotaPublica =
    ["/", "/login", "/planos", "/contratar", "/contratacao-recebida", "/termos-de-uso", "/politica-de-privacidade", "/demo-portal-tutor"].includes(location.pathname) ||
    location.pathname.startsWith("/vet/") ||
    /^\/pet\/[^/]+(?:\/portal)?\/?$/.test(location.pathname);
  const testeExpirado = Boolean(acessoTeste?.teste_expirado);
  const testeAtivo = Boolean(acessoTeste?.teste_ativo);
  const assinaturaBloqueada = role !== "admin" && acessoAssinatura?.situacao === "bloqueada";
  const assinaturaEmAviso = role !== "admin" && acessoAssinatura?.situacao === "aviso";
  const mostrarClinico = autenticado && !rotaAdmin && !rotaPublica && !testeExpirado && !assinaturaBloqueada;
  const mostrarBloqueioTeste = autenticado && role !== "admin" && !rotaAdmin && !rotaPublica && testeExpirado;
  const mostrarBloqueioAssinatura = autenticado && role !== "admin" && !rotaAdmin && !rotaPublica && assinaturaBloqueada;
  const telaAdminRestrita = rotaAdmin && autenticado !== null && role !== "admin";
  const telaPortalRestrita = Boolean(
    !/^\/pet\/[^/]+(?:\/portal)?\/?$/.test(location.pathname) &&
    autenticado &&
    role !== "admin" &&
    (acessoPortalNegado || (!portal && Boolean(portalError))),
  );
  const contextoPortal = { portal, loading: portalLoading, error: portalError };
  const mostrarRuntimeVisual = location.pathname !== "/admin-canvas";

  // Protótipos públicos são isolados do layout clínico e de suas barras de navegação.
  if (location.pathname === "/demo-portal-tutor") {
    return (
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster position="top-center" />
      </QueryClientProvider>
    );
  }

  // Documentos legais permanecem isolados do shell; somente os ajustes visuais
  // publicados pelo administrador podem ser aplicados a essas páginas.
  if (location.pathname === "/termos-de-uso" || location.pathname === "/politica-de-privacidade" || location.pathname === "/contratacao-recebida") {
    return (
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={null}><VisualPageRuntime /></Suspense>
        <Outlet />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TenantContext.Provider value={contextoPortal}>
        {mostrarRuntimeVisual && (
          <Suspense fallback={null}>
            <VisualPageRuntime />
          </Suspense>
        )}
        {mostrarClinico && <NatalVivoDecoracao />}
        {mostrarClinico && <RockDecoracao />}
        {mostrarClinico && (
          <div className={menuFixo ? "pl-16 lg:pl-80" : ""}>
            <Suspense fallback={null}>
              <Cabecalho menuFixo={menuFixo} aoMudarMenuFixo={alterarMenuFixo} />
            </Suspense>
          </div>
        )}
        {mostrarClinico && (
          <div className={menuFixo ? "pl-16 lg:pl-80" : ""}>
            <AlarmeAtivo />
          </div>
        )}
        {assinaturaEmAviso && mostrarClinico && <div className={menuFixo ? "pl-16 lg:pl-80" : ""}><div className="mx-auto mt-3 max-w-4xl rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-950">{acessoAssinatura?.mensagem || "Sua assinatura venceu. Regularize para evitar o bloqueio."}</div></div>}
        {testeAtivo && mostrarClinico && (
          <div className={menuFixo ? "pl-16 lg:pl-80" : ""}>
            <div className="mx-auto mt-3 max-w-4xl rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-center text-sm font-semibold text-primary">
              💚 Seu teste gratuito está ativo. {Number(acessoTeste?.dias_restantes || 0)} dia(s)
              restante(s).
            </div>
          </div>
        )}
        {rotaAdmin && autenticado === null ? (
          <div className="min-h-screen" />
        ) : telaAdminRestrita ? (
          <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
            <section className="w-full max-w-md rounded-2xl border bg-card p-7 text-center shadow-sm">
              <h1 className="text-2xl font-bold">Acesso restrito</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                A área administrativa é exclusiva da equipe Oricse.
              </p>
              <Link
                to="/"
                className="mt-5 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Voltar ao início
              </Link>
            </section>
          </main>
        ) : telaPortalRestrita ? (
          <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
            <section className="w-full max-w-md rounded-2xl border bg-card p-7 text-center shadow-sm">
              <h1 className="text-2xl font-bold">Acesso não autorizado</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {portal
                  ? "Esta conta pertence a outra clínica. Entre pelo endereço da clínica à qual seu usuário está vinculado."
                  : portalError
                    ? portalError
                    : "Esta conta não está vinculada a uma clínica ativa. Solicite acesso ao responsável da sua clínica."}
              </p>
              <button
                type="button"
                onClick={() => void supabase.auth.signOut()}
                className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Sair desta conta
              </button>
            </section>
          </main>
        ) : autenticado && !rotaPublica && !dadosDriveProntos ? (
          <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
            Sincronizando os dados no sistema Oricse...
          </div>
        ) : autenticado === null && !rotaPublica && !rotaAdmin ? (
          <div className="min-h-screen" />
        ) : mostrarBloqueioAssinatura ? (
          <main className="flex min-h-[75vh] items-center justify-center bg-background px-4 py-10"><section className="w-full max-w-xl rounded-3xl border bg-card p-7 text-center shadow-lg"><div className="text-4xl">🔒</div><p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-primary">Assinatura ORICSE</p><h1 className="mt-2 text-3xl font-bold">{acessoAssinatura?.titulo || "Acesso administrativo bloqueado"}</h1><p className="mt-3 text-muted-foreground">{acessoAssinatura?.mensagem || "Regularize a assinatura para continuar usando o sistema."}</p><div className="mt-5 rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">O Portal do Tutor continua ativo, incluindo documentos, agenda e pagamentos online.</div><Link to="/plano-clinica" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground">Ver assinatura e regularizar</Link></section></main>
        ) : mostrarBloqueioTeste ? (
          <main className="flex min-h-[75vh] items-center justify-center bg-background px-4 py-10">
            <section className="w-full max-w-xl rounded-3xl border bg-card p-7 text-center shadow-lg">
              <div className="text-4xl">💚</div>
              <h1 className="mt-4 text-3xl font-bold">
                Seu período de carinho com a Oricse chegou ao fim
              </h1>
              <p className="mt-3 text-muted-foreground">
                Seus dados estão guardadinhos aqui, exatamente como você deixou. Para continuar
                usando a Oricse, escolha um plano e regularize sua conta.
              </p>
              <div className="mt-5 rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
                <p>Nada foi apagado.</p>
                <p className="mt-1">
                  Enquanto a conta estiver pausada, edição, exportações, PDFs, downloads e backups
                  ficam indisponíveis.
                </p>
              </div>
              <Link
                to="/planos"
                className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground"
              >
                Escolher meu plano
              </Link>
            </section>
          </main>
        ) : (
          <div className={mostrarClinico && menuFixo ? "pl-16 lg:pl-80" : ""}>
            <Outlet />
          </div>
        )}
        {mostrarClinico && (
          <div className={menuFixo ? "pl-16 lg:pl-80" : ""}>
            <Rodape />
          </div>
        )}
        <Toaster position="top-center" />
      </TenantContext.Provider>
    </QueryClientProvider>
  );
}
