import { describe, it, expect } from "vitest";
import { simularSplit } from "./payment-split";
const taxas = { mercadoPagoPercentual: 5, mercadoPagoFixoCentavos: 0, oricsePercentual: 10 };
describe("cálculo de repasse em centavos", () => {
 it("cobrar fixa valor do tutor e deduz taxas", () => {
   const r = simularSplit("cobrar",5000,taxas);
   expect(r.cobradoTutorCentavos).toBe(5000);
   expect(r.taxaMercadoPagoCentavos).toBe(250);
   expect(r.taxaOricseCentavos).toBe(475);
   expect(r.liquidoClinicaCentavos).toBe(4275);
 });
 it("receber encontra o menor bruto que cobre o líquido", () => {
   const r=simularSplit("receber",5000,taxas);
   expect(r.liquidoClinicaCentavos).toBeGreaterThanOrEqual(5000);
   expect(simularSplit("cobrar",r.cobradoTutorCentavos-1,taxas).liquidoClinicaCentavos).toBeLessThan(5000);
 });
 it("não aceita taxa inválida",()=>expect(()=>simularSplit("cobrar",5000,{...taxas,oricsePercentual:100})).toThrow());
});
