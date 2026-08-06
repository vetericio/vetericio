import { useState } from "react";

const TECLAS = [
  ["C", "⌫", "^", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "+"],
  ["0", ",", "%", "="],
];

function avaliar(expr: string): string {
  const normalizada = expr
    .replace(/÷/g, "/")
    .replace(/×/g, "*")
    .replace(/−/g, "-")
    .replace(/,/g, ".")
    .replace(/\^/g, "**")
    .replace(/(\d+(?:\.\d+)?)%/g, "($1/100)");
  if (!/^[0-9+\-*/.()\s*]+$/.test(normalizada)) return "Erro";
  try {
    // eslint-disable-next-line no-new-func
    const resultado = Function(`"use strict"; return (${normalizada});`)();
    if (typeof resultado !== "number" || !isFinite(resultado)) return "Erro";
    return String(Math.round(resultado * 1e6) / 1e6).replace(".", ",");
  } catch {
    return "Erro";
  }
}

export function Calculadora() {
  const [expr, setExpr] = useState("");
  const [resultado, setResultado] = useState("");

  const aoTocar = (tecla: string) => {
    if (tecla === "C") {
      setExpr("");
      setResultado("");
      return;
    }
    if (tecla === "⌫") {
      setExpr((e) => e.slice(0, -1));
      return;
    }
    if (tecla === "=") {
      if (!expr) return;
      setResultado(avaliar(expr));
      return;
    }
    setExpr((e) => e + tecla);
  };

  return (
    <div className="flex h-full flex-col gap-2 rounded-2xl border border-border bg-card p-2.5 shadow-sm sm:gap-3 sm:p-4">
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-[0.7rem]">
        Calculadora
      </p>
      <div className="rounded-xl bg-secondary px-2 py-2 text-right sm:px-3 sm:py-3">
        <p className="min-h-4 truncate text-xs text-muted-foreground sm:text-sm">{expr || "0"}</p>
        <p className="mt-0.5 truncate text-xl font-semibold leading-tight text-foreground sm:text-3xl">
          {resultado || "—"}
        </p>
      </div>
      <div className="grid flex-1 grid-cols-4 gap-1.5 sm:gap-2">
        {TECLAS.flat().map((tecla) => {
          const operador = ["÷", "×", "−", "+", "^", "%"].includes(tecla);
          const igual = tecla === "=";
          const limpar = tecla === "C" || tecla === "⌫";
          return (
            <button
              key={tecla}
              type="button"
              onClick={() => aoTocar(tecla)}
              className={[
                "rounded-lg py-2 text-sm font-semibold transition-colors active:scale-[0.97] sm:rounded-xl sm:py-3 sm:text-lg",
                igual
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : operador
                    ? "bg-accent text-accent-foreground hover:bg-accent/80"
                    : limpar
                      ? "bg-secondary text-muted-foreground hover:bg-secondary/70"
                      : "bg-secondary text-foreground hover:bg-secondary/70",
              ].join(" ")}
            >
              {tecla}
            </button>
          );
        })}
      </div>
    </div>
  );
}
