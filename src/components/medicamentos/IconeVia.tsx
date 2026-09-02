import {
  Bandage,
  Bone,
  CircleDot,
  CircleEllipsis,
  Droplet,
  Droplets,
  Ear,
  Heart,
  MessageCircle,
  Pill,
  Pipette,
  Smile,
  SprayCan,
  Stethoscope,
  Syringe,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { NOME_VIA, ROTULO_VIA, VIAS_SERINGA, type Via } from "@/lib/medicamentos";

/** Um ícone coerente para cada via: quando a forma muda, o ícone muda. */
const ICONES: Record<Via, LucideIcon> = {
  IV: Syringe,
  IM: Syringe,
  SC: Syringe,
  VO: Pill,
  SL: Smile,
  ID: Pipette,
  IO: Bone,
  IP: CircleDot,
  IC: Heart,
  IT: Stethoscope,
  IN: Wind,
  OF: Droplet,
  OT: Ear,
  TOP: SprayCan,
  TD: Bandage,
  BUC: MessageCircle,
  RET: CircleEllipsis,
  VAG: Droplets,
};

function iconeDe(via: string): LucideIcon {
  const chave = via.trim().toUpperCase() as Via;
  return ICONES[chave] ?? Syringe;
}

/** Ícone pequeno (linha) da via de administração. */
export function IconeVia({ via, className = "h-3.5 w-3.5" }: { via: string; className?: string }) {
  const Icone = iconeDe(via);
  return <Icone className={className} aria-hidden />;
}

/**
 * Lista de vias com ícone.
 * IV / IM / SC compartilham uma única seringa; as demais mostram o próprio ícone.
 */
export function Vias({ vias }: { vias: string[] }) {
  const lista = vias.map((v) => v.trim().toUpperCase() as Via).filter(Boolean);
  if (lista.length === 0) return null;

  const seringa = lista.filter((v) => VIAS_SERINGA.includes(v));
  const outras = lista.filter((v) => !VIAS_SERINGA.includes(v));

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-muted-foreground">
      {seringa.length > 0 && (
        <span className="inline-flex items-center gap-1" title={seringa.map((v) => NOME_VIA[v]).join(" / ")}>
          <Syringe className="h-3.5 w-3.5" aria-hidden />
          {seringa.map((v) => ROTULO_VIA[v]).join(" / ")}
        </span>
      )}
      {outras.map((v) => (
        <span key={v} className="inline-flex items-center gap-1" title={NOME_VIA[v]}>
          <IconeVia via={v} />
          {ROTULO_VIA[v]}
        </span>
      ))}
    </span>
  );
}
