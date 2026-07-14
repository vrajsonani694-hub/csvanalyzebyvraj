from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    silhouette_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler


@dataclass
class TrainedModel:
    algorithm: str
    metrics: dict
    artifact_path: Path


def _numeric_frame(df: pd.DataFrame, features: list[str]) -> pd.DataFrame:
    frame = df[features].apply(pd.to_numeric, errors="coerce")
    frame = frame.dropna()
    if frame.empty:
        raise ValueError("No numeric rows remain after dropping missing values.")
    return frame


def train_regression(
    df: pd.DataFrame, target: str, features: list[str], algorithm: str, out_dir: Path
) -> TrainedModel:
    y = pd.to_numeric(df[target], errors="coerce")
    X = _numeric_frame(df, features).loc[y.dropna().index]
    y = y.loc[X.index]
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    X_train, X_test, y_train, y_test = train_test_split(Xs, y, test_size=0.2, random_state=42)
    if algorithm == "random_forest":
        model = RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=-1)
    else:
        model = LinearRegression()
    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    metrics = {
        "r2": float(r2_score(y_test, preds)),
        "rmse": float(np.sqrt(mean_squared_error(y_test, preds))),
        "mae": float(mean_absolute_error(y_test, preds)),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
    }
    if hasattr(model, "feature_importances_"):
        metrics["feature_importance"] = dict(zip(features, model.feature_importances_.tolist()))
    artifact = out_dir / f"regression-{algorithm}.joblib"
    joblib.dump({"model": model, "scaler": scaler, "features": features, "target": target}, artifact)
    return TrainedModel(algorithm=f"regression:{algorithm}", metrics=metrics, artifact_path=artifact)


def train_classification(
    df: pd.DataFrame, target: str, features: list[str], algorithm: str, out_dir: Path
) -> TrainedModel:
    frame = df[[*features, target]].dropna()
    if frame.empty:
        raise ValueError("No usable rows after dropping missing values.")
    y = frame[target].astype("string")
    X = frame[features].apply(pd.to_numeric, errors="coerce").fillna(0.0)
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    X_train, X_test, y_train, y_test = train_test_split(
        Xs, y, test_size=0.2, random_state=42, stratify=y if y.nunique() > 1 else None
    )
    if algorithm == "random_forest":
        model = RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1)
    else:
        model = LogisticRegression(max_iter=1000, multi_class="auto")
    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    metrics = {
        "accuracy": float(accuracy_score(y_test, preds)),
        "precision": float(precision_score(y_test, preds, average="macro", zero_division=0)),
        "recall": float(recall_score(y_test, preds, average="macro", zero_division=0)),
        "f1": float(f1_score(y_test, preds, average="macro", zero_division=0)),
        "labels": sorted(y.unique().tolist()),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
    }
    if hasattr(model, "feature_importances_"):
        metrics["feature_importance"] = dict(zip(features, model.feature_importances_.tolist()))
    artifact = out_dir / f"classification-{algorithm}.joblib"
    joblib.dump({"model": model, "scaler": scaler, "features": features, "target": target}, artifact)
    return TrainedModel(algorithm=f"classification:{algorithm}", metrics=metrics, artifact_path=artifact)


def train_clustering(
    df: pd.DataFrame, features: list[str], k: int, out_dir: Path
) -> TrainedModel:
    X = _numeric_frame(df, features)
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    model = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = model.fit_predict(Xs)
    metrics = {
        "k": int(k),
        "inertia": float(model.inertia_),
        "silhouette": float(silhouette_score(Xs, labels)) if len(set(labels)) > 1 else 0.0,
        "cluster_sizes": {int(c): int((labels == c).sum()) for c in set(labels)},
    }
    artifact = out_dir / f"kmeans-k{k}.joblib"
    joblib.dump({"model": model, "scaler": scaler, "features": features}, artifact)
    return TrainedModel(algorithm=f"clustering:kmeans", metrics=metrics, artifact_path=artifact)
