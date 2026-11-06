import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { NoPosts, PostList } from "@/components/post-list";
import { useIsAdmin } from "@/lib/session";

export const Route = createFileRoute("/_app/agendadas")({
  head: () => ({ meta: [{ title: "Agendadas — Gestor Instagram" }] }),
  component: ScheduledPage,
});

function ScheduledPage() {
  const isAdmin = useIsAdmin();
  return (
    <>
      <PageHeader
        title="Publicações agendadas"
        description="A fila roda no servidor a cada minuto, mesmo com o navegador fechado. Esta lista se atualiza sozinha."
      />
      <PostList
        statuses={["processando", "agendado"]}
        isAdmin={isAdmin}
        empty={<NoPosts title="Nada agendado">Use “Criar publicação” e escolha “Agendar”.</NoPosts>}
      />
    </>
  );
}
