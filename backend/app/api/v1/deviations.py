import uuid
from pydantic import BaseModel
from fastapi import APIRouter
from app.api.deps import DbSession, OperatorPlus, AdminOrQA
from app.schemas.api_response import ApiResponse
from app.services.deviation_service import create_deviation, close_deviation, list_deviations

router = APIRouter(tags=["deviations"])


class DeviationCreate(BaseModel):
    deviation_type: str
    severity: str = "Med"
    description: str
    corrective_action: str | None = None
    preventive_action: str | None = None


@router.post("/runs/{run_id}/deviations", response_model=ApiResponse[dict])
def api_create_deviation(run_id: uuid.UUID, body: DeviationCreate, db: DbSession, user: OperatorPlus):
    dev = create_deviation(
        db,
        run_id=run_id,
        deviation_type=body.deviation_type,
        severity=body.severity,
        description=body.description,
        corrective_action=body.corrective_action,
        preventive_action=body.preventive_action,
        user_id=user.user_id,
    )
    db.commit()
    return ApiResponse.ok({"production_run_deviation_id": str(dev.production_run_deviation_id)})


@router.get("/runs/{run_id}/deviations", response_model=ApiResponse[list[dict]])
def api_list_deviations(run_id: uuid.UUID, db: DbSession, user: OperatorPlus):
    devs = list_deviations(db, run_id)
    data = [
        {
            "production_run_deviation_id": str(d.production_run_deviation_id),
            "deviation_type": d.deviation_type,
            "severity": d.severity,
            "details": d.details,
            "corrective_action": d.corrective_action,
            "preventive_action": d.preventive_action,
            "status": d.deviation_status,
            "detected_at": d.detected_at.isoformat() if d.detected_at else None,
            "closed_at": d.closed_at.isoformat() if d.closed_at else None,
        }
        for d in devs
    ]
    return ApiResponse.ok(data)


@router.post("/deviations/{deviation_id}/close", response_model=ApiResponse[dict])
def api_close_deviation(deviation_id: uuid.UUID, db: DbSession, user: AdminOrQA):
    dev = close_deviation(db, deviation_id=deviation_id, user_id=user.user_id)
    db.commit()
    return ApiResponse.ok({"closed": True, "deviation_id": str(dev.production_run_deviation_id)})
