import { useEffect, useRef, useState } from "react";

import {
  aplicarBackup,
  baixarBackup,
  gerarImagemQr,
  lerArquivoBackup,
  montarBackup,
  nomeArquivoBackup,
  resumirBackup,
  validarBackup,
  type Backup as DadosBackup,
  type ResumoBackup,
} from "@/lib/backup";
import {
  apagarTransferencia,
  buscarTransferencia,
  enviarTransferencia,
} from "@/lib/transferencia.functions";
import {
  apagarSala,
  criarSala,
  enviarSala,
  puxarSala,
} from "@/lib/sincronizacao.functions";

const CHAVE_SALA = "veterico-sala-v1";
const FORMATO_SALA = /^[A-Z][0-9]{5}$/;

function salaGuardada(): string | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(CHAVE_SALA) ?? "";
  return FORMATO_SALA.test(v) ? v : null;
}

function guardarSala(codigo: string | null) {
  if (typeof window === "undefined") return;
  if (codigo) window.localStorage.setItem(CHAVE_SALA, codigo);
  else window.localStorage.removeItem(CHAVE_SALA);
}

/** Aceita o código digitado ou o link do QR de sincronização. */
function salaDoTexto(texto: string): string | null {
  const bruto = texto.trim().toUpperCase();
  if (FORMATO_SALA.test(bruto)) return bruto;
  try {
    const url = new URL(texto.trim());
    const c = (url.searchParams.get("sala") ?? "").toUpperCase();
    return FORMATO_SALA.test(c) ? c : null;
  } catch {
    return null;
  }
}


type Aviso = { tipo: "ok" | "erro"; texto: string } | null;

