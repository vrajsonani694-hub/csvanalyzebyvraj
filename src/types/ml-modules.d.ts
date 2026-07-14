declare module "ml-regression" {
  export class SimpleLinearRegression {
    constructor(x: number[], y: number[]);
    slope: number;
    intercept: number;
    predict(x: number): number;
  }
  export class MultivariateLinearRegression {
    constructor(x: number[][], y: number[][]);
    weights: number[][];
    predict(x: number[]): number[];
  }
}

declare module "ml-kmeans" {
  export interface KMeansResult {
    clusters: number[];
    centroids: number[][];
    iterations: number;
    converged: boolean;
  }
  export function kmeans(
    data: number[][],
    k: number,
    options?: { seed?: number; maxIterations?: number; initialization?: string },
  ): KMeansResult;
}
