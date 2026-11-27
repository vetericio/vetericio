import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarCheck2, CalendarClock, MessageCircle,
  Plus, RefreshCw, Search, Sparkles, Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { calcularDataRetorno, formatarDataRetorno, hojeRetornoBrasil, OPCOES_DIAS_RETORNO, situacaoPrazoRetorno, type SituacaoPrazoRetorno } from "@/lib/crm-prazos-retorno";
import { supabase, supabaseBanco } from "@/integrations/supabase/client";
import {
  atualizarRetornoClinico, listarRetornosClinica, prepararMensagemAcompanhamento, registrarRetornoClinico,
  type RetornoClinico, type StatusRetorno,
} from "@/lib/crm-retornos.functions";

type Paciente = { id: string; nome: string; tutor_id: string };
type Responsavel = { id: string; nome: string };
type Filtro = "para_tratar" | "no_prazo" | "hoje" | "atrasados" | "a_marcar" | "programados" | "todos";
const statusNome: Record<StatusRetorno,string> = {
  a_confirmar: "A confirmar", contatado: "Aguardando resposta",
  confirmado: "Confirmado", reagendar: "Reagendar",
  realizado: "Realizado", cancelado: "Cancelado",
};
const origemNome: Record<string,string> = {
  consulta: "Consulta", vacina: "Vacina", vermifugo: "Vermífugo",
  exame: "Exame", cirurgia: "Cirurgia", medicacao: "Medicação",
  manual: "Acompanhamento", outro: "Outro",
};
const corPrazo: Record<SituacaoPrazoRetorno | "encerrado", string> = {
  no_prazo: "bg-emerald-500", hoje: "bg-amber-400", atrasado: "bg-red-500",
  programado: "bg-slate-400", a_marcar: "bg-slate-400", encerrado: "bg-slate-300",
};
const nomePrazo: Record<SituacaoPrazoRetorno | "encerrado", string> = {
  no_prazo: "No prazo", hoje: "Hoje", atrasado: "Atrasado",
  programado: "Programado", a_marcar: "A marcar", encerrado: "Encerrado",
};
function prazoVisual(item: RetornoClinico, hoje: string): SituacaoPrazoRetorno | "encerrado" {
  return item.status === "realizado" || item.status === "cancelado"
    ? "encerrado" : situacaoPrazoRetorno(item.data_prevista, hoje);
}
function mostrarData(data: string | null) {
  if (!data) return "A marcar";
  return formatarDataRetorno(data);
}
function urlWhatsApp(telefone: string, mensagem: string) {
  return "https://wa.me/" + telefone + "?text=" + encodeURIComponent(mensagem);
}

