import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  "/recepcao": ["recepcao.agenda"],
  "/fila-espera": ["recepcao.agenda"],
  "/configurar-agenda-online": ["recepcao.agenda", "administracao.configuracoes"],
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
  "/estoque": ["estoque.catalogo.visualizar", "estoque.movimentar", "equipe.pagamentos.visualizar"],
  "/catalogo": ["estoque.catalogo.visualizar"],
  "/perfil-clinica": ["administracao.configuracoes"],
  "/configuracao-site": ["administracao.site"],
  "/temas": ["administracao.temas"],
  "/sincronizacao": ["administracao.configuracoes"],
};

export function permissoesDaRota(pathname: string) {
  return PERMISSOES_ROTA[pathname] || null;
}

export function usePermissoes() {
  const [permissoes, setPermissoes] = useState<PermissaoEfetiva[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [clinicaId, setClinicaId] = useState("");
  const [adminGlobal, setAdminGlobal] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data: sessao } = await supabase.auth.getSession();
      if (!sessao.session?.user?.id) {
        setPermissoes([]);
        setClinicaId("");
        setAdminGlobal(false);
        return;
      }

      const { data: plataforma } = await (supabase as any)
        .from("app_users")
        .select("role")
        .eq("user_id", sessao.session.user.id)
        .maybeSingle();
      if (plataforma?.role === "admin") {
        setPermissoes([]);
        setAdminGlobal(true);
        const { data: contextoAdmin } = await (supabase as any).rpc("oricse_contexto_clinica_atual");
        setClinicaId(contextoAdmin?.[0]?.clinica_id || "");
        return;
      }
      setAdminGlobal(false);

      const { data: contexto, error: contextoError } = await (supabase as any).rpc("oricse_contexto_clinica_atual");
      if (contextoError) throw contextoError;
      const id = contexto?.[0]?.clinica_id || "";
      if (!id) {
        setPermissoes([]);
        setClinicaId("");
        return;
      }

      const { data, error } = await (supabase as any).rpc("oricse_permissoes_efetivas", {
        p_clinica_id: id,
        p_user_id: sessao.session.user.id,
      });
      if (error) throw error;
      setClinicaId(id);
      setPermissoes((data || []) as PermissaoEfetiva[]);
    } catch (error) {
      console.error("Não foi possível carregar as permissões do usuário:", error);
      setPermissoes([]);
      setAdminGlobal(false);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    // Evita fazer chamadas ao cliente de auth dentro do callback de mudança de sessão.
    const { data } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => void carregar(), 0);
    });
    return () => data.subscription.unsubscribe();
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
    recarregar: carregar,
  };
}
