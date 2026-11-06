import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, EyeOff, Loader2, MessageSquare, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState, PageHeader } from "@/components/page-header";
import { AccountFilter } from "@/components/filters";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIA_LABEL, type Categoria } from "@/lib/comment-classifier";
import { archiveComment, collectNow, hideComment, replyComment } from "@/lib/ops.functions";
import { errorMessage, formatDateTime, useAccounts } from "@/lib/queries";
import { useIsAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/comentarios")({
  head: () => ({ meta: [{ title: "Comentários — Gestor Instagram" }] }),
  component: CommentsPage,
});

const TONE: Record<string, string> = {
  sensivel: "border-red-500/40 text-red-700 dark:text-red-400",
  reclamacao: "border-orange-500/40 text-orange-700 dark:text-orange-400",
  oportunidade: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  pergunta: "border-sky-500/40 text-sky-700 dark:text-sky-400",
  elogio: "border-violet-500/40 text-violet-700 dark:text-violet-400",
  outro: "",
};

function CommentsPage() {
  const [conta, setConta] = useState("todas");
  const [filtro, setFiltro] = useState("pendentes");
  const accounts = useAccounts();
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<{
    id: string;
    tipo: "responder" | "ocultar";
    texto: string;
  } | null>(null);
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});

  const comments = useQuery({
    queryKey: ["comments", conta, filtro],
    refetchInterval: 120_000,
    queryFn: async () => {
      let q = supabase
        .from("comments")
        .select("*")
        .order("publicado_em", { ascending: false })
        .limit(200);
      if (conta !== "todas") q = q.eq("instagram_account_id", conta);
      if (filtro === "pendentes") q = q.eq("respondido", false).eq("arquivado", false);
      else if (filtro === "humano") q = q.eq("precisa_humano", true).eq("arquivado", false);
      else if (filtro === "respondidos") q = q.eq("respondido", true);
      else if (filtro !== "todos") q = q.eq("categoria", filtro).eq("arquivado", false);
      const { data, error } = await q;
      if (error) throw error;
      const mediaIds = [
        ...new Set((data ?? []).map((c) => c.ig_media_id).filter((x): x is string => !!x)),
      ];
      const { data: media } = mediaIds.length
        ? await supabase
            .from("ig_media")
            .select("ig_media_id, caption, permalink, thumbnail_url")
            .in("ig_media_id", mediaIds)
        : { data: [] };
      const byId = new Map((media ?? []).map((m) => [m.ig_media_id, m]));
      return (data ?? []).map((c) => ({
        ...c,
        media: c.ig_media_id ? (byId.get(c.ig_media_id) ?? null) : null,
      }));
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["comments"] });
  const coletar = useMutation({
    mutationFn: () => collectNow({ data: conta === "todas" ? {} : { accountId: conta } }),
    onSuccess: () => {
      refresh();
      toast.success("Comentários atualizados.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const reply = useMutation({
    mutationFn: (v: { id: string; message: string }) => replyComment({ data: v }),
    onSuccess: () => {
      refresh();
      toast.success("Resposta publicada no Instagram.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const hide = useMutation({
    mutationFn: (v: { id: string; hide: boolean }) => hideComment({ data: v }),
    onSuccess: (_r, v) => {
      refresh();
      toast.success(v.hide ? "Comentário ocultado." : "Comentário visível de novo.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const archive = useMutation({
    mutationFn: (v: { id: string; arquivado: boolean }) => archiveComment({ data: v }),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const nome = (id: string) =>
    `@${(accounts.data ?? []).find((a) => a.id === id)?.username ?? "conta"}`;

  return (
    <>
      <PageHeader
        title="Comentários e comunidade"
        description="Coletados a cada hora (publicações dos últimos 30 dias) e classificados por palavras-chave. A classificação é uma triagem automática e pode errar; reclamações e casos sensíveis vão sempre para revisão humana. Nada é respondido ou ocultado sem confirmação, exceto as respostas automáticas que você ligar em Regras (modo Gestão ampliada)."
        actions={
          <Button variant="outline" onClick={() => coletar.mutate()} disabled={coletar.isPending}>
            {coletar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Coletar agora
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <AccountFilter value={conta} onChange={setConta} />
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-full sm:w-60" aria-label="Filtro">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pendentes">Sem resposta</SelectItem>
            <SelectItem value="humano">Precisam de atenção humana</SelectItem>
            {Object.entries(CATEGORIA_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
            <SelectItem value="respondidos">Respondidos</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {comments.isLoading ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      ) : !comments.data?.length ? (
        <EmptyState
          icon={<MessageSquare className="size-8" />}
          title="Nenhum comentário neste filtro"
        />
      ) : (
        <div className="space-y-3">
          {comments.data.map((c) => {
            const texto = rascunhos[c.id] ?? c.resposta_sugerida ?? "";
            return (
              <Card
                key={c.id}
                className={cn(c.precisa_humano && !c.respondido && "border-destructive/40")}
              >
                <CardContent className="space-y-3 p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={TONE[c.categoria]}>
                      {CATEGORIA_LABEL[c.categoria as Categoria] ?? c.categoria}
                    </Badge>
                    {c.precisa_humano && !c.respondido ? (
                      <Badge variant="destructive">Atenção humana</Badge>
                    ) : null}
                    {c.oculto ? <Badge variant="secondary">Oculto</Badge> : null}
                    <span className="text-xs text-muted-foreground">
                      @{c.autor} em {nome(c.instagram_account_id)} ·{" "}
                      {formatDateTime(c.publicado_em)}
                      {c.parent_ig_comment_id ? " · resposta" : ""}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{c.texto}</p>
                  {c.motivo_humano ? (
                    <p className="text-xs text-destructive">{c.motivo_humano}</p>
                  ) : null}
                  {c.media ? (
                    <p className="text-xs text-muted-foreground">
                      Na publicação:{" "}
                      {c.media.permalink ? (
                        <a
                          href={c.media.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {(c.media.caption ?? "").split("\n")[0]?.slice(0, 60) || "abrir"}
                        </a>
                      ) : (
                        (c.media.caption ?? "").slice(0, 60)
                      )}
                    </p>
                  ) : null}
                  {c.respondido ? (
                    <p className="rounded bg-muted p-2 text-xs">
                      {c.resposta_enviada
                        ? `Respondido${c.respondido_por === "automatico" ? " automaticamente" : ""} em ${formatDateTime(c.respondido_em)}: “${c.resposta_enviada}”`
                        : "Já respondido pela conta no Instagram."}
                    </p>
                  ) : c.categoria !== "sensivel" || isAdmin ? (
                    <div className="space-y-2">
                      {c.sugestao_por === "assistente" && c.resposta_sugerida ? (
                        <p className="text-xs text-muted-foreground">
                          Sugestão escrita pelo assistente com o contexto da publicação. Revise
                          antes de responder.
                        </p>
                      ) : null}
                      {!c.resposta_sugerida && c.parent_ig_comment_id ? (
                        <p className="text-xs text-muted-foreground">
                          Resposta dentro de uma conversa entre outras pessoas. Normalmente não
                          precisa de resposta da marca: considere arquivar.
                        </p>
                      ) : null}
                      <Textarea
                        rows={2}
                        value={texto}
                        placeholder="Escreva a resposta"
                        onChange={(e) => setRascunhos({ ...rascunhos, [c.id]: e.target.value })}
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {!c.respondido ? (
                      <Button
                        size="sm"
                        onClick={() => setConfirm({ id: c.id, tipo: "responder", texto })}
                        disabled={!texto.trim() || reply.isPending}
                      >
                        <Send className="size-4" />
                        Responder
                      </Button>
                    ) : null}
                    {isAdmin ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          c.oculto
                            ? hide.mutate({ id: c.id, hide: false })
                            : setConfirm({ id: c.id, tipo: "ocultar", texto: c.texto ?? "" })
                        }
                      >
                        <EyeOff className="size-4" />
                        {c.oculto ? "Reexibir" : "Ocultar"}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => archive.mutate({ id: c.id, arquivado: !c.arquivado })}
                    >
                      <Archive className="size-4" />
                      {c.arquivado ? "Desarquivar" : "Arquivar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.tipo === "responder"
                ? "Publicar esta resposta no Instagram?"
                : "Ocultar este comentário?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.tipo === "responder"
                ? `A resposta fica pública: “${confirm.texto}”`
                : "O comentário deixa de aparecer para o público (o autor ainda o vê). Dá para reexibir depois."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirm) return;
                if (confirm.tipo === "responder")
                  reply.mutate({ id: confirm.id, message: confirm.texto.trim() });
                else hide.mutate({ id: confirm.id, hide: true });
                setConfirm(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
