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
import type { RegraAlerta } from "@/lib/pendencias";

type Props = {
  regra: RegraAlerta | null;
  onFechar: () => void;
  onConfirmar: (regra: RegraAlerta) => void;
};

/** Quadro de confirmação: nada é cobrado sem o "Sim, registrar". */
export function DialogoAlerta({ regra, onFechar, onConfirmar }: Props) {
  return (
    <AlertDialog open={Boolean(regra)} onOpenChange={(o) => !o && onFechar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Atenção</AlertDialogTitle>
          <AlertDialogDescription>{regra?.pergunta}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onFechar}>Agora não</AlertDialogCancel>
          <AlertDialogCancel onClick={onFechar}>Não</AlertDialogCancel>
          <AlertDialogAction onClick={() => regra && onConfirmar(regra)}>
            Sim, registrar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
