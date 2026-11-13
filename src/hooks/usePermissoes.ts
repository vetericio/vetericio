import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, supabaseBanco } from "@/integrations/supabase/client";

export type PermissaoEfetiva = {
  codigo: string;
  nome: string;
  grupo: string;
  descricao: string;
  permitido: boolean;
  origem: "cargo" | "usuario" | "plano" | string;
  ordem: number;
};

export const PERMISSOES_ROTA: Record<string, string[]> = {
  "/minha-atividade": ["atividade.ponto"],
  "/banco-horas": ["atividade.ponto"],
  "/recepcao": ["recepcao.agenda"],
  "/todas-agendas": ["recepcao.agenda"],
  "/hotelzinho": ["hotelzinho.visualizar"],
  "/agenda-hotel": ["hotelzinho.visualizar"],
  "/banho-tosa": ["hotelzinho.visualizar"],
  "/fila-espera": ["recepcao.agenda", "consultorio.atendimentos"],
  "/configurar-agenda-online": ["recepcao.agenda", "administracao.configuracoes"],
  "/horarios-medicacoes": ["internacao.medicacoes"],
  "/configurar-portal-tutor": ["administracao.site", "portal_tutor.gerenciar"],
  "/configurar-pagamentos": ["administracao.configuracoes"],
  "/mercado-pago-clinica": ["administracao.configuracoes"],
  "/tutores": ["recepcao.cadastros.visualizar"],
  "/portal-tutores": ["portal_tutor.gerenciar"],
  "/animais": ["recepcao.cadastros.visualizar", "consultorio.atendimentos"],
  "/novo-animal": ["recepcao.cadastros.criar"],
  "/animal": ["recepcao.cadastros.visualizar", "consultorio.atendimentos", "internacao.painel"],
  "/crm": ["crm.visualizar", "crm.enviar", "crm.gerenciar"],
  "/consultorio": ["consultorio.atendimentos"],
  "/consulta": ["consultorio.atendimentos"],
  "/registro-clinico": ["consultorio.atendimentos"],
  "/encaminhar": ["consultorio.atendimentos", "recepcao.agenda"],
  "/assinar": ["consultorio.receituario"],
  "/receituario": ["consultorio.receituario"],
  "/termos": ["consultorio.receituario", "consultorio.atendimentos"],
  "/medicacoes": ["consultorio.medicacoes", "internacao.medicacoes"],
  "/internacao": ["internacao.painel"],
  "/registros": ["internacao.painel"],
  "/anamnese": ["internacao.registrar"],
  "/curva": ["internacao.registrar"],
  "/alarmes": ["internacao.registrar"],
  "/pendencias": ["internacao.registrar"],
  "/plantoes": ["internacao.plantoes"],
  "/financeiro": ["caixa.financeiro.visualizar"],
  "/comandas": ["caixa.comandas"],
  "/venda-expressa": ["caixa.comandas", "caixa.financeiro.gerenciar"],
  "/estoque": ["estoque.catalogo.visualizar", "estoque.movimentar"],
  "/rh": ["equipe.pagamentos.visualizar", "equipe.pagamentos.gerenciar"],
  "/catalogo": ["estoque.catalogo.visualizar"],
  "/perfil-clinica": ["administracao.configuracoes"],
  "/plano-clinica": ["administracao.configuracoes"],
  "/permissoes-equipe": ["administracao.permissoes"],
  "/configuracao-site": ["administracao.site"],
  "/temas": ["administracao.temas"],
  "/sincronizacao": ["administracao.configuracoes"],
};

export function permissoesDaRota(pathname: string) {
  return PERMISSOES_ROTA[pathname] || null;
}

// Evita repetir as mesmas RPCs de permissões em cada card, cabeçalho, menu
// ou página. Apenas memória desta aba; não persiste dados sensíveis no navegador.
// A API e as policies do banco continuam responsáveis por autorizar operações.
type SnapshotPermissoes = {
  usuarioId: string;
  permissoes: PermissaoEfetiva[];
  clinicaId: string;
  adminGlobal: boolean;
};
const CACHE_PERMISSOES_MS = 20_000;
let snapshotPermissoes: SnapshotPermissoes | null = null;
let snapshotObtidoEm = 0;
let consultaPermissoesPendente: { usuarioId: string; promise: Promise<SnapshotPermissoes> } | null = null;

