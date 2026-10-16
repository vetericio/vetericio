import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { driveAccessToken, readDriveJson, writeDriveJson } from "@/lib/drive-kv.server";
import { PLANOS_PADRAO } from "@/lib/drive-seed";

const schema=z.object({dados:z.record(z.unknown())});
const DB_PATH=[".oricse","database"];

function texto(v:unknown){return String(v??"").trim();}
function documento(v:unknown){return texto(v).replace(/\D/g,"");}
function numero(v:unknown){const n=Number(v);return Number.isFinite(n)?n:0;}
function brlNumero(valor:string|undefined){if(!valor)return 0;const limpo=valor.replace(/[^\d,.-]/g,"").replace(/\./g,"").replace(",", ".");return numero(limpo);}
function brl(valor:number){return `R$ ${valor.toFixed(2).replace(".",",")}`;}
function upper(v:unknown){return texto(v).toUpperCase().replace(/\s+/g,"-");}

type Plano=Record<string,any>;
type Contratacao=Record<string,any>;
type Promo=Record<string,any>;
type Uso=Record<string,any>;

async function carregarTabela<T>(token:string,nome:string,padrao:T[]=[]){const r=await readDriveJson<T[]>(token,DB_PATH,`${nome}.json`,padrao);return r.value||[];}
async function salvarTabela<T>(token:string,nome:string,rows:T[]){await writeDriveJson(token,DB_PATH,`${nome}.json`,rows);}

async function aplicarPromocao(token:string,dados:Record<string,unknown>,planoCodigo:string,valorBase:number){
  const codigo=upper(dados.promo_codigo);if(!codigo)return{codigo:null,desconto:0,final:valorBase,duracao:null};
  const [promos,usos,contratos]=await Promise.all([carregarTabela<Promo>(token,"oricse_codigos_promocionais"),carregarTabela<Uso>(token,"oricse_codigo_promocional_usos"),carregarTabela<Contratacao>(token,"oricse_contratacoes")]);
  const promo=promos.find((p)=>upper(p.codigo)===codigo&&p.ativo!==false);if(!promo)throw new Error("Código promocional inválido ou inativo.");
  const agora=Date.now();if(promo.valido_de&&new Date(promo.valido_de).getTime()>agora||promo.valido_ate&&new Date(promo.valido_ate).getTime()<agora)throw new Error("Este código promocional está fora do período de validade.");
  if(Array.isArray(promo.planos)&&promo.planos.length&&!promo.planos.includes(planoCodigo))throw new Error("Este código não é válido para o plano selecionado.");
  const usosPromo=usos.filter((u)=>String(u.codigo_id)===String(promo.id));if(promo.limite_usos!=null&&usosPromo.length>=Number(promo.limite_usos))throw new Error("Este código promocional atingiu o limite de usos.");
  const doc=documento(dados.cnpj)||documento(dados.responsavel_cpf);if(doc&&promo.limite_por_documento!=null&&usosPromo.filter((u)=>String(u.documento_normalizado||"")===doc).length>=Number(promo.limite_por_documento))throw new Error("Este documento já atingiu o limite de uso do código.");
  if(promo.somente_primeira_assinatura&&doc&&contratos.some((c)=>!["cancelada","recusada"].includes(String(c.status))&&(documento(c.cnpj)===doc||documento(c.responsavel_cpf)===doc)))throw new Error("Este código é válido somente para a primeira assinatura.");
  const desconto=promo.tipo_desconto==="percentual"?Math.round(valorBase*numero(promo.valor))/100:Math.min(valorBase,numero(promo.valor));
  return{codigo,desconto:Math.max(0,Math.min(valorBase,desconto)),final:Math.max(0,valorBase-desconto),duracao:promo.duracao||"primeiro_mes",promoId:promo.id,documento:doc};
}

function dadosComuns(d:Record<string,unknown>){return{
  clinica_nome:texto(d.clinica_nome),razao_social:texto(d.razao_social)||null,cnpj:documento(d.cnpj)||null,clinica_telefone:texto(d.clinica_telefone)||null,clinica_email:texto(d.clinica_email).toLowerCase()||null,clinica_cep:texto(d.clinica_cep)||null,clinica_endereco:texto(d.clinica_endereco)||null,clinica_numero:texto(d.clinica_numero)||null,clinica_complemento:texto(d.clinica_complemento)||null,clinica_bairro:texto(d.clinica_bairro)||null,clinica_cidade:texto(d.clinica_cidade)||null,clinica_uf:texto(d.clinica_uf)||null,tipo_operacao:texto(d.tipo_operacao)||null,slug_desejado:texto(d.slug_desejado)||null,dominio:texto(d.dominio)||null,responsavel_nome:texto(d.responsavel_nome),responsavel_cpf:documento(d.responsavel_cpf)||null,responsavel_crmv:texto(d.responsavel_crmv)||null,responsavel_crmv_uf:texto(d.responsavel_crmv_uf)||null,responsavel_email:texto(d.responsavel_email).toLowerCase(),responsavel_telefone:texto(d.responsavel_telefone)||null,responsavel_cep:texto(d.responsavel_cep)||null,responsavel_endereco:texto(d.responsavel_endereco)||null,responsavel_numero:texto(d.responsavel_numero)||null,responsavel_complemento:texto(d.responsavel_complemento)||null,responsavel_bairro:texto(d.responsavel_bairro)||null,responsavel_cidade:texto(d.responsavel_cidade)||null,responsavel_uf:texto(d.responsavel_uf)||null,observacoes:texto(d.observacoes)||null,aceitou_termos:true,aceitou_privacidade:true};}
