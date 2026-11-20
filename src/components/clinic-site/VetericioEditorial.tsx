import { ArrowDown, ArrowRight, CalendarDays, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const mediaRoot = "/clinic-site/vetericio";
const videoDesktop = `${mediaRoot}/atendimento-abertura.mp4`;
const videoMobile = `${mediaRoot}/atendimento-abertura-mobile.mp4`;

const steps = [
  {
    title: "Escolha um horário",
    text: "Agende a visita e conte para a gente o que seu pet precisa.",
  },
  {
    title: "Receba a equipe em casa",
    text: "Avaliamos seu pet no lugar onde ele vive e explicamos os próximos passos para você.",
  },
  {
    title: "Conte com a gente no hospital",
    text: "Se o atendimento exigir estrutura hospitalar, a equipe leva seu pet e realiza o procedimento completo lá.",
  },
];

export function VetericioHeader({
  actionHref,
  brand,
  links,
}: {
  actionHref: string;
  brand: ReactNode;
  links: { href: string; label: string }[];
}) {
  return (
    <header className="border-b border-[#003D4C]/10 bg-[#FCFAF6] text-[#003D4C]">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-4 px-5 sm:px-9">
        <div className="flex min-h-[72px] min-w-0 items-center">{brand}</div>
        <nav
          aria-label="Navegação do site"
          className="order-last flex w-full flex-wrap justify-center gap-x-5 border-t border-[#003D4C]/10 text-xs font-semibold sm:gap-x-7 lg:order-none lg:w-auto lg:border-0 lg:text-sm"
        >
          {links.map(({ href, label }) => (
            <a key={href} href={href} className="py-3 underline-offset-4 hover:underline">
              {label}
            </a>
          ))}
        </nav>
        <a
          href={actionHref}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[#003D4C]/35 px-3 text-xs font-semibold hover:bg-[#003D4C] hover:text-white sm:px-5 sm:text-sm"
        >
          <CalendarDays size={16} aria-hidden="true" /> Portal do Tutor
        </a>
      </div>
    </header>
  );
}

export function VetericioHero({
  title,
  description,
  actionHref,
  poster,
}: {
  title: string;
  description: string;
  actionHref: string;
  poster: string;
}) {
  const mediaRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const togglePlayback = useRef<() => void>(() => {});
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const media = mediaRef.current;
    const video = videoRef.current;
    if (!media || !video) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 639px)");
    let inView = false;
    let manuallyPaused = false;
    let manuallyStarted = false;

    const play = () => {
      if (!video.getAttribute("src")) video.src = mobile.matches ? videoMobile : videoDesktop;
      void video.play().catch(() => {});
    };
    const syncPlayback = () => {
      if (inView && !manuallyPaused && (!motionPreference.matches || manuallyStarted)) play();
      else video.pause();
    };
    togglePlayback.current = () => {
      if (video.paused) {
        manuallyPaused = false;
        manuallyStarted = true;
        play();
      } else {
        manuallyPaused = true;
        video.pause();
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting && entry.intersectionRatio >= 0.25;
        syncPlayback();
      },
      { threshold: 0.25 },
    );
    observer.observe(media);
    motionPreference.addEventListener("change", syncPlayback);
    return () => {
      observer.disconnect();
      motionPreference.removeEventListener("change", syncPlayback);
      video.pause();
    };
  }, []);

  return (
    <section id="inicio" data-clinic-section="inicio" className="relative bg-[#FCFAF6]">
      <div
        ref={mediaRef}
        className="relative aspect-[4/3] overflow-hidden bg-[#063742] sm:aspect-[16/9] lg:aspect-auto lg:h-[clamp(33rem,68svh,49rem)]"
      >
        <img
          src={poster}
          alt=""
          width={1600}
          height={900}
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-[55%_45%] lg:left-[25%] lg:w-3/4"
        />
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
          className={
            "absolute inset-0 h-full w-full object-cover object-center lg:left-[25%] lg:w-3/4 " +
            (started && !failed ? "opacity-100" : "opacity-0")
          }
          onPlaying={() => {
            setStarted(true);
            setPlaying(true);
          }}
          onPause={() => setPlaying(false)}
          onError={() => setFailed(true)}
        />
        <div className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(90deg,#063742_25%,rgba(6,55,66,.94)_33%,rgba(6,55,66,.72)_45%,rgba(6,55,66,.14)_68%,transparent_84%)] lg:block" />
        {!failed && (
          <button
            type="button"
            onClick={() => togglePlayback.current()}
            aria-label={playing ? "Pausar vídeo de abertura" : "Reproduzir vídeo de abertura"}
            className="absolute bottom-4 right-4 z-20 grid size-11 place-items-center rounded-full border border-white/65 bg-[#002C36]/85 text-white hover:bg-[#002C36] sm:bottom-6 sm:right-6"
          >
            {playing ? (
              <Pause size={17} aria-hidden="true" />
            ) : (
              <Play size={17} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 py-9 sm:px-9 sm:py-12 lg:pointer-events-none lg:absolute lg:inset-0 lg:z-10 lg:flex lg:items-center lg:px-16 xl:px-24">
        <div className="max-w-xl text-[#003D4C] lg:pointer-events-auto lg:text-white">
          <h1 className="text-balance font-serif text-[clamp(2.5rem,6vw,4.75rem)] leading-[.99] tracking-[-.04em]">
            {title}
          </h1>
          <p className="mt-5 max-w-[33rem] text-[15px] leading-7 lg:text-[17px] lg:leading-8">
            {description}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
            <a
              href={actionHref}
              className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[#A33C17] px-5 text-sm font-semibold text-white hover:bg-[#852B10] sm:px-6"
            >
              Agendar visita <ArrowRight size={17} aria-hidden="true" />
            </a>
            <a
              href="#como-funciona"
              className="inline-flex items-center gap-2 text-sm font-semibold underline decoration-current/60 underline-offset-4"
            >
              Como funciona <ArrowDown size={15} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function VetericioAbout({ actionHref }: { actionHref: string }) {
  return (
    <section id="sobre" data-clinic-section="sobre" className="bg-[#FCFAF6] text-[#003D4C]">
      <div className="mx-auto grid max-w-[1600px] items-center md:grid-cols-[.42fr_.58fr]">
        <div className="px-6 py-14 text-center sm:px-12 md:py-16 lg:px-16 xl:px-20">
          <h2 className="mx-auto max-w-[27rem] text-balance font-serif text-4xl leading-[1.05] tracking-tight lg:text-5xl">
            Por mais dias bons.
          </h2>
          <p className="mx-auto mt-5 max-w-[29rem] text-base leading-8">
            O lugar onde seu pet come, dorme e brinca também conta a história da saúde dele. Em
            casa, conseguimos olhar de perto para essa rotina e conversar sobre o cuidado que faz
            sentido para vocês.
          </p>
          <a
            href={actionHref}
            className="mt-7 inline-flex min-h-11 items-center gap-2 border-b border-[#A33C17] text-sm font-semibold text-[#852B10] hover:text-[#003D4C]"
          >
            Agendar uma visita <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
        <img
          src={`${mediaRoot}/meow.webp`}
          alt="Meow, um gato cinza e branco"
          width={1000}
          height={750}
          loading="lazy"
          decoding="async"
          className="aspect-[5/4] h-full max-h-[620px] w-full object-cover object-center sm:aspect-[4/3] md:aspect-auto md:min-h-[420px]"
        />
      </div>
    </section>
  );
}

export function VetericioVisitSteps() {
  return (
    <section
      id="como-funciona"
      className="bg-[#E6F1EE] px-5 py-14 text-[#003D4C] sm:px-9 sm:py-20"
      aria-labelledby="vetericio-visit-steps"
    >
      <div className="mx-auto max-w-6xl">
        <h2
          id="vetericio-visit-steps"
          className="text-balance text-center font-serif text-4xl leading-tight tracking-tight sm:text-5xl"
        >
          Como funciona a visita
        </h2>
        <ol className="mt-10 grid grid-cols-1 gap-7 md:grid-cols-3 md:gap-9">
          {steps.map(({ title, text }, index) => (
            <li key={title} className="border-t border-[#003D4C]/25 pt-5">
              <span
                className="flex size-9 items-center justify-center rounded-full bg-[#003D4C] text-sm font-semibold text-white"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 max-w-[34rem] text-sm leading-7">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
