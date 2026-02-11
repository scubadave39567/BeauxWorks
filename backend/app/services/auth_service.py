import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.exceptions import AccountLockedError, ConflictError, NotFoundError, UnauthorizedError
from app.models.identity import User, UserMfa, UserRecoveryCode, UserRefreshToken
from app.security.jwt import create_access_token, create_refresh_token, decode_refresh_token
from app.security.mfa import (
    decrypt_secret,
    encrypt_secret,
    generate_recovery_codes,
    generate_totp_secret,
    get_totp_uri,
    hash_recovery_code,
    verify_totp,
)
from app.security.passwords import hash_password, needs_rehash, verify_password
from app.services.audit_service import write_audit_log


def _hash_token(token: str) -> bytes:
    return hashlib.sha256(token.encode()).digest()


def authenticate_user(
    db: Session, email: str, password: str, ip_address: str | None = None
) -> User | tuple[str, User]:
    """Returns User if no MFA, or (mfa_token, User) if MFA is required."""
    user = (
        db.query(User)
        .filter(User.email == email, User.is_deleted == False)
        .first()
    )
    if user is None:
        raise UnauthorizedError("Invalid credentials")

    if not user.is_active:
        raise UnauthorizedError("Account is deactivated")

    # Check lockout
    now = datetime.now(timezone.utc)
    if user.locked_until and user.locked_until > now:
        raise AccountLockedError(user.locked_until.isoformat())

    if not verify_password(user.password_hash, password):
        user.failed_login_count += 1
        if user.failed_login_count >= settings.max_failed_logins:
            user.locked_until = now + timedelta(minutes=settings.lockout_duration_minutes)
        db.flush()
        write_audit_log(
            db,
            action="login_failed",
            actor_user_id=user.user_id,
            entity_type="user",
            entity_id=user.user_id,
            ip_address=ip_address,
        )
        db.commit()
        raise UnauthorizedError("Invalid credentials")

    # Rehash if needed
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)

    # Reset failed login count
    user.failed_login_count = 0
    user.locked_until = None

    # Check MFA
    mfa = (
        db.query(UserMfa)
        .filter(
            UserMfa.user_id == user.user_id,
            UserMfa.is_enabled == True,
            UserMfa.is_deleted == False,
        )
        .first()
    )

    if mfa:
        # Create a temporary MFA token
        mfa_token = create_access_token(
            str(user.user_id), extra_claims={"type": "mfa_pending"}
        )
        db.commit()
        return mfa_token, user

    # No MFA — update login time and return
    user.last_login_at = now
    write_audit_log(
        db,
        action="login_success",
        actor_user_id=user.user_id,
        entity_type="user",
        entity_id=user.user_id,
        ip_address=ip_address,
    )
    db.commit()
    return user


def verify_mfa_code(db: Session, user_id: uuid.UUID, code: str) -> bool:
    mfa = (
        db.query(UserMfa)
        .filter(
            UserMfa.user_id == user_id,
            UserMfa.is_enabled == True,
            UserMfa.is_deleted == False,
        )
        .first()
    )
    if not mfa:
        return False

    secret = decrypt_secret(mfa.secret_encrypted)
    if verify_totp(secret, code):
        return True

    # Try recovery codes
    code_hash = hash_recovery_code(code)
    recovery = (
        db.query(UserRecoveryCode)
        .filter(
            UserRecoveryCode.user_id == user_id,
            UserRecoveryCode.code_hash == code_hash,
            UserRecoveryCode.used_at == None,
        )
        .first()
    )
    if recovery:
        recovery.used_at = datetime.now(timezone.utc)
        return True

    return False


def create_token_pair(
    db: Session,
    user: User,
    device_info: str | None = None,
) -> tuple[str, str]:
    roles = [
        ur.role.name
        for ur in user.user_roles
        if not ur.is_deleted and ur.role and not ur.role.is_deleted
    ]
    access_token = create_access_token(
        str(user.user_id), extra_claims={"roles": roles}
    )
    refresh_token = create_refresh_token(str(user.user_id))

    token_record = UserRefreshToken(
        user_id=user.user_id,
        token_hash=_hash_token(refresh_token),
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.jwt_refresh_expires_days),
        device_info=device_info,
    )
    db.add(token_record)
    db.flush()

    return access_token, refresh_token


def refresh_tokens(
    db: Session, refresh_token_str: str, device_info: str | None = None
) -> tuple[str, str]:
    payload = decode_refresh_token(refresh_token_str)
    if not payload:
        raise UnauthorizedError("Invalid refresh token")

    user_id = uuid.UUID(payload["sub"])
    token_hash = _hash_token(refresh_token_str)

    record = (
        db.query(UserRefreshToken)
        .filter(
            UserRefreshToken.user_id == user_id,
            UserRefreshToken.token_hash == token_hash,
            UserRefreshToken.revoked_at == None,
        )
        .first()
    )
    if not record:
        raise UnauthorizedError("Invalid refresh token")

    now = datetime.now(timezone.utc)
    expires_at = record.expires_at.replace(tzinfo=timezone.utc) if record.expires_at.tzinfo is None else record.expires_at
    if expires_at < now:
        raise UnauthorizedError("Refresh token expired")

    # Revoke old token
    record.revoked_at = now
    record.last_used_at = now

    user = db.query(User).filter(User.user_id == user_id, User.is_deleted == False).first()
    if not user or not user.is_active:
        raise UnauthorizedError("User not found or inactive")

    return create_token_pair(db, user, device_info)


def revoke_refresh_token(db: Session, user_id: uuid.UUID, refresh_token_str: str) -> None:
    token_hash = _hash_token(refresh_token_str)
    record = (
        db.query(UserRefreshToken)
        .filter(
            UserRefreshToken.user_id == user_id,
            UserRefreshToken.token_hash == token_hash,
            UserRefreshToken.revoked_at == None,
        )
        .first()
    )
    if record:
        record.revoked_at = datetime.now(timezone.utc)


def enroll_mfa(db: Session, user: User) -> tuple[str, str, list[str]]:
    existing = (
        db.query(UserMfa)
        .filter(
            UserMfa.user_id == user.user_id,
            UserMfa.is_enabled == True,
            UserMfa.is_deleted == False,
        )
        .first()
    )
    if existing:
        raise ConflictError("MFA already enabled")

    secret = generate_totp_secret()
    encrypted = encrypt_secret(secret)
    qr_uri = get_totp_uri(secret, user.email)

    mfa = UserMfa(
        user_id=user.user_id,
        mfa_type="totp",
        secret_encrypted=encrypted,
        is_enabled=False,
    )
    db.add(mfa)

    recovery_codes = generate_recovery_codes()
    for code in recovery_codes:
        rc = UserRecoveryCode(
            user_id=user.user_id,
            code_hash=hash_recovery_code(code),
        )
        db.add(rc)

    db.flush()
    return secret, qr_uri, recovery_codes


def confirm_mfa_enrollment(db: Session, user: User, code: str) -> bool:
    mfa = (
        db.query(UserMfa)
        .filter(
            UserMfa.user_id == user.user_id,
            UserMfa.is_enabled == False,
            UserMfa.is_deleted == False,
        )
        .order_by(UserMfa.created_at.desc())
        .first()
    )
    if not mfa:
        raise NotFoundError("No pending MFA enrollment")

    secret = decrypt_secret(mfa.secret_encrypted)
    if not verify_totp(secret, code):
        return False

    mfa.is_enabled = True
    mfa.enabled_at = datetime.now(timezone.utc)
    db.flush()
    return True
