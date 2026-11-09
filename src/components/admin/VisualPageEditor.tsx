import { Link } from "@tanstack/react-router";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  BringToFront,
  Copy,
  Eye,
  EyeOff,
  ImagePlus,
  Layers3,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  ScanLine,
  Monitor,
  Move,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  SendToBack,
  Smartphone,
  Trash2,
  Type,
  Undo2,
  UploadCloud,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ROTAS_CATALOGO } from "@/lib/admin-page-routes";
import {
  applyVisualLayout,
  cloneVisual,
  editableTarget,
  EMPTY_DOCUMENT,
  ensurePage,
  validImageSource,
  visualLabel,
  visualSelector,
  type VisualAdded,
  type VisualDevice,
  type VisualDocument,
  type VisualLayout,
  type VisualPatch,
  type VisualStyle,
  VISUAL_DRAFT_KEY,
  VISUAL_NODE_ATTR,
  VISUAL_PUBLISHED_KEY,
  VISUAL_VERSIONS_KEY,
} from "@/lib/visual-editor";

type Version = { id: string; publishedAt: string; pages: VisualDocument["pages"] };
type SelectedItem = { id: string; kind: "patch" | "added" };

type ConflictReview = {
  message: string;
  remote?: VisualDocument;
  overlaps: string[];
};
const EDITOR_KEYS = [VISUAL_PUBLISHED_KEY, VISUAL_DRAFT_KEY, VISUAL_VERSIONS_KEY] as const;
type ConfigRow = { id?: string; chave?: string; valor?: unknown };
function sameEditorJson(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Reconcilia páginas por dispositivo. Conflitos reais exigem decisão explícita. */
function reconcileEditor(baseline: VisualDocument, local: VisualDocument, remote: VisualDocument) {
  const merged = cloneVisual(remote);
  const overlaps: string[] = [];
  const routes = new Set([
    ...Object.keys(baseline.pages),
    ...Object.keys(local.pages),
    ...Object.keys(remote.pages),
  ]);
  for (const page of routes) {
    for (const device of ["desktop", "mobile"] as const) {
      const before = baseline.pages[page]?.[device];
      const mine = local.pages[page]?.[device];
      const theirs = remote.pages[page]?.[device];
      const localChanged = !sameEditorJson(before, mine);
      const remoteChanged = !sameEditorJson(before, theirs);
      if (!localChanged) continue;
      if (remoteChanged && !sameEditorJson(mine, theirs)) {
        overlaps.push(page + " (" + (device === "desktop" ? "computador" : "celular") + ")");
        continue;
      }
      if (!merged.pages[page])
        merged.pages[page] = {
          desktop: { patches: [], added: [] },
          mobile: { patches: [], added: [] },
        };
      if (mine) merged.pages[page][device] = cloneVisual(mine);
    }
  }
  return { merged, overlaps };
}

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const deviceWidth = (device: VisualDevice) => (device === "desktop" ? 1440 : 390);

function number(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function VisualPageEditor() {
  const [device, setDevice] = useState<VisualDevice>("desktop");
  const [route, setRoute] = useState("/");
  useEffect(() => {
    const pagina = new URLSearchParams(window.location.search).get("pagina") || "/";
    if (
      ROTAS_CATALOGO.some(
        (r) => r.original === pagina && !r.dinamica && r.original !== "/admin-canvas",
      )
    )
      setRoute(pagina);
  }, []);
  const [buscaPagina, setBuscaPagina] = useState("");
  const gruposPaginas = Array.from(new Set(ROTAS_CATALOGO.map((r) => r.grupo)));
  const paginasFiltradas = ROTAS_CATALOGO.filter(
    (r) =>
      !buscaPagina.trim() ||
      (r.nome + " " + r.original + " " + r.grupo)
        .toLocaleLowerCase("pt-BR")
        .includes(buscaPagina.trim().toLocaleLowerCase("pt-BR")),
  );
  const [zoom, setZoom] = useState(70);
  const [documento, setDocumento] = useState<VisualDocument>(EMPTY_DOCUMENT());
  const [selected, setSelected] = useState<SelectedItem[]>([]);
  const [undo, setUndo] = useState<VisualDocument[]>([]);
  const [redo, setRedo] = useState<VisualDocument[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [conflict, setConflict] = useState<ConflictReview | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const savingRef = useRef(false);
  const recordIdsRef = useRef<Record<string, string>>({});
  const baselineRef = useRef<VisualDocument>(EMPTY_DOCUMENT());
  const [lastPublishedAt, setLastPublishedAt] = useState("");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [modoFoco, setModoFoco] = useState(false);
  const painesAntesDoFoco = useRef({ left: true, right: false });
  const areaCanvasRef = useRef<HTMLElement>(null);

  function alternarModoFoco() {
    if (!modoFoco) {
      painesAntesDoFoco.current = { left: leftOpen, right: rightOpen };
      setLeftOpen(false);
      setRightOpen(false);
      setModoFoco(true);
      return;
    }
    setModoFoco(false);
    setLeftOpen(painesAntesDoFoco.current.left);
    setRightOpen(painesAntesDoFoco.current.right);
  }

  useEffect(() => {
    if (!modoFoco) return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflowAnterior; };
  }, [modoFoco]);

  useEffect(() => {
    if (selected.length && !modoFoco) setRightOpen(true);
  }, [selected.length, modoFoco]);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cleanupFrameListenersRef = useRef<(() => void) | null>(null);
  const selectedRef = useRef<SelectedItem[]>([]);
  const documentRef = useRef(documento);
  const propertiesPanelRef = useRef<HTMLElement>(null);
  // Uma edição contínua de texto, número ou cor equivale a uma ação no histórico.
  const propertyGestureRef = useRef<{ source: Element; before: VisualDocument; recorded: boolean } | null>(null);
  selectedRef.current = selected;
  documentRef.current = documento;

  const layout = useMemo(
    () => ensurePage(cloneVisual(documento), route)[device],
    [documento, route, device],
  );
  const first = useMemo(() => {
    const item = selected[0];
    if (!item) return null;
    return item.kind === "patch"
      ? layout.patches.find((x) => x.id === item.id) || null
      : layout.added.find((x) => x.id === item.id) || null;
  }, [selected, layout]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user?.id) {
        window.location.replace("/login");
        return;
      }
      const { data: access } = await (supabase as any)
        .from("app_users")
        .select("role")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (access?.role !== "admin") {
        toast.error("O editor visual é exclusivo do administrador da plataforma.");
        window.location.replace("/inicio");
        return;
      }
      const [draft, published, history] = await Promise.all([
        (supabase as any)
          .from("oricse_config")
          .select("id,chave,valor")
          .eq("chave", VISUAL_DRAFT_KEY)
          .maybeSingle(),
        (supabase as any)
          .from("oricse_config")
          .select("id,chave,valor")
          .eq("chave", VISUAL_PUBLISHED_KEY)
          .maybeSingle(),
        (supabase as any)
          .from("oricse_config")
          .select("id,chave,valor")
          .eq("chave", VISUAL_VERSIONS_KEY)
          .maybeSingle(),
      ]);
      const error = draft.error || published.error || history.error;
      if (error) {
        setLoadError(error.message || "Não foi possível ler a configuração da página.");
        setLoading(false);
        return;
      }
      recordIdsRef.current = Object.fromEntries(
        [draft.data, published.data, history.data]
          .filter((row: ConfigRow | null): row is ConfigRow => Boolean(row?.id && row?.chave))
          .map((row: ConfigRow) => [row.chave!, row.id!]),
      );
      const documentLoaded = cloneVisual(
        draft.data?.valor || published.data?.valor || EMPTY_DOCUMENT(),
      ) as VisualDocument;
      baselineRef.current = cloneVisual(documentLoaded);
      setDocumento(documentLoaded);
      setLastPublishedAt(published.data?.valor?.updatedAt || "");
      setVersions(Array.isArray(history.data?.valor) ? history.data.valor : []);
      setLoading(false);
    })();
  }, []);

  const checkpoint = useCallback((before?: VisualDocument) => {
    const snapshot = cloneVisual(before ?? documentRef.current);
    setUndo((items) => [...items.slice(-39), snapshot]);
    setRedo([]);
  }, []);

  const updateLayout = useCallback(
    (mutate: (layout: VisualLayout) => void, remember = true) => {
      if (remember) {
        const focus = document.activeElement;
        const editingProperty = focus instanceof HTMLElement &&
          propertiesPanelRef.current?.contains(focus) &&
          ["INPUT", "TEXTAREA", "SELECT"].includes(focus.tagName);
        if (editingProperty) {
          if (propertyGestureRef.current?.source !== focus) {
            propertyGestureRef.current = {
              source: focus, before: cloneVisual(documentRef.current), recorded: false,
            };
          }
          if (!propertyGestureRef.current.recorded) {
            checkpoint(propertyGestureRef.current.before);
            propertyGestureRef.current.recorded = true;
          }
        } else {
          propertyGestureRef.current = null;
          checkpoint();
        }
      }
      // O ref é atualizado no próprio evento: movimentos rápidos não dependem
      // do momento em que o React processar a próxima renderização.
      const next = cloneVisual(documentRef.current);
      mutate(ensurePage(next, route)[device]);
      next.updatedAt = new Date().toISOString();
      documentRef.current = next;
      setDocumento(next);
    },
    [checkpoint, route, device],
  );

  function undoNow() {
    const previous = undo.at(-1);
    if (!previous) return;
    propertyGestureRef.current = null;
    setRedo((items) => [...items.slice(-39), cloneVisual(documentRef.current)]);
    const restored = cloneVisual(previous);
    documentRef.current = restored;
    setDocumento(restored);
    setUndo((items) => items.slice(0, -1));
    setSelected([]);
  }
  function redoNow() {
    const next = redo.at(-1);
    if (!next) return;
    propertyGestureRef.current = null;
    setUndo((items) => [...items.slice(-39), cloneVisual(documentRef.current)]);
    const restored = cloneVisual(next);
    documentRef.current = restored;
    setDocumento(restored);
    setRedo((items) => items.slice(0, -1));
    setSelected([]);
  }

  const selectedElements = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return [] as HTMLElement[];
    return selectedRef.current
      .map((item) => {
        if (item.kind === "added")
          return doc.querySelector(`[${VISUAL_NODE_ATTR}="${item.id}"]`) as HTMLElement | null;
        const patch = ensurePage(cloneVisual(documentRef.current), route)[device].patches.find(
          (x) => x.id === item.id,
        );
        try {
          return patch ? (doc.querySelector(patch.selector) as HTMLElement | null) : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as HTMLElement[];
  }, [route, device]);

  const drawSelection = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.querySelectorAll("[data-oricse-editor-overlay]").forEach((x) => x.remove());
    const elements = selectedElements();
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      const overlay = doc.createElement("div");
      overlay.dataset["oricseEditorOverlay"] = "1";
      Object.assign(overlay.style, {
        position: "fixed",
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        border: "2px solid #6F293B",
        boxSizing: "border-box",
        pointerEvents: "none",
        zIndex: "2147483646",
      });
      doc.body.appendChild(overlay);
    }
    if (elements.length) {
      const rect = elements[0].getBoundingClientRect();
      type ResizeMode = "horizontal" | "vertical" | "proportional";
      const beginResize = (mode: ResizeMode) => (event: PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();
        propertyGestureRef.current = null;
        const beforeResize = cloneVisual(documentRef.current);
        let resizeRecorded = false;
        const sx = event.clientX,
          sy = event.clientY;
        const starts = selectedRef.current.map((item) => {
          const target = elements[selectedRef.current.indexOf(item)];
          const box = target?.getBoundingClientRect();
          const page = ensurePage(cloneVisual(documentRef.current), route)[device];
          const layer =
            item.kind === "patch"
              ? page.patches.find((x) => x.id === item.id)
              : page.added.find((x) => x.id === item.id);
          return {
            item,
            width: box?.width || 100,
            height: box?.height || 40,
            x: layer?.style.x || 0,
          };
        });
        const move = (ev: PointerEvent) => {
          const dx = (ev.clientX - sx) / Math.max(zoom / 100, 0.1),
            dy = (ev.clientY - sy) / Math.max(zoom / 100, 0.1);
          if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
          if (!resizeRecorded) {
            checkpoint(beforeResize);
            resizeRecorded = true;
          }
          updateLayout(
            (value) =>
              starts.forEach(({ item, width, height, x }) => {
                const target =
                  item.kind === "patch"
                    ? value.patches.find((x) => x.id === item.id)
                    : value.added.find((x) => x.id === item.id);
                if (!target) return;
                if (mode === "horizontal") {
                  const nextWidth = Math.max(10, Math.round(width - dx));
                  target.style.width = nextWidth;
                  target.style.x = Math.round(x + (width - nextWidth));
                } else if (mode === "vertical") {
                  target.style.height = Math.max(10, Math.round(height + dy));
                } else {
                  const relativeX = dx / Math.max(width, 1),
                    relativeY = dy / Math.max(height, 1);
                  const scale = Math.max(
                    0.05,
                    1 + (Math.abs(relativeX) >= Math.abs(relativeY) ? relativeX : relativeY),
                  );
                  target.style.width = Math.max(10, Math.round(width * scale));
                  target.style.height = Math.max(10, Math.round(height * scale));
                }
              }),
            false,
          );
        };
        const stop = () => {
          doc.defaultView?.removeEventListener("pointermove", move);
          doc.defaultView?.removeEventListener("pointerup", stop);
        };
        doc.defaultView?.addEventListener("pointermove", move);
        doc.defaultView?.addEventListener("pointerup", stop);
      };
      const createHandle = (
        mode: ResizeMode,
        label: string,
        style: Partial<CSSStyleDeclaration>,
      ) => {
        const handle = doc.createElement("button");
        handle.type = "button";
        handle.setAttribute("aria-label", label);
        handle.title = label;
        handle.dataset["oricseEditorOverlay"] = "1";
        Object.assign(
          handle.style,
          {
            position: "fixed",
            border: "2px solid white",
            background: "#6F293B",
            padding: "0",
            pointerEvents: "auto",
            touchAction: "none",
            zIndex: "2147483647",
            boxShadow: "0 1px 4px rgba(0,0,0,.28)",
          },
          style,
        );
        handle.addEventListener("pointerdown", beginResize(mode));
        doc.body.appendChild(handle);
      };
      createHandle("horizontal", "Alterar somente a largura", {
        left: `${rect.left - 5}px`,
        top: `${rect.top + rect.height / 2 - 18}px`,
        width: "10px",
        height: "36px",
        borderRadius: "6px",
        cursor: "ew-resize",
      });
      createHandle("vertical", "Alterar somente a altura", {
        left: `${rect.left + rect.width / 2 - 18}px`,
        top: `${rect.bottom - 5}px`,
        width: "36px",
        height: "10px",
        borderRadius: "6px",
        cursor: "ns-resize",
      });
      createHandle("proportional", "Redimensionar mantendo a proporção", {
        left: `${rect.right - 9}px`,
        top: `${rect.bottom - 9}px`,
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        cursor: "nwse-resize",
      });
    }
  }, [checkpoint, selectedElements, updateLayout, zoom, route, device]);

  const applyToFrame = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    applyVisualLayout(doc, layout);
    doc.documentElement.style.setProperty("--oricse-editor-cursor", "move");
    doc.querySelectorAll("a,button,input,textarea,select").forEach((element) => {
      (element as HTMLElement).style.pointerEvents = "auto";
    });
    drawSelection();
  }, [layout, drawSelection]);

  useEffect(() => {
    const id = requestAnimationFrame(applyToFrame);
    return () => cancelAnimationFrame(id);
  }, [applyToFrame]);

  // Each iframe reload gets fresh listeners; remove the previous handlers to
  // prevent duplicate drag updates and stale closures when changing pages.
  useEffect(() => () => cleanupFrameListenersRef.current?.(), []);

  const bindFrame = useCallback(() => {
    cleanupFrameListenersRef.current?.();
    cleanupFrameListenersRef.current = null;
    const doc = iframeRef.current?.contentDocument;
    const win = iframeRef.current?.contentWindow;
    if (!doc || !win) return;
    applyToFrame();
    let drag: null | {
      sx: number;
      sy: number;
      starts: Array<{ item: SelectedItem; x: number; y: number }>;
      before: VisualDocument;
      recorded: boolean;
    } = null;
    const pointerDown = (event: PointerEvent) => {
      const raw = event.target as Element | null;
      if (!raw || raw.closest("[data-oricse-editor-overlay]")) return;
      event.preventDefault();
      event.stopPropagation();
      propertyGestureRef.current = null;
      const beforeDrag = cloneVisual(documentRef.current);
      const element = editableTarget(raw);
      const addedId = element.closest(`[${VISUAL_NODE_ATTR}]`)?.getAttribute(VISUAL_NODE_ATTR);
      let item: SelectedItem;
      if (addedId) item = { id: addedId, kind: "added" };
      else {
        const selector = visualSelector(element);
        let patch = ensurePage(cloneVisual(documentRef.current), route)[device].patches.find(
          (x) => x.selector === selector,
        );
        if (!patch) {
          const rect = element.getBoundingClientRect();
          patch = {
            id: uid("element"),
            selector,
            label: visualLabel(element),
            style: {
              baseWidth: Math.max(1, Math.round(rect.width)),
              baseHeight: Math.max(1, Math.round(rect.height)),
              width: Math.max(1, Math.round(rect.width)),
              height: Math.max(1, Math.round(rect.height)),
            },
          };
          // Selecionar um elemento ainda não é uma alteração para desfazer.
          // Se ele for arrastado, o gesto inteiro entra no histórico de uma vez.
          updateLayout((value) => value.patches.push(patch!), false);
        }
        item = { id: patch.id, kind: "patch" };
      }
      const multi = event.shiftKey || event.ctrlKey || event.metaKey;
      const already = selectedRef.current.some((x) => x.id === item.id && x.kind === item.kind);
      const next = multi
        ? already
          ? selectedRef.current.filter((x) => x.id !== item.id || x.kind !== item.kind)
          : [...selectedRef.current, item]
        : already && selectedRef.current.length > 1
          ? selectedRef.current
          : [item];
      setSelected(next);
      selectedRef.current = next;
      const page = ensurePage(cloneVisual(documentRef.current), route)[device];
      const starts = next.map((entry) => {
        const target =
          entry.kind === "patch"
            ? page.patches.find((x) => x.id === entry.id)
            : page.added.find((x) => x.id === entry.id);
        return { item: entry, x: target?.style.x || 0, y: target?.style.y || 0 };
      });
      drag = { sx: event.clientX, sy: event.clientY, starts, before: beforeDrag, recorded: false };
    };
    const move = (event: PointerEvent) => {
      // React may run the state updater after pointerup has cleared drag.
      // Capture an immutable reference for this event, rather than reading
      // drag inside the deferred update and crashing on drag.starts.
      const activeDrag = drag;
      if (!activeDrag) return;
      const dx = (event.clientX - activeDrag.sx) / Math.max(zoom / 100, 0.1),
        dy = (event.clientY - activeDrag.sy) / Math.max(zoom / 100, 0.1);
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      if (!activeDrag.recorded) {
        checkpoint(activeDrag.before);
        activeDrag.recorded = true;
      }
      const starts = activeDrag.starts;
      updateLayout(
        (value) =>
          starts.forEach(({ item, x, y }) => {
            const target =
              item.kind === "patch"
                ? value.patches.find((p) => p.id === item.id)
                : value.added.find((p) => p.id === item.id);
            if (target) {
              target.style.x = Math.round(x + dx);
              target.style.y = Math.round(y + dy);
            }
          }),
        false,
      );
    };
    const stop = () => {
      drag = null;
    };
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      event.preventDefault();
      event.stopPropagation();
      // O iframe tem seu próprio contexto de teclado. Encaminhar apenas
      // os atalhos para o histórico do Canvas, sem mexer no conteúdo.
      window.dispatchEvent(new KeyboardEvent("keydown", {
        key: event.key, ctrlKey: event.ctrlKey, metaKey: event.metaKey,
        shiftKey: event.shiftKey, bubbles: true,
      }));
    };
    const block = (event: Event) => {
      if ((event.target as Element)?.closest("a,button,form")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    doc.addEventListener("pointerdown", pointerDown, true);
    doc.addEventListener("keydown", shortcut, true);
    win.addEventListener("pointermove", move, true);
    win.addEventListener("pointerup", stop, true);
    win.addEventListener("pointercancel", stop, true);
    win.addEventListener("blur", stop, true);
    doc.addEventListener("click", block, true);
    doc.addEventListener("submit", block, true);
    cleanupFrameListenersRef.current = () => {
      drag = null;
      doc.removeEventListener("pointerdown", pointerDown, true);
      doc.removeEventListener("keydown", shortcut, true);
      win.removeEventListener("pointermove", move, true);
      win.removeEventListener("pointerup", stop, true);
      win.removeEventListener("pointercancel", stop, true);
      win.removeEventListener("blur", stop, true);
      doc.removeEventListener("click", block, true);
      doc.removeEventListener("submit", block, true);
    };
  }, [applyToFrame, checkpoint, device, route, updateLayout, zoom]);

  function patchSelected(style: Partial<VisualStyle>, text?: string) {
    if (!selected.length) return;
    updateLayout((value) =>
      selected.forEach((item) => {
        const target =
          item.kind === "patch"
            ? value.patches.find((x) => x.id === item.id)
            : value.added.find((x) => x.id === item.id);
        if (target) {
          target.style = { ...target.style, ...style };
          if (text !== undefined) target.text = text;
        }
      }),
    );
  }

  function addText() {
    const item: VisualAdded = {
      id: uid("text"),
      kind: "text",
      text: "Novo texto",
      style: {
        x: 40,
        y: 80,
        width: 320,
        height: 70,
        fontSize: 30,
        fontWeight: 700,
        color: "#4A1826",
        zIndex: 20,
      },
    };
    updateLayout((value) => value.added.push(item));
    setSelected([{ id: item.id, kind: "added" }]);
  }
  function addImage() {
    const src = window.prompt(
      "Cole o endereço da imagem (URL HTTPS, caminho do site ou data:image):",
      "",
    );
    if (!src) return;
    if (!validImageSource(src)) return toast.error("Use uma URL de imagem válida.");
    const item: VisualAdded = {
      id: uid("image"),
      kind: "image",
      src,
      text: "Imagem",
      style: { x: 40, y: 80, width: 260, height: 200, zIndex: 20 },
    };
    updateLayout((value) => value.added.push(item));
    setSelected([{ id: item.id, kind: "added" }]);
  }
  function duplicate() {
    if (!selected.length) return;
    const newSelection: SelectedItem[] = [];
    updateLayout((value) =>
      selected.forEach((item) => {
        if (item.kind === "added") {
          const source = value.added.find((x) => x.id === item.id);
          if (source) {
            const copy = {
              ...cloneVisual(source),
              id: uid(source.kind),
              style: {
                ...source.style,
                x: (source.style.x || 0) + 20,
                y: (source.style.y || 0) + 20,
              },
            };
            value.added.push(copy);
            newSelection.push({ id: copy.id, kind: "added" });
          }
        } else {
          const source = value.patches.find((x) => x.id === item.id);
          if (source) {
            const copy = {
              ...cloneVisual(source),
              id: uid("copy"),
              selector: source.selector,
              style: {
                ...source.style,
                x: (source.style.x || 0) + 20,
                y: (source.style.y || 0) + 20,
              },
            };
            value.patches.push(copy);
            newSelection.push({ id: copy.id, kind: "patch" });
          }
        }
      }),
    );
    setSelected(newSelection);
  }
  function hideOrDelete() {
    if (!selected.length) return;
    updateLayout((value) =>
      selected.forEach((item) => {
        if (item.kind === "added") value.added = value.added.filter((x) => x.id !== item.id);
        else {
          const patch = value.patches.find((x) => x.id === item.id);
          if (patch) patch.hidden = true;
        }
      }),
    );
    setSelected([]);
  }
  function toggleVisibility(item: SelectedItem) {
    updateLayout((value) => {
      const target =
        item.kind === "patch"
          ? value.patches.find((x) => x.id === item.id)
          : value.added.find((x) => x.id === item.id);
      if (!target) return;
      if (item.kind === "patch") (target as VisualPatch).hidden = !(target as VisualPatch).hidden;
      else target.style.opacity = target.style.opacity === 0 ? 1 : 0;
    });
  }
  function moveLayer(front: boolean) {
    updateLayout((value) => {
      const all = [...value.patches, ...value.added];
      const levels = all.map((item) => item.style.zIndex || 0);
      const targetLevel = front ? Math.max(0, ...levels) + 1 : Math.min(0, ...levels) - 1;
      selected.forEach((item) => {
        const target =
          item.kind === "patch"
            ? value.patches.find((x) => x.id === item.id)
            : value.added.find((x) => x.id === item.id);
        if (target) target.style.zIndex = targetLevel;
      });
    });
  }
  function resetPage() {
    if (!confirm("Restaurar esta página neste tamanho?")) return;
    updateLayout((value) => {
      value.patches = [];
      value.added = [];
    });
    setSelected([]);
  }

  function classifySaveError(error: { code?: string; message?: string } | null) {
    if (!error) return;
    if (error.code === "DRIVE_CONFLICT") {
      setConflict({
        message:
          "Outra edição foi registrada desde que você abriu o Canvas. Suas alterações continuam nesta tela.",
        overlaps: [],
      });
      return;
    }
    toast.error(error.message || "Não foi possível salvar as alterações.", {
      id: "oricse-canvas-save",
    });
  }

  function saveRows(rows: Array<{ chave: string; valor: unknown; updated_at: string }>) {
    return rows.map((row) => ({
      ...row,
      ...(recordIdsRef.current[row.chave] ? { id: recordIdsRef.current[row.chave] } : {}),
    }));
  }

  async function saveDraft() {
    if (savingRef.current || conflict || loadError) return;
    savingRef.current = true;
    setSaving(true);
    const payload = { ...documento, updatedAt: new Date().toISOString() };
    try {
      const { data, error } = await (supabase as any)
        .from("oricse_config")
        .upsert(
          saveRows([
            {
              chave: VISUAL_DRAFT_KEY,
              valor: payload,
              updated_at: payload.updatedAt,
            },
          ]),
          { onConflict: "chave" },
        )
        .select("id,chave,valor");
      if (error) {
        classifySaveError(error);
        return;
      }
      const saved = Array.isArray(data) ? data[0] : data;
      if (saved?.id) recordIdsRef.current[VISUAL_DRAFT_KEY] = String(saved.id);
      // Refresh the baseline used for optimistic concurrency on the next save.
      const latest = await (supabase as any)
        .from("oricse_config")
        .select("id,chave,valor")
        .eq("chave", VISUAL_DRAFT_KEY)
        .maybeSingle();
      if (latest.error) throw latest.error;
      if (latest.data?.id) recordIdsRef.current[VISUAL_DRAFT_KEY] = String(latest.data.id);
      baselineRef.current = cloneVisual(payload);
      setDocumento(payload);
      toast.success("Rascunho salvo.", { id: "oricse-canvas-draft" });
    } catch (error) {
      classifySaveError(error as { code?: string; message?: string });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function publish() {
    if (savingRef.current || conflict || loadError) return;
    savingRef.current = true;
    setSaving(true);
    const payload = { ...documento, updatedAt: new Date().toISOString() };
    const history: Version[] = [
      { id: uid("version"), publishedAt: payload.updatedAt, pages: cloneVisual(payload.pages) },
      ...versions,
    ].slice(0, 12);
    try {
      // All three entries go through a single coordinated Drive journal event.
      // No partial publication of page, draft or version history.
      const { data, error } = await (supabase as any)
        .from("oricse_config")
        .upsert(
          saveRows([
            { chave: VISUAL_PUBLISHED_KEY, valor: payload, updated_at: payload.updatedAt },
            { chave: VISUAL_DRAFT_KEY, valor: payload, updated_at: payload.updatedAt },
            { chave: VISUAL_VERSIONS_KEY, valor: history, updated_at: payload.updatedAt },
          ]),
          { onConflict: "chave" },
        )
        .select("id,chave,valor");
      if (error) {
        classifySaveError(error);
        return;
      }
      for (const row of Array.isArray(data) ? data : []) {
        if (row?.chave && row?.id) recordIdsRef.current[row.chave] = String(row.id);
      }
      const verification = await (supabase as any)
        .from("oricse_config")
        .select("id,chave,valor")
        .in("chave", [...EDITOR_KEYS]);
      if (verification.error) throw verification.error;
      const confirmedRows = (verification.data || []) as ConfigRow[];
      for (const row of confirmedRows) {
        if (row.id && row.chave) recordIdsRef.current[row.chave] = row.id;
      }
      const confirmedPublished = confirmedRows.find((row) => row.chave === VISUAL_PUBLISHED_KEY);
      if (
        (confirmedPublished?.valor as VisualDocument | undefined)?.updatedAt !== payload.updatedAt
      ) {
        throw new Error(
          "A publicação não foi confirmada no site. Revise antes de tentar novamente.",
        );
      }
      baselineRef.current = cloneVisual(payload);
      setDocumento(payload);
      setVersions(history);
      setLastPublishedAt(payload.updatedAt);
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("oricse-visual-editor");
        channel.postMessage({ type: "published", updatedAt: payload.updatedAt });
        channel.close();
      }
      window.dispatchEvent(new Event("oricse:visual-published"));
      toast.success("Publicado e confirmado no site real.", { id: "oricse-canvas-published" });
    } catch (error) {
      classifySaveError(error as { code?: string; message?: string });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function reviewConflict() {
    if (reviewing) return;
    setReviewing(true);
    try {
      const latest = await (supabase as any)
        .from("oricse_config")
        .select("id,chave,valor")
        .in("chave", [...EDITOR_KEYS]);
      if (latest.error) throw latest.error;
      const rows = (latest.data || []) as ConfigRow[];
      for (const row of rows) {
        if (row.id && row.chave) recordIdsRef.current[row.chave] = row.id;
      }
      const draft = rows.find((row) => row.chave === VISUAL_DRAFT_KEY)?.valor;
      const published = rows.find((row) => row.chave === VISUAL_PUBLISHED_KEY)?.valor;
      const current = cloneVisual(draft || published || EMPTY_DOCUMENT()) as VisualDocument;
      const reconciled = reconcileEditor(baselineRef.current, documento, current);
      const remoteHistory = rows.find((row) => row.chave === VISUAL_VERSIONS_KEY)?.valor;
      if (Array.isArray(remoteHistory)) setVersions(remoteHistory as Version[]);
      setLastPublishedAt((published as VisualDocument | undefined)?.updatedAt || "");
      baselineRef.current = cloneVisual(current);
      if (reconciled.overlaps.length) {
        setConflict({
          message:
            "O mesmo trecho foi alterado em outra sessão. Escolha qual versão deve prevalecer.",
          remote: current,
          overlaps: reconciled.overlaps,
        });
      } else {
        setUndo((items) => [...items.slice(-39), cloneVisual(documento)]);
        setDocumento(reconciled.merged);
        setConflict(null);
        toast.success("Versões conciliadas. Revise e publique quando desejar.", {
          id: "oricse-canvas-reconciled",
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao consultar a versão atual.", {
        id: "oricse-canvas-review",
      });
    } finally {
      setReviewing(false);
    }
  }

  function chooseConflictVersion(useLocal: boolean) {
    if (!conflict?.remote) return;
    if (
      !window.confirm(
        useLocal
          ? "Sua edição substituirá as alterações feitas na outra sessão nos mesmos trechos. Confirmar?"
          : "Descartar suas mudanças não salvas e carregar a versão atual do servidor?",
      )
    )
      return;
    setUndo((items) => [...items.slice(-39), cloneVisual(documento)]);
    if (!useLocal) setDocumento(cloneVisual(conflict.remote));
    setConflict(null);
  }

  function restore(version: Version) {
    checkpoint();
    setDocumento({
      version: 1,
      updatedAt: new Date().toISOString(),
      pages: cloneVisual(version.pages),
    });
    setSelected([]);
    toast.success("Versão carregada como rascunho. Revise e publique.");
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && (key === "z" || key === "y")) {
        event.preventDefault();
        if (event.shiftKey || key === "y") redoNow();
        else undoNow();
      } else if ((key === "delete" || key === "backspace") && selectedRef.current.length) {
        const target = event.target;
        // Backspace em campos de texto nunca deve excluir o elemento selecionado.
        if (target instanceof HTMLElement &&
          (target.matches("input,textarea,select") || target.isContentEditable)) return;
        event.preventDefault();
        hideOrDelete();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (loading)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#ece8e3]">
        Carregando editor visual…
      </main>
    );
  if (loadError)
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-bold">Não foi possível carregar o Canvas</h1>
        <p className="mt-3 text-sm">{loadError}</p>
        <button
          className="mt-4 rounded-xl border px-4 py-2"
          onClick={() => window.location.reload()}
        >
          Tentar carregar novamente
        </button>
      </main>
    );
  const frameWidth = deviceWidth(device);
  const scale = zoom / 100;
  function ajustarPaginaNaTela() {
    const disponivel = Math.max(250, (areaCanvasRef.current?.clientWidth ?? 1000) - 32);
    const opcoes = [40, 55, 70, 85, 100];
    setZoom(opcoes.filter((valor) => frameWidth * valor / 100 <= disponivel).at(-1) ?? 40);
  }

  return (
    <main className={`${modoFoco ? "fixed inset-0 z-[70] flex h-dvh flex-col overflow-hidden" : "min-h-screen"} bg-[#ded9d3] text-slate-900`}>
      <header className="sticky top-0 z-50 flex min-h-14 shrink-0 flex-wrap items-center gap-1.5 border-b bg-white px-2 py-2 shadow-sm lg:flex-nowrap lg:overflow-x-auto">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold"
        >
          <ArrowLeft size={17} /> Admin
        </Link>
        <button
          type="button"
          onClick={alternarModoFoco}
          className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${modoFoco ? "border-primary bg-primary/5 text-primary" : "hover:bg-slate-50"}`}
          aria-pressed={modoFoco}
          title={modoFoco ? "Sair da visualização ampla" : "Ampliar área da página e recolher os painéis"}
        >
          {modoFoco ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          <span className="hidden xl:inline">{modoFoco ? "Sair do foco" : "Tela ampla"}</span>
        </button>
        <button
          type="button"
          onClick={() => setLeftOpen((x) => !x)}
          className="rounded-xl border p-2"
          title={leftOpen ? "Recolher páginas e camadas" : "Expandir páginas e camadas"}
          aria-label={leftOpen ? "Recolher páginas e camadas" : "Expandir páginas e camadas"}
          aria-expanded={leftOpen}
        >
          {leftOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
        <button
          onClick={addText}
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold"
        >
          <Type size={17} /> Texto
        </button>
        <button
          onClick={addImage}
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold"
        >
          <ImagePlus size={17} /> Imagem
        </button>
        <button
          disabled={!undo.length}
          onClick={undoNow}
          className="rounded-xl border p-2 disabled:opacity-30"
        >
          <Undo2 size={18} />
        </button>
        <button
          disabled={!redo.length}
          onClick={redoNow}
          className="rounded-xl border p-2 disabled:opacity-30"
        >
          <Redo2 size={18} />
        </button>
        <div className="mx-1 h-8 w-px bg-slate-200" />
        <button
          onClick={() => {
            setDevice("desktop");
            setSelected([]);
          }}
          className={`rounded-xl p-2 ${device === "desktop" ? "bg-primary text-white" : "border"}`}
        >
          <Monitor size={18} />
        </button>
        <button
          onClick={() => {
            setDevice("mobile");
            setSelected([]);
          }}
          className={`rounded-xl p-2 ${device === "mobile" ? "bg-primary text-white" : "border"}`}
        >
          <Smartphone size={18} />
        </button>
        <select
          value={zoom}
          aria-label="Zoom da página"
          onChange={(e) => setZoom(Number(e.target.value))}
          className="rounded-xl border px-2 py-2"
        >
          <option value={40}>40%</option>
          <option value={55}>55%</option>
          <option value={70}>70%</option>
          <option value={85}>85%</option>
          <option value={100}>100%</option>
        </select>
        <button
          type="button"
          onClick={ajustarPaginaNaTela}
          className="rounded-xl border p-2"
          title="Ajustar página à largura disponível"
          aria-label="Ajustar página à tela"
        >
          <ScanLine size={18} />
        </button>
        <button
          type="button"
          onClick={() => setRightOpen((x) => !x)}
          className="rounded-xl border p-2"
          title={rightOpen ? "Recolher propriedades" : "Expandir propriedades"}
          aria-label={rightOpen ? "Recolher propriedades" : "Expandir propriedades"}
          aria-expanded={rightOpen}
        >
          {rightOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </button>
        <div className="ml-auto flex items-center gap-2">
          {lastPublishedAt && (
            <span className="hidden text-xs font-semibold text-emerald-700 xl:inline">
              No site: {new Date(lastPublishedAt).toLocaleString("pt-BR")}
            </span>
          )}
          <button
            disabled={saving || Boolean(conflict)}
            onClick={saveDraft}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-semibold"
          >
            <Save size={17} /> Salvar rascunho
          </button>
          <button
            disabled={saving || Boolean(conflict)}
            onClick={publish}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-semibold text-white"
          >
            <UploadCloud size={17} /> {saving ? "Publicando…" : "Publicar no site"}
          </button>
        </div>
      </header>
      {conflict && (
        <section
          role="alert"
          className="sticky top-16 z-40 mx-auto max-w-5xl rounded-b-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-950 shadow-lg"
        >
          <h2 className="font-extrabold">Conflito de edição — suas alterações continuam aqui</h2>
          <p className="mt-1 text-sm">{conflict.message}</p>
          {conflict.overlaps.length > 0 && (
            <p className="mt-2 text-xs">Trechos afetados: {conflict.overlaps.join(", ")}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              disabled={reviewing}
              onClick={() => void reviewConflict()}
              className="min-h-10 rounded-xl bg-amber-900 px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {reviewing ? "Verificando…" : "Atualizar e revisar"}
            </button>
            {conflict.remote && (
              <>
                <button
                  onClick={() => chooseConflictVersion(false)}
                  className="min-h-10 rounded-xl border border-amber-500 px-4 text-sm font-semibold"
                >
                  Usar versão do servidor
                </button>
                <button
                  onClick={() => chooseConflictVersion(true)}
                  className="min-h-10 rounded-xl border border-amber-500 px-4 text-sm font-semibold"
                >
                  Manter minha edição
                </button>
              </>
            )}
            <button
              onClick={() => {
                void navigator.clipboard
                  .writeText(JSON.stringify(documento, null, 2))
                  .then(() =>
                    toast.success("Cópia das suas alterações salva na área de transferência."),
                  )
                  .catch(() => toast.error("Não foi possível copiar. Mantenha esta aba aberta."));
              }}
              className="min-h-10 rounded-xl border border-amber-500 px-4 text-sm font-semibold"
            >
              Copiar minhas alterações
            </button>
          </div>
        </section>
      )}

      <div
        className={`grid ${modoFoco ? "min-h-0 flex-1" : "min-h-[calc(100vh-64px)]"} ${leftOpen && rightOpen ? "lg:grid-cols-[225px_minmax(0,1fr)_250px]" : leftOpen ? "lg:grid-cols-[225px_minmax(0,1fr)]" : rightOpen ? "lg:grid-cols-[minmax(0,1fr)_250px]" : "grid-cols-1"}`}
      >
        {leftOpen && (
          <aside className="min-w-0 overflow-y-auto border-r bg-white p-3 lg:max-h-[calc(100dvh-64px)]">
            <div className="flex items-center justify-between gap-2 pb-3">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Navegar e editar</span>
              <button type="button" onClick={() => setLeftOpen(false)} className="rounded-lg border p-1.5 hover:bg-slate-50" aria-label="Recolher painel de páginas"><PanelLeftClose size={17}/></button>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Páginas do ORICSE
                <input
                  value={buscaPagina}
                  onChange={(e) => setBuscaPagina(e.target.value)}
                  aria-label="Buscar página do editor"
                  placeholder="Pesquisar página..."
                  className="mt-2 w-full rounded-xl border px-3 py-2 text-sm font-normal normal-case tracking-normal"
                />
              </label>
              <select
                value={route}
                onChange={(e) => {
                  setRoute(e.target.value);
                  setSelected([]);
                  window.history.replaceState(
                    window.history.state,
                    "",
                    "/admin-canvas?pagina=" + encodeURIComponent(e.target.value),
                  );
                }}
                aria-label="Selecionar página para editar"
                className="w-full rounded-xl border p-2 text-sm font-semibold"
              >
                {!paginasFiltradas.some((r) => r.original === route) && (
                  <option value={route}>
                    {ROTAS_CATALOGO.find((r) => r.original === route)?.nome || route} — selecionada
                  </option>
                )}
                {gruposPaginas.map((grupo) => (
                  <optgroup key={grupo} label={grupo}>
                    {paginasFiltradas
                      .filter((r) => r.grupo === grupo)
                      .map((r) => (
                        <option
                          key={r.original}
                          value={r.original}
                          disabled={r.dinamica || r.original === "/admin-canvas"}
                        >
                          {r.nome} ({r.original})
                          {r.dinamica
                            ? " · por clínica"
                            : r.original === "/admin-canvas"
                              ? " · editor (não editável)"
                              : ""}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              <p className="text-xs leading-5 text-muted-foreground">
                {paginasFiltradas.length} páginas encontradas. Endereços que dependem da clínica são
                listados para consulta e exigem um link real para prévia.
              </p>
              <a
                href={route}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-semibold text-primary underline underline-offset-4"
              >
                <Eye size={14} /> Abrir página selecionada
              </a>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <h2 className="font-bold">Camadas</h2>
              <button
                onClick={() => setSelected([])}
                className="text-xs font-semibold text-primary"
              >
                Desmarcar
              </button>
            </div>
            <div className="mt-2 max-h-[48vh] space-y-1 overflow-auto">
              {[
                ...layout.added.map((x) => ({
                  item: { id: x.id, kind: "added" as const },
                  label: x.text || x.kind,
                  hidden: x.style.opacity === 0,
                })),
                ...layout.patches.map((x) => ({
                  item: { id: x.id, kind: "patch" as const },
                  label: x.label,
                  hidden: x.hidden,
                })),
              ]
                .reverse()
                .map(({ item, label, hidden }) => (
                  <div
                    key={`${item.kind}-${item.id}`}
                    className={`flex items-center gap-1 rounded-lg border p-1 ${selected.some((x) => x.id === item.id && x.kind === item.kind) ? "border-primary bg-primary/5" : ""}`}
                  >
                    <button
                      onClick={() => setSelected([item])}
                      className="min-w-0 flex-1 truncate px-2 py-1 text-left text-xs font-semibold"
                    >
                      {label}
                    </button>
                    <button
                      onClick={() => toggleVisibility(item)}
                      className="p-1 text-muted-foreground"
                    >
                      {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                ))}
              {!layout.added.length && !layout.patches.length && (
                <p className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                  Clique em qualquer objeto dentro da página para começar a editá-lo.
                </p>
              )}
            </div>
            <div className="mt-5 border-t pt-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Versões</h2>
                <button
                  onClick={resetPage}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"
                >
                  <RotateCcw size={13} /> Restaurar página
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {versions.slice(0, 5).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => restore(v)}
                    className="w-full rounded-xl border p-2 text-left text-xs"
                  >
                    <strong>{new Date(v.publishedAt).toLocaleString("pt-BR")}</strong>
                    <span className="mt-1 block text-muted-foreground">Carregar como rascunho</span>
                  </button>
                ))}
                {!versions.length && (
                  <p className="text-xs text-muted-foreground">Nenhuma versão publicada ainda.</p>
                )}
              </div>
            </div>
          </aside>
        )}

        <section ref={areaCanvasRef} className={`min-w-0 overflow-auto ${modoFoco ? "p-2 sm:p-3" : "p-3 lg:p-4"}`}>
          <div
            className="mx-auto origin-top"
            style={{ width: frameWidth * scale, minHeight: (device === "desktop" ? 900 : 844) * scale }}
          >
            <div
              className="origin-top-left overflow-hidden rounded-lg bg-white shadow-2xl"
              style={{
                width: frameWidth,
                height: device === "desktop" ? 900 : 844,
                transform: `scale(${scale})`,
              }}
            >
              <iframe
                key={`${route}-${device}`}
                ref={iframeRef}
                src={`${route}${route.includes("?") ? "&" : "?"}visual_editor=1`}
                onLoad={bindFrame}
                title={`Editor de ${route}`}
                className="h-full w-full border-0 bg-white"
                style={{ width: frameWidth }}
              />
            </div>
          </div>
          <p className={modoFoco ? "sr-only" : "mt-4 text-center text-xs text-slate-600"}>
            Clique para selecionar. Shift + clique seleciona vários. Arraste para mover. A alça
            esquerda muda a largura, a inferior muda a altura e a bolinha mantém a proporção.
          </p>
        </section>

        {rightOpen && (
          <aside
            ref={propertiesPanelRef}
            onBlurCapture={() => { propertyGestureRef.current = null; }}
            className="min-w-0 overflow-y-auto border-l bg-white p-3 lg:max-h-[calc(100dvh-64px)]"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">Propriedades</h2>
              <button type="button" onClick={() => setRightOpen(false)} className="rounded-lg border p-1.5 hover:bg-slate-50" aria-label="Recolher painel de propriedades"><PanelRightClose size={17}/></button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {selected.length
                ? `${selected.length} elemento(s) selecionado(s)`
                : "Selecione algo na página."}
            </p>
            {first && (
              <div className="mt-4 space-y-4">
                {(!("kind" in first) || first.kind !== "image") && (
                  <label className="block text-xs font-bold">
                    Texto
                    <textarea
                      value={first.text || ""}
                      onChange={(e) => patchSelected({}, e.target.value)}
                      rows={4}
                      className="mt-1 w-full rounded-xl border p-2 font-normal"
                    />
                  </label>
                )}
                {"src" in first && first.kind === "image" && (
                  <label className="block text-xs font-bold">
                    Imagem
                    <input
                      value={first.src || ""}
                      onChange={(e) =>
                        updateLayout((v) => {
                          const x = v.added.find((a) => a.id === first.id);
                          if (x) x.src = e.target.value;
                        })
                      }
                      className="mt-1 w-full rounded-xl border p-2 font-normal"
                    />
                  </label>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["x", "X"],
                      ["y", "Y"],
                      ["width", "Largura"],
                      ["height", "Altura"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="text-xs font-bold">
                      {label}
                      <input
                        type="number"
                        value={first.style[key] ?? ""}
                        onChange={(e) => patchSelected({ [key]: number(e.target.value) })}
                        className="mt-1 w-full rounded-lg border p-2 font-normal"
                      />
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-bold">
                    Fonte
                    <input
                      type="number"
                      min={6}
                      max={220}
                      value={first.style.fontSize ?? ""}
                      onChange={(e) => patchSelected({ fontSize: number(e.target.value) })}
                      className="mt-1 w-full rounded-lg border p-2 font-normal"
                    />
                  </label>
                  <label className="text-xs font-bold">
                    Peso
                    <select
                      value={first.style.fontWeight || 400}
                      onChange={(e) => patchSelected({ fontWeight: number(e.target.value) })}
                      className="mt-1 w-full rounded-lg border p-2 font-normal"
                    >
                      <option value={400}>Normal</option>
                      <option value={500}>Médio</option>
                      <option value={600}>Semibold</option>
                      <option value={700}>Negrito</option>
                      <option value={900}>Black</option>
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-bold">
                    Texto
                    <input
                      type="color"
                      value={first.style.color || "#4A1826"}
                      onChange={(e) => patchSelected({ color: e.target.value })}
                      className="mt-1 h-10 w-full rounded border"
                    />
                  </label>
                  <label className="text-xs font-bold">
                    Fundo
                    <input
                      type="color"
                      value={first.style.backgroundColor || "#FFFFFF"}
                      onChange={(e) => patchSelected({ backgroundColor: e.target.value })}
                      className="mt-1 h-10 w-full rounded border"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-bold">
                    Borda
                    <input
                      type="color"
                      value={first.style.borderColor || "#303842"}
                      onChange={(e) => patchSelected({ borderColor: e.target.value })}
                      className="mt-1 h-10 w-full rounded border"
                    />
                  </label>
                  <label className="text-xs font-bold">
                    Espessura
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={first.style.borderWidth ?? 0}
                      onChange={(e) => patchSelected({ borderWidth: number(e.target.value) })}
                      className="mt-1 h-10 w-full rounded border px-2 font-normal"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-bold">
                    Preenchimento / ícone
                    <input
                      type="color"
                      value={first.style.fill || first.style.color || "#303842"}
                      onChange={(e) => patchSelected({ fill: e.target.value })}
                      className="mt-1 h-10 w-full rounded border"
                    />
                  </label>
                  <label className="text-xs font-bold">
                    Traço / ícone
                    <input
                      type="color"
                      value={first.style.stroke || first.style.color || "#303842"}
                      onChange={(e) => patchSelected({ stroke: e.target.value })}
                      className="mt-1 h-10 w-full rounded border"
                    />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => patchSelected({ textAlign: "left" })}
                    className="rounded-lg border p-2"
                  >
                    <AlignLeft size={17} />
                  </button>
                  <button
                    onClick={() => patchSelected({ textAlign: "center" })}
                    className="rounded-lg border p-2"
                  >
                    <AlignCenter size={17} />
                  </button>
                  <button
                    onClick={() => patchSelected({ textAlign: "right" })}
                    className="rounded-lg border p-2"
                  >
                    <AlignRight size={17} />
                  </button>
                  <label className="ml-auto flex items-center gap-2 text-xs font-bold">
                    Opacidade
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.1}
                      value={first.style.opacity ?? 1}
                      onChange={(e) => patchSelected({ opacity: number(e.target.value, 1) })}
                      className="w-16 rounded-lg border p-2"
                    />
                  </label>
                </div>
                <label className="block text-xs font-bold">
                  Nível da camada
                  <input
                    type="number"
                    value={first.style.zIndex ?? 0}
                    onChange={(e) => patchSelected({ zIndex: number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border p-2 font-normal"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => moveLayer(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border p-2 text-xs font-bold"
                  >
                    <BringToFront size={15} /> Trazer à frente
                  </button>
                  <button
                    onClick={() => moveLayer(false)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border p-2 text-xs font-bold"
                  >
                    <SendToBack size={15} /> Enviar para trás
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t pt-4">
                  <button
                    onClick={duplicate}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border p-2 text-xs font-bold"
                  >
                    <Copy size={15} /> Duplicar
                  </button>
                  <button
                    onClick={hideOrDelete}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 p-2 text-xs font-bold text-red-600"
                  >
                    <Trash2 size={15} /> Excluir
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}