export function CrmRetornosPanel({ clinicaId, podeOperar, animalPreselecionadoId }: { clinicaId: string; podeOperar: boolean; animalPreselecionadoId?: string }) {
  const [retornos, setRetornos] = useState<RetornoClinico[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [tutores, setTutores] = useState<Responsavel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [animalId, setAnimalId] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");
  const [tipoNovo, setTipoNovo] = useState("Reavaliação clínica");
  const [orientacoes, setOrientacoes] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("para_tratar");
  const [busca, setBusca] = useState("");
  const [reagendarId, setReagendarId] = useState<string | null>(null);
  const [novaData, setNovaData] = useState("");
  const [observacao, setObservacao] = useState("");
  const [preparandoMensagem, setPreparandoMensagem] = useState<string | null>(null);
  const [editorMensagem, setEditorMensagem] = useState<{ retornoId: string; telefone: string; mensagem: string } | null>(null);
  const versaoCarregamento = useRef(0);
  const clinicaSincronizada = useRef("");
  const timerSincronizacao = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recarregar = useCallback(async (sincronizar = false) => {
    if (!clinicaId) return;
    const versao = ++versaoCarregamento.current;
    setCarregando(true);
    setErro("");
    try {
      const sessao = await supabase.auth.getSession();
      const accessToken = sessao.data.session?.access_token;
      if (sessao.error || !accessToken) throw new Error("Faça login novamente.");

      // A leitura dos retornos, o seletor de pacientes e o de tutores são
      // independentes. Nenhum aguarda os demais antes de iniciar.
      const [resposta, pets, pais] = await Promise.all([
        listarRetornosClinica({ data: { clinicaId, accessToken, sincronizar } }),
        (supabaseBanco as any).from("oricse_animais").select("id,nome,tutor_id")
          .eq("clinica_id", clinicaId).order("nome").limit(2000),
        (supabaseBanco as any).from("tutores").select("id,nome")
          .eq("clinica_id", clinicaId).limit(2000),
      ]);
      if (versaoCarregamento.current !== versao) return;
      if (pets.error || pais.error) throw new Error(pets.error?.message || pais.error?.message);
      setRetornos(resposta);
      setPacientes(pets.data || []);
      setTutores(pais.data || []);

      // Sincronizar reforços UMA VEZ por acesso, sem bloquear a primeira
      // renderização. Manter revalidação para não perder vacinas/exames novos.
      if (!sincronizar && clinicaSincronizada.current !== clinicaId) {
        clinicaSincronizada.current = clinicaId;
        if (timerSincronizacao.current) clearTimeout(timerSincronizacao.current);
        timerSincronizacao.current = setTimeout(() => {
          timerSincronizacao.current = null;
          void listarRetornosClinica({
            data: { clinicaId, accessToken, sincronizar: true },
          }).then((atualizados) => {
            if (versaoCarregamento.current === versao) setRetornos(atualizados);
          }).catch((erroSync) => {
            console.warn("Retornos exibidos, mas a conciliação dos reforços não foi concluída:", erroSync);
            // Permite nova tentativa manual pelo botão Atualizar.
          });
        }, 150);
      }
    } catch (e) {
      if (versaoCarregamento.current === versao)
        setErro(e instanceof Error ? e.message : "Não foi possível carregar os retornos.");
    } finally {
      if (versaoCarregamento.current === versao) setCarregando(false);
    }
  }, [clinicaId]);

  useEffect(() => {
    void recarregar();
    return () => {
      versaoCarregamento.current += 1;
      if (timerSincronizacao.current) clearTimeout(timerSincronizacao.current);
      timerSincronizacao.current = null;
    };
  }, [recarregar]);

  useEffect(() => {
    if (!animalPreselecionadoId || !pacientes.some((paciente) => paciente.id === animalPreselecionadoId)) return;
    setAnimalId(animalPreselecionadoId);
    setTipoNovo("Retorno a marcar");
    setNovoAberto(true);
  }, [animalPreselecionadoId, pacientes]);

  const hoje = hojeRetornoBrasil();
  const ativos = retornos.filter(r => r.status !== "realizado" && r.status !== "cancelado");
  const noPrazo = ativos.filter(r => situacaoPrazoRetorno(r.data_prevista, hoje) === "no_prazo");
  const paraHoje = ativos.filter(r => situacaoPrazoRetorno(r.data_prevista, hoje) === "hoje");
  const vencidos = ativos.filter(r => situacaoPrazoRetorno(r.data_prevista, hoje) === "atrasado");
  const aMarcar = ativos.filter(r => situacaoPrazoRetorno(r.data_prevista, hoje) === "a_marcar");
  const tutoresPorId = useMemo(() => new Map(tutores.map(t => [t.id,t.nome])), [tutores]);
  const filtrados = useMemo(() => retornos.filter(r => {
    const texto = (r.animal_nome + " " + r.tutor_nome + " " + r.titulo).toLocaleLowerCase("pt-BR");
    if (!texto.includes(busca.toLocaleLowerCase("pt-BR"))) return false;
    const aberto = r.status !== "realizado" && r.status !== "cancelado";
    const prazo = situacaoPrazoRetorno(r.data_prevista, hoje);
    if (filtro === "para_tratar") return aberto && prazo !== "programado";
    if (filtro === "no_prazo") return aberto && prazo === "no_prazo";
    if (filtro === "hoje") return aberto && prazo === "hoje";
    if (filtro === "atrasados") return aberto && prazo === "atrasado";
    if (filtro === "a_marcar") return aberto && prazo === "a_marcar";
    if (filtro === "programados") return aberto && prazo === "programado";
    return true;
  }), [retornos,busca,filtro,hoje]);

  async function criar() {
    if (!podeOperar || !animalId || !dataPrevista || salvando) return;
    setSalvando("novo");
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error("Sessão expirada.");
      await registrarRetornoClinico({ data: {
        accessToken: token, clinicaId, animalId, origem: "manual",
        titulo: tipoNovo, orientacoes, dataPrevista,
      }});
      setNovoAberto(false);
      setAnimalId("");
      setDataPrevista("");
      setOrientacoes("");
      toast.success("Retorno incluído na Central de Relacionamento.");
      await recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o retorno.");
    } finally {
      setSalvando(null);
    }
  }

  async function atualizar(item: RetornoClinico, status: StatusRetorno) {
    if (!podeOperar || salvando) return;
    if (status === "reagendar" && !novaData) return void toast.error("Escolha a nova data do retorno.");
    setSalvando(item.id);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error("Sessão expirada.");
      await atualizarRetornoClinico({ data: {
        accessToken: token, clinicaId, id: item.id, status,
        ...(status === "reagendar" ? { dataPrevista: novaData } : {}),
        observacao,
      }});
      setReagendarId(null);
      setNovaData("");
      setObservacao("");
      toast.success(status === "reagendar" ? "Nova data registrada. Falta confirmar com o tutor." :
        "Retorno atualizado: " + statusNome[status] + ".");
      await recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar o retorno.");
    } finally {
      setSalvando(null);
    }
  }

  async function abrirEditorMensagem(item: RetornoClinico) {
    if (!podeOperar || preparandoMensagem || !item.permite_whatsapp || !item.telefone) return;
    if (editorMensagem?.retornoId === item.id) {
      setEditorMensagem(null);
      return;
    }
    setEditorMensagem(null);
    setPreparandoMensagem(item.id);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error("Sessão expirada.");
      const resultado = await prepararMensagemAcompanhamento({
        data: { accessToken: token, clinicaId, retornoId: item.id },
      });
      setEditorMensagem({ retornoId: item.id, ...resultado });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível preparar a mensagem.");
    } finally {
      setPreparandoMensagem(null);
    }
  }

  return <section id="crm-retornos" className="space-y-5">
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black"><CalendarClock size={22} className="text-primary"/> Retornos e cuidados</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            A consulta pode indicar a data do retorno. Reforços de vacinas, vermífugos e exames com data registrada entram automaticamente aqui.
            A equipe confirma com o tutor, sem envio automático de mensagens.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void recarregar(true)} disabled={carregando}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold disabled:opacity-50">
            <RefreshCw size={16} /> Atualizar
          </button>
          {podeOperar && <button type="button" onClick={() => setNovoAberto(v => !v)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
            <Plus size={17}/> Novo retorno
          </button>}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">A fila “Para tratar” exibe retornos a partir de 2 dias antes da data prevista e aqueles ainda sem data.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {([
          ["No prazo", noPrazo.length, "no_prazo", "bg-emerald-500"],
          ["Hoje", paraHoje.length, "hoje", "bg-amber-400"],
          ["Atrasados", vencidos.length, "atrasados", "bg-red-500"],
          ["A marcar", aMarcar.length, "a_marcar", "bg-slate-400"],
        ] as const).map(([titulo,total,filtroCard,cor]) =>
          <button type="button" key={titulo} onClick={() => setFiltro(filtroCard)}
            className="rounded-xl border bg-muted/10 p-4 text-left transition hover:border-primary/50"
            aria-label={titulo + ": " + total + " retornos"}>
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <span className={"h-2.5 w-2.5 shrink-0 rounded-full " + cor} aria-hidden="true" />{titulo}
            </div>
            <p className="mt-1 text-3xl font-black tabular-nums">{total}</p>
          </button>)}
      </div>
    </div>

    {novoAberto && podeOperar && <div className="rounded-2xl border border-primary/30 bg-card p-5 shadow-sm">
      <h3 className="font-bold">Novo retorno em três passos</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">1. Animal e tutor *
          <select value={animalId} onChange={e=>setAnimalId(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3 font-normal">
            <option value="">Selecione o paciente</option>
            {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome} · {tutoresPorId.get(p.tutor_id) || "Tutor"}</option>)}
          </select>
        </label>
        <div className="text-sm font-semibold">
          <label htmlFor="crm-data-retorno" className="block">2. Data do retorno *</label>
          <input id="crm-data-retorno" type="date" value={dataPrevista} onChange={e=>setDataPrevista(e.target.value)}
            className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3 font-normal" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {OPCOES_DIAS_RETORNO.map(dias =>
              <button type="button" key={dias} onClick={() => setDataPrevista(calcularDataRetorno(dias))}
                className="rounded-lg border px-2 py-1.5 text-xs font-semibold hover:border-primary hover:bg-primary/5">
                {dias} dias
              </button>)}
          </div>
          {dataPrevista && <p className="mt-2 text-xs font-semibold text-primary">Retorno: {mostrarData(dataPrevista)}</p>}
        </div>
        <label className="text-sm font-semibold">Motivo do acompanhamento
          <select value={tipoNovo} onChange={e=>setTipoNovo(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3 font-normal">
            {["Reavaliação clínica","Resultado de exame","Vacinação","Vermifugação","Pós-operatório","Acompanhamento de medicação","Outro retorno"].map(x=><option key={x}>{x}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">3. Orientações para a equipe
          <textarea rows={2} maxLength={2000} value={orientacoes} onChange={e=>setOrientacoes(e.target.value)}
            placeholder="Ex.: telefonar para confirmar dois dias antes" className="mt-1 w-full rounded-xl border bg-background p-3 font-normal"/>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={!animalId || !dataPrevista || Boolean(salvando)}
          onClick={() => void criar()}
          className="min-h-11 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-40">
          {salvando === "novo" ? "Salvando..." : "Salvar retorno"}
        </button>
        <button type="button" onClick={() => setNovoAberto(false)} className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Cancelar</button>
      </div>
    </div>}

    <div className="flex flex-wrap items-center gap-2">
      <label className="flex min-h-11 min-w-[220px] flex-1 items-center gap-2 rounded-xl border bg-card px-3">
        <Search size={17} className="text-muted-foreground" />
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar tutor, animal ou retorno" className="min-w-0 flex-1 bg-transparent text-sm outline-none"/>
      </label>
      {([
        ["para_tratar","Para tratar"],["no_prazo","No prazo"],["hoje","Hoje"],["atrasados","Atrasados"],["a_marcar","A marcar"],["programados","Programados"],["todos","Todos"],
      ] as Array<[Filtro,string]>).map(([id,nome])=>
        <button type="button" key={id} onClick={()=>setFiltro(id)}
          aria-pressed={filtro===id}
          className={"min-h-11 rounded-xl border px-3 text-sm font-semibold " + (filtro===id ? "border-primary bg-primary/10 text-primary" : "bg-card text-muted-foreground")}>
          {nome}
        </button>)}
    </div>
    {carregando ? <p role="status" className="rounded-xl border bg-card p-5 text-sm">Verificando retornos e reforços clínicos…</p> :
      erro ? <div role="alert" className="rounded-xl border border-destructive/30 bg-card p-5 text-sm text-destructive">{erro}</div> :
      filtrados.length === 0 ? <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
        <CalendarCheck2 className="mx-auto text-primary" size={26}/>
        <h3 className="mt-2 font-bold">Nenhum retorno nesta seleção</h3>
        <p className="mt-1 text-sm text-muted-foreground">Registre um retorno na consulta ou utilize Novo retorno para incluir um acompanhamento.</p>
      </div> :
      <div className="grid gap-3 lg:grid-cols-2">
        {filtrados.map(item => <article key={item.id} className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">{origemNome[item.origem] || "Acompanhamento"}</p>
              <h3 className="mt-1 font-bold">{item.titulo}</h3>
              <p className="mt-1 text-sm">{item.animal_nome} · {item.tutor_nome}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-black tabular-nums">{mostrarData(item.data_prevista)}</p>
              <p className="mt-1 flex items-center justify-end gap-1.5 text-xs font-bold">
                <span className={"inline-block h-2.5 w-2.5 rounded-full " + corPrazo[prazoVisual(item, hoje)]} aria-hidden="true" />
                {nomePrazo[prazoVisual(item, hoje)]}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{statusNome[item.status]}</p>
            </div>
          </div>
          {item.orientacoes && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.orientacoes}</p>}
          {item.anotacao_equipe && <p className="mt-2 text-xs text-muted-foreground">Equipe: {item.anotacao_equipe}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/animal" search={{animalId:item.animal_id} as never}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold">
              <Stethoscope size={15}/> Ficha do animal
            </Link>
            {podeOperar && item.permite_whatsapp && item.telefone &&
              <button type="button" disabled={Boolean(preparandoMensagem)} onClick={() => void abrirEditorMensagem(item)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold text-primary disabled:opacity-50">
                <Sparkles size={15}/> {preparandoMensagem === item.id ? "Preparando..." : editorMensagem?.retornoId === item.id ? "Fechar mensagem" : "Preparar mensagem"}
              </button>}
            {podeOperar && !item.permite_whatsapp &&
              <span className="inline-flex min-h-10 items-center rounded-lg border px-3 text-xs text-muted-foreground">WhatsApp não autorizado</span>}
            {podeOperar && !["realizado","cancelado"].includes(item.status) && <>
              <button type="button" disabled={Boolean(salvando)} onClick={() => void atualizar(item,"contatado")}
                className="min-h-10 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">Contatei o tutor</button>
              <button type="button" disabled={Boolean(salvando)} onClick={() => void atualizar(item,"confirmado")}
                className="min-h-10 rounded-lg border border-primary/40 px-3 py-2 text-xs font-semibold text-primary disabled:opacity-40">Confirmado</button>
              <button type="button" disabled={Boolean(salvando)} onClick={() => void atualizar(item,"realizado")}
                className="min-h-10 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">Realizado</button>
              <button type="button" disabled={Boolean(salvando)}
                onClick={() => {setReagendarId(item.id === reagendarId ? null : item.id);setNovaData("");setObservacao("");}}
                className="min-h-10 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">Reagendar</button>
            </>}
          </div>
          {editorMensagem?.retornoId === item.id && <div className="mt-3 rounded-xl border border-primary/25 bg-muted/15 p-4">
            <label htmlFor={"crm-mensagem-" + item.id} className="block text-sm font-bold">Mensagem personalizada para {item.tutor_nome}</label>
            <p className="mt-1 text-xs text-muted-foreground">
              Confira o destinatário e revise o texto antes de abrir o WhatsApp. A mensagem não é enviada pelo ORICSE.
            </p>
            <textarea id={"crm-mensagem-" + item.id} rows={7} maxLength={3000}
              value={editorMensagem.mensagem}
              onChange={e => setEditorMensagem(anterior => anterior?.retornoId === item.id ? { ...anterior, mensagem: e.target.value } : anterior)}
              className="mt-3 w-full resize-y rounded-lg border bg-background p-3 text-sm leading-relaxed outline-none focus:border-primary"
              aria-label={"Editar mensagem para " + item.tutor_nome}/>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={urlWhatsApp(editorMensagem.telefone, editorMensagem.mensagem)} target="_blank" rel="noopener noreferrer"
                aria-disabled={!editorMensagem.mensagem.trim()}
                onClick={e => { if (!editorMensagem.mensagem.trim()) e.preventDefault(); }}
                className={"inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white " +
                  (!editorMensagem.mensagem.trim() ? "pointer-events-none opacity-40" : "hover:bg-emerald-800")}>
                <MessageCircle size={17}/> Abrir no WhatsApp
              </a>
              <button type="button" onClick={() => setEditorMensagem(null)}
                className="min-h-11 rounded-lg border px-4 text-sm font-semibold">Cancelar</button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Abre o WhatsApp com o texto preenchido. A mensagem só é enviada quando você confirmar no WhatsApp.
              O CRM não marca o contato como realizado automaticamente.
            </p>
          </div>}
          {reagendarId === item.id && <div className="mt-3 space-y-3 rounded-xl border bg-muted/20 p-3">
            <label className="block text-xs font-semibold">Nova data
              <input type="date" value={novaData} onChange={e=>setNovaData(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3"/>
            </label>
            <label className="block text-xs font-semibold">Observação da equipe
              <input value={observacao} onChange={e=>setObservacao(e.target.value)}
                placeholder="Ex.: tutor pediu outra semana" className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3"/>
            </label>
            <button type="button" disabled={!novaData || Boolean(salvando)} onClick={() => void atualizar(item,"reagendar")}
              className="min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-40">Salvar nova data</button>
          </div>}
        </article>)}
      </div>}
    <p className="text-xs text-muted-foreground">
      Abrir o WhatsApp não significa que a mensagem foi enviada nem que o tutor confirmou. Registre a situação nos botões acima após o contato real.
    </p>
  </section>;
}
