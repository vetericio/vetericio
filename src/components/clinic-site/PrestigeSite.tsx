import type { ClinicSiteConfig } from "@/lib/clinic-site";
import { Phone, MessageCircle, MapPin } from "lucide-react";

export function PrestigeSite({ config }: { config: ClinicSiteConfig }) {
  const hasWhatsapp = Boolean(config.whatsapp.replace(/\D/g, ""));
  return (
    <main
      className="min-h-screen bg-[var(--site-bg)] text-[var(--site-text)]"
      style={
        {
          "--site-bg": config.backgroundColor,
          "--site-text": config.textColor,
          "--site-primary": config.primaryColor,
          "--site-secondary": config.secondaryColor,
        } as React.CSSProperties
      }
    >
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-10">
        <a href="#inicio" className="font-serif text-lg tracking-[0.16em]">
          {config.logoUrl ? (
            <img src={config.logoUrl} alt={config.name} className="h-10 max-w-40 object-contain" />
          ) : (
            config.name
          )}
        </a>
        <a
          href="#contato"
          className="hidden text-xs uppercase tracking-[0.18em] opacity-80 sm:block"
        >
          Contato
        </a>
      </header>
      <section
        id="inicio"
        className="mx-auto grid max-w-7xl gap-10 px-5 pb-20 pt-10 sm:px-10 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:py-20"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--site-primary)]">
            Medicina veterinária
          </p>
          <h1 className="mt-5 max-w-3xl font-serif text-5xl leading-[1.03] sm:text-7xl">
            {config.slogan}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 opacity-80">{config.description}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            {hasWhatsapp && (
              <a
                href={`https://wa.me/${config.whatsapp.replace(/\D/g, "")}`}
                className="inline-flex min-h-12 items-center gap-2 bg-[var(--site-primary)] px-5 text-sm font-bold text-[#121A18]"
              >
                <MessageCircle size={17} /> Agendar pelo WhatsApp
              </a>
            )}
            {config.phone && (
              <a
                href={`tel:${config.phone.replace(/\D/g, "")}`}
                className="inline-flex min-h-12 items-center gap-2 border border-current px-5 text-sm font-bold"
              >
                <Phone size={17} /> Ligar
              </a>
            )}
          </div>
        </div>
        <div className="min-h-80 overflow-hidden bg-[var(--site-secondary)] sm:min-h-[540px]">
          {config.heroImageUrl ? (
            <img
              src={config.heroImageUrl}
              alt="Ambiente da clínica"
              fetchPriority="high"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full min-h-80 items-end p-8 font-serif text-3xl opacity-50">
              A sua história, com mais cuidado.
            </div>
          )}
        </div>
      </section>
      <section className="border-y border-white/15 px-5 py-16 sm:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--site-primary)]">
            Atendimento pensado em cada detalhe
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {config.services.map((service) => (
              <article key={service} className="border-t border-[var(--site-primary)] pt-5">
                <h2 className="font-serif text-2xl">{service}</h2>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section
        id="contato"
        className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-10 md:grid-cols-2"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--site-primary)]">
            Visite-nos
          </p>
          <h2 className="mt-4 font-serif text-4xl">Sempre que seu pet precisar.</h2>
        </div>
        <div className="space-y-4 text-base opacity-85">
          {config.emergency24h && (
            <p className="font-semibold text-[var(--site-primary)]">
              Atendimento de emergência 24 horas
            </p>
          )}
          {config.address && (
            <p className="flex gap-2">
              <MapPin size={19} />
              {config.address}
            </p>
          )}
          <p>{config.hours}</p>
          {config.phone && <p>{config.phone}</p>}
        </div>
      </section>
      <div className="fixed inset-x-3 bottom-3 z-10 flex gap-2 sm:hidden">
        {hasWhatsapp && (
          <a
            className="flex min-h-12 flex-1 items-center justify-center gap-2 bg-[var(--site-primary)] font-bold text-[#121A18]"
            href={`https://wa.me/${config.whatsapp.replace(/\D/g, "")}`}
          >
            <MessageCircle size={18} /> WhatsApp
          </a>
        )}
        {config.phone && (
          <a
            className="flex min-h-12 flex-1 items-center justify-center gap-2 border border-current bg-[var(--site-bg)] font-bold"
            href={`tel:${config.phone.replace(/\D/g, "")}`}
          >
            <Phone size={18} /> Ligar
          </a>
        )}
      </div>
    </main>
  );
}
