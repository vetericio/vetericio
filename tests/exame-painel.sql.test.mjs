import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const modulo = process.env.ORICSE_TEST_PGLITE_MODULE;
const id = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
test(
  "migração: exames são privativos, somente serviço autorizado insere e resultado é imutável",
  { skip: !modulo && "PGlite local opcional" },
  async (t) => {
    const { PGlite } = await import(modulo);
    const db = new PGlite();
    t.after(() => db.close());
    await db.exec(`
    create role authenticated; create role anon; create role service_role bypassrls;
    create table public.clinicas(id uuid primary key);
    create table public.drive_arquivos(id uuid primary key);
    create table public.oricse_animais(id uuid, clinica_id uuid, unique (clinica_id,id));
    insert into public.clinicas values ('${id(1)}'),('${id(2)}');
    insert into public.oricse_animais values ('${id(10)}','${id(1)}'),('${id(20)}','${id(2)}');
  `);
    await db.exec(
      fs.readFileSync(
        new URL(
          "../supabase/migrations/20261127230200_oricse_exames_laboratoriais_clinicos.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const inserir = (clinica, animal) =>
      db.query(
        `
    insert into public.oricse_exames_laboratoriais (id,clinica_id,animal_id,painel,especie,realizado_em,hora_exame,laboratorio,autor_id,autor_nome,resultados)
    values ($1,$2,$3,'bioquimico','Cachorro',date '2024-11-20',time '14:50','Lab fictício',$4,'Nome no registro',$5)
  `,
        [
          id(30),
          clinica,
          animal,
          id(40),
          JSON.stringify([
            {
              parametroId: "ureia",
              nome: "Ureia",
              unidade: "mg/dL",
              valor: "10",
              referencia: "8–22",
            },
          ]),
        ],
      );
    await db.exec("set role authenticated");
    await assert.rejects(inserir(id(1), id(10)), { code: "42501" });
    await assert.rejects(db.query("select * from public.oricse_exames_laboratoriais"), {
      code: "42501",
    });
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from public.oricse_referencias_laboratoriais"), {
      code: "42501",
    });
    await db.exec("set role service_role");
    await assert.rejects(inserir(id(1), id(20)), { code: "23503" });
    await inserir(id(1), id(10));
    await assert.rejects(
      db.query("update public.oricse_exames_laboratoriais set resultados = '[]'"),
      { code: "42501" },
    );
    await db.query(
      `
    insert into public.oricse_referencias_laboratoriais (clinica_id,laboratorio_chave,laboratorio,especie,painel,referencias,atualizado_por)
    values ($1,'lab ficticio','Lab fictício','Cachorro','bioquimico',$2,$3)
  `,
      [
        id(1),
        JSON.stringify([{ parametroId: "ureia", unidade: "mg/dL", referencia: "15–31" }]),
        id(40),
      ],
    );
    assert.equal(
      (await db.query("select resultados from public.oricse_exames_laboratoriais")).rows[0]
        .resultados[0].referencia,
      "8–22",
    );
    await db.exec("set role authenticated");
    await assert.rejects(db.query("select * from public.oricse_exames_laboratoriais"), {
      code: "42501",
    });
  },
);
