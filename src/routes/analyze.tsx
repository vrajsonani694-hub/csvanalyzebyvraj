import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { useDatasetStore } from "@/store/dataset-store";
import { useMemo, useState } from "react";
import {
  correlationMatrix,
  histogram,
  numericValues,
  summarizeCategorical,
  summarizeNumeric,
} from "@/lib/analysis/statistics";
import { ChartCard } from "@/components/charts/chart-card";
import { CorrelationHeatmap } from "@/components/charts/correlation-heatmap";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatNumber, formatPercent } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/analyze")({
  component: AnalyzePage,
  head: () => ({
    meta: [
      { title: "Analyze — AI CSV Analyzer Pro" },
      { name: "description", content: "Descriptive statistics, distributions, and correlations." },
    ],
  }),
});

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
];

function AnalyzePage() {
  const active = useDatasetStore((s) => s.active);
  const numericCols = useMemo(
    () => (active ? active.columns.filter((c) => c.kind === "number" || c.kind === "integer") : []),
    [active],
  );
  const categoricalCols = useMemo(
    () => (active ? active.columns.filter((c) => c.kind === "string" || c.kind === "boolean") : []),
    [active],
  );

  const [xCol, setXCol] = useState<string>("");
  const [yCol, setYCol] = useState<string>("");
  const [catCol, setCatCol] = useState<string>("");

  const numericSummaries = useMemo(
    () => (active ? numericCols.map((c) => summarizeNumeric(active.rows, c.name)) : []),
    [active, numericCols],
  );
  const categoricalSummaries = useMemo(
    () => (active ? categoricalCols.map((c) => summarizeCategorical(active.rows, c.name)) : []),
    [active, categoricalCols],
  );
  const corr = useMemo(
    () => (active ? correlationMatrix(active.rows, numericCols.map((c) => c.name)) : null),
    [active, numericCols],
  );

  const effectiveX = xCol || numericCols[0]?.name || "";
  const effectiveY = yCol || numericCols[1]?.name || numericCols[0]?.name || "";
  const effectiveCat = catCol || categoricalCols[0]?.name || "";

  const histData = useMemo(() => {
    if (!active || !effectiveX) return [];
    return histogram(numericValues(active.rows, effectiveX), 24).map((b) => ({
      x: Number(b.x.toFixed(3)),
      count: b.count,
    }));
  }, [active, effectiveX]);

  const scatterData = useMemo(() => {
    if (!active || !effectiveX || !effectiveY) return [];
    const out: { x: number; y: number }[] = [];
    for (const r of active.rows) {
      const x = r[effectiveX];
      const y = r[effectiveY];
      if (typeof x === "number" && typeof y === "number") out.push({ x, y });
      if (out.length >= 1500) break;
    }
    return out;
  }, [active, effectiveX, effectiveY]);

  const catData = useMemo(() => {
    if (!active || !effectiveCat) return [];
    return summarizeCategorical(active.rows, effectiveCat).top.slice(0, 8);
  }, [active, effectiveCat]);

  const trendData = useMemo(() => {
    if (!active || !effectiveX) return [];
    const values = numericValues(active.rows, effectiveX);
    const window = Math.max(1, Math.floor(values.length / 60));
    const out: { i: number; value: number }[] = [];
    for (let i = 0; i < values.length; i += window) {
      const slice = values.slice(i, i + window);
      const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
      out.push({ i, value: avg });
    }
    return out;
  }, [active, effectiveX]);

  if (!active) {
    return (
      <AppShell>
        <div className="rounded-xl border bg-card p-8 text-center shadow-soft">
          <p className="text-muted-foreground">
            Load a CSV first from the <Link to="/" className="text-primary underline">dashboard</Link>.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[180px]">
            <Label className="mb-1 block text-xs">Numeric X</Label>
            <Select value={effectiveX} onValueChange={setXCol}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {numericCols.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[180px]">
            <Label className="mb-1 block text-xs">Numeric Y</Label>
            <Select value={effectiveY} onValueChange={setYCol}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {numericCols.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[180px]">
            <Label className="mb-1 block text-xs">Category</Label>
            <Select value={effectiveCat} onValueChange={setCatCol}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {categoricalCols.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button asChild variant="outline" className="ml-auto">
            <Link to="/reports">Export report</Link>
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title={`Distribution — ${effectiveX || "—"}`} description="Histogram of numeric values">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={histData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="x" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
                  <Bar dataKey="count" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title={`Scatter — ${effectiveX} vs ${effectiveY}`} description="Relationship between two numeric columns">
            <div className="h-64">
              <ResponsiveContainer>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" dataKey="x" name={effectiveX} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <YAxis type="number" dataKey="y" name={effectiveY} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
                  <Scatter data={scatterData} fill="var(--color-chart-2)" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title={`Top categories — ${effectiveCat || "—"}`} description="Frequency of the most common values">
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={catData} dataKey="count" nameKey="value" outerRadius={90} innerRadius={45}>
                    {catData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title={`Trend — moving average of ${effectiveX}`} description="Row-order smoothed values">
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="i" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
                  <Line type="monotone" dataKey="value" stroke="var(--color-chart-4)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {corr && corr.columns.length > 1 && (
          <ChartCard title="Correlation matrix" description="Pearson correlation across numeric columns">
            <CorrelationHeatmap matrix={corr} />
          </ChartCard>
        )}

        {numericSummaries.length > 0 && (
          <div className="rounded-xl border bg-card shadow-soft">
            <div className="border-b px-5 py-3">
              <h3 className="font-semibold">Numeric summary</h3>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left">
                  <tr>
                    {["Column", "Count", "Mean", "Median", "Stdev", "Min", "Max", "Skew", "Outliers"].map((h) => (
                      <th key={h} className="whitespace-nowrap px-4 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {numericSummaries.map((n) => (
                    <tr key={n.column} className="border-t">
                      <td className="px-4 py-2 font-medium">{n.column}</td>
                      <td className="px-4 py-2 font-mono">{n.count}</td>
                      <td className="px-4 py-2 font-mono">{formatNumber(n.mean)}</td>
                      <td className="px-4 py-2 font-mono">{formatNumber(n.median)}</td>
                      <td className="px-4 py-2 font-mono">{formatNumber(n.stdev)}</td>
                      <td className="px-4 py-2 font-mono">{formatNumber(n.min)}</td>
                      <td className="px-4 py-2 font-mono">{formatNumber(n.max)}</td>
                      <td className="px-4 py-2 font-mono">{formatNumber(n.skewness)}</td>
                      <td className="px-4 py-2 font-mono">{n.outliers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {categoricalSummaries.length > 0 && (
          <div className="rounded-xl border bg-card shadow-soft">
            <div className="border-b px-5 py-3">
              <h3 className="font-semibold">Categorical summary</h3>
            </div>
            <div className="grid gap-3 p-5 md:grid-cols-2">
              {categoricalSummaries.map((c) => (
                <div key={c.column} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{c.column}</p>
                    <span className="text-xs text-muted-foreground">
                      {c.unique} unique · {formatPercent(c.missing / (c.count + c.missing || 1))} missing
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {c.top.slice(0, 5).map((t) => (
                      <li key={t.value} className="flex justify-between">
                        <span className="truncate pr-2" title={t.value}>{t.value}</span>
                        <span className="font-mono text-muted-foreground">{t.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
