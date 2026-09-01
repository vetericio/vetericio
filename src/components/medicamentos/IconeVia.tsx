import { Droplet, Pill, SprayCan, Syringe } from "lucide-react";

/** Ícone pequeno (linha) da via de administração. */
export function IconeVia({ via, className = "h-3.5 w-3.5" }: { via: string; className?: string }) {
  const v = via.toUpperCase();
  if (v === "VO") return <Pill className={className} aria-hidden />;
  if (v === "OT") return <SprayCan className={className} aria-hidden />;
  if (v === "OF") return <Droplet className={className} aria-hidden />;
  return <Syringe className={className} aria-hidden />;
}

/** Lista de vias com ícone, ex.: 💉 IV / IM */
export function Vias({ vias }: { vias: string[] }) {
  if (vias.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
      <IconeVia via={vias[0] ?? ""} />
      {vias.join(" / ")}
    </span>
  );
}
