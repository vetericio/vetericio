import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  emailAtendimentoOricse, ORICSE_EMAIL_ATENDIMENTO, ORICSE_WHATSAPP_EXIBICAO,
  ORICSE_WHATSAPP_NUMERO, whatsappAtendimentoOricse,
} from "../src/lib/contato-oricse.ts";

const read = (path) => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");

test("links de atendimento apontam para o número e e-mail oficiais", () => {
  assert.equal(ORICSE_EMAIL_ATENDIMENTO, "atendimento@oricse.com.br");
  assert.equal(ORICSE_WHATSAPP_NUMERO, "5531971969699");
  assert.equal("55" + ORICSE_WHATSAPP_EXIBICAO.replace(/\D/g, ""), ORICSE_WHATSAPP_NUMERO);
  assert.equal(whatsappAtendimentoOricse(), "https://wa.me/5531971969699");
  assert.equal(emailAtendimentoOricse(), "mailto:atendimento@oricse.com.br");
});

test("mensagens e assuntos com acentos são preservados", () => {
  const mensagem = "Olá! Dúvidas sobre contratação?";
  assert.equal(new URL(whatsappAtendimentoOricse(mensagem)).searchParams.get("text"), mensagem);
  assert.equal(new URL(emailAtendimentoOricse(mensagem)).searchParams.get("subject"), mensagem);
});

test("recuperação de senha, contratação, Ajuda e exclusão Meta usam os canais oficiais", () => {
  assert.match(read("routes/login.tsx"), /href=\{whatsappAtendimentoOricse\("Olá, preciso recuperar/);
  assert.match(read("routes/contratacao-recebida.tsx"), /href=\{whatsappAtendimentoOricse\(/);
  assert.match(read("routes/contratacao-recebida.tsx"), /href=\{emailAtendimentoOricse\(/);
  assert.match(read("components/ManualSistemaMenu.tsx"), /<ContatosAtendimentoOricse /);
  assert.doesNotMatch(read("lib/oricstudio-meta-data-deletion.server.ts"), /vetericio@gmail\.com/);
  assert.match(read("lib/oricstudio-meta-data-deletion.server.ts"), /href="\$\{emailAtendimentoOricse\(\)\}"/);
});

test("rodapé de clínica e contatos do Portal do Tutor permanecem separados", () => {
  assert.match(read("components/RodapeInstitucional.tsx"), /!linkMarca && !marcaDaClinica && \(\s*<ContatosAtendimentoOricse/);
  assert.doesNotMatch(read("components/PortalClinicContact.tsx"), /ORICSE_WHATSAPP|AtendimentoOricse/);
});
