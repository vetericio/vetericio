export type TipoPreventivo = "vacina" | "vermifugo";

const alvosCaninos = "Cinomose, hepatite infecciosa canina, adenovirose respiratória, parvovirose, parainfluenza e leptospirose";
const alvosFelinos = "Rinotraqueíte, calicivirose e panleucopenia felinas";

export const vacinasPredefinidas = [
  {
    grupo: "Cães e gatos",
    opcoes: [
      { id: "raiva", nome: "Antirrábica (raiva)", alvo: "Raiva" },
    ],
  },
  {
    grupo: "Caninas",
    opcoes: [
      { id: "v8", nome: "V8 canina", alvo: alvosCaninos },
      { id: "v10", nome: "V10 canina", alvo: alvosCaninos },
      { id: "tosse", nome: "Tosse dos canis", alvo: "Traqueobronquite infecciosa canina" },
    ],
  },
  {
    grupo: "Felinas",
    opcoes: [
      { id: "v3", nome: "V3 felina", alvo: alvosFelinos },
      { id: "v4", nome: "V4 felina", alvo: alvosFelinos + ", além de clamidiose" },
      { id: "v5", nome: "V5 felina", alvo: alvosFelinos + ", além de clamidiose e leucemia felina (FeLV)" },
      { id: "felv", nome: "FeLV", alvo: "Leucemia felina (FeLV)" },
    ],
  },
];

export const camposPreventivos = {
  fabricante: "",
  dose: "",
  fabricacao: "",
  validade: "",
  alvo_vacinacao: "",
  principio_ativo: "",
  via: "",
  hora_aplicacao: "",
  local_aplicacao: "",
  veterinario_nome: "",
  veterinario_crmv: "",
  veterinario_uf: "",
};

export type CamposPreventivos = typeof camposPreventivos;

export const selecaoPreventivos = "fabricante,dose,fabricacao,validade,hora_aplicacao,local_aplicacao,veterinario_nome,veterinario_crmv,veterinario_uf";

export function hojeNoBrasil(agora = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

export function dataPreventivaBR(data: string) {
  return data.split("-").reverse().join("/");
}

/** A rotulagem pode trazer dia ou somente mês. Preserva a precisão informada. */
export function dataDoRotulo(texto: string): string | null {
  const partes = texto.trim().match(/^(?:(\d{2})\/)?(\d{2})\/(\d{4})$/);
  const iso = partes
    ? [partes[3], partes[2], partes[1]].filter(Boolean).join("-")
    : texto.trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(iso)) return null;
  const dia = iso.length === 7 ? iso + "-01" : iso;
  const data = new Date(dia + "T12:00:00Z");
  return Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== dia ? null : iso;
}

export function fimDaValidade(iso: string) {
  if (iso.length === 10) return iso;
  const mes = Number(iso.slice(5, 7));
  return new Date(new Date(`${iso}-01T12:00:00Z`).setUTCMonth(mes, 0)).toISOString().slice(0, 10);
}

export function pendenciasPreventivo(tipo: TipoPreventivo, registro: CamposPreventivos & {
  nome: string; data: string; lote: string; retorno: string;
}, exigirCompletude = true) {
  const pendencias: string[] = [];
  const aplicacao = dataDoRotulo(registro.data);
  const fabricacao = dataDoRotulo(registro.fabricacao);
  const validade = dataDoRotulo(registro.validade);
  const retorno = dataDoRotulo(registro.retorno);
  if (exigirCompletude) {
    const exigidos: [string, string][] = [
      ["nome do produto", registro.nome], ["dose aplicada", registro.dose],
      ["nome do médico-veterinário", registro.veterinario_nome],
      ["CRMV do médico-veterinário", registro.veterinario_crmv],
      ["UF do CRMV", registro.veterinario_uf],
      ["data da aplicação", registro.data], ["horário da aplicação", registro.hora_aplicacao],
      ["local da aplicação", registro.local_aplicacao],
      ...(tipo === "vacina" ? [
        ["alvo da vacinação", registro.alvo_vacinacao], ["lote", registro.lote],
        ["fabricante", registro.fabricante], ["fabricação", registro.fabricacao], ["validade", registro.validade],
      ] as [string, string][] : [
        ["via de administração", registro.via],
      ] as [string, string][]),
    ];
    pendencias.push(...exigidos.filter(([, valor]) => !valor.trim()).map(([rotulo]) => rotulo));
  }
  if (registro.veterinario_uf && !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/i.test(registro.veterinario_uf)) {
    pendencias.push("UF válida do CRMV");
  }
  const agora = new Date();
  const hoje = hojeNoBrasil(agora);
  if (registro.data && (!aplicacao || aplicacao.length !== 10 || aplicacao > hoje)) pendencias.push("data válida de aplicação já realizada");
  if (registro.veterinario_crmv && !/\d/.test(registro.veterinario_crmv)) pendencias.push("número válido do CRMV");
  if (registro.hora_aplicacao) {
    const horaAtual = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(agora);
    if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(registro.hora_aplicacao) ||
        (aplicacao === hoje && registro.hora_aplicacao.slice(0, 5) > horaAtual)) {
      pendencias.push("horário válido de aplicação já realizada");
    }
  }
  if (registro.retorno && (!retorno || retorno.length !== 10 || (aplicacao && retorno < aplicacao))) pendencias.push("data de retorno igual ou posterior à aplicação");
  if (registro.fabricacao && !fabricacao) pendencias.push("data válida de fabricação");
  if (registro.validade && !validade) pendencias.push("data válida de validade");
  if (fabricacao && aplicacao && fabricacao > aplicacao.slice(0, fabricacao.length)) pendencias.push("fabricação anterior ou na data da aplicação");
  if (fabricacao && validade && (fabricacao.length === 7 ? fabricacao + "-01" : fabricacao) > fimDaValidade(validade)) pendencias.push("validade igual ou posterior à fabricação");
  return pendencias;
}

export function normalizarCamposPreventivos(campos: Partial<Record<keyof CamposPreventivos, string | null>>) {
  const resultado = { ...camposPreventivos };
  for (const chave of Object.keys(camposPreventivos) as (keyof CamposPreventivos)[]) {
    resultado[chave] = campos[chave]?.trim() || "";
  }
  resultado.veterinario_uf = resultado.veterinario_uf.toUpperCase();
  return resultado;
}
