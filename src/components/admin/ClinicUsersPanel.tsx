import { KeyRound, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { criarUsuarioClinica, redefinirSenhaUsuario } from "@/lib/admin-users.functions";

type PapelClinica = "rt" | "veterinario" | "auxiliar_estagiario" | "recepcao";

type PerfilInfo = {
  nome: string;
  resumo: string;
  acessos: string[];
  bloqueios: string[];
};

type Usuario = {
  user_id: string;
  username: string;
  email?: string | null;
};

type Vinculo = {
  clinica_id: string;
  user_id: string;
  papel: PapelClinica;
  ativo: boolean;
};

type Props = {
  clinica: { id: string; nome: string; limite_usuarios: number };
  usuariosDaClinica: Array<{ vinculo: Vinculo; usuario?: Usuario }>;
  perfis: Record<PapelClinica, PerfilInfo>;
  onAtualizarVinculo: (vinculo: Vinculo, mudancas: Partial<Vinculo>) => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
};

function limparUsuario(valor: string) {
  return valor.replace(/^@+/, "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9._-]/g, "");
}

export function ClinicUsersPanel({ clinica, usuariosDaClinica, perfis, onAtualizarVinculo, onRefresh }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<PapelClinica>("veterinario");
  const [salvando, setSalvando] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  async function tokenAtual() {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error("Sessão expirada.");
    return data.session.access_token;
  }

  async function criar() {
    const nome = limparUsuario(username);
    if (nome.length < 3) return toast.error("Informe um @usuário com pelo menos 3 caracteres.");
    if (password.length < 6) return toast.error("A senha deve ter pelo menos 6 caracteres.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return toast.error("Informe um e-mail válido.");

    setSalvando(true);
    try {
      await criarUsuarioClinica({
        data: {
          accessToken: await tokenAtual(),
          clinicaId: clinica.id,
          username: nome,
          password,
          email: email.trim().toLowerCase(),
          papel,
        },
      });
      setUsername("");
      setPassword("");
      setEmail("");
      setPapel("veterinario");
      await onRefresh();
      toast.success("Usuário criado e vinculado à clínica.");
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível criar o usuário.");
    } finally {
      setSalvando(false);
    }
  }

  async function alterarSenha(userId: string) {
    if (resetPassword.length < 6) return toast.error("A nova senha deve ter pelo menos 6 caracteres.");
    setSalvando(true);
    try {
      await redefinirSenhaUsuario({ data: { accessToken: await tokenAtual(), userId, password: resetPassword } });
      setResetUserId(null);
      setResetPassword("");
      toast.success("Senha atualizada.");
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível alterar a senha.");
    } finally {
      setSalvando(false);
    }
  }

  const ativos = usuariosDaClinica.filter((x) => x.vinculo.ativo).length;

  return <div className="space-y-5">
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Usuários · {clinica.nome}</h2>
          <p className="text-sm text-muted-foreground">{ativos} de {clinica.limite_usuarios} vagas em uso.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {usuariosDaClinica.length === 0 && <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Nenhum usuário vinculado a esta clínica.</div>}
        {usuariosDaClinica.map(({ vinculo, usuario }) => <div key={vinculo.user_id} className="rounded-xl border p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_120px] lg:items-center">
            <div>
              <div className="font-semibold">@{usuario?.username || "usuário"}</div>
              <div className="mt-1 text-sm text-muted-foreground">{usuario?.email || "E-mail não cadastrado"}</div>
              <div className="mt-1 text-xs text-muted-foreground">{perfis[vinculo.papel]?.resumo}</div>
            </div>
            <select value={vinculo.papel} onChange={(e) => void onAtualizarVinculo(vinculo, { papel: e.target.value as PapelClinica })} className="min-h-10 rounded-xl border px-3 text-sm">
              {Object.entries(perfis).map(([id, p]) => <option key={id} value={id}>{p.nome}</option>)}
            </select>
            <button onClick={() => void onAtualizarVinculo(vinculo, { ativo: !vinculo.ativo })} className={`rounded-xl px-3 py-2 text-sm font-semibold ${vinculo.ativo ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{vinculo.ativo ? "Ativo" : "Inativo"}</button>
          </div>
          <div className="mt-3 border-t pt-3">
            {resetUserId === vinculo.user_id ? <div className="flex flex-wrap gap-2">
              <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Nova senha" className="min-h-10 min-w-[220px] flex-1 rounded-xl border px-3" />
              <button disabled={salvando} onClick={() => void alterarSenha(vinculo.user_id)} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">Salvar nova senha</button>
              <button onClick={() => { setResetUserId(null); setResetPassword(""); }} className="rounded-xl border px-4 py-2 text-sm font-semibold">Cancelar</button>
            </div> : <button onClick={() => { setResetUserId(vinculo.user_id); setResetPassword(""); }} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"><KeyRound size={15}/> Alterar senha</button>}
          </div>
        </div>)}
      </div>
    </section>

    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2"><UserPlus size={20}/><h3 className="font-bold">Criar e vincular pessoa</h3></div>
      <p className="mt-1 text-sm text-muted-foreground">Crie o acesso e já vincule a pessoa a esta clínica.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold">@usuário<div className="mt-1 flex min-h-11 items-center rounded-xl border px-3 font-normal"><span className="text-muted-foreground">@</span><input value={username} onChange={(e) => setUsername(limparUsuario(e.target.value))} placeholder="usuario" className="min-w-0 flex-1 bg-transparent outline-none" autoComplete="off" /></div></label>
        <label className="text-sm font-semibold">Senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha inicial" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" autoComplete="new-password" /></label>
        <label className="text-sm font-semibold">E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@email.com" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" /></label>
        <label className="text-sm font-semibold">Cargo<select value={papel} onChange={(e) => setPapel(e.target.value as PapelClinica)} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">{Object.entries(perfis).map(([id, p]) => <option key={id} value={id}>{p.nome}</option>)}</select></label>
      </div>
      <button disabled={salvando} onClick={() => void criar()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-60"><UserPlus size={17}/>{salvando ? "Criando..." : "Criar e vincular usuário"}</button>

      <div className="mt-5 grid gap-3 md:grid-cols-2">{Object.entries(perfis).map(([id, p]) => <div key={id} className={`rounded-xl border p-4 ${papel === id ? "border-primary bg-primary/5" : ""}`}><div className="font-bold">{p.nome}</div><p className="mt-1 text-sm text-muted-foreground">{p.resumo}</p><div className="mt-3 text-xs"><strong>Acesso:</strong> {p.acessos.join(" · ")}</div>{p.bloqueios.length > 0 && <div className="mt-2 text-xs text-muted-foreground"><strong>Sem acesso:</strong> {p.bloqueios.join(" · ")}</div>}</div>)}</div>
    </section>
  </div>;
}
