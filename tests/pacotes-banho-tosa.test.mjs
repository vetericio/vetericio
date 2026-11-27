import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { pacoteElegivel } from "../src/lib/pacotes-banho-tosa.ts";

test("sugere apenas pacote do serviço, dentro da vigência em São Paulo, com saldo livre", () => {
  const p = {
    status: "ativo",
    disponiveis: 1,
    servicoId: "banho",
    validade: "2026-11-27",
    vendidoEm: "2026-11-20T12:00:00Z",
  };
  const em = new Date("2026-11-28T02:59:59Z");
  assert.equal(pacoteElegivel(p, "banho", em, "2026-11-27"), true);
  assert.equal(pacoteElegivel(p, "tosa", em, "2026-11-27"), false);
  assert.equal(pacoteElegivel({ ...p, disponiveis: 0 }, "banho", em, "2026-11-27"), false);
  assert.equal(pacoteElegivel({ ...p, status: "suspenso" }, "banho", em, "2026-11-27"), false);
  assert.equal(pacoteElegivel(p, "banho", new Date(em.getTime() + 1000), "2026-11-27"), false);
  assert.equal(pacoteElegivel(p, "banho", em, "2026-11-28"), false);
});

const moduleUrl = process.env.ORICSE_PGLITE_MODULE;
const migration = (filename) =>
  readFile(new URL("../supabase/migrations/" + filename, import.meta.url), "utf8");
const id = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");

