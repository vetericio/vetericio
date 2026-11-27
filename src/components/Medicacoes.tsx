import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { lerReceitaComIA } from "@/lib/medicacoes.functions";
import type { Especie as EspecieFicha, Medicacao } from "@/lib/ficha";
import { normalizarNomeMedicamento } from "@/lib/nomes";
import { useMedicamentos } from "@/hooks/useMedicamentos";
import { supabase } from "@/integrations/supabase/client";
import {
  calcularDose,
  calcularDosePeloVolume,
  calcularEntrada,
  numero,
  UNIDADES_REGISTRO_MANUAL,
  doseDaEspecie,
  dosePadraoCadastrada,
  especieBloqueada,
  especieMedicacaoDaFicha,
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
  pacienteId?: string;
  /** Peso do animal (kg) vindo do cadastro; base do cálculo do volume. */
  peso?: string;
};

const DURACOES_PADRAO = ["8h", "12h", "24h"] as const;
const DURACAO_OUTROS = "outros";
type DuracaoPadrao = (typeof DURACOES_PADRAO)[number] | typeof DURACAO_OUTROS | "";

function lerComoDataUrl(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error("Falha ao ler arquivo"));
    leitor.readAsDataURL(arquivo);
  });
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
  const especie = especieMedicacaoDaFicha(e);
  if (especie === "cao") return "Cão";
  if (especie === "gato") return "Gato";
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

export function Medicacoes(props: Props) {
  const { medicamentos } = useMedicamentos();
  // Estado dos formulários é efêmero. Alterar contexto invalida seleção, unidade e números juntos,
  // antes de qualquer render/submit que pudesse usar a apresentação anterior.
  const contexto = JSON.stringify([props.pacienteId, props.especie, props.peso, medicamentos]);
  return <MedicacoesContexto key={contexto} {...props} medicamentos={medicamentos} />;
}

