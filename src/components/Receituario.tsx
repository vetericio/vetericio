import { useEffect, useRef, useState } from "react";
import { FileDown, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useAnamneses } from "@/hooks/useAnamneses";
import { lerSelo, type TipoSelo } from "@/lib/assinatura";
import { racasParaEspecie, type EspecieReceituario } from "@/lib/racas";
import {
  baixarReceituario,
  ENDERECO_RECEITUARIO,
  FORMAS_MEDICAMENTO,
  INTERVALOS_RECEITUARIO,
  montarPosologia,
  type ItemReceituario,
  type PosicaoSeloReceituario,
} from "@/lib/receituario";

const campo =
  "mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-ring";
const rotulo = "text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground";
const escolha =
  "flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary";

const novoItem = (): ItemReceituario => ({
  id: crypto.randomUUID(),
  medicamento: "",
  apresentacao: "",
  quantidade: "",
  forma: "comprimido",
  intervalo: "12",
  dias: "",
  observacao: "",
});

const POSICOES_PADRAO: Record<TipoSelo, PosicaoSeloReceituario> = {
  assinatura: { x: 0.06, y: 0.2, largura: 0.32 },
  carimbo: { x: 0.58, y: 0.14, largura: 0.24 },
};

type CampoItem =
  "medicamento" | "apresentacao" | "quantidade" | "forma" | "intervalo" | "dias" | "observacao";

function especieDaAnamnese(valor: string): EspecieReceituario {
  if (valor === "Cachorro") return "Canina";
  if (valor === "Gato") return "Felina";
  return "Outro";
}

