"""Shared field validators used by Pydantic schemas and router business rules."""

from __future__ import annotations

import re
from decimal import Decimal
from typing import Optional

PAN_PATTERN = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
MOBILE_PATTERN = re.compile(r"^[6-9]\d{9}$")
PIN_CODE_PATTERN = re.compile(r"^\d{6}$")
USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_]{3,50}$")
TOKEN_NUMBER_PATTERN = re.compile(r"^\d{11}$")
AADHAAR_PATTERN = re.compile(r"^\d{12}$")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SLOT_TIME_PATTERN = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")

DRAFT_DOCUMENT_CATEGORIES = (
    "Digital Document (without Execution Page)",
    "Digital Execution Page (without sign)",
)
OFFICE_TYPES = ("Regular Office", "Model Office", "Regular")
EXECUTION_CAPTURE_TYPES = ("PHOTO", "FINGERPRINT", "SIGNATURE_PAD")

MIN_PASSWORD_LENGTH = 8
MIN_AGE = 1
MAX_AGE = 120


def normalize_pan(value: str) -> str:
    return value.strip().upper()


def validate_pan_optional(value: Optional[str]) -> Optional[str]:
    if value is None or not str(value).strip():
        return None
    normalized = normalize_pan(str(value))
    if not PAN_PATTERN.match(normalized):
        raise ValueError("PAN must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)")
    return normalized


def validate_mobile_optional(value: Optional[str]) -> Optional[str]:
    if value is None or not str(value).strip():
        return None
    normalized = str(value).strip()
    if not MOBILE_PATTERN.match(normalized):
        raise ValueError("Mobile number must be 10 digits starting with 6-9")
    return normalized


def validate_mobile_required(value: str) -> str:
    result = validate_mobile_optional(value)
    if not result:
        raise ValueError("Mobile number is required")
    return result


def validate_pin_code(value: str) -> str:
    normalized = str(value).strip()
    if not PIN_CODE_PATTERN.match(normalized):
        raise ValueError("Pin code must be exactly 6 digits")
    return normalized


def validate_password(value: str) -> str:
    if len(value) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    return value


def validate_username(value: str) -> str:
    normalized = str(value).strip()
    if not USERNAME_PATTERN.match(normalized):
        raise ValueError("Username must be 3-50 characters (letters, numbers, underscore)")
    return normalized


def validate_age_optional(value: Optional[int]) -> Optional[int]:
    if value is None:
        return None
    if value < MIN_AGE or value > MAX_AGE:
        raise ValueError(f"Age must be between {MIN_AGE} and {MAX_AGE}")
    return value


def validate_token_number(value: str) -> str:
    normalized = str(value).strip()
    if not TOKEN_NUMBER_PATTERN.match(normalized):
        raise ValueError("Token number must be exactly 11 digits")
    return normalized


def validate_positive_decimal(value: Optional[Decimal], field_name: str = "Amount") -> Optional[Decimal]:
    if value is None:
        return None
    if value < 0:
        raise ValueError(f"{field_name} cannot be negative")
    return value


def validate_non_empty_str(value: Optional[str], field_name: str) -> str:
    if value is None or not str(value).strip():
        raise ValueError(f"{field_name} is required")
    return str(value).strip()


def validate_aadhaar_optional(value: Optional[str]) -> Optional[str]:
    if value is None or not str(value).strip():
        return None
    normalized = str(value).strip()
    if not AADHAAR_PATTERN.match(normalized):
        raise ValueError("Aadhaar number must be exactly 12 digits")
    return normalized


def validate_email_optional(value: Optional[str]) -> Optional[str]:
    if value is None or not str(value).strip():
        return None
    normalized = str(value).strip()
    if not EMAIL_PATTERN.match(normalized):
        raise ValueError("Invalid email address")
    return normalized


def has_bilingual_name(
    first_en: Optional[str],
    first_mr: Optional[str],
    surname_en: Optional[str] = None,
    surname_mr: Optional[str] = None,
) -> bool:
    return bool(
        (first_en and first_en.strip())
        or (first_mr and first_mr.strip())
        or (surname_en and surname_en.strip())
        or (surname_mr and surname_mr.strip())
    )


def validate_email_optional(value: Optional[str]) -> Optional[str]:
    """Validate an optional email address. Returns the normalized (trimmed,
    lower-cased) email or None when blank. Raises ValueError on bad format."""
    if value is None or not str(value).strip():
        return None
    normalized = str(value).strip().lower()
    if not EMAIL_PATTERN.match(normalized):
        raise ValueError("Invalid email address")
    return normalized


def validate_draft_category(value: str) -> str:
    """Ensure a digital-submission draft category is one of the allowed ones."""
    normalized = str(value).strip()
    if normalized not in DRAFT_DOCUMENT_CATEGORIES:
        raise ValueError(
            "Invalid draft document category. Allowed: "
            + ", ".join(DRAFT_DOCUMENT_CATEGORIES)
        )
    return normalized


def validate_office_type(value: str) -> str:
    """Ensure an office type is one of the known values."""
    normalized = str(value).strip()
    if normalized not in OFFICE_TYPES:
        raise ValueError(
            "Invalid office type. Allowed: " + ", ".join(dict.fromkeys(OFFICE_TYPES))
        )
    return normalized


def validate_slot_time(value: str) -> str:
    """Validate a slot time string is in 24h HH:MM format."""
    normalized = str(value).strip()
    if not SLOT_TIME_PATTERN.match(normalized):
        raise ValueError("Slot time must be in HH:MM 24-hour format (e.g. 09:30)")
    return normalized


def validate_capture_type(value: str) -> str:
    """Ensure an execution capture type is one of the supported kinds."""
    normalized = str(value).strip().upper()
    if normalized not in EXECUTION_CAPTURE_TYPES:
        raise ValueError(
            "Invalid capture type. Allowed: " + ", ".join(EXECUTION_CAPTURE_TYPES)
        )
    return normalized
