import { useEffect, useState } from "react";
import { TEMAS, aplicarTema, carregarTema, type TemaId } from "@/lib/tema";

export function Rodape() {
  const [aberto, setAberto] = useState(false);
  const [tema, setTema] = useState<TemaId>("original");

  useEffect(() => {
    const salvo = carregarTema();
    setTema(salvo);
    aplicarTema(salvo);
  }, []);

  const escolher = (id: TemaId) => {
    setTema(id);
    aplicarTema(id);
  };

  return (
    <footer className="mx-auto w-full max-w-5xl px-4 pb-8 text-center">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="text-[11px] font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Temas
      </button>

      {aberto && (
        <div className="mx-auto mt-2 flex max-w-sm flex-wrap justify-center gap-2">
          {TEMAS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => escolher(t.id)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                tema === t.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
              }`}
              title={t.descricao}
            >
              {t.nome}
            </button>
          ))}
        </div>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        Todos os direitos reservados a Veterício Serviços Veterinários LTDA. 31995512795.
      </p>
    </footer>
  );
}
