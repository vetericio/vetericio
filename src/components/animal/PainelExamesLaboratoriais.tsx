import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Download, FlaskConical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabaseBanco } from "@/integrations/supabase/client";
import { enviarAnexoPortal } from "@/lib/drive.functions";
import { baixarDocumentoPortal } from "@/lib/portal-document.functions";
import { PORTAL_PDF_MAX_BYTES } from "@/lib/drive-storage";
import {
  listarExamesLaboratoriais,
  listarReferenciasLaboratoriais,
  salvarExameLaboratorial,
  salvarReferenciasLaboratoriais,
} from "@/lib/exame-painel.functions";
import {
  criarLinhasLab,
  preencherReferenciasLab,
  LABORATORIOS_ORIGEM,
  PAINEIS_LAB,
  salvarExameLabSchema,
  seriesLaboratoriais,
  unidadeComparavel,
  type ExameLab,
  type LinhaLab,
  type PainelLab,
  type SerieLab,
} from "@/lib/exame-painel";
import { diaNoFuso, FUSO_RELATORIOS } from "@/lib/relatorios";

type Props = {
  clinicaId: string;
  animalId: string;
  consultaId?: string;
  modoConsulta?: boolean;
  podeConfigurar?: boolean;
};
type Historico = Awaited<ReturnType<typeof listarExamesLaboratoriais>>;
const campo =
  "min-h-10 min-w-0 w-full rounded-lg border bg-background px-3 py-2 text-sm font-normal";
const botao =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50";
const primario = botao + " bg-primary text-primary-foreground";
const grade =
  "min-w-0 grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(108px,1fr)_minmax(76px,1fr)]";
const dataBR = (dia: string) => dia.split("-").reverse().join("/");
const agora = () => ({
  data: diaNoFuso(new Date().toISOString()),
  hora: new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: FUSO_RELATORIOS,
  }).format(new Date()),
});
const msg = (e: unknown, texto: string) => (e instanceof Error ? e.message : texto);
async function token() {
  const { data, error } = await supabaseBanco.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sessão expirada. Entre novamente.");
  return data.session.access_token;
}
function base64(arquivo: File) {
  return new Promise<string>((ok, falha) => {
    const reader = new FileReader();
    reader.onload = () => ok(String(reader.result));
    reader.onerror = () => falha(new Error("Não foi possível ler o PDF."));
    reader.readAsDataURL(arquivo);
  });
}

