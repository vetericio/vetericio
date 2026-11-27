import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const server = read("../src/lib/manual-sistema.server.ts")
  .replace(/^import .*\n/gm, "")
  .replace(/export const baixarManualSistema = criarEntregaManualSistema\([\s\S]+$/, "");
const { outputText } = ts.transpileModule(server, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const { criarEntregaManualSistema } = await import(
  "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
);
const request = (token, suffix = "", method = "GET") =>
  new Request("https://oricse.example/api/ajuda/manual" + suffix, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

test("PDF está disponível para funcionários das clínicas autorizadas, não visitantes e tutores", async () => {
  let leituras = 0;
  const abrir = async () => {
    leituras++;
    return new Response("%PDF-1.7", { headers: { "Content-Type": "application/pdf" } });
  };
  const autorizar = async (jwt) => {
    if (jwt === "equipe-A" || jwt === "equipe-B") return { admin: false, podeBaixar: true };
    if (jwt === "tutor" || jwt === "sem-vinculo") return { admin: false, podeBaixar: false };
    if (jwt === "admin") return { admin: true, podeBaixar: false };
    return null;
  };
  const buscar = criarEntregaManualSistema({
    autorizar,
    abrir,
    conexao: async () => ({ conta: "conta-ficticia@example.test", disponivel: true }),
  });
  assert.equal((await buscar(request())).status, 401);
  assert.equal((await buscar(request("invalido"))).status, 401);
  assert.equal((await buscar(request("tutor"))).status, 403);
  assert.equal((await buscar(request("sem-vinculo"))).status, 403);
  assert.equal((await buscar(request("equipe-A", "?acao=conexao"))).status, 403);
  assert.equal((await buscar(request("equipe-A", "", "POST"))).status, 405);
  assert.equal(leituras, 0);
  for (const perfil of ["equipe-A", "equipe-B"]) {
    const r = await buscar(request(perfil));
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("Cache-Control"), "private, no-store");
    assert.equal(r.headers.get("Content-Disposition"), 'attachment; filename="Manual-ORICSE.pdf"');
    assert.equal(await r.text(), "%PDF-1.7");
  }
  assert.equal(leituras, 2);
  assert.equal((await buscar(request("admin", "?acao=conexao"))).status, 200);
});

test("uma página HTML de erro não vira um PDF para baixar", async () => {
  const buscar = criarEntregaManualSistema({
    autorizar: async () => ({ admin: false, podeBaixar: true }),
    abrir: async () => new Response("sem PDF", { headers: { "Content-Type": "text/html" } }),
    conexao: async () => ({ conta: "", disponivel: false }),
  });
  assert.equal((await buscar(request("pet-shop"))).status, 503);
});

test("a Ajuda está diretamente acima de Sair no menu comum", () => {
  const menu = read("../src/components/MenuLateral.tsx");
  assert.match(
    menu,
    /areasOpcionais\.map\(renderArea\)[\s\S]+?ManualSistemaMenu[\s\S]+?onClick=\{sair\}/,
  );
  const item = read("../src/components/ManualSistemaMenu.tsx");
  assert.match(item, /Manual do Sistema/);
});
