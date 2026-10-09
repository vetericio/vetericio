import { createFileRoute } from "@tanstack/react-router";
import { Building2, Database, ExternalLink, LogOut, Plus, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extrairDriveFolderId } from "@/lib/drive-storage";
import { testarEConectarPastaDrive } from "@/lib/drive.functions";
import { garantirPastaOricse } from "@/lib/drive-default.functions";

export const Route = createFileRoute("/admin")({ component: Admin });

type Clinica = { id: string; nome: string; slug: string | null; status: string };
type DriveConfig = { modo: "oricse" | "personalizado"; root_folder_id: string | null; root_folder_url: string | null; status: string };

function limparSlug(valor: string) {
  return valor
    .replace(/@/g, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

function Admin() {
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [selecionada, setSelecionada] = useState<Clinica | null>(null);
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [drive, setDrive] = useState<DriveConfig | null>(null);
  const [pasta, setPasta] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function tokenAtual() {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error("Sessão expirada.");
    return data.session.access_token;
  }

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
    const buscar = async () => {
      const { data } = await (supabase as any)
        .from("clinica_drive_config")
        .select("modo,root_folder_id,root_folder_url,status")
        .eq("clinica_id", id)
        .maybeSingle();
      return data as DriveConfig | null;
    };

    let data = await buscar();
    if ((!data || (data.modo === "oricse" && !data.root_folder_id)) && !ocupado) {
      try {
        await garantirPastaOricse({ data: { accessToken: await tokenAtual(), clinicaId: id } });
        data = await buscar();
      } catch (e) {
        console.error("Falha ao preparar pasta padrão da clínica:", e);
      }
    }

    setDrive(data || { modo: "oricse", root_folder_id: null, root_folder_url: null, status: "pendente" });
    setPasta(data?.modo === "personalizado" ? (data.root_folder_url || data.root_folder_id || "") : "");
  }

  useEffect(() => { void carregar(); }, []);
  useEffect(() => { if (selecionada) void carregarDrive(selecionada.id); }, [selecionada?.id]);

  async function criarClinica() {
    if (!nome.trim()) return toast.error("Informe o nome da clínica.");
    const identificador = limparSlug(slug);
    if (!identificador) return toast.error("Informe o @ da clínica.");

    setOcupado(true);
    try {
      const { data, error } = await (supabase as any)
        .from("clinicas")
        .insert({ nome: nome.trim(), slug: identificador })
        .select("id,nome,slug,status")
        .single();
      if (error) throw error;

      await garantirPastaOricse({ data: { accessToken: await tokenAtual(), clinicaId: data.id } });
      setNome("");
      setSlug("");
      setSelecionada(data);
      await carregar();
      await carregarDrive(data.id);
      toast.success("Clínica criada e pasta preparada no Drive da ORICSE.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function conectarDrive() {
    if (!selecionada) return;
    if (!pasta.trim()) return usarPadrao();

    const folderId = extrairDriveFolderId(pasta);
    if (!folderId) return toast.error("Informe uma pasta válida do Google Drive.");
    setOcupado(true);
    try {
      await testarEConectarPastaDrive({ data: { accessToken: await tokenAtual(), clinicaId: selecionada.id, folderId, folderUrl: pasta } });
      await carregarDrive(selecionada.id);
      toast.success("Drive personalizado conectado.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function usarPadrao() {
    if (!selecionada) return;
    setOcupado(true);
    try {
      await garantirPastaOricse({ data: { accessToken: await tokenAtual(), clinicaId: selecionada.id } });
      await carregarDrive(selecionada.id);
      toast.success("Pasta da clínica pronta no Drive da ORICSE.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function sair() {
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

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
            <div className="space-y-2">
              {clinicas.map(c => {
                const identificador = limparSlug(c.slug || "");
                return <button key={c.id} onClick={()=>setSelecionada(c)} className={`w-full rounded-xl border px-3 py-3 text-left ${selecionada?.id===c.id?"border-primary bg-primary/5":"bg-white"}`}>
                  <div className="font-semibold">{c.nome}</div>
                  <div className="text-xs text-muted-foreground">{identificador ? `@${identificador}` : "Sem identificador"} · {c.status}</div>
                </button>;
              })}
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-4 shadow-sm">
            <h3 className="font-bold">Nova clínica</h3>
            <input value={nome} onChange={e=>setNome(e.target.value)} placeholder="Nome da clínica" className="mt-3 min-h-11 w-full rounded-xl border px-3"/>
            <div className="mt-2 flex min-h-11 w-full items-center rounded-xl border bg-white px-3 focus-within:border-primary">
              <span className="select-none font-semibold text-slate-500">@</span>
              <input
                value={slug}
                onChange={e=>setSlug(limparSlug(e.target.value))}
                placeholder="suaclinica"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent pl-0.5 outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">O @ já é fixo. Mesmo que você cole outro @, ele será removido.</p>
            <button disabled={ocupado} onClick={criarClinica} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60"><Plus size={18}/> Criar clínica</button>
          </section>
        </aside>

        <section>{!selecionada ? <div className="rounded-2xl border bg-white p-8 text-center text-muted-foreground">Selecione ou crie uma clínica.</div> : <div className="space-y-5">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-bold">{selecionada.nome}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Usuários, plano, financeiro e configurações desta clínica ficarão juntos aqui.</p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Database size={20}/><h3 className="text-xl font-bold">Google Drive</h3></div>
            <p className="mt-1 text-sm text-muted-foreground">Se nenhuma pasta personalizada for informada, a ORICSE cria automaticamente uma pasta para esta clínica dentro do Drive central.</p>

            <div className="mt-4 rounded-xl border bg-slate-50 p-4">
              <div className="text-sm font-semibold">Destino atual</div>
              <div className="mt-1 text-lg font-bold">{drive?.modo === "personalizado" ? "Drive personalizado" : "Drive da ORICSE"}</div>
              <div className="text-xs text-muted-foreground">Status: {drive?.status || "pendente"}</div>
              {drive?.modo === "oricse" && drive.root_folder_url && <a href={drive.root_folder_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary underline underline-offset-2">Abrir pasta da clínica <ExternalLink size={14}/></a>}
            </div>

            <label className="mt-4 block text-sm font-semibold">
              Pasta personalizada do Google Drive
              <input value={pasta} onChange={e=>setPasta(e.target.value)} placeholder="Opcional: cole o link de uma pasta própria da clínica" className="mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"/>
            </label>
            <p className="mt-1 text-[11px] text-muted-foreground">Deixe em branco para usar a pasta criada automaticamente pela ORICSE.</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={ocupado} onClick={conectarDrive} className="rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60">{pasta.trim() ? "Testar e conectar" : "Criar/usar pasta da ORICSE"}</button>
              <button disabled={ocupado} onClick={usarPadrao} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-semibold disabled:opacity-60"><RefreshCcw size={17}/> Usar Drive da ORICSE</button>
            </div>
          </div>
        </div>}</section>
      </div>
    </div>
  </main>;
}
