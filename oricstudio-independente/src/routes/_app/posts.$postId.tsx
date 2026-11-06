import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { PostEditor, postQueryKey } from "@/components/post-editor";
import { PostStatusBadge } from "@/components/post-list";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/queries";
import { useIsAdmin } from "@/lib/session";

export const Route = createFileRoute("/_app/posts/$postId")({
  head: () => ({ meta: [{ title: "Publicação — Gestor Instagram" }] }),
  component: PostPage,
});

function PostPage() {
  const { postId } = Route.useParams();
  const isAdmin = useIsAdmin();
  const post = useQuery({
    queryKey: [...postQueryKey(postId), "resumo"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const [p, ev] = await Promise.all([
        supabase
          .from("posts")
          .select("status, permalink, publicado_em, ultimo_erro")
          .eq("id", postId)
          .single(),
        supabase
          .from("post_events")
          .select("*")
          .eq("post_id", postId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (p.error) throw p.error;
      return { post: p.data, events: ev.data ?? [] };
    },
  });

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link to="/agendadas">
          <ArrowLeft className="size-4" />
          Publicações
        </Link>
      </Button>
      <PageHeader
        title="Publicação"
        description={post.data ? <PostStatusBadge status={post.data.post.status} /> : null}
        actions={
          post.data?.post.permalink ? (
            <Button variant="outline" asChild>
              <a href={post.data.post.permalink} target="_blank" rel="noreferrer">
                Ver no Instagram
              </a>
            </Button>
          ) : null
        }
      />
      <PostEditor postId={postId} isAdmin={isAdmin} />
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Registro da publicação</CardTitle>
        </CardHeader>
        <CardContent>
          {post.data?.events.length ? (
            <ol className="space-y-2 text-sm">
              {post.data.events.map((e) => (
                <li key={e.id} className="flex flex-wrap gap-x-3 border-b pb-2 last:border-0">
                  <span className="text-muted-foreground">{formatDateTime(e.created_at)}</span>
                  <span className="font-medium">{e.etapa.replace(/_/g, " ")}</span>
                  <span>{e.resultado.replace(/_/g, " ")}</span>
                  {e.detalhe ? (
                    <span className="w-full break-all text-xs text-muted-foreground">
                      {e.detalhe}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum passo registrado ainda. Os passos aparecem quando a fila começa a processar.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
