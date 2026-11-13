import { useEffect, useMemo, useState } from "react";
import { FileDown, FileText, Save, ShieldAlert, FileCheck2, Upload, Eye, EyeOff, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { obterAutorClinico } from "@/lib/perfil-clinico";
import { obterDadosReceituario } from "@/lib/receituario-contexto.functions";
import { listarModelosClinicos } from "@/lib/oricse-storage.functions";
import { enviarArquivoDrive } from "@/lib/drive.functions";
import { registrarDocumentoClinicoAssinado, alterarPublicacaoDocumentoClinico } from "@/lib/documento-clinico.functions";

import { obterModeloDocumentoEmissao } from "@/lib/configuracoes-clinica.functions";
import { DOCUMENTOS, MODELOS_BASE_CLINICOS, preencherTextoDocumento, valoresModeloDocumento } from "@/lib/modelos-documentos";
import { criarPdfComModelo, prepararPapelDocumento } from "@/lib/modelos-documentos-pdf";

type TipoClinico = "pedido" | "documento" | "termo";
type PadraoClinico = Awaited<ReturnType<typeof obterModeloDocumentoEmissao>>;
type Modelo = { id: string; nome: string; categoria: string; texto: string; versao: number };
type Contexto = Awaited<ReturnType<typeof obterDadosReceituario>>;

function preencher(texto: string, dados: Contexto, identidade?: PadraoClinico["identidade"]) {
  const valores: Record<string,string> = {
    ...(identidade ? valoresModeloDocumento(identidade, { paciente: "", tutor: "", data: "" }) : {}),
    clinica: dados.clinicaNome || "",
    endereco_clinica: dados.clinicaEndereco || "",
    paciente: dados.animal?.nome || "",
    especie: dados.animal?.especie || "",
    raca: dados.animal?.raca || "",
    tutor: dados.tutor?.nome || "",
    data: new Date().toLocaleDateString("pt-BR"),
    veterinario: "{{veterinario}}",
    crmv: "{{crmv}}",
  };
  return preencherTextoDocumento(texto, valores);
}
export function ModelosClinicosAtendimento() {
  const [profissional,setProfissional] = useState<Awaited<ReturnType<typeof obterAutorClinico>> | null>(null);
  const [modelos,setModelos] = useState<Modelo[]>([]);
  const [dados,setDados] = useState<Contexto | null>(null);
  const [selecionado,setSelecionado] = useState("");
  const [conteudo,setConteudo] = useState("");
  const [textoInicial, setTextoInicial] = useState("");
  const [padrao, setPadrao] = useState<PadraoClinico | null>(null);
  const [abrindoModelo, setAbrindoModelo] = useState(false);
  const [carregando,setCarregando] = useState(true);
  const [emitindo,setEmitindo] = useState(false);
  const [erro,setErro] = useState("");
  const [referencia,setReferencia] = useState<{id:string;versao:number}|null>(null);
  const [arquivoAssinado,setArquivoAssinado] = useState<File|null>(null);
  const [assinaturaConferida,setAssinaturaConferida] = useState(false);
  const [registro,setRegistro] = useState<{id:string;visivel:boolean}|null>(null);
  const [publicando,setPublicando] = useState(false);
  const [uploadPendente,setUploadPendente] = useState<string|null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const animalId = params.get("animalId") || undefined;
        const tutorId = params.get("tutorId") || undefined;
        if (!animalId) throw new Error("Abra esta página pelo atendimento de um animal para preencher e arquivar documentos.");
        const { data: sessao } = await supabase.auth.getSession();
        if (!sessao.session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");
        const contexto = await obterDadosReceituario({data:{
          accessToken:sessao.session.access_token,
          animalId, ...(tutorId ? { tutorId } : {}),
        }});
        if (!contexto.animal?.id || !contexto.clinicaId) throw new Error("Animal e clínica não identificados.");
        const [lista, autor] = await Promise.all([
          listarModelosClinicos({data:{
            accessToken:sessao.session.access_token, clinicaId:contexto.clinicaId,
          }}),
          obterAutorClinico(),
        ]);
        if (!ativo) return;
        setDados(contexto);
        setProfissional(autor);
        // Receitas usam o fluxo próprio com assinatura e controles especiais.
        setModelos([
          ...MODELOS_BASE_CLINICOS.map(base => ({ ...base, nome: DOCUMENTOS[base.categoria].titulo, texto: DOCUMENTOS[base.categoria].exemplo, versao: 0 })),
          ...lista.filter((item) => item.categoria !== "receita" && !MODELOS_BASE_CLINICOS.some(base => base.id === item.id)),
        ]);
      } catch(e) {
        if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar os modelos.");
      } finally { if (ativo) setCarregando(false); }
    })();
    return () => { ativo = false; };
  }, []);

  const modelo = useMemo(() => modelos.find((item) => item.id === selecionado), [modelos,selecionado]);
  async function escolher(id: string) {
    if (!dados || abrindoModelo || emitindo) return;
    if (modelo && conteudo !== textoInicial && !window.confirm("Descartar as alterações deste documento?")) return;
    const m = modelos.find(item => item.id === id);
    setAbrindoModelo(true);
    try {
      const { data: sessao } = await supabase.auth.getSession();
      if (!sessao.session?.access_token) throw new Error("Sessão expirada.");
      const configuracao = m ? await obterModeloDocumentoEmissao({ data: {
        accessToken: sessao.session.access_token, clinicaId: dados.clinicaId, tipo: m.categoria as TipoClinico,
      } }) : null;
      const base = m && MODELOS_BASE_CLINICOS.some(item => item.id === m.id);
      const texto = m ? preencher(base && configuracao?.modelo.texto ? configuracao.modelo.texto : m.texto, dados, configuracao?.identidade) : "";
      setSelecionado(id);
      setPadrao(configuracao);
      setTextoInicial(texto);
      setConteudo(texto);
      setReferencia(m ? { id:m.id,versao:m.versao } : null);
      setRegistro(null);setArquivoAssinado(null);setAssinaturaConferida(false);setUploadPendente(null);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível carregar o modelo.");
    } finally { setAbrindoModelo(false); }
  }
  const pendencias = useMemo(() => [...conteudo.matchAll(/\{\{[^{}]+\}\}/g)].map((m) => m[0])
    .filter(campo => campo !== "{{veterinario}}" && campo !== "{{crmv}}"), [conteudo]);
  const perfilCompleto = Boolean(profissional?.nome && profissional.crmv);
  async function exportar(arquivar: boolean) {
    if (!modelo || !padrao || !dados?.animal?.id || !dados.clinicaId) return;
    if (!conteudo.trim()) return toast.error("Preencha o conteúdo antes de gerar o documento.");
    if (pendencias.length) return toast.error("Preencha os campos pendentes antes de gerar: " + [...new Set(pendencias)].join(", "));
    if (conteudo.length > 25000) return toast.error("Documento acima do limite de 25 mil caracteres.");
    if (arquivar && !window.confirm("Arquivar este PDF como rascunho interno, ainda sem assinatura?")) return;
    setEmitindo(true);
    try {
      const autor = await obterAutorClinico();
      if (!autor.nome || !autor.crmv) throw new Error("Complete nome, CRMV e UF no cadastro profissional do seu perfil.");
      const texto = conteudo.replace(/\{\{(veterinario|crmv)\}\}/g,
        (_original, campo) => campo === "veterinario" ? autor.nome : autor.crmv);
      const papel = await prepararPapelDocumento(padrao.identidade, padrao.modelo);
      const pdf = await criarPdfComModelo({
        titulo: modelo.nome, conteudo: texto, papel,
        identificacao: [
          [dados.animal.nome, dados.animal.especie, dados.animal.raca, dados.animal.sexo,
            dados.animal.idade || dados.animal.nascimento, dados.animal.pelagem,
            dados.animal.peso && dados.animal.peso + " kg", dados.animal.microchip && "Microchip " + dados.animal.microchip].filter(Boolean).join(" · "),
          ["Responsável: " + (dados.tutor?.nome || ""), dados.tutor?.cpf && "CPF " + dados.tutor.cpf,
            dados.tutor?.endereco].filter(Boolean).join(" · "),
        ],
        assinatura: [
          [padrao.identidade.municipio, new Date().toLocaleDateString("pt-BR")].filter(Boolean).join(", "),
          autor.nome + " · " + autor.crmv,
          [autor.endereco, autor.telefone, padrao.identidade.email].filter(Boolean).join(" · "),
        ],
      });
      const filename = (modelo.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 65) || "documento") + ".pdf";
      if (!arquivar) {
        pdf.save(filename);
        toast.success("PDF gerado para conferência. Não é um documento assinado.");
        return;
      }
      const { data: sessao } = await supabase.auth.getSession();
      if (!sessao.session?.access_token) throw new Error("Sessão expirada.");
      const base64 = pdf.output("datauristring").split(",")[1];
      if (!base64) throw new Error("PDF não pôde ser convertido para envio.");
      const resposta = await enviarArquivoDrive({data:{
        accessToken:sessao.session.access_token,
        clinicaId:dados.clinicaId,
        categoria:"documentos",
        nome:filename,
        mimeType:"application/pdf",
        base64,
        visibilidade:"interno",
        entidadeTipo:"animal",
        entidadeId:dados.animal.id,
        metadata:{
          origem:"modelo_clinico", modeloId:referencia?.id || modelo.id,
          versaoModelo:referencia?.versao ?? modelo.versao,
          status:"rascunho_sem_assinatura",
          animalId:dados.animal.id, tutorId:dados.tutorId,
        },
      }});
      if (!resposta?.ok || !resposta.registroId) throw new Error("O armazenamento não confirmou o arquivo.");
      toast.success("Rascunho arquivado na pasta de documentos da clínica.");
      pdf.save(filename);
    } catch(e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar ou arquivar documento.");
    } finally { setEmitindo(false); }
  }

  async function receberAssinado(arquivo?: File) {
    if (!arquivo) return;
    if (arquivo.size > 8_000_000 || arquivo.size < 100 || !/\.pdf$/i.test(arquivo.name)) {
      toast.error("Escolha um PDF assinado de até 8 MB.");
      return;
    }
    const inicio = new TextDecoder().decode(await arquivo.slice(0,5).arrayBuffer());
    if (inicio !== "%PDF-") { toast.error("O arquivo não possui o formato PDF esperado."); return; }
    setArquivoAssinado(arquivo);setRegistro(null);setUploadPendente(null);setAssinaturaConferida(false);
  }
  async function registrarAssinado() {
    if (!modelo || !dados?.animal?.id || !dados?.tutorId || !dados.clinicaId || !arquivoAssinado || !assinaturaConferida || !perfilCompleto) return;
    if (!conteudo.trim() || pendencias.length) return toast.error("Revise e preencha todos os campos do documento.");
    if (!window.confirm("Confirmar o registro do PDF assinado? Ele ficará privado até sua liberação expressa.")) return;
    setEmitindo(true);
    try {
      const {data:sessao} = await supabase.auth.getSession();
      const accessToken=sessao.session?.access_token;
      if (!accessToken) throw new Error("Sessão expirada.");
      let registroId = uploadPendente;
      if (!registroId) {
        const base64 = await new Promise<string>((resolve,reject)=>{
          const leitor = new FileReader();
          leitor.onload = ()=>resolve(String(leitor.result||""));
          leitor.onerror = ()=>reject(new Error("Não foi possível ler o PDF assinado."));
          leitor.readAsDataURL(arquivoAssinado);
        });
        const uploaded = await enviarArquivoDrive({data:{
          accessToken,clinicaId:dados.clinicaId,categoria:"documentos",
          nome:arquivoAssinado.name.slice(0,150), mimeType:"application/pdf",
          base64, visibilidade:"interno",entidadeTipo:"animal",entidadeId:dados.animal.id,
          metadata:{origem:"modelo_clinico_assinado",modeloId:modelo.id,modeloVersao:modelo.versao,
            animalId:dados.animal.id,tutorId:dados.tutorId,status:"assinatura_declarada"},
        }});
        if (!uploaded?.ok || !uploaded.registroId) throw new Error("O Google Drive não confirmou o arquivo.");
        registroId=uploaded.registroId;
        setUploadPendente(registroId);
      }
      const resultado=await registrarDocumentoClinicoAssinado({data:{
        accessToken,clinicaId:dados.clinicaId,animalId:dados.animal.id,tutorId:dados.tutorId,
        registroId,modeloId:modelo.id,modeloVersao:modelo.versao,
        arquivoSha256:Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await arquivoAssinado.arrayBuffer()))).map((b)=>b.toString(16).padStart(2,"0")).join(""),
        categoria:modelo.categoria as "pedido"|"documento"|"termo",
        titulo:modelo.nome,assinaturaConferida:true,
      }});
      if (!resultado.registrado) throw new Error("A emissão não foi confirmada.");
      setRegistro({id:resultado.documentoId,visivel:resultado.visivelTutor});
      setUploadPendente(null);
      toast.success("Documento registrado. Acesso do tutor continua bloqueado.");
    } catch(e) { toast.error(e instanceof Error?e.message:"Não foi possível registrar o documento."); }
    finally { setEmitindo(false); }
  }
  async function alterarVisibilidade() {
    if (!registro || !dados?.clinicaId) return;
    const proximo = !registro.visivel;
    if (!window.confirm(proximo
      ? "Liberar este documento ao tutor? Confirme que ele é destinado ao responsável deste animal."
      : "Ocultar este documento do Portal do Tutor?")) return;
    setPublicando(true);
    try {
      const {data:sessao}=await supabase.auth.getSession();
      if(!sessao.session?.access_token) throw new Error("Sessão expirada.");
      const resposta=await alterarPublicacaoDocumentoClinico({data:{
        accessToken:sessao.session.access_token,clinicaId:dados.clinicaId,
        documentoId:registro.id,visivel:proximo,
      }});
      setRegistro({id:registro.id,visivel:resposta.visivelTutor});
      toast.success(proximo?"Documento liberado ao tutor.":"Documento ocultado do tutor.");
    } catch(e) { toast.error(e instanceof Error?e.message:"Não foi possível atualizar a visibilidade."); }
    finally{setPublicando(false);}
  }

  if (carregando) return <section className="mt-4 rounded-xl border bg-card p-5 text-sm text-muted-foreground">Carregando modelos da clínica...</section>;
  if (erro) return <section className="mt-4 rounded-xl border bg-card p-5 text-sm" role="status"><ShieldAlert size={18} className="mb-2 text-amber-600"/>{erro}</section>;
  return <section className="mt-5 rounded-xl border bg-card p-4 sm:p-5">
    <div className="mb-4 flex items-start gap-2">
      <FileText size={20} className="mt-0.5 text-primary"/>
      <div><h2 className="text-lg font-semibold">Modelos da clínica</h2>
        <p className="text-sm text-muted-foreground">Paciente: <strong>{dados?.animal?.nome}</strong> · Tutor: <strong>{dados?.tutor?.nome || "Não informado"}</strong>. Confira os dados antes de gerar.</p>
      </div>
    </div>
    <label className="block text-sm font-medium">Escolher modelo
      <select value={selecionado} disabled={abrindoModelo || emitindo} onChange={(e) => void escolher(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3 font-normal">
        <option value="">Selecione um documento...</option>
        {modelos.map((m)=><option value={m.id} key={m.id}>{m.nome}{m.versao ? ` · v${m.versao}` : " · Padrão da clínica"}</option>)}
      </select>
    </label>
    {!modelos.length && <p className="mt-3 text-sm text-muted-foreground">Nenhum modelo clínico disponível. O administrador ou RT pode criar modelos nas Configurações da Clínica.</p>}
    {abrindoModelo && <p role="status" className="mt-3 text-sm">Carregando modelo…</p>}
    {modelo && !abrindoModelo && <div className="mt-4 space-y-3">
      <p className="text-sm font-medium">
        {perfilCompleto ? `Médico-veterinário: ${profissional?.nome} · ${profissional?.crmv}`
          : "Complete nome, CRMV e UF no cadastro profissional do seu perfil."}
      </p>
      <label className="block text-sm font-medium">Revisar e completar documento
        <textarea rows={15} maxLength={25000} value={conteudo} onChange={(e)=>{setConteudo(e.target.value);setArquivoAssinado(null);setAssinaturaConferida(false);setUploadPendente(null);setRegistro(null);}}
          className="mt-1 w-full rounded-lg border bg-background p-3 font-mono text-sm leading-relaxed"/>
      </label>
      {pendencias.length > 0 && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Campos a preencher: {[...new Set(pendencias)].join(", ")}</p>}
      <p className="text-xs text-muted-foreground">O rascunho permanece privado. Para registrar uma emissão, assine o PDF pelo procedimento adequado, importe o arquivo assinado e confirme. Assinatura gráfica não equivale à certificação digital.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={emitindo || !perfilCompleto || Boolean(pendencias.length)} onClick={()=>void exportar(false)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-semibold disabled:opacity-50"><FileDown size={17}/> Baixar PDF</button>
        <button type="button" disabled={emitindo || !perfilCompleto || Boolean(pendencias.length)} onClick={()=>void exportar(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save size={17}/>{emitindo?"Processando...":"Arquivar rascunho"}</button>
      </div>
      <div className="mt-4 space-y-3 border-t pt-4">
        <div className="flex items-start gap-2"><FileCheck2 className="mt-0.5 text-primary" size={19}/>
          <div><h3 className="font-semibold">Assinar e registrar a emissão</h3>
            <p className="text-xs text-muted-foreground">1. Baixe o PDF acima. 2. Assine na ferramenta ORICSE ou externamente. 3. Importe o PDF assinado. 4. Revise e registre.</p></div>
        </div>
        <a href="/assinar" target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold hover:bg-muted">
          <ExternalLink size={16}/> Abrir ferramenta de assinatura
        </a>
        <label className="flex min-h-12 cursor-pointer flex-wrap items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium">
          <Upload size={16}/> {arquivoAssinado ? arquivoAssinado.name : "Selecionar PDF assinado (até 8 MB)"}
          <input type="file" accept=".pdf,application/pdf" className="sr-only" onChange={(e)=>{
            void receberAssinado(e.target.files?.[0]);e.target.value="";
          }}/>
        </label>
        {arquivoAssinado && !registro && <>
          <label className="flex items-start gap-3 rounded-lg border bg-background p-3 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-primary" checked={assinaturaConferida}
              onChange={(e)=>setAssinaturaConferida(e.target.checked)}/>
            <span>Confirmo que conferi o conteúdo e a assinatura deste PDF. O ORICSE verifica a integridade do arquivo enviado, mas não valida criptograficamente certificados digitais ou assinaturas GOV.BR.</span>
          </label>
          <button type="button" onClick={()=>void registrarAssinado()}
            disabled={emitindo || !perfilCompleto || !assinaturaConferida || Boolean(pendencias.length)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            <Save size={17}/>{emitindo?"Registrando...":"Registrar PDF assinado (privado)"}
          </button>
        </>}
        {registro && <div className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><FileCheck2 size={17} className="text-primary"/> Documento registrado</div>
          <p className="text-xs text-muted-foreground">Registro: {registro.id} · {registro.visivel?"Disponível no Portal do Tutor":"Privado — não aparece ao tutor"}.</p>
          <button type="button" disabled={publicando} onClick={()=>void alterarVisibilidade()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-semibold disabled:opacity-50">
            {registro.visivel?<EyeOff size={16}/>:<Eye size={16}/>}
            {publicando?"Atualizando...":registro.visivel?"Ocultar do Portal do Tutor":"Liberar no Portal do Tutor"}
          </button>
        </div>}
      </div>
    </div>}
  </section>;
}
