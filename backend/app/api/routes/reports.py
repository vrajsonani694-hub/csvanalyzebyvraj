from __future__ import annotations

import io
import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import Upload, get_db
from app.services.analysis import (
    categorical_summary,
    dataframe_overview,
    load_dataframe,
    numeric_summary,
)

router = APIRouter(prefix="/reports", tags=["reports"])


def _payload(upload_id: str, db: Session) -> tuple[Upload, dict]:
    record = db.get(Upload, upload_id)
    if not record:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Upload not found.")
    df = load_dataframe(Path(record.path))
    return record, {
        "dataset": {"name": record.name, "rows": int(df.shape[0]), "columns": int(df.shape[1])},
        "overview": dataframe_overview(df),
        "numeric": numeric_summary(df),
        "categorical": categorical_summary(df),
    }


@router.get("/{upload_id}/json")
def report_json(upload_id: str, db: Session = Depends(get_db)) -> Response:
    _, payload = _payload(upload_id, db)
    return Response(json.dumps(payload, indent=2), media_type="application/json")


@router.get("/{upload_id}/excel")
def report_excel(upload_id: str, db: Session = Depends(get_db)) -> StreamingResponse:
    record, payload = _payload(upload_id, db)
    import pandas as pd

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame([payload["overview"]]).to_excel(writer, sheet_name="Overview", index=False)
        pd.DataFrame(payload["numeric"]).to_excel(writer, sheet_name="Numeric", index=False)
        pd.DataFrame(
            [
                {"column": c["column"], "unique": c["unique"], "missing": c["missing"]}
                for c in payload["categorical"]
            ]
        ).to_excel(writer, sheet_name="Categorical", index=False)
    buffer.seek(0)
    filename = record.name.rsplit(".", 1)[0] + ".report.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
