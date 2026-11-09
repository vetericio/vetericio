import { createFileRoute } from "@tanstack/react-router";
import { PortalTutorClinica } from "@/routes/pet/$slug/portal";

export const Route = createFileRoute("/portaldotutor")({
  component: PortalDoTutorAlvorada,
});

function PortalDoTutorAlvorada() {
  return <PortalTutorClinica slugDaClinica="alvorada" />;
}
