import { useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { lerReceitaComIA } from "@/lib/medicacoes.functions";
import type { Medicacao } from "@/lib/ficha";

type Props = {
  lista: Medicacao[];
  onChange: (medicacoes: Medicacao[]) => void;
};

const VAZIA: Medicacao = { nome: "", dose: "", duracao: "" };

function lerComoDataUrl(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error("Falha ao ler arquivo"));
    leitor.readAsDataURL(arquivo);
  });
}

export function Medicacoes({ lista, onChange }: Props) {
  const [aberto, setAberto] = useState(true);
  const [lendo, setLendo] = useState(false);
  const [textoBruto, setTextoBruto] = useState("");
  const [rascunho, setRascunho] = useState<Medicacao>({ ...VAZIA });
  const [editando, setEditando] = useState<number | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const lerIA = useServerFn(lerReceitaComIA);

  const alterarRascunho = (campo: keyof Medicacao, valor: string) =>
    setRascunho((r) => ({ ...r, [campo]: valor }));

  const enviar = () => {
    const nome = rascunho.nome.trim();
    const dose = rascunho.dose.trim();
    const duracao = rascunho.duracao.trim();
    if (!nome) {
      toast.error("Escreva o nome da medicação.");
      return;
    }
    const item: Medicacao = { nome, dose, duracao };
    if (editando === null) {
      onChange([...lista, item]);
      toast.success("Medicação adicionada.");
    } else {
      onChange(lista.map((m, i) => (i === editando ? item : m)));
      toast.success("Medicação atualizada.");
      setEditando(null);
    }
    setRascunho({ ...VAZIA });
    setAberto(true);
  };

  const editar = (indice: number) => {
    const item = lista[indice];
    if (!item) return;
    setRascunho({ ...item });
    setEditando(indice);
    setAberto(true);
  };

  const cancelarEdicao = () => {
    setEditando(null);
    setRascunho({ ...VAZIA });
  };

  const remover = (indice: number) => {
    onChange(lista.filter((_, i) => i !== indice));
    if (editando === indice) cancelarEdicao();
  };

  const lerOffline = async (arquivo: File) => {
    const { lerTextoDaImagem, analisarMedicacoes } = await import("@/lib/ocr");
    const texto = await lerTextoDaImagem(arquivo);
    return { encontradas: analisarMedicacoes(texto), texto };
  };

  const lerFoto = async (arquivo: File) => {
    setLendo(true);
    setTextoBruto("");
    let encontradas: Medicacao[] = [];
    let texto = "";
    let usouIA = false;

    try {
      if (navigator.onLine) {
        try {
          const imagem = await lerComoDataUrl(arquivo);
          const resultado = await lerIA({ data: { imagem } });
          encontradas = resultado.medicacoes;
          usouIA = true;
        } catch {
          usouIA = false;
        }
      }

      if (!usouIA || encontradas.length === 0) {
        try {
          const offline = await lerOffline(arquivo);
          if (encontradas.length === 0) encontradas = offline.encontradas;
          texto = offline.texto;
          if (!usouIA) toast.info("Sem internet: leitura offline, precisão menor.");
        } catch {
          if (!usouIA) throw new Error("sem leitura");
        }
      }

      setTextoBruto(texto);
      if (encontradas.length === 0) {
        toast.info("Não reconheci medicações. Confira o texto lido e preencha à mão.");
      } else {
        onChange([...lista, ...encontradas]);
        toast.success(
          encontradas.length === 1
            ? "1 medicação sugerida. Revise antes de usar."
            : `${encontradas.length} medicações sugeridas. Revise antes de usar.`,
        );
      }
      setAberto(true);
    } catch {
      toast.error("Não foi possível ler a imagem.");
    } finally {
      setLendo(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galeriaRef.current) galeriaRef.current.value = "";
    }
  };

  const campo =
    "rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-ring";

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
            disabled={lendo}
            onClick={() => cameraRef.current?.click()}
            className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {lendo ? "Lendo foto…" : "📷 Tirar foto"}
          </button>
          <button
            type="button"
            disabled={lendo}
            onClick={() => galeriaRef.current?.click()}
            className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70 disabled:opacity-60"
          >
            {lendo ? "Lendo foto…" : "🖼️ Enviar foto"}
          </button>
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void lerFoto(arquivo);
          }}
        />
        <input
          ref={galeriaRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void lerFoto(arquivo);
          }}
        />
      </div>

      {aberto && (
        <div className="mt-3 space-y-3">
          {lista.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma medicação. Preencha abaixo e toque em Enviar, ou tire uma foto da receita.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {lista.map((m, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/60 px-2.5 py-1.5"
                >
                  <span className="text-sm text-foreground">
                    {[m.nome, m.dose, m.duracao].filter(Boolean).join(" · ")}
                  </span>
                  <span className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => editar(i)}
                      className="rounded-lg bg-background px-2 py-1 text-xs font-semibold text-foreground hover:bg-background/70"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => remover(i)}
                      className="rounded-lg bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20"
                    >
                      Excluir
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2 rounded-lg border border-dashed border-border p-2">
            <div className="grid gap-1 sm:grid-cols-3">
              <input
                value={rascunho.nome}
                onChange={(e) => alterarRascunho("nome", e.target.value)}
                placeholder="Medicação"
                className={campo}
              />
              <input
                value={rascunho.dose}
                onChange={(e) => alterarRascunho("dose", e.target.value)}
                placeholder="Dose"
                className={campo}
              />
              <input
                value={rascunho.duracao}
                onChange={(e) => alterarRascunho("duracao", e.target.value)}
                placeholder="Duração"
                className={campo}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={enviar}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {editando === null ? "Enviar" : "Salvar alteração"}
              </button>
              {editando !== null && (
                <button
                  type="button"
                  onClick={cancelarEdicao}
                  className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>

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
