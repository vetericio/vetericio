import { KeyRound, Pencil, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { atualizarUsuario, atualizarPerfilPessoa, criarUsuarioClinica, obterPerfilPessoa, redefinirSenhaUsuario, removerUsuarioClinica } from "@/lib/admin-users.functions";
import { UserPermissionsPanel } from "@/components/admin/UserPermissionsPanel";

type PapelClinica = "rt" | "veterinario" | "auxiliar_estagiario" | "recepcao";
type DadosPessoa = {
  nomeCompleto: string;
  crmv: string;
  crmvUf: string;
  cpf: string;
  mapa: string;
  telefone: string;
  endereco: string;
};
const pessoaVazia = (): DadosPessoa => ({
  nomeCompleto: "", crmv: "", crmvUf: "", cpf: "", mapa: "", telefone: "", endereco: "",
});
function CamposPessoa({ value, onChange }: { value: DadosPessoa; onChange: (valor: DadosPessoa) => void }) {
  const atualizar = (campo: keyof DadosPessoa, valor: string) => onChange({ ...value, [campo]: valor });
  const campos: { campo: keyof DadosPessoa; rotulo: string; placeholder: string }[] = [
    {campo:"nomeCompleto",rotulo:"Nome completo *",placeholder:"Nome e sobrenome"},
    {campo:"cpf",rotulo:"CPF",placeholder:"000.000.000-00"},
    {campo:"crmv",rotulo:"CRMV (número)",placeholder:"Número do registro"},
    {campo:"crmvUf",rotulo:"CRMV (UF)",placeholder:"MG"},
    {campo:"mapa",rotulo:"Registro MAPA",placeholder:"Se aplicável"},
    {campo:"telefone",rotulo:"Telefone / WhatsApp",placeholder:"(31) 99999-9999"},
  ];
  return <>
    {campos.map(({campo,rotulo,placeholder}) => <label key={campo} className="text-sm font-semibold">
      {rotulo}
      <input value={value[campo]} onChange={(e) => atualizar(campo, e.target.value)}
        placeholder={placeholder} maxLength={campo==="cpf"?14:undefined}
        className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"
        autoComplete={campo==="nomeCompleto"?"name":campo==="telefone"?"tel":"off"} />
    </label>)}
    <label className="text-sm font-semibold md:col-span-2">
      Endereço
      <input value={value.endereco} onChange={(e) => atualizar("endereco", e.target.value)}
        placeholder="Rua, número, complemento, bairro, cidade, UF e CEP"
        className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" autoComplete="street-address" />
    </label>
  </>;
}

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
  const [editId, setEditId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [pessoa, setPessoa] = useState<DadosPessoa>(pessoaVazia);
  const [editPessoaId, setEditPessoaId] = useState<string | null>(null);
  const [editPessoa, setEditPessoa] = useState<DadosPessoa>(pessoaVazia);
  const [carregandoPessoa, setCarregandoPessoa] = useState(false);

  async function abrirCadastroPessoa(userId: string) {
    setEditPessoaId(userId);
    setCarregandoPessoa(true);
    try {
      const perfil = await obterPerfilPessoa({ data: { accessToken: await tokenAtual(), userId } });
      setEditPessoa({
        nomeCompleto: perfil?.nome_completo || "",
        crmv: perfil?.crmv || "",
        crmvUf: perfil?.crmv_uf || "",
        cpf: perfil?.cpf || "",
        mapa: perfil?.mapa || "",
        telefone: perfil?.telefone || "",
        endereco: perfil?.endereco || "",
      });
    } catch (error) {
      setEditPessoaId(null);
      toast.error((error as Error).message || "Não foi possível carregar o cadastro.");
    } finally {
      setCarregandoPessoa(false);
    }
  }
  async function salvarCadastroPessoa(userId: string) {
    if (editPessoa.nomeCompleto.trim().length < 3) return void toast.error("Informe o nome completo.");
    setSalvando(true);
    try {
      await atualizarPerfilPessoa({ data: { accessToken: await tokenAtual(), userId, pessoa: editPessoa } });
      setEditPessoaId(null);
      toast.success("Cadastro individual atualizado.");
      await onRefresh();
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível salvar o cadastro.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarEdicao(userId: string) {
    const nome = limparUsuario(editUsername);
    if (nome.length < 3) { toast.error("Informe um @usuário com pelo menos 3 caracteres."); return; }
    if (!/^\S+@\S+\.\S+$/.test(editEmail.trim())) { toast.error("Informe um e-mail válido."); return; }
    setSalvando(true);
    try {
      await atualizarUsuario({ data: { accessToken: await tokenAtual(), userId, username: nome, email: editEmail.trim().toLowerCase() } });
      setEditId(null);
      await onRefresh();
      toast.success("Usuário atualizado. O login agora é o novo @usuário.");
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível atualizar o usuário.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(userId: string, nome: string) {
    if (!window.confirm(`Remover ${nome} desta clínica? Se não tiver vínculo com outra clínica, a conta de acesso será excluída. Esta ação é irreversível.`)) return;
    setSalvando(true);
    try {
      const r = await removerUsuarioClinica({ data: { accessToken: await tokenAtual(), clinicaId: clinica.id, userId } });
      await onRefresh();
      toast.success(r.contaExcluida ? "Usuário removido e conta excluída." : "Usuário removido da clínica.");
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível remover o usuário.");
    } finally {
      setSalvando(false);
    }
  }

  async function tokenAtual() {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error("Sessão expirada.");
    return data.session.access_token;
  }

  async function criar() {
    const nome = limparUsuario(username);
    if (nome.length < 3) {
      toast.error("Informe um @usuário com pelo menos 3 caracteres.");
      return;
    }
    if (pessoa.nomeCompleto.trim().length < 3) { toast.error("Informe o nome completo da pessoa."); return; }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error("Informe um e-mail válido.");
      return;
    }

    setSalvando(true);
    try {
      const resultado = await criarUsuarioClinica({
        data: {
          accessToken: await tokenAtual(),
          clinicaId: clinica.id,
          username: nome,
          password,
          email: email.trim().toLowerCase(),
          papel,
          pessoa,
        },
      });
      setUsername("");
      setPassword("");
      setEmail("");
      setPapel("veterinario");
      setPessoa(pessoaVazia());
      await onRefresh();
      toast.success(
        resultado.contaExistente
          ? resultado.vinculoExistente
            ? "Conta existente sincronizada e vínculo confirmado."
            : "Conta existente vinculada à clínica."
          : "Usuário criado e vinculado à clínica.",
      );
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível criar o usuário.");
    } finally {
      setSalvando(false);
    }
  }

  async function alterarSenha(userId: string) {
    if (resetPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
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
              <div className="font-semibold">
                {usuario?.username ? `@${usuario.username}` : "Conta sem perfil sincronizado"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {usuario?.email || (usuario ? "E-mail não cadastrado" : `ID da conta: ${vinculo.user_id}`)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{perfis[vinculo.papel]?.resumo}</div>
            </div>
            <select value={vinculo.papel} onChange={(e) => void onAtualizarVinculo(vinculo, { papel: e.target.value as PapelClinica })} className="min-h-10 rounded-xl border px-3 text-sm">
              {Object.entries(perfis).map(([id, p]) => <option key={id} value={id}>{p.nome}</option>)}
            </select>
            <button onClick={() => void onAtualizarVinculo(vinculo, { ativo: !vinculo.ativo })} className={`rounded-xl px-3 py-2 text-sm font-semibold ${vinculo.ativo ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{vinculo.ativo ? "Ativo" : "Inativo"}</button>
          </div>
          <div className="mt-3 border-t pt-3">
            {editId === vinculo.user_id && <div className="mb-3 grid gap-2 md:grid-cols-2">
              <div className="flex min-h-10 items-center rounded-xl border px-3"><span className="text-muted-foreground">@</span><input value={editUsername} onChange={(e) => setEditUsername(limparUsuario(e.target.value))} placeholder="usuario" className="min-w-0 flex-1 bg-transparent outline-none" autoComplete="off" /></div>
              <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="pessoa@email.com" className="min-h-10 rounded-xl border px-3" />
              <div className="flex gap-2 md:col-span-2">
                <button disabled={salvando} onClick={() => void salvarEdicao(vinculo.user_id)} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">Salvar dados</button>
                <button onClick={() => setEditId(null)} className="rounded-xl border px-4 py-2 text-sm font-semibold">Cancelar</button>
              </div>
            </div>}
            {editPessoaId === vinculo.user_id && <div className="mb-3 rounded-xl border bg-secondary/20 p-4">
              <h4 className="mb-3 font-bold">Cadastro individual da pessoa</h4>
              {carregandoPessoa ? <p className="text-sm text-muted-foreground">Carregando cadastro…</p> : <>
                <div className="grid gap-3 md:grid-cols-2">
                  <CamposPessoa value={editPessoa} onChange={setEditPessoa}/>
                </div>
                <div className="mt-3 flex gap-2">
                  <button disabled={salvando} onClick={() => void salvarCadastroPessoa(vinculo.user_id)}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">Salvar cadastro</button>
                  <button onClick={() => setEditPessoaId(null)} className="rounded-xl border px-4 py-2 text-sm font-semibold">Cancelar</button>
                </div>
              </>}
            </div>}
            <div className="mb-3 flex flex-wrap gap-2">
              <button onClick={() => void abrirCadastroPessoa(vinculo.user_id)}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold">
                <Pencil size={15}/> Cadastro pessoal / CRMV
              </button>
              <button onClick={() => { setEditId(vinculo.user_id); setEditUsername(usuario?.username || ""); setEditEmail(usuario?.email || ""); }} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"><Pencil size={15}/> Editar @usuário e e-mail</button>
              {vinculo.ativo && <UserPermissionsPanel clinicaId={clinica.id} userId={vinculo.user_id} nomeUsuario={usuario?.username ? `@${usuario.username}` : "Usuário"} />}
              <button disabled={salvando} onClick={() => void remover(vinculo.user_id, usuario?.username ? `@${usuario.username}` : "este usuário")} className="inline-flex items-center gap-2 rounded-xl border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"><Trash2 size={15}/> Remover</button>
            </div>
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
      <p className="mt-1 text-xs text-muted-foreground">
        Se o acesso já foi criado, informe o mesmo @usuário para recuperar ou concluir o vínculo sem duplicar a conta. A senha da conta existente não será alterada.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold">@usuário<div className="mt-1 flex min-h-11 items-center rounded-xl border px-3 font-normal"><span className="text-muted-foreground">@</span><input value={username} onChange={(e) => setUsername(limparUsuario(e.target.value))} placeholder="usuario" className="min-w-0 flex-1 bg-transparent outline-none" autoComplete="off" /></div></label>
        <label className="text-sm font-semibold">Senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha inicial" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" autoComplete="new-password" /></label>
        <label className="text-sm font-semibold">E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@email.com" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" /></label>
        <label className="text-sm font-semibold">Cargo<select value={papel} onChange={(e) => setPapel(e.target.value as PapelClinica)} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">{Object.entries(perfis).map(([id, p]) => <option key={id} value={id}>{p.nome}</option>)}</select></label>
        <CamposPessoa value={pessoa} onChange={setPessoa}/>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">CRMV e MAPA são informados quando aplicáveis. Dados pessoais protegidos e vinculados à conta, não à clínica.</p>
      <button disabled={salvando} onClick={() => void criar()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-60"><UserPlus size={17}/>{salvando ? "Criando..." : "Criar e vincular usuário"}</button>

      <div className="mt-5 grid gap-3 md:grid-cols-2">{Object.entries(perfis).map(([id, p]) => <div key={id} className={`rounded-xl border p-4 ${papel === id ? "border-primary bg-primary/5" : ""}`}><div className="font-bold">{p.nome}</div><p className="mt-1 text-sm text-muted-foreground">{p.resumo}</p><div className="mt-3 text-xs"><strong>Acesso:</strong> {p.acessos.join(" · ")}</div>{p.bloqueios.length > 0 && <div className="mt-2 text-xs text-muted-foreground"><strong>Sem acesso:</strong> {p.bloqueios.join(" · ")}</div>}</div>)}</div>
    </section>
  </div>;
}
