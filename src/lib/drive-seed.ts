const AGORA = "2026-10-16T00:00:00.000Z";

export const PLANOS_PADRAO = [
  { id:"f54385a7-954e-4c8f-977d-8aecc17115b2", codigo:"essencial", nome:"Essencial", ativo:true, ordem:1, preco:"R$ 49,90", preco_mensal:"R$ 49,90", preco_anual:"R$ 499,00", publico_alvo:"Veterinários que atendem em domicílio", descricao:"Bom para veterinários que atendem em domicílio", dominio_incluso:false, usuarios_inclusos:1, itens:["Cadastro de animais e tutores","Anamnese e prontuários","Receituário e PDFs clínicos"], created_at:AGORA, updated_at:AGORA },
  { id:"5dc9dc2c-00d0-448a-9354-43f3bc692413", codigo:"plus-clinica", nome:"Plus (Clínica)", ativo:true, ordem:2, preco:"R$ 99,90", preco_mensal:"R$ 99,90", preco_anual:"R$ 999,00", publico_alvo:"Pet shops e clínicas", descricao:"Bom para petshops e clínicas", dominio_incluso:false, usuarios_inclusos:3, itens:["Logo da sua clínica","3 usuários inclusos","Consultório e recepção","Financeiro e caixa","Serviços e estoque","Portal do tutor"], created_at:AGORA, updated_at:AGORA },
  { id:"7f20fd38-2353-4886-941d-c29d5cd74fc3", codigo:"master-equipe", nome:"Master (Equipe)", ativo:true, ordem:3, preco:"R$ 199,90", preco_mensal:"R$ 199,90", preco_anual:"R$ 1.999,00", publico_alvo:"Equipes e clínicas", descricao:"Para equipes e clínicas que precisam de um sistema sob medida", dominio_incluso:true, usuarios_inclusos:5, itens:["Tudo que o sistema oferece","Personalização: ajustamos o sistema à sua necessidade","www.suaclinica.com.br","5 usuários inclusos","Portal do tutor"], created_at:AGORA, updated_at:AGORA },
];

export const FUNCIONALIDADES_PADRAO = [
  ["atividade.ponto","Registro de atividade e ponto","Atividade",10],["recepcao.agenda","Agenda e fila de espera","Recepção",20],["recepcao.cadastros","Cadastro de tutores e animais","Recepção",21],["consultorio.atendimentos","Consultas e prontuários","Consultório",30],["consultorio.medicacoes","Calculadora de medicações","Consultório",31],["consultorio.receituario","Receituário","Consultório",32],["internacao.painel","Painel de internação","Internação",40],["internacao.medicacoes","Medicações na internação","Internação",41],["internacao.plantoes","Plantões e histórico","Internação",42],["caixa.financeiro","Financeiro e caixa","Caixa",50],["caixa.comandas","Comandas","Caixa",51],["estoque.catalogo","Catálogo de produtos e serviços","Estoque",60],["estoque.movimentar","Movimentações de estoque","Estoque",61],["equipe.pagamentos","Pagamento da equipe","Equipe",70],["crm.inteligente","CRM inteligente","CRM",75],["administracao.site","Site da clínica","Administração",80],["administracao.temas","Temas","Administração",81],["portal_tutor.acesso","Portal do tutor","Portal do tutor",89],["portal_tutor.agendamento_online","Agendamento online do tutor","Portal do tutor",90],
].map(([codigo,nome,grupo,ordem])=>({codigo,nome,grupo,ordem,ativo:true}));

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
  ["portal_tutor.gerenciar","Gerenciar portal do tutor","Portal do tutor","Ativar acessos, emitir convites e administrar o portal dos tutores da clínica.","portal_tutor.acesso",89],
] as const;
export const PERMISSOES_PADRAO=PERMISSOES.map(([codigo,nome,grupo,descricao,funcionalidade_codigo,ordem])=>({codigo,nome,grupo,descricao,funcionalidade_codigo,ordem,ativo:true}));

