import { Fragment, memo, useCallback, useRef, useState } from "react";
import {
  OPCOES,
  avaliarValor,
  comLinha,
  comVirgula,
  frasePorTermo,
  fraseAtualizacao,
  removerFraseDoParametro,
  resumoFaixas,
  ROTULOS_NUMERICOS,
  type ChaveNumerica,
  type Especie,
  type Registro,
  type ExameLaboratorial,
} from "@/lib/ficha";
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
import { Medicacoes as MedicacoesBase } from "@/components/Medicacoes";
import { DialogoAlerta } from "@/components/pendencias/DialogoAlerta";
import { useAnamneses } from "@/hooks/useAnamneses";
import { garantirItemERegistrar } from "@/hooks/usePendencias";
import { usePlantaoAtual } from "@/hooks/usePlantaoAtual";
import { emojiEspecie, sugerirAnamneses } from "@/lib/anamnese";
import { carregarRegras, regrasDisparadas, type RegraAlerta } from "@/lib/pendencias";
import { toast } from "sonner";

function alternarOpcaoLista(valor: string, opcao: string): string {
  const selecionadas = valor.split(" · ").filter(Boolean);
  return selecionadas.includes(opcao)
    ? selecionadas.filter((item) => item !== opcao).join(" · ")
    : [...selecionadas, opcao].join(" · ");
}

function formatarPesoKgDigitado(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 7);
  if (!digitos) return "";
  const limitado = String(Math.min(Number(digitos), 1000000));
  const preenchido = limitado.padStart(4, "0");
  const inteiros = preenchido.slice(0, -3).replace(/^0+(?=\d)/, "") || "0";
  return `${inteiros},${preenchido.slice(-3)}`;
}


type Props = {
  valores: Omit<Registro, "id">;
  onChange: (valores: Omit<Registro, "id">) => void;
  onEnviar: () => void;
  editando: boolean;
  onCancelar: () => void;
  /** Avaliação anterior mostrada apenas para leitura (modo "atualizar informações"). */
  anterior?: Registro | null;
  /** "Fazer curva?" ao lado da glicemia. */
  fazerCurva?: boolean;
  onFazerCurva?: (valor: boolean) => void;
  /** IDs das anamneses que já foram adicionadas à internação. */
  anamnesesJaAdicionadas?: string[];
};

// A lista de medicações só é redesenhada quando ela mesma (ou espécie/peso) muda.
const Medicacoes = memo(MedicacoesBase);

const NUMERICOS: { chave: ChaveNumerica; rotulo: string; unidade: string }[] = [
  { chave: "temperatura", rotulo: "Temperatura", unidade: "°C" },
  { chave: "fc", rotulo: "Frequência cardíaca (FC)", unidade: "bpm" },
  { chave: "fr", rotulo: "Frequência respiratória (FR)", unidade: "mpm" },
  { chave: "pas", rotulo: "PAS", unidade: "mmHg" },
  { chave: "glicemia", rotulo: "Glicemia", unidade: "mg/dL" },
];

const GRUPOS: { chave: keyof typeof OPCOES; rotulo: string }[] = [
  { chave: "alimentacao", rotulo: "Alimentação" },
  { chave: "comportamento", rotulo: "Comportamento" },
  { chave: "nivelConsciencia", rotulo: "Nível de consciência" },
  { chave: "mucosas", rotulo: "Mucosas" },
  { chave: "fezes", rotulo: "Fezes" },
  { chave: "urina", rotulo: "Urina" },
  { chave: "vomito", rotulo: "Vômito" },
  { chave: "salivacao", rotulo: "Salivação" },
];

/** Acrescenta a frase automática nas observações, sem repetir e sem apagar nada. */
function comFraseAutomatica(observacoes: string, termo: string): string {
  if (!termo) return observacoes;
  const frase = frasePorTermo(termo);
  const jaRegistrado = observacoes
    .split("\n")
    .some((l) => l.trim().startsWith("Animal com ") && l.includes(` ${termo} em `));
  if (jaRegistrado) return observacoes;
  return observacoes.trim() ? `${observacoes.replace(/\s+$/, "")}\n${frase}` : frase;
}

