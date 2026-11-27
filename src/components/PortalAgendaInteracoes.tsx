import { useCallback, useEffect, useRef, useState } from "react";
import {
  dataHoraPortal,
  mesmoHorarioPortal,
  rpcPortal,
  type AgendaPortalEvento,
  type AgendaPortalMarcacao,
} from "@/lib/portal-agenda-orcamentos";

const botao = "min-h-10 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50";
const campo = "w-full rounded-lg border bg-background p-2 text-sm";

function useRespostasPortal(clinicaId: string, tutorId?: string, versao = 0) {
  const [eventos, setEventos] = useState<AgendaPortalEvento[]>([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const contador = useRef(0);
  const consultar = useCallback(async () => {
    if (!clinicaId) return;
    const rodada = ++contador.current;
    setCarregando(true);
    try {
      const lista = await rpcPortal<AgendaPortalEvento[]>("oricse_portal_agenda_respostas", {
        p_clinica: clinicaId,
        p_tutor: tutorId ?? null,
      });
      if (rodada === contador.current) {
        setEventos(lista ?? []);
        setErro("");
      }
    } catch {
      if (rodada === contador.current)
        setErro("Não foi possível consultar as respostas do Portal.");
    } finally {
      if (rodada === contador.current) setCarregando(false);
    }
  }, [clinicaId, tutorId]);
  useEffect(() => {
    setEventos([]);
    setErro("");
    void consultar();
    return () => {
      contador.current += 1;
    };
  }, [consultar, versao]);
  return { eventos, erro, carregando, consultar };
}

export function AgendaPortalDoTutor({
  clinicaId,
  tutorId,
  marcacoes,
  animais,
  recarregarMarcacoes,
}: {
  clinicaId: string;
  tutorId: string;
  marcacoes: AgendaPortalMarcacao[];
  animais: { id: string; nome: string }[];
  recarregarMarcacoes?: () => Promise<void>;
}) {
  const { eventos, erro, carregando, consultar } = useRespostasPortal(clinicaId, tutorId);
  const [pedidoAberto, setPedidoAberto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [pendente, setPendente] = useState("");
  const [aviso, setAviso] = useState("");
  const [falha, setFalha] = useState("");
  const ocupada = useRef(false);
  async function registrar(a: AgendaPortalMarcacao, acao: "confirmacao" | "pedido") {
    if (ocupada.current) return;
    ocupada.current = true;
    setPendente(a.id);
    setAviso("");
    setFalha("");
    try {
      await rpcPortal("oricse_portal_agenda_interagir", {
        p_clinica: clinicaId,
        p_agendamento: a.id,
        p_horario: a.inicio,
        p_acao: acao,
        p_mensagem: acao === "pedido" ? mensagem.trim() : null,
      });
      setPedidoAberto("");
      setMensagem("");
      setAviso(
        acao === "confirmacao"
          ? "Sua confirmação foi registrada."
          : "Pedido registrado. O horário permanece até a clínica alterar a agenda.",
      );
      await consultar();
    } catch (error) {
      setFalha(error instanceof Error ? error.message : "Não foi possível registrar a ação.");
    } finally {
      ocupada.current = false;
      setPendente("");
    }
  }

  const mostrar = marcacoes.filter(
    (a) =>
      (a.estado === "confirmado" && Date.parse(a.inicio) > Date.now()) ||
      eventos.some((e) => e.agendamento_id === a.id && e.tipo === "pedido"),
  );
  if (!mostrar.length && !erro && !carregando) return null;

  return (
    <section
      className="space-y-3 rounded-2xl border bg-card p-4"
      aria-label="Confirmar ou pedir reagendamento"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Confirmação e reagendamento</h2>
        <button
          className={botao}
          type="button"
          disabled={carregando}
          onClick={() => {
            void consultar();
            void recarregarMarcacoes?.().catch(() =>
              setFalha("Não foi possível atualizar os agendamentos."),
            );
          }}
        >
          Atualizar respostas
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        A clínica vê suas confirmações e pedidos. Pedir reagendamento não cancela nem troca o
        horário.
      </p>
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
      {falha && (
        <p role="alert" className="text-sm text-destructive">
          {falha}
        </p>
      )}
      {aviso && (
        <p role="status" className="text-sm font-semibold">
          {aviso}
        </p>
      )}
      {carregando && (
        <p role="status" className="text-sm">
          Consultando respostas…
        </p>
      )}
      {mostrar.map((a) => {
        const lista = eventos.filter((e) => e.agendamento_id === a.id);
        const confirmado = lista.some(
          (e) => e.tipo === "confirmacao" && mesmoHorarioPortal(e.horario_referencia, a.inicio),
        );
        const pedidos = lista.filter((e) => e.tipo === "pedido");
        const pedidoPendente = pedidos.some((p) => !lista.some((e) => e.pedido_id === p.id));
        const podeOperar = a.estado === "confirmado" && Date.parse(a.inicio) > Date.now() && !erro;
        const animal = animais.find((p) => p.id === a.animal_id)?.nome;
        return (
          <article key={a.id} className="space-y-2 rounded-xl border p-3">
            <h3 className="font-semibold">
              {animal ? `${animal} · ` : ""}
              {a.tipo}
            </h3>
            <p className="text-sm">
              {dataHoraPortal(a.inicio)}
              {confirmado ? " · Presença confirmada por você" : ""}
            </p>
            {pedidos.map((p) => {
              const resposta = lista.find((e) => e.pedido_id === p.id);
              return (
                <div key={p.id} className="rounded-lg bg-muted/60 p-2 text-sm">
                  <p>
                    <strong>Pedido de {dataHoraPortal(p.criado_em)}</strong>
                    {p.mensagem ? `: ${p.mensagem}` : ""}
                  </p>
                  <p>
                    {resposta ? (
                      <>
                        <strong>Resposta da clínica:</strong> {resposta.mensagem}
                      </>
                    ) : (
                      "Aguardando resposta da clínica."
                    )}
                  </p>
                </div>
              );
            })}
            {podeOperar && (
              <div className="flex flex-wrap gap-2">
                {!confirmado && (
                  <button
                    className={botao}
                    type="button"
                    disabled={!!pendente || carregando}
                    onClick={() => void registrar(a, "confirmacao")}
                  >
                    Confirmar presença
                  </button>
                )}
                {!pedidoPendente && pedidoAberto !== a.id && (
                  <button
                    className={botao}
                    type="button"
                    disabled={!!pendente || carregando}
                    onClick={() => {
                      setPedidoAberto(a.id);
                      setMensagem("");
                    }}
                  >
                    Pedir reagendamento
                  </button>
                )}
              </div>
            )}
            {podeOperar && pedidoAberto === a.id && (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void registrar(a, "pedido");
                }}
              >
                <label className="block text-sm font-semibold">
                  Preferência de dias ou horários (opcional)
                  <textarea
                    className={campo}
                    maxLength={500}
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                  />
                </label>
                <div className="flex gap-2">
                  <button className={botao} disabled={!!pendente} type="submit">
                    Enviar pedido
                  </button>
                  <button className={botao} type="button" onClick={() => setPedidoAberto("")}>
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </article>
        );
      })}
    </section>
  );
}

export function AgendaPortalDaEquipe({ clinicaId, versao }: { clinicaId: string; versao: number }) {
  const { eventos, erro, carregando, consultar } = useRespostasPortal(clinicaId, undefined, versao);
  const [abrir, setAbrir] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [falha, setFalha] = useState("");
  const [aviso, setAviso] = useState("");
  const emCurso = useRef(false);
  const pedidos = eventos.filter((e) => e.tipo === "pedido");
  const confirmacoes = eventos.filter((e) => e.tipo === "confirmacao");
  const pendentes = pedidos.filter((p) => !eventos.some((e) => e.pedido_id === p.id));
  async function responder(p: AgendaPortalEvento) {
    if (!mensagem.trim() || emCurso.current) return;
    emCurso.current = true;
    setOcupado(true);
    setFalha("");
    setAviso("");
    try {
      await rpcPortal("oricse_portal_agenda_interagir", {
        p_clinica: clinicaId,
        p_agendamento: p.agendamento_id,
        p_horario: null,
        p_acao: "resposta",
        p_pedido: p.id,
        p_mensagem: mensagem.trim(),
      });
      setAbrir("");
      setMensagem("");
      setAviso("Resposta salva. Ela aparece no Portal do Tutor.");
      await consultar();
    } catch (error) {
      setFalha(error instanceof Error ? error.message : "Falha ao salvar a resposta.");
    } finally {
      emCurso.current = false;
      setOcupado(false);
    }
  }
  return (
    <section
      className="space-y-3 rounded-2xl border bg-card p-4"
      aria-label="Pedidos e confirmações do Portal do Tutor"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Respostas do Portal do Tutor</h2>
        <button
          type="button"
          className={botao}
          disabled={carregando}
          onClick={() => void consultar()}
        >
          Atualizar respostas
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        Responda no Portal. Se combinar outro horário, altere o agendamento na agenda da clínica; a
        resposta abaixo não altera o horário.
      </p>
      {carregando && (
        <p role="status" className="text-sm">
          Consultando respostas…
        </p>
      )}
      {(erro || falha) && (
        <p role="alert" className="text-sm text-destructive">
          {falha || erro}
        </p>
      )}
      {aviso && (
        <p role="status" className="text-sm font-semibold">
          {aviso}
        </p>
      )}
      <details open={pendentes.length > 0}>
        <summary className="cursor-pointer text-sm font-semibold">
          Pedidos de reagendamento ({pendentes.length} sem resposta)
        </summary>
        <div className="mt-2 space-y-2">
          {pedidos.length === 0 && <p className="text-sm">Nenhum pedido registrado.</p>}
          {pedidos.map((p) => {
            const resposta = eventos.find((e) => e.pedido_id === p.id);
            return (
              <article key={p.id} className="space-y-2 rounded-xl border p-3 text-sm">
                <h3 className="font-semibold">
                  {p.animal || p.servico} · {p.tutor}
                </h3>
                <p>
                  Horário do pedido: {dataHoraPortal(p.horario_referencia)} · {p.servico}
                </p>
                {!mesmoHorarioPortal(p.inicio, p.horario_referencia) && (
                  <p>Horário atual na agenda: {dataHoraPortal(p.inicio)}</p>
                )}
                {p.mensagem && <p>Preferência: {p.mensagem}</p>}
                {resposta ? (
                  <p>
                    <strong>Resposta:</strong> {resposta.mensagem}
                  </p>
                ) : abrir !== p.id ? (
                  <button
                    type="button"
                    className={botao}
                    onClick={() => {
                      setAbrir(p.id);
                      setMensagem("");
                    }}
                  >
                    Responder ao tutor
                  </button>
                ) : (
                  <form
                    className="space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void responder(p);
                    }}
                  >
                    <label className="block font-semibold">
                      Resposta visível para o tutor
                      <textarea
                        className={campo}
                        required
                        maxLength={500}
                        value={mensagem}
                        onChange={(e) => setMensagem(e.target.value)}
                      />
                    </label>
                    <button type="submit" className={botao} disabled={ocupado || !mensagem.trim()}>
                      Salvar resposta
                    </button>
                    <button type="button" className={botao} onClick={() => setAbrir("")}>
                      Cancelar
                    </button>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      </details>
      <details>
        <summary className="cursor-pointer text-sm font-semibold">
          Confirmações de presença ({confirmacoes.length})
        </summary>
        <ul className="mt-2 space-y-1 text-sm">
          {confirmacoes.map((e) => (
            <li key={e.id}>
              {e.animal || e.servico} · {e.tutor} · {dataHoraPortal(e.horario_referencia)}
              {!mesmoHorarioPortal(e.inicio, e.horario_referencia) && " (horário anterior)"}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
