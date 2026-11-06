import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordPage } from "./redefinir-senha";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Nova senha — Gestor Instagram" },
    { name: "description", content: "Defina uma nova senha com seu link seguro de recuperação do Gestor Instagram." },
    { property: "og:title", content: "Nova senha — Gestor Instagram" },
    { property: "og:description", content: "Recuperação segura do acesso ao Gestor Instagram." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ResetPasswordPage,
});