import json
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.exceptions import BusinessError, NotFoundError
from app.models.production import ProductionRun, QualityMetricType
from app.models.qc import RunQcEntry
from app.services.audit_service import write_audit_log


def record_entry(
    db: Session,
    *,
    run_id: uuid.UUID,
    metric_type_id: uuid.UUID,
    stage: str,
    value_number: float | None = None,
    value_text: str | None = None,
    uom_id: uuid.UUID | None = None,
    observed_at: datetime | None = None,
    notes: str | None = None,
    user_id: uuid.UUID,
) -> RunQcEntry:
    run = db.query(ProductionRun).filter(
        ProductionRun.production_run_id == run_id, ProductionRun.is_deleted == False
    ).first()
    if not run:
        raise NotFoundError("Production run not found")
    if run.status != "InProgress":
        raise BusinessError("Run must be InProgress to record QC", error_code="INVALID_RUN_STATUS")

    metric = db.query(QualityMetricType).filter(
        QualityMetricType.quality_metric_type_id == metric_type_id,
        QualityMetricType.is_deleted == False,
    ).first()
    if not metric:
        raise NotFoundError("Metric type not found")

    # data_type validation
    if metric.data_type == "Number" and value_number is None:
        raise BusinessError("Numeric value required for this metric", error_code="VALUE_REQUIRED")
    if metric.data_type == "Text" and not value_text:
        raise BusinessError("Text value required for this metric", error_code="VALUE_REQUIRED")

    # requires_notes
    if metric.requires_notes and not notes:
        raise BusinessError("Notes are required for this metric", error_code="NOTES_REQUIRED")

    # Check acceptance criteria from snapshot
    fail_info = _check_acceptance(run, metric_type_id, stage, value_number)

    entry = RunQcEntry(
        production_run_id=run_id,
        metric_type_id=metric_type_id,
        stage=stage,
        value_number=value_number,
        value_text=value_text,
        uom_id=uom_id,
        observed_at=observed_at or datetime.now(timezone.utc),
        notes=notes,
        created_by_user_id=user_id,
    )
    db.add(entry)
    db.flush()

    write_audit_log(
        db, action="QcEntryCreated", actor_user_id=user_id,
        entity_type="RunQcEntry", entity_id=entry.run_qc_entry_id,
        event_type="QcEntryCreated",
        details={"metric_type_id": str(metric_type_id), "stage": stage},
    )

    if fail_info:
        raise BusinessError(
            f"QC value out of range: {fail_info}",
            error_code="QC_FAIL_REQUIRES_DEVIATION",
        )

    return entry


def _check_acceptance(run: ProductionRun, metric_type_id: uuid.UUID, stage: str, value_number: float | None) -> str | None:
    """Check snapshot QC requirements for this metric+stage. Returns failure info or None."""
    if not run.snapshot_json or value_number is None:
        return None
    snapshot = json.loads(run.snapshot_json)
    for req in snapshot.get("qc_requirements", []):
        if req["metric_type_id"] == str(metric_type_id) and req["stage"] == stage:
            if not req.get("fail_requires_deviation"):
                continue
            min_v = req.get("min_value")
            max_v = req.get("max_value")
            if min_v is not None and value_number < min_v:
                return f"Value {value_number} below min {min_v}"
            if max_v is not None and value_number > max_v:
                return f"Value {value_number} above max {max_v}"
    return None


def amend_entry(
    db: Session,
    *,
    entry_id: uuid.UUID,
    value_number: float | None = None,
    value_text: str | None = None,
    reason: str,
    user_id: uuid.UUID,
) -> RunQcEntry:
    entry = db.query(RunQcEntry).filter(
        RunQcEntry.run_qc_entry_id == entry_id, RunQcEntry.is_deleted == False
    ).first()
    if not entry:
        raise NotFoundError("QC entry not found")

    original = {
        "value_number": float(entry.value_number) if entry.value_number is not None else None,
        "value_text": entry.value_text,
    }

    if value_number is not None:
        entry.value_number = value_number
    if value_text is not None:
        entry.value_text = value_text
    entry.is_amended = True
    entry.amended_at = datetime.now(timezone.utc)
    entry.amended_by_user_id = user_id
    entry.amended_reason = reason
    db.flush()

    write_audit_log(
        db, action="QcEntryAmended", actor_user_id=user_id,
        entity_type="RunQcEntry", entity_id=entry.run_qc_entry_id,
        event_type="QcEntryAmended",
        details={"reason": reason, "original": original},
    )
    return entry


def evaluate_requirements(db: Session, run_id: uuid.UUID) -> list[dict]:
    """Check snapshot QC requirements against entries. Returns per-requirement status."""
    run = db.query(ProductionRun).filter(
        ProductionRun.production_run_id == run_id, ProductionRun.is_deleted == False
    ).first()
    if not run or not run.snapshot_json:
        return []

    snapshot = json.loads(run.snapshot_json)
    requirements = snapshot.get("qc_requirements", [])

    entries = (
        db.query(RunQcEntry)
        .filter(RunQcEntry.production_run_id == run_id, RunQcEntry.is_deleted == False)
        .all()
    )

    results = []
    for req in requirements:
        metric_id = req["metric_type_id"]
        stage = req["stage"]

        matching = [
            e for e in entries
            if str(e.metric_type_id) == metric_id and e.stage == stage
        ]

        fulfilled = len(matching) > 0
        in_range = True
        if matching and req.get("min_value") is not None and matching[-1].value_number is not None:
            if float(matching[-1].value_number) < req["min_value"]:
                in_range = False
        if matching and req.get("max_value") is not None and matching[-1].value_number is not None:
            if float(matching[-1].value_number) > req["max_value"]:
                in_range = False

        results.append({
            "metric_type_id": metric_id,
            "metric_type_name": req.get("metric_type_name"),
            "stage": stage,
            "required": req.get("required", True),
            "fulfilled": fulfilled,
            "in_range": in_range,
            "fail_requires_deviation": req.get("fail_requires_deviation", False),
            "entry_count": len(matching),
        })

    return results
