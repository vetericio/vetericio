import type { ResultadoDose } from "@/lib/medicamentos";

/** Bloco grande com o volume a aplicar e a conta para conferência. */
export function ResultadoAplicar({ resultado }: { resultado: ResultadoDose }) {
  if (!resultado.ok) {
    return (
      <p className="rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground">
        {resultado.motivo}
      </p>
    );
  }
  return (
    <div className="rounded-2xl border-2 border-primary bg-primary/10 p-3 text-center">
      <p className="text-2xl font-bold leading-tight text-foreground">
        💉 APLICAR: {resultado.volumeTexto} {resultado.unidade}
      </p>
      <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
        <p>Dose total: {resultado.contaDose}</p>
        <p>Volume: {resultado.contaVolume}</p>
      </div>
    </div>
  );
}
