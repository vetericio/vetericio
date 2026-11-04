import { BENEFICIOS_ORICSE, NIVEIS_PLANOS, permitidoNoNivel } from "@/lib/beneficios-oricse";

const AGORA = "2026-10-16T00:00:00.000Z";

export const PLANOS_PADRAO = [
  { id:"3c2a0001-2026-4000-8000-000000000001", codigo:"solo-2026", nome:"Solo", ativo:true, publicado:true, ordem:1, preco:"R$ 49,90", preco_mensal:"R$ 49,90", preco_trimestral:"R$ 139,90", preco_semestral:"R$ 269,90", preco_anual:"R$ 499,00", preco_bienal:"R$ 899,00", publico_alvo:"Veterinários autônomos", descricao:"Para quem atende sozinho e precisa registrar pacientes e emitir documentos clínicos.", dominio_incluso:false, usuarios_inclusos:1, itens:["Até 25 animais","1 usuário","Consultas e prontuários básicos","Receitas, exames e documentos clínicos","Painel e resumo do dia"], created_at:AGORA, updated_at:AGORA },
  { id:"3c2a0002-2026-4000-8000-000000000002", codigo:"essencial-2026", nome:"Essencial", ativo:true, publicado:true, ordem:2, preco:"R$ 79,90", preco_mensal:"R$ 79,90", preco_trimestral:"R$ 229,90", preco_semestral:"R$ 429,90", preco_anual:"R$ 799,00", preco_bienal:"R$ 1.439,00", publico_alvo:"Consultórios e pequenos negócios", descricao:"Para profissionais que precisam de agenda, prontuário completo e financeiro básico.", dominio_incluso:false, usuarios_inclusos:1, itens:["Até 200 animais","1 usuário","Tudo do Solo","Agenda básica e prontuário completo","Calculadora de medicações e Portal do Tutor"], created_at:AGORA, updated_at:AGORA },
  { id:"3c2a0003-2026-4000-8000-000000000003", codigo:"profissional-2026", nome:"Profissional", ativo:true, publicado:true, ordem:3, preco:"R$ 119,90", preco_mensal:"R$ 119,90", preco_trimestral:"R$ 339,90", preco_semestral:"R$ 649,90", preco_anual:"R$ 1.199,00", preco_bienal:"R$ 2.159,00", publico_alvo:"Clínicas veterinárias, pet shops, Banho e Tosa e Hotelzinho", descricao:"Operação completa para equipes, internação, estoque, RH e todos os serviços pet.", dominio_incluso:false, usuarios_inclusos:3, destaque:true, itens:["Até 1.000 animais","3 usuários","Tudo do Essencial","Internação, Banho e Tosa e Hotelzinho","Estoque, Financeiro, RH, ponto e comissões"], created_at:AGORA, updated_at:AGORA },
  { id:"3c2a0004-2026-4000-8000-000000000004", codigo:"master-2026", nome:"Master", ativo:true, publicado:true, ordem:4, preco:"R$ 199,90", preco_mensal:"R$ 199,90", preco_trimestral:"R$ 569,90", preco_semestral:"R$ 1.079,90", preco_anual:"R$ 1.999,00", preco_bienal:"R$ 3.599,00", publico_alvo:"Negócios que precisam de todos os recursos e personalização", descricao:"Tudo do Profissional com CRM avançado, campanhas, relatórios e personalização.", dominio_incluso:true, usuarios_inclusos:5, itens:["Animais ilimitados","5 usuários","Tudo do Profissional","CRM avançado, campanhas e automações","Domínio personalizado e personalização sob medida","Fidelidade mínima de 12 meses"], created_at:AGORA, updated_at:AGORA },

];

