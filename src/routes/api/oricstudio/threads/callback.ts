import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const params=z.object({state:z.string().min(30).max(256),code:z.string().min(1).max(4096)});
export const Route=createFileRoute("/api/oricstudio/threads/callback")({
  server:{handlers:{
    GET:async({request})=>{
      const back=(result:"conectado"|"erro")=>
        Response.redirect(`https://oricse.vetericio.workers.dev/oricstudio?threads=${result}`,302);
      try {
        const url=new URL(request.url);
        if(url.searchParams.has("error"))return back("erro");
        const parsed=params.safeParse({
          state:url.searchParams.get("state"),
          code:url.searchParams.get("code")
        });
        if(!parsed.success)return back("erro");
        const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
        const {threadsFinalize}=await import("@/lib/oricstudio-threads.server");
        await threadsFinalize(supabaseAdmin,parsed.data.state,parsed.data.code);
        return back("conectado");
      }catch{
        // Não incluir códigos, tokens ou detalhes de erro na URL, resposta ou logs.
        return back("erro");
      }
    }
  }}
});
