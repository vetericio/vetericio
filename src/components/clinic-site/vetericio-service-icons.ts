import { createLucideIcon, type LucideIcon } from "lucide-react";

type IconNode = Parameters<typeof createLucideIcon>[1][number];

const outline = (d: string): IconNode => ["path", { key: "outline", d }];
const silhouette = (d: string): IconNode => [
  "path",
  { key: "silhouette", d, fill: "#0398AC", fillOpacity: "0.24" },
];
const detail = (d: string): IconNode => [
  "path",
  { key: "detail", d, strokeOpacity: "0.76", strokeWidth: "0.8" },
];
const accent = (d: string): IconNode => [
  "path",
  { key: "accent", d, stroke: "#FF6402", strokeWidth: "1" },
];

export const Consultation = createLucideIcon("VetericioConsultation", [
  outline(
    "M5.25 3.8H3.8v5.15a4.45 4.45 0 0 0 8.9 0V3.8h-1.45m-3 9.6v1.95a5.05 5.05 0 0 0 10.1 0v-.9",
  ),
  silhouette("M20.8 12a2.45 2.45 0 1 1-4.9 0 2.45 2.45 0 0 1 4.9 0Z"),
  detail("M17.7 12h1.3"),
  accent("M5.25 2.9v1.8m6-1.8v1.8"),
]);

const LabExam = createLucideIcon("VetericioLabExam", [
  silhouette("m10.4 3.35 3.85 1.32-2.43 7.1-3.85-1.32Z"),
  outline(
    "m11.4 3.69.53-1.55m1.84 5.73a5.5 5.5 0 0 1 4.4 5.46 5.57 5.57 0 0 1-5.56 5.57H9.2m-3.53 1.55h13.16M7.5 15.82h6.72m-3.45-4.4-.62 1.81",
  ),
  accent("M5.5 15.82h2"),
]);

const Surgery = createLucideIcon("VetericioSurgery", [
  silhouette("m10.5 12.05 2.45 2.45-4.04 4.03c-1.34 1.33-3.12 1.85-5.17 1.76l.79-2.26Z"),
  outline("m10.5 12.05 7.27-7.27a1.74 1.74 0 1 1 2.46 2.46l-7.28 7.26m2.29-4.14 2.61-2.61"),
  detail("m6.43 18.08 3.19-3.18"),
  accent("M3.5 12.08h3.4m-1.7-1.7v3.4"),
]);

const HomeVisit = createLucideIcon("VetericioHomeVisit", [
  silhouette("M5.1 10.25v8.68a1.3 1.3 0 0 0 1.3 1.3h11.2a1.3 1.3 0 0 0 1.3-1.3v-8.68L12 4.88Z"),
  outline("M2.8 11.97 12 4.8l9.2 7.17m-3.55-3V5.88h1.98v4.58"),
  accent("M12 11.08v5.25m-2.63-2.63h5.26"),
]);

const PetSitter = createLucideIcon("VetericioPetSitter", [
  silhouette(
    "M11.96 7.52c1.44 0 3.47 2.2 3.47 3.54 0 .7-.48 1.1-1.13 1.1-.77 0-1.36-.55-2.34-.55-1.01 0-1.55.55-2.34.55-.65 0-1.12-.4-1.12-1.1 0-1.34 2.01-3.54 3.46-3.54Z",
  ),
  outline(
    "M3 15.15h3.22c1.05 0 1.6.23 2.28.65l1.67 1.03h4.03a1.15 1.15 0 0 1 0 2.3h-4.03m5.08-.52 3.95-2.77a1.35 1.35 0 0 1 1.64 2.12l-4.02 3.09c-.46.36-1.02.5-1.66.5h-6.7L3 19.84",
  ),
  accent("M7.48 6.38l.3.67m2.57-2.93.15.74m3.22-.74-.15.74m2.97 1.52-.3.67"),
]);

const Vaccination = createLucideIcon("VetericioVaccination", [
  silhouette("m9.2 11.75 4.62 4.62 5.32-5.32-4.62-4.62Z"),
  outline(
    "m5.05 19.92 4.74-4.74m-.59-3.43 4.62 4.62m-6.03-3.21 4.62 4.62m4.42-9.34 2.22-2.22m-2.14-2.13 4.27 4.27",
  ),
  detail("m13.27 10.3 1.15 1.15m.8-3.1 1.15 1.15"),
  accent("M3.76 8.12v3.2m-1.6-1.6h3.2"),
]);

const Ophthalmology = createLucideIcon("VetericioOphthalmology", [
  silhouette(
    "M2.6 12.1c2.56-3.88 5.7-5.65 9.4-5.65s6.84 1.77 9.4 5.65c-2.56 3.87-5.7 5.64-9.4 5.64s-6.84-1.77-9.4-5.64Z",
  ),
  outline("M15.65 12.1a3.65 3.65 0 1 1-7.3 0 3.65 3.65 0 0 1 7.3 0Z"),
  detail("M12 10.58a1.52 1.52 0 0 0-1.52 1.52"),
  accent("M12 3.25v1.2m4.83.13-.64.99M7.17 4.58l.64.99"),
]);

