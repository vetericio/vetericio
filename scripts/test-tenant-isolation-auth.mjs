/**
 * Teste E2E autenticado e NÃO destrutivo do isolamento entre clínicas.
 * Executar em ambiente de testes com duas contas reais de teste, cada qual
 * vinculada SOMENTE à respectiva clínica. Não aceita service_role.
 *
 * ORICSE_TEST_URL=https://<ref>.supabase.co
 * ORICSE_TEST_ANON_KEY=... (chave pública/publicável)
 * ORICSE_TEST_A_EMAIL=... ORICSE_TEST_A_PASSWORD=... ORICSE_TEST_A_CLINIC_ID=uuid
 * ORICSE_TEST_B_EMAIL=... ORICSE_TEST_B_PASSWORD=... ORICSE_TEST_B_CLINIC_ID=uuid
 * node scripts/test-tenant-isolation-auth.mjs
 *
 * Os dados pessoais, senhas e tokens nunca são impressos.
 */
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const env = process.env;
const keys = [
  "ORICSE_TEST_URL", "ORICSE_TEST_ANON_KEY",
  "ORICSE_TEST_A_EMAIL", "ORICSE_TEST_A_PASSWORD", "ORICSE_TEST_A_CLINIC_ID",
  "ORICSE_TEST_B_EMAIL", "ORICSE_TEST_B_PASSWORD", "ORICSE_TEST_B_CLINIC_ID",
];
const missing = keys.filter((k) => !env[k]);
if (missing.length) {
  console.error("Configuração incompleta: " + missing.join(", "));
  process.exit(2);
}
assert.ok(!env.ORICSE_TEST_URL.includes("localhost") || env.ORICSE_TEST_URL.startsWith("http"),
  "URL inválida");
const clinicId = [env.ORICSE_TEST_A_CLINIC_ID, env.ORICSE_TEST_B_CLINIC_ID];
assert.match(clinicId[0], /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
assert.match(clinicId[1], /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
assert.notEqual(clinicId[0], clinicId[1], "As clínicas devem ser distintas");

function client() {
  return createClient(env.ORICSE_TEST_URL, env.ORICSE_TEST_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
const accounts = [client(), client()];
async function authenticate(c, side) {
  const { data, error } = await c.auth.signInWithPassword({
    email: env[`ORICSE_TEST_${side}_EMAIL`],
    password: env[`ORICSE_TEST_${side}_PASSWORD`],
  });
  assert.ifError(error);
  assert.ok(data?.user?.id && data?.session?.access_token, "Login autenticado obrigatório");
  return data.user.id;
}
const users = [
  await authenticate(accounts[0], "A"),
  await authenticate(accounts[1], "B"),
];
assert.notEqual(users[0], users[1], "As duas sessões precisam ser de usuários distintos");
let tests = 0;
const fail = [];
function check(name, condition) {
  tests++;
  if (condition) console.log("PASS " + name);
  else { console.error("FAIL " + name); fail.push(name); }
}
try {
  for (let i = 0; i < 2; i++) {
    const c = accounts[i], self = clinicId[i], other = clinicId[1-i];
    // Controle positivo: a sessão real deve enxergar suas próprias permissões.
    const own = await c.rpc("oricse_permissoes_efetivas", {
      p_clinica_id: self, p_user_id: users[i],
    });
    check(`${i}: leitura das próprias permissões`,
      !own.error && Array.isArray(own.data));

    // Controle negativo: nem um RT pode consultar permissões da outra clínica.
    const cross = await c.rpc("oricse_permissoes_efetivas", {
      p_clinica_id: other, p_user_id: users[1-i],
    });
    check(`${i}: não consulta permissões da clínica alheia`,
      Boolean(cross.error) || !Array.isArray(cross.data) || cross.data.length === 0);

    // Chamadas diretas à API de dados devem respeitar a mesma fronteira.
    for (const [table, column] of [
      ["oricse_animais", "clinica_id"],
      ["tutores", "clinica_id"],
      ["oricse_agendas_online", "clinica_id"],
      ["oricse_catalogo_itens", "clinica_id"],
    ]) {
      const result = await c.from(table).select("id").eq(column, other).limit(1);
      check(`${i}: SELECT externo bloqueado em ${table}`,
        Boolean(result.error) || (Array.isArray(result.data) && result.data.length === 0));
    }

    // Uma chamada direta à função privilegiada NÃO deve aceitar a clínica alheia.
    const otherAccess = await c.rpc("oricse_plano_permite", {
      p_clinica_id: other, p_codigo: "recepcao.agenda",
    });
    check(`${i}: plano de outra clínica não autoriza`,
      Boolean(otherAccess.error) || otherAccess.data === false);
  }
} finally {
  await Promise.all(accounts.map((c) => c.auth.signOut()));
}
console.log(`Total: ${tests}; falhas: ${fail.length}`);
if (fail.length) process.exitCode = 1;
