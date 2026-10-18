// Mantém somente a sessão de autenticação durante a sessão da aba.
// Dados clínicos continuam exclusivamente no Supabase e no Google Drive.
const memoria = new Map<string, string>();

function armazenamentoDaSessao() {
  if (typeof window === "undefined") return null;
  try { return window.sessionStorage; } catch { return null; }
}

export function brokeredPreviewStorage() {
  return {
    getItem: async (key: string) => armazenamentoDaSessao()?.getItem(key) ?? memoria.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      memoria.set(key, value);
      armazenamentoDaSessao()?.setItem(key, value);
    },
    removeItem: async (key: string) => {
      memoria.delete(key);
      armazenamentoDaSessao()?.removeItem(key);
    },
  };
}
