import { Link } from "@tanstack/react-router";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  BringToFront,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crop,
  Eye,
  EyeOff,
  ImagePlus,
  Layers3,
  Monitor,
  Move,
  PanelLeftClose,
  PanelLeftOpen,
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
import { enviarArquivoPublicoPlataforma } from "@/lib/platform-drive.functions";
import { useAdminNavigation } from "@/components/admin/AdminShell";
import {
  applyVisualLayout,
  cloneVisual,
  editableTarget,
  EMPTY_DOCUMENT,
  ensurePage,
  normalizeImageSource,
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

type Version = {
  id: string;
  publishedAt: string;
  pages: VisualDocument["pages"];
};
type SelectedItem = { id: string; kind: "patch" | "added" };

type ConflictReview = {
  message: string;
  remote?: VisualDocument;
  overlaps: string[];
};
const EDITOR_KEYS = [VISUAL_PUBLISHED_KEY, VISUAL_DRAFT_KEY, VISUAL_VERSIONS_KEY] as const;
// Produção congelada: o editor permanece disponível apenas para consulta.
const EDITOR_CONGELADO = true;
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

/** Elementos reais da home, disponíveis no painel sem alterar rascunhos salvos. */
const CAMADAS_INICIAIS_HOME = [
  ["home-fundo-bege", "Fundo bege da página"],
  ["home-cabecalho", "Cabeçalho"],
  ["home-menu-superior", "Menu superior"],
  ["home-botao-login", "Botão Login"],
  ["home-banner", "Área do banner"],
  ["home-base-capa", "Área da capa"],
  ["home-imagem-oryx", "Imagem do órix e pôr do sol"],
  ["home-logo-oricse", "Logo ORICSE"],
  ["home-selo", "Selo plataforma completa"],
  ["home-titulo-principal", "Título principal"],
  ["home-texto-apoio", "Texto de apoio"],
  ["home-botao-conhecer", "Botão Conhecer a Oricse"],
  ["home-botao-cliente", "Botão Já sou cliente"],
  ["home-legenda-inferior", "Legenda inferior do banner"],
] as const;

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const deviceWidth = (device: VisualDevice) => (device === "desktop" ? 1440 : 390);

function number(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function VisualPageEditor() {
  const { adminMenuRecolhido, alternarMenuAdmin } = useAdminNavigation();
  const [device, setDevice] = useState<VisualDevice>("desktop");
  // Resolve o destino antes do primeiro desenho. Isso impede que o Canva
  // carregue a home '/' quando o link recebido aponta para o login do tutor.
  const paginaInicialEditor = () => {
    if (typeof window === "undefined") return "/";
    const params = new URLSearchParams(window.location.search);
    const solicitado = params.get("pagina") || "/";
    const loginPortal =
      solicitado.startsWith("/portal-tutores") &&
      (solicitado.includes("portal_login_preview=1") || params.get("portal_login_preview") === "1");
    const pagina = loginPortal ? "/portal-tutores?portal_login_preview=1" : solicitado;
    return ROTAS_CATALOGO.some(
      (r) => r.original === pagina && !r.dinamica && r.original !== "/admin-canvas",
    )
      ? pagina
      : "/";
  };
  // O servidor não tem acesso ao endereço do navegador: só renderize a
  // prévia depois de resolver a seleção no cliente, sem erro de hidratação.
  const [route, setRoute] = useState("/");
  const [paginaResolvida, setPaginaResolvida] = useState(false);
  useEffect(() => {
    setRoute(paginaInicialEditor());
    setPaginaResolvida(true);
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
  const undoRef = useRef<VisualDocument[]>([]);
  const redoRef = useRef<VisualDocument[]>([]);
  const [croppingId, setCroppingId] = useState<string | null>(null);
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
  const [rightOpen, setRightOpen] = useState(true);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cleanupFrameListenersRef = useRef<(() => void) | null>(null);
  const selectedRef = useRef<SelectedItem[]>([]);
  const documentRef = useRef(documento);
  selectedRef.current = selected;
  documentRef.current = documento;

  const layout = useMemo(
    () => ensurePage(cloneVisual(documento), route)[device],
    [documento, route, device],
  );
  // A home institucional é uma composição aprovada e não recebe edições pelo Canva.
  // Ela segue disponível apenas para conferência no editor.
  const paginaInicialProtegida = route === "/";
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

  // O histórico usa referências sincronizadas, inclusive durante arrastes rápidos.
  // Um checkpoint representa uma ação completa, não cada pixel movimentado.
  const checkpoint = useCallback(() => {
    undoRef.current = [...undoRef.current.slice(-39), cloneVisual(documentRef.current)];
    redoRef.current = [];
    setUndo(undoRef.current);
    setRedo([]);
  }, []);

  const updateLayout = useCallback(
    (mutate: (layout: VisualLayout) => void, remember = true) => {
      if (EDITOR_CONGELADO) {
        toast.info("O sistema está congelado para preservar a versão aprovada.");
        return;
      }
      if (remember) checkpoint();
      const next = cloneVisual(documentRef.current);
      mutate(ensurePage(next, route)[device]);
      next.updatedAt = new Date().toISOString();
      documentRef.current = next;
      setDocumento(next);
    },
    [checkpoint, route, device],
  );

  const camadasNativasHome = useMemo(
    () =>
      route === "/"
        ? CAMADAS_INICIAIS_HOME.filter(
            ([id]) =>
              !layout.patches.some((patch) => patch.selector === `[data-visual-id="${id}"]`),
          )
        : [],
    [route, layout.patches],
  );

  /** Seleciona uma camada já existente no site, sem criar objetos artificiais. */
  function abrirCamadaNativa(id: string, label: string, ocultar = false) {
    const selector = `[data-visual-id="${id}"]`;
    const doc = iframeRef.current?.contentDocument;
    const element = doc?.querySelector(selector) as HTMLElement | null;
    if (!element) {
      toast.error("Esta camada ainda não carregou na prévia.");
      return;
    }
    const existing = ensurePage(cloneVisual(documentRef.current), route)[device].patches.find(
      (item) => item.selector === selector,
    );
    if (existing) {
      if (ocultar)
        updateLayout((value) => {
          const alvo = value.patches.find((x) => x.id === existing.id);
          if (alvo) alvo.hidden = true;
        });
      setSelected([{ id: existing.id, kind: "patch" }]);
      return;
    }
    const rect = element.getBoundingClientRect();
    const patch: VisualPatch = {
      id: uid("element"),
      selector,
      label,
      hidden: ocultar,
      style: {
        baseWidth: Math.max(1, Math.round(rect.width)),
        baseHeight: Math.max(1, Math.round(rect.height)),
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      },
    };
    updateLayout((value) => value.patches.push(patch));
    setSelected([{ id: patch.id, kind: "patch" }]);
  }

  function undoNow() {
    const previous = undoRef.current.at(-1);
    if (!previous) return;
    redoRef.current = [...redoRef.current.slice(-39), cloneVisual(documentRef.current)];
    undoRef.current = undoRef.current.slice(0, -1);
    setRedo(redoRef.current);
    setUndo(undoRef.current);
    documentRef.current = cloneVisual(previous);
    setDocumento(documentRef.current);
    setSelected([]);
    setCroppingId(null);
  }
  function redoNow() {
    const next = redoRef.current.at(-1);
    if (!next) return;
    undoRef.current = [...undoRef.current.slice(-39), cloneVisual(documentRef.current)];
    redoRef.current = redoRef.current.slice(0, -1);
    setUndo(undoRef.current);
    setRedo(redoRef.current);
    documentRef.current = cloneVisual(next);
    setDocumento(documentRef.current);
    setSelected([]);
    setCroppingId(null);
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
    const selectionBounds = (element: HTMLElement, item?: SelectedItem) => {
      const rect = element.getBoundingClientRect();
      if (element.tagName !== "IMG" || !item) return rect;
      const current = ensurePage(cloneVisual(documentRef.current), route)[device];
      const layer =
        item.kind === "patch"
          ? current.patches.find((p) => p.id === item.id)
          : current.added.find((p) => p.id === item.id);
      if (!layer) return rect;
      const bounded = (value: unknown) => Math.max(0, Math.min(90, Number(value) || 0));
      const leftCrop = bounded(layer.style.cropLeft);
      const rightCrop = Math.min(bounded(layer.style.cropRight), 95 - leftCrop);
      const topCrop = bounded(layer.style.cropTop);
      const bottomCrop = Math.min(bounded(layer.style.cropBottom), 95 - topCrop);
      const left = rect.left + (rect.width * leftCrop) / 100;
      const right = rect.right - (rect.width * rightCrop) / 100;
      const top = rect.top + (rect.height * topCrop) / 100;
      const bottom = rect.bottom - (rect.height * bottomCrop) / 100;
      return {
        left,
        right,
        top,
        bottom,
        width: right - left,
        height: bottom - top,
      };
    };
    for (const [index, element] of elements.entries()) {
      const rect = selectionBounds(element, selectedRef.current[index]);
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

      // Duplo clique em uma imagem ativa o recorte, com oito alças visíveis.
      // A imagem original continua salva; só a máscara é modificada.
      const itemSelecionado = selectedRef.current[0];
      if (
        croppingId &&
        itemSelecionado?.id === croppingId &&
        elements.length === 1 &&
        elements[0].tagName === "IMG"
      ) {
        const page = ensurePage(cloneVisual(documentRef.current), route)[device];
        const alvo =
          itemSelecionado.kind === "patch"
            ? page.patches.find((x) => x.id === croppingId)
            : page.added.find((x) => x.id === croppingId);
        if (alvo) {
          const bounded = (v: unknown) => Math.max(0, Math.min(90, Number(v) || 0));
          const startCrop = {
            top: bounded(alvo.style.cropTop),
            right: bounded(alvo.style.cropRight),
            bottom: bounded(alvo.style.cropBottom),
            left: bounded(alvo.style.cropLeft),
          };
          const left = rect.left + (rect.width * startCrop.left) / 100;
          const right = rect.right - (rect.width * startCrop.right) / 100;
          const top = rect.top + (rect.height * startCrop.top) / 100;
          const bottom = rect.bottom - (rect.height * startCrop.bottom) / 100;
          const outline = doc.createElement("div");
          outline.dataset["oricseEditorOverlay"] = "1";
          Object.assign(outline.style, {
            position: "fixed",
            left: `${left}px`,
            top: `${top}px`,
            width: `${Math.max(1, right - left)}px`,
            height: `${Math.max(1, bottom - top)}px`,
            border: "2px dashed #fff",
            outline: "2px solid #6F293B",
            pointerEvents: "none",
            boxSizing: "border-box",
            zIndex: "2147483646",
          });
          doc.body.appendChild(outline);
          type Side = "top" | "right" | "bottom" | "left";
          const createCropHandle = (sides: Side[], x: number, y: number, cursor: string) => {
            const handle = doc.createElement("button");
            handle.type = "button";
            handle.dataset["oricseEditorOverlay"] = "1";
            handle.title = "Arraste para recortar: " + sides.join(" + ");
            handle.setAttribute("aria-label", handle.title);
            Object.assign(handle.style, {
              position: "fixed",
              left: `${x - 8}px`,
              top: `${y - 8}px`,
              width: "16px",
              height: "16px",
              borderRadius: "4px",
              background: "#fff",
              border: "2px solid #6F293B",
              boxShadow: "0 1px 5px rgba(0,0,0,.25)",
              cursor,
              pointerEvents: "auto",
              touchAction: "none",
              zIndex: "2147483647",
            });
            handle.addEventListener("pointerdown", (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              const sx = ev.clientX,
                sy = ev.clientY;
              let mudou = false;
              try {
                doc.body.setPointerCapture(ev.pointerId);
              } catch {
                /* navegador sem captura */
              }
              const move = (current: PointerEvent) => {
                const dx = ((current.clientX - sx) * 100) / Math.max(1, rect.width);
                const dy = ((current.clientY - sy) * 100) / Math.max(1, rect.height);
                if (!mudou && Math.abs(dx) + Math.abs(dy) < 0.25) return;
                if (!mudou) {
                  checkpoint();
                  mudou = true;
                }
                updateLayout((layoutAtual) => {
                  const target =
                    itemSelecionado.kind === "patch"
                      ? layoutAtual.patches.find((p) => p.id === itemSelecionado.id)
                      : layoutAtual.added.find((p) => p.id === itemSelecionado.id);
                  if (!target) return;
                  const next = { ...startCrop };
                  if (sides.includes("left"))
                    next.left = Math.max(0, Math.min(95 - next.right, startCrop.left + dx));
                  if (sides.includes("right"))
                    next.right = Math.max(0, Math.min(95 - next.left, startCrop.right - dx));
                  if (sides.includes("top"))
                    next.top = Math.max(0, Math.min(95 - next.bottom, startCrop.top + dy));
                  if (sides.includes("bottom"))
                    next.bottom = Math.max(0, Math.min(95 - next.top, startCrop.bottom - dy));
                  target.style.cropTop = Math.round(next.top * 10) / 10;
                  target.style.cropRight = Math.round(next.right * 10) / 10;
                  target.style.cropBottom = Math.round(next.bottom * 10) / 10;
                  target.style.cropLeft = Math.round(next.left * 10) / 10;
                }, false);
              };
              const stop = () => {
                doc.defaultView?.removeEventListener("pointermove", move);
                doc.defaultView?.removeEventListener("pointerup", stop);
                doc.defaultView?.removeEventListener("pointercancel", stop);
                try {
                  doc.body.releasePointerCapture(ev.pointerId);
                } catch {
                  /* sem captura */
                }
              };
              doc.defaultView?.addEventListener("pointermove", move);
              doc.defaultView?.addEventListener("pointerup", stop);
              doc.defaultView?.addEventListener("pointercancel", stop);
            });
            doc.body.appendChild(handle);
          };
          createCropHandle(["top", "left"], left, top, "nwse-resize");
          createCropHandle(["top"], (left + right) / 2, top, "ns-resize");
          createCropHandle(["top", "right"], right, top, "nesw-resize");
          createCropHandle(["right"], right, (top + bottom) / 2, "ew-resize");
          createCropHandle(["bottom", "right"], right, bottom, "nwse-resize");
          createCropHandle(["bottom"], (left + right) / 2, bottom, "ns-resize");
          createCropHandle(["bottom", "left"], left, bottom, "nesw-resize");
          createCropHandle(["left"], left, (top + bottom) / 2, "ew-resize");
          return;
        }
      }

      type ResizeMode = "horizontal" | "vertical" | "proportional";
      const beginResize = (mode: ResizeMode) => (event: PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();
        let recorded = false;
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
          // O evento já usa as coordenadas CSS internas do iframe; não dividir pelo zoom.
          const dx = ev.clientX - sx,
            dy = ev.clientY - sy;
          if (!recorded && Math.abs(dx) + Math.abs(dy) < 2) return;
          if (!recorded) {
            checkpoint();
            recorded = true;
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
      const visible = selectionBounds(elements[0], selectedRef.current[0]);
      createHandle("horizontal", "Alterar somente a largura", {
        left: `${visible.left - 5}px`,
        top: `${visible.top + visible.height / 2 - 18}px`,
        width: "10px",
        height: "36px",
        borderRadius: "6px",
        cursor: "ew-resize",
      });
      createHandle("vertical", "Alterar somente a altura", {
        left: `${visible.left + visible.width / 2 - 18}px`,
        top: `${visible.bottom - 5}px`,
        width: "36px",
        height: "10px",
        borderRadius: "6px",
        cursor: "ns-resize",
      });
      createHandle("proportional", "Redimensionar mantendo a proporção", {
        left: `${visible.right - 9}px`,
        top: `${visible.bottom - 9}px`,
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        cursor: "nwse-resize",
      });
    }
  }, [checkpoint, selectedElements, updateLayout, route, device, croppingId]);

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
      historyRecorded: boolean;
    } = null;
    let ultimaImagemPressionada: { element: Element; time: number } | null = null;
    const pointerDown = (event: PointerEvent) => {
      const raw = event.target as Element | null;
      if (!raw || raw.closest("[data-oricse-editor-overlay]")) return;
      event.preventDefault();
      event.stopPropagation();
      // Dentro do banner, um clique no texto ou ícone seleciona a camada
      // nomeada correspondente, e não um span filho ou bloco gigante.
      const nomeado = raw.closest("[data-visual-id]") as HTMLElement | null;
      const element =
        nomeado && nomeado.dataset.visualId !== "home-fundo-bege" ? nomeado : editableTarget(raw);
      // Reconhece dois cliques mesmo que preventDefault suprima o dblclick.
      const agora = Date.now();
      const doisCliquesNaImagem =
        element.tagName === "IMG" &&
        ultimaImagemPressionada?.element === element &&
        agora - ultimaImagemPressionada.time < 420;
      ultimaImagemPressionada = element.tagName === "IMG" ? { element, time: agora } : null;
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
          updateLayout((value) => value.patches.push(patch!), true);
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
      setCroppingId(doisCliquesNaImagem && next.length === 1 ? item.id : null);
      const page = ensurePage(cloneVisual(documentRef.current), route)[device];
      const starts = next.map((entry) => {
        const target =
          entry.kind === "patch"
            ? page.patches.find((x) => x.id === entry.id)
            : page.added.find((x) => x.id === entry.id);
        return {
          item: entry,
          x: target?.style.x || 0,
          y: target?.style.y || 0,
        };
      });
      drag = {
        sx: event.clientX,
        sy: event.clientY,
        starts,
        historyRecorded: false,
      };
    };
    const move = (event: PointerEvent) => {
      // React may run the state updater after pointerup has cleared drag.
      // Capture an immutable reference for this event, rather than reading
      // drag inside the deferred update and crashing on drag.starts.
      const activeDrag = drag;
      if (!activeDrag) return;
      const dx = event.clientX - activeDrag.sx,
        dy = event.clientY - activeDrag.sy;
      if (!activeDrag.historyRecorded && Math.abs(dx) + Math.abs(dy) < 2) return;
      if (!activeDrag.historyRecorded) {
        checkpoint();
        activeDrag.historyRecorded = true;
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
    const doubleClick = (event: MouseEvent) => {
      const image = (event.target as Element | null)?.closest("img");
      if (!image || image.closest("[data-oricse-editor-overlay]")) return;
      event.preventDefault();
      event.stopPropagation();
      const addedId = image.closest(`[${VISUAL_NODE_ATTR}]`)?.getAttribute(VISUAL_NODE_ATTR);
      let target: SelectedItem | null = addedId ? { id: addedId, kind: "added" } : null;
      if (!target) {
        const selector = visualSelector(image);
        let patch = ensurePage(cloneVisual(documentRef.current), route)[device].patches.find(
          (p) => p.selector === selector,
        );
        if (!patch) {
          const box = image.getBoundingClientRect();
          patch = {
            id: uid("image"),
            selector,
            label: visualLabel(image),
            style: {
              baseWidth: box.width,
              baseHeight: box.height,
              width: box.width,
              height: box.height,
            },
          };
          updateLayout((layoutAtual) => layoutAtual.patches.push(patch!), true);
        }
        target = { id: patch.id, kind: "patch" };
      }
      setSelected([target]);
      selectedRef.current = [target];
      setCroppingId(target.id);
    };
    const onFrameKey = (event: KeyboardEvent) => {
      const target = event.target as Element | null;
      if (
        typeof target?.closest === "function" &&
        target.closest("input,textarea,select,[contenteditable='true']")
      )
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redoNow();
        else undoNow();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redoNow();
      } else if (event.key === "Delete" && selectedRef.current.length) {
        event.preventDefault();
        hideOrDelete();
      } else if (event.key === "Escape") {
        setCroppingId(null);
      }
    };
    const block = (event: Event) => {
      if ((event.target as Element)?.closest("a,button,form")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    doc.addEventListener("pointerdown", pointerDown, true);
    doc.addEventListener("dblclick", doubleClick, true);
    win.addEventListener("keydown", onFrameKey, true);
    win.addEventListener("pointermove", move, true);
    win.addEventListener("pointerup", stop, true);
    win.addEventListener("pointercancel", stop, true);
    win.addEventListener("blur", stop, true);
    doc.addEventListener("click", block, true);
    doc.addEventListener("submit", block, true);
    cleanupFrameListenersRef.current = () => {
      drag = null;
      doc.removeEventListener("pointerdown", pointerDown, true);
      doc.removeEventListener("dblclick", doubleClick, true);
      win.removeEventListener("keydown", onFrameKey, true);
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
  function addImageFromUrl() {
    const src = window.prompt(
      "Cole o endereço da imagem (URL HTTPS, caminho do site ou data:image):",
      "",
    );
    if (!src) return;
    if (!validImageSource(src)) return toast.error("Use uma URL de imagem válida.");
    const item: VisualAdded = {
      id: uid("image"),
      kind: "image",
      src: normalizeImageSource(src),
      text: "Imagem",
      style: { x: 40, y: 80, width: 260, height: 200, zIndex: 20 },
    };
    updateLayout((value) => value.added.push(item));
    setSelected([{ id: item.id, kind: "added" }]);
  }
  async function uploadImage(file?: File) {
    if (!file) return;
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      toast.error("Use uma imagem PNG, JPG, WebP ou GIF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 10 MB.");
      return;
    }
    setUploadingImage(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken)
        throw new Error("Sessão expirada. Entre novamente no sistema.");
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("Não foi possível ler a imagem."));
        reader.readAsDataURL(file);
      });
      const upload = await enviarArquivoPublicoPlataforma({
        data: { accessToken, nome: file.name, mimeType: file.type, base64 },
      });
      if (!upload.url || !validImageSource(upload.url))
        throw new Error("O Google Drive não retornou uma imagem válida.");
      const id = uid("image");
      updateLayout((value) =>
        value.added.push({
          id,
          kind: "image",
          src: upload.url,
          text: file.name,
          style: { x: 40, y: 80, width: 260, height: 200, zIndex: 20 },
        }),
      );
      setSelected([{ id, kind: "added" }]);
      toast.success("Imagem enviada. Salve o rascunho ou publique para manter a alteração.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
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
    if (!selectedRef.current.length) return;
    updateLayout((value) =>
      selectedRef.current.forEach((item) => {
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
    if (EDITOR_CONGELADO) {
      toast.info("O sistema está congelado para preservar a versão aprovada.");
      return;
    }
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
    if (EDITOR_CONGELADO) {
      toast.info("O sistema está congelado para preservar a versão aprovada.");
      return;
    }
    if (savingRef.current || conflict || loadError) return;
    savingRef.current = true;
    setSaving(true);
    const payload = { ...documento, updatedAt: new Date().toISOString() };
    const history: Version[] = [
      {
        id: uid("version"),
        publishedAt: payload.updatedAt,
        pages: cloneVisual(payload.pages),
      },
      ...versions,
    ].slice(0, 12);
    try {
      // All three entries go through a single coordinated Drive journal event.
      // No partial publication of page, draft or version history.
      const { data, error } = await (supabase as any)
        .from("oricse_config")
        .upsert(
          saveRows([
            {
              chave: VISUAL_PUBLISHED_KEY,
              valor: payload,
              updated_at: payload.updatedAt,
            },
            {
              chave: VISUAL_DRAFT_KEY,
              valor: payload,
              updated_at: payload.updatedAt,
            },
            {
              chave: VISUAL_VERSIONS_KEY,
              valor: history,
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
        channel.postMessage({
          type: "published",
          updatedAt: payload.updatedAt,
        });
        channel.close();
      }
      window.dispatchEvent(new Event("oricse:visual-published"));
      toast.success("Publicado e confirmado no site real.", {
        id: "oricse-canvas-published",
      });
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
        checkpoint();
        documentRef.current = cloneVisual(reconciled.merged);
        setDocumento(documentRef.current);
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
    checkpoint();
    if (!useLocal) {
      documentRef.current = cloneVisual(conflict.remote);
      setDocumento(documentRef.current);
    }
    setConflict(null);
  }

  function restore(version: Version) {
    checkpoint();
    const restored = {
      version: 1 as const,
      updatedAt: new Date().toISOString(),
      pages: cloneVisual(version.pages),
    };
    documentRef.current = restored;
    setDocumento(restored);
    setSelected([]);
    toast.success("Versão carregada como rascunho. Revise e publique.");
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as Element | null;
      if (
        typeof target?.closest === "function" &&
        target.closest("input,textarea,select,[contenteditable='true']")
      )
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redoNow();
        } else {
          undoNow();
        }
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redoNow();
      } else if (event.key === "Delete" && selectedRef.current.length) {
        event.preventDefault();
        hideOrDelete();
      } else if (event.key === "Escape") {
        setCroppingId(null);
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
  const isImageSelected = Boolean(
    first && selected.length === 1 && selectedElements()[0]?.tagName === "IMG",
  );

  return (
    <main className="min-h-screen bg-[#ded9d3] text-slate-900">
      <header className="sticky top-0 z-50 flex min-h-16 flex-wrap items-center gap-2 border-b bg-white px-3 py-2 shadow-sm">
        <Link
          to="/admin"
          onClick={(event) => {
            const mudou = !sameEditorJson(documento.pages, baselineRef.current.pages);
            if (mudou && !window.confirm("Há alterações não salvas. Voltar ao Admin sem salvar?")) {
              event.preventDefault();
            }
          }}
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold"
        >
          <ArrowLeft size={17} /> Voltar ao Admin
        </Link>
        <button
          type="button"
          onClick={alternarMenuAdmin}
          aria-expanded={!adminMenuRecolhido}
          aria-label={
            adminMenuRecolhido ? "Expandir menu da Administração" : "Recolher menu da Administração"
          }
          title={
            adminMenuRecolhido ? "Mostrar menu da Administração" : "Recolher menu da Administração"
          }
          className="hidden items-center gap-2 rounded-xl border px-3 py-2 font-semibold lg:inline-flex"
        >
          {adminMenuRecolhido ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          <span className="hidden xl:inline">
            {adminMenuRecolhido ? "Mostrar menu" : "Recolher menu"}
          </span>
        </button>
        <button
          onClick={() => setLeftOpen((x) => !x)}
          aria-label={leftOpen ? "Recolher páginas e camadas" : "Mostrar páginas e camadas"}
          aria-expanded={leftOpen}
          className="rounded-xl border p-2"
          title={leftOpen ? "Recolher páginas e camadas" : "Mostrar páginas e camadas"}
        >
          <Layers3 size={18} />
        </button>
        <button
          onClick={addText}
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold"
        >
          <Type size={17} /> Texto
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          aria-label="Selecionar imagem do computador"
          onChange={(event) => {
            void uploadImage(event.currentTarget.files?.[0]);
          }}
        />
        <button
          type="button"
          disabled={uploadingImage}
          onClick={() => imageInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold disabled:opacity-50"
        >
          <ImagePlus size={17} /> {uploadingImage ? "Enviando…" : "Enviar imagem"}
        </button>
        <button
          type="button"
          onClick={addImageFromUrl}
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold"
        >
          Imagem por URL
        </button>
        <button
          disabled={!undo.length}
          onClick={undoNow}
          aria-label="Desfazer (Ctrl+Z)"
          title="Desfazer (Ctrl+Z)"
          className="rounded-xl border p-2 disabled:opacity-30"
        >
          <Undo2 size={18} />
        </button>
        <button
          disabled={!redo.length}
          onClick={redoNow}
          aria-label="Refazer (Ctrl+Shift+Z)"
          title="Refazer (Ctrl+Shift+Z)"
          className="rounded-xl border p-2 disabled:opacity-30"
        >
          <Redo2 size={18} />
        </button>
        <div className="mx-1 h-8 w-px bg-slate-200" />
        <button
          onClick={() => {
            setDevice("desktop");
            setSelected([]);
            setCroppingId(null);
          }}
          className={`rounded-xl p-2 ${device === "desktop" ? "bg-primary text-white" : "border"}`}
        >
          <Monitor size={18} />
        </button>
        <button
          onClick={() => {
            setDevice("mobile");
            setSelected([]);
            setCroppingId(null);
          }}
          className={`rounded-xl p-2 ${device === "mobile" ? "bg-primary text-white" : "border"}`}
        >
          <Smartphone size={18} />
        </button>
        <select
          value={zoom}
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
          onClick={() => setRightOpen((x) => !x)}
          className="rounded-xl border p-2"
          title="Propriedades"
        >
          <Move size={18} />
        </button>
        <div className="ml-auto flex items-center gap-2">
          {lastPublishedAt && (
            <span className="hidden text-xs font-semibold text-emerald-700 xl:inline">
              No site: {new Date(lastPublishedAt).toLocaleString("pt-BR")}
            </span>
          )}
          <button
            disabled={saving || Boolean(conflict) || EDITOR_CONGELADO}
            onClick={saveDraft}
            title={EDITOR_CONGELADO ? "Sistema congelado" : "Salvar rascunho"}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-semibold"
          >
            <Save size={17} /> Salvar rascunho
          </button>
          <button
            disabled={saving || Boolean(conflict) || EDITOR_CONGELADO}
            onClick={publish}
            title={EDITOR_CONGELADO ? "Sistema congelado" : "Publicar no site"}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-semibold text-white"
          >
            <UploadCloud size={17} /> {saving ? "Publicando…" : "Publicar no site"}
          </button>
        </div>
      </header>
      {EDITOR_CONGELADO ? (
        <section className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-center text-sm font-semibold text-emerald-900">
          🔒 Sistema congelado — páginas e publicação protegidas contra alterações acidentais.
        </section>
      ) : paginaInicialProtegida ? (
        <section className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-center text-sm font-semibold text-emerald-900">
          🔒 Página inicial bloqueada — visualização aprovada e protegida contra alterações acidentais.
        </section>
      ) : null}
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
        className="grid min-h-[calc(100vh-64px)] min-w-0"
        style={{
          gridTemplateColumns: `${leftOpen ? "260px" : "64px"} minmax(0,1fr) ${rightOpen ? "290px" : "64px"}`,
        }}
      >
        {leftOpen ? (
          <aside className="min-w-0 border-r bg-white p-3">
            <button
              type="button"
              onClick={() => setLeftOpen(false)}
              aria-label="Recolher menu de páginas e camadas"
              title="Recolher menu"
              className="mb-3 flex h-9 w-full items-center justify-end gap-2 rounded-lg border px-2 text-xs font-semibold hover:bg-slate-50"
            >
              Recolher <ChevronLeft size={17} />
            </button>
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
                  setCroppingId(null);
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
                ...camadasNativasHome.map(([id, label]) => ({
                  item: { id, kind: "native" as const },
                  label,
                  hidden: false,
                })),
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
                      onClick={() =>
                        item.kind === "native"
                          ? abrirCamadaNativa(item.id, label)
                          : setSelected([item])
                      }
                      className="min-w-0 flex-1 truncate px-2 py-1 text-left text-xs font-semibold"
                    >
                      {label}
                    </button>
                    <button
                      onClick={() =>
                        item.kind === "native"
                          ? abrirCamadaNativa(item.id, label, true)
                          : toggleVisibility(item)
                      }
                      className="p-1 text-muted-foreground"
                    >
                      {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                ))}
              {!layout.added.length && !layout.patches.length && !camadasNativasHome.length && (
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
        ) : (
          <aside
            className="flex min-w-0 flex-col items-center gap-3 border-r bg-white px-1 py-3"
            aria-label="Menu de páginas e camadas recolhido"
          >
            <button
              type="button"
              onClick={() => setLeftOpen(true)}
              aria-label="Expandir menu de páginas e camadas"
              title="Expandir menu"
              className="flex h-10 w-10 items-center justify-center rounded-lg border hover:bg-slate-50"
            >
              <ChevronRight size={20} />
            </button>
            <button
              type="button"
              onClick={() => setLeftOpen(true)}
              aria-label="Páginas do ORICSE"
              title="Páginas do ORICSE"
              className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100"
            >
              <Layers3 size={20} />
            </button>
            <button
              type="button"
              onClick={() => setLeftOpen(true)}
              aria-label="Camadas"
              title="Camadas"
              className="flex h-10 w-10 items-center justify-center rounded-lg border text-xs font-bold hover:bg-slate-100"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => setLeftOpen(true)}
              aria-label="Versões"
              title="Versões"
              className="flex h-10 w-10 items-center justify-center rounded-lg border text-xs font-bold hover:bg-slate-100"
            >
              V
            </button>
          </aside>
        )}

        <section className="min-w-0 overflow-auto p-6">
          <div
            className="mx-auto origin-top"
            style={{ width: frameWidth * scale, minHeight: 760 * scale }}
          >
            <div
              className="origin-top-left overflow-hidden rounded-lg bg-white shadow-2xl"
              style={{
                width: frameWidth,
                height: device === "desktop" ? 900 : 844,
                transform: `scale(${scale})`,
              }}
            >
              {paginaResolvida && (
                <iframe
                  key={`${route}-${device}`}
                  ref={iframeRef}
                  src={`${route}${route.includes("?") ? "&" : "?"}visual_editor=1`}
                  onLoad={bindFrame}
                  title={`Editor de ${route}`}
                  className="h-full w-full border-0 bg-white"
                  style={{ width: frameWidth }}
                />
              )}
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-slate-600">
            Clique para selecionar. Shift + clique seleciona vários. Arraste para mover. A alça
            esquerda muda a largura, a inferior muda a altura e a bolinha mantém a proporção. Dê
            dois cliques em uma imagem para recortar.
          </p>
        </section>

        {rightOpen ? (
          <aside className="min-w-0 border-l bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">Propriedades</h2>
              <button
                type="button"
                onClick={() => setRightOpen(false)}
                aria-label="Recolher propriedades"
                title="Recolher propriedades"
                className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-slate-50"
              >
                <ChevronRight size={18} />
              </button>
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
                          if (x) x.src = normalizeImageSource(e.target.value);
                        })
                      }
                      className="mt-1 w-full rounded-xl border p-2 font-normal"
                    />
                  </label>
                )}
                {isImageSelected && (
                  <div className="rounded-xl border border-[#e2cbd0] bg-[#fff8f8] p-3">
                    <p className="flex items-center gap-2 text-sm font-bold text-[#6F293B]">
                      <Crop size={17} /> Recorte da imagem
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Dê dois cliques na imagem ou clique em Recortar. Arraste os quatro lados ou
                      cantos para definir o corte.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCroppingId(croppingId === first?.id ? null : first?.id || null)
                        }
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white"
                      >
                        <Crop size={15} />{" "}
                        {croppingId === first?.id ? "Concluir recorte" : "Recortar imagem"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          patchSelected({
                            cropTop: 0,
                            cropRight: 0,
                            cropBottom: 0,
                            cropLeft: 0,
                          })
                        }
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-bold"
                      >
                        <RotateCcw size={15} /> Restaurar original
                      </button>
                    </div>
                    {croppingId === first?.id && (
                      <p className="mt-2 text-xs font-medium text-primary">
                        Arraste as alças. O recorte é salvo sem apagar a imagem original.
                      </p>
                    )}
                  </div>
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
        ) : (
          <aside
            className="flex min-w-0 flex-col items-center gap-3 border-l bg-white px-1 py-3"
            aria-label="Propriedades recolhidas"
          >
            <button
              type="button"
              onClick={() => setRightOpen(true)}
              aria-label="Expandir propriedades"
              title="Expandir propriedades"
              className="flex h-10 w-10 items-center justify-center rounded-lg border hover:bg-slate-50"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => setRightOpen(true)}
              aria-label="Propriedades do elemento"
              title="Propriedades do elemento"
              className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100"
            >
              <Move size={19} />
            </button>
            <button
              type="button"
              onClick={() => setRightOpen(true)}
              aria-label="Editar texto e imagem"
              title="Texto e imagem"
              className="flex h-10 w-10 items-center justify-center rounded-lg border text-xs font-bold hover:bg-slate-100"
            >
              T
            </button>
          </aside>
        )}
      </div>
    </main>
  );
}
