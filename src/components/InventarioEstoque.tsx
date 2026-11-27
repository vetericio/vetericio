import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { useDemoAlvorada } from "@/lib/demo-alvorada-context";
import { supabaseBanco } from "@/integrations/supabase/client";
import {
  calcularDiferencaInventario,
  calcularReposicao,
  COBERTURAS_INVENTARIO,
  interpretarContagem,
  type ProdutoInventario,
  type RegistroInventario,
} from "@/lib/inventario-estoque";

type Modo = "contagem" | "reposicao" | "historico";
type Props = {
  clinicaId: string;
  podeContar: boolean;
  aoContar: (aindaAtivo: () => boolean) => Promise<void>;
};
const banco = supabaseBanco as unknown as SupabaseClient;
const campo = "w-full min-h-11 rounded-lg border bg-background px-3 py-2 text-base";
const botao = "min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50";
const principal = botao + " bg-primary text-primary-foreground";
const pt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const formatar = (valor: number | null) => (valor === null ? "Não informado" : pt.format(valor));
const dataBR = (iso: string) => iso.split("-").reverse().join("/");
const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
const sinal = (valor: number | null) =>
  valor === null ? "Não calculada" : (valor > 0 ? "+" : "") + pt.format(valor);

export function InventarioEstoque({ clinicaId, podeContar, aoContar }: Props) {
  const demoAlvorada = useDemoAlvorada();
  const podeRegistrar = podeContar && !demoAlvorada;
  const [modo, setModo] = useState<Modo | null>(null);
  const [busca, setBusca] = useState("");
  const [consulta, setConsulta] = useState("");
  const [versao, setVersao] = useState(0);
  const [produtos, setProdutos] = useState<ProdutoInventario[]>([]);
  const [limite, setLimite] = useState(false);
  const [historico, setHistorico] = useState<RegistroInventario[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erroListagem, setErroListagem] = useState("");
  const [cobertura, setCobertura] = useState<(typeof COBERTURAS_INVENTARIO)[number]>(7);
  const [produto, setProduto] = useState<ProdutoInventario | null>(null);
  const [contagem, setContagem] = useState("");
  const [motivo, setMotivo] = useState("");
  const [revisando, setRevisando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [conflito, setConflito] = useState(false);
  const [erroContagem, setErroContagem] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const pedido = useRef<{ chave: string; id: string } | null>(null);
  const ativo = useRef(false);
  const salvamento = useRef(false);
  const campoContagem = useRef<HTMLInputElement>(null);
  const quantidade = interpretarContagem(contagem);

  useEffect(() => {
    ativo.current = true;
    return () => {
      ativo.current = false;
    };
  }, []);

  useEffect(() => {
    if (!modo || !clinicaId) return;
    const abort = new AbortController();
    setCarregando(true);
    setErroListagem("");
    void (async () => {
      try {
        if (modo === "historico") {
          const r = await banco
            .from("oricse_estoque_contagens")
            .select(
              "id,produto_nome,saldo_sistema,saldo_contado,diferenca,motivo,operador_id,registrado_em",
            )
            .eq("clinica_id", clinicaId)
            .order("registrado_em", { ascending: false })
            .order("id", { ascending: false })
            .limit(50)
            .abortSignal(abort.signal);
          if (r.error) throw r.error;
          if (!abort.signal.aborted) setHistorico(r.data ?? []);
        } else {
          const r = await banco
            .rpc("oricse_estoque_observado", {
              p_clinica_id: clinicaId,
              p_busca: consulta,
            })
            .abortSignal(abort.signal);
          if (r.error || !Array.isArray(r.data?.produtos)) throw r.error ?? new Error();
          if (!abort.signal.aborted) {
            setProdutos(r.data.produtos);
            setLimite(r.data.limite === true);
          }
        }
      } catch {
        if (!abort.signal.aborted)
          setErroListagem("Não foi possível consultar esta seção de estoque.");
      } finally {
        if (!abort.signal.aborted) setCarregando(false);
      }
    })();
    return () => abort.abort();
  }, [clinicaId, consulta, modo, versao]);

  useEffect(() => {
    if (produto) campoContagem.current?.focus();
  }, [produto]);

  function limparContagem() {
    setProduto(null);
    setContagem("");
    setMotivo("");
    setRevisando(false);
    setConflito(false);
    setErroContagem("");
    pedido.current = null;
  }

  function abrirModo(novo: Modo) {
    if (salvamento.current) return;
    limparContagem();
    setConfirmacao("");
    setModo(modo === novo ? null : novo);
  }

  async function salvarContagem() {
    if (
      !podeRegistrar ||
      !produto ||
      quantidade === null ||
      !revisando ||
      salvamento.current ||
      conflito
    )
      return;
    const textoMotivo = motivo.trim();
    const chave = JSON.stringify([
      clinicaId,
      produto.id,
      quantidade,
      produto.estoque_atual,
      produto.updated_at,
      textoMotivo,
    ]);
    if (pedido.current?.chave !== chave) pedido.current = { chave, id: crypto.randomUUID() };
    salvamento.current = true;
    setSalvando(true);
    setErroContagem("");
    let gravada = false;
    try {
      const r = await banco.rpc("oricse_estoque_registrar_contagem", {
        p_clinica_id: clinicaId,
        p_produto_id: produto.id,
        p_saldo_contado: quantidade,
        p_saldo_esperado: produto.estoque_atual,
        p_referencia_em: produto.updated_at,
        p_motivo: textoMotivo,
        p_requisicao_id: pedido.current.id,
      });
      if (!ativo.current) return;
      if (r.error?.code === "40001") {
        setConflito(true);
        setErroContagem(
          "O estoque mudou após a leitura. Atualize o saldo e reconte antes de confirmar.",
        );
      } else if (r.error?.code === "42501") {
        setErroContagem("Você não tem permissão para registrar uma contagem nesta clínica.");
      } else if (r.error || !r.data?.id) {
        setErroContagem(
          "Não foi possível confirmar a gravação. Tente confirmar novamente sem editar os dados.",
        );
      } else {
        gravada = true;
        setConfirmacao(`${produto.nome}: contagem de ${formatar(quantidade)} registrada.`);
        limparContagem();
        setVersao((v) => v + 1);
        await aoContar(() => ativo.current);
      }
    } catch {
      if (ativo.current && !gravada)
        setErroContagem(
          "Não foi possível confirmar a gravação. Tente confirmar novamente sem editar os dados.",
        );
      if (ativo.current && gravada)
        setConfirmacao(
          "Contagem registrada. Atualize a página se o saldo da lista principal ainda não mudar.",
        );
    } finally {
      salvamento.current = false;
      if (ativo.current) setSalvando(false);
    }
  }

  return (
    <section
      aria-label="Inventário e reposição"
      className="space-y-3 rounded-2xl border bg-card p-4"
    >
      <div>
        <h3 className="font-bold">Inventário e reposição</h3>
        <p className="text-sm text-muted-foreground">
          Confira o saldo físico, acompanhe as diferenças e planeje compras pelo que saiu no PDV.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ...(podeRegistrar ? [["contagem", "Contagem física"]] : []),
            ["reposicao", "Reposição por consumo"],
            ["historico", "Histórico de contagens"],
          ] as [Modo, string][]
        ).map(([id, texto]) => (
          <button
            key={id}
            type="button"
            aria-pressed={modo === id}
            disabled={salvando}
            className={modo === id ? principal : botao}
            onClick={() => abrirModo(id)}
          >
            {texto}
          </button>
        ))}
      </div>
      {confirmacao && (
        <p role="status" className="text-sm font-semibold text-primary">
          {confirmacao}
        </p>
      )}
      {modo && (
        <div className="space-y-3 border-t pt-3">
          {modo !== "historico" && !produto && (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setConsulta(busca.trim());
                setVersao((v) => v + 1);
              }}
            >
              <label className="min-w-[13rem] flex-1 text-sm font-semibold">
                Buscar produto
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  maxLength={90}
                  placeholder="Nome ou código de barras"
                  className={campo}
                />
              </label>
              <button type="submit" className={botao}>
                Buscar
              </button>
            </form>
          )}
          {modo === "reposicao" && (
            <div className="space-y-2 text-sm">
              <label className="block max-w-52 font-semibold">
                Cobertura desejada
                <select
                  className={campo}
                  value={cobertura}
                  onChange={(e) => {
                    const valor = COBERTURAS_INVENTARIO.find(
                      (dias) => String(dias) === e.target.value,
                    );
                    if (valor) setCobertura(valor);
                  }}
                >
                  {COBERTURAS_INVENTARIO.map((dias) => (
                    <option key={dias} value={dias}>
                      {dias} dias
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-muted-foreground">
                Usa as quantidades vendidas no PDV em até 30 dias completos (sem hoje), a partir do
                primeiro dia inteiro após o início do PDV na clínica e o cadastro do produto. Com
                pelo menos 7 dias completos observados e alguma venda, calcula a média diária e a
                cobertura escolhida, respeita o mínimo cadastrado e desconta o saldo atual.
              </p>
              <p className="text-muted-foreground">
                Ajustes de estoque, contagens e consumo fora do PDV não entram. A sugestão não prevê
                demanda, rupturas ou prazo de entrega e não cria pedidos.
              </p>
            </div>
          )}
          {carregando ? (
            <p role="status" className="text-sm">
              Consultando estoque…
            </p>
          ) : erroListagem ? (
            <div className="flex flex-wrap items-center gap-2">
              <p role="alert" className="text-sm text-destructive">
                {erroListagem}
              </p>
              <button type="button" className={botao} onClick={() => setVersao((v) => v + 1)}>
                Tentar novamente
              </button>
            </div>
          ) : modo === "historico" ? (
            <>
              <p className="text-sm text-muted-foreground">
                Até 50 contagens recentes. O operador é identificado pela sessão; o registro
                original não pode ser editado nesta tela.
              </p>
              {!historico.length && <p className="text-sm">Nenhuma contagem registrada.</p>}
              <ul className="space-y-2">
                {historico.map((r) => (
                  <li key={r.id} className="space-y-1 rounded-lg border p-3 text-sm">
                    <strong>{r.produto_nome}</strong>
                    <p>
                      {quando(r.registrado_em)} · Operador{" "}
                      <code className="break-all">{r.operador_id}</code>
                    </p>
                    <p>
                      Sistema: {formatar(r.saldo_sistema)} · Contado: {formatar(r.saldo_contado)} ·
                      Diferença: {sinal(r.diferenca)}
                    </p>
                    <p className="break-words">Motivo: {r.motivo}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : modo === "contagem" && produto ? (
            <form
              className="space-y-3 rounded-xl border p-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (revisando) return;
                if (quantidade === null || motivo.trim().length < 5) {
                  setErroContagem(
                    "Informe uma quantidade válida e um motivo com pelo menos 5 caracteres.",
                  );
                  return;
                }
                setErroContagem("");
                setRevisando(true);
              }}
            >
              <h4 className="font-bold">{produto.nome}</h4>
              <p className="text-sm">
                Saldo na leitura: <strong>{formatar(produto.estoque_atual)}</strong>
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Quantidade física {produto.venda_por_peso ? "(kg)" : "(unidades)"}
                  <input
                    ref={campoContagem}
                    value={contagem}
                    inputMode="decimal"
                    required
                    className={campo}
                    maxLength={13}
                    readOnly={revisando}
                    onChange={(e) => setContagem(e.target.value)}
                    placeholder="Ex.: 12 ou 0"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Motivo da contagem
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className={campo}
                    maxLength={300}
                    minLength={5}
                    required
                    readOnly={revisando}
                    rows={2}
                    placeholder="Ex.: conferência física semanal"
                  />
                </label>
              </div>
              {quantidade !== null && (
                <p className="text-sm">
                  Diferença:{" "}
                  <strong>
                    {sinal(calcularDiferencaInventario(produto.estoque_atual, quantidade))}
                  </strong>
                  {produto.estoque_atual === null &&
                    " · Sem saldo anterior; a contagem inicializa o saldo, sem inventar diferença."}
                </p>
              )}
              {erroContagem && (
                <p role="alert" className="text-sm text-destructive">
                  {erroContagem}
                </p>
              )}
              {conflito ? (
                <button
                  type="button"
                  className={botao}
                  onClick={() => {
                    limparContagem();
                    setVersao((v) => v + 1);
                  }}
                >
                  Atualizar e recontar
                </button>
              ) : revisando ? (
                <>
                  <p className="text-sm font-semibold">
                    Ao confirmar, o saldo será igual à quantidade contada e a operação ficará
                    registrada no histórico.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={principal}
                      onClick={() => void salvarContagem()}
                      disabled={salvando}
                    >
                      {salvando ? "Confirmando…" : "Confirmar contagem"}
                    </button>
                    <button
                      type="button"
                      className={botao}
                      disabled={salvando}
                      onClick={() => setRevisando(false)}
                    >
                      Voltar e conferir
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className={principal}>
                    Revisar contagem
                  </button>
                  <button type="button" className={botao} onClick={limparContagem}>
                    Voltar aos produtos
                  </button>
                </div>
              )}
            </form>
          ) : (
            <>
              {!produtos.length && <p className="text-sm">Nenhum produto encontrado.</p>}
              {limite && (
                <p role="status" className="text-sm">
                  Mostrando até 80 produtos. Use a busca para localizar outros.
                </p>
              )}
              <ul className="space-y-2">
                {produtos.map((p) => {
                  const sugestao = calcularReposicao(p, cobertura);
                  const unidade = p.venda_por_peso ? "kg" : "un.";
                  return (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                    >
                      <div className="min-w-0 flex-1 break-words">
                        <strong>{p.nome}</strong>
                        {p.codigo_barras && (
                          <p className="text-muted-foreground">Código: {p.codigo_barras}</p>
                        )}
                        <p>
                          Saldo: {formatar(p.estoque_atual)} · Mínimo cadastrado:{" "}
                          {formatar(p.estoque_minimo)}
                        </p>
                        {modo === "reposicao" && (
                          <>
                            {p.inicio && (
                              <p>
                                PDV: {formatar(p.quantidade)} {unidade} em {p.dias} dias (
                                {dataBR(p.inicio)} a {dataBR(p.fim)}).
                              </p>
                            )}
                            {sugestao.tipo === "observado" ? (
                              <p className="font-semibold">
                                Reposição para {cobertura} dias: {formatar(sugestao.repor)}{" "}
                                {unidade} · Média observada: {formatar(sugestao.media)} {unidade}
                                /dia
                              </p>
                            ) : (
                              <p className="text-muted-foreground">
                                {sugestao.tipo === "sem-saldo"
                                  ? "Sem sugestão: registre primeiro o saldo físico."
                                  : "Sem sugestão: são necessários ao menos 7 dias completos e uma venda registrada no período."}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      {modo === "contagem" && podeRegistrar && (
                        <button
                          type="button"
                          className={botao}
                          aria-label={`Contar ${p.nome}`}
                          onClick={() => {
                            limparContagem();
                            setConfirmacao("");
                            setProduto(p);
                          }}
                        >
                          Contar
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
