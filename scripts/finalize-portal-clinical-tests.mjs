import fs from 'node:fs';

function read(path){ return fs.readFileSync(path,'utf8'); }
function write(path, value){ fs.writeFileSync(path,value); }

// Monta sincronização automática das comandas no shell autenticado.
{
  const path='src/components/Cabecalho.tsx';
  let s=read(path);
  if(!s.includes('ComandasBackgroundSync')){
    s=s.replace('import { CrmBackgroundSync } from "@/components/CrmBackgroundSync";\n','import { CrmBackgroundSync } from "@/components/CrmBackgroundSync";\nimport { ComandasBackgroundSync } from "@/components/ComandasBackgroundSync";\n');
    s=s.replace('      <CrmBackgroundSync />\n      <MenuLateral />','      <CrmBackgroundSync />\n      <ComandasBackgroundSync />\n      <MenuLateral />');
  }
  write(path,s);
}

// Faz o mesmo PDF baixado pelo veterinário ser persistido no Drive e registrado no Portal do Tutor.
{
  const path='src/lib/receituario.ts';
  let s=read(path);
  if(!s.includes('lerPreferenciaReceitaPortal')){
    s=s.replace('import type { jsPDF as DocumentoPDF } from "jspdf";\n','import type { jsPDF as DocumentoPDF } from "jspdf";\nimport { supabase } from "@/integrations/supabase/client";\nimport { enviarArquivoDrive } from "@/lib/drive.functions";\nimport { lerPreferenciaReceitaPortal, motivoFinalReceitaPortal } from "@/lib/receita-portal-state";\n');
  }
  const inicio=s.indexOf('export async function baixarReceituario(dados: DadosReceituario) {');
  if(inicio<0) throw new Error('baixarReceituario não encontrado');
  s=s.slice(0,inicio)+`export async function baixarReceituario(dados: DadosReceituario) {
  const doc = await criarReceituario(dados);
  const paciente = dados.paciente.trim().replace(/\\s+/g, "-").toLowerCase();
  const nomeArquivo = (dados.tipo === "especial" ? "receita-controle-especial" : "receituario") + "-" + (paciente || "oricse") + ".pdf";
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const animalId = params.get("animalId") || "";
  const preferencia = lerPreferenciaReceitaPortal();
  const motivoOcultacao = motivoFinalReceitaPortal(preferencia);

  if (animalId && !preferencia.enviar && !motivoOcultacao) {
    throw new Error("Selecione o motivo para não disponibilizar a receita no Portal do Tutor.");
  }

  doc.save(nomeArquivo);
  if (!animalId) return;

  const { data: sessao } = await supabase.auth.getSession();
  const accessToken = sessao.session?.access_token;
  if (!accessToken) throw new Error("Receita baixada, mas a sessão expirou antes do envio ao Portal do Tutor.");

  const { data: contexto, error: contextoError } = await (supabase as any).rpc("oricse_contexto_clinica_atual");
  if (contextoError) throw contextoError;
  const clinicaId = String((Array.isArray(contexto) ? contexto[0] : contexto)?.clinica_id || "");
  if (!clinicaId) throw new Error("Receita baixada, mas a clínica atual não foi identificada.");

  const { data: animalDb, error: animalError } = await (supabase as any)
    .from("oricse_animais")
    .select("id,tutor_id")
    .eq("id", animalId)
    .eq("clinica_id", clinicaId)
    .maybeSingle();
  if (animalError || !animalDb?.id || !animalDb?.tutor_id) {
    throw new Error("Receita baixada, mas o animal ainda não está sincronizado com o banco do Portal do Tutor.");
  }

  const receitaId = crypto.randomUUID();
  const base64 = doc.output("datauristring");
  const upload = await enviarArquivoDrive({ data: {
    accessToken,
    clinicaId,
    categoria: "receitas",
    nome: nomeArquivo,
    mimeType: "application/pdf",
    base64,
    visibilidade: preferencia.enviar ? "tutor" : "interno",
    entidadeTipo: "receita",
    entidadeId: receitaId,
    metadata: { animalId, tutorId: animalDb.tutor_id, tipo: dados.tipo || "normal" },
  }});
  if (!upload?.registroId) throw new Error("Receita baixada, mas o PDF não pôde ser vinculado ao Portal do Tutor.");

  const resumo = dados.itens.filter((item) => item.medicamento.trim()).map((item) => item.medicamento.trim()).join(", ");
  const { error: receitaError } = await (supabase as any).from("oricse_portal_receitas").insert({
    id: receitaId,
    clinica_id: clinicaId,
    animal_id: animalDb.id,
    tutor_id: animalDb.tutor_id,
    drive_arquivo_id: upload.registroId,
    tipo: dados.tipo || "normal",
    numero: dados.numero || null,
    titulo: dados.tipo === "especial" ? "Receita de controle especial" : "Receita veterinária",
    emitida_em: new Date().toISOString().slice(0,10),
    resumo: resumo || null,
    visivel_tutor: preferencia.enviar,
    motivo_ocultacao: preferencia.enviar ? null : motivoOcultacao,
    motivo_outro: preferencia.motivo === "Outro" ? preferencia.outro.trim() || null : null,
  });
  if (receitaError) throw new Error("Receita baixada, mas falhou o registro no Portal do Tutor: " + receitaError.message);
}
`;
  write(path,s);
}

console.log('Final portal clinical patch applied.');
