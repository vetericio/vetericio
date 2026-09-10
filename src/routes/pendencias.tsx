import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmarAcao, usarConfirmacao } from "@/components/ConfirmarAcao";

import { ExigePlantao } from "@/components/ExigePlantao";
import { DialogoNovoItem, type AnimalOpcao } from "@/components/pendencias/DialogoNovoItem";
import { useAnamneses } from "@/hooks/useAnamneses";
import { espelharAnamneses } from "@/hooks/usePendencias";
import { usePendencias } from "@/hooks/usePendencias";
import { useRegistros } from "@/hooks/useRegistros";
import {
  ANIMAL_GERAL,
  REGRAS_ALERTA,
  ROTULO_CATEGORIA,
  agruparPorAnimal,
  carregarLimites,
  chaveDoAnimal,
  itemVazio,
  limiteDaRegra,
  quandoCurto,
  salvarLimites,
  totalOcorrencias,
  type CategoriaPendencia,
  type ItemPendencia,
  type LimitesAlerta,
} from "@/lib/pendencias";

export const Route = createFileRoute("/pendencias")({
  head: () => ({
    meta: [
      { title: "Pendências — Veterício" },
      {
        name: "description",
        content:
          "Pendências por animal, medicamentos especiais e procedimentos cobráveis por ocorrência, com contador de cada execução.",
      },
      { property: "og:title", content: "Pendências — Veterício" },
      {
        property: "og:description",
        content: "Controle de pendências, medicamentos especiais e cobranças por ocorrência.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PendenciasPagina,
});

const CORES: Record<CategoriaPendencia, string> = {
  pendencia: "border-border bg-card",
  medicamento: "border-primary/40 bg-primary/5",
  procedimento: "border-accent bg-secondary/40",
};

const SELOS: Record<CategoriaPendencia, string> = {
  pendencia: "bg-secondary text-secondary-foreground",
  medicamento: "bg-primary text-primary-foreground",
  procedimento: "bg-foreground text-background",
};

function PendenciasPagina() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6">
      <ExigePlantao funcao="Pendências">
        <Conteudo />
      </ExigePlantao>
      <ConfirmarAcao pedido={confirmacao.pedido} onFechar={confirmacao.fechar} />
    </main>
  );
}

function Conteudo() {
  const { pendencias, salvarItem, excluirItem, registrar, removerOcorrencia } = usePendencias();
  const { registros } = useRegistros();
  const { anamneses } = useAnamneses();
  const [dialogo, setDialogo] = useState<ItemPendencia | null>(null);
  const [escolhendo, setEscolhendo] = useState(false);
  const [limites, setLimites] = useState<LimitesAlerta>(() => carregarLimites());
  const [ajustando, setAjustando] = useState(false);
  const confirmacao = usarConfirmacao();

  // Traz (e mantém) as pendências escritas na anamnese para dentro do módulo.
  useEffect(() => {
    espelharAnamneses(anamneses);
  }, [anamneses]);


  const animais: AnimalOpcao[] = useMemo(() => {
    const mapa = new Map<string, AnimalOpcao>();
    for (const r of registros) {
      const nome = r.animal.trim();
      if (!nome) continue;
      mapa.set(chaveDoAnimal(nome), { chave: chaveDoAnimal(nome), nome, especie: r.especie ?? "" });
    }
    for (const a of anamneses) {
      const nome = a.animal.trim();
      if (!nome) continue;
      const chave = chaveDoAnimal(nome);
      if (!mapa.has(chave)) mapa.set(chave, { chave, nome, especie: a.especie ?? "" });
    }
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [registros, anamneses]);

  const grupos = agruparPorAnimal(pendencias);

  const abrirNovo = (categoria: CategoriaPendencia) => {
    setEscolhendo(false);
    setDialogo({ ...itemVazio(categoria), animalNome: ANIMAL_GERAL });
  };

  const alternarStatus = (item: ItemPendencia) =>
    salvarItem({
      ...item,
      status: item.status === "realizado" ? "pendente" : "realizado",
      atualizadoEm: new Date().toISOString(),
    });

  const excluir = (item: ItemPendencia) => {
    confirmacao.pedir({
      titulo: "Excluir este item?",
      descricao: `${item.nome} sai da lista de pendências. Você tem 6 segundos para desfazer.`,
      acao: "Excluir item",
      destrutivo: true,
      onConfirmar: () => {
        excluirItem(item.id);
        toast.success("Item excluído.", {
          duration: 6000,
          action: {
            label: "Desfazer",
            onClick: () => {
              salvarItem(item);
              toast.success("Item de volta.");
            },
          },
        });
      },
    });
  };

  const gravarLimite = (chave: string, valor: string) => {
    const n = Number(valor.replace(",", ".").trim());
    const novos: LimitesAlerta = { ...limites };
    if (Number.isFinite(n) && valor.trim()) novos[chave as keyof LimitesAlerta] = n;
    else delete novos[chave as keyof LimitesAlerta];
    setLimites(novos);
    salvarLimites(novos);
  };

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-semibold text-foreground">Pendências</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pendências da anamnese, medicamentos especiais e procedimentos cobráveis. Nada daqui
            entra no PDF da ficha.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEscolhendo(true)}
          aria-label="Adicionar"
          className="shrink-0 rounded-2xl bg-primary px-4 py-2.5 text-lg font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          +
        </button>
      </div>

      {escolhendo && (
        <div className="mt-3 grid gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm sm:grid-cols-3">
          {(["pendencia", "medicamento", "procedimento"] as CategoriaPendencia[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => abrirNovo(c)}
              className="rounded-xl bg-secondary px-3 py-2.5 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70"
            >
              {ROTULO_CATEGORIA[c]}
            </button>
          ))}
        </div>
      )}

      {grupos.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma pendência ainda. Toque em + para lançar.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {grupos.map((g) => (
            <section key={g.chave || "geral"} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-base font-semibold text-foreground">{g.nome}</h2>
                <p className="text-[11px] text-muted-foreground">
                  {g.abertas} aberta(s) · {g.feitas} feita(s) · {g.cobrancas} cobrança(s)
                </p>
              </div>

              <ul className="mt-3 space-y-2">
                {g.itens.map((item) => {
                  const vezes = totalOcorrencias(item);
                  return (
                    <li
                      key={item.id}
                      className={`rounded-xl border p-3 ${CORES[item.categoria]} ${
                        item.status === "realizado" ? "opacity-70" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SELOS[item.categoria]}`}
                          >
                            {ROTULO_CATEGORIA[item.categoria]}
                          </span>
                          <p
                            className={`mt-1 truncate text-sm font-semibold ${
                              item.status === "realizado"
                                ? "text-muted-foreground line-through"
                                : "text-foreground"
                            }`}
                          >
                            {item.nome}
                          </p>
                          {(item.dose || item.unidade || item.via) && (
                            <p className="text-xs text-muted-foreground">
                              {[item.dose, item.unidade, item.via].filter(Boolean).join(" ")}
                            </p>
                          )}
                          {item.observacao?.trim() && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {item.observacao.trim()}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => registrar(item.id)}
                            className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                          >
                            + registrar
                          </button>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => alternarStatus(item)}
                              className="rounded-lg bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
                            >
                              {item.status === "realizado" ? "Reabrir" : "Concluir"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDialogo(item)}
                              className="rounded-lg bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => excluir(item)}
                              className="rounded-lg bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      </div>

                      <p className="mt-2 text-xs font-semibold text-foreground">
                        {item.nome} — {vezes} realizada(s) — {vezes} cobrança(s)
                      </p>
                      {vezes > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {item.ocorrencias.map((o) => (
                            <li
                              key={o.id}
                              className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground"
                            >
                              <span>
                                {quandoCurto(o.em)}
                                {o.observacao ? ` · ${o.observacao}` : ""}
                              </span>
                              <button
                                type="button"
                                onClick={() => removerOcorrencia(item.id, o.id)}
                                className="font-semibold hover:text-destructive"
                              >
                                desfazer
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <button
          type="button"
          onClick={() => setAjustando((a) => !a)}
          className="text-sm font-semibold text-foreground"
        >
          Limites dos avisos automáticos {ajustando ? "▲" : "▼"}
        </button>
        {ajustando && (
          <div className="mt-3 space-y-3">
            {REGRAS_ALERTA.map((r) => (
              <label key={r.chave} className="block">
                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {r.pergunta}
                </span>
                <input
                  defaultValue={String(limiteDaRegra(r, limites)).replace(".", ",")}
                  onBlur={(e) => gravarLimite(r.chave, e.target.value)}
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm tabular-nums text-foreground outline-none focus:border-ring"
                />
              </label>
            ))}
            <p className="text-[11px] text-muted-foreground">
              O aviso aparece quando o valor da ficha fica abaixo do limite.
            </p>
          </div>
        )}
      </section>

      <DialogoNovoItem
        aberto={Boolean(dialogo)}
        onFechar={() => setDialogo(null)}
        animais={animais}
        inicial={dialogo}
        onSalvar={(item) => {
          salvarItem(item);
          toast.success("Pendência salva.");
        }}
      />
    </>
  );
}
