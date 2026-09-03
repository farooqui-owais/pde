"""Business-rule validation for document entry workflow completion."""

from __future__ import annotations

from fastapi import HTTPException

from . import models


def validate_entry_ready_for_completion(entry: models.DocumentEntry) -> None:
    """Ensure mandatory PDE steps are filled before marking an entry SUBMITTED."""
    errors: list[str] = []

    if not entry.article_type_id:
        errors.append("Article type is required")
    if entry.market_value is None:
        errors.append("Market value is required")
    if entry.consideration_amount is None:
        errors.append("Consideration amount is required")
    if entry.number_of_pages is not None and entry.number_of_pages < 1:
        errors.append("Number of pages must be at least 1")

    if not entry.properties:
        errors.append("At least one property must be saved")
    if not entry.parties:
        errors.append("At least one party must be saved")
    if not entry.identifications:
        errors.append("At least one witness / identification must be saved")

    if errors:
        raise HTTPException(
            status_code=400,
            detail={"message": "Entry is incomplete and cannot be submitted", "errors": errors},
        )
