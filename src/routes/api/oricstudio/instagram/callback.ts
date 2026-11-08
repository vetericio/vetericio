import {createFileRoute} from "@tanstack/react-router";
import {z} from "zod";

const params=z.object({
  state:z.string().min(32).max(256),
  code:z.string().min(1).max(4096),
});
export const Route=createFileRoute("/api/oricstudio/instagram/callback")({
  server:{handlers:{GET:async({request})=>{
    // Redireciona sempre para a Oricse; não expõe o código nem o token em URLs.
    const origin=process.env["ORICSTUDIO_PUBLIC_ORIGIN"]||
      "https://oricse.com.br";
    const back=(ok:boolean,platform=false)=>Response.redirect(
      origin+"/oricstudio?"+(platform?"ambiente=plataforma&":"")+
      "meta="+(ok?"conectado":"erro"),302);
    try {
      const url=new URL(request.url);
      if(url.searchParams.has("error"))return back(false);
      const input=params.safeParse(Object.fromEntries(url.searchParams));
      if(!input.success)return back(false);
      const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
      const {finalizarInstagramDireto}=await import("@/lib/oricstudio-instagram.server");
      const result=await finalizarInstagramDireto(supabaseAdmin,input.data.state,input.data.code);
      return back(true,result.plataforma);
    }catch {
      return back(false);
    }
  }}},
});
