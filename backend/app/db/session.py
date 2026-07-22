from __future__ import annotations

from datetime import datetime
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker, mapped_column, Mapped
from sqlalchemy import String, Integer, DateTime, JSON

from app.core.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
    future=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, class_=Session)


class Base(DeclarativeBase):
    pass


class Upload(Base):
    __tablename__ = "uploads"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(128), index=True)
    name: Mapped[str] = mapped_column(String(255))
    size: Mapped[int] = mapped_column(Integer)
    rows: Mapped[int] = mapped_column(Integer, default=0)
    columns: Mapped[int] = mapped_column(Integer, default=0)
    path: Mapped[str] = mapped_column(String(1024))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SavedModel(Base):
    __tablename__ = "models"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(128), index=True)
    upload_id: Mapped[str] = mapped_column(String(64))
    algorithm: Mapped[str] = mapped_column(String(64))
    metrics: Mapped[dict] = mapped_column(JSON)
    path: Mapped[str] = mapped_column(String(1024))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


def _ensure_owner_column(table: str) -> None:
    from sqlalchemy import text

    with engine.begin() as conn:
        cols = [r[1] for r in conn.exec_driver_sql(f"PRAGMA table_info({table})").fetchall()]
        if "owner_id" not in cols:
            conn.exec_driver_sql(
                f"ALTER TABLE {table} ADD COLUMN owner_id VARCHAR(128) NOT NULL DEFAULT ''"
            )
            conn.exec_driver_sql(f"CREATE INDEX IF NOT EXISTS ix_{table}_owner_id ON {table}(owner_id)")


def init_db() -> None:
    Base.metadata.create_all(engine)
    if settings.database_url.startswith("sqlite"):
        _ensure_owner_column("uploads")
        _ensure_owner_column("models")


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
