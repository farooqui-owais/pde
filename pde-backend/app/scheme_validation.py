"""Scheme module validation constants and helpers."""

from __future__ import annotations

from fastapi import HTTPException

from . import models_scheme

MANDATORY_SCHEME_DOCUMENT_TYPES = (
    "7/12 Extract / Index II",
    "MahaRERA Certificate",
    "Approved Layout / Sanction Plan",
    "Title & Search Certificate",
)


def validate_scheme_submission_readiness(scheme: models_scheme.Scheme) -> list[str]:
    """Return a list of human-readable errors blocking scheme submission."""
    errors: list[str] = []

    if not scheme.seller_parties:
        errors.append("At least one Seller Party is required.")

    if not scheme.identifier:
        errors.append("Scheme Identifier details are required.")

    active_docs = [d for d in scheme.documents if d.is_active]
    uploaded_types = {d.document_type for d in active_docs}
    missing_docs = [t for t in MANDATORY_SCHEME_DOCUMENT_TYPES if t not in uploaded_types]
    if missing_docs:
        errors.append(
            "Missing mandatory documents: " + ", ".join(missing_docs)
        )

    if not scheme.templates:
        errors.append("At least one Template must be created.")

    return errors


def raise_if_scheme_not_submittable(scheme: models_scheme.Scheme) -> None:
    errors = validate_scheme_submission_readiness(scheme)
    if errors:
        raise HTTPException(
            status_code=422,
            detail={"message": "Submission prerequisites not met", "errors": errors},
        )
