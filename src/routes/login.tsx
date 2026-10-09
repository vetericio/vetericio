import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSiteBranding } from "@/hooks/useSiteBranding";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const { marca, logo_url } = useSiteBranding();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [entrando, setEntrando] = useState(false);

  async function entrar(event: FormEvent) {
    event.preventDefault();
    const nome = usuario.trim().replace(/^@+/, "").toLowerCase();
    if (!nome || !senha) {
      toast.error("Informe o @usuário e a senha.");
      return;
    }

    setEntrando(true);
    const email = `${nome}@vetericio.local`;
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password: senha });

    if (!loginError) {
      setEntrando(false);
      navigate({ to: "/" });
      return;
    }

    if (nome === "vetadmin27") {
      const { error: cadastroError } = await supabase.auth.signUp({ email, password: senha });
      if (!cadastroError) {
        const { error: segundoLoginError } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (!segundoLoginError) {
          setEntrando(false);
          navigate({ to: "/" });
          return;
        }
      }
    }

    setEntrando(false);
    toast.error("@usuário ou senha inválidos.");
  }

  return (
    <main className="flex min-h-[100dvh] items-start justify-center overflow-y-auto bg-background px-5 py-6 sm:items-center sm:py-10">
      <form onSubmit={entrar} className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-xl sm:p-7">
        <div className="text-center">
          <div className="mx-auto flex w-full items-center justify-center overflow-visible px-2 pt-2">
            <img src={logo_url} alt={`${marca} — sistema veterinário e petshop`} className="block h-auto max-h-[220px] w-auto max-w-full object-contain" />
          </div>
          <h1 className="mt-4 text-3xl font-bold">Entrar</h1>
          <p className="mt-2 text-sm text-muted-foreground">Acesse a {marca} com seu @usuário.</p>
        </div>

        <label className="mt-7 block text-sm font-semibold">
          @usuário
          <input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="@suaclinica" autoComplete="username" className="mt-2 min-h-12 w-full rounded-xl border bg-background px-4 outline-none focus:border-primary" />
        </label>

        <label className="mt-4 block text-sm font-semibold">
          Senha
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Sua senha" autoComplete="current-password" className="mt-2 min-h-12 w-full rounded-xl border bg-background px-4 outline-none focus:border-primary" />
        </label>

        <button disabled={entrando} className="mt-6 min-h-12 w-full rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60">
          {entrando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
