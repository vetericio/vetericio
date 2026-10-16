import fs from 'node:fs';
import path from 'node:path';
const roots=['src','supabase/functions'];
const allowed=new Set(['app_users','clinica_usuarios','oricse_portal_tutores']);
const problemas=[];
function walk(dir){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(ts|tsx|js|jsx)$/.test(e.name)){const t=fs.readFileSync(p,'utf8');for(const m of t.matchAll(/(?:supabaseAdmin|adminDb|admin)\s*\.from\(\s*["'`]([^"'`]+)["'`]\s*\)/g)){if(!allowed.has(m[1]))problemas.push(`${p}:${t.slice(0,m.index).split('\n').length} usa tabela de negócio no Supabase: ${m[1]}`)}}}}
for(const r of roots)walk(r);
console.log(`Dependências indevidas no Supabase: ${problemas.length}`);for(const p of problemas)console.log(`ERROR ${p}`);if(problemas.length)process.exit(1);
