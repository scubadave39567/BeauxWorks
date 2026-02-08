import uuid

from sqlalchemy import cast, func
from sqlalchemy.orm import Session

from app.models.foundations import Facility, SalesChannel, Unit
from app.models.products import Product, Sale


def list_sales(db: Session, *, product_id: uuid.UUID | None = None, skip: int = 0, limit: int = 50) -> list[Sale]:
    q = db.query(Sale).filter(Sale.is_deleted == False)
    if product_id:
        q = q.filter(Sale.product_id == product_id)
    return q.order_by(Sale.sale_date.desc()).offset(skip).limit(limit).all()


def create_sale(db: Session, user_id: uuid.UUID | None = None, **kwargs) -> Sale:
    sale = Sale(recorded_by_user_id=user_id, **kwargs)
    db.add(sale)
    db.flush()
    return sale


def get_sales_summary(db: Session, *, product_id: uuid.UUID | None = None) -> list[dict]:
    q = (
        db.query(
            Product.name.label("product_name"),
            SalesChannel.name.label("channel_name"),
            func.cast(Sale.sale_date, type_=Sale.sale_date.type).label("sale_day"),
            func.count().label("transaction_count"),
            func.sum(Sale.quantity).label("total_quantity"),
            func.sum(Sale.total_price).label("total_revenue"),
        )
        .join(Product, Sale.product_id == Product.product_id)
        .join(SalesChannel, Sale.sales_channel_id == SalesChannel.sales_channel_id)
        .filter(Sale.is_deleted == False)
    )
    if product_id:
        q = q.filter(Sale.product_id == product_id)
    q = q.group_by(Product.name, SalesChannel.name, Sale.sale_date)
    rows = q.all()
    return [
        {
            "product_name": r.product_name,
            "channel_name": r.channel_name,
            "sale_day": str(r.sale_day),
            "transaction_count": r.transaction_count,
            "total_quantity": float(r.total_quantity) if r.total_quantity else 0,
            "total_revenue": float(r.total_revenue) if r.total_revenue else 0,
        }
        for r in rows
    ]
