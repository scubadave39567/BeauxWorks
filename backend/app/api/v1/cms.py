from uuid import UUID

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.cms import (
    CmsProductCreate,
    CmsProductUpdate,
    WebsiteProductDetailResponse,
    WebsiteProductImageResponse,
    WebsiteProductListingResponse,
)
from app.schemas.common import IdResponse
from app.services.cms_service import (
    create_content,
    delete_content,
    get_by_slug,
    list_published,
    update_content,
)

router = APIRouter(prefix="/cms", tags=["cms"])


# --- Public endpoints ---

@router.get("/products", response_model=list[WebsiteProductListingResponse])
def public_list(db: DbSession):
    items = list_published(db)
    result = []
    for item in items:
        primary = None
        for img in item.images:
            if img.is_primary and not img.is_deleted:
                primary = img
                break
        result.append(
            WebsiteProductListingResponse(
                website_product_content_id=item.website_product_content_id,
                product_id=item.product_id,
                slug=item.slug,
                public_name=item.public_name,
                short_description=item.short_description,
                display_price=float(item.display_price) if item.display_price else None,
                price_label=item.price_label,
                availability_status=item.availability_status,
                is_featured=item.is_featured,
                primary_image_url=primary.image_url if primary else None,
                primary_image_alt=primary.alt_text if primary else None,
            )
        )
    return result


@router.get("/products/{slug}", response_model=WebsiteProductDetailResponse)
def public_detail(slug: str, db: DbSession):
    content = get_by_slug(db, slug)
    images = [
        WebsiteProductImageResponse(
            website_product_image_id=img.website_product_image_id,
            attachment_id=img.attachment_id,
            image_url=img.image_url,
            alt_text=img.alt_text,
            caption=img.caption,
            is_primary=img.is_primary,
            sort_order=img.sort_order,
        )
        for img in content.images
        if not img.is_deleted
    ]
    return WebsiteProductDetailResponse(
        website_product_content_id=content.website_product_content_id,
        product_id=content.product_id,
        slug=content.slug,
        public_name=content.public_name,
        public_description=content.public_description,
        short_description=content.short_description,
        display_price=float(content.display_price) if content.display_price else None,
        price_label=content.price_label,
        availability_status=content.availability_status,
        is_featured=content.is_featured,
        meta_title=content.meta_title,
        meta_description=content.meta_description,
        images=images,
    )


# --- Admin endpoints ---

@router.post("/admin/products", response_model=IdResponse, status_code=201)
def admin_create(body: CmsProductCreate, current_user: CurrentUser, db: DbSession):
    content = create_content(db, **body.model_dump())
    db.commit()
    return IdResponse(id=content.website_product_content_id)


@router.patch("/admin/products/{content_id}", response_model=WebsiteProductDetailResponse)
def admin_update(content_id: UUID, body: CmsProductUpdate, current_user: CurrentUser, db: DbSession):
    from app.models.cms import WebsiteProductContent

    content = (
        db.query(WebsiteProductContent)
        .filter(
            WebsiteProductContent.website_product_content_id == content_id,
            WebsiteProductContent.is_deleted == False,
        )
        .first()
    )
    if not content:
        from app.exceptions import NotFoundError
        raise NotFoundError("CMS content not found")
    update_content(db, content, **body.model_dump(exclude_unset=True))
    db.commit()
    db.refresh(content)
    return public_detail(content.slug, db)


@router.delete("/admin/products/{content_id}", status_code=204)
def admin_delete(content_id: UUID, current_user: CurrentUser, db: DbSession):
    from app.models.cms import WebsiteProductContent

    content = (
        db.query(WebsiteProductContent)
        .filter(
            WebsiteProductContent.website_product_content_id == content_id,
            WebsiteProductContent.is_deleted == False,
        )
        .first()
    )
    if not content:
        from app.exceptions import NotFoundError
        raise NotFoundError("CMS content not found")
    delete_content(db, content)
    db.commit()
