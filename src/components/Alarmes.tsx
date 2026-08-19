import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAlarmes } from "@/hooks/useAlarmes";
import {
  NOME_PLATAFORMA,
  criarAlarme,
  detectarPlataforma,
  proximoDisparo,
  textoProximo,
  type Alarme,
} from "@/lib/alarmes";
import {
  TOQUES,
  desbloquearAudio,
  duracaoToque,
  pararToque,
  tocarToque,
  type ToqueId,
} from "@/lib/toques";

export function Alarmes({ compacto = false }: { compacto?: boolean }) {
  const { alarmes, setAlarmes } = useAlarmes();
  const [montado, setMontado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [hora, setHora] = useState("00:00");
  const [rotulo, setRotulo] = useState("");
  const [toque, setToque] = useState<ToqueId>("sino");
  const [diario, setDiario] = useState(true);
  const [link, setLink] = useState("");

  useEffect(() => setMontado(true), []);

  const plataforma = detectarPlataforma(link);

  const alternar = (a: Alarme) => {
    desbloquearAudio();
    setAlarmes((lista) =>
      lista.map((x) =>
        x.id === a.id
          ? { ...x, ativo: !x.ativo, proximo: !x.ativo ? proximoDisparo(x.hora) : x.proximo }
          : x,
      ),
    );
  };

  const adicionar = () => {
    desbloquearAudio();
    if (link.trim() && !plataforma) {
      toast.error("Use um link do YouTube, Spotify ou Deezer.");
      return;
    }
    const novo = criarAlarme({
      rotulo: rotulo || `Alarme ${hora}`,
      hora,
      toque,
      diario,
      linkExterno: link,
    });
    setAlarmes((lista) => [...lista, novo]);
    setRotulo("");
    setLink("");
    setAberto(false);
    toast.success(`Alarme criado para ${textoProximo(novo)}.`);
  };


  const excluir = (id: string) => {
    setAlarmes((lista) => lista.filter((x) => x.id !== id));
  };

  const pedirNotificacoes = async () => {
    if (typeof Notification === "undefined") {
      toast.error("Este aparelho não permite notificações.");
      return;
    }
    const r = await Notification.requestPermission();
    if (r === "granted") toast.success("Notificações liberadas.");
    else toast.error("Notificações não liberadas.");
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Alarmes
        </p>
        <button
          type="button"
          onClick={() => {
            desbloquearAudio();
            setAberto((v) => !v);
          }}
          className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {aberto ? "Fechar" : "Adicionar alarme"}
        </button>
      </div>

      {aberto && (
        <div className="mt-3 space-y-3 rounded-xl bg-secondary/60 p-3">
          <div className="flex flex-wrap gap-3">
            <label className="flex-1">
              <span className="text-xs font-semibold text-muted-foreground">Hora</span>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-base font-semibold text-foreground outline-none focus:border-ring"
              />
            </label>
            <label className="flex-1">
              <span className="text-xs font-semibold text-muted-foreground">Nome</span>
              <input
                value={rotulo}
                onChange={(e) => setRotulo(e.target.value)}
                placeholder="Ex.: Medicação da Saturna"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
              />
            </label>
          </div>

          <div>
            <span className="text-xs font-semibold text-muted-foreground">
              Música (20 opções, toque em ▶ para ouvir)
            </span>
            <div className="mt-1 grid grid-cols-4 gap-2">
              {TOQUES.map((t) => (
                <div
                  key={t.id}
                  className={`flex flex-col items-center gap-1 rounded-lg p-1.5 ${
                    toque === t.id ? "bg-primary text-primary-foreground" : "bg-background"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      desbloquearAudio();
                      setToque(t.id);
                    }}
                    className="w-full truncate text-center text-[11px] font-semibold"
                  >
                    {t.nome}
                  </button>
                  <button
                    type="button"
                    aria-label={`Ouvir ${t.nome}`}
                    onClick={() => {
                      desbloquearAudio();
                      tocarToque(t.id);
                      window.setTimeout(pararToque, duracaoToque(t.id));
                    }}
                    className="text-xs opacity-70 hover:opacity-100"
                  >
                    ▶
                  </button>
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={diario}
              onChange={(e) => setDiario(e.target.checked)}
              className="h-4 w-4"
            />
            Repetir todos os dias
          </label>

          <div className="rounded-xl bg-background p-3">
            <span className="text-xs font-semibold text-muted-foreground">
              Ou use a sua música (YouTube, Spotify ou Deezer)
            </span>
            <div className="mt-1 flex gap-2">
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="Cole o link da música"
                className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
              />
              <button
                type="button"
                disabled={!plataforma}
                onClick={() => window.open(link, "_blank", "noopener")}
                className="shrink-0 rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70 disabled:opacity-40"
              >
                Testar
              </button>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {link.trim() && !plataforma
                ? "Link não reconhecido — use YouTube, Spotify ou Deezer."
                : plataforma === "youtube"
                  ? "YouTube: o vídeo toca na tela do alarme com o app aberto."
                  : plataforma
                    ? `${NOME_PLATAFORMA[plataforma]} não libera o áudio para outros apps: o alarme soa com a música do app e aparece o botão "Abrir minha música".`
                    : "Sem link, o alarme usa a música escolhida acima."}
            </p>
          </div>


          <button
            type="button"
            onClick={adicionar}
            className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Salvar alarme
          </button>
        </div>
      )}

      <ul className="mt-3 space-y-2">
        {montado &&
          alarmes.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {a.hora} — {a.rotulo}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {a.ativo ? `Soa ${textoProximo(a)}` : "Desligado"}
                  {a.intervaloHoras ? ` · a cada ${a.intervaloHoras}h` : a.diario ? " · diário" : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => alternar(a)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                    a.ativo
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-background text-foreground hover:bg-background/70"
                  }`}
                >
                  {a.ativo ? "Ligado" : "Ativar"}
                </button>
                {a.id !== "jejum-00h" && (
                  <button
                    type="button"
                    onClick={() => excluir(a.id)}
                    className="rounded-lg bg-background px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-background/70"
                  >
                    Excluir
                  </button>
                )}
              </div>
            </li>
          ))}
      </ul>

      {!compacto && (
        <div className="mt-3 space-y-2 rounded-xl border border-dashed border-border p-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Para tocar garantido, deixe o app aberto e o volume de mídia ligado. Um app
            instalado pela web não pode furar o modo silencioso do aparelho nem tocar com o app
            fechado — nesse caso, chega apenas a notificação do sistema, que obedece ao
            silencioso.
          </p>
          <button
            type="button"
            onClick={pedirNotificacoes}
            className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
          >
            Liberar notificações
          </button>
        </div>
      )}
    </section>
  );
}
