# OricStúdio do ORICSE — ambiente da plataforma

## Regra de produto

O OricStúdio da própria plataforma **não é uma clínica**. Não utiliza `clinica_id`,
não requer licença de clínica, nem compartilha dados com clientes. Usa a mesma
interface React `OricStudio` das clínicas, passando `ambiente="sistema"` no
endereço `/admin-oricstudio-sistema`. O atalho fica em `/admin-oricstudio`
e é restrito a quem tem `app_users.role='admin'`.

## Dados separados

- `oricstudio_sistema_publicacoes` — rascunhos e calendário;
- `oricstudio_sistema_versoes` — histórico editorial;
- `oricstudio_sistema_preferencias` — identidade do ORICSE;
- `oricstudio_sistema_midias` + bucket privado `oricstudio-sistema` — biblioteca;
- Contas OAuth Meta e Threads da plataforma têm `clinica_id IS NULL`,
  jamais apontam para uma clínica fictícia.

Banco restringe as quatro tabelas da plataforma por RLS ao administrador.
A biblioteca usa operações no servidor com autenticação de administrador e
signed URLs de curta duração; não há bucket público.

## Testes de homologação

1. Acesso administrativo abre `/admin-oricstudio-sistema` e não altera a
   clínica ativa do usuário.
2. Usuário não administrador recebe bloqueio e não consegue ler/escrever nas
   tabelas/bucket da plataforma.
3. Rascunhos, preferências, calendário e mídia criados no sistema não aparecem
   em nenhuma clínica.
4. Conexões do Instagram e Threads do sistema não aparecem nas listas de
   clínicas, e callbacks retornam ao ambiente correto.
5. Conexão de uma clínica continua exigindo vínculo, licença e clínica ativa.
6. Testar OAuth real nas contas autorizadas antes de permitir publicações.
7. Não ativar comercialização para clientes sem homologação completa.

O OricStúdio ainda não envia posts automaticamente: calendário e aprovações
são editoriais até que o publicador seja implementado e aprovado.
