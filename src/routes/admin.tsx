import { createFileRoute } from "@tanstack/react-router";
import { Building2, Database, LogOut, Plus, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extrairDriveFolderId } from "@/lib/drive-storage";
import { testarEConectarPastaDrive, voltarAoDrivePadrao } from "@/lib/drive.functions";

export const Route = createFileRoute("/admin")({ component: Admin });

type Clinica = { id: string; nome: string; slug: string | null; status: string };
type DriveConfig = { modo: "oricse" | "personalizado"; root_folder_id: string | null; root_folder_url: string | null; status: string };

function Admin() {
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [selecionada, setSelecionada] = useState<Clinica | null>(null);
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [drive, setDrive] = useState<DriveConfig | null>(null);
  const [pasta, setPasta] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function carregar() {
    const { data, error } = await (supabase as any).from("clinicas").select("id,nome,slug,status").order("nome");
    if (error) return toast.error("Não foi possível carregar as clínicas.");
    setClinicas(data || []);
    if (selecionada) {
      const atual = (data || []).find((c: Clinica) => c.id === selecionada.id);
      if (atual) setSelecionada(atual);
    }
  }

  async function carregarDrive(id: string) {
    const { data } = await (supabase as any).from("clinica_drive_config").select("modo,root_folder_id,root_folder_url,status").eq("clinica_id", id).maybeSingle();
    setDrive(data || { modo: "oricse", root_folder_id: null, root_folder_url: null, status: "pendente" });
    setPasta(data?.root_folder_url || data?.root_folder_id || "");
  }

  useEffect(() => { void carregar(); }, []);
  useEffect(() => { if (selecionada) void carregarDrive(selecionada.id); }, [selecionada?.id]);

  async function criarClinica() {
    if (!nome.trim()) return toast.error("Informe o nome da clínica.");
    setOcupado(true);
    const { data, error } = await (supabase as any).from("clinicas").insert({ nome: nome.trim(), slug: slug.trim() || null }).select("id,nome,slug,status").single();
    setOcupado(false);
    if (error) return toast.error(error.message);
    setNome(""); setSlug(""); setSelecionada(data); await carregar(); toast.success("Clínica criada.");
  }

  async function tokenAtual() {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error("Sessão expirada.");
    return data.session.access_token;
  }

  async function conectarDrive() {
    if (!selecionada) return;
    const folderId = extrairDriveFolderId(pasta);
    if (!folderId) return toast.error("Informe uma pasta válida do Google Drive.");
    setOcupado(true);
    try {
      await testarEConectarPastaDrive({ data: { accessToken: await tokenAtual(), clinicaId: selecionada.id, folderId, folderUrl: pasta } });
      await carregarDrive(selecionada.id);
      toast.success("Drive personalizado conectado.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setOcupado(false); }
  }

  async function usarPadrao() {
    if (!selecionada) return;
    setOcupado(true);
    try {
      await voltarAoDrivePadrao({ data: { accessToken: await tokenAtual(), clinicaId: selecionada.id } });
      await carregarDrive(selecionada.id);
      toast.success("A clínica voltou ao Drive padrão da ORICSE.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setOcupado(false); }
  }

  async function sair() { await supabase.auth.signOut(); window.location.assign("/login"); }

  return <main className="min-h-screen bg-[#f6f4ef] text-slate-900">
    <div className="mx-auto max-w-7xl px-5 py-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div><p className="text-sm font-semibold text-primary">ORICSE Admin</p><h1 className="text-3xl font-bold">Gestão da plataforma</h1></div>
        <button onClick={sair} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 font-semibold"><LogOut size={18}/> Sair</button>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2"><Building2 size={19}/><h2 className="font-bold">Clínicas</h2></div>
            <div className="space-y-2">{clinicas.map(c => <button key={c.id} onClick={()=>setSelecionada(c)} className={`w-full rounded-xl border px-3 py-3 text-left ${selecionada?.id===c.id?"border-primary bg-primary/5":"bg-white"}`}><div className="font-semibold">{c.nome}</div><div className="text-xs text-muted-foreground">{c.slug ? `@${c.slug}` : "Sem identificador"} · {c.status}</div></button>)}</div>
          </section>
          <section className="rounded-2xl border bg-white p-4 shadow-sm">
            <h3 className="font-bold">Nova clínica</h3>
            <input value={nome} onChange={e=>setNome(e.target.value)} placeholder="Nome da clínica" className="mt-3 min-h-11 w-full rounded-xl border px-3"/>
            <input value={slug} onChange={e=>setSlug(e.target.value)} placeholder="@suaclinica" className="mt-2 min-h-11 w-full rounded-xl border px-3"/>
            <button disabled={ocupado} onClick={criarClinica} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground"><Plus size={18}/> Criar clínica</button>
          </section>
        </aside>

        <section>{!selecionada ? <div className="rounded-2xl border bg-white p-8 text-center text-muted-foreground">Selecione ou crie uma clínica.</div> : <div className="space-y-5">
          <div className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-2xl font-bold">{selecionada.nome}</h2><p className="mt-1 text-sm text-muted-foreground">Usuários, plano, financeiro e configurações desta clínica ficarão juntos aqui.</p></div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Database size={20}/><h3 className="text-xl font-bold">Google Drive</h3></div>
            <p className="mt-1 text-sm text-muted-foreground">Por padrão, os arquivos ficam no Drive central da ORICSE. Se esta clínica tiver um Drive próprio, cole a pasta abaixo e conecte.</p>
            <div className="mt-4 rounded-xl border bg-slate-50 p-4"><div className="text-sm font-semibold">Destino atual</div><div className="mt-1 text-lg font-bold">{drive?.modo === "personalizado" ? "Drive personalizado" : "Drive da ORICSE"}</div><div className="text-xs text-muted-foreground">Status: {drive?.status || "pendente"}</div></div>
            <label className="mt-4 block text-sm font-semibold">Pasta do Google Drive<input value={pasta} onChange={e=>setPasta(e.target.value)} placeholder="Cole o link da pasta compartilhada" className="mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"/></label>
            <div className="mt-3 flex flex-wrap gap-2"><button disabled={ocupado} onClick={conectarDrive} className="rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground">Testar e conectar</button><button disabled={ocupado} onClick={usarPadrao} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-semibold"><RefreshCcw size={17}/> Voltar ao Drive da ORICSE</button></div>
          </div>
        </div>}</section>
      </div>
    </div>
  </main>;
}
