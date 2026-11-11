import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabaseBanco } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin-demonstracoes")({
  head: () => ({ meta: [{ title: "Pedidos de demonstração — Admin Oricse" }, { name: "robots", content: "noindex" }] }),
  component: AdminDemonstracoes,
});

type Pedido = { id: string; created_at: string; status: string; nome: string; negocio: string; tipo_negocio: string; cidade: string; uf: string; telefone: string; email: string; possui_sistema: boolean; sistema_atual: string | null; interesses: string[]; mensagem: string | null; logradouro: string | null; numero: string | null; bairro: string | null; cep: string | null };

function AdminDemonstracoes() {
  const [itens, setItens] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  async function carregar() {
    setCarregando(true);
    const { data, error } = await (supabaseBanco as any).from("oricse_solicitacoes_demonstracao").select("*").order("created_at", { ascending: false }).limit(200);
    setCarregando(false);
    if (error) { toast.error("Não foi possível carregar (apenas administradores da plataforma)."); return; }
    setItens(data || []);
  }
  useEffect(() => { void carregar(); }, []);
  async function mudar(id: string, status: string) {
    const { error } = await (supabaseBanco as any).from("oricse_solicitacoes_demonstracao").update({ status }).eq("id", id);
    if (error) { toast.error("Não foi possível atualizar."); return; }
    toast.success("Status atualizado."); void carregar();
  }
  return <main className="min-h-screen bg-background px-4 py-6 sm:px-6"><div className="mx-auto max-w-6xl">
    <Link to="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft size={18} /> Voltar ao Admin</Link>
    <h1 className="mt-6 text-3xl font-bold">Pedidos de demonstração</h1>
    {carregando ? <p className="mt-8 text-muted-foreground">Carregando...</p> : itens.length === 0 ? <p className="mt-8 text-muted-foreground">Nenhum pedido.</p> :
      <section className="mt-6 space-y-4">{itens.map((p) => <article key={p.id} className="rounded-3xl border bg-card p-5 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-xs font-bold uppercase text-primary">{p.status}</span><h2 className="text-xl font-bold">{p.negocio}</h2><p className="text-muted-foreground">{p.tipo_negocio} · {p.cidade}/{p.uf} · {new Date(p.created_at).toLocaleString("pt-BR")}</p></div>
          <select value={p.status} onChange={(e) => void mudar(p.id, e.target.value)} className="rounded-xl border bg-background px-3 py-2">{["novo", "em_contato", "agendado", "concluido", "descartado"].map((s) => <option key={s}>{s}</option>)}</select></div>
        <p className="mt-3">{p.nome} · {p.telefone} · {p.email}</p>
        {(p.logradouro || p.cep) && <p>{[p.logradouro, p.numero, p.bairro, p.cep].filter(Boolean).join(", ")}</p>}
        <p>Sistema atual: {p.possui_sistema ? p.sistema_atual || "sim" : "não"}</p>
        {p.interesses?.length > 0 && <p>Interesses: {p.interesses.join(", ")}</p>}
        {p.mensagem && <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{p.mensagem}</p>}
      </article>)}</section>}
  </div></main>;
}