const ADMIN=[...PERMISSOES_PADRAO.map(p=>p.codigo)];
export const PERMITIDAS_POR_PAPEL:Record<string,string[]>={
  responsavel:ADMIN, admin_clinica:ADMIN, rt:ADMIN,
  usuario:["atividade.ponto"],
  auxiliar_estagiario:["atividade.ponto","internacao.medicacoes","internacao.painel","internacao.registrar","recepcao.agenda"],
  recepcao:["atividade.ponto","caixa.comandas","caixa.financeiro.gerenciar","caixa.financeiro.visualizar","crm.enviar","crm.visualizar","estoque.catalogo.visualizar","portal_tutor.gerenciar","recepcao.agenda","recepcao.cadastros.criar","recepcao.cadastros.editar","recepcao.cadastros.visualizar"],
  veterinario:["atividade.ponto","consultorio.atendimentos","consultorio.medicacoes","consultorio.receituario","crm.visualizar","internacao.medicacoes","internacao.painel","internacao.plantoes","internacao.registrar","recepcao.agenda","recepcao.cadastros.visualizar"],
};
export const PERMISSOES_PAPEL_PADRAO=Object.entries(PERMITIDAS_POR_PAPEL).flatMap(([papel,permitidas])=>PERMISSOES_PADRAO.map(p=>({papel,permissao_codigo:p.codigo,permitido:permitidas.includes(p.codigo)})));

export const FUNCIONALIDADES_POR_PLANO:Record<string,string[]>={
  essencial:["administracao.temas","consultorio.atendimentos","consultorio.receituario","recepcao.cadastros"],
  "plus-clinica":["administracao.temas","atividade.ponto","caixa.comandas","caixa.financeiro","consultorio.atendimentos","consultorio.medicacoes","consultorio.receituario","estoque.catalogo","estoque.movimentar","portal_tutor.acesso","portal_tutor.agendamento_online","recepcao.agenda","recepcao.cadastros"],
  "master-equipe":FUNCIONALIDADES_PADRAO.map(f=>String(f.codigo)),
};
export const PLANO_FUNCIONALIDADES_PADRAO=PLANOS_PADRAO.flatMap(plano=>FUNCIONALIDADES_PADRAO.map(f=>({plano_id:plano.id,funcionalidade_codigo:String(f.codigo),permitido:FUNCIONALIDADES_POR_PLANO[plano.codigo]?.includes(String(f.codigo))||false})));

export const CLINICAS_PADRAO=[
  {id:"d9efe5af-3bf6-4230-ac1e-62249a88c155",nome:"Vetericio",slug:"vetericio",status:"ativa",plano:"Master (Equipe)",logo_url:"https://lh3.googleusercontent.com/d/1c_NPgVwvK7lgrhCNDFKoWNJxNpqkAA4K",dominio:null,limite_usuarios:5,duracao_padrao_atendimento_min:30,duracoes_atendimento_min:{Vacina:30,Retorno:30,Cirurgia:120,Consulta:30,"Banho e Tosa":60,Procedimento:30},created_at:AGORA,updated_at:AGORA},
  {id:"b2248b47-f22e-474b-a67c-f3f4326f2450",nome:"Oricse — Clínica de Testes",slug:"oricse-clinica-testes-isolamento",status:"ativa",plano:"Master (Equipe)",logo_url:null,dominio:null,limite_usuarios:5,duracao_padrao_atendimento_min:30,duracoes_atendimento_min:{Vacina:30,Retorno:30,Cirurgia:120,Consulta:30,"Banho e Tosa":60,Procedimento:30},created_at:AGORA,updated_at:AGORA},
];

export function seedTabela(nome:string):any[]{
  switch(nome){
    case "oricse_planos": return structuredClone(PLANOS_PADRAO);
    case "oricse_funcionalidades": return structuredClone(FUNCIONALIDADES_PADRAO);
    case "oricse_permissoes": return structuredClone(PERMISSOES_PADRAO);
    case "oricse_permissoes_papel": return structuredClone(PERMISSOES_PAPEL_PADRAO);
    case "oricse_plano_funcionalidades": return structuredClone(PLANO_FUNCIONALIDADES_PADRAO);
    case "clinicas": return structuredClone(CLINICAS_PADRAO);
    case "oricse_config": return [{chave:"site_publico",valor:{marca:"Oricse",contato:"",logo_url:"",cta_plano:"Escolher plano",titulo_planos:"Escolha o plano ideal para sua clínica",subtitulo_planos:"Organize atendimento, internação, prontuários, financeiro e estoque em um só sistema."},updated_at:AGORA}];
    default:return [];
  }
}
