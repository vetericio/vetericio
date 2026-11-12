import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Save, Stethoscope, Search, ShieldCheck, FileText, Wallet, Palette, MessagesSquare, ChevronRight, Settings2, CheckCircle2, LockKeyhole, CalendarDays, AlertCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ConfiguracaoModelosDocumentos } from "@/components/ConfiguracaoModelosDocumentos";
import { ConfiguracaoPoliticasClinica } from "@/components/ConfiguracaoPoliticasClinica";

export const Route = createFileRoute("/perfil-clinica")({
  head: () => ({
    meta: [
      { title: "Configurações da clínica — Oricse" },
      { name: "description", content: "Configurações operacionais da clínica na Oricse." },
    ],
  }),
  component: PerfilClinica,
});

type Papel = "rt" | "veterinario" | "auxiliar_estagiario" | "recepcao" | string;
type Duracoes = Record<string, number>;

type ClinicaPerfil = {
  id: string;
  nome: string;
  duracao_padrao_atendimento_min: number;
  duracoes_atendimento_min: Duracoes;
  papel: Papel;
};

const OPCOES_INTERVALO = [10, 15, 20, 30, 45, 60];
const TIPOS = ["Consulta", "Retorno", "Cirurgia", "Banho e Tosa", "Vacina", "Procedimento"] as const;
const DURACOES_PADRAO: Duracoes = {
  Consulta: 30,
  Retorno: 30,
  Cirurgia: 120,
  "Banho e Tosa": 60,
  Vacina: 30,
  Procedimento: 30,
};

