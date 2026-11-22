/**
 * Geração local e verificável de uma mensagem breve de acompanhamento.
 * Não chama serviços externos, não cria diagnósticos nem altera o prontuário.
 */
type DadosMensagem = {
  tutorNome: string;
  animalNome: string;
  autorNome?: string | null;
  queixa?: string | null;
  dataConsulta?: string | null;
};

const SINAIS: ReadonlyArray<[RegExp, string]> = [
  [/v[oô]mit|[êe]mese/i, "vômitos"],
  [/diarrei/i, "diarreia"],
  [/toss|tosse/i, "tosse"],
  [/coceira|prurido/i, "coceira"],
  [/mancand|claudic/i, "dificuldade para andar"],
  [/prostra|apatia/i, "prostração"],
  [/falta de ar|dispneia|dificuldade (para|de) respirar/i, "dificuldade para respirar"],
  [/ferida|les[aã]o/i, "lesão"],
  [/dor\b|doloros/i, "dor"],
  [/convuls/i, "convulsões"],
  [/falta de apetite|hiporexia|anorexia/i, "falta de apetite"],
];

function nomeCurto(nome: string) {
  return nome.trim().split(/\s+/)[0]?.replace(/[\r\n<>]/g, "") || "";
}
function juntar(itens: string[]) {
  if (itens.length === 1) return itens[0];
  return itens.slice(0, -1).join(", ") + " e " + itens[itens.length - 1];
}
function dataBr(data: string) {
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : "";
}
function resumoCurto(queixa: string) {
  const texto = queixa.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200);
  if (!texto) return "";
  const sinais = SINAIS.filter(([padrao]) => padrao.test(texto)).slice(0, 3).map(([, nome]) => nome);
  if (!sinais.length) return "";

  // Contexto de ingestão apenas quando explicitamente descrito no prontuário.
  const ingestao = texto.match(/\b(?:comeu|ingeriu|engoliu)\s+(um|uma|o|a)\s+([a-zà-ÿ-]{3,})\b/i);
  const causa = ingestao ? ` após ter comido ${ingestao[1].toLowerCase()} ${ingestao[2].toLowerCase()}` : "";
  return juntar(sinais) + causa;
}

export function comporMensagemAcompanhamento(dados: DadosMensagem) {
  const tutor = nomeCurto(dados.tutorNome);
  const animal = dados.animalNome.trim().replace(/[\r\n<>]/g, " ").slice(0, 90);
  const veterinario = nomeCurto(dados.autorNome || "");
  const resumo = resumoCurto(dados.queixa || "");
  const apresentacao = veterinario
    ? `Eu sou ${veterinario}, médico-veterinário que atendeu ${animal}.`
    : `Aqui é da equipe veterinária que acompanhou ${animal}.`;
  const referencia = resumo
    ? `Queria saber como ${animal} está desde o atendimento por ${resumo}. Já está melhor?`
    : `Queria saber como ${animal} está desde o atendimento${dados.dataConsulta ? " de " + dataBr(dados.dataConsulta) : ""}. Já está melhor?`;
  return `Oi, ${tutor || "tudo bem"}! Tudo bem?\n\n${apresentacao}\n\n${referencia}\n\nQualquer coisa, estou à disposição! 😊`;
}
