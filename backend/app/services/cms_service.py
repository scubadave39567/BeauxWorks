import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.models.cms import WebsiteProductContent, WebsiteProductImage


def list_published(db: Session) -> list[WebsiteProductContent]:
    return (
        db.query(WebsiteProductContent)
        .filter(
            WebsiteProductContent.is_published == True,
            WebsiteProductContent.is_deleted == False,
        )
        .order_by(WebsiteProductContent.sort_order)
        .all()
    )


def get_by_slug(db: Session, slug: str) -> WebsiteProductContent:
    content = (
        db.query(WebsiteProductContent)
        .filter(
            WebsiteProductContent.slug == slug,
            WebsiteProductContent.is_deleted == False,
        )
        .first()
    )
    if not content:
        raise NotFoundError("Product content not found")
    return content


def create_content(db: Session, **kwargs) -> WebsiteProductContent:
    content = WebsiteProductContent(**kwargs)
    if content.is_published and not content.published_at:
        content.published_at = datetime.now(timezone.utc)
    db.add(content)
    db.flush()
    return content


def update_content(db: Session, content: WebsiteProductContent, **kwargs) -> WebsiteProductContent:
    for key, value in kwargs.items():
        if value is not None:
            setattr(content, key, value)
    if content.is_published and not content.published_at:
        content.published_at = datetime.now(timezone.utc)
    db.flush()
    return content


def delete_content(db: Session, content: WebsiteProductContent) -> None:
    content.is_deleted = True
    db.flush()
