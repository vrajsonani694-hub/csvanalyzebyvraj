from __future__ import annotations

import logging
import uuid
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.auth import require_owner
from app.core.config import get_settings
from app.core.security import rate_limit
from app.db.session import Upload, get_db
from app.schemas import UploadResponse

log = logging.getLogger(__name__)
router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("", response_model=UploadResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(rate_limit)])
async def upload_csv(
    file: UploadFile,
    db: Session = Depends(get_db),
    owner_id: str = Depends(require_owner),
) -> UploadResponse:
    settings = get_settings()
    if not file.filename or Path(file.filename).suffix.lower() not in settings.allowed_extensions:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only .csv files are accepted.")

    upload_id = uuid.uuid4().hex
    target = settings.upload_dir / f"{upload_id}.csv"
    total = 0
    with target.open("wb") as dst:
        while chunk := await file.read(1024 * 1024):
            total += len(chunk)
            if total > settings.max_upload_bytes:
                dst.close()
                target.unlink(missing_ok=True)
                raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File exceeds size limit.")
            dst.write(chunk)

    try:
        df = pd.read_csv(target, nrows=1)
        head_cols = len(df.columns)
        with target.open("rb") as fp:
            rows = max(sum(1 for _ in fp) - 1, 0)
    except Exception as exc:  # noqa: BLE001
        target.unlink(missing_ok=True)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid CSV: {exc}") from exc

    record = Upload(
        id=upload_id,
        owner_id=owner_id,
        name=file.filename,
        size=total,
        rows=rows,
        columns=head_cols,
        path=str(target),
    )
    db.add(record)
    db.commit()
    log.info("upload.stored id=%s rows=%s cols=%s", upload_id, rows, head_cols)
    return UploadResponse(
        id=record.id,
        name=record.name,
        size=record.size,
        rows=record.rows,
        columns=record.columns,
        created_at=record.created_at,
    )


@router.get("", response_model=list[UploadResponse])
def list_uploads(
    db: Session = Depends(get_db),
    owner_id: str = Depends(require_owner),
) -> list[UploadResponse]:
    rows = (
        db.query(Upload)
        .filter(Upload.owner_id == owner_id)
        .order_by(Upload.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        UploadResponse(
            id=r.id, name=r.name, size=r.size, rows=r.rows, columns=r.columns, created_at=r.created_at
        )
        for r in rows
    ]


@router.delete("/{upload_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_upload(
    upload_id: str,
    db: Session = Depends(get_db),
    owner_id: str = Depends(require_owner),
) -> None:
    record = db.get(Upload, upload_id)
    if not record or record.owner_id != owner_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Upload not found.")
    Path(record.path).unlink(missing_ok=True)
    db.delete(record)
    db.commit()
