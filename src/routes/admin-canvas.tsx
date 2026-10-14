import { createFileRoute } from "@tanstack/react-router";
import { VisualPageEditor } from "@/components/admin/VisualPageEditor";

export const Route = createFileRoute("/admin-canvas")({
  component: VisualPageEditor,
});
