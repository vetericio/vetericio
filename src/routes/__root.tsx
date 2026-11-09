import { oricseStorage } from "@/lib/oricse-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useLocation,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";

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
import { ClinicasAtivasContext } from "@/lib/clinicas-ativas-context";
import { semClinicasNaLixeira } from "@/lib/clinicas-visiveis";
import { AdminShell } from "@/components/admin/AdminShell";
import { isPlatformHostname } from "@/lib/public-clinic-site";

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

// A customização visual é opcional: uma falha num chunk dela não pode derrubar
// login, início, navegação clínica ou administração.
class OptionalRuntimeBoundary extends Component<{children: ReactNode; fallback?: ReactNode},{failed:boolean}> {
  override state = { failed: false };
  static getDerivedStateFromError(){return {failed:true};}
  override componentDidCatch(error: Error) { console.error("ORICSE optional runtime failed:", error); }
  override render() { return this.state.failed ? (this.props.fallback ?? null) : this.props.children; }
}

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

// Um deploy pode substituir chunks versionados enquanto uma aba antiga está aberta.
// Recuperação limitada, sem limpar dados da clínica, sessão nem credenciais.
const ERRO_MODULO = /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|failed to load module script|chunkloaderror|vite:preloaderror/i;
let recargaVersaoEmAndamento = false;

function mensagemDeErro(error: unknown): string {
  if (error instanceof Error) return error.name + ": " + error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error)
    return String((error as { message?: unknown }).message ?? "");
  return String(error ?? "");
}

function enderecoDeRecuperacao() {
  const atual = new URL(window.location.href);
  atual.searchParams.delete("oricse_recovery");
  atual.searchParams.delete("oricse_build");
  atual.searchParams.delete("oricse_module_retry");
  const destino = atual.pathname + atual.search + atual.hash;
  return "/atualizar.html?next=" + encodeURIComponent(destino);
}

async function recarregarVersaoAtual(forcar = false) {
  if (typeof window === "undefined" || recargaVersaoEmAndamento) return;
  // Sem este limite, um arquivo ausente faz a página entrar em loop infinito:
  // tela de erro -> atualizar.html -> mesmo erro -> atualizar.html.
  // Uma nova tentativa continua disponível pelo botão "Recarregar sistema".
  if (!forcar && new URLSearchParams(window.location.search).has("oricse_module_retry")) return;
  recargaVersaoEmAndamento = true;
  // Reabre o HTML atual e limpa apenas os caches antigos do app;
  // sessão, credenciais e dados clínicos não são removidos.
  window.location.replace(enderecoDeRecuperacao());
}

