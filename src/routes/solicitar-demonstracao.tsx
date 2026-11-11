import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/solicitar-demonstracao")({
  beforeLoad: () => { throw redirect({ to: "/demonstracao", statusCode: 301 }); },
});
