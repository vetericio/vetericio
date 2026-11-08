import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { updateSettings } from "@/lib/app.functions";
import { errorMessage, qk, useSettings } from "@/lib/queries";

/** Global kill switch: stops new publications and automations without deleting anything. */
export function PauseToggle({ isAdmin, compact = false }: { isAdmin: boolean; compact?: boolean }) {
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const paused = !!settings?.pausa_geral;

  const mutation = useMutation({
    mutationFn: (pausa: boolean) => updateSettings({ data: { pausa_geral: pausa } }),
    onSuccess: (_r, pausa) => {
      qc.invalidateQueries({ queryKey: qk.settings });
      qc.invalidateQueries({ queryKey: qk.audit });
      toast.success(
        pausa
          ? "Pausa geral ativada. Nenhuma publicação ou automação será executada."
          : "Pausa geral desativada.",
      );
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!settings) return null;

  return (
    <>
      <Button
        variant={paused ? "destructive" : "outline"}
        size="sm"
        disabled={!isAdmin || mutation.isPending}
        onClick={() => setOpen(true)}
        title={isAdmin ? undefined : "Somente administradores podem alterar a pausa geral"}
      >
        {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
        {compact ? null : paused ? "Pausa ativa — retomar" : "Pausa geral"}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {paused ? "Retomar as automações?" : "Ativar a pausa geral?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {paused
                ? "Publicações agendadas e automações voltarão a ser executadas normalmente."
                : "Nenhuma nova publicação, agendamento ou automação será executado até você retomar. Nenhum dado, rascunho ou histórico é apagado."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => mutation.mutate(!paused)}>
              {paused ? "Retomar" : "Ativar pausa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
