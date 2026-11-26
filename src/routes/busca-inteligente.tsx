import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft, ChevronRight, CircleAlert, ClipboardList, PawPrint,
  ReceiptText, Search, ShieldCheck, Stethoscope, UserPlus, Plus, UserRound, Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CadastroTutor } from "./tutores";
import { CadastroAnimal } from "./novo-animal";
import { supabaseBanco } from "@/integrations/supabase/client";
import { usePermissoes } from "@/hooks/usePermissoes";
import { lerComandas, saldoComanda } from "@/lib/comandas";
import { pendenciasDosPets, type FonteCuidados } from "@/lib/portal-pet-care";

export const Route = createFileRoute("/busca-inteligente")({ component: BuscaInteligente });

type Tutor = {
  id: string;
  nome: string;
  nomeSocial?: string;
  telefone?: string;
  outroTelefone?: string;
  email?: string;
  cpfCnpj?: string;
  codigoPublico?: string;
  usuarioPortal?: string;
};
type Animal = {
  id: string;
  tutorId: string;
  nome: string;
  especie?: string;
  raca?: string;
};
type ComandaResumo = {
  id: string;
  numero: number;
  tutorId: string;
  animalId: string;
  saldo: number;
};
type RegistroPreventivo = {
  id: string;
  animal_id: string;
  nome: string;
  realizado: string | null;
  proximo: string | null;
};
type Filtro = "todos" | "tutores" | "animais";

