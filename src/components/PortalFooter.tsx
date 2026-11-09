import { VERSAO } from "@/lib/versao";

/**
 * Créditos institucionais oficiais da plataforma.
 * Reutilizado por todas as rotas: site comercial, sites das clínicas,
 * Portal do Tutor, páginas administrativas e módulos internos.
 */
export function PortalFooter() {
  const anoAtual = new Date().getFullYear();
  return (
    <footer className="oricse-global-credits" aria-label="Créditos e informações institucionais da ORICSE">
      <p className="oricse-global-credits-brand">Oricse - Soluções para o mercado pet</p>
      <p className="oricse-global-credits-makers">
        Desenvolvido por: <strong>DIRCE Tecnologia</strong> — Desenvolvimento, Inovação, Resultados, Conectividade e Evolução Tecnologia LTDA.
        {" · "} <strong>Veterício Serviços Veterinários LTDA.</strong>
      </p>
      <p className="oricse-global-credits-version">© {anoAtual} · Versão {VERSAO}</p>
    </footer>
  );
}
