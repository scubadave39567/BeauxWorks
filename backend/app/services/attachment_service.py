import hashlib
import uuid

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.models.products import Attachment, AttachmentLink


def upload_attachment(
    db: Session,
    *,
    file_name: str,
    content_type: str,
    file_data: bytes,
    uploaded_by_user_id: uuid.UUID,
    facility_id: uuid.UUID | None = None,
) -> Attachment:
    sha256 = hashlib.sha256(file_data).digest()
    attachment = Attachment(
        file_name=file_name,
        content_type=content_type,
        file_size_bytes=len(file_data),
        sha256_hash=sha256,
        uploaded_by_user_id=uploaded_by_user_id,
        facility_id=facility_id,
    )
    db.add(attachment)
    db.flush()

    # Write FILESTREAM blob via raw SQL
    db.execute(
        text("UPDATE dbo.attachments SET file_blob = :blob WHERE attachment_id = :aid"),
        {"blob": file_data, "aid": attachment.attachment_id},
    )
    db.flush()
    return attachment


def get_attachment(db: Session, attachment_id: uuid.UUID) -> Attachment:
    att = (
        db.query(Attachment)
        .filter(Attachment.attachment_id == attachment_id, Attachment.is_deleted == False)
        .first()
    )
    if not att:
        raise NotFoundError("Attachment not found")
    return att


def get_attachment_blob(db: Session, attachment_id: uuid.UUID) -> tuple[bytes, str, str]:
    """Returns (blob_data, file_name, content_type)."""
    result = db.execute(
        text("SELECT file_blob, file_name, content_type FROM dbo.attachments WHERE attachment_id = :aid AND is_deleted = 0"),
        {"aid": attachment_id},
    ).first()
    if not result or not result.file_blob:
        raise NotFoundError("Attachment blob not found")
    return result.file_blob, result.file_name, result.content_type


def link_attachment(
    db: Session,
    attachment_id: uuid.UUID,
    entity_type: str,
    entity_id: uuid.UUID,
    link_notes: str | None = None,
) -> AttachmentLink:
    link = AttachmentLink(
        attachment_id=attachment_id,
        entity_type=entity_type,
        entity_id=entity_id,
        link_notes=link_notes,
    )
    db.add(link)
    db.flush()
    return link
