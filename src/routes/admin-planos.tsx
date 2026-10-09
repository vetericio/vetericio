import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin-planos")({ component: AdminPlanos });

type Plano = {
  id?: string;
  codigo: string;
  nome: string;
  publico_alvo: string;
  preco: string;
  preco_mensal: string;
  preco_anual: string;
  cobranca_mensal: boolean;
  cobranca_anual: boolean;
  descricao: string;
  itens: string[];
  usuarios_inclusos: number;
  dominio_incluso: boolean;
  ativo: boolean;
  ordem: number;
};

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-2xl border bg-white p-5 shadow-sm">{children}</section>;
}

function AdminPlanos() {
  const navigate = useNavigate();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    try {
      const { data: sessao } = await supabase.auth.getSession();
      const uid = sessao.session?.user?.id;
      if (!uid) {
        navigate({ to: "/login" });
        return;
      }
      const { data: perfil } = await (supabase as any).from("app_users").select("role").eq("user_id", uid).maybeSingle();
      if (perfil?.role !== "admin") {
        navigate({ to: "/" });
        return;
      }

      const { data, error } = await (supabase as any)
        .from("oricse_planos")
        .select("id,codigo,nome,publico_alvo,preco,preco_mensal,preco_anual,cobranca_mensal,cobranca_anual,descricao,itens,usuarios_inclusos,dominio_incluso,ativo,ordem")
        .order("ordem");
      if (error) throw error;
      setPlanos((data || []).map((p: any, i: number) => ({
        ...p,
        preco_mensal: p.preco_mensal || p.preco || "R$ 0,00",
        preco_anual: p.preco_anual || "",
        cobranca_mensal: p.cobranca_mensal !== false,
        cobranca_anual: Boolean(p.cobranca_anual),
        itens: Array.isArray(p.itens) ? p.itens : [],
        ordem: Number(p.ordem) || i + 1,
      })));
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível carregar os planos.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { void carregar(); }, []);

  function alterarPlano(i: number, mudancas: Partial<Plano>) {
    setPlanos((lista) => lista.map((p, j) => j === i ? { ...p, ...mudancas } : p));
  }

  function moverPlano(indice: number, direcao: -1 | 1) {
    setPlanos((lista) => {
      const destino = indice + direcao;
      if (destino < 0 || destino >= lista.length) return lista;
      const nova = [...lista];
      [nova[indice], nova[destino]] = [nova[destino], nova[indice]];
      return nova.map((p, i) => ({ ...p, ordem: i + 1 }));
    });
  }

  function adicionarPlano() {
    setPlanos((lista) => [...lista, {
      codigo: `novo-plano-${Date.now().toString(36)}`,
      nome: "Novo plano",
      publico_alvo: "",
      preco: "R$ 0,00",
      preco_mensal: "R$ 0,00",
      preco_anual: "",
      cobranca_mensal: true,
      cobranca_anual: false,
      descricao: "",
      itens: [],
      usuarios_inclusos: 1,
      dominio_incluso: false,
      ativo: false,
      ordem: lista.length + 1,
    }]);
  }

  async function removerPlano(plano: Plano, indice: number) {
    if (!plano.id) {
      setPlanos((lista) => lista.filter((_, i) => i !== indice).map((p, i) => ({ ...p, ordem: i + 1 })));
      return;
    }
    const { count } = await (supabase as any).from("clinicas").select("id", { count: "exact", head: true }).eq("plano", plano.nome);
    if ((count || 0) > 0) return toast.error(`${count} clínica(s) ainda usam esse plano.`);
    if (!window.confirm(`Excluir permanentemente o plano “${plano.nome}”?`)) return;
    const { error } = await (supabase as any).from("oricse_planos").delete().eq("id", plano.id);
    if (error) return toast.error(error.message);
    setPlanos((lista) => lista.filter((_, i) => i !== indice).map((p, i) => ({ ...p, ordem: i + 1 })));
    toast.success("Plano removido.");
  }

  async function salvar() {
    const invalido = planos.find((p) => !p.cobranca_mensal && !p.cobranca_anual);
    if (invalido) return toast.error(`Ative cobrança mensal, anual ou ambas no plano “${invalido.nome}”.`);
    const anualSemPreco = planos.find((p) => p.cobranca_anual && !p.preco_anual.trim());
    if (anualSemPreco) return toast.error(`Informe o preço anual do plano “${anualSemPreco.nome}”.`);
    const mensalSemPreco = planos.find((p) => p.cobranca_mensal && !p.preco_mensal.trim());
    if (mensalSemPreco) return toast.error(`Informe o preço mensal do plano “${mensalSemPreco.nome}”.`);

    setOcupado(true);
    try {
      for (let i = 0; i < planos.length; i++) {
        const p = planos[i];
        const { error } = await (supabase as any).from("oricse_planos").upsert({
          ...(p.id ? { id: p.id } : {}),
          codigo: p.codigo,
          nome: p.nome.trim(),
          publico_alvo: p.publico_alvo,
          preco: p.preco_mensal || p.preco_anual || "",
          preco_mensal: p.preco_mensal,
          preco_anual: p.preco_anual || null,
          cobranca_mensal: p.cobranca_mensal,
          cobranca_anual: p.cobranca_anual,
          descricao: p.descricao,
          itens: p.itens,
          usuarios_inclusos: Math.max(1, Number(p.usuarios_inclusos) || 1),
          dominio_incluso: p.dominio_incluso,
          ativo: p.ativo,
          ordem: i + 1,
          updated_at: new Date().toISOString(),
        }, { onConflict: "codigo" });
        if (error) throw error;
      }
      await carregar();
      toast.success("Planos, valores e ordem atualizados.");
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível salvar os planos.");
    } finally {
      setOcupado(false);
    }
  }

  if (carregando) return <main className="min-h-screen bg-[#f6f4ef] p-6"><div className="mx-auto max-w-6xl">Carregando planos...</div></main>;

  return <main className="min-h-screen bg-[#f6f4ef] text-slate-900">
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <div>
          <button onClick={() => navigate({ to: "/admin" })} className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft size={17}/> Voltar ao Admin</button>
          <h1 className="text-3xl font-bold">Planos da Oricse</h1>
          <p className="mt-1 text-sm text-muted-foreground">Configure cobrança mensal/anual e a ordem exibida no site.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={adicionarPlano} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 font-semibold"><Plus size={17}/> Adicionar plano</button>
          <a href="/planos" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 font-semibold">Ver página <ExternalLink size={16}/></a>
          <button disabled={ocupado} onClick={salvar} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-50"><Save size={17}/> {ocupado ? "Salvando..." : "Salvar"}</button>
        </div>
      </header>

      <div className="mt-6 space-y-5">
        {planos.map((p, i) => <Card key={p.id || p.codigo}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">{i + 1}</span><h2 className="text-xl font-bold">{p.nome}</h2></div>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{p.codigo}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" title="Mover para cima" disabled={i === 0} onClick={() => moverPlano(i, -1)} className="rounded-lg border bg-white p-2 disabled:opacity-30"><ArrowUp size={18}/></button>
              <button type="button" title="Mover para baixo" disabled={i === planos.length - 1} onClick={() => moverPlano(i, 1)} className="rounded-lg border bg-white p-2 disabled:opacity-30"><ArrowDown size={18}/></button>
              <label className="flex items-center gap-2 px-2 text-sm font-semibold"><input type="checkbox" checked={p.ativo} onChange={(e) => alterarPlano(i, { ativo: e.target.checked })}/> Publicado</label>
              <button type="button" disabled={ocupado} onClick={() => void removerPlano(p, i)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"><Trash2 size={16}/> Remover plano</button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold">Nome<input value={p.nome} onChange={(e) => alterarPlano(i, { nome: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label>
            <label className="text-sm font-semibold">Bom para<input value={p.publico_alvo} onChange={(e) => alterarPlano(i, { publico_alvo: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label>

            <div className="rounded-2xl border p-4">
              <label className="flex items-center gap-2 text-base font-bold"><input type="checkbox" checked={p.cobranca_mensal} onChange={(e) => alterarPlano(i, { cobranca_mensal: e.target.checked })}/> Pagamento mensal</label>
              <label className="mt-3 block text-sm font-semibold">Preço mensal<input disabled={!p.cobranca_mensal} value={p.preco_mensal} onChange={(e) => alterarPlano(i, { preco_mensal: e.target.value, preco: e.target.value })} placeholder="R$ 49,90" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal disabled:bg-slate-50 disabled:opacity-60"/></label>
            </div>

            <div className="rounded-2xl border p-4">
              <label className="flex items-center gap-2 text-base font-bold"><input type="checkbox" checked={p.cobranca_anual} onChange={(e) => alterarPlano(i, { cobranca_anual: e.target.checked })}/> Pagamento anual</label>
              <label className="mt-3 block text-sm font-semibold">Preço anual<input disabled={!p.cobranca_anual} value={p.preco_anual} onChange={(e) => alterarPlano(i, { preco_anual: e.target.value })} placeholder="R$ 499,00/ano" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal disabled:bg-slate-50 disabled:opacity-60"/></label>
            </div>

            <label className="text-sm font-semibold md:col-span-2">Descrição<textarea value={p.descricao} onChange={(e) => alterarPlano(i, { descricao: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"/></label>
            <label className="text-sm font-semibold">Usuários inclusos<input type="number" min={1} value={p.usuarios_inclusos} onChange={(e) => alterarPlano(i, { usuarios_inclusos: Number(e.target.value) })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label>
            <label className="flex items-end gap-2 pb-3 text-sm font-semibold"><input type="checkbox" checked={p.dominio_incluso} onChange={(e) => alterarPlano(i, { dominio_incluso: e.target.checked })}/> Domínio próprio incluído</label>
            <label className="text-sm font-semibold md:col-span-2">Recursos · um por linha<textarea value={p.itens.join("\n")} onChange={(e) => alterarPlano(i, { itens: e.target.value.split("\n").filter(Boolean) })} rows={6} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"/></label>
          </div>
        </Card>)}
      </div>
    </div>
  </main>;
}
