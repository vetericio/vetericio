import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FormMedicamento } from "@/components/medicamentos/FormMedicamento";
import { PesquisaAvulsa } from "@/components/medicamentos/PesquisaAvulsa";
import { SeletorEspecie } from "@/components/medicamentos/SeletorEspecie";
import { useMedicamentos } from "@/hooks/useMedicamentos";
import {
  calcularFaixaDose,
  doseDaEspecie,
  ordenarMedicamentos,
  viasDe,
  type Especie,
  type Medicamento,
} from "@/lib/medicamentos";

export const Route = createFileRoute("/medicacoes")({
  head: () => ({
    meta: [
      { title: "Medicações — Veterício" },
      {
        name: "description",
        content:
          "Calculadora de doses veterinárias: peso fixo no topo, busca por medicação e volume a aplicar calculado para cão e gato.",
      },
      { property: "og:title", content: "Medicações — Veterício" },
      {
        property: "og:description",
        content:
          "Informe o peso uma única vez e veja a dose e o volume a aplicar de todos os medicamentos cadastrados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaMedicacoes,
});

const campo =
  "w-full rounded-xl border border-input bg-background px-3 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring";

/** Digitação estilo centavos: guarda só dígitos (3 casas decimais). 3600 → "3600" (3,600 kg). */
function lerDigitosPeso(texto: string): string {
  return texto.replace(/\D/g, "").slice(0, 6);
}

function formatarPeso(digitos: string): string {
  if (!digitos) return "";
  const n = Number(digitos) / 1000;
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function PaginaMedicacoes() {
  const { medicamentos, salvar, remover, carregado } = useMedicamentos();
  const [busca, setBusca] = useState("");
  const [peso, setPeso] = useState("");
  const [especie, setEspecie] = useState<Especie>("cao");
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Medicamento | null>(null);
  const [avulsaAberta, setAvulsaAberta] = useState(false);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const ordenada = ordenarMedicamentos(medicamentos);
    if (!termo) return ordenada;
    return ordenada.filter((m) => m.nome.toLowerCase().includes(termo));
  }, [medicamentos, busca]);

  const abrirNovo = () => {
    setEditando(null);
    setFormAberto(true);
  };

  const abrirEdicao = (m: Medicamento) => {
    setEditando(m);
    setFormAberto(true);
  };

  return (
    <div className="relative mx-auto w-full max-w-2xl px-4 pb-24">
      {/* Peso e espécie: pertencem ao animal, não ao cadastro do medicamento. */}
      <section className="sticky top-0 z-30 -mx-4 border-b border-border bg-background/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-end gap-2">
          <div className="w-32 shrink-0">
            <label
              className="block text-xs font-bold uppercase tracking-wide text-muted-foreground"
              htmlFor="peso-topo"
            >
              Peso
            </label>
            <div className="relative mt-1">
              <input
                id="peso-topo"
                value={formatarPeso(peso)}
                onChange={(e) => setPeso(lerDigitosPeso(e.target.value))}
                inputMode="numeric"
                placeholder="0,000"
                className={`${campo} pr-9 text-xl font-bold`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                kg
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <SeletorEspecie valor={especie} onChange={setEspecie} compacto />
          </div>
        </div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="🔎 Buscar medicação..."
          className={`${campo} mt-2`}
        />
      </section>

      <ul className="mt-3 space-y-2">
        {carregado && lista.length === 0 && (
          <li className="rounded-xl bg-secondary/60 px-3 py-4 text-sm text-muted-foreground">
            Nenhuma medicação encontrada. Toque no + para cadastrar.
          </li>
        )}
        {lista.map((m) => (
          <CardMedicamento
            key={m.id}
            medicamento={m}
            peso={peso}
            especie={especie}
            onEditar={() => abrirEdicao(m)}
            onAvulsa={() => setAvulsaAberta(true)}
          />
        ))}
      </ul>

      <button
        type="button"
        onClick={abrirNovo}
        aria-label="Inserir novo medicamento"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground shadow-lg hover:bg-primary/90"
      >
        +
      </button>

      <FormMedicamento
        aberto={formAberto}
        inicial={editando}
        onFechar={() => setFormAberto(false)}
        onSalvar={salvar}
        onExcluir={remover}
      />
      <PesquisaAvulsa aberto={avulsaAberta} onFechar={() => setAvulsaAberta(false)} />
    </div>
  );
}

type CardProps = {
  medicamento: Medicamento;
  peso: string;
  especie: Especie;
  onEditar: () => void;
  onAvulsa: () => void;
};

function CardMedicamento({ medicamento: m, peso, especie, onEditar, onAvulsa }: CardProps) {
  const dose = doseDaEspecie(m, especie);
  const resultado = calcularFaixaDose({
    peso,
    dose,
    concentracaoValor: m.concentracaoValor,
    concentracaoUnidade: m.concentracaoUnidade,
  });

  const cabecalho = [
    viasDe(m).join("/"),
    m.concentracaoValor ? `${m.concentracaoValor} ${m.concentracaoUnidade}` : "",
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <li className="rounded-2xl border border-border bg-card/60 p-3">
      <button type="button" onClick={onEditar} className="block w-full text-left">
        <span className="block text-base font-bold uppercase leading-tight text-foreground">
          {m.nome}
        </span>
        {cabecalho && (
          <span className="mt-0.5 block text-xs text-muted-foreground">{cabecalho}</span>
        )}
      </button>

      <div className="mt-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Dose</p>
        {resultado.ok ? (
          <>
            <p className="text-lg font-bold leading-tight text-foreground">{resultado.doseTexto}</p>
            {resultado.referencia && (
              <p className="text-xs text-muted-foreground">{resultado.referencia}</p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{resultado.motivo}</p>
        )}
        {dose.intervalo && (
          <p className="mt-0.5 text-xs text-muted-foreground">a cada {dose.intervalo} horas</p>
        )}
      </div>

      <div className="mt-2 rounded-xl border-2 border-primary bg-primary/10 px-3 py-2 text-center">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Quantidade a aplicar
        </p>
        {resultado.ok && resultado.volumeTexto ? (
          <p className="text-4xl font-bold leading-none text-foreground">
            {resultado.volumeTexto}
            <span className="ml-1 text-lg font-semibold">{resultado.unidade}</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {resultado.ok ? resultado.motivoVolume : resultado.motivo}
          </p>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onEditar}
          className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={onAvulsa}
          className="rounded-lg bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-background/70"
        >
          Pesquisa avulsa
        </button>
      </div>
    </li>
  );
}
