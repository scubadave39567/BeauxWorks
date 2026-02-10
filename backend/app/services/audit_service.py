import json
import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models.identity import AuditLog


def write_audit_log(
    db: Session,
    *,
    action: str,
    actor_user_id: uuid.UUID | None = None,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    metadata_json: str | None = None,
    event_type: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    details_json = json.dumps(details, default=str) if details else None
    log = AuditLog(
        action=action,
        actor_user_id=actor_user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata_json=metadata_json,
        event_type=event_type,
        details_json=details_json,
    )
    db.add(log)
    db.flush()
