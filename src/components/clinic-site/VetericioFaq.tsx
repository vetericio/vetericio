import { ArrowUpRight, CalendarDays, Hospital, House, Minus, Plus } from "lucide-react";

const faqTopics = [
  {
    title: "A visita em casa",
    icon: House,
    items: [
      {
        question: "Como funciona a consulta em casa?",
        answer:
          "O veterinário vai até você com hora marcada, examina seu pet e conversa sobre a saúde e a rotina dele. Ao final da consulta, explica os próximos passos.",
      },
      {
        question: "Vocês atendem cães e gatos em casa?",
        answer:
          "Sim. A visita é uma opção para cães e gatos, inclusive os que ficam ansiosos no carro ou na caixa de transporte.",
      },
      {
        question: "Dá para vacinar meu pet em casa?",
        answer:
          "Consulte a disponibilidade ao agendar. Na visita, o veterinário confere a carteirinha e avalia seu pet para orientar quais vacinas estão indicadas.",
      },
      {
        question: "Posso pedir atendimento com um especialista?",
        answer:
          "Sim. Oferecemos especialidades como cardiologia, oftalmologia e medicina felina. Na hora de agendar, confirme se o atendimento indicado pode ser feito em casa.",
      },
      {
        question: "O que preciso preparar para a visita?",
        answer:
          "Separe a carteirinha de vacinação, exames anteriores e a lista de medicamentos em uso, se tiver. Escolha um cantinho tranquilo onde seu pet costuma ficar à vontade.",
      },
    ],
  },
  {
    title: "Exames e hospital",
    icon: Hospital,
    items: [
      {
        question: "E se meu pet precisar ir ao hospital?",
        answer:
          "Se a avaliação indicar um procedimento hospitalar, a equipe da Veterício organiza o transporte, leva seu pet ao hospital e realiza todo o procedimento lá.",
      },
      {
        question: "Todos os exames podem ser feitos em casa?",
        answer:
          "Depende do exame. Na consulta, o veterinário explica quais podem ser feitos em casa e quais exigem equipamentos ou estrutura hospitalar.",
      },
      {
        question: "Onde são feitas as cirurgias?",
        answer:
          "No hospital. Quando há indicação de cirurgia, a equipe explica as etapas do procedimento e organiza a ida.",
      },
      {
        question: "Posso fazer o retorno em casa?",
        answer:
          "O retorno pode ser feito em casa quando o veterinário avaliar que a visita é suficiente para acompanhar a recuperação ou o tratamento.",
      },
      {
        question: "O que faço se for uma emergência?",
        answer:
          "Vá diretamente a um hospital veterinário com pronto atendimento. As visitas da Veterício são agendadas.",
      },
    ],
  },
  {
    title: "Agenda e valores",
    icon: CalendarDays,
    items: [
      {
        question: "Como marco a primeira consulta?",
        answer:
          "Fale com a equipe pelo WhatsApp e diga em que bairro você mora e qual atendimento seu pet precisa. Se já usa o Portal do Tutor, você também pode começar por lá.",
      },
      {
        question: "Vocês atendem no meu bairro?",
        answer:
          "Atendemos em Belo Horizonte e na região metropolitana. Informe seu bairro e sua cidade pelo WhatsApp para confirmar a disponibilidade.",
      },
      {
        question: "Quanto custa a visita?",
        answer:
          "Consulte o valor pelo WhatsApp antes de marcar. Informe o bairro e o serviço que procura. Se houver indicação de exame ou procedimento, consulte também o valor dessa etapa.",
      },
      {
        question: "A visita tem horário marcado?",
        answer:
          "Sim. Na hora de agendar, você combina com a equipe um dos horários disponíveis que encaixe na sua rotina.",
      },
      {
        question: "Como faço para remarcar?",
        answer:
          "Avise a equipe pelo WhatsApp assim que souber que precisa mudar o horário. Informe o nome do seu pet e a data da visita para consultar outras opções.",
      },
    ],
  },
];

export function VetericioFaq({ whatsAppHref }: { whatsAppHref?: string }) {
  return (
    <section
      id="faq"
      data-clinic-section="faq"
      aria-labelledby="vetericio-faq-title"
      className="bg-[#E6F2F0] px-5 py-14 text-[#003D4C] sm:px-8 sm:py-20"
    >
      <div className="mx-auto max-w-7xl">
        <div className="border-b border-[#B9D5D2] pb-6 sm:flex sm:items-end sm:justify-between sm:gap-6">
          <h2
            id="vetericio-faq-title"
            className="text-balance font-serif text-4xl leading-[1.08] tracking-tight sm:text-6xl"
          >
            Dúvidas frequentes
          </h2>
          {whatsAppHref && (
            <a
              href={whatsAppHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-semibold text-[#8D3A22] underline underline-offset-4 hover:text-[#003D4C] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#003D4C] sm:mt-0"
            >
              Falar com a equipe no WhatsApp
              <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          )}
        </div>

        <div className="mt-6 grid gap-5 sm:mt-8 lg:grid-cols-3">
          {faqTopics.map(({ title, icon: Icon, items }) => (
            <article key={title} className="rounded-2xl border border-[#BDD6D3] bg-[#FFFCF8]">
              <h3 className="flex items-center gap-3 rounded-t-2xl bg-[#F4EEE6] px-4 py-4 text-lg font-semibold sm:px-5">
                <Icon size={22} className="shrink-0 text-[#8D3A22]" aria-hidden="true" />
                {title}
              </h3>
              <div className="divide-y divide-[#D9E5E2] px-4 sm:px-5">
                {items.map(({ question, answer }, index) => (
                  <details key={question} className="group" open={index === 0 || undefined}>
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-3 text-sm font-semibold leading-snug hover:text-[#8D3A22] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003D4C] sm:text-base [&::-webkit-details-marker]:hidden">
                      <span>{question}</span>
                      <span
                        aria-hidden="true"
                        className="grid size-7 shrink-0 place-items-center rounded-full bg-[#E6F2F0] text-[#003D4C] group-open:bg-[#003D4C] group-open:text-white"
                      >
                        <Plus size={15} className="group-open:hidden" />
                        <Minus size={15} className="hidden group-open:block" />
                      </span>
                    </summary>
                    <p className="pb-4 pr-6 text-sm leading-relaxed text-[#36555B]">{answer}</p>
                  </details>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
