import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRegistros } from "@/hooks/useRegistros";
import { emojiEspecie, normalizarNome } from "@/lib/anamnese";
import type { Medicacao } from "@/lib/ficha";

export type AplicacaoPendente = {
  nome: string;
  /** Complemento opcional exibido antes do nome, ex.: "Besilato de". */
  nomeMenor?: string;
  /** ex.: "72 – 90 mg (20 – 25 mg/kg)" */
  dose: string;
  /** ex.: "0,28 – 0,56 mL" ou "½ comprimido" */
  quantidade: string;
  via: string;
  /** ex.: "12h" */
  duracao: string;
};

type Props = {
  aplicacao: AplicacaoPendente | null;
  onFechar: () => void;
};

/** "Para qual animal?" — grava a aplicação nas medicações do animal internado. */
export function DialogoAplicar({ aplicacao, onFechar }: Props) {
  const { registros, setRegistros } = useRegistros();
  const [busca, setBusca] = useState("");

  const internados = useMemo(() => {
    const termo = normalizarNome(busca);
    return registros
      .filter((r) => !r.obito)
      .filter((r) => !termo || normalizarNome(r.animal).includes(termo))
      .sort((a, b) => a.animal.localeCompare(b.animal, "pt-BR"));
  }, [registros, busca]);

  const aplicar = (id: string) => {
    if (!aplicacao) return;
    const agora = new Date();
    const hora = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const nova: Medicacao = {
      nome: aplicacao.nome,
      nomeMenor: aplicacao.nomeMenor,
      dose: aplicacao.dose,
      duracao: aplicacao.duracao,
      via: aplicacao.via,
      quantidade: aplicacao.quantidade,
      aplicadoEm: agora.toISOString(),
    };
    let nomeAnimal = "";
    setRegistros((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        nomeAnimal = r.animal;
        return { ...r, medicacoes: [...(r.medicacoes ?? []), nova] };
      }),
    );
    toast.success(`${aplicacao.nome} registrado em ${nomeAnimal || "animal"} às ${hora}`);
    setBusca("");
    onFechar();
  };

  return (
    <Dialog open={Boolean(aplicacao)} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Para qual animal?</DialogTitle>
          <DialogDescription>
            {aplicacao
              ? `${aplicacao.nome} — ${aplicacao.quantidade}${aplicacao.via ? ` • ${aplicacao.via}` : ""}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="🔎 Buscar animal internado..."
          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base outline-none focus:border-ring"
        />

        <ul className="max-h-72 space-y-1.5 overflow-y-auto">
          {internados.length === 0 && (
            <li className="rounded-xl bg-secondary/60 px-3 py-3 text-sm text-muted-foreground">
              Nenhum animal internado. Envie a ficha no Início primeiro.
            </li>
          )}
          {internados.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => aplicar(r.id)}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-card/60 px-3 py-2.5 text-left hover:bg-secondary/60"
              >
                <span className="truncate font-semibold text-foreground">
                  {emojiEspecie(r.especie ?? "")} {r.animal || "Sem nome"}
                </span>
                <span className="text-xs text-muted-foreground">registrar</span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
