import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const base=z.object({
  accessToken:z.string().min(20),
  clinicaId:z.string().uuid(),
});

export const listarContasMetaOricStudio=createServerFn({method:"POST"})
  .validator((i:unknown)=>base.parse(i))
  .handler(async({data})=>{
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const {metaListForClinic}=await import("@/lib/oricstudio-meta.server");
    return metaListForClinic(supabaseAdmin,data.accessToken,data.clinicaId);
  });

export const iniciarConexaoMetaOricStudio=createServerFn({method:"POST"})
  .validator((i:unknown)=>base.parse(i))
  .handler(async({data})=>{
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const {authorizeMetaUrl}=await import("@/lib/oricstudio-meta.server");
    return {url:await authorizeMetaUrl(supabaseAdmin,data.accessToken,data.clinicaId)};
  });

export const desconectarContaMetaOricStudio=createServerFn({method:"POST"})
  .validator((i:unknown)=>base.extend({contaId:z.string().uuid()}).parse(i))
  .handler(async({data})=>{
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const {metaDisconnect}=await import("@/lib/oricstudio-meta.server");
    return metaDisconnect(supabaseAdmin,data.accessToken,data.clinicaId,data.contaId);
  });

export const statusIntegracaoMetaOricStudio=createServerFn({method:"POST"})
  .validator((i:unknown)=>base.parse(i))
  .handler(async({data})=>{
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const {requireMetaEditor,metaConfig}=await import("@/lib/oricstudio-meta.server");
    const editor=await requireMetaEditor(supabaseAdmin,data.accessToken,data.clinicaId,false);
    const cfg=metaConfig();
    // O identificador e o callback OAuth são públicos; a secret jamais sai do servidor.
    // Mesmo com credenciais preenchidas, a Meta deve aprovar o app e o redirect URI.
    return {
      configurada:cfg.configured,
      diagnostico:editor.isPlatformAdmin ? {
        instagramAppId:cfg.clientId,
        callback:cfg.redirectUri,
        formatoIdValido:cfg.clientIdFormatoValido,
      } : null,
    };
  });

export const verificarContaMetaOricStudio=createServerFn({method:"POST"})
  .validator((i:unknown)=>base.extend({contaId:z.string().uuid()}).parse(i))
  .handler(async({data})=>{
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const {verifyAndRefreshMetaAccount}=await import("@/lib/oricstudio-meta.server");
    return verifyAndRefreshMetaAccount(supabaseAdmin,data.accessToken,data.clinicaId,data.contaId);
  });
