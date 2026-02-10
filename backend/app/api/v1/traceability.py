import uuid
from fastapi import APIRouter, Query
from app.api.deps import DbSession, OperatorPlus
from app.schemas.api_response import ApiResponse
from app.services.traceability_service import trace_by_lot, trace_by_run

router = APIRouter(prefix="/traceability", tags=["traceability"])


@router.get("/by-lot", response_model=ApiResponse[dict])
def api_trace_by_lot(db: DbSession, user: OperatorPlus, lot_id: uuid.UUID = Query(...)):
    data = trace_by_lot(db, lot_id)
    return ApiResponse.ok(data)


@router.get("/by-run", response_model=ApiResponse[dict])
def api_trace_by_run(db: DbSession, user: OperatorPlus, run_id: uuid.UUID = Query(...)):
    data = trace_by_run(db, run_id)
    return ApiResponse.ok(data)
