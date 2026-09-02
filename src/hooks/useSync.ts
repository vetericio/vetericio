import { useCallback, useEffect, useState } from "react";
import {
  codigoValido,
  desfazerUltimaSync,
  esquecerCodigo,
  gerarCodigo,
  lerCodigo,
  marcarPendente,
  pausar,
  podeDesfazer,
  salvarCodigo,
  sincronizacaoPausada,
  sincronizarAgora,
  temPendencia,
  ultimaSync,
  ultimoResumo,
  type EstadoSync,
  type ResumoSync,
} from "@/lib/sync";

/** Estado e ações da sincronização entre aparelhos. */
export function useSync() {
  const [codigo, setCodigo] = useState("");
  const [estado, setEstado] = useState<EstadoSync>("sem-codigo");
  const [ultima, setUltima] = useState("");
  const [erro, setErro] = useState("");
  const [temDesfazer, setTemDesfazer] = useState(false);
  const [pausada, setPausada] = useState(false);
  const [resumo, setResumo] = useState<ResumoSync | null>(null);

  const atualizarEstado = useCallback(() => {
    const c = lerCodigo();
    setCodigo(c);
    setUltima(ultimaSync());
    setTemDesfazer(podeDesfazer());
    setPausada(sincronizacaoPausada());
    setResumo(ultimoResumo());
    if (!codigoValido(c)) return setEstado("sem-codigo");
    setEstado(temPendencia() ? "pendente" : "sincronizado");
  }, []);

  const sincronizar = useCallback(async (manual = false) => {
    if (!codigoValido(lerCodigo())) return;
    setEstado("sincronizando");
    setErro("");
    const r = await sincronizarAgora(manual);
    setTemDesfazer(podeDesfazer());
    setPausada(sincronizacaoPausada());
    setResumo(ultimoResumo());
    if (r.ok) {
      setUltima(r.atualizadoEm);
      setEstado("sincronizado");
    } else {
      setErro(r.motivo);
      setEstado(temPendencia() ? "pendente" : "erro");
    }
  }, []);

  useEffect(() => {
    atualizarEstado();
    if (!codigoValido(lerCodigo())) return;
    void sincronizar();

    const aoVoltar = () => void sincronizar();
    const aoFocar = () => {
      if (document.visibilityState === "visible") void sincronizar();
    };
    window.addEventListener("online", aoVoltar);
    document.addEventListener("visibilitychange", aoFocar);
    return () => {
      window.removeEventListener("online", aoVoltar);
      document.removeEventListener("visibilitychange", aoFocar);
    };
  }, [atualizarEstado, sincronizar]);

  /** Gera um código curto que ainda não está em uso na nuvem. */
  const criarCodigo = useCallback(async () => {
    const { codigoLivre } = await import("@/lib/sync.functions");
    let novo = gerarCodigo();
    for (let i = 0; i < 8; i += 1) {
      const tentativa = gerarCodigo();
      try {
        const { livre } = await codigoLivre({ data: { codigo: tentativa } });
        if (livre) {
          novo = tentativa;
          break;
        }
      } catch {
        novo = tentativa;
        break;
      }
    }
    pausar(false);
    salvarCodigo(novo);
    setCodigo(novo);
    marcarPendente(true);
    await sincronizar(true);
    return novo;
  }, [sincronizar]);

  const usarCodigo = useCallback(
    async (texto: string) => {
      if (!codigoValido(texto)) return false;
      pausar(false);
      salvarCodigo(texto);
      setCodigo(lerCodigo());
      await sincronizar(true);
      return true;
    },
    [sincronizar],
  );

  const desfazer = useCallback(() => {
    const ok = desfazerUltimaSync();
    setTemDesfazer(podeDesfazer());
    if (ok) setEstado("pendente");
    return ok;
  }, []);

  const desconectar = useCallback(() => {
    esquecerCodigo();
    marcarPendente(false);
    pausar(false);
    setCodigo("");
    setEstado("sem-codigo");
  }, []);

  return {
    codigo,
    estado,
    ultima,
    erro,
    temDesfazer,
    sincronizar,
    criarCodigo,
    usarCodigo,
    desfazer,
    desconectar,
  };
}
