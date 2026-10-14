-- Impede que o mesmo usuário mantenha vínculo ativo com mais de uma clínica.
-- Usuários desligados podem ser vinculados novamente depois que o vínculo anterior for desativado.

create unique index if not exists clinica_usuarios_usuario_ativo_unico_idx
  on public.clinica_usuarios(user_id)
  where ativo = true;
