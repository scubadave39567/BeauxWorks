from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AttachmentUploadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    attachment_id: UUID
    file_name: str
    content_type: str
    file_size_bytes: int
    uploaded_at: datetime


class AttachmentLinkRequest(BaseModel):
    entity_type: str
    entity_id: UUID
    link_notes: str | None = None
