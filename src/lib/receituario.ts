import type { jsPDF as DocumentoPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { enviarArquivoDrive } from "@/lib/drive.functions";
import { lerPreferenciaReceitaPortal, motivoFinalReceitaPortal } from "@/lib/receita-portal-state";
import { lerSelos, type TipoSelo } from "./assinatura";
import { desenharIdentidadeDocumento, desenharIdentificacaoDocumento, desenharPapelDocumento, type PapelDocumento } from "@/lib/modelos-documentos-pdf";

export const ENDERECO_RECEITUARIO =
  "Rua Tenente Marino Freire, 444 - Paraúna / Belo Horizonte - MG\n31680-120";

export const FORMAS_MEDICAMENTO = [
  { valor: "comprimido", singular: "comprimido", plural: "comprimidos" },
  { valor: "cápsula", singular: "cápsula", plural: "cápsulas" },
  {
    valor: "comprimido revestido",
    singular: "comprimido revestido",
    plural: "comprimidos revestidos",
  },
  {
    valor: "comprimido mastigável",
    singular: "comprimido mastigável",
    plural: "comprimidos mastigáveis",
  },
  { valor: "gota", singular: "gota", plural: "gotas" },
  { valor: "mL", singular: "mL", plural: "mL" },
  { valor: "mg", singular: "mg", plural: "mg" },
  { valor: "g", singular: "g", plural: "g" },
  { valor: "micrograma", singular: "micrograma", plural: "microgramas" },
  { valor: "sachê", singular: "sachê", plural: "sachês" },
  { valor: "bisnaga", singular: "bisnaga", plural: "bisnagas" },
  { valor: "pipeta", singular: "pipeta", plural: "pipetas" },
  { valor: "ampola", singular: "ampola", plural: "ampolas" },
  { valor: "frasco", singular: "frasco", plural: "frascos" },
  { valor: "dose", singular: "dose", plural: "doses" },
  { valor: "aplicação", singular: "aplicação", plural: "aplicações" },
  { valor: "spray", singular: "spray", plural: "sprays" },
  { valor: "jato", singular: "jato", plural: "jatos" },
  { valor: "puff", singular: "puff", plural: "puffs" },
  { valor: "pomada", singular: "aplicação de pomada", plural: "aplicações de pomada" },
  { valor: "creme", singular: "aplicação de creme", plural: "aplicações de creme" },
  { valor: "gel", singular: "aplicação de gel", plural: "aplicações de gel" },
  { valor: "shampoo", singular: "aplicação de shampoo", plural: "aplicações de shampoo" },
  { valor: "supositório", singular: "supositório", plural: "supositórios" },
] as const;

export const INTERVALOS_RECEITUARIO = ["4", "6", "8", "12", "24", "48"] as const;

export type ItemReceituario = {
  id: string;
  medicamento: string;
  apresentacao: string;
  quantidade: string;
  forma: string;
  intervalo: string;
  intervaloOutro?: string;
  posologiaEditada?: string;
  dias: string;
  observacao: string;
};

export type PosicaoSeloReceituario = {
  /** posição relativa à prévia livre do final da página, entre 0 e 1 */
  x: number;
  y: number;
  /** largura relativa à largura da prévia, entre 0 e 1 */
  largura: number;
};

export type TipoReceita = "normal" | "especial";

export type DadosReceituario = {
  tipo?: TipoReceita;
  numero?: string | undefined;
  paciente: string;
  especie: string;
  raca: string;
  sexo: string;
  peso: string;
  tutor: string;
  telefoneTutor: string;
  nascimentoTutor?: string;
  cpfTutor?: string;
  enderecoTutor?: string;
  idade?: string;
  data: string;
  itens: ItemReceituario[];
  observacoes: string;
  endereco: string;
  profissional?: {
    nomeCompleto: string;
    crmv: string;
    crmvUf: string;
    mapa?: string | null;
    telefone?: string | null;
    endereco?: string | null;
    email?: string | null;
  };
  posicoesSelos: Partial<Record<TipoSelo, PosicaoSeloReceituario>>;
  selos?: Record<TipoSelo, string | null>;
  logoClinica?: string;
  nomeClinica?: string;
  papel?: PapelDocumento;
  pelagem?: string;
  castrado?: string;
  microchip?: string;
  demonstrativo?: boolean;
};

function linhasProfissional(dados: DadosRodape): string[] {
  const profissional = dados.profissional;
  if (!profissional) return ["Profissional não identificado"];
  return [
    profissional.nomeCompleto,
    `Médico-Veterinário · CRMV-${profissional.crmvUf} ${profissional.crmv}`,
    profissional.mapa ? `Registro MAPA ${profissional.mapa}` : "",
    profissional.telefone ? `Telefone: ${profissional.telefone}` : "",
    ...(dados.papel ? [profissional.endereco || "", profissional.email || ""] : []),
  ].filter(Boolean);
}

function limparPonto(texto: string) {
  return texto.trim().replace(/[.\s]+$/, "");
}

function unidadeDia(dias: string) {
  return /^(1|1[,.]0+)$/.test(dias.trim()) ? "dia" : "dias";
}

function quantidadeUnica(quantidade: string) {
  return ["1", "1,0", "1.0", "½", "1/2", "0,5", "0.5", "¼", "1/4", "⅓", "1/3"].includes(
    quantidade.trim(),
  );
}

export function frasePosologia(item: ItemReceituario) {
  if (item.posologiaEditada !== undefined) return item.posologiaEditada.trim();
  const quantidade = item.quantidade.trim();
  const forma = FORMAS_MEDICAMENTO.find((opcao) => opcao.valor === item.forma);
  const formaTexto = forma ? (quantidadeUnica(quantidade) ? forma.singular : forma.plural) : "";
  const partes: string[] = [];

  if (quantidade) partes.push(`Dar ${quantidade}${formaTexto ? ` ${formaTexto}` : ""}`);
  if (item.intervalo === "outro") {
    if (item.intervaloOutro?.trim()) partes.push(item.intervaloOutro.trim());
  } else if (item.intervalo) {
    partes.push(partes.length ? `a cada ${item.intervalo}h` : `A cada ${item.intervalo}h`);
  }
  if (item.dias.trim()) {
    partes.push(`por ${item.dias.trim()} ${unidadeDia(item.dias)}`);
  }

  const frase = partes.join(" ").trim();
  return frase ? `${frase}.` : "";
}

export function montarPosologia(item: ItemReceituario) {
  const observacao = limparPonto(item.observacao);
  return [frasePosologia(item), observacao ? `${observacao}.` : ""].filter(Boolean).join(" ");
}

export function idadePacienteReceituario(nascimento: string, idadeSalva: string, hoje: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) {
    return /^menos de 1 ano$/i.test(idadeSalva.trim()) ? "" : idadeSalva;
  }
  const [ano, mes, dia] = nascimento.split("-").map(Number);
  const nascimentoIso = new Date(`${nascimento}T00:00:00Z`);
  if (Number.isNaN(nascimentoIso.getTime()) || nascimentoIso.toISOString().slice(0, 10) !== nascimento) return "";
  const [anoAtual, mesAtual, diaAtual] = hoje.split("-").map(Number);
  const meses = (anoAtual - ano) * 12 + mesAtual - mes - Number(diaAtual < dia);
  if (meses < 0) return "";
  if (meses < 12) return meses === 1 ? "1 mês" : `${meses} meses`;
  const anos = Math.floor(meses / 12);
  return anos === 1 ? "1 ano" : `${anos} anos`;
}