const Nephrology = createLucideIcon("VetericioNephrology", [
  silhouette(
    "M7.1 4.2c-2.92 0-4.7 3.22-4.7 6.96 0 3.33 1.65 5.3 3.61 5.3 1.6 0 2.51-1.01 2.51-2.16 0-1.48-1.22-1.56-1.22-3.16 0-1.85 2.12-2.16 2.12-4.55A2.34 2.34 0 0 0 7.1 4.2Zm9.8 0c2.92 0 4.7 3.22 4.7 6.96 0 3.33-1.65 5.3-3.61 5.3-1.6 0-2.51-1.01-2.51-2.16 0-1.48 1.22-1.56 1.22-3.16 0-1.85-2.12-2.16-2.12-4.55a2.34 2.34 0 0 1 2.32-2.39Z",
  ),
  outline("M7.43 11.82c2.24.12 2.75 2.09 2.75 3.8v4.12m6.39-7.92c-2.24.12-2.75 2.09-2.75 3.8v4.12"),
  accent("M10.18 19.74v1.2m3.64-1.2v1.2"),
]);

const Cardiology = createLucideIcon("VetericioCardiology", [
  silhouette(
    "M12 20.22c-1.63-1.14-7.93-5.38-9.21-8.98-1.25-3.51.84-6.86 4.25-6.86 2.12 0 3.72 1.14 4.96 2.82 1.24-1.68 2.84-2.82 4.96-2.82 3.41 0 5.5 3.35 4.25 6.86C19.93 14.84 13.63 19.08 12 20.22Z",
  ),
  outline("M4.65 12.02H8.3l1.8-3.3 2.09 6.47 1.73-3.17h5.43"),
  accent("M16.12 12.02h2.28"),
]);

const Dentistry = createLucideIcon("VetericioDentistry", [
  silhouette(
    "M5.31 5.92c1.41-1.81 3.61-2.14 5.49-1.12.78.42 1.62.42 2.4 0 1.88-1.02 4.08-.69 5.49 1.12 1.63 2.09 1.16 4.47.08 6.63-.79 1.58-1.24 2.94-1.55 4.73-.23 1.3-.82 2.37-1.64 2.37-.95 0-1.16-1.5-1.51-2.92-.45-1.84-1.07-2.8-2.07-2.8s-1.62.96-2.07 2.8c-.35 1.42-.56 2.92-1.51 2.92-.82 0-1.41-1.07-1.64-2.37-.31-1.79-.76-3.15-1.55-4.73-1.08-2.16-1.55-4.54.08-6.63Z",
  ),
  detail("M8.56 7.54c1.11-.42 1.9.36 3.44.36"),
  accent("M20.72 3.09v2.9m-1.45-1.45h2.9"),
]);

const FelineCare = createLucideIcon("VetericioFelineCare", [
  silhouette(
    "M7.25 10.6c-1.55-.67-2.6-1.89-2.6-3.55l-.1-3.2L7.2 5.4a4.5 4.5 0 0 1 3.07-.07l2.56-1.72-.08 3.26c.17 1.6-.65 2.83-2.01 3.54l.55 1.23c3.24.72 5.48 2.8 5.48 5.15 0 2.12-1.38 3.41-3.37 3.41H6.51c-1.07 0-1.67-.54-1.67-1.34 0-.8.7-1.35 2.04-1.35l.37-4.38Z",
  ),
  outline(
    "M13.45 20.2h4.22c2.22 0 3.55-1.37 3.55-3.11 0-1.55-1.03-2.69-2.32-2.69m-6.6.44c-1.42.51-2.16 1.85-1.93 2.95H9.21",
  ),
  detail("M6.61 7.89h.36m3.27 0h.36M3 8.9l1.88.54m7.48.06L14 8.92"),
  accent("M8.55 9.26h.22"),
]);

const Endocrinology = createLucideIcon("VetericioEndocrinology", [
  detail(
    "M10.35 7.91V2.8m3.3 5.11V2.8M10.35 21.2v-4.58m3.3 4.58v-4.58m-3.3-11.62h3.3m-3.3 14h3.3M6.05 7.14C5.29 8.42 5 10.46 5.49 12.62m12.46-5.48c.76 1.28 1.05 3.32.56 5.48",
  ),
  silhouette(
    "M12 10c-1.02 0-1.78-.61-2.18-1.53C9.08 6.72 8.22 3.6 5.91 3.6c-2.38 0-3.51 2.91-3.51 6.05 0 5.16 1.6 10.12 4.48 10.12 1.99 0 3.02-2.36 3.79-4.53.27-.75.7-1.16 1.33-1.16s1.06.41 1.33 1.16c.77 2.17 1.8 4.53 3.79 4.53 2.88 0 4.48-4.96 4.48-10.12 0-3.14-1.13-6.05-3.51-6.05-2.31 0-3.17 3.12-3.91 4.87C13.78 9.39 13.02 10 12 10Z",
  ),
  accent("M11.1 12.1h1.8"),
]);

