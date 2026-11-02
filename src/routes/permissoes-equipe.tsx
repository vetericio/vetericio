import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserPermissionsPanel } from "@/components/admin/UserPermissionsPanel";

export const Route = createFileRoute("/permissoes-equipe")({
  head: () => ({ meta: [{ title: "Permissões da equipe — ORICSE" }] }),
  component: PermissoesEquipe,
});

type Funcionario = {
  user_id: string;
  papel: string;
  ativo: boolean;
  nome: string;
};

function PermissoesEquipe() {
  const [clinica, setClinica] = useState<{ id: string; nome: string } | null>(null);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try {
      const { data: auth, error: errorAuth } = await supabase.auth.getUser();
      if (errorAuth || !auth.user?.id) throw new Error("Faça login novamente para gerenciar a equipe.");
      const { data: contexto, error: contextError } = await (supabase as any).rpc("oricse_contexto_clinica_atual");
      if (contextError) throw contextError;
      const cid = contexto?.[0]?.clinica_id as string | undefined;
      if (!cid) throw new Error("Selecione uma clínica antes de gerenciar as permissões.");
      const [{ data: acesso, error: acessoError }, { data: links, error: linksError }] = await Promise.all([
        (supabase as any).rpc("oricse_permissoes_efetivas", { p_clinica_id: cid, p_user_id: auth.user.id }),
        supabase.from("clinica_usuarios").select("user_id,papel,ativo").eq("clinica_id",cid).eq("ativo",true),
      ]);
      if (acessoError || linksError) throw acessoError || linksError;
      const { data: perfil } = await supabase.from("app_users").select("role").eq("user_id",auth.user.id).maybeSingle();
      if (perfil?.role !== "admin" && !(acesso || []).some((p: any) => p.codigo === "administracao.permissoes" && p.permitido)) {
        throw new Error("Seu cargo não permite gerenciar acessos de funcionários.");
      }
      const ids = (links || []).map((v: any) => String(v.user_id));
      const { data: perfis, error: perfisError } = ids.length
        ? await supabase.from("app_users").select("user_id,username").in("user_id",ids)
        : {data:[], error:null};
      if (perfisError) throw perfisError;
      const nomes = new Map((perfis || []).map((p: any) => [String(p.user_id),String(p.username || "")]));
      setClinica({ id: cid, nome: String(contexto?.[0]?.clinica_nome || "Clínica atual") });
      setFuncionarios((links || []).map((p: any) => ({
        user_id: String(p.user_id), papel: String(p.papel), ativo: Boolean(p.ativo),
        nome: nomes.get(String(p.user_id)) || "Profissional",
      })));
    } catch (e) {
      setFuncionarios([]); setClinica(null);
      setErro(e instanceof Error ? e.message : "Não foi possível consultar os acessos da clínica.");
    } finally { setCarregando(false); }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  return <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6 pb-20 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link to="/perfil-clinica" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <ArrowLeft size={17}/> Configurações da clínica
      </Link>
      <button type="button" disabled={carregando} onClick={() => void carregar()}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold disabled:opacity-50">
        <RefreshCw size={16}/> Atualizar
      </button>
    </div>
    <header className="mb-6 mt-5">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Administração da clínica</p>
      <h1 className="mt-1 text-3xl font-black">Permissões da equipe</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Defina os acessos de cada profissional dentro dos limites do plano da clínica.
        Bloqueios comerciais só podem ser alterados pelo Admin Geral.
      </p>
      {clinica && <p className="mt-2 text-sm font-semibold">{clinica.nome}</p>}
    </header>
    {carregando ? <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Carregando equipe…</div>
      : erro ? <div role="alert" className="rounded-2xl border bg-card p-6">
          <p className="font-bold">Não foi possível carregar as permissões.</p>
          <p className="mt-2 text-sm text-muted-foreground">{erro}</p>
          <button type="button" onClick={() => void carregar()} className="mt-3 rounded-xl border px-4 py-2 text-sm font-bold">Tentar novamente</button>
        </div>
      : <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="inline-flex items-center gap-2 text-xl font-black"><Users size={20}/> Funcionários ativos</h2>
            <Link to="/plano-clinica" className="inline-flex items-center gap-2 text-sm font-bold text-primary">
              <ShieldCheck size={16}/> Consultar plano
            </Link>
          </div>
          <div className="space-y-3">
            {funcionarios.map((f) => <article key={f.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
              <div>
                <p className="font-bold">{f.nome.startsWith("@") ? f.nome : "@" + f.nome}</p>
                <p className="mt-1 text-xs text-muted-foreground">Cargo: {f.papel.replaceAll("_"," ")}</p>
              </div>
              {clinica && <UserPermissionsPanel clinicaId={clinica.id} userId={f.user_id} nomeUsuario={f.nome}/>}
            </article>)}
            {funcionarios.length === 0 && <p className="text-sm text-muted-foreground">Nenhum profissional ativo vinculado a esta clínica.</p>}
          </div>
        </section>}
  </main>;
}