const ALTURA_SELOS = 62;

export function caixaSeloReceituario(
  posicao: PosicaoSeloReceituario,
  imagem: { largura: number; altura: number },
  larguraArea: number,
  alturaArea: number,
) {
  // Usa toda a prévia e o mesmo cálculo de caixa na interface e no PDF.
  const larguraRelativa = Math.min(0.9, Math.max(0.08, posicao.largura));
  const escala = Math.min(
    (larguraArea * larguraRelativa) / imagem.largura,
    alturaArea / imagem.altura,
  );
  const largura = imagem.largura * escala;
  const altura = imagem.altura * escala;
  const x = Math.min(larguraArea - largura, Math.max(0, posicao.x * larguraArea));
  const y = Math.min(alturaArea - altura, Math.max(0, posicao.y * alturaArea));
  return { x, y, largura, altura };
}

function desenharSelo(
  doc: DocumentoPDF,
  imagem: string,
  posicao: PosicaoSeloReceituario,
  area: { x: number; y: number; largura: number; altura: number },
) {
  try {
    const props = doc.getImageProperties(imagem);
    const caixa = caixaSeloReceituario(posicao, { largura: props.width, altura: props.height }, area.largura, area.altura);
    doc.addImage(
      imagem,
      props.fileType,
      area.x + caixa.x,
      area.y + caixa.y,
      caixa.largura,
      caixa.altura,
    );
  } catch {
    // Uma imagem inválida não impede a geração do receituário.
  }
}

