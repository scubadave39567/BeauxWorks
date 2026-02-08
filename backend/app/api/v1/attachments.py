import hashlib
from uuid import UUID

from fastapi import APIRouter, UploadFile, File
from fastapi.responses import StreamingResponse

from app.api.deps import CurrentUser, DbSession
from app.schemas.attachments import AttachmentLinkRequest, AttachmentUploadResponse
from app.schemas.common import IdResponse
from app.services.attachment_service import (
    get_attachment,
    get_attachment_blob,
    link_attachment,
    upload_attachment,
)

router = APIRouter(prefix="/attachments", tags=["attachments"])


@router.post("/upload", response_model=AttachmentUploadResponse, status_code=201)
def upload(
    current_user: CurrentUser,
    db: DbSession,
    file: UploadFile = File(...),
    facility_id: UUID | None = None,
):
    file_data = file.file.read()
    attachment = upload_attachment(
        db,
        file_name=file.filename or "unnamed",
        content_type=file.content_type or "application/octet-stream",
        file_data=file_data,
        uploaded_by_user_id=current_user.user_id,
        facility_id=facility_id,
    )
    db.commit()
    return AttachmentUploadResponse(
        attachment_id=attachment.attachment_id,
        file_name=attachment.file_name,
        content_type=attachment.content_type,
        file_size_bytes=attachment.file_size_bytes,
        uploaded_at=attachment.uploaded_at,
    )


@router.get("/{attachment_id}/download")
def download(attachment_id: UUID, db: DbSession):
    blob, file_name, content_type = get_attachment_blob(db, attachment_id)

    def _iter():
        yield blob

    return StreamingResponse(
        _iter(),
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )


@router.post("/{attachment_id}/link", response_model=IdResponse, status_code=201)
def link(
    attachment_id: UUID,
    body: AttachmentLinkRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    lnk = link_attachment(
        db,
        attachment_id=attachment_id,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        link_notes=body.link_notes,
    )
    db.commit()
    return IdResponse(id=lnk.attachment_link_id)
