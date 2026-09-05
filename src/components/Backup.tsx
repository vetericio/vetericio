import { useCallback, useEffect, useRef, useState } from "react";

import {
  aplicarBackup,
  baixarBackup,
  gerarImagemQr,
  juntarSincronizacao,
  lerArquivoBackup,
  montarBackup,
  nomeArquivoBackup,
  resumirBackup,
  validarBackup,
  type Backup as DadosBackup,
  type ResumoBackup,
} from "@/lib/backup";
import { apagarTransferencia, buscarTransferencia } from "@/lib/transferencia.functions";
import { apagarSala, criarSala, enviarSala, puxarSala } from "@/lib/sincronizacao.functions";

const CHAVE_SALA = "veterico-sala-v1";
const FORMATO_SALA = /^[A-Z][0-9]{5}$/;
/** Intervalo da sincronização automática. */
const INTERVALO = 15000;

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
type Aba = "gerar" | "restaurar" | "conectar";

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

function horaCurta(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
  const [aba, setAba] = useState<Aba>("gerar");
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, setPendente] = useState<DadosBackup | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [lendo, setLendo] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const trilha = useRef<MediaStream | null>(null);
  const [sala, setSala] = useState<string | null>(null);
  const [qrSala, setQrSala] = useState<string | null>(null);
  const [salaManual, setSalaManual] = useState("");
  const [digitandoSala, setDigitandoSala] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [ultima, setUltima] = useState<string | null>(null);

  const pararCamera = () => {
    trilha.current?.getTracks().forEach((t) => t.stop());
    trilha.current = null;
    setLendo(false);
  };

  useEffect(() => pararCamera, []);

  /* ---------- Sincronização automática nos dois sentidos ---------- */

  /**
   * Traz o que existe no vínculo, junta com o que há aqui (sem apagar nada)
   * e devolve o resultado para o outro aparelho. O plantão aberto recebido
   * é adotado quando este aparelho não tem plantão em andamento.
   */
  const sincronizar = useCallback(async (cod: string) => {
    const { json } = await puxarSala({ data: { codigo: cod } });
    let mudou = false;
    if (json) {
      const remoto = validarBackup(JSON.parse(json));
      if (remoto) mudou = juntarSincronizacao(remoto);
    }
    await enviarSala({ data: { codigo: cod, dados: montarBackup() } });
    setConectado(true);
    setUltima(horaCurta(new Date()));
    return mudou;
  }, []);

  /** Laço automático: sincroniza sozinho enquanto houver vínculo. */
  useEffect(() => {
    if (!sala) return;
    let vivo = true;
    let recarregando = false;

    const passo = async () => {
      if (!vivo || recarregando || typeof document === "undefined") return;
      if (document.visibilityState === "hidden") return;
      try {
        const mudou = await sincronizar(sala);
        if (mudou && vivo) {
          recarregando = true;
          window.location.reload();
        }
      } catch {
        if (vivo) setConectado(false);
      }
    };

    void passo();
    const id = window.setInterval(() => void passo(), INTERVALO);
    const aoVoltar = () => void passo();
    window.addEventListener("online", aoVoltar);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      vivo = false;
      window.clearInterval(id);
      window.removeEventListener("online", aoVoltar);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [sala, sincronizar]);

  // Abre a restauração/conexão direto quando o link do QR foi aberto no navegador.
  useEffect(() => {
    setSala(salaGuardada());
    const params = new URLSearchParams(window.location.search);
    const c = params.get("transfer");
    const s = (params.get("sala") ?? "").toUpperCase();
    if (c && /^[0-9]{6}$/.test(c)) {
      setAberto(true);
      setAba("restaurar");
      void receberPorCodigo(c);
    } else if (FORMATO_SALA.test(s)) {
      setAberto(true);
      setAba("conectar");
      void conectar(s);
    } else {
      return;
    }
    const limpa = new URL(window.location.href);
    limpa.searchParams.delete("transfer");
    limpa.searchParams.delete("sala");
    window.history.replaceState(null, "", limpa.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- 1. Gerar backup ---------- */

  const gerar = async () => {
    setAviso(null);
    const dados = montarBackup();
    const nome = nomeArquivoBackup();
    try {
      const arquivo = new File([JSON.stringify(dados, null, 2)], nome, {
        type: "application/json",
      });
      const podeCompartilhar =
        typeof navigator !== "undefined" &&
        Boolean(navigator.share) &&
        (!navigator.canShare || navigator.canShare({ files: [arquivo] }));
      if (podeCompartilhar) {
        await navigator.share({ files: [arquivo], title: "Backup Veterício" });
        setAviso({ tipo: "ok", texto: `Backup ${nome} pronto.` });
        return;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
    baixarBackup(dados);
    setAviso({ tipo: "ok", texto: `Backup ${nome} salvo neste aparelho.` });
  };

  /* ---------- 2. Restaurar backup ---------- */

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
      setPendente(dados);
    } catch {
      setAviso({ tipo: "erro", texto: "Sem internet ou falha ao baixar. Use o arquivo de backup." });
    } finally {
      setOcupado(false);
    }
  }

  /* ---------- 3. Conectar ---------- */

  /** Cria a conexão neste aparelho, mostra o código e o QR. */
  async function criarConexao() {
    setAviso(null);
    setOcupado(true);
    try {
      const { codigo: nova } = await criarSala();
      await enviarSala({ data: { codigo: nova, dados: montarBackup() } });
      guardarSala(nova);
      setSala(nova);
      setConectado(true);
      setUltima(horaCurta(new Date()));
      setQrSala(await gerarImagemQr(`${window.location.origin}/?sala=${nova}`));
      setAviso({ tipo: "ok", texto: "Conectado. Use este código no outro aparelho." });
    } catch {
      setConectado(false);
      setAviso({ tipo: "erro", texto: "Não foi possível conectar. Verifique a internet." });
    } finally {
      setOcupado(false);
    }
  }

  /** Entra em uma conexão existente (código digitado ou QR). */
  async function conectar(valor: string) {
    const cod = salaDoTexto(valor);
    if (!cod) {
      setAviso({ tipo: "erro", texto: "Código inválido. Ex.: H78096." });
      return;
    }
    setAviso(null);
    setOcupado(true);
    setDigitandoSala(false);
    setSalaManual("");
    try {
      const mudou = await sincronizar(cod);
      guardarSala(cod);
      setSala(cod);
      setAviso({ tipo: "ok", texto: "Conectado. Os dados dos dois aparelhos foram juntados." });
      if (mudou) {
        window.location.reload();
        return;
      }
    } catch {
      setConectado(false);
      setAviso({ tipo: "erro", texto: "Não foi possível conectar. Verifique a internet." });
    } finally {
      setOcupado(false);
    }
  }

  /** Sincroniza agora, sem esperar o próximo ciclo. */
  async function sincronizarAgora() {
    if (!sala) return;
    setAviso(null);
    setOcupado(true);
    try {
      const mudou = await sincronizar(sala);
      if (mudou) {
        window.location.reload();
        return;
      }
      setAviso({ tipo: "ok", texto: "Tudo sincronizado." });
    } catch {
      setConectado(false);
      setAviso({ tipo: "erro", texto: "Sem conexão agora. Vamos tentar de novo sozinhos." });
    } finally {
      setOcupado(false);
    }
  }

  /** Desconecta os aparelhos e apaga a cópia guardada na nuvem. */
  async function desconectar() {
    const cod = sala;
    guardarSala(null);
    setSala(null);
    setQrSala(null);
    setConectado(false);
    setUltima(null);
    if (cod) await apagarSala({ data: { codigo: cod } }).catch(() => undefined);
    setAviso({ tipo: "ok", texto: "Desconectado. Os dados deste aparelho continuam aqui." });
  }

  async function mostrarQrSala() {
    if (!sala) return;
    setQrSala(await gerarImagemQr(`${window.location.origin}/?sala=${sala}`));
  }

  const lerQr = async () => {
    setAviso(null);
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
            const s = salaDoTexto(achado.data);
            const c = codigoDaUrl(achado.data);
            pararCamera();
            if (s) await conectar(s);
            else if (c) await receberPorCodigo(c);
            else setAviso({ tipo: "erro", texto: "Esse QR não é do app." });
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
  const principal =
    "rounded-lg bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground disabled:opacity-50";

  const abaClasse = (a: Aba) =>
    `flex-1 rounded-lg px-2 py-2 text-[11px] font-semibold ${
      aba === a
        ? "bg-primary text-primary-foreground"
        : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
    }`;

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
          {sala && (
            <p className="mb-2 text-[11px] font-semibold text-foreground">
              {conectado ? "🟢 Conectado" : "⚪ Desconectado — tentando reconectar"} ·{" "}
              <span className="tracking-[0.2em]">{sala}</span>
              {ultima ? ` · última sincronização ${ultima}` : ""}
            </p>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={() => setAba("gerar")} className={abaClasse("gerar")}>
              Gerar backup
            </button>
            <button
              type="button"
              onClick={() => setAba("restaurar")}
              className={abaClasse("restaurar")}
            >
              Restaurar backup
            </button>
            <button
              type="button"
              onClick={() => setAba("conectar")}
              className={abaClasse("conectar")}
            >
              Conectar
            </button>
          </div>

          {aba === "gerar" && (
            <div className="mt-3">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Salva no aparelho uma cópia de tudo: animais, fichas, plantão aberto, plantões
                salvos, medicações, alarmes, curvas, anamneses e bloco de notas.
              </p>
              <button type="button" onClick={() => void gerar()} className={`${principal} mt-2 w-full`}>
                Gerar backup
              </button>
            </div>
          )}

          {aba === "restaurar" && (
            <div className="mt-3">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Escolha um arquivo de backup. Nada é apagado sem você confirmar.
              </p>
              <button
                type="button"
                onClick={() => inputArquivo.current?.click()}
                className={`${botao} mt-2 w-full`}
              >
                Escolher arquivo
              </button>
            </div>
          )}

          {aba === "conectar" && (
            <div className="mt-3">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Liga dois aparelhos por um código de 6 caracteres (ex.: H78096) ou pelo QR. Depois de
                conectados, tudo se sincroniza sozinho nos dois sentidos — inclusive o plantão em
                andamento, que o segundo aparelho assume como está, sem começar outro. Precisa de
                internet nos dois.
              </p>

              {!sala ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => void criarConexao()}
                    className={principal}
                  >
                    Criar conexão
                  </button>
                  <button
                    type="button"
                    onClick={() => setDigitandoSala((v) => !v)}
                    className="rounded-lg border border-input px-3 py-2 text-[12px] font-semibold text-foreground"
                  >
                    Tenho um código
                  </button>
                  <button
                    type="button"
                    onClick={() => void lerQr()}
                    className="rounded-lg border border-input px-3 py-2 text-[12px] font-semibold text-foreground"
                  >
                    Ler QR
                  </button>
                </div>
              ) : (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => void sincronizarAgora()}
                    className={principal}
                  >
                    Sincronizar agora
                  </button>
                  <button type="button" onClick={() => void mostrarQrSala()} className={botao}>
                    Mostrar código e QR
                  </button>
                  <button
                    type="button"
                    onClick={() => void desconectar()}
                    className="text-[11px] font-semibold underline"
                  >
                    Desconectar
                  </button>
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
                    onClick={() => void conectar(salaManual)}
                    className={principal}
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
                  <p className="mt-1 text-[15px] font-bold tracking-[0.3em] text-foreground">
                    {sala}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    No outro aparelho, toque em “Ler QR” ou em “Tenho um código”.
                  </p>
                </div>
              )}
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
                  onClick={() => restaurar("juntar")}
                  className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground"
                >
                  Juntar (recomendado)
                </button>
                <button
                  type="button"
                  onClick={() => restaurar("substituir")}
                  className="rounded-lg bg-destructive px-3 py-1.5 text-[12px] font-semibold text-destructive-foreground"
                >
                  Substituir tudo
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
