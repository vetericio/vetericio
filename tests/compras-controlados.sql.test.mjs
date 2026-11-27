import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

// Testa SQL/roles em PostgreSQL isolado (WASM), sem depender de nenhuma credencial.
// Aponte ORICSE_TEST_PGLITE_MODULE para o entry point do @electric-sql/pglite.
const modulo = process.env.ORICSE_TEST_PGLITE_MODULE;
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test(
  "SQL: escopo, permissões, idempotência, autoria, imutabilidade e nenhum efeito no estoque",
  {
    skip: !modulo && "PGlite local opcional",
  },
  async (t) => {
    const { PGlite } = await import(modulo);
    const db = new PGlite();
    t.after(() => db.close());
    await db.exec(`
    create role authenticated;
    create role anon;
    create role service_role;
    create schema auth;
    create schema oricse_private;
    revoke all on schema oricse_private from public, anon, authenticated;
    create table auth.users (id uuid primary key, email text, raw_app_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
    $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    create table public.clinicas (id uuid primary key, slug text unique, status text, excluido_em timestamptz);
    create table public.clinica_usuarios (clinica_id uuid, user_id uuid, ativo boolean, ver boolean, movimentar boolean);
    create table public.oricse_catalogo_itens (
      id uuid primary key, clinica_id uuid not null, nome text, tipo text, ativo boolean, estoque_atual numeric,
      unique (clinica_id,id)
    );
    create table public.oricse_pessoas (user_id uuid primary key, nome_completo text);
    create table public.app_users (user_id uuid primary key, username text);
    create function public.oricse_usuario_pode_permissao(p_clinica_id uuid, p_codigo text)
    returns boolean language sql security definer set search_path = '' as $$
      select coalesce((select case p_codigo when 'estoque.catalogo.visualizar' then ver
        when 'estoque.movimentar' then movimentar else false end
        from public.clinica_usuarios where user_id = auth.uid() and clinica_id = p_clinica_id and ativo), false)
    $$;
    insert into auth.users values
      ('${id(10)}','autor@localhost',null), ('${id(11)}','finalizador@localhost',null),
      ('${id(12)}','leitor@localhost',null), ('${id(13)}','alheio@localhost',null),
      ('${id(14)}','demo@localhost','{"oricse_demo_clinica":"alvorada"}'),
      ('${id(15)}','desativado@localhost',null), ('${id(16)}','sem-permissao@localhost',null);
    insert into public.clinicas values
      ('${id(1)}','vetericio','ativa',null), ('${id(2)}','outra','ativa',null);
    insert into public.clinica_usuarios values
      ('${id(1)}','${id(10)}',true,true,true), ('${id(1)}','${id(11)}',true,true,true),
      ('${id(1)}','${id(12)}',true,true,false), ('${id(2)}','${id(13)}',true,true,true),
      ('${id(1)}','${id(14)}',true,true,true), ('${id(1)}','${id(15)}',false,true,true),
      ('${id(1)}','${id(16)}',true,false,true);
    insert into public.oricse_catalogo_itens values
      ('${id(20)}','${id(1)}','Produto A','produto',true,12),
      ('${id(21)}','${id(1)}','Produto arquivado','produto',false,2),
      ('${id(22)}','${id(1)}','Serviço','servico',true,null),
      ('${id(23)}','${id(2)}','Produto alheio','produto',true,11);
    insert into public.oricse_pessoas values ('${id(10)}','Autora do cadastro');
    insert into public.app_users values ('${id(11)}','finalizador');
  `);
    await db.exec(
      fs.readFileSync(
        new URL(
          "../supabase/migrations/20261127151000_oricse_compras_controlados.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const autorizar = async (ator, role = "authenticated") => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [ator ?? ""]);
      await db.exec(`set role ${role}`);
    };
    const registro = (opcoes = {}) => {
      const entrada = {
        clinica: id(1),
        compra: null,
        requisicao: id(30),
        data: "2024-02-29",
        produto: id(20),
        quantidade: null,
        fornecedor: null,
        nota: null,
        lote: null,
        finaliza: false,
        ...opcoes,
      };
      return db
        .query(
          "select public.oricse_salvar_compra_controlada($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as compra",
          Object.values(entrada),
        )
        .then(({ rows }) => rows[0].compra);
    };
    const listar = () =>
      db
        .query(
          "select id, status, autor_nome, produto_nome from public.oricse_compras_controlados order by id",
        )
        .then(({ rows }) => rows);
    const completo = {
      quantidade: 2.5,
      fornecedor: "Fornecedor",
      nota: "0001",
      lote: "00A",
      finaliza: true,
    };
    const negado = (r) => assert.rejects(r, { code: "42501" });

    await autorizar(null, "anon");
    await negado(registro());
    await negado(listar());
    await autorizar(id(13));
    assert.deepEqual(await listar(), []);
    await negado(registro());
    await negado(registro({ clinica: id(2), produto: id(23) }));
    await autorizar(id(14));
    await negado(registro());
    await autorizar(id(15));
    await negado(registro());
    await autorizar(id(16));
    await negado(registro());

    await autorizar(id(10));
    const rascunho = await registro();
    assert.equal(rascunho.status, "pendente");
    assert.equal(rascunho.autor_nome, "Autora do cadastro");
    assert.equal((await registro()).id, rascunho.id);
    await assert.rejects(registro({ data: "2024-03-01" }), /tentativa anterior/);
    await assert.rejects(registro({ requisicao: id(31), produto: id(23) }), /produto ativo/);
    await assert.rejects(registro({ requisicao: id(31), produto: id(21) }), /produto ativo/);
    await assert.rejects(registro({ requisicao: id(31), produto: id(22) }), /produto ativo/);
    await assert.rejects(registro({ requisicao: id(31), data: "2099-12-31" }), /futuro/);
    await assert.rejects(registro({ compra: rascunho.id, ...completo, quantidade: -1 }), /Revise/);
    await assert.rejects(
      registro({ compra: rascunho.id, ...completo, fornecedor: "\t " }),
      /fornecedor/,
    );
    await negado(db.query("select autor_id from public.oricse_compras_controlados"));
    await negado(db.query("update public.oricse_compras_controlados set status = 'completo'"));

    // A reentrega idêntica de uma edição também não muda a linha.
    await registro({ compra: rascunho.id, fornecedor: "Fornecedor" });
    await db.exec("reset role");
    const antesRepeticao = await db.query(
      "select atualizado_em from public.oricse_compras_controlados",
    );
    await autorizar(id(10));
    await registro({ compra: rascunho.id, fornecedor: "Fornecedor" });
    await db.exec("reset role");
    assert.deepEqual(
      (await db.query("select atualizado_em from public.oricse_compras_controlados")).rows,
      antesRepeticao.rows,
    );

    await db.exec(`update public.oricse_catalogo_itens set ativo=false where id='${id(20)}'`);
    await db.exec(
      `update public.oricse_pessoas set nome_completo='Nome posterior' where user_id='${id(10)}'`,
    );
    const antes = await db.query("select * from public.oricse_catalogo_itens order by id");

    await autorizar(id(12));
    assert.equal((await listar()).length, 1);
    await negado(registro({ compra: rascunho.id, ...completo }));
    await autorizar(id(13));
    assert.deepEqual(await listar(), []);
    await negado(registro({ compra: rascunho.id, ...completo }));

    await autorizar(id(11));
    await assert.rejects(
      registro({ compra: rascunho.id, produto: id(21), ...completo }),
      /produto ativo/,
    );
    const finalizado = await registro({ compra: rascunho.id, ...completo });
    assert.equal(finalizado.status, "completo");
    assert.equal(finalizado.autor_nome, "Autora do cadastro");
    assert.equal(finalizado.nota_fiscal, "0001");
    assert.equal((await registro({ compra: rascunho.id, ...completo })).id, finalizado.id);
    await assert.rejects(
      registro({ compra: rascunho.id, ...completo, quantidade: 3 }),
      /não pode ser alterada/,
    );
    await autorizar(id(10));
    assert.equal((await registro()).status, "completo");
    assert.equal((await listar()).length, 1);

    await db.exec("reset role");
    assert.deepEqual(
      (await db.query("select * from public.oricse_catalogo_itens order by id")).rows,
      antes.rows,
    );
    assert.equal(
      (await db.query("select finalizado_por from public.oricse_compras_controlados")).rows[0]
        .finalizado_por,
      id(11),
    );
    await assert.rejects(
      db.query("update public.oricse_compras_controlados set autor_nome = 'Alterado'"),
      /autoria/,
    );
    await assert.rejects(
      db.query("delete from public.oricse_compras_controlados"),
      /não pode ser excluído/,
    );
    await db.exec(`update public.clinicas set excluido_em=now() where id='${id(1)}'`);
    await autorizar(id(10));
    assert.deepEqual(await listar(), []);
    await negado(registro());
  },
);
