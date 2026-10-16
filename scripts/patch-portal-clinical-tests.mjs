import fs from 'node:fs';

function read(path){ return fs.readFileSync(path,'utf8'); }
function write(path, value){ fs.writeFileSync(path,value); }
function replaceOne(source, search, replacement, label){
  if(!source.includes(search)) throw new Error(`Trecho não encontrado: ${label}`);
  return source.replace(search,replacement);
}

// 1. Monta sincronização automática de comandas no shell autenticado.
{
  const path='src/components/Cabecalho.tsx';
  let s=read(path);
  s=replaceOne(s,
    'import { CrmBackgroundSync } from "@/components/CrmBackgroundSync";\n',
    'import { CrmBackgroundSync } from "@/components/CrmBackgroundSync";\nimport { ComandasBackgroundSync } from "@/components/ComandasBackgroundSync";\n',
    'import ComandasBackgroundSync');
  s=replaceOne(s,
    '      <CrmBackgroundSync />\n      <MenuLateral />',
    '      <CrmBackgroundSync />\n      <ComandasBackgroundSync />\n      <MenuLateral />',
    'mount ComandasBackgroundSync');
  write(path,s);
}

// 2. Faz o helper do Drive devolver também o UUID interno de drive_arquivos.
{
  const path='src/lib/drive.functions.ts';
  let s=read(path);
  s=replaceOne(s,
    '    if (registroError) throw new Error(`Arquivo enviado, mas falhou o registro: ${registroError.message}`);\n\n    return {\n      ok: true,\n      arquivo: {',
    '    if (registroError) throw new Error(`Arquivo enviado, mas falhou o registro: ${registroError.message}`);\n\n    const { data: registroDb, error: registroBuscaError } = await supabaseAdmin\n      .from("drive_arquivos")\n      .select("id")\n      .eq("clinica_id", data.clinicaId)\n      .eq("drive_file_id", arquivo.id)\n      .single();\n    if (registroBuscaError || !registroDb?.id) throw new Error("Arquivo enviado, mas o vínculo interno não foi localizado.");\n\n    return {\n      ok: true,\n      registroId: registroDb.id as string,\n      arquivo: {',
    'retorno registroId Drive');
  write(path,s);
}

// 3. Receituário: PDF baixado continua igual e também é persistido no portal, respeitando motivo de ocultação.
{
  const path='src/lib/receituario.ts';
  let s=read(path);
  s=replaceOne(s,
    'import type { jsPDF as DocumentoPDF } from "jspdf";\n',
    'import type { jsPDF as DocumentoPDF } from "jspdf";\nimport { supabase } from "@/integrations/supabase/client";\nimport { enviarArquivoDrive } from "@/lib/drive.functions";\nimport { lerPreferenciaReceitaPortal, motivoFinalReceitaPortal } from "@/lib/receita-portal-state";\n',
    'imports portal receituario');
  const old=/export async function baixarReceituario\(dados: DadosReceituario\) \{[\s\S]*?\n\}\s*$/;
  if(!old.test(s)) throw new Error('Função baixarReceituario não encontrada');
  s=s.replace(old,`export async function baixarReceituario(dados: DadosReceituario) {
  const doc = await criarReceituario(dados);
  const paciente = dados.paciente.trim().replace(/\\s+/g, "-").toLowerCase();
  const nomeArquivo = \`${'${dados.tipo === "especial" ? "receita-controle-especial" : "receituario"}'}-${'${paciente || "oricse"}'}.pdf\`;
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
    metadata: { animalId, tutorId: animalDb.tutor_id, tipo: dados.tipo },
  }});
  if (!upload?.registroId) throw new Error("Receita baixada, mas o PDF não pôde ser vinculado ao Portal do Tutor.");

  const resumo = dados.itens.filter((item) => item.medicamento.trim()).map((item) => item.medicamento.trim()).join(", ");
  const { error: receitaError } = await (supabase as any).from("oricse_portal_receitas").insert({
    id: receitaId,
    clinica_id: clinicaId,
    animal_id: animalDb.id,
    tutor_id: animalDb.tutor_id,
    drive_arquivo_id: upload.registroId,
    tipo: dados.tipo,
    numero: dados.numero || null,
    titulo: dados.tipo === "especial" ? "Receita de controle especial" : "Receita veterinária",
    emitida_em: new Date().toISOString().slice(0,10),
    resumo: resumo || null,
    visivel_tutor: preferencia.enviar,
    motivo_ocultacao: preferencia.enviar ? null : motivoOcultacao,
  });
  if (receitaError) throw new Error(`Receita baixada, mas falhou o registro no Portal do Tutor: ${'${receitaError.message}'}`);
}
`);
  write(path,s);
}

