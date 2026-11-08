// Checagem estatica de isolamento: proibe dependencias de execucao do Gestor original.
// Excecoes somente para codigos de bloqueio explicito de URLs/projeto antigos.
import { existsSync,readFileSync,readdirSync,statSync } from "node:fs";
import { join,relative,resolve } from "node:path";
const ROOT=resolve(import.meta.dirname,"..");
if(existsSync(join(ROOT,".env")))throw new Error("Nunca versionar .env real na copia OricStudio.");
const files=[];
function walk(directory){
  if(!existsSync(directory))return;
  for(const name of readdirSync(directory)){
    const path=join(directory,name);
    if(statSync(path).isDirectory()){if(name!=="test"&&name!=="__tests__")walk(path);continue;}
    if(/\.(ts|tsx|js|mjs)$/.test(name))files.push(path);
  }
}
walk(join(ROOT,"src"));walk(join(ROOT,"tools"));
const exempt=new Map([
  ["gestor-insta-vetericio.lovable.app", new Set([
    "src/lib/server/instance-guard.server.ts","tools/assistente.mjs",
  ])],
  ["ytuhblegzqppcwqkdovg", new Set([
    "src/lib/server/instance-guard.server.ts",
    "src/integrations/supabase/client.ts",
  ])],
]);
for(const path of files){
  const rel=relative(ROOT,path).replaceAll("\\","/");
  const body=readFileSync(path,"utf8");
  for(const [word,allow] of exempt)if(body.includes(word)&&!allow.has(rel))
    throw new Error(`Referencia bloqueada ao Gestor original em ${rel}`);
}
const local=readFileSync(join(ROOT,"tools/assistente.mjs"),"utf8");
if(!local.includes("process.env.ORICSTUDIO_URL")||local.includes("process.env.GESTOR_URL"))
  throw new Error("Assistente nao pode usar GESTOR_URL nem URL padrao do Gestor.");
if(!readFileSync(join(ROOT,"src/lib/server/instance-guard.server.ts"),"utf8").includes("ORICSTUDIO_INSTANCE_ID"))
  throw new Error("Falta trava de instancia OricStudio.");
console.log(`Independencia estaticamente validada em ${files.length} arquivos de runtime.`);
