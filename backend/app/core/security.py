from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Deque

from fastapi import HTTPException, Request, status

from app.core.config import get_settings

_window: dict[str, Deque[float]] = defaultdict(deque)


async def rate_limit(request: Request) -> None:
    """Sliding-window in-memory limiter keyed on client IP."""
    settings = get_settings()
    limit = settings.rate_limit_per_minute
    key = request.client.host if request.client else "unknown"
    now = time.monotonic()
    bucket = _window[key]
    while bucket and now - bucket[0] > 60:
        bucket.popleft()
    if len(bucket) >= limit:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Rate limit exceeded.")
    bucket.append(now)
