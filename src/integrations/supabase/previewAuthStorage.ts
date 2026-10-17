// Persistência exclusiva da sessão de autenticação.
// Dados clínicos e operacionais continuam fora do armazenamento do navegador.
const memoria = new Map<string, string>();

function armazenamentoLocal(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function brokeredPreviewStorage() {
  return {
    getItem: async (key: string) => {
      const storage = armazenamentoLocal();
      return storage?.getItem(key) ?? memoria.get(key) ?? null;
    },
    setItem: async (key: string, value: string) => {
      const storage = armazenamentoLocal();
      if (storage) storage.setItem(key, value);
      else memoria.set(key, value);
    },
    removeItem: async (key: string) => {
      const storage = armazenamentoLocal();
      if (storage) storage.removeItem(key);
      memoria.delete(key);
    },
  };
}
