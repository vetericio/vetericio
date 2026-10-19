import assert from "node:assert/strict";
import { test } from "node:test";
import { simularSplit } from "./payment-split";
const taxas = { mercadoPagoPercentual: 5, mercadoPagoFixoCentavos: 0, oricsePercentual: 10 };
test("cálculo de repasse: cobrar fixa valor do tutor e deduz taxas", () => {
   const r = simularSplit("cobrar",5000,taxas);
   assert.equal(r.cobradoTutorCentavos, 5000);
   assert.equal(r.taxaMercadoPagoCentavos, 250);
   assert.equal(r.taxaOricseCentavos, 475);
   assert.equal(r.liquidoClinicaCentavos, 4275);
});
test("cálculo de repasse: receber encontra o menor bruto que cobre o líquido", () => {
   const r=simularSplit("receber",5000,taxas);
   assert.ok(r.liquidoClinicaCentavos >= 5000);
   assert.ok(simularSplit("cobrar",r.cobradoTutorCentavos-1,taxas).liquidoClinicaCentavos < 5000);
});
test("cálculo de repasse: não aceita taxa inválida",()=>assert.throws(()=>simularSplit("cobrar",5000,{...taxas,oricsePercentual:100})));