const permissoesPesquisa = ["recepcao.cadastros.visualizar", "consultorio.atendimentos"];
function normalizar(valor: unknown) {
  return String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function corresponde(termo: string, valor: unknown) {
  const campo = String(valor ?? "");
  if (normalizar(campo).includes(normalizar(termo))) return true;
  const digitos = termo.replace(/\D/g, "");
  return digitos.length >= 3 && campo.replace(/\D/g, "").includes(digitos);
}
function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dataBR(valor?: string) {
  if (!valor) return "";
  const data = new Date(valor.slice(0, 10) + "T12:00:00");
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleDateString("pt-BR");
}
function hojeBrasil() {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const mapa = Object.fromEntries(partes.map(parte => [parte.type, parte.value]));
  return [mapa.year, mapa.month, mapa.day].join("-");
}

function BuscaInteligente() {
  const { clinicaId, carregando: verificando, adminGlobal, pode, podeAlguma } = usePermissoes();
  const autorizado = adminGlobal || podeAlguma(permissoesPesquisa);
  const podeFinanceiro = adminGlobal || pode("caixa.comandas") || pode("caixa.financeiro.visualizar");
  const podeConsultar = adminGlobal || pode("consultorio.atendimentos");
  const podeCadastrar = adminGlobal || pode("recepcao.cadastros.criar");
  const contextoCadastro = useRef({ clinicaId, podeCadastrar });
  contextoCadastro.current = { clinicaId, podeCadastrar };
  const [cadastro, setCadastro] = useState<{ tipo: "tutor" | "animal"; clinicaId: string; tutorId?: string } | null>(null);
  const [atualizacao, setAtualizacao] = useState(0);
  const cadastroAtual = podeCadastrar && cadastro?.clinicaId === clinicaId ? cadastro : null;
  function concluirCadastro(id: string) {
    if (contextoCadastro.current.clinicaId !== clinicaId || !contextoCadastro.current.podeCadastrar) return;
    setCadastro(null);
    setTutorSelecionado(id);
    setAtualizacao(n => n + 1);
  }
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [tutorSelecionado, setTutorSelecionado] = useState<string | null>(null);
  const [tutores, setTutores] = useState<Tutor[]>([]);
  const [animais, setAnimais] = useState<Animal[]>([]);
  const [comandas, setComandas] = useState<ComandaResumo[]>([]);
  const [vacinas, setVacinas] = useState<RegistroPreventivo[]>([]);
  const [vermifugos, setVermifugos] = useState<RegistroPreventivo[]>([]);
  const [fonteVacinas, setFonteVacinas] = useState<FonteCuidados>("indisponivel");
  const [fonteVermifugos, setFonteVermifugos] = useState<FonteCuidados>("indisponivel");
  const [financeiroCompleto, setFinanceiroCompleto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setCadastro(null);
    setTutorSelecionado(null);
  }, [clinicaId]);

  useEffect(() => {
    if (verificando || !clinicaId || !autorizado) return;
    let ativo = true;
    setCarregando(true);
    setErro("");
    setTutores([]);
    setAnimais([]);
    setComandas([]);
    setVacinas([]);
    setVermifugos([]);
    setFonteVacinas("indisponivel");
    setFonteVermifugos("indisponivel");
    setFinanceiroCompleto(false);

    void (async () => {
      try {
        // A RPC já utiliza o contexto e as políticas de autorização da clínica.
        // Não procurar dados em outras clínicas nem usar cadastros de demonstração.
        const [cadastros, financeiras, dosesVacina, dosesVermifugo] = await Promise.all([
          (supabaseBanco as any).rpc("oricse_tutores_tela", { p_clinica: clinicaId }),
          podeFinanceiro
            ? (supabaseBanco as any).from("oricse_portal_comandas")
                .select("id,numero,status,tutor_id,animal_id,saldo")
                .eq("clinica_id", clinicaId).eq("status", "Aberta").limit(1000)
            : Promise.resolve(null),
          (supabaseBanco as any).from("oricse_portal_vacinas")
            .select("id,animal_id,nome,aplicada_em,reforco_em")
            .eq("clinica_id", clinicaId).limit(2000),
          (supabaseBanco as any).from("oricse_portal_vermifugos")
            .select("id,animal_id,nome,administrado_em,proxima_dose_em")
            .eq("clinica_id", clinicaId).limit(2000),
        ]);
        if (cadastros.error) throw cadastros.error;
        if (!Array.isArray(cadastros.data?.tutores) || !Array.isArray(cadastros.data?.animais)) {
          throw new Error("A clínica não retornou cadastros válidos para a pesquisa.");
        }
        if (!ativo) return;
        const tutoresAtuais = cadastros.data.tutores as Tutor[];
        const animaisAtuais = cadastros.data.animais as Animal[];
        setTutores(tutoresAtuais);
        setAnimais(animaisAtuais);
        if (podeFinanceiro) {
          const idsDaClinica = new Set(tutoresAtuais.map(t => t.id));
          const locais: ComandaResumo[] = lerComandas()
            .filter(c => c.status === "Aberta" && idsDaClinica.has(c.tutorId))
            .map(c => ({
              id: c.id, numero: c.numero, tutorId: c.tutorId,
              animalId: c.animalId, saldo: saldoComanda(c),
            }));
          const banco: ComandaResumo[] = financeiras?.error
            ? []
            : (financeiras?.data || [])
                .filter((c: any) => idsDaClinica.has(c.tutor_id))
                .map((c: any) => ({
                  id: String(c.id), numero: Number(c.numero) || 0,
                  tutorId: String(c.tutor_id), animalId: String(c.animal_id || ""),
                  saldo: Math.max(0, Number(c.saldo) || 0),
                }));
          setComandas([...banco, ...locais.filter(c => !banco.some(b => b.id === c.id))]);
          setFinanceiroCompleto(!financeiras?.error && (financeiras?.data || []).length < 1000);
        }
        if (!dosesVacina.error) {
          setVacinas((dosesVacina.data || []).map((v: any) => ({
            id: v.id, animal_id: v.animal_id, nome: v.nome,
            realizado: v.aplicada_em, proximo: v.reforco_em,
          })));
          setFonteVacinas((dosesVacina.data || []).length < 2000 ? "completa" : "parcial");
        }
        if (!dosesVermifugo.error) {
          setVermifugos((dosesVermifugo.data || []).map((v: any) => ({
            id: v.id, animal_id: v.animal_id, nome: v.nome,
            realizado: v.administrado_em, proximo: v.proxima_dose_em,
          })));
          setFonteVermifugos((dosesVermifugo.data || []).length < 2000 ? "completa" : "parcial");
        }
      } catch (falha) {
        if (ativo) setErro(falha instanceof Error ? falha.message : "Não foi possível carregar os cadastros.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [autorizado, clinicaId, podeFinanceiro, verificando, atualizacao]);

  const tutorPorId = useMemo(() => new Map(tutores.map(t => [t.id, t])), [tutores]);
  const tutoresEncontrados = useMemo(() => {
    if (!busca.trim()) return [];
    return tutores.filter(t => [
      t.nome, t.nomeSocial, t.telefone, t.outroTelefone, t.email,
      t.cpfCnpj, t.codigoPublico, t.usuarioPortal,
    ].some(v => corresponde(busca, v))).slice(0, 50);
  }, [tutores, busca]);
  const animaisEncontrados = useMemo(() => {
    if (!busca.trim()) return [];
    return animais.filter(a => {
      const tutor = tutorPorId.get(a.tutorId);
      return [a.nome, a.especie, a.raca, tutor?.nome, tutor?.telefone, tutor?.cpfCnpj]
        .some(v => corresponde(busca, v));
    }).slice(0, 50);
  }, [animais, busca, tutorPorId]);

  const tutor = tutorSelecionado ? tutorPorId.get(tutorSelecionado) : null;
  const petsDoTutor = useMemo(() =>
    animais.filter(a => a.tutorId === tutorSelecionado),
  [animais, tutorSelecionado]);
  const comandasDoTutor = useMemo(() =>
    comandas.filter(c => c.tutorId === tutorSelecionado),
  [comandas, tutorSelecionado]);
  const pendencias = useMemo(() => pendenciasDosPets(
    petsDoTutor, vacinas, vermifugos, [],
    { vacinas: fonteVacinas, vermifugos: fonteVermifugos }, hojeBrasil(),
  ).filter(p => p.status !== "Sem informação"), [
    petsDoTutor, vacinas, vermifugos, fonteVacinas, fonteVermifugos,
  ]);
  const saldoAberto = comandasDoTutor.reduce((soma, c) => soma + c.saldo, 0);

  if (verificando) return <main className="p-8 text-muted-foreground">Verificando acesso…</main>;
  if (!autorizado || !clinicaId) return (
    <main className="mx-auto max-w-3xl px-5 py-12" role="alert">
      <ShieldCheck className="mb-3 text-primary" />
      <h1 className="text-2xl font-bold">Busca não disponível</h1>
      <p className="mt-2 text-muted-foreground">Selecione uma clínica e verifique sua permissão para consultar cadastros ou atendimentos.</p>
      <Link to="/inicio" className="mt-5 inline-block font-semibold text-primary">Voltar ao início</Link>
    </main>
  );

  return <main className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6">
    <Link to="/inicio" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <ArrowLeft size={17} /> Início
    </Link>
    <header className="mt-5">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-primary/10 p-3 text-primary"><Search size={25} /></span>
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Busca Inteligente</h1>
          <p className="mt-1 text-sm text-muted-foreground">Encontre tutores e animais e resolva tudo a partir do perfil.</p>
        </div>
      </div>
    </header>

    {erro && <div role="alert" className="mt-5 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
      {erro} <button type="button" className="ml-2 font-semibold underline" onClick={() => window.location.reload()}>Tentar novamente</button>
    </div>}

    {cadastroAtual?.tipo === "tutor" ? <CadastroTutor key={clinicaId} dentroDaBusca={{
      clinicaId, onSalvar: concluirCadastro, onCancelar: () => setCadastro(null),
    }} /> : cadastroAtual?.tipo === "animal" && cadastroAtual.tutorId && tutor?.id === cadastroAtual.tutorId
      ? <section className="mt-6 rounded-2xl border bg-card p-4 sm:p-6">
          <button type="button" onClick={() => setCadastro(null)} className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft size={17}/> Voltar ao tutor</button>
          <CadastroAnimal key={cadastroAtual.tutorId} dentroDaBusca={{
            clinicaId, tutorId: cadastroAtual.tutorId, onSalvar: () => concluirCadastro(tutor.id), onCancelar: () => setCadastro(null),
          }} />
        </section> : !tutor ? <>
      <section className="mt-6 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label htmlFor="busca-oricse" className="block text-sm font-semibold">Quem você procura?</label>
          {podeCadastrar && <button type="button" onClick={() => setCadastro({ tipo: "tutor", clinicaId })} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><UserPlus size={18}/> Novo tutor</button>}
        </div>
        <div className="mt-2 flex min-h-13 items-center gap-3 rounded-xl border bg-background px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
          <Search className="shrink-0 text-muted-foreground" size={20} />
          <input id="busca-oricse" autoFocus value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Nome, animal, CPF, telefone ou código"
            className="min-h-12 w-full min-w-0 bg-transparent text-base outline-none" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar os resultados">
          {([
            ["todos", "Todos"], ["tutores", "Tutores"], ["animais", "Animais"],
          ] as const).map(([valor, rotulo]) => (
            <button type="button" key={valor} onClick={() => setFiltro(valor)}
              aria-pressed={filtro === valor}
              className={filtro === valor
                ? "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                : "rounded-full border bg-background px-4 py-2 text-sm font-semibold text-foreground"}>
              {rotulo}
            </button>
          ))}
        </div>
      </section>
      {carregando ? <p className="mt-6 text-sm text-muted-foreground">Carregando cadastros da clínica…</p>
      : !busca.trim() ? <div className="mt-6 rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
        <Search className="mx-auto mb-3" size={26} /> Digite para pesquisar em todos os cadastros da clínica.
      </div>
      : <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {(filtro === "todos" || filtro === "tutores") && <section aria-label="Tutores encontrados">
          <h2 className="mb-3 flex items-center gap-2 font-bold"><Users size={19} className="text-primary" /> Tutores ({tutoresEncontrados.length}{tutoresEncontrados.length === 50 ? "+" : ""})</h2>
          <div className="space-y-2">
            {tutoresEncontrados.map(t => (
              <button key={t.id} type="button" onClick={() => setTutorSelecionado(t.id)}
                className="flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-primary focus-visible:outline-2 focus-visible:outline-primary">
                <UserRound className="shrink-0 text-primary" size={22} />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate">{t.nome}</strong>
                  <span className="block truncate text-sm text-muted-foreground">{t.telefone || t.email || "Contato não informado"}</span>
                </span>
                <ChevronRight className="shrink-0 text-muted-foreground" size={18} />
              </button>
            ))}
            {!tutoresEncontrados.length && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nenhum tutor encontrado.</p>}
          </div>
        </section>}
        {(filtro === "todos" || filtro === "animais") && <section aria-label="Animais encontrados">
          <h2 className="mb-3 flex items-center gap-2 font-bold"><PawPrint size={19} className="text-primary" /> Animais ({animaisEncontrados.length}{animaisEncontrados.length === 50 ? "+" : ""})</h2>
          <div className="space-y-2">
            {animaisEncontrados.map(a => (
              <Link key={a.id} to="/animal" search={{ animalId: a.id } as never}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition hover:border-primary focus-visible:outline-2 focus-visible:outline-primary">
                <PawPrint className="shrink-0 text-primary" size={22} />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate">{a.nome}</strong>
                  <span className="block truncate text-sm text-muted-foreground">{a.especie || "Espécie não informada"} · {tutorPorId.get(a.tutorId)?.nome || "Tutor não informado"}</span>
                </span>
                <ChevronRight className="shrink-0 text-muted-foreground" size={18} />
              </Link>
            ))}
            {!animaisEncontrados.length && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nenhum animal encontrado.</p>}
          </div>
        </section>}
      </div>}
    </> : <>
      <button type="button" onClick={() => setTutorSelecionado(null)}
        className="mt-6 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary">
        <ArrowLeft size={17} /> Voltar aos resultados
      </button>
      <section className="mt-2 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-primary"><UserRound size={17} /> Perfil do tutor</div>
            <h2 className="mt-2 text-2xl font-bold">{tutor.nome}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{[tutor.telefone, tutor.email].filter(Boolean).join(" · ") || "Sem contato cadastrado"}</p>
          </div>
          <Link to="/tutores" className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Gerenciar cadastro</Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Pets vinculados</p><strong className="mt-1 block text-2xl">{petsDoTutor.length}</strong></div>
          <div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Comandas abertas</p><strong className="mt-1 block text-2xl">{podeFinanceiro ? comandasDoTutor.length : "Restrito"}</strong></div>
          <div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Pendências identificadas</p><strong className="mt-1 block text-2xl">{pendencias.length + (podeFinanceiro ? comandasDoTutor.filter(c => c.saldo > 0).length : 0)}</strong></div>
        </div>
      </section>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-lg font-bold"><PawPrint className="text-primary" size={20} /> Animais</h3>
            {podeCadastrar && <button type="button" onClick={() => setCadastro({ tipo: "animal", clinicaId, tutorId: tutor.id })} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Plus size={17}/> Adicionar animal</button>}
          </div>
          <div className="mt-4 space-y-2">
            {petsDoTutor.map(a => <div key={a.id} className="flex items-center gap-3 rounded-xl border p-3">
              <PawPrint className="shrink-0 text-primary" size={20} />
              <div className="min-w-0 flex-1"><strong className="block truncate">{a.nome}</strong><span className="text-sm text-muted-foreground">{a.especie || "Espécie não informada"}</span></div>
              <Link to="/animal" search={{ animalId: a.id } as never} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">Abrir ficha</Link>
              {podeConsultar && <Link to="/registro-clinico" search={{ animalId: a.id } as never} className="rounded-lg border px-3 py-2 text-xs font-semibold">Consultar</Link>}
            </div>)}
            {!petsDoTutor.length && <p className="text-sm text-muted-foreground">Nenhum animal vinculado.</p>}
          </div>
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="flex items-center gap-2 text-lg font-bold"><ReceiptText className="text-primary" size={20} /> Comandas abertas</h3>
          {!podeFinanceiro ? <p className="mt-4 text-sm text-muted-foreground">Informações financeiras restritas ao seu perfil.</p>
          : <div className="mt-4 space-y-2">
            {comandasDoTutor.map(c => <Link key={c.id} to="/comandas" search={{ comandaId: c.id } as never}
              className="flex items-center justify-between gap-3 rounded-xl border p-3 transition hover:border-primary">
              <span><strong className="block">Comanda #{String(c.numero).padStart(5, "0")}</strong><span className="text-xs text-muted-foreground">Abrir e resolver</span></span>
              <span className="font-semibold">{moeda(c.saldo)}</span>
            </Link>)}
            {!comandasDoTutor.length && <p className="text-sm text-muted-foreground">Nenhuma comanda aberta localizada.</p>}
            <div className="border-t pt-3 text-sm font-semibold">Saldo em aberto: {moeda(saldoAberto)}</div>
            {!financeiroCompleto && <p className="text-xs text-muted-foreground">A consulta financeira pode estar incompleta. Confira o módulo Comandas.</p>}
          </div>}
        </section>
        <section className="rounded-2xl border bg-card p-5 lg:col-span-2">
          <h3 className="flex items-center gap-2 text-lg font-bold"><CircleAlert className="text-primary" size={20} /> Pendências e cuidados</h3>
          <p className="mt-1 text-sm text-muted-foreground">Reforços de vacinas e vermífugos atrasados ou previstos para os próximos 15 dias.</p>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {pendencias.map(p => <Link key={p.id} to="/animal" search={{ animalId: p.animal.id } as never}
              className="flex items-center justify-between gap-3 rounded-xl border p-3 transition hover:border-primary">
              <span className="min-w-0">
                <strong className="block">{p.animal.nome} · {p.status}</strong>
                <span className="block text-sm text-muted-foreground">{p.titulo}{p.data ? " · " + dataBR(p.data) : ""}</span>
              </span>
              <ChevronRight className="shrink-0 text-muted-foreground" size={17} />
            </Link>)}
            {!pendencias.length && <p className="text-sm text-muted-foreground">Nenhum reforço vencido ou próximo identificado nos registros consultados.</p>}
          </div>
          <Link to="/recepcao" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
            <ClipboardList size={17} /> Ver agenda e outras pendências da recepção
          </Link>
          {(fonteVacinas !== "completa" || fonteVermifugos !== "completa") &&
            <p className="mt-3 text-xs text-muted-foreground">Alguns registros preventivos podem estar indisponíveis. Confira a ficha do animal.</p>}
        </section>
      </div>
    </>}
  </main>;
}
