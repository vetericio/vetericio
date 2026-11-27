import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const js = (source) => ts.transpileModule(readFileSync(source, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, strict: true },
}).outputText;
const modulo = (compiled) => "data:text/javascript;base64," + Buffer.from(compiled).toString("base64");
const mensagemModule = modulo(js("src/lib/crm-mensagem-local.ts"));
const compiled = js("src/lib/crm-pos-cirurgico.ts").replace(
  /(["'])\.\/crm-mensagem-local\1/g,
  JSON.stringify(mensagemModule),
);
const { DIAS_POS_CIRURGICO_PADRAO, gerarTarefasPosCirurgicas, deslocarDia,
  normalizarProtocolo, mensagemPosCirurgica, precisaAvaliacaoPrioritaria, fonteClinicaElegivel } =
  await import(modulo(compiled));

const registro = {
  id: "cirurgia-001", clinicaId: "clinica-A", animalId: "animal-A", tutorId: "tutor-A",
  dataProcedimento: "2026-11-22", status: "concluido", acompanhamentoAprovado: true,
  procedimento: "Ovariohisterectomia",
};

assert.deepEqual([...DIAS_POS_CIRURGICO_PADRAO], [1,3,7,10]);
assert.deepEqual(gerarTarefasPosCirurgicas(registro).map(t => t.dataPrevista),
  ["2026-11-23","2026-11-25","2026-11-29","2026-12-02"]);
assert.deepEqual(gerarTarefasPosCirurgicas(registro).map(t => t.dia), [1,3,7,10]);
assert.equal(new Set(gerarTarefasPosCirurgicas(registro).map(t => t.chaveDedupe)).size, 4);
assert.deepEqual(gerarTarefasPosCirurgicas(registro),gerarTarefasPosCirurgicas(registro),
  "A mesma cirurgia sempre precisa gerar chaves estáveis para prevenir duplicação");
assert.equal(gerarTarefasPosCirurgicas({...registro,status:"rascunho"}).length,0);
assert.equal(gerarTarefasPosCirurgicas({...registro,status:"cancelado"}).length,0);
assert.equal(gerarTarefasPosCirurgicas({...registro,acompanhamentoAprovado:false}).length,0);
assert.equal(gerarTarefasPosCirurgicas({...registro,obitoRegistrado:true}).length,0);
assert.equal(gerarTarefasPosCirurgicas({...registro,animalId:""}).length,0);
assert.equal(gerarTarefasPosCirurgicas({...registro,dataProcedimento:"2026-02-30"}).length,0);
assert.equal(gerarTarefasPosCirurgicas({...registro,dataAlta:"2026-11-20"}).length,0);
assert.deepEqual(gerarTarefasPosCirurgicas({...registro,dataAlta:"2026-11-24"}).map(t=>t.dataPrevista),
  ["2026-11-25","2026-11-27","2026-12-01","2026-12-04"]);
assert.deepEqual(normalizarProtocolo([10,1,7,3,3,99,-1,2.5]),[1,3,7,10]);
assert.equal(deslocarDia("2028-02-28",1),"2028-02-29");
assert.equal(deslocarDia("2028-02-28",2),"2028-03-01");
assert.equal(deslocarDia("2026-02-29",1),null);
assert.notEqual(gerarTarefasPosCirurgicas({...registro,id:"cirurgia-002"})[0].chaveDedupe,
  gerarTarefasPosCirurgicas(registro)[0].chaveDedupe);
assert.equal(gerarTarefasPosCirurgicas(registro)[0].clinicaId,"clinica-A");
const mensagem = mensagemPosCirurgica(
  {tutorNome:"Marina Souza",animalNome:"Mel",veterinarioNome:"Dra. Camila"},
  gerarTarefasPosCirurgicas(registro)[0]
);
assert.match(mensagem,/Oi, Marina!/);
assert.doesNotMatch(mensagem,/Dra\. Camila/);
assert.match(mensagem,/equipe veterinária/);
assert.match(mensagem,/Não aguarde resposta por aqui/);
assert.match(mensagem,/Mel/);
assert.doesNotMatch(mensagem,/diagnostic|curad[ao]|prescrev|dose de/i);
assert.match(mensagemPosCirurgica({tutorNome:"",animalNome:""},gerarTarefasPosCirurgicas(registro)[0]),/equipe veterinária/);
assert.equal(precisaAvaliacaoPrioritaria({}),false);
assert.equal(precisaAvaliacaoPrioritaria({dorIntensa:true}),true);
assert.equal(precisaAvaliacaoPrioritaria({dificuldadeRespiratoria:true}),true);
const registroPersistido = {
  id: "registro-001", clinicaId:"clinica-A",
  animalId:"animal-A", tutorId:"tutor-A", data:"2026-11-22",
  status:"concluido", subtipo:"Cirurgia / Procedimentos",
  dados:{ acompanhamentoCrm:true },
};
assert.equal(fonteClinicaElegivel(registroPersistido, "clinica-A"),true);
assert.equal(fonteClinicaElegivel(registroPersistido, "clinica-B"),false,
  "O registro de uma clínica jamais pode gerar contatos para outra");
assert.equal(fonteClinicaElegivel({...registroPersistido,status:"rascunho"},"clinica-A"),false);
assert.equal(fonteClinicaElegivel({...registroPersistido,subtipo:"Consulta"},"clinica-A"),false);
assert.equal(fonteClinicaElegivel({...registroPersistido,dados:{acompanhamentoCrm:false}},"clinica-A"),false);
assert.equal(fonteClinicaElegivel({...registroPersistido,dados:{acompanhamentoCrm:true,obitoRegistrado:true}},"clinica-A"),false);
assert.equal(fonteClinicaElegivel({...registroPersistido,tutorId:null},"clinica-A"),false);
console.log("OK: pós-cirúrgico D+1/D+3/D+7/D+10, alta, segurança, datas, dedupe, mensagens e alertas.");
