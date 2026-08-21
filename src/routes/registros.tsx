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
import { useCurvas } from "@/hooks/useCurvas";
import { chaveDoAnimal } from "@/lib/curva";
import { limparAlarmesDeCurva } from "@/hooks/useAlarmes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const { plantao, limparPlantao } = usePlantaoAtual();
  const { curvas, setCurvas } = useCurvas();
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [letraAtiva, setLetraAtiva] = useState<string | null>(null);
  const [obitoAlvo, setObitoAlvo] = useState<Registro | null>(null);
  const [obitoHora, setObitoHora] = useState("");
  const [obitoMotivo, setObitoMotivo] = useState("");

  const horaAgora = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const abrirObito = (r: Registro) => {
    if (r.obito) {
      if (!window.confirm(`Desfazer o registro de óbito de ${r.animal.trim()}?`)) return;
      setRegistros((rs) =>
        rs.map((x) => {
          if (x.id !== r.id) return x;
          const { obito: _removido, ...resto } = x;
          return resto as Registro;
        }),
      );
      toast.success("Registro de óbito desfeito.");
      return;
    }
    setObitoHora(horaAgora());
    setObitoMotivo("");
    setObitoAlvo(r);
  };

  const confirmarObito = () => {
    if (!obitoAlvo) return;
    const hora = obitoHora.trim() || horaAgora();
    const motivo = obitoMotivo.trim();
    setRegistros((rs) =>
      rs.map((x) => (x.id === obitoAlvo.id ? { ...x, obito: { hora, motivo } } : x)),
    );
    setObitoAlvo(null);
    toast.success("Óbito registrado na ficha.");
  };

  const ordenados = [...registros].sort((a, b) =>
    normalizar(a.animal).localeCompare(normalizar(b.animal), "pt-BR"),
  );
  const termo = normalizar(busca);
  const visiveis = termo
    ? ordenados.filter((r) => normalizar(r.animal).includes(termo))
    : ordenados;

  const inicialDe = (nome: string) => {
    const c = normalizar(nome).charAt(0).toUpperCase();
    return /[A-Z]/.test(c) ? c : "#";
  };
  const letras = Array.from(new Set(visiveis.map((r) => inicialDe(r.animal)))).sort((a, b) =>
    a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b, "pt-BR"),
  );

  const irParaLetra = (letra: string) => {
    if (letra === letraAtiva) {
      setLetraAtiva(null);
      return;
    }
    setLetraAtiva(letra);
    const alvo = visiveis.find((r) => inicialDe(r.animal) === letra);
    if (alvo) {
      document
        .getElementById(`animal-${alvo.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const finalizarPlantao = () => {
    if (registros.length === 0) {
      toast.info("Não há animais para finalizar o plantão.");
      return;
    }
    if (!window.confirm("Finalizar o plantão e guardar estes animais no histórico?")) return;
    const novo: Plantao = {
      id: crypto.randomUUID(),
      data: plantao?.dia ?? diaDeHoje(),
      turno: plantao?.turno ?? "",
      registros,
      // Guarda a foto das curvas destes animais para o PDF deste plantão.
      curvas: curvas.filter((c) =>
        registros.some((r) => chaveDoAnimal(r.animal, r.especie) === c.chave),
      ),
      criadoEm: new Date().toISOString(),
    };
    setPlantoes((ps) => [novo, ...ps]);
    setRegistros([]);
    // As curvas valem até o fim do plantão: encerra e desliga os alarmes delas.
    setCurvas((lista) => lista.map((c) => (c.ativa ? { ...c, ativa: false } : c)));
    limparAlarmesDeCurva();
    // Encerrado o plantão, o app volta a perguntar o turno na próxima abertura.
    limparPlantao();
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
          onObito={abrirObito}
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
        )}
      </div>

      <AlertDialog open={Boolean(obitoAlvo)} onOpenChange={(o) => !o && setObitoAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar óbito</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmar que <strong>{obitoAlvo?.animal.trim()}</strong> foi a óbito? Informe a hora
              e o motivo para constar na ficha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Hora do óbito</span>
              <input
                value={obitoHora}
                onChange={(e) => setObitoHora(e.target.value)}
                placeholder="14h30"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:border-ring"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Motivo</span>
              <textarea
                value={obitoMotivo}
                onChange={(e) => setObitoMotivo(e.target.value)}
                rows={3}
                placeholder="Parada cardiorrespiratória"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
              />
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarObito}>Confirmar óbito</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {registros.length > 0 && (
        <section className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-foreground">Texto exportado</h2>
            <button
              type="button"
              onClick={() => copiarTexto(formatarTodos(registros))}
              className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
            >
              Copiar
            </button>
          </div>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-secondary p-3 font-sans text-sm leading-relaxed text-foreground">
            {formatarTodos(registros)}
          </pre>
        </section>
      )}
    </main>
  );
}
