import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('src');
const arquivos = [];
function andar(dir) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entrada.name);
    if (entrada.isDirectory()) andar(p);
    else if (/\.(tsx|ts|jsx|js)$/.test(entrada.name)) arquivos.push(p);
  }
}
andar(ROOT);

const problemas = [];
const avisos = [];
const rel = (p) => path.relative(process.cwd(), p).replaceAll('\\', '/');
const linhaDe = (texto, indice) => texto.slice(0, indice).split('\n').length;

for (const arquivo of arquivos) {
  const texto = fs.readFileSync(arquivo, 'utf8');
  const nome = rel(arquivo);

  for (const m of texto.matchAll(/<button\b[\s\S]*?>/g)) {
    const tag = m[0];
    const indice = m.index ?? 0;
    const aciona = /\bonClick\s*=|\bonPointerDown\s*=|\bonMouseDown\s*=|\bformAction\s*=|\btype\s*=\s*["']submit["']/.test(tag);
    const intencional = /\bdisabled\b|\baria-disabled\s*=\s*["']true["']/.test(tag);
    if (!aciona && !intencional) problemas.push(`${nome}:${linhaDe(texto, indice)} botão sem ação explícita`);
  }

  for (const m of texto.matchAll(/<a\b[\s\S]*?href\s*=\s*["']#["'][\s\S]*?>/g)) {
    avisos.push(`${nome}:${linhaDe(texto, m.index ?? 0)} link usa href="#"`);
  }
  for (const m of texto.matchAll(/onClick\s*=\s*\{\s*\(?.*?\)?\s*=>\s*\{\s*\}\s*\}/g)) {
    problemas.push(`${nome}:${linhaDe(texto, m.index ?? 0)} onClick vazio`);
  }
  for (const m of texto.matchAll(/onClick\s*=\s*\{\s*undefined\s*\}/g)) {
    problemas.push(`${nome}:${linhaDe(texto, m.index ?? 0)} onClick undefined`);
  }
  for (const m of texto.matchAll(/\b(?:TODO|FIXME|NÃO IMPLEMENTADO|NAO IMPLEMENTADO)\b/gi)) {
    avisos.push(`${nome}:${linhaDe(texto, m.index ?? 0)} marcador pendente: ${m[0]}`);
  }
}

console.log(`Arquivos verificados: ${arquivos.length}`);
console.log(`Problemas: ${problemas.length}`);
for (const p of problemas) console.log(`ERROR ${p}`);
console.log(`Avisos: ${avisos.length}`);
for (const a of avisos) console.log(`WARN ${a}`);

if (problemas.length) process.exit(1);
