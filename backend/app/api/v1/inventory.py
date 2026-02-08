from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.common import IdResponse
from app.schemas.inventory import (
    InventoryStatusResponse,
    RecallResponse,
    TransactionCreate,
    TransactionResponse,
)
from app.services.inventory_service import (
    create_transaction,
    get_inventory_status,
    list_transactions,
    recall_by_ingredient_lot,
    recall_by_product_lot,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("/status", response_model=list[InventoryStatusResponse])
def status(db: DbSession):
    return get_inventory_status(db)


@router.get("/transactions", response_model=list[TransactionResponse])
def transactions(
    db: DbSession,
    ingredient_id: UUID | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    return list_transactions(db, ingredient_id=ingredient_id, skip=skip, limit=limit)


@router.post("/transactions", response_model=IdResponse, status_code=201)
def create_txn(body: TransactionCreate, current_user: CurrentUser, db: DbSession):
    txn = create_transaction(
        db,
        user_id=current_user.user_id,
        **body.model_dump(),
    )
    db.commit()
    return IdResponse(id=txn.inventory_transaction_id)


@router.get("/recall/by-product-lot/{lot_code}")
def recall_product(lot_code: str, db: DbSession):
    return recall_by_product_lot(db, lot_code)


@router.get("/recall/by-ingredient-lot/{lot_number}")
def recall_ingredient(lot_number: str, db: DbSession):
    return recall_by_ingredient_lot(db, lot_number)
