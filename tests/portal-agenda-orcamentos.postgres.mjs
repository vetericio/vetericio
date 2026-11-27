// Run with PGLITE_IMPORT pointing at the module for an installed @electric-sql/pglite.
// Exercises real PostgreSQL, not SQL regex snapshots. No external DB connection.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const modulo = process.env.PGLITE_IMPORT;
const uuid = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const [
  clinica,
  outra,
  equipe,
  tutor,
  terceiro,
  pet,
  petOutro,
  agenda,
  catalogo,
  servico,
  proposta,
  outroTutor,
  recepcao,
  agOutro,
  outroCatalogo,
  semAcesso,
  demo,
  vencido,
  precoMudou,
] = Array.from({ length: 19 }, (_, i) => uuid(i + 1));
const sql = await readFile(
  new URL(
    "../supabase/migrations/20261128240000_oricse_portal_confirmacoes_orcamentos.sql",
    import.meta.url,
  ),
  "utf8",
);

test(
  "Portal: vínculo e papel, agenda sem alterar reserva, aprovação e comanda idempotentes",
  { skip: !modulo },
  async () => {
    const { PGlite } = await import(modulo);
    const db = new PGlite();
    try {
      await db.exec(`
      create role anon; create role authenticated; create role service_role; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('test.jwt',true),'')::jsonb,'{}')$$;
      grant usage on schema auth to authenticated;
      create table public.clinicas(id uuid primary key,status text not null,excluido_em timestamptz);
      create table public.tutores(clinica_id uuid,id uuid,nome text,primary key(clinica_id,id));
      create table public.oricse_animais(clinica_id uuid,id uuid,tutor_id uuid,nome text,primary key(clinica_id,id));
      create table public.oricse_portal_tutores(clinica_id uuid,tutor_id uuid,auth_user_id uuid,ativo boolean);
      create table public.oricse_catalogo_itens(clinica_id uuid,id uuid,ativo boolean,tipo text,nome text,valor numeric,faixas_peso jsonb,primary key(clinica_id,id));
      create table public.oricse_agendamentos_online(id uuid primary key,clinica_id uuid,tutor_id uuid,animal_id uuid,tipo text,animal_referencia text,
        inicio timestamptz,estado text,dados jsonb,pagamento_id uuid,pagamento_confirmado_em timestamptz);
      create table public.oricse_portal_comandas(id uuid primary key,clinica_id uuid,tutor_id uuid,animal_id uuid,numero bigint,status text,
        origem text,aberta_em timestamptz,finalizada_em timestamptz,itens jsonb,pagamentos jsonb,total numeric(12,2),total_pago numeric(12,2),saldo numeric(12,2),
        visivel_tutor boolean,atendimento_registro_id uuid,updated_at timestamptz);
      create table public.oricse_caixa_lancamentos(clinica_id uuid,setor text,origem_tipo text,origem_id uuid,tipo text,status text,descricao text,
        valor_centavos integer,forma_pagamento text,registrado_por uuid,detalhes jsonb,unique(clinica_id,origem_tipo,origem_id));
      create table public.app_users(user_id uuid,username text,email text);
      create function public.oricse_clinica_tem_funcionalidade(uuid,text) returns boolean language sql as $$select true$$;
      create function public.oricse_portal_pode_acessar_clinica(c uuid) returns boolean language sql as $$
        select exists(select 1 from public.oricse_portal_tutores p where p.clinica_id=c and p.auth_user_id=auth.uid() and p.ativo)
      $$;
      create function public.oricse_usuario_pode_permissao(c uuid, p text) returns boolean language sql as $$
        select c='${clinica}' and ((auth.uid()='${equipe}' and p='caixa.comandas') or (auth.uid()='${recepcao}' and p='recepcao.agenda'))
      $$;
      create function public.oricse_caixa_pode_operar(c uuid) returns boolean language sql as $$select public.oricse_usuario_pode_permissao(c,'caixa.comandas')$$;
      grant insert, update, delete, select on public.oricse_portal_comandas to authenticated;
      insert into auth.users select x from unnest(array['${equipe}','${tutor}','${terceiro}','${outroTutor}','${recepcao}','${semAcesso}','${demo}']::uuid[]) x;
      insert into public.clinicas(id,status) values ('${clinica}','ativa'),('${outra}','ativa');
      insert into public.tutores values ('${clinica}','${tutor}','Tutor'),('${clinica}','${terceiro}','Outro tutor'),('${outra}','${outroTutor}','Tutor de outra clínica');
      insert into public.oricse_animais values ('${clinica}','${pet}','${tutor}','Pet'),('${outra}','${petOutro}','${outroTutor}','Outro pet');
      insert into public.oricse_portal_tutores values ('${clinica}','${tutor}','${tutor}',true),('${clinica}','${terceiro}','${terceiro}',true),
        ('${outra}','${outroTutor}','${outroTutor}',true);
      insert into public.app_users values ('${equipe}','Equipe de teste',null);
      insert into public.oricse_agendamentos_online values
        ('${agenda}','${clinica}','${tutor}','${pet}','Consulta','Pet',now()+interval '7 days','confirmado','{}','${agenda}',now()),
        ('${agOutro}','${outra}','${outroTutor}','${petOutro}','Consulta','Pet 2',now()+interval '7 days','confirmado','{}',null,null);
      insert into public.oricse_catalogo_itens values
        ('${clinica}','${catalogo}',true,'produto','Produto:',2.50,'[]'),
        ('${clinica}','${servico}',true,'servico','Serviço',19.50,
          '[{"especie":"Cão","ateKg":5,"valor":30},{"especie":"Cão","ateKg":null,"valor":42},{"sexo":"Fêmea","ateKg":null,"valor":65}]'),
        ('${outra}','${outroCatalogo}',true,'produto','Não compartilhar',1.00,'[]');
    `);
      await db.exec(sql);

      const role = async (actor, extra = "{}") => {
        await db.exec("reset role");
        await db.query("select set_config('test.uid',$1,false),set_config('test.jwt',$2,false)", [
          actor,
          extra,
        ]);
        await db.exec("set role authenticated");
      };
      const value = async (query, args = []) => (await db.query(query, args)).rows[0]?.v;
      const f = (name, arity, params) =>
        value(
          `select public.${name}(${Array.from({ length: arity }, (_, i) => "$" + (i + 1)).join(",")}) v`,
          params,
        );
      const agendaDados = async () => {
        await db.exec("reset role");
        const {
          rows: [res],
        } = await db.query(
          "select inicio::text,estado,dados,pagamento_id from public.oricse_agendamentos_online where id=$1",
          [agenda],
        );
        return res;
      };

      const original = await agendaDados();
      await role(terceiro);
      const interagir = (acao, mensagem, pedido = null, horario = original.inicio) =>
        f("oricse_portal_agenda_interagir", 6, [clinica, agenda, horario, acao, mensagem, pedido]);
      await assert.rejects(interagir("confirmacao", null), { code: "42501" });
      assert.deepEqual(await f("oricse_portal_agenda_respostas", 2, [clinica, terceiro]), []);
      await assert.rejects(f("oricse_portal_agenda_respostas", 2, [clinica, tutor]), {
        code: "42501",
      });
      await role(tutor);
      await assert.rejects(
        f("oricse_portal_agenda_interagir", 6, [
          outra,
          agOutro,
          original.inicio,
          "confirmacao",
          null,
          null,
        ]),
        { code: "42501" },
      );
      const confirmacao = await interagir("confirmacao", null);
      assert.equal(await interagir("confirmacao", null), confirmacao);
      const pedido = await interagir("pedido", "De manhã se possível.");
      assert.equal(await interagir("pedido", "Envio repetido"), pedido);
      await assert.rejects(interagir("resposta", "Resposta falsa", pedido), { code: "42501" });
      await assert.rejects(interagir("confirmacao", null, null, "2000-01-01"), /mudou/);
      await role(equipe);
      await assert.rejects(interagir("resposta", "Recepção necessária", pedido), { code: "42501" });
      await role(recepcao);
      const resposta = await interagir(
        "resposta",
        "Ainda não temos outro horário; mantenha o atual.",
        pedido,
      );
      assert.equal(await interagir("resposta", "Retentativa", pedido), resposta);
      assert.deepEqual(
        await agendaDados(),
        original,
        "reagendar não altera estado/horário/pagamento",
      );
      await role(tutor);
      const eventos = await f("oricse_portal_agenda_respostas", 2, [clinica, tutor]);
      assert.equal(eventos.find((e) => e.id === pedido).mensagem, "De manhã se possível.");
      assert.equal(
        eventos.find((e) => e.id === resposta).mensagem,
        "Ainda não temos outro horário; mantenha o atual.",
      );

      const itens = [
        {
          id: uuid(70),
          produtoId: catalogo,
          quantidade: 0.501,
          peso: "",
          valorCentavos: 250,
          subtotalCentavos: 125,
        },
        {
          id: uuid(71),
          produtoId: servico,
          quantidade: 1.502,
          especie: "Cão",
          sexo: "Fêmea",
          peso: "5",
          valorCentavos: 3000,
          subtotalCentavos: 4506,
        },
      ];
      const compartilhar = (id, linhas = itens, total = 4631) =>
        f("oricse_portal_orcamento_compartilhar", 8, [
          clinica,
          id,
          tutor,
          pet,
          7,
          "Observação de teste.",
          JSON.stringify(linhas),
          total,
        ]);
      await assert.rejects(compartilhar(proposta), { code: "42501" });
      await role(equipe);
      await assert.rejects(
        compartilhar(proposta, [{ ...itens[0], produtoId: outroCatalogo }], 125),
        /catálogo indisponível/,
      );
      await assert.rejects(
        compartilhar(precoMudou, [{ ...itens[0], valorCentavos: 3 }, itens[1]]),
        /preço de um item mudou/,
      );
      assert.equal(await compartilhar(proposta), proposta);
      assert.equal(await compartilhar(proposta), proposta);
      await assert.rejects(compartilhar(proposta, itens, 20), /outro orçamento/);
      const aprovar = (id) => f("oricse_portal_orcamento_aprovar", 2, [clinica, id]);
      const converter = (id) => f("oricse_portal_orcamento_converter", 2, [clinica, id]);
      await assert.rejects(converter(proposta), /aprovado não encontrado/);
      await role(terceiro);
      await assert.rejects(aprovar(proposta), { code: "42501" });
      assert.deepEqual(await f("oricse_portal_orcamentos_listar", 2, [clinica, terceiro]), []);
      await role(recepcao);
      await assert.rejects(converter(proposta), { code: "42501" });
      await role(equipe, '{"app_metadata":{"oricse_demo_clinica":"alvorada"}}');
      await assert.rejects(converter(proposta), { code: "42501" });
      await role(tutor);
      assert.equal(await aprovar(proposta), proposta);
      assert.equal(await aprovar(proposta), proposta);
      await assert.rejects(converter(proposta), { code: "42501" });
      await assert.rejects(db.query("select * from public.oricse_portal_orcamentos"), {
        code: "42501",
      });
      await db.exec("reset role");
      assert.equal(await value("select count(*)::int v from public.oricse_portal_comandas"), 0);
      assert.equal(await value("select count(*)::int v from public.oricse_caixa_lancamentos"), 0);
      // Repricing later cannot change a tutor-approved snapshot.
      await db.query("update public.oricse_catalogo_itens set valor=99 where id=$1", [catalogo]);
      await role(equipe);
      const comandaId = await converter(proposta);
      assert.equal(await converter(proposta), comandaId);
      const [item] = await f("oricse_portal_orcamentos_listar", 2, [clinica, null]);
      assert.equal(item.total_centavos, 4631);
      assert.deepEqual(
        item.itens.map((i) => i.valorUnitario),
        [2.5, 30],
      );
      assert.equal(item.comanda_id, comandaId);
      assert.ok(item.compartilhado_em && item.aprovado_em && item.convertido_em);
      await assert.rejects(
        db.query("update public.oricse_portal_comandas set total=0 where id=$1", [comandaId]),
        { code: "42501" },
      );
      await assert.rejects(
        db.query("delete from public.oricse_portal_comandas where id=$1", [comandaId]),
        { code: "42501" },
      );
      await db.exec("reset role");
      assert.equal(await value("select count(*)::int v from public.oricse_portal_comandas"), 1);
      assert.equal(await value("select count(*)::int v from public.oricse_caixa_lancamentos"), 0);
      assert.equal(
        await value("select total::text v from public.oricse_portal_comandas where id=$1", [
          comandaId,
        ]),
        "46.31",
      );
      await role(equipe);
      // If a real authorized staff receipt occurs after conversion, the existing
      // caixa workflow accepts this canonical comanda without creating a sale.
      const pagamento = uuid(80);
      await f("oricse_receber_comanda_atendimento", 4, [comandaId, pagamento, 1000, "Pix"]);
      await f("oricse_receber_comanda_atendimento", 4, [comandaId, pagamento, 1000, "Pix"]);
      await db.exec("reset role");
      assert.equal(await value("select count(*)::int v from public.oricse_caixa_lancamentos"), 1);
      assert.equal(
        await value("select saldo::text v from public.oricse_portal_comandas where id=$1", [
          comandaId,
        ]),
        "36.31",
      );
      // An expired proposal cannot be newly approved.
      await db.query("update public.oricse_catalogo_itens set valor=2.50 where id=$1", [catalogo]);
      await role(equipe);
      await compartilhar(vencido);
      await db.exec("reset role");
      await db.query(
        "update public.oricse_portal_orcamentos set validade_em=current_date-10 where id=$1",
        [vencido],
      );
      await role(tutor);
      await assert.rejects(aprovar(vencido), /vencido/);
    } finally {
      await db.close();
    }
  },
);
