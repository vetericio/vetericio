import {
  Bone,
  createLucideIcon,
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
  type LucideIcon,
} from "lucide-react";

const FelinePortrait = createLucideIcon("FelinePortrait", [
  [
    "path",
    {
      key: "contour",
      d: "M7.25 10.6c-1.55-.67-2.6-1.89-2.6-3.55l-.1-3.2L7.2 5.4a4.5 4.5 0 0 1 3.07-.07l2.56-1.72-.08 3.26c.17 1.6-.65 2.83-2.01 3.54l.55 1.23c3.24.72 5.48 2.8 5.48 5.15 0 2.12-1.38 3.41-3.37 3.41H6.51c-1.07 0-1.67-.54-1.67-1.34 0-.8.7-1.35 2.04-1.35l.37-4.38Z",
      fill: "#0398AC",
      fillOpacity: "0.24",
    },
  ],
  [
    "path",
    {
      key: "tail",
      d: "M13.45 20.2h4.22c2.22 0 3.55-1.37 3.55-3.11 0-1.55-1.03-2.69-2.32-2.69",
    },
  ],
  ["path", { key: "paw", d: "M12.3 14.84c-1.42.51-2.16 1.85-1.93 2.95H9.21" }],
  [
    "path",
    {
      key: "face",
      d: "M6.61 7.89h.36m3.27 0h.36M3 8.9l1.88.54m7.48.06L14 8.92",
      strokeWidth: "0.85",
    },
  ],
]);

const Thyroid = createLucideIcon("Thyroid", [
  [
    "path",
    {
      key: "trachea",
      d: "M10.35 7.91V2.8m3.3 5.11V2.8M10.35 21.2v-4.58m3.3 4.58v-4.58m-3.3-11.62h3.3m-3.3 14h3.3",
      strokeOpacity: "0.57",
      strokeWidth: "0.85",
    },
  ],
  [
    "path",
    {
      key: "gland",
      d: "M12 10c-1.02 0-1.78-.61-2.18-1.53C9.08 6.72 8.22 3.6 5.91 3.6c-2.38 0-3.51 2.91-3.51 6.05 0 5.16 1.6 10.12 4.48 10.12 1.99 0 3.02-2.36 3.79-4.53.27-.75.7-1.16 1.33-1.16s1.06.41 1.33 1.16c.77 2.17 1.8 4.53 3.79 4.53 2.88 0 4.48-4.96 4.48-10.12 0-3.14-1.13-6.05-3.51-6.05-2.31 0-3.17 3.12-3.91 4.87C13.78 9.39 13.02 10 12 10Z",
      fill: "#0398AC",
      fillOpacity: "0.24",
    },
  ],
  [
    "path",
    {
      key: "lobes",
      d: "M6.05 7.14C5.29 8.42 5 10.46 5.49 12.62m12.46-5.48c.76 1.28 1.05 3.32.56 5.48",
      strokeOpacity: "0.7",
      strokeWidth: "0.85",
    },
  ],
]);

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
  "Medicina felina": FelinePortrait,
  Endocrinologia: Thyroid,
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
      className="bg-white px-5 py-16 text-[#03394D] sm:px-9 sm:py-24"
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
                const Icon = serviceIcons[service] || Stethoscope;
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
