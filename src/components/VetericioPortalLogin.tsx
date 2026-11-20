import { ArrowLeft, MessageCircle } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { vetericioBrand } from "@/lib/vetericio-brand";

export function VetericioPortalLogo({ className }: { className?: string }) {
  return (
    <img
      src={vetericioBrand.logo}
      alt="Veterício"
      width={1024}
      height={255}
      className={className}
    />
  );
}

export function VetericioPortalLogin({
  site,
  title,
  description,
  extended,
  style,
  children,
}: {
  site: string;
  title: string;
  description: string;
  extended: boolean;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <main
      data-visual-id="portal-tutor-login"
      data-portal-auth-mode={extended ? "extended" : "login"}
      className="portal-tutor-live vetericio-portal vetericio-portal-login"
      style={style}
    >
      <header className="vetericio-portal-top">
        <div>
          <a href={site} aria-label="Site da Veterício">
            <VetericioPortalLogo className="vetericio-portal-logo" />
          </a>
          <a href={site} className="vetericio-portal-back">
            <ArrowLeft size={16} aria-hidden="true" /> Voltar ao site
          </a>
        </div>
      </header>
      <div className="vetericio-portal-login-grid">
        <section className="vetericio-portal-welcome" aria-labelledby="vetericio-portal-heading">
          <img src={vetericioBrand.photo} alt="" width={1200} height={900} />
          <div className="vetericio-portal-welcome-copy">
            <h1 id="vetericio-portal-heading">Portal do Tutor</h1>
            <p className="vetericio-portal-slogan">{vetericioBrand.slogan}</p>
            <p>Agende uma visita, acompanhe os cuidados e consulte os documentos do seu pet.</p>
          </div>
        </section>
        <section className="vetericio-portal-form" aria-labelledby="vetericio-portal-form-title">
          <h2 id="vetericio-portal-form-title">{title}</h2>
          <p className="vetericio-portal-lead">{description}</p>
          {children}
          <a className="vetericio-portal-help" href={site + "#contato"}>
            <MessageCircle size={17} aria-hidden="true" /> Fale com a Veterício
          </a>
        </section>
      </div>
    </main>
  );
}
