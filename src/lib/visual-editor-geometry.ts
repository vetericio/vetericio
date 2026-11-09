import type { VisualStyle } from "./visual-editor";

export type CanvasRect = {
  left: number; top: number; right: number; bottom: number;
  width: number; height: number;
};
export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export type CropSide = "top" | "right" | "bottom" | "left";

export const rectOf = (left: number, top: number, right: number, bottom: number): CanvasRect => ({
  left, top, right, bottom,
  width: Math.max(0, right - left), height: Math.max(0, bottom - top),
});

export const intersectRect = (a: CanvasRect, b: CanvasRect): CanvasRect => {
  const left = Math.max(a.left,b.left), top = Math.max(a.top,b.top);
  return rectOf(left,top,Math.max(left,Math.min(a.right,b.right)),
                        Math.max(top,Math.min(a.bottom,b.bottom)));
};

const percentage = (v: number | undefined) => Math.min(95, Math.max(0, Number(v) || 0));

function objectPositionRatio(token: string | undefined, axis: "x"|"y"): number {
  if (!token) return 0.5;
  const key = token.toLowerCase();
  if (key === "left" || key === "top") return 0;
  if (key === "right" || key === "bottom") return 1;
  if (key === "center") return 0.5;
  const n = token.match(/^(-?\d+(?:\.\d+)?)%$/);
  if (n) return Number(n[1]) / 100;
  return axis === "x" ? 0.5 : 0.5;
}

/**
 * Extensão dos pixels realmente desenhados. Para object-fit: contain, o IMG
 * pode ter uma caixa maior do que a fotografia, e o contorno deve seguir
 * somente a fotografia (inclusive com scale / translate CSS).
 */
export function paintedImageRect(element: HTMLElement): CanvasRect {
  const box = element.getBoundingClientRect();
  const outer = rectOf(box.left,box.top,box.right,box.bottom);
  if (!(element instanceof HTMLImageElement) || !element.naturalWidth || !element.naturalHeight) return outer;
  const css = element.ownerDocument.defaultView?.getComputedStyle(element);
  const fit = css?.objectFit ?? "fill";
  if (fit !== "contain" && fit !== "scale-down" && fit !== "none") return outer;
  const unscaledW = Math.max(1,element.clientWidth), unscaledH = Math.max(1,element.clientHeight);
  const factor = fit === "none" ? 1 : Math.min(
    unscaledW / element.naturalWidth,unscaledH / element.naturalHeight,
    fit === "scale-down" ? 1 : Infinity,
  );
  const sx = outer.width / Math.max(1,element.offsetWidth);
  const sy = outer.height / Math.max(1,element.offsetHeight);
  const paintW = Math.min(outer.width,element.naturalWidth * factor * sx);
  const paintH = Math.min(outer.height,element.naturalHeight * factor * sy);
  const position = (css?.objectPosition || "50% 50%").split(/\s+/);
  let x = position[0], y = position[1];
  if (position.length === 1) {
    if (x === "top" || x === "bottom") { y = x; x = "center"; }
    else y = "center";
  }
  const left = outer.left+(outer.width-paintW)*objectPositionRatio(x,"x");
  const top = outer.top+(outer.height-paintH)*objectPositionRatio(y,"y");
  return rectOf(left,top,left+paintW,top+paintH);
}

export function imageBounds(element: HTMLElement, style: VisualStyle) {
  const r = element.getBoundingClientRect();
  const outer = rectOf(r.left,r.top,r.right,r.bottom);
  const painted = paintedImageRect(element);
  const clipping = rectOf(
    outer.left + outer.width * percentage(style.cropLeft) / 100,
    outer.top + outer.height * percentage(style.cropTop) / 100,
    outer.right - outer.width * percentage(style.cropRight) / 100,
    outer.bottom - outer.height * percentage(style.cropBottom) / 100,
  );
  return { outer, painted, visible: intersectRect(painted,clipping) };
}

export function resizedBox(
  handle: ResizeHandle, width: number, height: number,
  x: number, y: number, dx: number, dy: number,
): { x:number; y:number; width:number; height:number } {
  const w = Math.max(1,width), h = Math.max(1,height);
  const fromLeft = handle.includes("w");
  const fromTop = handle.includes("n");
  const fromRight = handle.includes("e");
  const fromBottom = handle.includes("s");
  let nextW = w, nextH = h;
  if ((fromLeft || fromRight) && (fromTop || fromBottom)) {
    // Os quatro cantos preservam a proporção, ancorando o canto oposto.
    const fx = (fromLeft ? -dx : dx) / w;
    const fy = (fromTop ? -dy : dy) / h;
    const factor = Math.max(0.035,1 + (Math.abs(fx) >= Math.abs(fy) ? fx : fy));
    nextW = Math.max(10,Math.round(w*factor));
    nextH = Math.max(10,Math.round(h*factor));
  } else if (fromLeft || fromRight) nextW = Math.max(10,Math.round(w+(fromLeft?-dx:dx)));
  else nextH = Math.max(10,Math.round(h+(fromTop?-dy:dy)));
  return {
    x: Math.round(x + (fromLeft ? w-nextW : 0)),
    y: Math.round(y + (fromTop ? h-nextH : 0)),
    width: nextW, height: nextH,
  };
}

export function croppedSide(
  side: CropSide, start: VisualStyle, outer: CanvasRect,
  painted: CanvasRect, visible: CanvasRect, dx: number, dy: number,
): Partial<VisualStyle> {
  const minSize = 18;
  const clamp = (n:number,min:number,max:number) => Math.max(min,Math.min(max,n));
  const toPct = (n:number,den:number) => clamp(Math.round(n/Math.max(1,den)*10000)/100,0,95);
  if (side === "left") return {cropLeft:toPct(clamp(visible.left+dx,painted.left,visible.right-minSize)-outer.left,outer.width)};
  if (side === "right") return {cropRight:toPct(outer.right-clamp(visible.right+dx,visible.left+minSize,painted.right),outer.width)};
  if (side === "top") return {cropTop:toPct(clamp(visible.top+dy,painted.top,visible.bottom-minSize)-outer.top,outer.height)};
  return {cropBottom:toPct(outer.bottom-clamp(visible.bottom+dy,visible.top+minSize,painted.bottom),outer.height)};
}
