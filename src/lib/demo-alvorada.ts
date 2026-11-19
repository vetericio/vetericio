const EMAIL_DEMO_ALVORADA = "alvorada@vetericio.local";

export const AVISO_DEMO_COBRANCA = "Cobranças e recebimentos estão indisponíveis na demonstração Alvorada.";
export const AVISO_DEMO_DOCUMENTOS = "A demonstração Alvorada não permite assinar, emitir ou publicar documentos.";

export function contaDemoAlvorada(usuario: {
  email?: string | null;
  app_metadata?: Record<string, unknown>;
} | null | undefined): boolean {
  return usuario?.app_metadata?.oricse_demo_clinica === "alvorada" ||
    usuario?.email?.toLowerCase() === EMAIL_DEMO_ALVORADA;
}

export function exigirEmissaoDisponivel(demo: boolean) {
  if (demo) throw new Error(AVISO_DEMO_DOCUMENTOS);
}
