import uuid
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter
from app.api.deps import DbSession, OperatorPlus, AdminOrQA
from app.schemas.api_response import ApiResponse
from app.services.qc_entry_service import record_entry, amend_entry, evaluate_requirements

router = APIRouter(prefix="/runs/{run_id}/qc", tags=["run-qc"])


class QcEntryCreate(BaseModel):
    metric_type_id: uuid.UUID
    stage: str
    value_number: float | None = None
    value_text: str | None = None
    uom_id: uuid.UUID | None = None
    observed_at: datetime | None = None
    notes: str | None = None


class QcEntryAmend(BaseModel):
    value_number: float | None = None
    value_text: str | None = None
    reason: str


@router.get("/requirements", response_model=ApiResponse[list[dict]])
def api_get_requirements(run_id: uuid.UUID, db: DbSession, user: OperatorPlus):
    data = evaluate_requirements(db, run_id)
    return ApiResponse.ok(data)


@router.post("/entries", response_model=ApiResponse[dict])
def api_create_entry(run_id: uuid.UUID, body: QcEntryCreate, db: DbSession, user: OperatorPlus):
    entry = record_entry(
        db,
        run_id=run_id,
        metric_type_id=body.metric_type_id,
        stage=body.stage,
        value_number=body.value_number,
        value_text=body.value_text,
        uom_id=body.uom_id,
        observed_at=body.observed_at,
        notes=body.notes,
        user_id=user.user_id,
    )
    db.commit()
    return ApiResponse.ok({"run_qc_entry_id": str(entry.run_qc_entry_id)})


@router.post("/entries/{entry_id}/amend", response_model=ApiResponse[dict])
def api_amend_entry(run_id: uuid.UUID, entry_id: uuid.UUID, body: QcEntryAmend, db: DbSession, user: AdminOrQA):
    entry = amend_entry(
        db,
        entry_id=entry_id,
        value_number=body.value_number,
        value_text=body.value_text,
        reason=body.reason,
        user_id=user.user_id,
    )
    db.commit()
    return ApiResponse.ok({"amended": True, "run_qc_entry_id": str(entry.run_qc_entry_id)})