function MedicacoesContexto({ lista, onChange, somenteLeitura = false, especie, peso = "", medicamentos }:
  Props & { medicamentos: ReturnType<typeof useMedicamentos>["medicamentos"] }) {
  const [aberto, setAberto] = useState(true);
  const [lendo, setLendo] = useState(false);
  const [textoBruto, setTextoBruto] = useState("");
  const [editando, setEditando] = useState<number | null>(null);
  const [edicaoInline, setEdicaoInline] = useState<{ dose: string; quantidade: string; duracao: string } | null>(null);
  const [nome, setNome] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [unidadeManual, setUnidadeManual] = useState("");
  const [modoQuantidade, setModoQuantidade] = useState<"ml" | "dose">("dose");
  const [duracao, setDuracao] = useState<DuracaoPadrao>("");
  const [duracaoOutros, setDuracaoOutros] = useState("");
  const [horarioInicial, setHorarioInicial] = useState("");
  // Padrão: modo rápido (só nomes). A setinha abre o formulário completo.
  const [formCompleto, setFormCompleto] = useState(false);
  const [nomesRapidos, setNomesRapidos] = useState<string[]>(["", ""]);
  /** Medicação do cadastro escolhida no formulário: base do cálculo do volume. */
  const [refCalculo, setRefCalculo] = useState<Sugestao | null>(null);
  /** Dose usada neste lançamento (editável, sem alterar o cadastro). */
  const [doseUsada, setDoseUsada] = useState("");
  /** Modo rápido: medicação do cadastro escolhida por linha. */
  const [refsRapidos, setRefsRapidos] = useState<Record<number, Sugestao | null>>({});
  /** Modo rápido: dose deste atendimento por linha (editável). */
  const [dosesRapidas, setDosesRapidas] = useState<Record<number, string>>({});
  const cameraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const rapidosRef = useRef<HTMLDivElement>(null);

  const quantidadeRef = useRef<HTMLInputElement>(null);
  const outrosRef = useRef<HTMLInputElement>(null);
  const lerIA = useServerFn(lerReceitaComIA);
  const contextoVigente = useRef(false);
  useLayoutEffect(() => {
    contextoVigente.current = true;
    return () => { contextoVigente.current = false; };
  }, []);

  /** ⭐ Medicações favoritas do cadastro, em ordem alfabética, com a dose padrão. */
  const especiais = useMemo(() => {
    const chave = especieMedicacaoDaFicha(especie);
    if (!chave) return [];
    return medicamentos
      .filter((m) => m.favorito && m.nome.trim() && !especieBloqueada(m, chave))
      .map((m) => {
        const d = doseDaEspecie(m, chave);
        const f = faixaDe(d);
        const padrao = dosePadraoCadastrada(d);
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
    const chave = especieMedicacaoDaFicha(especie);
    if (!chave) return [];
    return medicamentos
      .filter((m) => m.nome.trim() && !especieBloqueada(m, chave))
      .map((m) => {
        const d = doseDaEspecie(m, chave);
        const f = faixaDe(d);
        const padrao = dosePadraoCadastrada(d);
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



  const entrada = refCalculo ? calcularEntrada({
    peso, dose: doseUsada, quantidade,
    origem: modoQuantidade === "ml" ? "quantidade" : "dose",
    unidadeDose: refCalculo.unidadeDose,
    concentracaoValor: refCalculo.concValor,
    concentracaoUnidade: refCalculo.concUnidade,
  }) : null;
  const doseExibida = entrada?.dose ?? doseUsada;
  const calculo = entrada?.resultado ?? null;
  const volumeCalculado = entrada?.quantidade ?? quantidade;
  const unidadeCalculada = refCalculo ? entrada?.unidadeQuantidade ?? "" : unidadeManual;

  /** Medicação cadastrada correspondente à linha do modo rápido. */
  const refDaLinha = (i: number): Sugestao | null => {
    const escolhido = refsRapidos[i];
    if (escolhido) return escolhido;
    const termo = (nomesRapidos[i] ?? "").trim().toLocaleLowerCase("pt-BR");
    if (!termo) return null;
    return sugestoes.find((s) => s.nome.toLocaleLowerCase("pt-BR") === termo) ?? null;
  };

  const doseDaLinha = (i: number, ref: Sugestao | null): string =>
    dosesRapidas[i] ?? ref?.dosePadrao ?? "";

  /** mL da linha do modo rápido, sempre com os dados cadastrados. */
  const calculoDaLinha = (i: number, ref: Sugestao | null) => {
    if (!ref) return null;
    const dose = doseDaLinha(i, ref);
    if (!dose.trim())
      return {
        ok: false as const,
        motivo: "Informe a dose prescrita.",
      };
    return calcularDose({
      peso,
      dose,
      concentracaoValor: ref.concValor,
      concentracaoUnidade: ref.concUnidade,
      unidadeDose: ref.unidadeDose,
    });
  };

  /** Puxa a medicação cadastrada; a dose padrão vai preenchida e continua editável. */
  const usarEspecial = (item: (typeof especiais)[number]) => {
    const conta =
      item.dosePadrao
        ? calcularDose({
            peso,
            dose: item.dosePadrao,
            concentracaoValor: item.concValor,
            concentracaoUnidade: item.concUnidade,
            unidadeDose: item.unidadeDose,
          })
        : null;
    if (!conta?.ok || !item.dose.trim()) {
      toast.error("Informe a dose prescrita e confira a quantidade no formulário antes de adicionar.");
      return;
    }
    onChange([
      ...lista,
      {
        nome: item.nome,
        dose: item.dose,
        duracao: item.intervalo ? `${item.intervalo}h` : "",
        ...(item.via ? { via: item.via } : {}),
        ...(conta?.ok ? { quantidade: `${conta.volumeTexto} ${conta.unidade}` } : {}),
      },
    ]);
    toast.success(`${item.nome} adicionada. A dose padrão continua editável.`);
  };

  const resetForm = () => {
    setNome("");
    setQuantidade("");
    setUnidadeManual("");
    setModoQuantidade("ml");
    setDuracao("");
    setDuracaoOutros("");
    setHorarioInicial("");
    setEditando(null);
    setRefCalculo(null);
    setDoseUsada("");
  };

  const enviarRapido = () => {
    const itens: Medicacao[] = [];
    const semDose: string[] = [];
    nomesRapidos.forEach((n, i) => {
      const nomeLimpo = normalizarNomeMedicamento(n);
      if (!nomeLimpo) return;
      const ref = refDaLinha(i);
      const dose = doseDaLinha(i, ref);
      const conta = calculoDaLinha(i, ref);
      if (ref && !conta?.ok) {
        semDose.push(nomeLimpo);
        return;
      }
      itens.push({
        nome: nomeLimpo,
        dose: ref && dose.trim() ? `${dose} ${ref.unidadeDose}`.trim() : "",
        duracao: ref?.intervalo ? `${ref.intervalo}h` : "",
        ...(horarioInicial ? { horarioInicial, programadaEm: new Date().toISOString() } : {}),
        ...(conta?.ok ? { quantidade: `${conta.volumeTexto} ${conta.unidade}` } : {}),
      });
    });
    if (semDose.length) {
      toast.error("Informe a dose prescrita e confira o cálculo: " + semDose.join(", ") + ".");
      return;
    }
    if (itens.length === 0) {
      toast.error("Escreva o nome de ao menos uma medicação.");
      return;
    }
    onChange([...lista, ...itens]);
    setNomesRapidos(["", ""]);
    setRefsRapidos({});
    setDosesRapidas({});
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
    if (refCalculo && (!calculo || !calculo.ok)) {
      toast.error(calculo && !calculo.ok ? calculo.motivo : "Confira a dose, o peso e a concentração.");
      return;
    }
    const quantidadeFinal = volumeCalculado.trim();
    if (quantidadeFinal && (!unidadeCalculada || (numero(quantidadeFinal) ?? 0) <= 0)) {
      toast.error("Informe uma quantidade positiva e confirme a unidade.");
      return;
    }
    const dose = refCalculo && doseExibida.trim()
      ? `${doseExibida.trim()} ${refCalculo.unidadeDose}` : "";
    if (duracao === DURACAO_OUTROS && !duracaoOutros.trim()) {
      toast.error("Escreva a duração em outros.");
      return;
    }
    const duracaoSalva = duracaoParaSalvar(duracao, duracaoOutros);
    const anterior = editando !== null ? lista[editando] : undefined;
    const mesmaProgramacao = anterior?.horarioInicial === horarioInicial && anterior?.duracao === duracaoSalva &&
      anterior?.nome === nomeLimpo;
    const item: Medicacao = {
      ...anterior,
      nome: nomeLimpo,
      dose,
      duracao: duracaoSalva,
      horarioInicial: horarioInicial || undefined,
      programadaEm: horarioInicial
        ? (mesmaProgramacao ? anterior?.programadaEm : undefined) || new Date().toISOString()
        : undefined,
      ...(quantidadeFinal
        ? { quantidade: `${quantidadeFinal} ${unidadeCalculada}` }
        : {}),
    };

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
    setEdicaoInline({ dose: item.dose ?? "", quantidade: item.quantidade ?? "", duracao: item.duracao ?? "" });
    // A edição de uma linha já registrada não converte a quantidade pelo cadastro atual.
    // O par dose/unidade e a apresentação permanecem exatamente como foram lançados.
    setNome(item.nome);
    setRefCalculo(null);
    setDoseUsada("");
    setQuantidade("");
    setHorarioInicial(item.horarioInicial ?? "");
    setEditando(indice);
    setFormCompleto(true);
    setAberto(true);
  };

  const cancelarEdicao = () => {
    setEdicaoInline(null);
    resetForm();
  };

  const salvarEdicaoInline = (indice: number) => {
    if (!edicaoInline) return;
    const anterior = lista[indice];
    if (!anterior) return;
    const doseFinal = edicaoInline.dose.trim();
    const quantidadeFinal = edicaoInline.quantidade.trim();
    const temUnidade = (texto: string) => !texto || /[\p{L}µ%]/u.test(texto);
    if ((doseFinal !== anterior.dose && !temUnidade(doseFinal)) ||
        (quantidadeFinal !== (anterior.quantidade ?? "") && !temUnidade(quantidadeFinal))) {
      toast.error("Ao alterar dose ou quantidade, informe também a unidade registrada.");
      return;
    }
    onChange(lista.map((m, i) => i === indice ? {
      ...m,
      dose: doseFinal,
      quantidade: quantidadeFinal,
      duracao: edicaoInline.duracao.trim(),
      horarioInicial: horarioInicial || undefined,
      programadaEm: horarioInicial
        ? (m.horarioInicial === horarioInicial && m.duracao === edicaoInline.duracao.trim() ? m.programadaEm : undefined) || new Date().toISOString()
        : undefined,
    } : m));
    setEdicaoInline(null);
    resetForm();
    toast.success("Medicação atualizada.");
  };

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
    // Frequência pode vir da foto como 8/8h, 12/12h, 24/24h, "a cada 12h" etc.
    const freq = v.match(/(?:a\s*cada\s*)?(8|12|24)\s*(?:\/\s*\1)?\s*h(?:oras?)?/i);
    if (freq?.[1]) return `${freq[1]}h`;
    const mapa: Record<string, string> = {
      "8h": "8h", "8": "8h", "oito horas": "8h", "8 horas": "8h",
      "12h": "12h", "12": "12h", "doze horas": "12h", "12 horas": "12h",
      "24h": "24h", "24": "24h", "vinte e quatro horas": "24h", "24 horas": "24h",
      "48h": "48h", "48": "48h", "quarenta e oito horas": "48h", "48 horas": "48h",
      "7d": "7 dias", "7 dias": "7 dias", "7": "7 dias", "sete dias": "7 dias",
    };
    return mapa[v] ?? v;
  };

  /** Converte a leitura da foto para o modelo real do Veterício.
   * mL é quantidade administrada, nunca dose mg/kg. Quando há peso + concentração
   * cadastrada, calcula a dose inversa. Frequência da foto tem prioridade; se não
   * existir, usa o intervalo já cadastrado para o medicamento.
   */
  const enriquecerLeituraFoto = (m: Medicacao): Medicacao => {
    const nome = normalizarNomeMedicamento(m.nome);
    const chaveNome = nome.toLocaleLowerCase("pt-BR");
    const ref = sugestoes.find((s) => s.nome.toLocaleLowerCase("pt-BR") === chaveNome)
      ?? sugestoes.find((s) => chaveNome.includes(s.nome.toLocaleLowerCase("pt-BR")) || s.nome.toLocaleLowerCase("pt-BR").includes(chaveNome));

    const brutoDose = (m.dose ?? "").trim();
    const brutoDuracao = (m.duracao ?? "").trim();
    const freqNoTexto = [brutoDuracao, brutoDose]
      .map(normalizarDuracao)
      .find((x) => (DURACOES_PADRAO as readonly string[]).includes(x));
    const duracaoFinal = freqNoTexto || (ref?.intervalo ? normalizarDuracao(ref.intervalo) : brutoDuracao);

    const volumeMatch = brutoDose.match(/(\\d+(?:[.,]\\d+)?)\\s*m[lL]\\b/i);
    if (!volumeMatch?.[1]) {
      return { ...m, nome, duracao: duracaoFinal };
    }

    const volume = volumeMatch[1];
    let doseFinal = "";
    if (ref?.concValor && ref.unidadeDose) {
      const inverso = calcularDosePeloVolume({
        peso,
        volume,
        concentracaoValor: ref.concValor,
        concentracaoUnidade: ref.concUnidade,
        unidadeDose: ref.unidadeDose,
        unidadeQuantidade: "mL",
      });
      if (inverso.ok) doseFinal = `${inverso.doseTexto} ${ref.unidadeDose}`;
    }

    return {
      ...m,
      nome: ref?.nome ?? nome,
      dose: doseFinal,
      quantidade: `${volume.replace(".", ",")} mL`,
      duracao: duracaoFinal,
    };
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
          const { data: sessao } = await supabase.auth.getSession();
          const accessToken = sessao.session?.access_token;
          if (!accessToken) throw new Error("Sessão expirada. Entre novamente no sistema.");
          if (!contextoVigente.current) return;
          const resultado = await lerIA({ data: { imagem, accessToken } });
          if (!contextoVigente.current) return;
          encontradas = resultado.medicacoes.map(enriquecerLeituraFoto);
          usouIA = true;
        } catch {
          usouIA = false;
        }
      }

      if (!usouIA || encontradas.length === 0) {
        try {
          const offline = await lerOffline(arquivo);
          if (!contextoVigente.current) return;
          if (encontradas.length === 0) {
            encontradas = offline.encontradas.map(enriquecerLeituraFoto);
          }
          texto = offline.texto;
          if (!usouIA) toast.info("Sem internet: leitura offline, precisão menor.");
        } catch {
          if (!usouIA) throw new Error("sem leitura");
        }
      }

      if (!contextoVigente.current) return;
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
      if (contextoVigente.current) toast.error("Não foi possível ler a imagem.");
    } finally {
      if (contextoVigente.current) setLendo(false);
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
                  <span className="min-w-0 flex-1 text-sm text-foreground">
                    {m.nomeMenor && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {normalizarNomeMedicamento(m.nomeMenor)}
                      </span>
                    )}
                    {editando === i && edicaoInline ? (
                      <span className="block space-y-1.5">
                        <span className="block font-semibold">{normalizarNomeMedicamento(m.nome)}</span>
                        <span className="grid grid-cols-3 gap-1.5">
                          <label className="min-w-0 text-[10px] text-muted-foreground">
                            Dose
                            <input
                              aria-label="Dose"
                              value={edicaoInline.dose}
                              onChange={(e) => {
                                const valor = e.target.value;
                                setEdicaoInline((v) => v ? { ...v, dose: valor } : v);
                              }}
                              placeholder="Dose"
                              className="mt-0.5 w-full min-w-0 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
                            />
                          </label>
                          <label className="min-w-0 text-[10px] text-muted-foreground">
                            Quantidade e unidade
                            <input
                              aria-label="Quantidade"
                              value={edicaoInline.quantidade}
                              onChange={(e) => {
                                const valor = e.target.value;
                                setEdicaoInline((v) => v ? { ...v, quantidade: valor } : v);
                              }}
                              placeholder="Quantidade e unidade"
                              className="mt-0.5 w-full min-w-0 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
                            />
                          </label>
                          <label className="min-w-0 text-[10px] text-muted-foreground">
                            Intervalo
                            <input
                              aria-label="Intervalo"
                              value={edicaoInline.duracao}
                              onChange={(e) => setEdicaoInline((v) => v ? { ...v, duracao: e.target.value } : v)}
                              placeholder="8h"
                              className="mt-0.5 w-full min-w-0 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
                            />
                          </label>
                        </span>
                        <label className="block text-[10px] text-muted-foreground">
                          Horário da primeira dose
                          <input
                            type="time"
                            value={horarioInicial}
                            onChange={(e) => setHorarioInicial(e.target.value)}
                            className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
                          />
                        </label>
                        <span className="flex gap-1.5">
                          <button type="button" onClick={() => salvarEdicaoInline(i)} className="rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
                            Salvar
                          </button>
                          <button type="button" onClick={cancelarEdicao} className="rounded-lg bg-background px-2 py-1 text-xs font-semibold text-foreground">
                            Cancelar
                          </button>
                        </span>
                      </span>
                    ) : (
                      <span className="block min-w-0">
                        <span className="block truncate font-semibold">
                          {normalizarNomeMedicamento(m.nome)}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {[m.dose, m.quantidade, m.duracao]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    )}
                  </span>
                  {!somenteLeitura && editando !== i && (
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

          {!somenteLeitura && editando === null && (
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

            <p className="text-[11px] font-semibold text-muted-foreground">
              {rotuloEspecie(especie) ? `Espécie: ${rotuloEspecie(especie)}` : "Sem espécie canina ou felina confirmada, não há sugestão de dose"}
              {" | "}
              {peso.trim() ? `Peso: ${peso.trim()} kg` : "Peso: não informado na ficha"}
              {" · Se o contexto mudar, os campos não salvos são limpos."}
            </p>

            {especiais.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground">
                  ⭐ Medicações cadastradas (atalho quando há dose e cálculo disponíveis)
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
                <label className="block text-xs font-semibold text-muted-foreground">
                  Horário da primeira dose
                  <input
                    type="time"
                    value={horarioInicial}
                    onChange={(e) => setHorarioInicial(e.target.value)}
                    className={`${campo} mt-1`}
                  />
                </label>
                <div className="space-y-1.5" ref={rapidosRef}>
                  {nomesRapidos.map((valor, i) => {
                    const ref = refDaLinha(i);
                    const dose = doseDaLinha(i, ref);
                    const conta = calculoDaLinha(i, ref);
                    return (
                      <div key={i} className="space-y-1">
                        <CampoNomeMedicacao
                          value={valor}
                          opcoes={sugestoes}
                          onChange={(v) => {
                            setNomesRapidos((atual) => atual.map((n, j) => (j === i ? v : n)));
                            setRefsRapidos((atual) => ({ ...atual, [i]: null }));
                            setDosesRapidas((atual) => {
                              const copia = { ...atual };
                              delete copia[i];
                              return copia;
                            });
                          }}
                          onEscolher={(s) => {
                            setRefsRapidos((atual) => ({ ...atual, [i]: s }));
                            setDosesRapidas((atual) => {
                              const copia = { ...atual };
                              delete copia[i];
                              return copia;
                            });
                          }}
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

                        {ref && (
                          <div className="rounded-lg bg-secondary/60 p-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <label className="flex items-center gap-1.5 text-xs text-foreground">
                                Dose neste atendimento
                                <input
                                  value={dose}
                                  onChange={(e) => {
                                    const v = e.target.value
                                      .replace(/[^\d,.]/g, "")
                                      .replace(".", ",");
                                    setDosesRapidas((atual) => ({ ...atual, [i]: v }));
                                  }}
                                  inputMode="decimal"
                                  className={`${campo} w-20 tabular-nums`}
                                />
                                <span className="text-muted-foreground">{ref.unidadeDose}</span>
                              </label>
                              {ref.dosePadrao && (
                                <span className="text-[11px] text-muted-foreground">
                                  dose padrão cadastrada: {ref.dosePadrao} {ref.unidadeDose}
                                </span>
                              )}
                            </div>
                            <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-xs">
                              {conta?.ok ? (
                                <>
                                  <div className="rounded-md bg-background px-2 py-1.5">
                                    <span className="block text-[10px] font-semibold uppercase text-muted-foreground">Dose</span>
                                    <strong className="text-foreground">{dose} {ref.unidadeDose}</strong>
                                    <span className="block text-[10px] text-muted-foreground">
                                      Total: {conta.doseTotalTexto}
                                    </span>
                                  </div>
                                  <div className="rounded-md bg-background px-2 py-1.5">
                                    <span className="block text-[10px] font-semibold uppercase text-muted-foreground">Quantidade calculada</span>
                                    <strong className="text-foreground">{conta.volumeTexto} {conta.unidade}</strong>
                                    <span className="block text-[10px] text-muted-foreground">
                                      {peso.trim()} kg × {dose} ÷ {ref.concValor}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <span className="col-span-2 text-muted-foreground">
                                  {conta && !conta.ok
                                    ? conta.motivo
                                    : "Cálculo indisponível: falta dose ou concentração cadastrada."}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
            <label className="block text-xs font-semibold text-muted-foreground">
              Horário da primeira dose
              <input
                type="time"
                value={horarioInicial}
                onChange={(e) => setHorarioInicial(e.target.value)}
                className={`${campo} mt-1`}
              />
            </label>
            <div className="grid gap-1.5 sm:grid-cols-3">
              <CampoNomeMedicacao
                inputRef={nomeRef}
                value={nome}
                opcoes={sugestoes}
                onChange={(valor) => {
                  setNome(valor);
                  setRefCalculo(sugestoes.find((s) => s.nome.toLocaleLowerCase("pt-BR") === valor.trim().toLocaleLowerCase("pt-BR")) ?? null);
                  setUnidadeManual("");
                  setDoseUsada("");
                  setQuantidade("");
                }}
                onEscolher={(s) => {
                  setRefCalculo(s);
                  setUnidadeManual("");
                  setDoseUsada(s.dosePadrao);
                  setModoQuantidade("dose");
                  setQuantidade("");
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

              <div className="grid min-w-0 gap-1.5 sm:grid-cols-2">
                {refCalculo ? <label className="min-w-0">
                  <span className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">Dose ({refCalculo.unidadeDose})</span>
                  <input
                  ref={quantidadeRef}
                  inputMode="decimal"
                  value={doseExibida}
                  onChange={(e) => {
                    setModoQuantidade("dose");
                    setDoseUsada(e.target.value);
                    setQuantidade("");
                  }}

                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (duracao === DURACAO_OUTROS) outrosRef.current?.focus();
                      else enviar();
                    }
                  }}
                  enterKeyHint="next"
                  placeholder="Dose"
                  className={`${campo} min-w-0 flex-1`}
                  />
                </label> : <label className="min-w-0">
                  <span className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">Unidade informada</span>
                  <select aria-label="Unidade informada" value={unidadeManual}
                    className={`${campo} min-w-0`}
                    onChange={(e) => { setUnidadeManual(e.target.value); setQuantidade(""); }}>
                    <option value="">Selecione a unidade</option>
                    {UNIDADES_REGISTRO_MANUAL.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>}
                <label className="min-w-0">
                  <span className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">Quantidade{unidadeCalculada ? ` (${unidadeCalculada})` : ""}</span>
                  <input
                  value={volumeCalculado}
                  onChange={(e) => {
                    setModoQuantidade("ml");
                    setQuantidade(e.target.value);
                    setDoseUsada("");
                  }}
                  inputMode="decimal"
                  disabled={!unidadeCalculada}
                  aria-label={unidadeCalculada ? `Quantidade em ${unidadeCalculada}` : "Quantidade"}
                  className={`${campo} min-w-0`}
                  />
                </label>
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
            {refCalculo && calculo?.ok && (
              <p className="text-xs text-muted-foreground">
                Dose: {doseExibida} {refCalculo.unidadeDose} · Total: {calculo.doseTotalTexto}
                {" · "}Concentração: {refCalculo.concValor} {refCalculo.concUnidade}
              </p>
            )}
            {refCalculo && !calculo?.ok && (
              <p className="text-[11px] text-muted-foreground">
                {calculo?.motivo ?? "Informe a dose ou o volume para calcular."}
              </p>
            )}

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
