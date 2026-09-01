import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FormMedicamento } from "@/components/medicamentos/FormMedicamento";
import { PesquisaAvulsa } from "@/components/medicamentos/PesquisaAvulsa";
import { SeletorEspecie } from "@/components/medicamentos/SeletorEspecie";
import { IconeVia, Vias } from "@/components/medicamentos/IconeVia";
import {
  DialogoAplicar,
  type AplicacaoPendente,
} from "@/components/medicamentos/DialogoAplicar";
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
  const [aplicacao, setAplicacao] = useState<AplicacaoPendente | null>(null);

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
            peso={formatarPeso(peso)}
            especie={especie}
            onEditar={() => abrirEdicao(m)}
            onAvulsa={() => setAvulsaAberta(true)}
            onAplicar={setAplicacao}
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
      <DialogoAplicar aplicacao={aplicacao} onFechar={() => setAplicacao(null)} />
    </div>
  );
}

type CardProps = {
  medicamento: Medicamento;
  peso: string;
  especie: Especie;
  onEditar: () => void;
  onAvulsa: () => void;
  onAplicar: (a: AplicacaoPendente) => void;
};

function CardMedicamento({ medicamento: m, peso, especie, onEditar, onAvulsa, onAplicar }: CardProps) {
  const [pendente, setPendente] = useState<QuantidadePendente | null>(null);
  const dose = doseDaEspecie(m, especie);
  const vias = viasDe(m);
  const resultado = calcularFaixaDose({
    peso,
    dose,
    concentracaoValor: m.concentracaoValor,
    concentracaoUnidade: m.concentracaoUnidade,
  });

  const concentracao = m.concentracaoValor
    ? `${m.concentracaoValor} ${m.concentracaoUnidade}`
    : "";
  const frequencia = dose.intervalo ? `${dose.intervalo}h` : "";
  const podeAplicar = resultado.ok && Boolean(resultado.volumeTexto);

  const ministrar = () => {
    if (!resultado.ok || !resultado.volumeTexto) return;
    setPendente({
      nome: m.nome,
      via: vias.join("/"),
      duracao: frequencia ? `a cada ${frequencia}` : "",
      resultado,
    });
  };

  const confirmarQuantidade = (quantidade: string) => {
    if (!pendente) return;
    const r = pendente.resultado;
    onAplicar({
      nome: pendente.nome,
      dose: `${r.doseTexto}${r.referencia ? ` (${r.referencia})` : ""}`,
      quantidade,
      via: pendente.via,
      duracao: pendente.duracao,
    });
    setPendente(null);
  };


  return (
    <li className="rounded-2xl border border-border bg-card/60 px-3 py-2.5">
      <p className="text-lg font-bold uppercase leading-tight tracking-tight text-foreground">
        {m.nome}
      </p>

      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate font-semibold">{concentracao || "—"}</span>
        <Vias vias={vias} />
        <span className="shrink-0 font-semibold">{frequencia || "—"}</span>
      </div>

      <div className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{resultado.ok ? resultado.referencia : resultado.motivo}</span>
        {resultado.ok && <span className="shrink-0">Dose {resultado.doseTexto}</span>}
      </div>

      <button
        type="button"
        onClick={ministrar}
        disabled={!podeAplicar}
        className="mt-2 block w-full rounded-xl border-2 border-primary bg-primary/10 px-3 py-2 text-center disabled:cursor-default disabled:border-border disabled:bg-secondary/50"
      >
        {podeAplicar && resultado.ok ? (
          <>
            <span className="flex items-center justify-center gap-1.5 text-2xl font-bold leading-none text-foreground">
              <IconeVia via={vias[0] ?? ""} className="h-5 w-5" />
              Ministrar {resultado.volumeTexto}
              <span className="text-base font-semibold">{resultado.unidade}</span>
            </span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {resultado.exatoTexto ? `exato ${resultado.exatoTexto} • ` : ""}toque para aplicar
            </span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            {resultado.ok ? resultado.motivoVolume : resultado.motivo}
          </span>
        )}
      </button>

      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onAvulsa}
          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-secondary/70"
        >
          Pesquisa avulsa
        </button>
        <button
          type="button"
          onClick={onEditar}
          className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
        >
          Editar
        </button>
      </div>
    </li>
  );
}

