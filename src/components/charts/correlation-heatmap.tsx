import type { CorrelationMatrix } from "@/lib/analysis/statistics";

interface Props {
  matrix: CorrelationMatrix;
}

const cellColor = (v: number): string => {
  const clamped = Math.max(-1, Math.min(1, v));
  const hue = clamped >= 0 ? 210 : 15;
  const alpha = Math.abs(clamped);
  return `oklch(0.65 0.22 ${hue} / ${0.15 + alpha * 0.7})`;
};

export function CorrelationHeatmap({ matrix }: Props) {
  if (!matrix.columns.length) {
    return <p className="text-sm text-muted-foreground">Need at least one numeric column.</p>;
  }
  return (
    <div className="overflow-auto scrollbar-thin">
      <table className="border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th />
            {matrix.columns.map((c) => (
              <th
                key={c}
                className="min-w-[80px] px-2 py-1 text-left font-medium text-muted-foreground"
              >
                <div className="max-w-[120px] truncate" title={c}>
                  {c}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.columns.map((rowName, i) => (
            <tr key={rowName}>
              <th className="whitespace-nowrap pr-2 text-right font-medium text-muted-foreground">
                <div className="max-w-[120px] truncate" title={rowName}>
                  {rowName}
                </div>
              </th>
              {matrix.columns.map((_, j) => {
                const v = matrix.values[i][j];
                return (
                  <td
                    key={j}
                    className="rounded-md px-2 py-1.5 text-center font-mono tabular-nums"
                    style={{ backgroundColor: cellColor(v), color: Math.abs(v) > 0.55 ? "white" : "inherit" }}
                    title={`${matrix.columns[i]} × ${matrix.columns[j]}: ${v.toFixed(3)}`}
                  >
                    {v.toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
