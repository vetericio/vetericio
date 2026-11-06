import { createFileRoute } from "@tanstack/react-router";
import { Contato, PublicPage } from "@/components/public-page";
import { LEGAL } from "@/lib/legal";

export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [{ title: `Política de Privacidade — ${LEGAL.nomeServico}` }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PublicPage title="Política de Privacidade">
      <p>
        O {LEGAL.nomeServico} é uma ferramenta interna, de uso restrito
        {LEGAL.controlador ? ` de ${LEGAL.controlador}` : ""}, para administrar contas profissionais
        do Instagram das próprias marcas. Esta política explica quais dados são tratados, por quê e
        como você pode pedir a exclusão, conforme a Lei Geral de Proteção de Dados (Lei nº
        13.709/2018) e as políticas da plataforma Meta.
      </p>

      <h2>Quais dados tratamos</h2>
      <ul>
        <li>
          Dados da equipe que usa o sistema: e-mail de login e registro das ações administrativas.
        </li>
        <li>
          Dados recebidos da Meta após autorização expressa: identificador e nome do usuário do
          Facebook que autorizou, Páginas do Facebook e contas profissionais do Instagram
          autorizadas (nome, nome de usuário, foto de perfil e número de seguidores) e as permissões
          concedidas.
        </li>
        <li>
          Tokens de acesso emitidos pela Meta, guardados criptografados (AES-256-GCM) e usados
          apenas pelo servidor.
        </li>
        <li>
          Nas próximas funcionalidades: publicações criadas no sistema, métricas das contas e
          publicações e comentários recebidos nas publicações das marcas.
        </li>
      </ul>

      <h2>Para que usamos</h2>
      <ul>
        <li>
          Identificar as contas que a equipe pode administrar e verificar se a conexão continua
          válida.
        </li>
        <li>
          Publicar e agendar conteúdos nas contas autorizadas, analisar o desempenho e responder
          comentários, quando essas funções estiverem ativas.
        </li>
        <li>Manter um registro de auditoria das operações para segurança e rastreabilidade.</li>
      </ul>
      <p>
        Não vendemos dados, não os usamos para publicidade de terceiros e não acessamos contas sem
        autorização. Nunca pedimos a senha do Instagram ou do Facebook: a conexão é feita
        exclusivamente pelo login oficial da Meta.
      </p>

      <h2>Base legal</h2>
      <p>
        O tratamento se baseia no legítimo interesse de administrar as contas das próprias marcas e,
        para os dados vindos da Meta, no consentimento dado na tela de autorização da Meta, que pode
        ser revogado a qualquer momento.
      </p>

      <h2>Compartilhamento</h2>
      <p>
        Os dados são trocados apenas com a Meta Platforms (pela Graph API oficial) e ficam
        armazenados na infraestrutura de hospedagem e banco de dados do serviço. Não há outros
        destinatários.
      </p>

      <h2>Retenção e exclusão</h2>
      <p>
        Os dados ficam guardados enquanto a conexão estiver ativa. Ao desconectar uma conta, os
        tokens são apagados e as permissões são revogadas na Meta. Você também pode remover o app
        nas configurações do Facebook (Configurações e privacidade &gt; Configurações &gt;
        Integrações empresariais). Nesse caso, a Meta nos avisa e os dados recebidos dela são
        apagados automaticamente. Veja a página{" "}
        <a href="/exclusao-de-dados" className="text-foreground underline">
          Exclusão de dados
        </a>
        .
      </p>

      <h2>Seus direitos</h2>
      <p>
        Você pode pedir confirmação, acesso, correção, anonimização, portabilidade ou exclusão dos
        seus dados, além de informações sobre o compartilhamento, pelo contato abaixo.
      </p>

      <h2>Segurança</h2>
      <p>
        Usamos conexão criptografada, tokens cifrados, controle de acesso por papel e registro das
        operações administrativas. Em caso de incidente de segurança relevante, os titulares e a
        ANPD serão comunicados nos termos da lei.
      </p>

      <h2>Contato</h2>
      <p>
        Dúvidas e pedidos sobre privacidade: <Contato />.
      </p>
    </PublicPage>
  );
}
