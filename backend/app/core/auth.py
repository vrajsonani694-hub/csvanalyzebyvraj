from __future__ import annotations

import re
import secrets

from fastapi import Header, HTTPException, Response, status

_TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{16,128}$")
OWNER_HEADER = "X-Owner-Token"


def require_owner(
    response: Response,
    x_owner_token: str | None = Header(default=None, alias=OWNER_HEADER),
) -> str:
    """Return the caller's owner token, minting one on first contact.

    This is a lightweight per-browser identity used to scope all resources.
    Clients must persist the returned token and send it on every request.
    """
    if x_owner_token is None or x_owner_token == "":
        token = secrets.token_urlsafe(24)
        response.headers[OWNER_HEADER] = token
        return token
    if not _TOKEN_RE.match(x_owner_token):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid owner token.")
    return x_owner_token
