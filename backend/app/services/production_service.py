import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.models.production import (
    ProductionRun,
    ProductionRunCode,
    ProductionRunDeviation,
    ProductionRunQualityLog,
)


def list_production_runs(db: Session, *, skip: int = 0, limit: int = 50) -> list[ProductionRun]:
    return (
        db.query(ProductionRun)
        .filter(ProductionRun.is_deleted == False)
        .order_by(ProductionRun.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_production_run(db: Session, run_id: uuid.UUID) -> ProductionRun:
    run = (
        db.query(ProductionRun)
        .filter(ProductionRun.production_run_id == run_id, ProductionRun.is_deleted == False)
        .first()
    )
    if not run:
        raise NotFoundError("Production run not found")
    return run


def create_production_run(db: Session, **kwargs) -> ProductionRun:
    run = ProductionRun(**kwargs)
    db.add(run)
    db.flush()
    return run


def update_production_run(db: Session, run: ProductionRun, **kwargs) -> ProductionRun:
    for key, value in kwargs.items():
        if value is not None:
            setattr(run, key, value)
    db.flush()
    return run


def delete_production_run(db: Session, run: ProductionRun) -> None:
    run.is_deleted = True
    db.flush()


def add_quality_log(
    db: Session,
    run_id: uuid.UUID,
    measured_by_user_id: uuid.UUID,
    **kwargs,
) -> ProductionRunQualityLog:
    log = ProductionRunQualityLog(
        production_run_id=run_id,
        measured_by_user_id=measured_by_user_id,
        **kwargs,
    )
    db.add(log)
    db.flush()
    return log


def list_quality_logs(db: Session, run_id: uuid.UUID) -> list[ProductionRunQualityLog]:
    return (
        db.query(ProductionRunQualityLog)
        .filter(
            ProductionRunQualityLog.production_run_id == run_id,
            ProductionRunQualityLog.is_deleted == False,
        )
        .order_by(ProductionRunQualityLog.measured_at)
        .all()
    )


def add_deviation(
    db: Session,
    run_id: uuid.UUID,
    detected_by_user_id: uuid.UUID,
    **kwargs,
) -> ProductionRunDeviation:
    deviation = ProductionRunDeviation(
        production_run_id=run_id,
        detected_by_user_id=detected_by_user_id,
        **kwargs,
    )
    db.add(deviation)
    db.flush()
    return deviation


def scan_code(db: Session, code_value: str) -> ProductionRun:
    code = (
        db.query(ProductionRunCode)
        .filter(ProductionRunCode.code_value == code_value, ProductionRunCode.is_deleted == False)
        .first()
    )
    if not code:
        raise NotFoundError("Code not found")
    return get_production_run(db, code.production_run_id)
