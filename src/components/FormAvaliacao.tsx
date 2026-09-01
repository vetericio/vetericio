import { Fragment, useRef, useState } from "react";
import {
  ESPECIES,
  OPCOES,
  avaliarValor,
  comLinha,
  comVirgula,
  frasePorTermo,
  fraseAtualizacao,
  removerFraseDoParametro,
  resumoFaixas,
  ROTULOS_NUMERICOS,
  type ChaveNumerica,
  type Especie,
  type Registro,
} from "@/lib/ficha";
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
import { Medicacoes } from "@/components/Medicacoes";

type Props = {
  valores: Omit<Registro, "id">;
  onChange: (valores: Omit<Registro, "id">) => void;
  onEnviar: () => void;
  editando: boolean;
  onCancelar: () => void;
  /** Avaliação anterior mostrada apenas para leitura (modo "atualizar informações"). */
  anterior?: Registro | null;
  /** "Fazer curva?" ao lado da glicemia. */
  fazerCurva?: boolean;
  onFazerCurva?: (valor: boolean) => void;
};

const NUMERICOS: { chave: ChaveNumerica; rotulo: string; unidade: string }[] = [
  { chave: "temperatura", rotulo: "Temperatura", unidade: "°C" },
  { chave: "fc", rotulo: "FC", unidade: "bpm" },
  { chave: "fr", rotulo: "FR", unidade: "mpm" },
  { chave: "pas", rotulo: "PAS", unidade: "mmHg" },
  { chave: "glicemia", rotulo: "Glicemia", unidade: "mg/dL" },
];

const GRUPOS: { chave: keyof typeof OPCOES; rotulo: string }[] = [
  { chave: "alimentacao", rotulo: "Alimentação" },
  { chave: "comportamento", rotulo: "Comportamento" },
  { chave: "fezes", rotulo: "Fezes" },
  { chave: "mucosas", rotulo: "Mucosas" },
  { chave: "urina", rotulo: "Urina" },
  { chave: "vomito", rotulo: "Vômito" },
];

/** Acrescenta a frase automática nas observações, sem repetir e sem apagar nada. */
function comFraseAutomatica(observacoes: string, termo: string): string {
  if (!termo) return observacoes;
  const frase = frasePorTermo(termo);
  const jaRegistrado = observacoes
    .split("\n")
    .some((l) => l.trim().startsWith("Animal com ") && l.includes(` ${termo} em `));
  if (jaRegistrado) return observacoes;
  return observacoes.trim() ? `${observacoes.replace(/\s+$/, "")}\n${frase}` : frase;
}

