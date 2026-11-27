import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const entry = process.env.ORICSE_PGLITE_ENTRY;
const c = "00000000-0000-4000-8000-000000000001",
  outra = "00000000-0000-4000-8000-000000000002";
const agenda = "00000000-0000-4000-8000-000000000003",
  tutor = "00000000-0000-4000-8000-000000000004";
const animal = "00000000-0000-4000-8000-000000000005",
  servico = "00000000-0000-4000-8000-000000000006";
const data = "2099-11-27";
const dbDate = (dias) => new Date(Date.UTC(2099, 10, 27 + dias)).toISOString().slice(0, 10);

test(
  "migrações em PostgreSQL: série clínica e banho atômicas, exceções, histórico e bloqueio financeiro",
  { skip: !entry },
  async () => {
    const { PGlite } = await import(entry);
    const db = new PGlite();
    try {
      await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; grant usage on schema auth to authenticated;
      create function auth.uid() returns uuid language sql stable as $$ select '00000000-0000-4000-8000-000000000012'::uuid $$;
      create function public.oricse_usuario_pode_permissao(uuid,text) returns boolean language sql stable as $$
        select case when $1='${c}' then $2 in ('recepcao.agenda','hotelzinho.operar') else null end
      $$;
      create table clinicas(id uuid primary key);
      create table tutores(id uuid primary key,clinica_id uuid,nome text,codigo_publico text,telefone text);
      create table oricse_animais(id uuid primary key,clinica_id uuid,tutor_id uuid,nome text,especie text);
      create table oricse_agendas_online (id uuid primary key,clinica_id uuid,tipo text,timezone text,
        inicio time,fim time,dias_semana int[],intervalo_min int);
      create table oricse_agendamentos_online (
        id uuid primary key default gen_random_uuid(),clinica_id uuid,agenda_id uuid, tutor_id uuid,animal_id uuid,
        tutor_auth_id uuid,animal_referencia text,inicio timestamptz,fim timestamptz,estado text,origem text,tipo text,
        dados jsonb default '{}',observacoes text,pagamento_expira_em timestamptz,pagamento_confirmado_em timestamptz,
        updated_at timestamptz default now()
      );
      create table oricse_banho_tosa_agendamentos (
        id uuid primary key default gen_random_uuid(),clinica_id uuid,animal_id uuid,tutor_id uuid,
        servico_id uuid,servico_nome text,inicio timestamptz,fim timestamptz,profissional text,observacoes text,
        valor_centavos int,pago bool default false,status text default 'agendado',atualizado_em timestamptz default now(),
        pacote_id uuid
      );
      create table oricse_banho_tosa_servicos(id uuid primary key,clinica_id uuid,nome text,ativo bool,duracao_min int,preco_centavos int);
      create table oricse_banho_tosa_pagamentos(clinica_id uuid,agendamento_id uuid);
      create table oricse_caixa_lancamentos(clinica_id uuid,agendamento_banho_tosa_id uuid,tipo text,status text);
      insert into clinicas values ('${c}'),('${outra}');
      insert into tutores values ('${tutor}','${c}','João Teste','DEMO01','31999901234');
      insert into oricse_animais values ('${animal}','${c}','${tutor}','Pistache','Cão');
      insert into oricse_agendas_online values ('${agenda}','${c}','Consultório','America/Sao_Paulo','08:00','20:00',array[0,1,2,3,4,5,6],30);
      insert into oricse_banho_tosa_servicos values ('${servico}','${c}','Banho teste',true,30,9900);
      grant select on tutores,oricse_animais,oricse_agendas_online,oricse_banho_tosa_servicos,oricse_banho_tosa_agendamentos to authenticated;
      grant select,insert,update on oricse_agendamentos_online to authenticated;
    `);
      for (const migration of [
        "20261128210000_oricse_agenda_operacional.sql",
        "20261128212000_oricse_banho_agenda_series.sql",
      ]) {
        await db.exec(
          await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"),
        );
      }
      await db.exec("set role authenticated");
      await assert.rejects(
        db.query("select oricse_banho_salvar_serie($1,$2,'09:00','Ana','',p_repeticoes=>3)", [
          outra,
          data,
        ]),
        { code: "42501" },
      );
      await assert.rejects(
        db.query("select oricse_agenda_salvar_horarios($1,$2,$3,'09:00',30,'Bloqueio de agenda')", [
          outra,
          agenda,
          data,
        ]),
        { code: "42501" },
      );

      const search = await db.query("select * from oricse_agenda_buscar_pacientes($1,'JOAO')", [c]);
      assert.equal(search.rows[0].pet_nome, "Pistache");
      assert.equal(
        (await db.query("select * from oricse_agenda_buscar_pacientes($1,'JOAO')", [outra])).rows
          .length,
        0,
      );
      const clinico = (dia, hora, repeticoes = 1) =>
        db.query(
          "select oricse_agenda_salvar_horarios($1,$2,$3,$4,30,'Consulta',$5,$6,p_repeticoes=>$7) as n",
          [c, agenda, dia, hora, tutor, animal, repeticoes],
        );
      assert.equal((await clinico(dbDate(7), "09:00")).rows[0].n, 1);
      await assert.rejects(clinico(data, "09:00", 3), { code: "23P01" });
      assert.equal(
        (await db.query("select count(*)::int n from oricse_agendamentos_online")).rows[0].n,
        1,
      );
      assert.equal((await clinico(data, "13:00", 3)).rows[0].n, 3);
      const edit = (alvo, dia, hora, serie) =>
        db.query(
          "select oricse_agenda_salvar_horarios($1,$2,$3,$4,30,'Consulta',$5,$6,p_editar=>$7,p_inicio_anterior=>$8,p_toda_serie=>$9) as n",
          [c, agenda, dia, hora, tutor, animal, alvo.id, alvo.inicio, serie],
        );
      const fromSerie = () =>
        db
          .query(
            "select * from oricse_agendamentos_online where serie_id is not null order by inicio",
          )
          .then((r) => r.rows);
      const [primeiro, segundo, terceiro] = await fromSerie();
      assert.equal((await edit(segundo, dbDate(8), "14:00", false)).rows[0].n, 1);
      assert.equal((await edit(primeiro, data, "15:00", true)).rows[0].n, 2);
      const serie = await fromSerie();
      assert.equal(serie.find((x) => x.id === segundo.id).serie_excecao, true);
      assert.equal(
        serie
          .find((x) => x.id === terceiro.id)
          .inicio.toISOString()
          .slice(11, 16),
        "18:00",
      );
      await db.query("select oricse_agenda_status_recepcao($1,$2,'Chegou',$3)", [
        c,
        primeiro.id,
        serie[0].inicio,
      ]);
      const eventos = await db.query(
        "select acao,estado_novo from oricse_agenda_historico where agendamento_id=$1",
        [primeiro.id],
      );
      assert.deepEqual(
        new Set(eventos.rows.map((r) => r.acao)),
        new Set(["criacao", "reagendamento", "status"]),
      );
      assert.ok(eventos.rows.some((r) => r.estado_novo === "Chegou"));
      const ontem = (
        await db.query(
          "insert into oricse_agendamentos_online(clinica_id,agenda_id,inicio,fim,estado,origem,tipo) values($1,$2,now()-interval '1 day',now()-interval '23 hours','confirmado','recepcao','Consulta') returning id,inicio",
          [c, agenda],
        )
      ).rows[0];
      await db.query("select oricse_agenda_status_recepcao($1,$2,'Não compareceu',$3)", [
        c,
        ontem.id,
        ontem.inicio,
      ]);
      const falta = (
        await db.query("select estado,dados from oricse_agendamentos_online where id=$1", [
          ontem.id,
        ])
      ).rows[0];
      assert.equal(falta.estado, "cancelado");
      assert.equal(falta.dados.status_clinico, "Não compareceu");
      assert.ok(falta.dados.falta_em);
      await assert.rejects(
        db.query(
          "insert into oricse_agenda_historico(clinica_id,agendamento_id,acao) values($1,$2,'criacao')",
          [c, primeiro.id],
        ),
        { code: "42501" },
      );

      const banho = (dia, hora, n = 3) =>
        db.query("select oricse_banho_salvar_serie($1,$2,$3,'Ana','',$4,$5,$6) n", [
          c,
          dia,
          hora,
          animal,
          servico,
          n,
        ]);
      assert.equal((await banho(data, "09:00")).rows[0].n, 3);
      await assert.rejects(banho(dbDate(-7), "09:00"), { code: "23P01" });
      const lista = (await db.query("select * from oricse_banho_tosa_agendamentos order by inicio"))
        .rows;
      assert.equal(lista.length, 3);
      assert.ok(lista.every((a) => a.valor_centavos === 9900 && !a.pago && a.pacote_id === null));
      await db.exec("reset role");
      assert.equal(
        (await db.query("select count(*)::int n from oricse_caixa_lancamentos")).rows[0].n,
        0,
      );
      await db.query("insert into oricse_caixa_lancamentos values($1,$2,'entrada','pago')", [
        c,
        lista[1].id,
      ]);
      await db.exec("set role authenticated");
      const editarBanho = (alvo, dia, hora, serie) =>
        db.query(
          "select oricse_banho_salvar_serie($1,$2,$3,'Ana','',p_editar=>$4,p_inicio_anterior=>$5,p_toda_serie=>$6) n",
          [c, dia, hora, alvo.id, alvo.inicio, serie],
        );
      await assert.rejects(editarBanho(lista[1], dbDate(7), "10:00", false), /pago ou vinculado/);
      assert.equal((await editarBanho(lista[0], data, "11:00", true)).rows[0].n, 2);
      assert.equal(
        (
          await db.query("select inicio from oricse_banho_tosa_agendamentos where id=$1", [
            lista[1].id,
          ])
        ).rows[0].inicio.toISOString(),
        lista[1].inicio.toISOString(),
      );
    } finally {
      await db.close();
    }
  },
);
