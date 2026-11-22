import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarCheck2, CalendarClock, CheckCircle2, Clock3, MessageCircle,
  Plus, RefreshCw, Search, Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { supabase, supabaseBanco } from "@/integrations/supabase/client";
import {
  atualizarRetornoClinico, listarRetornosClinica, registrarRetornoClinico,
  type RetornoClinico, type StatusRetorno,
} from "@/lib/crm-retornos.functions";

type Paciente = { id: string; nome: string; tutor_id: string };
type Responsavel = { id: string; nome: string };
type Filtro = "pendentes" | "hoje" | "atrasados" | "todos";
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
function hojeLocal() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function mostrarData(data: string) {
  const [ano,mes,dia] = data.slice(0,10).split("-");
  return [dia,mes,ano].join("/");
}
function urlWhatsApp(r: RetornoClinico) {
  const telefone = r.telefone.replace(/\D/g,"");
  const completo = telefone.length >= 10 && telefone.length <= 11 ? "55" + telefone : telefone;
  const mensagem = "Olá, " + r.tutor_nome + "! Aqui é da clínica veterinária. " +
    "Gostaríamos de confirmar o retorno de " + r.animal_nome +
    " previsto para " + mostrarData(r.data_prevista) +
    ". Podemos confirmar essa data?";
  return "https://wa.me/" + completo + "?text=" + encodeURIComponent(mensagem);
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
  const [filtro, setFiltro] = useState<Filtro>("pendentes");
  const [busca, setBusca] = useState("");
  const [reagendarId, setReagendarId] = useState<string | null>(null);
  const [novaData, setNovaData] = useState("");
  const [observacao, setObservacao] = useState("");

  const recarregar = useCallback(async () => {
    if (!clinicaId) return;
    setCarregando(true);
    setErro("");
    try {
      const [sessao, pets, pais] = await Promise.all([
        supabase.auth.getSession(),
        (supabaseBanco as any).from("oricse_animais").select("id,nome,tutor_id")
          .eq("clinica_id", clinicaId).order("nome").limit(2000),
        (supabaseBanco as any).from("tutores").select("id,nome")
          .eq("clinica_id", clinicaId).limit(2000),
      ]);
      if (pets.error || pais.error || !sessao.data.session?.access_token)
        throw new Error(pets.error?.message || pais.error?.message || "Faça login novamente.");
      const resposta = await listarRetornosClinica({
        data: { clinicaId, accessToken: sessao.data.session.access_token },
      });
      setRetornos(resposta);
      setPacientes(pets.data || []);
      setTutores(pais.data || []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os retornos.");
    } finally {
      setCarregando(false);
    }
  }, [clinicaId]);

  useEffect(() => { void recarregar(); }, [recarregar]);

  useEffect(() => {
    if (!animalPreselecionadoId || !pacientes.some((paciente) => paciente.id === animalPreselecionadoId)) return;
    setAnimalId(animalPreselecionadoId);
    setTipoNovo("Retorno a marcar");
    setNovoAberto(true);
  }, [animalPreselecionadoId, pacientes]);

  const hoje = hojeLocal();
  const ativos = retornos.filter(r => r.status !== "realizado" && r.status !== "cancelado");
  const vencidos = ativos.filter(r => r.data_prevista < hoje);
  const paraHoje = ativos.filter(r => r.data_prevista === hoje);
  const confirmados = ativos.filter(r => r.status === "confirmado");
  const tutoresPorId = useMemo(() => new Map(tutores.map(t => [t.id,t.nome])), [tutores]);
  const filtrados = useMemo(() => retornos.filter(r => {
    const texto = (r.animal_nome + " " + r.tutor_nome + " " + r.titulo).toLocaleLowerCase("pt-BR");
    if (!texto.includes(busca.toLocaleLowerCase("pt-BR"))) return false;
    if (filtro === "pendentes") return r.status !== "realizado" && r.status !== "cancelado";
    if (filtro === "hoje") return r.data_prevista === hoje && r.status !== "realizado" && r.status !== "cancelado";
    if (filtro === "atrasados") return r.data_prevista < hoje && r.status !== "realizado" && r.status !== "cancelado";
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
      toast.success("Retorno incluído na Gestão de Clientes.");
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
          <button type="button" onClick={() => void recarregar()} disabled={carregando}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold disabled:opacity-50">
            <RefreshCw size={16} /> Atualizar
          </button>
          {podeOperar && <button type="button" onClick={() => setNovoAberto(v => !v)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
            <Plus size={17}/> Novo retorno
          </button>}
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {([
          ["Acompanhar",ativos.length,Clock3],
          ["Para hoje",paraHoje.length,CalendarClock],
          ["Atrasados",vencidos.length,CalendarCheck2],
          ["Confirmados",confirmados.length,CheckCircle2],
        ] as const).map(([titulo,total,Icone]) =>
          <div key={titulo} className="rounded-xl border bg-muted/10 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><Icone size={16}/>{titulo}</div>
            <p className="mt-1 text-3xl font-black tabular-nums">{total}</p>
          </div>)}
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
        <label className="text-sm font-semibold">2. Data do retorno *
          <input type="date" value={dataPrevista} onChange={e=>setDataPrevista(e.target.value)}
            className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3 font-normal" />
        </label>
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
        ["pendentes","A acompanhar"],["hoje","Hoje"],["atrasados","Atrasados"],["todos","Todos"],
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
              <p className={"mt-1 text-xs font-bold " + (item.data_prevista < hoje && !["realizado","cancelado"].includes(item.status) ? "text-amber-700" : "text-muted-foreground")}>
                {statusNome[item.status]}
              </p>
            </div>
          </div>
          {item.orientacoes && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.orientacoes}</p>}
          {item.anotacao_equipe && <p className="mt-2 text-xs text-muted-foreground">Equipe: {item.anotacao_equipe}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/animal" search={{animalId:item.animal_id} as never}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold">
              <Stethoscope size={15}/> Ficha do animal
            </Link>
            {item.permite_whatsapp && item.telefone &&
              <a href={urlWhatsApp(item)} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold text-primary">
                <MessageCircle size={15}/> Abrir WhatsApp
              </a>}
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
