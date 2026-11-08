import type { ClinicSiteConfig } from "@/lib/clinic-site";
import { MessageCircle } from "lucide-react";
export function Atelier({ config }: { config: ClinicSiteConfig }) {
  return (
    <main className="min-h-screen bg-[#f6f0e8] text-[#392f29]">
      <header className="mx-auto flex max-w-6xl justify-between p-6 font-semibold">
        <span>{config.name}</span>
        <a href="#agenda">Agendar</a>
      </header>
      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-14 md:grid-cols-2">
        <div>
          <p className="text-sm uppercase tracking-[.2em]">Clínica contemporânea</p>
          <h1 className="mt-5 text-5xl font-semibold tracking-tight">{config.slogan}</h1>
          <p className="mt-5 text-lg">{config.description}</p>
          <a
            id="agenda"
            href={`https://wa.me/${config.whatsapp.replace(/\D/g, "")}`}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#392f29] px-6 py-3 text-white"
          >
            <MessageCircle size={17} /> {config.whatsapp ? "Agendar" : "Conhecer a clínica"}
          </a>
        </div>
        <div className="aspect-[4/5] bg-[#d9cbbd]">
          {config.heroImageUrl && (
            <img
              src={config.heroImageUrl}
              alt="Ambiente da clínica"
              className="h-full w-full object-cover"
            />
          )}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="text-3xl">Estrutura e especialidades</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {config.services.map((s) => (
            <article key={s} className="rounded-2xl bg-white p-5">
              <b>{s}</b>
              <p className="mt-2 text-sm">Cuidado técnico e próximo.</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
