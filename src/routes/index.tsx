import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Calculadora } from "@/components/Calculadora";
import { Cronometro } from "@/components/Cronometro";
import { TaxaInfusao } from "@/components/TaxaInfusao";
import { FormAvaliacao } from "@/components/FormAvaliacao";
import { InstalarApp } from "@/components/InstalarApp";
import { useRegistros } from "@/hooks/useRegistros";
import { REGISTRO_VAZIO, type Registro } from "@/lib/ficha";

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
  const { registros, setRegistros, carregado } = useRegistros();
  const [form, setForm] = useState<Omit<Registro, "id">>(REGISTRO_VAZIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Abre em modo edição quando vem da página de registros.
  useEffect(() => {
    if (!carregado) return;
    const id = window.localStorage.getItem("veterico-editar-id");
    if (!id) return;
    window.localStorage.removeItem("veterico-editar-id");
    const alvo = registros.find((r) => r.id === id);
    if (alvo) {
      const { id: _ignorado, ...resto } = alvo;
      setForm(resto);
      setEditandoId(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregado]);

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
    navigate({ to: "/registros" });
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-5">
      <section className="grid grid-cols-2 gap-2 sm:gap-3">
        <Calculadora />
        <div className="space-y-2 sm:space-y-3">
          <Cronometro />
          <TaxaInfusao />
        </div>
      </section>

      <div className="mt-5">
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

      <div className="mt-8">
        <InstalarApp />
      </div>
    </main>
  );
}
