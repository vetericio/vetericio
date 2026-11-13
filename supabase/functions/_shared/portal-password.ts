export const orientacaoSenhaPortal =
  "Use de 4 a 12 caracteres, com maiúscula, minúscula, número e caractere especial.";

export function senhaPortalValida(senha: string) {
  const tamanho = Array.from(senha).length;
  return tamanho >= 4 && tamanho <= 12 &&
    /\p{Ll}/u.test(senha) && /\p{Lu}/u.test(senha) &&
    /[0-9]/.test(senha) && /[\p{P}\p{S}]/u.test(senha);
}

export const versaoSenhaPortal = 1;

// O provedor de autenticação aplica a política global à credencial interna.
// A política de entrada do tutor é validada separadamente, antes da conversão.
export async function credencialSenhaPortal(senha: string, portalId: string) {
  const entrada = new TextEncoder().encode(`oricse-portal-v1:${portalId}:${senha}`);
  const hash = await crypto.subtle.digest("SHA-256", entrada);
  const hex = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `Aa0!${hex}`;
}
