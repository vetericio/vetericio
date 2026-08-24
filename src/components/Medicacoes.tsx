import { useRef, useState } from "react";
import { toast } from "sonner";
import type { Medicacao } from "@/lib/ficha";

type Props = {
  lista: Medicacao[];
  onChange: (medicacoes: Medicacao[]) => void;
};

const VAZIA: Medicacao = { nome: "", dose: "", duracao: "" };

export function Medicacoes({ lista, onChange }: Props) {
  const [aberto, setAberto] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [textoBruto, setTextoBruto] = useState("");
  const arquivoRef = useRef<HTMLInputElement>(null);


  const alterar = (indice: number, campo: keyof Medicacao, valor: string) => {
    const nova = lista.map((m, i) => (i === indice ? { ...m, [campo]: valor } : m));
    onChange(nova);
  };

  const adicionar = () => {
    onChange([...lista, { ...VAZIA }]);
    setAberto(true);
  };

  const remover = (indice: number) => {
    onChange(lista.filter((_, i) => i !== indice));
  };

  const lerFoto = async (arquivo: File) => {
    setLendo(true);
    setTextoBruto("");
    try {
      const { lerTextoDaImagem, analisarMedicacoes } = await import("@/lib/ocr");
      const texto = await lerTextoDaImagem(arquivo);
      const encontradas = analisarMedicacoes(texto);
      if (encontradas.length === 0) {
        setTextoBruto(texto);
        toast.info("Não reconheci medicações. Confira o texto lido e preencha à mão.");
      } else {
        onChange([...lista, ...encontradas]);
        setTextoBruto(texto);
        toast.success(
          encontradas.length === 1
            ? "1 medicação sugerida. Revise antes de usar."
            : `${encontradas.length} medicações sugeridas. Revise antes de usar.`,
        );
      }
      setAberto(true);
    } catch {
      toast.error("Não foi possível ler a imagem neste aparelho.");
    } finally {
      setLendo(false);
      if (arquivoRef.current) arquivoRef.current.value = "";
    }
  };

  return (
    <section className="mt-3 rounded-xl border border-border bg-background/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          className="text-xs font-semibold text-foreground underline-offset-2 hover:underline"
        >
          Medicações ({lista.length}) {aberto ? "▲" : "▼"}
        </button>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={adicionar}
            className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
          >
            + Manual
          </button>
          <button
            type="button"
            disabled={lendo}
            onClick={() => arquivoRef.current?.click()}
            className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {lendo ? "Lendo foto…" : "📷 Tirar foto"}
          </button>
        </div>
        <input
          ref={arquivoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void lerFoto(arquivo);
          }}
        />
      </div>

      {aberto && (
        <div className="mt-3 space-y-2">
          {lista.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhuma medicação. Adicione à mão ou tire uma foto da receita.
            </p>
          )}
          {lista.map((m, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2">
              <div className="grid gap-1 sm:grid-cols-3">
                <input
                  value={m.nome}
                  onChange={(e) => alterar(i, "nome", e.target.value)}
                  placeholder="Medicação"
                  className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                />
                <input
                  value={m.dose}
                  onChange={(e) => alterar(i, "dose", e.target.value)}
                  placeholder="Dose"
                  className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                />
                <input
                  value={m.duracao}
                  onChange={(e) => alterar(i, "duracao", e.target.value)}
                  placeholder="Duração"
                  className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                />
              </div>
              <button
                type="button"
                onClick={() => remover(i)}
                className="self-start rounded-lg bg-destructive/10 px-2 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20"
              >
                ✕
              </button>
            </div>
          ))}

          {textoBruto && (
            <details className="rounded-lg bg-secondary p-2">
              <summary className="cursor-pointer text-xs font-semibold text-secondary-foreground">
                Texto lido da foto
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-sans text-xs text-muted-foreground">
                {textoBruto}
              </pre>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
