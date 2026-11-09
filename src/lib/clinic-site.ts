import { z } from "zod";

export const clinicSiteTemplates = [
  "signatura",
  "prestige",
  "atelier",
  "cuidado",
  "popular",
  "essencial",
  "horizonte",
] as const;
export type ClinicSiteTemplate = (typeof clinicSiteTemplates)[number];
export const clinicSiteTemplateLabels: Record<ClinicSiteTemplate, string> = {
  signatura: "Signature",
  prestige: "Prestige",
  atelier: "Prime",
  cuidado: "Class",
  popular: "King",
  essencial: "Essencial",
  horizonte: "Horizonte",
};
export const clinicSiteTemplateDescriptions: Record<ClinicSiteTemplate, string> = {
  signatura: "Editorial, exclusivo e sofisticado.",
  prestige: "Luxuoso, clássico e refinado.",
  atelier: "Moderno, claro e alto padrão.",
  cuidado: "Acolhedor e confiável.",
  popular: "Direto, comercial e urgente.",
  essencial: "Leve, objetivo e mobile-first.",
  horizonte: "Orgânico, natureza e bem-estar animal.",
};
export const clinicSiteTones = [
  "#6F293B",
  "#0F766E",
  "#1D4ED8",
  "#7C3AED",
  "#BE123C",
  "#C2410C",
  "#A16207",
  "#15803D",
  "#0F172A",
  "#374151",
] as const;

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const clinicSiteSchema = z.object({
  schema_version: z.literal(1),
  template: z.enum(clinicSiteTemplates),
  theme: z.object({
    colors: z.object({ primary: color, secondary: color, background: color, text: color }),
    font_pair: z.enum(["serif_editorial", "moderna_neutra", "humanista"]),
  }),
  content: z.object({
    identity: z.object({
      name: z.string().min(1).max(120),
      slogan: z.string().max(180),
      logo: z.string().url().or(z.literal("")),
    }),
    hero: z.object({
      title: z.string().min(1).max(180),
      subtitle: z.string().max(280),
      image: z.string().url().or(z.literal("")),
      cta_label: z.string().max(40),
      cta_href: z.string().max(500),
    }),
    about: z.object({
      enabled: z.boolean(),
      text: z.string().max(800),
      image: z.string().url().or(z.literal("")),
    }),
    services: z
      .array(
        z.object({
          title: z.string().min(1).max(80),
          description: z.string().max(160),
          icon: z.string().max(40).optional(),
        }),
      )
      .min(3)
      .max(8),
    gallery: z
      .array(
        z.object({
          url: z.string().url(),
          alt: z.string().min(1).max(140),
          width: z.number().positive(),
          height: z.number().positive(),
        }),
      )
      .max(8),
    team: z.array(
      z.object({
        name: z.string().min(1),
        role: z.string(),
        crmv: z.string(),
        photo: z.string().url().or(z.literal("")),
      }),
    ),
    testimonials: z.object({
      enabled: z.boolean(),
      items: z.array(z.object({ name: z.string(), text: z.string().max(320) })).max(6),
    }),
    attendance: z.object({ hours: z.string().max(500), emergency24h: z.boolean() }),
    location: z.object({ address: z.string().max(300), map_url: z.string().max(500) }),
    contact: z.object({
      phone: z.string().max(40),
      whatsapp: z.string().max(40),
      instagram: z.string().max(200),
      booking_url: z.string().max(500),
    }),
    footer: z.object({ technical_responsible: z.string().max(120), crmv: z.string().max(40) }),
  }),
  seo: z.object({
    title: z.string().max(60),
    description: z.string().max(160),
    share_image: z.string().url().or(z.literal("")),
  }),
  template_options: z.record(z.string(), z.unknown()),
});

export const clinicSiteSections = [
  "servicos",
  "sobre",
  "galeria",
  "equipe",
  "faq",
  "contato",
] as const;
export type ClinicSiteSection = (typeof clinicSiteSections)[number];
export const clinicSiteSectionLabels: Record<ClinicSiteSection, string> = {
  servicos: "Serviços",
  sobre: "Sobre nós",
  galeria: "Galeria",
  equipe: "Equipe",
  faq: "Perguntas frequentes",
  contato: "Contato",
};
export const clinicSitePresets: Record<
  ClinicSiteTemplate,
  {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
  }
