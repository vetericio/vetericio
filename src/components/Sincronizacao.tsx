import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSync } from "@/hooks/useSync";
import { gerarImagemQr } from "@/lib/backup";
import { codigoDoQr, quandoSync, textoQrSync } from "@/lib/sync";

const ROTULO: Record<string, string> = {
  "sem-codigo": "Não sincronizado",
  sincronizado: "Sincronizado ✓",
  sincronizando: "Sincronizando…",
  pendente: "Alterações pendentes",
  erro: "Erro ao sincronizar",
};

const COR: Record<string, string> = {
  "sem-codigo": "text-muted-foreground",
  sincronizado: "text-primary",
  sincronizando: "text-muted-foreground",
  pendente: "text-amber-600",
  erro: "text-destructive",
};

/** Sincronização entre dois aparelhos por código secreto + QR. */
export function Sincronizacao() {
  const { codigo, estado, ultima, erro, sincronizar, criarCodigo, usarCodigo, desconectar } =
    useSync();
  const [aberto, setAberto] = useState(false);
  const [qr, setQr] = useState("");
  const [digitado, setDigitado] = useState("");

  useEffect(() => {
    if (!aberto || !codigo) {
      setQr("");
      return;
    }
    let ativo = true;
    void gerarImagemQr(textoQrSync(codigo)).then((imagem) => {
      if (ativo) setQr(imagem);
    });
    return () => {
      ativo = false;
    };
  }, [aberto, codigo]);

  const conectar = async () => {
    const ok = await usarCodigo(codigoDoQr(digitado));
    if (!ok) {
      toast.error("Código inválido. Confira o código do outro aparelho.");
      return;
    }
    setDigitado("");
    toast.success("Aparelhos conectados. Dados sincronizados.");
  };

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="rounded-lg bg-secondary px-3 py-1.5 text-[11px] font-semibold text-secondary-foreground hover:bg-secondary/70"
      >
        Sincronizar
      </button>

      {aberto && (
        <div className="mx-auto mt-2 max-w-md rounded-2xl border border-border bg-card p-3 text-left">
          <p className={`text-xs font-semibold ${COR[estado] ?? ""}`}>
            {ROTULO[estado] ?? estado}
            {ultima ? ` • ${quandoSync(ultima)}` : ""}
          </p>
          {erro && <p className="mt-1 text-[11px] text-muted-foreground">{erro}</p>}

          {codigo ? (
            <>
              <p className="mt-2 text-[11px] text-muted-foreground">
                No outro aparelho, escolha “Sincronizar”, leia este QR ou digite o código abaixo.
              </p>
              {qr && (
                <img
                  src={qr}
                  alt="QR com o código de sincronização"
                  className="mx-auto mt-2 h-40 w-40 rounded-lg bg-white p-1"
                />
              )}
              <p className="mt-2 break-all rounded-lg bg-secondary/60 px-2 py-1.5 text-center font-mono text-xs">
                {codigo}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(codigo)}
                  className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground"
                >
                  Copiar código
                </button>
                <button
                  type="button"
                  onClick={() => void sincronizar()}
                  className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
                >
                  Sincronizar agora
                </button>
                <button
                  type="button"
                  onClick={desconectar}
                  className="rounded-lg bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive"
                >
                  Desconectar
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void criarCodigo()}
                className="mt-2 w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                Gerar código deste aparelho
              </button>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Já tenho um código
              </p>
              <div className="mt-1 flex gap-2">
                <input
                  value={digitado}
                  onChange={(e) => setDigitado(e.target.value)}
                  placeholder="Cole o código do outro aparelho"
                  className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus:border-ring"
                />
                <button
                  type="button"
                  onClick={() => void conectar()}
                  className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground"
                >
                  Conectar
                </button>
              </div>
            </>
          )}

          <p className="mt-3 text-[11px] text-muted-foreground">
            Funciona offline: tudo fica salvo no aparelho e sobe sozinho quando a internet voltar.
          </p>
        </div>
      )}
    </div>
  );
}
