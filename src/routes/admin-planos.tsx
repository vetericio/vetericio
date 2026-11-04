import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, LockKeyhole, Save, ShieldCheck, Users, Search, RotateCcw, GitCompare, Plus, Eye, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase, supabaseBanco } from "@/integrations/supabase/client";
import { BENEFICIOS_ORICSE, NIVEIS_PLANOS, permitidoNoNivel } from "@/lib/beneficios-oricse";

export const Route = createFileRoute("/admin-planos")({ component: AdminPlanos });

type Plano = {
  id: string;
  codigo: string;
  nome: string;
  publico_alvo: string;
  preco: string;
  preco_mensal: string;
  preco_trimestral: string;
  preco_semestral: string;
  preco_anual: string;
  preco_bienal: string;
  descricao: string;
  itens: string[];
  usuarios_inclusos: number;
  limite_animais: number | null;
  dominio_incluso: boolean;
  ativo: boolean;
  ordem: number;
};

type Funcionalidade = {
  codigo: string;
  nome: string;
  grupo: string;
  ordem: number;
};
type PermissaoCatalogada = {
  codigo: string;
  nome: string;
  grupo: string;
  descricao: string;
  funcionalidade_codigo: string | null;
  ordem: number;
};
type ItemCatalogo = Funcionalidade & {
  tipo: "modulo" | "acao" | "beneficio";
  descricao: string;
  pai: string | null;
  catalogada: boolean;
};
type HistoricoAlteracao = {
  id: string;
  usuario_id: string;
  data: string;
  tipo: string;
  alteracoes: Array<{ plano_id: string; codigo: string; permitido: boolean }>;
};

type Clinica = {
  id: string;
  nome: string;
  plano: string;
  status: string;
  limite_usuarios: number | null;
};

type Excecao = {
  id: string;
  clinica_id: string;
  funcionalidade_codigo: string;
  permitido: boolean;
  motivo: string;
  expira_em: string | null;
};

type Matriz = Record<string, Record<string, boolean>>;

type ModoExcecao = "plano" | "liberar" | "bloquear";

