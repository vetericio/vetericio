// Sessão de autenticação em memória. Nenhum token é persistido no navegador.
const memoria = new Map<string, string>();

export function brokeredPreviewStorage() {
  return {
    getItem: async (key: string) => memoria.get(key) ?? null,
    setItem: async (key: string, value: string) => { memoria.set(key, value); },
    removeItem: async (key: string) => { memoria.delete(key); },
  };
}