type DadosRodape = Pick<DadosReceituario, "tipo" | "endereco" | "data" | "profissional" | "papel">;

function layoutRodapeReceituario(doc: DocumentoPDF, dados: DadosRodape) {
  const personalizado = Boolean(dados.papel && dados.tipo !== "especial");
  const margem = personalizado ? 37 : 46;
  const larguraPagina = doc.internal.pageSize.getWidth();
  const largura = larguraPagina - margem * 2;
  const altura = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const endereco = doc.splitTextToSize(dados.endereco.trim(), largura) as string[];
  const rodapeY = personalizado ? altura - 62 : altura - margem - (Math.max(endereco.length, 1) + 1) * 12 - 8;
  doc.setFontSize(9);
  const contatos = linhasProfissional(dados).flatMap((linha) => doc.splitTextToSize(linha, largura) as string[]);
  const alturaIdentificacao = 24 + 11 * contatos.length;
  const linhaY = rodapeY - alturaIdentificacao;
  // A prévia completa do rodapé é a área interativa.
  // A reserva de conteúdo da receita permanece independente da edição.
  const topo = linhaY - 5 - ALTURA_SELOS - 23;
  const fim = rodapeY - 7;
  const areaSelos = { x: 0, y: topo, largura: larguraPagina, altura: fim - topo };
  const centro = larguraPagina / 2;
  const municipio = dados.papel ? dados.papel.clinica.municipio : "Belo Horizonte";
  const data = dados.data.trim() || new Date().toLocaleDateString("pt-BR");
  const alinhamento = personalizado ? "center" : "right";
  const textos = [
    { valor: `${municipio ? municipio + ", " : ""}${data}.`, x: personalizado ? centro : margem + largura,
      y: linhaY - 5 - ALTURA_SELOS - 10, tamanho: 10, alinhamento },
    { valor: "Assinatura do médico-veterinário", x: centro, y: linhaY + 12, tamanho: 9, alinhamento: "center" as const },
    ...contatos.map((valor, indice) => ({
      valor, x: centro, y: linhaY + 24 + indice * 11, tamanho: 9, alinhamento: "center" as const,
    })),
  ].map((texto) => {
    doc.setFontSize(texto.tamanho);
    return { ...texto, alinhamento: texto.alinhamento === "right" ? "right" as const : "center" as const,
      largura: doc.getTextWidth(texto.valor) };
  });
  return { areaSelos, margem, largura, larguraPagina, endereco, rodapeY, linhaY, centro, textos, personalizado,
    topo, fim };
}

export async function prepararPreviaRodapeReceituario(dados: DadosRodape) {
  const { jsPDF } = await import("jspdf");
  return layoutRodapeReceituario(new jsPDF({ unit: "pt", format: "a4" }), dados);
}

function sexoPacienteNoDocumento(sexo: string) {
  const valor = sexo.trim().toLocaleLowerCase("pt-BR");
  if (valor === "macho" || valor === "masculino") return "Masculino";
  if (valor === "fêmea" || valor === "femea" || valor === "feminino") return "Feminino";
  return sexo;
}

