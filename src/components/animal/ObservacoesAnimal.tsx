import { Clock3, Eye, Pencil, Plus, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Registro = {
  id: string;
  animalId: string;
  tipo: string;
  titulo: string;
  detalhe?: string;
  data: string;
  criadoEm: string;
  subtipo?: string;
  autorId?: string;
  autorNome?: string;
  autorCrmv?: string;
  atualizadoEm?: string;
};

type UsuarioAtual = {
  id: string;
  nome: string;
  crmv: string;
};

const PRONTUARIO_KEY = "oricse-prontuario-animal-v1";

function formatarDataHora(valor?: string) {
  if (!valor) return "Data não informada";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

function identificarUsuario(user: any, perfil?: any): UsuarioAtual {
  const meta = user?.user_metadata || {};
  const nome =
    meta.nome ||
    meta.full_name ||
    meta.name ||
    perfil?.username ||
    perfil?.email ||
    user?.email ||
    "Usuário";

  const crmvBase = meta.crmv || meta.responsavel_crmv || meta.crm_v || "";
  const uf = meta.crmv_uf || meta.responsavel_crmv_uf || "";
  const crmv = crmvBase
    ? `${String(crmvBase).toUpperCase().startsWith("CRMV") ? crmvBase : `CRMV${uf ? `-${uf}` : ""} ${crmvBase}`}`
    : "CRMV não informado";

  return { id: user.id, nome: String(nome), crmv: String(crmv) };
}

export function ObservacoesAnimal({
  animalId,
  registros,
  onChange,
}: {
  animalId: string;
  registros: Registro[];
  onChange: (registros: Registro[]) => void;
}) {
  const [usuario, setUsuario] = useState<UsuarioAtual | null>(null);
  const [carregandoUsuario, setCarregandoUsuario] = useState(true);
  const [modal, setModal] = useState<"novo" | "editar" | "visualizar" | null>(null);
  const [selecionado, setSelecionado] = useState<Registro | null>(null);
  const [titulo, setTitulo] = useState("");
  const [detalhe, setDetalhe] = useState("");

  useEffect(() => {
    let ativo = true;
    async function carregarUsuario() {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user) return;
        let perfil: any = null;
        try {
          const resposta = await (supabase as any)
            .from("app_users")
            .select("username,email")
            .eq("user_id", user.id)
            .maybeSingle();
          perfil = resposta.data;
        } catch {
          perfil = null;
        }
        if (ativo) setUsuario(identificarUsuario(user, perfil));
      } finally {
        if (ativo) setCarregandoUsuario(false);
      }
    }
    void carregarUsuario();
    return () => { ativo = false; };
  }, []);

  const observacoes = useMemo(
    () => registros
      .filter((r) => r.animalId === animalId && r.tipo === "Observações")
      .sort((a, b) => (b.criadoEm || b.data).localeCompare(a.criadoEm || a.data)),
    [registros, animalId],
  );

  function persistir(proximos: Registro[]) {
    onChange(proximos);
    localStorage.setItem(PRONTUARIO_KEY, JSON.stringify(proximos));
  }

  function abrirNovo() {
    if (!usuario) {
      toast.error("Não foi possível identificar o usuário logado.");
      return;
    }
    setSelecionado(null);
    setTitulo("");
    setDetalhe("");
    setModal("novo");
  }

  function abrirVisualizar(registro: Registro) {
    setSelecionado(registro);
    setModal("visualizar");
  }

  function abrirEditar(registro: Registro) {
    if (!usuario || registro.autorId !== usuario.id) return;
    setSelecionado(registro);
    setTitulo(registro.titulo);
    setDetalhe(registro.detalhe || "");
    setModal("editar");
  }

  function salvar() {
    if (!usuario) return toast.error("Usuário não identificado.");
    if (!titulo.trim()) return toast.error("Informe o título da observação.");
    if (!detalhe.trim()) return toast.error("Escreva a observação.");

    if (modal === "editar" && selecionado) {
      if (selecionado.autorId !== usuario.id) return toast.error("Somente o autor pode editar esta observação.");
      const agora = new Date().toISOString();
      const lista = registros.map((r) => r.id === selecionado.id ? {
        ...r,
        titulo: titulo.trim(),
        detalhe: detalhe.trim(),
        atualizadoEm: agora,
      } : r);
      persistir(lista);
      setModal(null);
      setSelecionado(null);
      toast.success("Observação atualizada.");
      return;
    }

    const agora = new Date();
    const novo: Registro = {
      id: crypto.randomUUID(),
      animalId,
      tipo: "Observações",
      titulo: titulo.trim(),
      detalhe: detalhe.trim(),
      data: agora.toISOString().slice(0, 10),
      criadoEm: agora.toISOString(),
      autorId: usuario.id,
      autorNome: usuario.nome,
      autorCrmv: usuario.crmv,
    };
    persistir([novo, ...registros]);
    setModal(null);
    setTitulo("");
    setDetalhe("");
    toast.success("Observação adicionada.");
  }

  function excluir(registro: Registro) {
    if (!usuario || registro.autorId !== usuario.id) {
      toast.error("Somente o autor pode excluir esta observação.");
      return;
    }
    if (!window.confirm("Deseja excluir esta observação?")) return;
    persistir(registros.filter((r) => r.id !== registro.id));
    toast.success("Observação excluída.");
  }

  return <>
    <section className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-4 sm:px-5">
        <div>
          <div className="flex items-center gap-2"><ClipboardIcon/><h2 className="text-xl font-black">Observações</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">Anotações do prontuário com autoria, CRMV, data e hora.</p>
        </div>
        <button type="button" onClick={abrirNovo} disabled={carregandoUsuario} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"><Plus size={16}/> Adicionar</button>
      </div>

      <div className="p-4 sm:p-5">
        {observacoes.length ? <div className="grid gap-3 xl:grid-cols-2">
          {observacoes.map((registro) => {
            const podeAlterar = Boolean(usuario?.id && registro.autorId === usuario.id);
            const autor = registro.autorNome || "Autor não identificado";
            const crmv = registro.autorCrmv || "Registro anterior · CRMV não informado";
            return <article key={registro.id} className="group overflow-hidden rounded-2xl border bg-white transition hover:border-primary/35 hover:shadow-sm">
              <button type="button" onClick={() => abrirVisualizar(registro)} className="block w-full p-4 text-left sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-black text-foreground">{registro.titulo}</h3>
                    {registro.detalhe && <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{registro.detalhe}</p>}
                  </div>
                  <Eye size={18} className="mt-0.5 shrink-0 text-muted-foreground"/>
                </div>
              </button>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/15 px-4 py-3 sm:px-5">
                <div className="min-w-0 text-xs text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground"><UserRound size={13}/>{autor}</span>
                    <span>·</span><span>{crmv}</span>
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1"><Clock3 size={12}/>{formatarDataHora(registro.criadoEm)}{registro.atualizadoEm ? ` · editado ${formatarDataHora(registro.atualizadoEm)}` : ""}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => abrirVisualizar(registro)} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-bold"><Eye size={14}/> Visualizar</button>
                  {podeAlterar && <>
                    <button type="button" onClick={() => abrirEditar(registro)} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-primary"><Pencil size={14}/> Editar</button>
                    <button type="button" onClick={() => excluir(registro)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700"><Trash2 size={14}/> Excluir</button>
                  </>}
                </div>
              </div>
            </article>;
          })}
        </div> : <div className="py-16 text-center text-muted-foreground"><ClipboardIcon className="mx-auto mb-3 opacity-25"/><p className="font-semibold">Nenhuma observação registrada.</p><p className="mt-1 text-sm">As novas observações mostrarão automaticamente autor, CRMV, data e hora.</p></div>}
      </div>
    </section>

    {(modal === "novo" || modal === "editar") && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onMouseDown={(e) => { if (e.currentTarget === e.target) setModal(null); }}>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Observações</p><h2 className="text-2xl font-black">{modal === "editar" ? "Editar observação" : "Nova observação"}</h2>{usuario && <p className="mt-1 text-xs text-muted-foreground">{usuario.nome} · {usuario.crmv} · data e hora serão registradas automaticamente</p>}</div>
          <button type="button" onClick={() => setModal(null)} className="rounded-lg p-2 hover:bg-muted"><X/></button>
        </div>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-bold">Título<input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Orientação ao tutor" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label>
          <label className="block text-sm font-bold">Observação<textarea value={detalhe} onChange={(e) => setDetalhe(e.target.value)} rows={8} placeholder="Escreva a observação completa..." className="mt-1 w-full rounded-xl border p-3 font-normal leading-6"/></label>
        </div>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setModal(null)} className="rounded-xl border px-4 py-2.5 font-bold">Cancelar</button><button type="button" onClick={salvar} className="rounded-xl bg-primary px-5 py-2.5 font-bold text-primary-foreground">{modal === "editar" ? "Salvar alterações" : "Salvar observação"}</button></div>
      </div>
    </div>}

    {modal === "visualizar" && selecionado && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onMouseDown={(e) => { if (e.currentTarget === e.target) setModal(null); }}>
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b bg-muted/20 p-5"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Observação</p><h2 className="mt-1 text-2xl font-black">{selecionado.titulo}</h2></div><button type="button" onClick={() => setModal(null)} className="rounded-lg p-2 hover:bg-muted"><X/></button></div>
        <div className="p-5"><p className="whitespace-pre-wrap text-sm leading-7 text-foreground">{selecionado.detalhe || "Sem detalhes."}</p></div>
        <div className="border-t bg-muted/15 p-5 text-sm">
          <div className="font-bold">{selecionado.autorNome || "Autor não identificado"}</div>
          <div className="mt-0.5 text-muted-foreground">{selecionado.autorCrmv || "Registro anterior · CRMV não informado"}</div>
          <div className="mt-2 text-xs text-muted-foreground">Criado em {formatarDataHora(selecionado.criadoEm)}{selecionado.atualizadoEm ? ` · Editado em ${formatarDataHora(selecionado.atualizadoEm)}` : ""}</div>
          {usuario?.id && selecionado.autorId === usuario.id && <div className="mt-4 flex gap-2"><button type="button" onClick={() => abrirEditar(selecionado)} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-primary"><Pencil size={14}/> Editar</button><button type="button" onClick={() => { setModal(null); excluir(selecionado); }} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700"><Trash2 size={14}/> Excluir</button></div>}
        </div>
      </div>
    </div>}
  </>;
}

function ClipboardIcon({ className = "" }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-5 w-5 text-primary ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>;
}
