import { descarregarOricseStorage, hidratarOricseStorage, oricseStorage } from "@/lib/oricse-storage";

function chaveModulo(chave: string) {
  return `oricse:modulo:${chave}`;
}

export async function carregarModulo<T>(chave: string, padrao: T): Promise<T> {
  await hidratarOricseStorage();
  const bruto = oricseStorage.getItem(chaveModulo(chave));
  if (!bruto) return padrao;
  try { return JSON.parse(bruto) as T; } catch { return padrao; }
}

export async function salvarModulo<T>(chave: string, dados: T): Promise<void> {
  await hidratarOricseStorage();
  oricseStorage.setItem(chaveModulo(chave), JSON.stringify(dados));
  await descarregarOricseStorage();
}

export async function apagarModulo(chave: string): Promise<void> {
  await hidratarOricseStorage();
  oricseStorage.removeItem(chaveModulo(chave));
  await descarregarOricseStorage();
}
