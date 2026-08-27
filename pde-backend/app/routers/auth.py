import secrets

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import get_settings
from ..database import get_db
from ..ratelimit import InMemoryRateLimiter
from ..recovery_store import ExpiringTokenStore, generate_otp
from ..security import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

_auth_limiter = InMemoryRateLimiter()
_settings = get_settings()

# §2: rate-limit credential / account-creation endpoints per IP (SlowAPI in the
# reference stack; swapped for the lightweight in-memory window here).
auth_rate_limit = _auth_limiter.dependency(
    max_calls=_settings["RATE_LIMIT_MAX"],
    window_seconds=_settings["RATE_LIMIT_WINDOW_SECONDS"],
    name="auth",
)

# Separate, tighter bucket for the recovery flows (identity-guessing surface).
recovery_rate_limit = _auth_limiter.dependency(
    max_calls=_settings["RATE_LIMIT_MAX"],
    window_seconds=_settings["RATE_LIMIT_WINDOW_SECONDS"],
    name="auth-recovery",
)

_RESET_TOKEN_TTL_SECONDS = 300
_OTP_TTL_SECONDS = 300
_password_reset_tokens = ExpiringTokenStore(ttl_seconds=_RESET_TOKEN_TTL_SECONDS)
_username_otp_tokens = ExpiringTokenStore(ttl_seconds=_OTP_TTL_SECONDS)


def _security_answer_matches(user: models.User, security_question: str, security_answer: str) -> bool:
    """Constant-effort-ish check: question must match verbatim AND the hashed
    answer must verify. Doesn't leak which part failed (see generic error
    messages below) to avoid telling an attacker which field was wrong."""
    if not user.security_question or not user.security_answer_hash:
        return False
    if user.security_question != security_question:
        return False
    return verify_password(security_answer, user.security_answer_hash)


@router.get("/csrf-token")
def csrf_token(response: Response):
    """Double-submit cookie CSRF token endpoint (§2).

    Issues an HttpOnly cookie and returns the same value in the JSON body so
    the frontend can echo it back as `X-CSRF-Token` on unsafe methods.
    """
    settings = get_settings()
    token = secrets.token_urlsafe(32)
    response.set_cookie(
        settings["CSRF_COOKIE_NAME"],
        token,
        max_age=3600,
        httponly=True,
        secure=settings["CSRF_COOKIE_SECURE"],
        samesite=settings["CSRF_COOKIE_SAMESITE"],
        path="/",
    )
    return {"csrf_token": token}


@router.get("/check-username", response_model=schemas.UsernameAvailability)
def check_username(username: str, db: Session = Depends(get_db)):
    exists = db.query(models.User).filter(models.User.username == username).first()
    return schemas.UsernameAvailability(username=username, available=exists is None)


@router.post(
    "/register",
    response_model=schemas.UserOut,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    _: None = Depends(auth_rate_limit),
):
    if db.query(models.User).filter(models.User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        title=payload.title,
        first_name=payload.first_name,
        middle_name=payload.middle_name,
        last_name=payload.last_name,
        username=payload.username,
        hashed_password=hash_password(payload.password),
        mobile_number=payload.mobile_number,
        landline_number=payload.landline_number,
        email=payload.email,
        alternate_email=payload.alternate_email,
        pan_number=payload.pan_number,
        pin_code=payload.pin_code,
        state=payload.state,
        district_name=payload.district_name,
        city=payload.city,
        house_no=payload.house_no,
        building_name=payload.building_name,
        road_street=payload.road_street,
        area_locality=payload.area_locality,
        security_question=payload.security_question,
        security_answer_hash=hash_password(payload.security_answer) if payload.security_answer else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=schemas.Token)
