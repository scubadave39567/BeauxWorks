from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.common import IdResponse
from app.schemas.sales import SaleCreate, SaleResponse, SalesSummaryResponse
from app.services.sales_service import create_sale, get_sales_summary, list_sales

router = APIRouter(prefix="/sales", tags=["sales"])


@router.get("", response_model=list[SaleResponse])
def list_all(
    db: DbSession,
    product_id: UUID | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    return list_sales(db, product_id=product_id, skip=skip, limit=limit)


@router.post("", response_model=IdResponse, status_code=201)
def create(body: SaleCreate, current_user: CurrentUser, db: DbSession):
    sale = create_sale(db, user_id=current_user.user_id, **body.model_dump())
    db.commit()
    return IdResponse(id=sale.sale_id)


@router.get("/summary", response_model=list[SalesSummaryResponse])
def summary(db: DbSession, product_id: UUID | None = None):
    return get_sales_summary(db, product_id=product_id)
