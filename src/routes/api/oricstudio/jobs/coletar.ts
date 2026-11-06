import {createFileRoute} from "@tanstack/react-router";
import {timingSafeEqual} from "node:crypto";

// Cron exclusivo OricStudio. Não utiliza segredo ou host do Gestor 2.0.
export const Route=createFileRoute("/api/oricstudio/jobs/coletar")({
  server:{handlers:{POST:async({request})=>{
    const key=process.env["ORICSTUDIO_CRON_SECRET"]||"";
    const supplied=/^Bearer ([A-Za-z0-9_-]{32,256})$/.exec(
      request.headers.get("authorization")||"")?.[1]||"";
    const a=Buffer.from(key),b=Buffer.from(supplied);
    if(a.length<32||a.length!==b.length||!timingSafeEqual(a,b))
      return Response.json({ok:false},{status:401,
        headers:{"Cache-Control":"no-store"}});
    try {
      const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
      const {coletarOricStudio}=await import("@/lib/oricstudio-coletor.server");
      return Response.json({ok:true,...await coletarOricStudio(supabaseAdmin)});
    }catch{
      return Response.json({ok:false,erro:"Coleta indisponível"},{status:500});
    }
  }}},
});
