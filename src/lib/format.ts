export const formatNumber = (n: number, digits = 3): string => {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e6 || abs < 1e-3) return n.toExponential(2);
  return Number(n.toFixed(digits)).toString();
};

export const formatInt = (n: number): string =>
  Number.isFinite(n) ? Math.round(n).toLocaleString() : "—";

export const formatBytes = (bytes: number): string => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
};

export const formatPercent = (n: number, digits = 1): string =>
  Number.isFinite(n) ? `${(n * 100).toFixed(digits)}%` : "—";

export const formatDate = (ts: number): string =>
  new Date(ts).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
