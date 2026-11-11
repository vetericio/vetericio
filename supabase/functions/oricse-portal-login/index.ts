import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Permite a plataforma e subdomínios ORICSE sem abrir CORS para sites arbitrários.
function origemAutorizada(req: Request): string {
  const origem = req.headers.get("origin") || "";
  const configurada = Deno.env.get("ORICSE_APP_ORIGIN") || "";
  if (["https://oricse.com.br", "https://app.oricse.com.br",
       "https://www.oricse.com.br", "https://oricse.vetericio.workers.dev",
       configurada].includes(origem) && origem) return origem;
  try {
    const u = new URL(origem);
    if (u.protocol === "https:" && !u.port && u.origin === origem &&
        /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.oricse\.com\.br$/.test(u.hostname))
      return origem;
  } catch {}
  return "https://oricse.com.br";
}
const corsBase = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
function normalizarUsuario(valor:unknown){return String(valor??"").trim().replace(/^@+/,"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9._-]+/g,".").replace(/\.{2,}/g,".").replace(/^\.+|\.+$/g,"");}

// Reduz tentativas automáticas no mesmo isolado. O limite persistente deve ser
// aplicado no gateway/banco antes de expor este endpoint em maior escala.
const tentativas=new Map<string,{quantidade:number;inicio:number}>();
function permitidoNoIsolado(chave:string){
  const agora=Date.now(),janela=10*60_000,limite=8,atual=tentativas.get(chave);
  if(!atual||agora-atual.inicio>=janela){tentativas.set(chave,{quantidade:1,inicio:agora});return true;}
  if(atual.quantidade>=limite)return false;
  atual.quantidade+=1;return true;
}
async function permitido(admin:ReturnType<typeof createClient>,chave:string){
  const {data,error}=await admin.rpc("oricse_rate_limit_allow",{p_escopo:"portal_login",p_chave:chave,p_limite:8,p_janela_segundos:600});
  if(!error)return data===true;
  // Compatibilidade segura enquanto a migration ainda não foi aplicada.
  console.error("Rate limit persistente indisponível",error.message);
  return permitidoNoIsolado(chave);
}

const DEMO_ALVORADA_EMAIL = "portal-demo-alvorada@vetericio.local";
const DEMO_ALVORADA_PASSWORD = "alvorada";

function dataDemo(offset:number){
  const data = new Date();
  data.setDate(data.getDate() + offset);
  return data.toISOString().slice(0, 10);
}

async function garantirDemoAlvorada(admin:ReturnType<typeof createClient>){
  const {data:clinica,error:clinicaError}=await admin.from("clinicas")
    .select("id,nome,slug,status")
    .eq("slug","alvorada")
    .eq("status","ativa")
    .maybeSingle();
  if(clinicaError||!clinica)throw new Error("A clínica modelo Alvorada não está disponível.");

  const usuarios=await admin.auth.admin.listUsers({page:1,perPage:1000});
  if(usuarios.error)throw new Error("Não foi possível consultar o acesso de demonstração.");
  let demoUser=usuarios.data.users.find((item)=>item.email===DEMO_ALVORADA_EMAIL);
  if(!demoUser){
    const criado=await admin.auth.admin.createUser({
      email:DEMO_ALVORADA_EMAIL,
      password:DEMO_ALVORADA_PASSWORD,
      email_confirm:true,
      user_metadata:{tipo:"portal_demo",clinica_slug:"alvorada"},
    });
    if(criado.error||!criado.data.user)throw new Error("Não foi possível preparar o acesso de demonstração.");
    demoUser=criado.data.user;
  }else{
    const atualizado=await admin.auth.admin.updateUserById(demoUser.id,{password:DEMO_ALVORADA_PASSWORD,email_confirm:true});
    if(atualizado.error)throw new Error("Não foi possível atualizar o acesso de demonstração.");
  }

  const cpfDemo="52998224725";
  let tutor=(await admin.from("tutores").select("id").eq("clinica_id",clinica.id).eq("cpf_digitos",cpfDemo).limit(1).maybeSingle()).data;
  if(!tutor){
    const criado=await admin.from("tutores").insert({
      clinica_id:clinica.id,
      nome:"Mariana Oliveira",
      cpf:cpfDemo,
      telefone:"(31) 99999-0000",
      email:"mariana.demo@alvorada.oricse.com.br",
      dados:{demo:true,observacao:"Tutor fictício do portal de demonstração."},
    }).select("id").single();
    if(criado.error||!criado.data)throw new Error("Não foi possível preparar o tutor de demonstração.");
    tutor=criado.data;
  }

  const portalAtual=(await admin.from("oricse_portal_tutores").select("id").eq("clinica_id",clinica.id).eq("usuario_chave","alvorada").limit(1).maybeSingle()).data;
  const portalPayload={clinica_id:clinica.id,tutor_id:tutor.id,auth_user_id:demoUser.id,usuario:"alvorada",usuario_chave:"alvorada",clinica_slug:"alvorada",ativo:true,senha_atualizada_em:new Date().toISOString(),updated_at:new Date().toISOString()};
  const portal=portalAtual
    ? await admin.from("oricse_portal_tutores").update(portalPayload).eq("id",portalAtual.id).select("id,auth_user_id").single()
    : await admin.from("oricse_portal_tutores").insert(portalPayload).select("id,auth_user_id").single();
  if(portal.error||!portal.data)throw new Error("Não foi possível preparar o login de demonstração.");

  const animaisDemo=[
    {nome:"Lua",especie:"Gato",raca:"SRD",sexo:"Fêmea",nascimento:"2023-03-15",peso_kg:4.2},
    {nome:"Thor",especie:"Cão",raca:"Golden Retriever",sexo:"Macho",nascimento:"2021-08-10",peso_kg:28},
    {nome:"Mel",especie:"Cão",raca:"Shih-tzu",sexo:"Fêmea",nascimento:"2024-01-20",peso_kg:6.4},
  ];
  const animais:Record<string,string>[]=[];
  for(const item of animaisDemo){
    let animal=(await admin.from("oricse_animais").select("id,nome").eq("clinica_id",clinica.id).eq("tutor_id",tutor.id).eq("nome",item.nome).limit(1).maybeSingle()).data;
    if(!animal){
      const criado=await admin.from("oricse_animais").insert({...item,clinica_id:clinica.id,tutor_id:tutor.id,dados:{demo:true}}).select("id,nome").single();
      if(criado.error||!criado.data)throw new Error("Não foi possível preparar os animais de demonstração.");
      animal=criado.data;
    }
    animais.push(animal);
  }
  const lua=animais.find((item)=>item.nome==="Lua")!;
  const thor=animais.find((item)=>item.nome==="Thor")!;
  const mel=animais.find((item)=>item.nome==="Mel")!;
  const inserirSeAusente=async(table:string,match:Record<string,unknown>,payload:Record<string,unknown>)=>{
    const existente=(await admin.from(table).select("id").match(match).limit(1).maybeSingle()).data;
    if(!existente){const criado=await admin.from(table).insert(payload);if(criado.error)throw criado.error;}
  };
  await inserirSeAusente("oricse_portal_vacinas",{clinica_id:clinica.id,animal_id:lua.id,nome:"Polivalente felina V4"},{clinica_id:clinica.id,animal_id:lua.id,nome:"Polivalente felina V4",aplicada_em:dataDemo(-120),reforco_em:dataDemo(20),lote:"ALV-2026-01",observacoes:"Aplicação registrada na clínica modelo.",visivel_tutor:true});
  await inserirSeAusente("oricse_portal_vacinas",{clinica_id:clinica.id,animal_id:thor.id,nome:"Antirrábica"},{clinica_id:clinica.id,animal_id:thor.id,nome:"Antirrábica",aplicada_em:dataDemo(-90),reforco_em:dataDemo(275),lote:"ALV-2026-02",observacoes:"Carteira atualizada.",visivel_tutor:true});
  await inserirSeAusente("oricse_portal_vermifugos",{clinica_id:clinica.id,animal_id:mel.id,nome:"Vermífugo de rotina"},{clinica_id:clinica.id,animal_id:mel.id,nome:"Vermífugo de rotina",administrado_em:dataDemo(-45),proxima_dose_em:dataDemo(45),observacoes:"Dose de manutenção.",visivel_tutor:true});
  await inserirSeAusente("oricse_portal_exames",{clinica_id:clinica.id,animal_id:lua.id,titulo:"Hemograma completo"},{clinica_id:clinica.id,animal_id:lua.id,titulo:"Hemograma completo",tipo:"Exame laboratorial",realizado_em:dataDemo(-8),resultado_resumo:"Parâmetros hematológicos dentro do esperado para a paciente.",visivel_tutor:true});
  await inserirSeAusente("oricse_portal_exames",{clinica_id:clinica.id,animal_id:thor.id,titulo:"Ultrassonografia abdominal"},{clinica_id:clinica.id,animal_id:thor.id,titulo:"Ultrassonografia abdominal",tipo:"Imagem",realizado_em:dataDemo(-35),resultado_resumo:"Laudo disponível para consulta do tutor.",visivel_tutor:true});
  await inserirSeAusente("oricse_portal_documentos",{clinica_id:clinica.id,animal_id:lua.id,titulo:"Cartão de vacinação"},{clinica_id:clinica.id,animal_id:lua.id,titulo:"Cartão de vacinação",tipo:"Carteira",data_documento:dataDemo(-8),observacoes:"Documento demonstrativo.",visivel_tutor:true});
  await inserirSeAusente("oricse_portal_documentos",{clinica_id:clinica.id,animal_id:mel.id,titulo:"Comprovante de atendimento"},{clinica_id:clinica.id,animal_id:mel.id,titulo:"Comprovante de atendimento",tipo:"Atendimento",data_documento:dataDemo(-15),observacoes:"Registro fictício para demonstração.",visivel_tutor:true});
  await inserirSeAusente("oricse_portal_receitas",{clinica_id:clinica.id,animal_id:thor.id,titulo:"Receita veterinária"},{clinica_id:clinica.id,animal_id:thor.id,tutor_id:tutor.id,tipo:"normal",numero:"ALV-DEMO-001",titulo:"Receita veterinária",emitida_em:dataDemo(-12),resumo:"Uso conforme orientação do médico-veterinário.",visivel_tutor:true});

  const agendas:Record<string,string>[]=[];
  for(const item of [
    {nome:"Consultas veterinárias",responsavel:"Dra. Luciana",tipo:"Consulta",cor:"verde"},
    {nome:"Banho e tosa",responsavel:"Equipe Alvorada",tipo:"Banho e Tosa",cor:"laranja"},
  ]){
    let agenda=(await admin.from("oricse_agendas_online").select("id,nome").eq("clinica_id",clinica.id).eq("nome",item.nome).limit(1).maybeSingle()).data;
    if(!agenda){
      const criado=await admin.from("oricse_agendas_online").insert({clinica_id:clinica.id,...item,inicio:"08:00",fim:"18:00",dias_semana:[1,2,3,4,5],intervalo_min:30,portal_ativo:true,modalidade:"aprovacao",antecedencia_horas:2,timezone:"America/Sao_Paulo",portal_regra_dias:"semanal",portal_datas_horarios:{}}).select("id,nome").single();
      if(criado.error||!criado.data)throw new Error("Não foi possível preparar as agendas de demonstração.");
      agenda=criado.data;
    }
    agendas.push(agenda);
  }
  const agendaConsulta=agendas[0];
  const agendaBanho=agendas[1];
  await inserirSeAusente("oricse_agendamentos_online",{clinica_id:clinica.id,tutor_id:tutor.id,animal_id:lua.id,tipo:"Consulta de rotina",observacoes:"Demonstração ORICSE"},{clinica_id:clinica.id,agenda_id:agendaConsulta.id,tutor_auth_id:demoUser.id,tutor_id:tutor.id,animal_id:lua.id,animal_referencia:"Lua",inicio:`${dataDemo(7)}T09:30:00-03:00`,fim:`${dataDemo(7)}T10:00:00-03:00`,estado:"confirmado",tipo:"Consulta de rotina",origem:"portal_tutor",observacoes:"Demonstração ORICSE",dados:{demo:true,status_clinico:"Confirmado",profissional:"Dra. Luciana"}});
  await inserirSeAusente("oricse_agendamentos_online",{clinica_id:clinica.id,tutor_id:tutor.id,animal_id:thor.id,tipo:"Banho e Tosa",observacoes:"Demonstração ORICSE"},{clinica_id:clinica.id,agenda_id:agendaBanho.id,tutor_auth_id:demoUser.id,tutor_id:tutor.id,animal_id:thor.id,animal_referencia:"Thor",inicio:`${dataDemo(12)}T14:00:00-03:00`,fim:`${dataDemo(12)}T15:00:00-03:00`,estado:"solicitado",tipo:"Banho e Tosa",origem:"portal_tutor",observacoes:"Demonstração ORICSE",dados:{demo:true,status_clinico:"Aguardando aprovação",profissional:"Equipe Alvorada"}});
  await inserirSeAusente("oricse_portal_comandas",{clinica_id:clinica.id,tutor_id:tutor.id,animal_id:lua.id,numero:1001},{id:crypto.randomUUID(),clinica_id:clinica.id,tutor_id:tutor.id,animal_id:lua.id,numero:1001,status:"Aberta",origem:"Portal do Tutor",aberta_em:new Date().toISOString(),itens:[{id:"demo-consulta",descricao:"Consulta de rotina",quantidade:1,valorUnitario:85}],pagamentos:[],total:85,total_pago:0,saldo:85,visivel_tutor:true});
  await inserirSeAusente("oricse_portal_comandas",{clinica_id:clinica.id,tutor_id:tutor.id,animal_id:thor.id,numero:1002},{id:crypto.randomUUID(),clinica_id:clinica.id,tutor_id:tutor.id,animal_id:thor.id,numero:1002,status:"Finalizada",origem:"Recepção",aberta_em:new Date(Date.now()-7*86400000).toISOString(),finalizada_em:new Date(Date.now()-6*86400000).toISOString(),itens:[{id:"demo-vacina",descricao:"Vacinação + avaliação",quantidade:1,valorUnitario:320}],pagamentos:[{id:"demo-pagamento",valor:320,formaPagamento:"PIX",data:dataDemo(-6)}],total:320,total_pago:320,saldo:0,visivel_tutor:true});
  await admin.from("oricse_portal_tutor_config").upsert({clinica_id:clinica.id,mensagem_boas_vindas:"Bem-vindo ao Portal do Tutor da Alvorada!",telefone_publico:"(31) 3333-0000",whatsapp_publico:"(31) 99999-0000",instrucoes_agendamento:"Escolha o serviço e o horário disponíveis. Esta é uma clínica modelo.",exibir_agendamento:true,exibir_documentos:true,nome_exibicao:"Alvorada Clínica Veterinária",canais_contato:{whatsapp:"(31) 99999-0000",instagram:"https://www.instagram.com/",facebook:"https://www.facebook.com/",email:"contato@alvorada.oricse.com.br",telefone:"(31) 3333-0000",horario:"Segunda a sexta, 8h às 18h"},updated_at:new Date().toISOString()},{onConflict:"clinica_id"});
  return {id:portal.data.id,auth_user_id:portal.data.auth_user_id,email:DEMO_ALVORADA_EMAIL};
}

Deno.serve(async(req)=>{
  const cors={...corsBase,"Access-Control-Allow-Origin":origemAutorizada(req),"Content-Type":"application/json"};
  const resposta=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return resposta({error:"Método não permitido."},405);
  try{
    const payload=await req.json().catch(()=>({}));
    const slug=String(payload?.slug??"").trim().toLowerCase();
    const usuarioChave=normalizarUsuario(payload?.usuario);
    const senha=String(payload?.senha??"");
    if(!slug||usuarioChave.length<3||!senha)return resposta({error:"Usuário ou senha inválidos."},401);
    const ip=(req.headers.get("x-forwarded-for")||"desconhecido").split(",")[0].trim();
    const url=Deno.env.get("SUPABASE_URL")!;
    const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
    if(!await permitido(admin,`${ip}:${slug}:${usuarioChave}`))return resposta({error:"Muitas tentativas. Aguarde alguns minutos antes de tentar novamente."},429);
    const demoAlvorada=slug==="alvorada"&&usuarioChave==="alvorada"&&senha===DEMO_ALVORADA_PASSWORD;
    let portal:any;
    let portalError:any=null;
    if(demoAlvorada){
      portal=await garantirDemoAlvorada(admin);
    }else{
      const consulta=await admin.from("oricse_portal_tutores")
        .select("id,auth_user_id,ativo")
        .eq("clinica_slug",slug)
        .eq("usuario_chave",usuarioChave)
        .eq("ativo",true)
        .maybeSingle();
      portal=consulta.data;
      portalError=consulta.error;
    }
    if(portalError||!portal?.auth_user_id)return resposta({error:"Usuário ou senha inválidos."},401);

    const {data:usuarioAuth,error:erroAuth}=await admin.auth.admin.getUserById(portal.auth_user_id);
    const email=demoAlvorada?DEMO_ALVORADA_EMAIL:usuarioAuth.user?.email;
    if(erroAuth||!email)return resposta({error:"Usuário ou senha inválidos."},401);

    const publico=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:login,error:erroLogin}=await publico.auth.signInWithPassword({email,password:senha});
    if(erroLogin||!login.session||!login.user||login.user.id!==portal.auth_user_id)return resposta({error:"Usuário ou senha inválidos."},401);

    await admin.from("oricse_portal_tutores").update({ultimo_acesso_em:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",portal.id);
    return resposta({access_token:login.session.access_token,refresh_token:login.session.refresh_token,expires_in:login.session.expires_in,expires_at:login.session.expires_at,token_type:login.session.token_type});
  }catch(error){console.error("oricse-portal-login",error);return resposta({error:"Não foi possível entrar agora."},500);}
});
