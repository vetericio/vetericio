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
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Calculadora
      </p>
      <div className="rounded-xl bg-secondary px-3 py-3 text-right">
        <p className="min-h-5 truncate text-sm text-muted-foreground">{expr || "0"}</p>
        <p className="mt-1 truncate text-3xl font-semibold leading-tight text-foreground">
          {resultado || "—"}
        </p>
      </div>
      <div className="grid flex-1 grid-cols-4 gap-2">
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
                "rounded-xl py-3 text-lg font-semibold transition-colors active:scale-[0.97]",
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
