from uuid import UUID

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.common import IdResponse
from app.schemas.products import ProductCreate, ProductResponse, ProductUpdate
from app.services.product_service import (
    create_product,
    delete_product,
    get_product,
    list_products,
    update_product,
)

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductResponse])
def list_all(db: DbSession):
    return list_products(db)


@router.get("/{product_id}", response_model=ProductResponse)
def get_one(product_id: UUID, db: DbSession):
    return get_product(db, product_id)


@router.post("", response_model=IdResponse, status_code=201)
def create(body: ProductCreate, current_user: CurrentUser, db: DbSession):
    product = create_product(db, **body.model_dump())
    db.commit()
    return IdResponse(id=product.product_id)


@router.patch("/{product_id}", response_model=ProductResponse)
def update(product_id: UUID, body: ProductUpdate, current_user: CurrentUser, db: DbSession):
    product = get_product(db, product_id)
    update_product(db, product, **body.model_dump(exclude_unset=True))
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=204)
def delete(product_id: UUID, current_user: CurrentUser, db: DbSession):
    product = get_product(db, product_id)
    delete_product(db, product)
    db.commit()
