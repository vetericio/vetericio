import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormMedicamento } from "@/components/medicamentos/FormMedicamento";
import { CalculadoraDose } from "@/components/medicamentos/CalculadoraDose";
import { PesquisaAvulsa } from "@/components/medicamentos/PesquisaAvulsa";
import { SeletorEspecie } from "@/components/medicamentos/SeletorEspecie";
import { useMedicamentos } from "@/hooks/useMedicamentos";
import {
  calcularDose,
  doseDaEspecie,
  ordenarMedicamentos,
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
          "Cadastro de medicamentos com dose separada para cão e gato, pesquisa por nome e calculadora de dose e volume por peso.",
      },
      { property: "og:title", content: "Medicações — Veterício" },
      {
        property: "og:description",
        content:
          "Cadastre medicamentos, guarde a dose de cão e gato e calcule o volume a aplicar pelo peso do animal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaMedicacoes,
});

const campo =
  "w-full rounded-xl border border-input bg-background px-3 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring";

function PaginaMedicacoes() {
  const { medicamentos, salvar, remover, carregado } = useMedicamentos();
  const [busca, setBusca] = useState("");
  const [peso, setPeso] = useState("");
  const [especie, setEspecie] = useState<Especie>("cao");
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Medicamento | null>(null);
  const [calculando, setCalculando] = useState<Medicamento | null>(null);
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
    <div className="relative mx-auto w-full max-w-2xl px-4 pb-24 pt-4">
      <h1 className="font-display text-xl font-semibold text-foreground">Medicações</h1>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Pesquisar medicação"
        className={`${campo} mt-3`}
      />

      {/* Calculadora do topo: um peso, uma espécie, todas as medicações. */}
      <section className="mt-3 rounded-2xl border border-border bg-card/60 p-3">
        <h2 className="text-sm font-semibold text-foreground">Calcular dose</h2>
        <label className="mt-2 block text-xs font-semibold text-muted-foreground" htmlFor="peso-topo">
          Peso do animal (kg)
        </label>
        <input
          id="peso-topo"
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
          inputMode="decimal"
          placeholder="0"
          className={`${campo} text-lg font-semibold`}
        />
        <div className="mt-2">
          <SeletorEspecie valor={especie} onChange={setEspecie} />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Com o peso preenchido, cada medicação abaixo mostra o volume a aplicar.
        </p>
      </section>

      <ul className="mt-3 space-y-2">
        {carregado && lista.length === 0 && (
          <li className="rounded-xl bg-secondary/60 px-3 py-4 text-sm text-muted-foreground">
            Nenhuma medicação encontrada. Toque no + para cadastrar.
          </li>
        )}
        {lista.map((m) => (
          <ItemMedicamento
            key={m.id}
            medicamento={m}
            peso={peso}
            especie={especie}
            onEditar={() => abrirEdicao(m)}
            onCalcular={() => setCalculando(m)}
            onAvulsa={() => setAvulsaAberta(true)}
            onExcluir={() => remover(m.id)}
          />
        ))}
      </ul>

      <button
        type="button"
        onClick={abrirNovo}
        aria-label="Inserir novo medicamento"
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground shadow-lg hover:bg-primary/90"
      >
        +
      </button>

      <FormMedicamento
        aberto={formAberto}
        inicial={editando}
        onFechar={() => setFormAberto(false)}
        onSalvar={salvar}
      />
      <CalculadoraDose medicamento={calculando} onFechar={() => setCalculando(null)} />
      <PesquisaAvulsa aberto={avulsaAberta} onFechar={() => setAvulsaAberta(false)} />
    </div>
  );
}

type ItemProps = {
  medicamento: Medicamento;
  peso: string;
  especie: Especie;
  onEditar: () => void;
  onCalcular: () => void;
  onAvulsa: () => void;
  onExcluir: () => void;
};

function ItemMedicamento({
  medicamento: m,
  peso,
  especie,
  onEditar,
  onCalcular,
  onAvulsa,
  onExcluir,
}: ItemProps) {
  const [menuAberto, setMenuAberto] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const iniciarToque = () => {
    timer.current = setTimeout(() => setMenuAberto(true), 500);
  };
  const cancelarToque = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const dose = doseDaEspecie(m, especie);
  const resultado = peso.trim()
    ? calcularDose({
        peso,
        dose: dose.dose,
        concentracaoValor: m.concentracaoValor,
        concentracaoUnidade: m.concentracaoUnidade,
      })
    : null;

  return (
    <li className="rounded-2xl border border-border bg-card/60 p-3">
      <DropdownMenu open={menuAberto} onOpenChange={setMenuAberto}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onPointerDown={iniciarToque}
            onPointerUp={cancelarToque}
            onPointerLeave={cancelarToque}
            onContextMenu={(e) => e.preventDefault()}
            className="w-full text-left"
          >
            <span className="block text-base font-bold uppercase leading-tight text-foreground">
              {m.nome}
            </span>
            {m.classificacao && (
              <span className="block text-[11px] italic text-muted-foreground">
                {m.classificacao}
              </span>
            )}
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Concentração:{" "}
              {m.concentracaoValor ? `${m.concentracaoValor} ${m.concentracaoUnidade}` : "—"}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={onEditar}>Editar medicamento</DropdownMenuItem>
          <DropdownMenuItem onSelect={onCalcular}>Calcular dose</DropdownMenuItem>
          <DropdownMenuItem onSelect={onAvulsa}>Pesquisa avulsa</DropdownMenuItem>
          <DropdownMenuItem onSelect={onExcluir} className="text-destructive">
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-secondary/60 px-2.5 py-1.5">
          <p className="text-xs font-semibold text-foreground">🐶 Cão</p>
          <p className="text-sm text-foreground">
            {m.cao.dose ? `${m.cao.dose} mg/kg` : "—"}
            {m.cao.intervalo ? ` — a cada ${m.cao.intervalo} horas` : ""}
          </p>
        </div>
        <div className="rounded-xl bg-primary/10 px-2.5 py-1.5">
          <p className="text-xs font-semibold text-foreground">🐱 Gato</p>
          <p className="text-sm text-foreground">
            {m.gato.dose ? `${m.gato.dose} mg/kg` : "—"}
            {m.gato.intervalo ? ` — a cada ${m.gato.intervalo} horas` : ""}
          </p>
        </div>
      </div>

      {resultado && (
        <div className="mt-2">
          {resultado.ok ? (
            <p className="rounded-xl border border-primary bg-primary/10 px-3 py-2 text-center text-lg font-bold text-foreground">
              💉 APLICAR: {resultado.volumeTexto} {resultado.unidade}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">{resultado.motivo}</p>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCalcular}
          className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
        >
          Calcular dose
        </button>
        <button
          type="button"
          onClick={onEditar}
          className="rounded-lg bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-background/70"
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
