import { useEffect, useState, type ReactNode } from "react";
import { LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { tokenConfiguracoesClinica } from "@/lib/configuracoes-clinica-ui";
import type { AreaProtegida } from "@/lib/configuracoes-clinica";
import { confirmarSenhaClinica, consultarProtecaoClinica } from "@/lib/configuracoes-clinica.functions";

export function ProtegidoPorSenha({ area, titulo, children }: {
  area: AreaProtegida;
  titulo: string;
  children: ReactNode;
}) {
  const [contexto, setContexto] = useState<{ clinicaId: string; exigeSenha: boolean } | null>(null);
  const [senha, setSenha] = useState("");
  const [liberado, setLiberado] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);

  function dadosDaArea() {
    const params = new URLSearchParams(window.location.search);
    return {
      area,
      animalId: area === "receituario" ? params.get("animalId") || undefined : undefined,
      tutorId: area === "receituario" ? params.get("tutorId") || undefined : undefined,
    };
  }

  useEffect(() => {
    let ativo = true;
    setContexto(null);
    setLiberado(false);
    setErro("");
    const dados = dadosDaArea();
    tokenConfiguracoesClinica()
      .then((accessToken) => consultarProtecaoClinica({ data: { ...dados, accessToken } }))
      .then((resultado) => { if (ativo) setContexto(resultado); })
      .catch((e: Error) => { if (ativo) setErro(e.message); });
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento !== "SIGNED_OUT") return;
      ativo = false;
      setContexto(null);
      setSenha("");
      setLiberado(false);
      setErro("Sua sessão terminou. Entre novamente.");
    });
    return () => { ativo = false; data.subscription.unsubscribe(); };
  }, [area, tentativa]);

  async function validar() {
    if (!contexto) return;
    setVerificando(true);
    setErro("");
    try {
      const accessToken = await tokenConfiguracoesClinica();
      await confirmarSenhaClinica({ data: { ...dadosDaArea(), accessToken, clinicaId: contexto.clinicaId, senha } });
      setLiberado(true);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSenha("");
      setVerificando(false);
    }
  }

  if (contexto && (liberado || !contexto.exigeSenha)) return <>{children}</>;

  return (
    <main className="mx-auto flex min-h-[55vh] w-full max-w-sm items-center px-4 py-8">
      <section className="w-full rounded-xl border bg-card p-5 shadow-sm">
        <LockKeyhole size={22} className="text-primary" />
        <h1 className="mt-3 text-xl font-semibold">{titulo}</h1>
        {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
        {contexto ? (
          <form className="mt-4" onSubmit={(e) => { e.preventDefault(); void validar(); }}>
            <label className="text-sm font-medium">Senha da sua conta ORICSE
              <input type="password" autoComplete="current-password" required maxLength={512}
                value={senha} onChange={(e) => setSenha(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3" />
            </label>
            <button type="submit" disabled={verificando || !senha}
              className="mt-4 min-h-11 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {verificando ? "Confirmando…" : "Confirmar acesso"}
            </button>
          </form>
        ) : erro ? (
          <button type="button" className="mt-4 min-h-11 rounded-lg border px-3 text-sm"
            onClick={() => setTentativa(tentativa + 1)}>Tentar novamente</button>
        ) : <p role="status" className="mt-2 text-sm text-muted-foreground">Verificando acesso…</p>}
      </section>
    </main>
  );
}
