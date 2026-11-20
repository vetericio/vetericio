import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const helper = fs.readFileSync("src/lib/permissao-clinica.server.ts", "utf8");
for (const token of [
  'status !== "ativa"', 'excluido_em', 'eq("ativo", true)',
  '"oricse_permissoes_efetivas"', 'p.permitido === true',
  'createClient(', 'Authorization:', 'accessToken',
]) assert.ok(helper.includes(token), `Guarda ausente: ${token}`);
assert.ok(!helper.includes('await admin.rpc('),
  "Permissões devem ser consultadas com JWT do funcionário, não service role");

const casos = [
  ["src/lib/agenda.functions.ts", "recepcao.agenda"],
  ["src/lib/clinic-logo.functions.ts", "administracao.site"],
  ["src/lib/animal-photo.functions.ts", "recepcao.cadastros.visualizar"],
  ["src/lib/agenda-politicas.functions.ts", "recepcao.agenda"],
  ["src/lib/politicas-operacionais.functions.ts", "administracao.configuracoes"],
  ["src/lib/indicadores-painel.functions.ts", "caixa.financeiro.visualizar"],
];
for (const [caminho, codigo] of casos) {
  const source = fs.readFileSync(caminho, "utf8");
  assert.ok(source.includes("exigirPermissaoClinica("), `Endpoint sem guarda: ${caminho}`);
  assert.ok(source.includes(codigo), `Permissão não mapeada: ${caminho}`);
  assert.match(source, /data\.accessToken\s*[,)]/, `JWT ausente na guarda: ${caminho}`);
}

const logo = fs.readFileSync("src/lib/clinic-logo.functions.ts", "utf8");
assert.match(logo, /permitirBloqueadaParaAdmin: data\.categoria === "logo"/);
const { outputText } = ts.transpileModule(helper, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const modulo = outputText.replace('"@supabase/supabase-js"', JSON.stringify(import.meta.resolve("@supabase/supabase-js")));
const { exigirPermissaoClinica } = await import(`data:text/javascript;base64,${Buffer.from(modulo).toString("base64")}`);

function verificarClinica({ status, role = "admin", excluido = false, permitirBloqueadaParaAdmin = false }) {
  const admin = {
    from(tabela) {
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        maybeSingle: async () => ({
          data: {
            clinicas: status && { status, excluido_em: excluido ? "2026-01-01" : null },
            app_users: { role },
            clinica_usuarios: null,
          }[tabela],
          error: null,
        }),
      };
      return consulta;
    },
  };
  return exigirPermissaoClinica(admin, "usuario-teste", "clinica-teste", ["administracao.site"], "jwt-teste", { permitirBloqueadaParaAdmin });
}

await verificarClinica({ status: "ativa" });
await verificarClinica({ status: "bloqueada", permitirBloqueadaParaAdmin: true });
await assert.rejects(verificarClinica({ status: "bloqueada" }), /Clínica indisponível/);
await assert.rejects(verificarClinica({ status: "bloqueada", role: "veterinario", permitirBloqueadaParaAdmin: true }), /Clínica indisponível/);
await assert.rejects(verificarClinica({ status: "bloqueada", excluido: true, permitirBloqueadaParaAdmin: true }), /Clínica indisponível/);
for (const status of [null, "inativa", "cancelada"]) {
  await assert.rejects(verificarClinica({ status, permitirBloqueadaParaAdmin: true }), /Clínica indisponível/);
}
console.log("Guardas das APIs verificadas. Em clínica bloqueada, somente o administrador pode enviar a logo.");
