import { useRef, useState } from "react";
import { MessageCircle, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { tokenConfiguracoesClinica } from "@/lib/configuracoes-clinica-ui";
import { salvarModeloConvite } from "@/lib/convite-portal-tutor.functions";
import {
  CAMPOS_CONVITE, LIMITE_MODELO_CONVITE, MODELO_CONVITE_PADRAO,
  camposAusentes, modeloConviteValido, preencherConvite, urlPortalDoTutor,
} from "@/lib/convite-portal-tutor";

export function EditorConvitePortalTutor({ clinicaId, clinicaNome, slug, salvo, aoSalvar }: {
  clinicaId: string;
  clinicaNome: string;
  slug: string;
  salvo: string;
  aoSalvar: (modelo: string) => void;
}) {
  const [modelo, setModelo] = useState(salvo);
  const [salvando, setSalvando] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);
  const cursor = useRef<{ inicio: number; fim: number } | null>(null);
  const ausentes = camposAusentes(modelo);
  const valido = modeloConviteValido(modelo);

  function inserir(chave: string) {
    const marcador = `{{${chave}}}`;
    const { inicio, fim } = cursor.current || { inicio: modelo.length, fim: modelo.length };
    const novo = modelo.slice(0, inicio) + marcador + modelo.slice(fim);
    if (novo.length > LIMITE_MODELO_CONVITE) return toast.error("A mensagem atingiu o limite de caracteres.");
    const posicao = inicio + marcador.length;
    cursor.current = { inicio: posicao, fim: posicao };
    setModelo(novo);
    requestAnimationFrame(() => {
      editor.current?.focus();
      editor.current?.setSelectionRange(posicao, posicao);
    });
  }

  async function salvar() {
    if (!valido) return;
    setSalvando(true);
    try {
      const accessToken = await tokenConfiguracoesClinica();
      const resultado = await salvarModeloConvite({ data: { accessToken, clinicaId, modelo } });
      setModelo(resultado.modelo);
      aoSalvar(resultado.modelo);
      toast.success("Mensagem de convite salva para esta clínica.");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar a mensagem.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold"><MessageCircle size={19} className="text-primary" /> Mensagem de convite pelo WhatsApp</h2>
      <p className="mt-1 text-sm text-muted-foreground">Personalize o texto da clínica. Clique em um campo para inseri-lo na posição do cursor.</p>
      <form className="mt-4" onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
        <fieldset disabled={salvando}>
          <legend className="mb-2 text-sm font-semibold">Campos obrigatórios</legend>
          <div className="flex flex-wrap gap-2">
            {CAMPOS_CONVITE.map(({ chave, rotulo }) => (
              <button type="button" key={chave} onClick={() => inserir(chave)}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold hover:bg-muted ${ausentes.some((campo) => campo.chave === chave) ? "border-amber-500" : ""}`}>
                <Plus size={14} /> {rotulo}
              </button>
            ))}
          </div>
          <label className="mt-4 block text-sm font-semibold" htmlFor="modelo-convite">Texto do convite</label>
          <textarea id="modelo-convite" ref={editor} value={modelo} maxLength={LIMITE_MODELO_CONVITE} rows={9}
            onSelect={(e) => { cursor.current = { inicio: e.currentTarget.selectionStart, fim: e.currentTarget.selectionEnd }; }}
            onChange={(e) => {
              cursor.current = { inicio: e.currentTarget.selectionStart, fim: e.currentTarget.selectionEnd };
              setModelo(e.currentTarget.value);
            }}
            className="mt-2 w-full rounded-xl border bg-background p-3 text-sm leading-6" />
          {!valido && <p className="mt-2 text-sm text-destructive" role="status">
            {ausentes.length ? `Faltam: ${ausentes.map(({ rotulo }) => rotulo).join(", ")}.` : "Use os botões para inserir campos reconhecidos."}
          </p>}
          <details className="mt-3 rounded-xl border px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold">Prévia com dados de exemplo</summary>
            <p className="my-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{preencherConvite(modelo, {
              nome_tutor: "Mariana Silva", nome_clinica: clinicaNome, link_portal: urlPortalDoTutor(slug),
              usuario_tutor: "@tut.mariana", codigo_ativacao: "AB12",
            })}</p>
          </details>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" disabled={!valido || modelo.trim() === salvo}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              <Save size={16} /> {salvando ? "Salvando…" : "Salvar mensagem"}
            </button>
            <button type="button" onClick={() => { cursor.current = null; setModelo(MODELO_CONVITE_PADRAO); }}
              className="min-h-11 rounded-xl border px-4 text-sm font-semibold hover:bg-muted">Restaurar texto padrão</button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
