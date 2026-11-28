import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pg = process.env.PGLITE_MODULE;
test(
  "oferta da contratação: cutoff BRT, custo, cupom, aceite privado, preparo e continuidade",
  {
    skip: !pg && "PGlite local opcional",
  },
  async () => {
    const { PGlite } = await import(pg);
    const db = new PGlite();
    const id = "00000000-0000-4000-8000-000000000007";
    const oferta = "oricse-perfis-equipe-2027-01";
    const camposTexto = `plano_codigo plano_nome ciclo status clinica_nome razao_social cnpj clinica_telefone clinica_email
    clinica_cep clinica_endereco clinica_numero clinica_complemento clinica_bairro clinica_cidade clinica_uf
    tipo_operacao slug_desejado dominio valor_exibido responsavel_nome responsavel_cpf responsavel_crmv responsavel_crmv_uf
    responsavel_email responsavel_telefone responsavel_cep responsavel_endereco responsavel_numero responsavel_complemento
    responsavel_bairro responsavel_cidade responsavel_uf observacoes promo_codigo promo_duracao modo_renovacao pagamento_id`;
    const camposNumericos = `adicional_perfis_mensal adicional_perfis_ciclo valor_base valor_total promo_valor_original promo_desconto promo_valor_final`;
    try {
      await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select '${id}'::uuid $$;
      create table public.app_users(user_id uuid,role text);
      insert into public.app_users values('${id}','admin');
      create table public.oricse_planos(codigo text primary key,nome text,ativo boolean,usuarios_inclusos int,
        preco_mensal text, preco_anual text, preco_trimestral text, preco_semestral text, preco_bienal text);
      insert into public.oricse_planos values
        ('essencial-2026','Essencial',true,1,'79.90','799','239','479','1500'),
        ('profissional-2026','Profissional',true,3,'119.90','1199','359','719','2300'),
        ('master-2026','Master',true,5,'199.90','1999','599','1199','3800'),
        ('solo-2026','Solo',true,1,'29.90','299','89','179','590');
      create table public.clinicas(id uuid primary key default gen_random_uuid(), nome text, slug text, tipo_publico text,
        status text, plano text, limite_usuarios integer, status_financeiro text, ultimo_pagamento_em timestamptz,
        observacoes text, excluido_em timestamptz);
      create table public.oricse_contratacoes(id uuid primary key default gen_random_uuid(),
        ${camposTexto
          .trim()
          .split(/\s+/)
          .map((c) => c + " text")
          .join(",")},
        ${camposNumericos
          .trim()
          .split(/\s+/)
          .map((c) => c + " numeric(12,2)")
          .join(",")},
        quantidade_usuarios int, perfis_inclusos int, perfis_extras int, aceitou_termos bool,
        aceitou_privacidade bool, renovacao_automatica bool, dados jsonb, pagamento_aprovado_em timestamptz,
        clinica_criada_id uuid, excluido_em timestamptz, created_at timestamptz default now(), updated_at timestamptz default now());
      create table public.oricse_assinaturas(clinica_id uuid primary key, contratacao_id uuid, plano_codigo text, status text, vencida boolean default false);
      create function public.oricse_acesso_administrativo_liberado(cid uuid) returns boolean language sql as
        $$ select coalesce((select not vencida from public.oricse_assinaturas where clinica_id=cid),false) $$;
      create table public.oricse_codigos_promocionais(id uuid primary key default gen_random_uuid(),codigo text);
      insert into public.oricse_codigos_promocionais(codigo) values('CUPOM-FICTICIO'),('CUPOM-INTEGRAL');
      create table public.oricse_codigo_promocional_usos(codigo_id uuid,contratacao_id uuid,documento_normalizado text);
      create function public.oricse_valor_brl(text) returns numeric language sql as $$ select $1::numeric $$;
      create function public.oricse_validar_codigo_promocional(text,text,text,numeric,text,text) returns jsonb language sql as
        $$ select jsonb_build_object('valido',true,'valor_original',$4,'desconto_aplicado',case when $1='CUPOM-INTEGRAL' then $4 else 5 end,
        'valor_final',case when $1='CUPOM-INTEGRAL' then 0 else $4-5 end,'duracao','primeiro_mes') $$;
      create function public.oricse_finalizar_contratacao_isenta(p_contratacao uuid) returns jsonb language sql as
        $$ update public.oricse_contratacoes set status='isento_aguardando_aprovacao' where id=p_contratacao
           and valor_total=0 and promo_valor_final=0 and promo_desconto>=promo_valor_original returning jsonb_build_object('ok',true) $$;
    `);
      const raw = readFileSync(
        new URL(
          "../supabase/migrations/20261128263000_oricse_promocao_perfis_checkout.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await db.exec(raw);
      const comprar = async (plano, num, extra = {}) =>
        (
          await db.query(
            "select public.oricse_iniciar_contratacao($1::jsonb) as r",
            [
              JSON.stringify({
                plano_codigo: plano,
                quantidade_usuarios: num,
                ciclo: "mensal",
                aceitou_termos: true,
                aceitou_privacidade: true,
                clinica_nome: "Clínica Fictícia",
                responsavel_nome: "Pessoa Exemplo",
                responsavel_email: "fixture@example.test",
                ...extra,
              }),
            ],
          )
        ).rows[0].r;
      const obter = async () =>
        (
          await db.query(
            "select public.oricse_oferta_perfis_equipe() as oferta",
          )
        ).rows[0].oferta;
      const direitos = async (c) =>
        (
          await db.query(
            "select * from private.oricse_promocao_perfis_ativa($1)",
            [c],
          )
        ).rows[0];
      const preparar = async (p) =>
        (
          await db.query(
            "select public.oricse_admin_preparar_clinica($1) as clinica",
            [p],
          )
        ).rows[0].clinica;
      assert.deepEqual(await obter(), {
        ativa: false,
        id: null,
        encerra_em: null,
        essencial_bonus: 2,
      });
      const anterior = await comprar("essencial-2026", 4, {
        oferta_perfis_id: oferta,
        limite_base_contratado: 10000,
      });
      assert.equal(anterior.oferta_perfis_id, null);
      assert.equal(anterior.valor_total, 124.6);
      const gravadoAnterior = (
        await db.query(
          "select dados from public.oricse_contratacoes where id=$1",
          [anterior.id],
        )
      ).rows[0].dados;
      assert.equal(gravadoAnterior.oferta_perfis_id, undefined);
      const relogio = async (iso) =>
        (
          await db.query(
            "select private.oricse_oferta_perfis_em($1) as ativa",
            [iso],
          )
        ).rows[0].ativa;
      await db.exec(
        "update private.oricse_oferta_perfis_equipe_controle set habilitada=true,inicia_em='2026-01-01Z';",
      );
      assert.equal(await relogio("2026-12-31T23:00:00Z"), true);
      assert.equal(await relogio("2027-02-01T02:59:59.999999Z"), true);
      assert.equal(await relogio("2027-02-01T03:00:00Z"), false);
      assert.equal(await relogio("2025-12-31T23:59:59Z"), false);
      const agora = (
        await db.query(
          "select private.oricse_oferta_perfis_em(statement_timestamp()) as ativo",
        )
      ).rows[0].ativo;
      // Mantém os testes executáveis mesmo depois da campanha, sem mudar o SQL
      // entregue: somente a instância fictícia usa um relógio de consulta fixo.
      if (!agora) {
        await db.exec(
          raw
            .slice(raw.indexOf("-- Alterações mínimas"))
            .replaceAll(
              "statement_timestamp()",
              "timestamptz '2027-01-31 00:00:00+00'",
            ),
        );
      } else {
        assert.deepEqual(await obter(), {
          ativa: true,
          id: oferta,
          encerra_em: "2027-01-31",
          essencial_bonus: 2,
        });
      }
      await assert.rejects(
        comprar("essencial-2026", 5),
        /oferta de perfis mudou/,
      );
      const contarAntes = () => db.query("select (select count(*)::int from public.oricse_contratacoes) pedidos,(select count(*)::int from public.oricse_codigo_promocional_usos) usos");
      const antesDivergencia = (await contarAntes()).rows[0];
      await assert.rejects(comprar("essencial-2026", 5, {
        oferta_perfis_esperada: oferta,
        oferta_perfis_total_esperado_centavos: 1,
        promo_codigo: "CUPOM-FICTICIO",
      }), /O total da contratação mudou/);
      assert.deepEqual((await contarAntes()).rows[0], antesDivergencia);
      await assert.rejects(comprar("essencial-2026", 5, {
        oferta_perfis_esperada: oferta,
        oferta_perfis_total_esperado_centavos: 10470,
        promo_codigo: "CUPOM-FICTICIO",
        modo_renovacao: "automatica_cartao",
      }), /selecione renovação manual/);
      assert.deepEqual((await contarAntes()).rows[0], antesDivergencia);
      const e = await comprar("essencial-2026", 5, {
        oferta_perfis_esperada: oferta,
        promo_codigo: "CUPOM-FICTICIO",
        oferta_perfis_total_esperado_centavos: 10470,
        valor_total: 0,
        perfis_inclusos: 1000,
        perfis_extras: 0,
      });
      assert.equal(e.oferta_perfis_id, oferta);
      assert.equal(e.valor_total, 104.7);
      const prof = await comprar("profissional-2026", 40, {
        oferta_perfis_esperada: oferta,
      });
      await assert.rejects(
        comprar("master-2026", 1000, {
          oferta_perfis_esperada: oferta,
          ciclo: "anual",
        }),
        /Confirme ciência/,
      );
      const master = await comprar("master-2026", 1000, {
        oferta_perfis_esperada: oferta,
        ciclo: "anual",
        aceitou_fidelidade_master: true,
      });
      const solo = await comprar("solo-2026", 2, {
        oferta_perfis_esperada: null,
      });
      const isento = await comprar("profissional-2026", 20, {
        oferta_perfis_esperada: oferta,
        promo_codigo: "CUPOM-INTEGRAL",
      });
      assert.equal(prof.valor_total, 119.9);
      assert.equal(master.valor_total, 1999);
      assert.equal(solo.valor_total, 44.8);
      assert.equal(isento.valor_total, 0);
      assert.equal(isento.status, "isento_aguardando_aprovacao");
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from private.oricse_ofertas_perfis_aceitas",
          )
        ).rows[0].n,
        4,
      );
      assert.deepEqual(
        (
          await db.query(`select has_table_privilege('authenticated','private.oricse_ofertas_perfis_aceitas','select') as leitura,
      has_function_privilege('anon','public.oricse_oferta_perfis_equipe()','execute') as oferta_publica`)
        ).rows[0],
        { leitura: false, oferta_publica: true },
      );
      const aprovado = async (p) =>
        db.query(
          "update public.oricse_contratacoes set status='pagamento_aprovado',pagamento_id='fixture-ok',pagamento_aprovado_em=now() where id=$1",
          [p],
        );
      const ativar = async (p) =>
        db.query(
          "update public.oricse_contratacoes set status='ativada' where id=$1",
          [p],
        );
      const ligar = async (c, p, plano) =>
        db.query(
          "insert into public.oricse_assinaturas(clinica_id,contratacao_id,plano_codigo,status) values($1,$2,$3,'ativa')",
          [c, p, plano],
        );
      await assert.rejects(preparar(e.id), /Pagamento não confirmado/);
      await aprovado(e.id);
      const c = await preparar(e.id);
      assert.equal(
        (
          await db.query(
            "select limite_usuarios from public.clinicas where id=$1",
            [c],
          )
        ).rows[0].limite_usuarios,
        3,
      );
      assert.deepEqual(await direitos(c), {
        ilimitado: false,
        bonus_perfis: 0,
      });
      await assert.rejects(ativar(e.id), /não corresponde/);
      await ligar(c, e.id, "essencial-2026");
      await db.query("update public.clinicas set status='ativa' where id=$1", [
        c,
      ]);
      await ativar(e.id);
      assert.deepEqual(await direitos(c), {
        ilimitado: false,
        bonus_perfis: 2,
      });
      await db.exec(
        "update private.oricse_oferta_perfis_equipe_controle set habilitada=false;",
      );
      assert.equal((await obter()).ativa, false);
      await assert.rejects(
        comprar("essencial-2026", 5, { oferta_perfis_esperada: oferta }),
        /oferta de perfis mudou/,
      );
      assert.deepEqual(await direitos(c), {
        ilimitado: false,
        bonus_perfis: 2,
      });
      await aprovado(prof.id);
      const cp = await preparar(prof.id);
      await ligar(cp, prof.id, "profissional-2026");
      await db.query("update public.clinicas set status='ativa' where id=$1", [
        cp,
      ]);
      await ativar(prof.id);
      assert.deepEqual(await direitos(cp), {
        ilimitado: true,
        bonus_perfis: 0,
      });
      await db.query(
        "update public.oricse_assinaturas set vencida=true where clinica_id=$1",
        [cp],
      );
      assert.deepEqual(await direitos(cp), {
        ilimitado: false,
        bonus_perfis: 0,
      });
      await db.query(
        "update public.oricse_assinaturas set vencida=false where clinica_id=$1",
        [cp],
      );
      assert.deepEqual(await direitos(cp), {
        ilimitado: true,
        bonus_perfis: 0,
      });
      await db.query(
        "update public.oricse_assinaturas set status='suspensa' where clinica_id=$1",
        [c],
      );
      assert.deepEqual(await direitos(c), {
        ilimitado: false,
        bonus_perfis: 0,
      });
      await aprovado(anterior.id);
      const ca = await preparar(anterior.id);
      assert.equal(
        (
          await db.query(
            "select limite_usuarios from public.clinicas where id=$1",
            [ca],
          )
        ).rows[0].limite_usuarios,
        4,
      );
    } finally {
      await db.close();
    }
  },
);
