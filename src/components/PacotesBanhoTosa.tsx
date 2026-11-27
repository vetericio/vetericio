import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabaseBanco } from "@/integrations/supabase/client";
import { centavosDoCampo, digitarCentavos } from "@/lib/moeda-centavos";
import {
  diaDoPacote,
  formasPacoteBanho,
  statusPacoteBanho,
  pacoteElegivel,
  type PacoteBanho,
  type VendaPacoteBanho,
} from "@/lib/pacotes-banho-tosa";

type RpcPacotes = {
  rpc(
    nome: "oricse_banho_listar_pacotes",
    args: { p_clinica: string; p_animal: string; p_portal: boolean },
  ): PromiseLike<{ data: PacoteBanho[] | null; error: { message: string } | null }>;
  rpc(
    nome: "oricse_banho_vender_pacote",
    args: VendaPacoteBanho,
  ): PromiseLike<{ data: string | null; error: { message: string } | null }>;
};
const banco = supabaseBanco as unknown as RpcPacotes;
const classeCampo = "mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal";
const btn =
  "min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50";
const formatarDia = (dia: string) => dia.split("-").reverse().join("/");
const hora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});

function usePacotes(clinicaId: string, animalId: string, portal: boolean, revisao = 0) {
  const chave = `${clinicaId}:${animalId}:${portal}:${revisao}`;
  const [resposta, setResposta] = useState<{
    chave: string;
    itens: PacoteBanho[];
    erro: boolean;
  }>();
  useEffect(() => {
    if (!clinicaId || !animalId) return;
    let ativo = true;
    (async () => {
      try {
        const { data, error } = await banco.rpc("oricse_banho_listar_pacotes", {
          p_clinica: clinicaId,
          p_animal: animalId,
          p_portal: portal,
        });
        if (ativo) setResposta({ chave, itens: error ? [] : (data ?? []), erro: Boolean(error) });
      } catch {
        if (ativo) setResposta({ chave, itens: [], erro: true });
      }
    })();
    return () => {
      ativo = false;
    };
  }, [animalId, chave, clinicaId, portal]);
  const atual = resposta?.chave === chave ? resposta : null;
  return {
    itens: atual?.itens ?? [],
    erro: atual?.erro ?? false,
    carregando: Boolean(clinicaId && animalId && !atual),
  };
}

