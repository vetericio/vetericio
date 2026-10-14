import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient, User } from "@supabase/supabase-js";
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

async function encontrarUsuarioAuthPorEmail(supabaseAdmin: Awaited<ReturnType<typeof requirePlatformAdmin>>, email: string) {
  const usuariosPorPagina = 1000;
  for (let pagina = 1; ; pagina += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: pagina,
      perPage: usuariosPorPagina,
    });
    if (error) throw new Error(`Não foi possível verificar contas existentes: ${error.message}`);
    const usuario = data.users.find((item) => item.email?.toLowerCase() === email);
    if (usuario) return usuario;
    if (data.users.length < usuariosPorPagina) return null;
  }
}

export const criarUsuarioClinica = createServerFn({ method: "POST" })
  .validator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data }) => {
    const supabaseAdmin = await requirePlatformAdmin(data.accessToken);
    const adminDb = supabaseAdmin as SupabaseClient;
    const { data: clinica, error: clinicaError } = await adminDb
      .from("clinicas")
      .select("id,nome,limite_usuarios")
      .eq("id", data.clinicaId)
      .single();
    if (clinicaError || !clinica) throw new Error("Clínica não encontrada.");

    const username = data.username.trim().replace(/^@+/, "").toLowerCase();
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("app_users")
      .select("user_id")
      .eq("username", username)
      .maybeSingle();
    if (existingError) throw new Error(`Não foi possível verificar o @usuário: ${existingError.message}`);
    const technicalEmail = `${username}@vetericio.local`;
    let authUser: User | null = null;
    if (existing?.user_id) {
      const { data: existingAuth, error: existingAuthError } =
        await supabaseAdmin.auth.admin.getUserById(existing.user_id);
      if (existingAuthError || !existingAuth.user) {
        throw new Error("O perfil do @usuário existe, mas sua conta de acesso não foi encontrada.");
      }
      if (existingAuth.user.email?.toLowerCase() !== technicalEmail) {
        throw new Error("Este @usuário já está em uso por outra conta.");
      }
      authUser = existingAuth.user;
    }

    if (!authUser) {
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: technicalEmail,
        password: data.password,
        email_confirm: true,
        user_metadata: { username, contact_email: data.email.trim().toLowerCase(), clinica_id: data.clinicaId, papel: data.papel },
      });
      if (createError || !created.user) {
        const contaJaExiste =
          createError?.code === "email_exists" ||
          /already (been )?registered|already exists|already in use/i.test(createError?.message || "");
        if (!contaJaExiste) {
          throw new Error(createError?.message || "Não foi possível criar a conta.");
        }
        authUser = await encontrarUsuarioAuthPorEmail(supabaseAdmin, technicalEmail);
        if (!authUser) throw new Error(createError?.message || "A conta já existe, mas não foi possível localizá-la.");
      } else {
        authUser = created.user;
      }
    }

    const { data: profile, error: profileReadError } = await supabaseAdmin
      .from("app_users")
      .select("user_id,username,role")
      .eq("user_id", authUser.id)
      .maybeSingle();
    if (profileReadError) throw new Error(`Não foi possível verificar o perfil existente: ${profileReadError.message}`);
    if (existing?.user_id && existing.user_id !== authUser.id) {
      throw new Error("Este @usuário já está em uso por outra conta.");
    }

    const { data: vinculos, error: vinculosError } = await supabaseAdmin
      .from("clinica_usuarios")
      .select("clinica_id,ativo")
      .eq("user_id", authUser.id);
    if (vinculosError) throw new Error(`Não foi possível verificar os vínculos existentes: ${vinculosError.message}`);
    const vinculoAtual = vinculos?.find((item) => item.clinica_id === data.clinicaId);
    const vinculoAtivoEmOutraClinica = vinculos?.some(
      (item) => item.ativo && item.clinica_id !== data.clinicaId,
    );
    if (vinculoAtivoEmOutraClinica) {
      throw new Error("Esta conta já está vinculada a outra clínica.");
    }

    if (!vinculoAtual?.ativo) {
      const { count, error: countError } = await supabaseAdmin
        .from("clinica_usuarios")
        .select("user_id", { count: "exact", head: true })
        .eq("clinica_id", data.clinicaId)
        .eq("ativo", true);
      if (countError) throw new Error(`Não foi possível verificar as vagas da clínica: ${countError.message}`);
      if ((count || 0) >= Number(clinica.limite_usuarios || 1)) {
        throw new Error(`O limite atual desta clínica é ${clinica.limite_usuarios} usuário(s).`);
      }
    }

    const { error: profileError } = await supabaseAdmin.from("app_users").upsert({
      user_id: authUser.id,
      username,
      role: profile?.role || "user",
      email: data.email.trim().toLowerCase(),
    }, { onConflict: "user_id" });
    if (profileError) {
      throw new Error(`A conta existe, mas não foi possível salvar o perfil: ${profileError.message}`);
    }

    if (vinculoAtual) {
      const { error: linkError } = await supabaseAdmin
        .from("clinica_usuarios")
        .update({ papel: data.papel, ativo: true })
        .eq("clinica_id", data.clinicaId)
        .eq("user_id", authUser.id);
      if (linkError) throw new Error(`A conta existe, mas não foi possível reativar o vínculo: ${linkError.message}`);
    } else {
      const { error: linkError } = await supabaseAdmin.from("clinica_usuarios").insert({
        clinica_id: data.clinicaId,
        user_id: authUser.id,
        papel: data.papel,
        ativo: true,
      });
      if (linkError) throw new Error(`A conta existe, mas não foi possível vinculá-la à clínica: ${linkError.message}`);
    }

    return {
      ok: true,
      userId: authUser.id,
      username,
      email: data.email.trim().toLowerCase(),
      papel: data.papel,
      contaExistente: Boolean(profile),
      vinculoExistente: Boolean(vinculoAtual),
    };
  });

export const redefinirSenhaUsuario = createServerFn({ method: "POST" })
  .validator((input: unknown) => resetSchema.parse(input))
  .handler(async ({ data }) => {
    const supabaseAdmin = await requirePlatformAdmin(data.accessToken);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message || "Não foi possível alterar a senha.");
    return { ok: true };
  });
