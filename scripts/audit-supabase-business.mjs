import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('src');
const arquivos=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(ts|tsx|js|jsx)$/.test(e.name))arquivos.push(p)}}
walk(root);
const tabelas=new Map();
const rpcs=new Map();
const storage=[];
for(const arquivo of arquivos){const t=fs.readFileSync(arquivo,'utf8');for(const m of t.matchAll(/\.from\(\s*["'`]([^"'`]+)["'`]\s*\)/g)){const n=m[1];if(!tabelas.has(n))tabelas.set(n,new Set());tabelas.get(n).add(path.relative(process.cwd(),arquivo))}for(const m of t.matchAll(/\.rpc\(\s*["'`]([^"'`]+)["'`]/g)){const n=m[1];if(!rpcs.has(n))rpcs.set(n,new Set());rpcs.get(n).add(path.relative(process.cwd(),arquivo))}if(/supabase\.storage|\.storage\.from\(/.test(t))storage.push(path.relative(process.cwd(),arquivo))}
console.log('TABLES',tabelas.size);for(const [n,f] of [...tabelas].sort())console.log(`TABLE ${n} :: ${[...f].join(',')}`);console.log('RPCS',rpcs.size);for(const [n,f] of [...rpcs].sort())console.log(`RPC ${n} :: ${[...f].join(',')}`);console.log('STORAGE',storage.length);for(const f of storage)console.log(`STORAGE ${f}`);
