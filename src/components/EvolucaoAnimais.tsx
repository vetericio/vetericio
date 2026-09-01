import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useRegistros } from "@/hooks/useRegistros";
import { agruparAnimais, corDaOpcao, seriesCategoricas, seriesNumericas } from "@/lib/evolucao";
import { comVirgula } from "@/lib/ficha";

/** Gráficos de evolução por animal (usado dentro de Animais internados). */
export function EvolucaoAnimais() {
  const { registros, carregado } = useRegistros();
  const [chave, setChave] = useState("");

  const animais = useMemo(
    () => (carregado ? agruparAnimais(registros) : []),
    [registros, carregado],
  );

  const animal = animais.find((a) => a.chave === chave) ?? animais[0];
  const numericas = animal ? seriesNumericas(animal) : [];
  const categoricas = animal ? seriesCategoricas(animal) : [];

  if (animais.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Nenhuma avaliação registrada ainda. Preencha a ficha no Início para começar a acompanhar a
        evolução.
      </p>
    );
  }

  return (
    <div>
      <label className="block">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Animal
        </span>
        <select
          value={animal?.chave ?? ""}
          onChange={(e) => setChave(e.target.value)}
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-base font-semibold text-foreground outline-none focus:border-ring"
        >
          {animais.map((a) => (
            <option key={a.chave} value={a.chave}>
              {a.rotulo} — {a.registros.length}{" "}
              {a.registros.length === 1 ? "avaliação" : "avaliações"}
            </option>
          ))}
        </select>
      </label>

      {numericas.length === 0 && categoricas.length === 0 && (
        <p className="mt-4 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Este animal ainda não tem valores preenchidos para gerar gráficos.
        </p>
      )}

      {numericas.length > 0 && (
        <section className="mt-5 space-y-3">
          <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Números
          </h3>
          {numericas.map((s) => (
            <article key={s.chave} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-sm font-semibold text-foreground">
                  {s.rotulo}{" "}
                  <span className="text-xs font-normal text-muted-foreground">({s.unidade})</span>
                </h4>
                {s.faixa && (
                  <span className="text-[11px] text-muted-foreground">
                    Normal: {comVirgula(String(s.faixa[0]))} a {comVirgula(String(s.faixa[1]))}
                  </span>
                )}
              </div>
              <div className="mt-2 h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={s.pontos} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    {s.faixa && (
                      <ReferenceArea
                        y1={s.faixa[0]}
                        y2={s.faixa[1]}
                        fill="var(--primary)"
                        fillOpacity={0.08}
                      />
                    )}
                    <XAxis
                      dataKey="rotuloX"
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      stroke="var(--border)"
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      stroke="var(--border)"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        fontSize: 12,
                        color: "var(--popover-foreground)",
                      }}
                      formatter={(v) => [`${comVirgula(String(v))} ${s.unidade}`, s.rotulo]}
                    />
                    <Line
                      type="linear"
                      dataKey="valor"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "var(--primary)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>
          ))}
        </section>
      )}

      {categoricas.length > 0 && (
        <section className="mt-5 space-y-3">
          <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Escolhas
          </h3>
          {categoricas.map((s) => (
            <article key={s.chave} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
              <h4 className="text-sm font-semibold text-foreground">{s.rotulo}</h4>

              <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
                {s.pontos.map((p, i) => (
                  <div key={i} className="min-w-16 flex-1 shrink-0">
                    <div
                      className="flex h-10 items-center justify-center rounded-lg px-1 text-center text-[0.65rem] font-semibold leading-tight"
                      style={{
                        backgroundColor: corDaOpcao(s.chave, p.opcao),
                        color: "var(--primary-foreground)",
                      }}
                      title={`${p.rotuloX} — ${p.opcao}`}
                    >
                      {p.opcao}
                    </div>
                    <p className="mt-1 text-center text-[0.6rem] text-muted-foreground">
                      {p.rotuloX}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {s.opcoes.map((o) => (
                  <span
                    key={o}
                    className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: corDaOpcao(s.chave, o) }}
                    />
                    {o}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
