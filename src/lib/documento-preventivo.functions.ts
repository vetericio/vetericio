import { contaDemoAlvorada, exigirEmissaoDisponivel } from "@/lib/demo-alvorada";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizarCamposPreventivos, pendenciasPreventivo, selecaoPreventivos } from "@/lib/dados-preventivos";
import { exigirPermissaoClinica } from "@/lib/permissao-clinica.server";

const schema = z.object({
  accessToken: z.string().min(20),
  clinicaId: z.string().uuid(),
  animalId: z.string().uuid(),
  registroId: z.string().uuid(),
  tipo: z.enum(["vacina", "vermifugo"]),
});
const texto = (valor: unknown) => typeof valor === "string" ? valor.trim() : "";
const objeto = (valor: unknown): Record<string, unknown> =>
  valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
const normalizarCrmv = (valor: unknown) => texto(valor).toUpperCase().replace(/[^A-Z0-9]/g, "");

export const obterDocumentoPreventivo = createServerFn({ method: "POST" })
  .validator((entrada: unknown) => schema.parse(entrada))
  .handler(async ({ data }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: { user }, error: erroSessao } = await admin.auth.getUser(data.accessToken);
    if (erroSessao || !user) throw new Error("Entre novamente para preparar o documento.");
    exigirEmissaoDisponivel(contaDemoAlvorada(user));
    await exigirPermissaoClinica(admin, user.id, data.clinicaId, ["consultorio.atendimentos"], data.accessToken);
    const { data: vinculo, error: erroVinculo } = await admin.from("clinica_usuarios").select("papel")
      .eq("clinica_id", data.clinicaId).eq("user_id", user.id).eq("ativo", true).maybeSingle();
    if (erroVinculo || !["rt", "veterinario"].includes(vinculo?.papel || "")) {
      throw new Error("O documento deve ser preparado pelo médico-veterinário responsável, com vínculo ativo na clínica.");
    }
    const vacina = data.tipo === "vacina";
    const consulta = vacina
      ? admin.from("oricse_portal_vacinas").select(`nome,lote,observacoes,aplicada_em,reforco_em,alvo_vacinacao,${selecaoPreventivos}`)
      : admin.from("oricse_portal_vermifugos").select(`nome,lote,observacoes,administrado_em,proxima_dose_em,principio_ativo,via,${selecaoPreventivos}`);
    const [registro, animal, perfil, conta, contrato] = await Promise.all([
      consulta.eq("id", data.registroId).eq("clinica_id", data.clinicaId).eq("animal_id", data.animalId).maybeSingle(),
      admin.from("oricse_animais").select("dados").eq("clinica_id", data.clinicaId).eq("id", data.animalId).maybeSingle(),
      admin.from("oricse_pessoas").select("nome_completo,crmv,crmv_uf,telefone,endereco").eq("user_id", user.id).maybeSingle(),
      admin.from("app_users").select("email").eq("user_id", user.id).maybeSingle(),
      admin.from("oricse_contratacoes").select("razao_social,cnpj,clinica_cidade,clinica_uf,dados")
        .eq("clinica_criada_id", data.clinicaId).is("excluido_em", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (registro.error || !registro.data || animal.error || !animal.data) throw new Error("Registro preventivo não localizado nesta ficha.");
    if (perfil.error || !perfil.data) throw new Error("Complete o cadastro pessoal do médico-veterinário.");
    if (conta.error) throw new Error("Não foi possível consultar o e-mail do médico-veterinário.");
    if (contrato.error) throw new Error("Não foi possível consultar os dados do estabelecimento.");

    const { resolverDadosReceituario } = await import("@/lib/receituario-contexto.server");
    const ficha = await resolverDadosReceituario({ accessToken: data.accessToken, animalId: data.animalId });
    if (!ficha.animal || !ficha.tutor || ficha.clinicaId !== data.clinicaId) throw new Error("Não foi possível confirmar o animal e seu responsável.");
    const linha = objeto(registro.data);
    const ato = {
      ...normalizarCamposPreventivos(linha as Parameters<typeof normalizarCamposPreventivos>[0]),
      nome: texto(linha.nome), lote: texto(linha.lote), observacoes: texto(linha.observacoes),
      data: texto(vacina ? linha.aplicada_em : linha.administrado_em),
      retorno: texto(vacina ? linha.reforco_em : linha.proxima_dose_em),
    };
    const pendencias = pendenciasPreventivo(data.tipo, ato);
    const profissional = {
      nome: texto(perfil.data.nome_completo),
      crmv: texto(perfil.data.crmv),
      uf: texto(perfil.data.crmv_uf).toUpperCase(),
      telefone: texto(perfil.data.telefone),
      endereco: texto(perfil.data.endereco),
      email: [conta.data?.email, user.email].map(texto).find((email) => email && !email.toLowerCase().endsWith("@vetericio.local")) || "",
    };
    if (!normalizarCrmv(profissional.crmv) || normalizarCrmv(profissional.crmv) !== normalizarCrmv(ato.veterinario_crmv)
      || profissional.uf !== ato.veterinario_uf) {
      throw new Error("Entre com a conta do veterinário que realizou o procedimento. O CRMV deve coincidir com o registro.");
    }

    const dadosAnimal = objeto(animal.data.dados);
    const dadosClinica = objeto(contrato.data?.dados);
    const estabelecimento = {
      nome: texto(contrato.data?.razao_social) || ficha.clinicaNome,
      cnpj: texto(contrato.data?.cnpj),
      endereco: ficha.clinicaEndereco,
      municipio: [texto(contrato.data?.clinica_cidade), texto(contrato.data?.clinica_uf)].filter(Boolean).join("/"),
      inscricaoEstadual: texto(dadosClinica.inscricao_estadual || dadosClinica.clinica_inscricao_estadual),
      crmv: texto(dadosClinica.registro_crmv_estabelecimento || dadosClinica.clinica_crmv),
    };
    const paciente = {
      ...ficha.animal,
      pelagem: [texto(dadosAnimal.cor), texto(dadosAnimal.pelagem)].filter(Boolean).join(" · "),
      microchip: texto(dadosAnimal.microchip),
      sinais: texto(dadosAnimal.sinaisParticulares || dadosAnimal.sinais_particulares),
      tatuagem: texto(dadosAnimal.tatuagem),
      brinco: texto(dadosAnimal.brinco),
      registro: texto(dadosAnimal.registroGenealogico || dadosAnimal.registro_genealogico),
    };
    const dadosObrigatorios: [string, string][] = [
      ["nome do animal", paciente.nome], ["espécie do animal", paciente.especie], ["raça do animal", paciente.raca],
      ["sexo do animal", paciente.sexo], ["nascimento ou idade do animal", paciente.nascimento || paciente.idade],
      ["pelagem ou plumagem", paciente.pelagem], ["nome do tutor", ficha.tutor.nome],
      ["CPF do tutor", /^\d{11}$/.test(ficha.tutor.cpf.replace(/\D/g, "")) ? ficha.tutor.cpf : ""],
      ["endereço completo do tutor", ficha.tutor.enderecoCompleto ? ficha.tutor.endereco : ""],
      ["nome no cadastro profissional", profissional.nome],
    ];
    pendencias.push(...dadosObrigatorios.filter(([, valor]) => !valor).map(([rotulo]) => rotulo));
    if (pendencias.length) throw new Error("Complete ou confira: " + pendencias.join(", ") + ".");
    return { tipo: data.tipo, ato, profissional, paciente, tutor: ficha.tutor, estabelecimento };
  });

/**
 * Captura a data/hora da gravação e o município do contrato da clínica ativa.
 * Não recebe local nem horário do formulário, evitando dados digitados arbitrariamente.
 */
const momentoAplicacaoSchema = z.object({
  accessToken: z.string().min(20),
  clinicaId: z.string().uuid(),
});

export const obterMomentoLocalAplicacao = createServerFn({ method: "POST" })
  .validator((entrada: unknown) => momentoAplicacaoSchema.parse(entrada))
  .handler(async ({ data }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: sessao, error: erroSessao } = await admin.auth.getUser(data.accessToken);
    if (erroSessao || !sessao.user) throw new Error("Sua sessão expirou. Entre novamente.");
    await exigirPermissaoClinica(admin, sessao.user.id, data.clinicaId, ["consultorio.atendimentos"], data.accessToken);

    const { data: contrato, error: erroContrato } = await admin.from("oricse_contratacoes")
      .select("clinica_cidade,clinica_uf")
      .eq("clinica_criada_id", data.clinicaId)
      .is("excluido_em", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (erroContrato) throw new Error("Não foi possível consultar a cidade da clínica.");
    const cidade = texto(contrato?.clinica_cidade);
    const uf = texto(contrato?.clinica_uf).toUpperCase();
    if (!cidade) throw new Error("Cadastre a cidade da clínica antes de registrar a aplicação.");

    const agora = new Date();
    const zona = "America/Sao_Paulo";
    const dataAplicacao = new Intl.DateTimeFormat("sv-SE", {
      timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(agora);
    const horaAplicacao = new Intl.DateTimeFormat("pt-BR", {
      timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(agora);
    return {
      data: dataAplicacao,
      hora: horaAplicacao,
      local: [cidade, uf].filter(Boolean).join("/"),
      registradoEm: agora.toISOString(),
    };
  });
