import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.exceptions import BusinessError, NotFoundError
from app.models.production import ProductionRunDeviation
from app.services.audit_service import write_audit_log


def create_deviation(
    db: Session,
    *,
    run_id: uuid.UUID,
    deviation_type: str,
    severity: str,
    description: str,
    corrective_action: str | None = None,
    preventive_action: str | None = None,
    user_id: uuid.UUID,
) -> ProductionRunDeviation:
    deviation = ProductionRunDeviation(
        production_run_id=run_id,
        detected_by_user_id=user_id,
        deviation_type=deviation_type,
        details=description,
        corrective_action=corrective_action,
        severity=severity,
        preventive_action=preventive_action,
        deviation_status="Open",
    )
    db.add(deviation)
    db.flush()

    write_audit_log(
        db, action="DeviationCreated", actor_user_id=user_id,
        entity_type="ProductionRunDeviation", entity_id=deviation.production_run_deviation_id,
        event_type="DeviationCreated",
        details={"type": deviation_type, "severity": severity, "run_id": str(run_id)},
    )
    return deviation


def close_deviation(
    db: Session,
    *,
    deviation_id: uuid.UUID,
    user_id: uuid.UUID,
) -> ProductionRunDeviation:
    deviation = (
        db.query(ProductionRunDeviation)
        .filter(ProductionRunDeviation.production_run_deviation_id == deviation_id,
                ProductionRunDeviation.is_deleted == False)
        .first()
    )
    if not deviation:
        raise NotFoundError("Deviation not found")
    if deviation.deviation_status == "Closed":
        raise BusinessError("Deviation already closed", error_code="ALREADY_CLOSED")

    deviation.deviation_status = "Closed"
    deviation.closed_at = datetime.now(timezone.utc)
    deviation.closed_by_user_id = user_id
    db.flush()

    write_audit_log(
        db, action="DeviationClosed", actor_user_id=user_id,
        entity_type="ProductionRunDeviation", entity_id=deviation.production_run_deviation_id,
        event_type="DeviationClosed",
        details={"deviation_id": str(deviation_id)},
    )
    return deviation


def list_deviations(db: Session, run_id: uuid.UUID) -> list[ProductionRunDeviation]:
    return (
        db.query(ProductionRunDeviation)
        .filter(ProductionRunDeviation.production_run_id == run_id,
                ProductionRunDeviation.is_deleted == False)
        .order_by(ProductionRunDeviation.detected_at)
        .all()
    )
