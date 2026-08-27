"""Lightweight in-memory stores for the forgot-password / forgot-username flows.

Mirrors the style of `ratelimit.InMemoryRateLimiter`: no external dependency
(no Redis), fine for a single-process demo deployment. Swap for a Redis-backed
store behind the same two methods (`issue` / `consume`) before running this
with multiple workers or processes, since state here does not survive a
restart and is not shared across workers.
"""
from __future__ import annotations

import secrets
import time
from typing import Optional


class ExpiringTokenStore:
    """token -> (payload dict, expiry timestamp). One-time use: `consume`
    deletes the entry so a token can't be replayed."""

    def __init__(self, ttl_seconds: float) -> None:
        self._ttl = ttl_seconds
        self._entries: dict[str, tuple[dict, float]] = {}

    def issue(self, payload: dict, length: int = 32) -> str:
        token = secrets.token_urlsafe(length)
        self._entries[token] = (payload, time.time() + self._ttl)
        return token

    def peek(self, token: str) -> Optional[dict]:
        entry = self._entries.get(token)
        if not entry:
            return None
        payload, expiry = entry
        if time.time() > expiry:
            del self._entries[token]
            return None
        return payload

    def consume(self, token: str) -> Optional[dict]:
        payload = self.peek(token)
        if payload is not None:
            del self._entries[token]
        return payload


def generate_otp() -> str:
    """6-digit numeric OTP. Zero-padded so it's always 6 characters."""
    return f"{secrets.randbelow(1_000_000):06d}"
