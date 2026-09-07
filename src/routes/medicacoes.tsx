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
import { DialogoMinistrar } from "@/components/medicamentos/DialogoMinistrar";
import { DialogoEscolherMedicamento } from "@/components/medicamentos/DialogoEscolherMedicamento";
import { CompletarInsercao } from "@/components/medicamentos/CompletarInsercao";
import { useMedicamentos } from "@/hooks/useMedicamentos";
import { normalizarNomeMedicamento } from "@/lib/nomes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

import {
  calcularFaixaDose,
  doseDaEspecie,
  especieBloqueada,
  faixaDe,
  numero,
  textoQuantidade,
  NOME_ESPECIE,
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
  const [avulsa, setAvulsa] = useState<Medicamento | null>(null);
  const [ministrando, setMinistrando] = useState<Medicamento | null>(null);
  const [aplicacao, setAplicacao] = useState<AplicacaoPendente | null>(null);

  const [menuAberto, setMenuAberto] = useState(false);
  const [escolhaAberta, setEscolhaAberta] = useState(false);
  const [completarAberto, setCompletarAberto] = useState(false);

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
            onExcluir={() => remover(m.id)}
            onAvulsa={() => setAvulsa(m)}
            onMinistrar={() => setMinistrando(m)}
          />
        ))}

      </ul>

      {menuAberto && (
        <button
          type="button"
          aria-label="Fechar ações"
          onClick={() => setMenuAberto(false)}
          className="fixed inset-0 z-30 bg-background/40"
        />
      )}

      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
        {menuAberto &&
          (
            [
              { rotulo: "Adicionar medicamento", icone: "＋", acao: abrirNovo },
              {
                rotulo: "Atualizar medicamento",
                icone: "✎",
                acao: () => setEscolhaAberta(true),
              },
              {
                rotulo: "Completar inserção",
                icone: "✔",
                acao: () => setCompletarAberto(true),
              },
            ] as const
          ).map((o) => (
            <div key={o.rotulo} className="flex items-center gap-2">
              <span className="rounded-lg bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground shadow">
                {o.rotulo}
              </span>
              <button
                type="button"
                aria-label={o.rotulo}
                onClick={() => {
                  setMenuAberto(false);
                  o.acao();
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground shadow-lg hover:bg-primary/90"
              >
                {o.icone}
              </button>
            </div>
          ))}

        <button
          type="button"
          onClick={() => setMenuAberto((v) => !v)}
          aria-expanded={menuAberto}
          aria-label="Ações de medicamento"
          className={`flex h-14 w-14 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground shadow-lg transition-transform hover:bg-primary/90 ${
            menuAberto ? "rotate-45" : ""
          }`}
        >
          +
        </button>
      </div>

      <FormMedicamento
        aberto={formAberto}
        inicial={editando}
        onFechar={() => setFormAberto(false)}
        onSalvar={salvar}
        onExcluir={remover}
      />
      <DialogoEscolherMedicamento
        aberto={escolhaAberta}
        medicamentos={medicamentos}
        onFechar={() => setEscolhaAberta(false)}
        onEscolher={(m) => {
          setEscolhaAberta(false);
          abrirEdicao(m);
        }}
      />
      <CompletarInsercao
        aberto={completarAberto}
        medicamentos={medicamentos}
        onFechar={() => setCompletarAberto(false)}
        onSalvar={salvar}
      />
      <PesquisaAvulsa
        aberto={Boolean(avulsa)}
        medicamento={avulsa}
        especieInicial={especie}
        pesoInicial={formatarPeso(peso)}

        onFechar={() => setAvulsa(null)}
      />
      <DialogoMinistrar
        medicamento={ministrando}
        especie={especie}
        pesoInicial={formatarPeso(peso)}
        onFechar={() => setMinistrando(null)}
        onConfirmar={(a) => {
          setMinistrando(null);
          setAplicacao(a);
        }}
      />
      <DialogoAplicar aplicacao={aplicacao} onFechar={() => setAplicacao(null)} />

    </div>
  );
}

type CardProps = {
  medicamento: Medicamento;
  peso: string;
  especie: Especie;
  onEditar: () => void;
  onExcluir: () => void;
  onAvulsa: () => void;
  onMinistrar: () => void;
};