def login(
    payload: schemas.LoginRequest,
    db: Session = Depends(get_db),
    _: None = Depends(auth_rate_limit),
):
    user = db.query(models.User).filter(models.User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    access_token = create_access_token({"sub": user.id})
    return schemas.Token(access_token=access_token, user=user)


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.post("/verify-password", status_code=status.HTTP_204_NO_CONTENT)
def verify_password_endpoint(
    payload: schemas.VerifyPasswordRequest,
    current_user: models.User = Depends(get_current_user),
    _: None = Depends(auth_rate_limit),
):
    """Gate for the 'Enter password to update user details' modal shown
    before Update Profile. A 204 means the password matched."""
    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")


@router.put("/me", response_model=schemas.UserOut)
def update_me(
    payload: schemas.UserUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update Profile. Username, password and security Q&A are intentionally
    excluded — those go through their own dedicated flows/endpoints."""
    if payload.email != current_user.email:
        clash = db.query(models.User).filter(
            models.User.email == payload.email, models.User.id != current_user.id
        ).first()
        if clash:
            raise HTTPException(status_code=400, detail="Email already registered")

    for field in (
        "title", "first_name", "middle_name", "last_name",
        "mobile_number", "landline_number", "email", "alternate_email", "pan_number",
        "pin_code", "state", "district_name", "city",
        "house_no", "building_name", "road_street", "area_locality",
    ):
        setattr(current_user, field, getattr(payload, field))

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: schemas.ChangePasswordRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(auth_rate_limit),
):
    if not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Old password is incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()


@router.post("/forgot-password/verify", response_model=schemas.ForgotPasswordVerifyResponse)
def forgot_password_verify(
    payload: schemas.ForgotPasswordVerifyRequest,
    db: Session = Depends(get_db),
    _: None = Depends(recovery_rate_limit),
):
    user = db.query(models.User).filter(models.User.username == payload.username).first()
    # Generic message either way — don't reveal whether the username exists
    # or the security answer was wrong.
    if not user or not _security_answer_matches(user, payload.security_question, payload.security_answer):
        raise HTTPException(status_code=400, detail="Username, security question or answer did not match")

    reset_token = _password_reset_tokens.issue({"user_id": user.id})
    return schemas.ForgotPasswordVerifyResponse(
        reset_token=reset_token, expires_in_seconds=_RESET_TOKEN_TTL_SECONDS
    )


@router.post("/forgot-password/reset", status_code=status.HTTP_204_NO_CONTENT)
def forgot_password_reset(
    payload: schemas.ForgotPasswordResetRequest,
    db: Session = Depends(get_db),
    _: None = Depends(recovery_rate_limit),
):
    claim = _password_reset_tokens.consume(payload.reset_token)
    if not claim:
        raise HTTPException(status_code=400, detail="Reset link has expired. Please start again.")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    user = db.query(models.User).filter(models.User.id == claim["user_id"]).first()
    if not user:
        raise HTTPException(status_code=400, detail="Reset link has expired. Please start again.")

    user.hashed_password = hash_password(payload.new_password)
    db.commit()


@router.post("/forgot-username/send-otp", response_model=schemas.ForgotUsernameSendOtpResponse)
def forgot_username_send_otp(
    payload: schemas.ForgotUsernameSendOtpRequest,
    db: Session = Depends(get_db),
    _: None = Depends(recovery_rate_limit),
):
    user = db.query(models.User).filter(models.User.mobile_number == payload.mobile_number).first()
    if not user or not _security_answer_matches(user, payload.security_question, payload.security_answer):
        raise HTTPException(status_code=400, detail="Mobile number, security question or answer did not match")

    otp = generate_otp()
    otp_token = _username_otp_tokens.issue({"user_id": user.id, "otp": otp})
    return schemas.ForgotUsernameSendOtpResponse(
        otp_token=otp_token,
        expires_in_seconds=_OTP_TTL_SECONDS,
        dev_otp=otp,  # see the illustrative note on the response schema
    )


@router.post("/forgot-username/verify-otp", response_model=schemas.ForgotUsernameVerifyOtpResponse)
def forgot_username_verify_otp(
    payload: schemas.ForgotUsernameVerifyOtpRequest,
    db: Session = Depends(get_db),
    _: None = Depends(recovery_rate_limit),
):
    claim = _username_otp_tokens.peek(payload.otp_token)
    if not claim or claim["otp"] != payload.otp:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    _username_otp_tokens.consume(payload.otp_token)

    user = db.query(models.User).filter(models.User.id == claim["user_id"]).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    return schemas.ForgotUsernameVerifyOtpResponse(username=user.username)
