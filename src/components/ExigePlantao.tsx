import { useState, type ReactNode } from "react";
import { usePlantaoAtual } from "@/hooks/usePlantaoAtual";
import { DialogoTurno } from "@/components/DialogoTurno";

/**
 * Libera o conteúdo somente com plantão ativo.
 * Fonte única da verdade: usePlantaoAtual.
 */
export function ExigePlantao({ children, funcao }: { children?: ReactNode; funcao: string }) {
  const { plantao, carregado } = usePlantaoAtual();
  const [aberto, setAberto] = useState(false);

  if (!carregado) return null;
  if (plantao) return <>{children}</>;

  return (
    <div className="rounded-2xl border border-border bg-secondary/40 px-4 py-6 text-center">
      <p className="text-sm font-semibold text-foreground">Inicie o plantão para usar esta função</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {funcao} fica disponível enquanto houver um plantão ativo.
      </p>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-3 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Iniciar plantão
      </button>
      <DialogoTurno aberto={aberto} onFechar={() => setAberto(false)} />
    </div>
  );
}
