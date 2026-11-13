// Desempenho visual real das páginas públicas via Lighthouse/Chrome.
// Não representa navegação autenticada interna: requer contas de teste e sessões.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const site=(process.env.ORICSE_PERF_URL||"https://oricse.com.br").replace(/\/$/,"");
const demo=(process.env.ORICSE_PERF_DEMO_URL||"https://alvorada.oricse.com.br").replace(/\/$/,"");
const LIMITE=3000;
const alvos=[
  ["Início",site+"/"],["Login",site+"/login"],["Soluções",site+"/solucoes"],
  ["Planos",site+"/planos"],["Demonstração",site+"/demonstracao"],
  ["Termos",site+"/termos-de-uso"],["Privacidade",site+"/politica-de-privacidade"],
  ["Site Alvorada",demo+"/"],["Portal Alvorada",demo+"/portaldotutor"],
];
const destino="performance-browser-public.json";
const resultados=[];
const cenarios=alvos.flatMap(([nome,url])=>[["desktop",nome,url],["mobile",nome,url]]);
for(const [perfil,nome,url] of cenarios){
  const temporario=path.join(os.tmpdir(),"oricse-lighthouse-"+resultados.length+".json");
  try{
    execFileSync("npx",["--yes","lighthouse@12.8.2",url,
      ...(perfil==="desktop"?["--preset=desktop"]:[]),
      "--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage",
      "--only-categories=performance","--output=json","--output-path="+temporario,
      "--quiet","--max-wait-for-load=20000"],{timeout:90000,stdio:"pipe"});
    const dados=JSON.parse(fs.readFileSync(temporario,"utf8"));
    const lcp=Math.round(dados.audits?.["largest-contentful-paint"]?.numericValue||0);
    const fcp=Math.round(dados.audits?.["first-contentful-paint"]?.numericValue||0);
    const tbt=Math.round(dados.audits?.["total-blocking-time"]?.numericValue||0);
    const row={perfil,nome,url,lcpMs:lcp,fcpMs:fcp,tbtMs:tbt,score:Math.round((dados.categories?.performance?.score||0)*100),metaAtingida:lcp>0&&lcp<=1000,limiteAtingido:lcp>0&&lcp<=LIMITE};
    resultados.push(row);
    console.log((row.limiteAtingido?"OK":"LENTO")+" "+perfil+" "+nome+" · LCP "+lcp+" ms · FCP "+fcp+" ms · TBT "+tbt+" ms");
  }catch(erro){
    resultados.push({perfil,nome,url,erro:erro instanceof Error?erro.message.slice(0,250):String(erro),limiteAtingido:false});
    console.error("FALHA "+perfil+" "+nome+" · auditoria Lighthouse indisponível");
  }finally{try{fs.unlinkSync(temporario);}catch{}}
}
fs.writeFileSync(destino,JSON.stringify({data:new Date().toISOString(),tipo:"Lighthouse desktop e mobile — carregamento frio, público e sem sessão",limiteMs:LIMITE,resultados},null,2));
const excedidas=resultados.filter(r=>!r.limiteAtingido);
console.log("Auditoria visual pública: "+(resultados.length-excedidas.length)+"/"+resultados.length+" com LCP até 3 segundos");
if(process.env.ORICSE_PERF_STRICT==="1"&&excedidas.length)process.exitCode=1;
