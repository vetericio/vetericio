export type DadosContrato = Record<string, string>;

export function extrairCamposContrato(conteudo: string) {
  const encontrados = new Set<string>();
  const regex = /{{\s*([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ0-9_-]{1,80})\s*}}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(conteudo))) encontrados.add(match[1]);
  return [...encontrados];
}

export function rotuloCampoContrato(campo: string) {
  return campo.replaceAll("_", " ").replace(/\b\w/g, (letra) => letra.toUpperCase());
}

function valorParaDocumento(campo: string, valor: string | undefined) {
  if (!valor) return "";
  if (campo.toLowerCase().includes("data") && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [ano, mes, dia] = valor.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return valor;
}

export function preencherModeloContrato(conteudo: string, dados: DadosContrato) {
  return conteudo.replace(
    /{{\s*([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ0-9_-]{1,80})\s*}}/g,
    (_texto, campo: string) => valorParaDocumento(campo, dados[campo]),
  );
}

export function nomeSeguroContrato(nome: string) {
  return (
    nome
      .trim()
      .replace(/[^a-zA-ZÀ-ÿ0-9 _-]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 100) || "Contrato"
  );
}

export async function gerarPdfContrato(titulo: string, conteudo: string, dados: DadosContrato) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margem = 54;
  const largura = 595.28;
  const larguraTexto = largura - margem * 2;
  const linhas = doc.splitTextToSize(
    preencherModeloContrato(conteudo, dados),
    larguraTexto,
  ) as string[];
  doc.setTextColor(74, 24, 38);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(titulo, margem, 62);
  doc.setDrawColor(190, 146, 158);
  doc.line(margem, 78, largura - margem, 78);
  doc.setTextColor(45, 34, 39);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  let y = 105;
  for (const linha of linhas) {
    if (y > 790) {
      doc.addPage();
      y = 54;
    }
    doc.text(linha, margem, y);
    y += 16;
  }
  doc.setFontSize(8);
  doc.setTextColor(125, 111, 117);
  doc.text("Documento gerado pela Oricse — versão sem assinatura", margem, 815);
  return `data:application/pdf;base64,${doc.output("datauristring").split(",")[1] || ""}`;
}

export function baixarPdfContrato(dataUri: string, nomeArquivo: string) {
  const link = document.createElement("a");
  link.href = dataUri;
  link.download = nomeArquivo;
  link.click();
}

export function lerArquivoComoDataUri(arquivo: File) {
  return new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result || ""));
    leitor.onerror = () => reject(new Error("Não foi possível ler o PDF."));
    leitor.readAsDataURL(arquivo);
  });
}
