export type ClinicSiteConfig = {
  name: string;
  slogan: string;
  description: string;
  logoUrl: string;
  heroImageUrl: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  phone: string;
  whatsapp: string;
  address: string;
  hours: string;
  emergency24h: boolean;
  services: string[];
};

export const prestigeDefault: ClinicSiteConfig = {
  name: "Sua clínica veterinária",
  slogan: "Cuidado extraordinário para quem faz parte da família.",
  description: "Medicina veterinária atenta, humana e personalizada.",
  logoUrl: "",
  heroImageUrl: "",
  primaryColor: "#C9A86A",
  secondaryColor: "#29423C",
  backgroundColor: "#121A18",
  textColor: "#F6F1E7",
  phone: "",
  whatsapp: "",
  address: "",
  hours: "Consulte nossos horários",
  emergency24h: false,
  services: ["Consulta personalizada", "Especialidades veterinárias", "Diagnóstico e prevenção"],
};

export function normalizeClinicSiteConfig(value: unknown): ClinicSiteConfig {
  const candidate = value && typeof value === "object" ? (value as Partial<ClinicSiteConfig>) : {};
  return {
    ...prestigeDefault,
    ...candidate,
    services: Array.isArray(candidate.services)
      ? candidate.services.filter((item): item is string => typeof item === "string")
      : prestigeDefault.services,
  };
}

export function whatsappHref(value: string) {
  return `https://wa.me/${value.replace(/\D/g, "")}`;
}
