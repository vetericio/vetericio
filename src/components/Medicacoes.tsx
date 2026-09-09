import { useMemo, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { lerReceitaComIA } from "@/lib/medicacoes.functions";
import type { Especie as EspecieFicha, Medicacao } from "@/lib/ficha";
import { normalizarNomeMedicamento } from "@/lib/nomes";
import { useMedicamentos } from "@/hooks/useMedicamentos";
import {
  calcularDose,
  doseDaEspecie,
  doseEfetiva,
  faixaDe,
  viasDe,
} from "@/lib/medicamentos";

type Props = {
  lista: Medicacao[];
  onChange: (medicacoes: Medicacao[]) => void;
  /** No card do animal (Animais internados) a lista é só para leitura. */
  somenteLeitura?: boolean;
  /** Espécie do animal, usada para puxar a dose padrão cadastrada. */
  especie?: EspecieFicha;
  /** Peso do animal (kg) vindo do cadastro; base do cálculo do volume. */
  peso?: string;
};

const UNIDADES = ["mL", "cápsula/comprimido"] as const;
type Unidade = (typeof UNIDADES)[number];

const DURACOES_PADRAO = ["8h", "12h", "24h"] as const;
const DURACAO_OUTROS = "outros";
type DuracaoPadrao = (typeof DURACOES_PADRAO)[number] | typeof DURACAO_OUTROS | "";

/** Máscara de centavos para mL: digita de trás para frente (5 -> 0,05 / 50 -> 0,50). */
function mascaraMl(valor: string): string {
  const digitos = valor.replace(/\D/g, "").replace(/^0+(?=\d{3,})/, "");
  if (!digitos) return "";
  const cheio = digitos.padStart(3, "0");
  const inteiro = cheio.slice(0, -2).replace(/^0+(?=\d)/, "");
  return `${inteiro},${cheio.slice(-2)}`;
}



function lerComoDataUrl(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error("Falha ao ler arquivo"));
    leitor.readAsDataURL(arquivo);
  });
}

/** Tenta separar uma dose "0,5 mL" ou "1 cp" em quantidade + unidade. */
function parseDose(dose: string): { quantidade: string; unidade: Unidade } {
  const limpa = dose.trim();
  const lower = limpa.toLowerCase();
  if (lower.includes("cp") || lower.includes("cápsula") || lower.includes("capsula") || lower.includes("comprimido") || lower.includes("comp")) {
    const match = limpa.match(/^([\d,.]+)\s*/);
    return { quantidade: match?.[1] ?? limpa, unidade: "cápsula/comprimido" };
  }
  if (lower.includes("ml")) {
    const match = limpa.match(/^([\d,.]+)\s*/);
    return { quantidade: match?.[1] ?? limpa, unidade: "mL" };
  }
  return { quantidade: limpa, unidade: "mL" };
}

/** Define o modo do radio a partir da duração salva. */
function parseDuracao(duracao: string): { modo: DuracaoPadrao; outros: string } {
  const valor = duracao.trim();
  if (!valor) return { modo: "", outros: "" };
  if ((DURACOES_PADRAO as readonly string[]).includes(valor)) {
    return { modo: valor as DuracaoPadrao, outros: "" };
  }
  if (valor) {
    return { modo: DURACAO_OUTROS, outros: valor };
  }
  return { modo: "", outros: "" };
}


function montarDose(quantidade: string, unidade: Unidade): string {
  const q = quantidade.trim();
  if (!q) return "";
  return `${q} ${unidade}`;
}

function duracaoParaSalvar(modo: DuracaoPadrao, outros: string): string {
  if (modo === DURACAO_OUTROS) return outros.trim();
  return modo;
}

type Sugestao = {
  id: string;
  nome: string;
  /** Concentração cadastrada, só como pista visual. */
  detalhe: string;
  intervalo: string;
  /** Dose padrão cadastrada (só número), editável no lançamento. */
  dosePadrao: string;
  /** Unidade da dose cadastrada, ex.: "mg/kg". */
  unidadeDose: string;
  concValor: string;
  concUnidade: string;
};

/** Rótulo curto da espécie, como pedido: "Cão" / "Gato". */
function rotuloEspecie(e: EspecieFicha | undefined): string {
  if (e === "Cachorro") return "Cão";
  if (e === "Gato") return "Gato";
  return "";
}