export const FUNCIONALIDADES_PADRAO = [
  ["atividade.ponto","Registro de atividade e ponto","Atividade",10],["recepcao.agenda","Agenda e fila de espera","Recepção",20],["recepcao.cadastros","Cadastro de tutores e animais","Recepção",21],["consultorio.atendimentos","Consultas e prontuários","Consultório",30],["consultorio.medicacoes","Calculadora de medicações","Consultório",31],["consultorio.receituario","Receituário","Consultório",32],["internacao.painel","Painel de internação","Internação",40],["internacao.medicacoes","Medicações na internação","Internação",41],["internacao.plantoes","Plantões e histórico","Internação",42],["caixa.financeiro","Financeiro e caixa","Caixa",50],["caixa.comandas","Comandas","Caixa",51],["estoque.catalogo","Catálogo de produtos e serviços","Estoque",60],["estoque.movimentar","Movimentações de estoque","Estoque",61],["equipe.pagamentos","Pagamento da equipe","Equipe",70],["crm.inteligente","CRM inteligente","CRM",75],["administracao.site","Site da clínica","Administração",80],["administracao.temas","Temas","Administração",81],["hotelzinho.modulo","Hotelzinho","Hotelzinho",85],["portal_tutor.acesso","Portal do tutor","Portal do tutor",89],["portal_tutor.agendamento_online","Agendamento online do tutor","Portal do tutor",90],
].map(([codigo,nome,grupo,ordem])=>({codigo,nome,grupo,ordem,ativo:true}));

export const BENEFICIOS_CATALOGO = BENEFICIOS_ORICSE.map(b => ({ codigo:b.codigo, nome:b.nome, grupo:b.grupo, ordem:b.ordem, ativo:true }));

