type Props = {
  letras: string[];
  ativa: string | null;
  onSelecionar: (letra: string) => void;
};

/** Coluna vertical discreta com as iniciais existentes (estilo Niagara). */
export function IndiceAlfabetico({ letras, ativa, onSelecionar }: Props) {
  if (letras.length === 0) return null;
  return (
    <nav
      aria-label="Índice alfabético dos animais"
      className="sticky top-28 flex w-6 shrink-0 flex-col items-center gap-0.5 self-start"
    >
      {letras.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onSelecionar(l)}
          aria-label={`Ir para animais com ${l}`}
          className={`w-full rounded text-[10px] font-semibold leading-4 transition-colors ${
            ativa === l
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-primary"
          }`}
        >
          {l}
        </button>
      ))}
    </nav>
  );
}
