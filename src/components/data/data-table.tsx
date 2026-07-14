import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ColumnProfile, Row } from "@/lib/csv/parser";
import { cn } from "@/lib/utils";

interface Props {
  rows: Row[];
  columns: ColumnProfile[];
  pageSize?: number;
}

const kindColor: Record<ColumnProfile["kind"], string> = {
  number: "bg-chart-1/15 text-chart-1",
  integer: "bg-chart-1/15 text-chart-1",
  string: "bg-chart-2/15 text-chart-2",
  boolean: "bg-chart-3/15 text-chart-3",
  date: "bg-chart-4/15 text-chart-4",
};

export function DataTable({ rows, columns, pageSize = 25 }: Props) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      columns.some((c) => {
        const v = r[c.name];
        return v !== null && String(v).toLowerCase().includes(q);
      }),
    );
  }, [rows, columns, query]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clamped = Math.min(page, pageCount - 1);
  const view = sorted.slice(clamped * pageSize, clamped * pageSize + pageSize);

  const toggleSort = (name: string) => {
    if (sortKey === name) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(name);
      setSortDir("asc");
    }
  };

  return (
    <div className="rounded-xl border bg-card shadow-soft">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search rows…"
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {sorted.length.toLocaleString()} rows
        </div>
      </div>
      <div className="overflow-auto scrollbar-thin">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/60">
            <tr>
              {columns.map((c) => {
                const isSorted = sortKey === c.name;
                const Icon = isSorted ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <th key={c.name} className="whitespace-nowrap px-4 py-3 text-left font-medium">
                    <button
                      onClick={() => toggleSort(c.name)}
                      className="flex items-center gap-2 hover:text-foreground"
                    >
                      <span>{c.name}</span>
                      <Badge variant="secondary" className={cn("h-5 px-1.5 text-[10px]", kindColor[c.kind])}>
                        {c.kind}
                      </Badge>
                      <Icon className={cn("h-3.5 w-3.5", isSorted ? "opacity-100" : "opacity-40")} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {view.map((row, i) => (
              <tr key={i} className="border-t hover:bg-muted/40">
                {columns.map((c) => {
                  const v = row[c.name];
                  return (
                    <td key={c.name} className="whitespace-nowrap px-4 py-2.5">
                      {v === null ? (
                        <span className="italic text-muted-foreground">null</span>
                      ) : typeof v === "number" ? (
                        <span className="font-mono tabular-nums">{v}</span>
                      ) : (
                        String(v)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {view.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-muted-foreground">
                  No rows match your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-2 border-t p-3">
        <div className="text-xs text-muted-foreground">
          Page {clamped + 1} of {pageCount}
        </div>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={clamped === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={clamped >= pageCount - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
