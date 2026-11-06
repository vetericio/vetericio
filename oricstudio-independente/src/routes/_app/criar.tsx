import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { PostEditor } from "@/components/post-editor";
import { useIsAdmin } from "@/lib/session";

export const Route = createFileRoute("/_app/criar")({
  head: () => ({ meta: [{ title: "Criar publicação — Gestor Instagram" }] }),
  component: CreatePage,
});

function CreatePage() {
  const isAdmin = useIsAdmin();
  return (
    <>
      <PageHeader
        title="Criar publicação"
        description="Imagem, carrossel, Reels ou Story, com prévia e agendamento no servidor."
      />
      <PostEditor isAdmin={isAdmin} />
    </>
  );
}
