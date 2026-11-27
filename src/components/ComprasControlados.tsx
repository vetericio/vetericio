import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listarComprasControlados,
  listarProdutosCompraControlados,
  salvarCompraControlado,
  type CompraControlado as Compra,
  type ProdutoCompraControlado as Produto,
} from "@/lib/compras-controlados.functions";
import { dataBR, diaNoFuso, periodoValido } from "@/lib/relatorios";

type Props = {
  clinicaId: string;
  podeEditar: boolean;
  modo: "registro" | "pendencias";
  onSalva?: () => void;
};
type Campos = {
  dataCompra: string;
  quantidade: string;
  fornecedor: string;
  notaFiscal: string;
  lote: string;
};

const controle =
  "mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const primario =
  "min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60";
const secundario =
  "min-h-11 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold disabled:opacity-60";
const hoje = () => diaNoFuso(new Date().toISOString());
const novosCampos = (): Campos => ({
  dataCompra: hoje(),
  quantidade: "",
  fornecedor: "",
  notaFiscal: "",
  lote: "",
});
const camposCompra = (c: Compra): Campos => ({
  dataCompra: c.dataCompra,
  quantidade: c.quantidade?.toString().replace(".", ",") ?? "",
  fornecedor: c.fornecedor ?? "",
  notaFiscal: c.notaFiscal ?? "",
  lote: c.lote ?? "",
});
const formatarQuantidade = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 });

async function tokenCompra() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Sessão indisponível.");
  return data.session.access_token;
}

function faltantes(c: Compra): string[] {
  return [
    !(c.quantidade != null && c.quantidade > 0) && "quantidade",
    !c.fornecedor?.trim() && "fornecedor",
    !c.notaFiscal?.trim() && "número da nota fiscal",
    !c.lote?.trim() && "lote",
  ].filter((item): item is string => !!item);
}

export function ComprasControlados(props: Props) {
  // A troca de clínica ou aba nunca carrega formulário, lista ou resultado de outra seleção.
  return <ComprasControladosPainel key={`${props.clinicaId}:${props.modo}`} {...props} />;
}

