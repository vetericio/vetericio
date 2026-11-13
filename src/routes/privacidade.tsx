import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [{ title: "Política de Privacidade | Oricse" }] }),
  component: () => <Navigate to="/politica-de-privacidade" replace />,
});