export function Receituario() {
  const { anamneses } = useAnamneses();
  const areaSelosRef = useRef<HTMLDivElement>(null);
  const [paciente, setPaciente] = useState("");
  const [tutor, setTutor] = useState("");
  const [especie, setEspecie] = useState<EspecieReceituario>("");
  const [outraEspecie, setOutraEspecie] = useState("");
  const [raca, setRaca] = useState("");
  const [sexo, setSexo] = useState("");
  const [peso, setPeso] = useState("");
  const [data, setData] = useState(() => new Date().toLocaleDateString("pt-BR"));
  const [itens, setItens] = useState<ItemReceituario[]>(() => [novoItem()]);
  const [observacoes, setObservacoes] = useState("");
  const [endereco, setEndereco] = useState(ENDERECO_RECEITUARIO);
  const [selos, setSelos] = useState<Record<TipoSelo, string | null>>({
    assinatura: null,
    carimbo: null,
  });
  const [posicoesSelos, setPosicoesSelos] = useState<
    Partial<Record<TipoSelo, PosicaoSeloReceituario>>
  >({});
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    const atualizar = () =>
      setSelos({ assinatura: lerSelo("assinatura"), carimbo: lerSelo("carimbo") });
    atualizar();
    window.addEventListener("veterico-selos", atualizar);
    window.addEventListener("storage", atualizar);
    return () => {
      window.removeEventListener("veterico-selos", atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, []);

  const escolherPaciente = (id: string) => {
    const anamnese = anamneses.find((item) => item.id === id);
    if (!anamnese) return;
    setPaciente(anamnese.animal);
    setEspecie(especieDaAnamnese(anamnese.especie));
    setOutraEspecie("");
    setPeso(anamnese.peso);
  };

  const mudarEspecie = (nova: EspecieReceituario) => {
    setEspecie(nova);
    if (nova !== "Outro") setOutraEspecie("");
    setRaca("");
  };

  const atualizarItem = (id: string, campoItem: CampoItem, valor: string) =>
    setItens((atual) =>
      atual.map((item) => (item.id === id ? { ...item, [campoItem]: valor } : item)),
    );

  const adicionarSelo = (tipo: TipoSelo) => {
    if (!selos[tipo]) {
      const artigo = tipo === "assinatura" ? "a assinatura" : "o carimbo";
      toast.error("Cadastre primeiro " + artigo + " em Assinar um documento.");
      return;
    }
    setPosicoesSelos((atual) => ({
      ...atual,
      [tipo]: atual[tipo] ?? POSICOES_PADRAO[tipo],
    }));
  };

  const iniciarGestoSelo = (
    evento: React.PointerEvent,
    tipo: TipoSelo,
    modo: "mover" | "tamanho",
  ) => {
    evento.preventDefault();
    evento.stopPropagation();
    const area = areaSelosRef.current;
    const inicial = posicoesSelos[tipo];
    if (!area || !inicial) return;
    const caixa = area.getBoundingClientRect();
    const xInicial = evento.clientX;
    const yInicial = evento.clientY;
    const alvo = evento.currentTarget as HTMLElement;
    alvo.setPointerCapture(evento.pointerId);

    const mover = (movimento: PointerEvent) => {
      const dx = (movimento.clientX - xInicial) / caixa.width;
      const dy = (movimento.clientY - yInicial) / caixa.height;
      setPosicoesSelos((atual) => {
        const item = atual[tipo] ?? inicial;
        if (modo === "tamanho") {
          const largura = Math.min(0.7, Math.max(0.12, inicial.largura + dx));
          return {
            ...atual,
            [tipo]: { ...item, largura, x: Math.min(item.x, 1 - largura) },
          };
        }
        return {
          ...atual,
          [tipo]: {
            ...item,
            x: Math.min(1 - item.largura, Math.max(0, inicial.x + dx)),
            y: Math.min(0.72, Math.max(0, inicial.y + dy)),
          },
        };
      });
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };

  const gerar = async () => {
    if (gerando) return;
    if (!paciente.trim()) {
      toast.error("Informe o nome do paciente.");
      return;
    }
    if (!itens.some((item) => item.medicamento.trim())) {
      toast.error("Informe ao menos um medicamento.");
      return;
    }
    if (!especie) {
      toast.error("Selecione a espécie.");
      return;
    }
    if (especie === "Outro" && !outraEspecie.trim()) {
      toast.error("Informe a outra espécie.");
      return;
    }
    setGerando(true);
    try {
      await baixarReceituario({
        paciente,
        tutor,
        especie: especie === "Outro" ? outraEspecie.trim() : especie,
        raca,
        sexo,
        peso,
        data,
        itens,
        observacoes,
        endereco,
        posicoesSelos,
      });
      toast.success("Receituário em PDF gerado.");
    } catch (erro) {
      console.error("Falha ao gerar receituário:", erro);
      toast.error("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setGerando(false);
    }
  };

  const racas = racasParaEspecie(especie);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 pb-28">
      <section>
        <h1 className="font-display text-xl font-semibold text-foreground">Receituário</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preencha somente o necessário e a receita sai completa.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="font-display font-semibold text-foreground">Paciente</h2>
        {anamneses.length > 0 && (
          <label className="mt-3 block">
            <span className={rotulo}>Puxar da Anamnese</span>
            <select
              defaultValue=""
              onChange={(e) => escolherPaciente(e.target.value)}
              className={campo}
            >
              <option value="">Preencher manualmente</option>
              {anamneses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.animal} {item.especie ? "· " + item.especie : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label>
            <span className={rotulo}>Paciente</span>
            <input
              value={paciente}
              onChange={(e) => setPaciente(e.target.value)}
              className={campo}
              placeholder="Nome do animal"
            />
          </label>
          <label>
            <span className={rotulo}>Tutor</span>
            <input
              value={tutor}
              onChange={(e) => setTutor(e.target.value)}
              className={campo}
              placeholder="Nome do responsável"
            />
          </label>
        </div>

        <fieldset className="mt-4">
          <legend className={rotulo}>Espécie</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["Canina", "Felina", "Outro"] as const).map((opcao) => (
              <label key={opcao} className={escolha}>
                <input
                  type="radio"
                  name="especie-receituario"
                  checked={especie === opcao}
                  onChange={() => mudarEspecie(opcao)}
                  className="accent-primary"
                />
                {opcao}
              </label>
            ))}
          </div>
        </fieldset>

        {especie === "Outro" && (
          <label className="mt-3 block">
            <span className={rotulo}>Qual espécie?</span>
            <input
              value={outraEspecie}
              onChange={(e) => setOutraEspecie(e.target.value)}
              className={campo}
              placeholder="Ex.: Equina"
            />
          </label>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-[1.4fr_0.7fr_0.55fr]">
          <label>
            <span className={rotulo}>Raça</span>
            <input
              value={raca}
              onChange={(e) => setRaca(e.target.value)}
              list="racas-receituario"
              className={campo}
              placeholder="SRD ou digite para procurar"
            />
            <datalist id="racas-receituario">
              {racas.map((opcao) => (
                <option key={opcao} value={opcao} />
              ))}
            </datalist>
          </label>
          <fieldset>
            <legend className={rotulo}>Sexo</legend>
            <div className="mt-1 flex gap-2">
              {["Macho", "Fêmea"].map((opcao) => (
                <label key={opcao} className={escolha}>
                  <input
                    type="radio"
                    name="sexo-receituario"
                    checked={sexo === opcao}
                    onChange={() => setSexo(opcao)}
                    className="accent-primary"
                  />
                  {opcao}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            <span className={rotulo}>Peso</span>
            <input
              value={peso}
              onChange={(e) => setPeso(e.target.value.replace(".", ","))}
              inputMode="decimal"
              className={campo}
              placeholder="kg"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display font-semibold text-foreground">Prescrição</h2>
          <button
            type="button"
            onClick={() => setItens((atual) => [...atual, novoItem()])}
            className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-secondary px-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70"
          >
            <Plus className="h-4 w-4" /> Medicamento
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {itens.map((item, indice) => {
            const posologia = montarPosologia(item);
            return (
              <article key={item.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{indice + 1}. Medicamento</p>
                  {itens.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setItens((atual) =>
                          atual.filter((medicamento) => medicamento.id !== item.id),
                        )
                      }
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                      aria-label={"Remover medicamento " + (indice + 1)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_0.48fr]">
                  <label>
                    <span className={rotulo}>Medicamento</span>
                    <input
                      value={item.medicamento}
                      onChange={(e) => atualizarItem(item.id, "medicamento", e.target.value)}
                      className={campo}
                      placeholder="Dipirona"
                    />
                  </label>
                  <label>
                    <span className={rotulo}>Apresentação</span>
                    <input
                      value={item.apresentacao}
                      onChange={(e) => atualizarItem(item.id, "apresentacao", e.target.value)}
                      className={campo}
                      placeholder="500 mg"
                    />
                  </label>
                </div>

                <p className={"mt-4 " + rotulo}>Posologia</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label>
                    <span className="text-xs text-muted-foreground">Quantidade</span>
                    <input
                      value={item.quantidade}
                      onChange={(e) => atualizarItem(item.id, "quantidade", e.target.value)}
                      inputMode="decimal"
                      className={campo}
                      placeholder="1"
                    />
                  </label>
                  <label>
                    <span className="text-xs text-muted-foreground">Forma</span>
                    <select
                      value={item.forma}
                      onChange={(e) => atualizarItem(item.id, "forma", e.target.value)}
                      className={campo}
                    >
                      {FORMAS_MEDICAMENTO.map((opcao) => (
                        <option key={opcao.valor} value={opcao.valor}>
                          {opcao.valor}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="text-xs text-muted-foreground">Intervalo</span>
                    <select
                      value={item.intervalo}
                      onChange={(e) => atualizarItem(item.id, "intervalo", e.target.value)}
                      className={campo}
                    >
                      {INTERVALOS_RECEITUARIO.map((horas) => (
                        <option key={horas} value={horas}>
                          {"a cada " + horas + "h"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="text-xs text-muted-foreground">Por quantos dias?</span>
                    <input
                      value={item.dias}
                      onChange={(e) => atualizarItem(item.id, "dias", e.target.value)}
                      inputMode="numeric"
                      className={campo}
                      placeholder="7"
                    />
                  </label>
                </div>

                <div className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-sm leading-relaxed text-primary">
                  {posologia || "A frase da posologia aparece aqui enquanto você preenche."}
                </div>
                <label className="mt-3 block">
                  <span className="text-xs text-muted-foreground">
                    Observação desta medicação (opcional)
                  </span>
                  <input
                    value={item.observacao}
                    onChange={(e) => atualizarItem(item.id, "observacao", e.target.value)}
                    className={campo}
                    placeholder="Ex.: administrar após alimentação"
                  />
                </label>
              </article>
            );
          })}
        </div>

        <label className="mt-4 block">
          <span className={rotulo}>Orientações gerais</span>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
            className={campo}
            placeholder="Orientações adicionais para o tutor (opcional)"
          />
        </label>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="font-display font-semibold text-foreground">Assinatura e carimbo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Adicione e arraste para definir onde cada um ficará no final da receita.
        </p>
        <div
          ref={areaSelosRef}
          className="relative mt-3 aspect-[595/150] touch-none select-none overflow-hidden rounded-xl border border-dashed border-primary/50 bg-white"
        >
          <p className="absolute left-3 top-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Área de assinatura e carimbo
          </p>
          {(["assinatura", "carimbo"] as TipoSelo[]).map((tipo) => {
            const posicao = posicoesSelos[tipo];
            const selo = selos[tipo];
            if (!posicao || !selo) return null;
            return (
              <div
                key={tipo}
                onPointerDown={(e) => iniciarGestoSelo(e, tipo, "mover")}
                className="absolute cursor-move rounded border border-dashed border-primary bg-white/40 p-0.5 shadow-sm"
                style={{
                  left: String(posicao.x * 100) + "%",
                  top: String(posicao.y * 100) + "%",
                  width: String(posicao.largura * 100) + "%",
                }}
              >
                <img
                  src={selo}
                  alt={tipo === "assinatura" ? "Assinatura" : "Carimbo"}
                  className="pointer-events-none max-h-16 w-full object-contain"
                />
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() =>
                    setPosicoesSelos((atual) => {
                      const proximo = { ...atual };
                      delete proximo[tipo];
                      return proximo;
                    })
                  }
                  className="absolute -left-2 -top-2 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                  aria-label={"Remover " + tipo}
                >
                  <X className="h-3 w-3" />
                </button>
                <span
                  onPointerDown={(e) => iniciarGestoSelo(e, tipo, "tamanho")}
                  className="absolute -bottom-2 -right-2 h-5 w-5 cursor-se-resize rounded-full border border-background bg-primary"
                  aria-label={"Ajustar tamanho de " + tipo}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["assinatura", "carimbo"] as TipoSelo[]).map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => adicionarSelo(tipo)}
              className="rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70"
            >
              {tipo === "assinatura" ? "+ Assinatura" : "+ Carimbo"}
            </button>
          ))}
        </div>
        {!selos.assinatura && !selos.carimbo && (
          <p className="mt-2 text-xs text-muted-foreground">
            Cadastre a assinatura e o carimbo em Assinar um documento.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="font-display font-semibold text-foreground">Final da receita</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[0.7fr_1.3fr]">
          <label>
            <span className={rotulo}>Data</span>
            <input
              value={data}
              onChange={(e) => setData(e.target.value)}
              className={campo}
              placeholder="dd/mm/aaaa"
            />
          </label>
          <label>
            <span className={rotulo}>Endereço</span>
            <textarea
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              rows={2}
              className={campo}
              placeholder="Endereço que aparecerá no final da folha"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          A data aparece somente no final do PDF.
        </p>
      </section>

      <button
        type="button"
        onClick={() => void gerar()}
        disabled={gerando}
        className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 mx-auto flex min-h-14 w-auto max-w-3xl items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-base font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 disabled:opacity-60"
      >
        <FileDown className="h-5 w-5" />
        {gerando ? "Gerando PDF…" : "Gerar receituário em PDF"}
      </button>
    </main>
  );
}
