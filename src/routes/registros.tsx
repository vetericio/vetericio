import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ListaRegistros } from "@/components/ListaRegistros";
import { useRegistros } from "@/hooks/useRegistros";
import { usePlantoes } from "@/hooks/usePlantoes";
import { usePlantaoAtual } from "@/hooks/usePlantaoAtual";
import {
  formatarRegistro,
  formatarTodos,
  type Plantao,
  type Registro,
} from "@/lib/ficha";
import { diaDeHoje } from "@/lib/plantao";
import { exportarPdf } from "@/lib/pdf";

export const Route = createFileRoute("/registros")({
  head: () => ({
    meta: [
      { title: "Animais registrados — Veterício" },
      {
        name: "description",
        content:
          "Lista dos animais avaliados na internação, com edição, exclusão, cópia, exportação em PDF e fechamento de plantão.",
      },
      { property: "og:title", content: "Animais registrados — Veterício" },
      {
        property: "og:description",
        content: "Consulte, edite, copie e exporte as avaliações de internação registradas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Registros,
});

function normalizar(texto: string) {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function Registros() {
  const { registros, setRegistros, carregado } = useRegistros();
  const { setPlantoes } = usePlantoes();
  const { plantao } = usePlantaoAtual();
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");

  const ordenados = [...registros].sort((a, b) =>
    normalizar(a.animal).localeCompare(normalizar(b.animal), "pt-BR"),
  );
  const termo = normalizar(busca);
  const visiveis = termo
    ? ordenados.filter((r) => normalizar(r.animal).includes(termo))
    : ordenados;

  const finalizarPlantao = () => {
    if (registros.length === 0) {
      toast.info("Não há animais para finalizar o plantão.");
      return;
    }
    if (!window.confirm("Finalizar o plantão e guardar estes animais no histórico?")) return;
    const novo: Plantao = {
      id: crypto.randomUUID(),
      data: diaDeHoje(),
      turno: plantao?.turno ?? "",
      registros,
      criadoEm: new Date().toISOString(),
    };
    setPlantoes((ps) => [novo, ...ps]);
    setRegistros([]);
    toast.success("Plantão finalizado.");
    navigate({ to: "/plantoes" });
  };


  const apagarTudo = () => {
    if (registros.length === 0) {
      toast.info("Não há registros salvos.");
      return;
    }
    if (window.confirm("Apagar todos os registros salvos neste aparelho?")) {
      setRegistros([]);
      toast.success("Todos os registros foram apagados.");
    }
  };

  const copiarTexto = async (texto: string) => {
    // Quebra de linha CRLF: reconhecida por WhatsApp, Notas e outros apps.
    const normalizado = texto.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
    try {
      await navigator.clipboard.writeText(normalizado);
      toast.success("Texto copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };


  const exportar = async () => {
    try {
      await exportarPdf(registros);
      toast.success("PDF gerado.");
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    }
  };




  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
      <h2 className="font-display text-lg font-semibold text-foreground">
        Animais registrados{carregado ? ` (${registros.length})` : ""}
      </h2>

      <div className="mt-3 flex flex-wrap gap-2">
        {registros.length > 0 && (
          <button
            type="button"
            onClick={exportar}
            className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Exportar PDF
          </button>
        )}
        {registros.length > 0 && (
          <button
            type="button"
            onClick={finalizarPlantao}
            className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
          >
            Finalizar plantão
          </button>
        )}
        <button
          type="button"
          onClick={apagarTudo}
          className="rounded-xl bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
        >
          Limpar todos os dados
        </button>
      </div>

      {registros.length > 0 && (
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Procurar animal pelo nome"
          className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      )}

      <div className="mt-4">
        {registros.length > 0 && visiveis.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum animal encontrado com esse nome.
          </p>
        ) : (
        <ListaRegistros
          registros={visiveis}
          onCopiar={(r: Registro) => copiarTexto(formatarRegistro(r))}
          onEditar={(r) => {
            window.localStorage.setItem("veterico-editar-id", r.id);
            navigate({ to: "/" });
          }}
          onAtualizar={(r) => {
            window.localStorage.setItem("veterico-atualizar-id", r.id);
            navigate({ to: "/" });
          }}
          onExcluir={(id) => {
            const alvo = registros.find((r) => r.id === id);
            if (!window.confirm(`Excluir o registro de ${alvo?.animal.trim() || "sem nome"}?`))
              return;
            setRegistros((rs) => rs.filter((x) => x.id !== id));
            toast.success("Registro excluído.");
          }}
        />
      </div>

      {registros.length > 0 && (
        <section className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="font-display text-base font-semibold text-foreground">Texto exportado</h2>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-secondary p-3 font-sans text-sm leading-relaxed text-foreground">
            {formatarTodos(registros)}
          </pre>
        </section>
      )}
    </main>
  );
}
