import type { ClinicSiteConfig } from "@/lib/clinic-site";
export function Popular({ config }: { config: ClinicSiteConfig }) {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <div className="bg-red-600 p-3 text-center font-black text-white">
        {config.emergency24h ? "EMERGÊNCIA 24 HORAS — LIGUE AGORA" : "ATENDIMENTO VETERINÁRIO"}
      </div>
      <header className="flex items-center justify-between p-5 font-black">
        <span>{config.name}</span>
        <a
          href={`https://wa.me/${config.whatsapp.replace(/\D/g, "")}`}
          className="rounded-lg bg-emerald-500 px-4 py-2"
        >
          WHATSAPP
        </a>
      </header>
      <section className="bg-yellow-300 px-5 py-14">
        <h1 className="mx-auto max-w-4xl text-5xl font-black">{config.slogan}</h1>
        <p className="mx-auto mt-5 max-w-4xl text-xl">{config.description}</p>
      </section>
      <section className="mx-auto max-w-5xl p-5">
        <h2 className="text-3xl font-black">Serviços para seu pet</h2>
        {config.services.map((s) => (
          <article key={s} className="border-b-4 border-slate-950 py-5 text-xl font-bold">
            {s}
          </article>
        ))}
      </section>
    </main>
  );
}
