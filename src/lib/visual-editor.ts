export type VisualDevice = "desktop" | "mobile";

export type VisualStyle = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  baseWidth?: number;
  baseHeight?: number;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  fill?: string;
  stroke?: string;
  textAlign?: "left" | "center" | "right";
  opacity?: number;
  borderRadius?: number;
  zIndex?: number;
  // Recorte não destrutivo: percentual de cada borda da imagem original.
  cropTop?: number;
  cropRight?: number;
  cropBottom?: number;
  cropLeft?: number;
};

export type VisualPatch = {
  id: string;
  selector: string;
  label: string;
  text?: string;
  hidden?: boolean;
  style: VisualStyle;
};

export type VisualAdded = {
  id: string;
  kind: "text" | "image";
  text?: string;
  src?: string;
  style: VisualStyle;
};

export type VisualLayout = { patches: VisualPatch[]; added: VisualAdded[] };
export type VisualPage = { desktop: VisualLayout; mobile: VisualLayout };
export type VisualDocument = { version: 1; updatedAt: string; pages: Record<string, VisualPage> };

export const EMPTY_LAYOUT = (): VisualLayout => ({ patches: [], added: [] });
export const EMPTY_DOCUMENT = (): VisualDocument => ({ version: 1, updatedAt: new Date().toISOString(), pages: {} });

export const VISUAL_DRAFT_KEY = "visual_editor_draft";
export const VISUAL_PUBLISHED_KEY = "visual_editor_published";
export const VISUAL_VERSIONS_KEY = "visual_editor_versions";
export const VISUAL_NODE_ATTR = "data-oricse-visual-added";

export function ensurePage(documento: VisualDocument, route: string): VisualPage {
  if (!documento.pages[route]) documento.pages[route] = { desktop: EMPTY_LAYOUT(), mobile: EMPTY_LAYOUT() };
  return documento.pages[route];
}

function esc(value: string) {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

export function visualSelector(element: Element): string {
  const explicit = element.getAttribute("data-visual-id");
  if (explicit) return `[data-visual-id="${esc(explicit)}"]`;
  if (element.id) return `#${esc(element.id)}`;
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== element.ownerDocument.body) {
    let part = current.tagName.toLowerCase();
    const parent = current.parentElement;
    if (parent) {
      const siblings = (Array.from(parent.children) as Element[]).filter((item) => item.tagName === current!.tagName);
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
    }
    parts.unshift(part);
    if (current.tagName.toLowerCase() === "main") break;
    current = parent;
  }
  return parts.join(" > ");
}

export function visualLabel(element: Element): string {
  const text = (element.textContent || "").replace(/\s+/g, " ").trim();
  const named = element.getAttribute("data-visual-label") || element.getAttribute("aria-label") || element.getAttribute("alt") || text;
  return named.slice(0, 54) || element.tagName.toLowerCase();
}

export function editableTarget(target: Element): HTMLElement {
  const preferred = target.closest(`[${VISUAL_NODE_ATTR}],button,a,input,textarea,select,img,svg,h1,h2,h3,h4,h5,h6,p,label,li,article,section,header,footer,nav,aside,div,span`) as HTMLElement | null;
  return preferred || (target as HTMLElement);
}

function boundedCrop(value: unknown) {
  return Math.min(90, Math.max(0, Number(value) || 0));
}

function visualCanvasScale(element: HTMLElement, style: VisualStyle) {
  const viewport = Math.max(
    1,
    element.ownerDocument.documentElement.clientWidth ||
      element.ownerDocument.defaultView?.innerWidth ||
      1,
  );
  // A prancheta do Canva é sempre 1440 px no computador e 390 px no celular.
  // Coordenadas gravadas no editor precisam acompanhar a página publicada,
  // em vez de manter pixels absolutos de outra tela.
  const reference = viewport < 768 ? 390 : 1440;
  return viewport / reference;
}

