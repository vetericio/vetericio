import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src');
const arquivos = [];
function andar(dir) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entrada.name);
    if (entrada.isDirectory()) andar(p);
    else if (/\.(ts|tsx|js|jsx)$/.test(entrada.name) && !entrada.name.endsWith('.gen.ts')) arquivos.push(p);
  }
}
andar(root);

const storageImport = 'import { oricseStorage, oricseSession } from "@/lib/oricse-storage";\n';
let alterados = 0;

for (const arquivo of arquivos) {
  if (arquivo.endsWith(path.join('src','lib','oricse-storage.ts'))) continue;
  if (arquivo.endsWith(path.join('src','lib','oricse-storage.functions.ts'))) continue;
  if (arquivo.endsWith(path.join('src','hooks','useProtecaoDadosLocais.ts'))) continue;
  if (arquivo.endsWith(path.join('src','integrations','supabase','previewAuthStorage.ts'))) continue;
  let texto = fs.readFileSync(arquivo, 'utf8');
  const original = texto;

  texto = texto.replace(/window\.localStorage/g, 'oricseStorage');
  texto = texto.replace(/window\.sessionStorage/g, 'oricseSession');
  texto = texto.replace(/(?<![\w.'"`])localStorage(?=\.(?:getItem|setItem|removeItem|clear|key)\b)/g, 'oricseStorage');
  texto = texto.replace(/(?<![\w.'"`])sessionStorage(?=\.(?:getItem|setItem|removeItem|clear|key)\b)/g, 'oricseSession');

  const usaStorage = /\boricseStorage\b/.test(texto);
  const usaSession = /\boricseSession\b/.test(texto);
  if ((usaStorage || usaSession) && !texto.includes('@/lib/oricse-storage')) {
    texto = storageImport + texto;
  }

  if (texto !== original) {
    fs.writeFileSync(arquivo, texto);
    alterados++;
  }
}

fs.writeFileSync('src/hooks/useProtecaoDadosLocais.ts', `/**\n * O ORICSE não usa armazenamento persistente do navegador.\n * Mantido somente para compatibilidade de imports antigos.\n */\nexport function useProtecaoDadosLocais() {\n  // Persistência é feita no Google Drive pelo backend.\n}\n`);

fs.writeFileSync('src/integrations/supabase/previewAuthStorage.ts', `// Sessão de autenticação em memória. Nenhum token é persistido no navegador.\nconst memoria = new Map<string, string>();\n\nexport function brokeredPreviewStorage() {\n  return {\n    getItem: async (key: string) => memoria.get(key) ?? null,\n    setItem: async (key: string, value: string) => { memoria.set(key, value); },\n    removeItem: async (key: string) => { memoria.delete(key); },\n  };\n}\n`);

console.log(`Arquivos migrados do armazenamento do navegador: ${alterados}`);
