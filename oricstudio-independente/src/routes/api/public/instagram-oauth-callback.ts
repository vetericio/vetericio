import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Mesmo padrao de seguranca do callback Facebook do Gestor: state SHA256,
// validade de dez minutos, consumo atomico e credenciais apenas no servidor.
const querySchema = z.object({
  code:z.string().min(1).max(4096).optional(),
  state:z.string().min(32).max(256).optional(),
  error:z.string().max(200).optional(),
  error_reason:z.string().max(200).optional(),
  error_description:z.string().max(200).optional(),
});

export const Route=createFileRoute("/api/public/instagram-oauth-callback")({
  server:{handlers:{GET:async({request})=>{
    const {instagramDirectConfig,finalizeInstagramDirect}=await import("@/lib/server/instagram-direct.server");
    const {sha256Hex}=await import("@/lib/server/crypto.server");
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const cfg=instagramDirectConfig();
    const back=(ok:boolean,motivo?:string)=>Response.redirect(
      `${cfg.baseUrl || new URL(request.url).origin}/contas?conexao=${ok?"ok":"erro"}${motivo?`&motivo=${encodeURIComponent(motivo)}`:""}`,302);
    const parsed=querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if(!parsed.success)return back(false,"parametros_invalidos");
    const q=parsed.data;
    if(!q.state)return back(false,"state_ausente");
    const hash=await sha256Hex(q.state);
    const {data:flow,error:flowError}=await supabaseAdmin.from("oauth_states")
      .select("id,user_id,expires_at,used_at").eq("state_hash",hash).maybeSingle();
    if(flowError||!flow)return back(false,"state_invalido");
    if(flow.used_at)return back(false,"state_ja_usado");
    if(Date.parse(flow.expires_at)<=Date.now())return back(false,"state_expirado");
    const {data:consumed,error:consumeError}=await supabaseAdmin.from("oauth_states")
      .update({used_at:new Date().toISOString()}).eq("id",flow.id)
      .is("used_at",null).gt("expires_at",new Date().toISOString()).select("id");
    if(consumeError||!consumed?.length)return back(false,"state_ja_usado");
    if(q.error||q.error_reason)return back(false,"access_denied");
    if(!q.code)return back(false,"code_ausente");
    if(cfg.missing.length)return back(false,"configuracao_incompleta");
    try {
      const result=await finalizeInstagramDirect(supabaseAdmin,flow.user_id,q.code);
      await supabaseAdmin.from("audit_log").insert({
        user_id:flow.user_id,acao:"oauth_instagram_direto",resultado:"sucesso",
        detalhes:{username:result.username},
      });
      return back(true);
    }catch{
      // Nao expor authorization code, tokens, App Secret ou mensagens Meta na URL.
      await supabaseAdmin.from("audit_log").insert({
        user_id:flow.user_id,acao:"oauth_instagram_direto",resultado:"erro",
        detalhes:{motivo:"falha_conexao_ou_persistencia"},
      });
      return back(false,"falha_na_conexao_instagram");
    }
  }}}},
});
