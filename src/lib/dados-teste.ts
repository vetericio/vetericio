import { oricseStorage, oricseSession } from "@/lib/oricse-storage";
const TUTORES_KEY = "oricse-tutores-v1";
const ANIMAIS_KEY = "oricse-animais-v1";

const NOMES = ["Ana Beatriz", "Bruno", "Carla", "Diego", "Eduarda", "Felipe", "Gabriela", "Henrique", "Isabela", "João Pedro", "Karina", "Lucas", "Mariana", "Nicolas", "Olívia", "Paulo", "Queila", "Rafael", "Sofia", "Thiago", "Valéria", "Wagner"];
const SOBRENOMES = ["Almeida", "Barbosa", "Cardoso", "Dias", "Esteves", "Ferreira", "Gomes", "Henriques", "Moreira", "Nogueira", "Oliveira", "Pereira", "Ramos", "Santos", "Teixeira", "Vasconcelos"];
const CIDADES: Array<[string, string, string, string]> = [
  ["São Paulo", "SP", "01310-100", "Avenida Paulista"],
  ["Rio de Janeiro", "RJ", "20040-020", "Rua da Assembleia"],
  ["Belo Horizonte", "MG", "30130-010", "Avenida Afonso Pena"],
  ["Curitiba", "PR", "80010-010", "Rua XV de Novembro"],
  ["Porto Alegre", "RS", "90010-000", "Rua dos Andradas"],
];
const BAIRROS = ["Centro", "Jardim América", "Vila Nova", "Boa Vista", "Santa Mônica"];
const ORIGENS = ["Indicação", "Instagram", "Google", "Passou em frente", "Convênio"];
const CORES = ["Preto", "Branco", "Caramelo", "Cinza", "Marrom", "Tricolor", "Preto e branco", "Tigrado"];

const ESPECIES: Array<{ especie: string; racas: string[]; nomes: string[]; porte: string[] }> = [
  { especie: "Cão", racas: ["SRD (Sem Raça Definida)", "Labrador Retriever", "Shih Tzu", "Golden Retriever", "Poodle", "Spitz Alemão", "Bulldog Francês", "Yorkshire Terrier"], nomes: ["Thor", "Mel", "Bob", "Luna", "Fred", "Nina", "Toby", "Pipoca", "Bella", "Max", "Mia", "Rex", "Lola", "Zeca", "Amora"], porte: ["Pequeno", "Médio", "Grande"] },
  { especie: "Gato", racas: ["SRD (Sem Raça Definida)", "Siamês", "Persa", "Maine Coon", "Angorá"], nomes: ["Mimi", "Tom", "Frajola", "Nala", "Simba", "Cleo", "Garfield", "Pretinha", "Mingau", "Biscoito"], porte: ["Pequeno", "Médio"] },
  { especie: "Coelho", racas: ["Mini Lop", "Rex"], nomes: ["Branquinho", "Cenoura"], porte: ["Pequeno"] },
  { especie: "Ave", racas: ["Calopsita", "Periquito"], nomes: ["Kiwi", "Piu"], porte: ["Pequeno"] },
  { especie: "Hamster", racas: ["Sírio"], nomes: ["Bolinha"], porte: ["Pequeno"] },
];

// Distribuição para totalizar 50 animais entre 22 tutores.
const SEQUENCIA_ESPECIES = [
  ...Array(29).fill(0), ...Array(15).fill(1), 2, 2, 3, 3, 3, 4,
];

function cpfValido(base: number): string {
  const d = String(base).padStart(9, "0").split("").map(Number);
  for (let n = 9; n <= 10; n += 1) {
    const soma = d.reduce((acc, v, i) => acc + v * (n + 1 - i), 0);
    const resto = (soma * 10) % 11;
    d.push(resto === 10 ? 0 : resto);
  }
  return d.join("");
}

function mascaraCpf(c: string) {
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}

function dataAtras(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

export function gerarDadosDeTeste(inicial: string) {
  const agora = new Date().toISOString();
  const tutores = NOMES.map((nome, i) => {
    const sobrenome = SOBRENOMES[(i * 5) % SOBRENOMES.length];
    const [cidade, estado, cep, rua] = CIDADES[i % CIDADES.length];
    const ddd = ["11", "21", "31", "41", "51"][i % 5];
    const cpf = cpfValido(123456000 + i * 7919);
    const nomeCompleto = `${nome} ${sobrenome}`;
    return {
      id: crypto.randomUUID(),
      nome: nomeCompleto,
      telefone: `(${ddd}) 9${String(80000000 + i * 123457).slice(0, 4)}-${String(1000 + i * 37).slice(0, 4)}`,
      email: `${nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ".")}.${sobrenome.toLowerCase()}@exemplo.com.br`,
      tipoPessoa: "Pessoa física",
      codigoPublico: `#${inicial}${String(900001 + i)}`,
      cpfCnpj: mascaraCpf(cpf),
      nascimento: dataAtras(365 * (25 + (i % 30)) + i * 11),
      sexo: i % 2 === 0 ? "Feminino" : "Masculino",
      profissao: ["Professora", "Engenheiro", "Designer", "Advogada", "Contador", "Enfermeira"][i % 6],
      origem: ORIGENS[i % ORIGENS.length],
      contatoPreferencial: "WhatsApp",
      autorizaLembretes: true,
      autorizaWhatsapp: true,
      autorizaEmail: i % 3 === 0,
      autorizaMarketing: false,
      cep,
      estado,
      cidade,
      bairro: BAIRROS[i % BAIRROS.length],
      endereco: rua,
      numero: String(100 + i * 13),
      observacoes: "Cadastro de teste.",
      criadoEm: agora,
    };
  });

  const animais = SEQUENCIA_ESPECIES.map((idxEsp, i) => {
    const esp = ESPECIES[idxEsp];
    const tutor = tutores[i % tutores.length];
    const macho = i % 2 === 0;
    return {
      id: crypto.randomUUID(),
      tutorId: tutor.id,
      nome: `${esp.nomes[i % esp.nomes.length]}`,
      nascimento: dataAtras(200 + ((i * 97) % 4200)),
      especie: esp.especie,
      raca: esp.racas[i % esp.racas.length],
      sexo: macho ? "Macho" : "Fêmea",
      cor: CORES[i % CORES.length],
      porte: esp.porte[i % esp.porte.length],
      peso: esp.especie === "Cão" ? String(4 + (i % 25)) : esp.especie === "Gato" ? String(3 + (i % 4)) : "1",
      castrado: i % 3 === 0 ? "Sim" : "Não",
      microchip: i % 4 === 0 ? String(985000000000000 + i * 4321) : "",
      temperamentos: [["Dócil"], ["Sociável"], ["Ansioso"], ["Dócil", "Agitado"]][i % 4],
      alergias: i % 9 === 0 ? "Alergia alimentar (frango)" : "",
      observacoes: "Animal de teste.",
      criadoEm: agora,
    };
  });

  return { tutores, animais };
}

export function inserirDadosDeTeste(inicial: string) {
  const { tutores, animais } = gerarDadosDeTeste(inicial);
  const lerLista = (chave: string) => {
    try {
      const v: unknown = JSON.parse(oricseStorage.getItem(chave) || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  oricseStorage.setItem(TUTORES_KEY, JSON.stringify([...tutores, ...lerLista(TUTORES_KEY)]));
  oricseStorage.setItem(ANIMAIS_KEY, JSON.stringify([...animais, ...lerLista(ANIMAIS_KEY)]));
  return { tutores: tutores.length, animais: animais.length };
}
