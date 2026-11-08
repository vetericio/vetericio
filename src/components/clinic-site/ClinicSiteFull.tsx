import type { CSSProperties, ReactNode } from "react";
import {
  ArrowRight, CalendarDays, Check, Clock3, Heart, Instagram,
  MapPin, MessageCircle, PawPrint, Phone, ShieldCheck, Sparkles,
} from "lucide-react";
import {
  clinicSiteSections, clinicSiteSectionLabels,
  type ClinicSiteConfig, type ClinicSiteSection, type ClinicSiteTemplate,
} from "@/lib/clinic-site";

type Props = {template: ClinicSiteTemplate; config: ClinicSiteConfig};
const safeHttps = (input: string) => /^https:\/\//i.test(input.trim()) ? input.trim() : "";
const waNumber = (input: string) => input.replace(/\D/g, "");
const realUrl = (value: string) => {
  const valueTrimmed = value.trim();
  return /^https:\/\/[^\s]+$/i.test(valueTrimmed) ? valueTrimmed : "";
};

export function ClinicSiteFull({template, config}: Props) {
  const luxe = template === "prestige";
  const editorial = template === "atelier";
  const friendly = template === "cuidado";
  const bold = template === "popular";
  const minimal = template === "essencial";
  const organic = template === "horizonte";
  const rounded = !luxe && !bold && !minimal;
  const buttonShape = luxe ? "rounded-none" : bold ? "rounded-md" : minimal ? "rounded-lg" : "rounded-full";
  const headingFont = luxe || editorial || organic ? "font-serif" : "font-sans";
  const sectionPad = minimal ? "py-14 sm:py-20" : "py-16 sm:py-24";
  const panels = rounded ? "rounded-3xl" : bold ? "rounded-md" : "rounded-xl";
  const hasWhatsApp = waNumber(config.whatsapp).length >= 10;
  const externalBooking = realUrl(config.bookingUrl);
  const actionHref = externalBooking || (hasWhatsApp ? "https://wa.me/" + waNumber(config.whatsapp) : "#contato");
  const image = safeHttps(config.heroImageUrl);
  const gallery = config.galleryUrls.filter(safeHttps);
  const social = realUrl(config.instagramUrl);
  const mapLink = config.address ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(config.address) : "";
  const sectionOrder = config.sectionOrder.length ? config.sectionOrder : [...clinicSiteSections];
  const visible = (section: ClinicSiteSection) => !config.hiddenSections.includes(section);
  const ink = minimal ? "border-slate-200/80" : "border-current/15";
  const outer = luxe ? "bg-[var(--site-bg)] text-[var(--site-text)]"
    : bold ? "bg-[var(--site-bg)] text-[var(--site-text)]"
    : "bg-[var(--site-bg)] text-[var(--site-text)]";
  const style = {
    "--site-primary":config.primaryColor, "--site-secondary":config.secondaryColor,
    "--site-bg":config.backgroundColor, "--site-text":config.textColor,
  } as CSSProperties;

  const brand = (
    <a href="#inicio" aria-label={"Início - " + config.name} className="flex min-w-0 items-center gap-3">
      {safeHttps(config.logoUrl) ? <img src={config.logoUrl} className="h-11 max-w-36 object-contain" alt={config.name}/> :
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-current/20"><PawPrint size={20}/></span>}
      <span className={"max-w-48 truncate text-base font-extrabold tracking-tight sm:text-lg " + headingFont}>{config.name}</span>
    </a>
  );
  const action = (label: string, inverted=false) => (
    <a href={actionHref} className={"inline-flex min-h-12 items-center justify-center gap-2 px-6 py-3 text-sm font-bold transition hover:opacity-85 " +
      buttonShape + (inverted ? " border border-current/30" : " bg-[var(--site-primary)] text-white")}>
      {hasWhatsApp && !externalBooking ? <MessageCircle size={18}/> : <CalendarDays size={18}/>} {label} <ArrowRight size={16}/>
    </a>
  );
  const imagePanel = (
    <div className={"relative min-h-[270px] overflow-hidden sm:min-h-[430px] " +
      (luxe ? "rounded-t-[9rem] sm:rounded-t-[12rem]" : bold ? "rounded-xl" : rounded ? "rounded-[2rem]" : "rounded-2xl")} style={{backgroundColor:"var(--site-secondary)"}}>
      {image ? <img src={image} alt={"Ambiente de " + config.name} className="absolute inset-0 h-full w-full object-cover"/> :
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-gradient-to-tr from-black/10 to-transparent p-6 text-[var(--site-text)]">
          <div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-current/20"><PawPrint size={65} strokeWidth={1.2}/></div>
          <span className="text-center text-xs font-semibold uppercase tracking-[0.3em] opacity-70">{config.name}</span>
        </div>}
      {(luxe || organic) && <div className="pointer-events-none absolute bottom-5 left-5 rounded-xl border border-white/40 bg-black/40 px-5 py-3 text-xs font-semibold tracking-wide text-white backdrop-blur-md">Atenção em cada detalhe</div>}
    </div>
  );

  const heading = (eyebrow: string, title: string) => (
    <div className="max-w-3xl">
      <span className="text-xs font-extrabold uppercase tracking-[.2em] text-[var(--site-primary)]">{eyebrow}</span>
      <h2 className={"mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl " + headingFont}>{title}</h2>
    </div>
  );

  const sections: Record<ClinicSiteSection, ReactNode> = {
    servicos: config.services.length ? (
      <section key="servicos" id="servicos" data-clinic-section="servicos" className={"px-5 sm:px-8 " + sectionPad}>
        <div className="mx-auto max-w-7xl">
          {heading("O que fazemos", "Cuidado para cada fase da vida.")}
          <div className={"mt-10 grid gap-4 " + (minimal ? "md:grid-cols-2" : "md:grid-cols-3")}>
            {config.services.map((service,index) => (
              <article key={service+"-"+index} className={"group border p-6 transition hover:-translate-y-1 " + ink + " " + panels +
                (luxe?" bg-white/[.04]":bold?" bg-[var(--site-secondary)]":" bg-white/35")}>
                <div className={"mb-7 flex h-11 w-11 items-center justify-center bg-[var(--site-primary)] text-white " + (rounded ? "rounded-full" : "rounded-lg")}>
                  {index%3===0 ? <Heart size={21}/> : index%3===1 ? <ShieldCheck size={21}/> : <PawPrint size={21}/>}
                </div>
                <h3 className="text-xl font-extrabold">{service}</h3>
                <p className="mt-3 text-sm leading-6 opacity-70">Orientação profissional e acompanhamento cuidadoso.</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    ) : null,
    sobre: (
      <section key="sobre" id="sobre" data-clinic-section="sobre" className={"border-y px-5 sm:px-8 " + ink + " " + sectionPad} style={{backgroundColor:"var(--site-secondary)"}}>
        <div className={"mx-auto grid max-w-7xl gap-10 md:grid-cols-2 md:items-center " + (organic?"md:grid-cols-[0.85fr_1.15fr]":"")}>
          <div className="relative">
            <div className={"flex aspect-[4/3] items-center justify-center border border-current/10 " + panels} style={{backgroundColor:"var(--site-bg)"}}>
              {gallery[0] ? <img src={gallery[0]} alt={"Nossa estrutura - " + config.name} className="h-full w-full object-cover"/> :
                <div className="flex h-full w-full flex-col items-center justify-center gap-5"><Heart size={65} strokeWidth={1.1} className="text-[var(--site-primary)]"/><span className="text-xs font-bold uppercase tracking-[.24em] opacity-60">O nosso propósito</span></div>}
            </div>
          </div>
          <div>
            {heading("Quem somos", config.aboutTitle || "Uma clínica feita para cuidar.")}
            <p className="mt-7 max-w-xl whitespace-pre-line text-base leading-8 opacity-80">{config.aboutText || config.description}</p>
            <div className="mt-7 flex items-center gap-3 text-sm font-bold"><span className="flex h-10 w-10 items-center justify-center rounded-full border border-current/20"><Check size={20}/></span>Cuidado, respeito e transparência</div>
          </div>
        </div>
      </section>
    ),
    galeria: gallery.length ? (
      <section key="galeria" id="galeria" data-clinic-section="galeria" className={"px-5 sm:px-8 " + sectionPad}>
        <div className="mx-auto max-w-7xl">
          {heading("Por dentro", "Conheça nosso espaço.")}
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((src,i) => <figure key={src+"-"+i} className={"aspect-[4/3] overflow-hidden bg-[var(--site-secondary)] " + panels}>
              <img src={src} alt={"Foto "+(i+1)+" de "+config.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"/>
            </figure>)}
          </div>
        </div>
      </section>
    ) : null,
    equipe: config.team.length ? (
      <section key="equipe" id="equipe" data-clinic-section="equipe" className={"border-t px-5 sm:px-8 " + ink + " " + sectionPad}>
        <div className="mx-auto max-w-7xl">
          {heading("Profissionais", "As pessoas por trás do cuidado.")}
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {config.team.map((person,index) => <article key={person.name+index} className={"overflow-hidden border " + ink + " " + panels}>
              <div className="flex aspect-[4/3] items-center justify-center bg-[var(--site-secondary)]">
                {safeHttps(person.imageUrl) ? <img src={person.imageUrl} alt={person.name} loading="lazy" className="h-full w-full object-cover"/> :
                  <PawPrint className="opacity-35" size={50}/>}
              </div>
              <div className="p-5"><h3 className="font-bold">{person.name}</h3><p className="mt-1 text-sm opacity-70">{person.role}</p></div>
            </article>)}
          </div>
        </div>
      </section>
    ) : null,
    faq: config.faqItems.length ? (
      <section key="faq" id="faq" data-clinic-section="faq" className={"px-5 sm:px-8 " + sectionPad} style={{backgroundColor:"var(--site-secondary)"}}>
        <div className="mx-auto max-w-5xl">
          {heading("Informações úteis", "Dúvidas frequentes.")}
          <div className="mt-9 space-y-3">
            {config.faqItems.map((item,i) => <details key={i} className={"group border border-current/15 bg-[var(--site-bg)] p-5 " + panels}>
              <summary className="cursor-pointer text-base font-bold">{item.question}</summary>
              <p className="mt-3 text-sm leading-7 opacity-75">{item.answer}</p>
            </details>)}
          </div>
        </div>
      </section>
    ) : null,
    contato: (
      <section key="contato" id="contato" data-clinic-section="contato" className={"px-5 sm:px-8 " + sectionPad}>
        <div className={"mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 " + (luxe?"border-t border-current/20 pt-12":"")}>
          <div>
            {heading("Vamos conversar?", "Estamos aqui por você e seu pet.")}
            <p className="mt-5 text-base leading-8 opacity-75">Entre em contato para consultar serviços, horários e informações de atendimento.</p>
            <div className="mt-8 flex flex-wrap gap-3">{action(config.ctaLabel || "Agendar atendimento")}{config.phone ? <a href={"tel:"+waNumber(config.phone)} className={"inline-flex items-center gap-2 border border-current/25 px-5 py-3 text-sm font-bold "+buttonShape}><Phone size={17}/> Ligar</a> : null}</div>
          </div>
          <div className={"space-y-5 border border-current/15 p-7 " + panels + (luxe?" bg-white/5":" bg-[var(--site-secondary)]")}>
            {config.address ? <div className="flex items-start gap-4"><MapPin className="mt-1 shrink-0 text-[var(--site-primary)]"/><div><strong className="block">Endereço</strong><p className="mt-1 text-sm leading-6">{config.address}</p><a href={mapLink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold underline">Abrir no mapa</a></div></div> : null}
            {config.hours ? <div className="flex items-start gap-4"><Clock3 className="mt-1 shrink-0 text-[var(--site-primary)]"/><div><strong className="block">Funcionamento</strong><p className="mt-1 text-sm leading-6">{config.hours}</p>{config.emergency24h && <p className="mt-1 text-xs font-bold">Atendimento de emergência 24h</p>}</div></div> : null}
            {config.phone ? <div className="flex items-start gap-4"><Phone className="mt-1 shrink-0 text-[var(--site-primary)]"/><div><strong className="block">Telefone</strong><a href={"tel:"+waNumber(config.phone)} className="mt-1 block text-sm">{config.phone}</a></div></div> : null}
            {hasWhatsApp ? <div className="flex items-start gap-4"><MessageCircle className="mt-1 shrink-0 text-[var(--site-primary)]"/><div><strong className="block">WhatsApp</strong><a href={"https://wa.me/"+waNumber(config.whatsapp)} className="mt-1 block text-sm underline">Conversar agora</a></div></div> : null}
            {social ? <a href={social} rel="noopener noreferrer" target="_blank" className="flex items-center gap-3 border-t border-current/15 pt-5 text-sm font-bold"><Instagram size={20}/> Instagram <ArrowRight size={16}/></a> : null}
          </div>
        </div>
      </section>
    ),
  };

  return <main className={"min-h-screen w-full overflow-x-clip " + outer} style={style} data-clinic-template={template}>
    {bold && config.emergency24h ? <div className="bg-[var(--site-primary)] px-4 py-2 text-center text-xs font-black uppercase tracking-widest text-white">Atendimento de emergência 24h · Entre em contato</div> : null}
    <header className={"relative z-10 border-b border-current/10 " + (organic?"bg-[var(--site-secondary)]":"")}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        {brand}
        <nav aria-label="Navegação do site" className="hidden items-center gap-6 text-sm font-semibold opacity-85 lg:flex">
          {sectionOrder.filter(section=>visible(section) && (section!=="equipe" || config.team.length) && (section!=="galeria" || gallery.length)).map(section =>
            <a key={section} href={"#"+section} className="hover:text-[var(--site-primary)]">{clinicSiteSectionLabels[section]}</a>)}
        </nav>
        <a href={actionHref} className={"inline-flex min-h-10 shrink-0 items-center gap-2 px-3 text-xs font-extrabold sm:px-5 sm:text-sm " + buttonShape + (bold?" bg-[var(--site-secondary)]":" bg-[var(--site-primary)] text-white")}>
          <CalendarDays size={16}/> <span className="hidden sm:inline">{config.ctaLabel || "Agendar"}</span><span className="sm:hidden">Contato</span>
        </a>
      </div>
    </header>

    <section id="inicio" data-clinic-section="inicio" className={"relative px-5 sm:px-8 " + (luxe ? "pb-16 pt-10 sm:pb-24" : "pb-16 pt-12 sm:pb-24") + (bold?" bg-[var(--site-secondary)]":"")}>
      <div className={"mx-auto grid max-w-7xl gap-10 md:items-center " +
        ((minimal||friendly) ? "md:grid-cols-[1fr_.85fr]" : organic ? "md:grid-cols-[.95fr_1.05fr]" : "md:grid-cols-2")}>
        <div className={editorial?"md:order-2":""}>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.22em] text-[var(--site-primary)]"><Sparkles size={15}/> Cuidado e confiança</div>
          <h1 className={"mt-6 max-w-3xl leading-[1.05] tracking-tight " + headingFont +
            (bold ? " text-5xl font-black uppercase sm:text-7xl" : minimal?" text-5xl font-semibold sm:text-6xl":" text-5xl font-semibold sm:text-7xl")}>{config.slogan}</h1>
          <p className="mt-6 max-w-xl text-base leading-8 opacity-75 sm:text-lg">{config.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">{action(config.ctaLabel || "Agendar atendimento")}{config.services.length ? <a href="#servicos" className={"inline-flex min-h-12 items-center justify-center gap-2 border border-current/25 px-5 py-3 text-sm font-bold "+buttonShape}>Conhecer serviços <ArrowRight size={16}/></a> : null}</div>
          <div className="mt-10 flex flex-wrap gap-5 border-t border-current/15 pt-5 text-xs font-semibold opacity-75">
            <span className="inline-flex items-center gap-2"><Heart size={17} className="text-[var(--site-primary)]"/> Atendimento atencioso</span>
            <span className="inline-flex items-center gap-2"><ShieldCheck size={17} className="text-[var(--site-primary)]"/> Orientação profissional</span>
          </div>
        </div>
        <div className={editorial?"md:order-1":""}>{imagePanel}</div>
      </div>
    </section>

    {sectionOrder.map(section => visible(section) ? sections[section] : null)}
    <footer data-clinic-section="rodape" className="border-t border-current/20 px-5 pb-24 pt-10 sm:px-8 sm:pb-12">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">{safeHttps(config.logoUrl) ? <img src={config.logoUrl} alt="" className="h-8 max-w-24 object-contain"/> : <PawPrint size={25}/>}<span className="font-bold">{config.name}</span></div>
        <p className="text-xs opacity-65">© {new Date().getFullYear()} {config.name}. Todos os direitos reservados.</p>
      </div>
    </footer>
    {hasWhatsApp && <a href={"https://wa.me/"+waNumber(config.whatsapp)} aria-label="Falar no WhatsApp" className="fixed bottom-5 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl sm:bottom-7 sm:right-7"><MessageCircle size={26}/></a>}
  </main>;
}
