import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { useDatasetStore } from "@/store/dataset-store";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { overview, summarizeCategorical, summarizeNumeric } from "@/lib/analysis/statistics";
import {
  exportExcelReport,
  exportJson,
  exportPdfReport,
  type ReportPayload,
} from "@/lib/reports/exporters";
import { rowsToCsv } from "@/lib/csv/parser";
import { exportCsvString } from "@/lib/reports/exporters";
import { toast } from "sonner";
import { FileJson, FileSpreadsheet, FileText, Table } from "lucide-react";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Reports — CSV Analyzer Pro by Vraj" },
      { name: "description", content: "Export PDF, Excel, CSV and JSON reports." },
    ],
  }),
});

function ReportsPage() {
  const active = useDatasetStore((s) => s.active);
  const model = useDatasetStore((s) => s.lastModel);
  const [busy, setBusy] = useState<string | null>(null);

  const payload: ReportPayload | null = useMemo(() => {
    if (!active) return null;
    const info = overview(active);
    const numeric = info.numericColumns.map((c) => summarizeNumeric(active.rows, c));
    const categorical = info.categoricalColumns.map((c) => summarizeCategorical(active.rows, c));
    return { dataset: active, overview: info, numeric, categorical, model };
  }, [active, model]);

  if (!active || !payload) {
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

  const baseName = active.name.replace(/\.csv$/i, "");

  const run = async (fmt: "pdf" | "excel" | "csv" | "json") => {
    setBusy(fmt);
    try {
      if (fmt === "pdf") {
        await exportPdfReport(payload, `${baseName}.report.pdf`);
        toast.success("PDF report ready");
      } else if (fmt === "excel") {
        exportExcelReport(payload, `${baseName}.report.xlsx`);
        toast.success("Excel report ready");
      } else if (fmt === "csv") {
        const csv = rowsToCsv(active.rows, active.columns.map((c) => c.name));
        exportCsvString(csv, `${baseName}.csv`);
      } else {
        exportJson(payload, `${baseName}.report.json`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const items = [
    { fmt: "pdf" as const, label: "PDF report", body: "Executive summary with stats and ML metrics.", icon: FileText },
    { fmt: "excel" as const, label: "Excel workbook", body: "Overview, numeric, categorical, model and data sheets.", icon: FileSpreadsheet },
    { fmt: "csv" as const, label: "Cleaned CSV", body: "The current in-memory dataset as CSV.", icon: Table },
    { fmt: "json" as const, label: "JSON payload", body: "Machine-readable analysis + model results.", icon: FileJson },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-semibold">Generate report</h2>
          <p className="text-sm text-muted-foreground">
            Includes dataset overview, statistical summaries{model ? ", trained model metrics" : ""} and preview data.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.fmt} className="p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg gradient-accent text-accent-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{item.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                <Button
                  className="mt-4"
                  onClick={() => void run(item.fmt)}
                  disabled={busy !== null}
                >
                  {busy === item.fmt ? "Preparing…" : "Download"}
                </Button>
              </Card>
            );
          })}
        </div>

        <Card className="p-5">
          <h3 className="font-semibold">Report contents</h3>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>• Dataset: {active.name}</li>
            <li>• {payload.overview.rowCount.toLocaleString()} rows, {payload.overview.columnCount} columns</li>
            <li>• {payload.numeric.length} numeric summaries, {payload.categorical.length} categorical summaries</li>
            <li>• {model ? `Model: ${model.algorithm}` : "No trained model yet"}</li>
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
