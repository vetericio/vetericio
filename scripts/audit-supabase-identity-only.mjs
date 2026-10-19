import fs from 'node:fs';
import path from 'node:path';

// O ORICSE usa Supabase como banco operacional. Esta regra anterior tratava
// qualquer tabela de negócio como erro e, por isso, bloqueava o CI mesmo para
// operações previstas. A proteção que importa é não vazar a service_role para
// o bundle do navegador e manter o cliente privilegiado somente no servidor.
const problemas = [];
const roots = ['src'];
const clientServer = 'src/integrations/supabase/client.server.ts';

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      const text = fs.readFileSync(file, 'utf8');
      if (file !== clientServer && /(?:ORICSE_)?SUPABASE_SERVICE_ROLE_KEY/.test(text)) {
        problemas.push(`${file} contém referência a credencial privilegiada.`);
      }
      if (file.endsWith('.tsx') && /from\s+["'][^"']*client\.server["']/.test(text)) {
        problemas.push(`${file} importa client.server diretamente no bundle do navegador.`);
      }
    }
  }
}

for (const root of roots) walk(root);
console.log(`Verificação de credenciais privilegiadas: ${problemas.length} problema(s)`);
for (const problema of problemas) console.log(`ERROR ${problema}`);
if (problemas.length) process.exit(1);
