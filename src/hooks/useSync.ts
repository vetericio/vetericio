import { useCallback, useEffect, useState } from "react";
import {
  codigoValido,
  esquecerCodigo,
  gerarCodigo,
  lerCodigo,
  marcarPendente,
  salvarCodigo,
  sincronizarAgora,
  temPendencia,
  ultimaSync,
  type EstadoSync,
} from "@/lib/sync";

/** Estado e ações da sincronização entre aparelhos. */
export function useSync() {
  const [codigo, setCodigo] = useState("");
  const [estado, setEstado] = useState<EstadoSync>("sem-codigo");
  const [ultima, setUltima] = useState("");
  const [erro, setErro] = useState("");

  const atualizarEstado = useCallback(() => {
    const c = lerCodigo();
    setCodigo(c);
    setUltima(ultimaSync());
    if (!codigoValido(c)) return setEstado("sem-codigo");
    setEstado(temPendencia() ? "pendente" : "sincronizado");
  }, []);

  const sincronizar = useCallback(async () => {
    if (!codigoValido(lerCodigo())) return;
    setEstado("sincronizando");
    setErro("");
    const r = await sincronizarAgora();
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

  const criarCodigo = useCallback(async () => {
    const novo = gerarCodigo();
    salvarCodigo(novo);
    setCodigo(novo);
    marcarPendente(true);
    await sincronizar();
    return novo;
  }, [sincronizar]);

  const usarCodigo = useCallback(
    async (texto: string) => {
      if (!codigoValido(texto)) return false;
      salvarCodigo(texto);
      setCodigo(lerCodigo());
      await sincronizar();
      return true;
    },
    [sincronizar],
  );

  const desconectar = useCallback(() => {
    esquecerCodigo();
    marcarPendente(false);
    setCodigo("");
    setEstado("sem-codigo");
  }, []);

  return { codigo, estado, ultima, erro, sincronizar, criarCodigo, usarCodigo, desconectar };
}
