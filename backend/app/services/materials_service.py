import json
import uuid
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.exceptions import BusinessError, NotFoundError
from app.models.inventory import InventoryTransaction
from app.models.production import ProductionRun, RunMaterial
from app.services.audit_service import write_audit_log


def generate_materials_plan(db: Session, run: ProductionRun, user_id: uuid.UUID) -> list[RunMaterial]:
    """Read snapshot_json.ingredients, create run_materials rows."""
    if run.status != "InProgress":
        raise BusinessError("Run must be InProgress to generate materials", error_code="INVALID_RUN_STATUS")
    if not run.snapshot_json:
        raise BusinessError("Run has no snapshot", error_code="NO_SNAPSHOT")

    snapshot = json.loads(run.snapshot_json)
    ingredients = snapshot.get("ingredients", [])

    # Compute multiplier from scaling_json or from yield ratio
    multiplier = 1.0
    if run.scaling_json:
        scaling = json.loads(run.scaling_json)
        multiplier = scaling.get("multiplier", 1.0)

    # Delete existing non-deleted materials
    existing = (
        db.query(RunMaterial)
        .filter(RunMaterial.production_run_id == run.production_run_id, RunMaterial.is_deleted == False)
        .all()
    )
    for m in existing:
        m.is_deleted = True

    materials = []
    for idx, ing in enumerate(ingredients):
        planned_qty = float(ing["base_amount"]) * multiplier
        mat = RunMaterial(
            production_run_id=run.production_run_id,
            item_id=uuid.UUID(ing["ingredient_id"]),
            planned_qty=planned_qty,
            planned_uom_id=uuid.UUID(ing["unit_id"]),
            sort_order=ing.get("sort_order", idx),
            snapshot_line_json=json.dumps(ing, default=str),
        )
        db.add(mat)
        materials.append(mat)

    db.flush()

    write_audit_log(
        db, action="MaterialsPlanGenerated", actor_user_id=user_id,
        entity_type="ProductionRun", entity_id=run.production_run_id,
        event_type="MaterialsPlanGenerated",
        details={"material_count": len(materials)},
    )
    return materials


def consume_material(
    db: Session,
    *,
    run_material_id: uuid.UUID,
    location_id: uuid.UUID | None,
    qty: float,
    uom_id: uuid.UUID,
    lot_id: uuid.UUID | None,
    notes: str | None,
    user_id: uuid.UUID,
) -> InventoryTransaction:
    mat = (
        db.query(RunMaterial)
        .filter(RunMaterial.run_material_id == run_material_id, RunMaterial.is_deleted == False)
        .first()
    )
    if not mat:
        raise NotFoundError("Run material not found")

    run = mat.production_run
    if run.status != "InProgress":
        raise BusinessError("Run must be InProgress to consume materials", error_code="INVALID_RUN_STATUS")

    txn = InventoryTransaction(
        ingredient_id=mat.item_id,
        facility_id=run.facility_id,
        ingredient_lot_id=lot_id,
        production_run_id=run.production_run_id,
        transaction_type="Consume",
        quantity=-abs(qty),  # signed negative for consumption
        unit_id=uom_id,
        reference_type="ProductionRun",
        reference_id=run.production_run_id,
        reference_line_id=run_material_id,
        reference_notes=notes,
        transacted_by_user_id=user_id,
        location_id=location_id,
    )
    db.add(txn)
    db.flush()

    write_audit_log(
        db, action="InventoryConsumed", actor_user_id=user_id,
        entity_type="InventoryTransaction", entity_id=txn.inventory_transaction_id,
        event_type="InventoryConsumed",
        details={"run_material_id": str(run_material_id), "qty": qty, "item_id": str(mat.item_id)},
    )
    return txn


def consume_remaining(
    db: Session,
    *,
    run_material_id: uuid.UUID,
    location_id: uuid.UUID | None,
    lot_id: uuid.UUID | None,
    user_id: uuid.UUID,
) -> InventoryTransaction:
    summary = get_material_summary(db, run_material_id)
    remaining = summary["remaining"]
    if remaining <= 0:
        raise BusinessError("No remaining quantity to consume", error_code="NO_REMAINING")

    mat = db.query(RunMaterial).filter(RunMaterial.run_material_id == run_material_id).first()
    return consume_material(
        db,
        run_material_id=run_material_id,
        location_id=location_id,
        qty=remaining,
        uom_id=mat.planned_uom_id,
        lot_id=lot_id,
        notes="Auto consume remaining",
        user_id=user_id,
    )


def get_material_summary(db: Session, run_material_id: uuid.UUID) -> dict:
    mat = (
        db.query(RunMaterial)
        .filter(RunMaterial.run_material_id == run_material_id, RunMaterial.is_deleted == False)
        .first()
    )
    if not mat:
        raise NotFoundError("Run material not found")

    consumed = (
        db.query(func.coalesce(func.sum(InventoryTransaction.quantity), 0))
        .filter(
            InventoryTransaction.reference_line_id == run_material_id,
            InventoryTransaction.transaction_type == "Consume",
            InventoryTransaction.voided_at == None,
            InventoryTransaction.is_deleted == False,
        )
        .scalar()
    )
    consumed_abs = abs(float(consumed))
    planned = float(mat.planned_qty)

    return {
        "run_material_id": str(mat.run_material_id),
        "item_id": str(mat.item_id),
        "item_name": mat.item.name if mat.item else None,
        "planned": planned,
        "consumed": consumed_abs,
        "remaining": max(0, planned - consumed_abs),
        "waste": float(mat.waste_qty),
        "unit_id": str(mat.planned_uom_id),
        "sort_order": mat.sort_order,
    }


def get_materials_summary(db: Session, run_id: uuid.UUID) -> list[dict]:
    materials = (
        db.query(RunMaterial)
        .filter(RunMaterial.production_run_id == run_id, RunMaterial.is_deleted == False)
        .order_by(RunMaterial.sort_order)
        .all()
    )
    return [get_material_summary(db, m.run_material_id) for m in materials]