export function applyVisualStyle(element: HTMLElement, style: VisualStyle, independentLayer = false) {
  const coordinateScale = visualCanvasScale(element, style);
  const px = (value: number | undefined) => Math.max(0, (value || 0) * coordinateScale);

  if (independentLayer) {
    const measured = element.getBoundingClientRect();
    const targetWidth = style.width != null ? px(style.width) : measured.width;
    const targetHeight = style.height != null ? px(style.height) : measured.height;
    const scaleX = style.width != null ? Math.max(0.02, targetWidth / Math.max(1, measured.width)) : 1;
    const scaleY = style.height != null ? Math.max(0.02, targetHeight / Math.max(1, measured.height)) : 1;
    element.style.transformOrigin = "top left";
    element.style.translate = `${(style.x || 0) * coordinateScale}px ${(style.y || 0) * coordinateScale}px`;
    element.style.scale = `${scaleX} ${scaleY}`;
    element.style.willChange = "translate, scale";
  } else {
    element.style.translate = `${(style.x || 0) * coordinateScale}px ${(style.y || 0) * coordinateScale}px`;
    if (style.width != null) element.style.width = `${Math.max(1, px(style.width))}px`;
    if (style.height != null) element.style.height = `${Math.max(1, px(style.height))}px`;
  }
  if (style.fontSize != null) element.style.fontSize = `${Math.max(1, px(style.fontSize))}px`;
  if (style.fontWeight != null) element.style.fontWeight = String(style.fontWeight);
  if (style.color) element.style.color = style.color;
  if (style.backgroundColor) element.style.backgroundColor = style.backgroundColor;
  if (style.borderColor) element.style.borderColor = style.borderColor;
  if (style.borderWidth != null) {
    element.style.borderWidth = `${Math.max(0, px(style.borderWidth))}px`;
    element.style.borderStyle = element.style.borderStyle || "solid";
  }
  if (style.fill) {
    element.style.fill = style.fill;
    element.querySelectorAll("path,circle,rect,polygon,ellipse").forEach((node) => (node as SVGElement).style.fill = style.fill!);
  }
  if (style.stroke) {
    element.style.stroke = style.stroke;
    element.querySelectorAll("path,circle,rect,line,polyline,polygon,ellipse").forEach((node) => (node as SVGElement).style.stroke = style.stroke!);
  }
  if (style.textAlign) element.style.textAlign = style.textAlign;
  if (style.opacity != null) element.style.opacity = String(style.opacity);
  if (style.borderRadius != null) element.style.borderRadius = `${Math.max(0, px(style.borderRadius))}px`;
  if (style.zIndex != null) {
    element.style.position = element.style.position || "relative";
    element.style.zIndex = String(style.zIndex);
  }
  if (element.tagName === "IMG") {
    const top = boundedCrop(style.cropTop), right = boundedCrop(style.cropRight);
    const bottom = boundedCrop(style.cropBottom), left = boundedCrop(style.cropLeft);
    if (top || right || bottom || left) {
      element.style.clipPath = `inset(${top}% ${right}% ${bottom}% ${left}%)`;
    } else {
      element.style.removeProperty("clip-path");
    }
  }
}

/**
 * Converte links de compartilhamento do Google Drive para um endpoint que
 * realmente entrega os bytes da imagem em <img>. O link /uc costuma redirecionar
 * para uma página de confirmação e aparece quebrado dentro do Canvas/iframe.
 */
