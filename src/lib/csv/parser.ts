import Papa from "papaparse";

export type CellValue = string | number | boolean | null;
export type Row = Record<string, CellValue>;

export type ColumnKind = "number" | "integer" | "boolean" | "date" | "string";

export interface ColumnProfile {
  name: string;
  kind: ColumnKind;
  nullCount: number;
  nullRatio: number;
  uniqueCount: number;
  sample: CellValue[];
}

export interface Dataset {
  id: string;
  name: string;
  size: number;
  uploadedAt: number;
  rows: Row[];
  columns: ColumnProfile[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const SIMPLE_DATE = /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/;

const isDateString = (v: string): boolean => {
  if (!v) return false;
  if (ISO_DATE.test(v) || SIMPLE_DATE.test(v)) {
    const t = Date.parse(v);
    return Number.isFinite(t);
  }
  return false;
};

const coerce = (raw: unknown): CellValue => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "boolean") return raw;
  const s = String(raw).trim();
  if (s === "" || /^(na|nan|null|none|n\/a)$/i.test(s)) return null;
  if (/^-?\d+$/.test(s)) {
    const n = Number(s);
    if (Number.isSafeInteger(n)) return n;
  }
  if (/^-?\d*\.\d+([eE][-+]?\d+)?$/.test(s) || /^-?\d+[eE][-+]?\d+$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  if (/^(true|false)$/i.test(s)) return s.toLowerCase() === "true";
  return s;
};

const inferKind = (values: CellValue[]): ColumnKind => {
  let nums = 0;
  let ints = 0;
  let bools = 0;
  let dates = 0;
  let seen = 0;
  for (const v of values) {
    if (v === null) continue;
    seen++;
    if (typeof v === "number") {
      nums++;
      if (Number.isInteger(v)) ints++;
    } else if (typeof v === "boolean") {
      bools++;
    } else if (typeof v === "string" && isDateString(v)) {
      dates++;
    }
  }
  if (seen === 0) return "string";
  if (bools / seen > 0.9) return "boolean";
  if (nums / seen > 0.9) return ints === nums ? "integer" : "number";
  if (dates / seen > 0.8) return "date";
  return "string";
};

export const profileColumns = (rows: Row[], headers: string[]): ColumnProfile[] =>
  headers.map((name) => {
    const values = rows.map((r) => r[name] ?? null);
    const nullCount = values.filter((v) => v === null).length;
    const unique = new Set(values.map((v) => (v === null ? "\0null" : String(v))));
    return {
      name,
      kind: inferKind(values),
      nullCount,
      nullRatio: rows.length ? nullCount / rows.length : 0,
      uniqueCount: unique.size,
      sample: values.slice(0, 5),
    };
  });

export interface ParseResult {
  dataset: Dataset;
  errors: string[];
}

export const parseCsvFile = (file: File): Promise<ParseResult> =>
  new Promise((resolve, reject) => {
    const rows: Row[] = [];
    let headers: string[] = [];
    const errors: string[] = [];
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      worker: false,
      dynamicTyping: false,
      step: (results) => {
        if (!headers.length && results.meta.fields) headers = results.meta.fields;
        const row: Row = {};
        for (const h of headers) row[h] = coerce(results.data[h]);
        rows.push(row);
        if (results.errors?.length) {
          for (const e of results.errors) errors.push(`${e.type}: ${e.message}`);
        }
      },
      complete: () => {
        if (!headers.length) {
          reject(new Error("CSV has no header row."));
          return;
        }
        const dataset: Dataset = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          size: file.size,
          uploadedAt: Date.now(),
          rows,
          columns: profileColumns(rows, headers),
        };
        resolve({ dataset, errors });
      },
      error: (err) => reject(err),
    });
  });

export const rowsToCsv = (rows: Row[], headers: string[]): string =>
  Papa.unparse({ fields: headers, data: rows.map((r) => headers.map((h) => r[h] ?? "")) });
