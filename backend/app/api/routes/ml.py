from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import SavedModel, Upload, get_db
from app.schemas import TrainRequest, TrainResponse
from app.services.analysis import load_dataframe
from app.services.ml import train_classification, train_clustering, train_regression

router = APIRouter(prefix="/ml", tags=["ml"])


@router.post("/train", response_model=TrainResponse, status_code=status.HTTP_201_CREATED)
def train(payload: TrainRequest, db: Session = Depends(get_db)) -> TrainResponse:
    upload = db.get(Upload, payload.upload_id)
    if not upload:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Upload not found.")
    df = load_dataframe(Path(upload.path))
    out_dir = get_settings().upload_dir / "models" / payload.upload_id
    out_dir.mkdir(parents=True, exist_ok=True)

    if payload.task == "regression":
        if not payload.target:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "target is required for regression.")
        result = train_regression(df, payload.target, payload.features, payload.algorithm, out_dir)
    elif payload.task == "classification":
        if not payload.target:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "target is required for classification.")
        result = train_classification(df, payload.target, payload.features, payload.algorithm, out_dir)
    else:
        result = train_clustering(df, payload.features, payload.k, out_dir)

    model_id = uuid.uuid4().hex
    record = SavedModel(
        id=model_id,
        upload_id=payload.upload_id,
        algorithm=result.algorithm,
        metrics=result.metrics,
        path=str(result.artifact_path),
    )
    db.add(record)
    db.commit()
    return TrainResponse(model_id=model_id, algorithm=result.algorithm, metrics=result.metrics)


@router.get("/models/{upload_id}")
def list_models(upload_id: str, db: Session = Depends(get_db)) -> list[dict]:
    rows = (
        db.query(SavedModel)
        .filter(SavedModel.upload_id == upload_id)
        .order_by(SavedModel.created_at.desc())
        .all()
    )
    return [
        {
            "model_id": r.id,
            "algorithm": r.algorithm,
            "metrics": r.metrics,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
