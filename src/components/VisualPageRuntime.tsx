import { useEffect, useRef } from "react";
import { useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { applyVisualLayout, type VisualDocument, VISUAL_PUBLISHED_KEY } from "@/lib/visual-editor";

let cache: VisualDocument | null = null;

export function VisualPageRuntime() {
  const location = useLocation();
  const applying = useRef(false);

  useEffect(() => {
    if (location.pathname === "/admin-canvas" || new URLSearchParams(window.location.search).has("visual_editor")) return;
    let active = true;
    let observer: MutationObserver | null = null;
    const run = async () => {
      if (!cache) {
        const { data } = await (supabase as any).from("oricse_config").select("valor").eq("chave", VISUAL_PUBLISHED_KEY).maybeSingle();
        cache = data?.valor || { version: 1, updatedAt: "", pages: {} };
      }
      if (!active) return;
      const mode = window.innerWidth < 768 ? "mobile" : "desktop";
      const layout = cache?.pages?.[location.pathname]?.[mode];
      const apply = () => {
        if (applying.current) return;
        applying.current = true;
        observer?.disconnect();
        applyVisualLayout(document, layout);
        observer?.observe(document.body, { childList: true, subtree: true });
        applying.current = false;
      };
      observer = new MutationObserver(() => { if (!applying.current) requestAnimationFrame(apply); });
      apply();
    };
    void run();
    return () => { active = false; observer?.disconnect(); };
  }, [location.pathname]);

  useEffect(() => {
    const refresh = () => { cache = null; };
    window.addEventListener("oricse:visual-published", refresh);
    return () => window.removeEventListener("oricse:visual-published", refresh);
  }, []);

  return null;
}
