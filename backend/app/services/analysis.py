from __future__ import annotations

from pathlib import Path

import pandas as pd


def load_dataframe(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, low_memory=False)


def dataframe_overview(df: pd.DataFrame) -> dict:
    numeric = df.select_dtypes(include="number").columns.tolist()
    categorical = df.select_dtypes(exclude=["number", "datetime"]).columns.tolist()
    return {
        "rows": int(df.shape[0]),
        "columns": int(df.shape[1]),
        "numeric_columns": numeric,
        "categorical_columns": categorical,
        "missing_cells": int(df.isna().sum().sum()),
        "duplicate_rows": int(df.duplicated().sum()),
        "memory_bytes": int(df.memory_usage(deep=True).sum()),
    }


def numeric_summary(df: pd.DataFrame) -> list[dict]:
    numeric = df.select_dtypes(include="number")
    out: list[dict] = []
    for col in numeric.columns:
        series = numeric[col].dropna()
        if series.empty:
            continue
        q1, q3 = series.quantile([0.25, 0.75])
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        outliers = int(((series < lower) | (series > upper)).sum())
        out.append(
            {
                "column": col,
                "count": int(series.size),
                "missing": int(numeric[col].isna().sum()),
                "mean": float(series.mean()),
                "median": float(series.median()),
                "stdev": float(series.std(ddof=1)) if series.size > 1 else 0.0,
                "min": float(series.min()),
                "max": float(series.max()),
                "q1": float(q1),
                "q3": float(q3),
                "skewness": float(series.skew()) if series.size > 2 else 0.0,
                "kurtosis": float(series.kurt()) if series.size > 3 else 0.0,
                "outliers": outliers,
            }
        )
    return out


def categorical_summary(df: pd.DataFrame, top_n: int = 10) -> list[dict]:
    categorical = df.select_dtypes(exclude=["number", "datetime"])
    out: list[dict] = []
    for col in categorical.columns:
        series = categorical[col].astype("string")
        counts = series.value_counts().head(top_n)
        out.append(
            {
                "column": col,
                "unique": int(series.nunique(dropna=True)),
                "missing": int(series.isna().sum()),
                "top": [{"value": str(idx), "count": int(cnt)} for idx, cnt in counts.items()],
            }
        )
    return out


def correlation_matrix(df: pd.DataFrame) -> dict:
    numeric = df.select_dtypes(include="number")
    if numeric.shape[1] < 2:
        return {"columns": numeric.columns.tolist(), "values": []}
    corr = numeric.corr(numeric_only=True).fillna(0.0)
    return {"columns": corr.columns.tolist(), "values": corr.values.tolist()}
