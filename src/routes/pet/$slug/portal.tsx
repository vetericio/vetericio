import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  FileText,
  HeartPulse,
  Loader2,
  LockKeyhole,
  LogOut,
  PawPrint,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pet/$slug/portal")({ component: PortalTutorClinica });

type ClinicaPublica = { nome: string; slug: string; logo_url: string | null };
type ContextoPortal = {
  clinica_id: string;
  clinica_nome: string;
  clinica_slug: string;
  clinica_logo_url: string | null;
  tutor_id: string;
  tutor_nome: string;
  tutor_telefone: string | null;
  tutor_email: string | null;
  usuario: string;
};
type Animal = {
  id: string;
  clinica_id: string;
  tutor_id: string;
  nome: string;
  especie: string;
  raca: string;
  sexo: string;
  nascimento: string | null;
  peso_kg: number | null;
  foto_url: string | null;
  dados: Record<string, unknown>;
};
type Vacina = {
  id: string;
  animal_id: string;
  nome: string;
  aplicada_em: string | null;
  reforco_em: string | null;
  lote: string | null;
  observacoes: string | null;
};
type Documento = {
  id: string;
  animal_id: string;
  titulo: string;
  tipo: string;
  data_documento: string | null;
  observacoes: string | null;
};
type Agenda = {
  id: string;
  nome: string;
  responsavel: string;
  inicio: string;
  fim: string;
  dias_semana: number[];
  intervalo_min: number;
  modalidade: "livre" | "aprovacao" | "pagamento" | string;
  antecedencia_horas: number;
  timezone: string;
  tipo: string;
  cor: string;
};
type Horario = { inicio: string; fim: string; rotulo: string };
type Agendamento = {
  id: string;
  animal_id: string | null;
  animal_referencia: string;
  inicio: string;
  fim: string;
  estado: string;
  tipo: string;
  observacoes: string | null;
  criado_em: string;
};
type Secao = "resumo" | "agenda" | "documentos" | "vacinas" | "perfil";

