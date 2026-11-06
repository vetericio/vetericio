# Registro de testes

Ambiente de produção: https://gestor-insta-vetericio.lovable.app (Lovable Cloud).

## Em produção

| Data | Teste | Resultado |
|---|---|---|
| 2026-11-04 | Consultar endereço e retornos autorizados da autenticação | Domínio publicado e seus caminhos já autorizados; nenhuma alteração de configuração necessária. |
| 2026-11-04 | Saúde do Lovable Cloud e configuração de acesso por e-mail | Cloud pausado; serviço de autenticação retorna HTTP 530; acesso por e-mail já estava habilitado. |
| 2026-11-04 | Páginas públicas no site publicado | /login, /recuperar-senha e /redefinir-senha retornam 200; /reset-password retorna 404 antes da publicação da correção. |

## Pendentes

| Teste | Como/quando |
|---|---|
| Confirmar vetericio@gmail.com e enviar recuperação oficial | Após proprietário retomar o Lovable Cloud; consulta da conta falhou por indisponibilidade. Nenhum e-mail enviado e nenhuma senha criada ou alterada. |
| Redefinição real e novo acesso no site publicado | Após publicar a correção e retomar o serviço; apenas o proprietário deve abrir o link e escolher sua senha. |

## Validação local da correção — 2026-11-04

- 9 testes passaram: retorno ao domínio publicado, rotas públicas, compatibilidade do caminho antigo, evento de recuperação atrasado, rejeição de sessão comum e de link expirado, limpeza ao sair.
- Navegador: páginas de recuperação acessíveis sem sessão, link inválido rejeitado, botão disponível para repetir após erro de serviço; página antiga conferida em celular sem transbordamento.
- Falha de envio simulada apenas no teste local; não houve envio real nem escolha de senha.
