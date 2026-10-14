export type VisualDevice = "desktop" | "mobile";

export type VisualStyle = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  backgroundColor?: string;
  textAlign?: "left" | "center" | "right";
  opacity?: number;
  borderRadius?: number;
  zIndex?: number;
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
      const siblings = Array.from(parent.children).filter((item) => item.tagName === current!.tagName);
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
  const named = element.getAttribute("aria-label") || element.getAttribute("alt") || text;
  return named.slice(0, 54) || element.tagName.toLowerCase();
}

export function editableTarget(target: Element): HTMLElement {
  const preferred = target.closest("h1,h2,h3,h4,p,span,label,button,a,img,article,section,header,footer,nav,aside,input,textarea,select") as HTMLElement | null;
  return preferred || (target as HTMLElement);
}

export function applyVisualStyle(element: HTMLElement, style: VisualStyle) {
  element.style.translate = `${style.x || 0}px ${style.y || 0}px`;
  if (style.width != null) element.style.width = `${Math.max(1, style.width)}px`;
  if (style.height != null) element.style.height = `${Math.max(1, style.height)}px`;
  if (style.fontSize != null) element.style.fontSize = `${Math.max(1, style.fontSize)}px`;
  if (style.fontWeight != null) element.style.fontWeight = String(style.fontWeight);
  if (style.color) element.style.color = style.color;
  if (style.backgroundColor) element.style.backgroundColor = style.backgroundColor;
  if (style.textAlign) element.style.textAlign = style.textAlign;
  if (style.opacity != null) element.style.opacity = String(style.opacity);
  if (style.borderRadius != null) element.style.borderRadius = `${Math.max(0, style.borderRadius)}px`;
  if (style.zIndex != null) { element.style.position = element.style.position || "relative"; element.style.zIndex = String(style.zIndex); }
}

export function validImageSource(src: string) {
  return /^(https?:\/\/|\/|data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,)/i.test(src.trim());
}

export function applyVisualLayout(doc: Document, layout?: VisualLayout) {
  doc.querySelectorAll(`[${VISUAL_NODE_ATTR}]`).forEach((node) => node.remove());
  if (!layout) return;
  for (const patch of layout.patches) {
    let element: HTMLElement | null = null;
    try { element = doc.querySelector(patch.selector) as HTMLElement | null; } catch { continue; }
    if (!element) continue;
    element.dataset["oricseVisualPatched"] = patch.id;
    element.style.display = patch.hidden ? "none" : "";
    if (patch.text != null && !["IMG", "INPUT", "TEXTAREA", "SELECT"].includes(element.tagName)) element.textContent = patch.text;
    applyVisualStyle(element, patch.style || {});
  }
  const host = (doc.querySelector("main") || doc.body) as HTMLElement;
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
      image.src = item.src && validImageSource(item.src) ? item.src : "";
      image.style.objectFit = "contain";
    } else node.textContent = item.text || "Novo texto";
    applyVisualStyle(node, item.style || {});
    host.appendChild(node);
  }
}

export function cloneVisual<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
