export const CAMPOS_CONVITE = [
  { chave: "nome_tutor", rotulo: "Nome do tutor" },
  { chave: "nome_clinica", rotulo: "Nome da clínica" },
  { chave: "link_portal", rotulo: "Link do Portal do Tutor" },
  { chave: "usuario_tutor", rotulo: "@ do tutor" },
  { chave: "codigo_ativacao", rotulo: "Código de ativação" },
  { chave: "recuperar_senha", rotulo: "Como recuperar a senha" },
] as const;

type CampoConvite = (typeof CAMPOS_CONVITE)[number]["chave"];
export type DadosConvite = Record<Exclude<CampoConvite, "recuperar_senha">, string>;

export const LIMITE_MODELO_CONVITE = 2000;
export const INSTRUCOES_RECUPERACAO = 'Se precisar redefinir sua senha, selecione “Esqueci minha senha” no portal. Informe seu @, CPF e data de nascimento, depois confirme qual dos animais é seu.';

export const MODELO_CONVITE_PADRAO = `Olá, {{nome_tutor}}!

É um prazer ter você com a gente na {{nome_clinica}}. Preparamos um espaço para você acompanhar os cuidados com seus animais.

Acesse o Portal do Tutor em {{link_portal}} e selecione “Ativar primeiro acesso”.
Seu usuário é {{usuario_tutor}} e seu código de ativação é {{codigo_ativacao}}.

{{recuperar_senha}}

Se precisar de ajuda, é só responder por aqui. Até breve!`;

export function camposAusentes(modelo: string) {
  return CAMPOS_CONVITE.filter(({ chave }) => !modelo.includes(`{{${chave}}}`));
}

export function modeloConviteValido(modelo: string) {
  const conhecidos = new Set<string>(CAMPOS_CONVITE.map(({ chave }) => chave));
  return modelo.length <= LIMITE_MODELO_CONVITE && !camposAusentes(modelo).length &&
    Array.from(modelo.matchAll(/\{\{([^{}]*)\}\}/g)).every((m) => conhecidos.has(m[1]));
}

export function preencherConvite(modelo: string, dados: DadosConvite) {
  const valores: Record<string, string> = { ...dados, recuperar_senha: INSTRUCOES_RECUPERACAO };
  return modelo.replace(/\{\{([^{}]*)\}\}/g, (original, chave: string) => valores[chave] ?? original);
}

export function urlPortalDoTutor(slug: string) {
  return `https://oricse.com.br/pet/${encodeURIComponent(slug)}/portal`;
}

export function whatsappDoTutor(telefone: string | null, mensagem: string) {
  const numero = (telefone || "").replace(/\D/g, "");
  const internacional = numero.startsWith("00") ? numero.slice(2) : numero;
  const nacional = !telefone?.trim().startsWith("+") && !numero.startsWith("00");
  const destino = nacional && /^\d{10,11}$/.test(internacional) ? `55${internacional}` : internacional;
  if (!/^[1-9]\d{9,14}$/.test(destino)) return null;
  return `https://wa.me/${destino}?text=${encodeURIComponent(mensagem)}`;
}