const PERMISSOES = [
  ["atividade.ponto","Ponto e atividade","Atividade","Registrar e consultar a própria jornada.","atividade.ponto",10],
  ["recepcao.agenda","Agenda e fila","Recepção","Visualizar e operar agenda e fila de espera.","recepcao.agenda",20],
  ["recepcao.cadastros.visualizar","Ver tutores e animais","Recepção","Consultar cadastros de tutores e animais.","recepcao.cadastros",21],
  ["recepcao.cadastros.criar","Cadastrar tutores e animais","Recepção","Criar novos tutores e animais.","recepcao.cadastros",22],
  ["recepcao.cadastros.editar","Editar tutores e animais","Recepção","Alterar cadastros existentes.","recepcao.cadastros",23],
  ["recepcao.cadastros.excluir","Excluir tutores e animais","Recepção","Excluir cadastros da clínica.","recepcao.cadastros",24],
  ["consultorio.atendimentos","Consultas e prontuários","Consultório","Acessar consultas e prontuários.","consultorio.atendimentos",30],
  ["consultorio.medicacoes","Calculadora de medicações","Consultório","Acessar ferramentas de cálculo de medicações.","consultorio.medicacoes",31],
  ["consultorio.receituario","Receituário e assinatura","Consultório","Emitir receitas e assinar documentos.","consultorio.receituario",32],
  ["internacao.painel","Painel de internação","Internação","Visualizar animais internados e painel clínico.","internacao.painel",40],
  ["internacao.registrar","Registrar evolução e parâmetros","Internação","Registrar observações, parâmetros e evolução.","internacao.painel",41],
  ["internacao.medicacoes","Medicações da internação","Internação","Acessar e registrar medicações da internação.","internacao.medicacoes",42],
  ["internacao.plantoes","Plantões e históricos","Internação","Abrir, finalizar e consultar plantões e históricos.","internacao.plantoes",43],
  ["caixa.financeiro.visualizar","Ver financeiro","Caixa","Consultar financeiro e caixa.","caixa.financeiro",50],
  ["caixa.financeiro.gerenciar","Gerenciar financeiro","Caixa","Realizar lançamentos e alterações financeiras.","caixa.financeiro",51],
  ["caixa.comandas","Comandas","Caixa","Visualizar e operar comandas.","caixa.comandas",52],
  ["estoque.catalogo.visualizar","Ver produtos e serviços","Estoque","Consultar catálogo de produtos e serviços.","estoque.catalogo",60],
  ["estoque.catalogo.gerenciar","Gerenciar produtos e serviços","Estoque","Cadastrar, editar e excluir itens do catálogo.","estoque.catalogo",61],
  ["estoque.movimentar","Movimentar estoque","Estoque","Registrar entradas, saídas e ajustes de estoque.","estoque.movimentar",62],
  ["equipe.pagamentos.visualizar","Ver pagamentos da equipe","Equipe","Consultar pagamentos e remunerações da equipe.","equipe.pagamentos",70],
  ["equipe.pagamentos.gerenciar","Gerenciar pagamentos da equipe","Equipe","Configurar remuneração, comissão e lançamentos da equipe.","equipe.pagamentos",71],
  ["crm.visualizar","Ver CRM e lembretes","CRM","Consultar fila de relacionamento e histórico de contatos.","crm.inteligente",75],
  ["crm.enviar","Operar contatos do CRM","CRM","Criar, editar e concluir contatos e lembretes do CRM.","crm.inteligente",76],
  ["crm.gerenciar","Configurar CRM","CRM","Editar regras, prazos e modelos de mensagens do CRM.","crm.inteligente",77],
  ["administracao.configuracoes","Configurações da clínica","Administração","Alterar configurações operacionais da clínica.",null,80],
  ["administracao.site","Site da clínica","Administração","Configurar site e domínio da clínica.","administracao.site",81],
  ["administracao.temas","Temas","Administração","Alterar aparência e temas.","administracao.temas",82],
  ["administracao.usuarios","Usuários da clínica","Administração","Criar, desativar e alterar cargos de usuários.",null,83],
  ["administracao.permissoes","Permissões dos usuários","Administração","Conceder ou retirar permissões individuais.",null,84],
  ["hotelzinho.visualizar","Visualizar hotelzinho","Hotelzinho","Consultar reservas e ocupação.","hotelzinho.modulo",85],
  ["hotelzinho.operar","Operar hospedagens","Hotelzinho","Realizar check-in, check-out e registrar cuidados.","hotelzinho.modulo",86],
  ["hotelzinho.gerenciar","Gerenciar hotelzinho","Hotelzinho","Administrar reservas e configurações do hotelzinho.","hotelzinho.modulo",87],
  ["portal_tutor.gerenciar","Gerenciar portal do tutor","Portal do tutor","Ativar acessos, emitir convites e administrar o portal dos tutores da clínica.","portal_tutor.acesso",89],
] as const;
export const PERMISSOES_PADRAO=PERMISSOES.map(([codigo,nome,grupo,descricao,funcionalidade_codigo,ordem])=>({codigo,nome,grupo,descricao,funcionalidade_codigo,ordem,ativo:true}));
// Apenas estas 33 permissões anteriores à central preservam herança histórica.
// Novas permissões devem nascer pendentes (não liberadas).
export const ACOES_LEGADAS = new Set(["atividade.ponto","recepcao.agenda","recepcao.cadastros.visualizar","recepcao.cadastros.criar","recepcao.cadastros.editar","recepcao.cadastros.excluir","consultorio.atendimentos","consultorio.medicacoes","consultorio.receituario","internacao.painel","internacao.registrar","internacao.medicacoes","internacao.plantoes","caixa.financeiro.visualizar","caixa.financeiro.gerenciar","caixa.comandas","estoque.catalogo.visualizar","estoque.catalogo.gerenciar","estoque.movimentar","equipe.pagamentos.visualizar","equipe.pagamentos.gerenciar","crm.visualizar","crm.enviar","crm.gerenciar","administracao.configuracoes","administracao.site","administracao.temas","administracao.usuarios","administracao.permissoes","hotelzinho.visualizar","hotelzinho.operar","hotelzinho.gerenciar","portal_tutor.gerenciar"]);

