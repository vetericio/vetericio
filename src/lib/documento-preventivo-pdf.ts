import { dataDoRotulo, dataPreventivaBR, fimDaValidade, hojeNoBrasil } from "@/lib/dados-preventivos";
import { criarPdfComModelo, type PapelDocumento } from "@/lib/modelos-documentos-pdf";
import { formatarDataDocumento } from "@/lib/modelos-documentos";
import type { obterDocumentoPreventivo } from "@/lib/documento-preventivo.functions";

export type DadosDocumentoPreventivo = Awaited<ReturnType<typeof obterDocumentoPreventivo>>;

export async function criarDocumentoPreventivoPdf(dados: DadosDocumentoPreventivo, identificacao: {
  municipio: string; razaoSocial: string; cnpj: string; endereco: string; crmv: string; inscricaoEstadual: string;
  enderecoProfissional: string; telefoneProfissional: string; emailProfissional: string; comEstabelecimento: boolean;
}, papel?: PapelDocumento, orientacoes = "") {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const vacina = dados.tipo === "vacina";
  const titulo = vacina ? "Atestado de vacinação" : "Comprovante de vermifugação";
  const hoje = dataPreventivaBR(hojeNoBrasil());
  const { paciente, tutor, profissional, ato } = dados;
  const rotulo = (data: string) => {
    const iso = dataDoRotulo(data);
    return iso ? dataPreventivaBR(iso) : "";
  };

  const validade = dataDoRotulo(ato.validade);
  const observacaoValidade = validade && ato.data > fimDaValidade(validade)
    ? "A data registrada é posterior à validade informada para o produto." : "";
  if (papel) {
    const papelFinal = identificacao.comEstabelecimento ? { ...papel, clinica: {
      ...papel.clinica, razaoSocial: identificacao.razaoSocial, cnpj: identificacao.cnpj,
      crmv: identificacao.crmv, endereco: identificacao.endereco,
    } } : null;
    const itens = [
      ["Data da aplicação", rotulo(ato.data)], ["Horário", ato.hora_aplicacao.slice(0, 5)], ["Local", ato.local_aplicacao],
      [vacina ? "Nome comercial da vacina" : "Produto administrado", ato.nome],
      ["Vacinação contra", ato.alvo_vacinacao], ["Princípio ativo", ato.principio_ativo],
      ["Fabricante", ato.fabricante], ["Lote / partida", ato.lote], ["Dose aplicada", ato.dose], ["Via", ato.via],
      ["Fabricação", rotulo(ato.fabricacao)], ["Validade", rotulo(ato.validade)],
      [vacina ? "Revacinação prevista" : "Próxima dose prevista", rotulo(ato.retorno)],
      ["Observações", [ato.observacoes, observacaoValidade].filter(Boolean).join("\n")],
      ["Orientações adicionais", orientacoes.trim()],
      ["Inscrição estadual", identificacao.comEstabelecimento ? identificacao.inscricaoEstadual : ""],
    ];
    return criarPdfComModelo({
      titulo, papel: papelFinal, fundoSemIdentidade: papelFinal ? null : papel,
      identificacao: {
        paciente: {
          ...paciente, idade: paciente.idade || formatarDataDocumento(paciente.nascimento),
          peso: paciente.peso ? paciente.peso + " kg" : "",
          outros: [paciente.sinais, paciente.tatuagem && "Tatuagem: " + paciente.tatuagem,
            paciente.brinco && "Brinco: " + paciente.brinco, paciente.registro && "Registro: " + paciente.registro].filter(Boolean).join(" · "),
        },
        tutor: { ...tutor, nascimento: formatarDataDocumento(tutor.nascimento) },
      },
      conteudo: [
        vacina ? "Atesto que realizei o ato vacinal descrito abaixo no animal identificado neste documento."
          : "Declaro que o procedimento abaixo foi realizado no animal identificado neste documento.",
        "",
        ...itens.filter(([, valor]) => valor).map(([nome, valor]) => `${nome}: ${valor}`),
        "", "Uma via para o responsável pelo animal e uma via para o prontuário.",
      ].join("\n"),
      assinatura: [
        `${identificacao.municipio}, ${hoje}`, `${profissional.nome} · CRMV-${profissional.uf} ${profissional.crmv}`,
        [identificacao.enderecoProfissional, identificacao.telefoneProfissional, identificacao.emailProfissional].filter(Boolean).join(" · "),
      ],
    });
  }

  let y = 19;
  function iniciarPagina() { y = 19; }
  function linha(texto: string, negrito = false, tamanho = 10.5) {
    pdf.setFont("helvetica", negrito ? "bold" : "normal");
    pdf.setFontSize(tamanho);
    for (const trecho of pdf.splitTextToSize(texto, 174) as string[]) {
      if (y > 274) { pdf.addPage(); iniciarPagina(); }
      pdf.setFont("helvetica", negrito ? "bold" : "normal");
      pdf.setFontSize(tamanho);
      pdf.text(trecho, 18, y);
      y += tamanho >= 15 ? 8 : 5.2;
    }
  }
  function grupo(nome: string, itens: [string, string][]) {
    y += 3;
    linha(nome, true, 11);
    for (const [rotulo, valor] of itens) {
      if (valor) linha(`${rotulo}: ${valor}`);
    }
  }

  iniciarPagina();
  pdf.setProperties({ title: titulo });
  linha(titulo, true, 18);
  linha("Para assinatura do médico-veterinário", true);
  y += 2;
  linha(vacina
    ? "Atesto que realizei o ato vacinal descrito abaixo no animal identificado neste documento."
    : "Declaro que o procedimento abaixo foi realizado no animal identificado neste documento.");
  grupo("Animal", [
    ["Nome", paciente.nome], ["Espécie / raça / sexo", [paciente.especie, paciente.raca, paciente.sexo].join(" / ")],
    ["Nascimento", paciente.nascimento ? dataPreventivaBR(paciente.nascimento) : ""], ["Idade informada", paciente.idade],
    ["Pelagem ou plumagem", paciente.pelagem], ["Microchip", paciente.microchip],
    ["Sinais particulares", paciente.sinais], ["Tatuagem", paciente.tatuagem], ["Brinco", paciente.brinco], ["Registro genealógico", paciente.registro],
  ]);
  grupo("Responsável pelo animal", [["Nome completo", tutor.nome], ["CPF", tutor.cpf], ["Endereço", tutor.endereco]]);
  grupo(vacina ? "Ato vacinal" : "Administração do vermífugo", [
    ["Data da aplicação", rotulo(ato.data)], ["Horário", ato.hora_aplicacao.slice(0, 5)], ["Local", ato.local_aplicacao],
    [vacina ? "Nome comercial da vacina" : "Produto administrado", ato.nome],
    ["Vacinação contra", ato.alvo_vacinacao], ["Princípio ativo", ato.principio_ativo],
    ["Fabricante", ato.fabricante], ["Lote / partida", ato.lote], ["Dose aplicada", ato.dose], ["Via", ato.via],
    ["Fabricação", rotulo(ato.fabricacao)], ["Validade", rotulo(ato.validade)],
    [vacina ? "Revacinação prevista" : "Próxima dose prevista", rotulo(ato.retorno)], ["Observações", [ato.observacoes, observacaoValidade].filter(Boolean).join("\n")],
  ]);
  if (orientacoes.trim()) grupo("Orientações adicionais", [["Orientações", orientacoes]]);
  grupo("Médico-veterinário responsável", [
    ["Nome completo", profissional.nome], ["Inscrição", `CRMV-${profissional.uf} ${profissional.crmv}`],
    ["Endereço profissional", identificacao.enderecoProfissional], ["Telefone", identificacao.telefoneProfissional], ["E-mail", identificacao.emailProfissional],
  ]);
  if (identificacao.comEstabelecimento) grupo("Estabelecimento", [
    ["Razão social", identificacao.razaoSocial], ["CNPJ", identificacao.cnpj], ["Endereço", identificacao.endereco],
    ["Registro no CRMV", identificacao.crmv], ["Inscrição estadual", identificacao.inscricaoEstadual],
  ]);
  if (y > 241) { pdf.addPage(); iniciarPagina(); }
  y += 5;
  linha(`${identificacao.municipio}, ${hoje}`);
  y += 6;
  linha("________________________________________");
  linha("Assinatura do médico-veterinário");
  y += 3;
  linha("Uma via para o responsável pelo animal e uma via para o prontuário.");
  return pdf;
}
