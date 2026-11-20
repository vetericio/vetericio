import { ArrowRight, Check, Hospital, House } from "lucide-react";

const homeBenefits = [
  "Seu pet fica perto de você, no lugar que conhece.",
  "Você evita o trânsito e a sala de espera.",
  "Avaliamos seu pet no ambiente onde ele vive.",
];

export function VetericioCareComparison({ actionHref }: { actionHref: string }) {
  return (
    <section
      id="em-casa"
      aria-labelledby="vetericio-care-comparison-title"
      className="bg-[#FBF6EF] px-5 py-10 text-[#003D4C] sm:px-8 sm:py-16"
    >
      <div className="mx-auto max-w-7xl">
        <h2
          id="vetericio-care-comparison-title"
          className="max-w-3xl text-balance font-serif text-[clamp(2.35rem,5vw,4.5rem)] leading-[1.02] tracking-tight"
        >
          Seu pet fica em casa. O veterinário vai até ele.
        </h2>
        <div className="mt-7 grid gap-3 md:grid-cols-[1.2fr_1fr] lg:mt-9 lg:gap-5">
          <article className="rounded-2xl bg-[#003D4C] p-5 text-white sm:p-7 lg:p-8">
            <h2 className="flex items-center gap-3 text-xl font-semibold sm:text-2xl">
              <House className="shrink-0 text-[#BEE5DE]" size={27} aria-hidden="true" />
              Em casa
            </h2>
            <ul role="list" className="mt-5 space-y-2.5 text-sm leading-relaxed sm:text-base">
              {homeBenefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 shrink-0 text-[#BEE5DE]" size={19} aria-hidden="true" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <a
              href={actionHref}
              className="mt-6 inline-flex min-h-12 items-center gap-3 rounded-full bg-[#F6DFCB] px-5 text-sm font-semibold text-[#003D4C] hover:bg-white"
            >
              Agendar visita em casa <ArrowRight size={17} aria-hidden="true" />
            </a>
          </article>
          <article className="rounded-2xl border border-[#003D4C]/20 bg-[#FFFCF8] p-5 sm:p-7 lg:p-8">
            <h2 className="flex items-center gap-3 text-xl font-semibold sm:text-2xl">
              <Hospital className="shrink-0 text-[#9D3D1D]" size={27} aria-hidden="true" />
              No hospital
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-[#36555B] sm:text-base">
              Para cirurgias, internação e exames que exigem estrutura hospitalar.
            </p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#36555B] sm:text-base">
              <strong className="font-semibold text-[#003D4C]">Em emergência,</strong> vá direto a
              um hospital veterinário com pronto atendimento.
            </p>
          </article>
        </div>
        <p className="mt-5 max-w-3xl text-sm leading-relaxed text-[#36555B] sm:text-base">
          Se a visita indicar um procedimento no hospital, a Veterício leva seu pet e faz o
          procedimento lá.
        </p>
      </div>
    </section>
  );
}