export const ACOES_PADRAO = PERMISSOES_PADRAO.map((p) => ({
  codigo: "acao." + String(p.codigo),
  nome: String(p.nome),
  grupo: String(p.grupo),
  ordem: Number(p.ordem) * 10 + 1,
  ativo: true,
}));


const ADMIN=[...PERMISSOES_PADRAO.map(p=>p.codigo)];
export const PERMITIDAS_POR_PAPEL:Record<string,string[]>={
  responsavel:ADMIN, admin_clinica:ADMIN, rt:ADMIN,
  usuario:["atividade.ponto"],
  auxiliar_estagiario:["atividade.ponto","internacao.medicacoes","internacao.painel","internacao.registrar","recepcao.agenda"],
  recepcao:["atividade.ponto","caixa.comandas","caixa.financeiro.gerenciar","caixa.financeiro.visualizar","crm.enviar","crm.visualizar","estoque.catalogo.visualizar","portal_tutor.gerenciar","recepcao.agenda","recepcao.cadastros.criar","recepcao.cadastros.editar","recepcao.cadastros.visualizar"],
  veterinario:["atividade.ponto","consultorio.atendimentos","consultorio.medicacoes","consultorio.receituario","crm.visualizar","internacao.medicacoes","internacao.painel","internacao.plantoes","internacao.registrar","recepcao.agenda","recepcao.cadastros.visualizar"],
};
export const PERMISSOES_PAPEL_PADRAO=Object.entries(PERMITIDAS_POR_PAPEL).flatMap(([papel,permitidas])=>PERMISSOES_PADRAO.map(p=>({papel,permissao_codigo:p.codigo,permitido:permitidas.includes(p.codigo)})));

const BASE_2026 = ["administracao.temas","consultorio.atendimentos","consultorio.receituario","recepcao.cadastros"];
const ESSENCIAL_2026 = [...BASE_2026,"recepcao.agenda","consultorio.medicacoes","caixa.financeiro","portal_tutor.acesso"];
const PROFISSIONAL_2026 = [...ESSENCIAL_2026,"internacao.painel","internacao.medicacoes","internacao.plantoes","caixa.comandas","estoque.catalogo","estoque.movimentar","atividade.ponto","equipe.pagamentos","crm.inteligente","administracao.site","hotelzinho.modulo","portal_tutor.agendamento_online"];
export const FUNCIONALIDADES_POR_PLANO:Record<string,string[]>={
  "solo-2026":BASE_2026,
  "essencial-2026":ESSENCIAL_2026,
  "profissional-2026":PROFISSIONAL_2026,
  "master-2026":FUNCIONALIDADES_PADRAO.map(f=>String(f.codigo)),

};
export const PLANO_FUNCIONALIDADES_PADRAO=PLANOS_PADRAO.flatMap(plano=>[
  ...FUNCIONALIDADES_PADRAO.map(f=>({plano_id:plano.id,funcionalidade_codigo:String(f.codigo),permitido:FUNCIONALIDADES_POR_PLANO[plano.codigo]?.includes(String(f.codigo))||false})),
  ...PERMISSOES_PADRAO.map(p=>({plano_id:plano.id,funcionalidade_codigo:"acao."+String(p.codigo),
    permitido:ACOES_LEGADAS.has(String(p.codigo)) &&
      (!NIVEIS_PLANOS.includes(plano.codigo as any) || !["administracao.usuarios","administracao.permissoes"].includes(String(p.codigo)) || NIVEIS_PLANOS.indexOf(plano.codigo as any) >= 2) &&
      (!p.funcionalidade_codigo || Boolean(FUNCIONALIDADES_POR_PLANO[plano.codigo]?.includes(String(p.funcionalidade_codigo))))})),
  ...BENEFICIOS_CATALOGO.map(b=>({plano_id:plano.id,funcionalidade_codigo:b.codigo,
    permitido: NIVEIS_PLANOS.includes(plano.codigo as any)
      ? permitidoNoNivel(b.codigo,NIVEIS_PLANOS.indexOf(plano.codigo as any))
      : true})),

]);