> = {
  signatura: {
    primaryColor: "#173D35",
    secondaryColor: "#C9AA6A",
    backgroundColor: "#F7F5EF",
    textColor: "#173D35",
  },
  prestige: {
    primaryColor: "#C9A86A",
    secondaryColor: "#29423C",
    backgroundColor: "#121A18",
    textColor: "#F6F1E7",
  },
  atelier: {
    primaryColor: "#73523C",
    secondaryColor: "#E4D5C6",
    backgroundColor: "#F7F1EB",
    textColor: "#322920",
  },
  cuidado: {
    primaryColor: "#307760",
    secondaryColor: "#D7E8DE",
    backgroundColor: "#F2F8F4",
    textColor: "#1E4036",
  },
  popular: {
    primaryColor: "#B33C34",
    secondaryColor: "#FFE297",
    backgroundColor: "#FFFDF8",
    textColor: "#322523",
  },
  essencial: {
    primaryColor: "#263C54",
    secondaryColor: "#E7EDF2",
    backgroundColor: "#FFFFFF",
    textColor: "#1E293B",
  },
  horizonte: {
    primaryColor: "#537B52",
    secondaryColor: "#DCE8D1",
    backgroundColor: "#F6F8F0",
    textColor: "#203E30",
  },
};
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
  aboutTitle: string;
  aboutText: string;
  galleryUrls: string[];
  team: Array<{ name: string; role: string; imageUrl: string }>;
  faqItems: Array<{ question: string; answer: string }>;
  instagramUrl: string;
  bookingUrl: string;
  ctaLabel: string;
  sectionOrder: ClinicSiteSection[];
  hiddenSections: ClinicSiteSection[];
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
  aboutTitle: "Uma equipe que cuida de quem faz parte da sua família.",
  aboutText:
    "Acreditamos no atendimento responsável, na prevenção e no respeito a cada animal. Aqui você encontra orientação clara e atenção em todas as etapas do cuidado.",
  galleryUrls: [],
  team: [],
  faqItems: [
    {
      question: "Como faço um agendamento?",
      answer: "Entre em contato pelo WhatsApp ou telefone para consultar os horários disponíveis.",
    },
    {
      question: "Quais serviços estão disponíveis?",
      answer:
        "Confira nossa relação de serviços nesta página ou fale com a equipe para tirar dúvidas.",
    },
  ],
  instagramUrl: "",
  bookingUrl: "",
  ctaLabel: "Agendar atendimento",
  sectionOrder: [...clinicSiteSections],
  hiddenSections: [],
};

export function normalizeClinicSiteConfig(value: unknown): ClinicSiteConfig {
  const candidate = value && typeof value === "object" ? (value as Partial<ClinicSiteConfig>) : {};
  return {
    ...prestigeDefault,
    ...candidate,
    services: Array.isArray(candidate.services)
      ? candidate.services.filter((item): item is string => typeof item === "string").slice(0, 24)
      : prestigeDefault.services,
    galleryUrls: Array.isArray(candidate.galleryUrls)
      ? candidate.galleryUrls
          .filter((v): v is string => typeof v === "string" && /^https:\/\//i.test(v))
          .slice(0, 12)
      : [],
    team: Array.isArray(candidate.team)
      ? candidate.team
          .filter((v): v is ClinicSiteConfig["team"][number] =>
            Boolean(
              v &&
              typeof v.name === "string" &&
              typeof v.role === "string" &&
              typeof v.imageUrl === "string",
            ),
          )
          .slice(0, 20)
      : [],
    faqItems: Array.isArray(candidate.faqItems)
      ? candidate.faqItems
          .filter((v): v is ClinicSiteConfig["faqItems"][number] =>
            Boolean(v && typeof v.question === "string" && typeof v.answer === "string"),
          )
          .slice(0, 12)
      : prestigeDefault.faqItems,
    sectionOrder: [...clinicSiteSections].sort((a, b) => {
      const order = Array.isArray(candidate.sectionOrder)
        ? candidate.sectionOrder
        : [...clinicSiteSections];
      const ai = order.indexOf(a),
        bi = order.indexOf(b);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    }),
    hiddenSections: Array.isArray(candidate.hiddenSections)
      ? candidate.hiddenSections.filter((v): v is ClinicSiteSection =>
          clinicSiteSections.includes(v as ClinicSiteSection),
        )
      : [],
  };
}

export function isAaContrast(foreground: string, background: string) {
  const rgb = (hex: string) =>
    [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const luminance = (hex: string) =>
    rgb(hex)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const [a, b] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05) >= 4.5;
}

export function whatsappHref(value: string) {
  return `https://wa.me/${value.replace(/\D/g, "")}`;
}
