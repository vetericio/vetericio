import { Hourglass } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/page-header";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState icon={<Hourglass className="size-8" />} title="Disponível na próxima fase">
        {description}
      </EmptyState>
    </>
  );
}
