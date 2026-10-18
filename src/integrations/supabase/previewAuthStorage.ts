// Mantém somente a sessão de autenticação entre aberturas do navegador.
// Dados clínicos continuam exclusivamente no Supabase e no Google Drive.
const memoria = new Map<string, string>();

function armazenamentoDaAutenticacao() {
  if (typeof window === "undefined") return null;
  try { return window.localStorage; } catch { return null; }
}

export function brokeredPreviewStorage() {
  return {
    getItem: async (key: string) => armazenamentoDaAutenticacao()?.getItem(key) ?? memoria.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      memoria.set(key, value);
      armazenamentoDaAutenticacao()?.setItem(key, value);
    },
    removeItem: async (key: string) => {
      memoria.delete(key);
      armazenamentoDaAutenticacao()?.removeItem(key);
    },
  };
}