function PerfilClinica() {
  const [perfil, setPerfil] = useState<ClinicaPerfil | null>(null);
  const [intervalo, setIntervalo] = useState(30);
  const [duracoes, setDuracoes] = useState<Duracoes>(DURACOES_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [adminGeral, setAdminGeral] = useState(false);
  const [grupoAtivo, setGrupoAtivo] = useState("operacao");
  const [busca, setBusca] = useState("");

  const podeEditar = adminGeral || perfil?.papel === "rt" || perfil?.papel === "recepcao";
  const opcaoSelecionada = useMemo(
    () => OPCOES_INTERVALO.includes(intervalo) ? String(intervalo) : "personalizado",
    [intervalo],
  );

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData.user?.id;
        if (!userId) throw new Error("Sessão não encontrada.");
        const { data: contaAdmin } = await (supabase as any).from("app_users").select("role").eq("user_id", userId).maybeSingle();
        if (ativo) setAdminGeral(contaAdmin?.role === "admin");

        const { data: vinculo, error: erroVinculo } = await (supabase as any)
          .from("clinica_usuarios")
          .select("clinica_id,papel")
          .eq("user_id", userId)
          .eq("ativo", true)
          .limit(1)
          .maybeSingle();
        if (erroVinculo) throw erroVinculo;
        if (!vinculo?.clinica_id) throw new Error("Usuário não vinculado a uma clínica.");

        const { data: clinica, error: erroClinica } = await (supabase as any)
          .from("clinicas")
          .select("id,nome,duracao_padrao_atendimento_min,duracoes_atendimento_min")
          .eq("id", vinculo.clinica_id)
          .maybeSingle();
        if (erroClinica) throw erroClinica;
        if (!clinica?.id) throw new Error("Clínica não encontrada.");

        const intervaloSalvo = Math.max(5, Number(clinica.duracao_padrao_atendimento_min) || 30);
        const salvas = { ...DURACOES_PADRAO, ...(clinica.duracoes_atendimento_min || {}) };
        if (!ativo) return;
        setPerfil({
          id: clinica.id,
          nome: clinica.nome,
          duracao_padrao_atendimento_min: intervaloSalvo,
          duracoes_atendimento_min: salvas,
          papel: vinculo.papel,
        });
        setIntervalo(intervaloSalvo);
        setDuracoes(salvas);
      } catch (e) {
        if (ativo) toast.error((e as Error).message || "Não foi possível carregar o perfil da clínica.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    void carregar();
    return () => { ativo = false; };
  }, []);

  function alterarDuracao(tipo: string, valor: number) {
    setDuracoes((atual) => ({ ...atual, [tipo]: valor }));
  }

  async function salvar() {
    if (!podeEditar) return toast.error("Somente a administração geral, o RT ou a Recepção podem alterar esta configuração.");
    const intervaloMin = Math.round(Number(intervalo));
    if (!Number.isFinite(intervaloMin) || intervaloMin < 5 || intervaloMin > 720) {
      return toast.error("Informe um intervalo entre 5 e 720 minutos.");
    }

    for (const tipo of TIPOS) {
      const minutos = Math.round(Number(duracoes[tipo]));
      if (!Number.isFinite(minutos) || minutos < 5 || minutos > 720) {
        return toast.error(`Informe uma duração válida para ${tipo}.`);
      }
    }

    setSalvando(true);
    try {
      const payload = Object.fromEntries(TIPOS.map((tipo) => [tipo, Math.round(Number(duracoes[tipo]))]));
      const { error } = await (supabase as any).rpc("set_my_clinic_agenda_settings", {
        p_interval_minutes: intervaloMin,
        p_durations: payload,
      });
      if (error) throw error;
      setPerfil((atual) => atual ? {
        ...atual,
        duracao_padrao_atendimento_min: intervaloMin,
        duracoes_atendimento_min: payload,
      } : atual);
      toast.success("Configurações da agenda salvas.");
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível salvar a configuração.");
    } finally {
      setSalvando(false);
    }
  }


  const grupos = [
    { id: "estrutura", titulo: "Clínica e estrutura", icone: Building2, itens: [
      { nome: "Dados cadastrais e unidades", descricao: "Cadastro, endereço, contatos, responsável técnico e funcionamento." },
      { nome: "Equipe e permissões", descricao: "Gerencie acessos e responsabilidades.", href: "/permissoes-equipe" },
      { nome: "Animais e tutores", descricao: "Campos cadastrais, responsáveis e identificação." },
      { nome: "Aprovações administrativas", descricao: "Regras para ações sensíveis.", especial: "politicas" },
    ] },
    { id: "operacao", titulo: "Operação clínica", icone: Stethoscope, itens: [
      { nome: "Agenda e atendimentos", descricao: "Intervalos e duração de procedimentos.", especial: "agenda" },
      { nome: "Políticas de cancelamento e faltas", descricao: "Tolerância, antecedência, remarcação e sinal.", especial: "politicas" },
      { nome: "Prontuário e protocolos", descricao: "Modelos clínicos, checklists e configurações por espécie." },
      { nome: "Internação e hospedagem", descricao: "Rotinas, leitos, cuidados e regras da hospedagem." },
      { nome: "Banho e tosa", descricao: "Duração, serviços, pacotes e horários." },
      { nome: "Equipamentos clínicos", descricao: "Cadastro, manutenção e calibração." },
    ] },
    { id: "comercial", titulo: "Comercial e financeiro", icone: Wallet, itens: [
      { nome: "Produtos e serviços", descricao: "Catálogo, preços e itens de estoque.", href: "/catalogo" },
      { nome: "Estoque e Venda Expressa", descricao: "Lotes, validade, código de barras e regras de venda." },
      { nome: "Caixa, pagamentos e comissões", descricao: "Estornos, descontos, taxas e aprovações." },
      ...(adminGeral ? [{ nome: "Mercado Pago", descricao: "Conta de recebimento vinculada à clínica.", href: "/mercado-pago-clinica" }] : []),
      { nome: "Faturamento e documentos fiscais", descricao: "Integração fiscal e parâmetros de emissão." },
    ] },
    { id: "documentos", titulo: "Documentos e modelos", icone: FileText, itens: [
      { nome: "Receituários personalizados", descricao: "Biblioteca de receitas, cabeçalhos e modelos próprios." },
      { nome: "Pedidos de exames", descricao: "Modelos de solicitações e encaminhamentos." },
      { nome: "Laudos, atestados e declarações", descricao: "Modelos com preenchimento automático." },
      { nome: "Termos e consentimentos", descricao: "Termos por procedimento e autorizações." },
      { nome: "Editor visual e importação", descricao: "Crie, importe, salve e versione modelos de texto.", especial: "modelos" },
      { nome: "Assinaturas e senhas do RT", descricao: "Políticas de autenticação e versões." },
    ] },
    { id: "comunicacao", titulo: "Comunicação", icone: MessagesSquare, itens: [
      ...((adminGeral || perfil?.papel === "admin_clinica") ? [{ nome: "Portal do Tutor", descricao: "Personalização e serviços disponíveis ao tutor.", href: "/configurar-portal-tutor" }] : []),
      { nome: "CRM e campanhas", descricao: "Comunicação, segmentação e relacionamento." },
      { nome: "Modelos de mensagens", descricao: "Mensagens personalizáveis para uso nas comunicações.", especial: "politicas" },
      { nome: "Lembretes automáticos", descricao: "Vacinas, retornos, consultas e mensagens." },
      { nome: "Central de pendências e automações", descricao: "Tarefas, avisos e regras de execução." },
    ] },
    { id: "personalizacao", titulo: "Personalização", icone: Palette, itens: [
      { nome: "Identidade visual", descricao: "Logotipo, cores, documentos e site." },
      { nome: "Acessibilidade e interface", descricao: "Contraste, legibilidade e densidade de informações." },
      { nome: "Impressoras e equipamentos", descricao: "Etiquetas, leitores, câmeras e impressão." },
      { nome: "Indicadores personalizados", descricao: "Seleção de métricas dos painéis." },
    ] },
    { id: "administracao", titulo: "Administração avançada", icone: ShieldCheck, itens: [
      { nome: "Meu plano e funcionalidades", descricao: "Recursos e limites contratados.", href: "/plano-clinica" },
      { nome: "Segurança e auditoria", descricao: "Permissões, histórico e autenticação." },
      { nome: "Backup, importação e contingência", descricao: "Exportações, migrações e continuidade operacional." },
      { nome: "Privacidade e LGPD", descricao: "Retenção, solicitações e proteção de dados." },
      { nome: "Integrações e API", descricao: "Serviços externos e webhooks." },
    ] },
  ];
  const termoBusca = busca.trim().toLocaleLowerCase("pt-BR");
  const gruposVisiveis = grupos.filter((grupo) => !termoBusca || grupo.titulo.toLocaleLowerCase("pt-BR").includes(termoBusca) || grupo.itens.some((item) => (item.nome + " " + item.descricao).toLocaleLowerCase("pt-BR").includes(termoBusca)));
  const gruposConteudo = termoBusca ? gruposVisiveis : grupos.filter((grupo) => grupo.id === grupoAtivo);
  const pendente = !!perfil && (intervalo !== perfil.duracao_padrao_atendimento_min || TIPOS.some((tipo) => duracoes[tipo] !== perfil.duracoes_atendimento_min[tipo]));

  if (carregando) {
    return <main className="mx-auto w-full max-w-6xl px-4 py-8" aria-busy="true"><div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Carregando configurações da clínica...</div></main>;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-5 sm:px-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Settings2 size={22}/></div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Configurações da clínica</h1>
            <p className="text-sm text-muted-foreground">{perfil?.nome || "Clínica"} · Central de administração</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"><CheckCircle2 size={14} className="text-emerald-600"/> Configurações centralizadas</span>
      </header>

      <div className="mb-4 flex items-center gap-2 rounded-xl border bg-card px-3 shadow-sm">
        <Search size={18} className="shrink-0 text-muted-foreground"/>
        <input aria-label="Buscar configuração" type="search" placeholder="Buscar configuração, documento, agenda, equipe..." value={busca} onChange={(e) => setBusca(e.target.value)}
          className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"/>
        {busca && <button type="button" onClick={() => setBusca("")} className="text-xs font-medium text-primary">Limpar</button>}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
        <nav aria-label="Categorias de configurações" className="rounded-xl border bg-card p-2 lg:sticky lg:top-4">
          <p className="px-3 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Categorias</p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {gruposVisiveis.map((grupo) => {
              const Icone = grupo.icone;
              return <button key={grupo.id} type="button" onClick={() => { setGrupoAtivo(grupo.id); setBusca(""); }}
                aria-current={!termoBusca && grupoAtivo === grupo.id ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors sm:text-sm ${!termoBusca && grupoAtivo === grupo.id ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}>
                <Icone size={17} className="shrink-0"/><span className="min-w-0 flex-1">{grupo.titulo}</span><ChevronRight size={14} className="hidden shrink-0 lg:block"/>
              </button>;
            })}
          </div>
        </nav>

        <div className="min-w-0 space-y-4">
          {gruposConteudo.map((grupo) => {
            const Icone = grupo.icone;
            const itensVisiveis = termoBusca && !grupo.titulo.toLocaleLowerCase("pt-BR").includes(termoBusca)
              ? grupo.itens.filter((item) => (item.nome + " " + item.descricao).toLocaleLowerCase("pt-BR").includes(termoBusca))
              : grupo.itens;
            return <section key={grupo.id} className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center gap-3 border-b pb-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icone size={19}/></span>
                <div><h2 className="text-base font-semibold text-foreground sm:text-lg">{grupo.titulo}</h2><p className="text-xs text-muted-foreground">Escolha o que deseja configurar.</p></div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {itensVisiveis.map((item) => {
                  const isAgenda = "especial" in item && item.especial === "agenda";
                  const isPoliticas = "especial" in item && item.especial === "politicas" && (adminGeral || perfil?.papel === "rt" || perfil?.papel === "admin_clinica");
                  const isModelos = "especial" in item && item.especial === "modelos" && (adminGeral || perfil?.papel === "rt" || perfil?.papel === "admin_clinica");
                  const destination = "href" in item ? item.href : undefined;
                  const corpo = <><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-foreground">{item.nome}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{item.descricao}</span></span>
                    {destination ? <ChevronRight size={17} className="shrink-0 text-muted-foreground"/> : (isAgenda || isModelos || isPoliticas) ? <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">Nesta página</span> : <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">Em preparação</span>}</>;
                  return destination && item.nome === "Meu plano e funcionalidades" ? <Link key={item.nome} to="/plano-clinica" className="flex min-h-20 items-center gap-2 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40">{corpo}</Link> : destination ? <Link key={item.nome} to={destination as any} className="flex min-h-20 items-center gap-2 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40">{corpo}</Link>
                    : <div key={item.nome} className="flex min-h-20 items-center gap-2 rounded-lg border p-3">{corpo}</div>;
                })}
              </div>

              {(["estrutura","operacao","comunicacao"].includes(grupo.id)) && !termoBusca && (adminGeral || perfil?.papel === "rt" || perfil?.papel === "admin_clinica") && (
                <ConfiguracaoPoliticasClinica grupo={grupo.id as "estrutura"|"operacao"|"comunicacao"} podeGerenciar={true}/>
              )}
              {grupo.id === "documentos" && !termoBusca && (adminGeral || perfil?.papel === "rt" || perfil?.papel === "admin_clinica") && (
                <ConfiguracaoModelosDocumentos clinica={perfil?.nome || "clínica"} podeGerenciar={Boolean(adminGeral || perfil?.papel === "rt" || perfil?.papel === "admin_clinica")}/>
              )}
              {grupo.id === "operacao" && (!termoBusca || "agenda e atendimentos intervalos e duração de procedimentos".includes(termoBusca)) && <div className="mt-5 rounded-xl border bg-background p-4 sm:p-5">
                <div className="mb-4 flex items-start gap-2"><CalendarDays size={20} className="mt-0.5 text-primary"/><div><h3 className="font-semibold">Intervalos da agenda</h3><p className="text-xs leading-relaxed text-muted-foreground">Defina a distância entre os horários e quanto tempo cada serviço ocupa.</p></div></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium">Intervalo da grade
                    <select value={opcaoSelecionada} disabled={!podeEditar} onChange={(e) => { if(e.target.value !== "personalizado") setIntervalo(Number(e.target.value)); else if (OPCOES_INTERVALO.includes(intervalo)) setIntervalo(25); }}
                      className="mt-1 min-h-11 w-full rounded-lg border bg-card px-3 font-normal">
                      {OPCOES_INTERVALO.map((min) => <option key={min} value={min}>{min} minutos</option>)}<option value="personalizado">Personalizado</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium">Minutos
                    <input type="number" min={5} max={720} step={5} value={intervalo} disabled={!podeEditar} onChange={(e) => setIntervalo(Number(e.target.value))}
                      className="mt-1 min-h-11 w-full rounded-lg border bg-card px-3 font-normal"/>
                  </label>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Exemplo: 8h00 → {formatarExemplo(8 * 60 + (intervalo || 30))} → {formatarExemplo(8 * 60 + 2 * (intervalo || 30))}</p>
                <div className="mt-5 border-t pt-4">
                  <h3 className="mb-1 text-sm font-semibold">Duração por atendimento</h3>
                  <p className="mb-3 text-xs text-muted-foreground">O horário permanece ocupado durante o período definido.</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {TIPOS.map((tipo) => <label key={tipo} className="flex min-h-12 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"><span>{tipo}</span>
                      <span className="flex items-center gap-1"><input aria-label={`Duração de ${tipo} em minutos`} type="number" min={5} max={720} step={5} value={duracoes[tipo] ?? 30} disabled={!podeEditar} onChange={(e) => alterarDuracao(tipo, Number(e.target.value))}
                        className="h-9 w-20 rounded-md border bg-card px-2 text-right font-medium"/><span className="text-xs text-muted-foreground">min</span></span>
                    </label>)}
                  </div>
                </div>
                {!podeEditar && <p className="mt-3 flex items-center gap-2 text-xs text-amber-700"><LockKeyhole size={14}/> Seu perfil possui acesso somente à visualização.</p>}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <span className="text-xs text-muted-foreground">{pendente ? "Alterações ainda não salvas." : "Configurações atualizadas."}</span>
                  <button type="button" disabled={!podeEditar || salvando || !pendente} onClick={salvar}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
                    <Save size={16}/>{salvando ? "Salvando..." : "Salvar agenda"}
                  </button>
                </div>
              </div>}
            </section>;
          })}
          {gruposVisiveis.length === 0 && <div className="rounded-xl border bg-card p-8 text-center"><AlertCircle className="mx-auto mb-2 text-muted-foreground"/><h2 className="font-semibold">Nenhuma configuração encontrada</h2><p className="mt-1 text-sm text-muted-foreground">Experimente outra palavra.</p></div>}
          <p className="px-1 text-xs text-muted-foreground">Os recursos marcados como “Em preparação” fazem parte da evolução planejada e ainda não possuem configuração disponível nesta tela.</p>
        </div>
      </div>
    </main>
  );
}

function formatarExemplo(total: number) {
  const minutosDia = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(minutosDia / 60);
  const m = minutosDia % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

