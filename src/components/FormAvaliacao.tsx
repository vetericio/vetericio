import { OPCOES, REGISTRO_VAZIO, type Registro } from "@/lib/ficha";

type Props = {
  valores: Omit<Registro, "id">;
  onChange: (valores: Omit<Registro, "id">) => void;
  onEnviar: () => void;
  editando: boolean;
  onCancelar: () => void;
};

const NUMERICOS: { chave: keyof typeof REGISTRO_VAZIO; rotulo: string; unidade: string }[] = [
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

export function FormAvaliacao({ valores, onChange, onEnviar, editando, onCancelar }: Props) {
  const set = (chave: keyof Omit<Registro, "id">, valor: string) =>
    onChange({ ...valores, [chave]: valor });

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <label className="block">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Animal
        </span>
        <input
          value={valores.animal}
          onChange={(e) => set("animal", e.target.value)}
          placeholder="Nome do animal"
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-lg font-semibold text-foreground outline-none focus:border-ring"
        />
      </label>

      <div className="mt-5 space-y-4">
        {GRUPOS.map(({ chave, rotulo }) => (
          <div key={chave}>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {rotulo}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {OPCOES[chave].map((opcao) => {
                const ativo = valores[chave] === opcao;
                return (
                  <button
                    key={opcao}
                    type="button"
                    onClick={() => set(chave, ativo ? "" : opcao)}
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
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {NUMERICOS.map(({ chave, rotulo, unidade }) => (
          <label key={chave} className="block">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {rotulo} <span className="normal-case tracking-normal">({unidade})</span>
            </span>
            <input
              value={valores[chave]}
              onChange={(e) => set(chave, e.target.value)}
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-input bg-background px-2.5 py-2 text-base font-semibold tabular-nums text-foreground outline-none focus:border-ring"
            />
          </label>
        ))}
      </div>

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

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onEnviar}
          className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold uppercase tracking-wide text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {editando ? "Salvar alterações" : "Enviar"}
        </button>
        {editando && (
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/70"
          >
            Cancelar
          </button>
        )}
      </div>
    </section>
  );
}
