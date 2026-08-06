import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Calculadora } from "@/components/Calculadora";
import { Cronometro } from "@/components/Cronometro";
import { TaxaInfusao } from "@/components/TaxaInfusao";
import { FormAvaliacao } from "@/components/FormAvaliacao";
import { ListaRegistros } from "@/components/ListaRegistros";
import { InstalarApp } from "@/components/InstalarApp";
import {
  REGISTRO_VAZIO,
  carregarRegistros,
  formatarTodos,
  salvarRegistros,
  type Registro,
} from "@/lib/ficha";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Veterício — Ficha de Avaliação da Internação" },
      {
        name: "description",
        content:
          "App offline da Veterício para registrar avaliações de internação: alimentação, comportamento, mucosas, sinais vitais, taxa de infusão e exportação em texto.",
      },
      { property: "og:title", content: "Veterício — Ficha de Avaliação da Internação" },
      {
        property: "og:description",
        content:
          "Registre avaliações de animais internados offline e exporte todos os dados em texto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [form, setForm] = useState<Omit<Registro, "id">>(REGISTRO_VAZIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    setRegistros(carregarRegistros());
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (carregado) salvarRegistros(registros);
  }, [registros, carregado]);

  const enviar = () => {
    if (!form.animal.trim()) {
      toast.error("Informe o nome do animal.");
      return;
    }
    if (editandoId) {
      setRegistros((rs) => rs.map((r) => (r.id === editandoId ? { ...form, id: editandoId } : r)));
      setEditandoId(null);
      toast.success("Registro atualizado.");
    } else {
      setRegistros((rs) => [...rs, { ...form, id: crypto.randomUUID() }]);
      toast.success(`${form.animal.trim()} adicionado.`);
    }
    setForm(REGISTRO_VAZIO);
  };

  const exportar = async () => {
    if (registros.length === 0) {
      toast.error("Nenhum registro para exportar.");
      return;
    }
    const texto = formatarTodos(registros);
    try {
      if (navigator.share) {
        await navigator.share({ text: texto });
        return;
      }
      await navigator.clipboard.writeText(texto);
      toast.success("Texto copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto abaixo.");
    }
  };

  const copiar = async () => {
    if (registros.length === 0) return;
    try {
      await navigator.clipboard.writeText(formatarTodos(registros));
      toast.success("Texto copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6">
      <header className="text-center">
        <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
          Veterício Serviços Veterinários LTDA
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Ficha de Avaliação da Internação</p>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-[1.15fr_1fr]">
        <Calculadora />
        <div className="space-y-3">
          <Cronometro />
          <TaxaInfusao />
        </div>
      </section>

      <div className="mt-6">
        <FormAvaliacao
          valores={form}
          onChange={setForm}
          onEnviar={enviar}
          editando={Boolean(editandoId)}
          onCancelar={() => {
            setEditandoId(null);
            setForm(REGISTRO_VAZIO);
          }}
        />
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Animais registrados ({registros.length})
          </h2>
          {registros.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Apagar todos os registros?")) {
                  setRegistros([]);
                  toast.success("Registros apagados.");
                }
              }}
              className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary/70"
            >
              Limpar tudo
            </button>
          )}
        </div>

        <div className="mt-3">
          <ListaRegistros
            registros={registros}
            onEditar={(r) => {
              const { id, ...resto } = r;
              setForm(resto);
              setEditandoId(id);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onExcluir={(id) => setRegistros((rs) => rs.filter((r) => r.id !== id))}
          />
        </div>
      </section>

      {registros.length > 0 && (
        <section className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-foreground">Exportar</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copiar}
                className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
              >
                Copiar
              </button>
              <button
                type="button"
                onClick={exportar}
                className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Compartilhar
              </button>
            </div>
          </div>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-secondary p-3 font-sans text-sm leading-relaxed text-foreground">
            {formatarTodos(registros)}
          </pre>
        </section>
      )}

      <div className="mt-8">
        <InstalarApp />
      </div>
    </main>
  );
}