export function PainelExamesLaboratoriais({
  clinicaId,
  animalId,
  consultaId,
  modoConsulta,
  podeConfigurar,
}: Props) {
  const [historico, setHistorico] = useState<Historico | null>(null);
  const [erro, setErro] = useState("");
  const [revisao, setRevisao] = useState(0);
  const [aba, setAba] = useState<"registros" | "evolucao">("registros");
  const [editando, setEditando] = useState(false);
  const [painel, setPainel] = useState<PainelLab>("bioquimico");
  const [linhas, setLinhas] = useState(() => criarLinhasLab("bioquimico"));
  const [momento, setMomento] = useState(agora);
  const [laboratorio, setLaboratorio] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [ocupado, setOcupado] = useState<"" | "referencias" | "salvar" | "baixar">("");
  const [status, setStatus] = useState("");
  const chaveRegistro = useRef("");
  const listaId = useId();

  useEffect(() => {
    let ativa = true;
    setErro("");
    void token()
      .then((accessToken) =>
        listarExamesLaboratoriais({ data: { accessToken, clinicaId, animalId } }),
      )
      .then((dados) => {
        if (ativa) setHistorico(dados);
      })
      .catch((e: unknown) => {
        if (ativa) setErro(msg(e, "Não foi possível carregar os exames."));
      });
    return () => {
      ativa = false;
    };
  }, [clinicaId, animalId, revisao]);

  const series = useMemo(() => seriesLaboratoriais(historico?.exames || []), [historico]);
  const laboratorios = [
    ...new Set([
      ...LABORATORIOS_ORIGEM,
      ...(historico?.laboratorios || []),
      ...(historico?.exames.map((e) => e.laboratorio) || []),
    ]),
  ];
  function iniciar() {
    chaveRegistro.current = crypto.randomUUID();
    setMomento(agora());
    setPainel("bioquimico");
    setLinhas(criarLinhasLab("bioquimico"));
    setLaboratorio("");
    setObservacoes("");
    setArquivo(null);
    setAba("registros");
    setEditando(true);
    setStatus("");
  }
  function trocarPainel(valor: PainelLab) {
    if (valor === painel) return;
    if (
      linhas.some((l) => l.valor || l.referencia) &&
      !window.confirm("Trocar o painel e descartar as linhas preenchidas?")
    )
      return;
    setPainel(valor);
    setLinhas(criarLinhasLab(valor));
    setStatus("");
  }
  function alterarLinha(id: string, chave: keyof Omit<LinhaLab, "parametroId">, valor: string) {
    setLinhas((ls) =>
      ls.map((l) =>
        l.parametroId !== id
          ? l
          : {
              ...l,
              [chave]: valor,
              ...(chave === "unidade" && unidadeComparavel(l.unidade) !== unidadeComparavel(valor)
                ? { referencia: "" }
                : {}),
            },
      ),
    );
  }
  async function referencias(salvar: boolean) {
    if (!laboratorio.trim() || ocupado || !historico) return;
    if (
      !salvar &&
      linhas.some((l) => l.referencia) &&
      !window.confirm("Substituir as referências já digitadas pelas referências do laboratório?")
    )
      return;
    setOcupado("referencias");
    setStatus("");
    try {
      const a = {
        accessToken: await token(),
        clinicaId,
        animalId,
        laboratorio: laboratorio.trim(),
        painel,
      };
      if (salvar) {
        const refs = linhas
          .filter((l) => !l.parametroId.startsWith("personalizado-"))
          .map(({ parametroId, unidade, referencia }) => ({ parametroId, unidade, referencia }));
        if (!refs.some((r) => r.referencia.trim()))
          throw new Error("Preencha ao menos uma faixa para cadastrá-la.");
        if (
          !window.confirm(
            "Substituir as faixas reutilizáveis deste laboratório, espécie e painel? Os exames anteriores não mudam.",
          )
        )
          return;
        await salvarReferenciasLaboratoriais({ data: { ...a, referencias: refs } });
        setStatus("Referências salvas para este laboratório, espécie e painel.");
        setRevisao((r) => r + 1);
      } else {
        const resp = await listarReferenciasLaboratoriais({ data: a });
        const preenchidas = preencherReferenciasLab(
          linhas,
          resp.referencias,
          resp.especie,
          laboratorio,
        );
        setLinhas(preenchidas);
        setStatus(
          preenchidas.some((l) => l.referencia)
            ? "Confira as faixas com o laudo. Você pode ajustá-las neste exame."
            : "Sem faixas cadastradas. Informe a referência do laudo quando disponível.",
        );
      }
    } catch (e) {
      setStatus(msg(e, "Não foi possível consultar as referências."));
    } finally {
      setOcupado("");
    }
  }
  async function gravar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    setOcupado("salvar");
    setStatus("");
    try {
      const entrada = salvarExameLabSchema.safeParse({
        accessToken: await token(),
        clinicaId,
        animalId,
        consultaId,
        id: chaveRegistro.current,
        painel,
        ...momento,
        laboratorio,
        observacoes,
        temPdf: !!arquivo,
        resultados: linhas.filter((l) => l.valor.trim()),
      });
      if (!entrada.success)
        throw new Error(
          entrada.error.issues[0]?.path[0] === "resultados"
            ? "Confira os nomes e valores e registre pelo menos um resultado."
            : entrada.error.issues[0]?.message,
        );
      if (arquivo)
        await enviarAnexoPortal({
          data: {
            accessToken: entrada.data.accessToken,
            clinicaId,
            animalId,
            registroId: entrada.data.id,
            categoria: "exames",
            nome: arquivo.name,
            base64: await base64(arquivo),
          },
        });
      const exame = await salvarExameLaboratorial({ data: entrada.data });
      setHistorico((atual) =>
        atual
          ? { ...atual, exames: [exame, ...atual.exames.filter((x) => x.id !== exame.id)] }
          : atual,
      );
      setRevisao((r) => r + 1);
      setEditando(false);
      toast.success("Exame registrado no prontuário interno.");
    } catch (e) {
      setStatus(msg(e, "Não foi possível registrar o exame."));
    } finally {
      setOcupado("");
    }
  }
  async function baixar(exame: ExameLab) {
    if (ocupado) return;
    setOcupado("baixar");
    try {
      const arq = await baixarDocumentoPortal({
        data: {
          accessToken: await token(),
          clinicaEquipeId: clinicaId,
          documentoId: exame.id,
          tipo: "exame-laboratorial",
        },
      });
      const binario = Uint8Array.from(atob(arq.base64), (char) => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([binario], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = arq.nome || "exame.pdf";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.error(msg(e, "Não foi possível baixar o PDF."));
    } finally {
      setOcupado("");
    }
  }

  return (
    <section
      className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 sm:p-5"
      aria-label="Resultados laboratoriais"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <FlaskConical size={20} /> Resultados laboratoriais
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {modoConsulta
              ? "Salve no prontuário sem finalizar a consulta ou lançar valores na comanda."
              : "Registre o laudo e acompanhe as medições do paciente. Os resultados são internos."}
          </p>
        </div>
        {historico && !historico.demo && !editando && (
          <button type="button" className={primario} onClick={iniciar}>
            <Plus size={17} /> Registrar exame
          </button>
        )}
      </div>
      {erro ? (
        <p role="alert" className="text-sm">
          {erro}{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => setRevisao((r) => r + 1)}
          >
            Tentar novamente
          </button>
        </p>
      ) : !historico ? (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando exames…
        </p>
      ) : editando ? (
        <form className="min-w-0 space-y-4 rounded-xl border p-3 sm:p-4" onSubmit={gravar}>
          <div>
            <h4 className="font-bold text-primary">
              Exame em {dataBR(momento.data)} às {momento.hora}
            </h4>
            <p className="text-sm text-muted-foreground">
              Por {historico.autor} · {historico.especie}
            </p>
          </div>
          <fieldset className="min-w-0 space-y-4" disabled={Boolean(ocupado)}>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-semibold">
                Painel
                <select
                  value={painel}
                  className={campo}
                  onChange={(e) => trocarPainel(e.target.value as PainelLab)}
                >
                  {Object.entries(PAINEIS_LAB).map(([id, nome]) => (
                    <option key={id} value={id}>
                      {nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Data do exame
                <input
                  className={campo}
                  required
                  type="date"
                  max={agora().data}
                  value={momento.data}
                  onChange={(e) => setMomento({ ...momento, data: e.target.value })}
                />
              </label>
              <label className="text-sm font-semibold">
                Horário
                <input
                  required
                  className={campo}
                  type="time"
                  value={momento.hora}
                  onChange={(e) => setMomento({ ...momento, hora: e.target.value })}
                />
              </label>
              <label className="text-sm font-semibold">
                Laboratório
                <input
                  className={campo}
                  required
                  maxLength={120}
                  list={listaId}
                  value={laboratorio}
                  onChange={(e) => {
                    setLaboratorio(e.target.value);
                    setStatus("");
                    setLinhas((ls) => ls.map((l) => ({ ...l, referencia: "" })));
                  }}
                />
                <datalist id={listaId}>
                  {laboratorios.map((l) => (
                    <option value={l} key={l} />
                  ))}
                </datalist>
              </label>
            </div>
            {painel !== "outros" && historico.especie !== "Outra" && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={botao}
                  disabled={!laboratorio.trim()}
                  onClick={() => void referencias(false)}
                >
                  Carregar referências do laboratório
                </button>
                {podeConfigurar && (
                  <button
                    type="button"
                    className={botao}
                    disabled={!laboratorio.trim()}
                    onClick={() => void referencias(true)}
                  >
                    Salvar referências do laboratório e espécie
                  </button>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Transcreva o laudo. Para comparação, use vírgula decimal, sem separador de milhares.
            </p>
            <div className={grade + " hidden border-b pb-2 text-sm font-semibold sm:grid"}>
              <span>Parâmetro</span>
              <span>Resultado</span>
              <span>Referência</span>
            </div>
            {linhas.map((l) => {
              const extra = l.parametroId.startsWith("personalizado-"),
                nome = l.nome || "parâmetro personalizado";
              return (
                <div
                  key={l.parametroId}
                  className={grade + " grid items-start border-b pb-3 sm:border-0 sm:pb-0"}
                >
                  {extra ? (
                    <div className="col-span-2 flex min-w-0 gap-1 sm:col-span-1">
                      <input
                        className={campo}
                        aria-label="Nome do parâmetro personalizado"
                        placeholder="Parâmetro"
                        maxLength={120}
                        value={l.nome}
                        onChange={(e) => alterarLinha(l.parametroId, "nome", e.target.value)}
                      />
                      <button
                        type="button"
                        aria-label="Remover parâmetro personalizado"
                        className="px-1"
                        onClick={() =>
                          setLinhas((ls) => ls.filter((a) => a.parametroId !== l.parametroId))
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ) : (
                    <span className="col-span-2 break-words text-sm font-semibold sm:col-span-1 sm:pt-2 sm:font-medium">
                      {l.nome}
                    </span>
                  )}
                  <div className="min-w-0">
                    <span aria-hidden="true" className="mb-1 block text-xs font-medium sm:hidden">
                      Resultado
                    </span>
                    <div className="flex min-w-0 rounded-lg border">
                      <input
                        className="min-h-10 min-w-0 flex-1 rounded-l-lg bg-background px-2 text-sm"
                        aria-label={"Resultado: " + nome}
                        maxLength={100}
                        value={l.valor}
                        onChange={(e) => alterarLinha(l.parametroId, "valor", e.target.value)}
                      />
                      <input
                        className="w-1/2 min-w-9 max-w-[5.5rem] rounded-r-lg border-l bg-muted px-1 text-center text-xs"
                        aria-label={"Unidade: " + nome}
                        placeholder="Unidade"
                        maxLength={35}
                        value={l.unidade}
                        onChange={(e) => alterarLinha(l.parametroId, "unidade", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <span aria-hidden="true" className="mb-1 block text-xs font-medium sm:hidden">
                      Referência
                    </span>
                    <input
                      className={campo}
                      aria-label={"Referência: " + nome}
                      placeholder="Sem faixa"
                      maxLength={140}
                      value={l.referencia}
                      onChange={(e) => alterarLinha(l.parametroId, "referencia", e.target.value)}
                    />
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              className={botao}
              disabled={linhas.length >= 60}
              onClick={() =>
                setLinhas((ls) => [
                  ...ls,
                  {
                    parametroId: "personalizado-" + crypto.randomUUID(),
                    nome: "",
                    unidade: "",
                    valor: "",
                    referencia: "",
                  },
                ])
              }
            >
              <Plus size={16} /> Adicionar parâmetro
            </button>
            <label className="block text-sm font-semibold">
              Observações do laudo
              <textarea
                className={campo}
                maxLength={2500}
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold">
              Anexar laudo em PDF (opcional, até 20 MB)
              <input
                className="mt-2 block max-w-full text-sm"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => {
                  const novo = e.currentTarget.files?.[0] || null;
                  if (
                    novo &&
                    (novo.type !== "application/pdf" || novo.size > PORTAL_PDF_MAX_BYTES)
                  ) {
                    setStatus("Selecione um PDF de até 20 MB.");
                    e.currentTarget.value = "";
                    setArquivo(null);
                    return;
                  }
                  if (novo !== arquivo) chaveRegistro.current = crypto.randomUUID();
                  setArquivo(novo);
                }}
              />
            </label>
          </fieldset>
          {status && (
            <p role="status" className="rounded-lg bg-muted p-3 text-sm">
              {status}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={primario} disabled={!!ocupado}>
              {ocupado === "salvar" ? "Registrando…" : "Salvar resultado"}
            </button>
            <button
              type="button"
              className={botao}
              disabled={!!ocupado}
              onClick={() => setEditando(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={aba === "registros"}
              className={aba === "registros" ? primario : botao}
              onClick={() => setAba("registros")}
            >
              Histórico de exames
            </button>
            <button
              type="button"
              aria-pressed={aba === "evolucao"}
              className={aba === "evolucao" ? primario : botao}
              onClick={() => setAba("evolucao")}
            >
              Evolução
            </button>
          </div>
          {aba === "evolucao" ? (
            <Evolucao series={series} />
          ) : (
            <>
              {!historico.exames.length && (
                <p className="text-sm text-muted-foreground">
                  Nenhum resultado laboratorial estruturado registrado para este paciente.
                </p>
              )}
              {historico.exames.map((e) => (
                <details key={e.id} className="rounded-xl border p-3">
                  <summary className="cursor-pointer break-words text-sm font-bold">
                    {PAINEIS_LAB[e.painel]} · {dataBR(e.data)} às {e.hora} · {e.laboratorio}
                    {consultaId && consultaId === e.consultaId ? " · Desta consulta" : ""}
                  </summary>
                  <p className="my-2 text-xs text-muted-foreground">
                    Por {e.autor} · {e.especie}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr>
                          <th scope="col" className="p-1">
                            Parâmetro
                          </th>
                          <th scope="col" className="p-1">
                            Resultado
                          </th>
                          <th scope="col" className="p-1">
                            Referência registrada
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {e.resultados.map((r) => (
                          <tr key={r.parametroId} className="border-t">
                            <td className="p-1">{r.nome}</td>
                            <td className="p-1">
                              {r.valor} {r.unidade}
                            </td>
                            <td className="p-1">{r.referencia || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {e.observacoes && (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm">{e.observacoes}</p>
                  )}
                  {e.temPdf && (
                    <button
                      type="button"
                      className={botao + " mt-2"}
                      disabled={!!ocupado}
                      onClick={() => void baixar(e)}
                    >
                      <Download size={15} /> Baixar laudo
                    </button>
                  )}
                </details>
              ))}
            </>
          )}
        </>
      )}
    </section>
  );
}

function Evolucao({ series }: { series: SerieLab[] }) {
  const [selecionada, setSelecionada] = useState("");
  const serie = series.find((s) => s.chave === selecionada) || series[0];
  if (!serie)
    return (
      <p className="text-sm text-muted-foreground">Registre resultados para ver a evolução.</p>
    );
  const medidos = serie.pontos.filter((p) => p.numerico !== null);
  const nums = medidos.map((p) => p.numerico!);
  const minimo = nums.reduce((a, b) => Math.min(a, b), Infinity),
    maximo = nums.reduce((a, b) => Math.max(a, b), -Infinity);
  const tempos = medidos.map((p) => Date.parse(p.data + "T" + p.hora + ":00Z"));
  const intervalo = tempos.at(-1)! - tempos[0]!;
  const pontos =
    nums.length > 1
      ? nums.map((n, i) => [
          36 + 428 * (intervalo > 0 ? (tempos[i] - tempos[0]) / intervalo : i / (nums.length - 1)),
          maximo === minimo ? 69 : 115 - (92 * (n - minimo)) / (maximo - minimo),
        ])
      : [];
  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold">
        Parâmetro e unidade
        <select
          className={campo}
          value={serie.chave}
          onChange={(e) => setSelecionada(e.target.value)}
        >
          {series.map((s) => (
            <option key={s.chave} value={s.chave}>
              {s.nome} · {s.unidade || "Sem unidade"} · {PAINEIS_LAB[s.painel]}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">
        Só valores numéricos do mesmo parâmetro e unidade entram no gráfico. Confira laboratório e
        referência de cada data. A curva não indica diagnóstico.
      </p>
      {pontos.length ? (
        <svg
          viewBox="0 0 500 140"
          className="w-full max-w-2xl rounded-xl border"
          role="img"
          aria-label={"Evolução de " + serie.nome + " em " + serie.unidade + ", em ordem de data"}
        >
          <path d="M36 16 V116 H464" stroke="currentColor" opacity=".35" fill="none" />
          <polyline
            points={pontos.map((p) => p.join(",")).join(" ")}
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />
          {pontos.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="4" fill="currentColor">
              <title>
                {dataBR(medidos[i].data) + ": " + medidos[i].valor + " " + serie.unidade}
              </title>
            </circle>
          ))}
        </svg>
      ) : (
        <p className="text-sm text-muted-foreground">
          São necessários dois registros numéricos com unidade compatível para mostrar o gráfico.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {["Data e hora", "Laboratório", "Resultado", "Referência registrada"].map((label) => (
                <th key={label} scope="col" className="p-2">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {serie.pontos.map((p, i) => (
              <tr key={p.id + i} className="border-t">
                <td className="p-2">
                  {dataBR(p.data)} {p.hora}
                </td>
                <td className="p-2">{p.laboratorio}</td>
                <td className="p-2">
                  {p.valor} {serie.unidade}
                </td>
                <td className="p-2">{p.referencia || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
