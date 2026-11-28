import assert from "node:assert/strict";
import test from "node:test";
import {
  descricaoOfertaPerfis,
  formatarPrazoOferta,
  tituloOfertaPerfis,
  distribuirPerfis,
  lerCampanhaPerfis,
  ofertaDoPlano,
} from "../src/lib/promocao-perfis-ui.ts";

test("a comunicação da oferta não aparece quando o servidor não a concede", () => {
  assert.equal(tituloOfertaPerfis({ tipo: "padrao" }), null);
  assert.equal(descricaoOfertaPerfis({ tipo: "padrao" }), null);
});

test("Essencial separa os dois perfis da promoção dos três incluídos", () => {
  const oferta = {
    tipo: "extras_gratis",
    perfisBase: 1,
    extrasGratis: 2,
    prazo: "2027-01-31",
  } as const;
  assert.equal(tituloOfertaPerfis(oferta), "3 perfis incluídos");
  assert.match(
    descricaoOfertaPerfis(oferta)!,
    /2 perfis extras grátis.*contrate até 31\/01\/2027/i,
  );
});

test("acesso ilimitado não inventa um teto nem concede agendas", () => {
  const oferta = { tipo: "ilimitado", prazo: "2027-01-31" } as const;
  assert.equal(tituloOfertaPerfis(oferta), "Perfis ilimitados sem acréscimo");
  assert.match(descricaoOfertaPerfis(oferta)!, /começa na ativação.*assinatura elegível permanecer ativa/);
  assert.doesNotMatch(descricaoOfertaPerfis(oferta)!, /agenda|999|1000/i);
  assert.equal(formatarPrazoOferta(""), "");
});

const campanhaAtiva = lerCampanhaPerfis({
  ativa: true,
  id: "campanha-fixture",
  encerra_em: "2027-01-31",
  essencial_bonus: 2,
});

test("estado inativo não permite que o cliente mostre a data, ID ou oferta", () => {
  assert.deepEqual(
    lerCampanhaPerfis({ ativa: false, id: "antigo", encerra_em: "2027-01-31", essencial_bonus: 2 }),
    { ativa: false, id: null },
  );
  assert.throws(() => lerCampanhaPerfis({ ativa: true, essencial_bonus: 2 }));
  assert.deepEqual(ofertaDoPlano("solo-2026", 1, campanhaAtiva), { tipo: "padrao" });
});

test("no Essencial o 4º perfil é o primeiro que recebe cobrança; depois do prazo volta ao padrão", () => {
  const promocao = ofertaDoPlano("essencial-2026", 1, campanhaAtiva);
  assert.deepEqual(distribuirPerfis(3, 1, promocao), {
    baseSelecionados: 1,
    extrasGratuitos: 2,
    extrasCobrados: 0,
    inclusosParaResumo: 3,
  });
  assert.equal(distribuirPerfis(4, 1, promocao).extrasCobrados, 1);
  assert.equal(
    distribuirPerfis(4, 1, ofertaDoPlano("essencial-2026", 1, { ativa: false, id: null }))
      .extrasCobrados,
    3,
  );
});

test("Profissional e Master não aplicam teto numérico de perfis", () => {
  for (const [plano, base] of [
    ["profissional-2026", 3],
    ["master-2026", 5],
  ] as const) {
    assert.equal(
      distribuirPerfis(12_000, base, ofertaDoPlano(plano, base, campanhaAtiva)).extrasCobrados,
      0,
    );
  }
});