function ListaPacotes({ itens }: { itens: PacoteBanho[] }) {
  return (
    <ul className="space-y-2">
      {itens.map((p) => (
        <li key={p.id} className="rounded-xl border p-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-1">
            <div>
              <p className="font-bold">{p.nome}</p>
              <p>
                {p.servicoNome} · validade {formatarDia(p.validade)}
              </p>
            </div>
            <span className="rounded-full border px-2 py-0.5 text-xs font-semibold">
              {statusPacoteBanho[p.status]}
            </span>
          </div>
          <p className="mt-2">
            <strong>{p.disponiveis} disponíveis para agendar</strong> · {p.reservadas} reservadas ·{" "}
            {p.usadas} de {p.total} usadas
          </p>
          {p.status === "suspenso" && (
            <p className="mt-1 text-muted-foreground">Fale com a clínica para conferir o pacote.</p>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer font-medium">
              Histórico de sessões utilizadas
            </summary>
            {p.historico.length ? (
              <ol className="mt-2 list-inside list-disc">
                {p.historico.map((movimento, index) => (
                  <li key={index}>
                    Sessão utilizada em {hora.format(new Date(movimento.consumidoEm))}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-1 text-muted-foreground">Nenhuma sessão utilizada.</p>
            )}
          </details>
        </li>
      ))}
    </ul>
  );
}

export function PortalPacotesBanhoTosa({
  clinicaId,
  animais,
}: {
  clinicaId: string;
  animais: { id: string; nome: string }[];
}) {
  const [pet, setPet] = useState("");
  const animalId = animais.some((a) => a.id === pet) ? pet : (animais[0]?.id ?? "");
  const { itens, erro, carregando } = usePacotes(clinicaId, animalId, true);
  if (animais.length < 2 && !itens.length && !erro) return null;
  return (
    <section className="rounded-2xl border bg-white p-4" aria-label="Pacotes de banho e tosa">
      <h2 className="mb-3 font-bold">Pacotes de banho e tosa</h2>
      {animais.length > 1 && (
        <label className="mb-3 block text-sm font-semibold">
          Pet do pacote
          <select className={classeCampo} value={animalId} onChange={(e) => setPet(e.target.value)}>
            {animais.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      {erro ? (
        <p role="status" className="text-sm text-muted-foreground">
          Não foi possível consultar os pacotes agora.
        </p>
      ) : carregando ? (
        <p role="status" className="text-sm text-muted-foreground">
          Consultando pacotes…
        </p>
      ) : itens.length ? (
        <ListaPacotes itens={itens} />
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum pacote para este pet.</p>
      )}
    </section>
  );
}

export function SelecionarPacoteBanho({
  clinicaId,
  animalId,
  servicoId,
  inicio,
  valor,
  onMudar,
  revisao,
}: {
  clinicaId: string;
  animalId: string;
  servicoId: string;
  inicio: string;
  valor: string;
  onMudar: (id: string) => void;
  revisao?: number;
}) {
  const { itens, erro, carregando } = usePacotes(clinicaId, animalId, false, revisao);
  if (!animalId || !servicoId) return null;
  const elegiveis = itens.filter((p) =>
    pacoteElegivel(p, servicoId, new Date(inicio), diaDoPacote(Date.now())),
  );
  return (
    <div className="space-y-1">
      <label className="block text-sm font-semibold">
        Usar pacote de banho e tosa (opcional)
        <select
          className={classeCampo}
          value={valor}
          onChange={(e) => onMudar(e.target.value)}
          disabled={carregando || erro}
        >
          <option value="">Sem pacote</option>
          {elegiveis.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} · {p.disponiveis} disponível(is) · até {formatarDia(p.validade)}
            </option>
          ))}
        </select>
      </label>
      {carregando ? (
        <p role="status" className="text-xs">
          Consultando sessões…
        </p>
      ) : erro ? (
        <p role="alert" className="text-xs text-destructive">
          Não foi possível consultar os pacotes. Atualize e confira antes de cobrar o serviço.
        </p>
      ) : !elegiveis.length ? (
        <p className="text-xs text-muted-foreground">
          Nenhum pacote disponível para este pet, serviço e data.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          O agendamento reserva a sessão. A sessão é utilizada ao marcar o serviço como pronto.
          Extras são separados.
        </p>
      )}
    </div>
  );
}

type PainelProps = {
  clinicaId: string;
  podeVender: boolean;
  animais: { id: string; nome: string; tutor_id: string }[];
  tutores: { id: string; nome: string }[];
  servicos: { id: string; nome: string; ativo: boolean }[];
};

export function PainelPacotesBanhoTosa(props: PainelProps) {
  return <PainelPacotes key={props.clinicaId} {...props} />;
}
function PainelPacotes({ clinicaId, podeVender, animais, tutores, servicos }: PainelProps) {
  const [animalId, setAnimalId] = useState("");
  const [servico, setServico] = useState("");
  const [nome, setNome] = useState("");
  const [sessoes, setSessoes] = useState("4");
  const [validade, setValidade] = useState("");
  const [preco, setPreco] = useState("");
  const [forma, setForma] = useState("Pix");
  const [recebido, setRecebido] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const [erro, setErro] = useState("");
  const envio = useRef<string | null>(null);
  const trava = useRef(false);
  const { itens, erro: erroLista, carregando } = usePacotes(clinicaId, animalId, false, revisao);
  const mapaTutores = new Map(tutores.map((t) => [t.id, t.nome]));
  const animal = animais.find((a) => a.id === animalId);
  async function vender(e: FormEvent) {
    e.preventDefault();
    if (trava.current || !podeVender || !recebido) return;
    const quantia = centavosDoCampo(preco);
    const num = Number(sessoes);
    if (
      !animal ||
      !servico ||
      !nome.trim() ||
      !validade ||
      quantia <= 0 ||
      !Number.isInteger(num) ||
      num < 1 ||
      num > 100
    ) {
      setErro("Preencha pet, serviço, nome, número de sessões, validade e valor recebido.");
      return;
    }
    setErro("");
    trava.current = true;
    setSalvando(true);
    try {
      envio.current ??= crypto.randomUUID();
      const { data, error } = await banco.rpc("oricse_banho_vender_pacote", {
        p_clinica: clinicaId,
        p_animal: animalId,
        p_servico: servico,
        p_nome: nome.trim(),
        p_sessoes: num,
        p_validade: validade,
        p_valor_centavos: quantia,
        p_forma: forma,
        p_requisicao: envio.current,
      });
      if (error || !data)
        throw Error(
          error?.message ||
            "Não foi possível saber se a venda foi registrada. Confira o histórico e tente novamente.",
        );
      envio.current = null;
      setNome("");
      setServico("");
      setPreco("");
      setRecebido(false);
      setRevisao((v) => v + 1);
      toast.success("Venda registrada e sessões disponíveis no pacote.");
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível registrar a venda. Confira o histórico.",
      );
    } finally {
      trava.current = false;
      setSalvando(false);
    }
  }
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4">
      <div>
        <h2 className="font-bold">Pacotes de banho e tosa</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulte saldo, validade e sessões utilizadas por pet.
        </p>
      </div>
      <label className="block text-sm font-bold">
        Pet
        <select
          className={classeCampo}
          value={animalId}
          disabled={salvando}
          onChange={(e) => {
            setAnimalId(e.target.value);
            setRecebido(false);
          }}
        >
          <option value="">Selecione o pet</option>
          {animais.map((pet) => (
            <option key={pet.id} value={pet.id}>
              {pet.nome} · {mapaTutores.get(pet.tutor_id) ?? "Tutor"}
            </option>
          ))}
        </select>
      </label>
      {animal && (
        <>
          {podeVender && (
            <form className="space-y-3 rounded-xl border p-3" onSubmit={vender}>
              <h3 className="font-bold">Registrar venda de pacote</h3>
              <p className="text-sm text-muted-foreground">
                Registre somente um pagamento já recebido. Este botão não executa cobrança.
              </p>
              <fieldset disabled={salvando} className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Nome do pacote
                  <input
                    className={classeCampo}
                    required
                    maxLength={120}
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Serviço coberto
                  <select
                    className={classeCampo}
                    required
                    value={servico}
                    onChange={(e) => setServico(e.target.value)}
                  >
                    <option value="">Selecione o serviço</option>
                    {servicos
                      .filter((s) => s.ativo)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Sessões
                  <input
                    className={classeCampo}
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    required
                    value={sessoes}
                    onChange={(e) => setSessoes(e.target.value)}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Válido até
                  <input
                    className={classeCampo}
                    type="date"
                    required
                    min={diaDoPacote(Date.now())}
                    value={validade}
                    onChange={(e) => setValidade(e.target.value)}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Valor recebido (R$)
                  <input
                    className={classeCampo}
                    inputMode="numeric"
                    required
                    placeholder="0,00"
                    value={preco}
                    onChange={(e) => setPreco(digitarCentavos(e.target.value))}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Forma de pagamento
                  <select
                    className={classeCampo}
                    value={forma}
                    onChange={(e) => setForma(e.target.value)}
                  >
                    {formasPacoteBanho.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-start gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    required
                    checked={recebido}
                    onChange={(e) => setRecebido(e.target.checked)}
                  />
                  Confirmo que já recebi o pagamento integral deste pacote.
                </label>
              </fieldset>
              {erro && (
                <p role="alert" className="text-sm text-destructive">
                  {erro}
                </p>
              )}
              <button className={btn} disabled={salvando || !recebido}>
                {salvando ? "Registrando…" : "Registrar venda"}
              </button>
            </form>
          )}
          {carregando ? (
            <p role="status" className="text-sm">
              Consultando pacotes…
            </p>
          ) : erroLista ? (
            <p role="alert" className="text-sm text-destructive">
              Não foi possível consultar os pacotes.{" "}
              <button
                type="button"
                className="font-bold underline"
                onClick={() => setRevisao((v) => v + 1)}
              >
                Tentar novamente
              </button>
            </p>
          ) : itens.length ? (
            <ListaPacotes itens={itens} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Este pet ainda não tem pacotes registrados.
            </p>
          )}
        </>
      )}
    </section>
  );
}
