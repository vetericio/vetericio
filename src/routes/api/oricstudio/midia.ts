import {createFileRoute} from "@tanstack/react-router";
export const Route=createFileRoute("/api/oricstudio/midia")({
  server:{handlers:{GET:async({request})=>{
    try {
      const {verificarTicketMidiaOricstudio,resolverMidiaAssinadaOricstudio}
        =await import("@/lib/oricstudio-midia.server");
      const ticket=verificarTicketMidiaOricstudio(new URL(request.url).searchParams.get("ticket")||"");
      const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
      const media=await resolverMidiaAssinadaOricstudio(supabaseAdmin,ticket);
      const {baixarMidiaOricstudioServidor}=await import("@/lib/drive.functions");
      return baixarMidiaOricstudioServidor(media.clinicaId,media.registroId);
    }catch {
      // O endpoint é público apenas durante a validade do ticket assinado;
      // não revela se o arquivo, a clínica ou o segredo existem.
      return new Response("Link de mídia inválido ou expirado",{status:404,
        headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
    }
  }}}},
});