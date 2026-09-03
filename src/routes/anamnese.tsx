import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAnamneses } from "@/hooks/useAnamneses";
import { usePlantaoAtual } from "@/hooks/usePlantaoAtual";
import { ExigePlantao } from "@/components/ExigePlantao";
import { GuardaSaida } from "@/components/GuardaSaida";
import { ESPECIES, type Especie } from "@/lib/ficha";
import {
  ANAMNESE_VAZIA,
  emojiEspecie,
  normalizarNome,
  quandoCurto,
  type Anamnese,
} from "@/lib/anamnese";

export const Route = createFileRoute("/anamnese")({
  head: () => ({
    meta: [
      { title: "Anamnese — Veterício" },
      {
        name: "description",
        content:
          "Ficha de anamnese enxuta: queixa principal, relato, exames, pendências com checkbox, conduta e ponto de atenção para a passagem de plantão.",
      },
      { property: "og:title", content: "Anamnese — Veterício" },
      {
        property: "og:description",
        content: "Anamnese minimalista para a passagem de plantão da Veterício.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnamnesePagina,
});

const rotuloCampo =
  "text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground";
const campo =
  "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring";

function AnamnesePagina() {
  const { plantao, carregado: plantaoCarregado } = usePlantaoAtual();
  if (!plantaoCarregado) return null;
  if (!plantao)
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
        <ExigePlantao funcao="A anamnese" />
      </main>
    );
  return <AnamneseConteudo />;
}

function AnamneseConteudo() {
  const { anamneses, setAnamneses, carregado } = useAnamneses();
  const [form, setForm] = useState<Omit<Anamnese, "id" | "atualizadoEm">>(ANAMNESE_VAZIA);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novaPendencia, setNovaPendencia] = useState("");
  const [busca, setBusca] = useState("");

  // Só considera "não salvo" quando o formulário difere do que está guardado.
  const salvo = editandoId
    ? (() => {
        const alvo = anamneses.find((a) => a.id === editandoId);
        if (!alvo) return ANAMNESE_VAZIA;
        const { id: _i, atualizadoEm: _q, ...resto } = alvo;
        return resto;
      })()
    : ANAMNESE_VAZIA;
  const sujo =
    JSON.stringify(form) !== JSON.stringify(salvo) || novaPendencia.trim().length > 0;

  const set = <K extends keyof typeof form>(chave: K, valor: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [chave]: valor }));

  const limpar = () => {
    setForm(ANAMNESE_VAZIA);
    setEditandoId(null);
    setNovaPendencia("");
  };

  const adicionarPendencia = () => {
    const texto = novaPendencia.trim();
    if (!texto) return;
    set("pendencias", [...form.pendencias, { id: crypto.randomUUID(), texto, feito: false }]);
    setNovaPendencia("");
  };

  const salvar = () => {
    if (!form.animal.trim()) {
      toast.error("Informe o nome do animal.");
      return;
    }
    const agora = new Date().toISOString();
    if (editandoId) {
      setAnamneses((lista) =>
        lista.map((a) => (a.id === editandoId ? { ...a, ...form, atualizadoEm: agora } : a)),
      );
      toast.success("Anamnese atualizada.");
    } else {
      setAnamneses((lista) => [
        { ...form, id: crypto.randomUUID(), atualizadoEm: agora },
        ...lista,
      ]);
      toast.success("Anamnese salva. O animal já aparece na busca do Início.");
    }
    limpar();
  };

  const editar = (a: Anamnese) => {
    const { id: _i, atualizadoEm: _q, ...resto } = a;
    setForm(resto);
    setEditandoId(a.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const excluir = (a: Anamnese) => {
    if (!window.confirm(`Excluir a anamnese de ${a.animal.trim()}?`)) return;
    setAnamneses((lista) => lista.filter((x) => x.id !== a.id));
    if (editandoId === a.id) limpar();
    toast.success("Anamnese excluída.");
  };

  const alternarPendencia = (a: Anamnese, pid: string) =>
    setAnamneses((lista) =>
      lista.map((x) =>
        x.id === a.id
          ? {
              ...x,
              atualizadoEm: new Date().toISOString(),
              pendencias: x.pendencias.map((p) =>
                p.id === pid ? { ...p, feito: !p.feito } : p,
              ),
            }
          : x,
      ),
    );

  const termo = normalizarNome(busca);
  const visiveis = termo
    ? anamneses.filter((a) => normalizarNome(a.animal).includes(termo))
    : anamneses;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
      <GuardaSaida sujo={sujo} />
      <h1 className="font-display text-lg font-semibold text-foreground">Anamnese</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cadastre o animal aqui. Ele só vai para Animais internados depois que a ficha for enviada
        no Início.
      </p>

      <section className="mt-5 space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <label className="block">
          <span className={rotuloCampo}>Nome do animal</span>
          <input
            value={form.animal}
            onChange={(e) => set("animal", e.target.value)}
            placeholder="Nome do animal"
            className={`${campo} text-base font-semibold`}
          />
        </label>

        <div>
          <p className={rotuloCampo}>Espécie</p>
          <div className="mt-1.5 flex gap-2">
            {ESPECIES.map((esp) => {
              const ativo = form.especie === esp;
              return (
                <button
                  key={esp}
                  type="button"
                  onClick={() => set("especie", (ativo ? "" : esp) as Especie)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    ativo
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                  }`}
                >
                  {emojiEspecie(esp)} {esp}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className={rotuloCampo}>Queixa principal</span>
          <input
            value={form.queixa}
            onChange={(e) => set("queixa", e.target.value)}
            placeholder="Motivo do atendimento"
            className={campo}
          />
        </label>

        <label className="block">
          <span className={rotuloCampo}>Relato</span>
          <textarea
            value={form.relato}
            onChange={(e) => set("relato", e.target.value)}
            rows={3}
            placeholder="O que o tutor contou"
            className={campo}
          />
        </label>

        <label className="block">
          <span className={rotuloCampo}>Exames</span>
          <textarea
            value={form.exames}
            onChange={(e) => set("exames", e.target.value)}
            rows={2}
            placeholder="Exames feitos e resultados"
            className={campo}
          />
        </label>

        <div>
          <p className={rotuloCampo}>Pendências</p>
          <div className="mt-1.5 space-y-1.5">
            {form.pendencias.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2.5 rounded-lg bg-secondary/50 px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={p.feito}
                  onChange={() =>
                    set(
                      "pendencias",
                      form.pendencias.map((x) =>
                        x.id === p.id ? { ...x, feito: !x.feito } : x,
                      ),
                    )
                  }
                  className="h-5 w-5 shrink-0 accent-[var(--primary)]"
                />
                <span
                  className={`flex-1 text-sm ${
                    p.feito ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  {p.texto}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    set("pendencias", form.pendencias.filter((x) => x.id !== p.id))
                  }
                  className="text-xs font-semibold text-muted-foreground hover:text-destructive"
                >
                  remover
                </button>
              </label>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={novaPendencia}
              onChange={(e) => setNovaPendencia(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  adicionarPendencia();
                }
              }}
              placeholder="Nova pendência"
              className={`${campo} mt-0`}
            />
            <button
              type="button"
              onClick={adicionarPendencia}
              className="shrink-0 rounded-lg bg-secondary px-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70"
            >
              Adicionar
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={rotuloCampo}>Conduta / plano</span>
            <textarea
              value={form.conduta}
              onChange={(e) => set("conduta", e.target.value)}
              rows={2}
              placeholder="Opcional"
              className={campo}
            />
          </label>
          <label className="block">
            <span className={rotuloCampo}>Atenção no próximo plantão</span>
            <textarea
              value={form.atencao}
              onChange={(e) => set("atencao", e.target.value)}
              rows={2}
              placeholder="Opcional"
              className={campo}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={salvar}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {editandoId ? "Salvar alterações" : "Salvar anamnese"}
          </button>
          {(editandoId || form.animal) && (
            <button
              type="button"
              onClick={limpar}
              className="rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70"
            >
              Cancelar
            </button>
          )}
        </div>
      </section>

      {carregado && anamneses.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-foreground">
              Anamneses ({anamneses.length})
            </h2>
          </div>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Procurar animal"
            className={`${campo} mt-2`}
          />

          <ul className="mt-3 space-y-2">
            {visiveis.map((a) => {
              const abertas = a.pendencias.filter((p) => !p.feito).length;
              return (
                <li key={a.id} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {emojiEspecie(a.especie)} {a.animal.trim()}
                      </p>
                      {a.queixa.trim() && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {a.queixa.trim()}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => editar(a)}
                        className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => excluir(a)}
                        className="rounded-lg bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>

                  {a.pendencias.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {a.pendencias.map((p) => (
                        <li key={p.id}>
                          <label className="flex items-center gap-2.5 text-sm">
                            <input
                              type="checkbox"
                              checked={p.feito}
                              onChange={() => alternarPendencia(a, p.id)}
                              className="h-5 w-5 shrink-0 accent-[var(--primary)]"
                            />
                            <span
                              className={
                                p.feito ? "text-muted-foreground line-through" : "text-foreground"
                              }
                            >
                              {p.texto}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {abertas > 0 ? `${abertas} pendência(s) aberta(s) · ` : ""}
                    atualizado {quandoCurto(a.atualizadoEm)}
                  </p>
                  {a.atencao.trim() && (
                    <p className="mt-1 text-xs font-semibold text-destructive">
                      Atenção: {a.atencao.trim()}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <BlocoNotas />
    </main>

  );
}