function CardMedicamento({
  medicamento: m,
  peso,
  especie,
  onEditar,
  onExcluir,
  onAvulsa,
  onMinistrar,
}: CardProps) {
  const [confirmando, setConfirmando] = useState(false);
  const dose = doseDaEspecie(m, especie);
  const faixa = faixaDe(dose);
  const bloqueado = especieBloqueada(m, especie);
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
  const podeAplicar = !bloqueado && resultado.ok && Boolean(resultado.volumeTexto);

  const forma = resultado.ok ? (resultado.forma ?? "mL") : "mL";
  const volMin = resultado.ok ? resultado.volMin : null;
  const volMax = resultado.ok ? resultado.volMax : null;
  const dMin = numero(faixa.min);
  const dMax = numero(faixa.max);
  // Dose padrão cadastrada; sem ela, média entre mínima e máxima.
  const dPadrao = doseEfetiva(dose);
  // O volume é linear na dose: projeta a partir da mínima calculada.
  const volPadrao =
    volMin !== null && dMin !== null && dMin > 0 && dPadrao !== null
      ? volMin * (dPadrao / dMin)
      : volMin !== null && volMax !== null
        ? (volMin + volMax) / 2
        : (volMax ?? volMin);

  const textoDose = (v: number | null) =>
    v === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${faixa.unidade}`;

  const doseBase = dose.dosePadrao?.trim()
    ? `${dose.dosePadrao.trim()} ${faixa.unidade}`
    : referenciaDose(dose);

  const unidadeDose = resultado.ok ? (resultado.unidade ?? forma) : forma;

  return (
    <li className="rounded-2xl border border-border bg-card/60 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 leading-tight">
          {m.nomeMenor?.trim() && (
            <p className="text-[11px] font-medium text-muted-foreground">
              {normalizarNomeMedicamento(m.nomeMenor)}
            </p>
          )}
          <p className="text-lg font-bold tracking-tight text-foreground">
            {normalizarNomeMedicamento(m.nome)}
          </p>
          <p className="text-xs font-semibold text-muted-foreground">{concentracao || "—"}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Ações de ${m.nome}`}
              className="-mr-1 shrink-0 rounded-lg px-2 py-1 text-lg leading-none text-muted-foreground hover:bg-secondary/70"
            >
              ⋯
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEditar}>✏️ Editar medicação</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setConfirmando(true)}>
              🗑️ Excluir medicação
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex gap-3">
        {/* Coluna esquerda: indicação, intervalo, dose base, via */}
        <div className="min-w-0 flex-1 space-y-2 text-xs">
          <div>
            <p className="font-semibold text-muted-foreground">Indicação</p>
            <p className="text-foreground">{m.resumo?.trim() || "—"}</p>
          </div>
          <p className="flex items-center gap-1.5 font-semibold text-foreground">
            <span aria-hidden="true">🕐</span> {frequencia || "—"}
          </p>
          <div>
            <p className="font-semibold text-muted-foreground">Dose base</p>
            <p className="font-semibold text-foreground">{doseBase || "—"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-muted-foreground">Via</span>
            {vias.length === 0 ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              vias.map((v) => (
                <span
                  key={v}
                  className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground"
                >
                  {v}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Coluna direita: caixas Dose / Mín. / Máx. */}
        <div className="w-[47%] shrink-0">
          {bloqueado ? (
            <p className="text-xs font-semibold text-destructive">
              Não pode ser ministrado em {NOME_ESPECIE[especie]}
            </p>
          ) : (
            <div className="grid grid-cols-[1.25fr_1fr_1fr] gap-1.5 text-center">
              <div className="rounded-xl bg-secondary/60 px-1.5 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Dose ({unidadeDose})
                </p>
                <p className="text-2xl font-bold leading-tight text-foreground">
                  {volPadrao !== null ? textoQuantidade(volPadrao, forma) : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {dPadrao !== null && volPadrao !== null
                    ? `(${textoDose(dPadrao)})`
                    : "Não definida"}
                </p>
              </div>
              <div className="rounded-xl bg-secondary/60 px-1 py-2">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Mín.</p>
                <p className="text-sm font-bold text-foreground">
                  {volMin !== null ? textoQuantidade(volMin, forma) : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {dMin !== null ? `(${textoDose(dMin)})` : "Não informada"}
                </p>
              </div>
              <div className="rounded-xl bg-secondary/60 px-1 py-2">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Máx.</p>
                <p className="text-sm font-bold text-foreground">
                  {volMax !== null
                    ? textoQuantidade(volMax, forma)
                    : volMin !== null
                      ? textoQuantidade(volMin, forma)
                      : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {dMax !== null && dMin !== null && dMax > dMin
                    ? `(${textoDose(dMax)})`
                    : dMin !== null
                      ? `(${textoDose(dMin)})`
                      : "Não informada"}
                </p>
              </div>
            </div>
          )}
          {!bloqueado && !resultado.ok && (
            <p className="mt-1 text-[11px] text-muted-foreground">{resultado.motivo}</p>
          )}
          {!bloqueado && resultado.ok && !resultado.volumeTexto && (
            <p className="mt-1 text-[11px] text-muted-foreground">{resultado.motivoVolume}</p>
          )}
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onMinistrar}
          disabled={!podeAplicar}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:cursor-default disabled:bg-secondary/50 disabled:text-muted-foreground"
        >
          <IconeVia via={vias[0] ?? ""} className="h-4 w-4" />
          Ministrar
          {podeAplicar && volPadrao !== null ? ` ${textoQuantidade(volPadrao, forma)}` : ""}
          {podeAplicar && resultado.ok ? (
            <span className="text-xs font-semibold">{resultado.unidade}</span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={onAvulsa}
          className="shrink-0 rounded-xl border-2 border-primary bg-transparent px-3 py-2 text-xs font-bold text-foreground hover:bg-primary/5"
        >
          🧮 Consulta avulsa
        </button>
      </div>

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta medicação?</AlertDialogTitle>
            <AlertDialogDescription>
              {normalizarNomeMedicamento(m.nome)} sairá da lista de medicações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onExcluir}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}


