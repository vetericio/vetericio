import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("portal diferencia via histórica de controle especial de uma receita de uso", () => {
  const tela = readFileSync(new URL("../src/routes/pet/$slug/portal.tsx", import.meta.url), "utf8");
  assert.match(tela, /r\.tipo==="especial"\?"Registro histórico de controle especial":"Receita comum"/);
  assert.match(tela, /Este PDF histórico não comprova emissão oficial nem assinatura/);
  assert.match(tela, /Antes de usar na farmácia, confirme o documento oficial com a clínica/);
  assert.match(tela, /rotulo=\{r\.tipo==="especial" \? "Abrir PDF histórico" : "Abrir PDF"\}/);
});
