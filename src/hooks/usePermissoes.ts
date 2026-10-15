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
  "/tutores": ["recepcao.cadastros.visualizar"],
  "/animais": ["recepcao.cadastros.visualizar", "consultorio.atendimentos"],
  "/animal": ["recepcao.cadastros.visualizar", "consultorio.atendimentos", "internacao.painel"],
  "/consultorio": ["consultorio.atendimentos"],
  "/registro-clinico": ["consultorio.atendimentos"],
  "/assinar": ["consultorio.receituario"],
  "/receituario": ["consultorio.receituario"],
  "/medicacoes": ["consultorio.medicacoes", "internacao.medicacoes"],
  "/internacao": ["internacao.painel"],
  "/registros": ["internacao.painel"],
  "/anamnese": ["internacao.painel"],
  "/curva": ["internacao.painel"],
  "/alarmes": ["internacao.painel"],
  "/pendencias": ["internacao.painel"],
  "/plantoes": ["internacao.plantoes"],
  "/financeiro": ["caixa.financeiro.visualizar"],
  "/comandas": ["caixa.comandas"],
  "/estoque": ["estoque.catalogo.visualizar"],
  "/catalogo": ["estoque.catalogo.visualizar"],
  "/perfil-clinica": ["administracao.configuracoes"],
  "/configuracao-site": ["administracao.site"],
  "/temas": ["administracao.temas"],
};

export function permissoesDaRota(pathname: string) {
  return PERMISSOES_ROTA[pathname] || null;
}

export function usePermissoes() {
  const [permissoes, setPermissoes] = useState<PermissaoEfetiva[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [clinicaId, setClinicaId] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data: sessao } = await supabase.auth.getSession();
      if (!sessao.session?.user?.id) {
        setPermissoes([]);
        setClinicaId("");
        return;
      }

      const { data: plataforma } = await (supabase as any)
        .from("app_users")
        .select("role")
        .eq("user_id", sessao.session.user.id)
        .maybeSingle();
      if (plataforma?.role === "admin") {
        setPermissoes([]);
        setClinicaId("");
        return;
      }

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
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    const { data } = supabase.auth.onAuthStateChange(() => void carregar());
    return () => data.subscription.unsubscribe();
  }, [carregar]);

  const permitidas = useMemo(
    () => new Set(permissoes.filter((p) => p.permitido).map((p) => p.codigo)),
    [permissoes],
  );

  const pode = useCallback((codigo: string) => permitidas.has(codigo), [permitidas]);
  const podeAlguma = useCallback((codigos: string[]) => codigos.some((codigo) => permitidas.has(codigo)), [permitidas]);

  return { permissoes, permitidas, carregando, clinicaId, pode, podeAlguma, recarregar: carregar };
}
