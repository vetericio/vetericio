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

const rotas = new Set(['/']);
for (const arquivo of arquivos) {
  const texto = fs.readFileSync(arquivo, 'utf8');
  for (const m of texto.matchAll(/createFileRoute\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) rotas.add(m[1]);
}

function rotaConhecida(destino) {
  if (rotas.has(destino)) return true;
  if (destino === '/admin/login') return true;
  for (const rota of rotas) {
    if (!rota.includes('$')) continue;
    const padrao = '^' + rota.split('/').map((p) => p.startsWith('$') ? '[^/]+' : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/') + '$';
    if (new RegExp(padrao).test(destino)) return true;
  }
  return false;
}

for (const arquivo of arquivos) {
  const texto = fs.readFileSync(arquivo, 'utf8');
  const nome = rel(arquivo);
  const jsx = /\.(tsx|jsx)$/.test(nome);

  if (jsx) {
    for (const m of texto.matchAll(/<button\b[\s\S]*?>/g)) {
      const tag = m[0];
      const indice = m.index ?? 0;
      const antes = texto.slice(Math.max(0, indice - 180), indice);
      const aciona = /\bonClick\s*=|\bonPointerDown\s*=|\bonMouseDown\s*=|\bformAction\s*=|\btype\s*=\s*["']submit["']/.test(tag);
      const intencional = /\bdisabled\b|\baria-disabled\s*=\s*["']true["']/.test(tag);
      const triggerAsChild = /<(?:SheetTrigger|DropdownMenuTrigger|DialogTrigger|PopoverTrigger|TooltipTrigger)\b[^>]*\basChild\b[^>]*>\s*$/.test(antes);
      if (!aciona && !intencional && !triggerAsChild) problemas.push(`${nome}:${linhaDe(texto, indice)} botão sem ação explícita`);
    }

    for (const m of texto.matchAll(/<a\b[\s\S]*?href\s*=\s*["']#["'][\s\S]*?>/g)) avisos.push(`${nome}:${linhaDe(texto, m.index ?? 0)} link usa href="#"`);
    for (const m of texto.matchAll(/onClick\s*=\s*\{\s*\(?.*?\)?\s*=>\s*\{\s*\}\s*\}/g)) problemas.push(`${nome}:${linhaDe(texto, m.index ?? 0)} onClick vazio`);
    for (const m of texto.matchAll(/onClick\s*=\s*\{\s*undefined\s*\}/g)) problemas.push(`${nome}:${linhaDe(texto, m.index ?? 0)} onClick undefined`);
  }

  for (const m of texto.matchAll(/\b(?:TODO|FIXME|NÃO IMPLEMENTADO|NAO IMPLEMENTADO)\b/g)) avisos.push(`${nome}:${linhaDe(texto, m.index ?? 0)} marcador pendente: ${m[0]}`);

  const alvos = [
    ...texto.matchAll(/\bto\s*=\s*["'](\/[^"']*)["']/g),
    ...texto.matchAll(/\bto\s*:\s*["'](\/[^"']*)["']/g),
    ...texto.matchAll(/window\.location\.href\s*=\s*["'](\/[^"']*)["']/g),
    ...texto.matchAll(/\bhref\s*=\s*["'](\/[^"'#?][^"']*)["']/g),
  ];
  for (const m of alvos) {
    const destino = m[1].split('?')[0].split('#')[0];
    if (destino.startsWith('//') || destino.startsWith('/api/')) continue;
    if (!rotaConhecida(destino)) avisos.push(`${nome}:${linhaDe(texto, m.index ?? 0)} destino interno sem rota literal conhecida: ${destino}`);
  }
}

console.log(`Arquivos verificados: ${arquivos.length}`);
console.log(`Rotas conhecidas: ${rotas.size}`);
console.log(`Problemas: ${problemas.length}`);
for (const p of problemas) console.log(`ERROR ${p}`);
console.log(`Avisos: ${avisos.length}`);
for (const a of avisos) console.log(`WARN ${a}`);

if (problemas.length) process.exit(1);