async function obterPermissoesCompartilhadas(force = false): Promise<SnapshotPermissoes> {
  const { data: sessao, error: erroSessao } = await supabase.auth.getSession();
  if (erroSessao) throw erroSessao;
  const usuarioId = sessao.session?.user?.id || "";
  if (!usuarioId) {
    snapshotPermissoes = null;
    snapshotObtidoEm = 0;
    return { usuarioId: "", permissoes: [], clinicaId: "", adminGlobal: false };
  }

  if (!force && snapshotPermissoes?.usuarioId === usuarioId &&
    Date.now() - snapshotObtidoEm < CACHE_PERMISSOES_MS) {
    return snapshotPermissoes;
  }
  if (consultaPermissoesPendente?.usuarioId === usuarioId) {
    return consultaPermissoesPendente.promise;
  }

  const promessa = (async (): Promise<SnapshotPermissoes> => {
    const { data: plataforma, error: erroPlataforma } = await (supabase as any)
      .from("app_users")
      .select("role")
      .eq("user_id", usuarioId)
      .maybeSingle();
    if (erroPlataforma) throw erroPlataforma;
    const adminGlobal = plataforma?.role === "admin";

    const { data: contexto, error: erroContexto } = await (supabaseBanco as any)
      .rpc("oricse_contexto_clinica_atual");
    if (erroContexto) throw erroContexto;
    const clinicaId = contexto?.[0]?.clinica_id || "";
    if (adminGlobal || !clinicaId) {
      return { usuarioId, permissoes: [], clinicaId, adminGlobal };
    }

    const { data, error } = await (supabaseBanco as any).rpc("oricse_permissoes_efetivas", {
      p_clinica_id: clinicaId,
      p_user_id: usuarioId,
    });
    if (error) throw error;
    return { usuarioId, clinicaId, adminGlobal: false, permissoes: (data || []) as PermissaoEfetiva[] };
  })();

  consultaPermissoesPendente = { usuarioId, promise: promessa };
  try {
    const resposta = await promessa;
    snapshotPermissoes = resposta;
    snapshotObtidoEm = Date.now();
    return resposta;
  } finally {
    if (consultaPermissoesPendente?.promise === promessa) consultaPermissoesPendente = null;
  }
}

export function usePermissoes() {
  const [permissoes, setPermissoes] = useState<PermissaoEfetiva[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [clinicaId, setClinicaId] = useState("");
  const [adminGlobal, setAdminGlobal] = useState(false);
  // Uma resposta atrasada de uma clínica anterior não deve sobrescrever a atual.
  const versaoConsulta = useRef(0);

  const carregar = useCallback(async (forcar = false) => {
    const versao = ++versaoConsulta.current;
    if (forcar || !snapshotPermissoes ||
      Date.now() - snapshotObtidoEm >= CACHE_PERMISSOES_MS) {
      setCarregando(true);
    }
    try {
      const resultado = await obterPermissoesCompartilhadas(forcar);
      if (versao !== versaoConsulta.current) return;
      setPermissoes(resultado.permissoes);
      setClinicaId(resultado.clinicaId);
      setAdminGlobal(resultado.adminGlobal);
    } catch (error) {
      if (versao !== versaoConsulta.current) return;
      console.error("Não foi possível carregar as permissões do usuário:", error);
      setPermissoes([]);
      setClinicaId("");
      setAdminGlobal(false);
    } finally {
      if (versao === versaoConsulta.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    // Uma mudança de usuário ou clínica força nova consulta, sem aproveitamento
    // indevido do snapshot anterior. TOKEN_REFRESHED não muda permissões.
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "TOKEN_REFRESHED") return;
      setTimeout(() => void carregar(true), 0);
    });
    const quandoAlterarClinica = () => { void carregar(true); };
    if (typeof window !== "undefined") {
      window.addEventListener("oricse:clinica-alterada", quandoAlterarClinica);
    }
    return () => {
      versaoConsulta.current += 1;
      data.subscription.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("oricse:clinica-alterada", quandoAlterarClinica);
      }
    };
  }, [carregar]);

  const permitidas = useMemo(
    () => new Set(permissoes.filter((p) => p.permitido).map((p) => p.codigo)),
    [permissoes],
  );

  const bloqueadasPeloPlano = useMemo(
    () => new Set(permissoes.filter((p) => !p.permitido && p.origem === "plano").map((p) => p.codigo)),
    [permissoes],
  );

  const mapaPermissoes = useMemo(
    () => new Map(permissoes.map((p) => [p.codigo, p])),
    [permissoes],
  );

  const pode = useCallback((codigo: string) => adminGlobal || permitidas.has(codigo), [adminGlobal, permitidas]);
  const podeAlguma = useCallback((codigos: string[]) => adminGlobal || codigos.some((codigo) => permitidas.has(codigo)), [adminGlobal, permitidas]);
  const bloqueadaPeloPlano = useCallback((codigo: string) => !adminGlobal && bloqueadasPeloPlano.has(codigo), [adminGlobal, bloqueadasPeloPlano]);
  const origemDaPermissao = useCallback((codigo: string) => adminGlobal ? "admin" : mapaPermissoes.get(codigo)?.origem || "indisponivel", [adminGlobal, mapaPermissoes]);

  return {
    permissoes,
    permitidas,
    bloqueadasPeloPlano,
    carregando,
    clinicaId,
    adminGlobal,
    pode,
    podeAlguma,
    bloqueadaPeloPlano,
    origemDaPermissao,
    recarregar: () => carregar(true),
  };
}
