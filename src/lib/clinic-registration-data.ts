export type RegistrationRecord = Record<string, unknown>;

export const REGISTRATION_GROUPS: ReadonlyArray<{ title: string; fields: ReadonlyArray<readonly [string, string]> }> = [
  { title: "Responsável e registro profissional", fields: [
    ["responsavel_nome", "Nome completo"], ["responsavel_cpf", "CPF"],
    ["responsavel_crmv", "Número do CRMV"], ["responsavel_crmv_uf", "UF do CRMV"],
    ["responsavel_email", "E-mail"], ["responsavel_telefone", "Telefone"],
  ] },
  { title: "Endereço do responsável", fields: [
    ["responsavel_cep", "CEP"], ["responsavel_endereco", "Endereço"], ["responsavel_numero", "Número"],
    ["responsavel_complemento", "Complemento"], ["responsavel_bairro", "Bairro"],
    ["responsavel_cidade", "Cidade"], ["responsavel_uf", "UF"],
  ] },
  { title: "Clínica e áreas de atuação", fields: [
    ["clinica_nome", "Nome da clínica"], ["razao_social", "Razão social"], ["cnpj", "CNPJ/CPF"],
    ["clinica_telefone", "Telefone"], ["clinica_email", "E-mail"],
    ["tipo_operacao", "Tipo de operação"], ["operacoes_ativas", "Áreas de atuação"],
    ["operacoes_selecionadas", "Operações selecionadas"], ["observacoes", "Observações"],
  ] },
  { title: "Endereço da clínica", fields: [
    ["clinica_cep", "CEP"], ["clinica_endereco", "Endereço"], ["clinica_numero", "Número"],
    ["clinica_complemento", "Complemento"], ["clinica_bairro", "Bairro"],
    ["clinica_cidade", "Cidade"], ["clinica_uf", "UF"],
  ] },
  { title: "Site e identidade informados na contratação", fields: [
    ["slug_desejado", "Identificador solicitado"], ["nome_publico", "Nome público"], ["dominio", "Domínio"],
    ["logo_nome", "Nome do arquivo da logo"], ["logo_data_url", "Logo enviada"],
    ["modelo_site", "Modelo do site"], ["estilo_site", "Estilo do site"],
    ["servicos_iniciais", "Serviços iniciais"], ["horario_abertura", "Horário de abertura"],
    ["horario_fechamento", "Horário de fechamento"], ["agenda_online", "Agenda online"],
  ] },
  { title: "Contratação e autorizações informadas", fields: [
    ["plano_codigo", "Código do plano"], ["plano_nome", "Plano"], ["ciclo", "Período contratado"],
    ["modo_renovacao", "Forma de renovação"], ["quantidade_usuarios", "Quantidade de usuários"],
    ["perfis_inclusos", "Perfis inclusos"], ["perfis_extras", "Perfis extras"],
    ["adicional_perfis_mensal", "Adicional mensal de perfis"], ["adicional_perfis_ciclo", "Adicional de perfis no período"],
    ["valor_base", "Valor base registrado"], ["valor_total", "Valor total registrado"],
    ["promo_codigo", "Código promocional"], ["aceitou_termos", "Aceite dos Termos de Uso"],
    ["aceitou_privacidade", "Aceite da Política de Privacidade"], ["fidelidade_meses", "Fidelidade (meses)"],
    ["aceitou_fidelidade_master", "Aceite da fidelidade Master"], ["fidelidade_aceita_em", "Data do aceite da fidelidade"],
  ] },
];

// Explicit columns plus the original JSON payload: addresses and CRMV are not on clinicas.
export const REGISTRATION_COLUMNS = Array.from(new Set([
  "id", "created_at", "dados", ...REGISTRATION_GROUPS.flatMap(group => group.fields.map(([key]) => key))
    .filter(key => !["operacoes_ativas", "operacoes_selecionadas", "nome_publico", "logo_nome", "logo_data_url", "modelo_site", "estilo_site", "servicos_iniciais", "horario_abertura", "horario_fechamento", "agenda_online", "fidelidade_meses", "aceitou_fidelidade_master", "fidelidade_aceita_em"].includes(key)),
])).join(",");

export function originalRegistrationData(record: RegistrationRecord): RegistrationRecord {
  const payload = record.dados;
  const original = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as RegistrationRecord : {};
  const merged = { ...record, ...original };
  delete merged.dados;
  return merged;
}

export function registrationValue(value: unknown): string {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) return "Não informado";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (Array.isArray(value)) return value.length ? value.map(registrationValue).join(", ") : "Não informado";
  if (typeof value === "object") return Object.entries(value).map(([key, item]) => `${key.replace(/_/g, " ")}: ${registrationValue(item)}`).join("; ") || "Não informado";
  return String(value);
}