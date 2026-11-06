import { Badge } from "@/components/ui/badge";
import type { Recomendacao } from "@/lib/analysis";

const TONE: Record<string, string> = {
  alta: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  média: "border-amber-500/40 text-amber-700 dark:text-amber-400",
  baixa: "border-muted-foreground/40 text-muted-foreground",
};

export function Recommendations({ items, avisos }: { items: Recomendacao[]; avisos: string[] }) {
  return (
    <div className="space-y-3">
      {avisos.map((a) => (
        <p key={a} className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          {a}
        </p>
      ))}
      {items.map((r, i) => (
        <div key={r.id} className="rounded-md border p-4 text-sm">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">#{i + 1}</span>
            <span className="font-medium">{r.titulo}</span>
            <Badge variant="outline" className={TONE[r.confianca]}>
              confiança {r.confianca}
            </Badge>
          </div>
          <dl className="grid gap-1 sm:grid-cols-[140px_1fr]">
            <dt className="text-muted-foreground">Observado</dt>
            <dd>{r.observado}</dd>
            <dt className="text-muted-foreground">Dados</dt>
            <dd>{r.dados}</dd>
            <dt className="text-muted-foreground">Hipótese</dt>
            <dd>{r.hipotese}</dd>
            <dt className="text-muted-foreground">Ação recomendada</dt>
            <dd className="font-medium">{r.acao}</dd>
            <dt className="text-muted-foreground">Como avaliar</dt>
            <dd>{r.indicador}</dd>
            <dt className="text-muted-foreground">Prioridade</dt>
            <dd>
              impacto {r.impacto}/3 · esforço {r.esforco}/3 · urgência {r.urgencia}/3
            </dd>
          </dl>
        </div>
      ))}
      {!items.length && !avisos.length ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma recomendação no momento: os dados não mostram desvios relevantes.
        </p>
      ) : null}
    </div>
  );
}
