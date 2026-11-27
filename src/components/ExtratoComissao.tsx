import { useEffect, useState } from "react";
import { supabase, supabaseBanco } from "@/integrations/supabase/client";
import { fecharExtratoComissao } from "@/lib/extrato-comissao.functions";

type Linha = { id: string; data: string; descricao: string; centavos: number };
type Extrato = { itens: Linha[]; valor_centavos: number; fechado_em: string };
const moeda = (v: number) =>
  (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ExtratoComissao({
  clinicaId,
  funcionarioId,
  mes,
  podeFechar,
  mesEncerrado,
  linhas,
  carregando,
}: {
  clinicaId: string;
  funcionarioId: string;
  mes: string;
  podeFechar: boolean;
  mesEncerrado: boolean;
  linhas: Linha[];
  carregando: boolean;
}) {
  const [extrato, setExtrato] = useState<Extrato | null>(null);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [clinicaConferida, setClinicaConferida] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const db = supabaseBanco;
  const periodo = /^\d{4}-\d{2}$/.test(mes) ? mes + "-01" : "";
  useEffect(() => {
    let ativo = true;
    setPronto(false);
    setExtrato(null);
    setErro("");
    setConfirmar(false);
    setClinicaConferida(false);
    if (!clinicaId || !funcionarioId || !periodo) return;
    void (async () => {
      try {
        const { data, error } = await db
          .from("oricse_fechamentos_comissao")
          .select("itens,valor_centavos,fechado_em")
          .eq("clinica_id", clinicaId)
          .eq("funcionario_id", funcionarioId)
          .eq("mes", periodo)
          .maybeSingle()
          .overrideTypes<Extrato | null, { merge: false }>();
        if (!ativo) return;
        if (error) throw error;
        setExtrato(data);
        setPronto(true);
        if (podeFechar && mesEncerrado && !data) {
          const resposta = await db.rpc("oricse_contexto_clinica_atual");
          if (ativo && !resposta.error)
            setClinicaConferida(resposta.data?.[0]?.clinica_id === clinicaId);
        }
      } catch {
        if (ativo) setErro("Não foi possível consultar o extrato.");
      }
    })();
    return () => {
      ativo = false;
    };
  }, [db, clinicaId, funcionarioId, periodo, revisao, podeFechar, mesEncerrado]);
  async function fechar() {
    if (
      !confirmar ||
      !podeFechar ||
      !mesEncerrado ||
      !pronto ||
      !clinicaConferida ||
      salvando ||
      extrato
    )
      return;
    setSalvando(true);
    setErro("");
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.access_token) throw new Error("Sessão inválida");
      await fecharExtratoComissao({
        data: { accessToken: data.session.access_token, clinicaId, funcionarioId, mes },
      });
      setConfirmar(false);
      setRevisao((n) => n + 1);
    } catch {
      setErro("O fechamento não foi confirmado. Confira se há lançamentos neste período.");
    } finally {
      setSalvando(false);
    }
  }
  const dados = extrato?.itens ?? linhas;
  return (
    <section className="space-y-2 rounded-xl border bg-card p-4">
      <h3 className="font-bold">Extrato de comissões</h3>
      <p className="text-sm text-muted-foreground">
        Apenas comissões já lançadas. Fechar preserva uma cópia dos valores e não registra
        pagamento.
      </p>
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
      {!pronto || carregando ? (
        !erro && (
          <p role="status" className="text-sm">
            Carregando extrato…
          </p>
        )
      ) : (
        <>
          <p className="text-sm font-semibold">
            {extrato
              ? `Fechado em ${new Date(extrato.fechado_em).toLocaleString("pt-BR")}`
              : "Em aberto"}{" "}
            · {moeda(extrato?.valor_centavos ?? dados.reduce((n, l) => n + l.centavos, 0))}
          </p>
          {dados.length ? (
            <ul className="divide-y">
              {dados.map((l) => (
                <li key={l.id} className="flex justify-between gap-3 py-2 text-sm">
                  <span>
                    {l.data.split("-").reverse().join("/")} · {l.descricao}
                  </span>
                  <strong>{moeda(l.centavos)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma comissão lançada.</p>
          )}
          {podeFechar && mesEncerrado && !extrato && dados.length > 0 && !clinicaConferida && (
            <p className="text-sm text-muted-foreground">
              Para fechar, selecione esta clínica no Início.
            </p>
          )}
          {podeFechar &&
            clinicaConferida &&
            mesEncerrado &&
            !extrato &&
            dados.length > 0 &&
            (confirmar ? (
              <div className="flex flex-wrap gap-2 text-sm">
                <p className="w-full">Guardar este extrato como definitivo?</p>
                <button
                  disabled={salvando}
                  className="min-h-10 rounded-lg bg-primary px-3 text-primary-foreground"
                  type="button"
                  onClick={() => void fechar()}
                >
                  Confirmar fechamento
                </button>
                <button
                  disabled={salvando}
                  type="button"
                  className="min-h-10 rounded-lg border px-3"
                  onClick={() => setConfirmar(false)}
                >
                  Voltar
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="min-h-10 rounded-lg border px-3 text-sm font-semibold"
                onClick={() => setConfirmar(true)}
              >
                Fechar extrato do mês
              </button>
            ))}
        </>
      )}
    </section>
  );
}
