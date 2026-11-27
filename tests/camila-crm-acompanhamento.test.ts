import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AVISO_URGENCIA_ACOMPANHAMENTO, comporMensagemAcompanhamento } from "../src/lib/crm-mensagem-local.ts";

const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    return specifier === "./crm-mensagem-local" ? nextResolve(specifier + ".ts", context)
      : nextResolve(specifier, context);
  },
});
const { mensagemPosCirurgica } = await import("../src/lib/crm-pos-cirurgico.ts");
hook.deregister();

test("retorno padrão é da equipe, não interpreta a queixa e não sugere esperar mensagem numa urgência", () => {
  const dadosLegados = {
    tutorNome: "Pessoa Fictícia", animalNome: "Animal de Teste", dataConsulta: "2026-10-14",
    queixa: "Sintoma privado após ter comido uma folha", autorNome: "Autor Fictício",
  };
  const msg = comporMensagemAcompanhamento(dadosLegados);
  assert.match(msg, /Oi, Pessoa! Aqui é da equipe veterinária/);
  assert.match(msg, /14\/10\/2026/);
  assert.ok(msg.includes(AVISO_URGENCIA_ACOMPANHAMENTO));
  assert.doesNotMatch(msg, /sintoma privado|folha|Autor Fictício/);
  assert.doesNotMatch(comporMensagemAcompanhamento({...dadosLegados, dataConsulta: "2026-02-30"}), /30\/02\/2026/);
});

test("pós-cirúrgico faz pergunta neutra e orienta urgência sem se passar pelo veterinário", () => {
  const dadosLegados = { tutorNome: "Pessoa fictícia", animalNome: "Animal de teste", veterinarioNome: "Autor Fictício" };
  const msg = mensagemPosCirurgica(dadosLegados, { dia: 1, perguntas: ["Como foi a noite?"] });
  assert.match(msg, /Aqui é da equipe veterinária\./);
  assert.match(msg, /Como foi a noite\?/);
  assert.ok(msg.includes(AVISO_URGENCIA_ACOMPANHAMENTO));
  assert.doesNotMatch(msg, /Autor Fictício|Sou o médico|aguarde nossa resposta/i);
});

test("prévia de retorno não consulta queixa nem outra consulta; botão não se diz envio", () => {
  const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const preparar = ler("../src/lib/crm-retornos.functions.ts").split("export const prepararMensagemAcompanhamento")[1];
  assert.doesNotMatch(preparar, /dados_atendimento|Queixa principal|\.order\("data"/);
  assert.match(preparar, /\.select\("data"\)/);
  const tela = ler("../src/components/CrmRetornosPanel.tsx");
  assert.match(tela, /Preparar mensagem/);
  assert.match(tela, /Abrir no WhatsApp/);
});