export const CLINICAS_PADRAO=[
  {id:"d9efe5af-3bf6-4230-ac1e-62249a88c155",nome:"Vetericio",slug:"vetericio",status:"ativa",plano:"Master (Equipe)",logo_url:"https://lh3.googleusercontent.com/d/1c_NPgVwvK7lgrhCNDFKoWNJxNpqkAA4K",dominio:null,limite_usuarios:5,duracao_padrao_atendimento_min:30,duracoes_atendimento_min:{Vacina:30,Retorno:30,Cirurgia:120,Consulta:30,"Banho e Tosa":60,Procedimento:30},created_at:AGORA,updated_at:AGORA},
  {id:"b2248b47-f22e-474b-a67c-f3f4326f2450",nome:"Oricse — Clínica de Testes",slug:"oricse-clinica-testes-isolamento",status:"ativa",plano:"Master (Equipe)",logo_url:null,dominio:null,limite_usuarios:5,duracao_padrao_atendimento_min:30,duracoes_atendimento_min:{Vacina:30,Retorno:30,Cirurgia:120,Consulta:30,"Banho e Tosa":60,Procedimento:30},created_at:AGORA,updated_at:AGORA},
];

// O journal exige ID estável para aplicar patches. Linhas iniciais de
// matrizes/permissões não tinham ID e desapareciam ao hidratar o estado.
// Este identificador é determinístico e usado só nas linhas de seed do Drive.
function idEstavelSeed(nome: string, registro: Record<string, unknown>, indice: number) {
  const base = nome + ":" + String(registro.codigo || registro.chave || registro.funcionalidade_codigo || "") +
    ":" + String(registro.plano_id || registro.papel || "") + ":" + indice;
  const partes = [2166136261, 2246822519, 3266489917, 668265263];
  for (let i = 0; i < base.length; i++) {
    for (let p = 0; p < 4; p++) {
      partes[p] = Math.imul((partes[p] ^ base.charCodeAt(i) ^ (p * 257)) >>> 0, 16777619) >>> 0;
    }
  }
  const hex = partes.map((valor) => valor.toString(16).padStart(8, "0")).join("");
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-4" + hex.slice(13, 16) +
    "-8" + hex.slice(17, 20) + "-" + hex.slice(20, 32);
}
function comIds(nome: string, lista: any[]): any[] {
  return lista.map((item, indice) => item.id != null ? item :
    { ...item, id: idEstavelSeed(nome, item, indice) });
}

export function seedTabela(nome:string):any[]{
  switch(nome){
    case "oricse_planos": return structuredClone(PLANOS_PADRAO);
    case "oricse_funcionalidades": return comIds(nome,structuredClone([...FUNCIONALIDADES_PADRAO,...ACOES_PADRAO,...BENEFICIOS_CATALOGO]));
    case "oricse_permissoes": return comIds(nome,structuredClone(PERMISSOES_PADRAO));
    case "oricse_permissoes_papel": return comIds(nome,structuredClone(PERMISSOES_PAPEL_PADRAO));
    case "oricse_plano_funcionalidades": return comIds(nome,structuredClone(PLANO_FUNCIONALIDADES_PADRAO));
    case "oricse_planos_auditoria": return [];
    case "clinicas": return structuredClone(CLINICAS_PADRAO);
    case "oricse_config": return comIds(nome,[{chave:"site_publico",valor:{marca:"Oricse",contato:"",logo_url:"",cta_plano:"Escolher plano",titulo_planos:"Escolha o plano ideal para sua clínica",subtitulo_planos:"Organize atendimento, internação, prontuários, financeiro e estoque em um só sistema."},updated_at:AGORA}]);
    default:return [];
  }
}