function ComprasControladosPainel({ clinicaId, modo, podeEditar, onSalva }: Props) {
  const pendencias = modo === "pendencias";
  const [lista, setLista] = useState<Compra[]>([]);
  const [lendo, setLendo] = useState(pendencias);
  const [erroLista, setErroLista] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const [editando, setEditando] = useState<Compra | null>(null);
  const [produto, setProduto] = useState<Produto | null>(null);
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Produto[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState("");
  const [campos, setCampos] = useState<Campos>(novosCampos);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState("");
  const [confirma, setConfirma] = useState(false);
  const [salva, setSalva] = useState<Compra | null>(null);
  const ativo = useRef(false);
  const buscandoAgora = useRef(false);
  const salvandoAgora = useRef(false);
  const versaoBusca = useRef(0);
  const requestId = useRef<string | null>(null);
  const dataRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ativo.current = true;
    return () => {
      ativo.current = false;
    };
  }, []);

  useEffect(() => {
    if (!pendencias) return;
    let cancelado = false;
    setLendo(true);
    setErroLista(false);
    async function carregar() {
      try {
        const resposta = await listarComprasControlados({
          data: { accessToken: await tokenCompra(), clinicaId, somentePendencias: true },
        });
        if (!cancelado) setLista(resposta.filter((item) => item.status === "pendente"));
      } catch {
        if (!cancelado) {
          setLista([]);
          setErroLista(true);
        }
      } finally {
        if (!cancelado) setLendo(false);
      }
    }
    void carregar();
    return () => {
      cancelado = true;
    };
  }, [clinicaId, pendencias, revisao]);

  const editandoId = editando?.id;
  useEffect(() => {
    if (editandoId) dataRef.current?.focus();
  }, [editandoId]);

  function limparBusca() {
    // Ignora resposta tardia de uma pesquisa anterior após trocar o produto/registro.
    versaoBusca.current++;
    buscandoAgora.current = false;
    setBuscando(false);
    setBusca("");
    setResultados(null);
    setErroBusca("");
  }

  function abrirCompra(c: Compra) {
    if (!podeEditar || c.status !== "pendente" || salvandoAgora.current) return;
    limparBusca();
    setEditando(c);
    setProduto({ id: c.produtoId, nome: c.produtoNome });
    setCampos(camposCompra(c));
    setErroForm("");
    setSalva(null);
    setConfirma(false);
  }

  function limparCompra() {
    requestId.current = null;
    limparBusca();
    setEditando(null);
    setProduto(null);
    setCampos(novosCampos());
    setErroForm("");
    setConfirma(false);
  }

  async function buscarProdutos() {
    if (!podeEditar || buscandoAgora.current || salvandoAgora.current || confirma) return;
    const termo = busca.trim();
    setResultados(null);
    if (termo.length < 2) {
      setErroBusca("Digite pelo menos 2 caracteres do nome do produto.");
      return;
    }
    const versao = ++versaoBusca.current;
    buscandoAgora.current = true;
    setBuscando(true);
    setErroBusca("");
    try {
      const resposta = await listarProdutosCompraControlados({
        data: { accessToken: await tokenCompra(), clinicaId, busca: termo },
      });
      if (ativo.current && versao === versaoBusca.current) setResultados(resposta);
    } catch {
      if (ativo.current && versao === versaoBusca.current) {
        setErroBusca("Não foi possível buscar no catálogo. Tente novamente.");
      }
    } finally {
      if (ativo.current && versao === versaoBusca.current) {
        buscandoAgora.current = false;
        setBuscando(false);
      }
    }
  }

  function dadosValidados(finalizar: boolean) {
    if (!produto) {
      setErroForm("Busque e selecione um produto do catálogo.");
      return null;
    }
    if (!periodoValido(campos.dataCompra, campos.dataCompra) || campos.dataCompra > hoje()) {
      setErroForm("Informe uma data de compra válida, até hoje.");
      return null;
    }
    const quantidadeTexto = campos.quantidade.trim();
    const quantidade = quantidadeTexto ? Number(quantidadeTexto.replace(",", ".")) : null;
    if (
      quantidadeTexto &&
      (!/^\d+(?:[.,]\d{1,3})?$/.test(quantidadeTexto) ||
        quantidade === null ||
        !Number.isFinite(quantidade) ||
        quantidade <= 0 ||
        quantidade > 999_999_999_999.999)
    ) {
      setErroForm(
        "Informe uma quantidade maior que zero, com até 12 dígitos inteiros e 3 casas decimais (ex.: 1,5).",
      );
      return null;
    }
    const fornecedor = campos.fornecedor.trim() || null;
    const notaFiscal = campos.notaFiscal.trim() || null;
    const lote = campos.lote.trim() || null;
    if (finalizar && (quantidade === null || !fornecedor || !notaFiscal || !lote)) {
      setErroForm(
        "Para confirmar a compra, preencha quantidade, fornecedor, número da nota fiscal e lote.",
      );
      return null;
    }
    return {
      compra: {
        ...(editando ? { id: editando.id } : {}),
        dataCompra: campos.dataCompra,
        produtoId: produto.id,
        quantidade,
        fornecedor,
        notaFiscal,
        lote,
        finalizar,
      },
    };
  }

  async function salvar(finalizar: boolean) {
    if (!podeEditar || salvandoAgora.current) return;
    const dados = dadosValidados(finalizar);
    if (!dados) return;
    salvandoAgora.current = true;
    setSalvando(true);
    setErroForm("");
    try {
      const chaveNovaCompra = editando
        ? {}
        : { requestId: (requestId.current ??= crypto.randomUUID()) };
      const resposta = await salvarCompraControlado({
        data: { accessToken: await tokenCompra(), clinicaId, ...dados.compra, ...chaveNovaCompra },
      });
      if (!ativo.current) return;
      limparCompra();
      setSalva(resposta);
      if (pendencias) {
        setLista((atual) =>
          resposta.status === "completo"
            ? atual.filter((item) => item.id !== resposta.id)
            : atual.map((item) => (item.id === resposta.id ? resposta : item)),
        );
        setRevisao((v) => v + 1);
      }
      onSalva?.();
    } catch {
      if (ativo.current) {
        setErroForm(
          "Não foi possível salvar a compra. Verifique seu acesso e se o registro ainda está pendente, depois tente novamente.",
        );
      }
    } finally {
      salvandoAgora.current = false;
      if (ativo.current) setSalvando(false);
    }
  }

  function prepararConfirmacao(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (salvando || confirma || !podeEditar) return;
    setErroForm("");
    if (dadosValidados(true)) setConfirma(true);
  }

  const exibirFormulario = podeEditar && (!pendencias || !!editando);

  return (
    <section
      aria-label={pendencias ? "Pendências de compras" : "Registro de compra de controlado"}
      className="space-y-4 rounded-xl border bg-card p-4"
    >
      <div>
        <h2 className="text-base font-bold">
          {pendencias ? "Pendências de compras" : "Registrar compra de controlado"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O registro serve para controle documental. Não altera nem dá entrada no estoque.
        </p>
        {!podeEditar && (
          <p className="mt-1 text-sm text-muted-foreground">
            Seu acesso permite consulta, mas não registrar nem alterar compras.
          </p>
        )}
      </div>
      {salva && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 p-3 text-sm"
        >
          <div>
            <strong>{salva.status === "completo" ? "Compra confirmada" : "Rascunho salvo"}</strong>
            <div className="break-words">
              {salva.produtoNome} · {dataBR(salva.dataCompra)}
            </div>
            <div className="break-words text-muted-foreground">
              Registrado por: {salva.autorNome || "Não informado"}
            </div>
          </div>
          {salva.status === "pendente" && podeEditar && !pendencias && (
            <button type="button" className={secundario} onClick={() => abrirCompra(salva)}>
              Continuar rascunho
            </button>
          )}
        </div>
      )}

      {pendencias && (
        <div className="space-y-3">
          {lendo ? (
            <p role="status" className="text-sm text-muted-foreground">
              Buscando registros pendentes…
            </p>
          ) : erroLista ? (
            <div className="flex flex-wrap items-center gap-2">
              <p role="alert" className="text-sm text-destructive">
                Não foi possível consultar as pendências.
              </p>
              <button type="button" className={secundario} onClick={() => setRevisao((v) => v + 1)}>
                Tentar novamente
              </button>
            </div>
          ) : !lista.length ? (
            <p role="status" className="text-sm text-muted-foreground">
              Nenhuma compra pendente.
            </p>
          ) : (
            <ul className="space-y-2">
              {lista.map((c) => {
                const pendente = faltantes(c);
                return (
                  <li
                    key={c.id}
                    className="flex flex-col justify-between gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 break-words">
                      <p className="font-bold">
                        {c.produtoNome} · {dataBR(c.dataCompra)}
                      </p>
                      <p>
                        {pendente.length
                          ? `Falta preencher: ${pendente.join(", ")}.`
                          : "Pronta para conferência e confirmação."}
                      </p>
                      <p className="text-muted-foreground">
                        Registrado por: {c.autorNome || "Não informado"}
                        {c.quantidade != null
                          ? ` · Quantidade: ${formatarQuantidade.format(c.quantidade)}`
                          : ""}
                      </p>
                    </div>
                    {podeEditar && (
                      <button
                        type="button"
                        className={secundario}
                        disabled={salvando || editando?.id === c.id}
                        aria-label={`Abrir rascunho de ${c.produtoNome}, ${dataBR(c.dataCompra)}`}
                        onClick={() => abrirCompra(c)}
                      >
                        {editando?.id === c.id ? "Em edição" : "Abrir rascunho"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {exibirFormulario && (
        <form className="space-y-4" onSubmit={prepararConfirmacao}>
          {editando && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3 text-sm">
              <strong>Editando rascunho de {editando.produtoNome}</strong>
              <span className="text-muted-foreground">
                Registrado por: {editando.autorNome || "Não informado"}
              </span>
            </div>
          )}
          <fieldset
            disabled={salvando || confirma}
            className="min-w-0 space-y-4 disabled:opacity-70"
          >
            {produto ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <p className="min-w-0 break-words">
                  <strong>Produto:</strong> {produto.nome}
                </p>
                <button
                  type="button"
                  className={secundario}
                  onClick={() => {
                    setProduto(null);
                    limparBusca();
                  }}
                >
                  Trocar produto
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label className="min-w-0 flex-1 text-sm font-semibold">
                    Buscar produto no catálogo
                    <input
                      className={controle}
                      type="search"
                      value={busca}
                      maxLength={80}
                      placeholder="Digite o nome do produto"
                      autoComplete="off"
                      disabled={buscando}
                      onChange={(e) => {
                        setBusca(e.target.value);
                        setResultados(null);
                        setErroBusca("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void buscarProdutos();
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className={secundario}
                    disabled={buscando}
                    onClick={() => {
                      void buscarProdutos();
                    }}
                  >
                    {buscando ? "Buscando…" : "Buscar"}
                  </button>
                </div>
                {erroBusca && (
                  <p role="alert" className="text-sm text-destructive">
                    {erroBusca}
                  </p>
                )}
                {resultados !== null &&
                  (resultados.length ? (
                    <ul
                      aria-label="Produtos encontrados"
                      className="max-h-64 divide-y overflow-auto rounded-lg border"
                    >
                      {resultados.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="min-h-11 w-full break-words p-3 text-left text-sm font-semibold hover:bg-muted"
                            onClick={() => {
                              setProduto(item);
                              limparBusca();
                              setErroForm("");
                            }}
                          >
                            {item.nome}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p role="status" className="text-sm text-muted-foreground">
                      Nenhum produto do catálogo encontrado. Tente outro nome.
                    </p>
                  ))}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="min-w-0 text-sm font-semibold">
                Data da compra
                <input
                  ref={dataRef}
                  type="date"
                  max={hoje()}
                  required
                  className={controle}
                  value={campos.dataCompra}
                  onChange={(e) => setCampos({ ...campos, dataCompra: e.target.value })}
                />
              </label>
              <label className="min-w-0 text-sm font-semibold">
                Quantidade
                <input
                  className={controle}
                  inputMode="decimal"
                  value={campos.quantidade}
                  maxLength={20}
                  onChange={(e) => setCampos({ ...campos, quantidade: e.target.value })}
                />
              </label>
              <label className="min-w-0 text-sm font-semibold">
                Fornecedor
                <input
                  className={controle}
                  value={campos.fornecedor}
                  maxLength={180}
                  onChange={(e) => setCampos({ ...campos, fornecedor: e.target.value })}
                />
              </label>
              <label className="min-w-0 text-sm font-semibold">
                Número da nota fiscal
                <input
                  className={controle}
                  value={campos.notaFiscal}
                  maxLength={100}
                  placeholder="Somente o identificador; sem anexo"
                  onChange={(e) => setCampos({ ...campos, notaFiscal: e.target.value })}
                />
              </label>
              <label className="min-w-0 text-sm font-semibold">
                Lote
                <input
                  className={controle}
                  value={campos.lote}
                  maxLength={100}
                  onChange={(e) => setCampos({ ...campos, lote: e.target.value })}
                />
              </label>
            </div>
          </fieldset>
          {erroForm && (
            <p role="alert" className="text-sm text-destructive">
              {erroForm}
            </p>
          )}
          {confirma ? (
            <div aria-label="Confirmar compra" className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-semibold">
                Depois de confirmada, a compra não poderá ser editada por aqui.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={primario}
                  disabled={salvando}
                  onClick={() => {
                    void salvar(true);
                  }}
                >
                  {salvando ? "Confirmando…" : "Confirmar registro definitivo"}
                </button>
                <button
                  type="button"
                  className={secundario}
                  disabled={salvando}
                  onClick={() => setConfirma(false)}
                >
                  Voltar aos campos
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Para guardar um rascunho, basta selecionar o produto e informar a data. Você pode
                concluir os demais campos em Pendências.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className={primario} disabled={salvando}>
                  Confirmar compra
                </button>
                <button
                  type="button"
                  className={secundario}
                  disabled={salvando}
                  onClick={() => {
                    void salvar(false);
                  }}
                >
                  {salvando ? "Salvando…" : "Salvar rascunho"}
                </button>
                {editando && (
                  <button
                    type="button"
                    className={secundario}
                    disabled={salvando}
                    onClick={limparCompra}
                  >
                    Fechar edição
                  </button>
                )}
              </div>
            </>
          )}
        </form>
      )}
    </section>
  );
}