test(
  "Postgres: venda, reservas, baixa idempotente, extras, estorno e isolamento",
  { skip: !moduleUrl },
  async () => {
    const { PGlite } = await import(moduleUrl);
    const db = await PGlite.create();
    try {
      await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('fixture.uid',true),'')::uuid$$;
      create table public.clinicas(id uuid primary key,slug text,status text);
      create table public.tutores(clinica_id uuid,id uuid,primary key(clinica_id,id));
      create table public.oricse_animais(clinica_id uuid,id uuid,tutor_id uuid,primary key(clinica_id,id));
      create table public.oricse_portal_tutores(clinica_id uuid,tutor_id uuid,auth_user_id uuid,ativo boolean);
      create function public.oricse_usuario_pode_permissao(c uuid,p text) returns boolean language sql stable as $$
        select c='${id(1)}' and (
          auth.uid()='${id(11)}' or (auth.uid()='${id(14)}' and p in ('hotelzinho.visualizar','hotelzinho.operar'))
        ) $$;
      create function public.oricse_portal_pode_acessar_clinica(c uuid) returns boolean language sql stable as $$
        select exists(select 1 from public.oricse_portal_tutores where clinica_id=c and auth_user_id=auth.uid() and ativo) $$;
      insert into auth.users values ('${id(11)}'),('${id(12)}'),('${id(13)}'),('${id(14)}');
      insert into public.clinicas values ('${id(1)}','vetericio','ativa'),('${id(2)}','alvorada','ativa');
      insert into public.tutores values ('${id(1)}','${id(21)}'),('${id(1)}','${id(22)}'),('${id(2)}','${id(21)}');
      insert into public.oricse_animais values
         ('${id(1)}','${id(31)}','${id(21)}'),('${id(1)}','${id(32)}','${id(22)}'),('${id(2)}','${id(31)}','${id(21)}');
      insert into public.oricse_portal_tutores values
         ('${id(1)}','${id(21)}','${id(12)}',true),('${id(1)}','${id(22)}','${id(13)}',true);
    `);
      await db.exec(await migration("20261102022000_oricse_banho_tosa.sql"));
      await db.exec(await migration("20261102024000_oricse_banho_tosa_operacao.sql"));
      await db.exec(`
      create table public.oricse_banho_tosa_pagamentos(id uuid,clinica_id uuid,agendamento_id uuid,valor_centavos integer,forma text,registrado_em timestamptz,registrado_por uuid);
    `);
      await db.exec(await migration("20261102043000_oricse_caixa_geral.sql"));
      await db.exec(await migration("20261102043500_caixa_banho_vinculo.sql"));
      await db.exec(await migration("20261102051500_caixa_banho_saldo_seguro.sql"));
      await db.exec(await migration("20261102060000_caixa_separar_visualizacao_escrita.sql"));
      await db.exec(`
      create table public.oricse_caixa_estornos(clinica_id uuid,lancamento_id uuid,status text);
      grant usage on schema auth to anon,authenticated;
      insert into public.oricse_banho_tosa_servicos(id,clinica_id,nome,preco_centavos) values
        ('${id(41)}','${id(1)}','Banho',7500),('${id(42)}','${id(1)}','Tosa',10000),('${id(43)}','${id(2)}','Banho',8000);
    `);
      await db.exec(await migration("20261128230000_oricse_pacotes_banho_tosa.sql"));

      const as = async (usuario) =>
        db.exec(`reset role; set fixture.uid='${id(usuario)}'; set role authenticated;`);
      const dia = "(now() at time zone 'America/Sao_Paulo')::date";
      const venda = (
        clinica = 1,
        pet = 31,
        requisicao = 71,
        valor = 12000,
        validade = `${dia}+30`,
      ) =>
        db.query(
          `select public.oricse_banho_vender_pacote($1,$2,$3,'Pack de exemplo',1,${validade},$4,'Pix',$5) id`,
          [id(clinica), id(pet), id(41), valor, id(requisicao)],
        );
      const listar = async (portal = false, pet = 31, clinica = 1) =>
        (
          await db.query("select public.oricse_banho_listar_pacotes($1,$2,$3) lista", [
            id(clinica),
            id(pet),
            portal,
          ])
        ).rows[0].lista;
      const agendar = (
        n,
        pacote = null,
        { clinica = 1, tutor = 21, pet = 31, servico = 41, dias = 0 } = {},
      ) =>
        db.query(
          `insert into public.oricse_banho_tosa_agendamentos(id,clinica_id,tutor_id,animal_id,servico_id,servico_nome,inicio,fim,valor_centavos,pacote_id)
       values($1,$2,$3,$4,$5,'Banho',now()+($7::int * interval '1 day'),now()+interval '1 hour'+($7::int * interval '1 day'),7500,$6)`,
          [id(n), id(clinica), id(tutor), id(pet), id(servico), pacote, dias],
        );
      const status = (n, s) =>
        db.query("update public.oricse_banho_tosa_agendamentos set status=$1 where id=$2", [
          s,
          id(n),
        ]);
      const pagamento = (n, agendamento, valor) =>
        db.query(
          `insert into public.oricse_caixa_lancamentos(clinica_id,setor,origem_tipo,origem_id,tipo,status,descricao,valor_centavos,agendamento_banho_tosa_id)
       values($1,'Banho e tosa','banho_tosa_pagamento',$2,'entrada','pago','Extra',$3,$4)`,
          [id(1), id(n), valor, id(agendamento)],
        );

      await as(14);
      await assert.rejects(venda(), /não pode registrar venda/);
      await as(11);
      await assert.rejects(venda(2), /não pode registrar venda/);
      await assert.rejects(venda(1, 99), /Selecione um pet/);
      await assert.rejects(venda(1, 31, 71, 12000, `${dia}-1`), /validade não pode/);
      const pacote = (await venda()).rows[0].id;
      assert.equal((await venda()).rows[0].id, pacote);
      await assert.rejects(venda(1, 31, 71, 13000), /já foi registrada/);
      assert.equal((await listar())[0].disponiveis, 1);
      assert.equal(
        (await db.query("select count(*)::int n from public.oricse_caixa_lancamentos")).rows[0].n,
        1,
      );

      await assert.rejects(agendar(51, pacote, { pet: 32, tutor: 22 }), /mesma clínica/);
      await assert.rejects(agendar(51, pacote, { servico: 42 }), /mesma clínica/);
      await assert.rejects(agendar(51, pacote, { dias: 31 }), /validade/);
      await agendar(51, pacote);
      assert.equal((await listar())[0].reservadas, 1);
      assert.equal((await listar())[0].disponiveis, 0);
      await assert.rejects(agendar(52, pacote), /já foram usadas ou reservadas/);
      await assert.rejects(pagamento(75, 51, 7500), /ultrapassa/);
      await status(51, "cancelado");
      assert.equal((await listar())[0].disponiveis, 1);
      await assert.rejects(status(51, "agendado"), /novo agendamento/);

      await agendar(53);
      await pagamento(77, 53, 500);
      await assert.rejects(
        db.query("update public.oricse_banho_tosa_agendamentos set pacote_id=$1 where id=$2", [
          pacote,
          id(53),
        ]),
        /já tem recebimento/,
      );

      await agendar(52);
      await db.query("update public.oricse_banho_tosa_agendamentos set pacote_id=$1 where id=$2", [
        pacote,
        id(52),
      ]);
      assert.equal(
        (
          await db.query(
            "select valor_centavos as centavos from public.oricse_banho_tosa_agendamentos where id=$1",
            [id(52)],
          )
        ).rows[0].centavos,
        0,
      );
      await db.query(
        "insert into public.oricse_banho_tosa_extras(clinica_id,agendamento_id,descricao,quantidade,valor_unitario_centavos) values($1,$2,'Extra',1,300)",
        [id(1), id(52)],
      );
      await pagamento(76, 52, 300);
      await status(52, "pronto");
      await status(52, "pronto");
      await status(52, "entregue");
      let p = (await listar())[0];
      assert.equal(p.usadas, 1);
      assert.equal(p.reservadas, 0);
      assert.equal(p.status, "esgotado");
      assert.equal(p.historico.length, 1);
      await assert.rejects(status(52, "cancelado"), /sessão já utilizada/);

      await as(12);
      p = (await listar(true))[0];
      assert.equal(p.historico.length, 1);
      assert.equal("valor_centavos" in p, false);
      assert.deepEqual(await listar(true, 32), []);
      await assert.rejects(listar(false), /não pode consultar/);
      await assert.rejects(
        db.query("select id from public.oricse_banho_tosa_pacotes"),
        /permission denied/,
      );
      await as(13);
      assert.deepEqual(await listar(true), []);

      await as(11);
      const p2 = (await venda(1, 31, 78)).rows[0].id;
      await agendar(54, p2);
      await db.exec("reset role");
      await db.query(
        `insert into public.oricse_caixa_estornos(clinica_id,lancamento_id,status)
      select clinica_id,caixa_id,'confirmado' from public.oricse_banho_tosa_pacotes where id=$1`,
        [p2],
      );
      await as(11);
      assert.equal((await listar()).find((p) => p.id === p2).status, "suspenso");
      await assert.rejects(status(54, "pronto"), /pacote está suspenso/);
      await status(54, "cancelado");
      assert.equal((await listar()).find((p) => p.id === p2).usadas, 0);
    } finally {
      await db.close();
    }
  },
);
