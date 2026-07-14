from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class UploadResponse(BaseModel):
    id: str
    name: str
    size: int
    rows: int
    columns: int
    created_at: datetime


class AnalysisResponse(BaseModel):
    overview: dict[str, Any]
    numeric: list[dict[str, Any]]
    categorical: list[dict[str, Any]]
    correlation: dict[str, Any]


class TrainRequest(BaseModel):
    upload_id: str
    task: str = Field(pattern="^(regression|classification|clustering)$")
    algorithm: str = "linear"
    target: str | None = None
    features: list[str]
    k: int = Field(default=3, ge=2, le=20)


class TrainResponse(BaseModel):
    model_id: str
    algorithm: str
    metrics: dict[str, Any]


class ReportRequest(BaseModel):
    upload_id: str
    include_charts: bool = True
