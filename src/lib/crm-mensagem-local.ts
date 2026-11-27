export type DadosMensagem = {
  tutorNome: string;
  animalNome: string;
  dataConsulta?: string | null;
};

export const AVISO_URGENCIA_ACOMPANHAMENTO =
  "Se houver piora ou sinais de urgência, procure atendimento veterinário de urgência. Não aguarde resposta por aqui.";

function nomeCurto(nome: string) {
  return nome.trim().split(/\s+/)[0]?.replace(/[\r\n<>]/g, "") || "";
}

function dataBr(data: string) {
  const diaIso = data.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(diaIso)) return "";
  const instante = new Date(diaIso + "T12:00:00Z");
  return Number.isFinite(instante.getTime()) && instante.toISOString().startsWith(diaIso)
    ? diaIso.split("-").reverse().join("/") : "";
}

export function comporMensagemAcompanhamento(dados: DadosMensagem) {
  const tutor = nomeCurto(dados.tutorNome);
  const animal = dados.animalNome.trim().replace(/[\r\n<>]/g, " ").slice(0, 90) || "seu animal";
  const data = dados.dataConsulta ? dataBr(dados.dataConsulta) : "";
  const saudacao = tutor ? `Oi, ${tutor}!` : "Oi!";
  const referencia = data ? `Como ${animal} está desde o atendimento de ${data}?` :
    `Como ${animal} está? Podemos ajudar a organizar o acompanhamento.`;
  return `${saudacao} Aqui é da equipe veterinária.\n\n${referencia}\n\n${AVISO_URGENCIA_ACOMPANHAMENTO}`;
}
