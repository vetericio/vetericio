import { useEffect, useState, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type PedidoConfirmacao = {
  titulo: string;
  descricao: ReactNode;
  /** Texto do botão que executa. Ex.: "Excluir Tramadol". */
  acao: string;
  /** Quando definido, o usuário precisa digitar esta palavra para liberar. */
  palavra?: string;
  destrutivo?: boolean;
  onConfirmar: () => void;
};

/**
 * Janela única de confirmação do app: mesmo formato em todas as telas,
 * com o botão nomeado pela ação (nunca "OK").
 */
export function ConfirmarAcao({
  pedido,
  onFechar,
}: {
  pedido: PedidoConfirmacao | null;
  onFechar: () => void;
}) {
  const [digitado, setDigitado] = useState("");

  useEffect(() => {
    setDigitado("");
  }, [pedido]);

  const liberado = !pedido?.palavra || digitado.trim().toUpperCase() === pedido.palavra.toUpperCase();

  return (
    <AlertDialog open={Boolean(pedido)} onOpenChange={(aberto) => !aberto && onFechar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pedido?.titulo}</AlertDialogTitle>
          <AlertDialogDescription>{pedido?.descricao}</AlertDialogDescription>
        </AlertDialogHeader>

        {pedido?.palavra && (
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">
              Passo 2 de 2: digite {pedido.palavra} para liberar
            </span>
            <input
              value={digitado}
              onChange={(e) => setDigitado(e.target.value)}
              placeholder={pedido.palavra}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:border-ring"
            />
          </label>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!liberado}
            onClick={() => {
              pedido?.onConfirmar();
              onFechar();
            }}
            className={
              pedido?.destrutivo
                ? "min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "min-h-11"
            }
          >
            {pedido?.acao}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Estado pronto para as telas: `pedir(...)` abre a janela. */
export function usarConfirmacao() {
  const [pedido, setPedido] = useState<PedidoConfirmacao | null>(null);
  return {
    pedido,
    pedir: (p: PedidoConfirmacao) => setPedido(p),
    fechar: () => setPedido(null),
  };
}
