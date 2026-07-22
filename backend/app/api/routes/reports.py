from __future__ import annotations

import io
import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session

from app.core.auth import require_owner
from app.db.session import Upload, get_db
from app.services.analysis import (
    categorical_summary,
    dataframe_overview,
    load_dataframe,
    numeric_summary,
)

router = APIRouter(prefix="/reports", tags=["reports"])

_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _sanitize_cell(value: Any) -> Any:
    """Neutralize spreadsheet formula injection in string cells."""
    if isinstance(value, str) and value and value[0] in _FORMULA_PREFIXES:
        return "'" + value
    return value


def _sanitize_records(records: list[dict]) -> list[dict]:
    return [{_sanitize_cell(k): _sanitize_cell(v) for k, v in row.items()} for row in records]


def _payload(upload_id: str, owner_id: str, db: Session) -> tuple[Upload, dict]:
    record = db.get(Upload, upload_id)
    if not record or record.owner_id != owner_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Upload not found.")
    df = load_dataframe(Path(record.path))
    return record, {
        "dataset": {"name": record.name, "rows": int(df.shape[0]), "columns": int(df.shape[1])},
        "overview": dataframe_overview(df),
        "numeric": numeric_summary(df),
        "categorical": categorical_summary(df),
    }


@router.get("/{upload_id}/json")
def report_json(
    upload_id: str,
    db: Session = Depends(get_db),
    owner_id: str = Depends(require_owner),
) -> Response:
    _, payload = _payload(upload_id, owner_id, db)
    return Response(json.dumps(payload, indent=2), media_type="application/json")


@router.get("/{upload_id}/excel")
def report_excel(
    upload_id: str,
    db: Session = Depends(get_db),
    owner_id: str = Depends(require_owner),
) -> StreamingResponse:
    record, payload = _payload(upload_id, owner_id, db)
    import pandas as pd

    overview_row = {_sanitize_cell(k): _sanitize_cell(v) for k, v in payload["overview"].items()}
    numeric_rows = _sanitize_records(payload["numeric"])
    categorical_rows = _sanitize_records(
        [
            {"column": c["column"], "unique": c["unique"], "missing": c["missing"]}
            for c in payload["categorical"]
        ]
    )

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        pd.DataFrame([overview_row]).to_excel(writer, sheet_name="Overview", index=False)
        pd.DataFrame(numeric_rows).to_excel(writer, sheet_name="Numeric", index=False)
        pd.DataFrame(categorical_rows).to_excel(writer, sheet_name="Categorical", index=False)
    buffer.seek(0)
    safe_name = _sanitize_cell(record.name.rsplit(".", 1)[0])
    filename = f"{safe_name}.report.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
