import uuid

from sqlalchemy.orm import Session

from app.models.inventory import IngredientLot, InventoryTransaction
from app.models.production import ProductionRun, RunMaterial
from app.models.recipes import Ingredient


def trace_by_lot(db: Session, lot_id: uuid.UUID) -> dict:
    """All runs consuming that lot with run details + quantities."""
    lot = db.query(IngredientLot).filter(IngredientLot.ingredient_lot_id == lot_id).first()
    lot_info = None
    if lot:
        lot_info = {
            "lot_id": str(lot.ingredient_lot_id),
            "lot_number": lot.lot_number,
            "ingredient_id": str(lot.ingredient_id),
            "ingredient_name": lot.ingredient.name if lot.ingredient else None,
        }

    txns = (
        db.query(InventoryTransaction)
        .filter(
            InventoryTransaction.ingredient_lot_id == lot_id,
            InventoryTransaction.transaction_type == "Consume",
            InventoryTransaction.voided_at == None,
            InventoryTransaction.is_deleted == False,
        )
        .all()
    )

    runs = {}
    for t in txns:
        run_id = str(t.production_run_id) if t.production_run_id else str(t.reference_id)
        if run_id not in runs:
            run = db.query(ProductionRun).filter(ProductionRun.production_run_id == t.production_run_id).first()
            runs[run_id] = {
                "production_run_id": run_id,
                "status": run.status if run else None,
                "lot_code": run.lot_code if run else None,
                "started_at": run.started_at.isoformat() if run and run.started_at else None,
                "consumed_qty": 0,
            }
        runs[run_id]["consumed_qty"] += abs(float(t.quantity))

    return {
        "lot": lot_info,
        "affected_runs": list(runs.values()),
    }


def trace_by_run(db: Session, run_id: uuid.UUID) -> dict:
    """All consumption transactions grouped by item and lot."""
    run = db.query(ProductionRun).filter(ProductionRun.production_run_id == run_id).first()
    run_info = None
    if run:
        run_info = {
            "production_run_id": str(run.production_run_id),
            "status": run.status,
            "lot_code": run.lot_code,
        }

    txns = (
        db.query(InventoryTransaction)
        .filter(
            InventoryTransaction.reference_type == "ProductionRun",
            InventoryTransaction.reference_id == run_id,
            InventoryTransaction.transaction_type == "Consume",
            InventoryTransaction.voided_at == None,
            InventoryTransaction.is_deleted == False,
        )
        .all()
    )

    items = {}
    for t in txns:
        item_id = str(t.ingredient_id)
        if item_id not in items:
            ingredient = db.query(Ingredient).filter(Ingredient.ingredient_id == t.ingredient_id).first()
            items[item_id] = {
                "item_id": item_id,
                "item_name": ingredient.name if ingredient else None,
                "lots": {},
                "total_consumed": 0,
            }

        lot_key = str(t.ingredient_lot_id) if t.ingredient_lot_id else "no_lot"
        if lot_key not in items[item_id]["lots"]:
            lot_number = None
            if t.ingredient_lot_id:
                lot = db.query(IngredientLot).filter(IngredientLot.ingredient_lot_id == t.ingredient_lot_id).first()
                lot_number = lot.lot_number if lot else None
            items[item_id]["lots"][lot_key] = {
                "lot_id": str(t.ingredient_lot_id) if t.ingredient_lot_id else None,
                "lot_number": lot_number,
                "consumed_qty": 0,
            }

        qty = abs(float(t.quantity))
        items[item_id]["lots"][lot_key]["consumed_qty"] += qty
        items[item_id]["total_consumed"] += qty

    # Flatten lots from dict to list
    for item in items.values():
        item["lots"] = list(item["lots"].values())

    return {
        "run": run_info,
        "consumption": list(items.values()),
    }
