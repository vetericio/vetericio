import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  applyVisualLayout,
  type VisualDocument,
  type VisualLayout,
  VISUAL_PUBLISHED_KEY,
} from "@/lib/visual-editor";

const EMPTY_PUBLISHED: VisualDocument = { version: 1, updatedAt: "", pages: {} };
const SYNC_STORAGE_KEY = "oricse:visual-published-at";
const SYNC_CHANNEL = "oricse-visual-editor";

// Cache em memória: uma navegação interna não deve buscar o mesmo layout
// visual dezenas de vezes. Nunca gravar o documento no armazenamento do navegador.
let paginaVisualCache: VisualDocument | null = null;
let paginaVisualCarregadoEm = 0;
let paginaVisualRequisicao: Promise<VisualDocument> | null = null;
const DURACAO_CACHE_MS = 60_000;

async function buscarLayoutPublicado(): Promise<VisualDocument> {
  if (paginaVisualCache && Date.now() - paginaVisualCarregadoEm < DURACAO_CACHE_MS)
    return paginaVisualCache;
  if (paginaVisualRequisicao) return paginaVisualRequisicao;
  paginaVisualRequisicao = (async () => {
    const { data, error } = await (supabase as any)
      .from("oricse_config")
      .select("valor")
      .eq("chave", VISUAL_PUBLISHED_KEY)
      .maybeSingle();
    if (error) throw error;
    paginaVisualCache = data?.valor || EMPTY_PUBLISHED;
    paginaVisualCarregadoEm = Date.now();
    return paginaVisualCache!;
  })().finally(() => { paginaVisualRequisicao = null; });
  return paginaVisualRequisicao;
}

function invalidarLayoutPublicado() {
  paginaVisualCache = null;
  paginaVisualCarregadoEm = 0;
}


function hasContent(layout?: VisualLayout) {
  return Boolean(layout && (layout.patches.length || layout.added.length));
}

export function VisualPageRuntime() {
  const location = useLocation();
  const applying = useRef(false);
  const [revision, setRevision] = useState(0);

  const requestRefresh = useCallback(() => {
    invalidarLayoutPublicado();
    setRevision((value) => value + 1);
  }, []);

  useLayoutEffect(() => {
    const onPublished = () => requestRefresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === SYNC_STORAGE_KEY) requestRefresh();
    };
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(SYNC_CHANNEL) : null;
    channel?.addEventListener("message", onPublished);
    window.addEventListener("oricse:visual-published", onPublished);
    window.addEventListener("storage", onStorage);
    return () => {
      channel?.removeEventListener("message", onPublished);
      channel?.close();
      window.removeEventListener("oricse:visual-published", onPublished);
      window.removeEventListener("storage", onStorage);
    };
  }, [requestRefresh]);

  useLayoutEffect(() => {
    if (
      location.pathname === "/admin-canvas" ||
      new URLSearchParams(window.location.search).has("visual_editor")
    ) return;

    let active = true;
    let frame = 0;
    let published: VisualDocument = EMPTY_PUBLISHED;

    const chooseLayout = () => {
      // Login padrão: a mesma arte editada na prévia se aplica ao login real
      // de todas as clínicas, sem alterar autenticação ou páginas internas.
      const loginTutor = location.pathname.replace(/\/$/, "") === "/portaldotutor"
        && window.location.hostname !== "alvorada.oricse.com.br"
        && Boolean(document.querySelector(".portal-tutor-login-screen"));
      const paginaVisual = loginTutor
        ? "/portal-tutores?portal_login_preview=1"
        : location.pathname === "/portal-tutores" && new URLSearchParams(window.location.search).has("portal_login_preview")
          ? "/portal-tutores?portal_login_preview=1"
          : location.pathname;
      const page = published.pages?.[paginaVisual];
      if (!page) return undefined;
      // Nunca aplicar coordenadas salvas no desktop em uma tela mobile.
      // Se não existir layout mobile publicado, usar o CSS responsivo nativo.
      // O fallback de desktop deslocava elementos e quebrava o menu no celular.
      if (window.innerWidth < 768) return hasContent(page.mobile) ? page.mobile : undefined;
      return hasContent(page.desktop) ? page.desktop : undefined;
    };

    const apply = () => {
      if (!active || applying.current) return;
      const layout = chooseLayout();
      // A maior parte das páginas clínicas não possui patches publicados.
      // Evita varrer imagens e o DOM inteiro em cada navegação quando não há
      // nada para aplicar nem um layout anterior para restaurar.
      if (!layout && !document.querySelector("[data-oricse-visual-patched], [data-oricse-visual-added]"))
        return;
      applying.current = true;
      try { applyVisualLayout(document, layout); }
      finally { applying.current = false; }
    };

    const scheduleApply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };

    const loadPublished = async () => {
      try {
        const resultado = await buscarLayoutPublicado();
        if (!active) return;
        published = resultado;
        scheduleApply();
      } catch (error) {
        console.error("Não foi possível carregar o layout visual publicado:", error);
      }
    };

    const onResize = () => scheduleApply();
    window.addEventListener("resize", onResize);
    // A home pública entrega o layout publicado junto do HTML. Aplicá-lo no
    // layout effect evita que a primeira pintura mostre uma versão e, depois,
    // a consulta do Supabase reposicione logo, textos ou botões.
    const bootstrap = document.getElementById("oricse-visual-bootstrap");
    if (revision === 0 && bootstrap?.textContent) {
      try {
        published = JSON.parse(bootstrap.textContent) as VisualDocument;
        apply();
      } catch (error) {
        console.error("Não foi possível ler o layout visual inicial:", error);
        void loadPublished();
      }
    } else {
      void loadPublished();
    }

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [location.pathname, revision]);

  return null;
}
