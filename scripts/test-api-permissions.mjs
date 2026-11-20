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

const imagemPublica = fs.readFileSync("src/lib/drive-public-image.server.ts", "utf8").replace(
  'import { driveAccessToken } from "./drive-kv.server";',
  'const driveAccessToken = async () => "token-ficticio";',
);
const { outputText: imageModule } = ts.transpileModule(imagemPublica, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { getPublicDriveImage } = await import(`data:text/javascript;base64,${Buffer.from(imageModule).toString("base64")}`);
const fetchOriginal = globalThis.fetch;
let pastaPrivada = false;
let downloads = 0;
try {
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).hostname, "www.googleapis.com");
    assert.equal(options.redirect, "error");
    if (new URL(url).searchParams.get("alt") === "media") {
      downloads++;
      return new Response(new Uint8Array([137, 80, 78, 71]));
    }
    return Response.json({
      mimeType: "image/png", size: "4", trashed: false,
      appProperties: { visibilidade: pastaPrivada ? "interno" : "publico" },
      permissions: [{ type: "anyone", role: "reader" }],
    });
  };
  const imagem = await getPublicDriveImage("arquivo-publico-ficticio");
  assert.equal(imagem.status, 200);
  assert.equal(imagem.headers.get("content-type"), "image/png");
  assert.match(imagem.headers.get("content-security-policy"), /\bsandbox\b/);
  assert.deepEqual([...new Uint8Array(await imagem.arrayBuffer())], [137, 80, 78, 71]);

  pastaPrivada = true;
  assert.equal((await getPublicDriveImage("arquivo-privado-ficticio")).status, 404);
  assert.equal(downloads, 1, "Arquivos internos não devem ser baixados pelo endpoint público");
} finally {
  globalThis.fetch = fetchOriginal;
}
console.log("Prévia pública entrega a imagem sem disponibilizar arquivos internos.");
