import json
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.exceptions import BusinessError, NotFoundError
from app.models.foundations import RunStatus
from app.models.production import ProductionRun
from app.models.recipes import RecipeVersion
from app.services.audit_service import write_audit_log
from app.services.snapshot_service import build_run_snapshot, build_scaling_json


VALID_TRANSITIONS = {
    "Planned": ["InProgress", "Canceled"],
    "InProgress": ["Completed", "Canceled"],
    "Completed": [],
    "Canceled": [],
}


def create_run(
    db: Session,
    *,
    recipe_version_id: uuid.UUID,
    facility_id: uuid.UUID,
    target_yield_qty: float,
    target_yield_uom_id: uuid.UUID,
    notes: str | None = None,
    user_id: uuid.UUID,
) -> ProductionRun:
    # Validate recipe version is Released
    rv = (
        db.query(RecipeVersion)
        .filter(RecipeVersion.recipe_version_id == recipe_version_id,
                RecipeVersion.is_deleted == False)
        .first()
    )
    if not rv:
        raise NotFoundError("Recipe version not found")
    if rv.status != "Released":
        raise BusinessError(
            "Recipe version must be Released to create a production run",
            error_code="RECIPE_NOT_RELEASED",
        )

    # Get "planned" run_status_id for backward compat
    planned_status = db.query(RunStatus).filter(RunStatus.code == "planned").first()
    if not planned_status:
        raise BusinessError("Run status 'planned' not found", error_code="CONFIG_ERROR")

    run = ProductionRun(
        recipe_version_id=recipe_version_id,
        facility_id=facility_id,
        target_yield_value=target_yield_qty,
        target_yield_unit_id=target_yield_uom_id,
        status="Planned",
        run_status_id=planned_status.run_status_id,
        created_by_user_id=user_id,
        operator_user_id=user_id,
        notes=notes,
    )
    db.add(run)
    db.flush()

    write_audit_log(
        db,
        action="RunCreated",
        actor_user_id=user_id,
        entity_type="ProductionRun",
        entity_id=run.production_run_id,
        event_type="RunCreated",
        details={"recipe_version_id": str(recipe_version_id), "facility_id": str(facility_id)},
    )
    return run


def transition_status(
    db: Session,
    *,
    run_id: uuid.UUID,
    target_status: str,
    user_id: uuid.UUID,
    final_yield_qty: float | None = None,
    final_yield_uom_id: uuid.UUID | None = None,
) -> ProductionRun:
    run = (
        db.query(ProductionRun)
        .filter(ProductionRun.production_run_id == run_id, ProductionRun.is_deleted == False)
        .first()
    )
    if not run:
        raise NotFoundError("Production run not found")

    allowed = VALID_TRANSITIONS.get(run.status, [])
    if target_status not in allowed:
        raise BusinessError(
            f"Cannot transition from {run.status} to {target_status}",
            error_code="INVALID_STATUS_TRANSITION",
        )

    now = datetime.now(timezone.utc)

    if target_status == "InProgress":
        # Generate snapshot + materials plan
        snapshot = build_run_snapshot(db, run)
        run.snapshot_json = json.dumps(snapshot, default=str)

        # Build scaling_json
        base_yield = float(run.recipe_version.base_yield_value)
        multiplier = float(run.target_yield_value) / base_yield if base_yield else 1.0
        run.scaling_json = json.dumps(build_scaling_json(run, multiplier), default=str)

        run.started_at = now
        run.status = "InProgress"

        # Update legacy run_status_id
        in_progress_status = db.query(RunStatus).filter(RunStatus.code == "in_progress").first()
        if in_progress_status:
            run.run_status_id = in_progress_status.run_status_id

        db.flush()

        write_audit_log(
            db, action="RunStatusChanged", actor_user_id=user_id,
            entity_type="ProductionRun", entity_id=run.production_run_id,
            event_type="RunStatusChanged",
            details={"from": "Planned", "to": "InProgress"},
        )
        write_audit_log(
            db, action="RunSnapshotGenerated", actor_user_id=user_id,
            entity_type="ProductionRun", entity_id=run.production_run_id,
            event_type="RunSnapshotGenerated",
            details={"snapshot_ingredient_count": len(snapshot.get("ingredients", []))},
        )

    elif target_status == "Completed":
        # Completion gates will be checked in Phase 6
        if final_yield_qty is None:
            raise BusinessError(
                "Final yield quantity is required to complete a run",
                error_code="FINAL_YIELD_REQUIRED",
            )
        run.actual_yield_value = final_yield_qty
        run.actual_yield_unit_id = final_yield_uom_id or run.target_yield_unit_id
        run.completed_at = now
        run.status = "Completed"

        completed_status = db.query(RunStatus).filter(RunStatus.code == "completed").first()
        if completed_status:
            run.run_status_id = completed_status.run_status_id

        db.flush()

        write_audit_log(
            db, action="RunCompleted", actor_user_id=user_id,
            entity_type="ProductionRun", entity_id=run.production_run_id,
            event_type="RunCompleted",
            details={"final_yield_qty": final_yield_qty},
        )

    elif target_status == "Canceled":
        run.status = "Canceled"

        canceled_status = db.query(RunStatus).filter(RunStatus.code == "canceled").first()
        if canceled_status:
            run.run_status_id = canceled_status.run_status_id

        db.flush()

        write_audit_log(
            db, action="RunStatusChanged", actor_user_id=user_id,
            entity_type="ProductionRun", entity_id=run.production_run_id,
            event_type="RunStatusChanged",
            details={"from": run.status, "to": "Canceled"},
        )

    return run


def get_run(db: Session, run_id: uuid.UUID) -> ProductionRun:
    run = (
        db.query(ProductionRun)
        .filter(ProductionRun.production_run_id == run_id, ProductionRun.is_deleted == False)
        .first()
    )
    if not run:
        raise NotFoundError("Production run not found")
    return run


def list_runs(
    db: Session,
    *,
    facility_id: uuid.UUID | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> list[ProductionRun]:
    q = db.query(ProductionRun).filter(ProductionRun.is_deleted == False)
    if facility_id:
        q = q.filter(ProductionRun.facility_id == facility_id)
    if status:
        q = q.filter(ProductionRun.status == status)
    return q.order_by(ProductionRun.created_at.desc()).offset(skip).limit(limit).all()