export function FormAvaliacao({
  valores,
  onChange,
  onEnviar,
  editando,
  onCancelar,
  anterior,
  fazerCurva = false,
  onFazerCurva,
  anamnesesJaAdicionadas = [],
}: Props) {
  const iniciais = useRef(valores);
  // Callback estável para as medicações: evita redesenhar a lista a cada tecla.
  const valoresRef = useRef(valores);
  valoresRef.current = valores;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const mudarMedicacoes = useCallback(
    (medicacoes: NonNullable<Registro["medicacoes"]>) =>
      onChangeRef.current({ ...valoresRef.current, medicacoes }),
    [],
  );
  const [perguntados, setPerguntados] = useState<ChaveNumerica[]>([]);
  const [pendente, setPendente] = useState<ChaveNumerica | null>(null);
  // Fila de perguntas: se um valor dispara mais de uma regra, aparecem em sequência.
  const [fila, setFila] = useState<RegraAlerta[]>([]);
  const [alertados, setAlertados] = useState<string[]>([]);
  const [outroAberto, setOutroAberto] = useState(false);
  const [especieAberto, setEspecieAberto] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);
  const { anamneses } = useAnamneses();
  const { plantao, carregado: plantaoCarregado } = usePlantaoAtual();
  // Adicionar paciente só com plantão ativo.
  const semPlantao = plantaoCarregado && !plantao;
  const sugestoes =
    sugerindo && !anterior && !editando ? sugerirAnamneses(anamneses, valores.animal) : [];


  const set = (chave: keyof Omit<Registro, "id">, valor: string) =>
    onChange({ ...valores, [chave]: valor });

  const setNumero = (chave: ChaveNumerica, valor: string) => {
    // Valor novo no campo: pode perguntar de novo sobre ele.
    setAlertados((a) => a.filter((k) => !k.startsWith(`${chave}:`)));
    // Em modo edição, as observações só mudam depois da pergunta (substituir/acrescentar).
    if (editando) {
      onChange({ ...valores, [chave]: valor });
      return;
    }
    const { fora, termo } = avaliarValor(chave, valor, valores.especie);
    const limpas = removerFraseDoParametro(valores.observacoes, chave);
    let observacoes = limpas;
    if (chave === "glicemia" || chave === "pas") {
      observacoes = fora ? comFraseAutomatica(limpas, termo) : limpas;
    } else if (chave === "temperatura") {
      const n = Number(valor.replace(",", "."));
      if (Number.isFinite(n) && (n < 37 || n > 40)) {
        observacoes = comFraseAutomatica(limpas, n < 37 ? "hipotermia" : "hipertermia");
      }
    }
    onChange({ ...valores, [chave]: valor, observacoes });
  };

  const aoSairDoCampo = (chave: ChaveNumerica) => {
    verificarAlerta(chave);
    if (!editando) return;
    if (perguntados.includes(chave)) return;
    const antes = (iniciais.current[chave] ?? "").trim();
    const agora = (valores[chave] ?? "").trim();
    if (!agora || antes === agora) return;
    setPendente(chave);
  };

  /** Regras cadastradas pelo usuário: abrem o quadro de confirmação, uma vez por valor. */
  const verificarAlerta = (chave: ChaveNumerica) => {
    const disparadas = regrasDisparadas(chave, valores[chave] ?? "", carregarRegras()).filter(
      (r) => !alertados.includes(`${chave}:${r.id}`),
    );
    if (disparadas.length === 0) return;
    setAlertados((a) => [...a, ...disparadas.map((r) => `${chave}:${r.id}`)]);
    setFila((f) => [...f, ...disparadas]);
  };

  const proximaPergunta = () => setFila((f) => f.slice(1));

  const confirmarAlerta = (regra: RegraAlerta) => {
    garantirItemERegistrar({
      animalNome: valores.animal,
      especie: valores.especie ?? "",
      categoria: regra.itemCategoria,
      nome: regra.itemNome,
    });
    proximaPergunta();
    toast.success(`${regra.itemNome} registrado em Pendências.`);
  };

  const responder = (substituir: boolean) => {
    const chave = pendente;
    if (!chave) return;
    const valor = valores[chave];
    if (substituir) {
      const { fora, termo } = avaliarValor(chave, valor, valores.especie);
      const limpas = removerFraseDoParametro(valores.observacoes, chave);
      onChange({
        ...valores,
        observacoes: fora ? comFraseAutomatica(limpas, termo) : limpas,
      });
    } else {
      onChange({
        ...valores,
        observacoes: comLinha(valores.observacoes, fraseAtualizacao(chave, valor)),
      });
    }
    setPerguntados((p) => [...p, chave]);
    setPendente(null);
  };

  const faixas = resumoFaixas(valores.especie);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      {anterior && (
        <div className="mb-4 rounded-xl border border-border bg-secondary/50 p-3">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Informação anterior (somente leitura)
          </p>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-foreground sm:grid-cols-3">
            {NUMERICOS.filter(({ chave }) => (anterior[chave] ?? "").trim()).map(({ chave }) => (
              <p key={chave}>
                <span className="text-muted-foreground">{ROTULOS_NUMERICOS[chave].rotulo}: </span>
                <span className="font-semibold tabular-nums">{comVirgula(anterior[chave])}</span>
              </p>
            ))}
            {GRUPOS.filter(({ chave }) => (anterior[chave] ?? "").trim()).map(
              ({ chave, rotulo }) => (
                <p key={chave}>
                  <span className="text-muted-foreground">{rotulo}: </span>
                  <span className="font-semibold">{anterior[chave]}</span>
                </p>
              ),
            )}
            {([
              ["Saturação de oxigênio (SpO₂)", anterior.spo2, "%"],
              ["Tempo de preenchimento capilar (TPC)", anterior.tpc, "s"],
              ["Escala de dor", anterior.dor, ""],
              ["Características das fezes", anterior.fezesCaracteristica, ""],
              ["Observações urinárias", anterior.urinaObservacoes, ""],
              ["Características do vômito", anterior.vomitoCaracteristica, ""],
              ["Salivação", anterior.salivacao, ""],
            ] as [string, string | undefined, string][]).filter(([, valor]) => (valor ?? "").trim()).map(([rotulo, valor, unidade]) => (
              <p key={rotulo}><span className="text-muted-foreground">{rotulo}: </span><span className="font-semibold">{valor}{unidade ? ` ${unidade}` : ""}</span></p>
            ))}
          </div>
          {anterior.observacoes.trim() && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {anterior.observacoes.trim()}
            </p>
          )}
        </div>
      )}

      <div className="block">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Animal
        </span>
        <input
          value={valores.animal}
          onChange={(e) => {
            onChange({ ...valores, animal: e.target.value, anamneseId: "" });
            setSugerindo(true);
          }}
          onFocus={() => setSugerindo(true)}
          placeholder="Nome do animal"
          readOnly={Boolean(anterior)}
          autoComplete="off"
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-lg font-semibold text-foreground outline-none focus:border-ring"
        />
        {sugestoes.length > 0 && (
          <ul className="mt-1.5 overflow-hidden rounded-lg border border-border bg-card">
            {sugestoes.map((a) => {
              const jaAdicionado = anamnesesJaAdicionadas.includes(a.id);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    disabled={jaAdicionado}
                    onClick={() => {
                      if (jaAdicionado) return;
                      onChange({
                        ...valores,
                        animal: a.animal.trim(),
                        especie: a.especie || valores.especie || "",
                        peso: a.peso || valores.peso || "",
                        anamneseId: a.id,
                      });
                      setSugerindo(false);
                    }}
                    className={[
                      "flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm",
                      jaAdicionado
                        ? "cursor-not-allowed bg-muted/60 text-muted-foreground opacity-60"
                        : "hover:bg-secondary/60",
                    ].join(" ")}
                  >
                    <span className={jaAdicionado ? "font-semibold text-muted-foreground" : "font-semibold text-foreground"}>
                      {emojiEspecie(a.especie)} {a.animal.trim()}
                      {jaAdicionado && <span className="ml-1 font-normal">(já adicionado)</span>}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {a.queixa.trim() || "anamnese"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Tutor
          </span>
          <input
            value={valores.tutor ?? ""}
            onChange={(e) => set("tutor", e.target.value)}
            placeholder="Nome do tutor"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
          />
        </label>
        <label className="block">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Baia
          </span>
          <input
            value={valores.baia ?? ""}
            onChange={(e) => set("baia", e.target.value)}
            placeholder="Ex.: Baia 2"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
          />
        </label>
      </div>


      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <div className="relative min-w-0">
          <label className="block text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Espécie
          </label>
          {(() => {
            const ehOutraEspecie = Boolean(valores.especie) && valores.especie !== "Cachorro" && valores.especie !== "Gato";
            const rotuloEspecie = !valores.especie
              ? "Selecione a espécie"
              : ehOutraEspecie && valores.especie !== "Outro"
                ? `Outro — ${valores.especie}`
                : valores.especie;
            return (
              <>
                <button type="button" aria-label="Selecionar espécie" aria-expanded={especieAberto} onClick={() => setEspecieAberto((aberto) => !aberto)} className="mt-1 flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-input bg-background px-3 text-left text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20">
                  <span>{rotuloEspecie}</span><span aria-hidden="true">▾</span>
                </button>
                {especieAberto && <div className="absolute z-20 mt-1 w-full rounded-xl border border-border bg-card p-2 shadow-lg">
                  {(["Cachorro", "Gato", "Outro"] as const).map((esp) => <button key={esp} type="button" onClick={() => { onChange({ ...valores, especie: esp }); setEspecieAberto(false); }} className={["min-h-10 w-full rounded-lg px-3 text-left text-sm", (esp === "Outro" ? ehOutraEspecie : valores.especie === esp) ? "bg-primary font-semibold text-primary-foreground" : "text-foreground hover:bg-secondary"].join(" ")}>{esp}</button>)}
                </div>}
                {ehOutraEspecie && <input aria-label="Especifique a espécie" autoFocus={valores.especie === "Outro"} value={valores.especie === "Outro" ? "" : valores.especie} onChange={(e) => onChange({ ...valores, especie: e.target.value || "Outro" })} placeholder="Qual espécie?" className="mt-2 min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" />}
              </>
            );
          })()}
        </div>

        <div className="shrink-0 w-28">
          <label className="block">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Peso (kg)
            </span>
            <input
              value={valores.peso ?? ""}
              onChange={(e) => set("peso", formatarPesoKgDigitado(e.target.value))}
              inputMode="decimal"
              placeholder="0,000"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold tabular-nums text-foreground outline-none focus:border-ring"
            />
          </label>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {GRUPOS.map(({ chave, rotulo }) => {
          const opcoesFixas = OPCOES[chave] as readonly string[];
          const valorAtual = (valores[chave] ?? "").trim();
          const ehAlimentacao = chave === "alimentacao";
          const ehComportamento = chave === "comportamento";
          const valorLegado = !ehAlimentacao && !ehComportamento && valorAtual && !opcoesFixas.includes(valorAtual) ? valorAtual : "";
          const outroAtivo = (ehAlimentacao || ehComportamento) && (ehAlimentacao ? outroAberto || (valorAtual !== "" && !opcoesFixas.includes(valorAtual)) : valorAtual === "Outro" || (valorAtual !== "" && !opcoesFixas.includes(valorAtual)));
          return (
            <div
              key={chave}
              className={chave === "fezes" ? "grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start" : ""}
            >
              <p className={["text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground", chave === "fezes" ? "sm:col-span-2" : ""].join(" ")}>{rotulo}</p>
              <div className={["mt-2 flex flex-wrap gap-2", chave === "fezes" ? "sm:col-start-1" : ""].join(" ")}>
                {opcoesFixas.filter((opcao) => opcao !== "Outro").map((opcao) => {
                  const ativo = valores[chave] === opcao;
                  return <button key={opcao} type="button" aria-pressed={ativo} onClick={() => { if (ehAlimentacao) setOutroAberto(false); const proximo = ativo ? "" : opcao; const atualizado: Omit<Registro, "id"> = { ...valores, [chave]: proximo }; if (chave === "fezes" && proximo !== "Sim") atualizado.fezesCaracteristica = ""; if (chave === "urina" && proximo !== "Sim") atualizado.urinaObservacoes = ""; if (chave === "vomito" && proximo !== "Sim") atualizado.vomitoCaracteristica = ""; onChange(atualizado); }} className={["min-h-10 rounded-full border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", ativo ? "border-primary bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30" : "border-transparent bg-secondary text-secondary-foreground hover:border-primary/40 hover:bg-secondary/70"].join(" ")}>{opcao}</button>;
                })}
                {valorLegado && <span className="inline-flex min-h-10 items-center rounded-full bg-muted px-3 py-2 text-sm text-foreground">Registro anterior: {valorLegado}</span>}
                {(ehAlimentacao || ehComportamento) && <button type="button" aria-pressed={Boolean(outroAtivo)} onClick={() => { if (ehAlimentacao) setOutroAberto(!outroAtivo); set(chave, outroAtivo ? "" : "Outro"); }} className={["min-h-10 rounded-full border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", outroAtivo ? "border-primary bg-primary text-primary-foreground ring-2 ring-primary/30" : "border-transparent bg-secondary text-secondary-foreground hover:border-primary/40"].join(" ")}>Outro</button>}
              </div>
              {(ehAlimentacao || ehComportamento) && outroAtivo && <input value={opcoesFixas.includes(valorAtual) ? "" : valores[chave]} onChange={(e) => set(chave, e.target.value)} placeholder={ehAlimentacao ? "Descreva a alimentação" : "Descreva o comportamento"} className="mt-2 min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />}
              {chave === "fezes" && <div className="mt-3 sm:col-start-2 sm:row-start-2"><p className="text-xs font-medium text-muted-foreground">Características das fezes</p><div className="mt-2 flex flex-wrap gap-2">{["Firmes / Formadas", "Pastosas", "Amolecidas", "Semilíquidas", "Líquidas / Aquosas", "Mucoides", "Espumosas", "Melena"].map((opcao) => { const selecionadas = (valores.fezesCaracteristica ?? "").split(" · ").filter(Boolean); const ativo = selecionadas.includes(opcao); const desabilitado = valores.fezes !== "Sim"; return <button key={opcao} type="button" disabled={desabilitado} aria-disabled={desabilitado} aria-pressed={ativo} onClick={() => set("fezesCaracteristica", alternarOpcaoLista(valores.fezesCaracteristica ?? "", opcao))} className={["min-h-10 rounded-full border px-3 py-2 text-sm", ativo ? "border-primary bg-primary text-primary-foreground ring-2 ring-primary/30" : "border-transparent bg-secondary text-secondary-foreground", desabilitado ? "cursor-not-allowed opacity-50" : ""].join(" ")}>{opcao}</button>; })}</div></div>}
              {chave === "urina" && <div className="mt-3"><p className="text-xs font-medium text-muted-foreground">Observações urinárias</p><div className="mt-2 flex flex-wrap gap-2">{["Sondagem vesical", "Expressão vesical manual", "Hematúria", "Piúria"].map((opcao) => { const selecionadas = (valores.urinaObservacoes ?? "").split(" · ").filter(Boolean); const ativo = selecionadas.includes(opcao); const desabilitado = valores.urina !== "Sim"; return <button key={opcao} type="button" disabled={desabilitado} aria-disabled={desabilitado} aria-pressed={ativo} onClick={() => set("urinaObservacoes", (ativo ? selecionadas.filter((x) => x !== opcao) : [...selecionadas, opcao]).join(" · "))} className={["min-h-10 rounded-full border px-3 py-2 text-sm", ativo ? "border-primary bg-primary text-primary-foreground ring-2 ring-primary/30" : "border-transparent bg-secondary text-secondary-foreground", desabilitado ? "cursor-not-allowed opacity-50" : ""].join(" ")}>{opcao}</button>; })}</div></div>}
              {chave === "vomito" && valores.vomito === "Sim" && <div className="mt-3"><p className="text-xs font-medium text-muted-foreground">Características do vômito</p><div className="mt-2 flex flex-wrap gap-2">{["Alimentar", "Espumoso", "Bilioso", "Líquido", "Com sangue", "Fecaloide"].map((opcao) => { const selecionadas = (valores.vomitoCaracteristica ?? "").split(" · ").filter(Boolean); const ativo = selecionadas.includes(opcao); return <button key={opcao} type="button" aria-pressed={ativo} onClick={() => set("vomitoCaracteristica", alternarOpcaoLista(valores.vomitoCaracteristica ?? "", opcao))} className={["min-h-10 rounded-full border px-3 py-2 text-sm", ativo ? "border-primary bg-primary text-primary-foreground ring-2 ring-primary/30" : "border-transparent bg-secondary text-secondary-foreground"].join(" ")}>{opcao}</button>; })}</div></div>}
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {NUMERICOS.map(({ chave, rotulo, unidade }) => {
          const { fora } = avaliarValor(chave, valores[chave], valores.especie);
          return (
            <Fragment key={chave}>
            <label className="block">
              <span
                className={[
                  "text-[0.7rem] font-semibold uppercase tracking-[0.14em]",
                  fora ? "text-destructive" : "text-muted-foreground",
                ].join(" ")}
              >
                {rotulo} <span className="normal-case tracking-normal">({unidade})</span>
              </span>
              <input
                value={valores[chave]}
                onChange={(e) => setNumero(chave, e.target.value)}
                onBlur={() => aoSairDoCampo(chave)}
                inputMode="decimal"
                aria-invalid={fora}
                className={[
                  "mt-1 w-full rounded-lg border bg-background px-2.5 py-2 text-base font-semibold tabular-nums outline-none",
                  fora
                    ? "border-destructive text-destructive focus:border-destructive"
                    : "border-input text-foreground focus:border-ring",
                ].join(" ")}
              />
            </label>
            {chave === "glicemia" && onFazerCurva && (
              <div className="block">
                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Fazer curva glicêmica?
                </span>
                <div className="mt-1 flex gap-2">
                  {[true, false].map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => onFazerCurva(v)}
                      className={[
                        "flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition-colors",
                        fazerCurva === v
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/70",
                      ].join(" ")}
                    >
                      {v ? "Sim" : "Não"}
                    </button>
                  ))}
                </div>
              </div>
            )}
            </Fragment>
          );
        })}
      </div>

      <section className="mt-5 space-y-4 rounded-xl border border-border bg-secondary/20 p-3 sm:p-4" aria-label="Parâmetros complementares">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Parâmetros complementares</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-muted-foreground">Saturação de oxigênio (SpO₂) — %<input type="number" min="0" max="100" step="any" value={valores.spo2 ?? ""} onChange={(e) => { const value = e.target.value; if (value === "" || (Number(value) >= 0 && Number(value) <= 100)) set("spo2", value); }} inputMode="decimal" className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base font-semibold text-foreground" /></label>
          <label className="block text-xs font-medium text-muted-foreground">Tempo de preenchimento capilar (TPC) — segundos<input type="number" min="0" step="any" value={valores.tpc ?? ""} onChange={(e) => { const value = e.target.value; if (value === "" || Number(value) >= 0) set("tpc", value); }} inputMode="decimal" className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base font-semibold text-foreground" /></label>
        </div>
        <fieldset><legend className="text-xs font-semibold text-muted-foreground">Escala de dor</legend><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{["0 — Sem sinais aparentes", "1 — Leve", "2 — Moderada", "3 — Intensa", "4 — Muito intensa", "NA — Não avaliável"].map((opcao) => { const ativo = valores.dor === opcao; return <button key={opcao} type="button" aria-pressed={ativo} onClick={() => set("dor", ativo ? "" : opcao)} className={["min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-medium", ativo ? "border-primary bg-primary text-primary-foreground ring-2 ring-primary/30" : "border-transparent bg-background text-foreground hover:border-primary/40"].join(" ")}>{opcao}</button>; })}</div></fieldset>
      </section>

      {faixas && (
        <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">
          Faixas ({valores.especie}): {faixas}
        </p>
      )}

      <label className="mt-4 block">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Observações
        </span>
        <textarea
          value={valores.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
          rows={3}
          className="mt-1 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
        />
      </label>

      <div className="mt-4">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Medicações
        </span>
        <Medicacoes
          lista={valores.medicacoes ?? []}
          especie={valores.especie ?? ""}
          peso={valores.peso ?? ""}
          onChange={mudarMedicacoes}
        />
      </div>

      <div className="mt-6 flex gap-2 border-t border-border pt-5">
        <button
          type="button"
          onClick={onEnviar}
          disabled={semPlantao}
          title={semPlantao ? "Inicie o plantão para usar esta função" : undefined}
          className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold uppercase tracking-wide text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-secondary/50 disabled:text-muted-foreground disabled:opacity-60"
        >
          {semPlantao
            ? "Inicie o plantão para usar esta função"
            : anterior
              ? "Acrescentar informação"
              : editando
                ? "Salvar alterações"
                : "Enviar ficha"}
        </button>
        {(editando || anterior) && (
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/70"
          >
            Cancelar
          </button>
        )}
      </div>


      <DialogoAlerta
        regra={fila[0] ?? null}
        onFechar={proximaPergunta}
        onConfirmar={confirmarAlerta}
      />

      <AlertDialog open={Boolean(pendente)} onOpenChange={(o) => !o && setPendente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendente ? ROTULOS_NUMERICOS[pendente].rotulo : ""} alterada
            </AlertDialogTitle>
            <AlertDialogDescription>
              A nova informação deve substituir a anterior nas observações ou ser acrescentada
              como atualização?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => responder(false)}>Acrescentar</AlertDialogCancel>
            <AlertDialogAction onClick={() => responder(true)}>Substituir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
