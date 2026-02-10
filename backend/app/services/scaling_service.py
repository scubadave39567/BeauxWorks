import json
import uuid

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.exceptions import BusinessError, NotFoundError
from app.models.inventory import InventoryTransaction
from app.models.production import ProductionRun, RunMaterial
from app.models.recipes import RecipeVersion
from app.services.audit_service import write_audit_log
from app.services.materials_service import generate_materials_plan


def preview_scale(
    db: Session,
    recipe_version_id: uuid.UUID,
    target_yield_qty: float,
    target_yield_uom_id: uuid.UUID,
) -> dict:
    """Compute multiplier and scaled ingredients without persistence."""
    rv = (
        db.query(RecipeVersion)
        .filter(RecipeVersion.recipe_version_id == recipe_version_id, RecipeVersion.is_deleted == False)
        .first()
    )
    if not rv:
        raise NotFoundError("Recipe version not found")

    base_yield = float(rv.base_yield_value)
    if base_yield == 0:
        raise BusinessError("Base yield is zero", error_code="ZERO_BASE_YIELD")

    multiplier = target_yield_qty / base_yield

    scaled_ingredients = []
    for rvi in sorted(rv.ingredients, key=lambda x: x.sort_order):
        if rvi.is_deleted:
            continue
        scaled_ingredients.append({
            "ingredient_id": str(rvi.ingredient_id),
            "ingredient_name": rvi.ingredient.name if rvi.ingredient else None,
            "base_amount": float(rvi.base_amount),
            "scaled_amount": float(rvi.base_amount) * multiplier,
            "unit_id": str(rvi.unit_id),
            "sort_order": rvi.sort_order,
        })

    return {
        "multiplier": multiplier,
        "target_yield_qty": target_yield_qty,
        "target_yield_uom_id": str(target_yield_uom_id),
        "base_yield_value": base_yield,
        "base_yield_unit_id": str(rv.base_yield_unit_id),
        "scaled_ingredients": scaled_ingredients,
    }


def apply_scale(
    db: Session,
    *,
    run_id: uuid.UUID,
    target_yield_qty: float,
    target_yield_uom_id: uuid.UUID,
    user_id: uuid.UUID,
) -> ProductionRun:
    """Apply scaling to a run. Forbidden if any consumption exists."""
    run = (
        db.query(ProductionRun)
        .filter(ProductionRun.production_run_id == run_id, ProductionRun.is_deleted == False)
        .first()
    )
    if not run:
        raise NotFoundError("Run not found")
    if run.status != "InProgress":
        raise BusinessError("Run must be InProgress to scale", error_code="INVALID_RUN_STATUS")

    # Check for existing consumption
    consumption_count = (
        db.query(func.count(InventoryTransaction.inventory_transaction_id))
        .filter(
            InventoryTransaction.reference_type == "ProductionRun",
            InventoryTransaction.reference_id == run_id,
            InventoryTransaction.transaction_type == "Consume",
            InventoryTransaction.voided_at == None,
            InventoryTransaction.is_deleted == False,
        )
        .scalar()
    )
    if consumption_count and consumption_count > 0:
        raise BusinessError(
            "Cannot scale after consumption has started",
            error_code="SCALING_LOCKED_AFTER_CONSUMPTION",
        )

    # Update target yield
    run.target_yield_value = target_yield_qty
    run.target_yield_unit_id = target_yield_uom_id

    # Rebuild snapshot ingredients with new multiplier
    base_yield = float(run.recipe_version.base_yield_value)
    if base_yield == 0:
        raise BusinessError("Base yield is zero", error_code="ZERO_BASE_YIELD")
    multiplier = target_yield_qty / base_yield

    # Update scaling_json
    run.scaling_json = json.dumps({
        "multiplier": multiplier,
        "target_yield_value": target_yield_qty,
        "target_yield_unit_id": str(target_yield_uom_id),
        "base_yield_value": base_yield,
        "base_yield_unit_id": str(run.recipe_version.base_yield_unit_id),
    }, default=str)

    # Update snapshot ingredients
    if run.snapshot_json:
        snapshot = json.loads(run.snapshot_json)
        for ing in snapshot.get("ingredients", []):
            ing["scaled_amount"] = float(ing["base_amount"]) * multiplier
        run.snapshot_json = json.dumps(snapshot, default=str)

    db.flush()

    # Regenerate materials plan
    generate_materials_plan(db, run, user_id)

    write_audit_log(
        db, action="RunScaled", actor_user_id=user_id,
        entity_type="ProductionRun", entity_id=run.production_run_id,
        event_type="RunScaled",
        details={"multiplier": multiplier, "target_yield_qty": target_yield_qty},
    )
    return run


def get_print_data(db: Session, run_id: uuid.UUID) -> dict:
    """Return print-ready batch record payload."""
    run = (
        db.query(ProductionRun)
        .filter(ProductionRun.production_run_id == run_id, ProductionRun.is_deleted == False)
        .first()
    )
    if not run:
        raise NotFoundError("Run not found")

    recipe_name = ""
    if run.recipe_version and run.recipe_version.recipe:
        recipe_name = run.recipe_version.recipe.name

    facility_name = run.facility.name if run.facility else ""

    # Get materials
    materials = (
        db.query(RunMaterial)
        .filter(RunMaterial.production_run_id == run_id, RunMaterial.is_deleted == False)
        .order_by(RunMaterial.sort_order)
        .all()
    )

    ingredients = [
        {
            "name": m.item.name if m.item else "Unknown",
            "planned_qty": float(m.planned_qty),
            "unit_id": str(m.planned_uom_id),
        }
        for m in materials
    ]

    # Get steps from snapshot
    steps = []
    if run.snapshot_json:
        snapshot = json.loads(run.snapshot_json)
        steps = snapshot.get("steps", [])

    # Get QC checklist from snapshot
    qc_checklist = []
    if run.snapshot_json:
        snapshot = json.loads(run.snapshot_json)
        qc_checklist = snapshot.get("qc_requirements", [])

    scaling = json.loads(run.scaling_json) if run.scaling_json else {}

    return {
        "title": f"Batch Record: {recipe_name}",
        "recipe_name": recipe_name,
        "facility": facility_name,
        "lot_code": run.lot_code,
        "date": run.started_at.isoformat() if run.started_at else None,
        "target_yield": float(run.target_yield_value),
        "multiplier": scaling.get("multiplier", 1.0),
        "ingredients": ingredients,
        "steps": steps,
        "qc_checklist": qc_checklist,
        "signature_lines": ["Prepared by", "Verified by", "QA Review"],
    }
