import { useEffect } from "react";
import { useBlocker } from "@tanstack/react-router";
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

/**
 * Pergunta "Tem certeza?" só quando existe texto/alteração não salva.
 * Vale para trocar de aba, voltar e fechar o app.
 */
export function GuardaSaida({ sujo }: { sujo: boolean }) {
  const bloqueio = useBlocker({
    shouldBlockFn: () => sujo,
    enableBeforeUnload: () => sujo,
    withResolver: true,
    disabled: !sujo,
  });

  // Fechar/recarregar o app com texto pendente.
  useEffect(() => {
    if (!sujo) return;
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sujo]);

  return (
    <AlertDialog open={bloqueio.status === "blocked"} onOpenChange={(o) => !o && bloqueio.reset?.()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
          <AlertDialogDescription>
            Existe texto que ainda não foi salvo. Se sair agora, ele será perdido.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => bloqueio.reset?.()}>Continuar editando</AlertDialogCancel>
          <AlertDialogAction onClick={() => bloqueio.proceed?.()}>Sair sem salvar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
