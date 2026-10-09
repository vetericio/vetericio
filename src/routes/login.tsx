import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import logoVetericio from "@/assets/vetericio-logo-verde.png";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [primeiroAcesso, setPrimeiroAcesso] = useState<boolean | null>(null);

  useEffect(() => {
    let ativo = true;

    async function verificarPrimeiroAcesso() {
      const { data, error } = await (supabase as any).rpc("vetericio_bootstrap_open");
      if (!ativo) return;
      if (error) {
        console.error("Falha ao verificar primeiro acesso:", error);
        setPrimeiroAcesso(false);
        return;
      }
      setPrimeiroAcesso(Boolean(data));
    }

    void verificarPrimeiroAcesso();
    return () => { ativo = false; };
  }, []);

  async function entrar(event: FormEvent) {
    event.preventDefault();
    const nome = usuario.trim().replace(/^@+/, "").toLowerCase();
    if (!nome || !senha) {
      toast.error("Informe o @usuário e a senha.");
      return;
    }

    setEntrando(true);
    const email = `${nome}@vetericio.local`;

    if (primeiroAcesso) {
      const { data, error } = await supabase.auth.signUp({ email, password: senha });
      if (error) {
        setEntrando(false);
        toast.error(error.message || "Não foi possível criar o acesso inicial.");
        return;
      }

      if (!data.session) {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (loginError) {
          setEntrando(false);
          toast.error("A conta foi criada, mas o acesso ainda não foi liberado. Tente entrar novamente.");
          return;
        }
      }

      setEntrando(false);
      toast.success("Acesso inicial criado com sucesso.");
      navigate({ to: "/" });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setEntrando(false);
    if (error) {
      const mensagem = error.message?.toLowerCase().includes("invalid login credentials")
        ? "@usuário ou senha inválidos."
        : "Não foi possível entrar agora. Verifique a conexão e tente novamente.";
      toast.error(mensagem);
      return;
    }
    navigate({ to: "/" });
  }

  const titulo = primeiroAcesso ? "Criar acesso inicial" : "Entrar";
  const descricao = primeiroAcesso
    ? "Nenhum usuário existe ainda. Crie agora o primeiro acesso de administrador."
    : "Acesse o sistema com seu @usuário.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <form onSubmit={entrar} className="w-full max-w-md rounded-3xl border bg-card p-7 shadow-xl">
        <div className="text-center">
          <img src={logoVetericio} alt="Veterício Serviços Veterinários" className="mx-auto h-auto w-full max-w-[260px] object-contain" />
          <h1 className="mt-5 text-3xl font-bold">{primeiroAcesso === null ? "Carregando..." : titulo}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{primeiroAcesso === null ? "Verificando o acesso do sistema." : descricao}</p>
        </div>

        <label className="mt-7 block text-sm font-semibold">
          @usuário
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            placeholder="@suaclinica"
            autoComplete="username"
            disabled={primeiroAcesso === null}
            className="mt-2 min-h-12 w-full rounded-xl border bg-background px-4 outline-none focus:border-primary disabled:opacity-60"
          />
        </label>

        <label className="mt-4 block text-sm font-semibold">
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder={primeiroAcesso ? "Crie sua senha" : "Sua senha"}
            autoComplete={primeiroAcesso ? "new-password" : "current-password"}
            disabled={primeiroAcesso === null}
            className="mt-2 min-h-12 w-full rounded-xl border bg-background px-4 outline-none focus:border-primary disabled:opacity-60"
          />
        </label>

        <button
          disabled={entrando || primeiroAcesso === null}
          className="mt-6 min-h-12 w-full rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60"
        >
          {entrando ? (primeiroAcesso ? "Criando acesso..." : "Entrando...") : titulo}
        </button>
      </form>
    </main>
  );
}
