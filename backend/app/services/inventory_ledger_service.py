import uuid
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.exceptions import BusinessError, NotFoundError
from app.models.inventory import InventoryTransaction
from app.services.audit_service import write_audit_log


def get_onhand(
    db: Session,
    facility_id: uuid.UUID,
    *,
    item_id: uuid.UUID | None = None,
    location_id: uuid.UUID | None = None,
) -> list[dict]:
    """Computed on-hand = SUM(qty) from non-voided transactions, grouped by item."""
    q = (
        db.query(
            InventoryTransaction.ingredient_id,
            func.sum(InventoryTransaction.quantity).label("on_hand"),
        )
        .filter(
            InventoryTransaction.facility_id == facility_id,
            InventoryTransaction.voided_at == None,
            InventoryTransaction.is_deleted == False,
        )
        .group_by(InventoryTransaction.ingredient_id)
    )
    if item_id:
        q = q.filter(InventoryTransaction.ingredient_id == item_id)
    if location_id:
        q = q.filter(InventoryTransaction.location_id == location_id)

    rows = q.all()
    return [
        {"item_id": str(row.ingredient_id), "on_hand": float(row.on_hand)}
        for row in rows
    ]


def receive_inventory(
    db: Session,
    *,
    facility_id: uuid.UUID,
    location_id: uuid.UUID | None,
    item_id: uuid.UUID,
    lot_id: uuid.UUID | None,
    qty: float,
    uom_id: uuid.UUID,
    user_id: uuid.UUID,
) -> InventoryTransaction:
    txn = InventoryTransaction(
        ingredient_id=item_id,
        facility_id=facility_id,
        ingredient_lot_id=lot_id,
        transaction_type="Receive",
        quantity=abs(qty),  # positive
        unit_id=uom_id,
        transacted_by_user_id=user_id,
        location_id=location_id,
    )
    db.add(txn)
    db.flush()

    write_audit_log(
        db, action="InventoryReceived", actor_user_id=user_id,
        entity_type="InventoryTransaction", entity_id=txn.inventory_transaction_id,
        event_type="InventoryReceived",
        details={"item_id": str(item_id), "qty": qty},
    )
    return txn


def adjust_inventory(
    db: Session,
    *,
    facility_id: uuid.UUID,
    location_id: uuid.UUID | None,
    item_id: uuid.UUID,
    qty: float,
    reason_code: str,
    user_id: uuid.UUID,
) -> InventoryTransaction:
    txn = InventoryTransaction(
        ingredient_id=item_id,
        facility_id=facility_id,
        transaction_type="Adjust",
        quantity=qty,  # can be positive or negative
        unit_id=None,  # will need a default or be required
        transacted_by_user_id=user_id,
        location_id=location_id,
        reason_code=reason_code,
    )
    db.add(txn)
    db.flush()

    write_audit_log(
        db, action="InventoryAdjusted", actor_user_id=user_id,
        entity_type="InventoryTransaction", entity_id=txn.inventory_transaction_id,
        event_type="InventoryAdjusted",
        details={"item_id": str(item_id), "qty": qty, "reason_code": reason_code},
    )
    return txn


def transfer_inventory(
    db: Session,
    *,
    from_facility_id: uuid.UUID,
    from_location_id: uuid.UUID | None,
    to_facility_id: uuid.UUID,
    to_location_id: uuid.UUID | None,
    item_id: uuid.UUID,
    lot_id: uuid.UUID | None,
    qty: float,
    uom_id: uuid.UUID,
    user_id: uuid.UUID,
) -> tuple[InventoryTransaction, InventoryTransaction]:
    transfer_ref = uuid.uuid4()

    txn_out = InventoryTransaction(
        ingredient_id=item_id,
        facility_id=from_facility_id,
        ingredient_lot_id=lot_id,
        transaction_type="TransferOut",
        quantity=-abs(qty),
        unit_id=uom_id,
        transacted_by_user_id=user_id,
        location_id=from_location_id,
        reference_type="Transfer",
        reference_id=transfer_ref,
    )
    txn_in = InventoryTransaction(
        ingredient_id=item_id,
        facility_id=to_facility_id,
        ingredient_lot_id=lot_id,
        transaction_type="TransferIn",
        quantity=abs(qty),
        unit_id=uom_id,
        transacted_by_user_id=user_id,
        location_id=to_location_id,
        reference_type="Transfer",
        reference_id=transfer_ref,
    )
    db.add(txn_out)
    db.add(txn_in)
    db.flush()

    write_audit_log(
        db, action="InventoryTransferred", actor_user_id=user_id,
        entity_type="InventoryTransaction", entity_id=txn_out.inventory_transaction_id,
        event_type="InventoryTransferred",
        details={"item_id": str(item_id), "qty": qty, "from": str(from_facility_id), "to": str(to_facility_id)},
    )
    return txn_out, txn_in


def void_transaction(
    db: Session,
    *,
    txn_id: uuid.UUID,
    reason: str,
    user_id: uuid.UUID,
) -> InventoryTransaction:
    txn = (
        db.query(InventoryTransaction)
        .filter(InventoryTransaction.inventory_transaction_id == txn_id, InventoryTransaction.is_deleted == False)
        .first()
    )
    if not txn:
        raise NotFoundError("Transaction not found")
    if txn.voided_at is not None:
        raise BusinessError("Transaction already voided", error_code="ALREADY_VOIDED")

    txn.voided_at = datetime.now(timezone.utc)
    txn.voided_by_user_id = user_id
    txn.void_reason = reason
    db.flush()

    write_audit_log(
        db, action="LedgerVoided", actor_user_id=user_id,
        entity_type="InventoryTransaction", entity_id=txn.inventory_transaction_id,
        event_type="LedgerVoided",
        details={"reason": reason},
    )
    return txn
