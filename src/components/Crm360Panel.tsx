import { BarChart3, BellRing, CheckCircle2, ClipboardList, Megaphone, MessageCircle, Plus, Send, Sparkles, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { supabaseBanco } from "@/integrations/supabase/client";

type Canal = "whatsapp" | "email" | "manual";
type Filtro = "todos" | "marketing" | "whatsapp" | "email" | "inativos" | "hotel" | "banho_tosa";
type Tutor = { id: string; nome: string; telefone?: string | null; outro_telefone?: string | null; email?: string | null; autoriza_marketing?: boolean; contato_preferencial?: string | null };
type Animal = { id: string; tutor_id: string; nome: string; especie?: string | null };
type Agenda = { tutor_id?: string | null; inicio?: string | null; estado?: string | null };
type Estadia = { tutor_id?: string | null; status?: string | null };
type BanhoTosa = { tutor_id?: string | null; status?: string | null };
type Cobranca = { tutor_id?: string | null; status?: string | null; valor?: number | null };
type Campanha = { id: string; nome: string; assunto: string; mensagem: string; canal: Canal; status: string; audiencia_estimada: number; enviados: number; created_at: string };
type Tarefa = { id: string; titulo: string; descricao?: string | null; status: string; vencimento_em?: string | null; prioridade: string };

type Base = { tutores: Tutor[]; animais: Animal[]; agenda: Agenda[]; hotel: Estadia[]; banho_tosa: BanhoTosa[]; cobrancas: Cobranca[] };

const filtros: Array<{ id: Filtro; nome: string; detalhe: string }> = [
  { id: "todos", nome: "Todos os tutores", detalhe: "Base completa da clínica" },
  { id: "marketing", nome: "Consentimento de marketing", detalhe: "Somente quem autorizou campanhas" },
  { id: "whatsapp", nome: "Com WhatsApp", detalhe: "Contato direto disponível" },
  { id: "email", nome: "Com e-mail", detalhe: "E-mail cadastrado" },
  { id: "inativos", nome: "Inativos há 90 dias", detalhe: "Oportunidade de reativação" },
  { id: "hotel", nome: "Hotelzinho", detalhe: "Já usaram ou têm estadia" },
  { id: "banho_tosa", nome: "Banho e tosa", detalhe: "Clientes do banho e tosa" },
];

function moeda(valor = 0) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor || 0));
}

function dataCurta(valor?: string | null) {
  return valor ? new Date(valor).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "Sem prazo";
}

function primeiroCanal(tutor: Tutor): Canal {
  if (tutor.telefone || tutor.outro_telefone) return "whatsapp";
  if (tutor.email) return "email";
  return "manual";
}

