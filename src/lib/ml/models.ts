import { SimpleLinearRegression, MultivariateLinearRegression } from "ml-regression";
import { kmeans } from "ml-kmeans";
import type { Dataset, Row } from "@/lib/csv/parser";
import { numericValues } from "@/lib/analysis/statistics";

export type TaskType = "regression" | "classification" | "clustering";

export interface TaskRecommendation {
  task: TaskType;
  reason: string;
  targetCandidates: string[];
}

export const recommendTask = (dataset: Dataset, target?: string): TaskRecommendation => {
  const numericCols = dataset.columns.filter((c) => c.kind === "number" || c.kind === "integer");
  const categorical = dataset.columns.filter((c) => c.kind === "string" || c.kind === "boolean");
  if (!target) {
    if (numericCols.length >= 2 && categorical.length === 0) {
      return {
        task: "clustering",
        reason: "Only numeric features detected — clustering can uncover structure.",
        targetCandidates: [],
      };
    }
    return {
      task: numericCols.length ? "regression" : "classification",
      reason: "Pick a target column to train a supervised model.",
      targetCandidates: dataset.columns.map((c) => c.name),
    };
  }
  const col = dataset.columns.find((c) => c.name === target);
  if (!col) throw new Error(`Unknown target column: ${target}`);
  if (col.kind === "number" || col.kind === "integer") {
    if (col.uniqueCount <= Math.max(10, dataset.rows.length * 0.05) && col.kind === "integer") {
      return {
        task: "classification",
        reason: `Target "${target}" has ${col.uniqueCount} discrete values — treating as classification.`,
        targetCandidates: [],
      };
    }
    return {
      task: "regression",
      reason: `Numeric target "${target}" — regression is appropriate.`,
      targetCandidates: [],
    };
  }
  return {
    task: "classification",
    reason: `Categorical target "${target}" — classification is appropriate.`,
    targetCandidates: [],
  };
};

export interface FeatureFrame {
  X: number[][];
  y: (number | string)[];
  featureNames: string[];
}

