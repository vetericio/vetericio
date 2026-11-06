import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** Line chart over days. Missing values stay as gaps (never drawn as zero). */
export function TimeChart({
  data,
  series,
}: {
  data: Record<string, string | number | null>[];
  series: { key: string; label: string }[];
}) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s, i) => [s.key, { label: s.label, color: COLORS[i % COLORS.length]! }]),
  );
  if (!data.length)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Sem dados coletados neste período.
      </p>
    );
  return (
    <ChartContainer config={config} className="h-64 w-full">
      <LineChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="dia"
          tickLine={false}
          axisLine={false}
          tickFormatter={(d: string) => d.slice(8, 10) + "/" + d.slice(5, 7)}
          minTickGap={16}
        />
        <YAxis tickLine={false} axisLine={false} width={44} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            type="monotone"
            stroke={`var(--color-${s.key})`}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
