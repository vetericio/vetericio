import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlvoradaDemoShowcase } from "@/components/clinic-site/AlvoradaDemoShowcase";
import { ClinicSiteRenderer } from "@/components/clinic-site/ClinicSiteRenderer";
import { clinicSiteTemplates, normalizeClinicSiteConfig } from "@/lib/clinic-site";
import { hostDaPagina } from "@/lib/tenant-context";
import { findPublicClinicSlug, isPlatformHostname, loadPublicClinicSite, type PublicClinicSite } from "@/lib/public-clinic-site";

export const Route = createFileRoute("/")({
  component: PublicClinicHome,
});

function PublicClinicHome() {
  const [site, setSite] = useState<PublicClinicSite | null>(null);
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<"initial" | "loading" | "ready" | "unavailable">("initial");
  const [hostname, setHostname] = useState("");

  useEffect(() => {
    const host = hostDaPagina();
    setHostname(host);
    if (!host || isPlatformHostname(host)) return;
    let active = true;
    setStatus("loading");
    void (async () => {
      try {
        const resolved = await findPublicClinicSlug(host);
        if (!resolved) throw new Error("Clínica não encontrada.");
        const publishedSite = await loadPublicClinicSite(resolved);
        if (!publishedSite) throw new Error("Site não publicado.");
        if (!active) return;
        setSlug(resolved);
        setSite(publishedSite);
        setStatus("ready");
      } catch (error) {
        console.error("Falha ao abrir site público da clínica:", error);
        if (active) setStatus("unavailable");
      }
    })();
    return () => { active = false; };
  }, []);

  // O domínio principal sempre apresenta a página comercial da ORICSE. A
  // resolução abaixo é exclusiva dos domínios próprios das clínicas.
  if (!hostname || isPlatformHostname(hostname)) return <OricseHome />;
  if (status === "initial" || status === "loading") {
    return <main className="grid min-h-screen place-items-center bg-white p-6 text-center text-sm text-slate-500" aria-live="polite">Carregando site da clínica...</main>;
  }
  if (status !== "ready" || !site) {
    return <main className="grid min-h-screen place-items-center bg-white p-6 text-center"><p className="text-slate-600">Este site não está disponível.</p></main>;
  }

  const template = clinicSiteTemplates.includes(site.template as (typeof clinicSiteTemplates)[number])
    ? site.template as (typeof clinicSiteTemplates)[number]
    : "prestige";
  const config = normalizeClinicSiteConfig(site.config);

  if (hostname === "alvorada.oricse.com.br" && slug === "alvorada") {
    return <AlvoradaDemoShowcase initialTemplate={template} config={config} clinicSlug={slug} />;
  }
  return <ClinicSiteRenderer template={template} config={config} clinicSlug={slug} />;
}

const solutions = [
  ["Recepção e agenda", "Confirmações, fila de espera e o cadastro do tutor sempre à mão."],
  ["Clínica veterinária", "Prontuários, receitas, vacinas e exames no mesmo fluxo."],
  ["Banho, tosa e hotel", "Serviços, pacotes, reservas e cuidados organizados."],
  ["Financeiro e OricsePay", "Agenda online confirmada após o pagamento, sem retrabalho."],
];

function OricseHome() {
  return (
    <main className="overflow-x-hidden bg-[#fffdfa] text-[#4a1826]">
      <header className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <Link to="/" className="inline-flex items-center" aria-label="Oricse, página inicial">
          <img src="/oricse-logo-oryx.svg?v=15" alt="Oricse" className="h-12 w-auto object-contain sm:h-14" />
        </Link>
        <nav className="flex items-center gap-4 text-sm font-semibold text-[#643546] sm:gap-7 sm:text-base">
          <a className="hidden sm:inline" href="#oricstudio">OricStúdio</a>
          <a className="hidden md:inline" href="#portal">Portal do Tutor</a>
          <Link to="/planos">Planos</Link>
          <Link to="/login" className="rounded-full bg-[#4a1826] px-4 py-2.5 font-bold text-white transition hover:bg-[#66243a] sm:px-6">Login</Link>
        </nav>
      </header>

      <section className="relative isolate overflow-hidden border-y border-[#f0e1db] bg-[#fff9f5]">
        <img src="/oricse-capa-paisagem.png" alt="" aria-hidden="true" className="absolute inset-0 -z-20 h-full w-full object-cover object-center opacity-95" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(255,250,247,.96)_0%,rgba(255,250,247,.82)_45%,rgba(255,250,247,.16)_100%)]" />
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-10 lg:py-32">
          <div className="max-w-2xl">
            <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#9c6574]">Soluções para o mercado pet</p>
            <h1 className="mt-5 max-w-[12ch] text-5xl font-bold leading-[.93] tracking-[-.06em] text-[#4a1826] sm:text-7xl">
              Cuidar de pets é a sua <span className="text-[#a56a78]">missão.</span> Organizar tudo é a nossa.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#755563]">
              Uma plataforma completa para manter a rotina organizada, o time alinhado e os tutores por perto.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/planos" className="rounded-full bg-[#4a1826] px-6 py-3.5 font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#66243a]">Conhecer a Oricse</Link>
              <Link to="/login" className="rounded-full border border-[#cfaeba] bg-white/90 px-6 py-3.5 font-bold text-[#5e2b3d] transition hover:bg-white">Já sou cliente</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {solutions.map(([title, description]) => (
            <article key={title} className="rounded-3xl border border-[#eadbd6] bg-white p-6 shadow-[0_10px_30px_rgba(74,24,38,.05)]">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f7e9e9] text-lg text-[#81394f]">✦</span>
              <h2 className="mt-4 text-lg font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#765a64]">{description}</p>
              <Link to="/solucoes" className="mt-5 inline-flex text-sm font-bold text-[#843950] hover:underline">Saiba mais →</Link>
            </article>
          ))}
        </div>
      </section>

      <section id="oricstudio" className="bg-[#35111f] px-5 py-16 text-[#fff8f3] sm:px-8 sm:py-20 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_.9fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#efbdca]">OricStúdio</p>
            <h2 className="mt-4 max-w-2xl text-4xl font-bold leading-tight tracking-[-.045em] sm:text-5xl">Sua clínica bem cuidada, dentro e fora da rotina.</h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[#eed9df]">Organize sua presença digital, planeje conteúdos e mantenha a marca da sua clínica sempre viva.</p>
            <Link to="/oricstudio" className="mt-7 inline-flex rounded-full bg-[#ffe2ca] px-6 py-3.5 font-bold text-[#4a1826] transition hover:bg-white">Conhecer o OricStúdio</Link>
          </div>
          <div id="portal" className="rounded-[28px] border border-white/15 bg-white/10 p-7 backdrop-blur-sm">
            <p className="text-sm font-bold text-[#f4c9b5]">Portal do Tutor</p>
            <h2 className="mt-3 text-3xl font-bold">O tutor resolve. Sua equipe respira.</h2>
            <p className="mt-4 leading-7 text-[#ecdce0]">Documentos, vacinas, agendamentos e pagamentos online no acesso seguro da sua clínica.</p>
            <Link to="/solucoes" className="mt-6 inline-flex rounded-full border border-white/35 px-5 py-3 font-bold text-white transition hover:bg-white/10">Ver como funciona</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
