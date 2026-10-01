import { useEffect, useState } from "react";
import { FileDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAnamneses } from "@/hooks/useAnamneses";
import { lerSelo } from "@/lib/assinatura";
import { baixarReceituario, ENDERECO_RECEITUARIO, type ItemReceituario } from "@/lib/receituario";

const novoItem = (): ItemReceituario => ({
  id: crypto.randomUUID(),
  medicamento: "",
  posologia: "",
});
const campo =
  "mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-ring";
const rotulo = "text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground";

export function Receituario() {
  const { anamneses } = useAnamneses();
  const [paciente, setPaciente] = useState("");
  const [especie, setEspecie] = useState("");
  const [peso, setPeso] = useState("");
  const [tutor, setTutor] = useState("");
  const [data, setData] = useState(() => new Date().toLocaleDateString("pt-BR"));
  const [itens, setItens] = useState<ItemReceituario[]>(() => [novoItem()]);
  const [observacoes, setObservacoes] = useState("");
  const [endereco, setEndereco] = useState(ENDERECO_RECEITUARIO);
  const [gerando, setGerando] = useState(false);
  const [temSelo, setTemSelo] = useState(false);

  useEffect(() => {
    const atualizar = () => setTemSelo(Boolean(lerSelo("assinatura") || lerSelo("carimbo")));
    atualizar();
    window.addEventListener("veterico-selos", atualizar);
    window.addEventListener("storage", atualizar);
    return () => {
      window.removeEventListener("veterico-selos", atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, []);

  const escolherPaciente = (id: string) => {
    const anamnese = anamneses.find((item) => item.id === id);
    if (!anamnese) return;
    setPaciente(anamnese.animal);
    setEspecie(anamnese.especie);
    setPeso(anamnese.peso);
  };

  const atualizarItem = (id: string, chave: "medicamento" | "posologia", valor: string) =>
    setItens((atual) => atual.map((item) => (item.id === id ? { ...item, [chave]: valor } : item)));

  const gerar = async () => {
    if (gerando) return;
    if (!paciente.trim()) {
      toast.error("Informe o nome do paciente.");
      return;
    }
    if (!itens.some((item) => item.medicamento.trim() || item.posologia.trim())) {
      toast.error("Adicione ao menos um medicamento ou orientação.");
      return;
    }
    setGerando(true);
    try {
      await baixarReceituario({
        paciente,
        especie,
        peso,
        tutor,
        data,
        itens,
        observacoes,
        endereco,
      });
      toast.success("Receituário em PDF gerado.");
    } catch (erro) {
      console.error("Falha ao gerar receituário:", erro);
      toast.error(
        "Não foi possível gerar o PDF. Confira a assinatura e o carimbo e tente novamente.",
      );
    } finally {
      setGerando(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 pb-28">
      <section>
        <h1 className="font-display text-xl font-semibold text-foreground">Receituário</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gere o PDF com sua assinatura e carimbo já cadastrados.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="font-display font-semibold text-foreground">Identificação</h2>
        {anamneses.length > 0 && (
          <label className="mt-3 block">
            <span className={rotulo}>Puxar da Anamnese</span>
            <select
              defaultValue=""
              onChange={(e) => escolherPaciente(e.target.value)}
              className={campo}
            >
              <option value="">Preencher manualmente</option>
              {anamneses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.animal} {item.especie ? `· ${item.especie}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label>
            <span className={rotulo}>Paciente</span>
            <input
              value={paciente}
              onChange={(e) => setPaciente(e.target.value)}
              className={campo}
              placeholder="Nome do animal"
            />
          </label>
          <label>
            <span className={rotulo}>Tutor</span>
            <input
              value={tutor}
              onChange={(e) => setTutor(e.target.value)}
              className={campo}
              placeholder="Nome do responsável"
            />
          </label>
          <label>
            <span className={rotulo}>Espécie</span>
            <input
              value={especie}
              onChange={(e) => setEspecie(e.target.value)}
              className={campo}
              placeholder="Ex.: Felina"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className={rotulo}>Peso</span>
              <input
                value={peso}
                onChange={(e) => setPeso(e.target.value.replace(".", ","))}
                inputMode="decimal"
                className={campo}
                placeholder="kg"
              />
            </label>
            <label>
              <span className={rotulo}>Data</span>
              <input
                value={data}
                onChange={(e) => setData(e.target.value)}
                className={campo}
                placeholder="dd/mm/aaaa"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display font-semibold text-foreground">Prescrição</h2>
          <button
            type="button"
            onClick={() => setItens((atual) => [...atual, novoItem()])}
            className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-secondary px-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70"
          >
            <Plus className="h-4 w-4" /> Medicamento
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {itens.map((item, indice) => (
            <div key={item.id} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">{indice + 1}.</p>
                {itens.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItens((atual) => atual.filter((x) => x.id !== item.id))}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                    aria-label={`Remover medicamento ${indice + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <label className="mt-1 block">
                <span className={rotulo}>Medicamento</span>
                <input
                  value={item.medicamento}
                  onChange={(e) => atualizarItem(item.id, "medicamento", e.target.value)}
                  className={campo}
                  placeholder="Nome e apresentação do medicamento"
                />
              </label>
              <label className="mt-2 block">
                <span className={rotulo}>Posologia e orientações</span>
                <textarea
                  value={item.posologia}
                  onChange={(e) => atualizarItem(item.id, "posologia", e.target.value)}
                  rows={2}
                  className={campo}
                  placeholder="Quantidade, via, intervalo e duração"
                />
              </label>
            </div>
          ))}
        </div>
        <label className="mt-4 block">
          <span className={rotulo}>Orientações gerais</span>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
            className={campo}
            placeholder="Observações adicionais para o tutor (opcional)"
          />
        </label>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="font-display font-semibold text-foreground">Rodapé do documento</h2>
        <label className="mt-3 block">
          <span className={rotulo}>Endereço</span>
          <textarea
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            rows={2}
            className={campo}
            placeholder="Endereço que aparecerá no final da folha"
          />
        </label>
        <p className="mt-3 text-xs text-muted-foreground">
          {temSelo
            ? "O PDF usa a assinatura e o carimbo salvos em Assinar um documento."
            : "Cadastre sua assinatura e seu carimbo em Assinar um documento para incluí-los no PDF."}
        </p>
      </section>

      <button
        type="button"
        onClick={() => void gerar()}
        disabled={gerando}
        className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 mx-auto flex min-h-14 w-auto max-w-3xl items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-base font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 disabled:opacity-60"
      >
        <FileDown className="h-5 w-5" />
        {gerando ? "Gerando PDF…" : "Gerar receituário em PDF"}
      </button>
    </main>
  );
}
