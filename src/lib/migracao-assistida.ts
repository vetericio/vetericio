export const modelosMigracao = {
  tutores: "id_origem;nome;telefone;cpf_cnpj;email",
  animais: "id_origem;tutor_id_origem;tutor_cpf_cnpj;nome;especie;raca;sexo;nascimento;microchip",
  prontuarios: "id_origem;animal_id_origem;microchip;data;titulo;detalhe;veterinario;crmv",
  vacinas:
    "id_origem;animal_id_origem;microchip;nome;aplicada_em;reforco_em;lote;fabricante;fabricacao;validade;dose;alvo_vacinacao;hora_aplicacao;local_aplicacao;veterinario;crmv;uf;observacoes",
  anexos: "id_origem;animal_id_origem;microchip;arquivo;data;titulo;observacoes",
} as const;

export type TipoMigracao = keyof typeof modelosMigracao;
export type RegistroMigracao = { linha: number; dados: Record<string, string> };
export type RetornoMigracao = {
  status: "novo" | "existente" | "importado" | "pendente";
  motivo: string;
  animalId?: string;
  registroId?: string;
};
export const plataformasMigracao = {
  simplesvet: {
    nome: "SimplesVet",
    instrucao:
      "Em Clientes, abra a exportação de Pessoas e animais e escolha Planilha. Solicite ao suporte os históricos, as vacinas e os anexos com os identificadores dos animais.",
  },
  vetsmart: {
    nome: "VetSmart",
    instrucao:
      "Solicite ao Prontuário VetSmart a planilha Exportação Dados e os arquivos originais dos anexos. Confira as abas e vincule as colunas pelo identificador de origem.",
  },
  vetus: {
    nome: "Vetus",
    instrucao:
      "Solicite ao suporte a exportação da base clínica, com tutores, animais, históricos, vacinas e arquivos vinculados por identificador.",
  },
  nuvemvet: {
    nome: "Nuvem Vet",
    instrucao:
      "Solicite ao suporte a exportação da base clínica e dos arquivos. Confira se os relatórios de consultas e vacinas incluem os identificadores dos animais.",
  },
  outra: {
    nome: "Outra plataforma",
    instrucao:
      "Peça ao fornecedor arquivos CSV ou XLSX e os PDFs originais. Solicite identificadores estáveis para tutores, animais e registros.",
  },
};

export const normalizarColuna = (v: string) =>
  v
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

export function lerCsv(conteudo: string): string[][] {
  const texto = conteudo.replace(/^\uFEFF/, "");
  const cabecalho = texto.split(/\r?\n/, 1)[0] || "";
  const separador = [";", ",", "\t"].sort(
    (a, b) => cabecalho.split(b).length - cabecalho.split(a).length,
  )[0];
  const linhas: string[][] = [];
  let linha: string[] = [],
    campo = "",
    aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"') {
      if (aspas && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (aspas || !campo) aspas = !aspas;
      else campo += c;
    } else if (c === separador && !aspas) {
      linha.push(campo);
      campo = "";
    } else if ((c === "\r" || c === "\n") && !aspas) {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linhas.push([...linha, campo]);
      linha = [];
      campo = "";
    } else campo += c;
  }
  if (aspas) throw new Error("CSV com aspas abertas.");
  if (campo || linha.length) linhas.push([...linha, campo]);
  return linhas;
}

type Celula = string | number | boolean | Date | null | undefined;
const textoCelula = (valor: Celula) =>
  valor instanceof Date ? valor.toISOString().slice(0, 10) : String(valor ?? "").trim();
export function montarRegistros(
  linhas: Celula[][],
  mapa: Record<string, string>,
): RegistroMigracao[] {
  return linhas.slice(1).flatMap((linha, i) => {
    if (!linha.some((celula) => textoCelula(celula))) return [];
    const dados = Object.fromEntries(
      Object.entries(mapa)
        .filter(([, coluna]) => coluna !== "")
        .map(([campo, coluna]) => {
          const texto = textoCelula(linha[Number(coluna)]);
          const data = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
          return [
            campo,
            data &&
            ["nascimento", "data", "aplicada_em", "reforco_em", "fabricacao", "validade"].includes(
              campo,
            )
              ? `${data[3]}-${data[2]}-${data[1]}`
              : texto,
          ];
        }),
    );
    return [{ linha: i + 2, dados }];
  });
}

export function sugerirColunas(tipo: TipoMigracao, titulos: string[]) {
  const sinonimos: Record<string, string[]> = {
    id_origem: [
      "id",
      "codigo",
      `id_${{ tutores: "tutor", animais: "animal", prontuarios: "prontuario", vacinas: "vacina", anexos: "anexo" }[tipo]}`,
    ],
    tutor_id_origem: ["id_tutor", "tutor_id", "id_cliente", "codigo_cliente"],
    animal_id_origem: ["id_animal", "animal_id", "id_pet", "codigo_animal", "paciente_id"],
    cpf_cnpj: ["cpf", "cnpj", "documento"],
    tutor_cpf_cnpj: ["cpf_tutor", "cpf_cliente"],
    telefone: ["celular", "whatsapp", "telefone_principal"],
    nome: [tipo === "animais" ? "nome_animal" : tipo === "vacinas" ? "vacina" : "nome_cliente"],
    detalhe: ["prontuario", "descricao", "evolucao", "texto"],
    aplicada_em: ["data_aplicacao", "aplicacao"],
    reforco_em: ["proxima_dose", "data_retorno"],
    arquivo: ["nome_arquivo", "anexo"],
  };
  const normalizados = titulos.map(normalizarColuna);
  return Object.fromEntries(
    modelosMigracao[tipo].split(";").map((campo) => {
      const opcoes = [campo, ...(sinonimos[campo] || [])];
      const indice = opcoes.map((opcao) => normalizados.indexOf(opcao)).find((i) => i >= 0);
      return [campo, indice === undefined ? "" : String(indice)];
    }),
  );
}
