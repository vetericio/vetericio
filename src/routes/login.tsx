import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, AtSign } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { supabase, supabaseConfigurado, supabaseMensagemConfiguracao } from "@/integrations/supabase/client";
import { useSiteBranding } from "@/hooks/useSiteBranding";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const { marca, logo_url } = useSiteBranding();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  async function entrar(event: FormEvent) {
    event.preventDefault();
    const nome = usuario.trim().replace(/^@+/, "").toLowerCase();
    if (!nome || !senha) {
      toast.error("Informe o @usuário e a senha.");
      return;
    }

    if (!supabaseConfigurado) {
      toast.error(supabaseMensagemConfiguracao);
      return;
    }

    setEntrando(true);
    const email = `${nome}@vetericio.local`;
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password: senha });

    if (!loginError) {
      setEntrando(false);
      navigate({ to: "/inicio" });
      return;
    }

    setEntrando(false);
    toast.error("@usuário ou senha inválidos.");
  }

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#FBF7F2] px-4 py-8 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-[#C59A5C]/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -right-32 h-[32rem] w-[32rem] rounded-full bg-[#6F293B]/10 blur-3xl" />
      <div className="relative w-full max-w-[1000px]">
        <Link to="/" className="mb-5 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-white hover:text-foreground">
          <ArrowLeft size={16} /> Voltar ao site
        </Link>
        <div className="grid overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_30px_100px_-45px_rgba(111,41,59,0.28)] md:grid-cols-[0.92fr_1.08fr]">
          <section className="relative hidden flex-col justify-between overflow-hidden bg-[#4A1826] p-9 text-white md:flex lg:p-12">
            <div aria-hidden="true" className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10" />
            <div aria-hidden="true" className="absolute -right-12 -top-12 h-48 w-48 rounded-full border border-white/10" />
            <div className="relative">
              <img src={logo_url} alt={`${marca}`} className="h-36 w-auto max-w-[320px] object-contain object-left brightness-0 invert lg:h-40 lg:max-w-[360px]" />
              <h1 className="mt-14 font-display text-4xl font-semibold leading-tight lg:text-[2.7rem]">
                A rotina da sua clínica, em boas mãos.
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-6 text-[#FBF7F2]/80">
                Acesse seus atendimentos, pacientes e ferramentas clínicas em um só lugar.
              </p>
            </div>
            <p className="relative text-xs text-[#FBF7F2]/70">Acesso seguro e exclusivo para sua equipe.</p>
          </section>

          <form onSubmit={entrar} className="flex min-h-[540px] flex-col justify-center p-6 sm:p-10 lg:p-14">
            <div className="mb-8 md:hidden">
              <img src={logo_url} alt={marca} className="mx-auto h-24 w-auto max-w-[280px] object-contain" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Bem-vindo de volta</p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground">Acesse sua conta</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Entre com os dados da sua clínica para continuar.</p>
            </div>

            <label className="mt-8 block text-sm font-semibold text-foreground">
              Usuário da clínica
              <span className="mt-2 flex min-h-12 items-center rounded-xl border border-border bg-[#FBF7F2] px-3 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
                <AtSign aria-hidden="true" size={18} className="shrink-0 text-muted-foreground" />
                <input
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="@nomedaclinica"
                  autoComplete="username"
                  aria-label="@nomedaclinica"
                  className="h-11 min-w-0 flex-1 bg-transparent px-2 outline-none placeholder:text-muted-foreground/60"
                />
              </span>
            </label>

            <label className="mt-5 block text-sm font-semibold text-foreground">
              Senha
              <span className="mt-2 flex min-h-12 items-center rounded-xl border border-border bg-[#FBF7F2] px-3 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
                <LockKeyhole aria-hidden="true" size={18} className="shrink-0 text-muted-foreground" />
                <input
                  type={mostrarSenha ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  className="h-11 min-w-0 flex-1 bg-transparent px-2 outline-none placeholder:text-muted-foreground/60"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((visivel) => !visivel)}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            <button disabled={entrando} className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60">
              {entrando ? "Entrando..." : <>Entrar na Oricse <ArrowRight size={17} /></>}
            </button>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Ainda não tem um plano?{" "}
              <Link to="/planos" className="font-semibold text-primary hover:underline">Conheça as opções</Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
