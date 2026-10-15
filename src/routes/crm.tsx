import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarClock, Check, Mail, MessageCircle, RefreshCw, Settings2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { usePermissoes } from "@/hooks/usePermissoes";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/crm")({ component: Crm });

type TipoCrm = "aniversario" | "vacina" | "lembrete_consulta" | "retorno" | "pos_cirurgico" | "inativo";
type CanalCrm = "whatsapp" | "email" | "manual";
type StatusCrm = "pendente" | "enviado" | "ignorado" | "cancelado";
type Aba = "fila" | "historico" | "modelos" | "config";

type CrmConfig = {
  clinica_id: string;
  ativo: boolean;
  canal_padrao: CanalCrm;
  dias_antecedencia_agenda: number;
  dias_pos_cirurgico: number;
  dias_inatividade: number;
  gerar_aniversarios: boolean;
  gerar_reforcos: boolean;
  gerar_agendamentos: boolean;
  gerar_pos_cirurgico: boolean;
  gerar_inativos: boolean;
};

type ModeloCrm = {
  id: string;
  clinica_id: string;
  tipo: TipoCrm;
  nome: string;
  assunto: string;
  mensagem: string;
  canal: CanalCrm;
  ativo: boolean;
};

type EventoCrm = {
  id: string;
  clinica_id: string;
  tutor_ref_local?: string | null;
  destinatario_nome: string;
  telefone: string;
  email: string;
  animal_nome: string;
  tipo: TipoCrm;
  titulo: string;
  mensagem: string;
  canal: CanalCrm;
  agendado_para: string;
  status: StatusCrm;
  origem: string;
  enviado_em?: string | null;
};

type TutorLocal = {
  id: string;
  nome: string;
  telefone?: string;
  outroTelefone?: string;
  email?: string;
  nascimento?: string;
  criadoEm?: string;
  contatoPreferencial?: string;
  autorizaLembretes?: boolean;
  autorizaWhatsapp?: boolean;
  autorizaEmail?: boolean;
  autorizaMarketing?: boolean;
};

type AnimalLocal = { id: string; tutorId: string; nome: string };
type RegistroLocal = {
  id: string;
  animalId: string;
  tipo?: string;
  titulo?: string;
  detalhe?: string;
  subtipo?: string;
  proximaDose?: string;
  proximoReforco?: string;
  validadeFim?: string;
  dados?: Record<string, unknown>;
};
type EventoAgendaLocal = { id: string; data?: string; hora?: string; tipo?: string; paciente?: string; tutor?: string; tutorId?: string; animalId?: string };
type AgendaLocal = { id: string; eventos?: EventoAgendaLocal[] };

type Variaveis = { tutor?: string; animal?: string; data?: string; hora?: string; servico?: string; clinica?: string };

type Candidato = Omit<EventoCrm, "id" | "status" | "origem" | "enviado_em"> & {
  chave_dedupe: string;
  status: "pendente";
  origem: "automatico";
  metadados: Record<string, unknown>;
};

const PADRAO: Omit<CrmConfig, "clinica_id"> = {
  ativo: true,
  canal_padrao: "whatsapp",
  dias_antecedencia_agenda: 1,
  dias_pos_cirurgico: 1,
  dias_inatividade: 180,
  gerar_aniversarios: true,
  gerar_reforcos: true,
  gerar_agendamentos: true,
  gerar_pos_cirurgico: true,
  gerar_inativos: false,
};

const ROTULOS: Record<TipoCrm, string> = {
  aniversario: "Aniversário",
  vacina: "Vacina / reforço",
  lembrete_consulta: "Lembrete de consulta",
  retorno: "Retorno",
  pos_cirurgico: "Pós-cirúrgico",
  inativo: "Cliente inativo",
};

function lerLista<T>(chave: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const valor: unknown = JSON.parse(window.localStorage.getItem(chave) || "[]");
    return Array.isArray(valor) ? (valor as T[]) : [];
  } catch {
    return [];
  }
}

function normalizarData(valor?: unknown): string | null {
  if (typeof valor !== "string") return null;
  const texto = valor.trim();
  let m = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${String(Number(m[2])).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
  return null;
}

function dataBR(data?: string) {
  if (!data) return "—";
  const d = normalizarData(data);
  if (!d) return data;
  const [ano, mes, dia] = d.split("-");
  return `${dia}/${mes}/${ano}`;
}

function inicioDia(data = new Date()) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

function diasEntre(data: string, hoje = inicioDia()) {
  const alvo = new Date(`${data}T12:00:00`);
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12);
  return Math.round((alvo.getTime() - base.getTime()) / 86400000);
}

