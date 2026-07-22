import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { DataTable } from "@/components/data/data-table";
import { Dropzone } from "@/components/upload/dropzone";
import { useDatasetStore } from "@/store/dataset-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { clean, type MissingStrategy } from "@/lib/analysis/cleaning";
import { profileColumns, rowsToCsv } from "@/lib/csv/parser";
import { exportCsvString } from "@/lib/reports/exporters";
import { toast } from "sonner";
import { Download, Sparkles } from "lucide-react";

export const Route = createFileRoute("/preview")({
  component: PreviewPage,
  head: () => ({
    meta: [
      { title: "Data preview — CSV Analyzer Pro by Vraj" },
      { name: "description", content: "Search, sort, and clean your CSV dataset." },
    ],
  }),
});

function PreviewPage() {
  const active = useDatasetStore((s) => s.active);
  const replaceRows = useDatasetStore((s) => s.replaceRows);
  const [missing, setMissing] = useState<MissingStrategy>("keep");
  const [removeDupes, setRemoveDupes] = useState(false);
  const [removeOutliers, setRemoveOutliers] = useState(false);

  if (!active) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl">
          <Dropzone />
        </div>
      </AppShell>
    );
  }

  const runClean = () => {
    const { rows, report } = clean(active.rows, active.columns, {
      removeDuplicates: removeDupes,
      missing,
      removeOutliers,
    });
    const nextColumns = profileColumns(rows, active.columns.map((c) => c.name));
    replaceRows(rows, nextColumns);
    toast.success(
      `Cleaned: -${report.removedDuplicates} dupes, ${report.filledMissing} missing handled, -${report.removedOutliers} outliers`,
    );
  };

  const exportCsv = () => {
    const csv = rowsToCsv(active.rows, active.columns.map((c) => c.name));
    exportCsvString(csv, active.name.replace(/\.csv$/i, "") + ".cleaned.csv");
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold">Data preview</h2>
            <p className="text-sm text-muted-foreground">
              {active.rows.length.toLocaleString()} rows · {active.columns.length} columns
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
            <Button asChild>
              <Link to="/analyze">
                <Sparkles className="mr-2 h-4 w-4" /> Analyze
              </Link>
            </Button>
          </div>
        </div>

        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Missing values</Label>
              <Select value={missing} onValueChange={(v) => setMissing(v as MissingStrategy)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">Keep as null</SelectItem>
                  <SelectItem value="drop">Drop rows</SelectItem>
                  <SelectItem value="mean">Fill numeric mean</SelectItem>
                  <SelectItem value="median">Fill numeric median</SelectItem>
                  <SelectItem value="mode">Fill with mode</SelectItem>
                  <SelectItem value="zero">Fill with 0 / empty</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
              <Label htmlFor="dupes" className="text-sm">Remove duplicates</Label>
              <Switch id="dupes" checked={removeDupes} onCheckedChange={setRemoveDupes} />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
              <Label htmlFor="outliers" className="text-sm">Remove IQR outliers</Label>
              <Switch id="outliers" checked={removeOutliers} onCheckedChange={setRemoveOutliers} />
            </div>
            <Button onClick={runClean} className="md:justify-self-end">Apply cleaning</Button>
          </div>
        </Card>

        <DataTable rows={active.rows} columns={active.columns} />
      </div>
    </AppShell>
  );
}
