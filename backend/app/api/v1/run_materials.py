import uuid
from pydantic import BaseModel
from fastapi import APIRouter
from app.api.deps import DbSession, OperatorPlus
from app.schemas.api_response import ApiResponse
from app.services.materials_service import (
    generate_materials_plan,
    consume_material,
    consume_remaining,
    get_materials_summary,
)
from app.services.run_lifecycle_service import get_run

router = APIRouter(prefix="/runs/{run_id}/materials", tags=["run-materials"])


class ConsumeRequest(BaseModel):
    location_id: uuid.UUID | None = None
    qty: float
    uom_id: uuid.UUID
    lot_id: uuid.UUID | None = None
    notes: str | None = None


class ConsumeRemainingRequest(BaseModel):
    location_id: uuid.UUID | None = None
    lot_id: uuid.UUID | None = None


@router.get("", response_model=ApiResponse[list[dict]])
def api_get_materials(run_id: uuid.UUID, db: DbSession, user: OperatorPlus):
    summary = get_materials_summary(db, run_id)
    return ApiResponse.ok(summary)


@router.post("/generate", response_model=ApiResponse[dict])
def api_generate_materials(run_id: uuid.UUID, db: DbSession, user: OperatorPlus):
    run = get_run(db, run_id)
    materials = generate_materials_plan(db, run, user.user_id)
    db.commit()
    return ApiResponse.ok({"generated": len(materials)})


@router.post("/{material_id}/consume", response_model=ApiResponse[dict])
def api_consume_material(
    run_id: uuid.UUID, material_id: uuid.UUID, body: ConsumeRequest, db: DbSession, user: OperatorPlus
):
    txn = consume_material(
        db,
        run_material_id=material_id,
        location_id=body.location_id,
        qty=body.qty,
        uom_id=body.uom_id,
        lot_id=body.lot_id,
        notes=body.notes,
        user_id=user.user_id,
    )
    db.commit()
    return ApiResponse.ok({"transaction_id": str(txn.inventory_transaction_id)})


@router.post("/{material_id}/consume-remaining", response_model=ApiResponse[dict])
def api_consume_remaining(
    run_id: uuid.UUID, material_id: uuid.UUID, body: ConsumeRemainingRequest, db: DbSession, user: OperatorPlus
):
    txn = consume_remaining(
        db,
        run_material_id=material_id,
        location_id=body.location_id,
        lot_id=body.lot_id,
        user_id=user.user_id,
    )
    db.commit()
    return ApiResponse.ok({"transaction_id": str(txn.inventory_transaction_id)})
