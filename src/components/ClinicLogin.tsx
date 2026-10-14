import { FormEvent, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import {
  supabase,
  supabaseConfigurado,
  supabaseMensagemConfiguracao,
} from "@/integrations/supabase/client";
import type { ClinicPortalInfo } from "@/lib/tenant-context";

export function ClinicLogin({ clinic }: { clinic: ClinicPortalInfo }) {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  async function entrar(event: FormEvent) {
    event.preventDefault();
    const nome = usuario.trim().replace(/^@+/, "").toLowerCase();
    if (!nome || !senha) return void toast.error("Informe o @usuário e a senha.");
    if (!supabaseConfigurado) return void toast.error(supabaseMensagemConfiguracao);
    setEntrando(true);
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: `${nome}@vetericio.local`,
      password: senha,
    });
    if (loginError) {
      setEntrando(false);
      return void toast.error("@usuário ou senha inválidos.");
    }
    const { data: acesso, error: erroAcesso } = await supabase.rpc(
      "oricse_usuario_pode_acessar_portal",
      { p_clinica_id: clinic.clinica_id },
    );
    if (erroAcesso || !acesso) {
      await supabase.auth.signOut();
      setEntrando(false);
      return void toast.error(
        erroAcesso
          ? "Não foi possível confirmar o acesso desta clínica. Tente novamente."
          : "Este usuário não está vinculado a esta clínica.",
      );
    }
    setEntrando(false);
    await navigate({ to: "/inicio" });
  }

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#f5f7f4] px-4 py-8 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-emerald-200/35 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 -right-32 h-[32rem] w-[32rem] rounded-full bg-teal-100/70 blur-3xl"
      />
      <div className="relative w-full max-w-[470px]">
        <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_30px_100px_-45px_rgba(16,76,63,0.35)]">
          <div className="bg-[#0d5147] px-7 py-8 text-center text-white sm:px-10">
            {clinic.clinica_logo_url ? (
              <img
                src={clinic.clinica_logo_url}
                alt={clinic.clinica_nome}
                className="mx-auto mb-4 max-h-16 max-w-[190px] object-contain"
              />
            ) : (
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-xl font-bold">
                {clinic.clinica_nome.trim().charAt(0).toLocaleUpperCase("pt-BR")}
              </div>
            )}
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">
              Acesso exclusivo
            </p>
            <h1 className="mt-2 text-2xl font-semibold">{clinic.clinica_nome}</h1>
          </div>
          <form onSubmit={entrar} className="p-6 sm:p-9">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              Bem-vindo de volta
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">Entrar na clínica</h2>
            <label className="mt-6 block text-sm font-semibold">
              Usuário
              <span className="mt-1 flex min-h-12 items-center rounded-xl border bg-[#fbfcfa] px-3 focus-within:border-primary">
                <span className="text-muted-foreground">@</span>
                <input
                  value={usuario}
                  onChange={(event) => setUsuario(event.target.value)}
                  placeholder="nomedousuario"
                  autoComplete="username"
                  className="h-11 min-w-0 flex-1 bg-transparent px-2 outline-none"
                />
              </span>
            </label>
            <label className="mt-4 block text-sm font-semibold">
              Senha
              <span className="mt-1 flex min-h-12 items-center rounded-xl border bg-[#fbfcfa] px-3 focus-within:border-primary">
                <LockKeyhole size={17} className="text-muted-foreground" />
                <input
                  type={mostrarSenha ? "text" : "password"}
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  className="h-11 min-w-0 flex-1 bg-transparent px-2 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((value) => !value)}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  className="rounded-md p-2 text-muted-foreground hover:bg-muted"
                >
                  {mostrarSenha ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
            <button
              disabled={entrando}
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60"
            >
              {entrando ? (
                "Entrando…"
              ) : (
                <>
                  Entrar <ArrowRight size={17} />
                </>
              )}
            </button>
            <a
              href="/"
              className="mt-5 inline-flex w-full items-center justify-center gap-1 text-sm text-muted-foreground hover:text-primary"
            >
              <ArrowLeft size={14} /> Página principal
            </a>
          </form>
        </div>
      </div>
    </main>
  );
}

export function PortalUnavailable({ message }: { message: string }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#f5f7f4] px-4">
      <section className="w-full max-w-md rounded-2xl border bg-white p-7 text-center shadow-sm">
        <h1 className="text-xl font-bold">Clínica não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <a
          href="/"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <ArrowLeft size={15} /> Voltar
        </a>
      </section>
    </main>
  );
}
