import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modulo = process.env.PGLITE_MODULE;
test(
  "Worker anterior compatível antes do primeiro fechamento; rollback não desfaz turno nem memória arquivada",
  {
    skip: !modulo && "PGlite local opcional",
  },
  async () => {
    const { PGlite } = await import(modulo);
    const db = new PGlite();
    const a = "00000000-0000-4000-8000-000000000001";
    const b = "00000000-0000-4000-8000-000000000006";
    const autor = "00000000-0000-4000-8000-000000000002";
    const turno = {
      id: "00000000-0000-4000-8000-000000000003",
      dia: "2026-11-27",
      turno: "diurno",
    };
    const proximo = { ...turno, id: "00000000-0000-4000-8000-000000000004", turno: "noturno" };
    const chTurno = "veterico-plantao-v1";
    const chFichas = "veterico-registros-v1";
    const chArquivo = "veterico-plantoes-v1";
    const chNotas = "veterico-bloco-notas";
    const fichas = [{ id: "ficha-a", animal: "Paciente fictício", medicacoes: [] }];
    const inicial = {
      [chTurno]: JSON.stringify(turno),
      [chFichas]: JSON.stringify(fichas),
      [chArquivo]: "[]",
      [chNotas]: "Nota de demonstração",
      "veterico-alarmes-v1": '[{"ativo":true}]',
    };
    const eventoLegado = (cid, turnoId, chave) =>
      db.query(
        `
    insert into public.oricse_painel_plantao_eventos(clinica_id,turno_chave,tipo,chave,texto,autor_id,autor_nome)
      values($1,$2,'passagem',$3,'texto de teste',$4,'Pessoa de teste')
    returning registrado_em`,
        [cid, turnoId, chave, autor],
      );
    const gravarWorkerAnterior = (cid, dados) =>
      db.query(
        `
    insert into public.oricse_dados_modulos(clinica_id,chave,dados,atualizado_por,atualizado_em)
      values($1,'estado_sistema',$2::jsonb,$3,now())
      on conflict (clinica_id,chave) do update set dados=excluded.dados, atualizado_por=excluded.atualizado_por
    returning dados`,
        [cid, JSON.stringify(dados), autor],
      );
    const ler = async (cid = a) =>
      (await db.query("select dados from public.oricse_dados_modulos where clinica_id=$1", [cid]))
        .rows[0].dados;
    const fechar = (retrato, esperado) =>
      db.query(
        "select public.oricse_encerrar_plantao_atomicamente($1,$2,$3,$4::jsonb,$5::jsonb) as ok",
        [a, autor, turno.id, JSON.stringify(esperado), JSON.stringify(retrato)],
      );
    try {
      await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      grant usage on schema auth to authenticated;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('fixture.usuario',true),'')::uuid $$;
      create table public.clinicas (id uuid primary key);
      create table public.clinica_usuarios (clinica_id uuid not null, user_id uuid not null, ativo boolean not null);
      grant select on public.clinica_usuarios to authenticated;
      insert into public.clinica_usuarios values ('${a}','${autor}',true);
      create table public.oricse_dados_modulos (
        clinica_id uuid not null references public.clinicas(id), chave text not null,
        dados jsonb not null, atualizado_por uuid, atualizado_em timestamptz,
        primary key (clinica_id,chave)
      );
      grant select, insert, update on public.oricse_dados_modulos to service_role;
      grant select, insert, update, delete on public.oricse_dados_modulos to authenticated;
      alter table public.oricse_dados_modulos enable row level security;
      create policy oricse_dados_modulos_select on public.oricse_dados_modulos for select to authenticated
        using (exists(select 1 from public.clinica_usuarios cu where cu.clinica_id=oricse_dados_modulos.clinica_id
           and cu.user_id=(select auth.uid()) and cu.ativo=true));
      create policy oricse_dados_modulos_insert on public.oricse_dados_modulos for insert to authenticated
        with check (atualizado_por=(select auth.uid()) and exists(select 1 from public.clinica_usuarios cu where cu.clinica_id=oricse_dados_modulos.clinica_id
           and cu.user_id=(select auth.uid()) and cu.ativo=true));
      create policy oricse_dados_modulos_update on public.oricse_dados_modulos for update to authenticated
        using (exists(select 1 from public.clinica_usuarios cu where cu.clinica_id=oricse_dados_modulos.clinica_id
           and cu.user_id=(select auth.uid()) and cu.ativo=true)) with check (atualizado_por=(select auth.uid()) and exists(select 1 from public.clinica_usuarios cu where cu.clinica_id=oricse_dados_modulos.clinica_id
           and cu.user_id=(select auth.uid()) and cu.ativo=true));
      create policy oricse_dados_modulos_delete on public.oricse_dados_modulos for delete to authenticated
        using (exists(select 1 from public.clinica_usuarios cu where cu.clinica_id=oricse_dados_modulos.clinica_id
           and cu.user_id=(select auth.uid()) and cu.ativo=true));
    `);
      const migrar = (arquivo) =>
        db.exec(
          readFileSync(new URL(`../supabase/migrations/${arquivo}`, import.meta.url), "utf8"),
        );
      await migrar("20261128220000_oricse_painel_plantao_eventos.sql");
      await db.query("insert into public.clinicas values($1),($2)", [a, b]);
      await db.exec("set role service_role");
      await gravarWorkerAnterior(a, inicial);
      await gravarWorkerAnterior(b, inicial);
      await eventoLegado(a, turno.id, "antes-do-schema");
      await db.exec("reset role");
      await migrar("20261128262000_oricse_integridade_plantao_clinico.sql");
      await migrar("20261128262008_oricse_plantao_ponte_fechamento.sql");
      const grants = (
        await db.query(`
        select
          has_table_privilege('authenticated','public.oricse_fechamentos_plantao','select') as ler_arquivo,
          has_function_privilege('authenticated','private.oricse_plantao_guardar_fechamento_na_transicao()','execute') as executar_guard
      `)
      ).rows[0];
      assert.deepEqual(grants, { ler_arquivo: false, executar_guard: false });
      const editarAvaliacaoPeloApp = (nome) =>
        db.query(
          `
        update public.oricse_dados_modulos
          set dados=jsonb_set(dados,array[$1::text],to_jsonb($2::text)), atualizado_por=auth.uid()
          where clinica_id=$3 and chave='estado_sistema' returning dados
      `,
          [chFichas, JSON.stringify([{ ...fichas[0], observacoes: nome }]), a],
        );
      await db.exec(`set role authenticated; set fixture.usuario='${autor}';`);
      assert.equal((await editarAvaliacaoPeloApp("antes do primeiro fechamento")).rowCount, 1);
      await db.exec("reset role;");

      await db.exec("set role service_role");
      await eventoLegado(a, turno.id, "depois-do-schema");
      await gravarWorkerAnterior(a, { ...(await ler()), preferencia: "preservada" });
      const antes = await ler();
      const retrato = {
        id: turno.id,
        turnoChave: turno.id,
        registros: JSON.parse(antes[chFichas]),
        notas: antes[chNotas],
      };
      await assert.rejects(fechar(retrato, { [chNotas]: "desatualizada" }), /A internação mudou/);
      assert.equal((await ler())[chTurno], inicial[chTurno]);
      assert.equal((await fechar(retrato, antes)).rows[0].ok, true);
      assert.equal((await fechar(retrato, antes)).rows[0].ok, true);
      const fechado = await ler();
      assert.equal(JSON.parse(fechado[chArquivo]).length, 1);
      assert.equal(JSON.parse(fechado[chArquivo])[0].eventos.length, 2);
      for (const chave of [chFichas, chNotas, "veterico-alarmes-v1", "preferencia"])
        assert.equal(fechado[chave], antes[chave]);
      await assert.rejects(eventoLegado(a, turno.id, "fora-do-turno"), /já foi arquivado/);
      await assert.rejects(gravarWorkerAnterior(a, antes), /já foi arquivado/);
      await assert.rejects(
        gravarWorkerAnterior(a, { ...fechado, [chArquivo]: "[]" }),
        /fechamentos arquivados/,
      );
      await assert.rejects(
        gravarWorkerAnterior(a, { ...fechado, [chFichas]: "[]" }),
        /não pode ser esvaziada/,
      );
      // O Worker de rollback ainda pode operar um novo turno e as janelas antigas
      // de Medicação/Pendências em estado fresco, sem tocar o arquivo confirmado.
      await gravarWorkerAnterior(a, { ...fechado, [chTurno]: JSON.stringify(proximo) });
      await db.exec(`reset role; set role authenticated; set fixture.usuario='${autor}';`);
      const editado = (await editarAvaliacaoPeloApp("após o fechamento e virada")).rows[0].dados;
      assert.equal(JSON.parse(editado[chFichas])[0].observacoes, "após o fechamento e virada");
      assert.equal(editado[chArquivo], fechado[chArquivo]);
      await assert.rejects(
        db.query(
          "delete from public.oricse_dados_modulos where clinica_id=$1 and chave='estado_sistema'",
          [a],
        ),
        /não pode ser removido/,
      );
      await db.query(
        `
        insert into public.oricse_dados_modulos(clinica_id,chave,dados,atualizado_por) values($1,'modulo-ficticio','{}'::jsonb,auth.uid())
      `,
        [a],
      );
      assert.equal(
        (
          await db.query(
            "delete from public.oricse_dados_modulos where clinica_id=$1 and chave='modulo-ficticio' returning chave",
            [a],
          )
        ).rowCount,
        1,
      );

      await db.exec("reset role; set role service_role;");

      const aberto = await ler();
      await eventoLegado(a, proximo.id, "turno-novo");
      await gravarWorkerAnterior(a, {
        ...aberto,
        [chFichas]: JSON.stringify([
          { ...fichas[0], medicacoes: [{ nome: "Teste", aplicadoEm: "2026-11-27T11:00Z" }] },
        ]),
        "veterico-pendencias-v1": '[{"id":"teste"}]',
      });
      const operando = await ler();
      assert.equal(JSON.parse(operando[chFichas])[0].medicacoes.length, 1);
      assert.equal(operando["veterico-pendencias-v1"], '[{"id":"teste"}]');
      await assert.rejects(
        gravarWorkerAnterior(a, {
          ...operando,
          [chTurno]: JSON.stringify({ finalizadoEm: "agora" }),
          [chFichas]: "[]",
        }),
        /encerramento antigo/,
      );
      await gravarWorkerAnterior(b, {
        ...(await ler(b)),
        [chFichas]: "[]",
        [chTurno]: JSON.stringify({ finalizadoEm: "agora" }),
      });
      assert.equal((await ler(b))[chFichas], "[]");
      await gravarWorkerAnterior(a, { ...(await ler()), [chFichas]: "[]" });
      assert.equal((await ler())[chFichas], "[]"); // Exclusão no turno novo continua possível.
      const verificado = await ler();
      assert.equal(JSON.parse(verificado[chTurno]).id, proximo.id);
      assert.equal(verificado[chArquivo], fechado[chArquivo]);
      assert.equal(
        (await db.query("select count(*)::int as n from public.oricse_fechamentos_plantao")).rows[0]
          .n,
        1,
      );
    } finally {
      await db.close();
    }
  },
);