/** Campo de nome com sugestões vindas apenas do cadastro do Veterício. */
function CampoNomeMedicacao({
  value,
  onChange,
  onEscolher,
  opcoes,
  placeholder,
  className,
  inputRef,
  onEnter,
  onFocus,
}: {
  value: string;
  onChange: (valor: string) => void;
  onEscolher?: (s: Sugestao) => void;
  opcoes: Sugestao[];
  placeholder?: string;
  className?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  onEnter?: () => void;
  onFocus?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);

  const filtradas = useMemo(() => {
    const termo = value.trim().toLocaleLowerCase("pt-BR");
    if (termo.length < 2) return [];
    const comeca: Sugestao[] = [];
    const contem: Sugestao[] = [];
    for (const o of opcoes) {
      const alvo = o.nome.toLocaleLowerCase("pt-BR");
      if (alvo === termo) continue;
      if (alvo.startsWith(termo)) comeca.push(o);
      else if (alvo.includes(termo)) contem.push(o);
    }
    return [...comeca, ...contem].slice(0, 8);
  }, [opcoes, value]);

  const mostrar = aberto && filtradas.length > 0;

  const escolher = (s: Sugestao) => {
    onChange(s.nome);
    onEscolher?.(s);
    setAberto(false);
    setAtivo(0);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setAberto(true);
          setAtivo(0);
        }}
        onFocus={() => {
          setAberto(true);
          onFocus?.();
        }}
        onBlur={() => window.setTimeout(() => setAberto(false), 120)}
        onKeyDown={(e) => {
          if (mostrar && e.key === "ArrowDown") {
            e.preventDefault();
            setAtivo((i) => (i + 1) % filtradas.length);
            return;
          }
          if (mostrar && e.key === "ArrowUp") {
            e.preventDefault();
            setAtivo((i) => (i - 1 + filtradas.length) % filtradas.length);
            return;
          }
          if (e.key === "Escape") {
            setAberto(false);
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            const alvo = mostrar ? filtradas[ativo] : undefined;
            if (alvo) escolher(alvo);
            else onEnter?.();
            return;
          }
        }}
        enterKeyHint="next"
        placeholder={placeholder}
        className={className}
      />
      {mostrar && (
        <ul className="absolute left-0 right-0 top-full z-40 mt-1 max-h-52 overflow-auto rounded-lg border border-border bg-background shadow-lg">
          {filtradas.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(s)}
                className={`block w-full px-2.5 py-1.5 text-left text-sm text-foreground ${
                  i === ativo ? "bg-secondary" : "hover:bg-secondary/60"
                }`}
              >
                {s.nome}
                {s.detalhe ? (
                  <span className="text-xs text-muted-foreground"> · {s.detalhe}</span>
                ) : null}

              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Medicacoes({ lista, onChange, somenteLeitura = false, especie }: Props) {

  const { medicamentos } = useMedicamentos();
  const [aberto, setAberto] = useState(true);
  const [lendo, setLendo] = useState(false);
  const [textoBruto, setTextoBruto] = useState("");
  const [editando, setEditando] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [unidade, setUnidade] = useState<Unidade>("mL");
  const [duracao, setDuracao] = useState<DuracaoPadrao>("");
  const [duracaoOutros, setDuracaoOutros] = useState("");
  // Padrão: modo rápido (só nomes). A setinha abre o formulário completo.
  const [formCompleto, setFormCompleto] = useState(false);
  const [nomesRapidos, setNomesRapidos] = useState<string[]>(["", ""]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const rapidosRef = useRef<HTMLDivElement>(null);

  const quantidadeRef = useRef<HTMLInputElement>(null);
  const outrosRef = useRef<HTMLInputElement>(null);
  const lerIA = useServerFn(lerReceitaComIA);

  /** ⭐ Medicações especiais do cadastro, em ordem alfabética, com a dose padrão. */
  const especiais = useMemo(() => {
    const chave = especie === "Gato" ? "gato" : "cao";
    return medicamentos
      .filter((m) => m.especial && m.nome.trim())
      .map((m) => {
        const d = doseDaEspecie(m, chave);
        const f = faixaDe(d);
        const padrao = doseEfetiva(d);
        const dose = padrao === null ? "" : `${String(padrao).replace(".", ",")} ${f.unidade}`;
        return {
          id: m.id,
          nome: normalizarNomeMedicamento(m.nome),
          dose,
          via: viasDe(m)[0] ?? "",
          intervalo: (d.intervalo ?? "").trim(),
          dosePadrao: padrao === null ? "" : String(padrao),
          unidadeDose: f.unidade,
          concValor: m.concentracaoValor ?? "",
          concUnidade: m.concentracaoUnidade ?? "",
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [medicamentos, especie]);

  /** Sugestões ao digitar: só o que está cadastrado no Veterício. */
  const sugestoes = useMemo<Sugestao[]>(() => {
    const chave = especie === "Gato" ? "gato" : "cao";
    return medicamentos
      .filter((m) => m.nome.trim())
      .map((m) => {
        const d = doseDaEspecie(m, chave);
        const f = faixaDe(d);
        const padrao = doseEfetiva(d);
        return {
          id: m.id,
          nome: normalizarNomeMedicamento(m.nome),
          detalhe: m.concentracaoValor
            ? `${m.concentracaoValor} ${m.concentracaoUnidade ?? ""}`.trim()
            : "",
          intervalo: (d.intervalo ?? "").trim(),
          dosePadrao: padrao === null ? "" : String(padrao).replace(".", ","),
          unidadeDose: f.unidade,
          concValor: m.concentracaoValor ?? "",
          concUnidade: m.concentracaoUnidade ?? "",
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [medicamentos, especie]);



  /** Puxa a medicação cadastrada; a dose padrão vai preenchida e continua editável. */
  const usarEspecial = (item: (typeof especiais)[number]) => {
    onChange([
      ...lista,
      {
        nome: item.nome,
        dose: item.dose,
        duracao: item.intervalo ? `${item.intervalo}h` : "",
        ...(item.via ? { via: item.via } : {}),
      },
    ]);
    toast.success(`${item.nome} adicionada. A dose padrão continua editável.`);
  };

  const resetForm = () => {
    setNome("");
    setQuantidade("");
    setUnidade("mL");
    setDuracao("");
    setDuracaoOutros("");
    setEditando(null);
  };

  const enviarRapido = () => {
    const itens: Medicacao[] = nomesRapidos
      .map((n) => normalizarNomeMedicamento(n))
      .filter(Boolean)
      .map((n) => ({ nome: n, dose: "", duracao: "" }));
    if (itens.length === 0) {
      toast.error("Escreva o nome de ao menos uma medicação.");
      return;
    }
    onChange([...lista, ...itens]);
    setNomesRapidos(["", ""]);
    toast.success(
      itens.length === 1 ? "Medicação adicionada." : `${itens.length} medicações adicionadas.`,
    );
  };

  const enviar = () => {
    const nomeLimpo = normalizarNomeMedicamento(nome);
    if (!nomeLimpo) {
      toast.error("Escreva o nome da medicação.");
      return;
    }
    const dose = montarDose(quantidade, unidade);
    if (duracao === DURACAO_OUTROS && !duracaoOutros.trim()) {
      toast.error("Escreva a duração em outros.");
      return;
    }
    const duracaoSalva = duracaoParaSalvar(duracao, duracaoOutros);
    const item: Medicacao = { nome: nomeLimpo, dose, duracao: duracaoSalva };

    if (editando === null) {
      onChange([...lista, item]);
      toast.success("Medicação adicionada.");
    } else {
      onChange(lista.map((m, i) => (i === editando ? item : m)));
      toast.success("Medicação atualizada.");
    }
    resetForm();
    setAberto(true);
  };


  const editar = (indice: number) => {
    const item = lista[indice];
    if (!item) return;
    const { quantidade: q, unidade: u } = parseDose(item.dose);
    const { modo, outros } = parseDuracao(item.duracao);
    setNome(item.nome);
    setQuantidade(q);
    setUnidade(u);
    setDuracao(modo);
    setDuracaoOutros(outros);
    setEditando(indice);
    setFormCompleto(true);
    setAberto(true);
  };

  const cancelarEdicao = () => resetForm();

  const remover = (indice: number) => {
    onChange(lista.filter((_, i) => i !== indice));
    if (editando === indice) cancelarEdicao();
  };

  const lerOffline = async (arquivo: File) => {
    const { lerTextoDaImagem, analisarMedicacoes } = await import("@/lib/ocr");
    const texto = await lerTextoDaImagem(arquivo);
    return { encontradas: analisarMedicacoes(texto), texto };
  };

  const normalizarDuracao = (valor: string): string => {
    const v = valor.trim().toLowerCase();
    const mapa: Record<string, string> = {
      "8h": "8h", "8": "8h", "oito horas": "8h", "8 horas": "8h",
      "12h": "12h", "12": "12h", "doze horas": "12h", "12 horas": "12h",
      "24h": "24h", "24": "24h", "vinte e quatro horas": "24h", "24 horas": "24h",
      "48h": "48h", "48": "48h", "quarenta e oito horas": "48h", "48 horas": "48h",
      "7d": "7 dias", "7 dias": "7 dias", "7": "7 dias", "sete dias": "7 dias",
    };
    return mapa[v] ?? v;
  };

  const classificarDuracao = (valor: string): { modo: DuracaoPadrao; outros: string } => {
    const normalizado = normalizarDuracao(valor);
    if ((DURACOES_PADRAO as readonly string[]).includes(normalizado)) {
      return { modo: normalizado as DuracaoPadrao, outros: "" };
    }
    return { modo: DURACAO_OUTROS, outros: valor.trim() };
  };

  const lerFoto = async (arquivo: File) => {
    setLendo(true);
    setTextoBruto("");
    let encontradas: Medicacao[] = [];
    let texto = "";
    let usouIA = false;

    try {
      if (navigator.onLine) {
        try {
          const imagem = await lerComoDataUrl(arquivo);
          const resultado = await lerIA({ data: { imagem } });
          encontradas = resultado.medicacoes.map((m) => {
            const { modo, outros } = classificarDuracao(m.duracao);
            return {
              ...m,
              nome: normalizarNomeMedicamento(m.nome),
              duracao: modo === DURACAO_OUTROS && outros ? outros : modo,
            };
          });
          usouIA = true;
        } catch {
          usouIA = false;
        }
      }

      if (!usouIA || encontradas.length === 0) {
        try {
          const offline = await lerOffline(arquivo);
          if (encontradas.length === 0) {
            encontradas = offline.encontradas.map((m) => {
              const { modo, outros } = classificarDuracao(m.duracao);
              return {
              ...m,
              nome: normalizarNomeMedicamento(m.nome),
              duracao: modo === DURACAO_OUTROS && outros ? outros : modo,
            };
            });
          }
          texto = offline.texto;
          if (!usouIA) toast.info("Sem internet: leitura offline, precisão menor.");
        } catch {
          if (!usouIA) throw new Error("sem leitura");
        }
      }

      setTextoBruto(texto);
      if (encontradas.length === 0) {
        toast.info("Não reconheci medicações. Confira o texto lido e preencha à mão.");
      } else {
        onChange([...lista, ...encontradas]);
        toast.success(
          encontradas.length === 1
            ? "1 medicação sugerida. Revise antes de usar."
            : `${encontradas.length} medicações sugeridas. Revise antes de usar.`,
        );
      }
      setAberto(true);
    } catch {
      toast.error("Não foi possível ler a imagem.");
    } finally {
      setLendo(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galeriaRef.current) galeriaRef.current.value = "";
    }
  };

  const campo =
    "rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-ring";

  return (
    <section className="mt-3 rounded-xl border border-border bg-background/60 p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap sm:justify-between">
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          className="truncate text-left text-xs font-semibold text-foreground underline-offset-2 hover:underline"
        >
          Medicações ({lista.length}) {aberto ? "▲" : "▼"}
        </button>
        {!somenteLeitura && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={lendo}
              onClick={() => cameraRef.current?.click()}
              className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {lendo ? "Lendo foto…" : "📷 Tirar foto"}
            </button>
            <button
              type="button"
              disabled={lendo}
              onClick={() => galeriaRef.current?.click()}
              className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70 disabled:opacity-60"
            >
              {lendo ? "Lendo foto…" : "🖼️ Enviar foto"}
            </button>
          </div>
        )}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void lerFoto(arquivo);
          }}
        />
        <input
          ref={galeriaRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void lerFoto(arquivo);
          }}
        />
      </div>

      {aberto && (
        <div className="mt-3 space-y-3">
          {lista.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {somenteLeitura
                ? "Nenhuma medicação. Para editar, use o botão Editar do animal."
                : "Nenhuma medicação. Preencha abaixo e toque em Adicionar medicação, ou tire uma foto da receita."}
            </p>
          ) : (

            <ul className="space-y-1.5">
              {lista.map((m, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/60 px-2.5 py-1.5"
                >
                  <span className="min-w-0 text-sm text-foreground">
                    {m.nomeMenor && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {normalizarNomeMedicamento(m.nomeMenor)}
                      </span>
                    )}
                    <span className="block truncate">
                      {[normalizarNomeMedicamento(m.nome), m.dose, m.duracao]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {!somenteLeitura && (
                    <span className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => editar(i)}
                        className="rounded-lg bg-background px-2 py-1 text-xs font-semibold text-foreground hover:bg-background/70"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => remover(i)}
                        className="rounded-lg bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20"
                      >
                        Excluir
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!somenteLeitura && (
          <div className="space-y-2 rounded-lg border border-dashed border-border p-2">
            <button
              type="button"
              onClick={() => {
                if (editando !== null) return;
                setFormCompleto((v) => !v);
              }}
              className="flex w-full items-center gap-1.5 text-left text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <span aria-hidden>{formCompleto ? "▾" : "▸"}</span>
              {formCompleto
                ? "Formulário completo (dose e duração)"
                : "Adicionar várias de uma vez (só o nome)"}
            </button>

            {especiais.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground">
                  ⭐ Medicações cadastradas (toque para puxar com a dose padrão)
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {especiais.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => usarEspecial(m)}
                      className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
                    >
                      {m.nome}
                      {m.dose ? ` · ${m.dose}` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}


            {!formCompleto && editando === null ? (
              <>
                <div className="space-y-1.5" ref={rapidosRef}>
                  {nomesRapidos.map((valor, i) => (
                    <CampoNomeMedicacao
                      key={i}
                      value={valor}
                      opcoes={sugestoes}
                      onChange={(v) =>
                        setNomesRapidos((atual) => atual.map((n, j) => (j === i ? v : n)))
                      }
                      onFocus={() => {
                        if (i === nomesRapidos.length - 1)
                          setNomesRapidos((atual) => [...atual, ""]);
                      }}
                      onEnter={() => {
                        const campos = rapidosRef.current?.querySelectorAll("input");
                        campos?.[i + 1]?.focus();
                      }}
                      placeholder={`Medicação ${i + 1}`}
                      className={`${campo} w-full`}
                    />
                  ))}
                </div>

                <div className="flex justify-end border-t border-border pt-2">
                  <button
                    type="button"
                    onClick={enviarRapido}
                    className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
                  >
                    Adicionar tudo
                  </button>
                </div>
              </>
            ) : (
            <>
            <div className="grid gap-1.5 sm:grid-cols-3">
              <CampoNomeMedicacao
                inputRef={nomeRef}
                value={nome}
                opcoes={sugestoes}
                onChange={setNome}
                onEscolher={(s) => {
                  const alvo = `${s.intervalo}h`;
                  if ((DURACOES_PADRAO as readonly string[]).includes(alvo))
                    setDuracao(alvo as DuracaoPadrao);
                  else if (s.intervalo) {
                    setDuracao(DURACAO_OUTROS);
                    setDuracaoOutros(alvo);
                  }
                  quantidadeRef.current?.focus();
                }}

                onEnter={() => quantidadeRef.current?.focus()}
                placeholder="Medicação"
                className={campo}
              />

              <div className="flex min-w-0 gap-1.5">
                <input
                  ref={quantidadeRef}
                  value={quantidade}
                  onChange={(e) =>
                    setQuantidade(unidade === "mL" ? mascaraMl(e.target.value) : e.target.value)
                  }

                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (duracao === DURACAO_OUTROS) outrosRef.current?.focus();
                      else enviar();
                    }
                  }}
                  enterKeyHint="next"
                  placeholder="Quantidade"
                  className={`${campo} min-w-0 flex-1`}
                />
                <select
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value as Unidade)}
                  className={`${campo} shrink-0`}
                  style={{ width: "auto", minWidth: "5.5rem" }}
                >
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className={`${campo} space-y-1.5`}>
                <div className="grid grid-cols-4 gap-1">
                {([...DURACOES_PADRAO, DURACAO_OUTROS] as DuracaoPadrao[]).map((d) => {
                  const selecionado = duracao === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuracao(d)}
                      className={`inline-flex items-center justify-center gap-1 rounded-full border px-1 py-1 text-[0.7rem] transition-colors ${
                        selecionado
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:bg-secondary"
                      }`}
                    >
                      <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full border border-current">
                        {selecionado && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                      </span>
                      <span className="truncate">{d}</span>
                    </button>
                  );
                })}
                </div>

                {duracao === DURACAO_OUTROS && (
                  <input
                    ref={outrosRef}
                    value={duracaoOutros}
                    onChange={(e) => setDuracaoOutros(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        enviar();
                      }
                    }}
                    enterKeyHint="send"
                    placeholder="Especifique"
                    className={`${campo} w-full text-xs`}
                  />
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-2">
              <button
                type="button"
                onClick={enviar}
                className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
              >
                {editando === null ? "Adicionar medicação" : "Salvar alteração"}
              </button>
              {editando !== null && (
                <button
                  type="button"
                  onClick={cancelarEdicao}
                  className="rounded-lg bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-background/70"
                >
                  Cancelar
                </button>
              )}
            </div>
            </>
            )}

          </div>
          )}

          {textoBruto && (
            <details className="rounded-lg bg-secondary p-2">
              <summary className="cursor-pointer text-xs font-semibold text-secondary-foreground">
                Texto lido da foto
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-sans text-xs text-muted-foreground">
                {textoBruto}
              </pre>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
