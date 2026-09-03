import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  NOME_VIA,
  ROTULO_VIA,
  UNIDADES_CONCENTRACAO,
  VIAS,
  faixaDe,
  ordenarMedicamentos,
  viasDe,
  type DoseEspecie,
  type Medicamento,
} from "@/lib/medicamentos";
import { normalizarNomeMedicamento } from "@/lib/nomes";
import { IconeVia } from "@/components/medicamentos/IconeVia";

type Props = {
  aberto: boolean;
  medicamentos: Medicamento[];
  onFechar: () => void;
  onSalvar: (item: Medicamento) => void;
};

const campo =
  "w-full rounded-xl border border-input bg-background px-3 py-2 text-base text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring";
const rotulo = "block text-xs font-semibold text-muted-foreground";

type Faltas = {
  concentracaoValor: boolean;
  concentracaoUnidade: boolean;
  vias: boolean;
  resumo: boolean;
  classificacao: boolean;
  doseCao: boolean;
  intervaloCao: boolean;
  doseGato: boolean;
  intervaloGato: boolean;
};

const vazio = (v?: string) => !(v ?? "").trim();

/** Quais campos de cadastro ainda estão em branco. "Nome menor" nunca conta. */
export function camposFaltantes(m: Medicamento): Faltas {
  const unificada = m.doseUnificada === true;
  const cao = faixaDe(m.cao);
  const gato = faixaDe(m.gato);
  const cobraCao = m.cao.proibido !== true;
  const cobraGato = !unificada && m.gato.proibido !== true;
  return {
    concentracaoValor: vazio(m.concentracaoValor),
    concentracaoUnidade: vazio(m.concentracaoUnidade),
    vias: viasDe(m).length === 0,
    resumo: vazio(m.resumo),
    classificacao: vazio(m.classificacao),
    doseCao: cobraCao && vazio(cao.min),
    intervaloCao: cobraCao && vazio(m.cao.intervalo),
    doseGato: cobraGato && vazio(gato.min),
    intervaloGato: cobraGato && vazio(m.gato.intervalo),
  };
}

export function temFalta(m: Medicamento): boolean {
  return Object.values(camposFaltantes(m)).some(Boolean);
}

