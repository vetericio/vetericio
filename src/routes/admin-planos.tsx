import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, LockKeyhole, Save, ShieldCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin-planos")({ component: AdminPlanos });

type Plano = {
  id: string;
  codigo: string;
  nome: string;
  publico_alvo: string;
  preco: string;
  preco_mensal: string;
  preco_anual: string;
  descricao: string;
  itens: string[];
  usuarios_inclusos: number;
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

      const [planosRes, funcoesRes, matrizRes, clinicasRes, excecoesRes] = await Promise.all([
        (supabase as any).from("oricse_planos").select("*").order("ordem"),
        (supabase as any).from("oricse_funcionalidades").select("codigo,nome,grupo,ordem").eq("ativo", true).order("ordem"),
        (supabase as any).from("oricse_plano_funcionalidades").select("plano_id,funcionalidade_codigo,permitido"),
        (supabase as any).from("clinicas").select("id,nome,plano,status,limite_usuarios").order("nome"),
        (supabase as any).from("oricse_clinica_funcionalidade_excecoes").select("id,clinica_id,funcionalidade_codigo,permitido,motivo,expira_em"),
      ]);
      for (const resposta of [planosRes, funcoesRes, matrizRes, clinicasRes, excecoesRes]) {
        if (resposta.error) throw resposta.error;
      }

      const planosDados = (planosRes.data || []).map((p: any) => ({ ...p, itens: Array.isArray(p.itens) ? p.itens : [] })) as Plano[];
      const mapa: Matriz = {};
      for (const item of matrizRes.data || []) {
        (mapa[item.plano_id] ??= {})[item.funcionalidade_codigo] = Boolean(item.permitido);
      }
      setPlanos(planosDados);
      setFuncionalidades((funcoesRes.data || []) as Funcionalidade[]);
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

  const grupos = useMemo(() => {
    const mapa = new Map<string, Funcionalidade[]>();
    for (const item of funcionalidades) {
      const lista = mapa.get(item.grupo) || [];
      lista.push(item);
      mapa.set(item.grupo, lista);
    }
    return [...mapa.entries()];
  }, [funcionalidades]);

  const clinicaAtual = clinicas.find((c) => c.id === clinicaSelecionada) || null;

  function alterarPlano(id: string, campo: keyof Plano, valor: unknown) {
    setPlanos((lista) => lista.map((p) => p.id === id ? { ...p, [campo]: valor } as Plano : p));
  }

  function alterarFuncionalidade(planoId: string, codigo: string, permitido: boolean) {
    setMatriz((atual) => ({
      ...atual,
      [planoId]: { ...(atual[planoId] || {}), [codigo]: permitido },
    }));
  }

  async function salvarPlano(plano: Plano) {
    setSalvando(`plano:${plano.id}`);
    try {
      const { error } = await (supabase as any)
        .from("oricse_planos")
        .update({
          nome: plano.nome.trim(),
          publico_alvo: plano.publico_alvo,
          preco: plano.preco,
          preco_mensal: plano.preco_mensal,
          preco_anual: plano.preco_anual,
          descricao: plano.descricao,
          itens: plano.itens,
          usuarios_inclusos: Math.max(1, Number(plano.usuarios_inclusos) || 1),
          dominio_incluso: plano.dominio_incluso,
          ativo: plano.ativo,
          updated_at: new Date().toISOString(),
        })
        .eq("id", plano.id);
      if (error) throw error;

      const dados = funcionalidades.map((f) => ({
        plano_id: plano.id,
        funcionalidade_codigo: f.codigo,
        permitido: Boolean(matriz[plano.id]?.[f.codigo]),
      }));
      const { error: erroMatriz } = await (supabase as any)
        .from("oricse_plano_funcionalidades")
        .upsert(dados, { onConflict: "plano_id,funcionalidade_codigo" });
      if (erroMatriz) throw erroMatriz;
      toast.success(`${plano.nome} salvo com a matriz de acessos.`);
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
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">O plano define o teto de acesso da clínica. O cargo e a permissão individual só funcionam dentro do que o plano libera. Exceções por clínica são controladas exclusivamente pelo Admin ORICSE.</p>

      <section className="mt-7 space-y-5">
        {planos.map((plano) => {
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
              <Campo rotulo="Valor mensal" valor={plano.preco_mensal} onChange={(v) => alterarPlano(plano.id,"preco_mensal",v)}/>
              <Campo rotulo="Valor anual" valor={plano.preco_anual} onChange={(v) => alterarPlano(plano.id,"preco_anual",v)}/>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_180px_180px]">
              <label className="text-xs font-bold">Descrição<textarea rows={3} value={plano.descricao} onChange={(e) => alterarPlano(plano.id,"descricao",e.target.value)} className="mt-1 w-full rounded-xl border bg-background p-3 text-sm font-normal"/></label>
              <label className="text-xs font-bold">Usuários incluídos<div className="mt-1 flex h-[74px] items-center rounded-xl border bg-background px-3"><Users size={17} className="mr-2 text-muted-foreground"/><input type="number" min={1} value={plano.usuarios_inclusos} onChange={(e) => alterarPlano(plano.id,"usuarios_inclusos",Math.max(1,Number(e.target.value)||1))} className="w-full bg-transparent text-sm outline-none"/></div></label>
              <div className="text-xs font-bold">Opções<div className="mt-1 flex h-[74px] flex-col justify-center gap-2 rounded-xl border bg-background px-3 text-sm font-normal"><label className="flex items-center gap-2"><input type="checkbox" checked={plano.dominio_incluso} onChange={(e)=>alterarPlano(plano.id,"dominio_incluso",e.target.checked)}/> Domínio incluído</label><label className="flex items-center gap-2"><input type="checkbox" checked={plano.ativo} onChange={(e)=>alterarPlano(plano.id,"ativo",e.target.checked)}/> Plano ativo</label></div></div>
            </div>
            <label className="mt-3 block text-xs font-bold">Itens comerciais exibidos na página pública<textarea rows={4} value={plano.itens.join("\n")} onChange={(e)=>alterarPlano(plano.id,"itens",e.target.value.split("\n").map((x)=>x.trim()).filter(Boolean))} className="mt-1 w-full rounded-xl border bg-background p-3 text-sm font-normal"/></label>

            <div className="mt-5 border-t pt-5">
              <h3 className="font-black">Matriz de funcionalidades</h3>
              <p className="mt-1 text-xs text-muted-foreground">Desligado aqui = nenhum funcionário desta clínica acessa a função, mesmo que o cargo ou a permissão individual estejam liberados.</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {grupos.map(([grupo, itens]) => <fieldset key={grupo} className="rounded-xl border p-3"><legend className="px-1 text-xs font-black uppercase tracking-wider text-muted-foreground">{grupo}</legend><div className="space-y-2">{itens.map((f)=><label key={f.codigo} className="flex min-h-10 items-center justify-between gap-3 rounded-lg bg-secondary/35 px-3 text-sm"><span>{f.nome}</span><input type="checkbox" checked={Boolean(matriz[plano.id]?.[f.codigo])} onChange={(e)=>alterarFuncionalidade(plano.id,f.codigo,e.target.checked)} className="h-4 w-4"/></label>)}</div></fieldset>)}
              </div>
            </div>
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

        {clinicaAtual && <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {funcionalidades.map((f) => {
            const modo = modoExcecao(f.codigo);
            return <article key={f.codigo} className="rounded-xl border p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{f.grupo}</p><p className="mt-1 text-sm font-bold">{f.nome}</p></div>{modo!=="plano" && <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${modo==="liberar"?"bg-emerald-100 text-emerald-800":"bg-destructive/10 text-destructive"}`}>{modo==="liberar"?"Liberado":"Bloqueado"}</span>}</div><div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-secondary/50 p-1">{(["plano","liberar","bloquear"] as ModoExcecao[]).map((opcao)=><button key={opcao} type="button" disabled={salvando===`excecao:${f.codigo}`} onClick={()=>void mudarExcecao(f.codigo,opcao)} className={`rounded-md px-2 py-2 text-[11px] font-bold capitalize ${modo===opcao?"bg-background shadow-sm":"text-muted-foreground"}`}>{opcao}</button>)}</div></article>;
          })}
        </div>}
      </section>

      <div className="mt-6 rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm"><Check size={17} className="mr-2 inline text-primary"/><strong>Regra final:</strong> plano → cargo → permissão individual. Exceções de clínica entram no nível do plano e só o Admin ORICSE pode alterá-las.</div>
    </div>
  </main>;
}

function Campo({ rotulo, valor, onChange }: { rotulo: string; valor: string; onChange: (valor: string) => void }) {
  return <label className="text-xs font-bold">{rotulo}<input value={valor || ""} onChange={(e)=>onChange(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal"/></label>;
}
