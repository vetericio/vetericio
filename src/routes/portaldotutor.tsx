import { createFileRoute } from "@tanstack/react-router";
import { PortalTutorClinica } from "@/routes/pet/$slug/portal";
import { useTenantContext } from "@/lib/tenant-context";

export const Route = createFileRoute("/portaldotutor")({
  component: PortalDoTutor,
});

function PortalDoTutor() {
  const { portal, loading, error } = useTenantContext();

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Carregando Portal do Tutor...</main>;
  }

  if (!portal?.clinica_slug) {
    return <main className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-muted-foreground">{error || "Este endereço não está vinculado a uma clínica ativa."}</main>;
  }

  return <PortalTutorClinica slugDaClinica={portal.clinica_slug} />;
}