// 4. Ficha do animal: Receita abre o receituário real e Exame aceita PDF que é enviado ao Drive.
{
  const path='src/routes/animal.tsx';
  let s=read(path);
  s=replaceOne(s,
    'import { supabase } from "@/integrations/supabase/client";\n',
    'import { supabase } from "@/integrations/supabase/client";\nimport { enviarArquivoDrive } from "@/lib/drive.functions";\n',
    'import Drive animal');
  s=replaceOne(s,
    '  const [salvandoPortal, setSalvandoPortal] = useState(false);\n',
    '  const [salvandoPortal, setSalvandoPortal] = useState(false);\n  const [arquivoPdf, setArquivoPdf] = useState<File | null>(null);\n',
    'state arquivoPdf');
  s=replaceOne(s,
    '  function abrirNovo(tipo: RegistroTipo) {\n    if (tipo === "Agendamentos" && animal) {',
    '  function abrirNovo(tipo: RegistroTipo) {\n    if (tipo === "Receitas" && animal) {\n      window.location.href = `/receituario?animalId=${encodeURIComponent(animal.id)}&tutorId=${encodeURIComponent(animal.tutorId)}`;\n      return;\n    }\n    if (tipo === "Agendamentos" && animal) {',
    'Receitas abre receituario');
  s=replaceOne(s,
    '    setTipoDetalhe(tipo === "Exames" ? "Exame" : tipo === "Documentos" ? "Documento" : "");\n  }',
    '    setTipoDetalhe(tipo === "Exames" ? "Exame" : tipo === "Documentos" ? "Documento" : "");\n    setArquivoPdf(null);\n  }',
    'reset PDF');
  s=replaceOne(s,
    '        } else if (modalTipo === "Exames") {\n          const { error } = await (supabase as any).from("oricse_portal_exames").insert({ clinica_id:clinicaId, animal_id:animal.id, titulo:titulo.trim(), tipo:tipoDetalhe.trim() || "Exame", realizado_em:data || null, resultado_resumo:detalhe.trim() || null, visivel_tutor:visivelTutor });\n          if (error) throw error;\n        } else {',
    `        } else if (modalTipo === "Exames") {
          const { data: exameCriado, error } = await (supabase as any).from("oricse_portal_exames").insert({ clinica_id:clinicaId, animal_id:animal.id, titulo:titulo.trim(), tipo:tipoDetalhe.trim() || "Exame", realizado_em:data || null, resultado_resumo:detalhe.trim() || null, visivel_tutor:visivelTutor }).select("id").single();
          if (error) throw error;
          if (arquivoPdf) {
            const { data: sessao } = await supabase.auth.getSession();
            const accessToken = sessao.session?.access_token;
            if (!accessToken) throw new Error("Sessão expirada antes do envio do PDF.");
            const base64 = await new Promise<string>((resolve, reject) => {
              const leitor = new FileReader();
              leitor.onload = () => resolve(String(leitor.result || ""));
              leitor.onerror = () => reject(new Error("Não foi possível ler o PDF selecionado."));
              leitor.readAsDataURL(arquivoPdf);
            });
            const upload = await enviarArquivoDrive({ data: {
              accessToken,
              clinicaId,
              categoria: "exames",
              nome: arquivoPdf.name,
              mimeType: "application/pdf",
              base64,
              visibilidade: visivelTutor ? "tutor" : "interno",
              entidadeTipo: "exame",
              entidadeId: exameCriado.id,
              metadata: { animalId: animal.id, titulo: titulo.trim() },
            }});
            if (!upload?.registroId) throw new Error("PDF enviado, mas não foi possível vinculá-lo ao exame.");
            const { error: vinculoError } = await (supabase as any).from("oricse_portal_exames").update({ drive_arquivo_id:upload.registroId, updated_at:new Date().toISOString() }).eq("id",exameCriado.id).eq("clinica_id",clinicaId);
            if (vinculoError) throw vinculoError;
          }
        } else {`,
    'upload PDF exame');
  s=replaceOne(s,
    '}{(modalTipo === "Exames" || modalTipo === "Documentos") && <label className="block text-sm font-bold">Tipo<input value={tipoDetalhe}',
    '}{(modalTipo === "Exames" || modalTipo === "Documentos") && <label className="block text-sm font-bold">Tipo<input value={tipoDetalhe}',
    'âncora tipo detalhe');
  const anchor='{(modalTipo === "Exames" || modalTipo === "Documentos") && <label className="block text-sm font-bold">Tipo<input value={tipoDetalhe} onChange={(e) => setTipoDetalhe(e.target.value)} placeholder={modalTipo === "Exames" ? "Ex.: Hemograma" : "Ex.: Laudo, Receita, Termo"} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"/></label>}';
  s=replaceOne(s, anchor, anchor + '{modalTipo === "Exames" && <label className="block text-sm font-bold">PDF do exame (opcional)<input type="file" accept="application/pdf,.pdf" onChange={(e) => { const arquivo=e.target.files?.[0] || null; if (arquivo && arquivo.type !== "application/pdf") { toast.error("Selecione um arquivo PDF."); e.currentTarget.value=""; setArquivoPdf(null); return; } if (arquivo && arquivo.size > 20_000_000) { toast.error("O PDF deve ter no máximo 20 MB."); e.currentTarget.value=""; setArquivoPdf(null); return; } setArquivoPdf(arquivo); }} className="mt-1 block w-full rounded-xl border bg-background p-2 font-normal"/><span className="mt-1 block text-xs font-normal text-muted-foreground">Até 20 MB. Se o registro estiver visível ao tutor, o PDF também poderá ser aberto no portal.</span></label>}', 'input PDF exame');
  write(path,s);
}

