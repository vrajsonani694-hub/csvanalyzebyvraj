from __future__ import annotations

import io

from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


def test_upload_and_analyze(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("ACAP_UPLOAD_DIR", str(tmp_path / "uploads"))
    monkeypatch.setenv("ACAP_DATABASE_URL", f"sqlite:///{tmp_path / 'db.sqlite'}")
    from app.core.config import get_settings

    get_settings.cache_clear()

    csv = b"a,b\n1,2\n3,4\n5,6\n"
    with TestClient(app) as client:
        resp = client.post("/api/uploads", files={"file": ("t.csv", io.BytesIO(csv), "text/csv")})
        assert resp.status_code == 201
        upload_id = resp.json()["id"]
        analysis = client.get(f"/api/analysis/{upload_id}")
        assert analysis.status_code == 200
        body = analysis.json()
        assert body["overview"]["rows"] == 3
        assert any(n["column"] == "a" for n in body["numeric"])
