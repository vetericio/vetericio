import { AlertCircle, Check, CheckCircle2, ChevronRight, Droplets, FileCheck2, FlaskConical, Plus, Settings2, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Especie } from "@/lib/ficha";
import type { ExameAnamnese } from "@/lib/anamnese";
import {
  atualizarReferenciaExame,
  avaliarExame,
  normalizarExames,
  referenciaCadastrada,
  referenciaDoExame,
  type ExamesAnamnese,
  type GrupoExames,
  type ReferenciasExames,
} from "@/lib/exames-laboratoriais";

type Props = {
  especie: Especie;
  exames: Partial<ExamesAnamnese>;
  referencias: ReferenciasExames;
  erroReferencias: boolean;
  onChange: (exames: ExamesAnamnese) => void;
  onReferenciasChange: (referencias: ReferenciasExames) => void;
  onLimpar: () => void;
};

const campo = "min-h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";
const acao = "inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-border px-2.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50";

export function ExamesLaboratoriais({ especie, exames, referencias, erroReferencias, onChange, onReferenciasChange, onLimpar }: Props) {
  const [grupoEditando, setGrupoEditando] = useState<GrupoExames | null>(null);
  const listas = normalizarExames(exames);

  const mudar = (grupo: GrupoExames, indice: number, campoExame: "nome" | "unidade" | "valor" | "referencia", valor: string) => {
    const anterior = listas[grupo][indice];
    if (!anterior) return;
    const alterado: ExameAnamnese = { ...anterior, [campoExame]: valor };
    if (campoExame === "nome" || campoExame === "unidade") {
      // Uma unidade/nome diferente nunca herda silenciosamente a faixa anterior.
      alterado.referencia = referenciaCadastrada(alterado, especie, referencias);
      alterado.referenciaEspecie = especie;
    }
    if (campoExame === "referencia") {
      alterado.referenciaEspecie = especie;
      onReferenciasChange(atualizarReferenciaExame(referencias, especie, alterado));
    }
    onChange({ ...listas, [grupo]: listas[grupo].map((x, i) => i === indice ? alterado : x) });
  };

  const adicionar = (grupo: GrupoExames) => onChange({
    ...listas,
    [grupo]: [...listas[grupo], { id: crypto.randomUUID(), nome: "", unidade: "", valor: "", referencia: "", personalizado: true }],
  });

  // Função de renderização, não um componente criado a cada tecla: preserva o foco.
  const renderizarGrupo = (grupo: GrupoExames, titulo: string) => {
    const editando = grupoEditando === grupo;
    const Icone = grupo === "hemograma" ? Droplets : FlaskConical;
    return (
      <div key={grupo} className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card/80">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3 sm:p-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground sm:text-lg">
            <Icone className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" /> {titulo}
          </h3>
          <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto">
            <button type="button" disabled={!especie} aria-pressed={editando} aria-label={`${editando ? "Concluir" : "Editar"} referências de ${titulo}`} onClick={() => setGrupoEditando(editando ? null : grupo)} className={acao}>
              {editando ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Settings2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
              {editando ? "Concluir referências" : "Editar referências"}
            </button>
            <button type="button" onClick={() => adicionar(grupo)} aria-label={`Adicionar exame em ${titulo}`} className={acao}>
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" /> Adicionar exame
            </button>
          </div>
        </div>
        <div className="divide-y divide-border">
          {listas[grupo].map((exame, indice) => {
            const ref = referenciaDoExame(exame, especie, referencias);
            const estado = especie ? avaliarExame(exame.valor, ref) : "neutro";
            const descricao = estado === "dentro" ? "Dentro da referência informada" : estado === "abaixo" ? "Abaixo da referência informada" : "Acima da referência informada";
            const livre = !!exame.personalizado;
            const nomeAcessivel = exame.nome.trim() || `novo exame ${indice + 1} de ${titulo}`;
            return (
              <div key={exame.id ?? `${grupo}-${indice}`} className="min-w-0 space-y-2 p-3 sm:p-4">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(4.5rem,6rem)_1.5rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_1.5rem] sm:gap-3">
                  <div className="min-w-0">
                    {livre ? (
                      <input aria-label={`Nome do exame ${indice + 1} de ${titulo}`} autoFocus={!exame.nome && !!exame.id} value={exame.nome} onChange={(e) => mudar(grupo, indice, "nome", e.target.value)} placeholder="Nome do exame" className={campo} />
                    ) : (
                      <p className="break-words text-sm font-semibold leading-snug text-foreground sm:text-base">
                        {exame.nome}<span className="ml-1 font-normal text-muted-foreground">{exame.unidade ? `(${exame.unidade})` : ""}</span>
                      </p>
                    )}
                  </div>
                  <input aria-label={`Valor de ${nomeAcessivel}`} value={exame.valor} onChange={(e) => mudar(grupo, indice, "valor", e.target.value)} inputMode="decimal" placeholder="Valor" className={`${campo} px-2 text-center`} />
                  {estado !== "neutro" ? (
                    <span role="img" aria-label={descricao} title={descricao}>
                      {estado === "dentro" ? <CheckCircle2 aria-hidden="true" className="h-6 w-6 text-emerald-600 dark:text-emerald-400" /> : <AlertCircle aria-hidden="true" className="h-6 w-6 text-destructive" />}
                    </span>
                  ) : <span aria-hidden="true" className="text-center text-muted-foreground">—</span>}
                </div>
                {(editando || livre) ? (
                  <div className={`grid min-w-0 gap-2 ${livre ? "grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_2.75rem]" : "grid-cols-2"}`}>
                    <label className="min-w-0 text-xs text-muted-foreground">
                      Unidade
                      <input aria-label={`Unidade de ${nomeAcessivel}`} value={exame.unidade ?? ""} onChange={(e) => mudar(grupo, indice, "unidade", e.target.value)} placeholder="Unidade" className={`${campo} mt-1 px-2`} />
                    </label>
                    <label className="min-w-0 text-xs text-muted-foreground">
                      Referência
                      <input aria-label={`Referência de ${nomeAcessivel}`} disabled={!especie || !exame.nome.trim()} value={ref} onChange={(e) => mudar(grupo, indice, "referencia", e.target.value)} placeholder="Mín. – máx." className={`${campo} mt-1 px-2 disabled:opacity-50`} />
                    </label>
                    {livre && <button type="button" onClick={() => onChange({ ...listas, [grupo]: listas[grupo].filter((_, i) => i !== indice) })} aria-label={`Remover ${nomeAcessivel}`} className="mt-5 flex min-h-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-destructive"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>}
                  </div>
                ) : <p className="text-xs text-muted-foreground sm:text-sm">{ref ? `Ref.: ${ref}` : "Referência não cadastrada"}</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section aria-label="Exames laboratoriais" className="min-w-0 space-y-4 pt-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-foreground">Exames laboratoriais</h2>
        {especie && Object.keys(referencias[especie]).length > 0 && !erroReferencias && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><FileCheck2 className="h-4 w-4" aria-hidden="true" /> Referências salvas</span>
        )}
      </div>
      {!especie && <p className="text-sm text-muted-foreground">Selecione a espécie no início da anamnese para cadastrar ou usar as referências.</p>}
      <p className="text-xs leading-relaxed text-muted-foreground">Use os intervalos e unidades do laudo. Referências separadas por espécie, salvas neste aparelho. Campos vazios não entram na ficha nem no PDF.</p>
      {erroReferencias && <p role="alert" className="text-sm text-destructive">Não foi possível guardar as referências neste aparelho. Mantenha a página aberta para não perder as alterações.</p>}
      {renderizarGrupo("hemograma", "Hemograma")}
      {renderizarGrupo("bioquimico", "Bioquímico")}
      {listas.outrosExames.length > 0 && renderizarGrupo("outrosExames", "Outros exames")}
      <button type="button" onClick={() => adicionar("outrosExames")} className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-secondary">
        <Plus className="h-5 w-5 shrink-0" aria-hidden="true" /> <span className="flex-1">Adicionar outro exame</span> <ChevronRight className="h-5 w-5 shrink-0" aria-hidden="true" />
      </button>
      <button type="button" onClick={onLimpar} className={acao}><Trash2 className="h-4 w-4" aria-hidden="true" /> Limpar exames</button>
    </section>
  );
}
