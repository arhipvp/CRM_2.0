"""Utilities for working with task priorities."""
from __future__ import annotations

from typing import Any

ALLOWED_PRIORITIES = ("low", "normal", "high")
DEFAULT_PRIORITY = "normal"
_PRIORITY_ALIASES = {
    "urgent": "high",
    "highest": "high",
    "medium": "normal",
    "med": "normal",
    "mid": "normal",
    "lowest": "low",
}


def normalize_priority(priority: Any) -> str:
    """Normalize priority value to one of the allowed levels."""
    if isinstance(priority, str):
        normalized = priority.strip().lower()
        if normalized in ALLOWED_PRIORITIES:
            return normalized
        alias = _PRIORITY_ALIASES.get(normalized)
        if alias:
            return alias
    return DEFAULT_PRIORITY


__all__ = [
    "ALLOWED_PRIORITIES",
    "DEFAULT_PRIORITY",
    "normalize_priority",
]