function validarBase(d:Record<string,unknown>){if(d.aceitou_termos!==true||d.aceitou_privacidade!==true)throw new Error("Revise os dados e aceite os termos e a política de privacidade.");if(!texto(d.clinica_nome)||!texto(d.responsavel_nome)||!texto(d.responsavel_email))throw new Error("Informe o nome da clínica e os dados do responsável.");}

export const iniciarContratacaoDrive=createServerFn({method:"POST"}).validator((i:unknown)=>schema.parse(i)).handler(async({data})=>{
  const d=data.dados;validarBase(d);const ciclo=texto(d.ciclo);if(!["mensal","anual"].includes(ciclo))throw new Error("Ciclo de contratação inválido.");
  const token=await driveAccessToken();const planos=await carregarTabela<Plano>(token,"oricse_planos",PLANOS_PADRAO as Plano[]);const plano=planos.find((p)=>p.codigo===texto(d.plano_codigo)&&p.ativo!==false);if(!plano)throw new Error("O plano selecionado não está disponível.");
  const quantidade=Math.max(1,Math.min(10000,Math.trunc(numero(d.quantidade_usuarios)||1)));const incluidos=Math.max(1,Math.min(10000,Number(plano.usuarios_inclusos)||1));const extras=Math.max(0,quantidade-incluidos);const extraMensal=14.9;const adicionalMensal=extras*extraMensal;const base=brlNumero(ciclo==="anual"?plano.preco_anual:plano.preco_mensal);const adicionalCiclo=ciclo==="anual"?adicionalMensal*12:adicionalMensal;const totalSemPromo=Math.round((base+adicionalCiclo)*100)/100;const promo=await aplicarPromocao(token,d,texto(plano.codigo),totalSemPromo);
  const agora=new Date().toISOString(),id=crypto.randomUUID();const row:Contratacao={id,plano_codigo:plano.codigo,plano_nome:plano.nome,ciclo,status:"aguardando_pagamento",...dadosComuns(d),quantidade_usuarios:quantidade,perfis_inclusos:incluidos,perfis_extras:extras,adicional_perfis_mensal:adicionalMensal,adicional_perfis_ciclo:adicionalCiclo,valor_base:base,valor_total:promo.final,valor_exibido:brl(promo.final),promo_codigo:promo.codigo,promo_valor_original:promo.codigo?totalSemPromo:null,promo_desconto:promo.codigo?promo.desconto:null,promo_valor_final:promo.codigo?promo.final:null,promo_duracao:promo.duracao,dados:d,created_at:agora,updated_at:agora};
  const rows=await carregarTabela<Contratacao>(token,"oricse_contratacoes");rows.push(row);await salvarTabela(token,"oricse_contratacoes",rows);
  if(promo.codigo&&promo.promoId){const usos=await carregarTabela<Uso>(token,"oricse_codigo_promocional_usos");usos.push({id:crypto.randomUUID(),codigo_id:promo.promoId,contratacao_id:id,documento_normalizado:promo.documento||null,created_at:agora});await salvarTabela(token,"oricse_codigo_promocional_usos",usos);}
  return{id,status:row.status,valor_exibido:row.valor_exibido,created_at:agora};
});

export const iniciarTesteGratisDrive=createServerFn({method:"POST"}).validator((i:unknown)=>schema.parse(i)).handler(async({data})=>{
  const d=data.dados;validarBase(d);const doc=documento(d.cnpj)||documento(d.responsavel_cpf);if(![11,14].includes(doc.length))throw new Error("Informe um CPF ou CNPJ válido para solicitar o teste.");
  const token=await driveAccessToken();const rows=await carregarTabela<Contratacao>(token,"oricse_contratacoes");if(rows.some((c)=>String(c.documento_teste||"")===doc))throw new Error("Este CPF/CNPJ já foi usado para solicitar um teste gratuito.");
  const agora=new Date().toISOString(),id=crypto.randomUUID();const row:Contratacao={id,plano_codigo:"teste-gratis",plano_nome:"Teste grátis",ciclo:"teste",status:"teste_aguardando_ativacao",...dadosComuns(d),documento_teste:doc,dados:d,created_at:agora,updated_at:agora};rows.push(row);await salvarTabela(token,"oricse_contratacoes",rows);return{id,status:row.status,created_at:agora};
});