export function FormAvaliacao({
  valores,
  onChange,
  onEnviar,
  editando,
  onCancelar,
  anterior,
  fazerCurva = false,
  onFazerCurva,
}: Props) {
  const iniciais = useRef(valores);
  const [perguntados, setPerguntados] = useState<ChaveNumerica[]>([]);
  const [pendente, setPendente] = useState<ChaveNumerica | null>(null);
  const [outroAberto, setOutroAberto] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);
  const { anamneses } = useAnamneses();
  const sugestoes =
    sugerindo && !anterior && !editando ? sugerirAnamneses(anamneses, valores.animal) : [];


  const set = (chave: keyof Omit<Registro, "id">, valor: string) =>
    onChange({ ...valores, [chave]: valor });

  const setNumero = (chave: ChaveNumerica, valor: string) => {
    // Em modo edição, as observações só mudam depois da pergunta (substituir/acrescentar).
    if (editando) {
      onChange({ ...valores, [chave]: valor });
      return;
    }
    const { fora, termo } = avaliarValor(chave, valor, valores.especie);
    const limpas = removerFraseDoParametro(valores.observacoes, chave);
    onChange({
      ...valores,
      [chave]: valor,
      observacoes: fora ? comFraseAutomatica(limpas, termo) : limpas,
    });
  };

  const aoSairDoCampo = (chave: ChaveNumerica) => {
    if (!editando) return;
    if (perguntados.includes(chave)) return;
    const antes = (iniciais.current[chave] ?? "").trim();
    const agora = (valores[chave] ?? "").trim();
    if (!agora || antes === agora) return;
    setPendente(chave);
  };

  const responder = (substituir: boolean) => {
    const chave = pendente;
    if (!chave) return;
    const valor = valores[chave];
    if (substituir) {
      const { fora, termo } = avaliarValor(chave, valor, valores.especie);
      const limpas = removerFraseDoParametro(valores.observacoes, chave);
      onChange({
        ...valores,
        observacoes: fora ? comFraseAutomatica(limpas, termo) : limpas,
      });
    } else {
      onChange({
        ...valores,
        observacoes: comLinha(valores.observacoes, fraseAtualizacao(chave, valor)),
      });
    }
    setPerguntados((p) => [...p, chave]);
    setPendente(null);
  };

  const faixas = resumoFaixas(valores.especie);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      {anterior && (
        <div className="mb-4 rounded-xl border border-border bg-secondary/50 p-3">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Informação anterior (somente leitura)
          </p>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-foreground sm:grid-cols-3">
            {NUMERICOS.filter(({ chave }) => (anterior[chave] ?? "").trim()).map(({ chave }) => (
              <p key={chave}>
                <span className="text-muted-foreground">{ROTULOS_NUMERICOS[chave].rotulo}: </span>
                <span className="font-semibold tabular-nums">{comVirgula(anterior[chave])}</span>
              </p>
            ))}
            {GRUPOS.filter(({ chave }) => (anterior[chave] ?? "").trim()).map(
              ({ chave, rotulo }) => (
                <p key={chave}>
                  <span className="text-muted-foreground">{rotulo}: </span>
                  <span className="font-semibold">{anterior[chave]}</span>
                </p>
              ),
            )}
          </div>
          {anterior.observacoes.trim() && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {anterior.observacoes.trim()}
            </p>
          )}
        </div>
      )}

      <div className="block">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Animal
        </span>
        <input
          value={valores.animal}
          onChange={(e) => {
            set("animal", e.target.value);
            setSugerindo(true);
          }}
          onFocus={() => setSugerindo(true)}
          placeholder="Nome do animal"
          readOnly={Boolean(anterior)}
          autoComplete="off"
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-lg font-semibold text-foreground outline-none focus:border-ring"
        />
        {sugestoes.length > 0 && (
          <ul className="mt-1.5 overflow-hidden rounded-lg border border-border bg-card">
            {sugestoes.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({
                      ...valores,
                      animal: a.animal.trim(),
                      especie: a.especie || valores.especie,
                    });
                    setSugerindo(false);
                  }}
                  className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-secondary/60"
                >
                  <span className="font-semibold text-foreground">
                    {emojiEspecie(a.especie)} {a.animal.trim()}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {a.queixa.trim() || "anamnese"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>


      <div className="mt-3">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Espécie
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ESPECIES.map((esp) => {
            const ativo = valores.especie === esp;
            return (
              <button
                key={esp}
                type="button"
                onClick={() => onChange({ ...valores, especie: (ativo ? "" : esp) as Especie })}
                className={[
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  ativo
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/70",
                ].join(" ")}
              >
                {esp}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {GRUPOS.map(({ chave, rotulo }) => {
          const opcoesFixas = OPCOES[chave] as readonly string[];
          const valorAtual = valores[chave].trim();
          const ehAlimentacao = chave === "alimentacao";
          const outroAtivo =
            ehAlimentacao && (outroAberto || (valorAtual !== "" && !opcoesFixas.includes(valorAtual)));
          return (
            <div key={chave}>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {rotulo}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {opcoesFixas.map((opcao) => {
                  const ativo = valores[chave] === opcao;
                  return (
                    <button
                      key={opcao}
                      type="button"
                      onClick={() => {
                        if (ehAlimentacao) setOutroAberto(false);
                        set(chave, ativo ? "" : opcao);
                      }}
                      className={[
                        "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                        ativo
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/70",
                      ].join(" ")}
                    >
                      {opcao}
                    </button>
                  );
                })}
                {ehAlimentacao && (
                  <button
                    type="button"
                    onClick={() => {
                      if (outroAtivo) {
                        setOutroAberto(false);
                        set("alimentacao", "");
                      } else {
                        setOutroAberto(true);
                        set("alimentacao", "");
                      }
                    }}
                    className={[
                      "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                      outroAtivo
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/70",
                    ].join(" ")}
                  >
                    Outro
                  </button>
                )}
              </div>
              {ehAlimentacao && outroAtivo && (
                <input
                  type="text"
                  autoFocus
                  value={opcoesFixas.includes(valorAtual) ? "" : valores.alimentacao}
                  onChange={(e) => set("alimentacao", e.target.value)}
                  placeholder="Escreva o alimento"
                  className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {NUMERICOS.map(({ chave, rotulo, unidade }) => {
          const { fora } = avaliarValor(chave, valores[chave], valores.especie);
          return (
            <Fragment key={chave}>
            <label className="block">
              <span
                className={[
                  "text-[0.7rem] font-semibold uppercase tracking-[0.14em]",
                  fora ? "text-destructive" : "text-muted-foreground",
                ].join(" ")}
              >
                {rotulo} <span className="normal-case tracking-normal">({unidade})</span>
              </span>
              <input
                value={valores[chave]}
                onChange={(e) => setNumero(chave, e.target.value)}
                onBlur={() => aoSairDoCampo(chave)}
                inputMode="decimal"
                aria-invalid={fora}
                className={[
                  "mt-1 w-full rounded-lg border bg-background px-2.5 py-2 text-base font-semibold tabular-nums outline-none",
                  fora
                    ? "border-destructive text-destructive focus:border-destructive"
                    : "border-input text-foreground focus:border-ring",
                ].join(" ")}
              />
            </label>
            {chave === "glicemia" && onFazerCurva && (
              <div className="block">
                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Fazer curva?
                </span>
                <div className="mt-1 flex gap-2">
                  {[true, false].map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => onFazerCurva(v)}
                      className={[
                        "flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition-colors",
                        fazerCurva === v
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/70",
                      ].join(" ")}
                    >
                      {v ? "Sim" : "Não"}
                    </button>
                  ))}
                </div>
              </div>
            )}
            </Fragment>
          );
        })}
      </div>

      {faixas && (
        <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">
          Faixas ({valores.especie}): {faixas}
        </p>
      )}

      <label className="mt-4 block">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Observações
        </span>
        <textarea
          value={valores.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
          rows={3}
          className="mt-1 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
        />
      </label>

      <div className="mt-4">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Medicações
        </span>
        <Medicacoes
          lista={valores.medicacoes ?? []}
          onChange={(medicacoes) => onChange({ ...valores, medicacoes })}
        />
      </div>

      <div className="mt-6 flex gap-2 border-t border-border pt-5">
        <button
          type="button"
          onClick={onEnviar}
          className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold uppercase tracking-wide text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {anterior ? "Acrescentar informação" : editando ? "Salvar alterações" : "Enviar ficha"}
        </button>
        {(editando || anterior) && (
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/70"
          >
            Cancelar
          </button>
        )}
      </div>


      <AlertDialog open={Boolean(pendente)} onOpenChange={(o) => !o && setPendente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendente ? ROTULOS_NUMERICOS[pendente].rotulo : ""} alterada
            </AlertDialogTitle>
            <AlertDialogDescription>
              A nova informação deve substituir a anterior nas observações ou ser acrescentada
              como atualização?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => responder(false)}>Acrescentar</AlertDialogCancel>
            <AlertDialogAction onClick={() => responder(true)}>Substituir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