export function CompletarInsercao({ aberto, medicamentos, onFechar, onSalvar }: Props) {
  // Lista congelada ao abrir: itens completados só desaparecem no próximo acesso.
  const pendentes = useMemo(
    () => ordenarMedicamentos(medicamentos).filter(temFalta),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aberto],
  );
  const [rascunho, setRascunho] = useState<Record<string, Medicamento>>({});

  useEffect(() => {
    if (aberto) setRascunho({});
  }, [aberto]);

  const atual = (m: Medicamento) => rascunho[m.id] ?? m;

  const mudar = (m: Medicamento, partes: Partial<Medicamento>) =>
    setRascunho((r) => ({ ...r, [m.id]: { ...atual(m), ...partes } }));

  const mudarDose = (m: Medicamento, especie: "cao" | "gato", partes: Partial<DoseEspecie>) => {
    const item = atual(m);
    const dose = item[especie];
    const f = faixaDe(dose);
    mudar(m, {
      [especie]: {
        ...dose,
        doseMin: f.min,
        doseMax: f.max,
        unidade: f.unidade,
        porAnimal: f.porAnimal,
        ...partes,
      },
    } as Partial<Medicamento>);
  };

  const salvarTudo = () => {
    const alterados = Object.values(rascunho);
    if (alterados.length === 0) {
      toast.info("Nada para salvar.");
      return;
    }
    alterados.forEach(onSalvar);
    toast.success(
      alterados.length === 1
        ? "1 medicamento atualizado."
        : `${alterados.length} medicamentos atualizados.`,
    );
    onFechar();
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Completar inserção</DialogTitle>
        </DialogHeader>

        <div className="sticky top-0 z-10 -mt-2 flex gap-2 bg-background pb-2 pt-1">
          <button
            type="button"
            onClick={salvarTudo}
            className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Salvar
          </button>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70"
          >
            Fechar
          </button>
        </div>

        {pendentes.length === 0 && (
          <p className="rounded-xl bg-secondary/60 px-3 py-4 text-sm text-muted-foreground">
            Todos os medicamentos estão completos.
          </p>
        )}

        <div className="space-y-3">
          {pendentes.map((m) => {
            const falta = camposFaltantes(m);
            const item = atual(m);
            const fCao = faixaDe(item.cao);
            const fGato = faixaDe(item.gato);
            return (
              <fieldset key={m.id} className="rounded-xl border border-border p-3">
                <legend className="px-1 leading-tight">
                  {m.nomeMenor?.trim() && (
                    <span className="block text-[10px] text-muted-foreground">
                      {normalizarNomeMedicamento(m.nomeMenor)}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-foreground">
                    {normalizarNomeMedicamento(m.nome)}
                  </span>
                </legend>

                <div className="space-y-2">
                  {(falta.concentracaoValor || falta.concentracaoUnidade) && (
                    <div>
                      <span className={rotulo}>Concentração</span>
                      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
                        {falta.concentracaoValor ? (
                          <input
                            value={item.concentracaoValor}
                            onChange={(e) => mudar(m, { concentracaoValor: e.target.value })}
                            inputMode="decimal"
                            className={`${campo} min-w-0`}
                            placeholder="50"
                          />
                        ) : (
                          <span className="self-center truncate text-sm font-semibold text-muted-foreground">
                            {item.concentracaoValor}
                          </span>
                        )}
                        {falta.concentracaoUnidade ? (
                          <select
                            value={item.concentracaoUnidade}
                            onChange={(e) => mudar(m, { concentracaoUnidade: e.target.value })}
                            className={`${campo} min-w-0 appearance-none`}
                          >
                            <option value="">unidade…</option>
                            {UNIDADES_CONCENTRACAO.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="self-center truncate text-sm font-semibold text-muted-foreground">
                            {item.concentracaoUnidade}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {falta.vias && (
                    <div>
                      <span className={rotulo}>Via</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {VIAS.map((v) => {
                          const ativo = item.vias.includes(v);
                          return (
                            <button
                              key={v}
                              type="button"
                              aria-pressed={ativo}
                              title={NOME_VIA[v]}
                              onClick={() =>
                                mudar(m, {
                                  vias: ativo
                                    ? item.vias.filter((x) => x !== v)
                                    : VIAS.filter((x) => x === v || item.vias.includes(x)),
                                })
                              }
                              className={`flex items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-xs font-semibold ${
                                ativo
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background text-foreground"
                              }`}
                            >
                              <IconeVia via={v} />
                              {ROTULO_VIA[v]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(falta.doseCao || falta.intervaloCao) && (
                    <div className="grid grid-cols-2 gap-2">
                      {falta.doseCao && (
                        <div>
                          <span className={rotulo}>
                            {item.doseUnificada ? "🐶🐱 Dose" : "🐶 Dose"} ({fCao.unidade})
                          </span>
                          <input
                            value={fCao.min}
                            onChange={(e) => mudarDose(m, "cao", { doseMin: e.target.value })}
                            inputMode="decimal"
                            className={`${campo} min-w-0`}
                            placeholder="20"
                          />
                        </div>
                      )}
                      {falta.intervaloCao && (
                        <div>
                          <span className={rotulo}>
                            {item.doseUnificada ? "🐶🐱 Intervalo (h)" : "🐶 Intervalo (h)"}
                          </span>
                          <input
                            value={item.cao.intervalo}
                            onChange={(e) => mudarDose(m, "cao", { intervalo: e.target.value })}
                            inputMode="decimal"
                            className={`${campo} min-w-0`}
                            placeholder="8"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {(falta.doseGato || falta.intervaloGato) && (
                    <div className="grid grid-cols-2 gap-2">
                      {falta.doseGato && (
                        <div>
                          <span className={rotulo}>🐱 Dose ({fGato.unidade})</span>
                          <input
                            value={fGato.min}
                            onChange={(e) => mudarDose(m, "gato", { doseMin: e.target.value })}
                            inputMode="decimal"
                            className={`${campo} min-w-0`}
                            placeholder="20"
                          />
                        </div>
                      )}
                      {falta.intervaloGato && (
                        <div>
                          <span className={rotulo}>🐱 Intervalo (h)</span>
                          <input
                            value={item.gato.intervalo}
                            onChange={(e) => mudarDose(m, "gato", { intervalo: e.target.value })}
                            inputMode="decimal"
                            className={`${campo} min-w-0`}
                            placeholder="8"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {falta.classificacao && (
                    <div>
                      <span className={rotulo}>Classificação</span>
                      <input
                        value={item.classificacao}
                        onChange={(e) => mudar(m, { classificacao: e.target.value })}
                        className={campo}
                        placeholder="Ex.: antibiótico"
                      />
                    </div>
                  )}

                  {falta.resumo && (
                    <div>
                      <span className={rotulo}>Resumo</span>
                      <textarea
                        value={item.resumo}
                        onChange={(e) => mudar(m, { resumo: e.target.value })}
                        rows={2}
                        className={campo}
                        placeholder="Anotações livres"
                      />
                    </div>
                  )}
                </div>
              </fieldset>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
