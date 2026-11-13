import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Heart,
  Instagram,
  MapPin,
  MessageCircle,
  PawPrint,
  ImagePlus,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useTenantContext } from "@/lib/tenant-context";
import {
  clinicSiteSections,
  clinicSiteSectionLabels,
  type ClinicSiteConfig,
  type ClinicSiteSection,
  type ClinicSiteTemplate,
} from "@/lib/clinic-site";

type Props = {
  template: ClinicSiteTemplate;
  config: ClinicSiteConfig;
  clinicSlug?: string;
  onUploadImage?: (slot: string, file: File) => void;
  uploadingSlot?: string | null;
  imageOverrides?: Record<string, string>;
  uploadReadySlot?: string | null;
  hiddenUploadSlots?: string[];
  onConfirmUpload?: (slot: string) => void;
};
const safeHttps = (input?: string) =>
  /^https:\/\//i.test((input || "").trim()) ? (input || "").trim() : "";
const safeImage = (input?: string) => {
  const value = (input || "").trim();
  const driveId = value.match(
    /^https:\/\/drive\.google\.com\/uc\?export=(?:view|download)&id=([^&]+)/i,
  )?.[1];
  if (driveId) return `https://lh3.googleusercontent.com/d/${encodeURIComponent(driveId)}=w1440`;
  const googleusercontentId = value.match(
    /^https:\/\/lh3\.googleusercontent\.com\/d\/([^/?#=]+)/i,
  )?.[1];
  if (googleusercontentId)
    return `https://lh3.googleusercontent.com/d/${encodeURIComponent(googleusercontentId)}=w1440`;
  if (/^https:\/\//i.test(value)) return value;
  return /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(value) ? value : "";
};
const safeTeamPhoto = (input: string) => {
  const value = safeImage(input);
  if (value) return value;
  // Apenas imagens inline WEBP são aceitas; a vitrine importa duas fotos locais
  // do próprio código para evitar URLs públicas de mídia quebradas.
  if (/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(input)) return input;
  const local = input.trim();
  return /^\/clinic-site\/[a-z0-9/_-]+\.(?:webp|png|jpe?g)$/i.test(local) ? local : "";
};
const waNumber = (input: string) => input.replace(/\D/g, "");
const realUrl = (value: string) => {
  const valueTrimmed = value.trim();
  return /^https:\/\/[^\s]+$/i.test(valueTrimmed) ? valueTrimmed : "";
};

function FotoPublicaDoProfissional({ url, nome }: { url: string; nome: string }) {
  const [falhou, setFalhou] = useState(false);
  useEffect(() => setFalhou(false), [url]);
  if (!url || falhou) return <PawPrint aria-hidden="true" className="opacity-35" size={50} />;
  // A foto nunca é reinterpretada: só ajustamos o enquadramento.
  // As imagens originais são verticais, portanto o topo deve permanecer visível.
  return (
    <img
      src={url}
      alt={nome}
      loading="lazy"
      decoding="async"
      onError={() => setFalhou(true)}
      className="block h-full w-full object-cover object-top"
      style={{ objectPosition: "center 0%" }}
    />
  );
}

export function ClinicSiteFull({
  template,
  config,
  clinicSlug,
  onUploadImage,
  uploadingSlot,
  imageOverrides = {},
  uploadReadySlot,
  hiddenUploadSlots = [],
  onConfirmUpload,
}: Props) {
  const signatura = template === "signatura";
  const luxe = template === "prestige";
  const prime = template === "atelier";
  const editorial = template === "atelier";
  const friendly = template === "cuidado";
  const bold = template === "popular";
  const king = template === "popular";
  const minimal = template === "essencial";
  const organic = template === "horizonte";
  const rounded = !luxe && !bold && !minimal && !prime;
  const buttonShape = luxe
    ? "rounded-none"
    : bold
      ? "rounded-md"
      : prime
        ? "rounded-full"
        : minimal
          ? "rounded-lg"
          : "rounded-full";
  const headingFont = luxe || organic || signatura || king ? "font-serif" : "font-sans";
  const sectionPad = signatura ? "py-20 sm:py-28" : minimal ? "py-14 sm:py-20" : "py-16 sm:py-24";
  const panels =
    signatura || prime
      ? "rounded-2xl"
      : rounded
        ? "rounded-3xl"
        : bold
          ? "rounded-md"
          : "rounded-xl";
  const hasWhatsApp = waNumber(config.whatsapp).length >= 10;
  // Todos os botões de agendamento levam diretamente ao Portal do Tutor da
  // clínica, inclusive em domínios personalizados. O contexto autenticado não
  // é necessário: a rota identifica a clínica pelo slug público.
  const { portal: tenantPortal } = useTenantContext();
  const caminhoAtual = typeof window === "undefined" ? "" : window.location.pathname;
  const hostAtual = typeof window === "undefined" ? "" : window.location.hostname.toLowerCase();
  const routeSlug = caminhoAtual.match(/^\/c\/([a-z0-9-]+)\/?$/i)?.[1] || "";
  const subdomainSlug = hostAtual.match(/^([a-z0-9-]+)\.oricse\.com\.br$/)?.[1] || "";
  const publishedSlug = clinicSlug || tenantPortal?.clinica_slug || routeSlug || subdomainSlug;
  // A Alvorada utiliza o endereço público oficial, independente do tema
  // selecionado. Outras clínicas mantêm seus próprios links atuais.
  let portalHref = "";
  if (publishedSlug === "alvorada") {
    portalHref = "https://alvorada.oricse.com.br/portaldotutor";
  } else if (publishedSlug) {
    portalHref = `/pet/${encodeURIComponent(publishedSlug)}/portal?secao=agenda&modelo=${encodeURIComponent(template)}`;
  }
  const actionHref = portalHref || realUrl(config.bookingUrl) || "#contato";
  const actionLabel = publishedSlug === "alvorada" ? "Agendar atendimento" : "Portal do Tutor";
  // Fotos exclusivas da demonstração da Alvorada. Os outros temas e clínicas não mudam.
  const classAlvorada = friendly && publishedSlug === "alvorada";
  const elanAlvorada = luxe && publishedSlug === "alvorada";
  const elanFotos = [
    "/clinic-site/alvorada/elan-gato.png",
    "/clinic-site/alvorada/elan-mulher-cachorro.png",
  ];
  const image =
    (publishedSlug === "alvorada" ? safeImage(imageOverrides.hero) : "") ||
    (publishedSlug === "alvorada" ? safeHttps(config.heroImageUrl) : "") ||
    (elanAlvorada ? elanFotos[0] : "") ||
    (classAlvorada ? "/clinic-site/class/intro-veterinaria-gato.webp" : "") ||
    safeHttps(config.heroImageUrl) ||
    (prime
      ? "/clinic-site/prime/hero.png"
      : friendly
        ? "/clinic-site/class/hero.png"
        : king
          ? "/clinic-site/king/hero.png"
          : "");
  const configuredGallery = config.galleryUrls.filter(safeHttps);
  const gallery = elanAlvorada
    ? [...elanFotos, ...configuredGallery.filter((url) => !elanFotos.includes(url))]
    : classAlvorada
      ? [
          "/clinic-site/class/intro-veterinaria-gato.webp",
          "/clinic-site/class/chegada-cachorro.webp",
          ...configuredGallery.filter(
            (url) =>
              url !== "/clinic-site/class/intro-veterinaria-gato.webp" &&
              url !== "/clinic-site/class/chegada-cachorro.webp",
          ),
        ]
      : configuredGallery.length || (!prime && !friendly && !king)
        ? configuredGallery
        : prime
          ? ["/clinic-site/prime/consulta-felina.png", "/clinic-site/prime/recuperacao-noturna.png"]
          : friendly
            ? ["/clinic-site/class/consulta-colorida.png"]
            : ["/clinic-site/king/gato-editorial.png"];
  const gallerySlots = Array.from(
    {
      length: Math.max(
        gallery.length,
        onUploadImage ? 3 : 0,
        ...Object.keys(imageOverrides)
          .filter((key) => /^gallery-[0-9]+$/.test(key))
          .map((key) => Number(key.slice(8)) + 1),
        0,
      ),
    },
    (_, index) => gallery[index] || "",
  );
  const aboutImage =
    safeImage(imageOverrides.about) ||
    (publishedSlug === "alvorada" && configuredGallery[0]
      ? configuredGallery[0]
      : classAlvorada
        ? gallery[1]
        : gallery[0]);
  // Controles de upload somente na vitrine Alvorada e com sessão admin validada.
  const uploadButton = (slot: string) =>
    onUploadImage && publishedSlug === "alvorada" && !hiddenUploadSlots.includes(slot) ? (
      uploadReadySlot === slot ? (
        <button
          type="button"
          className="absolute bottom-3 right-3 z-30 inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-lg hover:bg-emerald-700"
          onClick={(event) => {
            event.stopPropagation();
            onConfirmUpload?.(slot);
          }}
        >
          <Check size={15} /> OK
        </button>
      ) : (
        <label
          className="absolute bottom-3 right-3 z-30 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/70 bg-white/95 px-3 py-2 text-xs font-bold text-slate-900 shadow-lg hover:bg-white"
          onClick={(event) => event.stopPropagation()}
        >
          <ImagePlus size={15} />
          {uploadingSlot === slot ? "Enviando…" : "Enviar foto"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            disabled={!!uploadingSlot}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) onUploadImage(slot, file);
              event.currentTarget.value = "";
            }}
          />
        </label>
      )
    ) : null;
  const social = realUrl(config.instagramUrl);
  const mapLink = config.address
    ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(config.address)
    : "";
  const sectionOrder = config.sectionOrder.length ? config.sectionOrder : [...clinicSiteSections];
  const visible = (section: ClinicSiteSection) => !config.hiddenSections.includes(section);
  const ink = minimal
    ? "border-slate-200/80"
    : signatura
      ? "border-[#173D35]/15"
      : prime
        ? "border-[#0E5CA8]/15"
        : friendly
          ? "border-[#F05D43]/20"
          : "border-current/15";
  const outer = luxe
    ? "bg-[var(--site-bg)] text-[var(--site-text)]"
    : bold
      ? "bg-[var(--site-bg)] text-[var(--site-text)]"
      : "bg-[var(--site-bg)] text-[var(--site-text)]";
  const style = {
    "--site-primary": config.primaryColor,
    "--site-secondary": config.secondaryColor,
    "--site-bg": config.backgroundColor,
    "--site-text": config.textColor,
  } as CSSProperties;

  const brand = (
    <a
      href="#inicio"
      aria-label={"Início - " + config.name}
      className="flex min-w-0 items-center gap-3"
    >
      {safeHttps(config.logoUrl) ? (
        <span className="flex h-[72px] w-[min(48vw,240px)] shrink-0 items-center justify-start sm:w-[240px]">
          <img
            src={config.logoUrl}
            className="h-full w-full object-contain object-left"
            alt={config.name}
            width={240}
            height={72}
            decoding="async"
          />
        </span>
      ) : (
        <>
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-current/20">
            <PawPrint size={20} />
          </span>
          <span
            className={
              "max-w-48 truncate text-base font-extrabold tracking-tight sm:text-lg " + headingFont
            }
          >
            {config.name}
          </span>
        </>
      )}
    </a>
  );
  const action = (label: string, inverted = false) => (
    <a
      href={actionHref}
      className={
        "inline-flex min-h-12 items-center justify-center gap-2 px-6 py-3 text-sm font-bold transition hover:opacity-85 " +
        buttonShape +
        (inverted ? " border border-current/30" : " bg-[var(--site-primary)] text-white")
      }
    >
      <CalendarDays size={18} /> {label} <ArrowRight size={16} />
    </a>
  );
  const imagePanel = (
    <div
      className={
        "relative min-h-[270px] overflow-hidden sm:min-h-[430px] " +
        (luxe
          ? "rounded-t-[9rem] sm:rounded-t-[12rem]"
          : bold
            ? "rounded-xl"
            : prime
              ? "rounded-2xl"
              : friendly
                ? "rounded-[2.5rem]"
                : rounded
                  ? "rounded-[2rem]"
                  : "rounded-2xl")
      }
      style={{ backgroundColor: "var(--site-secondary)" }}
    >
      {image ? (
        <img
          src={image}
          alt={"Ambiente de " + config.name}
          className="absolute inset-0 h-full w-full object-cover"
          width={960}
          height={720}
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-gradient-to-tr from-black/10 to-transparent p-6 text-[var(--site-text)]">
          <div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-current/20">
            <PawPrint size={65} strokeWidth={1.2} />
          </div>
          <span className="text-center text-xs font-semibold uppercase tracking-[0.3em] opacity-70">
            {config.name}
          </span>
        </div>
      )}
      {uploadButton("hero")}
      {(luxe || organic || signatura || prime || friendly) && (
        <div className="pointer-events-none absolute bottom-5 left-5 rounded-xl border border-white/40 bg-black/40 px-5 py-3 text-xs font-semibold tracking-wide text-white backdrop-blur-md">
          {prime
            ? "Estrutura que acolhe, cuidado que acompanha"
            : friendly
              ? "Todo dia pode ser uma aventura boa"
              : "Atenção em cada detalhe"}
        </div>
      )}
    </div>
  );

  const heading = (eyebrow: string, title: string) => (
    <div className="max-w-3xl">
      <span className="text-xs font-extrabold uppercase tracking-[.2em] text-[var(--site-primary)]">
        {eyebrow}
      </span>
      <h2
        className={
          "mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl " + headingFont
        }
      >
        {title}
      </h2>
    </div>
  );

  const sections: Record<ClinicSiteSection, ReactNode> = {
    servicos: config.services.length ? (
      <section
        key="servicos"
        id="servicos"
        data-clinic-section="servicos"
        className={"px-5 sm:px-8 " + sectionPad}
      >
        <div className="mx-auto max-w-7xl">
          {heading(
            king ? "Cuidado, em capítulos" : "O que fazemos",
            king
              ? "Cada encontro muda a próxima página da história."
              : "Cuidado para cada fase da vida.",
          )}
          <div
            className={
              "mt-10 grid gap-4 " +
              (prime
                ? "sm:grid-cols-2 lg:grid-cols-4"
                : king || minimal
                  ? "md:grid-cols-2"
                  : "md:grid-cols-3")
            }
          >
            {config.services.map((service, index) => (
              <article
                key={service + "-" + index}
                className={
                  "group border p-6 transition hover:-translate-y-1 " +
                  ink +
                  " " +
                  panels +
                  (luxe
                    ? " bg-white/[.04]"
                    : signatura
                      ? " bg-white shadow-[0_18px_45px_rgba(23,61,53,.08)]"
                      : prime
                        ? " bg-white shadow-[0_15px_34px_rgba(14,92,168,.08)]"
                        : king
                          ? index % 2
                            ? " bg-[#B7183E] text-[#F2EBE1]"
                            : " bg-[#101526] text-[#F2EBE1]"
                          : bold
                            ? " bg-[var(--site-secondary)]"
                            : " bg-white/35")
                }
              >
                <div
                  className={
                    "mb-7 flex h-11 w-11 items-center justify-center bg-[var(--site-primary)] text-white " +
                    (rounded ? "rounded-full" : "rounded-lg")
                  }
                >
                  {index % 3 === 0 ? (
                    <Heart size={21} />
                  ) : index % 3 === 1 ? (
                    <ShieldCheck size={21} />
                  ) : (
                    <PawPrint size={21} />
                  )}
                </div>
                <h3 className="text-xl font-extrabold">{service}</h3>
                <p className="mt-3 text-sm leading-6 opacity-70">
                  Orientação profissional e acompanhamento cuidadoso.
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    ) : null,
    sobre: (
      <section
        key="sobre"
        id="sobre"
        data-clinic-section="sobre"
        className={"border-y px-5 sm:px-8 " + ink + " " + sectionPad}
        style={{ backgroundColor: "var(--site-secondary)" }}
      >
        <div
          className={
            "mx-auto grid max-w-7xl gap-10 md:grid-cols-2 md:items-center " +
            (organic ? "md:grid-cols-[0.85fr_1.15fr]" : "")
          }
        >
          <div className="relative">
            <div
              className={
                "flex aspect-[4/3] items-center justify-center border border-current/10 " + panels
              }
              style={{ backgroundColor: "var(--site-bg)" }}
            >
              {aboutImage ? (
                <img
                  src={aboutImage}
                  alt={"Nossa estrutura - " + config.name}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-5">
                  <Heart size={65} strokeWidth={1.1} className="text-[var(--site-primary)]" />
                  <span className="text-xs font-bold uppercase tracking-[.24em] opacity-60">
                    O nosso propósito
                  </span>
                </div>
              )}
            </div>
            {uploadButton("about")}
          </div>
          <div>
            {heading("Quem somos", config.aboutTitle || "Uma clínica feita para cuidar.")}
            <p className="mt-7 max-w-xl whitespace-pre-line text-base leading-8 opacity-80">
              {config.aboutText || config.description}
            </p>
            <div className="mt-7 flex items-center gap-3 text-sm font-bold">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-current/20">
                <Check size={20} />
              </span>
              Cuidado, respeito e transparência
            </div>
          </div>
        </div>
      </section>
    ),
    galeria:
      gallerySlots.some(Boolean) ||
      Object.keys(imageOverrides).some((key) => key.startsWith("gallery-")) ||
      onUploadImage ? (
        <section
          key="galeria"
          id="galeria"
          data-clinic-section="galeria"
          className={"px-5 sm:px-8 " + sectionPad}
        >
          <div className="mx-auto max-w-7xl">
            {heading("Por dentro", "Conheça nosso espaço.")}
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {gallerySlots.map((src, i) => (
                <figure
                  key={src + "-" + i}
                  className={
                    "relative aspect-[4/3] overflow-hidden bg-[var(--site-secondary)] " + panels
                  }
                >
                  {safeImage(imageOverrides[`gallery-${i}`]) || src ? (
                    <img
                      src={safeImage(imageOverrides[`gallery-${i}`]) || src}
                      alt={"Foto " + (i + 1) + " de " + config.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center opacity-50">
                      <ImagePlus size={38} />
                    </div>
                  )}
                  {uploadButton(`gallery-${i}`)}
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null,
    equipe: config.team.length ? (
      <section
        key="equipe"
        id="equipe"
        data-clinic-section="equipe"
        className={
          "border-t px-5 sm:px-8 " +
          ink +
          " " +
          sectionPad +
          (luxe
            ? " bg-[#101b17] text-[#f7f0e2]"
            : king
              ? " bg-[#f2ebe1]"
              : minimal
                ? " bg-white"
                : friendly
                  ? " bg-[#fff4e4]"
                  : prime
                    ? " bg-[#eef7ff]"
                    : organic
                      ? " bg-[#eaf2e3]"
                      : " bg-[#f7f4ee]")
        }
      >
        <div className="mx-auto max-w-7xl">
          {heading("Profissionais", "As pessoas por trás do cuidado.")}
          <div
            className={
              "mt-10 grid gap-5 sm:grid-cols-2 " +
              (luxe || king ? "lg:gap-9 lg:grid-cols-2" : "lg:grid-cols-3")
            }
          >
            {config.team.map((person, index) => (
              <article
                key={person.name + index}
                className={
                  "overflow-hidden border " +
                  ink +
                  " " +
                  panels +
                  (luxe
                    ? " border-[#c9a86a]/45 bg-[#21332d] shadow-2xl"
                    : king
                      ? " border-[#101526] bg-white shadow-[10px_10px_0_#b7183e]"
                      : minimal
                        ? " bg-white shadow-none"
                        : friendly
                          ? " border-[#f05d43]/30 bg-white shadow-lg"
                          : prime
                            ? " border-[#0e5ca8]/20 bg-white shadow-xl"
                            : organic
                              ? " border-[#537b52]/20 bg-[#fffdf6] shadow-md"
                              : " bg-white shadow-sm")
                }
              >
                <div
                  className={
                    "relative flex items-center justify-center overflow-hidden bg-[var(--site-secondary)] " +
                    (luxe ? "aspect-[3/4]" : king ? "aspect-square" : "aspect-[4/3]")
                  }
                >
                  <FotoPublicaDoProfissional
                    url={safeTeamPhoto(imageOverrides[`team-${index}`] || person.imageUrl)}
                    nome={person.name}
                  />
                  {uploadButton(`team-${index}`)}
                </div>
                <div className="p-5">
                  <h3 className="font-bold">{person.name}</h3>
                  <p className="mt-1 text-sm opacity-70">{person.role}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    ) : null,
    faq: config.faqItems.length ? (
      <section
        key="faq"
        id="faq"
        data-clinic-section="faq"
        className={"px-5 sm:px-8 " + sectionPad}
        style={{ backgroundColor: "var(--site-secondary)" }}
      >
        <div className="mx-auto max-w-5xl">
          {heading("Informações úteis", "Dúvidas frequentes.")}
          <div className="mt-9 space-y-3">
            {config.faqItems.map((item, i) => (
              <details
                key={i}
                className={"group border border-current/15 bg-[var(--site-bg)] p-5 " + panels}
              >
                <summary className="cursor-pointer text-base font-bold">{item.question}</summary>
                <p className="mt-3 text-sm leading-7 opacity-75">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    ) : null,
    contato: (
      <section
        key="contato"
        id="contato"
        data-clinic-section="contato"
        className={"px-5 sm:px-8 " + sectionPad}
      >
        <div
          className={
            "mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 " +
            (luxe ? "border-t border-current/20 pt-12" : "")
          }
        >
          <div>
            {heading("Vamos conversar?", "Estamos aqui por você e seu pet.")}
            <p className="mt-5 text-base leading-8 opacity-75">
              Entre em contato para consultar serviços, horários e informações de atendimento.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {action(actionLabel)}
              {config.phone ? (
                <a
                  href={"tel:" + waNumber(config.phone)}
                  className={
                    "inline-flex items-center gap-2 border border-current/25 px-5 py-3 text-sm font-bold " +
                    buttonShape
                  }
                >
                  <Phone size={17} /> Ligar
                </a>
              ) : null}
            </div>
          </div>
          <div
            className={
              "space-y-5 border border-current/15 p-7 " +
              panels +
              (luxe ? " bg-white/5" : " bg-[var(--site-secondary)]")
            }
          >
            {config.address ? (
              <div className="flex items-start gap-4">
                <MapPin className="mt-1 shrink-0 text-[var(--site-primary)]" />
                <div>
                  <strong className="block">Endereço</strong>
                  <p className="mt-1 text-sm leading-6">{config.address}</p>
                  <a
                    href={mapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm font-semibold underline"
                  >
                    Abrir no mapa
                  </a>
                </div>
              </div>
            ) : null}
            {config.hours ? (
              <div className="flex items-start gap-4">
                <Clock3 className="mt-1 shrink-0 text-[var(--site-primary)]" />
                <div>
                  <strong className="block">Funcionamento</strong>
                  <p className="mt-1 text-sm leading-6">{config.hours}</p>
                  {config.emergency24h && (
                    <p className="mt-1 text-xs font-bold">Atendimento de emergência 24h</p>
                  )}
                </div>
              </div>
            ) : null}
            {config.phone ? (
              <div className="flex items-start gap-4">
                <Phone className="mt-1 shrink-0 text-[var(--site-primary)]" />
                <div>
                  <strong className="block">Telefone</strong>
                  <a href={"tel:" + waNumber(config.phone)} className="mt-1 block text-sm">
                    {config.phone}
                  </a>
                </div>
              </div>
            ) : null}
            {hasWhatsApp ? (
              <div className="flex items-start gap-4">
                <MessageCircle className="mt-1 shrink-0 text-[var(--site-primary)]" />
                <div>
                  <strong className="block">WhatsApp</strong>
                  <a
                    href={"https://wa.me/" + waNumber(config.whatsapp)}
                    className="mt-1 block text-sm underline"
                  >
                    Conversar agora
                  </a>
                </div>
              </div>
            ) : null}
            {social ? (
              <a
                href={social}
                rel="noopener noreferrer"
                target="_blank"
                className="flex items-center gap-3 border-t border-current/15 pt-5 text-sm font-bold"
              >
                <Instagram size={20} /> Instagram <ArrowRight size={16} />
              </a>
            ) : null}
          </div>
        </div>
      </section>
    ),
  };

  const primeHero = (
    <section
      id="inicio"
      data-clinic-section="inicio"
      className="relative isolate overflow-hidden bg-[#082D52] px-5 py-16 text-white sm:px-8 sm:py-24"
    >
      {image ? (
        <img
          src={image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-50"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      ) : null}
      {uploadButton("hero")}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(95deg,rgba(6,31,60,.98)_0%,rgba(8,45,82,.94)_51%,rgba(8,45,82,.62)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-0 h-[440px] w-[440px] rounded-full bg-sky-400/10 blur-3xl"
      />

      {/* O Prime mantém o conteúdo e a faixa de benefícios em blocos separados:
          nenhum elemento é absoluto nem sobrepõe as chamadas para ação. */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-12 sm:gap-16">
        <div className="max-w-4xl">
          <span
            className="inline-flex items-center gap-2 rounded-full border border-sky-100/30 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[.16em] backdrop-blur-sm"
            style={{ color: "#DDEFFF" }}
          >
            <Clock3 size={15} />
            {config.emergency24h
              ? "Medicina veterinária 24 horas"
              : "Cuidado veterinário especializado"}
          </span>

          <h1
            className="mt-8 max-w-[850px] text-4xl font-extrabold leading-[1.06] tracking-[-.04em] sm:text-6xl lg:text-7xl"
            style={{ color: "#F8FBFF" }}
          >
            {config.slogan}
          </h1>
          <p
            className="mt-6 max-w-2xl text-base leading-relaxed sm:text-lg sm:leading-8"
            style={{ color: "#DCE8F5" }}
          >
            {config.description}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href={actionHref}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-[0_10px_26px_rgba(0,25,67,.25)] transition hover:brightness-110"
              style={{ backgroundColor: "#176CB9", color: "#FFFFFF" }}
            >
              <CalendarDays size={18} />
              {actionLabel}
              <ArrowRight size={16} />
            </a>
            {config.services.length ? (
              <a
                href="#servicos"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/45 bg-white/10 px-6 py-3 text-sm font-bold backdrop-blur-sm transition hover:bg-white/20"
                style={{ color: "#FFFFFF" }}
              >
                Ver especialidades <ArrowRight size={16} />
              </a>
            ) : null}
          </div>
        </div>

        <div
          className="grid w-full grid-cols-1 overflow-hidden rounded-3xl border border-white/20 shadow-[0_20px_55px_rgba(1,21,43,.22)] backdrop-blur-xl sm:grid-cols-3"
          style={{ backgroundColor: "rgba(234,245,255,0.10)", color: "#FFFFFF" }}
        >
          <div className="flex min-h-32 flex-col justify-center gap-3 px-6 py-6 sm:px-7">
            <ShieldCheck size={23} className="text-sky-200" aria-hidden="true" />
            <span className="text-sm font-semibold leading-6">
              Especialistas para cada necessidade
            </span>
          </div>
          <div className="flex min-h-32 flex-col justify-center gap-3 border-y border-white/15 px-6 py-6 sm:border-x sm:border-y-0 sm:px-7">
            <Heart size={23} className="text-sky-200" aria-hidden="true" />
            <span className="text-sm font-semibold leading-6">Acolhimento para toda a família</span>
          </div>
          <div className="flex min-h-32 flex-col justify-center gap-3 px-6 py-6 sm:px-7">
            <Clock3 size={23} className="text-sky-200" aria-hidden="true" />
            <span className="text-sm font-semibold leading-6">
              {config.emergency24h
                ? "Prontos para cuidar, dia e noite"
                : "Atenção em cada etapa do cuidado"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );

  const classHero = (
    <section
      id="inicio"
      data-clinic-section="inicio"
      className="relative isolate overflow-hidden bg-[#FFF8ED] px-5 py-10 sm:px-8 sm:py-14"
    >
      <div className="pointer-events-none absolute -left-14 top-10 h-40 w-40 rounded-full bg-[#FFCF52] blur-[1px]" />
      <div className="pointer-events-none absolute right-[34%] top-8 h-12 w-12 rounded-full border-[9px] border-[#35A9A0]" />
      <div className="pointer-events-none absolute -bottom-14 right-8 h-52 w-52 rounded-full bg-[#F05D43]" />
      <div className="relative mx-auto grid max-w-7xl gap-9 md:grid-cols-[.92fr_1.08fr] md:items-center">
        <div className="py-7 sm:py-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#182752] px-4 py-2 text-xs font-extrabold uppercase tracking-[.18em] text-white shadow-sm">
            <Sparkles size={15} className="text-[#FFCF52]" /> Seu pet no melhor roteiro
          </span>
          <h1 className="mt-7 max-w-2xl text-5xl font-black leading-[.91] tracking-[-.055em] text-[#182752] sm:text-7xl">
            {config.slogan}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-[#182752]/75 sm:text-lg">
            {config.description}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {action(actionLabel)}
            {config.services.length ? (
              <a
                href="#servicos"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-[#182752] bg-white px-5 py-3 text-sm font-extrabold text-[#182752] transition hover:-translate-y-0.5"
              >
                Explorar cuidados <ArrowRight size={16} />
              </a>
            ) : null}
          </div>
          <div className="mt-10 flex flex-wrap gap-3 text-sm font-bold text-[#182752]">
            <span className="rounded-full bg-white px-4 py-2 shadow-sm">
              <Heart className="mr-2 inline text-[#F05D43]" size={16} />
              Clima leve
            </span>
            <span className="rounded-full bg-white px-4 py-2 shadow-sm">
              <PawPrint className="mr-2 inline text-[#35A9A0]" size={16} />
              Cuidado de verdade
            </span>
          </div>
        </div>
        <div className="relative min-h-[360px] overflow-hidden rounded-[3rem] border-[10px] border-white bg-[#35A9A0] shadow-[0_24px_0_#182752] sm:min-h-[500px]">
          {image ? (
            <img
              src={image}
              alt="Momento feliz na clínica"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
          {uploadButton("hero")}
          <div className="absolute left-5 top-5 rounded-full bg-[#FFCF52] px-4 py-2 text-xs font-black uppercase tracking-widest text-[#182752] shadow-sm">
            Partiu cuidar
          </div>
          <div className="absolute bottom-5 right-5 max-w-[12rem] rounded-3xl bg-[#182752] p-4 text-sm font-bold leading-5 text-white shadow-xl">
            Saúde também pode ter sorriso e vento no focinho.
          </div>
        </div>
      </div>
    </section>
  );

  const kingHero = (
    <section
      id="inicio"
      data-clinic-section="inicio"
      className="relative overflow-hidden bg-[#F2EBE1] px-5 py-10 text-[#101526] sm:px-8 sm:py-14"
    >
      <div className="pointer-events-none absolute -right-16 top-0 h-64 w-64 rounded-full border-[28px] border-[#B7183E]" />
      <div className="relative mx-auto grid max-w-7xl gap-9 md:grid-cols-[.86fr_1.14fr] md:items-end">
        <div className="relative z-10 py-7 sm:pb-16 sm:pt-10">
          <span className="inline-flex items-center gap-2 border-b-2 border-[#B7183E] pb-2 text-xs font-black uppercase tracking-[.25em]">
            <Sparkles size={14} className="text-[#B7183E]" /> Cuidado em estado de arte
          </span>
          <h1 className="mt-7 max-w-2xl font-serif text-6xl leading-[.84] tracking-[-.075em] sm:text-8xl">
            {config.slogan}
          </h1>
          <p className="mt-8 max-w-lg text-base leading-8 text-[#101526]/75 sm:text-lg">
            {config.description}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            {action(actionLabel)}
            {config.services.length ? (
              <a
                href="#servicos"
                className="inline-flex min-h-12 items-center justify-center gap-2 border-b-2 border-[#101526] px-2 py-3 text-sm font-black transition hover:text-[#B7183E]"
              >
                Ver capítulos do cuidado <ArrowRight size={16} />
              </a>
            ) : null}
          </div>
          <div className="mt-12 grid max-w-lg grid-cols-2 gap-4 border-t border-[#101526]/25 pt-5 text-xs font-bold uppercase tracking-[.12em]">
            <span>
              <Heart className="mb-2 text-[#B7183E]" size={20} />
              Escuta antes de tudo
            </span>
            <span>
              <ShieldCheck className="mb-2 text-[#B7183E]" size={20} />
              Técnica com presença
            </span>
          </div>
        </div>
        <div className="relative min-h-[390px] overflow-hidden border-[7px] border-[#101526] bg-[#B7183E] shadow-[18px_18px_0_#B7183E] sm:min-h-[560px]">
          {image ? (
            <img
              src={image}
              alt="Retrato da relação entre equipe e pet"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
          {uploadButton("hero")}
          <span className="absolute bottom-0 left-0 bg-[#101526] px-5 py-3 text-xs font-black uppercase tracking-[.25em] text-[#F2EBE1]">
            King · cuidado autoral
          </span>
          <span className="absolute right-5 top-5 rounded-full bg-[#F2EBE1] px-4 py-3 text-xs font-black uppercase tracking-[.16em] text-[#101526]">
            01 / 01
          </span>
        </div>
      </div>
    </section>
  );

  return (
    <main
      className={"min-h-screen w-full overflow-x-clip " + outer}
      style={style}
      data-clinic-template={template}
    >
      {(bold || signatura || prime) && config.emergency24h ? (
        <div className="bg-[var(--site-primary)] px-4 py-2 text-center text-xs font-black uppercase tracking-widest text-white">
          Atendimento de emergência 24h · Cuidado contínuo para o seu pet
        </div>
      ) : null}
      <header
        className={
          "relative z-10 border-b border-current/10 " +
          (organic || signatura
            ? "bg-[var(--site-secondary)]"
            : prime
              ? "bg-white"
              : friendly
                ? "bg-[#FFF8ED]"
                : king
                  ? "bg-[#101526] text-[#F2EBE1] border-white/15"
                  : "")
        }
        // Élan: halo contínuo no cabeçalho inteiro, evitando recortes da área clara.
        style={
          luxe
            ? {
                backgroundImage:
                  "radial-gradient(ellipse clamp(295px, 47vw, 630px) 220px at clamp(125px, 16vw, 210px) 50%, rgba(250,245,234,0.97) 0%, rgba(250,245,234,0.94) 32%, rgba(250,245,234,0.63) 54%, rgba(250,245,234,0.16) 78%, rgba(250,245,234,0) 100%)",
              }
            : undefined
        }
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          {brand}
          <nav
            aria-label="Navegação do site"
            className={
              "hidden items-center text-sm font-semibold lg:flex " +
              (luxe
                ? "gap-4 rounded-full border border-white/10 bg-[#15251F]/80 px-4 py-2.5 text-[#FFF9EE] shadow-[0_4px_16px_rgba(0,0,0,0.14)] backdrop-blur-sm"
                : "gap-6 opacity-85")
            }
          >
            {sectionOrder
              .filter(
                (section) =>
                  visible(section) &&
                  (section !== "equipe" || config.team.length) &&
                  (section !== "galeria" || gallery.length),
              )
              .map((section) => (
                <a key={section} href={"#" + section} className="hover:text-[var(--site-primary)]">
                  {clinicSiteSectionLabels[section]}
                </a>
              ))}
          </nav>
          <a
            href={actionHref}
            className={
              "inline-flex min-h-10 shrink-0 items-center gap-2 px-3 text-xs font-extrabold sm:px-5 sm:text-sm " +
              buttonShape +
              (bold ? " bg-[var(--site-secondary)]" : " bg-[var(--site-primary)] text-white")
            }
          >
            <CalendarDays size={16} /> <span className="hidden sm:inline">Portal do Tutor</span>
            <span className="sm:hidden">Portal do Tutor</span>
          </a>
        </div>
      </header>

      {prime ? (
        primeHero
      ) : friendly ? (
        classHero
      ) : king ? (
        kingHero
      ) : (
        <section
          id="inicio"
          data-clinic-section="inicio"
          className={
            "relative px-5 sm:px-8 " +
            (luxe ? "pb-16 pt-10 sm:pb-24" : "pb-16 pt-12 sm:pb-24") +
            (bold || signatura ? " bg-[var(--site-secondary)]" : "")
          }
        >
          <div
            className={
              "mx-auto grid max-w-7xl gap-10 md:items-center " +
              (minimal || friendly || signatura
                ? "md:grid-cols-[1fr_.85fr]"
                : organic
                  ? "md:grid-cols-[.95fr_1.05fr]"
                  : "md:grid-cols-2")
            }
          >
            <div className={editorial ? "md:order-2" : ""}>
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.22em] text-[var(--site-primary)]">
                <Sparkles size={15} /> Cuidado e confiança
              </div>
              <h1
                className={
                  "mt-6 max-w-3xl leading-[1.05] tracking-tight " +
                  headingFont +
                  (bold
                    ? " text-5xl font-black uppercase sm:text-7xl"
                    : minimal
                      ? " text-5xl font-semibold sm:text-6xl"
                      : " text-5xl font-semibold sm:text-7xl")
                }
              >
                {config.slogan}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 opacity-75 sm:text-lg">
                {config.description}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {action(actionLabel)}
                {config.services.length ? (
                  <a
                    href="#servicos"
                    className={
                      "inline-flex min-h-12 items-center justify-center gap-2 border border-current/25 px-5 py-3 text-sm font-bold " +
                      buttonShape
                    }
                  >
                    Conhecer serviços <ArrowRight size={16} />
                  </a>
                ) : null}
              </div>
              <div className="mt-10 flex flex-wrap gap-5 border-t border-current/15 pt-5 text-xs font-semibold opacity-75">
                <span className="inline-flex items-center gap-2">
                  <Heart size={17} className="text-[var(--site-primary)]" /> Atendimento atencioso
                </span>
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck size={17} className="text-[var(--site-primary)]" /> Orientação
                  profissional
                </span>
                {signatura ? (
                  <span className="inline-flex items-center gap-2">
                    <Clock3 size={17} className="text-[var(--site-primary)]" /> Estrutura preparada
                    para urgências
                  </span>
                ) : null}
              </div>
            </div>
            <div className={editorial ? "md:order-1" : ""}>{imagePanel}</div>
          </div>
        </section>
      )}

      {sectionOrder.map((section) => (visible(section) ? sections[section] : null))}
      <footer
        data-clinic-section="rodape"
        className="border-t border-current/20 px-5 pb-24 pt-10 sm:px-8 sm:pb-12"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {safeHttps(config.logoUrl) ? (
              <span className="flex h-8 w-24 shrink-0 items-center">
                <img
                  src={config.logoUrl}
                  alt=""
                  className="h-full w-full object-contain object-left"
                  width={96}
                  height={32}
                  loading="lazy"
                  decoding="async"
                />
              </span>
            ) : (
              <PawPrint size={25} />
            )}
            <span className="font-bold">{config.name}</span>
          </div>
          <p className="text-xs opacity-65">
            © {new Date().getFullYear()} {config.name}. Todos os direitos reservados.
          </p>
        </div>
      </footer>
      {hasWhatsApp && (
        <a
          href={"https://wa.me/" + waNumber(config.whatsapp)}
          aria-label="Falar no WhatsApp"
          className="fixed bottom-5 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl sm:bottom-7 sm:right-7"
        >
          <MessageCircle size={26} />
        </a>
      )}
    </main>
  );
}
