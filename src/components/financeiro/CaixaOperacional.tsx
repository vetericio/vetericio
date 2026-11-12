import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine, ArrowLeftRight, ArrowUpRight, Banknote, CheckCircle2, ClipboardList,
  FileDown, LockKeyhole, Plus, ReceiptText, RefreshCw, ShieldAlert, Wallet, X,
} from "lucide-react";
import { toast } from "sonner";
import { supabaseBanco } from "@/integrations/supabase/client";

type Turno = {
  id: string; clinica_id: string; aberto_por: string; aberto_em: string;
  fundo_centavos: number; observacao_abertura: string; aberto_nome?: string; fechado_nome?: string | null; status: "aberto" | "fechado";
  fechado_em: string | null; fechado_por: string | null;
  contado_centavos: number | null; esperado_centavos: number | null;
  divergencia_centavos: number | null; justificativa_fechamento: string;
  resumo_fechamento: ResumoTurno | null;
};
type Ajuste = {
  id: string; turno_id: string; tipo: "sangria" | "suprimento"; valor_centavos: number;
  motivo: string; registrado_em: string; registrado_por: string;
};
type Estorno = {
  id: string; lancamento_id: string; valor_centavos: number; motivo: string;
  status: "solicitado" | "confirmado" | "rejeitado";
  solicitado_em: string; solicitado_por: string; revisado_em: string | null;
  referencia_comprovante: string | null;
};
type LancamentoCentral = {
  id: string; descricao: string; setor: string; valor_centavos: number;
  status: string; tipo: string; forma_pagamento: string; registrado_em: string;
};
type ResumoTurno = {
  fundo_centavos: number; esperado_centavos: number; dinheiro_centavos: number;
  pix_centavos: number; credito_centavos: number; debito_centavos: number;
  outras_formas_centavos: number; sangria_centavos: number; suprimento_centavos: number;
  estorno_dinheiro_centavos: number; fonte: string;
};
type Operacao = "abrir" | "suprimento" | "sangria" | "fechar" | "estorno" | "revisar" | null;

type Props = {
  clinicaId: string;
  recebido: number;
  pendente: number;
  despesas: number;
  podeOperar: boolean;
  podeAprovar: boolean;
  lancamentosLegadosNoDia: number;
  onNovoLancamento: () => void;
  onVerLancamentos: () => void;
};

