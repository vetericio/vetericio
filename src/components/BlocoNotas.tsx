import { useEffect, useRef, useState } from "react";
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

export const CHAVE_BLOCO_NOTAS = "veterico-bloco-notas";

/** Rascunho livre do plantão. Não entra em PDF, cópia nem exportação. */
export function BlocoNotas() {
  const [texto, setTexto] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const primeira = useRef(true);

  useEffect(() => {
    try {
      setTexto(window.localStorage.getItem(CHAVE_BLOCO_NOTAS) ?? "");
    } catch {
      /* sem acesso: começa vazio */
    }
  }, []);

  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(CHAVE_BLOCO_NOTAS, texto);
        setSalvo(true);
      } catch {
        /* espaço cheio: ignora */
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [texto]);

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Bloco de notas</h2>
        <button
          type="button"
          onClick={() => setConfirmar(true)}
          className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
        >
          Limpar
        </button>
      </div>

      <textarea
        value={texto}
        onChange={(e) => {
          setSalvo(false);
          setTexto(e.target.value);
        }}
        rows={8}
        placeholder="Anotações livres deste plantão…"
        className="mt-2 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
      />
      <p className="mt-1 text-[11px] text-muted-foreground">
        {salvo ? "salvo" : "\u00a0"} · não entra no PDF nem na exportação
      </p>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar o bloco de notas?</AlertDialogTitle>
            <AlertDialogDescription>
              O texto anotado será apagado deste aparelho.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setTexto("");
                setSalvo(false);
              }}
            >
              Limpar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
