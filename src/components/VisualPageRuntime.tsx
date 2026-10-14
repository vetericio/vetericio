import { useCallback, useEffect, useRef, useState } from "react";
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

function hasContent(layout?: VisualLayout) {
  return Boolean(layout && (layout.patches.length || layout.added.length));
}

export function VisualPageRuntime() {
  const location = useLocation();
  const applying = useRef(false);
  const [revision, setRevision] = useState(0);

  const requestRefresh = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    const onPublished = () => requestRefresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === SYNC_STORAGE_KEY) requestRefresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") requestRefresh();
    };
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(SYNC_CHANNEL) : null;
    channel?.addEventListener("message", onPublished);
    window.addEventListener("oricse:visual-published", onPublished);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onPublished);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      channel?.removeEventListener("message", onPublished);
      channel?.close();
      window.removeEventListener("oricse:visual-published", onPublished);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onPublished);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [requestRefresh]);

  useEffect(() => {
    if (
      location.pathname === "/admin-canvas" ||
      new URLSearchParams(window.location.search).has("visual_editor")
    ) return;

    let active = true;
    let observer: MutationObserver | null = null;
    let frame = 0;
    let published: VisualDocument = EMPTY_PUBLISHED;

    const chooseLayout = () => {
      const page = published.pages?.[location.pathname];
      if (!page) return undefined;
      const preferred = window.innerWidth < 768 ? page.mobile : page.desktop;
      const fallback = window.innerWidth < 768 ? page.desktop : page.mobile;
      return hasContent(preferred) ? preferred : fallback;
    };

    const apply = () => {
      if (!active || applying.current) return;
      applying.current = true;
      observer?.disconnect();
      applyVisualLayout(document, chooseLayout());
      observer?.observe(document.body, { childList: true, subtree: true });
      applying.current = false;
    };

    const scheduleApply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };

    const loadPublished = async () => {
      const { data, error } = await (supabase as any)
        .from("oricse_config")
        .select("valor,updated_at")
        .eq("chave", VISUAL_PUBLISHED_KEY)
        .maybeSingle();

      if (!active) return;
      if (error) {
        console.error("Não foi possível carregar o layout publicado:", error);
        return;
      }

      published = data?.valor || EMPTY_PUBLISHED;
      observer = new MutationObserver(scheduleApply);
      scheduleApply();
    };

    const onResize = () => scheduleApply();
    window.addEventListener("resize", onResize);
    void loadPublished();

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [location.pathname, revision]);

  return null;
}
