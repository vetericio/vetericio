import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardCheck, Plus, Save, Trash2, Upload, Wrench } from "lucide-react";
import { toast } from "sonner";
import { oricseStorage, hidratarOricseStorage, descarregarOricseStorage } from "@/lib/oricse-storage";

const CHAVE = "oricse-modulos-administrativos-v3";
type Equipamento = { id:string; nome:string; setor:string; patrimonio:string; proximaManutencao:string; status:"operante"|"manutencao"|"fora_de_uso"; observacoes:string };
type Pendencia = {id:string; titulo:string; responsavel:string; prazo:string; prioridade:"baixa"|"media"|"alta"; status:"aberta"|"em_andamento"|"concluida"; observacoes:string};
type Especie = {id:string; nome:string; instrucoes:string};
type Indicadores = {consultas:boolean;exames:boolean;internacao:boolean;hotel:boolean;banhoTosa:boolean;vendaExpressa:boolean;receita:boolean;despesas:boolean};
type Estado = {
 versao:1; equipamentos:Equipamento[]; pendencias:Pendencia[]; especies:Especie[];
 contingencia:{responsavel:string;telefone:string;orientacoes:string;ultimaRevisao:string};
 indicadores:Indicadores;
};
const PADRAO:Estado = {
 versao:1,equipamentos:[],pendencias:[],especies:[],
 contingencia:{responsavel:"",telefone:"",orientacoes:"",ultimaRevisao:""},
 indicadores:{consultas:true,exames:true,internacao:true,hotel:true,banhoTosa:true,vendaExpressa:true,receita:true,despesas:true},
};
const copia=(x:Estado)=>JSON.parse(JSON.stringify(x)) as Estado;
function lerEstado():Estado {
 const bruto=oricseStorage.getItem(CHAVE);
 if(!bruto)return copia(PADRAO);
 const e=JSON.parse(bruto) as Estado;
 if(e.versao!==1 || !Array.isArray(e.equipamentos) || !Array.isArray(e.pendencias) || !Array.isArray(e.especies) || !e.contingencia || !e.indicadores)throw new Error("Dados administrativos inconsistentes. Nada será substituído automaticamente.");
 return e;
}
function campo(label:string,value:string,onChange:(v:string)=>void,disabled:boolean,maxLength=100,type="text"){
 return <label className="block text-xs font-medium">{label}<input value={value} maxLength={maxLength} type={type} disabled={disabled}
  onChange={e=>onChange(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-card px-3 text-sm disabled:opacity-50"/></label>;
}
function titulo(texto:string,subtitulo:string){
 return <div className="mb-3"><h3 className="text-sm font-semibold">{texto}</h3><p className="mt-1 text-xs text-muted-foreground">{subtitulo}</p></div>;
}
export function ModulosAdministrativosClinica({grupo, podeGerenciar}:{grupo:"estrutura"|"operacao"|"personalizacao"|"administracao";podeGerenciar:boolean}){
 const [estado,setEstado]=useState<Estado>(copia(PADRAO));
 const [confirmado,setConfirmado]=useState<Estado>(copia(PADRAO));
 const [carregando,setCarregando]=useState(true),[salvando,setSalvando]=useState(false),[erro,setErro]=useState("");
 const [filtro,setFiltro]=useState<"todos"|"abertos"|"concluidos">("todos");
 const [importacao,setImportacao]=useState<Omit<Equipamento,"id">[]>([]);
 const [arquivoImportacao,setArquivoImportacao]=useState("");
 useEffect(()=>{
  let ativo=true;
  void (async()=>{try{await hidratarOricseStorage();const e=lerEstado();if(ativo){setEstado(e);setConfirmado(copia(e));}}
   catch(e){if(ativo)setErro(e instanceof Error?e.message:"Não foi possível carregar dados.");}
   finally{if(ativo)setCarregando(false);}})();
  return ()=>{ativo=false;};
 },[]);
 const alterado=useMemo(()=>JSON.stringify(estado)!==JSON.stringify(confirmado),[estado,confirmado]);
 const pendencias=useMemo(()=>estado.pendencias.filter(p=>filtro==="todos"||(filtro==="abertos"?p.status!=="concluida":p.status==="concluida")),[estado.pendencias,filtro]);
 function mudarEquip(id:string,patch:Partial<Equipamento>){setEstado(s=>({...s,equipamentos:s.equipamentos.map(x=>x.id===id?{...x,...patch}:x)}));}
 function mudarPend(id:string,patch:Partial<Pendencia>){setEstado(s=>({...s,pendencias:s.pendencias.map(x=>x.id===id?{...x,...patch}:x)}));}
 function mudarEspecie(id:string,patch:Partial<Especie>){setEstado(s=>({...s,especies:s.especies.map(x=>x.id===id?{...x,...patch}:x)}));}
 function remover(tipo:"equipamentos"|"pendencias"|"especies",id:string){if(!window.confirm("Excluir este registro? A exclusão somente será efetiva após salvar."))return;
  setEstado(s=>({...s,[tipo]:s[tipo].filter(x=>x.id!==id)}));}
 function lerCsv(texto:string):string[][]{
  // CSV com separador ponto e vírgula, aspas duplas e escape por aspas repetidas.
  const linhas:string[][]=[];let linha:string[]=[],campo="",emAspas=false;
  for(let i=0;i<texto.length;i++){
    const ch=texto[i];
    if(ch==='"'){
      if(emAspas && texto[i+1]==='"'){campo+='"';i++;}
      else emAspas=!emAspas;
    }else if(ch===';'&&!emAspas){linha.push(campo);campo="";}
    else if((ch==='\n'||ch==='\r')&&!emAspas){
      if(ch==='\r'&&texto[i+1]==='\n')i++;
      linha.push(campo);campo="";
      if(linha.some(x=>x.trim()))linhas.push(linha);
      linha=[];
    }else campo+=ch;
  }
  if(emAspas)throw new Error("CSV com aspas não fechadas.");
  linha.push(campo);if(linha.some(x=>x.trim()))linhas.push(linha);
  return linhas;
 }
 async function prepararEquipamentos(file?:File){
  if(!file||!podeGerenciar)return;
  if(!file.name.toLowerCase().endsWith(".csv")||file.size>120000||file.size<5)return toast.error("Use um arquivo .csv de até 120 KB.");
  try{
    const rows=lerCsv((await file.text()).replace(/^\uFEFF/,""));
    if(rows.length<2||rows.length>251)throw new Error("O CSV deve ter cabeçalho e até 250 equipamentos.");
    const headers=rows[0].map(x=>x.trim().toLowerCase());
    const required=["nome","setor","patrimonio","proxima_manutencao","status","observacoes"];
    if(required.some(k=>!headers.includes(k)))throw new Error("Colunas obrigatórias: "+required.join("; "));
    const visto=new Set(estado.equipamentos.filter(x=>x.patrimonio.trim()).map(x=>x.patrimonio.trim().toLowerCase()));
    const arr:Omit<Equipamento,"id">[]=[];
    for(const [i,row] of rows.slice(1).entries()){
      const get=(k:string)=>String(row[headers.indexOf(k)]||"").trim();
      const nome=get("nome"),setor=get("setor"),patrimonio=get("patrimonio");
      const data=get("proxima_manutencao"),status=get("status")||"operante";
      const observacoes=get("observacoes");
      if(nome.length<2||nome.length>100||setor.length<2||setor.length>80||patrimonio.length>80||
        observacoes.length>600||(!["operante","manutencao","fora_de_uso"].includes(status))||
        (data!==""&&!/^\d{4}-\d{2}-\d{2}$/.test(data)))throw new Error("Linha "+(i+2)+" contém dados inválidos.");
      const chave=patrimonio.toLowerCase();
      if(chave&&visto.has(chave))continue;
      if(chave)visto.add(chave);
      arr.push({nome,setor,patrimonio,proximaManutencao:data,status:status as Equipamento["status"],observacoes});
    }
    if(!arr.length)throw new Error("Nenhum equipamento novo. Os patrimônios informados já existem.");
    if(estado.equipamentos.length+arr.length>250)throw new Error("O limite de 250 equipamentos seria ultrapassado.");
    setImportacao(arr);setArquivoImportacao(file.name);
  }catch(e){setImportacao([]);toast.error(e instanceof Error?e.message:"Não foi possível ler o CSV.");}
 }
 function aplicarImportacao(){
  if(!podeGerenciar||!importacao.length)return;
  setEstado(s=>({...s,equipamentos:[...s.equipamentos,...importacao.map(e=>({...e,id:crypto.randomUUID()}))]}));
  setImportacao([]);
  toast.info("Itens adicionados para revisão. Clique em Salvar módulo para confirmar.");
 }
 async function salvar(){
  if(!podeGerenciar||salvando||!alterado)return;
  if(estado.equipamentos.some(x=>!x.nome.trim()||!x.setor.trim())||estado.pendencias.some(x=>!x.titulo.trim())||estado.especies.some(x=>!x.nome.trim()))return toast.error("Preencha os campos obrigatórios antes de salvar.");
  setSalvando(true);
  try{oricseStorage.setItem(CHAVE,JSON.stringify(estado));await descarregarOricseStorage();setConfirmado(copia(estado));toast.success("Módulos salvos e confirmados no servidor.");}
  catch(e){toast.error(e instanceof Error?e.message:"Falha ao salvar. Nenhum sucesso foi confirmado.");}
  finally{setSalvando(false);}
 }
 if(carregando)return <p className="mt-4 rounded-lg border p-3 text-xs text-muted-foreground">Carregando módulos administrativos...</p>;
 if(erro)return <p role="alert" className="mt-4 rounded-lg border border-destructive p-3 text-xs text-destructive">{erro}</p>;
 return <section className="mt-5 rounded-xl border bg-background p-4 sm:p-5">
  {grupo==="estrutura"&&<>
   {titulo("Central de pendências e aprovações","Registre responsáveis, prazos e prioridades. Não executa pagamentos ou aprovações financeiras automaticamente.")}
   <div className="mb-3 flex flex-wrap gap-2">
    {(["todos","abertos","concluidos"] as const).map(k=><button type="button" key={k} onClick={()=>setFiltro(k)}
     className={"rounded-lg border px-3 py-2 text-xs font-semibold "+(filtro===k?"bg-primary text-primary-foreground":"")}>{k==="todos"?"Todas":k==="abertos"?"Pendentes":"Concluídas"}</button>)}
    <span className="ml-auto text-xs text-muted-foreground">{estado.pendencias.filter(x=>x.status!=="concluida").length} pendentes</span>
   </div>
   <div className="space-y-3">{pendencias.map(p=><div key={p.id} className="rounded-lg border p-3">
    <div className="grid gap-3 sm:grid-cols-2">
     {campo("Tarefa *",p.titulo,v=>mudarPend(p.id,{titulo:v}),!podeGerenciar,140)}
     {campo("Responsável",p.responsavel,v=>mudarPend(p.id,{responsavel:v}),!podeGerenciar)}
     {campo("Prazo",p.prazo,v=>mudarPend(p.id,{prazo:v}),!podeGerenciar,10,"date")}
     <label className="text-xs font-medium">Prioridade<select value={p.prioridade} disabled={!podeGerenciar} onChange={e=>mudarPend(p.id,{prioridade:e.target.value as Pendencia["prioridade"]})} className="mt-1 min-h-10 w-full rounded-lg border bg-card px-3"><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option></select></label>
     <label className="text-xs font-medium">Status<select value={p.status} disabled={!podeGerenciar} onChange={e=>mudarPend(p.id,{status:e.target.value as Pendencia["status"]})} className="mt-1 min-h-10 w-full rounded-lg border bg-card px-3"><option value="aberta">Aberta</option><option value="em_andamento">Em andamento</option><option value="concluida">Concluída</option></select></label>
     {campo("Observações",p.observacoes,v=>mudarPend(p.id,{observacoes:v}),!podeGerenciar,800)}
    </div>
    {podeGerenciar&&<button type="button" onClick={()=>remover("pendencias",p.id)} className="mt-2 inline-flex items-center gap-1 text-xs text-destructive"><Trash2 size={14}/> Excluir tarefa</button>}
   </div>)}</div>
   {podeGerenciar&&<button type="button" onClick={()=>{if(estado.pendencias.length>=400)return toast.error("Limite de 400 pendências.");setEstado(s=>({...s,pendencias:[...s.pendencias,{id:crypto.randomUUID(),titulo:"Nova tarefa",responsavel:"",prazo:"",prioridade:"media",status:"aberta",observacoes:""}]}));}} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold"><Plus size={16}/> Adicionar tarefa</button>}
  </>}
  {grupo==="operacao"&&<>
   {titulo("Equipamentos, manutenção e calibração","Inventário administrativo com status e data prevista. Não substitui controle técnico ou laudo de calibração.")}
   <div className="space-y-3">{estado.equipamentos.map(e=><div key={e.id} className="rounded-lg border p-3">
    <div className="grid gap-3 sm:grid-cols-2">
     {campo("Equipamento *",e.nome,v=>mudarEquip(e.id,{nome:v}),!podeGerenciar)}
     {campo("Setor *",e.setor,v=>mudarEquip(e.id,{setor:v}),!podeGerenciar,80)}
     {campo("Patrimônio ou série",e.patrimonio,v=>mudarEquip(e.id,{patrimonio:v}),!podeGerenciar,80)}
     {campo("Próxima manutenção",e.proximaManutencao,v=>mudarEquip(e.id,{proximaManutencao:v}),!podeGerenciar,10,"date")}
     <label className="text-xs font-medium">Situação<select value={e.status} disabled={!podeGerenciar} onChange={x=>mudarEquip(e.id,{status:x.target.value as Equipamento["status"]})} className="mt-1 min-h-10 w-full rounded-lg border bg-card px-3"><option value="operante">Operante</option><option value="manutencao">Manutenção</option><option value="fora_de_uso">Fora de uso</option></select></label>
     {campo("Observações",e.observacoes,v=>mudarEquip(e.id,{observacoes:v}),!podeGerenciar,600)}
    </div>
    {e.proximaManutencao && e.proximaManutencao < new Date().toISOString().slice(0,10) && e.status!=="fora_de_uso" && <p className="mt-2 flex items-center gap-1 text-xs text-amber-700"><AlertTriangle size={14}/> Manutenção prevista vencida</p>}
    {podeGerenciar&&<button type="button" onClick={()=>remover("equipamentos",e.id)} className="mt-2 inline-flex items-center gap-1 text-xs text-destructive"><Trash2 size={14}/> Remover equipamento</button>}
   </div>)}</div>
   {podeGerenciar&&<div className="mt-3 rounded-lg border border-dashed p-3">
     <p className="text-xs font-semibold">Importar equipamentos (CSV)</p>
     <p className="my-2 text-xs text-muted-foreground">Colunas separadas por ponto e vírgula: nome; setor; patrimonio; proxima_manutencao; status; observacoes. Valores de status: operante, manutencao ou fora_de_uso. Patrimônios repetidos são ignorados.</p>
     <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs font-semibold"><Upload size={15}/> Selecionar CSV
      <input type="file" accept=".csv,text/csv" className="sr-only" onChange={e=>{void prepararEquipamentos(e.target.files?.[0]);e.target.value="";}}/>
     </label>
     {importacao.length>0&&<div className="mt-3 rounded-md border p-3">
       <p className="text-xs font-semibold">{arquivoImportacao}: {importacao.length} equipamentos novos</p>
       <p className="mt-1 text-xs text-muted-foreground">Prévia: {importacao.slice(0,5).map(x=>x.nome+" ("+x.setor+")").join(" · ")}</p>
       <button type="button" onClick={aplicarImportacao} className="mt-3 min-h-10 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">Adicionar para revisão</button>
       <button type="button" onClick={()=>setImportacao([])} className="ml-2 min-h-10 rounded-md border px-3 text-xs">Cancelar</button>
     </div>}
   </div>}
   {!estado.equipamentos.length&&<p className="text-xs text-muted-foreground">Nenhum equipamento cadastrado.</p>}
   {podeGerenciar&&<button type="button" onClick={()=>{if(estado.equipamentos.length>=250)return toast.error("Limite de 250 equipamentos.");setEstado(s=>({...s,equipamentos:[...s.equipamentos,{id:crypto.randomUUID(),nome:"Novo equipamento",setor:"Consultório",patrimonio:"",proximaManutencao:"",status:"operante",observacoes:""}]}));}} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold"><Wrench size={15}/> Adicionar equipamento</button>}
   <div className="mt-5 border-t pt-4">
    {titulo("Protocolos por espécie","Orientações administrativas para consulta. A aplicação no prontuário exige validação do responsável técnico.")}
    <div className="space-y-3">{estado.especies.map(e=><div key={e.id} className="rounded-lg border p-3">
     {campo("Espécie *",e.nome,v=>mudarEspecie(e.id,{nome:v}),!podeGerenciar,80)}
     <label className="mt-2 block text-xs font-medium">Orientações<textarea rows={3} maxLength={1400} disabled={!podeGerenciar} value={e.instrucoes} onChange={x=>mudarEspecie(e.id,{instrucoes:x.target.value})} className="mt-1 w-full rounded-lg border bg-card p-3 text-sm"/></label>
     {podeGerenciar&&<button type="button" onClick={()=>remover("especies",e.id)} className="mt-2 text-xs text-destructive">Remover</button>}
    </div>)}</div>
    {podeGerenciar&&<button type="button" onClick={()=>{if(estado.especies.length>=100)return toast.error("Limite de 100 espécies.");setEstado(s=>({...s,especies:[...s.especies,{id:crypto.randomUUID(),nome:"Outra espécie",instrucoes:""}]}));}} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold"><Plus size={15}/> Adicionar espécie</button>}
   </div>
  </>}
  {grupo==="personalizacao"&&<>
   {titulo("Indicadores do painel","Escolha quais setores devem aparecer no resumo gerencial. Preferência salva para integração aos dashboards.")}
   <div className="grid gap-3 sm:grid-cols-2">{([
    ["consultas","Consultas"],["exames","Exames"],["internacao","Internação"],["hotel","Hotelzinho"],
    ["banhoTosa","Banho e tosa"],["vendaExpressa","Venda Expressa"],["receita","Receita"],["despesas","Despesas"],
   ] as const).map(([k,n])=><label key={k} className="flex items-center gap-2 rounded-lg border px-3 py-3 text-sm">
    <input type="checkbox" disabled={!podeGerenciar} checked={estado.indicadores[k]} onChange={e=>setEstado(s=>({...s,indicadores:{...s.indicadores,[k]:e.target.checked}}))} className="h-4 w-4 accent-primary"/>{n}
   </label>)}</div>
  </>}
  {grupo==="administracao"&&<>
   {titulo("Plano de contingência","Registre contatos e procedimentos de resposta a indisponibilidade. Não constitui backup automático nem plano de recuperação testado.")}
   <div className="grid gap-3 sm:grid-cols-2">
    {campo("Responsável",estado.contingencia.responsavel,v=>setEstado(s=>({...s,contingencia:{...s.contingencia,responsavel:v}})),!podeGerenciar)}
    {campo("Telefone de emergência",estado.contingencia.telefone,v=>setEstado(s=>({...s,contingencia:{...s.contingencia,telefone:v}})),!podeGerenciar,60)}
    {campo("Última revisão",estado.contingencia.ultimaRevisao,v=>setEstado(s=>({...s,contingencia:{...s.contingencia,ultimaRevisao:v}})),!podeGerenciar,10,"date")}
   </div>
   <label className="mt-3 block text-xs font-medium">Procedimentos de contingência<textarea rows={7} maxLength={4000} disabled={!podeGerenciar} value={estado.contingencia.orientacoes} onChange={e=>setEstado(s=>({...s,contingencia:{...s.contingencia,orientacoes:e.target.value}}))} className="mt-1 w-full rounded-lg border bg-card p-3 text-sm"/></label>
   <p className="mt-2 text-xs text-muted-foreground">Não inclua senhas, tokens ou dados pessoais sensíveis neste campo.</p>
  </>}
  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
   <span className="flex items-center gap-1 text-xs text-muted-foreground"><ClipboardCheck size={14}/>{alterado?"Alterações pendentes de salvamento":"Dados atualizados"}</span>
   <button type="button" disabled={!podeGerenciar||salvando||!alterado} onClick={()=>void salvar()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"><Save size={15}/>{salvando?"Salvando...":"Salvar módulo"}</button>
  </div>
 </section>;
}
