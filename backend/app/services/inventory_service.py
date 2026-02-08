import uuid

from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.models.inventory import (
    IngredientInventory,
    IngredientLot,
    InventoryTransaction,
    ProductionRunIngredientConsumption,
    Supplier,
)
from app.models.recipes import Ingredient
from app.models.foundations import Facility, Unit


def get_inventory_status(db: Session) -> list[dict]:
    rows = (
        db.query(
            IngredientInventory,
            Ingredient.name.label("ingredient_name"),
            Facility.name.label("facility_name"),
            Unit.abbreviation.label("unit_abbreviation"),
        )
        .join(Ingredient, IngredientInventory.ingredient_id == Ingredient.ingredient_id)
        .join(Facility, IngredientInventory.facility_id == Facility.facility_id)
        .join(Unit, IngredientInventory.unit_id == Unit.unit_id)
        .filter(IngredientInventory.is_deleted == False)
        .all()
    )
    result = []
    for ii, ing_name, fac_name, unit_abbrev in rows:
        low = (
            ii.low_stock_threshold is not None
            and float(ii.quantity_on_hand) <= float(ii.low_stock_threshold)
        )
        result.append({
            "ingredient_id": ii.ingredient_id,
            "ingredient_name": ing_name,
            "facility_id": ii.facility_id,
            "facility_name": fac_name,
            "quantity_on_hand": float(ii.quantity_on_hand),
            "unit_abbreviation": unit_abbrev,
            "low_stock_threshold": float(ii.low_stock_threshold) if ii.low_stock_threshold else None,
            "is_low_stock": low,
        })
    return result


def create_transaction(db: Session, user_id: uuid.UUID | None = None, **kwargs) -> InventoryTransaction:
    txn = InventoryTransaction(transacted_by_user_id=user_id, **kwargs)
    db.add(txn)

    # Update materialized stock
    ii = (
        db.query(IngredientInventory)
        .filter(
            IngredientInventory.ingredient_id == kwargs["ingredient_id"],
            IngredientInventory.facility_id == kwargs["facility_id"],
            IngredientInventory.is_deleted == False,
        )
        .first()
    )
    if ii:
        ii.quantity_on_hand = float(ii.quantity_on_hand) + float(kwargs["quantity"])

    db.flush()
    return txn


def list_transactions(db: Session, *, ingredient_id: uuid.UUID | None = None, skip: int = 0, limit: int = 50) -> list[InventoryTransaction]:
    q = db.query(InventoryTransaction).filter(InventoryTransaction.is_deleted == False)
    if ingredient_id:
        q = q.filter(InventoryTransaction.ingredient_id == ingredient_id)
    return q.order_by(InventoryTransaction.transacted_at.desc()).offset(skip).limit(limit).all()


def recall_by_product_lot(db: Session, lot_code: str) -> dict:
    """Call sp_recall_by_product_lot via raw cursor for multi-result-set."""
    conn = db.connection()
    raw = conn.connection.cursor()
    raw.execute("EXEC dbo.sp_recall_by_product_lot ?", [lot_code])

    results = {}
    set_names = ["product_lot_info", "ingredient_lots_consumed", "distribution_records"]
    for name in set_names:
        if raw.description:
            cols = [col[0] for col in raw.description]
            results[name] = [dict(zip(cols, row)) for row in raw.fetchall()]
        else:
            results[name] = []
        if not raw.nextset():
            break
    return results


def recall_by_ingredient_lot(db: Session, lot_number: str) -> dict:
    """Call sp_recall_by_ingredient_lot via raw cursor for multi-result-set."""
    conn = db.connection()
    raw = conn.connection.cursor()
    raw.execute("EXEC dbo.sp_recall_by_ingredient_lot ?", [lot_number])

    results = {}
    set_names = ["ingredient_lot_info", "affected_runs", "product_lots", "distribution_records"]
    for name in set_names:
        if raw.description:
            cols = [col[0] for col in raw.description]
            results[name] = [dict(zip(cols, row)) for row in raw.fetchall()]
        else:
            results[name] = []
        if not raw.nextset():
            break
    return results
