import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ClipboardList, Clock3, Grid3X3, List, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermissoes } from "@/hooks/usePermissoes";
import { consultarPainelPlantao, registrarEventoPlantao } from "@/lib/painel-plantao.functions";
import {
  classeDaDose,
  colunaDeHorario,
  horarioCivilPlantao,
  type ClassePlantao,
  type DosePlantao,
  type EstadoExecucaoPlantao,
  type EventoPlantao,
  type PainelPlantao,
} from "@/lib/painel-plantao";

export const Route = createFileRoute("/horarios-medicacoes")({ component: HorariosMedicacoes });

const grupos = [
  { id: "atrasadas", nome: "Atrasadas", classe: "border-rose-300 bg-rose-50 text-rose-950" },
  { id: "agora", nome: "Agora", classe: "border-amber-300 bg-amber-50 text-amber-950" },
  { id: "proximas", nome: "Próximas", classe: "border-blue-200 bg-blue-50 text-blue-950" },
] as const;
const rotuloExecucao = (e: EstadoExecucaoPlantao) =>
  e === "realizada" ? "Realizada" : "Não realizada";
const dataBR = (d: string) => d.split("-").reverse().join("/");
function momento(iso: string) {
  const { dia, horario } = horarioCivilPlantao(iso);
  return `${dataBR(dia)} · ${horario}`;
}

type Formulario =
  | { tipo: "dose"; dose: DosePlantao; estado: EstadoExecucaoPlantao }
  | { tipo: "ocorrencia" | "passagem"; chave: string };

