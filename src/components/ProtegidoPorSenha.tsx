import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LockKeyhole, Settings2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabaseBanco } from "@/integrations/supabase/client";

type AreaProtegida = "assinar" | "receituario";
type Contexto = { clinica_id: string; exigida: boolean; configurada: boolean; pode_configurar: boolean };
const TEMPO_LIBERADO_MS = 15 * 60 * 1000;

export function ProtegidoPorSenha({ area, titulo, children }: {
  area: AreaProtegida; titulo: string; children: ReactNode;
}) {
  const [contexto, setContexto] = useState<Contexto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [senha, setSenha] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [exigida, setExigida] = useState(true);
  const [configurando, setConfigurando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [liberadoAte, setLiberadoAte] = useState(0);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const { data, error } = await (supabaseBanco as any).rpc("oricse_protecao_contexto", { p_area: area });
      if (error) throw error;
      const resultado = (Array.isArray(data) ? data[0] : data) as Contexto | undefined;
      if (!resultado?.clinica_id) throw new Error("Não foi possível identificar a clínica ativa.");
      setContexto(resultado);
      setExigida(resultado.exigida);
      setLiberadoAte(0);
      setSenha("");
    } catch (error) {
      setContexto(null);
      setErro(error instanceof Error ? error.message : "Não foi possível verificar a proteção da clínica.");
    } finally {
      setCarregando(false);
    }
  }, [area]);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    if (!liberadoAte) return;
    const timer = window.setTimeout(() => setLiberadoAte(0), Math.max(0, liberadoAte - Date.now()));
    const verificar = () => { if (Date.now() >= liberadoAte) setLiberadoAte(0); };
    window.addEventListener("focus", verificar);
    return () => { window.clearTimeout(timer); window.removeEventListener("focus", verificar); };
  }, [liberadoAte]);

  async function liberar() {
    if (!contexto || salvando) return;
    setSalvando(true);
    try {
      const { data, error } = await (supabaseBanco as any).rpc("oricse_protecao_validar", { p_area: area, p_senha: senha });
      if (error) throw error;
      if (data !== true) throw new Error("Senha incorreta.");
      setLiberadoAte(Date.now() + TEMPO_LIBERADO_MS);
      setSenha("");
      toast.success("Área liberada por 15 minutos nesta sessão.");
    } catch (error) {
      setSenha("");
      toast.error(error instanceof Error ? error.message : "Não foi possível conferir a senha.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarConfig() {
    if (!contexto?.pode_configurar || salvando) return;
    if (novaSenha && novaSenha.length < 8) return void toast.error("Use uma senha de pelo menos 8 caracteres.");
    if (novaSenha !== confirmacao) return void toast.error("A confirmação da nova senha não corresponde.");
    if (exigida && !contexto.configurada && !novaSenha) return void toast.error("Defina uma senha antes de ativar a proteção.");
    setSalvando(true);
    try {
      const { data, error } = await (supabaseBanco as any).rpc("oricse_protecao_configurar", {
        p_area: area, p_exigida: exigida, p_nova_senha: novaSenha || null,
      });
      if (error || data !== true) throw error || new Error("Alteração não confirmada.");
      setNovaSenha(""); setConfirmacao(""); setConfigurando(false); setLiberadoAte(0);
      toast.success("Proteção atualizada pelo RT.");
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar a proteção.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <main className="mx-auto max-w-md px-4 py-12 text-sm text-muted-foreground">Conferindo regras de acesso da clínica…</main>;
  if (erro || !contexto) return (
    <main className="mx-auto max-w-md space-y-3 px-4 py-12" role="alert">
      <p className="font-semibold text-destructive">{erro || "Acesso indisponível."}</p>
      <button type="button" onClick={() => void carregar()} className="rounded-xl border px-4 py-2">Tentar novamente</button>
    </main>
  );

  const liberado = !contexto.exigida || liberadoAte > Date.now();

  return <>
    {contexto.pode_configurar && (
      <div className="mx-auto mb-3 flex w-full max-w-3xl justify-end px-4">
        <button type="button" onClick={() => setConfigurando(v => !v)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold">
          <Settings2 size={16}/> Segurança · RT
        </button>
      </div>
    )}
    {configurando && contexto.pode_configurar && (
      <section className="mx-auto mb-5 w-full max-w-3xl space-y-3 rounded-2xl border border-primary/25 bg-card p-5 shadow-sm" aria-label="Configuração de segurança do RT">
        <div className="flex items-center gap-2"><ShieldCheck className="text-primary" size={20}/><h2 className="font-bold">Senha de {area === "assinar" ? "assinaturas de documentos" : "receituários"}</h2></div>
        <p className="text-sm text-muted-foreground">Somente o responsável técnico da clínica pode configurar esta exigência. A senha é armazenada como hash, nunca em texto simples.</p>
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input type="checkbox" checked={exigida} onChange={e => setExigida(e.target.checked)} className="h-5 w-5 accent-primary"/>
          Exigir senha para acessar esta área
        </label>
        <label className="block text-sm font-semibold"> {contexto.configurada ? "Alterar senha (opcional)" : "Definir senha"}
          <input type="password" autoComplete="new-password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)}
            minLength={8} maxLength={128} placeholder="Mínimo de 8 caracteres" className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3"/>
        </label>
        <label className="block text-sm font-semibold">Confirmar nova senha
          <input type="password" autoComplete="new-password" value={confirmacao} onChange={e => setConfirmacao(e.target.value)}
            maxLength={128} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3"/>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={salvando} onClick={() => void salvarConfig()} className="rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-50">Salvar configuração</button>
          <button type="button" onClick={() => setConfigurando(false)} className="rounded-xl border px-4 py-2">Cancelar</button>
        </div>
      </section>
    )}
    {liberado ? children : (
      <main className="mx-auto flex min-h-[48vh] w-full max-w-md items-center px-4 py-8">
        <section className="w-full rounded-3xl border bg-card p-6 shadow-sm">
          <LockKeyhole className="mx-auto text-primary" size={30}/>
          <h1 className="mt-3 text-center text-xl font-bold">{titulo}</h1>
          {!contexto.configurada ? (
            <p className="mt-3 text-center text-sm text-amber-700">O responsável técnico precisa definir a senha antes de liberar esta área.</p>
          ) : (
            <form onSubmit={e => { e.preventDefault(); void liberar(); }} className="mt-5 space-y-4">
              <p className="text-center text-sm text-muted-foreground">Digite a senha definida pelo RT para continuar.</p>
              <label className="block text-sm font-semibold">Senha de acesso
                <input type="password" autoComplete="off" value={senha} onChange={e => setSenha(e.target.value)}
                  className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3 text-base" required autoFocus/>
              </label>
              <button type="submit" disabled={salvando || !senha} className="min-h-11 w-full rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50">
                {salvando ? "Validando…" : "Desbloquear"}
              </button>
            </form>
          )}
        </section>
      </main>
    )}
  </>;
}