function deslocarData(data: string, dias: number) {
  const d = new Date(`${data}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoLocal(data: string, hora = "09:00") {
  const h = /^\d{2}:\d{2}/.test(hora) ? hora.slice(0, 5) : "09:00";
  return new Date(`${data}T${h}:00`).toISOString();
}

function proximoAniversario(nascimento?: string) {
  const n = normalizarData(nascimento);
  if (!n) return null;
  const [, mes, dia] = n.split("-").map(Number);
  const hoje = inicioDia();
  let alvo = new Date(hoje.getFullYear(), mes - 1, dia);
  if (alvo < hoje) alvo = new Date(hoje.getFullYear() + 1, mes - 1, dia);
  return `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, "0")}-${String(alvo.getDate()).padStart(2, "0")}`;
}

function extrairDataReforco(registro: RegistroLocal): string | null {
  const dados = registro.dados || {};
  const candidatos = [
    registro.proximaDose,
    registro.proximoReforco,
    registro.validadeFim,
    dados.proximaDose,
    dados.proximoReforco,
    dados.validadeFim,
    dados.proxima_dose,
    dados.proximo_reforco,
    dados.validade_fim,
  ];
  for (const valor of candidatos) {
    const data = normalizarData(valor);
    if (data) return data;
  }
  const detalhe = String(registro.detalhe || "");
  const achado = detalhe.match(/(?:pr[oó]xima\s+dose|pr[oó]ximo\s+refor[cç]o|refor[cç]o|validade\s+at[eé]|repetir\s+em)\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i);
  return achado ? normalizarData(achado[1]) : null;
}

function renderizar(texto: string, variaveis: Variaveis) {
  return texto.replace(/{{\s*(tutor|animal|data|hora|servico|clinica)\s*}}/gi, (_, chave: keyof Variaveis) => variaveis[chave] || "");
}

function canalTutor(tutor: TutorLocal, padrao: CanalCrm): CanalCrm {
  const preferencia = String(tutor.contatoPreferencial || "").toLowerCase();
  if (preferencia.includes("email") && tutor.autorizaEmail !== false && tutor.email) return "email";
  if (tutor.autorizaWhatsapp !== false && (tutor.telefone || tutor.outroTelefone)) return "whatsapp";
  if (tutor.autorizaEmail !== false && tutor.email) return "email";
  return padrao === "whatsapp" && !(tutor.telefone || tutor.outroTelefone) ? "manual" : padrao;
}

function telefone(tutor: TutorLocal) {
  return String(tutor.telefone || tutor.outroTelefone || "");
}

function Crm() {
  const { carregando: carregandoPermissoes, clinicaId, pode, adminGlobal } = usePermissoes();
  const [aba, setAba] = useState<Aba>("fila");
  const [config, setConfig] = useState<CrmConfig | null>(null);
  const [modelos, setModelos] = useState<ModeloCrm[]>([]);
  const [eventos, setEventos] = useState<EventoCrm[]>([]);
  const [clinicaNome, setClinicaNome] = useState("Clínica");
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);

  const podeOperar = adminGlobal || pode("crm.enviar") || pode("crm.gerenciar");
  const podeGerenciar = adminGlobal || pode("crm.gerenciar");

  async function carregarEventos(id = clinicaId) {
    if (!id) return;
    const { data, error } = await (supabase as any)
      .from("oricse_crm_eventos")
      .select("*")
      .eq("clinica_id", id)
      .order("agendado_para", { ascending: true });
    if (error) throw error;
    setEventos((data || []) as EventoCrm[]);
  }

  function modelo(tipo: TipoCrm, lista = modelos) {
    return lista.find((item) => item.tipo === tipo && item.ativo) || lista.find((item) => item.tipo === tipo);
  }

  function criarCandidato(tipo: TipoCrm, tutor: TutorLocal, animalNome: string, data: string, hora: string, servico: string, chave: string, cfg: CrmConfig, listaModelos: ModeloCrm[], nomeClinica: string): Candidato | null {
    const m = modelo(tipo, listaModelos);
    if (!m?.mensagem) return null;
    const vars: Variaveis = { tutor: tutor.nome, animal: animalNome, data: dataBR(data), hora, servico, clinica: nomeClinica };
    return {
      clinica_id: cfg.clinica_id,
      tutor_ref_local: tutor.id,
      destinatario_nome: tutor.nome,
      telefone: telefone(tutor),
      email: tutor.email || "",
      animal_nome: animalNome,
      tipo,
      titulo: renderizar(m.assunto || m.nome || ROTULOS[tipo], vars),
      mensagem: renderizar(m.mensagem, vars),
      canal: canalTutor(tutor, m.canal || cfg.canal_padrao),
      agendado_para: isoLocal(data, "09:00"),
      chave_dedupe: chave,
      status: "pendente",
      origem: "automatico",
      metadados: { data_origem: data, hora, servico },
    };
  }

  async function sincronizarComDados(cfg = config, listaModelos = modelos, nomeClinica = clinicaNome) {
    if (!cfg || !cfg.clinica_id || !podeOperar || !cfg.ativo) return;
    setSincronizando(true);
    try {
      const tutores = lerLista<TutorLocal>("oricse-tutores-v1");
      const animais = lerLista<AnimalLocal>("oricse-animais-v1");
      const registros = lerLista<RegistroLocal>("oricse-prontuario-animal-v1");
      const agendas = lerLista<AgendaLocal>("oricse-agendas-v2");
      const tutorPorId = new Map(tutores.map((t) => [String(t.id), t]));
      const animalPorId = new Map(animais.map((a) => [String(a.id), a]));
      const candidatos: Candidato[] = [];
      const agora = new Date();
      const anoAtual = agora.getFullYear();

      if (cfg.gerar_aniversarios) {
        for (const tutor of tutores) {
          if (tutor.autorizaLembretes === false) continue;
          const data = proximoAniversario(tutor.nascimento);
          if (!data || diasEntre(data) < 0 || diasEntre(data) > 45) continue;
          const candidato = criarCandidato("aniversario", tutor, "", data, "", "aniversário", `aniversario:${tutor.id}:${data.slice(0, 4)}`, cfg, listaModelos, nomeClinica);
          if (candidato) candidatos.push(candidato);
        }
      }

      if (cfg.gerar_reforcos) {
        for (const registro of registros) {
          const data = extrairDataReforco(registro);
          if (!data || diasEntre(data) < -14 || diasEntre(data) > 60) continue;
          const animal = animalPorId.get(String(registro.animalId));
          if (!animal) continue;
          const tutor = tutorPorId.get(String(animal.tutorId));
          if (!tutor || tutor.autorizaLembretes === false) continue;
          const texto = `${registro.tipo || ""} ${registro.subtipo || ""} ${registro.titulo || ""} ${registro.detalhe || ""}`;
          if (!/vacina|v10|v8|antirr[aá]b|gi[aá]rd|gripe|verm[ií]f/i.test(texto)) continue;
          const servico = registro.titulo || registro.subtipo || (/(verm[ií]f)/i.test(texto) ? "vermifugação" : "reforço de vacina");
          const candidato = criarCandidato("vacina", tutor, animal.nome, data, "", servico, `vacina:${registro.id}:${data}`, cfg, listaModelos, nomeClinica);
          if (candidato) candidatos.push(candidato);
        }
      }

      const todosEventos = agendas.flatMap((agenda) => Array.isArray(agenda.eventos) ? agenda.eventos : []);
      if (cfg.gerar_agendamentos || cfg.gerar_pos_cirurgico || cfg.gerar_inativos) {
        for (const evento of todosEventos) {
          const dataEvento = normalizarData(evento.data);
          if (!dataEvento) continue;
          const tutor = evento.tutorId ? tutorPorId.get(String(evento.tutorId)) : tutores.find((t) => t.nome === evento.tutor);
          const animal = evento.animalId ? animalPorId.get(String(evento.animalId)) : undefined;
          if (!tutor || tutor.autorizaLembretes === false) continue;
          const animalNome = animal?.nome || evento.paciente || "seu pet";
          const tipoServico = evento.tipo || "consulta";
          const hora = evento.hora || "";

          if (cfg.gerar_agendamentos && diasEntre(dataEvento) >= 0 && diasEntre(dataEvento) <= 60) {
            const tipo: TipoCrm = /retorno/i.test(tipoServico) ? "retorno" : "lembrete_consulta";
            const dataEnvio = deslocarData(dataEvento, -Math.max(0, cfg.dias_antecedencia_agenda));
            const candidato = criarCandidato(tipo, tutor, animalNome, dataEnvio, hora, tipoServico, `${tipo}:${evento.id}:${dataEvento}:${hora}`, cfg, listaModelos, nomeClinica);
            if (candidato) {
              const m = modelo(tipo, listaModelos);
              const vars = { tutor: tutor.nome, animal: animalNome, data: dataBR(dataEvento), hora, servico: tipoServico, clinica: nomeClinica };
              if (m) {
                candidato.titulo = renderizar(m.assunto || m.nome, vars);
                candidato.mensagem = renderizar(m.mensagem, vars);
              }
              candidato.metadados = { ...candidato.metadados, data_consulta: dataEvento };
              candidatos.push(candidato);
            }
          }

          if (cfg.gerar_pos_cirurgico && /cirurg|procedimento cirúrg/i.test(tipoServico)) {
            const dataContato = deslocarData(dataEvento, Math.max(0, cfg.dias_pos_cirurgico));
            if (diasEntre(dataContato) >= -14 && diasEntre(dataContato) <= 60) {
              const candidato = criarCandidato("pos_cirurgico", tutor, animalNome, dataContato, "", tipoServico, `pos_cirurgico:${evento.id}:${dataContato}`, cfg, listaModelos, nomeClinica);
              if (candidato) candidatos.push(candidato);
            }
          }
        }
      }

      if (cfg.gerar_inativos) {
        const ultimoPorTutor = new Map<string, string>();
        for (const evento of todosEventos) {
          const d = normalizarData(evento.data);
          if (!evento.tutorId || !d || new Date(`${d}T12:00:00`) > agora) continue;
          const atual = ultimoPorTutor.get(String(evento.tutorId));
          if (!atual || d > atual) ultimoPorTutor.set(String(evento.tutorId), d);
        }
        for (const tutor of tutores) {
          if (tutor.autorizaMarketing !== true) continue;
          const ultima = ultimoPorTutor.get(String(tutor.id)) || normalizarData(tutor.criadoEm);
          if (!ultima) continue;
          const diasInativo = Math.floor((inicioDia().getTime() - new Date(`${ultima}T12:00:00`).getTime()) / 86400000);
          if (diasInativo < cfg.dias_inatividade) continue;
          const animal = animais.find((a) => String(a.tutorId) === String(tutor.id));
          const data = `${anoAtual}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
          const candidato = criarCandidato("inativo", tutor, animal?.nome || "seu pet", data, "", "acompanhamento", `inativo:${tutor.id}:${anoAtual}-${agora.getMonth() + 1}`, cfg, listaModelos, nomeClinica);
          if (candidato) candidatos.push(candidato);
        }
      }

      if (candidatos.length) {
        const { error } = await (supabase as any)
          .from("oricse_crm_eventos")
          .upsert(candidatos, { onConflict: "clinica_id,chave_dedupe", ignoreDuplicates: true });
        if (error) throw error;
      }
      await carregarEventos(cfg.clinica_id);
      toast.success(candidatos.length ? "CRM sincronizado com os dados da clínica." : "CRM atualizado. Nenhum novo lembrete encontrado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível sincronizar o CRM.");
    } finally {
      setSincronizando(false);
    }
  }

  useEffect(() => {
    if (carregandoPermissoes || !clinicaId) return;
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      try {
        const [configResult, modelosResult, clinicaResult] = await Promise.all([
          (supabase as any).from("oricse_crm_config").select("*").eq("clinica_id", clinicaId).maybeSingle(),
          (supabase as any).from("oricse_crm_modelos").select("*").eq("clinica_id", clinicaId).order("tipo"),
          (supabase as any).from("clinicas").select("nome").eq("id", clinicaId).maybeSingle(),
        ]);
        if (configResult.error) throw configResult.error;
        if (modelosResult.error) throw modelosResult.error;
        if (clinicaResult.error) throw clinicaResult.error;
        if (!ativo) return;
        const cfg = (configResult.data || { clinica_id: clinicaId, ...PADRAO }) as CrmConfig;
        const mods = (modelosResult.data || []) as ModeloCrm[];
        const nome = clinicaResult.data?.nome || "Clínica";
        setConfig(cfg);
        setModelos(mods);
        setClinicaNome(nome);
        await carregarEventos(clinicaId);
      } catch (error) {
        if (ativo) toast.error(error instanceof Error ? error.message : "Não foi possível carregar o CRM.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    void carregar();
    return () => { ativo = false; };
  }, [carregandoPermissoes, clinicaId]);

  const pendentes = useMemo(() => eventos.filter((evento) => evento.status === "pendente"), [eventos]);
  const vencidos = useMemo(() => pendentes.filter((evento) => new Date(evento.agendado_para).getTime() < Date.now()), [pendentes]);
  const hoje = useMemo(() => pendentes.filter((evento) => new Date(evento.agendado_para).toDateString() === new Date().toDateString()), [pendentes]);
  const historico = useMemo(() => eventos.filter((evento) => evento.status !== "pendente").sort((a, b) => new Date(b.agendado_para).getTime() - new Date(a.agendado_para).getTime()), [eventos]);

  async function alterarStatus(evento: EventoCrm, status: StatusCrm) {
    if (!podeOperar) return;
    setSalvando(evento.id);
    const payload: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === "enviado") payload.enviado_em = new Date().toISOString();
    const { error } = await (supabase as any).from("oricse_crm_eventos").update(payload).eq("id", evento.id).eq("clinica_id", clinicaId);
    setSalvando(null);
    if (error) return void toast.error(error.message);
    setEventos((lista) => lista.map((item) => item.id === evento.id ? { ...item, status, enviado_em: status === "enviado" ? new Date().toISOString() : item.enviado_em } : item));
  }

  function abrirContato(evento: EventoCrm) {
    if (evento.canal === "email" && evento.email) {
      window.location.href = `mailto:${evento.email}?subject=${encodeURIComponent(evento.titulo)}&body=${encodeURIComponent(evento.mensagem)}`;
      return;
    }
    const digitos = evento.telefone.replace(/\D/g, "");
    if (!digitos) return void toast.error("Este contato não possui telefone para WhatsApp.");
    const numero = digitos.startsWith("55") ? digitos : `55${digitos}`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(evento.mensagem)}`, "_blank", "noopener,noreferrer");
  }

  async function salvarConfig() {
    if (!config || !podeGerenciar) return;
    setSalvando("config");
    const { error } = await (supabase as any).from("oricse_crm_config").upsert({ ...config, updated_at: new Date().toISOString() }, { onConflict: "clinica_id" });
    setSalvando(null);
    if (error) return void toast.error(error.message);
    toast.success("Configurações do CRM salvas.");
  }

  async function salvarModelo(item: ModeloCrm) {
    if (!podeGerenciar) return;
    setSalvando(item.id);
    const { error } = await (supabase as any).from("oricse_crm_modelos").update({ assunto: item.assunto, mensagem: item.mensagem, canal: item.canal, ativo: item.ativo, updated_at: new Date().toISOString() }).eq("id", item.id).eq("clinica_id", clinicaId);
    setSalvando(null);
    if (error) return void toast.error(error.message);
    toast.success("Modelo de mensagem salvo.");
  }

  if (carregandoPermissoes || carregando) {
    return <main className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">Carregando CRM...</main>;
  }

  return <main className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6">
    <Link to="/recepcao" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={17}/> Recepção</Link>

    <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-primary"><Sparkles size={20}/><span className="text-xs font-black uppercase tracking-[0.16em]">CRM inteligente</span></div>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Relacionamento com tutores</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Aniversários, vacinas, consultas, retornos e pós-cirúrgico em uma única fila, com mensagens editáveis pela clínica.</p>
      </div>
      {podeOperar && <button type="button" disabled={sincronizando} onClick={() => void sincronizarComDados()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"><RefreshCw size={17} className={sincronizando ? "animate-spin" : ""}/>{sincronizando ? "Sincronizando..." : "Sincronizar agora"}</button>}
    </header>

    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      <Resumo titulo="Pendentes" valor={pendentes.length} detalhe="contatos na fila" />
      <Resumo titulo="Para hoje" valor={hoje.length} detalhe="ações previstas hoje" />
      <Resumo titulo="Atrasados" valor={vencidos.length} detalhe="precisam de atenção" destaque={vencidos.length > 0} />
    </div>

    <nav className="mt-5 flex gap-1 overflow-x-auto rounded-xl border bg-card p-1">
      {([['fila','Fila'],['historico','Histórico'],['modelos','Mensagens'],['config','Configurações']] as Array<[Aba,string]>).filter(([id]) => id !== 'config' || podeGerenciar).map(([id, rotulo]) => <button key={id} type="button" onClick={() => setAba(id)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold ${aba === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{rotulo}</button>)}
    </nav>

    {aba === "fila" && <section className="mt-5 space-y-3">
      {pendentes.length ? pendentes.map((evento) => <EventoCard key={evento.id} evento={evento} podeOperar={podeOperar} salvando={salvando === evento.id} onContato={abrirContato} onStatus={alterarStatus}/>) : <Vazio texto="Nenhum contato pendente. Use “Sincronizar agora” para verificar aniversários, reforços e agenda."/>}
    </section>}

    {aba === "historico" && <section className="mt-5 space-y-3">
      {historico.length ? historico.map((evento) => <EventoCard key={evento.id} evento={evento} podeOperar={false} salvando={false} onContato={abrirContato} onStatus={alterarStatus}/>) : <Vazio texto="Ainda não há contatos concluídos ou ignorados."/>}
    </section>}

    {aba === "modelos" && <section className="mt-5 grid gap-4 lg:grid-cols-2">
      {modelos.map((item) => <article key={item.id} className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-wider text-primary">{ROTULOS[item.tipo]}</p><h2 className="mt-1 font-black">{item.nome}</h2></div>
          <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={item.ativo} disabled={!podeGerenciar} onChange={(e) => setModelos((lista) => lista.map((m) => m.id === item.id ? { ...m, ativo: e.target.checked } : m))}/> Ativo</label>
        </div>
        <label className="mt-4 block text-xs font-bold">Assunto / título<input value={item.assunto} disabled={!podeGerenciar} onChange={(e) => setModelos((lista) => lista.map((m) => m.id === item.id ? { ...m, assunto: e.target.value } : m))} className="mt-1 min-h-10 w-full rounded-xl border bg-background px-3 text-sm font-normal"/></label>
        <label className="mt-3 block text-xs font-bold">Mensagem<textarea value={item.mensagem} disabled={!podeGerenciar} onChange={(e) => setModelos((lista) => lista.map((m) => m.id === item.id ? { ...m, mensagem: e.target.value } : m))} rows={5} className="mt-1 w-full rounded-xl border bg-background p-3 text-sm font-normal"/></label>
        <div className="mt-2 text-[11px] text-muted-foreground">Variáveis: {'{{tutor}}'} · {'{{animal}}'} · {'{{data}}'} · {'{{hora}}'} · {'{{servico}}'} · {'{{clinica}}'}</div>
        <div className="mt-3 flex items-center justify-between gap-3"><select value={item.canal} disabled={!podeGerenciar} onChange={(e) => setModelos((lista) => lista.map((m) => m.id === item.id ? { ...m, canal: e.target.value as CanalCrm } : m))} className="h-10 rounded-xl border bg-background px-3 text-sm"><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="manual">Manual</option></select>{podeGerenciar && <button type="button" disabled={salvando === item.id} onClick={() => void salvarModelo(item)} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">Salvar</button>}</div>
      </article>)}
    </section>}

    {aba === "config" && config && podeGerenciar && <section className="mt-5 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2"><Settings2 size={20} className="text-primary"/><h2 className="text-xl font-black">Automações da clínica</h2></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Toggle rotulo="Aniversários" checked={config.gerar_aniversarios} onChange={(v) => setConfig({ ...config, gerar_aniversarios: v })}/>
        <Toggle rotulo="Vacinas e reforços" checked={config.gerar_reforcos} onChange={(v) => setConfig({ ...config, gerar_reforcos: v })}/>
        <Toggle rotulo="Lembretes de consulta e retorno" checked={config.gerar_agendamentos} onChange={(v) => setConfig({ ...config, gerar_agendamentos: v })}/>
        <Toggle rotulo="Pós-cirúrgico" checked={config.gerar_pos_cirurgico} onChange={(v) => setConfig({ ...config, gerar_pos_cirurgico: v })}/>
        <Toggle rotulo="Recuperar clientes inativos" checked={config.gerar_inativos} onChange={(v) => setConfig({ ...config, gerar_inativos: v })}/>
        <Toggle rotulo="CRM ativo" checked={config.ativo} onChange={(v) => setConfig({ ...config, ativo: v })}/>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <CampoNumero rotulo="Lembrete antes da agenda" sufixo="dia(s)" valor={config.dias_antecedencia_agenda} min={0} max={30} onChange={(v) => setConfig({ ...config, dias_antecedencia_agenda: v })}/>
        <CampoNumero rotulo="Contato pós-cirúrgico" sufixo="dia(s) depois" valor={config.dias_pos_cirurgico} min={0} max={30} onChange={(v) => setConfig({ ...config, dias_pos_cirurgico: v })}/>
        <CampoNumero rotulo="Considerar cliente inativo após" sufixo="dias" valor={config.dias_inatividade} min={30} max={3650} onChange={(v) => setConfig({ ...config, dias_inatividade: v })}/>
      </div>
      <button type="button" disabled={salvando === "config"} onClick={() => void salvarConfig()} className="mt-5 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">Salvar configurações</button>
    </section>}
  </main>;
}

function Resumo({ titulo, valor, detalhe, destaque = false }: { titulo: string; valor: number; detalhe: string; destaque?: boolean }) {
  return <div className={`rounded-2xl border bg-card p-4 shadow-sm ${destaque ? "border-amber-300" : ""}`}><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{titulo}</p><p className="mt-1 text-3xl font-black tabular-nums">{valor}</p><p className="text-xs text-muted-foreground">{detalhe}</p></div>;
}

function EventoCard({ evento, podeOperar, salvando, onContato, onStatus }: { evento: EventoCrm; podeOperar: boolean; salvando: boolean; onContato: (evento: EventoCrm) => void; onStatus: (evento: EventoCrm, status: StatusCrm) => void }) {
  const quando = new Date(evento.agendado_para);
  return <article className="rounded-2xl border bg-card p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">{ROTULOS[evento.tipo]}</span><span className="text-xs text-muted-foreground"><CalendarClock size={13} className="mr-1 inline"/>{quando.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span></div><h2 className="mt-2 truncate text-lg font-black">{evento.destinatario_nome || "Tutor"}{evento.animal_nome ? ` · ${evento.animal_nome}` : ""}</h2><p className="mt-1 text-sm text-muted-foreground">{evento.mensagem}</p></div>
      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${evento.status === "enviado" ? "bg-emerald-100 text-emerald-800" : evento.status === "pendente" ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"}`}>{evento.status}</span>
    </div>
    {podeOperar && evento.status === "pendente" && <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" onClick={() => onContato(evento)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground">{evento.canal === "email" ? <Mail size={16}/> : <MessageCircle size={16}/>} Abrir {evento.canal === "email" ? "e-mail" : evento.canal === "manual" ? "contato" : "WhatsApp"}</button>
      <button type="button" disabled={salvando} onClick={() => void onStatus(evento, "enviado")} className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-bold disabled:opacity-50"><Check size={16}/> Marcar enviado</button>
      <button type="button" disabled={salvando} onClick={() => void onStatus(evento, "ignorado")} className="min-h-10 rounded-xl border px-3 text-sm font-semibold text-muted-foreground disabled:opacity-50">Ignorar</button>
    </div>}
  </article>;
}

function Toggle({ rotulo, checked, onChange }: { rotulo: string; checked: boolean; onChange: (valor: boolean) => void }) {
  return <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border bg-background px-4 text-sm font-bold"><span>{rotulo}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5"/></label>;
}

function CampoNumero({ rotulo, sufixo, valor, min, max, onChange }: { rotulo: string; sufixo: string; valor: number; min: number; max: number; onChange: (valor: number) => void }) {
  return <label className="text-xs font-bold">{rotulo}<div className="mt-1 flex items-center rounded-xl border bg-background"><input type="number" min={min} max={max} value={valor} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))} className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm font-normal outline-none"/><span className="pr-3 text-xs text-muted-foreground">{sufixo}</span></div></label>;
}

function Vazio({ texto }: { texto: string }) {
  return <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">{texto}</div>;
}
