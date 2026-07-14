from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import Upload, get_db
from app.schemas import AnalysisResponse
from app.services.analysis import (
    categorical_summary,
    correlation_matrix,
    dataframe_overview,
    load_dataframe,
    numeric_summary,
)

router = APIRouter(prefix="/analysis", tags=["analysis"])


def _load_upload(upload_id: str, db: Session):
    record = db.get(Upload, upload_id)
    if not record:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Upload not found.")
    path = Path(record.path)
    if not path.exists():
        raise HTTPException(status.HTTP_410_GONE, "Upload file is missing on disk.")
    return record, load_dataframe(path)


@router.get("/{upload_id}", response_model=AnalysisResponse)
def analyze(upload_id: str, db: Session = Depends(get_db)) -> AnalysisResponse:
    _, df = _load_upload(upload_id, db)
    return AnalysisResponse(
        overview=dataframe_overview(df),
        numeric=numeric_summary(df),
        categorical=categorical_summary(df),
        correlation=correlation_matrix(df),
    )
