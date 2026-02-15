from __future__ import annotations
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

class RunCreate(BaseModel):
    recipe_version_id: UUID
    facility_id: UUID
    target_yield_qty: float
    target_yield_uom_id: UUID
    notes: str | None = None

class StatusTransitionRequest(BaseModel):
    target_status: str  # InProgress, Completed, Canceled
    final_yield_qty: float | None = None
    final_yield_uom_id: UUID | None = None

class RunResponse(BaseModel):
    production_run_id: UUID
    recipe_version_id: UUID
    facility_id: UUID
    status: str
    recipe_name: str | None = None
    target_yield_value: float
    target_yield_unit_id: UUID
    actual_yield_value: float | None = None
    actual_yield_unit_id: UUID | None = None
    lot_code: str | None = None
    notes: str | None = None
    snapshot_exists: bool = False
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True

class RunListResponse(BaseModel):
    production_run_id: UUID
    status: str
    facility_id: UUID
    recipe_version_id: UUID
    recipe_name: str | None = None
    target_yield_value: float
    target_yield_unit_id: UUID
    lot_code: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True
