import {createFileRoute} from "@tanstack/react-router";
import {timingSafeEqual} from "node:crypto";

// Chamado apenas pelo agendador do ORICSE. Nunca usa token ou cron do Gestor 2.0.
export const Route=createFileRoute("/api/oricstudio/jobs/publicar")({
  server:{handlers:{POST:async({request})=>{
    const secret=process.env["ORICSTUDIO_CRON_SECRET"]||"";
    const provided=/^Bearer ([A-Za-z0-9_-]{32,256})$/.exec(
      request.headers.get("authorization")||"")?.[1]||"";
    const expected=Buffer.from(secret);
    const received=Buffer.from(provided);
    if(expected.length<32||expected.length!==received.length||
      !timingSafeEqual(expected,received))
      return Response.json({ok:false,erro:"não autorizado"},{status:401,
        headers:{"Cache-Control":"no-store"}});
    if(process.env["ORICSTUDIO_PUBLICACAO_HOMOLOGADA"]!=="true")
      return Response.json({ok:true,pausado:true,motivo:"Publicação ainda não homologada."});
    try{
      const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
      const {processarFilaOricstudio}=await import("@/lib/oricstudio-publicador.server");
      const result=await processarFilaOricstudio(supabaseAdmin,3);
      return Response.json({ok:true,...result});
    }catch(e){
      console.error("OricStudio publish queue",e instanceof Error?e.message:"falha interna");
      return Response.json({ok:false,erro:"Falha no processamento da fila."},{status:500});
    }
  }}},
});