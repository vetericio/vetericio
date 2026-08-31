import type { Especie } from "@/lib/medicamentos";

type Props = {
  valor: Especie;
  onChange: (especie: Especie) => void;
  /** true = botões menores, para caber ao lado do peso */
  compacto?: boolean;
};

/** Botões grandes 🐶 / 🐱 para escolher a espécie. */
export function SeletorEspecie({ valor, onChange, compacto }: Props) {
  const opcoes: { id: Especie; rotulo: string }[] = [
    { id: "cao", rotulo: "🐶 Cão" },
    { id: "gato", rotulo: "🐱 Gato" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {opcoes.map((o) => {
        const ativo = valor === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={ativo}
            className={`rounded-xl border font-semibold transition-colors ${
              compacto ? "px-2 py-3 text-sm" : "px-3 py-3 text-base"
            } ${
              ativo
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-secondary"
            }`}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}
