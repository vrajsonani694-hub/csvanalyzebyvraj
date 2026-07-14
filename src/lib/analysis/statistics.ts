import * as ss from "simple-statistics";
import type { ColumnProfile, Dataset, Row } from "@/lib/csv/parser";

export interface NumericSummary {
  column: string;
  count: number;
  missing: number;
  mean: number;
  median: number;
  mode: number | null;
  min: number;
  max: number;
  variance: number;
  stdev: number;
  q1: number;
  q3: number;
  iqr: number;
  skewness: number;
  kurtosis: number;
  outliers: number;
}

export interface CategoricalSummary {
  column: string;
  count: number;
  missing: number;
  unique: number;
  top: { value: string; count: number }[];
}

export const numericValues = (rows: Row[], column: string): number[] => {
  const out: number[] = [];
  for (const r of rows) {
    const v = r[column];
    if (typeof v === "number" && Number.isFinite(v)) out.push(v);
  }
  return out;
};

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export const summarizeNumeric = (rows: Row[], column: string): NumericSummary => {
  const values = numericValues(rows, column);
  const missing = rows.length - values.length;
  if (values.length === 0) {
    return {
      column,
      count: 0,
      missing,
      mean: 0,
      median: 0,
      mode: null,
      min: 0,
      max: 0,
      variance: 0,
      stdev: 0,
      q1: 0,
      q3: 0,
      iqr: 0,
      skewness: 0,
      kurtosis: 0,
      outliers: 0,
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = ss.mean(values);
  const stdev = values.length > 1 ? ss.sampleStandardDeviation(values) : 0;
  const q1 = ss.quantileSorted(sorted, 0.25);
  const q3 = ss.quantileSorted(sorted, 0.75);
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  const outliers = values.filter((v) => v < lower || v > upper).length;
  return {
    column,
    count: values.length,
    missing,
    mean,
    median: ss.medianSorted(sorted),
    mode: safe(() => ss.mode(values), null),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    variance: values.length > 1 ? ss.sampleVariance(values) : 0,
    stdev,
    q1,
    q3,
    iqr,
    skewness: values.length > 2 ? ss.sampleSkewness(values) : 0,
    kurtosis: values.length > 3 ? ss.sampleKurtosis(values) : 0,
    outliers,
  };
};

export const summarizeCategorical = (rows: Row[], column: string): CategoricalSummary => {
  const counts = new Map<string, number>();
  let missing = 0;
  for (const r of rows) {
    const v = r[column];
    if (v === null || v === "") {
      missing++;
      continue;
    }
    const key = String(v);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([value, count]) => ({ value, count }));
  return {
    column,
    count: rows.length - missing,
    missing,
    unique: counts.size,
    top,
  };
};

export interface CorrelationMatrix {
  columns: string[];
  values: number[][];
}

export const correlationMatrix = (rows: Row[], columns: string[]): CorrelationMatrix => {
  const series = columns.map((c) => numericValues(rows, c));
  const n = columns.length;
  const values: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const a = series[i];
      const b = series[j];
      const len = Math.min(a.length, b.length);
      let r = 0;
      if (len > 1) {
        try {
          r = ss.sampleCorrelation(a.slice(0, len), b.slice(0, len));
        } catch {
          r = 0;
        }
      } else if (i === j) r = 1;
      if (!Number.isFinite(r)) r = 0;
      values[i][j] = r;
      values[j][i] = r;
    }
  }
  return { columns, values };
};

export interface DatasetOverview {
  rowCount: number;
  columnCount: number;
  numericColumns: string[];
  categoricalColumns: string[];
  dateColumns: string[];
  totalMissing: number;
  missingRatio: number;
  duplicateRows: number;
  memoryEstimate: number;
}

export const overview = (dataset: Dataset): DatasetOverview => {
  const numeric = dataset.columns.filter((c) => c.kind === "number" || c.kind === "integer");
  const categorical = dataset.columns.filter((c) => c.kind === "string" || c.kind === "boolean");
  const dates = dataset.columns.filter((c) => c.kind === "date");
  const totalMissing = dataset.columns.reduce((s, c) => s + c.nullCount, 0);
  const total = dataset.rows.length * Math.max(dataset.columns.length, 1);
  return {
    rowCount: dataset.rows.length,
    columnCount: dataset.columns.length,
    numericColumns: numeric.map((c) => c.name),
    categoricalColumns: categorical.map((c) => c.name),
    dateColumns: dates.map((c) => c.name),
    totalMissing,
    missingRatio: total ? totalMissing / total : 0,
    duplicateRows: countDuplicates(dataset.rows, dataset.columns),
    memoryEstimate: dataset.size,
  };
};

export const countDuplicates = (rows: Row[], columns: ColumnProfile[]): number => {
  const seen = new Set<string>();
  let dupes = 0;
  const keys = columns.map((c) => c.name);
  for (const r of rows) {
    const k = keys.map((h) => (r[h] === null ? "\0" : String(r[h]))).join("\u0001");
    if (seen.has(k)) dupes++;
    else seen.add(k);
  }
  return dupes;
};

export const histogram = (values: number[], bins = 20): { x: number; count: number }[] => {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ x: min, count: values.length }];
  const width = (max - min) / bins;
  const buckets = new Array(bins).fill(0);
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.floor((v - min) / width));
    buckets[idx]++;
  }
  return buckets.map((count, i) => ({ x: min + width * (i + 0.5), count }));
};