// 5. Portal: exames abrem PDF e receitas ganham seção própria.
{
  const path='src/routes/pet/$slug/portal.tsx';
  let s=read(path);
  s=replaceOne(s,
    'type Exame={id:string;animal_id:string;titulo:string;tipo:string;realizado_em:string|null;resultado_resumo:string|null};\n',
    'type Exame={id:string;animal_id:string;titulo:string;tipo:string;realizado_em:string|null;resultado_resumo:string|null;drive_arquivo_id:string|null};\ntype Receita={id:string;animal_id:string;tipo:string;numero:string|null;titulo:string;emitida_em:string;resumo:string|null;drive_arquivo_id:string|null};\n',
    'tipos exame receita');
  s=replaceOne(s,
    'type Secao="resumo"|"agenda"|"documentos"|"exames"|"vacinas"|"comanda"|"perfil";',
    'type Secao="resumo"|"agenda"|"documentos"|"exames"|"receitas"|"vacinas"|"comanda"|"perfil";',
    'secao receitas');
  s=replaceOne(s,
    'const [vacinas,setVacinas]=useState<Vacina[]>([]);const [exames,setExames]=useState<Exame[]>([]);const [documentos,setDocumentos]=useState<Documento[]>([]);',
    'const [vacinas,setVacinas]=useState<Vacina[]>([]);const [exames,setExames]=useState<Exame[]>([]);const [receitas,setReceitas]=useState<Receita[]>([]);const [documentos,setDocumentos]=useState<Documento[]>([]);',
    'state receitas');
  s=replaceOne(s,
    '      const [a,v,e,d,ag,marc,c]=await Promise.all([',
    '      const [a,v,e,d,r,ag,marc,c]=await Promise.all([',
    'promise receitas');
  s=replaceOne(s,
    '(supabase as any).from("oricse_portal_exames").select("id,animal_id,titulo,tipo,realizado_em,resultado_resumo").eq("clinica_id",ctx.clinica_id).order("realizado_em",{ascending:false,nullsFirst:false}),\n        (supabase as any).from("oricse_portal_documentos")',
    '(supabase as any).from("oricse_portal_exames").select("id,animal_id,titulo,tipo,realizado_em,resultado_resumo,drive_arquivo_id").eq("clinica_id",ctx.clinica_id).order("realizado_em",{ascending:false,nullsFirst:false}),\n        (supabase as any).from("oricse_portal_documentos")',
    'exam drive select');
  s=replaceOne(s,
    '        (supabase as any).from("oricse_portal_documentos").select("id,animal_id,titulo,tipo,data_documento,observacoes,drive_arquivo_id").eq("clinica_id",ctx.clinica_id).order("data_documento",{ascending:false,nullsFirst:false}),\n        (supabase as any).rpc("oricse_portal_agendas"),',
    '        (supabase as any).from("oricse_portal_documentos").select("id,animal_id,titulo,tipo,data_documento,observacoes,drive_arquivo_id").eq("clinica_id",ctx.clinica_id).order("data_documento",{ascending:false,nullsFirst:false}),\n        (supabase as any).from("oricse_portal_receitas").select("id,animal_id,tipo,numero,titulo,emitida_em,resumo,drive_arquivo_id").eq("clinica_id",ctx.clinica_id).order("emitida_em",{ascending:false}),\n        (supabase as any).rpc("oricse_portal_agendas"),',
    'query receitas');
  s=replaceOne(s,
    ']);for(const r of[a,v,e,d,ag,marc,c])if(r.error)throw r.error;',
    ']);for(const resposta of[a,v,e,d,r,ag,marc,c])if(resposta.error)throw resposta.error;',
    'check responses');
  s=replaceOne(s,
    'setVacinas(v.data||[]);setExames(e.data||[]);setDocumentos(d.data||[]);setAgendas(ag.data||[]);',
    'setVacinas(v.data||[]);setExames(e.data||[]);setDocumentos(d.data||[]);setReceitas(r.data||[]);setAgendas(ag.data||[]);',
    'set receitas');
  s=replaceOne(s,
    'const docsAnimal=useMemo(()=>documentos.filter(d=>d.animal_id===animalId),[documentos,animalId]);const marcacoesAnimal=',
    'const docsAnimal=useMemo(()=>documentos.filter(d=>d.animal_id===animalId),[documentos,animalId]);const receitasAnimal=useMemo(()=>receitas.filter(r=>r.animal_id===animalId),[receitas,animalId]);const marcacoesAnimal=',
    'memo receitas');
  s=replaceOne(s,
    'async function abrirDocumento(id:string){setBaixandoDoc(id);try{',
    'async function abrirDocumento(id:string,tipo:"documento"|"exame"|"receita"="documento"){setBaixandoDoc(id);try{',
    'assinatura abrirDocumento');
  s=replaceOne(s,
    'baixarDocumentoPortal({data:{accessToken,documentoId:id}})',
    'baixarDocumentoPortal({data:{accessToken,documentoId:id,tipo}})',
    'tipo downloader');
  s=replaceOne(s,
    '["exames","Exames",FlaskConical],["vacinas","Vacinas",HeartPulse]',
    '["exames","Exames",FlaskConical],["receitas","Receitas",ReceiptText],["vacinas","Vacinas",HeartPulse]',
    'nav receitas');
  s=replaceOne(s,
    'secao==="resumo"&&<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">',
    'secao==="resumo"&&<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">',
    'grid resumo 6');
  s=replaceOne(s,
    '<Resumo titulo="Exames" valor={`${examesAnimal.length} registro(s)`} Icon={FlaskConical} onClick={()=>setSecao("exames")}/><Resumo titulo="Vacinas"',
    '<Resumo titulo="Exames" valor={`${examesAnimal.length} registro(s)`} Icon={FlaskConical} onClick={()=>setSecao("exames")}/><Resumo titulo="Receitas" valor={`${receitasAnimal.length} registro(s)`} Icon={ReceiptText} onClick={()=>setSecao("receitas")}/><Resumo titulo="Vacinas"',
    'resumo receitas');
  s=replaceOne(s,
    '{secao==="exames"&&<Lista titulo="Exames" vazio="Nenhum exame liberado.">{examesAnimal.map(e=><div key={e.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{e.titulo}</strong><p className="text-xs text-slate-500">{e.tipo} · {dataBr(e.realizado_em)}</p>{e.resultado_resumo&&<p className="mt-2 whitespace-pre-wrap text-sm">{e.resultado_resumo}</p>}</div></div></div>)}</Lista>}',
    '{secao==="exames"&&<Lista titulo="Exames" vazio="Nenhum exame liberado.">{examesAnimal.map(e=><div key={e.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{e.titulo}</strong><p className="text-xs text-slate-500">{e.tipo} · {dataBr(e.realizado_em)}</p>{e.resultado_resumo&&<p className="mt-2 whitespace-pre-wrap text-sm">{e.resultado_resumo}</p>}</div>{e.drive_arquivo_id&&<button disabled={baixandoDoc===e.id} onClick={()=>void abrirDocumento(e.id,"exame")} className="inline-flex min-h-9 items-center gap-1 rounded-lg border px-3 text-xs font-bold text-[#5f7e9b] disabled:opacity-50">{baixandoDoc===e.id?<Loader2 size={14} className="animate-spin"/>:<Download size={14}/>} Abrir PDF</button>}</div></div>)}</Lista>}\n  {secao==="receitas"&&<Lista titulo="Receitas" vazio="Nenhuma receita disponível.">{receitasAnimal.map(r=><div key={r.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{r.titulo}</strong><p className="text-xs text-slate-500">{r.tipo === "especial" ? "Controle especial" : "Receita"} · {dataBr(r.emitida_em)}{r.numero?` · Nº ${r.numero}`:""}</p>{r.resumo&&<p className="mt-2 text-sm">{r.resumo}</p>}</div>{r.drive_arquivo_id&&<button disabled={baixandoDoc===r.id} onClick={()=>void abrirDocumento(r.id,"receita")} className="inline-flex min-h-9 items-center gap-1 rounded-lg border px-3 text-xs font-bold text-[#5f7e9b] disabled:opacity-50">{baixandoDoc===r.id?<Loader2 size={14} className="animate-spin"/>:<Download size={14}/>} Abrir PDF</button>}</div></div>)}</Lista>}',
    'exam + receitas UI');
  write(path,s);
}

console.log('Portal clinical integration patch applied.');
