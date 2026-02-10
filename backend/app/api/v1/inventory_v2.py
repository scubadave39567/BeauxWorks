import uuid
from pydantic import BaseModel
from fastapi import APIRouter, Query
from app.api.deps import DbSession, OperatorPlus, AdminOrQA
from app.schemas.api_response import ApiResponse
from app.services.inventory_ledger_service import (
    get_onhand,
    receive_inventory,
    adjust_inventory,
    transfer_inventory,
    void_transaction,
)

router = APIRouter(prefix="/inventory", tags=["inventory-v2"])


class ReceiveRequest(BaseModel):
    facility_id: uuid.UUID
    location_id: uuid.UUID | None = None
    item_id: uuid.UUID
    lot_id: uuid.UUID | None = None
    qty: float
    uom_id: uuid.UUID


class AdjustRequest(BaseModel):
    facility_id: uuid.UUID
    location_id: uuid.UUID | None = None
    item_id: uuid.UUID
    qty: float
    reason_code: str


class TransferRequest(BaseModel):
    from_facility_id: uuid.UUID
    from_location_id: uuid.UUID | None = None
    to_facility_id: uuid.UUID
    to_location_id: uuid.UUID | None = None
    item_id: uuid.UUID
    lot_id: uuid.UUID | None = None
    qty: float
    uom_id: uuid.UUID


class VoidRequest(BaseModel):
    reason: str


@router.get("/onhand", response_model=ApiResponse[list[dict]])
def api_onhand(
    db: DbSession,
    user: OperatorPlus,
    facility_id: uuid.UUID = Query(...),
    item_id: uuid.UUID | None = Query(None),
    location_id: uuid.UUID | None = Query(None),
):
    data = get_onhand(db, facility_id, item_id=item_id, location_id=location_id)
    return ApiResponse.ok(data)


@router.post("/receive", response_model=ApiResponse[dict])
def api_receive(body: ReceiveRequest, db: DbSession, user: OperatorPlus):
    txn = receive_inventory(
        db,
        facility_id=body.facility_id,
        location_id=body.location_id,
        item_id=body.item_id,
        lot_id=body.lot_id,
        qty=body.qty,
        uom_id=body.uom_id,
        user_id=user.user_id,
    )
    db.commit()
    return ApiResponse.ok({"transaction_id": str(txn.inventory_transaction_id)})


@router.post("/adjust", response_model=ApiResponse[dict])
def api_adjust(body: AdjustRequest, db: DbSession, user: AdminOrQA):
    txn = adjust_inventory(
        db,
        facility_id=body.facility_id,
        location_id=body.location_id,
        item_id=body.item_id,
        qty=body.qty,
        reason_code=body.reason_code,
        user_id=user.user_id,
    )
    db.commit()
    return ApiResponse.ok({"transaction_id": str(txn.inventory_transaction_id)})


@router.post("/transfer", response_model=ApiResponse[dict])
def api_transfer(body: TransferRequest, db: DbSession, user: OperatorPlus):
    txn_out, txn_in = transfer_inventory(
        db,
        from_facility_id=body.from_facility_id,
        from_location_id=body.from_location_id,
        to_facility_id=body.to_facility_id,
        to_location_id=body.to_location_id,
        item_id=body.item_id,
        lot_id=body.lot_id,
        qty=body.qty,
        uom_id=body.uom_id,
        user_id=user.user_id,
    )
    db.commit()
    return ApiResponse.ok({
        "transfer_out_id": str(txn_out.inventory_transaction_id),
        "transfer_in_id": str(txn_in.inventory_transaction_id),
    })


@router.post("/transactions/{txn_id}/void", response_model=ApiResponse[dict])
def api_void(txn_id: uuid.UUID, body: VoidRequest, db: DbSession, user: AdminOrQA):
    txn = void_transaction(db, txn_id=txn_id, reason=body.reason, user_id=user.user_id)
    db.commit()
    return ApiResponse.ok({"voided": True, "transaction_id": str(txn.inventory_transaction_id)})
