/** Confere estrutura e dígitos verificadores de um CPF, com ou sem máscara. */
export function cpfValido(cpf: string): boolean {
  const digitos = cpf.trim().replace(/[.-]/g, "");
  if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false;

  function digitoVerificador(tamanho: number) {
    const soma = [...digitos.slice(0, tamanho)].reduce(
      (total, digito, indice) => total + Number(digito) * (tamanho + 1 - indice),
      0,
    );
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  }

  return digitoVerificador(9) === Number(digitos[9])
    && digitoVerificador(10) === Number(digitos[10]);
}
