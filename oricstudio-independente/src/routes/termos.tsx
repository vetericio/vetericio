import { createFileRoute } from "@tanstack/react-router";
import { Contato, PublicPage } from "@/components/public-page";
import { LEGAL } from "@/lib/legal";

export const Route = createFileRoute("/termos")({
  head: () => ({ meta: [{ title: `Termos de Serviço — ${LEGAL.nomeServico}` }] }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <PublicPage title="Termos de Serviço">
      <h2>1. Objeto</h2>
      <p>
        O {LEGAL.nomeServico} é uma ferramenta interna para administrar contas profissionais do
        Instagram das marcas{LEGAL.controlador ? ` de ${LEGAL.controlador}` : ""}. Não é um serviço
        aberto ao público e não há cadastro livre.
      </p>

      <h2>2. Acesso</h2>
      <p>
        O acesso é concedido por um administrador. Cada usuário é responsável por manter a própria
        senha em sigilo e pelas ações feitas com a sua conta, que ficam registradas.
      </p>

      <h2>3. Uso da plataforma Meta</h2>
      <p>
        As integrações usam apenas as APIs oficiais da Meta e dependem das permissões concedidas por
        quem autorizou cada conta. O uso deve respeitar os Termos da Plataforma Meta, as Diretrizes
        da Comunidade do Instagram e a legislação aplicável. É proibido usar o sistema para
        engajamento artificial, spam ou acesso a contas sem autorização.
      </p>

      <h2>4. Conteúdo</h2>
      <p>
        O conteúdo publicado é de responsabilidade da marca titular da conta. Ações de alto impacto,
        como exclusões, gastos com anúncios e comunicações sensíveis, exigem aprovação humana
        específica.
      </p>

      <h2>5. Disponibilidade</h2>
      <p>
        O serviço depende de terceiros (Meta e provedores de hospedagem). Limites, mudanças ou
        indisponibilidades dessas plataformas podem afetar funcionalidades. Publicações cujo
        resultado não puder ser confirmado são marcadas como “resultado desconhecido” e verificadas
        antes de qualquer nova tentativa.
      </p>

      <h2>6. Privacidade</h2>
      <p>
        O tratamento de dados segue a{" "}
        <a href="/privacidade" className="text-foreground underline">
          Política de Privacidade
        </a>
        .
      </p>

      <h2>7. Contato</h2>
      <p>
        <Contato />.
      </p>
    </PublicPage>
  );
}
