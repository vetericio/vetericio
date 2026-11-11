import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Building2, CalendarDays, CheckCircle2, Clock3, Mail, MapPin, MessageSquare, Phone, RefreshCcw, Tag, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabaseBanco } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin-solicitacoes-demonstracao")({ component: AdminSolicitacoesDemonstracao });

type Status = "novo" | "em_contato" | "agendado" | "concluido" | "descartado";
type Solicitacao = {
  id: string;
  created_at: string;
  status: Status;
  nome: string;
  negocio: string;
  tipo_negocio: string;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
  telefone: string;
  email: string;
  possui_sistema: boolean;
  sistema_atual: string | null;
  interesses: string[];
  mensagem: string | null;
};

const STATUS: Array<{ value: Status; label: string }> = [
  { value: "novo", label: "Novo" },
  { value: "em_contato", label: "Em contato" },
  { value: "agendado", label: "Demonstração agendada" },
  { value: "concluido", label: "Concluído" },
  { value: "descartado", label: "Descartado" },
];

function dataHoraBR(valor: string) {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function rotuloStatus(status: Status) {
  return STATUS.find((item) => item.value === status)?.label ?? status;
}

function classeStatus(status: Status) {
  if (status === "novo") return "bg-amber-50 text-amber-800";
  if (status === "em_contato") return "bg-blue-50 text-blue-800";
  if (status === "agendado") return "bg-violet-50 text-violet-800";
  if (status === "concluido") return "bg-emerald-50 text-emerald-800";
  return "bg-slate-100 text-slate-600";
}

function AdminSolicitacoesDemonstracao() {
  const [itens, setItens] = useState<Solicitacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<Status | "todos">("todos");

  async function carregar() {
    setCarregando(true);
    setErro("");
    const { data, error } = await (supabaseBanco as any)
      .from("oricse_solicitacoes_demonstracao")
      .select("id,created_at,status,nome,negocio,tipo_negocio,cep,logradouro,numero,complemento,bairro,cidade,uf,telefone,email,possui_sistema,sistema_atual,interesses,mensagem")
      .order("created_at", { ascending: false });
    setCarregando(false);
    if (error) {
      setErro("Não foi possível carregar as solicitações de demonstração.");
      return;
    }
    setItens((data ?? []) as Solicitacao[]);
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function atualizarStatus(item: Solicitacao, status: Status) {
    if (status === item.status) return;
    setSalvando(item.id);
    const { error } = await (supabaseBanco as any)
      .from("oricse_solicitacoes_demonstracao")
      .update({ status })
      .eq("id", item.id);
    setSalvando(null);
    if (error) {
      toast.error("Não foi possível atualizar o status.");
      return;
    }
    setItens((atuais) => atuais.map((atual) => atual.id === item.id ? { ...atual, status } : atual));
    toast.success("Status atualizado.");
  }

  const itensFiltrados = filtroStatus === "todos" ? itens : itens.filter((item) => item.status === filtroStatus);

  return (
    <main className="min-h-screen bg-[#f6f4ef] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} /> Voltar ao Admin
        </Link>

        <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Comercial</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">Solicitações de demonstração</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">Todos os contatos que solicitaram conhecer o Oricse. Use os dados abaixo para organizar o retorno e o agendamento.</p>
          </div>
          <button type="button" onClick={() => void carregar()} disabled={carregando} className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-bold shadow-sm hover:bg-slate-50 disabled:opacity-60">
            <RefreshCcw size={17} className={carregando ? "animate-spin" : ""} /> Atualizar
          </button>
        </header>

        <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3 shadow-sm" aria-label="Filtrar solicitações por status">
          <span className="mr-1 text-sm font-black">Status:</span>
          <button
            type="button"
            aria-pressed={filtroStatus === "todos"}
            onClick={() => setFiltroStatus("todos")}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-bold transition ${filtroStatus === "todos" ? "bg-primary text-primary-foreground shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            Todos <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs">{itens.length}</span>
          </button>
          {STATUS.map((status) => {
            const quantidade = itens.filter((item) => item.status === status.value).length;
            const ativo = filtroStatus === status.value;
            return (
              <button
                key={status.value}
                type="button"
                aria-pressed={ativo}
                onClick={() => setFiltroStatus(status.value)}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-bold transition ${ativo ? "bg-primary text-primary-foreground shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                {status.label} <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs">{quantidade}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Total</p><p className="mt-1 text-2xl font-black">{itens.length}</p></div>
          <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Novos</p><p className="mt-1 text-2xl font-black text-amber-700">{itens.filter((item) => item.status === "novo").length}</p></div>
          <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Agendados</p><p className="mt-1 text-2xl font-black text-violet-700">{itens.filter((item) => item.status === "agendado").length}</p></div>
        </div>

        {erro && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800" role="alert">{erro} <button type="button" onClick={() => void carregar()} className="ml-2 underline">Tentar novamente</button></div>}

        {carregando ? (
          <div className="mt-8 rounded-3xl border bg-white p-10 text-center text-muted-foreground"><RefreshCcw className="mx-auto animate-spin" size={22} /><p className="mt-3">Carregando solicitações...</p></div>
        ) : !erro && itensFiltrados.length === 0 ? (
          <div className="mt-8 rounded-3xl border bg-white p-10 text-center shadow-sm">
            <Clock3 className="mx-auto text-muted-foreground" size={28} />
            <h2 className="mt-3 text-xl font-bold">{itens.length === 0 ? "Nenhuma solicitação ainda" : "Nenhuma solicitação neste status"}</h2>
            <p className="mt-2 text-muted-foreground">{itens.length === 0 ? "Quando alguém preencher o formulário de demonstração, o pedido aparecerá aqui." : "Escolha outro status acima para visualizar outras solicitações."}</p>
          </div>
        ) : (
          <section className="mt-8 space-y-5">
            {itensFiltrados.map((item) => (
              <article key={item.id} className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${classeStatus(item.status)}`}><CheckCircle2 size={14} /> {rotuloStatus(item.status)}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays size={14} /> {dataHoraBR(item.created_at)}</span>
                    </div>
                    <h2 className="mt-3 text-2xl font-black">{item.nome}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground"><Building2 size={15} /> {item.negocio} · {item.tipo_negocio}</p>
                  </div>
                  <label className="text-sm font-bold">
                    Atualizar status
                    <select value={item.status} disabled={salvando === item.id} onChange={(event) => void atualizarStatus(item, event.target.value as Status)} className="mt-1 min-h-11 min-w-52 rounded-xl border bg-white px-3 font-normal">
                      {STATUS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                    </select>
                  </label>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl bg-[#fff8f3] p-4 text-sm">
                    <h3 className="font-black">Contato</h3>
                    <a href={`mailto:${item.email}`} className="mt-3 flex items-start gap-2 break-all hover:underline"><Mail size={16} className="mt-0.5 shrink-0 text-primary" /> {item.email}</a>
                    <a href={`tel:${item.telefone}`} className="mt-2 flex items-start gap-2 hover:underline"><Phone size={16} className="mt-0.5 shrink-0 text-primary" /> {item.telefone}</a>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm">
                    <h3 className="font-black">Localização</h3>
                    <p className="mt-3 flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-primary" /> {item.cidade}/{item.uf}</p>
                    {(item.logradouro || item.numero || item.bairro || item.cep) && <p className="mt-2 text-muted-foreground">{[item.logradouro, item.numero].filter(Boolean).join(", ")}{item.complemento ? ` · ${item.complemento}` : ""}{item.bairro ? ` · ${item.bairro}` : ""}{item.cep ? ` · CEP ${item.cep}` : ""}</p>}
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm">
                    <h3 className="font-black">Contexto</h3>
                    <p className="mt-3">Possui sistema: <strong>{item.possui_sistema ? "Sim" : "Não"}</strong></p>
                    {item.sistema_atual && <p className="mt-1 text-muted-foreground">Sistema atual: {item.sistema_atual}</p>}
                  </div>
                </div>

                {(item.interesses?.length || item.mensagem) && (
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {item.interesses?.length > 0 && <div className="rounded-2xl border p-4 text-sm"><h3 className="flex items-center gap-2 font-black"><Tag size={16} className="text-primary" /> Interesses</h3><div className="mt-3 flex flex-wrap gap-2">{item.interesses.map((interesse) => <span key={interesse} className="rounded-full bg-[#f9eee8] px-3 py-1.5 text-xs font-semibold text-primary">{interesse}</span>)}</div></div>}
                    {item.mensagem && <div className="rounded-2xl border p-4 text-sm"><h3 className="flex items-center gap-2 font-black"><MessageSquare size={16} className="text-primary" /> Mensagem</h3><p className="mt-3 whitespace-pre-wrap leading-relaxed text-muted-foreground">{item.mensagem}</p></div>}
                  </div>
                )}

                <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><UserRound size={14} /> ID da solicitação: {item.id}</p>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
