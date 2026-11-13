import process from "node:process";

const base = (process.env.ORICSE_SMOKE_URL || "https://oricse.com.br").replace(/\/$/, "");
const publica = ["/", "/solucoes", "/planos", "/demonstracao", "/termos-de-uso", "/politica-de-privacidade"];
const demo = process.env.ORICSE_SMOKE_DEMO || "https://alvorada.oricse.com.br";
const alvos = [
  ...publica.map((rota)=>({nome:rota,url:base+rota})),
  {nome:"site demonstrativo Alvorada",url:demo+"/"},
  {nome:"Portal do Tutor demonstrativo",url:demo+"/portaldotutor"},
];
const falhas=[];
for (const item of alvos) {
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(), 15000);
  try {
    const response = await fetch(item.url + (item.url.includes("?")?"&":"?") + "auditoria=" + Date.now(),{
      redirect:"follow",signal:controller.signal,headers:{"accept":"text/html"},
    });
    const body = await response.text();
    const tipo=response.headers.get("content-type")||"";
    const local=new URL(response.url);
    const login=local.pathname==="/login"||local.pathname.startsWith("/entrar");
    const falha=response.status!==200||login||!/text\/html/i.test(tipo)||body.length<250||
      /<title>\s*(404|not found|just a moment)/i.test(body);
    if(falha){
      falhas.push(item.nome+": HTTP "+response.status+
        (login?" (redirecionado ao login)":"")+
        " · content-type "+tipo+" · tamanho "+body.length);
    }
    console.log((falha?"FAIL":"OK")+" "+item.nome+" · HTTP "+response.status+" · "+body.length+" bytes");
  }catch(error){
    falhas.push(item.nome+": "+(error instanceof Error?error.message:String(error)));
    console.error("FAIL "+item.nome+": "+(error instanceof Error?error.message:String(error)));
  }finally{clearTimeout(timeout);}
}
if(falhas.length){
  console.error("Auditoria pública falhou em "+falhas.length+" de "+alvos.length+" rotas:");
  falhas.forEach(f=>console.error(" - "+f));
  process.exitCode=1;
}else console.log("Rotas públicas e demonstrativas conferidas: "+alvos.length+"/"+alvos.length);
