import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { supabaseBanco } from "@/integrations/supabase/client";
import { usePermissoes } from "@/hooks/usePermissoes";
import { parseValorMonetario } from "@/lib/comandas";

const dinheiro = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formas = [
  "Pix",
  "Dinheiro",
  "Cartão de débito",
  "Cartão de crédito",
  "Transferência",
  "Boleto",
  "Outro",
];

export function ComandaAtendimento({ id, clinicaId }: { id: string; clinicaId: string }) {
  const { pode } = usePermissoes();
  const [comanda, setComanda] = useState<{
    numero: number;
    total: number;
    total_pago: number;
    saldo: number;
    pagamentos: { id: string; valor: number; formaPagamento: string; estornado?: number }[];
  } | null>(null);
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState(formas[0]);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const emEnvio = useRef(false);
  const tentativa = useRef<{ chave: string; id: string } | null>(null);
  const carregar = useCallback(async () => {
    const { data, error } = await supabaseBanco
      .from("oricse_portal_comandas")
      .select("numero,total,total_pago,saldo,pagamentos")
      .eq("clinica_id", clinicaId)
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      setErro("Não foi possível consultar esta comanda.");
      return;
    }
    setComanda({
      ...data,
      pagamentos: Array.isArray(data.pagamentos) ? (data.pagamentos as never) : [],
    });
    setErro("");
  }, [clinicaId, id]);
  useEffect(() => {
    void carregar();
    const timer = window.setInterval(carregar, 15000);
    window.addEventListener("focus", carregar);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", carregar);
    };
  }, [carregar]);

  async function receber(e: FormEvent) {
    e.preventDefault();
    if (!comanda || emEnvio.current) return;
    const centavos = Math.round(parseValorMonetario(valor) * 100);
    if (
      !Number.isSafeInteger(centavos) ||
      centavos <= 0 ||
      centavos > Math.round(comanda.saldo * 100)
    ) {
      return void toast.error("Informe um valor dentro do saldo da comanda.");
    }
    const chave = `${centavos}:${forma}`;
    if (tentativa.current?.chave !== chave) tentativa.current = { chave, id: crypto.randomUUID() };
    emEnvio.current = true;
    setOcupado(true);
    try {
      const { error } = await supabaseBanco.rpc("oricse_receber_comanda_atendimento", {
        p_comanda: id,
        p_pagamento: tentativa.current.id,
        p_centavos: centavos,
        p_forma: forma,
      });
      if (error) throw new Error(error.message);
      tentativa.current = null;
      setValor("");
      toast.success("Pagamento registrado no Caixa.");
      window.dispatchEvent(new Event("oricse:caixa-alterado"));
    } catch (falha) {
      toast.error(falha instanceof Error ? falha.message : "Falha ao confirmar pagamento.");
    } finally {
      await carregar();
      emEnvio.current = false;
      setOcupado(false);
    }
  }

  return (
    <section className="my-4 space-y-3 rounded-xl border bg-card p-4">
      <h2 className="flex items-center gap-2 font-bold">
        <ReceiptText size={17} /> Comanda do atendimento
        {comanda ? ` #${String(comanda.numero).padStart(5, "0")}` : ""}
      </h2>
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
      {comanda && (
        <>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              Total <strong>{dinheiro(comanda.total)}</strong>
            </span>
            <span>
              Recebido <strong>{dinheiro(comanda.total_pago)}</strong>
            </span>
            <span>
              Saldo <strong>{dinheiro(comanda.saldo)}</strong>
            </span>
          </div>
          {comanda.pagamentos.length > 0 && (
            <ul className="divide-y text-sm">
              {comanda.pagamentos.map((pagamento) => (
                <li key={pagamento.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span>
                    {pagamento.formaPagamento} · {dinheiro(pagamento.valor)}
                  </span>
                  {!!pagamento.estornado && (
                    <span>Estorno confirmado de {dinheiro(pagamento.estornado)}</span>
                  )}
                  {pagamento.valor > 0 && pode("caixa.financeiro.visualizar") && (
                    <a
                      className="font-semibold text-primary underline"
                      href={`/financeiro?estornoOrigem=${encodeURIComponent(pagamento.id)}`}
                    >
                      Resolver estorno no Caixa
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
          {comanda.saldo > 0 && (pode("caixa.comandas") || pode("caixa.financeiro.gerenciar")) && (
            <form onSubmit={receber} className="flex flex-wrap items-end gap-2">
              <label className="text-sm font-semibold">
                Valor recebido
                <input
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder={dinheiro(comanda.saldo)}
                  className="mt-1 block min-h-10 rounded-lg border bg-background px-3"
                />
              </label>
              <label className="text-sm font-semibold">
                Forma de pagamento
                <select
                  value={forma}
                  onChange={(e) => setForma(e.target.value)}
                  className="mt-1 block min-h-10 rounded-lg border bg-background px-3"
                >
                  {formas.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={ocupado}
                className="min-h-10 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {ocupado ? "Confirmando…" : "Registrar pagamento"}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