function HorariosMedicacoes() {
  const { clinicaId, usuarioId, carregando: carregandoAcesso, pode } = usePermissoes();
  const autorizado =
    !carregandoAcesso &&
    !!clinicaId &&
    pode("internacao.medicacoes") &&
    pode("internacao.registrar");
  const escopo = autorizado ? `${clinicaId}:${usuarioId}` : "";
  const atual = useRef("");
  atual.current = escopo;
  const rodada = useRef(0);
  const [leitura, setLeitura] = useState<{ escopo: string; dados: PainelPlantao } | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [modo, setModo] = useState<"lista" | "grade">("lista");
  const [formulario, setFormulario] = useState<(Formulario & { turno: string }) | null>(null);
  const [nota, setNota] = useState("");
  const [revisouHistorico, setRevisouHistorico] = useState(false);
  const [paciente, setPaciente] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroRegistro, setErroRegistro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const painel = autorizado && leitura?.escopo === escopo ? leitura.dados : null;

  const carregar = useCallback(async () => {
    if (!autorizado) return;
    const tentativa = ++rodada.current;
    const estaAtual = () => tentativa === rodada.current && atual.current === escopo;
    setErro("");
    setCarregando(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) throw new Error("Sessão expirada. Entre novamente.");
      const painel = await consultarPainelPlantao({
        data: { accessToken: data.session.access_token, clinicaId },
      });
      if (estaAtual()) setLeitura({ escopo, dados: painel });
    } catch (falha) {
      if (estaAtual())
        setErro(falha instanceof Error ? falha.message : "Não foi possível abrir o painel.");
    } finally {
      if (estaAtual()) setCarregando(false);
    }
  }, [autorizado, clinicaId, escopo]);

  const invalidarLeitura = useCallback(() => {
    rodada.current++;
  }, []);

  useEffect(() => {
    setFormulario(null);
    setSalvando(false);
    setMensagem("");
    void carregar();
    if (!autorizado) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void carregar();
    }, 60_000);
    return () => {
      invalidarLeitura();
      window.clearInterval(timer);
    };
  }, [autorizado, carregar, invalidarLeitura]);

  const executadas = useMemo(
    () =>
      new Map((painel?.eventos ?? []).filter((e) => e.tipo === "dose").map((e) => [e.chave, e])),
    [painel],
  );
  const porGrupo = useMemo(() => {
    const mapa: Record<ClassePlantao, DosePlantao[]> = { atrasadas: [], agora: [], proximas: [] };
    if (painel)
      for (const d of painel.doses) {
        if (!executadas.has(d.chave))
          mapa[classeDaDose(d.horario, Date.parse(painel.agora))].push(d);
      }
    return mapa;
  }, [executadas, painel]);

  const grade = useMemo(() => {
    const colunas = new Set<string>();
    const dados = new Map<string, Map<string, DosePlantao[]>>();
    for (const d of painel?.doses ?? []) {
      const coluna = colunaDeHorario(d.horario);
      colunas.add(coluna);
      const paciente = dados.get(d.registroId) ?? new Map<string, DosePlantao[]>();
      const doses = paciente.get(coluna) ?? [];
      doses.push(d);
      paciente.set(coluna, doses);
      dados.set(d.registroId, paciente);
    }
    return { colunas: [...colunas].sort(), dados };
  }, [painel]);

  function abrir(novo: Formulario) {
    if (!painel?.turno) return;
    setErroRegistro("");
    setMensagem("");
    setNota("");
    setRevisouHistorico(false);
    setPaciente("");
    setFormulario({ ...novo, turno: painel.turno.chave });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!painel?.turno || !formulario || salvando || !autorizado || erro) return;
    if (painel.turno.chave !== formulario.turno) {
      setErroRegistro("O plantão mudou. Feche e abra um novo registro.");
      return;
    }
    const texto = nota.trim();
    if (!texto && (formulario.tipo !== "dose" || formulario.estado === "nao_realizada")) return;
    if (formulario.tipo === "ocorrencia" && !paciente) return;
    if (
      formulario.tipo === "dose" &&
      formulario.dose.historicoLegadoSemVinculo &&
      !revisouHistorico
    )
      return;
    const evento =
      formulario.tipo === "dose"
        ? {
            tipo: "dose" as const,
            chave: formulario.dose.chave,
            estado: formulario.estado,
            texto,
            revisouHistorico,
          }
        : formulario.tipo === "ocorrencia"
          ? { tipo: "ocorrencia" as const, chave: formulario.chave, registroId: paciente, texto }
          : { tipo: "passagem" as const, chave: formulario.chave, texto };
    setSalvando(true);
    setErroRegistro("");
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) throw new Error("Sessão expirada. Entre novamente.");
      const resultado = await registrarEventoPlantao({
        data: {
          accessToken: data.session.access_token,
          clinicaId,
          turno: formulario.turno,
          evento,
        },
      });
      if (atual.current !== escopo) return;
      setFormulario(null);
      const descricao = resultado.estado ? rotuloExecucao(resultado.estado) : "Registro confirmado";
      setMensagem(`${descricao}: ${resultado.autor_nome} · ${momento(resultado.registrado_em)}.`);
      await carregar();
    } catch (falha) {
      if (atual.current === escopo)
        setErroRegistro(falha instanceof Error ? falha.message : "Registro não confirmado.");
    } finally {
      if (atual.current === escopo) setSalvando(false);
    }
  }

  function linhaDose(d: DosePlantao, compacto = false) {
    const evento = executadas.get(d.chave);
    const liberada =
      d.confirmada &&
      !erro &&
      !carregando &&
      painel &&
      Date.parse(d.horario) <= Date.parse(painel.agora);
    return (
      <div
        key={d.chave}
        className={
          compacto
            ? "space-y-1 text-xs"
            : "flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-3"
        }
      >
        <div className="min-w-0">
          {!compacto && (
            <p className="text-xs font-semibold text-muted-foreground">
              {momento(d.horario)} · {d.paciente}
              {d.baia ? ` · ${d.baia}` : ""}
            </p>
          )}
          <p className="break-words font-semibold">
            {compacto ? `${horarioCivilPlantao(d.horario).horario} · ` : ""}
            {d.medicamento}
          </p>
          {!evento && d.historicoLegadoSemVinculo && (
            <p className="mt-1 rounded-md border border-amber-300 bg-amber-50 p-1 text-xs font-semibold text-amber-950">
              Há aplicação anterior sem vínculo. Confira a ficha antes de registrar.
            </p>
          )}
          <p className="break-words text-xs text-muted-foreground">
            {[d.dose, d.quantidade, d.via].filter(Boolean).join(" · ")}
          </p>
        </div>
        {evento?.estado ? (
          <p className="text-xs font-bold">
            {rotuloExecucao(evento.estado)} · {evento.autor_nome}
            <br />
            {momento(evento.registrado_em)}
          </p>
        ) : liberada ? (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className="rounded-lg border px-2 py-1.5 text-xs font-bold hover:bg-secondary"
              aria-label={`Registrar realizada: ${d.medicamento}, ${d.paciente}, ${momento(d.horario)}`}
              onClick={() => abrir({ tipo: "dose", dose: d, estado: "realizada" })}
            >
              Realizada
            </button>
            <button
              type="button"
              className="rounded-lg border px-2 py-1.5 text-xs font-bold hover:bg-secondary"
              aria-label={`Registrar não realizada: ${d.medicamento}, ${d.paciente}, ${momento(d.horario)}`}
              onClick={() => abrir({ tipo: "dose", dose: d, estado: "nao_realizada" })}
            >
              Não realizada
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const titulo =
    formulario?.tipo === "dose"
      ? `Confirmar execução: ${rotuloExecucao(formulario.estado).toLowerCase()}`
      : formulario?.tipo === "ocorrencia"
        ? "Registrar ocorrência"
        : "Registrar passagem de plantão";
  const obrigatoria = formulario?.tipo !== "dose" || formulario.estado === "nao_realizada";
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-5">
      <Link
        to="/internacao"
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold hover:bg-secondary"
      >
        <ArrowLeft size={17} /> Voltar à internação
      </Link>
      <header className="mt-3 rounded-2xl bg-primary px-5 py-5 text-primary-foreground">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Clock3 size={17} /> INTERNAÇÃO
        </p>
        <h1 className="mt-1 text-2xl font-bold">Painel do Plantão</h1>
        <p className="mt-1 text-sm">
          Horários das medicações, execução registrada e passagem de turno.
        </p>
        {painel?.turno && (
          <p className="mt-2 text-sm font-semibold">
            {dataBR(painel.turno.dia)} · {painel.turno.turno} · horário de Brasília
          </p>
        )}
      </header>
      {carregandoAcesso ? (
        <p role="status" className="mt-4">
          Verificando acesso…
        </p>
      ) : !autorizado ? (
        <p role="alert" className="mt-4 rounded-xl border p-4">
          O painel requer acesso às medicações e aos registros de internação desta clínica.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Modo de visualização">
              <button
                type="button"
                aria-pressed={modo === "lista"}
                onClick={() => setModo("lista")}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                <List size={16} /> Lista
              </button>
              <button
                type="button"
                aria-pressed={modo === "grade"}
                onClick={() => setModo("grade")}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                <Grid3X3 size={16} /> Grade por paciente
              </button>
            </div>
            <button
              type="button"
              disabled={carregando || salvando}
              onClick={() => void carregar()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold disabled:opacity-50"
            >
              <RefreshCw size={16} /> {carregando ? "Atualizando…" : "Atualizar painel"}
            </button>
          </div>
          {erro && (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-950"
            >
              {erro} Atualize o painel para continuar.
            </p>
          )}
          {mensagem && (
            <p
              role="status"
              className="mt-3 rounded-xl border border-green-300 bg-green-50 p-3 text-sm text-green-950"
            >
              {mensagem}
            </p>
          )}
          {!painel && carregando && (
            <p role="status" className="mt-4">
              Carregando plantão…
            </p>
          )}
          {painel && !painel.turno && (
            <section className="mt-4 rounded-xl border border-dashed p-5">
              <h2 className="font-bold">Nenhum plantão ativo</h2>
              <p className="mt-1 text-sm">
                Inicie o plantão no painel de internação para programar e registrar ocorrências.
              </p>
              <Link to="/internacao" className="mt-3 inline-block font-bold text-primary">
                Ir para a internação
              </Link>
            </section>
          )}
          {painel?.turno && (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!painel.pacientes.length || !!erro || carregando}
                  onClick={() => abrir({ tipo: "ocorrencia", chave: crypto.randomUUID() })}
                  className="min-h-10 rounded-lg border px-3 text-sm font-bold disabled:opacity-50"
                >
                  Registrar ocorrência
                </button>
                <button
                  type="button"
                  disabled={!!erro || carregando}
                  onClick={() => abrir({ tipo: "passagem", chave: crypto.randomUUID() })}
                  className="min-h-10 rounded-lg border px-3 text-sm font-bold disabled:opacity-50"
                >
                  Registrar passagem de plantão
                </button>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Agora: até 15 min antes ou depois da hora prevista. Atrasadas são doses sem registro
                neste painel; confira a ficha e a equipe antes de administrar. O painel mostra a
                programação registrada; não altera prescrições. Atualização: {momento(painel.agora)}
                .
              </p>
              {painel.programacoesLegadas > 0 && (
                <p className="mt-3 rounded-lg border bg-secondary p-3 text-sm">
                  {painel.programacoesLegadas} programação(ões) anterior(es) à ativação do painel:
                  só horários futuros para conferência, sem marcar atrasos. Para permitir registro
                  de execução, confirme horário e intervalo na ficha de internação.
                </p>
              )}
              {painel.semProgramacao > 0 && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  {painel.semProgramacao} item(ns) ou horário(s) sem programação inequívoca. Confira
                  horário, intervalo ou duplicidade na ficha.
                </p>
              )}
              {modo === "lista" ? (
                <div className="mt-4 grid items-start gap-3 lg:grid-cols-3">
                  {grupos.map((g) => (
                    <section key={g.id} className={`min-w-0 rounded-xl border p-3 ${g.classe}`}>
                      <h2 className="text-base font-bold">
                        {g.nome} ({porGrupo[g.id].length})
                      </h2>
                      <div className="mt-3 space-y-2 text-foreground">
                        {porGrupo[g.id].length ? (
                          porGrupo[g.id].map((d) => linhaDose(d))
                        ) : (
                          <p className="text-sm">Nenhuma dose neste grupo.</p>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <section className="mt-4" aria-label="Grade de medicações">
                  {!grade.colunas.length ? (
                    <p className="rounded-xl border border-dashed p-5">
                      Nenhum horário programado neste recorte.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border">
                      <table className="w-full border-collapse bg-card text-left">
                        <caption className="sr-only">
                          Medicações por paciente e horário, no horário de Brasília.
                        </caption>
                        <thead className="bg-secondary">
                          <tr>
                            <th scope="col" className="sticky left-0 bg-secondary p-3">
                              Paciente
                            </th>
                            {grade.colunas.map((c) => (
                              <th scope="col" key={c} className="min-w-40 border-l p-3 text-sm">
                                {dataBR(c.slice(0, 10))}
                                <br />
                                {c.slice(11)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {painel.pacientes.map((p) => (
                            <tr key={p.id} className="border-t align-top">
                              <th
                                scope="row"
                                className="sticky left-0 min-w-36 bg-card p-3 text-sm"
                              >
                                {p.nome}
                                {p.baia && (
                                  <span className="block font-normal text-muted-foreground">
                                    {p.baia}
                                  </span>
                                )}
                              </th>
                              {grade.colunas.map((c) => (
                                <td key={c} className="space-y-2 border-l p-3">
                                  {grade.dados
                                    .get(p.id)
                                    ?.get(c)
                                    ?.map((d) => linhaDose(d, true)) ?? (
                                    <span aria-hidden="true">—</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
          {painel && (
            <section className="mt-6 rounded-xl border bg-card p-4">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <ClipboardList size={18} /> Registros e passagens
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Execuções dos horários exibidos, ocorrências do turno ativo e até três passagens
                anteriores.
              </p>
              {!painel.eventos.length ? (
                <p className="mt-4 text-sm">Nenhum registro lançado neste painel.</p>
              ) : (
                <ul className="mt-3 divide-y">
                  {painel.eventos.map((e) => (
                    <LinhaEvento
                      key={`${e.turno_chave}:${e.tipo}:${e.chave}`}
                      evento={e}
                      anterior={e.turno_chave !== painel.turno?.chave}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
      <Dialog
        open={!!formulario}
        onOpenChange={(aberto) => {
          if (!aberto && !salvando) setFormulario(null);
        }}
      >
        {formulario && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{titulo}</DialogTitle>
              <DialogDescription>
                A ação fica registrada com seu nome e horário do servidor. Confira antes de
                confirmar.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => void salvar(e)} className="space-y-3">
              {formulario.tipo === "dose" && (
                <p className="rounded-lg border p-3 text-sm font-semibold">
                  {formulario.dose.paciente} · {formulario.dose.medicamento} ·{" "}
                  {momento(formulario.dose.horario)}
                </p>
              )}
              {formulario.tipo === "dose" && formulario.dose.historicoLegadoSemVinculo && (
                <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">
                  Há aplicação anterior do mesmo item na ficha e o sistema não sabe se ela
                  corresponde a este horário.
                  <label className="mt-2 flex items-center gap-2 font-semibold">
                    <input
                      type="checkbox"
                      required
                      checked={revisouHistorico}
                      onChange={(e) => setRevisouHistorico(e.target.checked)}
                    />
                    Conferi a ficha e o que ocorreu neste horário.
                  </label>
                </div>
              )}
              {formulario.tipo === "ocorrencia" && (
                <div>
                  <label
                    htmlFor="paciente-ocorrencia-plantao"
                    className="block text-sm font-semibold"
                  >
                    Paciente
                  </label>
                  <select
                    id="paciente-ocorrencia-plantao"
                    required
                    value={paciente}
                    onChange={(e) => setPaciente(e.target.value)}
                    className="mt-1 min-h-10 w-full rounded-lg border bg-background px-2"
                  >
                    <option value="">Selecione</option>
                    {painel?.pacientes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                        {p.baia ? ` · ${p.baia}` : ""} · {p.id.slice(-6)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <label className="block text-sm font-semibold">
                {formulario.tipo === "dose" && obrigatoria
                  ? "Motivo"
                  : obrigatoria
                    ? "Registro"
                    : "Observação (opcional)"}
                <textarea
                  required={obrigatoria}
                  maxLength={1000}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border px-2 py-1"
                />
              </label>
              {erroRegistro && (
                <p role="alert" className="text-sm text-destructive">
                  {erroRegistro}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => setFormulario(null)}
                  className="min-h-10 rounded-lg border px-3 text-sm font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    salvando ||
                    !!erro ||
                    (formulario.tipo === "dose" &&
                      formulario.dose.historicoLegadoSemVinculo &&
                      !revisouHistorico) ||
                    (obrigatoria && !nota.trim()) ||
                    (formulario.tipo === "ocorrencia" && !paciente)
                  }
                  className="min-h-10 rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  {salvando ? "Registrando…" : "Confirmar registro"}
                </button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </main>
  );
}

function LinhaEvento({ evento: e, anterior }: { evento: EventoPlantao; anterior: boolean }) {
  return (
    <li className="space-y-1 py-3 text-sm">
      <p className="font-bold">
        {e.tipo === "dose" && e.estado
          ? rotuloExecucao(e.estado)
          : e.tipo === "ocorrencia"
            ? "Ocorrência"
            : anterior
              ? "Passagem anterior"
              : "Passagem de plantão"}
        {e.paciente && ` · ${e.paciente}`}
        {e.medicamento && ` · ${e.medicamento}`}
        {e.agendado_em && ` · previsto ${momento(e.agendado_em)}`}
      </p>
      <p className="text-xs text-muted-foreground">
        {e.autor_nome} · {momento(e.registrado_em)}
      </p>
      {e.texto && <p className="whitespace-pre-wrap break-words">{e.texto}</p>}
    </li>
  );
}
