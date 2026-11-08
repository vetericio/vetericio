import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccounts } from "@/lib/queries";

export function AccountFilter({
  value,
  onChange,
  allLabel = "Todas as contas",
}: {
  value: string;
  onChange: (v: string) => void;
  allLabel?: string;
}) {
  const accounts = useAccounts();
  const managed = (accounts.data ?? []).filter((a) => a.gerenciada);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar por conta">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todas">{allLabel}</SelectItem>
        {managed.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            @{a.username}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PeriodFilter({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="w-full sm:w-44" aria-label="Período">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="7">Últimos 7 dias</SelectItem>
        <SelectItem value="14">Últimos 14 dias</SelectItem>
        <SelectItem value="30">Últimos 30 dias</SelectItem>
        <SelectItem value="90">Últimos 90 dias</SelectItem>
      </SelectContent>
    </Select>
  );
}