export function Crm360Panel({ clinicaId, podeCampanhas, podeOperar, onAbrirFila }: { clinicaId: string; podeCampanhas: boolean; podeOperar: boolean; onAbrirFila: () => void }) {
  const [base, setBase] = useState<Base>({ tutores: [], animais: [], agenda: [], hotel: [], banho_tosa: [], cobrancas: [] });
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [nome, setNome] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("Olá, {{tutor}}! Temos uma novidade especial para você e seu pet. Fale com a nossa equipe para aproveitar.");
  const [canal, setCanal] = useState<Canal>("whatsapp");
  const [novaTarefa, setNovaTarefa] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [publicando, setPublicando] = useState(false);

  const carregar = useCallback(async () => {
    if (!clinicaId) return;
    setCarregando(true);
    const [baseResult, campanhasResult, tarefasResult] = await Promise.all([
      (supabaseBanco as any).rpc("oricse_crm_360_base", { p_clinica_id: clinicaId }),
      (supabaseBanco as any).from("oricse_crm_campanhas").select("*").eq("clinica_id", clinicaId).order("created_at", { ascending: false }).limit(6),
      (supabaseBanco as any).from("oricse_crm_tarefas").select("*").eq("clinica_id", clinicaId).order("vencimento", { ascending: true }).limit(6),
    ]);
    setCarregando(false);
    if (baseResult.error || campanhasResult.error || tarefasResult.error) {
      toast.error(baseResult.error?.message || campanhasResult.error?.message || tarefasResult.error?.message || "Não foi possível carregar o CRM 360.");
      return;
    }
    setBase(baseResult.data || { tutores: [], animais: [], agenda: [], hotel: [], banho_tosa: [], cobrancas: [] });
    setCampanhas(campanhasResult.data || []);
    setTarefas(tarefasResult.data || []);
  }, [clinicaId]);

  useEffect(() => { void carregar(); }, [carregar]);

  const porTutor = useMemo(() => new Map(base.tutores.map((tutor) => [tutor.id, tutor])), [base.tutores]);
  const alvo = useMemo(() => {
    const hoje = Date.now();
    const usadosHotel = new Set(base.hotel.filter((item) => item.status !== "cancelado").map((item) => item.tutor_id).filter(Boolean));
    const usadosBanho = new Set(base.banho_tosa.filter((item) => item.status !== "cancelado").map((item) => item.tutor_id).filter(Boolean));
    const ultimoAgendamento = new Map<string, number>();
    base.agenda.filter((item) => item.tutor_id && item.inicio && item.estado !== "cancelado").forEach((item) => {
      const data = new Date(item.inicio || "").getTime();
      if (data < hoje) ultimoAgendamento.set(item.tutor_id as string, Math.max(ultimoAgendamento.get(item.tutor_id as string) || 0, data));
    });
    return base.tutores.filter((tutor) => {
      if (filtro === "marketing") return tutor.autoriza_marketing === true;
      if (filtro === "whatsapp") return Boolean(tutor.telefone || tutor.outro_telefone);
      if (filtro === "email") return Boolean(tutor.email);
      if (filtro === "hotel") return usadosHotel.has(tutor.id);
      if (filtro === "banho_tosa") return usadosBanho.has(tutor.id);
      if (filtro === "inativos") {
        const ultimo = ultimoAgendamento.get(tutor.id) || 0;
        return ultimo > 0 && hoje - ultimo > 90 * 86400000;
      }
      return true;
    });
  }, [base, filtro]);

  useEffect(() => { setSelecionados(alvo.map((tutor) => tutor.id)); }, [filtro, base.tutores.length]);

  const receitaEmAberto = useMemo(() => base.cobrancas.filter((item) => !["pago", "cancelado"].includes(String(item.status).toLowerCase())).reduce((soma, item) => soma + Number(item.valor || 0), 0), [base.cobrancas]);
  const notificacoesPendentes = useMemo(() => campanhas.reduce((soma, item) => soma + Number(item.audiencia_estimada || 0), 0), [campanhas]);

  function alternarTutor(id: string) {
    setSelecionados((lista) => lista.includes(id) ? lista.filter((item) => item !== id) : [...lista, id]);
  }

  async function publicarCampanha() {
    if (!podeCampanhas) return;
    if (!nome.trim() || !assunto.trim() || !mensagem.trim()) return void toast.error("Dê um nome, assunto e mensagem para a campanha.");
    if (!selecionados.length) return void toast.error("Selecione ao menos um tutor.");
    setPublicando(true);
    const destinatarios = selecionados.map((id) => {
      const tutor = porTutor.get(id);
      return {
        tutor_id: id,
        nome: tutor?.nome || "Tutor",
        telefone: tutor?.telefone || tutor?.outro_telefone || "",
        email: tutor?.email || "",
        canal: canal === "manual" ? primeiroCanal(tutor || { id: "", nome: "" }) : canal,
      };
    });
    const { data: criada, error: erroCriar } = await (supabaseBanco as any)
      .from("oricse_crm_campanhas")
      .insert({ clinica_id: clinicaId, nome: nome.trim(), assunto: assunto.trim(), mensagem: mensagem.trim(), canal, status: "rascunho", metadados: { filtro, selecionados } })
      .select("id")
      .single();
    if (erroCriar) {
      setPublicando(false);
      return void toast.error(erroCriar.message);
    }
    const { error } = await (supabaseBanco as any).rpc("oricse_crm_campanha_publicar", { p_campanha_id: criada.id, p_destinatarios: destinatarios });
    setPublicando(false);
    if (error) return void toast.error(error.message);
    toast.success(`Campanha criada para ${destinatarios.length} tutor(es). Os envios estão na fila CRM.`);
    setNome(""); setAssunto(""); setMensagem("Olá, {{tutor}}! Temos uma novidade especial para você e seu pet. Fale com a nossa equipe para aproveitar.");
    await carregar();
    onAbrirFila();
  }

  async function adicionarTarefa() {
    if (!novaTarefa.trim() || !podeOperar) return;
    const { error } = await (supabaseBanco as any).from("oricse_crm_tarefas").insert({ clinica_id: clinicaId, titulo: novaTarefa.trim(), status: "aberta", prioridade: "normal" });
    if (error) return void toast.error(error.message);
    setNovaTarefa("");
    await carregar();
  }

  async function concluirTarefa(tarefa: Tarefa) {
    if (!podeOperar) return;
    const { error } = await (supabaseBanco as any).from("oricse_crm_tarefas").update({ status: tarefa.status === "concluida" ? "aberta" : "concluida", concluida_em: tarefa.status === "concluida" ? null : new Date().toISOString() }).eq("id", tarefa.id);
    if (error) return void toast.error(error.message);
    await carregar();
  }

  return <section className="mt-6 space-y-5">
    <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary"><Sparkles size={19}/><span className="text-xs font-black uppercase tracking-[0.16em]">CRM 360</span></div>
          <h2 className="mt-1 text-2xl font-black tracking-tight">Campanhas, jornada e retenção em uma só operação</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Transforme agenda, Portal do Tutor, hotelzinho, banho e tosa e financeiro em ações de relacionamento rastreáveis.</p>
        </div>
        <button type="button" onClick={() => void carregar()} className="rounded-xl border px-3 py-2 text-sm font-bold">Atualizar dados</button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Users size={18}/>} titulo="Base ativa" valor={base.tutores.length} detalhe="tutores no relacionamento" />
        <Metric icon={<Megaphone size={18}/>} titulo="Campanhas" valor={campanhas.length} detalhe={`${notificacoesPendentes} destinatários em campanhas`} />
        <Metric icon={<BellRing size={18}/>} titulo="Portal do Tutor" valor="Links seguros" detalhe="exames e documentos entram na fila" />
        <Metric icon={<BarChart3 size={18}/>} titulo="Em aberto" valor={moeda(receitaEmAberto)} detalhe="sinal para cobrança humanizada" />
      </div>
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.45fr_.85fr]">
      <section className="rounded-3xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2"><Megaphone className="text-primary" size={20}/><div><h3 className="font-black">Nova campanha segmentada</h3><p className="text-xs text-muted-foreground">Crie a mensagem, escolha o público e envie para a fila com um clique.</p></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input label="Nome interno" value={nome} onChange={setNome} placeholder="Ex.: Semana da saúde bucal" />
          <Input label="Assunto / chamada" value={assunto} onChange={setAssunto} placeholder="Condição especial para seu pet" />
        </div>
        <label className="mt-3 block text-xs font-bold">Canal preferido<select value={canal} onChange={(e) => setCanal(e.target.value as Canal)} className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal"><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="manual">Melhor contato cadastrado</option></select></label>
        <label className="mt-3 block text-xs font-bold">Mensagem<textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border bg-background p-3 text-sm font-normal"/></label>
        <p className="mt-1 text-[11px] text-muted-foreground">Use {"{{tutor}}"} para personalizar a mensagem. O contato é aberto somente pela equipe, na fila do CRM.</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {filtros.map((item) => <button key={item.id} type="button" onClick={() => setFiltro(item.id)} className={`rounded-xl border p-3 text-left transition ${filtro === item.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}><p className="text-sm font-black">{item.nome}</p><p className="mt-1 text-xs text-muted-foreground">{item.detalhe}</p></button>)}
        </div>

        <div className="mt-4 rounded-2xl border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">{selecionados.length} de {alvo.length} tutor(es) selecionado(s)</p><p className="text-xs text-muted-foreground">Apenas estes contatos receberão esta campanha.</p></div><button type="button" onClick={() => setSelecionados(selecionados.length === alvo.length ? [] : alvo.map((tutor) => tutor.id))} className="text-xs font-bold text-primary">{selecionados.length === alvo.length ? "Limpar" : "Selecionar todos"}</button></div>
          <div className="mt-3 max-h-44 space-y-1 overflow-y-auto pr-1">
            {alvo.slice(0, 100).map((tutor) => <label key={tutor.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-background"><span className="min-w-0"><span className="block truncate font-semibold">{tutor.nome}</span><span className="block truncate text-xs text-muted-foreground">{tutor.telefone || tutor.outro_telefone || tutor.email || "Sem contato digital"}</span></span><input type="checkbox" checked={selecionados.includes(tutor.id)} onChange={() => alternarTutor(tutor.id)} /></label>)}
            {!alvo.length && <p className="py-4 text-center text-sm text-muted-foreground">Nenhum tutor atende a este filtro.</p>}
          </div>
        </div>
        <button type="button" disabled={!podeCampanhas || publicando || carregando} onClick={() => void publicarCampanha()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"><Send size={17}/>{publicando ? "Criando campanha..." : `Enviar para ${selecionados.length} tutor(es)`}</button>
        {!podeCampanhas && <p className="mt-2 text-xs text-amber-700">Seu perfil pode visualizar o CRM, mas não possui permissão para publicar campanhas.</p>}
      </section>

      <aside className="space-y-5">
        <section className="rounded-3xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2"><ClipboardList className="text-primary" size={20}/><h3 className="font-black">Plano de ação da equipe</h3></div>
          <div className="mt-3 flex gap-2"><input value={novaTarefa} onChange={(e) => setNovaTarefa(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void adicionarTarefa(); }} placeholder="Nova ação de relacionamento" className="h-10 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm"/><button type="button" onClick={() => void adicionarTarefa()} disabled={!podeOperar} className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Plus size={18}/></button></div>
          <div className="mt-3 space-y-2">{tarefas.map((tarefa) => <button type="button" key={tarefa.id} onClick={() => void concluirTarefa(tarefa)} className="flex w-full items-start gap-2 rounded-xl border p-3 text-left"><CheckCircle2 size={17} className={tarefa.status === "concluida" ? "mt-0.5 text-emerald-600" : "mt-0.5 text-muted-foreground"}/><span><span className={`block text-sm font-bold ${tarefa.status === "concluida" ? "line-through text-muted-foreground" : ""}`}>{tarefa.titulo}</span><span className="text-xs text-muted-foreground">{dataCurta(tarefa.vencimento_em)} · {tarefa.prioridade}</span></span></button>)}{!tarefas.length && <p className="py-4 text-center text-sm text-muted-foreground">Defina a próxima ação do time.</p>}</div>
        </section>
        <section className="rounded-3xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2"><MessageCircle className="text-primary" size={20}/><h3 className="font-black">Últimas campanhas</h3></div>
          <div className="mt-3 space-y-2">{campanhas.map((item) => <div key={item.id} className="rounded-xl border p-3"><p className="text-sm font-black">{item.nome}</p><p className="mt-1 text-xs text-muted-foreground">{item.audiencia_estimada || 0} destinatários · {dataCurta(item.created_at)} · {item.status}</p></div>)}{!campanhas.length && <p className="py-4 text-center text-sm text-muted-foreground">Sua primeira campanha aparecerá aqui.</p>}</div>
        </section>
      </aside>
    </div>
  </section>;
}

function Metric({ icon, titulo, valor, detalhe }: { icon: ReactNode; titulo: string; valor: ReactNode; detalhe: string }) {
  return <div className="rounded-2xl border bg-background p-4"><div className="flex items-center gap-2 text-primary">{icon}<span className="text-xs font-black uppercase tracking-wide">{titulo}</span></div><p className="mt-2 text-2xl font-black">{valor}</p><p className="mt-1 text-xs text-muted-foreground">{detalhe}</p></div>;
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return <label className="block text-xs font-bold">{label}<input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal"/></label>;
}
