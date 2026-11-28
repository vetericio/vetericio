import {
  descricaoOfertaPerfis,
  tituloOfertaPerfis,
  type OfertaPerfis,
} from "@/lib/promocao-perfis-ui";

export function BeneficioPromocionalPerfis({ oferta }: { oferta: OfertaPerfis }) {
  const titulo = tituloOfertaPerfis(oferta);
  const detalhes = descricaoOfertaPerfis(oferta);
  if (!titulo || !detalhes) return null;
  return (
    <div className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5 text-sm leading-5">
      <p className="font-bold text-primary">{titulo}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detalhes}</p>
    </div>
  );
}
