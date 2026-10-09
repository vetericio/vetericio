import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import logoVetericio from "@/assets/vetericio-logo-verde.png";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [entrando, setEntrando] = useState(false);

  async function entrar(event: FormEvent) {
    event.preventDefault();
    const nome = usuario.trim().replace(/^@+/, "").toLowerCase();
    if (!nome || !senha) { toast.error("Informe o @usuário e a senha."); return; }
    setEntrando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: `${nome}@vetericio.local`, password: senha });
    setEntrando(false);
    if (error) { toast.error("@usuário ou senha inválidos."); return; }
    navigate({ to: "/" });
  }

  return <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10"><form onSubmit={entrar} className="w-full max-w-md rounded-3xl border bg-card p-7 shadow-xl"><div className="text-center"><img src={logoVetericio} alt="Veterício Serviços Veterinários" className="mx-auto h-auto w-full max-w-[260px] object-contain" /><h1 className="mt-5 text-3xl font-bold">Entrar</h1><p className="mt-2 text-sm text-muted-foreground">Acesse o sistema com seu @usuário.</p></div><label className="mt-7 block text-sm font-semibold">@usuário<input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="@vetadmin27" autoComplete="username" className="mt-2 min-h-12 w-full rounded-xl border bg-background px-4 outline-none focus:border-primary" /></label><label className="mt-4 block text-sm font-semibold">Senha<input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Sua senha" autoComplete="current-password" className="mt-2 min-h-12 w-full rounded-xl border bg-background px-4 outline-none focus:border-primary" /></label><button disabled={entrando} className="mt-6 min-h-12 w-full rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60">{entrando ? "Entrando..." : "Entrar"}</button></form></main>;
}
