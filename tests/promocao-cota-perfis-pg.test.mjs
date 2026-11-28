import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Execução explícita: indique a PGlite já instalada na estação de testes.
const mod = process.env.ORICSE_PGLITE_ENTRY;
test("promocao: cota real, manutenção da cota legada, troca de plano e isolamento", {skip:!mod}, async()=>{
 const {PGlite}=await import(pathToFileURL(mod));
 const db=new PGlite();
 const ids=Array.from({length:50},(_,i)=>"00000000-0000-4000-8000-"+String(i).padStart(12,"0"));
 try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create schema private;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
    create table public.clinicas(id uuid primary key, plano text, limite_usuarios integer, excluido_em timestamptz);
    create table public.oricse_planos(id uuid primary key, codigo text, nome text, usuarios_inclusos integer);
    create table public.clinica_usuarios(clinica_id uuid, user_id uuid, ativo boolean, primary key(clinica_id,user_id));
    create table public.app_users(user_id uuid primary key, role text);
    create table private.beneficios(clinica_id uuid primary key, ilimitado boolean, bonus_perfis integer);
    create function private.oricse_promocao_perfis_ativa(p_clinica_id uuid)
    returns table(ilimitado boolean, bonus_perfis integer) language sql stable as $$
      select coalesce(b.ilimitado,false),coalesce(b.bonus_perfis,0)
      from (select p_clinica_id id) x left join private.beneficios b on b.clinica_id=x.id
    $$;
    insert into public.oricse_planos values
    ('${ids[20]}','essencial','Essencial',1),('${ids[21]}','master','Master',5),('${ids[22]}','solo','Solo',1);
    insert into public.clinicas values
    ('${ids[1]}','essencial',1,null),('${ids[2]}','master',5,null),('${ids[3]}','solo',1,null);
    insert into private.beneficios values ('${ids[1]}',false,2),('${ids[2]}',true,0);
    insert into public.app_users values ('${ids[30]}','admin');
  `);
  await db.exec(readFileSync(new URL("../supabase/migrations/20261128263001_oricse_promocao_cota_perfis_equipe.sql",import.meta.url),"utf8"));
  await db.exec("CREATE TRIGGER clinicas_ajustar_limite_plano BEFORE INSERT OR UPDATE OF plano, limite_usuarios ON public.clinicas FOR EACH ROW EXECUTE FUNCTION public.oricse_ajustar_limite_ao_trocar_plano()");
  const suite = async(id,uid)=>db.query("insert into public.clinica_usuarios values($1,$2,true)",[ids[id],ids[uid]]);
  for (const i of [10,11,12]) await suite(1,i);
  await assert.rejects(suite(1,13),/Limite.*\(3\)/);
  for (const i of [10,11,12,13,14,15,16,17]) await suite(2,i);
  await suite(3,11);
  await assert.rejects(suite(3,12),/Limite.*\(1\)/);
  await db.query("update public.clinicas set limite_usuarios=1 where id=$1",[ids[1]]);
  await db.query("update public.clinicas set limite_usuarios=5 where id=$1",[ids[2]]);
  await assert.rejects(db.query("update public.clinicas set plano='solo' where id=$1",[ids[2]]),/não pode ser menor/);
  const flags=await db.query("select has_function_privilege('anon','public.oricse_cota_perfis_clinica(uuid)','EXECUTE') a, has_function_privilege('authenticated','private.oricse_cota_perfis_equipe(uuid)','EXECUTE') b");
  assert.deepEqual(flags.rows[0],{a:false,b:false});
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${ids[10]}',false); select set_config('request.jwt.claim.role','authenticated',false);`);
  assert.deepEqual((await db.query("select public.oricse_cota_perfis_clinica($1) info",[ids[1]])).rows[0].info,{ilimitado:false,limite:3,bonus_perfis:2});
  assert.deepEqual((await db.query("select public.oricse_cota_perfis_clinica($1) info",[ids[2]])).rows[0].info,{ilimitado:true,limite:null,bonus_perfis:0});
  await assert.rejects(db.query("select public.oricse_cota_perfis_clinica($1)",[ids[3]]),/Sem permissão/);
  await db.exec(`select set_config('request.jwt.claim.sub','${ids[30]}',false);`);
  assert.equal((await db.query("select public.oricse_cota_perfis_clinica($1) info",[ids[3]])).rows[0].info.limite,1);
  await db.exec("reset role; delete from private.beneficios where ilimitado;");
  await assert.rejects(suite(2,19),/Limite.*\(5\)/);
  assert.equal((await db.query("select count(*)::int n from public.clinica_usuarios where clinica_id=$1",[ids[2]])).rows[0].n,8);
 }finally {await db.close();}
});
