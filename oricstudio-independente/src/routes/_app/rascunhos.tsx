import { Link, createFileRoute } from "@tanstack/react-router";
import { SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { NoPosts, PostList } from "@/components/post-list";
import { useIsAdmin } from "@/lib/session";

export const Route = createFileRoute("/_app/rascunhos")({
  head: () => ({ meta: [{ title: "Rascunhos — Gestor Instagram" }] }),
  component: DraftsPage,
});

function DraftsPage() {
  const isAdmin = useIsAdmin();
  return (
    <>
      <PageHeader
        title="Rascunhos"
        description="Conteúdos salvos e publicações aguardando aprovação de um administrador."
        actions={
          <Button asChild>
            <Link to="/criar">
              <SquarePen className="size-4" />
              Nova publicação
            </Link>
          </Button>
        }
      />
      <PostList
        statuses={["aguardando_aprovacao", "rascunho"]}
        isAdmin={isAdmin}
        empty={
          <NoPosts title="Nenhum rascunho">
            Crie uma publicação e salve como rascunho para revisar depois.
          </NoPosts>
        }
      />
    </>
  );
}
