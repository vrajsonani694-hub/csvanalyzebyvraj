import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toPng } from "html-to-image";
import type { Dataset } from "@/lib/csv/parser";
import type { NumericSummary, CategoricalSummary, DatasetOverview } from "@/lib/analysis/statistics";
import type { ModelResult } from "@/lib/ml/models";

const download = (data: BlobPart, filename: string, mime: string) => {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const exportJson = (payload: unknown, filename: string): void => {
  download(JSON.stringify(payload, null, 2), filename, "application/json");
};

export const exportCsvString = (csv: string, filename: string): void => {
  download(csv, filename, "text/csv;charset=utf-8;");
};

export interface ReportPayload {
  dataset: Dataset;
  overview: DatasetOverview;
  numeric: NumericSummary[];
  categorical: CategoricalSummary[];
  model?: ModelResult | null;
}

const fmt = (n: number, digits = 3): string =>
  Number.isFinite(n) ? Number(n.toFixed(digits)).toString() : "—";

export const exportExcelReport = (report: ReportPayload, filename: string): void => {
  const wb = XLSX.utils.book_new();

  const overviewSheet = XLSX.utils.aoa_to_sheet([
    ["CSV Analyzer Pro by Vraj — Report"],
    ["Dataset", report.dataset.name],
    ["Rows", report.overview.rowCount],
    ["Columns", report.overview.columnCount],
    ["Missing cells", report.overview.totalMissing],
    ["Duplicate rows", report.overview.duplicateRows],
    ["Numeric columns", report.overview.numericColumns.join(", ")],
    ["Categorical columns", report.overview.categoricalColumns.join(", ")],
    ["Date columns", report.overview.dateColumns.join(", ")],
    ["Generated", new Date().toISOString()],
  ]);
  XLSX.utils.book_append_sheet(wb, overviewSheet, "Overview");

  if (report.numeric.length) {
    const num = [
      ["column", "count", "missing", "mean", "median", "stdev", "min", "max", "q1", "q3", "skew", "kurtosis", "outliers"],
      ...report.numeric.map((n) => [
        n.column, n.count, n.missing, fmt(n.mean), fmt(n.median), fmt(n.stdev),
        fmt(n.min), fmt(n.max), fmt(n.q1), fmt(n.q3), fmt(n.skewness), fmt(n.kurtosis), n.outliers,
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(num), "Numeric");
  }
  if (report.categorical.length) {
    const cat = [
      ["column", "count", "missing", "unique", "top values"],
      ...report.categorical.map((c) => [
        c.column, c.count, c.missing, c.unique,
        c.top.map((t) => `${t.value} (${t.count})`).join(", "),
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cat), "Categorical");
  }

  if (report.model) {
    const m = report.model;
    const rows: (string | number)[][] = [["algorithm", m.algorithm]];
    if (m.algorithm === "linear-regression") {
      rows.push(["target", m.target], ["R²", fmt(m.r2)], ["RMSE", fmt(m.rmse)], ["MAE", fmt(m.mae)]);
      rows.push(["intercept", fmt(m.intercept)]);
      m.features.forEach((f, i) => rows.push([`coef:${f}`, fmt(m.coefficients[i])]));
    } else if (m.algorithm === "knn") {
      rows.push(
        ["target", m.target],
        ["accuracy", fmt(m.accuracy)],
        ["precision", fmt(m.precision)],
        ["recall", fmt(m.recall)],
        ["f1", fmt(m.f1)],
      );
    } else if (m.algorithm === "kmeans") {
      rows.push(["k", m.k], ["inertia", fmt(m.inertia)], ["silhouette", fmt(m.silhouette)]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Model");
  }

  const preview = report.dataset.rows.slice(0, 500);
  const headers = report.dataset.columns.map((c) => c.name);
  const previewData = [headers, ...preview.map((r) => headers.map((h) => r[h] ?? ""))];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(previewData), "Data (first 500)");

  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  download(buffer, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
};

export const exportPdfReport = async (
  report: ReportPayload,
  filename: string,
  chartElements: HTMLElement[] = [],
): Promise<void> => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("CSV Analyzer Pro by Vraj", 40, 50);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Dataset: ${report.dataset.name}`, 40, 72);
  doc.text(`Generated ${new Date().toLocaleString()}`, 40, 88);

  autoTable(doc, {
    startY: 110,
    head: [["Metric", "Value"]],
    body: [
      ["Rows", String(report.overview.rowCount)],
      ["Columns", String(report.overview.columnCount)],
      ["Missing cells", String(report.overview.totalMissing)],
      ["Duplicate rows", String(report.overview.duplicateRows)],
      ["Numeric columns", String(report.overview.numericColumns.length)],
      ["Categorical columns", String(report.overview.categoricalColumns.length)],
    ],
    theme: "striped",
    headStyles: { fillColor: [88, 60, 220] },
  });

  if (report.numeric.length) {
    autoTable(doc, {
      startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20,
      head: [["Column", "Mean", "Median", "Stdev", "Min", "Max", "Outliers"]],
      body: report.numeric.map((n) => [
        n.column, fmt(n.mean), fmt(n.median), fmt(n.stdev), fmt(n.min), fmt(n.max), String(n.outliers),
      ]),
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 160, 190] },
    });
  }

  if (report.model) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Machine Learning Model", 40, 50);
    const m = report.model;
    const rows: string[][] = [["Algorithm", m.algorithm]];
    if (m.algorithm === "linear-regression") {
      rows.push(["Target", m.target], ["R²", fmt(m.r2)], ["RMSE", fmt(m.rmse)], ["MAE", fmt(m.mae)]);
    } else if (m.algorithm === "knn") {
      rows.push(
        ["Target", m.target],
        ["Accuracy", fmt(m.accuracy)],
        ["Precision", fmt(m.precision)],
        ["Recall", fmt(m.recall)],
        ["F1", fmt(m.f1)],
      );
    } else if (m.algorithm === "kmeans") {
      rows.push(["k", String(m.k)], ["Inertia", fmt(m.inertia)], ["Silhouette", fmt(m.silhouette)]);
    }
    autoTable(doc, { startY: 70, head: [["Metric", "Value"]], body: rows, theme: "striped" });
  }

  for (const el of chartElements) {
    try {
      const dataUrl = await toPng(el, { pixelRatio: 2, cacheBust: true });
      doc.addPage();
      const img = new Image();
      img.src = dataUrl;
      await new Promise((res) => (img.onload = () => res(null)));
      const ratio = img.height / img.width;
      const w = pageWidth - 80;
      const h = w * ratio;
      doc.setFontSize(12);
      doc.text("Chart", 40, 40);
      doc.addImage(dataUrl, "PNG", 40, 60, w, h);
    } catch {
      // skip failed chart
    }
  }

  doc.save(filename);
};

export const exportElementAsPng = async (el: HTMLElement, filename: string): Promise<void> => {
  const dataUrl = await toPng(el, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" });
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  download(blob, filename, "image/png");
};
