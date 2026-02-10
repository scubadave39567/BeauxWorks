"""Standard API response wrapper: {success, data, error}."""

from __future__ import annotations

from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    success: bool
    data: T | None = None
    error: str | None = None
    error_code: str | None = None

    @classmethod
    def ok(cls, data: T) -> ApiResponse[T]:
        return cls(success=True, data=data)

    @classmethod
    def err(cls, error: str, *, error_code: str | None = None, status_code: int = 400) -> ApiResponse[None]:
        return cls(success=False, error=error, error_code=error_code)
