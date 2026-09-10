import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { useConforto } from "@/hooks/useConforto";
import { TEMA_CALMO } from "@/lib/conforto";
import {
  CORES_RAPIDAS,
  TEMAS,
  aplicarCorPersonalizada,
  aplicarTema,
  carregarCor,
  carregarTema,
  grupoDoTema,
  salvarCor,
  type TemaId,
} from "@/lib/tema";

export const Route = createFileRoute("/temas")({
  head: () => ({
    meta: [
      { title: "Temas do app — Veterício" },
      {
        name: "description",
        content:
          "Veja todos os temas do Veterício lado a lado, com prévia de cores, e escolha o seu ou monte um com a sua cor.",
      },
      { property: "og:title", content: "Temas do app — Veterício" },
      {
        property: "og:description",
        content: "Todos os temas do Veterício em uma página, com prévia de cores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaTemas,
});

function PaginaTemas() {
  const [tema, setTema] = useState<TemaId>("original");
  const [cor, setCor] = useState("#2f7d76");
  const { conforto, definirModo } = useConforto();

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

  const escolherModo = (modo: "veterico" | "calmo") => {
    definirModo(modo);
    if (modo === "calmo") {
      escolher(TEMA_CALMO as TemaId);
      toast.success("Modo calmo ligado: menos cor, menos movimento, som mais baixo.");
    } else {
      toast.success("Modo Veterício ligado: o app como sempre foi.");
    }
  };

  const cartao = (t: (typeof TEMAS)[number]) => {
    const atual = tema === t.id;
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => escolher(t.id)}
        className={`${t.classe} overflow-hidden rounded-xl border-2 text-left transition-shadow hover:shadow-md ${
          atual ? "border-foreground" : "border-border"
        }`}
      >
        <div className="bg-background p-2.5">
          <p className="text-[12px] font-bold text-foreground">{t.nome}</p>
          <p className="text-[10px] text-muted-foreground">{t.descricao}</p>

          <div className="mt-2 rounded-lg bg-card p-2">
            <p className="text-[10px] font-semibold text-card-foreground">Ficha do animal</p>
            <div className="mt-1.5 flex gap-1">
              <span className="rounded-md bg-primary px-2 py-1 text-[9px] font-semibold text-primary-foreground">
                Enviar
              </span>
              <span className="rounded-md bg-secondary px-2 py-1 text-[9px] font-semibold text-secondary-foreground">
                Copiar
              </span>
            </div>
          </div>

          <p className="mt-2 text-[9px] font-semibold text-muted-foreground">
            {atual ? "Em uso" : "Toque para usar"}
          </p>
        </div>
      </button>
    );
  };

  const sobrios = TEMAS.filter((t) => grupoDoTema(t.id) === "sobrio");
  const divertidos = TEMAS.filter((t) => grupoDoTema(t.id) === "divertido");

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-10 pt-2">
      <h1 className="mb-1 text-center text-lg font-bold text-foreground">Temas</h1>
      <p className="mb-4 text-center text-[11px] text-muted-foreground">
        Escolha primeiro como o app deve se comportar e depois as cores.
      </p>

      <section className="mb-5 rounded-2xl border border-border bg-card p-3">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Como o app se comporta
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => escolherModo("veterico")}
            className={`min-h-11 rounded-xl border-2 p-3 text-left ${
              conforto.modo === "veterico" ? "border-foreground bg-secondary/60" : "border-border"
            }`}
          >
            <p className="text-sm font-bold text-foreground">Veterício</p>
            <p className="text-[11px] text-muted-foreground">
              Do jeito de sempre: cores livres, som e vibração normais.
            </p>
          </button>
          <button
            type="button"
            onClick={() => escolherModo("calmo")}
            className={`min-h-11 rounded-xl border-2 p-3 text-left ${
              conforto.modo === "calmo" ? "border-foreground bg-secondary/60" : "border-border"
            }`}
          >
            <p className="text-sm font-bold text-foreground">Calmo</p>
            <p className="text-[11px] text-muted-foreground">
              Sem movimento na tela, tema sóbrio, som mais baixo, sem vibração e o Início mais
              enxuto.
            </p>
          </button>
        </div>
      </section>

      <h2 className="mb-2 text-sm font-bold text-foreground">Temas sóbrios</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{sobrios.map(cartao)}</div>

      <h2 className="mb-2 mt-5 text-sm font-bold text-foreground">Temas divertidos</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{divertidos.map(cartao)}</div>

      {tema === "minha-cor" && (
        <div className="mt-4 rounded-xl bg-secondary/60 p-3 text-center">
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
    </main>
  );
}
