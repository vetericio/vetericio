type Endereco = {
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  estado?: string | null;
  cep?: string | null;
};

function enderecoCompleto(dados: Endereco): string {
  const rua = [dados.endereco, dados.numero].filter(Boolean).join(", ");
  const cidadeUf = [dados.cidade, dados.uf || dados.estado].filter(Boolean).join("/");
  return [rua, dados.complemento, dados.bairro, cidadeUf, dados.cep ? "CEP " + dados.cep : ""]
    .map((parte) => String(parte || "").trim()).filter(Boolean).join(" · ");
}

export async function resolverDadosReceituario(data: { accessToken: string; animalId?: string; tutorId?: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: autenticacao, error: erroAuth } = await supabaseAdmin.auth.getUser(data.accessToken);
  if (erroAuth || !autenticacao.user) throw new Error("Sua sessão expirou. Entre novamente.");
  const userId = autenticacao.user.id;
  const { data: perfil, error: erroPerfil } = await supabaseAdmin
    .from("app_users").select("role").eq("user_id", userId).maybeSingle();
  if (erroPerfil) throw new Error("Não foi possível confirmar a conta autenticada.");
  const admin = perfil?.role === "admin";

  // O identificador do animal determina a clínica; IDs fornecidos na URL não autorizam acesso.
  const { data: animal, error: erroAnimal } = data.animalId
    ? await supabaseAdmin.from("oricse_animais")
        .select("id,clinica_id,tutor_id,nome,especie,raca,sexo,nascimento,peso_kg,dados")
        .eq("id", data.animalId).maybeSingle()
    : { data: null, error: null };
  if (erroAnimal) throw new Error("Não foi possível consultar o cadastro do animal.");
  if (data.animalId && !animal) throw new Error("Animal não encontrado.");

  const { data: tutorBusca, error: erroTutorBusca } = !animal && data.tutorId
    ? await supabaseAdmin.from("tutores")
        .select("id,clinica_id,nome,telefone,cpf,dados")
        .eq("id", data.tutorId).maybeSingle()
    : { data: null, error: null };
  if (erroTutorBusca) throw new Error("Não foi possível consultar o tutor.");
  if (data.tutorId && !animal && !tutorBusca) throw new Error("Tutor não encontrado.");

  let clinicaId = animal?.clinica_id || tutorBusca?.clinica_id || null;
  if (!clinicaId) {
    const { data: selecionada, error: erroSelecionada } = await supabaseAdmin
      .from("oricse_clinica_ativa_usuario").select("clinica_id")
      .eq("user_id", userId).maybeSingle();
    if (erroSelecionada) throw new Error("Não foi possível localizar a clínica selecionada.");
    clinicaId = selecionada?.clinica_id || null;
  }
  if (!clinicaId) {
    const { data: vinculos, error: erroVinculos } = await supabaseAdmin
      .from("clinica_usuarios").select("clinica_id")
      .eq("user_id", userId).eq("ativo", true).limit(2);
    if (erroVinculos) throw new Error("Não foi possível consultar os vínculos da clínica.");
    if (vinculos?.length === 1) clinicaId = vinculos[0].clinica_id;
  }
  if (!clinicaId) {
    if (data.animalId || data.tutorId) throw new Error("Clínica do atendimento não identificada.");
    return { clinicaId: "", clinicaNome: "", clinicaEndereco: "", animal: null, tutor: null, tutorId: "" };
  }

  const { data: vinculo, error: erroVinculo } = await supabaseAdmin
    .from("clinica_usuarios").select("ativo")
    .eq("user_id", userId).eq("clinica_id", clinicaId).eq("ativo", true).maybeSingle();
  if (erroVinculo || (!admin && !vinculo))
    throw new Error("Você não possui acesso à clínica deste atendimento.");

  const { data: clinica, error: erroClinica } = await supabaseAdmin
    .from("clinicas").select("id,nome,status,excluido_em").eq("id", clinicaId).maybeSingle();
  if (erroClinica || !clinica || clinica.excluido_em || clinica.status !== "ativa")
    throw new Error("Clínica indisponível para emissão de receitas.");

  const tutorId = animal?.tutor_id || tutorBusca?.id || null;
  if (data.tutorId && tutorId && data.tutorId !== tutorId)
    throw new Error("O tutor informado não pertence ao animal deste atendimento.");

  const { data: tutor, error: erroTutor } = tutorId
    ? await supabaseAdmin.from("tutores")
        .select("id,clinica_id,nome,telefone,cpf,dados")
        .eq("id", tutorId).eq("clinica_id", clinicaId).maybeSingle()
    : { data: null, error: null };
  if (erroTutor || (tutorId && !tutor))
    throw new Error("Não foi possível confirmar o vínculo do tutor com a clínica.");

  const [contratacoes, site] = await Promise.all([
    supabaseAdmin.from("oricse_contratacoes")
      .select("clinica_endereco,clinica_numero,clinica_complemento,clinica_bairro,clinica_cidade,clinica_uf,clinica_cep")
      .eq("clinica_criada_id", clinicaId)
      .is("excluido_em", null)
      .order("created_at", { ascending: false }).limit(5),
    supabaseAdmin.from("clinic_sites")
      .select("config").eq("clinica_id", clinicaId).maybeSingle(),
  ]);
  if (contratacoes.error) throw new Error("Não foi possível consultar o endereço cadastrado da clínica.");
  const contrato = (contratacoes.data || []).find((item) => String(item.clinica_endereco || "").trim());
  const enderecoCadastro = contrato ? enderecoCompleto({
    endereco: contrato.clinica_endereco,
    numero: contrato.clinica_numero,
    complemento: contrato.clinica_complemento,
    bairro: contrato.clinica_bairro,
    cidade: contrato.clinica_cidade,
    uf: contrato.clinica_uf,
    cep: contrato.clinica_cep,
  }) : "";
  // O site publicado serve somente como alternativa quando a contratação não possui endereço.
  const config = (site.data?.config || {}) as Record<string, unknown>;
  const clinicaEndereco = enderecoCadastro || String(config.address || "").trim();

  const dadosAnimal = (animal?.dados || {}) as Record<string, unknown>;
  const dadosTutor = (tutor?.dados || {}) as Record<string, unknown>;
  const string = (valor: unknown) => typeof valor === "string" ? valor.trim() : valor == null ? "" : String(valor);
  return {
    clinicaId,
    clinicaNome: clinica.nome,
    clinicaEndereco,
    animal: animal ? {
      id: animal.id,
      nome: string(animal.nome),
      especie: string(animal.especie),
      raca: string(animal.raca),
      sexo: string(animal.sexo),
      peso: string(animal.peso_kg ?? dadosAnimal.peso),
      idade: string(dadosAnimal.idade),
      nascimento: string(animal.nascimento),
      pelagem: string(dadosAnimal.pelagem || dadosAnimal.cor),
      microchip: string(dadosAnimal.microchip),
    } : null,
    tutor: tutor ? {
      id: tutor.id,
      nome: string(tutor.nome),
      nascimento: string(dadosTutor.nascimento || dadosTutor.dataNascimento || dadosTutor.data_nascimento),
      telefone: string(tutor.telefone || dadosTutor.telefone || dadosTutor.outroTelefone),
      cpf: string(tutor.cpf || dadosTutor.cpfCnpj),
      enderecoCompleto: Boolean(
        string(dadosTutor.endereco) && string(dadosTutor.numero) && string(dadosTutor.bairro) &&
        string(dadosTutor.cidade) && string(dadosTutor.uf || dadosTutor.estado) && string(dadosTutor.cep),
      ),
      endereco: enderecoCompleto({
        endereco: string(dadosTutor.endereco),
        numero: string(dadosTutor.numero),
        complemento: string(dadosTutor.complemento),
        bairro: string(dadosTutor.bairro),
        cidade: string(dadosTutor.cidade),
        uf: string(dadosTutor.uf || dadosTutor.estado),
        cep: string(dadosTutor.cep),
      }),
    } : null,
    tutorId: tutor?.id || "",
  };
}