export function normalizeImageSource(src: string) {
  const value = src.trim();
  if (!value) return value;
  const driveId = value.match(
    /^https?:\/\/(?:www\.)?drive\.google\.com\/uc\?(?:[^#]*&)?id=([^&#]+)/i,
  )?.[1]
    || value.match(/^https?:\/\/(?:www\.)?drive\.google\.com\/file\/d\/([^/?#]+)/i)?.[1]
    || value.match(/^https?:\/\/(?:www\.)?drive\.google\.com\/open\?id=([^&#]+)/i)?.[1];
  if (driveId) return `https://lh3.googleusercontent.com/d/${encodeURIComponent(driveId)}=w2000`;
  const contentId = value.match(
    /^https?:\/\/lh3\.googleusercontent\.com\/d\/([^/?#=]+)/i,
  )?.[1];
  if (contentId) return `https://lh3.googleusercontent.com/d/${encodeURIComponent(contentId)}=w2000`;
  return value;
}

export function validImageSource(src: string) {
  return /^(https?:\/\/|\/|data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,)/i.test(src.trim());
}

type OriginalPatchState = {
  style: string | null;
  innerHTML: string | null;
  descendants: Array<{ node: Element; style: string | null }>;
};
const originalPatchState = new WeakMap<HTMLElement, OriginalPatchState>();

function restoreStyle(element: Element, original: string | null) {
  if (original === null) element.removeAttribute("style");
  else element.setAttribute("style", original);
}

export function applyVisualLayout(doc: Document, layout?: VisualLayout) {
  // Fundamental para que Desfazer/Refazer funcione visualmente: os patches
  // anteriores não podem deixar estilos inline no iframe após saírem do estado.
  doc.querySelectorAll<HTMLElement>("[data-oricse-visual-patched]").forEach((node) => {
    const original = originalPatchState.get(node);
    if (original) {
      restoreStyle(node, original.style);
      if (original.innerHTML !== null) node.innerHTML = original.innerHTML;
      original.descendants.forEach(({ node: child, style }) => {
        if (child.isConnected) restoreStyle(child, style);
      });
    }
    node.removeAttribute("data-oricse-visual-patched");
  });
  doc.querySelectorAll(`[${VISUAL_NODE_ATTR}]`).forEach((node) => node.remove());
  // Normalize também as imagens nativas da página para o preview do Canvas.
  doc.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    const source = image.getAttribute("src") || "";
    const normalized = normalizeImageSource(source);
    if (normalized && normalized !== source) image.src = normalized;
  });
  if (!layout) return;
  for (const patch of layout.patches) {
    let element: HTMLElement | null = null;
    try { element = doc.querySelector(patch.selector) as HTMLElement | null; } catch { continue; }
    if (!element) continue;
    if (!originalPatchState.has(element)) {
      originalPatchState.set(element, {
        style: element.getAttribute("style"),
        innerHTML: null,
        descendants: Array.from(element.querySelectorAll("path,circle,rect,line,polyline,polygon,ellipse")).map((child) => ({
          node: child, style: child.getAttribute("style"),
        })),
      });
    }
    const original = originalPatchState.get(element)!;
    if (patch.text != null && original.innerHTML === null && !["IMG","INPUT","TEXTAREA","SELECT"].includes(element.tagName)) {
      original.innerHTML = element.innerHTML;
    }
    element.dataset["oricseVisualPatched"] = patch.id;
    element.style.visibility = patch.hidden ? "hidden" : "";
    element.style.pointerEvents = patch.hidden ? "none" : "";
    if (patch.text != null && !["IMG", "INPUT", "TEXTAREA", "SELECT"].includes(element.tagName)) element.textContent = patch.text;
    applyVisualStyle(element, patch.style || {}, true);
  }
  const host = (doc.querySelector("main.portal-tutor-login-screen") || doc.querySelector("main") || doc.body) as HTMLElement;
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  for (const item of layout.added) {
    const node = item.kind === "image" ? doc.createElement("img") : doc.createElement("div");
    node.setAttribute(VISUAL_NODE_ATTR, item.id);
    node.setAttribute("data-visual-id", item.id);
    node.style.position = "absolute";
    node.style.left = "0";
    node.style.top = "0";
    node.style.whiteSpace = "pre-wrap";
    if (item.kind === "image") {
      const image = node as HTMLImageElement;
      image.alt = item.text || "Imagem adicionada";
      image.src = item.src && validImageSource(item.src) ? normalizeImageSource(item.src) : "";
      image.style.objectFit = "contain";
    } else node.textContent = item.text || "Novo texto";
    applyVisualStyle(node, item.style || {});
    host.appendChild(node);
  }
}

export function cloneVisual<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
