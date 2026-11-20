import {
  Bone,
  Cat,
  Droplet,
  Eye,
  HeartPulse,
  House,
  Microscope,
  Monitor,
  PawPrint,
  Plus,
  Ribbon,
  ScanLine,
  Scissors,
  Stethoscope,
  Syringe,
  Target,
  Utensils,
  Workflow,
  type LucideIcon,
} from "lucide-react";

const serviceIcons: Record<string, LucideIcon> = {
  Consultas: Stethoscope,
  Exames: Microscope,
  Cirurgias: Scissors,
  "Atendimento domiciliar": House,
  "Pet sitter": PawPrint,
  Vacinas: Syringe,
  Oftalmologia: Eye,
  Nefrologia: Droplet,
  Cardiologia: HeartPulse,
  "Odontologia veterinária": ScanLine,
  "Medicina felina": Cat,
  Endocrinologia: Workflow,
  Ultrassonografia: Monitor,
  Nutrição: Utensils,
  Fisiatria: Bone,
  Oncologia: Ribbon,
  Acupuntura: Target,
  "E muito mais...": Plus,
};

const primaryServices = new Set([
  "Atendimento domiciliar",
  "Consultas",
  "Vacinas",
  "Exames",
  "Cirurgias",
  "Pet sitter",
]);
const tones = [
  "bg-[#DCECE9] text-[#174A50]",
  "bg-[#F4E3D6] text-[#893A24]",
  "bg-[#E4EDE1] text-[#2F5347]",
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
      className="bg-white px-5 py-16 text-[#003D4C] sm:px-9 sm:py-24"
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
            <h3 className="mb-4 text-sm font-semibold text-[#36555B] sm:text-base">{title}</h3>
            <ul className={`grid gap-4 sm:grid-cols-2 ${columns}`}>
              {items.map((service, index) => {
                const Icon = serviceIcons[service] || Stethoscope;
                return (
                  <li
                    key={service}
                    className="overflow-hidden rounded-xl border border-[#003D4C]/15 bg-[#FFFCF8]"
                  >
                    <div
                      className={`relative flex h-[100px] items-center overflow-hidden px-6 sm:h-[116px] ${tones[index % tones.length]}`}
                      aria-hidden="true"
                    >
                      <Icon size={42} strokeWidth={1.45} />
                      <Icon
                        className="absolute -right-1.5 -top-4 opacity-[0.12]"
                        size={152}
                        strokeWidth={1.1}
                      />
                    </div>
                    <div className="p-5 sm:px-6">
                      <h4 className="text-lg font-semibold leading-tight">{service}</h4>
                      <p className="mt-2.5 text-sm leading-relaxed text-[#38575B]">
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