const Ultrasound = createLucideIcon("VetericioUltrasound", [
  silhouette(
    "M4.1 3.8h12.35a1.2 1.2 0 0 1 1.2 1.2v8.5a1.2 1.2 0 0 1-1.2 1.2H4.1a1.2 1.2 0 0 1-1.2-1.2V5a1.2 1.2 0 0 1 1.2-1.2Z",
  ),
  outline(
    "M10.28 14.7v3.2m-3.35.1h6.69m4.08-1.79c0 1.29-.23 2.56.72 3.51.62.62 1.44.63 1.98.28m-2.38-6.13 1.39-1.36a1.33 1.33 0 0 1 1.88 1.88l-1.36 1.38a1.35 1.35 0 0 1-1.91-1.9Z",
  ),
  detail("M7 11.51a4.63 4.63 0 0 1 6.55 0M8.62 10l1.66-2.76L11.94 10"),
  accent("M9.8 6.56h.96"),
]);

const Nutrition = createLucideIcon("VetericioNutrition", [
  silhouette("M3.4 12.25h17.2c-.49 3.82-2.67 6.2-5.9 6.7H9.3c-3.23-.5-5.41-2.88-5.9-6.7Z"),
  outline(
    "M9.5 12.25c.87-3.79 3.67-6.36 8.2-6.74-.45 3.49-2.6 6.74-8.2 6.74Zm1.26-2.69c-1.22-1.59-2.94-2.2-4.71-2.13.39 1.91 1.6 3.03 3.92 3.22",
  ),
  detail("M6.3 15.11h11.4m-8.42 5.52h5.44"),
  accent("M18.9 9.2h.7m-1.3 1.68h.7"),
]);

const Rehabilitation = createLucideIcon("VetericioRehabilitation", [
  silhouette(
    "M6.05 4.42c3.44-.19 6.95 1.36 7.88 4.29l-1.2 3.5 2.59 4.28h2.26c1.26 0 2.32.9 2.32 2.06 0 .81-.66 1.38-1.46 1.38h-4.31c-.83 0-1.37-.39-1.72-.99l-3.77-6.55.62-2.23-3.21-1.65",
  ),
  detail("m11.4 12.7 2.35 4.1m3.47 1.25v1.66"),
  outline("M4.34 11.17a5.34 5.34 0 0 0 .77 6.72m-2.52-3.25 1.34 3.55 3.45-1.6"),
  accent("M12.37 11.93h.68"),
]);

const Oncology = createLucideIcon("VetericioOncology", [
  silhouette(
    "M7.62 6.25C8.34 4.36 9.87 3.4 12 3.4s3.66.96 4.38 2.85l1.17 3.12c.36.96.16 1.91-.47 2.71l-7.69 9.1-3.22-2.74 7.67-8.57a.9.9 0 0 0 .17-.9l-.8-2.11m-5.59-.61-1.17 3.12c-.36.96-.16 1.91.47 2.71l1.63 1.93m5.27-.71 4.01 5.14-3.22 2.74-2.62-3.21",
  ),
  outline("M7.62 6.25a7.06 7.06 0 0 1 8.76 0m-5.59.61-.8 2.09a.9.9 0 0 0 .17.9l1.76 2.03"),
  accent("M20.33 7.64v2.93m-1.46-1.47h2.92"),
]);

const Acupuncture = createLucideIcon("VetericioAcupuncture", [
  silhouette(
    "M3.85 16.75c2.82-.92 5.51-.98 8.15-.2 2.64.78 5.33.73 8.15-.2v2.25c-2.82.93-5.51.98-8.15.2-2.64-.78-5.33-.72-8.15.2Z",
  ),
  outline("m6.3 4.05 1.5 3.3m.72 1.6 2.65 5.84m7.58-11.2-1.92 3.04m-.93 1.48-3.82 6.03"),
  detail("m5.58 5.5 1.34-.61m11.05.32 1.24.78"),
  accent("M11.45 16.01h1.1"),
]);

const MoreCare = createLucideIcon("VetericioMoreCare", [
  silhouette("M10.13 5.85h3.74v4.28h4.28v3.74h-4.28v4.28h-3.74v-4.28H5.85v-3.74h4.28Z"),
  detail("M3.4 10.1a8.85 8.85 0 0 1 5.33-5.91m11.87 9.7a8.85 8.85 0 0 1-5.33 5.92"),
  accent("M19.3 4.8v3.05m-1.52-1.53h3.05M4.7 16.15v3.05m-1.52-1.53h3.05"),
]);

export const vetericioServiceIcons: Record<string, LucideIcon> = {
  Consultas: Consultation,
  Exames: LabExam,
  Cirurgias: Surgery,
  "Atendimento domiciliar": HomeVisit,
  "Pet sitter": PetSitter,
  Vacinas: Vaccination,
  Oftalmologia: Ophthalmology,
  Nefrologia: Nephrology,
  Cardiologia: Cardiology,
  "Odontologia veterinária": Dentistry,
  "Medicina felina": FelineCare,
  Endocrinologia: Endocrinology,
  Ultrassonografia: Ultrasound,
  Nutrição: Nutrition,
  Fisiatria: Rehabilitation,
  Oncologia: Oncology,
  Acupuntura: Acupuncture,
  "E muito mais...": MoreCare,
};
