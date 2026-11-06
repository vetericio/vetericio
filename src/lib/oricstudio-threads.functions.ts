import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const base=z.object({accessToken:z.string().min(20),clinicaId:z.string().uuid().nullable()});

export const listarContasThreadsOricStudio=createServerFn({method:"POST"})
  .validator((i:unknown)=>base.parse(i))
  .handler(async({data})=>{
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const {threadsList}=await import("@/lib/oricstudio-threads.server");
    return threadsList(supabaseAdmin,data.accessToken,data.clinicaId);
  });

export const statusThreadsOricStudio=createServerFn({method:"POST"})
  .validator((i:unknown)=>base.parse(i))
  .handler(async({data})=>{
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const {requireMetaEditor}=await import("@/lib/oricstudio-meta.server");
    const {threadsConfigured}=await import("@/lib/oricstudio-threads.server");
    await requireMetaEditor(supabaseAdmin,data.accessToken,data.clinicaId,false);
    return {configurada:threadsConfigured()};
  });

export const conectarThreadsOricStudio=createServerFn({method:"POST"})
  .validator((i:unknown)=>base.parse(i))
  .handler(async({data})=>{
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const {threadsAuthorize}=await import("@/lib/oricstudio-threads.server");
    return {url:await threadsAuthorize(supabaseAdmin,data.accessToken,data.clinicaId)};
  });

export const desconectarThreadsOricStudio=createServerFn({method:"POST"})
  .validator((i:unknown)=>base.extend({contaId:z.string().uuid()}).parse(i))
  .handler(async({data})=>{
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const {threadsDisconnect}=await import("@/lib/oricstudio-threads.server");
    return threadsDisconnect(supabaseAdmin,data.accessToken,data.clinicaId,data.contaId);
  });

export const verificarThreadsOricStudio=createServerFn({method:"POST"})
  .validator((i:unknown)=>base.extend({contaId:z.string().uuid()}).parse(i))
  .handler(async({data})=>{
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const {threadsVerify}=await import("@/lib/oricstudio-threads.server");
    return threadsVerify(supabaseAdmin,data.accessToken,data.clinicaId,data.contaId);
  });
