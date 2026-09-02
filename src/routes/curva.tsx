import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { useRegistros } from "@/hooks/useRegistros";
import { usePlantaoAtual } from "@/hooks/usePlantaoAtual";
import { ExigePlantao } from "@/components/ExigePlantao";
import { useCurvas } from "@/hooks/useCurvas";
import { definirAlarmes } from "@/hooks/useAlarmes";
import { criarAlarme, horaDe, horaDeAgoraMais } from "@/lib/alarmes";
import { desbloquearAudio, TOQUES, type ToqueId } from "@/lib/toques";
import {
  ROTULO_PARAMETRO,
  chaveDoAnimal,
  horaDaMedicao,
  tituloCurva,
  type Curva,
  type ParametroCurva,
} from "@/lib/curva";
import { avaliarValor, comVirgula, nomeAnimal, paraNumero } from "@/lib/ficha";

export const Route = createFileRoute("/curva")({
  head: () => ({
    meta: [
      { title: "Curva glicêmica e de PAS — Veterício" },
      {
        name: "description",
        content:
          "Acompanhe curva glicêmica ou de pressão arterial por animal internado, com intervalo de 1 a 4 horas e alarme automático a cada medição.",
      },
      { property: "og:title", content: "Curva glicêmica e de PAS — Veterício" },
      {
        property: "og:description",
        content:
          "Registre medições de glicemia e PAS em intervalos e leve a curva para a ficha do animal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PaginaCurva,
});

const INTERVALOS = [1, 2, 3, 4];

function PaginaCurva() {
  const { plantao, carregado: plantaoCarregado } = usePlantaoAtual();
  if (!plantaoCarregado) return null;
  if (!plantao)
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-5">
        <ExigePlantao funcao="A curva glicêmica e de PAS" />
      </main>
    );
  return <CurvaConteudo />;
}

function CurvaConteudo() {
  const { registros, carregado } = useRegistros();
  const { curvas, setCurvas } = useCurvas();

  const [chave, setChave] = useState("");
  const [parametros, setParametros] = useState<ParametroCurva[]>(["glicemia"]);
  const [intervalo, setIntervalo] = useState(2);
  const [toque, setToque] = useState<ToqueId>("urgente");
  const [novos, setNovos] = useState<Record<string, { glicemia: string; pas: string }>>({});
  const [comAlarme, setComAlarme] = useState(true);

  const animais = useMemo(() => {
    const mapa = new Map<string, { chave: string; rotulo: string; animal: string; especie: string }>();
    for (const r of registros) {
      const k = chaveDoAnimal(r.animal, r.especie);
      if (!mapa.has(k)) {
        mapa.set(k, {
          chave: k,
          rotulo: nomeAnimal(r),
          animal: r.animal.trim(),
          especie: r.especie ?? "",
        });
      }
    }
    return [...mapa.values()];
  }, [registros]);

  const selecionado = animais.find((a) => a.chave === chave) ?? animais[0];

  const alternarParametro = (p: ParametroCurva) => {
    setParametros((atual) =>
      atual.includes(p) ? atual.filter((x) => x !== p) : [...atual, p],
    );
  };

  const iniciar = () => {
    if (!selecionado) return;
    if (parametros.length === 0) {
      toast.error("Escolha glicemia, PAS ou os dois.");
      return;
    }
    desbloquearAudio();
    const id = crypto.randomUUID();
    const nova: Curva = {
      id,
      chave: selecionado.chave,
      animal: selecionado.animal,
      especie: (selecionado.especie || "") as Curva["especie"],
      parametros: [...parametros],
      intervaloHoras: intervalo,
      ativa: true,
      criadoEm: new Date().toISOString(),
      medicoes: [],
    };

    const nomes = parametros.map((p) => ROTULO_PARAMETRO[p].rotulo).join(" e ");
    if (comAlarme) {
      const proximo = horaDeAgoraMais(intervalo);
      const alarme = criarAlarme({
        rotulo: `Curva ${selecionado.animal} — ${nomes.toLowerCase()}`,
        hora: horaDe(proximo),
        toque,
        intervaloHoras: intervalo,
        curvaId: id,
      });
      alarme.proximo = proximo.toISOString();
      definirAlarmes((lista) => [...lista, alarme]);
      nova.alarmeId = alarme.id;
      toast.success(`Curva iniciada e alarme criado para ${horaDe(proximo)}.`);
    } else {
      toast.success("Curva iniciada.");
    }

    setCurvas((lista) => [nova, ...lista]);
  };

  const adicionarMedicao = (c: Curva) => {
    const entrada = novos[c.id] ?? { glicemia: "", pas: "" };
    if (!entrada.glicemia.trim() && !entrada.pas.trim()) {
      toast.error("Informe o valor da medição.");
      return;
    }
    setCurvas((lista) =>
      lista.map((x) =>
        x.id === c.id
          ? {
              ...x,
              medicoes: [
                ...x.medicoes,
                {
                  id: crypto.randomUUID(),
                  em: new Date().toISOString(),
                  glicemia: entrada.glicemia.trim(),
                  pas: entrada.pas.trim(),
                },
              ],
            }
          : x,
      ),
    );
    setNovos((n) => ({ ...n, [c.id]: { glicemia: "", pas: "" } }));
    toast.success("Medição registrada.");
  };

  const excluirCurva = (c: Curva) => {
    if (!window.confirm(`Apagar a curva de ${c.animal}?`)) return;
    setCurvas((lista) => lista.filter((x) => x.id !== c.id));
    if (c.alarmeId) definirAlarmes((lista) => lista.filter((a) => a.id !== c.alarmeId));
  };

  const excluirMedicao = (c: Curva, idMedicao: string) => {
    setCurvas((lista) =>
      lista.map((x) =>
        x.id === c.id ? { ...x, medicoes: x.medicoes.filter((m) => m.id !== idMedicao) } : x,
      ),
    );
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-5">
      <h2 className="font-display text-xl font-semibold text-foreground">
        Curva glicêmica / PAS
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Escolha o animal, o que vai medir e de quantas em quantas horas. As medições entram na
        ficha final do animal.
      </p>

      {animais.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {carregado
            ? "Registre o animal na ficha do Início para começar uma curva."
            : "Carregando…"}
        </p>
      ) : (
        <section className="mt-5 space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <label className="block">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Animal
            </span>
            <select
              value={selecionado?.chave ?? ""}
              onChange={(e) => setChave(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-base font-semibold text-foreground outline-none focus:border-ring"
            >
              {animais.map((a) => (
                <option key={a.chave} value={a.chave}>
                  {a.rotulo}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Medir
            </span>
            <div className="mt-1 flex gap-2">
              {(["glicemia", "pas"] as ParametroCurva[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => alternarParametro(p)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    parametros.includes(p)
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                  }`}
                >
                  {ROTULO_PARAMETRO[p].rotulo}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Intervalo
            </span>
            <div className="mt-1 flex gap-2">
              {INTERVALOS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setIntervalo(h)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    intervalo === h
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Música do alarme
            </span>
            <select
              value={toque}
              onChange={(e) => setToque(e.target.value as ToqueId)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            >
              {TOQUES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>

          {parametros.length > 0 && (
            <label className="flex items-start gap-2 rounded-xl bg-secondary/60 p-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={comAlarme}
                onChange={(e) => setComAlarme(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <strong>Sugestão de alarme:</strong> avisar a cada {intervalo}h para medir{" "}
                {parametros.map((p) => ROTULO_PARAMETRO[p].rotulo.toLowerCase()).join(" e ")} de{" "}
                {selecionado?.animal}. O alarme vale até finalizar o plantão.
              </span>
            </label>
          )}

          <button
            type="button"
            onClick={iniciar}
            className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Iniciar acompanhamento
          </button>
        </section>
      )}

      <div className="mt-6 space-y-4">
        {curvas.map((c) => {
          const entrada = novos[c.id] ?? { glicemia: "", pas: "" };
          const dados = c.medicoes.map((m) => ({
            hora: horaDaMedicao(m),
            glicemia: paraNumero(m.glicemia),
            pas: paraNumero(m.pas),
          }));
          return (
            <article key={c.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {c.animal} {c.especie === "Cachorro" ? "🐶" : c.especie === "Gato" ? "🐱" : ""}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {tituloCurva(c)}
                    {c.ativa ? "" : " · encerrada"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => excluirCurva(c)}
                    className="rounded-lg bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir
                  </button>
                </div>
              </div>

              {c.ativa && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  {c.parametros.map((p) => (
                    <label key={p} className="flex-1">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {ROTULO_PARAMETRO[p].rotulo} ({ROTULO_PARAMETRO[p].unidade})
                      </span>
                      <input
                        inputMode="decimal"
                        value={p === "glicemia" ? entrada.glicemia : entrada.pas}
                        onChange={(e) =>
                          setNovos((n) => ({
                            ...n,
                            [c.id]: { ...entrada, [p]: e.target.value },
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-base font-semibold text-foreground outline-none focus:border-ring"
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    onClick={() => adicionarMedicao(c)}
                    className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Registrar
                  </button>
                </div>
              )}

              {c.medicoes.length > 0 ? (
                <>
                  <ul className="mt-3 divide-y divide-border/70 text-sm">
                    {c.medicoes.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-3 py-1.5">
                        <span className="font-mono text-muted-foreground">{horaDaMedicao(m)}</span>
                        <span className="flex flex-1 flex-wrap gap-3">
                          {c.parametros.map((p) => {
                            const valor = (p === "glicemia" ? m.glicemia : m.pas).trim();
                            if (!valor) return null;
                            const { fora } = avaliarValor(p, valor, c.especie);
                            return (
                              <span
                                key={p}
                                className={fora ? "font-semibold text-destructive" : "text-foreground"}
                              >
                                {ROTULO_PARAMETRO[p].rotulo}: {comVirgula(valor)}{" "}
                                {ROTULO_PARAMETRO[p].unidade}
                              </span>
                            );
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={() => excluirMedicao(c, m.id)}
                          className="text-xs font-semibold text-destructive"
                        >
                          apagar
                        </button>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 h-52 w-full" style={{ minHeight: 208 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                        <Tooltip />
                        {c.parametros.includes("glicemia") && (
                          <Line
                            type="monotone"
                            dataKey="glicemia"
                            name="Glicemia"
                            stroke="var(--primary)"
                            strokeWidth={2}
                            connectNulls
                          />
                        )}
                        {c.parametros.includes("pas") && (
                          <Line
                            type="monotone"
                            dataKey="pas"
                            name="PAS"
                            stroke="var(--destructive)"
                            strokeWidth={2}
                            connectNulls
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Nenhuma medição registrada ainda.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
