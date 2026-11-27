import { useEffect, useState } from "react";
import { supabaseBanco } from "@/integrations/supabase/client";

const rotulos = {
  entrega_observada: "Entrega observada",
  resposta_observada: "Resposta observada",
} as const;
type Situacao = keyof typeof rotulos;
type Nota = { situacao: Situacao; registrado_em: string };

export function HistoricoWhatsAppManual({
  clinicaId,
  eventoId,
  fonte,
  podeRegistrar,
}: {
  clinicaId: string;
  eventoId: string;
  fonte?: "banco" | "drive";
  podeRegistrar: boolean;
}) {
  const db = supabaseBanco;
  const [aberto, setAberto] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    if (!aberto || fonte !== "banco") return;
    let ativo = true;
    setPronto(false);
    setErro("");
    void (async () => {
      try {
        const { data, error } = await db
          .from("oricse_whatsapp_acompanhamentos")
          .select("situacao,registrado_em")
          .eq("clinica_id", clinicaId)
          .eq("evento_id", eventoId)
          .order("registrado_em");
        if (!ativo) return;
        if (error) throw error;
        setNotas(data ?? []);
        setPronto(true);
      } catch {
        if (ativo) setErro("Não foi possível consultar este acompanhamento.");
      }
    })();
    return () => {
      ativo = false;
    };
  }, [db, aberto, clinicaId, eventoId, revisao, fonte]);

  async function registrar(situacao: Situacao) {
    if (!podeRegistrar || !pronto || salvando || notas.some((n) => n.situacao === situacao)) return;
    setSalvando(true);
    setErro("");
    try {
      const { error } = await db
        .from("oricse_whatsapp_acompanhamentos")
        .insert({ clinica_id: clinicaId, evento_id: eventoId, situacao });
      if (error && error.code !== "23505") throw error;
      setRevisao((n) => n + 1);
    } catch {
      setErro("A anotação não foi confirmada.");
    } finally {
      setSalvando(false);
    }
  }
  if (fonte !== "banco")
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        Este contato é legado; o envio informado continua no histórico, sem confirmação de entrega
        ou resposta.
      </p>
    );
  return (
    <details
      className="mt-3 rounded-lg border p-2.5 text-sm"
      onToggle={(e) => setAberto(e.currentTarget.open)}
    >
      <summary className="cursor-pointer font-semibold">Acompanhamento manual do WhatsApp</summary>
      {aberto && (
        <div className="space-y-2 pt-2">
          <p className="text-muted-foreground">
            Marque apenas o que você conferiu no WhatsApp. O ORICSE não recebe confirmação
            automática.
          </p>
          {erro && (
            <p role="alert" className="text-destructive">
              {erro}
            </p>
          )}
          {!pronto && !erro && <p role="status">Carregando histórico…</p>}
          {pronto && (
            <ul>
              {notas.map((n) => (
                <li key={n.situacao}>
                  {rotulos[n.situacao]} em {new Date(n.registrado_em).toLocaleString("pt-BR")}
                </li>
              ))}
            </ul>
          )}
          {pronto && podeRegistrar && (
            <div className="flex flex-wrap gap-2">
              {(Object.keys(rotulos) as Situacao[])
                .filter((s) => !notas.some((n) => n.situacao === s))
                .map((s) => (
                  <button
                    className="min-h-10 rounded-lg border px-3 font-semibold"
                    key={s}
                    type="button"
                    disabled={salvando}
                    onClick={() => void registrar(s)}
                  >
                    Registrar {s === "entrega_observada" ? "entrega" : "resposta"}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </details>
  );
}
