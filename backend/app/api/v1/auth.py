from fastapi import APIRouter, Depends, Request

from app.api.deps import CurrentUser, DbSession
from app.exceptions import UnauthorizedError
from app.models.identity import User
from app.schemas.auth import (
    LoginRequest,
    MfaEnrollConfirmRequest,
    MfaEnrollResponse,
    MfaPendingResponse,
    MfaVerifyRequest,
    RefreshRequest,
    TokenResponse,
)
from app.security.jwt import decode_access_token
from app.services.audit_service import write_audit_log
from app.services.auth_service import (
    authenticate_user,
    confirm_mfa_enrollment,
    create_token_pair,
    enroll_mfa,
    refresh_tokens,
    revoke_refresh_token,
    verify_mfa_code,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse | MfaPendingResponse)
def login(body: LoginRequest, request: Request, db: DbSession):
    ip = request.client.host if request.client else None
    result = authenticate_user(db, body.email, body.password, ip_address=ip)

    if isinstance(result, tuple):
        mfa_token, _user = result
        return MfaPendingResponse(mfa_token=mfa_token)

    user: User = result
    access_token, refresh_token = create_token_pair(db, user)
    db.commit()
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/verify-mfa", response_model=TokenResponse)
def verify_mfa(body: MfaVerifyRequest, request: Request, db: DbSession):
    payload = decode_access_token(body.mfa_token)
    if not payload or payload.get("type") != "mfa_pending":
        raise UnauthorizedError("Invalid MFA token")

    from uuid import UUID

    user_id = UUID(payload["sub"])
    if not verify_mfa_code(db, user_id, body.code):
        raise UnauthorizedError("Invalid MFA code")

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise UnauthorizedError()

    from datetime import datetime, timezone

    user.last_login_at = datetime.now(timezone.utc)
    ip = request.client.host if request.client else None
    write_audit_log(
        db,
        action="login_success_mfa",
        actor_user_id=user.user_id,
        entity_type="user",
        entity_id=user.user_id,
        ip_address=ip,
    )

    access_token, refresh_token = create_token_pair(db, user)
    db.commit()
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: DbSession):
    access_token, refresh_token = refresh_tokens(db, body.refresh_token)
    db.commit()
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout", status_code=204)
def logout(body: RefreshRequest, current_user: CurrentUser, db: DbSession):
    revoke_refresh_token(db, current_user.user_id, body.refresh_token)
    write_audit_log(
        db,
        action="logout",
        actor_user_id=current_user.user_id,
        entity_type="user",
        entity_id=current_user.user_id,
    )
    db.commit()


@router.post("/mfa/enroll", response_model=MfaEnrollResponse)
def mfa_enroll(current_user: CurrentUser, db: DbSession):
    secret, qr_uri, recovery_codes = enroll_mfa(db, current_user)
    db.commit()
    return MfaEnrollResponse(secret=secret, qr_uri=qr_uri, recovery_codes=recovery_codes)


@router.post("/mfa/confirm", status_code=200)
def mfa_confirm(body: MfaEnrollConfirmRequest, current_user: CurrentUser, db: DbSession):
    success = confirm_mfa_enrollment(db, current_user, body.code)
    if not success:
        raise UnauthorizedError("Invalid TOTP code — enrollment not confirmed")
    db.commit()
    return {"detail": "MFA enrollment confirmed"}
