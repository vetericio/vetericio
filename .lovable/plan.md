# Corrigir o envio do backup por QR

## O que está acontecendo

O envio falha antes de chegar na internet. A tabela de transferências temporárias foi criada no banco **sem as permissões de acesso** necessárias — confirmei que ela hoje não tem nenhuma permissão concedida a nenhum papel. Resultado: toda tentativa de gravar ou ler o backup é recusada pelo banco, e o app mostra a mensagem genérica "Não foi possível enviar. Verifique a internet ou use o arquivo de backup."

Ou seja: não é problema de internet nem do QR — é permissão no banco.

## O que será feito

1. **Migração no banco**: conceder à conta de serviço do app (usada apenas no servidor) permissão de gravar, ler e apagar na tabela de transferências. Nenhum acesso é concedido ao navegador/visitante — o backup continua acessível somente pelo código de 6 dígitos, através do servidor.
2. **Regra de acesso explícita**: adicionar uma política que nega leitura direta pelo app/navegador, deixando claro no banco que só o servidor pode tocar nesses dados (resolve também o aviso de segurança pendente).
3. **Mensagens de erro reais**: em vez da mensagem genérica, o painel de Backup vai mostrar o motivo específico da falha (permissão, backup grande demais, sem conexão), para não confundir problema de servidor com problema de internet.
4. **Teste ponta a ponta**: enviar um backup de verdade, ler o código gerado e confirmar que o outro lado recupera os dados, incluindo o "Apagar agora".

## Detalhes técnicos

- Migração: `GRANT SELECT, INSERT, DELETE ON public.transferencias TO service_role;` (sem grants para `anon`/`authenticated`), mantendo RLS habilitado e adicionando uma policy restritiva para eliminar o alerta `RLS Enabled No Policy`.
- `src/lib/transferencia.functions.ts`: propagar `error.message`/`error.code` do banco em vez de mascarar toda falha como erro genérico; manter `supabaseAdmin` carregado dentro do handler.
- `src/components/Backup.tsx`: exibir a mensagem retornada pelo servidor quando houver, com o texto atual só como fallback para falha de rede.
- Validação: envio + busca + apagar via app real, checando os logs do servidor.
