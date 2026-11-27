import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const modulo = process.env.ORICSE_TEST_PGLITE_MODULE;
const id = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");

test(
  "SQL: contagem serializada, autoria e reposição isoladas da clínica",
  {
    skip: !modulo && "PGlite local opcional",
  },
  async (t) => {
    const { PGlite } = await import(modulo);
    const db = await PGlite.create();
    t.after(() => db.close());
    await db.exec(`
  create role anon; create role authenticated; create schema auth;
  grant usage on schema auth to authenticated;
  create table auth.users (id uuid primary key, email text, raw_app_meta_data jsonb);
  insert into auth.users values ('${id(91)}','demo@example.test','{"oricse_demo_clinica":"alvorada"}');
  create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('inventario.fixture_uid',true),'')::uuid $$;
  create table public.clinicas(id uuid primary key);
  create table public.fixture_permissoes (clinica uuid, operador uuid, codigo text);
  create function public.oricse_usuario_pode_permissao(clinica uuid, codigo text) returns boolean
  language sql stable security definer set search_path='' as $$
   select exists(select 1 from public.fixture_permissoes p where p.clinica=$1 and p.codigo=$2 and p.operador=auth.uid()) $$;
  create table public.oricse_catalogo_itens (
   id uuid primary key,clinica_id uuid not null references public.clinicas, tipo text not null, nome text not null,
   estoque_atual numeric(12,3), estoque_minimo numeric(12,3), codigo_barras text, venda_por_peso boolean default false,
   ativo boolean default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(clinica_id,id)
  );
  create table public.oricse_vendas_expressas(id uuid primary key,clinica_id uuid not null references public.clinicas,registrada_em timestamptz not null, unique(clinica_id,id));
  create table public.oricse_vendas_expressas_itens(venda_id uuid,clinica_id uuid,item_id uuid,quantidade numeric(12,3),foreign key(clinica_id,venda_id) references public.oricse_vendas_expressas(clinica_id,id),foreign key(clinica_id,item_id) references public.oricse_catalogo_itens(clinica_id,id));
  insert into public.clinicas values ('${id(1)}'),('${id(2)}'),('${id(3)}');
  insert into public.fixture_permissoes values
   ('${id(1)}','${id(4)}','estoque.movimentar'),
   ('${id(1)}','${id(5)}','estoque.catalogo.visualizar'),
   ('${id(3)}','${id(4)}','estoque.movimentar'),
   ('${id(1)}','${id(91)}','estoque.movimentar');
  insert into public.oricse_catalogo_itens (id,clinica_id,tipo,nome,estoque_atual,estoque_minimo,codigo_barras,venda_por_peso,created_at,updated_at) values
   ('${id(6)}','${id(1)}','produto','Ração Exemplo',8,1,'012345',true,now()-interval '40 days','2026-01-01T15:00:00Z'),
   ('${id(7)}','${id(2)}','produto','Produto outra clínica',80,80,'secret',false,now()-interval '40 days','2026-01-01T15:00:00Z'),
   ('${id(8)}','${id(1)}','produto','Saldo desconhecido',null,null,null,false,now()-interval '40 days','2026-01-01T15:00:00Z'),
   ('${id(9)}','${id(1)}','servico','Consulta exemplo',null,null,null,false,now()-interval '40 days','2026-01-01T15:00:00Z'),
   ('${id(16)}','${id(3)}','produto','Produto sem vendas',1,null,null,false,now()-interval '40 days','2026-01-01T15:00:00Z');
  insert into public.oricse_vendas_expressas values ('${id(10)}','${id(1)}', now()-interval '12 days'),
   ('${id(11)}','${id(1)}',now()-interval '3 days'), ('${id(12)}','${id(1)}',now()-interval '2 days'),
   ('${id(13)}','${id(2)}',now()-interval '2 days'),
   ('${id(14)}','${id(1)}',((now() at time zone 'America/Sao_Paulo')::date::timestamp at time zone 'America/Sao_Paulo')+interval '1 minute');
  insert into public.oricse_vendas_expressas_itens values
   ('${id(10)}','${id(1)}','${id(6)}',90), ('${id(11)}','${id(1)}','${id(6)}',2.5),
   ('${id(12)}','${id(1)}','${id(6)}',3.25), ('${id(13)}','${id(2)}','${id(7)}',150),
   ('${id(14)}','${id(1)}','${id(6)}',99);
 `);
    await db.exec(
      fs.readFileSync(
        new URL(
          "../supabase/migrations/20261113010000_historico_estoque_auditoria.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      fs.readFileSync(
        new URL(
          "../supabase/migrations/20261128250000_estoque_contagens_reposicao.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const role = async (name, uid) => {
      await db.exec("reset role; set role " + name);
      await db.query("select set_config('inventario.fixture_uid',$1,false)", [uid ?? ""]);
    };
    const observar = (clinica, busca = "") =>
      db
        .query("select public.oricse_estoque_observado($1,$2) as r", [id(clinica), busca])
        .then((r) => r.rows[0].r);
    const contar = (
      clinica,
      prod,
      contado,
      esperado,
      timestamp,
      pedido,
      motivo = "Conferência física",
    ) =>
      db
        .query("select public.oricse_estoque_registrar_contagem($1,$2,$3,$4,$5,$6,$7) as r", [
          id(clinica),
          id(prod),
          contado,
          esperado,
          timestamp,
          motivo,
          id(pedido),
        ])
        .then((r) => r.rows[0].r);
    await role("anon");
    await assert.rejects(observar(1), (e) => e.code === "42501");
    await role("authenticated", id(5));
    const dados = await observar(1, "racao");
    assert.equal(dados.produtos.length, 1);
    assert.equal(dados.produtos[0].quantidade, 5.75);
    assert.equal(dados.produtos[0].dias, 11);
    assert.equal((await observar(1, "012345")).produtos[0].id, id(6));
    assert.equal((await observar(1, "Consulta")).produtos.length, 0);
    await assert.rejects(observar(2), (e) => e.code === "42501");
    await assert.rejects(contar(1, 6, 4, 8, "2026-01-01T15:00:00Z", 20), (e) => e.code === "42501");
    await assert.rejects(
      db.query("delete from public.oricse_estoque_contagens"),
      (e) => e.code === "42501",
    );
    await role("authenticated", id(91));
    await assert.rejects(contar(1, 6, 4, 8, "2026-01-01T15:00:00Z", 20), (e) => e.code === "42501");
    await role("authenticated", id(4));
    assert.equal((await observar(3)).produtos[0].quantidade, null);
    await assert.rejects(
      contar(1, 7, 1, 80, "2026-01-01T15:00:00Z", 20),
      (e) => e.code === "22023",
    );
    await assert.rejects(
      contar(1, 6, 1.1111, 8, "2026-01-01T15:00:00Z", 20),
      (e) => e.code === "22023",
    );
    const ajuste = await contar(1, 6, 5.25, 8, "2026-01-01T15:00:00Z", 20);
    assert.equal((await contar(1, 6, 5.25, 8, "2026-01-01T15:00:00Z", 20)).id, ajuste.id);
    await assert.rejects(contar(1, 6, 1, 8, "2026-01-01T15:00:00Z", 20), (e) => e.code === "22023");
    await assert.rejects(contar(1, 6, 1, 8, "2026-01-01T15:00:00Z", 21), (e) => e.code === "40001");
    const nova = await contar(1, 8, 0, null, "2026-01-01T15:00:00Z", 22);
    const rows = (
      await db.query(
        "select * from public.oricse_estoque_contagens order by saldo_sistema nulls last",
      )
    ).rows;
    assert.equal(rows.length, 2);
    assert.equal(Number(rows[0].diferenca), -2.75);
    assert.equal(rows[0].operador_id, id(4));
    assert.equal(rows[1].id, nova.id);
    assert.equal(rows[1].diferenca, null);
    assert.equal((await observar(1, "racao")).produtos[0].estoque_atual, 5.25);
    assert.equal((await observar(1, "racao")).produtos[0].quantidade, 5.75);
    await role("authenticated", id(99));
    assert.equal(
      (await db.query("select count(*) as n from public.oricse_estoque_contagens")).rows[0].n,
      0,
    );
    await db.exec("reset role");
    const hist = (await db.query("select * from public.oricse_historico_estoque")).rows;
    assert.equal(hist.length, 1);
    assert.equal(Number(hist[0].quantidade), 2.75);
  },
);
