import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Check,
  ExternalLink,
  FastForward,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/page-header";
import { useManagedAccountsMap, usePostsList } from "@/components/post-editor";
import {
  approvePost,
  cancelSchedule,
  deletePost,
  reschedulePost,
  retryPost,
} from "@/lib/posts.functions";
import { toLocalInput } from "@/lib/media";
import { errorMessage, formatDateTime, qk } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const POST_STATUS: Record<string, { label: string; tone: string }> = {
  rascunho: { label: "Rascunho", tone: "bg-muted text-muted-foreground" },
  aguardando_aprovacao: {
    label: "Aguardando aprovação",
    tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  agendado: {
    label: "Agendado",
    tone: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
  },
  processando: {
    label: "Em processamento",
    tone: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30",
  },
  publicado: {
    label: "Publicado",
    tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  falhou: {
    label: "Falhou",
    tone: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  },
  resultado_desconhecido: {
    label: "Resultado desconhecido",
    tone: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  },
};

const TIPO_LABEL: Record<string, string> = {
  imagem: "Imagem",
  carrossel: "Carrossel",
  reels: "Reels",
  story: "Story",
};

export function PostStatusBadge({ status }: { status: string }) {
  const s = POST_STATUS[status];
  return (
    <Badge variant="outline" className={cn("font-medium", s?.tone)}>
      {s?.label ?? status}
    </Badge>
  );
}

export function PostList({
  statuses,
  isAdmin,
  empty,
}: {
  statuses: string[];
  isAdmin: boolean;
  empty: ReactNode;
}) {
  const posts = usePostsList(statuses);
  const accounts = useManagedAccountsMap();
  const qc = useQueryClient();
  const [reagendar, setReagendar] = useState<{ id: string; quando: string; original: string; modo: "reagendar" | "adiantar" } | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const done = (msg: string) => (r?: { avisos?: string[] } | { ok: true }) => {
    qc.invalidateQueries({ queryKey: ["posts"] });
    qc.invalidateQueries({ queryKey: qk.audit });
    if (r && "avisos" in r) r.avisos?.forEach((a) => toast.warning(a));
    toast.success(msg);
  };
  const onError = (e: unknown) => toast.error(errorMessage(e));

  const approve = useMutation({
    mutationFn: (id: string) => approvePost({ data: { id } }),
    onSuccess: done("Publicação aprovada e agendada."),
    onError,
  });
  const cancel = useMutation({
    mutationFn: (id: string) => cancelSchedule({ data: { id } }),
    onSuccess: done("Agendamento cancelado. A publicação voltou para rascunhos."),
    onError,
  });
  const retry = useMutation({
    mutationFn: (id: string) => retryPost({ data: { id } }),
    onSuccess: done("Publicação recolocada na fila."),
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deletePost({ data: { id } }),
    onSuccess: done("Excluído."),
    onError,
  });
  const resched = useMutation({
    mutationFn: (v: { id: string; quando: string }) =>
      reschedulePost({ data: { id: v.id, agendado_para: new Date(v.quando).toISOString() } }),
    onSuccess: (r) => {
      setReagendar(null);
      done("Reagendado.")(r);
    },
    onError,
  });

  if (posts.isLoading) return <Loader2 className="size-5 animate-spin text-muted-foreground" />;
  if (!posts.data?.length) return <>{empty}</>;

  return (
    <>
      <div className="space-y-3">
        {posts.data.map((p) => {
          const acc = accounts.get(p.instagram_account_id);
          const travado = !!p.publish_attempted_at || p.etapa === "publicando";
          return (
            <Card key={p.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <Link to="/posts/$postId" params={{ postId: p.id }} className="shrink-0">
                  {p.thumb?.public_url ? (
                    p.thumb.tipo === "video" ? (
                      <video
                        src={p.thumb.public_url}
                        className="size-16 rounded object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={p.thumb.public_url}
                        alt=""
                        className="size-16 rounded object-cover"
                      />
                    )
                  ) : (
                    <div className="size-16 rounded bg-muted" />
                  )}
                </Link>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <PostStatusBadge status={p.status} />
                    <span className="text-xs text-muted-foreground">
                      {TIPO_LABEL[p.tipo] ?? p.tipo} · @{acc?.username ?? "conta"}
                      {p.campanha ? ` · ${p.campanha}` : ""}
                    </span>
                  </div>
                  <Link
                    to="/posts/$postId"
                    params={{ postId: p.id }}
                    className="block truncate font-medium hover:underline"
                  >
                    {p.titulo || (p.legenda ?? "").split("\n")[0] || "Sem título"}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {p.status === "publicado"
                      ? `Publicado em ${formatDateTime(p.publicado_em)}`
                      : p.agendado_para
                        ? `Agendado para ${formatDateTime(p.agendado_para)}`
                        : "Sem data"}
                    {p.status === "processando" && p.etapa
                      ? ` · etapa: ${p.etapa.replace(/_/g, " ")}`
                      : ""}
                    {p.tentativas > 0 && p.status !== "publicado"
                      ? ` · tentativa ${p.tentativas}`
                      : ""}
                  </p>
                  {p.status === "agendado" && p.agendado_para ? (
                    <p
                      className="text-sm font-semibold tabular-nums text-foreground"
                      aria-label={`Execução programada para ${formatDateTime(p.agendado_para)}. Faltam ${formatCountdown(new Date(p.agendado_para).getTime() - agora)}.`}
                    >
                      Em {formatCountdown(new Date(p.agendado_para).getTime() - agora)}
                    </p>
                  ) : null}
                  {p.ultimo_erro && p.status !== "publicado" ? (
                    <p className="text-xs text-destructive">{p.ultimo_erro}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.permalink ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={p.permalink} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-4" />
                        Ver no Instagram
                      </a>
                    </Button>
                  ) : null}
                  {isAdmin && p.status === "aguardando_aprovacao" ? (
                    <Button
                      size="sm"
                      onClick={() => approve.mutate(p.id)}
                      disabled={approve.isPending}
                    >
                      <Check className="size-4" />
                      Aprovar
                    </Button>
                  ) : null}
                  {["rascunho", "aguardando_aprovacao", "agendado", "falhou"].includes(p.status) &&
                  !travado ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/posts/$postId" params={{ postId: p.id }}>
                        <Pencil className="size-4" />
                        Editar
                      </Link>
                    </Button>
                  ) : null}
                  {["agendado", "aguardando_aprovacao"].includes(p.status) && !travado ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setReagendar({ id: p.id, quando: toLocalInput(p.agendado_para), original: p.agendado_para ?? "", modo: "adiantar" })
                        }
                      >
                        <FastForward className="size-4" />
                        Adiantar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setReagendar({ id: p.id, quando: toLocalInput(p.agendado_para), original: p.agendado_para ?? "", modo: "reagendar" })
                        }
                      >
                        <CalendarClock className="size-4" />
                        Reagendar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cancel.mutate(p.id)}
                        disabled={cancel.isPending}
                      >
                        <Undo2 className="size-4" />
                        Cancelar
                      </Button>
                    </>
                  ) : null}
                  {isAdmin && p.status === "falhou" ? (
                    <Button size="sm" onClick={() => retry.mutate(p.id)} disabled={retry.isPending}>
                      <RotateCcw className="size-4" />
                      Tentar novamente
                    </Button>
                  ) : null}
                  {["rascunho", "falhou"].includes(p.status) ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => remove.mutate(p.id)}
                      disabled={remove.isPending}
                      aria-label="Excluir"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!reagendar} onOpenChange={(o) => !o && setReagendar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reagendar?.modo === "adiantar" ? "Adiantar publicação" : "Reagendar publicação"}</DialogTitle>
            <DialogDescription>
              {reagendar?.modo === "adiantar"
                ? "Escolha quanto antecipar ou informe um horário futuro anterior ao atual (horário de Brasília)."
                : "Escolha o novo horário (horário de Brasília)."}
            </DialogDescription>
          </DialogHeader>
          {reagendar?.modo === "adiantar" ? (
            <div className="flex flex-wrap gap-2">
              {[5, 15, 30, 60].map((minutos) => (
                <Button
                  key={minutos}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setReagendar((r) =>
                      r
                        ? {
                            ...r,
                            quando: toLocalInput(
                              new Date(new Date(r.original).getTime() - minutos * 60_000).toISOString(),
                            ),
                          }
                        : r,
                    )
                  }
                >
                  {minutos} min
                </Button>
              ))}
            </div>
          ) : null}
          <Input
            type="datetime-local"
            value={reagendar?.quando ?? ""}
            min={toLocalInput(new Date(Date.now() + 60_000).toISOString())}
            onChange={(e) => setReagendar((r) => (r ? { ...r, quando: e.target.value } : r))}
          />
          {reagendar?.modo === "adiantar" &&
          (!reagendar.quando ||
            new Date(reagendar.quando).getTime() >= new Date(reagendar.original).getTime()) ? (
            <p className="text-sm text-destructive">Escolha um horário anterior ao que já está agendado.</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReagendar(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => reagendar && resched.mutate(reagendar)}
              disabled={
                !reagendar?.quando ||
                resched.isPending ||
                (reagendar.modo === "adiantar" &&
                  new Date(reagendar.quando).getTime() >= new Date(reagendar.original).getTime())
              }
            >
              {reagendar?.modo === "adiantar" ? "Confirmar antecipação" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export function NoPosts({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <EmptyState icon={<CalendarClock className="size-8" />} title={title}>
      {children}
    </EmptyState>
  );
}
