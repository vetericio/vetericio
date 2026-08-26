import { useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { lerReceitaComIA } from "@/lib/medicacoes.functions";
import type { Medicacao } from "@/lib/ficha";

type Props = {
  lista: Medicacao[];
  onChange: (medicacoes: Medicacao[]) => void;
};

const UNIDADES = ["mL", "cápsula/comprimido"] as const;
type Unidade = (typeof UNIDADES)[number];

const DURACOES_PADRAO = ["8h", "12h", "24h", "48h", "7 dias", "outros"] as const;

function lerComoDataUrl(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error("Falha ao ler arquivo"));
    leitor.readAsDataURL(arquivo);
  });
}

/** Tenta separar uma dose "0,5 mL" ou "1 cp" em quantidade + unidade. */
function parseDose(dose: string): { quantidade: string; unidade: Unidade } {
  const limpa = dose.trim();
  const lower = limpa.toLowerCase();
  if (lower.includes("cp") || lower.includes("cápsula") || lower.includes("capsula") || lower.includes("comprimido") || lower.includes("comp")) {
    const match = limpa.match(/^([\d,.]+)\s*/);
    return { quantidade: match?.[1] ?? limpa, unidade: "cápsula/comprimido" };
  }
  if (lower.includes("ml")) {
    const match = limpa.match(/^([\d,.]+)\s*/);
    return { quantidade: match?.[1] ?? limpa, unidade: "mL" };
  }
  return { quantidade: limpa, unidade: "mL" };
}

/** Converte a duração salva em opção padrão + texto customizado. */
function parseDuracao(duracao: string): { padrao: string; outros: string } {
  const valor = duracao.trim();
  if (!valor) return { padrao: "", outros: "" };
  if ((DURACOES_PADRAO as readonly string[]).includes(valor)) return { padrao: valor, outros: "" };
  return { padrao: "outros", outros: valor };
}

function montarDose(quantidade: string, unidade: Unidade): string {
  const q = quantidade.trim();
  if (!q) return "";
  return `${q} ${unidade}`;
}

function montarDuracao(padrao: string, outros: string): string {
  if (padrao === "outros") return outros.trim();
  return padrao;
}

export function Medicacoes({ lista, onChange }: Props) {
  const [aberto, setAberto] = useState(true);
  const [lendo, setLendo] = useState(false);
  const [textoBruto, setTextoBruto] = useState("");
  const [editando, setEditando] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [unidade, setUnidade] = useState<Unidade>("mL");
  const [duracaoPadrao, setDuracaoPadrao] = useState("");
  const [duracaoOutros, setDuracaoOutros] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const lerIA = useServerFn(lerReceitaComIA);

  const resetForm = () => {
    setNome("");
    setQuantidade("");
    setUnidade("mL");
    setDuracaoPadrao("");
    setDuracaoOutros("");
    setEditando(null);
  };

  const enviar = () => {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      toast.error("Escreva o nome da medicação.");
      return;
    }
    const dose = montarDose(quantidade, unidade);
    const duracao = montarDuracao(duracaoPadrao, duracaoOutros);
    const item: Medicacao = { nome: nomeLimpo, dose, duracao };

    if (editando === null) {
      onChange([...lista, item]);
      toast.success("Medicação adicionada.");
    } else {
      onChange(lista.map((m, i) => (i === editando ? item : m)));
      toast.success("Medicação atualizada.");
    }
    resetForm();
    setAberto(true);
  };

  const editar = (indice: number) => {
    const item = lista[indice];
    if (!item) return;
    const { quantidade: q, unidade: u } = parseDose(item.dose);
    const { padrao, outros } = parseDuracao(item.duracao);
    setNome(item.nome);
    setQuantidade(q);
    setUnidade(u);
    setDuracaoPadrao(padrao);
    setDuracaoOutros(outros);
    setEditando(indice);
    setAberto(true);
  };

  const cancelarEdicao = () => resetForm();

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
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap sm:justify-between">
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          className="truncate text-left text-xs font-semibold text-foreground underline-offset-2 hover:underline"
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
                  <span className="min-w-0 text-sm text-foreground">
                    <span className="block truncate">{[m.nome, m.dose, m.duracao].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="flex shrink-0 gap-1.5">
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
            <div className="grid gap-1.5 sm:grid-cols-3">
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Medicação"
                className={campo}
              />
              <div className="flex min-w-0 gap-1.5">
                <input
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="Quantidade"
                  className={`${campo} min-w-0 flex-1`}
                />
                <select
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value as Unidade)}
                  className={`${campo} shrink-0`}
                  style={{ width: "auto", minWidth: "5.5rem" }}
                >
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex min-w-0 gap-1.5">
                <select
                  value={duracaoPadrao}
                  onChange={(e) => setDuracaoPadrao(e.target.value)}
                  className={`${campo} min-w-0 flex-1`}
                >
                  <option value="">Duração</option>
                  {DURACOES_PADRAO.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                {duracaoPadrao === "outros" && (
                  <input
                    value={duracaoOutros}
                    onChange={(e) => setDuracaoOutros(e.target.value)}
                    placeholder="Outra duração"
                    className={`${campo} min-w-0 flex-1`}
                  />
                )}
              </div>
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
