import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCotaPerfisClinica } from "../src/lib/cota-perfis-clinica.ts";

test("cota de perfis rejeita omissões e falsos ilimitados; duas vagas promocionais são explícitas",()=>{
 assert.equal(parseCotaPerfisClinica(null),null);
 assert.equal(parseCotaPerfisClinica({ilimitado:true,limite:99999,bonus_perfis:0}),null);
 assert.equal(parseCotaPerfisClinica({ilimitado:false,limite:null,bonus_perfis:0}),null);
 assert.equal(parseCotaPerfisClinica({ilimitado:false,limite:1,bonus_perfis:1}),null);
 assert.deepEqual(parseCotaPerfisClinica({ilimitado:false,limite:3,bonus_perfis:2}),{ilimitado:false,limite:3,bonus_perfis:2});
 assert.deepEqual(parseCotaPerfisClinica({ilimitado:true,limite:null,bonus_perfis:0}),{ilimitado:true,limite:null,bonus_perfis:0});
});

test("o pop-up é exclusivo da página institucional e depende de consulta válida",()=>{
 const home=readFileSync(new URL("../src/routes/index.tsx",import.meta.url),"utf8");
 const show=readFileSync(new URL("../src/components/MostrarPromocaoPerfisNaHome.tsx",import.meta.url),"utf8");
 assert.match(home,/resultado\.tipo === "plataforma"[^\n]*<MostrarPromocaoPerfisNaHome/);
 assert.equal(home.split("<MostrarPromocaoPerfisNaHome").length,2);
 assert.match(show,/rpc\("oricse_oferta_perfis_equipe"\)/);
 assert.match(show,/!error && data\?\.ativa === true/);
 assert.match(show,/tempo > 0/);
});
