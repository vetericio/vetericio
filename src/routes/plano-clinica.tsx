import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, CalendarDays, LockKeyhole, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/plano-clinica")({
  head: () => ({ meta: [{ title: "Meu plano — ORICSE" }] }),
  component: PlanoClinica,
});

type Recurso = {
  codigo: string;
  nome: string;
  grupo: string;
  descricao: string;
  tipo: "modulo" | "acao";
  permitido: boolean;
  ordem: number;
};
type Resumo = {
  clinica: { id: string; nome: string; plano: string; status: string; limite_usuarios: number | null };
  plano: {
    nome: string; codigo: string; descricao: string; usuarios_inclusos: number;
    dominio_incluso: boolean; preco_mensal: string; preco_anual: string;
  } | null;
  recursos: Recurso[];
};

function PlanoClinica() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [mostrar, setMostrar] = useState<"todos" | "liberados" | "bloqueados">("todos");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const { data: user, error: erroAuth } = await supabase.auth.getUser();
      if (erroAuth || !user.user?.id) throw new Error("Faça login para consultar seu plano.");
      // O servidor escolhe a clínica da sessão e valida se o usuário é gestor.
      // Nenhum ID de clínica é aceito do navegador nesta operação.
      const { data, error } = await (supabase as any).rpc("oricse_plano_resumo_clinica");
      if (error) throw error;
      if (!data?.clinica?.id) throw new Error("Não foi possível identificar a clínica.");
      setResumo(data as Resumo);
    } catch (e) {
      setResumo(null);
      setErro(e instanceof Error ? e.message : "Não foi possível consultar o plano.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const recursos = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return (resumo?.recursos || []).filter((r) =>
      (mostrar === "todos" || (mostrar === "liberados" ? r.permitido : !r.permitido)) &&
      (!termo || [r.nome, r.descricao, r.grupo, r.codigo]
        .some((x) => x.toLocaleLowerCase("pt-BR").includes(termo)))
    );
  }, [resumo, mostrar, busca]);
  const grupos = useMemo(() => {
    const mapa = new Map<string, Recurso[]>();
    for (const r of recursos) mapa.set(r.grupo, [...(mapa.get(r.grupo) || []), r]);
    return [...mapa.entries()];
  }, [recursos]);
  const liberados = (resumo?.recursos || []).filter((r) => r.permitido).length;
  const bloqueados = (resumo?.recursos || []).length - liberados;

  return <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-20 pt-6 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link to="/perfil-clinica" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft size={17}/> Configurações da clínica
      </Link>
      <button type="button" onClick={() => void carregar()} disabled={carregando}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold disabled:opacity-50">
        <RefreshCw size={16}/> Atualizar
      </button>
    </div>
    <header className="mb-6 mt-5">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Administração da clínica</p>
      <h1 className="mt-1 text-3xl font-black">Meu plano e funcionalidades</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Consulte o que a sua clínica tem disponível no ORICSE. Apenas o Admin Geral
        pode alterar os limites e as liberações comerciais do plano.
      </p>
    </header>

    {carregando && <section aria-live="polite" className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
      Consultando plano e permissões…
    </section>}
    {!carregando && erro && <section role="alert" className="rounded-2xl border p-5">
      <h2 className="font-bold">Não foi possível carregar seu plano.</h2>
      <p className="mt-2 text-sm text-muted-foreground">{erro}</p>
      <button type="button" className="mt-3 rounded-xl border px-4 py-2 text-sm font-bold" onClick={() => void carregar()}>
        Tentar novamente
      </button>
    </section>}

    {!carregando && resumo && <>
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{resumo.clinica.nome}</p>
            <h2 className="mt-1 text-2xl font-black">{resumo.plano?.nome || resumo.clinica.plano}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{resumo.plano?.descricao || "Plano da clínica"}</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold">
            <ShieldCheck size={15}/> {resumo.clinica.status === "ativa" ? "Clínica ativa" : resumo.clinica.status}
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-secondary/40 p-4">
            <Users size={20} className="text-primary"/>
            <p className="mt-2 text-xl font-black">{resumo.clinica.limite_usuarios ?? resumo.plano?.usuarios_inclusos ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Limite de usuários</p>
          </div>
          <div className="rounded-xl bg-secondary/40 p-4">
            <CalendarDays size={20} className="text-primary"/>
            <p className="mt-2 text-xl font-black">{resumo.clinica.limite_usuarios ?? resumo.plano?.usuarios_inclusos ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Agendas incluídas</p>
          </div>
          <div className="rounded-xl bg-secondary/40 p-4">
            <BadgeCheck size={20} className="text-primary"/>
            <p className="mt-2 text-xl font-black">{liberados}</p>
            <p className="text-xs text-muted-foreground">Recursos liberados no plano</p>
          </div>
          <div className="rounded-xl bg-secondary/40 p-4">
            <LockKeyhole size={20} className="text-primary"/>
            <p className="mt-2 text-xl font-black">{bloqueados}</p>
            <p className="text-xs text-muted-foreground">Recursos bloqueados no plano</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Cada usuário contratado dá direito a uma agenda. Para solicitar agendas adicionais, escreva para <a className="font-semibold text-primary underline" href="mailto:atendimento@oricse.com.br">atendimento@oricse.com.br</a> ou fale com seu consultor.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Esta tela apresenta os limites do plano, não as permissões individuais de cada funcionário.
          Um recurso liberado ainda depende da autorização do cargo.
        </p>
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-black">Funcionalidades do plano</h2>
          <p className="mt-1 text-sm text-muted-foreground">Consulte os módulos e suas ações, separados por categoria.</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar módulo ou funcionalidade"
            aria-label="Buscar funcionalidades"
            className="min-h-11 min-w-0 rounded-xl border bg-background px-3 text-sm"/>
          <select value={mostrar} onChange={(e) => setMostrar(e.target.value as typeof mostrar)}
            aria-label="Filtrar funcionalidades" className="min-h-11 min-w-0 rounded-xl border bg-background px-3 text-sm">
            <option value="todos">Todos os recursos</option>
            <option value="liberados">Liberados</option>
            <option value="bloqueados">Bloqueados</option>
          </select>
        </div>
        <div className="mt-4 space-y-3">
          {grupos.map(([grupo, itens]) => <details key={grupo} className="rounded-xl border" open={Boolean(busca)}>
            <summary className="cursor-pointer px-4 py-3 text-sm font-black">
              {grupo} <span className="ml-2 text-xs font-normal text-muted-foreground">
                {itens.filter((r) => r.permitido).length}/{itens.length} liberados
              </span>
            </summary>
            <div className="divide-y border-t">
              {itens.map((item) => <div key={item.codigo} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.nome}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.descricao}</p>
                  <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{item.codigo}</p>
                </div>
                <span className="shrink-0 text-xs font-bold">
                  {item.permitido ? "✓ Liberado" : "✕ Bloqueado"}
                </span>
              </div>)}
            </div>
          </details>)}
          {recursos.length===0 && <p className="rounded-xl border p-5 text-sm text-muted-foreground">
            Nenhum recurso corresponde aos filtros escolhidos.
          </p>}
        </div>
      </section>
      <p className="mt-5 text-sm text-muted-foreground">
        Para solicitar alterações no plano ou a liberação de um recurso, contate a administração geral do ORICSE.
      </p>
    </>}
  </main>;
}
