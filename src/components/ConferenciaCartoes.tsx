import { useEffect, useState, type FormEvent } from "react";
import { supabaseBanco } from "@/integrations/supabase/client";
import {
  lerValorConferencia,
  pagamentoEmCartao,
  situacaoConferencia,
} from "@/lib/conferencia-cartoes";

type Movimento = {
  id: string;
  descricao: string;
  valor_centavos: number;
  forma_pagamento: string;
  registrado_em: string;
  status: string;
  tipo: string;
};
type Registro = {
  id: string;
  lancamento_id: string;
  liquido_esperado_centavos: number;
  recebido_centavos: number;
  depositado_em: string;
  conferido_em: string;
  anotacao: string;
};
const moeda = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const data = (iso: string) => iso.split("-").reverse().join("/");
const diaSaoPaulo = (instante: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
const campo = "mt-1 min-h-10 w-full rounded-lg border bg-background px-2";

export function ConferenciaCartoes({
  clinicaId,
  movimentos,
  podeEditar,
  carregando,
  erroCaixa,
}: {
  clinicaId: string;
  movimentos: Movimento[];
  podeEditar: boolean;
  carregando: boolean;
  erroCaixa: string;
}) {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [aberto, setAberto] = useState("");
  const [esperado, setEsperado] = useState("");
  const [recebido, setRecebido] = useState("");
  const [deposito, setDeposito] = useState("");
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const [maisAntigos, setMaisAntigos] = useState(false);
  const cliente = supabaseBanco;
  useEffect(() => {
    let atual = true;
    setPronto(false);
    setErro("");
    if (!clinicaId) return;
    void (async () => {
      const itens: Registro[] = [];
      for (let pagina = 0; pagina < 20; pagina++) {
        const { data, error } = await cliente
          .from("oricse_conferencia_cartoes")
          .select(
            "id,lancamento_id,liquido_esperado_centavos,recebido_centavos,depositado_em,conferido_em,anotacao",
          )
          .eq("clinica_id", clinicaId)
          .order("conferido_em", { ascending: false })
          .order("id", { ascending: false })
          .range(pagina * 500, pagina * 500 + 499);
        if (!atual) return;
        if (error) {
          setErro("Não foi possível carregar a conferência.");
          return;
        }
        itens.push(...(data ?? []));
        if ((data?.length ?? 0) < 500) {
          setRegistros(itens);
          setPronto(true);
          return;
        }
      }
      setErro("O histórico excede o limite de consulta. Nenhuma conferência foi alterada.");
    })().catch(() => {
      if (atual) setErro("Não foi possível carregar a conferência.");
    });
    return () => {
      atual = false;
    };
  }, [clinicaId, cliente, revisao]);
  const porMovimento = new Map<string, Registro[]>();
  for (const reg of registros)
    porMovimento.set(reg.lancamento_id, [...(porMovimento.get(reg.lancamento_id) ?? []), reg]);
  const validos = movimentos.filter(
    (m) => m.tipo === "entrada" && m.status === "pago" && pagamentoEmCartao(m.forma_pagamento),
  );
  const linhas = validos.filter(
    (m) => filtro === "Todos" || situacaoConferencia(porMovimento.get(m.id)?.[0]) === filtro,
  );
  async function salvar(e: FormEvent, m: Movimento) {
    e.preventDefault();
    if (!podeEditar || !pronto || salvando) return;
    const exp = lerValorConferencia(esperado),
      rec = lerValorConferencia(recebido);
    if (exp === null || rec === null || exp > m.valor_centavos || !deposito) {
      setErro(
        "Informe o líquido esperado, o valor real e a data. O líquido esperado não pode passar o valor bruto.",
      );
      return;
    }
    if (deposito < diaSaoPaulo(new Date(m.registrado_em)) || deposito > diaSaoPaulo(new Date())) {
      setErro("A data do depósito deve estar entre a data do pagamento e hoje.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const { error } = await cliente.from("oricse_conferencia_cartoes").insert({
        clinica_id: clinicaId,
        lancamento_id: m.id,
        liquido_esperado_centavos: exp,
        recebido_centavos: rec,
        depositado_em: deposito,
        anotacao: nota.trim(),
      });
      if (error) throw error;
      setAberto("");
      setRevisao((n) => n + 1);
    } catch {
      setErro("Não foi possível salvar a conferência. O caixa não foi modificado.");
    } finally {
      setSalvando(false);
    }
  }
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="text-xl font-bold">Conciliação de cartões</h2>
      <p className="text-sm text-muted-foreground">
        Compare o líquido previsto pela operadora com o que entrou na conta. Cada revisão fica no
        histórico. A conferência é manual, não altera o caixa e não desconta estornos.
      </p>
      <div className="flex flex-wrap gap-2" aria-label="Situação da conferência">
        {["Todos", "Pendente", "Conciliado", "Divergente"].map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={filtro === item}
            onClick={() => {
              setFiltro(item);
              setMaisAntigos(false);
            }}
            className="min-h-10 rounded-lg border px-3 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            {item}
          </button>
        ))}
      </div>
      {(erro || erroCaixa) && (
        <p role="alert" className="rounded-lg border border-destructive p-2 text-sm">
          {erro || erroCaixa}
        </p>
      )}
      {!pronto || carregando || erroCaixa ? (
        !erro && !erroCaixa && <p role="status">Carregando pagamentos…</p>
      ) : (
        <>
          {!linhas.length && (
            <p className="text-sm text-muted-foreground">
              Nenhum pagamento em cartão neste filtro.
            </p>
          )}
          {linhas.slice(0, maisAntigos ? linhas.length : 25).map((m) => {
            const historico = porMovimento.get(m.id) ?? [],
              ultimo = historico[0];
            return (
              <article key={m.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <strong>{m.descricao}</strong>
                    <p className="text-sm">
                      {new Date(m.registrado_em).toLocaleDateString("pt-BR")} · {m.forma_pagamento}{" "}
                      · bruto {moeda(m.valor_centavos)}
                    </p>
                  </div>
                  <strong className="rounded-full bg-muted px-3 py-1 text-xs">
                    {situacaoConferencia(ultimo)}
                  </strong>
                </div>
                {ultimo && (
                  <p className="mt-2 text-sm">
                    Previsto {moeda(ultimo.liquido_esperado_centavos)} · recebido{" "}
                    {moeda(ultimo.recebido_centavos)} · diferença{" "}
                    {moeda(ultimo.recebido_centavos - ultimo.liquido_esperado_centavos)} ·{" "}
                    {data(ultimo.depositado_em)}
                  </p>
                )}
                {historico.length > 0 && (
                  <details className="mt-1 text-sm">
                    <summary className="cursor-pointer">
                      Histórico de conferência ({historico.length})
                    </summary>
                    <ul className="space-y-1 pt-2">
                      {historico.map((r) => (
                        <li key={r.id}>
                          {new Date(r.conferido_em).toLocaleString("pt-BR")} · depósito{" "}
                          {data(r.depositado_em)} · previsto {moeda(r.liquido_esperado_centavos)} ·
                          recebido {moeda(r.recebido_centavos)}
                          {r.anotacao && <> · {r.anotacao}</>}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {podeEditar && aberto !== m.id && (
                  <button
                    type="button"
                    className="mt-2 min-h-10 rounded-lg border px-3 text-sm font-semibold"
                    onClick={() => {
                      setAberto(m.id);
                      setEsperado(
                        ultimo
                          ? (ultimo.liquido_esperado_centavos / 100).toFixed(2).replace(".", ",")
                          : "",
                      );
                      setRecebido("");
                      setDeposito("");
                      setNota("");
                      setErro("");
                    }}
                  >
                    {ultimo ? "Registrar revisão" : "Conferir depósito"}
                  </button>
                )}
                {podeEditar && aberto === m.id && (
                  <form
                    onSubmit={(e) => void salvar(e, m)}
                    className="mt-3 grid gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-2"
                  >
                    <label className="text-sm">
                      Líquido esperado (R$)
                      <input
                        required
                        inputMode="decimal"
                        className={campo}
                        value={esperado}
                        onChange={(e) => setEsperado(e.target.value)}
                      />
                    </label>
                    <label className="text-sm">
                      Valor recebido (R$)
                      <input
                        required
                        inputMode="decimal"
                        className={campo}
                        value={recebido}
                        onChange={(e) => setRecebido(e.target.value)}
                      />
                    </label>
                    <label className="text-sm">
                      Data do depósito
                      <input
                        required
                        type="date"
                        min={diaSaoPaulo(new Date(m.registrado_em))}
                        max={diaSaoPaulo(new Date())}
                        className={campo}
                        value={deposito}
                        onChange={(e) => setDeposito(e.target.value)}
                      />
                    </label>
                    <label className="text-sm">
                      Observação
                      <input
                        maxLength={240}
                        className={campo}
                        value={nota}
                        onChange={(e) => setNota(e.target.value)}
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={salvando}
                        className="min-h-10 rounded-lg bg-primary px-3 text-sm text-primary-foreground"
                      >
                        Salvar conferência
                      </button>
                      <button
                        type="button"
                        disabled={salvando}
                        onClick={() => {
                          setAberto("");
                          setErro("");
                        }}
                        className="min-h-10 rounded-lg border px-3 text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </article>
            );
          })}
          {!maisAntigos && linhas.length > 25 && (
            <button
              type="button"
              onClick={() => setMaisAntigos(true)}
              className="min-h-10 rounded-lg border px-3 text-sm"
            >
              Mostrar todos ({linhas.length})
            </button>
          )}
        </>
      )}
    </section>
  );
}
