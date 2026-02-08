import uuid

from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.models.products import Product


def list_products(db: Session) -> list[Product]:
    return (
        db.query(Product)
        .filter(Product.is_deleted == False)
        .order_by(Product.name)
        .all()
    )


def get_product(db: Session, product_id: uuid.UUID) -> Product:
    product = (
        db.query(Product)
        .filter(Product.product_id == product_id, Product.is_deleted == False)
        .first()
    )
    if not product:
        raise NotFoundError("Product not found")
    return product


def create_product(db: Session, **kwargs) -> Product:
    product = Product(**kwargs)
    db.add(product)
    db.flush()
    return product


def update_product(db: Session, product: Product, **kwargs) -> Product:
    for key, value in kwargs.items():
        if value is not None:
            setattr(product, key, value)
    db.flush()
    return product


def delete_product(db: Session, product: Product) -> None:
    product.is_deleted = True
    db.flush()