function ErrorComponent({ error }: { error: unknown; reset: () => void }) {
  console.error(error);
  useEffect(() => {
    const erro = error instanceof Error ? error : new Error(String(error));
    reportLovableError(erro, { boundary: "tanstack_root_error_component" });
  }, [error]);
  useEffect(() => {
    if (ERRO_MODULO.test(mensagemDeErro(error))) void recarregarVersaoAtual();
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Esta página não carregou</h1>
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => void recarregarVersaoAtual(true)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Recarregar sistema
            </button>
            <a href="/admin" className="rounded-md border px-4 py-2 text-sm font-medium">
              Abrir administração
            </a>
            <a href="/login" className="rounded-md border px-4 py-2 text-sm font-medium">
              Voltar ao login
            </a>
          </div>
          <p className="mt-5 break-words text-xs text-muted-foreground">
            Diagnóstico: {error instanceof Error ? error.message : String(error)}
          </p>
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
      { property: "og:image", content: "https://oricse.com.br/oricse-logo-oryx.svg" },
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
      { rel: "manifest", href: "/oricse-manifest-v16.webmanifest" },
      { rel: "canonical", href: "https://oricse.com.br/" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/oricse-favicon-32.png?v=16" },
      { rel: "shortcut icon", type: "image/png", href: "/oricse-favicon-32.png?v=16" },
      { rel: "apple-touch-icon", type: "image/png", sizes: "180x180", href: "/oricse-favicon-180.png?v=16" },
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
        <style>{"/* Home ORICSE: uma única composição proporcional em qualquer tela/zoom. */\nmain[data-visual-id=\"home-fundo-bege\"]{background:#fffdfa;color:#512b38;overflow-x:hidden}\nmain[data-visual-id=\"home-fundo-bege\"] [data-visual-id=\"home-cabecalho\"]{min-height:clamp(42px,4vw,76px);max-width:none;padding:0 clamp(12px,4vw,76px)}\nmain[data-visual-id=\"home-fundo-bege\"] [data-visual-id=\"home-menu-superior\"]{display:flex!important;gap:clamp(9px,2.8vw,32px);font-size:clamp(9px,1.05vw,16px);white-space:nowrap}\nmain[data-visual-id=\"home-fundo-bege\"] [data-visual-id=\"home-cabecalho\"]>button{display:none!important}\nmain[data-visual-id=\"home-fundo-bege\"] [data-visual-id=\"home-banner\"]{position:relative;isolation:isolate;background:transparent}\nmain[data-visual-id=\"home-fundo-bege\"] [data-visual-id=\"home-base-capa\"]{position:relative;width:100%;aspect-ratio:1.86/1;background:transparent}\nmain[data-visual-id=\"home-fundo-bege\"] [data-visual-id=\"home-imagem-oryx\"]{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:fill}\nmain[data-visual-id=\"home-fundo-bege\"] [data-visual-id=\"home-conteudo-banner\"]{position:absolute;inset:0;display:block;width:100%;max-width:none;padding:0}\nmain[data-visual-id=\"home-fundo-bege\"] [data-visual-id=\"home-conteudo-banner\"]>div{display:contents}\nmain[data-visual-id=\"home-fundo-bege\"] [data-home-hero-logo-wrap]{position:absolute;top:-4%;left:14%;width:auto;margin:0;z-index:10}\nmain[data-visual-id=\"home-fundo-bege\"] [data-visual-id=\"home-logo-oricse\"]{width:clamp(58px,12vw,200px);height:clamp(58px,12vw,200px);object-fit:contain}\nmain[data-visual-id=\"home-fundo-bege\"] [data-visual-id=\"home-selo\"]{position:absolute;top:25%;left:5%;z-index:10;margin:0;font-size:clamp(6px,.7vw,10px);padding:clamp(3px,.45vw,6px) clamp(7px,.8vw,12px)}\nmain[data-visual-id=\"home-fundo-bege\"] [data-visual-id=\"home-titulo-principal\"]{position:absolute;top:31%;left:5%;width:46%;max-width:none;margin:0;z-index:10;font-size:clamp(24px,5.3vw,98px);line-height:.91;letter-spacing:-.065em}\nmain[data-visual-id=\"home-fundo-bege\"] [data-visual-id=\"home-texto-apoio\"]{position:absolute;top:72%;left:5%;max-width:42%;margin:0;z-index:10;font-size:clamp(8px,1.05vw,18px);line-height:1.75}\nmain[data-visual-id=\"home-fundo-bege\"] [data-home-hero-actions]{position:absolute;top:85%;left:6%;display:flex;flex-wrap:nowrap;gap:clamp(4px,.65vw,12px);margin:0;z-index:10;transform-origin:left top;transform:scale(clamp(.42,1vw,.9))}\nmain[data-visual-id=\"home-fundo-bege\"] [data-visual-id=\"home-legenda-inferior\"]{position:absolute;bottom:1%;left:58%;margin:0;z-index:10;color:white;font-size:clamp(6px,.72vw,13px);white-space:nowrap}\n"}</style>
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
  // Uma clínica em seu subdomínio é uma página pública, mesmo que o visitante
  // tenha sessão aberta no sistema administrativo da ORICSE.
  const paginaInicialDeClinica =
    location.pathname === "/" &&
    Boolean(hostDaPagina()) &&
    !isPlatformHostname(hostDaPagina());
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
  const [quantidadeClinicasAtivas, setQuantidadeClinicasAtivas] = useState<number | null>(null);

  useEffect(() => {
    if (!autenticado || role !== "admin") {
      setQuantidadeClinicasAtivas(null);
      return;
    }
    let ativo = true;
    void (async () => {
      const { count, error } = await semClinicasNaLixeira(
        (supabaseBanco as any).from("clinicas").select("id", { count: "exact", head: true }),
      );
      if (!error && ativo) setQuantidadeClinicasAtivas(count || 0);
    })();
    return () => { ativo = false; };
  }, [autenticado, role]);

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
        host === "oricse.com.br" ||
        host === "app.oricse.com.br" ||
        host === "oricse.com" ||
        host === "www.oricse.com" ||
        host === "localhost" ||
        host === "127.0.0.1" ||
        host.endsWith(".lovable.app") ||
        host.endsWith(".workers.dev");
      // Nas telas internas do domínio da plataforma não existe portal para
      // resolver. Evitar essa RPC remove uma espera de rede de cada troca de
      // página e libera a validação de sessão imediatamente.
      if ((!slug && hostDaPlataforma) || (location.pathname === "/" && !hostDaPlataforma)) {
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
      ["/", "/login", "/modelos", "/solucoes", "/planos", "/contratar", "/contratacao-recebida", "/termos-de-uso", "/politica-de-privacidade", "/demo-portal-tutor"].includes(location.pathname) ||
      location.pathname.startsWith("/vet/") ||
      /^\/pet\/[^/]+(?:\/portal)?\/?$/.test(location.pathname);
    const rotaAdmin = location.pathname.startsWith("/admin") ||
    (location.pathname === "/oricstudio" && location.search?.ambiente === "plataforma");
    if (autenticado === false && !rotaPublica && !rotaAdmin) navigate({ to: "/login" });
    if (autenticado && acessoPortalNegado) return;
    if (
      autenticado &&
      (location.pathname === "/login" ||
        location.pathname.startsWith("/vet/") ||
        (portal && location.pathname === "/" && !paginaInicialDeClinica))
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
    paginaInicialDeClinica,
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

  // Uma aba que ficou aberta após um deploy deve reconciliar a versão sozinha.
  // O marcador é emitido junto dos assets no mesmo deploy; não afeta os dados
  // do paciente, a sessão ou as configurações persistidas.
  useEffect(() => {
    const versaoDestaAba = import.meta.env.VITE_ORICSE_BUILD_ID as string | undefined;
    if (!versaoDestaAba || typeof window === "undefined") return;
    let ativo = true;
    let verificando = false;
    async function verificarVersao() {
      if (!ativo || verificando || document.visibilityState !== "visible") return;
      verificando = true;
      try {
        const resposta = await fetch("/oricse-build.json", {
          cache: "no-store",
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        });
        if (!resposta.ok || !(resposta.headers.get("content-type") || "").includes("json")) return;
        const versaoPublicada = (await resposta.json() as {build?: string}).build;
        if (!ativo || !versaoPublicada || versaoPublicada === versaoDestaAba) return;
        // Use o estado da URL durante a atualização, sem persistir dados
        // no armazenamento do navegador.
        const atual = new URL(window.location.href);
        if (atual.searchParams.get("oricse_build") === versaoPublicada) return;
        atual.searchParams.set("oricse_build", versaoPublicada);
        window.location.replace(atual.pathname + atual.search + atual.hash);
        return;

      } catch {
        // Uma queda de rede temporária não pode interromper o trabalho.
      } finally {
        verificando = false;
      }
    }
    const aoFocar = () => { void verificarVersao(); };
    document.addEventListener("visibilitychange", aoFocar);
    window.addEventListener("focus", aoFocar);
    const intervalo = window.setInterval(aoFocar, 120000);
    void verificarVersao();
    return () => {
      ativo = false;
      document.removeEventListener("visibilitychange", aoFocar);
      window.removeEventListener("focus", aoFocar);
      window.clearInterval(intervalo);
    };
  }, []);

  // Remova o marcador do endereço quando o editor/rota estiver carregado.
  // A proteção de recuperação vale apenas durante a navegação problemática,
  // e não para todas as próximas páginas visitadas pelo cliente.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("oricse_module_retry") && !params.has("oricse_build")) return;
    // A espera permite que chunks da rota atual terminem de carregar antes
    // de permitir outra recuperação, evitando a repetição imediata do erro.
    const cleanup = window.setTimeout(() => {
      if (document.querySelector("main, [data-oricse-page]")) {
        const atual = new URL(window.location.href);
        atual.searchParams.delete("oricse_module_retry");
        atual.searchParams.delete("oricse_build");
        window.history.replaceState(window.history.state, "", atual.pathname + atual.search + atual.hash);
      }
    }, 10000);
    return () => window.clearTimeout(cleanup);
  }, [location.pathname]);

  useEffect(() => {
    const recuperarModuloExpirado = (event: Event | PromiseRejectionEvent) => {
      const motivo = event instanceof PromiseRejectionEvent
        ? event.reason
        : (event as Event & { payload?: unknown }).payload ?? event;
      if (event.type !== "vite:preloadError" && !ERRO_MODULO.test(mensagemDeErro(motivo))) return;
      // Após uma recuperação, preservar a tela de erro em vez de reiniciar indefinidamente.
      if (new URLSearchParams(window.location.search).has("oricse_module_retry")) return;
      event.preventDefault?.();
      void recarregarVersaoAtual();
    };

    window.addEventListener("vite:preloadError", recuperarModuloExpirado);
    window.addEventListener("unhandledrejection", recuperarModuloExpirado);

    // A versão 16 somente aposenta o cache legado. Ela não armazena código:
    // cada publicação passa a obter seus módulos diretamente da rede.
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .getRegistration("/")
        .then((registro) => {
          if (registro && !registro.active?.scriptURL.includes("sw.js?v=16"))
            return navigator.serviceWorker.register("/sw.js?v=16", { scope: "/" });
          return undefined;
        })
        .catch(() => undefined);
    }
    return () => {
      window.removeEventListener("vite:preloadError", recuperarModuloExpirado);
      window.removeEventListener("unhandledrejection", recuperarModuloExpirado);
    };
  }, []);

  const rotaAdmin = location.pathname.startsWith("/admin") ||
    (location.pathname === "/oricstudio" && location.search?.ambiente === "plataforma");
  const rotaPublica =
    ["/", "/login", "/solucoes", "/planos", "/contratar", "/contratacao-recebida", "/termos-de-uso", "/politica-de-privacidade", "/demo-portal-tutor", "/portaldotutor"].includes(location.pathname) ||
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
    !paginaInicialDeClinica &&
    autenticado &&
    role !== "admin" &&
    (acessoPortalNegado || (!portal && Boolean(portalError))),
  );
  const contextoPortal = { portal, loading: portalLoading, error: portalError };
  const mostrarRuntimeVisual = location.pathname !== "/admin-canvas" && !paginaInicialDeClinica;

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
      <ClinicasAtivasContext.Provider value={{ quantidade: quantidadeClinicasAtivas }}>
      <TenantContext.Provider value={contextoPortal}>
        {mostrarRuntimeVisual && (
          <OptionalRuntimeBoundary>
            <Suspense fallback={null}>
              <VisualPageRuntime />
            </Suspense>
          </OptionalRuntimeBoundary>
        )}
        {mostrarClinico && <NatalVivoDecoracao />}
        {mostrarClinico && <RockDecoracao />}
        {mostrarClinico && (
          <div className={menuFixo ? "pl-16 lg:pl-80" : ""}>
            <OptionalRuntimeBoundary fallback={<div className="border-b bg-background p-3 text-sm"><a className="font-semibold underline" href="/inicio">Início</a><span className="mx-3">·</span><a className="font-semibold underline" href="/admin">Administração</a></div>}>
              <Suspense fallback={null}>
                <Cabecalho menuFixo={menuFixo} aoMudarMenuFixo={alterarMenuFixo} />
              </Suspense>
            </OptionalRuntimeBoundary>
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
        ) : rotaAdmin && autenticado && role === "admin" ? (
          <AdminShell><Outlet /></AdminShell>
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
      </ClinicasAtivasContext.Provider>
    </QueryClientProvider>
  );
}
