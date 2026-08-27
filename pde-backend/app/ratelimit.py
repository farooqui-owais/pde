"""Lightweight in-memory rate limiter (no external dependency).

The Reusable prompt calls this out as SlowAPI in the reference stack. To keep
this lighter-path refactor shipping without forcing a new pip dependency, we
provide a small dependency-based limiter. It can be swapped for SlowAPI later
without touching callers:
    from slowapi import Limiter
    limiter = Limiter(get_remote_address)  # then @limiter.limit("8/minute")
"""
from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Callable, Optional

from fastapi import HTTPException, Request, status


class InMemoryRateLimiter:
    """Sliding-window limiter keyed by client IP + (optional) bucket name."""

    def __init__(self) -> None:
        # key -> (timestamp deque)
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def _window(self, key: str, max_calls: int, window: float) -> bool:
        now = time.time()
        dq = self._hits[key]
        # Drop entries older than the window.
        while dq and dq[0] <= now - window:
            dq.popleft()
        if len(dq) >= max_calls:
            return False
        dq.append(now)
        return True

    def dependency(
        self,
        max_calls: int,
        window_seconds: float,
        name: Optional[str] = None,
    ) -> Callable[[Request], None]:
        bucket = name or "default"

        def check(request: Request) -> None:
            client = request.client.host if request.client else "unknown"
            key = f"{bucket}:{client}"
            if not self._window(key, max_calls, window_seconds):
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Please try again later.",
                )

        return check