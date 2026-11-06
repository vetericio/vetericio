import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { NoPosts, PostList } from "@/components/post-list";
import { useIsAdmin } from "@/lib/session";

export const Route = createFileRoute("/_app/historico")({
  head: () => ({ meta: [{ title: "Histórico — Gestor Instagram" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const isAdmin = useIsAdmin();
  return (
    <>
      <PageHeader
        title="Histórico de publicações"
        description="Publicadas (confirmadas pela Meta), com falha ou com resultado ainda em verificação."
      />
      <PostList
        statuses={["resultado_desconhecido", "falhou", "publicado"]}
        isAdmin={isAdmin}
        empty={
          <NoPosts title="Nenhuma publicação ainda">
            As publicações feitas pelo sistema aparecem aqui com o link do Instagram.
          </NoPosts>
        }
      />
    </>
  );
}