function AdminPlanos() {
  const navigate = useNavigate();
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [funcionalidades, setFuncionalidades] = useState<Funcionalidade[]>([]);
  const [permissoesCatalogadas, setPermissoesCatalogadas] = useState<PermissaoCatalogada[]>([]);
  const [historico, setHistorico] = useState<HistoricoAlteracao[]>([]);
  const [alteracoesPendentes, setAlteracoesPendentes] = useState<Record<string, boolean>>({});
  const [busca, setBusca] = useState("");
  const [areaCatalogo, setAreaCatalogo] = useState<"beneficios" | "tecnico">("beneficios");
  const [buscaClinica, setBuscaClinica] = useState("");
  const [grupoFiltro, setGrupoFiltro] = useState("todos");
  const [apenasDiferencas, setApenasDiferencas] = useState(false);
  const [apenasPendentes, setApenasPendentes] = useState(false);
  const [gruposFechados, setGruposFechados] = useState<Record<string, boolean>>({});
  const [planoSimulado, setPlanoSimulado] = useState("");
  const [novoPlanoAberto, setNovoPlanoAberto] = useState(false);
  const [novoPlanoNome, setNovoPlanoNome] = useState("");
  const [novoPlanoCodigo, setNovoPlanoCodigo] = useState("");
  const [matriz, setMatriz] = useState<Matriz>({});
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [excecoes, setExcecoes] = useState<Excecao[]>([]);
  const [clinicaSelecionada, setClinicaSelecionada] = useState("");
  const [salvando, setSalvando] = useState<string | null>(null);
  const [usuarioAtual, setUsuarioAtual] = useState("");

  async function carregar() {
    setCarregando(true);
    try {
      const { data: sessao } = await supabase.auth.getSession();
      const userId = sessao.session?.user?.id;
      if (!userId) {
        setAutorizado(false);
        void navigate({ to: "/login" });
        return;
      }
      setUsuarioAtual(userId);

      const { data: perfil, error: erroPerfil } = await (supabase as any)
        .from("app_users")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      if (erroPerfil) throw erroPerfil;
      if (perfil?.role !== "admin") {
        setAutorizado(false);
        toast.error("Somente o Admin da plataforma pode alterar planos.");
        void navigate({ to: "/inicio" });
        return;
      }
      setAutorizado(true);

      const [planosRes, funcoesRes, matrizRes, clinicasRes, excecoesRes, permissoesRes, auditoriaRes, cotasRes] = await Promise.all([
        (supabase as any).from("oricse_planos").select("*").order("ordem"),
        (supabase as any).from("oricse_funcionalidades").select("codigo,nome,grupo,ordem").eq("ativo", true).order("ordem"),
        (supabase as any).from("oricse_plano_funcionalidades").select("plano_id,funcionalidade_codigo,permitido"),
        (supabase as any).from("clinicas").select("id,nome,plano,status,limite_usuarios").order("nome"),
        (supabase as any).from("oricse_clinica_funcionalidade_excecoes").select("id,clinica_id,funcionalidade_codigo,permitido,motivo,expira_em"),
        (supabase as any).from("oricse_permissoes").select("codigo,nome,grupo,descricao,funcionalidade_codigo,ordem").eq("ativo",true).order("ordem"),
        (supabase as any).from("oricse_planos_auditoria").select("id,usuario_id,data,tipo,alteracoes").order("data",{ascending:false}).limit(40),
        (supabaseBanco as any).from("oricse_planos_limites").select("plano_codigo,limite_animais"),
      ]);
      for (const resposta of [planosRes, funcoesRes, matrizRes, clinicasRes, excecoesRes, permissoesRes, auditoriaRes, cotasRes]) {
        if (resposta.error) throw resposta.error;
      }

      const cotas = new Map<string, number | null>(
        (cotasRes.data || []).map((c: any) => [String(c.plano_codigo), c.limite_animais == null ? null : Number(c.limite_animais)]),
      );
      const planosDados = (planosRes.data || []).map((p: any) => ({
        ...p,
        itens: Array.isArray(p.itens) ? p.itens : [],
        limite_animais: cotas.get(String(p.codigo)) ?? null,
      })) as Plano[];
      const mapa: Matriz = {};
      for (const item of matrizRes.data || []) {
        (mapa[item.plano_id] ??= {})[item.funcionalidade_codigo] = Boolean(item.permitido);
      }
      setPlanos(planosDados);
      const recebidas = (funcoesRes.data || []) as Funcionalidade[];
      const codigosRecebidos = new Set(recebidas.map((f) => f.codigo));
      // Fonte canônica de fallback para snapshots antigos no Drive.
      const todosRecursos = [...recebidas, ...BENEFICIOS_ORICSE.filter((b) => !codigosRecebidos.has(b.codigo))];
      setFuncionalidades(todosRecursos as Funcionalidade[]);
      setPermissoesCatalogadas((permissoesRes.data || []) as PermissaoCatalogada[]);
      setHistorico((auditoriaRes.data || []) as HistoricoAlteracao[]);
      setAlteracoesPendentes({});
      setMatriz(mapa);
      setClinicas((clinicasRes.data || []) as Clinica[]);
      setExcecoes((excecoesRes.data || []) as Excecao[]);
      const primeira = clinicasRes.data?.[0]?.id || "";
      setClinicaSelecionada((atual) => atual || primeira);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar os planos.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  // Une módulos cadastrados às operações reais utilizadas pelos cargos.
  const planosVisiveis = planos.filter((p) => p.codigo.endsWith("-2026"));
  const catalogo = useMemo<ItemCatalogo[]>(() => {
    const codigos = new Set(funcionalidades.map((f) => f.codigo));
    const modulos: ItemCatalogo[] = funcionalidades
      .filter((f) => !f.codigo.startsWith("acao."))
      .map((f) => ({ ...f, tipo: f.codigo.startsWith("beneficio.") ? "beneficio" : "modulo", descricao: f.codigo.startsWith("beneficio.") ? "Benefício comercial específico do plano; sua funcionalidade também depende das permissões técnicas." : "Acesso geral ao módulo.", pai: null, catalogada: true } as ItemCatalogo));
    const acoes: ItemCatalogo[] = permissoesCatalogadas.map((p) => ({
      codigo: "acao." + p.codigo, nome: p.nome, grupo: p.grupo,
      ordem: p.ordem * 10 + 1, descricao: p.descricao,
      pai: p.funcionalidade_codigo, tipo: "acao",
      catalogada: codigos.has("acao." + p.codigo),
    }));
    return [...modulos, ...acoes].sort((a, b) => a.grupo.localeCompare(b.grupo, "pt-BR") || a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [funcionalidades, permissoesCatalogadas]);

  function valorPlano(planoId: string, item: ItemCatalogo): boolean {
    const linha = matriz[planoId];
    // A ação nunca supera o bloqueio do módulo-pai.
    if (item.tipo === "acao" && item.pai && !linha?.[item.pai]) return false;
    if (Object.prototype.hasOwnProperty.call(linha || {}, item.codigo)) return Boolean(linha?.[item.codigo]);
    // A configuração persistida prevalece; sem ela, mostrar a proposta aprovada.
    if (item.tipo === "beneficio") {
      const plano = planos.find((p) => p.id === planoId);
      return plano ? permitidoNoNivel(item.codigo, NIVEIS_PLANOS.indexOf(plano.codigo as any)) : false;
    }
    // Permissões preexistentes não são alteradas antes de decisão do administrador.
    return item.tipo === "acao" && item.catalogada;
  }

  const visiveis = useMemo(() => {
    const texto = busca.trim().toLocaleLowerCase("pt-BR");
    return catalogo.filter((f) =>
      (f.tipo === "beneficio") === (areaCatalogo === "beneficios")
      && (grupoFiltro === "todos" || f.grupo === grupoFiltro)
      && (!apenasPendentes || !f.catalogada || planos.some((p) => matriz[p.id]?.[f.codigo] === undefined))
      && (!apenasDiferencas || new Set(planos.map((p) => valorPlano(p.id, f))).size > 1)
      && (!texto || [f.nome, f.descricao, f.codigo, f.grupo].some((v) => v.toLocaleLowerCase("pt-BR").includes(texto)))
    );
  }, [catalogo, busca, grupoFiltro, areaCatalogo, apenasPendentes, apenasDiferencas, planos, matriz]);
  const grupos = useMemo(() => {
    const mapa = new Map<string, ItemCatalogo[]>();
    for (const item of visiveis) {
      const lista = mapa.get(item.grupo) || [];
      lista.push(item);
      mapa.set(item.grupo, lista);
    }
    return [...mapa.entries()];
  }, [visiveis]);

  const chavesPendentes = Object.keys(alteracoesPendentes);
  const quantidadePendentes = catalogo.filter((f) => !f.catalogada
    || planos.some((p) => matriz[p.id]?.[f.codigo] === undefined)).length;

  const clinicaAtual = clinicas.find((c) => c.id === clinicaSelecionada) || null;

  function alterarPlano(id: string, campo: keyof Plano, valor: unknown) {
    setPlanos((lista) => lista.map((p) => p.id === id ? { ...p, [campo]: valor } as Plano : p));
  }

  // A matriz do Admin Geral nunca desabilita controles comerciais.
  function aplicarMudancas(planoId: string, codigos: string[], permitido: boolean) {
    const unicos = [...new Set(codigos)];
    setMatriz((atual) => ({
      ...atual,
      [planoId]: {
        ...(atual[planoId] || {}),
        ...Object.fromEntries(unicos.map((codigo) => [codigo, permitido])),
      },
    }));
    setAlteracoesPendentes((atual) => ({
      ...atual,
      ...Object.fromEntries(unicos.map((codigo) => [planoId + ":" + codigo, true])),
    }));
  }

  function alterarFuncionalidade(planoId: string, codigo: string, permitido: boolean) {
    const item = catalogo.find((f) => f.codigo === codigo);
    const pai = permitido && item?.tipo === "acao" && item.pai && !matriz[planoId]?.[item.pai]
      ? item.pai : null;
    if (pai) {
      const plano = planos.find((p) => p.id === planoId)?.nome || "selecionado";
      if (!window.confirm(
        "Este módulo está bloqueado na venda. Deseja desbloquear?\n\n" +
        "Plano: " + plano + "\nMódulo: " +
        (catalogo.find((f) => f.codigo === pai)?.nome || pai) +
        "\n\nIsso liberará o módulo e a ação selecionada para todas as clínicas deste plano. " +
        "A alteração só será aplicada depois de clicar em Salvar alterações.",
      )) return;
    }
    aplicarMudancas(planoId, pai ? [pai, codigo] : [codigo], permitido);
  }

  function alterarGrupo(planoId: string, itens: ItemCatalogo[], permitir: boolean) {
    const plano = planos.find((p) => p.id === planoId)?.nome || "selecionado";
    if (!window.confirm((permitir ? "Liberar" : "Bloquear") + " " + itens.length +
      " recursos deste grupo no plano " + plano + "?")) return;
    const paisBloqueados = permitir
      ? [...new Set(itens.filter((item) => item.tipo === "acao" && item.pai &&
        !matriz[planoId]?.[item.pai]).map((item) => item.pai as string))]
      : [];
    if (paisBloqueados.length && !window.confirm(
      "Estes módulos estão bloqueados na venda. Deseja desbloquear?\n\n" +
      paisBloqueados.map((codigo) => "• " + (catalogo.find((f) => f.codigo === codigo)?.nome || codigo)).join("\n") +
      "\n\nA alteração valerá para todas as clínicas do plano " + plano +
      " após salvar. Você pode cancelar sem modificar nada.",
    )) return;
    aplicarMudancas(planoId, [...itens.map((item) => item.codigo), ...paisBloqueados], permitir);
  }

  async function salvarMatriz() {
    if (!chavesPendentes.length) return void toast.info("Nenhuma alteração de acesso pendente.");
    setSalvando("matriz");
    try {
      const mudancas = catalogo.flatMap((item) => planos.filter((p) => alteracoesPendentes[p.id + ":" + item.codigo])
        .map((p) => ({ plano_id: p.id, funcionalidade_codigo: item.codigo, permitido: valorPlano(p.id, item) })));
      if (mudancas.length !== chavesPendentes.length) throw new Error("O catálogo mudou. Atualize antes de salvar.");
      const novasAcoes = catalogo.filter((f) => !f.catalogada && mudancas.some((m) => m.funcionalidade_codigo === f.codigo));
      if (novasAcoes.length) {
        const { error } = await (supabase as any).from("oricse_funcionalidades")
          .upsert(novasAcoes.map((f) => ({ codigo: f.codigo, nome: f.nome, grupo: f.grupo, ordem: f.ordem, ativo: true })), { onConflict: "codigo" });
        if (error) throw error;
      }
      const { error } = await (supabase as any).from("oricse_plano_funcionalidades")
        .upsert(mudancas, { onConflict: "plano_id,funcionalidade_codigo" });
      if (error) throw error;
      const { error: auditoriaError } = await (supabase as any).from("oricse_planos_auditoria").insert({
        id: crypto.randomUUID(), usuario_id: usuarioAtual, data: new Date().toISOString(),
        tipo: "matriz", alteracoes: mudancas.map(({ plano_id, funcionalidade_codigo, permitido }) => ({
          plano_id, codigo: funcionalidade_codigo, permitido,
        })),
      });
      if (auditoriaError) toast.warning("Permissões salvas, mas o histórico não pôde ser registrado.");
      else toast.success(mudancas.length + " alterações de planos salvas.");
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar os controles de acesso.");
    } finally { setSalvando(null); }
  }

  async function criarPlano() {
    const nome = novoPlanoNome.trim();
    const codigo = novoPlanoCodigo.trim().toLowerCase();
    if (nome.length < 3 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(codigo)) {
      return void toast.error("Informe um nome e um código válido (letras, números e hífens).");
    }
    if (planos.some((p) => p.codigo === codigo)) return void toast.error("Já existe um plano com esse código.");
    setSalvando("novo-plano");
    try {
      const { error } = await (supabase as any).from("oricse_planos").insert({
        id: crypto.randomUUID(), nome, codigo, ativo: false, ordem: planos.length + 1,
        preco: "", preco_mensal: "", preco_trimestral: "", preco_semestral: "", preco_anual: "", preco_bienal: "", publico_alvo: "",
        descricao: "", itens: [], usuarios_inclusos: 1, dominio_incluso: false,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setNovoPlanoAberto(false); setNovoPlanoNome(""); setNovoPlanoCodigo("");
      toast.success("Plano criado inativo. Configure os acessos antes de ativá-lo.");
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o plano.");
    } finally { setSalvando(null); }
  }

  async function salvarPlano(plano: Plano) {
    setSalvando(`plano:${plano.id}`);
    try {
      const limite = plano.limite_animais;
      if (limite !== null && (!Number.isInteger(limite) || limite < 1 || limite > 1000000)) {
        throw new Error("Informe uma quantidade de 1 a 1.000.000 de animais ou escolha Ilimitado.");
      }
      const { error } = await (supabase as any)
        .from("oricse_planos")
        .update({
          nome: plano.nome.trim(),
          publico_alvo: plano.publico_alvo,
          preco: plano.preco,
          preco_mensal: plano.preco_mensal,
          preco_trimestral: plano.preco_trimestral,
          preco_semestral: plano.preco_semestral,
          preco_anual: plano.preco_anual,
          preco_bienal: plano.preco_bienal,
          descricao: plano.descricao,
          itens: plano.itens,
          usuarios_inclusos: Math.max(1, Number(plano.usuarios_inclusos) || 1),
          dominio_incluso: plano.dominio_incluso,
          ativo: plano.ativo,
          updated_at: new Date().toISOString(),
        })
        .eq("id", plano.id);
      if (error) throw error;

      // O checkout do Mercado Pago consulta o catálogo no PostgreSQL.
      // Mantém preço, descrição, ativação e usuários sincronizados com o Admin,
      // mas somente para os novos planos — contratos antigos ficam intactos.
      if (plano.codigo.endsWith("-2026")) {
        const { error: erroCheckout } = await (supabaseBanco as any)
          .from("oricse_planos")
          .update({
            nome: plano.nome.trim(),
            publico_alvo: plano.publico_alvo,
            descricao: plano.descricao,
            preco: plano.preco_mensal,
            preco_mensal: plano.preco_mensal,
            preco_trimestral: plano.preco_trimestral,
            preco_semestral: plano.preco_semestral,
            preco_anual: plano.preco_anual,
            preco_bienal: plano.preco_bienal,
            itens: plano.itens,
            usuarios_inclusos: Math.max(1, Number(plano.usuarios_inclusos) || 1),
            dominio_incluso: plano.dominio_incluso,
            ativo: plano.ativo,
            updated_at: new Date().toISOString(),
          })
          .eq("codigo", plano.codigo);
        if (erroCheckout) throw new Error("Plano salvo, mas o checkout não foi sincronizado: "+erroCheckout.message);
      }

      // Cotas têm uma única fonte de verdade no PostgreSQL. A regra do banco
      // bloqueia criação acima do limite para todos os funcionários da clínica.
      const { error: erroCota } = await (supabaseBanco as any)
        .from("oricse_planos_limites")
        .upsert({
          plano_codigo: plano.codigo,
          plano_nome: plano.nome.trim(),
          limite_animais: limite,
          atualizado_em: new Date().toISOString(),
        }, { onConflict: "plano_codigo" });
      if (erroCota) throw new Error("Dados comerciais salvos, mas o limite de animais não foi atualizado: " + erroCota.message);
      toast.success(`${plano.nome} e seu limite coletivo de animais foram salvos.`);
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o plano.");
    } finally {
      setSalvando(null);
    }
  }

  function modoExcecao(codigo: string): ModoExcecao {
    const item = excecoes.find((e) => e.clinica_id === clinicaSelecionada && e.funcionalidade_codigo === codigo);
    if (!item) return "plano";
    return item.permitido ? "liberar" : "bloquear";
  }

  async function mudarExcecao(codigo: string, modo: ModoExcecao) {
    if (!clinicaSelecionada) return;
    setSalvando(`excecao:${codigo}`);
    try {
      if (modo === "plano") {
        const { error } = await (supabase as any)
          .from("oricse_clinica_funcionalidade_excecoes")
          .delete()
          .eq("clinica_id", clinicaSelecionada)
          .eq("funcionalidade_codigo", codigo);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("oricse_clinica_funcionalidade_excecoes")
          .upsert({
            clinica_id: clinicaSelecionada,
            funcionalidade_codigo: codigo,
            permitido: modo === "liberar",
            motivo: "Exceção configurada pelo Admin ORICSE",
            criado_por: usuarioAtual || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "clinica_id,funcionalidade_codigo" });
        if (error) throw error;
      }
      const { data, error } = await (supabase as any)
        .from("oricse_clinica_funcionalidade_excecoes")
        .select("id,clinica_id,funcionalidade_codigo,permitido,motivo,expira_em");
      if (error) throw error;
      setExcecoes((data || []) as Excecao[]);
      toast.success(modo === "plano" ? "A clínica voltou a seguir o plano." : "Exceção salva para esta clínica.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível alterar a exceção.");
    } finally {
      setSalvando(null);
    }
  }

  async function salvarLimiteClinica() {
    if (!clinicaAtual) return;
    setSalvando("limite-clinica");
    try {
      const limite = Math.max(1, Number(clinicaAtual.limite_usuarios) || 1);
      const { error } = await (supabase as any)
        .from("clinicas")
        .update({ limite_usuarios: limite, updated_at: new Date().toISOString() })
        .eq("id", clinicaAtual.id);
      if (error) throw error;
      toast.success("Limite de usuários da clínica atualizado.");
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível alterar o limite.");
    } finally {
      setSalvando(null);
    }
  }

  if (carregando || autorizado === null) {
    return <main className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">Carregando planos e acessos...</main>;
  }
  if (!autorizado) return null;

  return <main className="min-h-screen bg-background px-4 py-6 sm:px-6">
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary"><ArrowLeft size={18}/> Admin ORICSE</Link>
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-bold text-primary"><ShieldCheck size={15}/> Controle central de planos</div>
      </div>

      <h1 className="mt-6 text-3xl font-black tracking-tight">Planos e funcionalidades</h1>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border bg-secondary/30 p-3 text-xs"><span className="font-bold">98 benefícios comerciais configuráveis</span><span className="text-muted-foreground">Quatro planos vigentes com regras individuais por clínica.</span></div>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">O plano define o teto de acesso da clínica. O cargo e a permissão individual só funcionam dentro do que o plano libera. Exceções por clínica são controladas exclusivamente pelo Admin ORICSE.</p>

      <section className="mt-6 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Catálogo de benefícios e permissões</h2>
            <p className="mt-1 text-sm text-muted-foreground">Cada um dos 98 benefícios pode ser liberado ou bloqueado por plano. A aba técnica mantém os acessos reais dos módulos e ações.</p>
          </div>
          <button type="button" onClick={() => setNovoPlanoAberto((v) => !v)}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-bold">
            <Plus size={16}/> Criar plano
          </button>
        </div>

        {novoPlanoAberto && <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border p-3">
          <Campo rotulo="Nome do novo plano" valor={novoPlanoNome} onChange={setNovoPlanoNome}/>
          <Campo rotulo="Código (sem espaços)" valor={novoPlanoCodigo} onChange={setNovoPlanoCodigo}/>
          <button type="button" disabled={salvando === "novo-plano"} onClick={() => void criarPlano()}
            className="min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
            Criar plano inativo
          </button>
        </div>}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border p-3"><strong className="text-2xl">{catalogo.filter((f)=>f.tipo==="beneficio").length}</strong><p className="text-xs text-muted-foreground">Benefícios comerciais configuráveis</p></div>
          <div className="rounded-xl border p-3"><strong className="text-2xl">{quantidadePendentes}</strong><p className="text-xs text-muted-foreground">Aguardando classificação completa</p></div>
          <div className="rounded-xl border p-3"><strong className="text-2xl">{chavesPendentes.length}</strong><p className="text-xs text-muted-foreground">Alterações não salvas</p></div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Tipo de controle de acesso">
          <button type="button" onClick={()=>{setAreaCatalogo("beneficios");setGrupoFiltro("todos")}}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold ${areaCatalogo==="beneficios"?"bg-primary text-primary-foreground":"border bg-background"}`}>
            98 benefícios
          </button>
          <button type="button" onClick={()=>{setAreaCatalogo("tecnico");setGrupoFiltro("todos")}}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold ${areaCatalogo==="tecnico"?"bg-primary text-primary-foreground":"border bg-background"}`}>
            Permissões técnicas dos módulos
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[210px] flex-[2_1_280px]">
            <Search size={16} className="absolute left-3 top-3 text-muted-foreground"/>
            <input value={busca} onChange={(e) => setBusca(e.target.value)}
              aria-label="Pesquisar funcionalidades" placeholder="Pesquisar nome, código ou descrição"
              className="min-h-11 w-full rounded-xl border bg-background pl-10 pr-3 text-sm"/>
          </div>
          <select aria-label="Filtrar grupo" value={grupoFiltro} onChange={(e) => setGrupoFiltro(e.target.value)}
            className="min-h-11 max-w-full rounded-xl border bg-background px-3 text-sm">
            <option value="todos">Todos os grupos</option>
            {[...new Set(catalogo.filter((f)=>(f.tipo==="beneficio")===(areaCatalogo==="beneficios")).map((f) => f.grupo))].map((grupo) => <option key={grupo} value={grupo}>{grupo}</option>)}
          </select>
          <label className="inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold">
            <input type="checkbox" checked={apenasDiferencas} onChange={(e)=>setApenasDiferencas(e.target.checked)}/>
            <GitCompare size={15}/> Só diferenças
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold">
            <input type="checkbox" checked={apenasPendentes} onChange={(e)=>setApenasPendentes(e.target.checked)}/>
            <SlidersHorizontal size={15}/> Pendentes
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Todos os controles estão disponíveis para o Admin. Ao tentar liberar uma ação de módulo bloqueado na venda, você decide se deseja desbloquear a oferta comercial para o plano.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => { if (chavesPendentes.length && !window.confirm("Descartar mudanças ainda não salvas?")) return; void carregar(); }}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold">
              <RotateCcw size={15}/> Descartar
            </button>
            <button type="button" disabled={!chavesPendentes.length || salvando === "matriz"}
              onClick={() => void salvarMatriz()}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
              <Save size={16}/> {salvando === "matriz" ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </div>

        <div className="mt-4 max-w-full overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[670px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-secondary">
              <tr>
                <th className="sticky left-0 z-20 min-w-[240px] border-b bg-secondary px-3 py-3">Funcionalidade / ação</th>
                {planosVisiveis.map((p) => <th key={p.id} className="min-w-[125px] border-b px-3 py-3 text-center">
                  <span className="block font-black">{p.nome}</span>
                  <span className="text-[10px] font-normal text-muted-foreground">
                    {catalogo.filter((f)=>valorPlano(p.id,f)).length} liberadas
                  </span>
                </th>)}
              </tr>
            </thead>
            <tbody>
              {grupos.map(([grupo,itens]) => <FragmentoGrupo key={grupo} grupo={grupo} itens={itens}
                fechado={Boolean(gruposFechados[grupo])}
                onToggle={()=>setGruposFechados((atual)=>({...atual,[grupo]:!atual[grupo]}))}
                planos={planosVisiveis} matriz={matriz} valorPlano={valorPlano}
                alterarFuncionalidade={alterarFuncionalidade} alterarGrupo={alterarGrupo}/>)}
              {visiveis.length===0 && <tr><td colSpan={planosVisiveis.length+1} className="p-6 text-center text-muted-foreground">Nenhum recurso encontrado com estes filtros.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border p-4">
            <h3 className="flex items-center gap-2 font-bold"><Eye size={17}/> Visualizar como clínica</h3>
            <p className="mt-1 text-xs text-muted-foreground">Prévia somente de leitura; não altera acessos de usuários.</p>
            <select value={planoSimulado} onChange={(e)=>setPlanoSimulado(e.target.value)} className="mt-3 min-h-10 w-full rounded-lg border bg-background px-3 text-sm">
              <option value="">Selecionar plano</option>
              {planosVisiveis.map((p)=><option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            {planoSimulado && <div className="mt-3 max-h-36 overflow-y-auto text-xs">
              {catalogo.filter((f)=>valorPlano(planoSimulado,f)).map((f)=><div key={f.codigo} className="py-1">✓ {f.grupo} · {f.nome}</div>)}
            </div>}
          </div>
          <div className="rounded-xl border p-4">
            <h3 className="font-bold">Histórico de alterações</h3>
            <p className="mt-1 text-xs text-muted-foreground">Últimas decisões registradas pelo administrador.</p>
            <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
              {historico.length===0 && <p className="text-xs text-muted-foreground">Nenhuma alteração registrada ainda.</p>}
              {historico.map((h)=><div key={h.id} className="rounded-lg bg-secondary/40 p-2 text-xs">
                <span className="font-bold">{new Date(h.data).toLocaleString("pt-BR")}</span>
                <span className="ml-2">{h.alteracoes?.length || 0} decisões</span>
                <p className="mt-1 text-muted-foreground">Administrador: {h.usuario_id}</p>
              </div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-7 space-y-5">
        {planosVisiveis.map((plano) => {
          const liberadas = funcionalidades.filter((f) => matriz[plano.id]?.[f.codigo]).length;
          return <article key={plano.id} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black">{plano.nome}</h2><span className="rounded-full bg-secondary px-2 py-1 text-[11px] font-bold">{liberadas}/{funcionalidades.length} funções</span></div>
                <p className="mt-1 text-xs text-muted-foreground">Código interno: {plano.codigo}</p>
              </div>
              <button type="button" disabled={salvando === `plano:${plano.id}`} onClick={() => void salvarPlano(plano)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"><Save size={16}/>{salvando === `plano:${plano.id}` ? "Salvando..." : "Salvar plano"}</button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Campo rotulo="Nome" valor={plano.nome} onChange={(v) => alterarPlano(plano.id,"nome",v)}/>
              <Campo rotulo="Público-alvo" valor={plano.publico_alvo} onChange={(v) => alterarPlano(plano.id,"publico_alvo",v)}/>
              <Campo rotulo="Mensal" valor={plano.preco_mensal} onChange={(v) => alterarPlano(plano.id,"preco_mensal",v)}/>
              <Campo rotulo="Trimestral" valor={plano.preco_trimestral} onChange={(v) => alterarPlano(plano.id,"preco_trimestral",v)}/>
              <Campo rotulo="Semestral" valor={plano.preco_semestral} onChange={(v) => alterarPlano(plano.id,"preco_semestral",v)}/>
              <Campo rotulo="Anual · 365 dias" valor={plano.preco_anual} onChange={(v) => alterarPlano(plano.id,"preco_anual",v)}/>
              <Campo rotulo="Dois anos" valor={plano.preco_bienal} onChange={(v) => alterarPlano(plano.id,"preco_bienal",v)}/>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_180px_180px]">
              <label className="text-xs font-bold">Descrição<textarea rows={3} value={plano.descricao} onChange={(e) => alterarPlano(plano.id,"descricao",e.target.value)} className="mt-1 w-full rounded-xl border bg-background p-3 text-sm font-normal"/></label>
              <label className="text-xs font-bold">Usuários incluídos<div className="mt-1 flex h-[74px] items-center rounded-xl border bg-background px-3"><Users size={17} className="mr-2 text-muted-foreground"/><input type="number" min={1} value={plano.usuarios_inclusos} onChange={(e) => alterarPlano(plano.id,"usuarios_inclusos",Math.max(1,Number(e.target.value)||1))} className="w-full bg-transparent text-sm outline-none"/></div></label>
              <div className="text-xs font-bold">Opções<div className="mt-1 flex h-[74px] flex-col justify-center gap-2 rounded-xl border bg-background px-3 text-sm font-normal"><label className="flex items-center gap-2"><input type="checkbox" checked={plano.dominio_incluso} onChange={(e)=>alterarPlano(plano.id,"dominio_incluso",e.target.checked)}/> Domínio incluído</label><label className="flex items-center gap-2"><input type="checkbox" checked={plano.ativo} onChange={(e)=>alterarPlano(plano.id,"ativo",e.target.checked)}/> Plano ativo</label></div></div>
            </div>
            <section className="mt-4 rounded-xl border bg-secondary/20 p-4">
              <h3 className="text-sm font-bold">Limite de animais do plano</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                É um limite único por clínica: todos os funcionários compartilham a mesma quantidade.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className={`min-w-0 rounded-xl border-2 p-3 transition-colors ${plano.limite_animais !== null ? "border-primary bg-background" : "border-border bg-card"}`}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
                    <input type="radio" name={`cota-animal-${plano.id}`}
                      checked={plano.limite_animais !== null}
                      onChange={() => alterarPlano(plano.id, "limite_animais", 50)}
                      className="accent-primary"/>
                    Quantidade definida
                  </label>
                  <div className="mt-3 flex items-center gap-2">
                    <input type="number" aria-label={`Quantidade de animais do plano ${plano.nome}`}
                      min={1} max={1000000} step={1}
                      disabled={plano.limite_animais === null}
                      value={plano.limite_animais ?? 50}
                      onChange={(e) => alterarPlano(plano.id, "limite_animais", e.target.value === "" ? 0 : Number(e.target.value))}
                      className="min-w-0 w-full rounded-lg border bg-background px-3 py-2 text-base font-bold disabled:opacity-50"/>
                    <span className="text-xs font-semibold">animais</span>
                  </div>
                </div>
                <label className={`flex min-w-0 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 p-3 text-sm font-bold transition-colors ${plano.limite_animais === null ? "border-primary bg-background" : "border-border bg-card"}`}>
                  <input type="radio" name={`cota-animal-${plano.id}`}
                    checked={plano.limite_animais === null}
                    onChange={() => alterarPlano(plano.id, "limite_animais", null)}
                    className="accent-primary"/>
                  Ilimitado
                </label>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Ao atingir o limite, novos animais não poderão ser cadastrados. Os animais existentes
                permanecem acessíveis e editáveis; a regra vale para todos os usuários desta clínica.
              </p>
            </section>
            <label className="mt-3 block text-xs font-bold">Itens comerciais exibidos na página pública<textarea rows={4} value={plano.itens.join("\n")} onChange={(e)=>alterarPlano(plano.id,"itens",e.target.value.split("\n").map((x)=>x.trim()).filter(Boolean))} className="mt-1 w-full rounded-xl border bg-background p-3 text-sm font-normal"/></label>

            <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
              As permissões detalhadas são gerenciadas na matriz central acima. Salvar este cartão altera somente dados comerciais.
            </p>
          </article>;
        })}
      </section>

      <section className="mt-7 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2"><LockKeyhole size={20} className="text-primary"/><h2 className="text-xl font-black">Exceções por clínica</h2></div>
        <p className="mt-1 text-sm text-muted-foreground">Use somente quando uma clínica precisar de uma liberação ou bloqueio específico sem alterar o plano de todas as outras.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_auto] lg:items-end">
          <label className="text-xs font-bold">Clínica<select value={clinicaSelecionada} onChange={(e)=>setClinicaSelecionada(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal">{clinicas.map((c)=><option key={c.id} value={c.id}>{c.nome} · {c.plano}</option>)}</select></label>
          <label className="text-xs font-bold">Limite de usuários desta clínica<input type="number" min={1} value={clinicaAtual?.limite_usuarios ?? 1} onChange={(e)=>setClinicas((lista)=>lista.map((c)=>c.id===clinicaSelecionada?{...c,limite_usuarios:Math.max(1,Number(e.target.value)||1)}:c))} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal"/></label>
          <button type="button" disabled={!clinicaAtual || salvando==="limite-clinica"} onClick={() => void salvarLimiteClinica()} className="min-h-11 rounded-xl border px-4 text-sm font-bold disabled:opacity-50">Salvar limite</button>
        </div>

        {clinicaAtual && <div className="mt-5">
          <input aria-label="Pesquisar recursos por clínica" value={buscaClinica} onChange={(e)=>setBuscaClinica(e.target.value)}
            placeholder="Pesquisar entre os 98 benefícios da clínica..." className="mb-3 min-h-11 w-full rounded-xl border bg-background px-4 text-sm"/>
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {funcionalidades.filter((f)=>f.codigo.startsWith("beneficio.") && (f.nome+" "+f.grupo).toLocaleLowerCase("pt-BR").includes(buscaClinica.toLocaleLowerCase("pt-BR"))).map((f) => {
            const modo = modoExcecao(f.codigo);
            return <article key={f.codigo} className="rounded-xl border p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{f.grupo}</p><p className="mt-1 text-sm font-bold">{f.nome}</p></div>{modo!=="plano" && <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${modo==="liberar"?"bg-emerald-100 text-emerald-800":"bg-destructive/10 text-destructive"}`}>{modo==="liberar"?"Liberado":"Bloqueado"}</span>}</div><div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-secondary/50 p-1">{(["plano","liberar","bloquear"] as ModoExcecao[]).map((opcao)=><button key={opcao} type="button" disabled={salvando===`excecao:${f.codigo}`} onClick={()=>void mudarExcecao(f.codigo,opcao)} className={`rounded-md px-2 py-2 text-[11px] font-bold capitalize ${modo===opcao?"bg-background shadow-sm":"text-muted-foreground"}`}>{opcao}</button>)}</div></article>;
          })}
          </div>
        </div>}
      </section>

      <div className="mt-6 rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm"><Check size={17} className="mr-2 inline text-primary"/><strong>Regra final:</strong> plano → cargo → permissão individual. Exceções de clínica entram no nível do plano e só o Admin ORICSE pode alterá-las.</div>
    </div>
  </main>;
}

function FragmentoGrupo({
  grupo, itens, fechado, onToggle, planos, matriz, valorPlano, alterarFuncionalidade, alterarGrupo,
}: {
  grupo: string;
  itens: ItemCatalogo[];
  fechado: boolean;
  onToggle: () => void;
  planos: Plano[];
  matriz: Matriz;
  valorPlano: (planoId: string, item: ItemCatalogo) => boolean;
  alterarFuncionalidade: (planoId: string, codigo: string, permitido: boolean) => void;
  alterarGrupo: (planoId: string, itens: ItemCatalogo[], permitido: boolean) => void;
}) {
  return <>
    <tr className="bg-secondary/50">
      <th className="sticky left-0 bg-secondary/90 px-3 py-2">
        <button type="button" onClick={onToggle} className="w-full text-left font-black">
          {fechado ? "▸" : "▾"} {grupo} <span className="text-xs font-normal">({itens.length})</span>
        </button>
      </th>
      {planos.map((p) => <td key={p.id} className="px-2 py-1.5 text-center">
        <div className="flex items-center justify-center gap-1">
          <button type="button" onClick={()=>alterarGrupo(p.id,itens,true)}
            title={"Liberar grupo no plano " + p.nome}
            className="rounded border px-2 py-1 text-[10px] font-bold">Todos ✓</button>
          <button type="button" onClick={()=>alterarGrupo(p.id,itens,false)}
            title={"Bloquear grupo no plano " + p.nome}
            className="rounded border px-2 py-1 text-[10px] font-bold">Todos ✕</button>
        </div>
      </td>)}
    </tr>
    {!fechado && itens.map((item) => <tr key={item.codigo} className="border-t">
      <th scope="row" className="sticky left-0 bg-card px-3 py-2 font-normal">
        <div className="font-semibold">{item.nome}</div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">{item.codigo}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{item.descricao}</div>
        <div className="mt-1 text-[10px] font-semibold text-primary">
          {item.tipo==="acao" ? "AÇÃO INDIVIDUAL" : item.tipo==="beneficio" ? "BENEFÍCIO" : "MÓDULO"}
          {!item.catalogada ? " · PENDENTE DE CLASSIFICAÇÃO" : ""}
        </div>
      </th>
      {planos.map((plano) => {
        const explicita = Object.prototype.hasOwnProperty.call(matriz[plano.id] || {},item.codigo);
        const paiLiberado = !item.pai || Boolean(matriz[plano.id]?.[item.pai]);
        const checked = valorPlano(plano.id,item);
        return <td key={plano.id} className="px-3 py-2 text-center">
          <label className="inline-flex cursor-pointer flex-col items-center gap-1">
            <input type="checkbox" aria-label={item.nome+" — "+plano.nome}
              checked={checked}
              onChange={(e)=>alterarFuncionalidade(plano.id,item.codigo,e.target.checked)}
              className="h-5 w-5 accent-primary"/>
            <span className="text-[10px] text-muted-foreground">
              {item.tipo==="acao" && !paiLiberado ? "Bloqueado na venda · pode liberar" :
                !explicita ? "Herdado / pendente" : checked ? "Liberado" : "Bloqueado"}
            </span>
          </label>
        </td>;
      })}
    </tr>)}
  </>;
}

function Campo({ rotulo, valor, onChange }: { rotulo: string; valor: string; onChange: (valor: string) => void }) {
  return <label className="text-xs font-bold">{rotulo}<input value={valor || ""} onChange={(e)=>onChange(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal"/></label>;
}
