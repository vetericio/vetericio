// Audita TODAS as rotas de página estáticas declaradas pelo TanStack.
// Observação: fetch/TTFB NÃO equivale a renderização interativa autenticada.
// Rotas dinâmicas exigem fixtures e usuário real, reportadas separadamente.
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const raiz = path.resolve("src/routes");
const origem = (process.env.ORICSE_PERF_URL || "https://oricse.com.br").replace(/\/$/, "");
const limiteMs = Number(process.env.ORICSE_PERF_LIMITE_MS || 3000);
const executaLive = process.argv.includes("--live");
const estrito = process.env.ORICSE_PERF_STRICT === "1";
const arquivos = [];
function percorrer(diretorio) {
  for (const item of fs.readdirSync(diretorio, {withFileTypes: true})) {
    const nome = path.join(diretorio, item.name);
    if (item.isDirectory()) percorrer(nome);
    else if (/\.tsx?$/.test(item.name)) arquivos.push(nome);
  }
}
percorrer(raiz);
const declaradas = new Set();
for (const arquivo of arquivos) {
  const source = fs.readFileSync(arquivo, "utf8");
  for (const m of source.matchAll(/createFileRoute\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    declaradas.add(m[1]);
  }
}
const rotas = [...declaradas].sort();
const paginas = rotas.filter(rota =>
  rota.startsWith("/") && !rota.startsWith("/api/") &&
  !rota.includes("$") && !rota.includes("*") && !rota.includes("{") &&
  !rota.includes("}") && !rota.includes("_") && rota !== "/");
paginas.unshift("/");
const dinamicas = rotas.filter(r=>r.includes("$")||r.includes("*")||r.includes("{")||r.includes("}"));
const APIs = rotas.filter(r=>r.startsWith("/api/"));
console.log("Inventário ORICSE: " + rotas.length + " rotas declaradas; " + paginas.length +
  " páginas estáticas testáveis; " + dinamicas.length + " rotas dinâmicas; " + APIs.length + " endpoints API.");
if (!rotas.length || !paginas.length) process.exit(1);
if (!executaLive) process.exit(0);

const resultados = Array.from({length: paginas.length});
let cursor = 0;
async function testarPagina(indice) {
  const rota = paginas[indice];
  const control = new AbortController();
  const timeout = setTimeout(() => control.abort(), 9000);
  const inicio = performance.now();
  try {
    const url = origem + rota;
    const resposta = await fetch(url, { redirect: "follow", signal: control.signal, headers: { accept: "text/html" } });
    const primeiroByteMs = Math.round(performance.now()-inicio);
    const conteudo = await resposta.text();
    const totalMs = Math.round(performance.now()-inicio);
    const contentType = resposta.headers.get("content-type") || "";
    const erro = resposta.status >= 500 || resposta.status === 404 || !contentType.includes("text/html") || conteudo.length < 100;
    resultados[indice] = {rota, status: resposta.status, primeiroByteMs, totalMs, erro, destino: new URL(resposta.url).pathname};
  } catch (e) {
    resultados[indice] = {rota, status: 0, primeiroByteMs: null, totalMs: Math.round(performance.now()-inicio), erro: true,
      detalhe: e instanceof Error ? e.message : String(e)};
  } finally { clearTimeout(timeout); }
}
async function trabalhador() {
  while (cursor < paginas.length) {
    const atual = cursor++;
    await testarPagina(atual);
  }
}
await Promise.all(Array.from({length: Math.min(5, paginas.length)}, trabalhador));

const duracoes = resultados.map(x=>x.primeiroByteMs).filter(Number.isFinite).sort((a,b)=>a-b);
const percentual = p => duracoes.length ? duracoes[Math.min(duracoes.length-1,Math.ceil(duracoes.length*p)-1)] : null;
const acimaLimite = resultados.filter(x=>x.totalMs>limiteMs);
const erros = resultados.filter(x=>x.erro);
const relatorio = {
  tipo: "HTTP SSR sem sessão — não mede interação/renderização client-side",
  origem, geradoEm: new Date().toISOString(), metaMs: 1000, limiteMs,
  totalDeclaradas: rotas.length, testadas: resultados.length,
  rotasDinamicasNaoTestadas: dinamicas, endpointsNaoTestados: APIs.length,
  ttfbP50Ms: percentual(.5), ttfbP95Ms: percentual(.95),
  respostasAcimaLimite: acimaLimite.length, erros: erros.length,
  resultados,
};
fs.writeFileSync("performance-audit.json",JSON.stringify(relatorio,null,2));
for (const x of resultados) console.log((x.erro?"FALHA":x.totalMs>limiteMs?"LENTO":"OK")+
  " " + x.rota + " · HTTP "+x.status+" · TTFB "+(x.primeiroByteMs??"-")+" ms · total "+x.totalMs+" ms");
console.log("Resumo: "+resultados.length+" páginas HTTP | P50 TTFB "+percentual(.5)+" ms | P95 TTFB "+
  percentual(.95)+" ms | "+acimaLimite.length+" respostas >"+limiteMs+" ms | "+erros.length+" erros.");
console.log("Atenção: requer navegador autenticado para medir cliques até conteúdo pronto nas páginas clínicas.");
if (estrito && (acimaLimite.length || erros.length)) process.exitCode=1;
