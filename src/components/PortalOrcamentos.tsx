import { useCallback, useEffect, useRef, useState } from "react";
import {
  dataHoraPortal,
  estadoOrcamentoTextual,
  reaisPortal,
  rpcPortal,
  type OrcamentoPortal,
} from "@/lib/portal-agenda-orcamentos";

const botao = "min-h-10 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50";
function dataValidade(data: string) {
  return data.split("-").reverse().join("/");
}

export function OrcamentosPortal({
  clinicaId,
  tutorId,
  animalId,
  abrirComanda,
}: {
  clinicaId: string;
  tutorId?: string;
  animalId?: string;
  abrirComanda?: (id: string) => void;
}) {
  const [lista, setLista] = useState<OrcamentoPortal[]>([]);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState("");
  const [confirma, setConfirma] = useState("");
  const emCurso = useRef(false);
  const ordem = useRef(0);
  const consultar = useCallback(async () => {
    if (!clinicaId) return;
    const vez = ++ordem.current;
    setCarregando(true);
    try {
      const resposta = await rpcPortal<OrcamentoPortal[]>("oricse_portal_orcamentos_listar", {
        p_clinica: clinicaId,
        p_tutor: tutorId ?? null,
      });
      if (vez === ordem.current) {
        setLista(resposta ?? []);
        setErro("");
      }
    } catch {
      if (vez === ordem.current) setErro("Não foi possível consultar os orçamentos do Portal.");
    } finally {
      if (vez === ordem.current) setCarregando(false);
    }
  }, [clinicaId, tutorId]);

  useEffect(() => {
    setLista([]);
    setConfirma("");
    setAviso("");
    setErro("");
    void consultar();
    return () => {
      ordem.current += 1;
    };
  }, [consultar]);

  async function atualizar(o: OrcamentoPortal) {
    if (emCurso.current) return;
    const aprovando = Boolean(tutorId);
    emCurso.current = true;
    setProcessando(o.id);
    setAviso("");
    setErro("");
    try {
      const id = await rpcPortal<string>(
        aprovando ? "oricse_portal_orcamento_aprovar" : "oricse_portal_orcamento_converter",
        { p_clinica: clinicaId, p_id: o.id },
      );
      setConfirma("");
      setAviso(
        aprovando
          ? "Orçamento aprovado. Nenhuma cobrança foi feita."
          : "Comanda criada com os itens do orçamento.",
      );
      await consultar();
      if (!aprovando) {
        window.dispatchEvent(new Event("oricse:caixa-alterado"));
        abrirComanda?.(id);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
    } finally {
      emCurso.current = false;
      setProcessando("");
    }
  }

  const filtrados = lista.filter((o) => !animalId || o.animal_id === animalId);
  const titulo = tutorId
    ? "Orçamentos compartilhados pela clínica"
    : "Orçamentos do Portal do Tutor";

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4" aria-label={titulo}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">{titulo}</h2>
        <button
          type="button"
          className={botao}
          disabled={carregando}
          onClick={() => void consultar()}
        >
          Atualizar orçamentos
        </button>
      </div>
      {!tutorId && (
        <p className="text-sm text-muted-foreground">
          Compartilhe pelo editor de orçamento. Depois da aprovação do tutor, abra uma comanda com
          os itens e valores aprovados.
        </p>
      )}
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
      {aviso && (
        <p role="status" className="text-sm font-semibold">
          {aviso}
        </p>
      )}
      {carregando && (
        <p role="status" className="text-sm">
          Consultando orçamentos…
        </p>
      )}
      {!carregando && !erro && filtrados.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum orçamento compartilhado para esta seleção.
        </p>
      )}
      {filtrados.map((o) => (
        <article key={o.id} className="space-y-2 rounded-xl border p-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-semibold">
              Orçamento para {o.animal}
              {!tutorId && ` · ${o.tutor}`}
            </h3>
            <span className="rounded-full bg-muted px-2 py-1 text-xs">
              {estadoOrcamentoTextual(o)}
            </span>
          </div>
          <p>
            Compartilhado em {dataHoraPortal(o.compartilhado_em)} · Válido até{" "}
            {dataValidade(o.validade_em)}
          </p>
          <ul className="space-y-1 rounded-lg bg-muted/50 p-2">
            {o.itens.map((i) => (
              <li key={i.id} className="flex justify-between gap-2">
                <span>
                  {i.quantidade.toLocaleString("pt-BR")} × {i.descricao} (
                  {reaisPortal(Math.round(i.valorUnitario * 100))})
                </span>
                <strong>{reaisPortal(i.subtotalCentavos)}</strong>
              </li>
            ))}
          </ul>
          <p className="font-bold">Total: {reaisPortal(o.total_centavos)}</p>
          {o.observacoes && <p className="whitespace-pre-wrap">{o.observacoes}</p>}
          {o.aprovado_em && <p>Aprovado em {dataHoraPortal(o.aprovado_em)}.</p>}
          {o.convertido_em && (
            <p>
              Comanda{" "}
              {o.comanda_numero != null
                ? `#${String(o.comanda_numero).padStart(5, "0")}`
                : "gerada"}{" "}
              em {dataHoraPortal(o.convertido_em)}.
            </p>
          )}
          {tutorId && o.estado === "compartilhado" && !o.vencido && confirma !== o.id && (
            <button
              className={botao}
              type="button"
              disabled={!!processando || carregando}
              onClick={() => setConfirma(o.id)}
            >
              Aprovar orçamento
            </button>
          )}
          {!tutorId && o.estado === "aprovado" && confirma !== o.id && (
            <button
              className={botao}
              type="button"
              disabled={!!processando || carregando}
              onClick={() => setConfirma(o.id)}
            >
              Gerar comanda
            </button>
          )}
          {!tutorId && o.comanda_id && (
            <button className={botao} type="button" onClick={() => abrirComanda?.(o.comanda_id!)}>
              Abrir comanda vinculada
            </button>
          )}
          {confirma === o.id && (
            <div className="space-y-2 rounded-lg border p-2">
              <p>
                {tutorId
                  ? "Confirma os itens, quantidades e valor acima? Aprovar não é pagar."
                  : "Abrir a comanda com os itens e preços aprovados? Isso não registra recebimento."}
              </p>
              <div className="flex gap-2">
                <button
                  className={botao}
                  type="button"
                  disabled={!!processando}
                  onClick={() => void atualizar(o)}
                >
                  {processando === o.id
                    ? "Salvando…"
                    : tutorId
                      ? "Confirmar aprovação"
                      : "Confirmar abertura da comanda"}
                </button>
                <button
                  className={botao}
                  type="button"
                  disabled={!!processando}
                  onClick={() => setConfirma("")}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
