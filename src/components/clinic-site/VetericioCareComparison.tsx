import { Hospital, House } from "lucide-react";

const careSettings = [
  {
    title: "Em casa",
    icon: House,
    cardStyle: "border-[#003D4C]/30 bg-[#E6F1EE]",
    iconStyle: "bg-[#003D4C] text-white",
    benefits: [
      {
        title: "Mais conforto para o pet",
        description:
          "Ele fica perto de você, no ambiente que conhece. Isso pode deixar a consulta mais tranquila para gatos e pets que ficam agitados no trajeto.",
      },
      {
        title: "Mais praticidade para você",
        description:
          "Você recebe a equipe com hora marcada, sem ter que organizar o transporte, pegar trânsito ou passar pela sala de espera.",
      },
      {
        title: "Uma avaliação que leva a rotina em conta",
        description:
          "O veterinário pode observar como seu pet se movimenta, onde come e como descansa. Esses detalhes ajudam a orientar o cuidado.",
      },
    ],
    noteTitle: "E se precisar do hospital?",
    note: "Se o procedimento exigir estrutura hospitalar, a equipe da Veterício leva seu pet ao hospital e realiza todo o procedimento lá.",
  },
  {
    title: "No hospital veterinário",
    icon: Hospital,
    cardStyle: "border-[#003D4C]/15 bg-[#FFFCF8]",
    iconStyle: "bg-[#F9E9DC] text-[#9D3D1D]",
    benefits: [
      {
        title: "Estrutura para procedimentos",
        description:
          "Equipamentos para exames e centro cirúrgico, conforme os recursos de cada hospital.",
      },
      {
        title: "Internação e monitoramento",
        description:
          "Quando o pet precisa ficar em observação, o hospital pode oferecer acompanhamento e cuidados intensivos conforme a estrutura disponível.",
      },
      {
        title: "Pronto atendimento em emergências",
        description:
          "Em caso de emergência, procure diretamente um hospital veterinário com pronto atendimento.",
      },
    ],
    noteTitle: "O que considerar na ida",
    note: "A ida envolve deslocamento e pode ter espera. Alguns pets ficam mais agitados durante o trajeto ou em um ambiente desconhecido.",
  },
] as const;

export function VetericioCareComparison() {
  return (
    <section
      id="em-casa"
      aria-labelledby="vetericio-care-comparison-title"
      className="scroll-mt-24 bg-[#FBF6EF] px-5 py-16 text-[#003D4C] sm:px-8 sm:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <h2
            id="vetericio-care-comparison-title"
            className="text-balance font-serif text-4xl leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl"
          >
            O que muda quando o veterinário vai até o pet
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#36555B] sm:text-lg">
            Na consulta de rotina, o veterinário pode ir até vocês. Compare o conforto de receber a
            equipe em casa com os recursos que o hospital oferece quando o caso pede mais estrutura.
          </p>
        </div>

        <div className="mt-9 grid gap-4 md:grid-cols-2 lg:mt-12 lg:gap-5">
          {careSettings.map(
            ({ title, icon: Icon, cardStyle, iconStyle, benefits, noteTitle, note }) => (
              <article
                key={title}
                className={`grid gap-y-5 rounded-2xl border p-5 sm:p-7 md:row-span-3 md:grid-rows-subgrid lg:p-8 ${cardStyle}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`grid size-11 shrink-0 place-items-center rounded-full ${iconStyle}`}
                  >
                    <Icon size={21} strokeWidth={1.7} aria-hidden="true" />
                  </span>
                  <h3 className="text-xl font-semibold leading-tight sm:text-2xl">{title}</h3>
                </div>
                <ul className="space-y-4 border-t border-[#003D4C]/15 pt-5">
                  {benefits.map(({ title, description }) => (
                    <li key={title}>
                      <h4 className="font-semibold">{title}</h4>
                      <p className="mt-1 text-sm leading-relaxed text-[#36555B] sm:text-base">
                        {description}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-[#003D4C]/15 pt-4">
                  <h4 className="text-sm font-semibold text-[#9D3D1D]">{noteTitle}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-[#36555B] sm:text-base">{note}</p>
                </div>
              </article>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