function dataLocalIso(data = new Date()) {
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function primeiraDataAgenda() {
  const data = new Date();
  data.setDate(data.getDate() + 1);
  return dataLocalIso(data);
}

function formatarData(valor?: string | null) {
  if (!valor) return "Não informado";
  const data = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleDateString("pt-BR");
}

function formatarDataHora(valor: string) {
  const data = new Date(valor);
  return data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function emojiEspecie(especie?: string) {
  const valor = (especie || "").toLowerCase();
  if (["cão", "cao", "canino", "cachorro"].includes(valor)) return "🐶";
  if (["gato", "felino"].includes(valor)) return "🐱";
  if (valor.includes("ave")) return "🐦";
  if (valor.includes("coelho")) return "🐰";
  return "🐾";
}

function mensagemEstado(estado: string) {
  if (estado === "confirmado") return "Confirmado";
  if (estado === "solicitado") return "Aguardando aprovação";
  if (estado === "reservado") return "Reservado";
  if (estado === "cancelado") return "Cancelado";
  if (estado === "expirado") return "Expirado";
  return estado;
}

export function PortalTutorClinica({ slugDaClinica }: { slugDaClinica?: string } = {}) {
  const params = Route.useParams({ strict: false });
  const slug = slugDaClinica ?? (params as { slug?: string }).slug ?? "";

  const [clinica, setClinica] = useState<ClinicaPublica | null>(null);
  const [carregandoClinica, setCarregandoClinica] = useState(true);
  const [carregandoPortal, setCarregandoPortal] = useState(true);
  const [contexto, setContexto] = useState<ContextoPortal | null>(null);
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [processandoLogin, setProcessandoLogin] = useState(false);
  const [modoAtivacao, setModoAtivacao] = useState(false);
  const [tokenAtivacao, setTokenAtivacao] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaNova2, setSenhaNova2] = useState("");
  const [processandoAtivacao, setProcessandoAtivacao] = useState(false);
  const [animais, setAnimais] = useState<Animal[]>([]);
  const [vacinas, setVacinas] = useState<Vacina[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [animalId, setAnimalId] = useState("");
  const [secao, setSecao] = useState<Secao>("resumo");
  const [agendaId, setAgendaId] = useState("");
  const [dataAgenda, setDataAgenda] = useState(primeiraDataAgenda);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [horarioInicio, setHorarioInicio] = useState("");
  const [observacoesAgenda, setObservacoesAgenda] = useState("");
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [agendando, setAgendando] = useState(false);
  const [telefonePerfil, setTelefonePerfil] = useState("");
  const [emailPerfil, setEmailPerfil] = useState("");
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const token = hash.get("ativar") || query.get("ativar") || "";
    const user = hash.get("usuario") || query.get("usuario") || "";
    if (token) {
      setTokenAtivacao(token);
      setModoAtivacao(true);
    }
    if (user) setUsuario(user);
  }, []);

  useEffect(() => {
    let ativo = true;
    setCarregandoClinica(true);
    setClinica(null);
    void (async () => {
      const { data, error } = await (supabase as any).rpc("oricse_portal_tutor_clinica", { p_slug: slug });
      if (!ativo) return;
      if (!error && Array.isArray(data) && data.length) setClinica(data[0]);
      setCarregandoClinica(false);
    })();
    return () => { ativo = false; };
  }, [slug]);

  const carregarDadosPortal = useCallback(async () => {
    setCarregandoPortal(true);
    try {
      const { data: contextoData, error: contextoError } = await (supabase as any).rpc("oricse_portal_meu_contexto");
      if (contextoError) throw contextoError;
      const item = Array.isArray(contextoData) ? contextoData[0] : contextoData;
      if (!item?.tutor_id || item.clinica_slug !== slug) {
        setContexto(null);
        setAnimais([]);
        return;
      }
      const ctx = item as ContextoPortal;
      setContexto(ctx);
      setTelefonePerfil(ctx.tutor_telefone || "");
      setEmailPerfil(ctx.tutor_email || "");

      const [animaisResp, vacinasResp, documentosResp, agendasResp, agendamentosResp] = await Promise.all([
        (supabase as any).from("oricse_animais").select("id,clinica_id,tutor_id,nome,especie,raca,sexo,nascimento,peso_kg,foto_url,dados").eq("clinica_id", ctx.clinica_id).order("nome"),
        (supabase as any).from("oricse_portal_vacinas").select("id,animal_id,nome,aplicada_em,reforco_em,lote,observacoes").eq("clinica_id", ctx.clinica_id).order("reforco_em", { ascending: true, nullsFirst: false }),
        (supabase as any).from("oricse_portal_documentos").select("id,animal_id,titulo,tipo,data_documento,observacoes").eq("clinica_id", ctx.clinica_id).order("data_documento", { ascending: false, nullsFirst: false }),
        (supabase as any).rpc("oricse_portal_agendas"),
        (supabase as any).from("oricse_agendamentos_online").select("id,animal_id,animal_referencia,inicio,fim,estado,tipo,observacoes,criado_em").eq("clinica_id", ctx.clinica_id).order("inicio", { ascending: true }),
      ]);
      for (const resposta of [animaisResp, vacinasResp, documentosResp, agendasResp, agendamentosResp]) {
        if (resposta.error) throw resposta.error;
      }
      const listaAnimais = (animaisResp.data || []) as Animal[];
      setAnimais(listaAnimais);
      setVacinas((vacinasResp.data || []) as Vacina[]);
      setDocumentos((documentosResp.data || []) as Documento[]);
      setAgendas((agendasResp.data || []) as Agenda[]);
      setAgendamentos((agendamentosResp.data || []) as Agendamento[]);
      setAnimalId((atual) => atual && listaAnimais.some((a) => a.id === atual) ? atual : (listaAnimais[0]?.id || ""));
      setAgendaId((atual) => atual && (agendasResp.data || []).some((a: Agenda) => a.id === atual) ? atual : (agendasResp.data?.[0]?.id || ""));
    } catch (error) {
      console.error("Não foi possível carregar o portal do tutor:", error);
      setContexto(null);
      setAnimais([]);
    } finally {
      setCarregandoPortal(false);
    }
  }, [slug]);

  useEffect(() => {
    let ativo = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      if (data.session) void carregarDadosPortal();
      else setCarregandoPortal(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (!ativo) return;
      if (session) void carregarDadosPortal();
      else {
        setContexto(null);
        setAnimais([]);
        setCarregandoPortal(false);
      }
    });
    return () => {
      ativo = false;
      listener.subscription.unsubscribe();
    };
  }, [carregarDadosPortal]);

  useEffect(() => {
    if (!contexto || !agendaId || !dataAgenda) {
      setHorarios([]);
      setHorarioInicio("");
      return;
    }
    let ativo = true;
    setCarregandoHorarios(true);
    void (async () => {
      const { data, error } = await (supabase as any).rpc("oricse_portal_horarios_disponiveis", { p_agenda_id: agendaId, p_data: dataAgenda });
      if (!ativo) return;
      if (error) {
        setHorarios([]);
        setHorarioInicio("");
      } else {
        const lista = (data || []) as Horario[];
        setHorarios(lista);
        setHorarioInicio((atual) => lista.some((h) => h.inicio === atual) ? atual : (lista[0]?.inicio || ""));
      }
      setCarregandoHorarios(false);
    })();
    return () => { ativo = false; };
  }, [agendaId, contexto, dataAgenda]);

  const animal = useMemo(() => animais.find((a) => a.id === animalId) || null, [animais, animalId]);
  const vacinasAnimal = useMemo(() => vacinas.filter((v) => v.animal_id === animalId), [vacinas, animalId]);
  const documentosAnimal = useMemo(() => documentos.filter((d) => d.animal_id === animalId), [documentos, animalId]);
  const agendamentosAnimal = useMemo(() => agendamentos.filter((a) => a.animal_id === animalId), [agendamentos, animalId]);
  const agendaAtual = useMemo(() => agendas.find((a) => a.id === agendaId) || null, [agendas, agendaId]);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setProcessandoLogin(true);
    try {
      const { data, error } = await supabase.functions.invoke("oricse-portal-login", { body: { slug, usuario, senha } });
      if (error || !data?.access_token || !data?.refresh_token) throw new Error(data?.error || "Usuário ou senha inválidos.");
      const { error: sessaoError } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
      if (sessaoError) throw sessaoError;
      setSenha("");
      await carregarDadosPortal();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally {
      setProcessandoLogin(false);
    }
  }

  async function ativar(evento: React.FormEvent) {
    evento.preventDefault();
    if (senhaNova.length < 8) return void toast.error("A senha precisa ter pelo menos 8 caracteres.");
    if (senhaNova !== senhaNova2) return void toast.error("As senhas não coincidem.");
    setProcessandoAtivacao(true);
    try {
      const { data, error } = await supabase.functions.invoke("oricse-portal-activate", { body: { slug, usuario, token: tokenAtivacao, senha: senhaNova } });
      if (error || !data?.ok) throw new Error(data?.error || "Não foi possível ativar o acesso.");
      toast.success("Acesso ativado. Entre com seu usuário e a senha criada.");
      setModoAtivacao(false);
      setSenhaNova("");
      setSenhaNova2("");
      setTokenAtivacao("");
      if (typeof window !== "undefined") window.history.replaceState({}, "", window.location.pathname);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ativar o acesso.");
    } finally {
      setProcessandoAtivacao(false);
    }
  }

  async function sair() {
    await supabase.auth.signOut();
    setContexto(null);
    setAnimais([]);
    setSecao("resumo");
  }

  async function salvarPerfil() {
    setSalvandoPerfil(true);
    try {
      const { error } = await (supabase as any).rpc("oricse_portal_atualizar_perfil", { p_telefone: telefonePerfil, p_email: emailPerfil });
      if (error) throw error;
      toast.success("Seus dados foram atualizados.");
      await carregarDadosPortal();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar seus dados.");
    } finally {
      setSalvandoPerfil(false);
    }
  }

  async function criarAgendamento() {
    if (!animal || !agendaId || !horarioInicio) return;
    setAgendando(true);
    try {
      const { data, error } = await (supabase as any).rpc("oricse_portal_criar_agendamento", {
        p_agenda_id: agendaId,
        p_animal_id: animal.id,
        p_inicio: horarioInicio,
        p_observacoes: observacoesAgenda || null,
      });
      if (error) throw error;
      const estado = data?.[0]?.estado;
      toast.success(estado === "confirmado" ? "Agendamento confirmado." : "Solicitação enviada para a clínica.");
      setObservacoesAgenda("");
      await carregarDadosPortal();
      const { data: novosHorarios } = await (supabase as any).rpc("oricse_portal_horarios_disponiveis", { p_agenda_id: agendaId, p_data: dataAgenda });
      setHorarios((novosHorarios || []) as Horario[]);
      setHorarioInicio(novosHorarios?.[0]?.inicio || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir o agendamento.");
    } finally {
      setAgendando(false);
    }
  }

  if (carregandoClinica) return <main className="flex min-h-screen items-center justify-center bg-[#f4f6f7]"><Loader2 className="animate-spin" /></main>;
  if (!clinica) return <main className="mx-auto max-w-lg p-10 text-center"><h1 className="text-2xl font-bold">Portal indisponível</h1><p className="mt-3 text-muted-foreground">Clínica não encontrada ou portal indisponível.</p><Link to="/" className="mt-4 inline-block underline">Voltar ao ORICSE</Link></main>;

  if (!contexto) {
    return <main className="min-h-screen bg-slate-50 text-[#303842]">
      <header className="border-b bg-white"><div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-5">
        {clinica.logo_url ? <img src={clinica.logo_url} alt="" className="h-14 w-14 rounded-xl object-contain"/> : <div className="rounded-xl bg-slate-100 p-3"><PawPrint/></div>}
        <div><p className="text-xs font-semibold uppercase tracking-wider text-[#5f7e9b]">Portal do tutor · ORICSE</p><h1 className="text-xl font-bold">{clinica.nome}</h1></div>
      </div></header>
      <div className="mx-auto grid max-w-5xl gap-7 px-5 py-10 lg:grid-cols-[1.15fr_1fr]">
        <section><h2 className="text-3xl font-black tracking-tight">Seus animais e cuidados em um só lugar.</h2><p className="mt-3 max-w-xl text-slate-600">A clínica controla o que fica disponível. Você acessa somente os seus próprios animais, documentos, vacinas e horários.</p><div className="mt-6 grid gap-3 sm:grid-cols-2">{[
          [PawPrint,"Meus animais","Cadastros vinculados a você"],
          [CalendarDays,"Agendamentos","Horários realmente disponíveis"],
          [HeartPulse,"Vacinas","Aplicações e próximos reforços"],
          [FileText,"Documentos","Exames e arquivos liberados pela clínica"],
        ].map(([Icon,nome,desc]) => { const I = Icon as typeof PawPrint; return <div key={String(nome)} className="rounded-2xl border bg-white p-5"><I className="mb-3 text-[#5f7e9b]"/><h3 className="font-bold">{String(nome)}</h3><p className="mt-1 text-sm text-slate-500">{String(desc)}</p></div>; })}</div></section>
        <section className="self-start rounded-2xl border bg-white p-6 shadow-sm">
          {modoAtivacao ? <>
            <div className="flex items-center gap-2"><ShieldCheck/><h2 className="text-xl font-bold">Ativar primeiro acesso</h2></div>
            <p className="mt-2 text-sm text-slate-500">Use o usuário e o convite entregues pela clínica. O convite é de uso único.</p>
            <form onSubmit={ativar} className="mt-5 space-y-4">
              <label className="block text-sm font-semibold">Usuário<input value={usuario} onChange={(e)=>setUsuario(e.target.value)} placeholder="@seu.usuario" autoComplete="username" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label>
              <label className="block text-sm font-semibold">Código de ativação<input value={tokenAtivacao} onChange={(e)=>setTokenAtivacao(e.target.value)} autoComplete="one-time-code" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-mono text-xs font-normal"/></label>
              <label className="block text-sm font-semibold">Crie sua senha<input type="password" value={senhaNova} onChange={(e)=>setSenhaNova(e.target.value)} autoComplete="new-password" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label>
              <label className="block text-sm font-semibold">Repita a senha<input type="password" value={senhaNova2} onChange={(e)=>setSenhaNova2(e.target.value)} autoComplete="new-password" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label>
              <button disabled={processandoAtivacao} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#303842] px-4 font-bold text-white disabled:opacity-50">{processandoAtivacao?<Loader2 className="animate-spin" size={18}/>:<ShieldCheck size={18}/>} Ativar acesso</button>
            </form>
            <button onClick={()=>setModoAtivacao(false)} className="mt-4 w-full text-sm font-semibold text-[#5f7e9b]">Já tenho acesso</button>
          </> : <>
            <div className="flex items-center gap-2"><UserRound/><h2 className="text-xl font-bold">Acesso do tutor</h2></div>
            <p className="mt-2 text-sm text-slate-500">Entre com o usuário criado para você por esta clínica.</p>
            <form className="mt-5 space-y-4" onSubmit={entrar}>
              <label className="block text-sm font-semibold">Usuário<input value={usuario} onChange={e=>setUsuario(e.target.value)} autoComplete="username" placeholder="@seu.usuario" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label>
              <label className="block text-sm font-semibold">Senha<input type="password" value={senha} onChange={e=>setSenha(e.target.value)} autoComplete="current-password" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label>
              <button disabled={processandoLogin} type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#303842] px-4 font-bold text-white disabled:opacity-50">{processandoLogin?<Loader2 className="animate-spin" size={18}/>:<LockKeyhole size={18}/>} Entrar</button>
            </form>
            <button onClick={()=>setModoAtivacao(true)} className="mt-4 w-full text-sm font-semibold text-[#5f7e9b]">Ativar meu primeiro acesso</button>
          </>}
        </section>
      </div>
    </main>;
  }

  if (carregandoPortal) return <main className="flex min-h-screen items-center justify-center bg-[#f4f6f7]"><Loader2 className="animate-spin" /></main>;

  return <main className="min-h-screen bg-[#f4f6f7] text-[#303842]">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="flex items-center gap-3">{contexto.clinica_logo_url ? <img src={contexto.clinica_logo_url} alt="" className="h-12 w-12 rounded-xl object-contain"/> : <div className="rounded-xl bg-[#303842] p-3 text-white"><PawPrint size={20}/></div>}<div><p className="text-[11px] font-bold uppercase tracking-wider text-[#5f7e9b]">Portal do Tutor</p><h1 className="font-bold">{contexto.clinica_nome}</h1></div></div>
      <div className="flex items-center gap-2"><button onClick={()=>setSecao("perfil")} className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold">{contexto.tutor_nome}</button><button onClick={sair} aria-label="Sair" className="rounded-xl border bg-white p-2.5 text-slate-500 hover:text-red-600"><LogOut size={18}/></button></div>
    </div></header>

    <div className="mx-auto max-w-6xl px-5 py-7">
      {secao === "perfil" ? <section className="mx-auto max-w-2xl rounded-2xl border bg-white p-6 shadow-sm">
        <button onClick={()=>setSecao("resumo")} className="text-sm font-bold text-[#5f7e9b]">← Voltar aos animais</button>
        <div className="mt-5 flex items-center gap-3"><UserRound/><div><h2 className="text-2xl font-black">Meu perfil</h2><p className="text-sm text-slate-500">{contexto.usuario}</p></div></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Telefone<input value={telefonePerfil} onChange={(e)=>setTelefonePerfil(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label><label className="text-sm font-semibold">E-mail<input type="email" value={emailPerfil} onChange={(e)=>setEmailPerfil(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label></div>
        <button disabled={salvandoPerfil} onClick={salvarPerfil} className="mt-5 min-h-11 rounded-xl bg-[#303842] px-5 font-bold text-white disabled:opacity-50">{salvandoPerfil?"Salvando...":"Salvar meus dados"}</button>
      </section> : !animais.length ? <section className="rounded-2xl border bg-white p-8 text-center"><PawPrint className="mx-auto text-slate-400" size={36}/><h2 className="mt-3 text-xl font-bold">Nenhum animal vinculado ainda</h2><p className="mt-2 text-sm text-slate-500">Peça à clínica para vincular seus animais ao cadastro do portal.</p></section> : <>
        <div><p className="text-sm text-slate-500">Olá, {contexto.tutor_nome.split(" ")[0]}! 👋</p><h2 className="mt-1 text-3xl font-black tracking-tight">Meus animais</h2></div>
        <div className="mt-5 flex gap-3 overflow-x-auto pb-2">{animais.map((item)=><button key={item.id} onClick={()=>{setAnimalId(item.id);setSecao("resumo");}} className={`min-w-[220px] rounded-2xl border p-4 text-left shadow-sm transition ${item.id===animalId?"border-[#5f7e9b] bg-white ring-2 ring-[#5f7e9b]/10":"bg-white/70 hover:bg-white"}`}><div className="flex items-center gap-3">{item.foto_url?<img src={item.foto_url} alt="" className="h-14 w-14 rounded-full object-cover"/>:<span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-3xl">{emojiEspecie(item.especie)}</span>}<span><strong className="block">{item.nome}</strong><span className="text-xs text-slate-500">{item.especie || "Espécie não informada"}</span></span></div></button>)}</div>

        {animal && <div className="mt-5 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="self-start rounded-2xl border bg-white p-5 shadow-sm"><div className="text-center">{animal.foto_url?<img src={animal.foto_url} alt="" className="mx-auto h-24 w-24 rounded-full object-cover"/>:<div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-slate-100 text-5xl">{emojiEspecie(animal.especie)}</div>}<h3 className="mt-3 text-xl font-black">{animal.nome}</h3><p className="text-xs text-slate-500">{[animal.especie,animal.sexo,animal.raca].filter(Boolean).join(" · ")}</p>{animal.peso_kg!=null&&<p className="mt-2 text-sm font-semibold">{Number(animal.peso_kg).toFixed(3).replace(".",",")} kg</p>}</div><nav className="mt-5 space-y-1">{([
            ["resumo","Visão geral",PawPrint],
            ["agenda","Agenda",CalendarDays],
            ["documentos","Documentos",FileText],
            ["vacinas","Vacinas",HeartPulse],
          ] as const).map(([id,nome,Icon])=><button key={id} onClick={()=>setSecao(id)} className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-bold ${secao===id?"bg-[#303842] text-white":"hover:bg-slate-50"}`}><Icon size={17}/>{nome}</button>)}</nav></aside>

          <section className="min-w-0">
            {secao==="resumo"&&<div className="grid gap-3 sm:grid-cols-3"><button onClick={()=>setSecao("agenda")} className="rounded-2xl border bg-white p-5 text-left shadow-sm"><CalendarDays className="text-[#5f7e9b]"/><h3 className="mt-3 font-black">Agenda</h3><p className="mt-1 text-sm text-slate-500">{agendamentosAnimal.length} registro(s)</p></button><button onClick={()=>setSecao("documentos")} className="rounded-2xl border bg-white p-5 text-left shadow-sm"><FileText className="text-[#5f7e9b]"/><h3 className="mt-3 font-black">Documentos</h3><p className="mt-1 text-sm text-slate-500">{documentosAnimal.length} disponível(is)</p></button><button onClick={()=>setSecao("vacinas")} className="rounded-2xl border bg-white p-5 text-left shadow-sm"><HeartPulse className="text-[#5f7e9b]"/><h3 className="mt-3 font-black">Vacinas</h3><p className="mt-1 text-sm text-slate-500">{vacinasAnimal.length} registro(s)</p></button></div>}

            {secao==="agenda"&&<div className="space-y-4"><section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-black">Novo agendamento</h3><p className="mt-1 text-sm text-slate-500">Os horários abaixo são consultados na agenda real da clínica.</p></div><button onClick={()=>setDataAgenda(primeiraDataAgenda())} className="rounded-lg border p-2 text-slate-500" aria-label="Atualizar data"><RefreshCw size={16}/></button></div>{agendas.length?<div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Agenda<select value={agendaId} onChange={(e)=>setAgendaId(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">{agendas.map((a)=><option key={a.id} value={a.id}>{a.nome}{a.responsavel?` · ${a.responsavel}`:""}</option>)}</select></label><label className="text-sm font-semibold">Data<input type="date" min={dataLocalIso()} value={dataAgenda} onChange={(e)=>setDataAgenda(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label><div className="sm:col-span-2"><p className="text-sm font-semibold">Horários disponíveis</p><div className="mt-2 flex min-h-12 flex-wrap gap-2 rounded-xl border bg-slate-50 p-2">{carregandoHorarios?<span className="flex items-center gap-2 px-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={15}/>Consultando agenda...</span>:horarios.length?horarios.map((h)=><button key={h.inicio} onClick={()=>setHorarioInicio(h.inicio)} className={`rounded-lg px-3 py-2 text-sm font-bold ${horarioInicio===h.inicio?"bg-[#303842] text-white":"bg-white border"}`}>{h.rotulo}</button>):<span className="px-2 py-2 text-sm text-slate-500">Nenhum horário livre nesta data.</span>}</div></div><label className="sm:col-span-2 text-sm font-semibold">Observação para a clínica<textarea value={observacoesAgenda} onChange={(e)=>setObservacoesAgenda(e.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-xl border p-3 font-normal" placeholder="Opcional"/></label></div>:<div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">A clínica ainda não disponibilizou uma agenda online para tutores.</div>}{agendaAtual?.modalidade==="pagamento"&&<p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Esta agenda exige pagamento online e permanece bloqueada até a integração de pagamento ser liberada.</p>}{agendas.length>0&&agendaAtual?.modalidade!=="pagamento"&&<button disabled={!horarioInicio||agendando} onClick={criarAgendamento} className="mt-5 flex min-h-11 items-center gap-2 rounded-xl bg-[#303842] px-5 font-bold text-white disabled:opacity-40">{agendando?<Loader2 className="animate-spin" size={17}/>:<CheckCircle2 size={17}/>} {agendaAtual?.modalidade==="livre"?"Confirmar agendamento":"Enviar solicitação"}</button>}</section>
              <section className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="font-black">Agendamentos de {animal.nome}</h3><div className="mt-3 space-y-2">{agendamentosAnimal.length?agendamentosAnimal.map((ag)=><div key={ag.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><strong className="text-sm">{ag.tipo}</strong><p className="text-xs text-slate-500">{formatarDataHora(ag.inicio)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ag.estado==="confirmado"?"bg-emerald-100 text-emerald-800":ag.estado==="solicitado"?"bg-amber-100 text-amber-900":"bg-slate-100 text-slate-700"}`}>{mensagemEstado(ag.estado)}</span></div>):<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum agendamento registrado.</p>}</div></section></div>}

            {secao==="documentos"&&<section className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="text-xl font-black">Exames e documentos</h3><p className="mt-1 text-sm text-slate-500">Somente itens liberados pela clínica aparecem aqui.</p><div className="mt-4 space-y-2">{documentosAnimal.length?documentosAnimal.map((doc)=><div key={doc.id} className="rounded-xl border p-4"><div className="flex items-start gap-3"><FileText className="mt-0.5 text-[#5f7e9b]" size={20}/><div><strong>{doc.titulo}</strong><p className="mt-0.5 text-xs text-slate-500">{doc.tipo} · {formatarData(doc.data_documento)}</p>{doc.observacoes&&<p className="mt-2 text-sm text-slate-600">{doc.observacoes}</p>}</div></div></div>):<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum documento foi liberado para {animal.nome}.</p>}</div></section>}

            {secao==="vacinas"&&<section className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="text-xl font-black">Vacinas e reforços</h3><div className="mt-4 space-y-2">{vacinasAnimal.length?vacinasAnimal.map((vacina)=><div key={vacina.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><strong>{vacina.nome}</strong>{vacina.reforco_em&&<span className="rounded-full bg-[#5f7e9b]/10 px-2.5 py-1 text-xs font-bold text-[#5f7e9b]">Reforço {formatarData(vacina.reforco_em)}</span>}</div><p className="mt-1 text-xs text-slate-500">Aplicada em {formatarData(vacina.aplicada_em)}{vacina.lote?` · Lote ${vacina.lote}`:""}</p>{vacina.observacoes&&<p className="mt-2 text-sm text-slate-600">{vacina.observacoes}</p>}</div>):<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhuma vacina liberada para visualização.</p>}</div></section>}
          </section>
        </div>}
      </>}
    </div>
  </main>;
}
