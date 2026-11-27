/** Run using PGLITE_MODULE pointing at an installed PGlite dist/index.js. No live database. */
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
const a="00000000-0000-4000-8000-000000000001",b="00000000-0000-4000-8000-000000000002";
const u="00000000-0000-4000-8000-000000000011",v="00000000-0000-4000-8000-000000000012";
const card="00000000-0000-4000-8000-000000000021",pix="00000000-0000-4000-8000-000000000022";
const sent="00000000-0000-4000-8000-000000000031",pending="00000000-0000-4000-8000-000000000032";
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    grant usage on schema auth to authenticated;
    create function public.oricse_usuario_pode_permissao(uuid,text) returns boolean language sql stable
    as $$select $1='${a}'::uuid and (auth.uid()='${u}'::uuid or (auth.uid()='${v}'::uuid and $2 like '%.visualizar'))$$;
    create table public.clinicas(id uuid primary key);
    create table public.oricse_caixa_lancamentos(id uuid primary key,clinica_id uuid,tipo text,status text,forma_pagamento text,valor_centavos int,registrado_em timestamptz);
    create table public.oricse_pagamento_lancamentos(id uuid primary key default gen_random_uuid(),clinica_id uuid,funcionario_id uuid,tipo text,valor numeric(12,2),data date,descricao text);
    create table public.oricse_crm_eventos(id uuid primary key,clinica_id uuid,canal text,status text);
    grant select on public.oricse_caixa_lancamentos,public.oricse_crm_eventos to authenticated;
    insert into public.clinicas values ('${a}'),('${b}');
    insert into public.oricse_caixa_lancamentos values ('${card}','${a}','entrada','pago','Crédito',10000,'2026-10-01T12:00:00Z'),('${pix}','${a}','entrada','pago','Pix',10000,'2026-10-01T12:00:00Z');
    insert into public.oricse_crm_eventos values ('${sent}','${a}','whatsapp','enviado'),('${pending}','${a}','whatsapp','pendente');
    insert into public.oricse_pagamento_lancamentos(clinica_id,funcionario_id,tipo,valor,data,descricao) values
      ('${a}','${v}','comissao',15.50,'2026-01-01','Primeira'),('${a}','${v}','comissao',20,'2026-01-31','Segunda'),
      ('${a}','${v}','plantao',40,'2026-01-03','Não é comissão'),('${b}','${v}','comissao',98,'2026-01-04','Outra clínica');
  `);
  for(const file of ["20261128260000_benchmark_conferencia_cartoes.sql","20261128260100_benchmark_fechamento_comissoes.sql","20261128260200_benchmark_acompanhamento_whatsapp.sql"]) {
    await db.exec(await readFile(new URL("../supabase/migrations/"+file,import.meta.url),"utf8"));
  }
  await db.exec(`set role authenticated; set test.uid='${u}';`);
  const checkCard=(c,id,n=9800,dia="2026-10-04")=>db.query("insert into public.oricse_conferencia_cartoes(clinica_id,lancamento_id,liquido_esperado_centavos,recebido_centavos,depositado_em) values($1,$2,$3,9700,$4)",[c,id,n,dia]);
  await checkCard(a,card);
  await checkCard(a,card); // separate audited revisions
  await assert.rejects(checkCard(b,card),/row-level security/);
  await assert.rejects(checkCard(a,pix),/row-level security/);
  await assert.rejects(checkCard(a,card,10001),/row-level security/);
  await assert.rejects(db.exec("delete from public.oricse_conferencia_cartoes"),/permission denied/);
  await assert.rejects(checkCard(a,card,9800,"2026-09-30"),/row-level security/);
  await assert.rejects(checkCard(a,card,9800,"2099-01-01"),/row-level security/);
  const salvarExtrato=(clinica)=>db.query("insert into public.oricse_fechamentos_comissao(clinica_id,funcionario_id,mes,itens,valor_centavos,fechado_por) values($1,$2,'2026-01-01','[{}]'::jsonb,3550,$3)",[clinica,v,u]);
  await assert.rejects(salvarExtrato(a),/permission denied/);
  await db.exec("set role service_role");
  await salvarExtrato(a);
  await assert.rejects(salvarExtrato(a),/duplicate key/);
  await salvarExtrato(b);
  await db.exec("set role authenticated");
  const note=(c,id)=>db.query("insert into public.oricse_whatsapp_acompanhamentos(clinica_id,evento_id,situacao) values($1,$2,'resposta_observada')",[c,id]);
  await note(a,sent);
  await assert.rejects(note(a,pending),/row-level security/);
  await assert.rejects(note(b,sent),/row-level security/);
  await assert.rejects(note(a,sent),/duplicate key/);
  await db.exec(`set test.uid='${v}';`);
  assert.equal((await db.query("select count(*)::int as n from public.oricse_conferencia_cartoes")).rows[0].n,2);
  assert.equal((await db.query("select count(*)::int as n from public.oricse_whatsapp_acompanhamentos")).rows[0].n,1);
  assert.equal((await db.query("select count(*)::int as n from public.oricse_fechamentos_comissao")).rows[0].n,1);
  await assert.rejects(checkCard(a,card),/row-level security/);
  await assert.rejects(salvarExtrato(a),/permission denied/);
  console.log("SQL: revisões, integridade do fechamento, escopo por clínica e permissões passaram");
} finally { await db.close(); }
