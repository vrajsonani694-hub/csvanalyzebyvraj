import type { ColumnProfile, Row } from "@/lib/csv/parser";
import { numericValues } from "./statistics";
import * as ss from "simple-statistics";

export type MissingStrategy = "drop" | "mean" | "median" | "mode" | "zero" | "keep";

export interface CleanOptions {
  removeDuplicates: boolean;
  missing: MissingStrategy;
  removeOutliers: boolean;
}

export interface CleanReport {
  removedDuplicates: number;
  filledMissing: number;
  removedOutliers: number;
}

const mostFrequent = (rows: Row[], col: string): string | number | boolean | null => {
  const counts = new Map<string, { v: string | number | boolean; c: number }>();
  for (const r of rows) {
    const v = r[col];
    if (v === null) continue;
    const k = String(v);
    const existing = counts.get(k);
    if (existing) existing.c++;
    else counts.set(k, { v, c: 1 });
  }
  let best: { v: string | number | boolean; c: number } | null = null;
  for (const e of counts.values()) if (!best || e.c > best.c) best = e;
  return best?.v ?? null;
};

export const clean = (
  rows: Row[],
  columns: ColumnProfile[],
  opts: CleanOptions,
): { rows: Row[]; report: CleanReport } => {
  let working = rows.map((r) => ({ ...r }));
  const report: CleanReport = { removedDuplicates: 0, filledMissing: 0, removedOutliers: 0 };

  if (opts.removeDuplicates) {
    const seen = new Set<string>();
    const keys = columns.map((c) => c.name);
    const next: Row[] = [];
    for (const r of working) {
      const k = keys.map((h) => (r[h] === null ? "\0" : String(r[h]))).join("\u0001");
      if (seen.has(k)) report.removedDuplicates++;
      else {
        seen.add(k);
        next.push(r);
      }
    }
    working = next;
  }

  if (opts.missing !== "keep") {
    for (const col of columns) {
      const isNum = col.kind === "number" || col.kind === "integer";
      let replacement: string | number | boolean | null = null;
      if (opts.missing === "drop") {
        const before = working.length;
        working = working.filter((r) => r[col.name] !== null);
        report.filledMissing += before - working.length;
        continue;
      }
      if (opts.missing === "zero") replacement = isNum ? 0 : "";
      else if (opts.missing === "mode") replacement = mostFrequent(working, col.name);
      else if (isNum) {
        const vals = numericValues(working, col.name);
        if (vals.length) {
          replacement = opts.missing === "mean" ? ss.mean(vals) : ss.median(vals);
        }
      } else {
        replacement = mostFrequent(working, col.name);
      }
      if (replacement === null) continue;
      for (const r of working) {
        if (r[col.name] === null) {
          r[col.name] = replacement;
          report.filledMissing++;
        }
      }
    }
  }

  if (opts.removeOutliers) {
    const bounds = new Map<string, [number, number]>();
    for (const col of columns) {
      if (col.kind !== "number" && col.kind !== "integer") continue;
      const vals = numericValues(working, col.name).sort((a, b) => a - b);
      if (vals.length < 4) continue;
      const q1 = ss.quantileSorted(vals, 0.25);
      const q3 = ss.quantileSorted(vals, 0.75);
      const iqr = q3 - q1;
      bounds.set(col.name, [q1 - 1.5 * iqr, q3 + 1.5 * iqr]);
    }
    const next: Row[] = [];
    for (const r of working) {
      let drop = false;
      for (const [col, [lo, hi]] of bounds) {
        const v = r[col];
        if (typeof v === "number" && (v < lo || v > hi)) {
          drop = true;
          break;
        }
      }
      if (drop) report.removedOutliers++;
      else next.push(r);
    }
    working = next;
  }

  return { rows: working, report };
};
