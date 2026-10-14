import { createFileRoute } from "@tanstack/react-router";
import { ClinicLogin, PortalUnavailable } from "@/components/ClinicLogin";
import { useTenantContext } from "@/lib/tenant-context";

export const Route = createFileRoute("/vet/$slug")({ component: PortalDaClinica });

function PortalDaClinica() {
  const { portal, loading, error } = useTenantContext();
  if (loading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center text-sm text-muted-foreground">
        Carregando clínica…
      </main>
    );
  }
  if (error) return <PortalUnavailable message={error} />;
  if (!portal)
    return <PortalUnavailable message="Confira o link ou entre em contato com a clínica." />;
  return <ClinicLogin clinic={portal} />;
}
