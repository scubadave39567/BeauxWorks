from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class MfaVerifyRequest(BaseModel):
    mfa_token: str
    code: str


class MfaEnrollResponse(BaseModel):
    secret: str
    qr_uri: str
    recovery_codes: list[str]


class MfaEnrollConfirmRequest(BaseModel):
    code: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class MfaPendingResponse(BaseModel):
    mfa_required: bool = True
    mfa_token: str
