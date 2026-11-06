// URLs temporárias assinadas para a API oficial da Meta buscar mídia privada.
// Nenhum arquivo Drive recebe permissão pública permanente.
import {createHmac,timingSafeEqual} from "node:crypto";
import {ORICSTUDIO_PLATAFORMA_ID} from "@/lib/oricstudio-plataforma";

type Ticket={midiaId:string;clinicaId:string;vence:number};
function secret() {
  const key=Buffer.from(process.env["ORICSTUDIO_MIDIA_SIGNING_KEY"]||"","base64");
  if(key.length!==32)throw new Error("Chave de assinatura de mídia OricStudio ausente ou inválida.");
  return key;
}
function assinar(valor:string){
  return createHmac("sha256",secret()).update(valor).digest("base64url");
}
export function criarLinkTemporarioOricstudio(midiaId:string,clinicaId:string,horas=6) {
  if(!/^[0-9a-f-]{36}$/i.test(midiaId)||!/^[0-9a-f-]{36}$/i.test(clinicaId))
    throw new Error("Identificador de mídia/clínica inválido.");
  const duracao=Math.min(Math.max(horas,1),24);
  const ticket:Ticket={midiaId,clinicaId,vence:Date.now()+duracao*3600000};
  const encoded=Buffer.from(JSON.stringify(ticket)).toString("base64url");
  const origin=process.env["ORICSTUDIO_PUBLIC_ORIGIN"]||"https://oricse.vetericio.workers.dev";
  const url=new URL("/api/oricstudio/midia",origin);
  if(url.protocol!=="https:")throw new Error("Servidor OricStudio exige HTTPS.");
  url.searchParams.set("ticket",encoded+"."+assinar(encoded));
  return url.toString();
}
export function verificarTicketMidiaOricstudio(raw:string):Ticket {
  if(raw.length>1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(raw))
    throw new Error("Ticket inválido.");
  const [encoded,signature]=raw.split(".");
  if(!encoded||!signature)throw new Error("Ticket incompleto.");
  const expected=Buffer.from(assinar(encoded),"base64url");
  const received=Buffer.from(signature,"base64url");
  if(received.length!==expected.length||!timingSafeEqual(expected,received))
    throw new Error("Assinatura inválida.");
  let ticket:Ticket;
  try{ticket=JSON.parse(Buffer.from(encoded,"base64url").toString("utf8")) as Ticket;}
  catch{throw new Error("Ticket ilegível.");}
  if(!ticket || !/^[0-9a-f-]{36}$/i.test(ticket.midiaId) ||
    !/^[0-9a-f-]{36}$/i.test(ticket.clinicaId) ||
    !Number.isFinite(ticket.vence) || ticket.vence<Date.now() ||
    ticket.vence>Date.now()+24*3600000)
    throw new Error("Ticket expirado ou inválido.");
  return ticket;
}
export async function resolverMidiaAssinadaOricstudio(db:any,ticket:Ticket){
  const plataforma=ticket.clinicaId===ORICSTUDIO_PLATAFORMA_ID;
  const table=plataforma?"oricstudio_sistema_midias":"oricstudio_midias";
  const query=db.from(table).select("caminho_privado,tipo").eq("id",ticket.midiaId);
  const {data:midia,error}=await (plataforma?query:query.eq("clinica_id",ticket.clinicaId)).maybeSingle();
  if(error||!midia)throw new Error("Mídia não encontrada neste ambiente.");
  if(!plataforma){
    const [{data:clinic},{data:lic}]=await Promise.all([
      db.from("clinicas").select("status,excluido_em").eq("id",ticket.clinicaId).maybeSingle(),
      db.from("oricstudio_licencas").select("status,expira_em").eq("clinica_id",ticket.clinicaId).maybeSingle(),
    ]);
    if(clinic?.status!=="ativa"||clinic?.excluido_em||
       lic?.status!=="ativo"||(lic.expira_em&&Date.parse(lic.expira_em)<=Date.now()))
      throw new Error("A licença da clínica não está válida.");
  }
  return {registroId:String(midia.caminho_privado),clinicaId:ticket.clinicaId};
}