export async function criarReceituario(dados: DadosReceituario) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const rodape = layoutRodapeReceituario(doc, dados);
  const { personalizado, margem, largura, endereco, rodapeY, areaSelos } = rodape;
  const limiteConteudo = rodape.linhaY - 5 - ALTURA_SELOS - 28;
  let y = margem;

  const cabecalho = () => {
    y = margem;
    doc.setTextColor(0);
    if (dados.papel && personalizado) {
      const fator = 72 / 25.4;
      desenharPapelDocumento(doc, dados.papel);
      y = desenharIdentidadeDocumento(doc, dados.papel, margem, 23 * fator, fator);
      if (dados.papel.tema) {
        const tema = dados.papel.tema;
        const centro = doc.internal.pageSize.getWidth() / 2;
        const centralizado = tema.id === "14";
        const titulo = tema.id === "15" || tema.id === "17" ? "Receituário veterinário"
          : tema.id === "14" ? "R E C E I T U Á R I O"
          : tema.id === "13" ? "RECEITUÁRIO" : "Receituário";
        doc.setFont("times", "bold");
        doc.setFontSize(centralizado ? 22 : tema.id === "15" ? 24 : 27);
        doc.setTextColor(tema.texto);
        doc.text(titulo, centralizado ? centro : margem, y + 12, { align: centralizado ? "center" : "left" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(tema.acento);
        const legenda = centralizado ? "ATENDIMENTO CLÍNICO VETERINÁRIO" : "VETERINÁRIO";
        doc.text(legenda, centralizado ? centro : margem, y + 29, { align: centralizado ? "center" : "left" });
        y += 44;
        if (dados.demonstrativo) {
          doc.setFont("helvetica", "normal");
          doc.setTextColor("#77716e");
          doc.setFontSize(7.2);
          doc.text("PRÉVIA DEMONSTRATIVA · SEM VALIDADE", margem + largura, y + 1, { align: "right" });
          y += 14;
        }
        y = desenharIdentificacaoDocumento(doc, {
          paciente: { nome: dados.paciente, especie: dados.especie, raca: dados.raca, sexo: sexoPacienteNoDocumento(dados.sexo),
            idade: dados.idade, peso: dados.peso ? dados.peso + " kg" : "", pelagem: dados.pelagem, castrado: dados.castrado, microchip: dados.microchip },
          tutor: { nome: dados.tutor, cpf: dados.cpfTutor, telefone: dados.telefoneTutor,
            endereco: dados.enderecoTutor, nascimento: dados.nascimentoTutor },
        }, margem, y, fator, tema.acento, "receita", tema);
        y += 17;
        doc.setTextColor(0);
        if (y + 40 > limiteConteudo) throw new Error("Os dados de identificação são longos demais para o receituário. Revise o cadastro.");
        return;
      }
      if (dados.demonstrativo) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text("PRÉVIA DEMONSTRATIVA · SEM VALIDADE", margem + largura / 2, y, { align: "center" });
        y += 17;
      }
      y = desenharIdentificacaoDocumento(doc, {
        paciente: { nome: dados.paciente, especie: dados.especie, raca: dados.raca, sexo: sexoPacienteNoDocumento(dados.sexo),
          idade: dados.idade, peso: dados.peso ? dados.peso + " kg" : "", pelagem: dados.pelagem, castrado: dados.castrado, microchip: dados.microchip },
        tutor: { nome: dados.tutor, cpf: dados.cpfTutor, telefone: dados.telefoneTutor,
          endereco: dados.enderecoTutor, nascimento: dados.nascimentoTutor },
      }, margem, y, fator, dados.papel.corQuadros, "receita");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(19);
      doc.text("Receita veterinária", margem, y);
      y += 27;
      if (y + 40 > limiteConteudo) throw new Error("Os dados de identificação são longos demais para o receituário. Revise o cadastro.");
      return;
    }
    let xIdentidade = margem;
    let alturaLogo = 0;
    if (dados.logoClinica) {
      const logo = doc.getImageProperties(dados.logoClinica);
      const escala = Math.min(105 / logo.width, 49 / logo.height);
      alturaLogo = logo.height * escala;
      doc.addImage(dados.logoClinica, "PNG", margem, y - 8, logo.width * escala, alturaLogo);
      xIdentidade += logo.width * escala + 13;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    const larguraIdentidade = margem + largura - xIdentidade;
    const nomeClinica = doc.splitTextToSize(dados.nomeClinica || "Receituário veterinário", larguraIdentidade) as string[];
    nomeClinica.forEach((linha, indice) => doc.text(linha, xIdentidade, y + 8 + indice * 17));
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const linhasIdentidade = linhasProfissional(dados).flatMap((linha) => doc.splitTextToSize(linha, larguraIdentidade) as string[]);
    const inicioIdentidade = y + 22 + (nomeClinica.length - 1) * 17;
    linhasIdentidade.forEach((linha, indice) => doc.text(linha, xIdentidade, inicioIdentidade + indice * 10));
    y = Math.max(y + alturaLogo + 4, inicioIdentidade + linhasIdentidade.length * 10 + 4);
    doc.setDrawColor(20, 130, 116);
    doc.setLineWidth(1.2);
    doc.line(margem, y, margem + largura, y);
    y += 28;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(dados.tipo === "especial" ? "RECEITA DE CONTROLE ESPECIAL" : "RECEITUÁRIO VETERINÁRIO", margem, y);
    if (dados.tipo === "especial" && dados.numero) {
      doc.setFontSize(10);
      doc.text(`Nº ${dados.numero}`, margem + largura, y, { align: "right" });
    }
    y += 22;
    if (dados.demonstrativo) {
      doc.setFontSize(9);
      doc.setTextColor("#612b40");
      doc.text("PRÉVIA DEMONSTRATIVA · SEM VALIDADE", margem, y);
      y += 13;
    }

    y = desenharIdentificacaoDocumento(doc, {
      paciente: { nome: dados.paciente, especie: dados.especie, raca: dados.raca, sexo: sexoPacienteNoDocumento(dados.sexo),
        idade: dados.idade, peso: dados.peso ? dados.peso + " kg" : "", pelagem: dados.pelagem, castrado: dados.castrado, microchip: dados.microchip },
      tutor: { nome: dados.tutor, cpf: dados.cpfTutor, telefone: dados.telefoneTutor,
        endereco: dados.enderecoTutor, nascimento: dados.nascimentoTutor },
    }, margem, y, 72 / 25.4, undefined, "receita");
    if (y + 40 > limiteConteudo) throw new Error("Os dados de identificação são longos demais para o receituário. Revise o cadastro.");
  };

  const novaPagina = () => {
    doc.addPage();
    cabecalho();
  };

  const escrever = (texto: string, recuo = 0, negrito = false) => {
    doc.setFont("helvetica", negrito ? "bold" : "normal");
    doc.setFontSize(11);
    const linhas = doc.splitTextToSize(texto, largura - recuo) as string[];
    linhas.forEach((linha) => {
      if (y + 16 > limiteConteudo) novaPagina();
      doc.setFont("helvetica", negrito ? "bold" : "normal");
      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.text(linha, margem + recuo, y);
      y += 16;
    });
  };

  cabecalho();
  escrever("Prescrição", 0, true);
  y += 7;
  dados.itens
    .filter((item) => item.medicamento.trim())
    .forEach((item, indice) => {
      if (y + 52 > limiteConteudo) novaPagina();
      const nome = item.medicamento.trim();
      const rotuloMedicamento = String(indice + 1) + ". " + nome;
      const apresentacao = item.apresentacao.trim();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const larguraApresentacao = apresentacao ? doc.getTextWidth(apresentacao) : 0;
      const espacoNome = Math.max(
        100,
        largura - larguraApresentacao - (apresentacao ? 62 : 50),
      );
      const linhasNome = doc.splitTextToSize(rotuloMedicamento, espacoNome) as string[];
      linhasNome.forEach((linha, linhaIndice) => {
        if (y + 16 > limiteConteudo) novaPagina();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(linha, margem, y);
        if (linhaIndice === 0) {
          const inicioTraco = margem + doc.getTextWidth(linha) + 6;
          const fimTraco = apresentacao
            ? margem + largura - larguraApresentacao - 8
            : margem + largura - 4;
          if (fimTraco - inicioTraco >= 18) {
            doc.setDrawColor(0);
            doc.setLineWidth(0.5);
            doc.line(inicioTraco, y + 2, fimTraco, y + 2);
          }
          if (apresentacao) {
            doc.text(apresentacao, margem + largura, y, { align: "right" });
          }
        }
        y += 16;
      });
      const posologia = montarPosologia(item);
      if (posologia) escrever(posologia, 18);
      y += 12;
    });

  if (dados.observacoes.trim()) {
    if (y + 48 > limiteConteudo) novaPagina();
    escrever("Orientações gerais", 0, true);
    y += 5;
    escrever(dados.observacoes.trim());
  }

  const paginaFinal = doc.getNumberOfPages();
  doc.setPage(paginaFinal);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  for (const texto of rodape.textos) {
    doc.setFontSize(texto.tamanho);
    doc.text(texto.valor, texto.x, texto.y, { align: texto.alinhamento });
  }
  doc.setDrawColor(90);
  doc.setLineWidth(0.5);
  doc.line(rodape.centro - 80, rodape.linhaY, rodape.centro + 80, rodape.linhaY);

  const { assinatura, carimbo } = dados.demonstrativo
    ? { assinatura: null, carimbo: null }
    : dados.selos ?? await lerSelos();
  if (assinatura && dados.posicoesSelos.assinatura) {
    desenharSelo(doc, assinatura, dados.posicoesSelos.assinatura, areaSelos);
  }
  if (carimbo && dados.posicoesSelos.carimbo) {
    desenharSelo(doc, carimbo, dados.posicoesSelos.carimbo, areaSelos);
  }
  if (personalizado) return doc;

  for (let pagina = 1; pagina <= doc.getNumberOfPages(); pagina++) {
    doc.setPage(pagina);
    doc.setDrawColor(20, 130, 116);
    doc.setLineWidth(0.8);
    doc.line(margem, rodapeY, margem + largura, rodapeY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    endereco.forEach((linha, indice) =>
      doc.text(linha, margem + largura / 2, rodapeY + 14 + indice * 12, {
        align: "center",
      }),
    );
    doc.text(
      dados.profissional?.telefone ? "Telefone do médico-veterinário: " + dados.profissional.telefone : "",
      margem + largura / 2,
      rodapeY + 14 + Math.max(endereco.length, 1) * 12,
      { align: "center" },
    );
  }
  return doc;
}

export async function baixarReceituario(dados: DadosReceituario) {
  const doc = await criarReceituario(dados);
  const paciente = dados.paciente.trim().replace(/\s+/g, "-").toLowerCase();
  const nomeArquivo = (dados.tipo === "especial" ? "receita-controle-especial" : "receituario") + "-" + (paciente || "oricse") + ".pdf";
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const animalId = params.get("animalId") || "";
  const preferencia = lerPreferenciaReceitaPortal();
  const motivoOcultacao = motivoFinalReceitaPortal(preferencia);

  if (animalId && !preferencia.enviar && !motivoOcultacao) {
    throw new Error("Selecione o motivo para não disponibilizar a receita no Portal do Tutor.");
  }

  doc.save(nomeArquivo);
  if (!animalId) return;

  const { data: sessao } = await supabase.auth.getSession();
  const accessToken = sessao.session?.access_token;
  if (!accessToken) throw new Error("Receita baixada, mas a sessão expirou antes do envio ao Portal do Tutor.");

  const { data: contexto, error: contextoError } = await (supabase as any).rpc("oricse_contexto_clinica_atual");
  if (contextoError) throw contextoError;
  const clinicaId = String((Array.isArray(contexto) ? contexto[0] : contexto)?.clinica_id || "");
  if (!clinicaId) throw new Error("Receita baixada, mas a clínica atual não foi identificada.");

  const { data: animalDb, error: animalError } = await (supabase as any)
    .from("oricse_animais")
    .select("id,tutor_id")
    .eq("id", animalId)
    .eq("clinica_id", clinicaId)
    .maybeSingle();
  if (animalError || !animalDb?.id || !animalDb?.tutor_id) {
    throw new Error("Receita baixada, mas o animal ainda não está sincronizado com o banco do Portal do Tutor.");
  }

  const receitaId = crypto.randomUUID();
  const base64 = doc.output("datauristring");
  const upload = await enviarArquivoDrive({ data: {
    accessToken,
    clinicaId,
    categoria: "receitas",
    nome: nomeArquivo,
    mimeType: "application/pdf",
    base64,
    visibilidade: preferencia.enviar ? "tutor" : "interno",
    entidadeTipo: "receita",
    entidadeId: receitaId,
    metadata: { animalId, tutorId: animalDb.tutor_id, tipo: dados.tipo || "normal" },
  }});
  if (!upload?.registroId) throw new Error("Receita baixada, mas o PDF não pôde ser vinculado ao Portal do Tutor.");

  const resumo = dados.itens.filter((item) => item.medicamento.trim()).map((item) => item.medicamento.trim()).join(", ");
  const { error: receitaError } = await (supabase as any).from("oricse_portal_receitas").insert({
    id: receitaId,
    clinica_id: clinicaId,
    animal_id: animalDb.id,
    tutor_id: animalDb.tutor_id,
    drive_arquivo_id: upload.registroId,
    tipo: dados.tipo || "normal",
    numero: dados.numero || null,
    titulo: dados.tipo === "especial" ? "Receita de controle especial" : "Receita veterinária",
    emitida_em: new Date().toISOString().slice(0,10),
    resumo: resumo || null,
    visivel_tutor: preferencia.enviar,
    motivo_ocultacao: preferencia.enviar ? null : motivoOcultacao,
    motivo_outro: preferencia.motivo === "Outro" ? preferencia.outro.trim() || null : null,
  });
  if (receitaError) throw new Error("Receita baixada, mas falhou o registro no Portal do Tutor: " + receitaError.message);
}
