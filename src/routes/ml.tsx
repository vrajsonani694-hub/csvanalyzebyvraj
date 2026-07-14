import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { useDatasetStore } from "@/store/dataset-store";
import { useMemo, useState } from "react";
import {
  recommendTask,
  trainClassification,
  trainClustering,
  trainRegression,
  type ModelResult,
  type TaskType,
} from "@/lib/ml/models";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { formatNumber } from "@/lib/format";
import { ChartCard } from "@/components/charts/chart-card";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Brain, Play, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/ml")({
  component: MLPage,
  head: () => ({
    meta: [
      { title: "ML Studio — AI CSV Analyzer Pro" },
      { name: "description", content: "Train regression, classification, or clustering models on your CSV." },
    ],
  }),
});

function MLPage() {
  const active = useDatasetStore((s) => s.active);
  const model = useDatasetStore((s) => s.lastModel);
  const setModel = useDatasetStore((s) => s.setModel);

  const numericCols = useMemo(
    () => (active ? active.columns.filter((c) => c.kind === "number" || c.kind === "integer") : []),
    [active],
  );

  const [task, setTask] = useState<TaskType>("regression");
  const [target, setTarget] = useState<string>("");
  const [features, setFeatures] = useState<string[]>([]);
  const [k, setK] = useState<number>(3);
  const [busy, setBusy] = useState(false);

  const recommendation = useMemo(
    () => (active ? recommendTask(active, target || undefined) : null),
    [active, target],
  );

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

  const effectiveFeatures = features.length
    ? features
    : numericCols
        .filter((c) => c.name !== target)
        .slice(0, 4)
        .map((c) => c.name);

  const run = () => {
    setBusy(true);
    try {
      let result: ModelResult;
      if (task === "regression") {
        if (!target) throw new Error("Pick a numeric target.");
        result = trainRegression(active, target, effectiveFeatures);
      } else if (task === "classification") {
        if (!target) throw new Error("Pick a target column.");
        result = trainClassification(active, target, effectiveFeatures);
      } else {
        result = trainClustering(active, effectiveFeatures, k);
      }
      setModel(result);
      toast.success("Model trained");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Training failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleFeature = (name: string, on: boolean) => {
    setFeatures((prev) =>
      on ? Array.from(new Set([...prev, name])) : prev.filter((f) => f !== name),
    );
  };

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary text-primary-foreground">
              <Brain className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">ML Studio</h2>
              <p className="text-xs text-muted-foreground">Train a model in the browser</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="mb-1 block text-xs">Task</Label>
              <Select value={task} onValueChange={(v) => setTask(v as TaskType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="regression">Regression (Linear)</SelectItem>
                  <SelectItem value="classification">Classification (KNN)</SelectItem>
                  <SelectItem value="clustering">Clustering (K-Means)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {task !== "clustering" && (
              <div>
                <Label className="mb-1 block text-xs">Target column</Label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger><SelectValue placeholder="Select target…" /></SelectTrigger>
                  <SelectContent>
                    {active.columns.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name} · {c.kind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {task === "clustering" && (
              <div>
                <Label className="mb-1 block text-xs">Number of clusters (k)</Label>
                <Select value={String(k)} onValueChange={(v) => setK(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="mb-1 block text-xs">Numeric features</Label>
              <div className="max-h-56 space-y-1 overflow-auto rounded-lg border p-2 scrollbar-thin">
                {numericCols.length === 0 && (
                  <p className="p-2 text-xs text-muted-foreground">No numeric columns detected.</p>
                )}
                {numericCols.map((c) => {
                  const isTarget = c.name === target && task !== "clustering";
                  const checked = effectiveFeatures.includes(c.name) && !isTarget;
                  return (
                    <label
                      key={c.name}
                      className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/60"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={isTarget}
                        onCheckedChange={(v) => toggleFeature(c.name, v === true)}
                      />
                      <span className={isTarget ? "text-muted-foreground line-through" : ""}>{c.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {recommendation && (
              <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">Recommendation</p>
                {recommendation.reason}
              </div>
            )}

            <Button onClick={run} disabled={busy} className="w-full">
              <Play className="mr-2 h-4 w-4" />
              {busy ? "Training…" : "Train model"}
            </Button>
          </div>
        </Card>

        <div className="space-y-6">
          {!model ? (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-xl border border-dashed bg-card/50 p-10 text-center">
              <div>
                <TrendingUp className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Configure a task on the left and hit <span className="font-medium">Train model</span>.
                </p>
              </div>
            </div>
          ) : (
            <ModelResults result={model} />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}

function ModelResults({ result }: { result: ModelResult }) {
  if (result.algorithm === "linear-regression") {
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="R²" value={formatNumber(result.r2, 4)} />
          <Metric label="RMSE" value={formatNumber(result.rmse)} />
          <Metric label="MAE" value={formatNumber(result.mae)} />
        </div>
        <ChartCard title="Actual vs Predicted" description={`Target: ${result.target}`}>
          <div className="h-72">
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" dataKey="actual" name="Actual" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <YAxis type="number" dataKey="predicted" name="Predicted" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
                <Scatter data={result.predictions} fill="var(--color-chart-1)" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Coefficients">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Feature</th>
                  <th className="px-3 py-2 font-medium">Weight</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="px-3 py-2 italic">intercept</td>
                  <td className="px-3 py-2 font-mono">{formatNumber(result.intercept)}</td>
                </tr>
                {result.features.map((f, i) => (
                  <tr key={f} className="border-t">
                    <td className="px-3 py-2">{f}</td>
                    <td className="px-3 py-2 font-mono">{formatNumber(result.coefficients[i])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </>
    );
  }

  if (result.algorithm === "knn") {
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Accuracy" value={formatNumber(result.accuracy, 4)} />
          <Metric label="Precision" value={formatNumber(result.precision, 4)} />
          <Metric label="Recall" value={formatNumber(result.recall, 4)} />
          <Metric label="F1" value={formatNumber(result.f1, 4)} />
        </div>
        <ChartCard title="Confusion matrix" description={`Target: ${result.target}`}>
          <div className="overflow-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th />
                  {result.labels.map((l) => (
                    <th key={l} className="px-3 py-2 text-xs font-medium text-muted-foreground">
                      pred {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.labels.map((rowL, i) => (
                  <tr key={rowL} className="border-t">
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      actual {rowL}
                    </th>
                    {result.labels.map((_, j) => {
                      const v = result.confusion[i][j];
                      const max = Math.max(...result.confusion.flat(), 1);
                      const alpha = 0.1 + (v / max) * 0.7;
                      return (
                        <td
                          key={j}
                          className="px-3 py-2 text-center font-mono"
                          style={{ background: `oklch(0.6 0.22 275 / ${alpha})`, color: alpha > 0.55 ? "white" : "inherit" }}
                        >
                          {v}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </>
    );
  }

  const clusterCounts = result.assignments.reduce<Record<number, number>>((acc, c) => {
    acc[c] = (acc[c] ?? 0) + 1;
    return acc;
  }, {});
  const clusterData = Object.entries(clusterCounts).map(([id, count]) => ({
    id: `Cluster ${id}`,
    count,
  }));
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="k" value={String(result.k)} />
        <Metric label="Inertia" value={formatNumber(result.inertia)} />
        <Metric label="Silhouette" value={formatNumber(result.silhouette, 4)} />
      </div>
      <ChartCard title="Cluster sizes">
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={clusterData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="id" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
              <Line dataKey="count" type="monotone" stroke="var(--color-chart-2)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </>
  );
}
