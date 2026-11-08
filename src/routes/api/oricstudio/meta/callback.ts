import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const params=z.object({
  state:z.string().min(30).max(256),
  code:z.string().min(1).max(4096),
});

export const Route=createFileRoute("/api/oricstudio/meta/callback")({
  server:{
    handlers:{
      GET:async({request})=>{
        const back=(result:"conectado"|"erro",plataforma=false)=>
          Response.redirect(
            `https://oricse.com.br/oricstudio?${plataforma?"ambiente=plataforma&":""}meta=${result}`,302);
        try{
          const url=new URL(request.url);
          if(url.searchParams.has("error"))return back("erro");
          const input=params.safeParse({
            state:url.searchParams.get("state"),
            code:url.searchParams.get("code"),
          });
          if(!input.success)return back("erro");
          const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
          const {finalizeMetaOAuth}=await import("@/lib/oricstudio-meta.server");
          const retorno=await finalizeMetaOAuth(supabaseAdmin,input.data.state,input.data.code);
          return back("conectado",retorno.plataforma);
        }catch{
          // Nunca registrar codes, access tokens ou secrets no log/URL.
          return back("erro");
        }
      },
    },
  },
});
