import { Hospital, House, Stethoscope } from "lucide-react";

const careSettings = [
  {
    title: "Em casa",
    icon: House,
    advantage:
      "Sem carro nem sala de espera, o pet fica em um ambiente familiar. O veterinário pode observar como ele anda, descansa e se comporta na rotina.",
    limitation:
      "Alguns exames, cirurgias e internações precisam de uma estrutura que a visita domiciliar não oferece.",
  },
  {
    title: "Clínica ou pet shop com atendimento veterinário",
    icon: Stethoscope,
    advantage:
      "É uma opção para consultas, vacinas e procedimentos ambulatoriais, conforme os serviços oferecidos no local.",
    limitation:
      "Exige deslocamento e pode envolver espera. A disponibilidade de exames e de outros procedimentos varia de um estabelecimento para outro.",
  },
  {
    title: "Hospital veterinário",
    icon: Hospital,
    advantage:
      "Tem estrutura para cuidados mais complexos, como cirurgias, internação e monitoramento, conforme os recursos da unidade.",
    limitation:
      "O deslocamento e o ambiente novo podem incomodar alguns pets. Em uma emergência, procure um hospital veterinário com pronto atendimento.",
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
            Para muitos cães e gatos, ficar no próprio ambiente torna a consulta mais tranquila.
            Quando o pet precisa de equipamentos ou monitoramento, a estrutura do local também faz
            parte do cuidado.
          </p>
        </div>

        <div className="mt-9 grid gap-3 lg:mt-12 lg:grid-cols-3 lg:gap-4">
          {careSettings.map(({ title, icon: Icon, advantage, limitation }) => (
            <article
              key={title}
              className="grid gap-y-5 rounded-2xl border border-[#003D4C]/15 bg-[#FFFCF8] p-5 sm:p-7 lg:row-span-3 lg:grid-rows-subgrid"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F9E9DC] text-[#9D3D1D]">
                  <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <h3 className="self-center text-xl font-semibold leading-tight">{title}</h3>
              </div>
              <div className="border-t border-[#003D4C]/15 pt-4">
                <p className="text-sm font-semibold text-[#9D3D1D]">Vantagens</p>
                <p className="mt-2 text-sm leading-relaxed text-[#36555B] sm:text-base">
                  {advantage}
                </p>
              </div>
              <div className="border-t border-[#003D4C]/15 pt-4">
                <p className="text-sm font-semibold text-[#9D3D1D]">Limites</p>
                <p className="mt-2 text-sm leading-relaxed text-[#36555B] sm:text-base">
                  {limitation}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