export const buildFrame = (rows: Row[], features: string[], target?: string): FeatureFrame => {
  const X: number[][] = [];
  const y: (number | string)[] = [];
  for (const r of rows) {
    const row: number[] = [];
    let ok = true;
    for (const f of features) {
      const v = r[f];
      if (typeof v === "number" && Number.isFinite(v)) row.push(v);
      else if (typeof v === "boolean") row.push(v ? 1 : 0);
      else {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if (target) {
      const tv = r[target];
      if (tv === null || tv === "") continue;
      y.push(typeof tv === "number" ? tv : String(tv));
    }
    X.push(row);
  }
  return { X, y, featureNames: features };
};

export const trainTestSplit = <T>(
  X: number[][],
  y: T[],
  testRatio = 0.2,
  seed = 42,
): { xTrain: number[][]; xTest: number[][]; yTrain: T[]; yTest: T[] } => {
  const idx = X.map((_, i) => i);
  let s = seed;
  for (let i = idx.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const cut = Math.max(1, Math.floor(idx.length * (1 - testRatio)));
  const trainIdx = idx.slice(0, cut);
  const testIdx = idx.slice(cut);
  return {
    xTrain: trainIdx.map((i) => X[i]),
    xTest: testIdx.map((i) => X[i]),
    yTrain: trainIdx.map((i) => y[i]),
    yTest: testIdx.map((i) => y[i]),
  };
};

const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

export interface RegressionResult {
  algorithm: "linear-regression";
  target: string;
  features: string[];
  coefficients: number[];
  intercept: number;
  rmse: number;
  mae: number;
  r2: number;
  predictions: { actual: number; predicted: number }[];
}

export const trainRegression = (
  dataset: Dataset,
  target: string,
  features: string[],
): RegressionResult => {
  const frame = buildFrame(dataset.rows, features, target);
  const y = frame.y.map((v) => Number(v));
  if (frame.X.length < 5) throw new Error("Need at least 5 usable rows for regression.");
  const { xTrain, xTest, yTrain, yTest } = trainTestSplit(frame.X, y, 0.2);

  let predict: (row: number[]) => number;
  let coefficients: number[];
  let intercept: number;

  if (features.length === 1) {
    const model = new SimpleLinearRegression(
      xTrain.map((r) => r[0]),
      yTrain,
    );
    predict = (row) => model.predict(row[0]);
    coefficients = [model.slope];
    intercept = model.intercept;
  } else {
    const model = new MultivariateLinearRegression(
      xTrain,
      yTrain.map((v) => [v]),
    );
    predict = (row) => model.predict(row)[0];
    coefficients = model.weights.slice(0, -1).map((w) => w[0]);
    intercept = model.weights[model.weights.length - 1][0];
  }

  const predictions = xTest.map((row, i) => ({
    actual: yTest[i],
    predicted: predict(row),
  }));
  const errors = predictions.map((p) => p.predicted - p.actual);
  const rmse = Math.sqrt(mean(errors.map((e) => e * e)));
  const mae = mean(errors.map((e) => Math.abs(e)));
  const yMean = mean(yTest);
  const ssTot = yTest.reduce((s, v) => s + (v - yMean) ** 2, 0);
  const ssRes = errors.reduce((s, e) => s + e * e, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return {
    algorithm: "linear-regression",
    target,
    features,
    coefficients,
    intercept,
    rmse,
    mae,
    r2,
    predictions,
  };
};

export interface ClassificationResult {
  algorithm: "logistic-regression" | "knn";
  target: string;
  features: string[];
  labels: string[];
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  confusion: number[][];
  predictions: { actual: string; predicted: string }[];
}

const knnPredict = (train: number[][], labels: string[], k: number, row: number[]): string => {
  const dists = train.map((tr, i) => {
    let s = 0;
    for (let j = 0; j < tr.length; j++) s += (tr[j] - row[j]) ** 2;
    return { d: s, l: labels[i] };
  });
  dists.sort((a, b) => a.d - b.d);
  const counts = new Map<string, number>();
  for (let i = 0; i < Math.min(k, dists.length); i++)
    counts.set(dists[i].l, (counts.get(dists[i].l) ?? 0) + 1);
  let best = "";
  let max = -1;
  for (const [l, c] of counts) if (c > max) ((max = c), (best = l));
  return best;
};

const standardize = (
  X: number[][],
): { X: number[][]; mean: number[]; std: number[] } => {
  const cols = X[0]?.length ?? 0;
  const means = new Array(cols).fill(0);
  const stds = new Array(cols).fill(0);
  for (let j = 0; j < cols; j++) {
    let s = 0;
    for (const r of X) s += r[j];
    means[j] = s / X.length;
    let v = 0;
    for (const r of X) v += (r[j] - means[j]) ** 2;
    stds[j] = Math.sqrt(v / X.length) || 1;
  }
  return {
    X: X.map((r) => r.map((v, j) => (v - means[j]) / stds[j])),
    mean: means,
    std: stds,
  };
};

export const trainClassification = (
  dataset: Dataset,
  target: string,
  features: string[],
  k = 5,
): ClassificationResult => {
  const frame = buildFrame(dataset.rows, features, target);
  const y = frame.y.map((v) => String(v));
  if (frame.X.length < 5) throw new Error("Need at least 5 usable rows for classification.");
  const { X: Xn } = standardize(frame.X);
  const { xTrain, xTest, yTrain, yTest } = trainTestSplit(Xn, y, 0.2);
  const labels = Array.from(new Set(y)).sort();
  const kEff = Math.min(k, xTrain.length);
  const predictions = xTest.map((row, i) => ({
    actual: yTest[i],
    predicted: knnPredict(xTrain, yTrain, kEff, row),
  }));

  const confusion = Array.from({ length: labels.length }, () =>
    new Array(labels.length).fill(0),
  );
  for (const p of predictions) {
    const a = labels.indexOf(p.actual);
    const q = labels.indexOf(p.predicted);
    if (a >= 0 && q >= 0) confusion[a][q]++;
  }
  const correct = predictions.filter((p) => p.actual === p.predicted).length;
  const accuracy = predictions.length ? correct / predictions.length : 0;

  let precisionSum = 0;
  let recallSum = 0;
  let f1Sum = 0;
  for (let i = 0; i < labels.length; i++) {
    const tp = confusion[i][i];
    const fp = confusion.reduce((s, row, r) => s + (r !== i ? row[i] : 0), 0);
    const fn = confusion[i].reduce((s, v, j) => s + (j !== i ? v : 0), 0);
    const p = tp + fp ? tp / (tp + fp) : 0;
    const r = tp + fn ? tp / (tp + fn) : 0;
    const f = p + r ? (2 * p * r) / (p + r) : 0;
    precisionSum += p;
    recallSum += r;
    f1Sum += f;
  }
  const n = labels.length || 1;
  return {
    algorithm: "knn",
    target,
    features,
    labels,
    accuracy,
    precision: precisionSum / n,
    recall: recallSum / n,
    f1: f1Sum / n,
    confusion,
    predictions,
  };
};

export interface ClusteringResult {
  algorithm: "kmeans";
  features: string[];
  k: number;
  centroids: number[][];
  assignments: number[];
  inertia: number;
  silhouette: number;
}

const silhouette = (X: number[][], labels: number[]): number => {
  if (X.length < 2) return 0;
  const dist = (a: number[], b: number[]) =>
    Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
  const scores: number[] = [];
  for (let i = 0; i < X.length; i++) {
    const own = labels[i];
    const others = new Map<number, number[]>();
    let intraSum = 0;
    let intraN = 0;
    for (let j = 0; j < X.length; j++) {
      if (i === j) continue;
      const d = dist(X[i], X[j]);
      if (labels[j] === own) {
        intraSum += d;
        intraN++;
      } else {
        const arr = others.get(labels[j]) ?? [];
        arr.push(d);
        others.set(labels[j], arr);
      }
    }
    const a = intraN ? intraSum / intraN : 0;
    let b = Infinity;
    for (const arr of others.values()) {
      const m = arr.reduce((s, v) => s + v, 0) / arr.length;
      if (m < b) b = m;
    }
    if (!Number.isFinite(b)) continue;
    scores.push((b - a) / Math.max(a, b));
  }
  return scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
};

export const trainClustering = (
  dataset: Dataset,
  features: string[],
  k = 3,
): ClusteringResult => {
  const frame = buildFrame(dataset.rows, features);
  if (frame.X.length < k) throw new Error(`Need at least ${k} usable rows.`);
  const { X: Xn } = standardize(frame.X);
  const result = kmeans(Xn, k, { seed: 42, maxIterations: 200 });
  const inertia = Xn.reduce((s, row, i) => {
    const c = result.centroids[result.clusters[i]];
    return s + row.reduce((a, v, j) => a + (v - c[j]) ** 2, 0);
  }, 0);
  const sample = Xn.length > 400 ? Xn.slice(0, 400) : Xn;
  const sampleLabels = result.clusters.slice(0, sample.length);
  return {
    algorithm: "kmeans",
    features,
    k,
    centroids: result.centroids,
    assignments: result.clusters,
    inertia,
    silhouette: silhouette(sample, sampleLabels),
  };
};

export type ModelResult = RegressionResult | ClassificationResult | ClusteringResult;
