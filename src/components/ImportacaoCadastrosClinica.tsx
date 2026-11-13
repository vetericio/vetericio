import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Download, PawPrint, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { supabaseBanco } from "@/integrations/supabase/client";
import { lerCsv } from "@/lib/migracao-assistida";

type Tipo = "tutores" | "animais";
type Tutor = { id:string; nome:string; telefone?:string; cpfCnpj?:string };
type Animal = { id:string; nome:string; tutorId?:string; tutor_id?:string; microchip?:string; dados?:{microchip?:string} };
type Base = { tutores:Tutor[]; animais:Animal[]; clinicaId:string };
type RegistroCsv = { indice:number; dados:Record<string,string> };
type Linha = RegistroCsv & { status:"novo"|"duplicado"|"erro"; motivo:string; tutorId?:string };
const MAX_LINHAS=100;
const soDigitos=(v:string)=>v.replace(/\D/g,"");
const normalizar=(v:string)=>v.trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
const csvModelos:Record<Tipo,string>={
  tutores:"nome;telefone;cpf_cnpj;email\nMaria Silva;31999999999;12345678909;maria@exemplo.com\n",
  animais:"nome;especie;raca;tutor_cpf_cnpj;microchip;nascimento\nLuna;Cão;SRD (Sem Raça Definida);12345678909;;2021-05-10\n",
};
function parserCsv(conteudo:string):RegistroCsv[]{
  const linhas=lerCsv(conteudo).filter(linha=>linha.some(campo=>campo.trim()));
  if(linhas.length<2)throw new Error("O arquivo precisa de cabeçalho e pelo menos uma linha.");
  if(linhas.length-1>MAX_LINHAS)throw new Error("Importe até "+MAX_LINHAS+" registros por vez.");
  const headers=linhas[0].map(x=>normalizar(x).replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,""));
  if(headers.some(x=>!x)||new Set(headers).size!==headers.length)throw new Error("Cabeçalhos vazios ou repetidos.");
  return linhas.slice(1).map((val,i)=>{
    if(val.length>headers.length)throw new Error("Linha "+(i+2)+": colunas em excesso.");
    return {indice:i+2,dados:Object.fromEntries(headers.map((h,j)=>[h,(val[j]||"").trim()]))};
  });
}
function validoData(valor:string){
  if(!valor)return true;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(valor))return false;
  const data=new Date(valor+"T12:00:00Z");
  return !Number.isNaN(data.getTime())&&data.toISOString().slice(0,10)===valor&&valor<=new Date().toISOString().slice(0,10);
}
function conferir(tipo:Tipo,rows:RegistroCsv[],base:Base):Linha[]{
  const chaves=new Set<string>();
  const docs=new Set<string>();
  const microchips=new Set<string>();
  const tutoresPorDocumento=new Map<string,Tutor[]>();
  for(const tutor of base.tutores){
    const doc=soDigitos(tutor.cpfCnpj||"");
    if(doc)tutoresPorDocumento.set(doc,[...(tutoresPorDocumento.get(doc)||[]),tutor]);
  }
  return rows.map(row=>{
    const d=row.dados,nome=(d.nome||"").trim();
    const erro=(motivo:string):Linha=>({...row,status:"erro",motivo});
    const duplicado=(motivo:string):Linha=>({...row,status:"duplicado",motivo});
    if(nome.length<2||nome.length>110)return erro("Nome deve ter de 2 a 110 caracteres.");
    if(tipo==="tutores"){
      const telefone=soDigitos(d.telefone||""),doc=soDigitos(d.cpf_cnpj||"");
      const email=d.email||"";
      if(telefone.length<10||telefone.length>11)return erro("Telefone inválido: informe DDD e número.");
      if(doc&&![11,14].includes(doc.length))return erro("CPF/CNPJ deve ter 11 ou 14 dígitos.");
      if(email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>180))return erro("E-mail inválido.");
      const chave=normalizar(nome)+"|"+telefone;
      if((doc&&docs.has(doc))||chaves.has(chave))return duplicado("Repetido neste arquivo.");
      if(doc)docs.add(doc);
      chaves.add(chave);
      if((doc&&tutoresPorDocumento.has(doc))||base.tutores.some(t=>normalizar(t.nome)===normalizar(nome)&&soDigitos(t.telefone||"")===telefone))return duplicado("Tutor já cadastrado.");
      return {...row,status:"novo",motivo:"Pronto para cadastrar."};
    }
    const doc=soDigitos(d.tutor_cpf_cnpj||""),especie=(d.especie||"").trim(),microchip=(d.microchip||"").trim();
    if(![11,14].includes(doc.length))return erro("Informe CPF/CNPJ do tutor existente.");
    const correspondentes=tutoresPorDocumento.get(doc)||[];
    if(correspondentes.length!==1)return erro(correspondentes.length?"Tutor ambíguo: documento repetido.":"Tutor não encontrado nesta clínica.");
    if(especie.length<2||especie.length>80)return erro("Espécie inválida.");
    if((d.raca||"").length>100||microchip.length>35)return erro("Raça ou microchip excede limite.");
    if(!validoData(d.nascimento||""))return erro("Nascimento inválido ou futuro. Use AAAA-MM-DD.");
    const tutorId=correspondentes[0].id;
    const chave=tutorId+"|"+normalizar(nome);
    if(chaves.has(chave))return duplicado("Mesmo animal repetido neste arquivo.");
    chaves.add(chave);
    if(base.animais.some(a=>(a.tutorId||a.tutor_id)===tutorId&&normalizar(a.nome)===normalizar(nome)))return duplicado("Animal já cadastrado para este tutor.");
    if(microchip&&(microchips.has(microchip)||base.animais.some(a=>(a.microchip||a.dados?.microchip||"").trim()===microchip)))return duplicado("Microchip repetido ou já cadastrado.");
    if(microchip)microchips.add(microchip);
    return {...row,status:"novo",motivo:"Pronto para cadastrar.",tutorId};
  });
}
export function ImportacaoCadastrosClinica({podeGerenciar}:{podeGerenciar:boolean}){
  const [tipo,setTipo]=useState<Tipo>("tutores");
  const [base,setBase]=useState<Base|null>(null);
  const [registros,setRegistros]=useState<RegistroCsv[]>([]);
  const [nomeArquivo,setNomeArquivo]=useState("");
  const [carregando,setCarregando]=useState(true);
  const [executando,setExecutando]=useState(false);
  const [erro,setErro]=useState("");
  const [resultado,setResultado]=useState("");
  async function consultarBase(tipoAtual:Tipo):Promise<Base>{
    const {data:auth,error:authError}=await supabaseBanco.auth.getUser();
    if(authError||!auth.user)throw new Error("Sessão expirada.");
    const {data:cid,error:erroClinica}=await(supabaseBanco as any).rpc("oricse_clinica_ativa_obter");
    if(erroClinica||!cid)throw new Error("Selecione uma clínica ativa.");
    const {data:pessoas,error:erroPessoas}=await(supabaseBanco as any).rpc("oricse_tutores_tela",{p_clinica:cid});
    if(erroPessoas||!Array.isArray(pessoas?.tutores))throw new Error("Não foi possível conferir os tutores existentes.");
    const tutores=(pessoas.tutores||[]) as Tutor[];
    if(tutores.length>=1000)throw new Error("Há muitos tutores para validar com segurança nesta tela. Solicite importação supervisionada.");
    let animais:Animal[]=[];
    if(tipoAtual==="animais"){
      const {data,error}=await(supabaseBanco as any).from("oricse_animais")
        .select("id,nome,tutor_id,dados").eq("clinica_id",cid).limit(1000);
      if(error||!data)throw new Error("Não foi possível verificar os animais já cadastrados.");
      if(data.length>=1000)throw new Error("A lista de animais excede o limite de conferência desta importação.");
      animais=data as Animal[];
    }
    return {clinicaId:String(cid),tutores,animais};
  }
  useEffect(()=>{let ativo=true;void(async()=>{
    try{const b=await consultarBase("tutores");if(ativo)setBase(b);}
    catch(e){if(ativo)setErro(e instanceof Error?e.message:"Não foi possível carregar a clínica.");}
    finally{if(ativo)setCarregando(false);}
  })();return()=>{ativo=false;};},[]);
  const linhas=useMemo(()=>base?conferir(tipo,registros,base):[],[base,registros,tipo]);
  const novos=linhas.filter(x=>x.status==="novo").length,duplicados=linhas.filter(x=>x.status==="duplicado").length,invalidos=linhas.filter(x=>x.status==="erro").length;
  async function selecionarTipo(proximo:Tipo){
    if(executando||proximo===tipo)return;
    setTipo(proximo);setRegistros([]);setNomeArquivo("");setErro("");setResultado("");
    setCarregando(true);
    try{setBase(await consultarBase(proximo));}
    catch(e){setBase(null);setErro(e instanceof Error?e.message:"Falha ao conferir cadastros.");}
    finally{setCarregando(false);}
  }
  async function carregarArquivo(file?:File){
    if(!file||!podeGerenciar)return;
    setRegistros([]);setResultado("");setErro("");setNomeArquivo("");
    if(!file.name.toLowerCase().endsWith(".csv")||file.size>180000||file.size<5)return setErro("Selecione um CSV com até 180 KB.");
    try{
      const rows=parserCsv(await file.text());
      const obrigatorios=tipo==="tutores"?["nome","telefone"]:["nome","especie","tutor_cpf_cnpj"];
      const headers=Object.keys(rows[0].dados);
      if(obrigatorios.some(x=>!headers.includes(x)))throw new Error("Colunas obrigatórias: "+obrigatorios.join(", "));
      setRegistros(rows);setNomeArquivo(file.name);
    }catch(e){setErro(e instanceof Error?e.message:"CSV inválido.");}
  }
  function baixarModelo(){
    const blob=new Blob(["\uFEFF"+csvModelos[tipo]],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="modelo_importacao_"+tipo+".csv";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function executarImportacao(){
    if(!podeGerenciar||!base||executando||!novos||invalidos)return;
    if(!window.confirm("Cadastrar "+novos+" registros novos na clínica selecionada? Os registros existentes não serão alterados. Uma falha pode resultar em importação parcial."))return;
    setExecutando(true);setErro("");setResultado("");
    let salvos=0;
    try{
      const atualizado=await consultarBase(tipo);
      if(atualizado.clinicaId!==base.clinicaId)throw new Error("A clínica ativa mudou. Reabra a importação.");
      const reavaliadas=conferir(tipo,registros,atualizado);
      if(reavaliadas.some((x,i)=>x.status!==linhas[i].status||x.tutorId!==linhas[i].tutorId)){
        setBase(atualizado);
        throw new Error("Os cadastros mudaram desde a prévia. Revise novamente antes de confirmar.");
      }
      for(const linha of reavaliadas.filter(x=>x.status==="novo")){
        const d=linha.dados;
        if(tipo==="tutores"){
          const doc=soDigitos(d.cpf_cnpj||"");
          const payload={
            nome:d.nome, telefone:soDigitos(d.telefone||""), cpfCnpj:doc,
            email:d.email||"",tipoPessoa:doc.length===14?"Pessoa jurídica":"Pessoa física",
            autorizaMarketing:false,autorizaWhatsapp:false,autorizaEmail:false,autorizaLembretes:false,
          };
          const {error}=await(supabaseBanco as any).rpc("oricse_tutor_salvar_tela",{p_clinica:base.clinicaId,p_dados:payload,p_id:null});
          if(error)throw new Error("Linha "+linha.indice+": "+error.message);
        }else{
          if(!linha.tutorId)throw new Error("Linha "+linha.indice+": tutor não identificado.");
          const payload={
            nome:d.nome,especie:d.especie,
            raca:d.raca||"SRD (Sem Raça Definida)",nascimento:d.nascimento||"",
            microchip:d.microchip||"",temperamentos:[],status:"Ativo",
          };
          const {error}=await(supabaseBanco as any).rpc("oricse_animal_salvar_tela",{
            p_clinica:base.clinicaId,p_tutor:linha.tutorId,p_animal:null,p_dados:payload,
          });
          if(error)throw new Error("Linha "+linha.indice+": "+error.message);
        }
        salvos++;
      }
      toast.success(salvos+" registros importados e confirmados.");
      setResultado(salvos+" registros cadastrados.");
    }catch(e){
      const mensagem=e instanceof Error?e.message:"Falha na importação.";
      setErro(mensagem);
      setResultado(salvos?salvos+" registros confirmados antes da interrupção. Reimporte apenas os restantes após revisar a nova prévia.":"Nenhum registro confirmado nesta tentativa.");
    }finally{
      try{setBase(await consultarBase(tipo));}catch{setErro(x=>x||"Importação feita, mas não foi possível atualizar a prévia.");}
      setExecutando(false);
    }
  }
  return <section className="mt-5 rounded-xl border bg-background p-4 sm:p-5" aria-label="Importação de tutores e animais">
    <h3 className="text-base font-semibold">Importar tutores e animais</h3>
    <p className="mt-1 text-xs text-muted-foreground">Importação controlada pelo Supabase, até 100 linhas por vez. Não altera cadastros existentes. Comece pelos tutores; os animais precisam de tutor já cadastrado com CPF/CNPJ.</p>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button type="button" disabled={executando} onClick={()=>void selecionarTipo("tutores")} className={"flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold "+(tipo==="tutores"?"bg-primary text-primary-foreground":"")}><Users size={16}/> Tutores</button>
      <button type="button" disabled={executando} onClick={()=>void selecionarTipo("animais")} className={"flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold "+(tipo==="animais"?"bg-primary text-primary-foreground":"")}><PawPrint size={16}/> Animais</button>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={baixarModelo} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold"><Download size={15}/> Baixar modelo CSV</button>
      {podeGerenciar&&<label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs font-semibold"><Upload size={15}/> Selecionar CSV
        <input type="file" disabled={executando||carregando} accept=".csv,text/csv" className="sr-only" onChange={e=>{void carregarArquivo(e.target.files?.[0]);e.target.value="";}}/>
      </label>}
    </div>
    {carregando&&<p className="mt-3 text-xs text-muted-foreground">Conferindo cadastros existentes...</p>}
    {erro&&<p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 p-3 text-xs text-destructive"><AlertCircle size={15}/>{erro}</p>}
    {resultado&&<p className="mt-3 rounded-lg border p-3 text-xs">{resultado}</p>}
    {base&&<p className="mt-3 text-xs text-muted-foreground">Clínica selecionada confirmada. {base.tutores.length} tutores existentes{tipo==="animais"?" · "+base.animais.length+" animais verificados":""}.</p>}
    {linhas.length>0&&<div className="mt-4 space-y-3">
      <h4 className="text-sm font-semibold">Prévia: {nomeArquivo}</h4>
      <div className="flex flex-wrap gap-3 text-xs"><span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 size={14}/>{novos} novos</span><span>{duplicados} duplicados ignorados</span><span className="text-destructive">{invalidos} inválidos</span></div>
      <div className="max-h-64 overflow-y-auto rounded-lg border">
        {linhas.slice(0,30).map(x=><div key={x.indice} className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-xs last:border-0">
          <span>{x.indice}. {x.dados.nome||"(sem nome)"}</span>
          <span className={x.status==="erro"?"text-destructive":x.status==="duplicado"?"text-muted-foreground":"text-emerald-700"}>{x.motivo}</span>
        </div>)}
      </div>
      {linhas.length>30&&<p className="text-xs text-muted-foreground">Exibindo 30 de {linhas.length} linhas; todas são verificadas.</p>}
      {invalidos>0&&<p className="text-xs text-destructive">Corrija as linhas inválidas no CSV antes de importar.</p>}
      <button type="button" disabled={!podeGerenciar||executando||carregando||!novos||invalidos>0}
        onClick={()=>void executarImportacao()} className="min-h-11 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {executando?"Importando...":"Confirmar importação de "+novos+" registros"}
      </button>
    </div>}
    <p className="mt-3 text-xs text-muted-foreground">Consentimentos de comunicação não são presumidos. Qualquer erro interrompe o lote e informa quantos registros foram efetivamente gravados; não há exclusão automática.</p>
  </section>;
}
