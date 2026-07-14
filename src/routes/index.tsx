import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  BarChart3,
  Brain,
  Database,
  FileDown,
  Rows3,
  Columns3,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Dropzone } from "@/components/upload/dropzone";
import { StatCard } from "@/components/dashboard/stat-card";
import { useDatasetStore } from "@/store/dataset-store";
import { useMemo } from "react";
import { overview } from "@/lib/analysis/statistics";
import { formatBytes, formatDate, formatInt, formatPercent } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  const active = useDatasetStore((s) => s.active);
  const history = useDatasetStore((s) => s.history);
  const info = useMemo(() => (active ? overview(active) : null), [active]);

  return (
    <AppShell>
      {!active || !info ? (
        <div className="mx-auto max-w-4xl space-y-8">
          <motion.header
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Runs entirely in your browser
            </div>
            <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
              Turn any CSV into insight in <span className="text-gradient">seconds</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-balance text-muted-foreground">
              Descriptive statistics, correlations, interactive charts, and trained ML models —
              no accounts, no uploads to a server, no waiting.
            </p>
          </motion.header>
          <Dropzone />
          {history.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Recent uploads</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm shadow-soft"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{h.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.rows.toLocaleString()} rows · {h.columns} cols · {formatBytes(h.size)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(h.uploadedAt)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Rows" value={formatInt(info.rowCount)} hint={formatBytes(info.memoryEstimate)} icon={Rows3} accent="primary" delay={0} />
            <StatCard label="Columns" value={formatInt(info.columnCount)} hint={`${info.numericColumns.length} numeric`} icon={Columns3} accent="accent" delay={0.05} />
            <StatCard label="Missing" value={formatPercent(info.missingRatio)} hint={`${formatInt(info.totalMissing)} cells`} icon={AlertCircle} accent="warning" delay={0.1} />
            <StatCard label="Duplicates" value={formatInt(info.duplicateRows)} hint="identical rows" icon={Database} accent="success" delay={0.15} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <QuickAction
              to="/preview"
              icon={Rows3}
              title="Explore data"
              body="Search, sort, and clean the dataset in an interactive table."
            />
            <QuickAction
              to="/analyze"
              icon={BarChart3}
              title="Run analysis"
              body="Descriptive stats, distributions, and correlation matrix."
            />
            <QuickAction
              to="/ml"
              icon={Brain}
              title="Train a model"
              body="Regression, classification, or K-Means clustering with one click."
            />
          </div>

          <section className="rounded-xl border bg-card p-5 shadow-soft">
            <h2 className="mb-4 font-semibold">Column overview</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {active.columns.slice(0, 12).map((c) => (
                <div key={c.name} className="rounded-lg border bg-background/60 p-3">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-medium" title={c.name}>{c.name}</p>
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {c.kind}
                    </span>
                  </div>
                  <div className="mt-1.5 text-xs text-muted-foreground">
                    {c.uniqueCount.toLocaleString()} unique · {formatPercent(c.nullRatio)} missing
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Button asChild variant="outline">
                <Link to="/reports">
                  <FileDown className="mr-2 h-4 w-4" /> Generate report
                </Link>
              </Button>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function QuickAction({
  to,
  icon: Icon,
  title,
  body,
}: {
  to: string;
  icon: typeof Rows3;
  title: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-xl border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-glow"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg gradient-accent text-accent-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </Link>
  );
}
