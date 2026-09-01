import { useEffect, useState } from "react";
import { Backup } from "@/components/Backup";
import { Sincronizacao } from "@/components/Sincronizacao";
import {
  CORES_RAPIDAS,
  TEMAS,
  aplicarCorPersonalizada,
  aplicarTema,
  carregarCor,
  carregarTema,
  salvarCor,
  type TemaId,
} from "@/lib/tema";

export function Rodape() {
  const [aberto, setAberto] = useState(false);
  const [tema, setTema] = useState<TemaId>("original");
  const [cor, setCor] = useState("#2f7d76");

  useEffect(() => {
    const salvo = carregarTema();
    const corSalva = carregarCor();
    setTema(salvo);
    setCor(corSalva);
    aplicarTema(salvo, corSalva);
  }, []);

  const escolher = (id: TemaId) => {
    setTema(id);
    aplicarTema(id, cor);
  };

  const mudarCor = (nova: string) => {
    setCor(nova);
    salvarCor(nova);
    setTema("minha-cor");
    aplicarTema("minha-cor", nova);
    aplicarCorPersonalizada(nova);
  };

  return (
    <footer className="mx-auto w-full max-w-5xl px-4 pb-8 text-center">
      <div className="flex flex-wrap items-start justify-center gap-2">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="rounded-lg bg-secondary px-3 py-1.5 text-[11px] font-semibold text-secondary-foreground hover:bg-secondary/70"
        >
          Temas
        </button>
        <Backup />
        <Sincronizacao />
      </div>

      {aberto && (
        <div className="mx-auto mt-2 max-w-md">

          <div className="flex flex-wrap justify-center gap-2">
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

          {tema === "minha-cor" && (
            <div className="mt-3 rounded-xl bg-secondary/60 p-3">
              <p className="text-[11px] font-semibold text-muted-foreground">
                Escolha a sua cor — o app monta o tema inteiro a partir dela
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <input
                  type="color"
                  value={cor}
                  onChange={(e) => mudarCor(e.target.value)}
                  aria-label="Escolher a cor do app"
                  className="h-9 w-14 cursor-pointer rounded-lg border border-input bg-background p-1"
                />
                {CORES_RAPIDAS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Usar a cor ${c}`}
                    onClick={() => mudarCor(c)}
                    style={{ backgroundColor: c }}
                    className={`h-7 w-7 rounded-full border-2 ${
                      cor.toLowerCase() === c ? "border-foreground" : "border-border"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}



      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        Todos os direitos reservados a Veterício Serviços Veterinários LTDA. 31995512795.
      </p>
    </footer>
  );
}
