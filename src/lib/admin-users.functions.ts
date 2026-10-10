import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const papelSchema = z.enum(["rt", "veterinario", "auxiliar_estagiario", "recepcao"]);

const createSchema = z.object({
  accessToken: z.string().min(20),
  clinicaId: z.string().uuid(),
  username: z.string().min(3).max(40).regex(/^[a-z0-9._-]+$/),
  password: z.string().min(6).max(128),
  email: z.string().email().max(180),
  papel: papelSchema,
});

const resetSchema = z.object({
  accessToken: z.string().min(20),
  userId: z.string().uuid(),
  password: z.string().min(6).max(128),
});

async function requirePlatformAdmin(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData.user) throw new Error("Sessão inválida ou expirada.");
  const { data: profile } = await supabaseAdmin.from("app_users").select("role").eq("user_id", authData.user.id).maybeSingle();
  if (profile?.role !== "admin") throw new Error("Apenas o administrador da plataforma pode gerenciar usuários.");
  return supabaseAdmin;
}

export const criarUsuarioClinica = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data }) => {
    const supabaseAdmin = await requirePlatformAdmin(data.accessToken);
    const { data: clinica, error: clinicaError } = await supabaseAdmin.from("clinicas").select("id,nome,limite_usuarios").eq("id", data.clinicaId).single();
    if (clinicaError || !clinica) throw new Error("Clínica não encontrada.");

    const { count } = await supabaseAdmin.from("clinica_usuarios").select("user_id", { count: "exact", head: true }).eq("clinica_id", data.clinicaId).eq("ativo", true);
    if ((count || 0) >= Number(clinica.limite_usuarios || 1)) throw new Error(`O limite atual desta clínica é ${clinica.limite_usuarios} usuário(s).`);

    const username = data.username.trim().replace(/^@+/, "").toLowerCase();
    const { data: existing } = await supabaseAdmin.from("app_users").select("user_id").eq("username", username).maybeSingle();
    if (existing?.user_id) throw new Error("Este @usuário já está em uso.");

    const technicalEmail = `${username}@vetericio.local`;
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: technicalEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: { username, contact_email: data.email.trim().toLowerCase(), clinica_id: data.clinicaId, papel: data.papel },
    });
    if (createError || !created.user) throw new Error(createError?.message || "Não foi possível criar a conta.");

    try {
      const { error: profileError } = await supabaseAdmin.from("app_users").insert({
        user_id: created.user.id,
        username,
        role: "user",
        email: data.email.trim().toLowerCase(),
      });
      if (profileError) throw profileError;
      const { error: linkError } = await supabaseAdmin.from("clinica_usuarios").insert({
        clinica_id: data.clinicaId,
        user_id: created.user.id,
        papel: data.papel,
        ativo: true,
      });
      if (linkError) throw linkError;
    } catch (error) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
      throw new Error((error as Error).message || "Não foi possível concluir o vínculo do usuário.");
    }

    return { ok: true, userId: created.user.id, username, email: data.email.trim().toLowerCase(), papel: data.papel };
  });

export const redefinirSenhaUsuario = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => resetSchema.parse(input))
  .handler(async ({ data }) => {
    const supabaseAdmin = await requirePlatformAdmin(data.accessToken);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message || "Não foi possível alterar a senha.");
    return { ok: true };
  });
