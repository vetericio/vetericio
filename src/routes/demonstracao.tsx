import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { CheckCircle2, ClipboardList, Sparkles, ShieldCheck } from "lucide-react";
import { supabaseBanco } from "@/integrations/supabase/client";
import { FundoDeserto } from "@/components/demonstracao/FundoDeserto";

export const Route = createFileRoute("/demonstracao")({
  head: () => ({
    meta: [
      { title: "Solicitar demonstração — Oricse" },
      { name: "description", content: "Conheça o Oricse na prática com uma demonstração personalizada para sua clínica, banho e tosa, hotelzinho ou centro veterinário." },
      { property: "og:title", content: "Solicite uma demonstração do Oricse" },
      { property: "og:description", content: "Demonstração personalizada e sem compromisso do sistema Oricse para o mercado pet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Demonstracao,
});

const TIPOS = ["Clínica/hospital veterinário", "Consultório veterinário", "Veterinário particular", "Pet shop", "Banho e tosa", "Hotelzinho/creche", "Casa de ração", "ONG", "Outro"];
const INTERESSES = ["Gestão clínica e prontuário", "Internação e medicações", "Agenda e agendamento online", "Banho e tosa", "Hotelzinho", "Financeiro e caixa", "Portal do Tutor", "Outro"];
const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const BENEFICIOS = [
  { Icone: ClipboardList, t: "Apresentação completa", d: "Do cadastro ao financeiro." },
  { Icone: Sparkles, t: "Demonstração personalizada", d: "De acordo com o seu tipo de negócio." },
  { Icone: ShieldCheck, t: "Sem compromisso", d: "Tire suas dúvidas e avalie com calma." },
];

const VAZIO = { nome: "", negocio: "", tipo_negocio: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", telefone: "", email: "", possui_sistema: "", sistema_atual: "", mensagem: "", site: "" };
type Dados = typeof VAZIO;

export function validarDemonstracao(d: Dados, consent: boolean): string | null {
  if (d.site) return "Solicitação inválida.";
  if (d.nome.trim().length < 3) return "Informe o nome completo.";
  if (d.negocio.trim().length < 2) return "Informe o nome do negócio.";
  if (!TIPOS.includes(d.tipo_negocio)) return "Selecione o tipo de negócio.";
  if (d.cidade.trim().length < 2 || !UFS.includes(d.uf)) return "Informe cidade e UF.";
  const tel = d.telefone.replace(/\D/g, "");
  if (tel.length < 10 || tel.length > 13) return "Informe um telefone (WhatsApp) válido com DDD.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) return "Informe um e-mail válido.";
  if (d.possui_sistema !== "sim" && d.possui_sistema !== "nao") return "Informe se já possui um sistema de gestão.";
  if (!consent) return "É necessário autorizar o contato sobre a demonstração.";
  return null;
}

const inputCls = "mt-1 min-h-11 w-full rounded-xl border border-[#E7D8D2] bg-white/80 px-3 text-sm font-normal text-[#4A1826] outline-none focus:border-[#C59A5C] focus:ring-2 focus:ring-[#C59A5C]/30";
const labelCls = "block text-sm font-semibold text-[#4A1826]";
const Req = () => <span className="text-[#6F293B]"> *</span>;

function Demonstracao() {
  const [d, setD] = useState<Dados>(VAZIO);
  const [interesses, setInteresses] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [enderecoCompleto, setEnderecoCompleto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const set = (k: keyof Dados) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value });

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const v = validarDemonstracao(d, consent);
    if (v) { setErro(v); return; }
    setEnviando(true);
    try {
      const { data, error } = await (supabaseBanco as any).rpc("oricse_solicitar_demonstracao", {
        p: { ...d, possui_sistema: d.possui_sistema === "sim", interesses, consentimento: consent },
      });
      if (error || !data) throw new Error(error?.message?.includes("Aguarde") || error?.message?.includes("Tente novamente") ? error.message : "Não foi possível enviar sua solicitação agora. Tente novamente em instantes ou fale conosco pelo WhatsApp.");
      setOk(true);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="relative min-h-screen text-[#4A1826]" style={{ fontFamily: "Manrope, sans-serif" }}>
      <FundoDeserto />
      <header className="relative z-10 mx-auto flex max-w-[1540px] items-center gap-4 px-5 pb-4 pt-8 text-[#4A1826] sm:px-10 lg:px-14">
        <Link to="/" className="text-5xl font-bold tracking-[-0.06em] sm:text-6xl" style={{ fontFamily: "Sora, sans-serif" }}>Oricse</Link>
        <span className="h-11 w-px bg-[#4A1826]/20" />
        <span className="text-sm sm:text-base">Soluções para o mercado pet</span>
      </header>
      <main className="relative z-10 mx-auto grid max-w-[1540px] gap-10 px-5 pb-16 pt-7 sm:px-10 lg:grid-cols-[minmax(350px,0.8fr)_minmax(590px,1.2fr)] lg:items-start lg:gap-12 lg:px-14 lg:pt-10">
        <section className="text-[#4A1826] lg:pt-14">
          <p className="inline-flex rounded-full bg-[#fbd1a5]/80 px-5 py-3 text-sm font-bold text-[#4A1826] shadow-sm">Solicitação de Demonstração</p>
          <h1 className="mt-8 text-[clamp(42px,4.2vw,68px)] font-bold leading-[1.1] tracking-[-0.045em]" style={{ fontFamily: "Sora, sans-serif" }}>Conheça o Oricse na prática</h1>
          <p className="mt-5 max-w-xl text-[17px] font-medium leading-relaxed text-[#4A1826] sm:text-[20px]">Veja como o Oricse pode organizar a rotina da sua clínica, banho e tosa, hotelzinho ou centro veterinário, com uma demonstração personalizada para o seu negócio.</p>
          <ul className="mt-12 space-y-6">
            {BENEFICIOS.map(({ Icone, t, d: desc }) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-14 w-14 shrink-0 items-center justify-center rounded-[17px] border border-[#fff2d8]/80 bg-[#ffd7a4]/85"><Icone size={27} className="text-[#6F293B]" /></span>
                <div><p className="text-[18px] font-bold">{t}</p><p className="text-sm text-[#4A1826]/90">{desc}</p></div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[28px] border border-white/95 bg-[#FBF7F2]/90 p-6 shadow-[0_20px_70px_rgba(111,41,59,.14)] backdrop-blur-md sm:p-8">
          {ok ? (
            <div className="py-10 text-center" role="status">
              <CheckCircle2 className="mx-auto text-[#6F293B]" size={44} />
              <h2 className="mt-4 text-2xl font-bold" style={{ fontFamily: "Sora, sans-serif" }}>Solicitação recebida!</h2>
              <p className="mt-2 text-[#4A1826]/80">Nossa equipe entrará em contato para agendar a apresentação.</p>
              <Link to="/" className="mt-6 inline-block rounded-xl bg-[#6F293B] px-6 py-3 font-semibold text-[#FBF7F2]">Voltar ao início</Link>
            </div>
          ) : (
            <form onSubmit={enviar} noValidate className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold" style={{ fontFamily: "Sora, sans-serif" }}>Solicite sua demonstração</h2>
                <p className="mt-1 text-sm text-[#4A1826]/75">Preencha os dados abaixo e nossa equipe entrará em contato para agendar a apresentação.</p>
              </div>
              <input type="text" name="site" tabIndex={-1} autoComplete="off" value={d.site} onChange={set("site")} className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />
              <label className={labelCls}>Nome completo<Req /><input className={inputCls} value={d.nome} onChange={set("nome")} maxLength={120} autoComplete="name" /></label>
              <label className={labelCls}>Nome do negócio (clínica, pet shop, etc.)<Req /><input className={inputCls} value={d.negocio} onChange={set("negocio")} maxLength={150} /></label>
              <label className={labelCls}>Tipo de negócio<Req />
                <select className={inputCls} value={d.tipo_negocio} onChange={set("tipo_negocio")}><option value="">Selecione</option>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select>
              </label>
              <div>
                <span className={labelCls}>Endereço (cidade/UF)<Req /></span>
                <div className="grid grid-cols-[1fr_6rem] gap-3">
                  <input aria-label="Cidade" placeholder="Cidade" className={inputCls} value={d.cidade} onChange={set("cidade")} maxLength={100} />
                  <select aria-label="UF" className={inputCls} value={d.uf} onChange={set("uf")}><option value="">UF</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
                </div>
                <button type="button" onClick={() => setEnderecoCompleto(!enderecoCompleto)} className="mt-2 text-xs font-semibold text-[#6F293B] underline">{enderecoCompleto ? "Ocultar endereço completo" : "Informar endereço completo (opcional)"}</button>
                {enderecoCompleto && (
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <input aria-label="CEP" placeholder="CEP" className={inputCls} value={d.cep} onChange={set("cep")} maxLength={9} inputMode="numeric" />
                    <input aria-label="Número" placeholder="Número" className={inputCls} value={d.numero} onChange={set("numero")} maxLength={20} />
                    <input aria-label="Logradouro" placeholder="Logradouro" className={`${inputCls} col-span-2`} value={d.logradouro} onChange={set("logradouro")} maxLength={200} />
                    <input aria-label="Complemento" placeholder="Complemento" className={inputCls} value={d.complemento} onChange={set("complemento")} maxLength={100} />
                    <input aria-label="Bairro" placeholder="Bairro" className={inputCls} value={d.bairro} onChange={set("bairro")} maxLength={100} />
                  </div>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelCls}>Telefone (WhatsApp)<Req /><input className={inputCls} value={d.telefone} onChange={set("telefone")} inputMode="tel" maxLength={20} autoComplete="tel" placeholder="(00) 00000-0000" /></label>
                <label className={labelCls}>E-mail<Req /><input type="email" className={inputCls} value={d.email} onChange={set("email")} maxLength={255} autoComplete="email" /></label>
              </div>
              <fieldset>
                <legend className={labelCls}>Já possui um sistema de gestão?<Req /></legend>
                <div className="mt-2 flex gap-5 text-sm">
                  {[["sim", "Sim"], ["nao", "Não"]].map(([v, l]) => (
                    <label key={v} className="flex items-center gap-2"><input type="radio" name="possui" value={v} checked={d.possui_sistema === v} onChange={set("possui_sistema")} className="accent-[#6F293B]" />{l}</label>
                  ))}
                </div>
              </fieldset>
              {d.possui_sistema === "sim" && <label className={labelCls}>Qual sistema você utiliza?<input className={inputCls} value={d.sistema_atual} onChange={set("sistema_atual")} maxLength={120} /></label>}
              <fieldset>
                <legend className={labelCls}>O que você busca no Oricse?</legend>
                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                  {INTERESSES.map((i) => (
                    <label key={i} className="flex items-center gap-2"><input type="checkbox" className="accent-[#6F293B]" checked={interesses.includes(i)} onChange={() => setInteresses(interesses.includes(i) ? interesses.filter((x) => x !== i) : [...interesses, i])} />{i}</label>
                  ))}
                </div>
              </fieldset>
              <label className={labelCls}>Conte um pouco sobre a sua necessidade ou objetivo com o sistema<textarea rows={4} className={`${inputCls} py-2`} value={d.mensagem} onChange={set("mensagem")} maxLength={2000} /></label>
              <label className="flex items-start gap-2 text-xs text-[#4A1826]/85">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[#6F293B]" />
                <span>Autorizo o Oricse a usar meus dados exclusivamente para entrar em contato sobre esta demonstração, conforme a <Link to="/politica-de-privacidade" className="underline">Política de Privacidade</Link> (LGPD).<Req /></span>
              </label>
              {erro && <p role="alert" className="rounded-xl border border-[#6F293B]/30 bg-[#6F293B]/10 px-3 py-2 text-sm font-semibold text-[#6F293B]">{erro}</p>}
              <div className="flex justify-center pt-2">
                <button type="submit" disabled={enviando} className="min-h-14 rounded-full bg-[#6F293B] px-12 text-base font-bold text-[#FBF7F2] transition hover:bg-[#4A1826] disabled:opacity-60">{enviando ? "Enviando..." : "Solicitar Demonstração"}</button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
