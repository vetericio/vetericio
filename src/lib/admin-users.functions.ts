import { createServerFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";

const papelSchema = z.enum(["rt", "veterinario", "auxiliar_estagiario", "recepcao"]);
const dadosPessoaSchema = z.object({
  nomeCompleto: z.string().trim().min(3).max(180),
  crmv: z.string().trim().max(40).default(""),
  crmvUf: z.string().trim().max(2).default(""),
  cpf: z.string().trim().max(18).default(""),
  mapa: z.string().trim().max(70).default(""),
  telefone: z.string().trim().max(30).default(""),
  endereco: z.string().trim().max(350).default(""),
});
const createSchema = z.object({ accessToken:z.string().min(20), clinicaId:z.string().uuid(), username:z.string().min(3).max(40).regex(/^[a-z0-9._-]+$/), password:z.string().min(6).max(128), email:z.string().email().max(180), papel:papelSchema, pessoa:dadosPessoaSchema });
const lerPessoaSchema = z.object({ accessToken:z.string().min(20), userId:z.string().uuid().optional() });
const atualizarPessoaSchema = z.object({ accessToken:z.string().min(20), userId:z.string().uuid(), pessoa:dadosPessoaSchema });

function validarCpf(cpf: string): string | null {
  const digitos = cpf.replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) throw new Error("CPF inválido.");
  const digito = (tamanho: number) => {
    const soma = [...digitos.slice(0, tamanho)].reduce((acc, n, i) => acc + Number(n) * (tamanho + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  if (digito(9) !== Number(digitos[9]) || digito(10) !== Number(digitos[10])) throw new Error("CPF inválido.");
  return digitos;
}

function normalizarPessoa(pessoa: z.infer<typeof dadosPessoaSchema>) {
  const uf = pessoa.crmvUf.trim().toUpperCase();
  if (uf && !/^[A-Z]{2}$/.test(uf)) throw new Error("Informe a UF do CRMV com duas letras.");
  return {
    nome_completo: pessoa.nomeCompleto.trim(),
    crmv: pessoa.crmv.trim() || null,
    crmv_uf: uf || null,
    cpf: validarCpf(pessoa.cpf),
    mapa: pessoa.mapa.trim() || null,
    telefone: pessoa.telefone.trim() || null,
    endereco: pessoa.endereco.trim() || null,
    updated_at: new Date().toISOString(),
  };
}
const resetSchema = z.object({ accessToken:z.string().min(20), userId:z.string().uuid(), password:z.string().min(6).max(128) });
const excluirClinicaSchema = z.object({ accessToken:z.string().min(20), clinicaId:z.string().uuid(), confirmacao:z.literal("APAGAR") });
const atualizarUsuarioSchema = z.object({ accessToken:z.string().min(20), userId:z.string().uuid(), username:z.string().min(3).max(40).regex(/^[a-z0-9._-]+$/), email:z.string().email().max(180) });
const removerUsuarioSchema = z.object({ accessToken:z.string().min(20), clinicaId:z.string().uuid(), userId:z.string().uuid() });

async function requirePlatformAdmin(accessToken:string){
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const {data:authData,error:authError}=await supabaseAdmin.auth.getUser(accessToken);
  if(authError||!authData.user)throw new Error("Sessão inválida ou expirada.");
  const {data:profile}=await supabaseAdmin.from("app_users").select("role").eq("user_id",authData.user.id).maybeSingle();
  if(profile?.role!=="admin")throw new Error("Apenas o administrador da plataforma pode gerenciar usuários.");
  return supabaseAdmin;
}

async function drive(accessToken:string,table:string,operation:"select"|"insert"|"update"|"delete"|"upsert",opts:Record<string,unknown>={}){
  const {executarDriveDbInterno}=await import("@/lib/drive-db.functions");
  return executarDriveDbInterno({ accessToken,table,operation,payload:opts.payload,columns:String(opts.columns||"*"),filters:(opts.filters as any[])||[],order:(opts.order as any[])||[],limit:opts.limit as number|undefined,range:opts.range as [number,number]|undefined,single:(opts.single as any)||"none",head:Boolean(opts.head),count:(opts.count as string|null)||null,onConflict:opts.onConflict as string|undefined } as any) as Promise<any>;
}

async function encontrarUsuarioAuthPorEmail(admin:Awaited<ReturnType<typeof requirePlatformAdmin>>,email:string){
  const porPagina=1000;
  for(let pagina=1;;pagina++){
    const {data,error}=await admin.auth.admin.listUsers({page:pagina,perPage:porPagina});
    if(error)throw new Error(`Não foi possível verificar contas existentes: ${error.message}`);
    const usuario=data.users.find((item)=>item.email?.toLowerCase()===email);
    if(usuario)return usuario;
    if(data.users.length<porPagina)return null;
  }
}

export const criarUsuarioClinica=createServerFn({method:"POST"}).validator((i:unknown)=>createSchema.parse(i)).handler(async({data})=>{
  const admin=await requirePlatformAdmin(data.accessToken);
  // Validar todos os documentos antes de criar a conta Auth, evitando cadastros parciais.
  const pessoaNormalizada=normalizarPessoa(data.pessoa);
  const clinicaResp=await drive(data.accessToken,"clinicas","select",{columns:"id,nome,limite_usuarios",filters:[{kind:"eq",column:"id",value:data.clinicaId}],single:"maybeSingle"});
  const clinica=clinicaResp.data;
  if(!clinica)throw new Error("Clínica não encontrada.");
  const username=data.username.trim().replace(/^@+/,"").toLowerCase();
  const {data:existing,error:existingError}=await admin.from("app_users").select("user_id").eq("username",username).maybeSingle();
  if(existingError)throw new Error(`Não foi possível verificar o @usuário: ${existingError.message}`);
  const technicalEmail=`${username}@vetericio.local`;
  let authUser:User|null=null;
  if(existing?.user_id){const {data:existingAuth,error}=await admin.auth.admin.getUserById(existing.user_id);if(error||!existingAuth.user)throw new Error("O perfil do @usuário existe, mas sua conta de acesso não foi encontrada.");if(existingAuth.user.email?.toLowerCase()!==technicalEmail)throw new Error("Este @usuário já está em uso por outra conta.");authUser=existingAuth.user;}
  if(!authUser){const {data:created,error}=await admin.auth.admin.createUser({email:technicalEmail,password:data.password,email_confirm:true,user_metadata:{username,contact_email:data.email.trim().toLowerCase(),clinica_id:data.clinicaId,papel:data.papel}});if(error||!created.user){const existe=error?.code==="email_exists"||/already (been )?registered|already exists|already in use/i.test(error?.message||"");if(!existe)throw new Error(error?.message||"Não foi possível criar a conta.");authUser=await encontrarUsuarioAuthPorEmail(admin,technicalEmail);if(!authUser)throw new Error(error?.message||"A conta já existe, mas não foi possível localizá-la.");}else authUser=created.user;}
  const {data:profile,error:profileReadError}=await admin.from("app_users").select("user_id,username,role").eq("user_id",authUser.id).maybeSingle();if(profileReadError)throw new Error(profileReadError.message);
  if(existing?.user_id&&existing.user_id!==authUser.id)throw new Error("Este @usuário já está em uso por outra conta.");
  const {data:vinculos,error:vinculosError}=await admin.from("clinica_usuarios").select("clinica_id,ativo").eq("user_id",authUser.id);if(vinculosError)throw new Error(vinculosError.message);
  const vinculoAtual=vinculos?.find((x)=>x.clinica_id===data.clinicaId);if(vinculos?.some((x)=>x.ativo&&x.clinica_id!==data.clinicaId))throw new Error("Esta conta já está vinculada a outra clínica.");
  if(!vinculoAtual?.ativo){const {count,error}=await admin.from("clinica_usuarios").select("user_id",{count:"exact",head:true}).eq("clinica_id",data.clinicaId).eq("ativo",true);if(error)throw new Error(error.message);if((count||0)>=Number(clinica.limite_usuarios||1))throw new Error(`O limite atual desta clínica é ${clinica.limite_usuarios} usuário(s).`);}
  const {error:profileError}=await admin.from("app_users").upsert({user_id:authUser.id,username,role:profile?.role||"user",email:data.email.trim().toLowerCase()},{onConflict:"user_id"});if(profileError)throw new Error(profileError.message);
  const {error:pessoaError}=await admin.from("oricse_pessoas").upsert({
    user_id:authUser.id,...pessoaNormalizada,
  },{onConflict:"user_id"});
  if(pessoaError)throw new Error("Não foi possível salvar os dados da pessoa: "+pessoaError.message);
  const link=vinculoAtual?await admin.from("clinica_usuarios").update({papel:data.papel,ativo:true}).eq("clinica_id",data.clinicaId).eq("user_id",authUser.id):await admin.from("clinica_usuarios").insert({clinica_id:data.clinicaId,user_id:authUser.id,papel:data.papel,ativo:true});if(link.error)throw new Error(link.error.message);
  return{ok:true,userId:authUser.id,username,email:data.email.trim().toLowerCase(),papel:data.papel,contaExistente:Boolean(profile),vinculoExistente:Boolean(vinculoAtual)};
});


/** Cadastro pessoal isolado da tabela pública de identidade. */
export const obterPerfilPessoa=createServerFn({method:"POST"})
  .validator((input:unknown)=>lerPessoaSchema.parse(input))
  .handler(async({data})=>{
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const {data:auth,error:authError}=await supabaseAdmin.auth.getUser(data.accessToken);
    if(authError||!auth.user)throw new Error("Sessão expirada.");
    const userId=data.userId||auth.user.id;
    if(userId!==auth.user.id){
      const {data:perfil,error:perfilError}=await supabaseAdmin.from("app_users").select("role").eq("user_id",auth.user.id).maybeSingle();
      if(perfilError||perfil?.role!=="admin")throw new Error("Sem permissão para consultar este cadastro.");
    }
    const {data:perfil,error}=await supabaseAdmin.from("oricse_pessoas")
      .select("user_id,nome_completo,crmv,crmv_uf,cpf,mapa,telefone,endereco,updated_at")
      .eq("user_id",userId).maybeSingle();
    if(error)throw new Error("Não foi possível carregar o cadastro: "+error.message);
    return perfil||null;
  });

export const atualizarPerfilPessoa=createServerFn({method:"POST"})
  .validator((input:unknown)=>atualizarPessoaSchema.parse(input))
  .handler(async({data})=>{
    const admin=await requirePlatformAdmin(data.accessToken);
    const {data:conta,error:contaError}=await admin.from("app_users").select("user_id")
      .eq("user_id",data.userId).maybeSingle();
    if(contaError||!conta)throw new Error("Usuário não encontrado.");
    const {error}=await admin.from("oricse_pessoas").upsert({
      user_id:data.userId,...normalizarPessoa(data.pessoa),
    },{onConflict:"user_id"});
    if(error)throw new Error("Não foi possível salvar o cadastro pessoal: "+error.message);
    return {ok:true};
  });

export const redefinirSenhaUsuario=createServerFn({method:"POST"}).validator((i:unknown)=>resetSchema.parse(i)).handler(async({data})=>{const admin=await requirePlatformAdmin(data.accessToken);const {error}=await admin.auth.admin.updateUserById(data.userId,{password:data.password});if(error)throw new Error(error.message||"Não foi possível alterar a senha.");return{ok:true};});

export const excluirClinica=createServerFn({method:"POST"}).validator((i:unknown)=>excluirClinicaSchema.parse(i)).handler(async({data})=>{
  const admin=await requirePlatformAdmin(data.accessToken);
  const r=await drive(data.accessToken,"clinicas","select",{columns:"id,nome",filters:[{kind:"eq",column:"id",value:data.clinicaId}],single:"maybeSingle"});if(!r.data)throw new Error("Clínica não encontrada.");
  const {data:vinculos,error}=await admin.from("clinica_usuarios").select("user_id").eq("clinica_id",data.clinicaId);if(error)throw new Error(error.message);const ids=Array.from(new Set((vinculos||[]).map((v)=>v.user_id)));
  const del=await drive(data.accessToken,"clinicas","delete",{filters:[{kind:"eq",column:"id",value:data.clinicaId}]});if(del.error)throw new Error(del.error.message);
  await admin.from("oricse_portal_tutores").delete().eq("clinica_id",data.clinicaId);
  await admin.from("clinica_usuarios").delete().eq("clinica_id",data.clinicaId);
  let contasRemovidas=0;
  for(const userId of ids){const {data:perfil}=await admin.from("app_users").select("role").eq("user_id",userId).maybeSingle();if(perfil?.role==="admin")continue;const {count}=await admin.from("clinica_usuarios").select("user_id",{count:"exact",head:true}).eq("user_id",userId);if((count||0)>0)continue;await admin.from("app_users").delete().eq("user_id",userId);const {error:authError}=await admin.auth.admin.deleteUser(userId);if(!authError)contasRemovidas++;}
  return{ok:true,nome:r.data.nome as string,contasRemovidas};
});

export const atualizarUsuario=createServerFn({method:"POST"}).validator((i:unknown)=>atualizarUsuarioSchema.parse(i)).handler(async({data})=>{
  const admin=await requirePlatformAdmin(data.accessToken);const username=data.username.trim().replace(/^@+/,"").toLowerCase(),email=data.email.trim().toLowerCase();const {data:outro,error}=await admin.from("app_users").select("user_id").eq("username",username).neq("user_id",data.userId).maybeSingle();if(error)throw new Error(error.message);if(outro)throw new Error("Este @usuário já está em uso por outra conta.");const {data:atual,error:erroAtual}=await admin.auth.admin.getUserById(data.userId);if(erroAtual||!atual.user)throw new Error("Conta de acesso não encontrada.");const {error:authError}=await admin.auth.admin.updateUserById(data.userId,{email:`${username}@vetericio.local`,email_confirm:true,user_metadata:{...(atual.user.user_metadata||{}),username,contact_email:email}});if(authError)throw new Error(authError.message);const {error:perfilError}=await admin.from("app_users").update({username,email}).eq("user_id",data.userId);if(perfilError)throw new Error(perfilError.message);return{ok:true};
});

export const removerUsuarioClinica=createServerFn({method:"POST"}).validator((i:unknown)=>removerUsuarioSchema.parse(i)).handler(async({data})=>{
  const admin=await requirePlatformAdmin(data.accessToken);const {error}=await admin.from("clinica_usuarios").delete().eq("clinica_id",data.clinicaId).eq("user_id",data.userId);if(error)throw new Error(error.message);const {data:perfil}=await admin.from("app_users").select("role").eq("user_id",data.userId).maybeSingle();const {count}=await admin.from("clinica_usuarios").select("user_id",{count:"exact",head:true}).eq("user_id",data.userId);let contaExcluida=false;if(perfil?.role!=="admin"&&(count||0)===0){await admin.from("app_users").delete().eq("user_id",data.userId);const {error:authError}=await admin.auth.admin.deleteUser(data.userId);contaExcluida=!authError;}return{ok:true,contaExcluida};
});
