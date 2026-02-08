from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.common import IdResponse
from app.schemas.production_runs import (
    BatchRecordResponse,
    DeviationCreate,
    DeviationResponse,
    ProductionRunCreate,
    ProductionRunResponse,
    ProductionRunUpdate,
    QualityLogCreate,
    QualityLogResponse,
    ScanResponse,
)
from app.services.production_service import (
    add_deviation,
    add_quality_log,
    create_production_run,
    delete_production_run,
    get_production_run,
    list_production_runs,
    list_quality_logs,
    scan_code,
    update_production_run,
)

router = APIRouter(prefix="/production-runs", tags=["production-runs"])


@router.get("", response_model=list[ProductionRunResponse])
def list_all(db: DbSession, skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200)):
    return list_production_runs(db, skip=skip, limit=limit)


@router.get("/{run_id}", response_model=ProductionRunResponse)
def get_one(run_id: UUID, db: DbSession):
    return get_production_run(db, run_id)


@router.post("", response_model=IdResponse, status_code=201)
def create(body: ProductionRunCreate, current_user: CurrentUser, db: DbSession):
    run = create_production_run(db, **body.model_dump())
    db.commit()
    return IdResponse(id=run.production_run_id)


@router.patch("/{run_id}", response_model=ProductionRunResponse)
def update(run_id: UUID, body: ProductionRunUpdate, current_user: CurrentUser, db: DbSession):
    run = get_production_run(db, run_id)
    update_production_run(db, run, **body.model_dump(exclude_unset=True))
    db.commit()
    db.refresh(run)
    return run


@router.delete("/{run_id}", status_code=204)
def delete(run_id: UUID, current_user: CurrentUser, db: DbSession):
    run = get_production_run(db, run_id)
    delete_production_run(db, run)
    db.commit()


@router.get("/{run_id}/quality-logs", response_model=list[QualityLogResponse])
def get_quality_logs(run_id: UUID, db: DbSession):
    return list_quality_logs(db, run_id)


@router.post("/{run_id}/quality-logs", response_model=IdResponse, status_code=201)
def create_quality_log(
    run_id: UUID, body: QualityLogCreate, current_user: CurrentUser, db: DbSession
):
    log = add_quality_log(
        db,
        run_id,
        measured_by_user_id=current_user.user_id,
        **body.model_dump(exclude_unset=True),
    )
    db.commit()
    return IdResponse(id=log.production_run_quality_log_id)


@router.post("/{run_id}/deviations", response_model=IdResponse, status_code=201)
def create_deviation(
    run_id: UUID, body: DeviationCreate, current_user: CurrentUser, db: DbSession
):
    deviation = add_deviation(
        db,
        run_id,
        detected_by_user_id=current_user.user_id,
        **body.model_dump(),
    )
    db.commit()
    return IdResponse(id=deviation.production_run_deviation_id)


@router.get("/scan/{code_value}", response_model=ScanResponse)
def scan(code_value: str, db: DbSession):
    run = scan_code(db, code_value)
    return ScanResponse(
        production_run_id=run.production_run_id,
        lot_code=run.lot_code,
        run_status=run.run_status.code if run.run_status else None,
    )


@router.get("/{run_id}/batch-record", response_model=BatchRecordResponse)
def batch_record(run_id: UUID, db: DbSession):
    run = get_production_run(db, run_id)
    ql = list_quality_logs(db, run_id)
    deviations = [
        d for d in run.deviations if not d.is_deleted
    ]
    return BatchRecordResponse(
        production_run_id=run.production_run_id,
        lot_code=run.lot_code,
        recipe_name=run.recipe_version.recipe.name if run.recipe_version and run.recipe_version.recipe else "",
        version_number=run.recipe_version.version_number if run.recipe_version else 0,
        run_status=run.run_status.code if run.run_status else "",
        facility_name=run.facility.name if run.facility else "",
        operator_name=run.operator.display_name if run.operator else None,
        target_yield_value=float(run.target_yield_value),
        actual_yield_value=float(run.actual_yield_value) if run.actual_yield_value else None,
        quality_logs=ql,
        deviations=deviations,
    )
