import { Consultation, vetericioServiceIcons } from "./vetericio-service-icons";

const primaryServices = new Set([
  "Atendimento domiciliar",
  "Consultas",
  "Vacinas",
  "Exames",
  "Cirurgias",
  "Pet sitter",
]);
const brandPanels = [
  "bg-[radial-gradient(ellipse_at_90%_0%,#02758B,#03394D_74%)]",
  "bg-[radial-gradient(ellipse_at_12%_0%,#0398AC,#05384D_82%)]",
  "bg-[radial-gradient(ellipse_at_85%_100%,#017F96,#03394D_76%)]",
];

export function VetericioServices({
  services,
  descriptions,
}: {
  services: string[];
  descriptions: Record<string, string>;
}) {
  const mainServices = services.filter((service) => primaryServices.has(service));
  const specialties = services.filter((service) => !primaryServices.has(service));
  const groups = [
    { title: "Serviços veterinários", items: mainServices, columns: "lg:grid-cols-3" },
    { title: "Especialidades veterinárias", items: specialties, columns: "lg:grid-cols-4" },
  ];

  return (
    <section
      id="servicos"
      data-clinic-section="servicos"
      aria-labelledby="vetericio-services-title"
      className="bg-[#FBF7F1] px-5 py-16 text-[#03394D] sm:px-9 sm:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <h2
          id="vetericio-services-title"
          className="text-balance font-serif text-4xl leading-tight tracking-tight sm:text-6xl"
        >
          Serviços e especialidades
        </h2>
        {groups.map(({ title, items, columns }) => (
          <div key={title} className="mt-9 sm:mt-12">
            <h3 className="mb-4 border-b border-[#03394D]/15 pb-3 text-sm font-semibold sm:text-base">
              {title}
            </h3>
            <ul className={`grid gap-4 sm:grid-cols-2 sm:gap-5 ${columns}`}>
              {items.map((service, index) => {
                const Icon = vetericioServiceIcons[service] || Consultation;
                return (
                  <li
                    key={service}
                    className="overflow-hidden rounded-2xl border border-[#03394D]/15 bg-white shadow-[0_8px_24px_#03394D0D]"
                  >
                    <div
                      className={`grid h-[7.25rem] place-items-center bg-[#03394D] text-white sm:h-36 ${brandPanels[index % brandPanels.length]}`}
                      aria-hidden="true"
                    >
                      <Icon className="size-[3.75rem] sm:size-[4.75rem]" strokeWidth={1.15} />
                    </div>
                    <div className="relative p-5 before:absolute before:left-5 before:top-0 before:h-0.5 before:w-8 before:bg-[#FF6402] sm:px-6 sm:before:left-6">
                      <h4 className="text-balance font-serif text-[1.4rem] leading-tight tracking-tight">
                        {service}
                      </h4>
                      <p className="mt-2.5 text-sm leading-relaxed text-[#03394D]/90">
                        {descriptions[service]}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