function formatarCentavos(valor: number | null | undefined) {
  return ((valor || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dinheiroReal(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function centavosDeTexto(texto: string): number {
  const limpo = texto.trim().replace(/\s/g, "").replace(/R\$/gi, "");
  if (!limpo) return Number.NaN;
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normal);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : Number.NaN;
}
function mensagemErro(error: unknown) {
  const mensagem = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : error instanceof Error ? error.message : "Falha de comunicação com o servidor.";
  return mensagem || "Não foi possível confirmar a operação no servidor.";
}
function dataBR(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
}
function csvSeguro(campo: string | number | null | undefined) {
  let valor = String(campo ?? "");
  if (/^[\s]*[=+@\-]/.test(valor)) valor = "'" + valor;
  return '"' + valor.replace(/"/g, '""') + '"';
}

export function CaixaOperacional({
  clinicaId, recebido, pendente, despesas, podeOperar, podeAprovar,
  lancamentosLegadosNoDia, onNovoLancamento, onVerLancamentos,
}: Props) {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [ajustes, setAjustes] = useState<Ajuste[]>([]);
  const [estornos, setEstornos] = useState<Estorno[]>([]);
  const [lancamentosCentrais, setLancamentosCentrais] = useState<LancamentoCentral[]>([]);
  const [resumo, setResumo] = useState<ResumoTurno | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [operacao, setOperacao] = useState<Operacao>(null);
  const [chaveOperacao, setChaveOperacao] = useState("");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [lancamentoId, setLancamentoId] = useState("");
  const [estornoId, setEstornoId] = useState("");
  const [referencia, setReferencia] = useState("");
  const [comprovadoExternamente, setComprovadoExternamente] = useState(false);
  const [rejeitar, setRejeitar] = useState(false);
  const [entendi, setEntendi] = useState(false);

  const turnoAberto = useMemo(() => turnos.find(t => t.status === "aberto") || null, [turnos]);
  const solicitacoes = useMemo(() => estornos.filter(e => e.status === "solicitado"), [estornos]);

  const atualizar = useCallback(async () => {
    if (!clinicaId) { setCarregando(false); return; }
    setCarregando(true);
    try {
      const [turnosResp, ajustesResp, estornosResp, movimentosResp] = await Promise.all([
        (supabaseBanco as any).from("oricse_caixa_turnos").select("*")
          .eq("clinica_id", clinicaId).order("aberto_em", { ascending: false }).limit(75),
        (supabaseBanco as any).from("oricse_caixa_ajustes").select("*")
          .eq("clinica_id", clinicaId).order("registrado_em", { ascending: false }).limit(1500),
        (supabaseBanco as any).from("oricse_caixa_estornos").select("*")
          .eq("clinica_id", clinicaId).order("solicitado_em", { ascending: false }).limit(500),
        (supabaseBanco as any).from("oricse_caixa_lancamentos")
          .select("id,descricao,setor,valor_centavos,status,tipo,forma_pagamento,registrado_em")
          .eq("clinica_id", clinicaId).eq("tipo", "entrada").eq("status", "pago")
          .order("registrado_em", { ascending: false }).limit(500),
      ]);
      const problema = [turnosResp, ajustesResp, estornosResp, movimentosResp].find(r => r.error);
      if (problema) throw problema.error;
      const proximosTurnos = (turnosResp.data || []) as Turno[];
      const aberto = proximosTurnos.find(t => t.status === "aberto");
      let resumoAtual: ResumoTurno | null = null;
      if (aberto) {
        const resposta = await (supabaseBanco as any).rpc("oricse_caixa_resumo_turno", { p_turno_id: aberto.id });
        if (resposta.error) throw resposta.error;
        resumoAtual = resposta.data as ResumoTurno;
      }
      setTurnos(proximosTurnos);
      setAjustes((ajustesResp.data || []) as Ajuste[]);
      setEstornos((estornosResp.data || []) as Estorno[]);
      setLancamentosCentrais((movimentosResp.data || []) as LancamentoCentral[]);
      setResumo(resumoAtual);
      setErro("");
    } catch (error) {
      setErro("Não foi possível carregar as operações do Caixa: " + mensagemErro(error));
    } finally {
      setCarregando(false);
    }
  }, [clinicaId]);

  useEffect(() => { void atualizar(); }, [atualizar]);

  function abrirOperacao(proxima: Operacao) {
    setValor("");
    setMotivo("");
    setReferencia("");
    setLancamentoId("");
    setEstornoId("");
    setComprovadoExternamente(false);
    setRejeitar(false);
    setEntendi(false);
    setChaveOperacao(crypto.randomUUID());
    setOperacao(proxima);
  }

  async function confirmar() {
    if (!clinicaId || !operacao || ocupado) return;
    const c = centavosDeTexto(valor);
    if (operacao === "abrir" && (!Number.isFinite(c) || c < 0))
      return void toast.error("Informe um fundo de troco válido (pode ser zero).");
    if (["sangria", "suprimento", "estorno"].includes(operacao) && (!Number.isFinite(c) || c <= 0))
      return void toast.error("Informe um valor maior que zero.");
    if (["sangria", "suprimento"].includes(operacao) && motivo.trim().length < 5)
      return void toast.error("Escreva um motivo com pelo menos 5 caracteres.");
    if (operacao === "estorno" && (!lancamentoId || motivo.trim().length < 10))
      return void toast.error("Escolha o pagamento e informe um motivo com pelo menos 10 caracteres.");
    if (operacao === "fechar" && (!Number.isFinite(c) || !entendi))
      return void toast.error("Informe a contagem física e confirme a abrangência do fechamento.");
    if (operacao === "fechar" && resumo && c !== resumo.esperado_centavos && motivo.trim().length < 10)
      return void toast.error("Justifique a diferença de caixa com pelo menos 10 caracteres.");
    if (operacao === "revisar" && (!estornoId || (!rejeitar && (!comprovadoExternamente || referencia.trim().length < 8))))
      return void toast.error("Informe a solicitação, o comprovante externo e confirme que o valor foi devolvido.");

    setOcupado(true);
    try {
      let nome = "Operação";
      let resposta: { data: unknown; error: { message: string } | null } | undefined;
      if (operacao === "abrir") {
        nome = "Caixa aberto";
        resposta = await (supabaseBanco as any).rpc("oricse_caixa_abrir", {
          p_clinica_id: clinicaId, p_fundo_centavos: c, p_observacao: motivo,
        });
      } else if ((operacao === "sangria" || operacao === "suprimento") && turnoAberto) {
        nome = operacao === "sangria" ? "Sangria registrada" : "Suprimento registrado";
        resposta = await (supabaseBanco as any).rpc("oricse_caixa_movimentar", {
          p_turno_id: turnoAberto.id, p_tipo: operacao, p_valor_centavos: c,
          p_motivo: motivo, p_idempotencia: chaveOperacao,
        });
      } else if (operacao === "fechar" && turnoAberto) {
        nome = "Caixa fechado";
        resposta = await (supabaseBanco as any).rpc("oricse_caixa_fechar", {
          p_turno_id: turnoAberto.id, p_contado_centavos: c, p_justificativa: motivo,
        });
      } else if (operacao === "estorno") {
        nome = "Estorno solicitado; ainda não foi executado";
        resposta = await (supabaseBanco as any).rpc("oricse_caixa_solicitar_estorno", {
          p_lancamento_id: lancamentoId, p_valor_centavos: c, p_motivo: motivo,
        });
      } else if (operacao === "revisar") {
        nome = rejeitar ? "Solicitação rejeitada" : "Confirmação externa registrada";
        resposta = await (supabaseBanco as any).rpc("oricse_caixa_revisar_estorno", {
          p_estorno_id: estornoId, p_aprovar: !rejeitar, p_referencia: referencia || motivo,
        });
      } else {
        throw new Error("Abra o caixa ou selecione a operação disponível.");
      }
      if (resposta?.error) throw resposta.error;
      if (!resposta?.data) throw new Error("O banco não confirmou esta operação.");
      toast.success(nome);
      setOperacao(null);
      await atualizar();
      window.dispatchEvent(new Event("oricse:caixa-alterado"));
    } catch (error) {
      const mensagem = mensagemErro(error);
      toast.error(mensagem);
      setErro(mensagem);
    } finally {
      setOcupado(false);
    }
  }

  async function gerarPdfFechamento(turno: Turno) {
    if (turno.status !== "fechado" || !turno.resumo_fechamento) return void toast.error("Fechamento ainda não confirmado.");
    try {
      const { jsPDF } = await import("jspdf");
      const documento = new jsPDF({ unit: "mm", format: "a4" });
      const esquerdo = 20;
      let y = 22;
      const linha = (rotulo: string, valor: string, destaque = false) => {
        if (y > 275) { documento.addPage(); y = 22; }
        documento.setFont("helvetica", destaque ? "bold" : "normal");
        documento.setFontSize(destaque ? 11 : 10);
        documento.text(rotulo, esquerdo, y);
        documento.text(valor, 190, y, { align: "right" });
        y += 9;
      };
      documento.setFont("helvetica", "bold");
      documento.setFontSize(18); documento.text("ORICSE", esquerdo, y); y += 10;
      documento.setFontSize(13); documento.text("Comprovante de fechamento de caixa", esquerdo, y); y += 12;
      documento.setDrawColor(180,150,160); documento.line(esquerdo,y,190,y); y += 9;
      linha("ID do fechamento", turno.id);
      linha("Aberto", dataBR(turno.aberto_em));
      linha("Operador", turno.aberto_nome || turno.aberto_por);
      linha("Fechado", dataBR(turno.fechado_em));
      linha("Responsavel pelo fechamento", turno.fechado_nome || turno.fechado_por || "");
      y += 3;documento.line(esquerdo,y,190,y);y += 8;
      const resumo = turno.resumo_fechamento;
      linha("Fundo inicial", formatarCentavos(resumo.fundo_centavos));
      linha("Dinheiro recebido (central)", formatarCentavos(resumo.dinheiro_centavos));
      linha("Pix registrado", formatarCentavos(resumo.pix_centavos));
      linha("Credito registrado", formatarCentavos(resumo.credito_centavos));
      linha("Debito registrado", formatarCentavos(resumo.debito_centavos));
      linha("Outras formas", formatarCentavos(resumo.outras_formas_centavos));
      linha("Suprimentos", formatarCentavos(resumo.suprimento_centavos));
      linha("Sangrias", formatarCentavos(resumo.sangria_centavos));
      linha("Estornos em dinheiro confirmados", formatarCentavos(resumo.estorno_dinheiro_centavos));
      y += 3;documento.line(esquerdo,y,190,y);y += 8;
      linha("Esperado em especie", formatarCentavos(turno.esperado_centavos), true);
      linha("Dinheiro contado", formatarCentavos(turno.contado_centavos), true);
      linha("Diferenca", formatarCentavos(turno.divergencia_centavos), true);
      const justificativa = turno.justificativa_fechamento?.trim();
      if(justificativa){
        y += 5;documento.setFontSize(10);documento.setFont("helvetica","bold");
        documento.text("Justificativa da divergencia",esquerdo,y);y+=6;
        documento.setFont("helvetica","normal");
        const linhas = documento.splitTextToSize(justificativa,165);
        documento.text(linhas,esquerdo,y);y+=linhas.length*5+6;
      }
      y+=7;
      const nota = "Fechamento parcial: inclui apenas movimentos centralizados no PostgreSQL. Pagamentos legados nao conciliados ficam fora do calculo.";
      documento.setFontSize(9);documento.setFont("helvetica","italic");
      documento.text(documento.splitTextToSize(nota,170),esquerdo,Math.min(y,270));
      documento.save("oricse-fechamento-"+turno.id.slice(0,8)+".pdf");
    } catch (error) {
      toast.error("Não foi possível gerar o PDF: " + mensagemErro(error));
    }
  }

  function exportarHistorico() {
    const cabecalho = ["Tipo", "Registrado em", "Caixa", "Valor (R$)", "Operador", "Motivo ou referência", "Estado"];
    const linhas: (string | number | null)[][] = [
      ...turnos.map(t => ["Abertura", t.aberto_em, t.id, (t.fundo_centavos / 100).toFixed(2), t.aberto_nome || t.aberto_por, t.observacao_abertura, t.status]),
      ...turnos.filter(t => t.fechado_em).map(t => ["Fechamento", t.fechado_em, t.id, ((t.contado_centavos || 0) / 100).toFixed(2), t.fechado_nome || t.fechado_por || "", t.justificativa_fechamento, "fechado"]),
      ...ajustes.map(a => [a.tipo, a.registrado_em, a.turno_id, (a.valor_centavos / 100).toFixed(2), a.registrado_por, a.motivo, "registrado"]),
      ...estornos.map(e => ["Estorno", e.solicitado_em, e.lancamento_id, (e.valor_centavos / 100).toFixed(2), e.solicitado_por, e.motivo, e.status]),
    ];
    const cab = cabecalho.map(csvSeguro).join(";");
    const dados = [cab, ...linhas.map(l => l.map(csvSeguro).join(";"))].join("\r\n");
    const arquivo = new Blob(["\uFEFF" + dados], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement("a");
    link.href = url; link.download = "oricse-caixa-historico-" + new Date().toISOString().slice(0,10) + ".csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const botoes: Array<{ id: Exclude<Operacao,null> | "lancamento" | "relatorio"; label: string; Icone: typeof Plus; ativo: boolean }> = [
    { id: "lancamento", label: "Lançamento", Icone: Plus, ativo: podeOperar },
    { id: "estorno", label: "Estorno", Icone: ArrowLeftRight, ativo: podeOperar },
    { id: turnoAberto ? "fechar" : "abrir", label: turnoAberto ? "Fechar caixa" : "Abrir caixa", Icone: LockKeyhole, ativo: podeOperar },
    { id: "sangria", label: "Sangria", Icone: ArrowUpRight, ativo: podeOperar && !!turnoAberto },
    { id: "suprimento", label: "Suprimento", Icone: Banknote, ativo: podeOperar && !!turnoAberto },
    { id: "relatorio", label: "Relatórios", Icone: FileDown, ativo: true },
  ];

  return (
    <section className="mb-5 space-y-4" aria-label="Operações do caixa">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><Wallet size={22} className="text-primary"/>
              <h2 className="text-xl font-extrabold">Caixa da clínica</h2></div>
            <p className="mt-1 text-sm text-muted-foreground">
              {carregando ? "Carregando..." : turnoAberto ? "Aberto em " + dataBR(turnoAberto.aberto_em) + " · Operador: " + (turnoAberto.aberto_nome || "Identificado pelo cadastro") : "Nenhum caixa operacional aberto"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={"rounded-full px-3 py-1.5 text-xs font-bold " + (turnoAberto ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700")}>
              {turnoAberto ? "Aberto" : "Fechado"}
            </span>
            <button type="button" onClick={()=>void atualizar()} disabled={carregando} aria-label="Atualizar situação do caixa" className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50"><RefreshCw size={15}/> Atualizar</button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { titulo: "Recebido hoje", valor: recebido, icone: ArrowDownToLine },
            { titulo: "A receber", valor: pendente, icone: ReceiptText },
            { titulo: "Despesas", valor: despesas, icone: ArrowUpRight },
            { titulo: "Resultado do dia", valor: recebido-despesas, icone: Wallet },
          ].map(({titulo,valor:total,icone:Icone})=>(
            <article key={titulo} className="rounded-xl bg-secondary/45 p-3 sm:p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Icone size={16}/>{titulo}</div>
              <p className="mt-2 break-words text-xl font-extrabold tabular-nums sm:text-2xl">{dinheiroReal(total)}</p>
            </article>
          ))}
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">Os indicadores do dia incluem lançamentos legados; a conferência física oficial utiliza apenas os lançamentos centralizados no PostgreSQL e ajustes do turno.</p>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {botoes.map(({id,label,Icone,ativo})=>(
            <button key={id} type="button" disabled={!ativo || ocupado || carregando}
              onClick={()=>id==="lancamento" ? onNovoLancamento() : id==="relatorio" ? exportarHistorico() : abrirOperacao(id)}
              className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-1 py-2 text-center text-xs font-bold leading-4 text-foreground hover:border-primary hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40">
              <Icone size={22} className="text-primary"/>{label}
            </button>
          ))}
        </div>
        {turnoAberto && resumo && <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 text-sm">
          <span>Troco inicial: <strong>{formatarCentavos(resumo.fundo_centavos)}</strong></span>
          <span>Dinheiro esperado: <strong>{formatarCentavos(resumo.esperado_centavos)}</strong></span>
          <span>Pix registrado: <strong>{formatarCentavos(resumo.pix_centavos)}</strong></span>
          <span>Sangrias: <strong>{formatarCentavos(resumo.sangria_centavos)}</strong></span>
          <span>Suprimentos: <strong>{formatarCentavos(resumo.suprimento_centavos)}</strong></span>
        </div>}
        {lancamentosLegadosNoDia > 0 && <p role="status" className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          <ShieldAlert size={18} className="mt-1 shrink-0"/>
          Há {lancamentosLegadosNoDia} lançamento(s) do dia no armazenamento anterior. Eles aparecem no painel, mas ainda não compõem a conferência oficial do caixa. Não feche o turno como totalmente conciliado sem conferir esses recebimentos.
        </p>}
        {erro && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
      </div>

      <details className="rounded-2xl border bg-card p-4">
        <summary className="cursor-pointer text-base font-bold">Histórico de fechamentos e auditoria</summary>
        {turnos.length ? <div className="mt-3 space-y-2">
          {turnos.slice(0,12).map(t=>(
            <div key={t.id} className="flex flex-wrap justify-between gap-2 rounded-lg border p-3 text-sm">
              <div><strong>Aberto em {dataBR(t.aberto_em)}</strong><p className="text-xs text-muted-foreground">Operador: {t.aberto_nome || t.aberto_por.slice(0,8)} · {t.status==="aberto"?"Em andamento":"Fechado em "+dataBR(t.fechado_em)}</p></div>
              <div className="flex items-center gap-3">
                <div className="text-right"><strong>{t.status==="aberto"?"Aberto":formatarCentavos(t.contado_centavos)}</strong>{t.status==="fechado"&&<p className="text-xs text-muted-foreground">Diferença: {formatarCentavos(t.divergencia_centavos)}</p>}</div>
                {t.status==="fechado"&&<button type="button" onClick={()=>void gerarPdfFechamento(t)}
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg border px-3 text-xs font-semibold">
                  <FileDown size={15}/> PDF
                </button>}
              </div>
            </div>
          ))}
        </div> : <p className="mt-3 text-sm text-muted-foreground">Nenhum turno registrado.</p>}
        {solicitacoes.length>0 && <p className="mt-3 text-sm text-amber-800">{solicitacoes.length} solicitação(ões) de estorno aguardando análise.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={exportarHistorico} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold"><FileDown size={16}/> Exportar histórico CSV</button>
          <button type="button" onClick={onVerLancamentos} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold"><ClipboardList size={16}/> Ver lançamentos</button>
          {podeAprovar && solicitacoes.length>0 && <button type="button" onClick={()=>abrirOperacao("revisar")} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground">Revisar estornos</button>}
        </div>
      </details>

      {operacao && <div className="rounded-2xl border-2 border-primary/30 bg-card p-4 shadow-sm sm:p-5" role="region" aria-label="Formulário de operação do caixa">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-extrabold">{{
            abrir:"Abrir novo caixa",sangria:"Retirada de dinheiro · Sangria",
            suprimento:"Entrada de troco · Suprimento",fechar:"Conferência e fechamento",
            estorno:"Solicitar estorno",revisar:"Revisar estorno",
          }[operacao]}</h3>
          <button type="button" aria-label="Fechar formulário" onClick={()=>setOperacao(null)} className="rounded-lg border p-2"><X size={18}/></button>
        </div>
        {operacao==="fechar"&&resumo&&<div className="mt-3 rounded-xl bg-secondary/40 p-3 text-sm">
          <p>Dinheiro esperado (lançamentos centrais): <strong>{formatarCentavos(resumo.esperado_centavos)}</strong></p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{resumo.fonte}</p>
        </div>}
        {operacao==="estorno"&&<label className="mt-3 block text-sm font-semibold">
          Pagamento centralizado
          <select value={lancamentoId} onChange={e=>{setLancamentoId(e.target.value);const l=lancamentosCentrais.find(x=>x.id===e.target.value);if(l)setValor((l.valor_centavos/100).toFixed(2).replace(".",","));}}
            className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-sm">
            <option value="">Selecionar transação confirmada</option>
            {lancamentosCentrais.map(l=><option value={l.id} key={l.id}>{l.descricao} · {formatarCentavos(l.valor_centavos)} · {dataBR(l.registrado_em)}</option>)}
          </select>
          <p className="mt-1 text-xs font-normal text-muted-foreground">Pagamentos de comandas legadas ainda não podem ser estornados por esta tela. Não altere manualmente o histórico original.</p>
        </label>}
        {operacao==="revisar"&&<label className="mt-3 block text-sm font-semibold">
          Solicitação pendente
          <select value={estornoId} onChange={e=>setEstornoId(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-sm">
            <option value="">Selecionar solicitação</option>
            {solicitacoes.map(e=><option value={e.id} key={e.id}>{formatarCentavos(e.valor_centavos)} · {e.motivo.slice(0,70)}</option>)}
          </select>
        </label>}
        {operacao!=="revisar"&&<label className="mt-3 block text-sm font-semibold">
          {operacao==="fechar"?"Dinheiro contado na gaveta (R$)":operacao==="abrir"?"Fundo de troco inicial (R$)":"Valor (R$)"}
          <input inputMode="decimal" value={valor} onChange={e=>setValor(e.target.value)}
            placeholder="0,00" className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-base"/>
        </label>}
        {operacao==="revisar"&&<label className="mt-3 flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={rejeitar} onChange={e=>setRejeitar(e.target.checked)} className="h-4 w-4"/> Rejeitar esta solicitação
        </label>}
        {operacao!=="revisar"&&<label className="mt-3 block text-sm font-semibold">
          {operacao==="abrir"?"Observações (opcional)":operacao==="fechar"?"Justificativa de diferença (quando houver)":"Motivo"}
          <textarea rows={2} value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Descreva o motivo quando necessário"
            className="mt-1 min-h-20 w-full rounded-xl border bg-background p-3 text-base"/>
        </label>}
        {operacao==="revisar"&&<>
          <label className="mt-3 block text-sm font-semibold">
            {rejeitar?"Justificativa da rejeição":"Referência do comprovante de devolução feita fora do ORICSE"}
            <input value={referencia} onChange={e=>setReferencia(e.target.value)} placeholder={rejeitar?"Motivo da rejeição":"Código ou referência do estorno externo"} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-base"/>
          </label>
          {!rejeitar&&<label className="mt-3 flex items-start gap-2 text-sm leading-6">
            <input type="checkbox" checked={comprovadoExternamente} onChange={e=>setComprovadoExternamente(e.target.checked)} className="mt-1 h-4 w-4"/>
            Confirmo que a devolução já foi efetuada e comprovada no banco, cartão ou provedor. O ORICSE apenas registrará essa confirmação.
          </label>}
        </>}
        {operacao==="fechar"&&<label className="mt-3 flex items-start gap-2 text-sm leading-6">
          <input type="checkbox" checked={entendi} onChange={e=>setEntendi(e.target.checked)} className="mt-1 h-4 w-4"/>
          Conferi o dinheiro físico e estou ciente de que os lançamentos legados ainda não fazem parte desta apuração automática.
        </label>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={()=>void confirmar()} disabled={ocupado||carregando}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
            <CheckCircle2 size={17}/>{ocupado?"Confirmando no banco...":operacao==="estorno"?"Enviar solicitação":operacao==="revisar"?(rejeitar?"Rejeitar":"Registrar confirmação externa"):"Confirmar operação"}
          </button>
          <button type="button" onClick={()=>setOperacao(null)} className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Cancelar</button>
        </div>
      </div>}
    </section>
  );
}
