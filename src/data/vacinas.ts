export type VacinaCatalogo = {
  nome: string;
  especie: string[];
  fabricante?: string;
  grupo?: string;
  aliases?: string[];
};

export const VACINAS_CATALOGO: VacinaCatalogo[] = [
  // Cães — Zoetis
  { nome: "Vanguard Plus", especie: ["Cão"], fabricante: "Zoetis", grupo: "Polivalente", aliases: ["V8", "V10", "Vanguard"] },
  { nome: "Vanguard HTLP 5/CV-L", especie: ["Cão"], fabricante: "Zoetis", grupo: "Polivalente", aliases: ["V8", "V10", "Vanguard HTLP"] },
  { nome: "Vanguard B Oral", especie: ["Cão"], fabricante: "Zoetis", grupo: "Respiratória", aliases: ["Bordetella", "Tosse dos canis"] },
  { nome: "Vanguard i III", especie: ["Cão"], fabricante: "Zoetis", grupo: "Respiratória", aliases: ["Bordetella", "Parainfluenza", "Adenovírus 2"] },
  { nome: "BronchiGuard", especie: ["Cão"], fabricante: "Zoetis", grupo: "Respiratória", aliases: ["Bordetella", "Tosse dos canis"] },
  { nome: "Bronchi-Shield III", especie: ["Cão"], fabricante: "Zoetis", grupo: "Respiratória", aliases: ["Bordetella", "Parainfluenza", "Adenovírus 2"] },
  { nome: "Guard-Vac LCI/GP", especie: ["Cão"], fabricante: "Zoetis", grupo: "Leptospirose", aliases: ["Lepto"] },
  { nome: "GiardiaVax", especie: ["Cão"], fabricante: "Zoetis", grupo: "Giardíase", aliases: ["Giárdia"] },
  { nome: "Defensor", especie: ["Cão", "Gato"], fabricante: "Zoetis", grupo: "Raiva", aliases: ["Antirrábica", "Raiva"] },

  // Gatos — Zoetis
  { nome: "Felocell CVR", especie: ["Gato"], fabricante: "Zoetis", grupo: "Tríplice felina", aliases: ["V3", "Tríplice felina"] },
  { nome: "Felocell CVR-C", especie: ["Gato"], fabricante: "Zoetis", grupo: "Quádrupla felina", aliases: ["V4", "Quádrupla felina"] },
  { nome: "Felocell FeLV", especie: ["Gato"], fabricante: "Zoetis", grupo: "FeLV", aliases: ["Leucemia felina", "FeLV"] },
  { nome: "Fel-O-Vax LvK IV + CaliciVax", especie: ["Gato"], fabricante: "Zoetis", grupo: "Quíntupla felina", aliases: ["V5", "Quíntupla felina", "FeLV"] },

  // Cães — MSD Saúde Animal
  { nome: "Nobivac Canine 1-DAPPVL2+CV", especie: ["Cão"], fabricante: "MSD Saúde Animal", grupo: "Polivalente", aliases: ["V10", "Polivalente"] },
  { nome: "Nobivac DHPPI+L", especie: ["Cão"], fabricante: "MSD Saúde Animal", grupo: "Polivalente", aliases: ["V8", "V10", "Polivalente"] },
  { nome: "Nobivac Puppy DP", especie: ["Cão"], fabricante: "MSD Saúde Animal", grupo: "Filhotes", aliases: ["Puppy", "Cinomose", "Parvovirose"] },
  { nome: "Nobivac KC", especie: ["Cão"], fabricante: "MSD Saúde Animal", grupo: "Respiratória", aliases: ["Bordetella", "Parainfluenza", "Tosse dos canis"] },
  { nome: "Nobivac Intra-Trac Oral Bb", especie: ["Cão"], fabricante: "MSD Saúde Animal", grupo: "Respiratória", aliases: ["Bordetella", "Tosse dos canis"] },
  { nome: "Nobivac Respira Bb", especie: ["Cão"], fabricante: "MSD Saúde Animal", grupo: "Respiratória", aliases: ["Bordetella", "Tosse dos canis"] },
  { nome: "Nobivac Raiva", especie: ["Cão", "Gato", "Furão"], fabricante: "MSD Saúde Animal", grupo: "Raiva", aliases: ["Antirrábica", "Raiva"] },

  // Gatos — MSD Saúde Animal
  { nome: "Nobivac Feline 1-HCP", especie: ["Gato"], fabricante: "MSD Saúde Animal", grupo: "Tríplice felina", aliases: ["V3", "Tríplice felina"] },
  { nome: "Nobivac Feline 1-HCPCH", especie: ["Gato"], fabricante: "MSD Saúde Animal", grupo: "Quádrupla felina", aliases: ["V4", "Quádrupla felina"] },
  { nome: "Nobivac Feline 1-HCPCH + FeLV", especie: ["Gato"], fabricante: "MSD Saúde Animal", grupo: "Quíntupla felina", aliases: ["V5", "Quíntupla felina", "FeLV"] },

  // Cães — Boehringer Ingelheim
  { nome: "Recombitek C6/Cv", especie: ["Cão"], fabricante: "Boehringer Ingelheim", grupo: "Polivalente", aliases: ["Cinomose", "Hepatite", "Adenovírus 2", "Parvovirose", "Parainfluenza", "Coronavirose", "Leptospirose"] },

  // Gatos — Boehringer Ingelheim
  { nome: "Purevax Recombinante FeLV", especie: ["Gato"], fabricante: "Boehringer Ingelheim", grupo: "FeLV", aliases: ["FeLV", "Leucemia felina", "Purevax"] },

  // Cães — Virbac
  { nome: "Canigen CH(A2)P/L", especie: ["Cão"], fabricante: "Virbac", grupo: "Polivalente", aliases: ["Cinomose", "Hepatite", "Adenovirose", "Parvovirose", "Leptospirose", "Canigen"] },
  { nome: "Canigen R", especie: ["Cão", "Gato"], fabricante: "Virbac", grupo: "Raiva", aliases: ["Antirrábica", "Raiva", "Canigen"] },

  // Gatos — Virbac
  { nome: "Feligen CR/P", especie: ["Gato"], fabricante: "Virbac", grupo: "Tríplice felina", aliases: ["V3", "Calicivirose", "Rinotraqueíte", "Panleucopenia", "Feligen"] },
  { nome: "Feligen CRP/R", especie: ["Gato"], fabricante: "Virbac", grupo: "Quádrupla felina + raiva", aliases: ["V4", "Calicivirose", "Rinotraqueíte", "Panleucopenia", "Raiva", "Feligen"] },

  // Cães e gatos — Ceva
  { nome: "Hertaliq", especie: ["Cão", "Gato"], fabricante: "Ceva", grupo: "Raiva", aliases: ["Antirrábica", "Raiva"] },
  { nome: "Rabmune", especie: ["Cão", "Gato"], fabricante: "Ceva", grupo: "Raiva", aliases: ["Antirrábica", "Raiva"] },

  // Genéricas / atalhos clínicos
  { nome: "V6", especie: ["Cão"], grupo: "Polivalente", aliases: ["Sêxtupla"] },
  { nome: "V8", especie: ["Cão"], grupo: "Polivalente", aliases: ["Óctupla"] },
  { nome: "V10", especie: ["Cão"], grupo: "Polivalente", aliases: ["Décupla"] },
  { nome: "V12", especie: ["Cão"], grupo: "Polivalente", aliases: ["Polivalente"] },
  { nome: "Antirrábica", especie: ["Cão", "Gato", "Coelho", "Furão"], grupo: "Raiva", aliases: ["Raiva"] },
  { nome: "Bordetella bronchiseptica", especie: ["Cão"], grupo: "Respiratória", aliases: ["Tosse dos canis"] },
  { nome: "Leptospirose", especie: ["Cão"], grupo: "Leptospirose", aliases: ["Lepto"] },
  { nome: "Influenza canina", especie: ["Cão"], grupo: "Respiratória", aliases: ["Gripe canina"] },
  { nome: "Giardíase", especie: ["Cão"], grupo: "Giardíase", aliases: ["Giárdia"] },
  { nome: "V3 / Tríplice felina", especie: ["Gato"], grupo: "Tríplice felina", aliases: ["V3"] },
  { nome: "V4 / Quádrupla felina", especie: ["Gato"], grupo: "Quádrupla felina", aliases: ["V4"] },
  { nome: "V5 / Quíntupla felina", especie: ["Gato"], grupo: "Quíntupla felina", aliases: ["V5"] },
  { nome: "FeLV", especie: ["Gato"], grupo: "Leucemia felina", aliases: ["Leucemia felina"] },
  { nome: "RHD / Doença hemorrágica viral", especie: ["Coelho"], grupo: "Coelhos", aliases: ["RHDV", "RHDV2"] },
  { nome: "Mixomatose", especie: ["Coelho"], grupo: "Coelhos" },

  // Sempre disponível
  { nome: "Outra vacina", especie: ["Cão", "Gato", "Coelho", "Hamster", "Rato", "Porquinho-da-índia", "Ave", "Réptil", "Quelônio", "Serpente", "Silvestre / exótico", "Outro"], grupo: "Outro" },
];

export function vacinasPorEspecie(especie?: string) {
  if (!especie) return [...VACINAS_CATALOGO];
  const lista = VACINAS_CATALOGO.filter((v) => v.especie.includes(especie));
  return lista.sort((a, b) => {
    if (a.nome === "Outra vacina") return 1;
    if (b.nome === "Outra vacina") return -1;
    return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
  });
}
