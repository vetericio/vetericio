import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/meta-permissions";

const TONE: Record<string, string> = {
  ativa: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  token_expirado: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  permissao_insuficiente: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  revogada: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  erro: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  desconectada: "bg-muted text-muted-foreground",
  inativa: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", TONE[status] ?? "bg-muted text-muted-foreground")}
    >
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