function dataCurta(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function linhaResumo(r: ResumoBackup): string {
  return [
    `${r.registros} animal(is)`,
    `${r.plantoes} plantão(ões)`,
    `${r.curvas} curva(s)`,
    `${r.alarmes} alarme(s)`,
    `${r.medicamentos} medicamento(s)`,
    `${r.anamneses} anamnese(s)`,
    ...(r.temNotas ? ["bloco de notas"] : []),
  ].join(" · ");
}

function codigoDaUrl(texto: string): string | null {
  const direto = texto.trim().match(/^[0-9]{6}$/);
  if (direto) return direto[0];
  try {
    const url = new URL(texto.trim());
    const c = url.searchParams.get("transfer") ?? "";
    return /^[0-9]{6}$/.test(c) ? c : null;
  } catch {
    return null;
  }
}

export function Backup() {
  const [aberto, setAberto] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, setPendente] = useState<DadosBackup | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [digitando, setDigitando] = useState(false);
  const [codigoManual, setCodigoManual] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [lendo, setLendo] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const trilha = useRef<MediaStream | null>(null);
  const [sala, setSala] = useState<string | null>(null);
  const [qrSala, setQrSala] = useState<string | null>(null);
  const [salaManual, setSalaManual] = useState("");
  const [digitandoSala, setDigitandoSala] = useState(false);

  const pararCamera = () => {
    trilha.current?.getTracks().forEach((t) => t.stop());
    trilha.current = null;
    setLendo(false);
  };

  useEffect(() => pararCamera, []);

  // Abre a restauração direto quando o link do QR foi aberto no navegador.
  useEffect(() => {
    setSala(salaGuardada());
    const params = new URLSearchParams(window.location.search);
    const c = params.get("transfer");
    const s = (params.get("sala") ?? "").toUpperCase();
    if (c && /^[0-9]{6}$/.test(c)) {
      setAberto(true);
      void receberPorCodigo(c);
    } else if (FORMATO_SALA.test(s)) {
      setAberto(true);
      void vincular(s);
    } else {
      return;
    }
    const limpa = new URL(window.location.href);
    limpa.searchParams.delete("transfer");
    limpa.searchParams.delete("sala");
    window.history.replaceState(null, "", limpa.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gerar = () => {
    baixarBackup();
    setAviso({ tipo: "ok", texto: "Backup gerado. Envie o arquivo para o outro aparelho." });
  };

  const compartilharBackup = async () => {
    setAviso(null);
    // Gera o backup na hora do clique e usa esse resultado direto — nunca depende de estado anterior.
    const dados = montarBackup();
    const texto = JSON.stringify(dados, null, 2);
    const nome = nomeArquivoBackup();
    try {
      const arquivo = new File([texto], nome, { type: "application/json" });
      const podeCompartilhar =
        typeof navigator !== "undefined" &&
        Boolean(navigator.share) &&
        (!navigator.canShare || navigator.canShare({ files: [arquivo] }));
      if (podeCompartilhar) {
        await navigator.share({ files: [arquivo], title: "Backup Veterício" });
        return;
      }
      // Sem compartilhamento de arquivo: salva o backup recém-gerado no aparelho.
      baixarBackup(dados);
      setAviso({
        tipo: "ok",
        texto: `Este navegador não abre o menu de compartilhamento. O backup ${nome} foi salvo no aparelho — envie-o pelo app que preferir.`,
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      baixarBackup(dados);
      setAviso({
        tipo: "ok",
        texto: `Não foi possível abrir o menu de compartilhamento. O backup ${nome} foi salvo no aparelho.`,
      });
    }
  };


  const escolherArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    const dados = await lerArquivoBackup(arquivo);
    if (!dados) {
      setAviso({ tipo: "erro", texto: "Arquivo inválido — nada foi alterado." });
      return;
    }
    setAviso(null);
    setPendente(dados);
  };

  const restaurar = (modo: "substituir" | "juntar") => {
    if (!pendente) return;
    aplicarBackup(pendente, modo);
    setPendente(null);
    if (codigo) void apagarTransferencia({ data: { codigo } }).catch(() => undefined);
    window.location.assign("/");
  };

  /* ---------- Sincronização entre aparelhos ---------- */

  /** Cria o vínculo neste aparelho e já envia os dados atuais. */
  async function criarVinculo() {
    setAviso(null);
    setOcupado(true);
    try {
      const { codigo: nova } = await criarSala();
      await enviarSala({ data: { codigo: nova, dados: montarBackup() } });
      guardarSala(nova);
      setSala(nova);
      setQrSala(await gerarImagemQr(`${window.location.origin}/?sala=${nova}`));
      setAviso({ tipo: "ok", texto: "Vínculo criado e dados enviados." });
    } catch {
      setAviso({ tipo: "erro", texto: "Não foi possível criar o vínculo. Verifique a internet." });
    } finally {
      setOcupado(false);
    }
  }

  /** Entra em um vínculo existente (código digitado ou QR) e traz os dados. */
  async function vincular(valor: string) {
    const cod = salaDoTexto(valor);
    if (!cod) {
      setAviso({ tipo: "erro", texto: "Código inválido. Ex.: H78096." });
      return;
    }
    guardarSala(cod);
    setSala(cod);
    setDigitandoSala(false);
    setSalaManual("");
    await trazerDoVinculo(cod);
  }

  /** Envia os dados deste aparelho para o vínculo. */
  async function enviarParaVinculo(cod = sala) {
    if (!cod) return;
    setAviso(null);
    setOcupado(true);
    try {
      await enviarSala({ data: { codigo: cod, dados: montarBackup() } });
      setAviso({ tipo: "ok", texto: "Dados deste aparelho enviados para o outro." });
    } catch {
      setAviso({ tipo: "erro", texto: "Não foi possível enviar. Verifique a internet." });
    } finally {
      setOcupado(false);
    }
  }

  /** Traz os dados do outro aparelho e mostra o resumo antes de aplicar. */
  async function trazerDoVinculo(cod = sala) {
    if (!cod) return;
    setAviso(null);
    setOcupado(true);
    try {
      const { json } = await puxarSala({ data: { codigo: cod } });
      if (!json) {
        setAviso({
          tipo: "erro",
          texto: "Nada para trazer ainda. No outro aparelho, toque em “Enviar deste aparelho”.",
        });
        return;
      }
      const dados = validarBackup(JSON.parse(json));
      if (!dados) {
        setAviso({ tipo: "erro", texto: "Esses dados não são do app." });
        return;
      }
      setPendente(dados);
    } catch {
      setAviso({ tipo: "erro", texto: "Não foi possível trazer. Verifique a internet." });
    } finally {
      setOcupado(false);
    }
  }

  /** Desfaz o vínculo e apaga os dados guardados na nuvem. */
  async function desvincular() {
    const cod = sala;
    guardarSala(null);
    setSala(null);
    setQrSala(null);
    if (cod) await apagarSala({ data: { codigo: cod } }).catch(() => undefined);
    setAviso({ tipo: "ok", texto: "Vínculo desfeito. Os dados deste aparelho continuam aqui." });
  }

  async function mostrarQrSala() {
    if (!sala) return;
    setQrSala(await gerarImagemQr(`${window.location.origin}/?sala=${sala}`));
  }

  async function receberPorCodigo(valor: string) {
    setOcupado(true);
    setAviso(null);
    try {
      const { json } = await buscarTransferencia({ data: { codigo: valor } });
      if (!json) {
        setAviso({ tipo: "erro", texto: "Código não encontrado ou expirado (validade de 24h)." });
        return;
      }
      const dados = validarBackup(JSON.parse(json));
      if (!dados) {
        setAviso({ tipo: "erro", texto: "Esses dados não são um backup do app." });
        return;
      }
      setCodigo(valor);
      setDigitando(false);
      setPendente(dados);
    } catch {
      setAviso({ tipo: "erro", texto: "Sem internet ou falha ao baixar. Use o arquivo de backup." });
    } finally {
      setOcupado(false);
    }
  }

  const enviarNuvem = async () => {
    setQr(null);
    setCodigo(null);
    setAviso(null);
    setOcupado(true);
    try {
      const { codigo: novo } = await enviarTransferencia({ data: { dados: montarBackup() } });
      const link = `${window.location.origin}/?transfer=${novo}`;
      setCodigo(novo);
      setQr(await gerarImagemQr(link));
    } catch (e) {
      const motivo = e instanceof Error && e.message ? e.message : "";
      setAviso({
        tipo: "erro",
        texto: motivo
          ? `Não foi possível enviar. ${motivo}`
          : "Não foi possível enviar. Verifique a internet ou use o arquivo de backup.",
      });
    } finally {
      setOcupado(false);
    }
  };


  const apagarNuvem = async () => {
    if (!codigo) return;
    await apagarTransferencia({ data: { codigo } }).catch(() => undefined);
    setQr(null);
    setCodigo(null);
    setAviso({ tipo: "ok", texto: "Backup apagado da nuvem." });
  };

  const lerQr = async () => {
    setAviso(null);
    setQr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      trilha.current = stream;
      setLendo(true);
      const el = video.current;
      if (!el) return;
      el.srcObject = stream;
      await el.play();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const jsQR = (await import("jsqr")).default;

      const procurar = async () => {
        if (!trilha.current || !ctx) return;
        if (el.videoWidth > 0) {
          canvas.width = el.videoWidth;
          canvas.height = el.videoHeight;
          ctx.drawImage(el, 0, 0);
          const imagem = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const achado = jsQR(imagem.data, canvas.width, canvas.height);
          if (achado?.data) {
            const c = codigoDaUrl(achado.data);
            const s = salaDoTexto(achado.data);
            pararCamera();
            if (c) await receberPorCodigo(c);
            else if (s) await vincular(s);
            else setAviso({ tipo: "erro", texto: "Esse QR não é um backup do app." });
            return;
          }
        }
        requestAnimationFrame(() => void procurar());
      };
      void procurar();
    } catch {
      setLendo(false);
      setAviso({ tipo: "erro", texto: "Não foi possível abrir a câmera." });
    }
  };

  const botao =
    "rounded-lg bg-secondary px-3 py-2 text-[12px] font-semibold text-secondary-foreground hover:bg-secondary/70 disabled:opacity-50";

  return (
    <div>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="rounded-lg bg-secondary px-3 py-1.5 text-[11px] font-semibold text-secondary-foreground hover:bg-secondary/70"
      >
        Sincronização
      </button>


      {aberto && (
        <div className="mx-auto mt-2 max-w-md rounded-xl bg-secondary/60 p-3 text-left">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Backup:</span> uma cópia congelada dos
            dados (uma foto do momento), em arquivo ou por QR. Serve para guardar ou levar tudo para
            outro aparelho. Não fica se atualizando sozinho: sempre que quiser, gere um novo.
          </p>



          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={gerar}
              className="rounded-lg bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground"
            >
              Gerar backup
            </button>
            <button
              type="button"
              onClick={() => inputArquivo.current?.click()}
              className={botao}
            >
              Restaurar backup
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void enviarNuvem()}
              className={botao}
            >
              Enviar por QR
            </button>
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void lerQr()}
              className="rounded-lg border border-input px-3 py-2 text-[12px] font-semibold text-foreground"
            >
              Ler QR
            </button>
            <button
              type="button"
              onClick={() => setDigitando((v) => !v)}
              className="rounded-lg border border-input px-3 py-2 text-[12px] font-semibold text-foreground"
            >
              Tenho um código
            </button>
          </div>

          <div className="mt-2 grid gap-2">
            <button
              type="button"
              onClick={() => void compartilharBackup()}
              className={botao}
            >
              Compartilhar backup
            </button>
          </div>

          <div className="mt-4 border-t border-input pt-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Sincronizar:</span> liga os dois
              aparelhos com um código de 6 caracteres (ex.: H78096). Depois de ligados, você pode
              enviar ou trazer tudo — animais, plantão aberto, plantões salvos, medicações, alarmes,
              anamneses e bloco de notas — sempre que quiser. Precisa de internet nos dois.
            </p>

            {!sala ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => void criarVinculo()}
                  className="rounded-lg bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Sincronizar este aparelho
                </button>
                <button
                  type="button"
                  onClick={() => setDigitandoSala((v) => !v)}
                  className="rounded-lg border border-input px-3 py-2 text-[12px] font-semibold text-foreground"
                >
                  Tenho um código
                </button>
              </div>
            ) : (
              <div className="mt-2">
                <p className="text-[12px] text-foreground">
                  Vinculado ao código{" "}
                  <span className="font-bold tracking-[0.2em]">{sala}</span>
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => void enviarParaVinculo()}
                    className="rounded-lg bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Enviar deste aparelho
                  </button>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => void trazerDoVinculo()}
                    className={botao}
                  >
                    Trazer do outro aparelho
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void mostrarQrSala()}
                    className="text-[11px] font-semibold underline"
                  >
                    Mostrar QR do código
                  </button>
                  <button
                    type="button"
                    onClick={() => void desvincular()}
                    className="text-[11px] font-semibold underline"
                  >
                    Desvincular
                  </button>
                </div>
              </div>
            )}

            {digitandoSala && (
              <div className="mt-2 flex gap-2">
                <input
                  value={salaManual}
                  onChange={(e) =>
                    setSalaManual(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 6),
                    )
                  }
                  placeholder="H78096"
                  aria-label="Código de sincronização"
                  className="w-28 rounded-lg border border-input bg-background px-3 py-2 text-center text-[13px] tracking-widest"
                />
                <button
                  type="button"
                  disabled={ocupado || !FORMATO_SALA.test(salaManual)}
                  onClick={() => void vincular(salaManual)}
                  className="rounded-lg bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Conectar
                </button>
              </div>
            )}

            {qrSala && (
              <div className="mt-3 text-center">
                <img
                  src={qrSala}
                  alt="QR do código de sincronização"
                  className="mx-auto w-48 rounded-lg bg-white p-2"
                />
                <p className="mt-1 text-[15px] font-bold tracking-[0.3em] text-foreground">{sala}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  No outro aparelho, toque em “Ler QR” ou em “Tenho um código”.
                </p>
              </div>
            )}
          </div>



          {digitando && (
            <div className="mt-2 flex gap-2">
              <input
                value={codigoManual}
                onChange={(e) => setCodigoManual(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="000000"
                aria-label="Código de 6 dígitos"
                className="w-28 rounded-lg border border-input bg-background px-3 py-2 text-center text-[13px] tracking-widest"
              />
              <button
                type="button"
                disabled={ocupado || codigoManual.length !== 6}
                onClick={() => void receberPorCodigo(codigoManual)}
                className="rounded-lg bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                Buscar
              </button>
            </div>
          )}

          <input
            ref={inputArquivo}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              void escolherArquivo(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          {qr && (
            <div className="mt-3 text-center">
              <img
                src={qr}
                alt="QR com o link do backup"
                className="mx-auto w-48 rounded-lg bg-white p-2"
              />
              {codigo && (
                <p className="mt-1 text-[15px] font-bold tracking-[0.3em] text-foreground">
                  {codigo}
                </p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                No outro aparelho, toque em “Ler QR” ou digite o código. Válido por 24 horas. Precisa
                de internet nos dois aparelhos.
              </p>
              <button
                type="button"
                onClick={() => void apagarNuvem()}
                className="mt-1 text-[11px] font-semibold underline"
              >
                Apagar agora
              </button>
            </div>
          )}

          {lendo && (
            <div className="mt-3 text-center">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={video} playsInline muted className="mx-auto w-56 rounded-lg bg-black" />
              <button
                type="button"
                onClick={pararCamera}
                className="mt-1 text-[11px] font-semibold underline"
              >
                Cancelar leitura
              </button>
            </div>
          )}

          {pendente && (
            <div className="mt-3 rounded-lg border border-input p-3">
              <p className="text-[12px] font-semibold text-foreground">Backup encontrado</p>
              <p className="text-[11px] text-muted-foreground">
                {linhaResumo(resumirBackup(pendente))}
                {dataCurta(pendente.criadoEm) ? ` — de ${dataCurta(pendente.criadoEm)}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => restaurar("substituir")}
                  className="rounded-lg bg-destructive px-3 py-1.5 text-[12px] font-semibold text-destructive-foreground"
                >
                  Substituir tudo
                </button>
                <button
                  type="button"
                  onClick={() => restaurar("juntar")}
                  className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground"
                >
                  Juntar
                </button>
                <button
                  type="button"
                  onClick={() => setPendente(null)}
                  className="rounded-lg bg-secondary px-3 py-1.5 text-[12px] font-semibold text-secondary-foreground"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {aviso && (
            <p
              className={`mt-2 text-[11px] font-semibold ${
                aviso.tipo === "erro" ? "text-destructive" : "text-foreground"
              }`}
            >
              {aviso.texto}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
