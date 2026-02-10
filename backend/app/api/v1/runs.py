import uuid
from fastapi import APIRouter, Query
from app.api.deps import DbSession, OperatorPlus, AdminOrQA
from app.schemas.api_response import ApiResponse
from app.schemas.runs import RunCreate, RunResponse, RunListResponse, StatusTransitionRequest
from app.services.run_lifecycle_service import create_run, transition_status, get_run, list_runs

router = APIRouter(prefix="/runs", tags=["runs"])


@router.post("", response_model=ApiResponse[RunResponse])
def api_create_run(body: RunCreate, db: DbSession, user: OperatorPlus):
    run = create_run(
        db,
        recipe_version_id=body.recipe_version_id,
        facility_id=body.facility_id,
        target_yield_qty=body.target_yield_qty,
        target_yield_uom_id=body.target_yield_uom_id,
        notes=body.notes,
        user_id=user.user_id,
    )
    db.commit()
    return ApiResponse.ok(_run_to_response(run))


@router.get("/{run_id}", response_model=ApiResponse[RunResponse])
def api_get_run(run_id: uuid.UUID, db: DbSession, user: OperatorPlus):
    run = get_run(db, run_id)
    return ApiResponse.ok(_run_to_response(run))


@router.get("", response_model=ApiResponse[list[RunListResponse]])
def api_list_runs(
    db: DbSession,
    user: OperatorPlus,
    facility_id: uuid.UUID | None = Query(None),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    runs = list_runs(db, facility_id=facility_id, status=status, skip=skip, limit=limit)
    data = [
        RunListResponse(
            production_run_id=r.production_run_id,
            status=r.status,
            facility_id=r.facility_id,
            recipe_version_id=r.recipe_version_id,
            target_yield_value=float(r.target_yield_value),
            lot_code=r.lot_code,
            started_at=r.started_at,
            completed_at=r.completed_at,
            created_at=r.created_at,
        )
        for r in runs
    ]
    return ApiResponse.ok(data)


@router.post("/{run_id}/status", response_model=ApiResponse[RunResponse])
def api_transition_status(run_id: uuid.UUID, body: StatusTransitionRequest, db: DbSession, user: OperatorPlus):
    run = transition_status(
        db,
        run_id=run_id,
        target_status=body.target_status,
        user_id=user.user_id,
        final_yield_qty=body.final_yield_qty,
        final_yield_uom_id=body.final_yield_uom_id,
    )
    db.commit()
    return ApiResponse.ok(_run_to_response(run))


def _run_to_response(run) -> RunResponse:
    return RunResponse(
        production_run_id=run.production_run_id,
        recipe_version_id=run.recipe_version_id,
        facility_id=run.facility_id,
        status=run.status,
        target_yield_value=float(run.target_yield_value),
        target_yield_unit_id=run.target_yield_unit_id,
        actual_yield_value=float(run.actual_yield_value) if run.actual_yield_value is not None else None,
        actual_yield_unit_id=run.actual_yield_unit_id,
        lot_code=run.lot_code,
        notes=run.notes,
        snapshot_exists=run.snapshot_json is not None,
        started_at=run.started_at,
        completed_at=run.completed_at,
        created_at=run.created_at,
    )
