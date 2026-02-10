"""Unit tests for recipe version release/retire in app.services.recipe_service."""

import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.exceptions import BusinessError, NotFoundError
from app.services.recipe_service import release_recipe_version, retire_recipe_version


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_db():
    """Return a MagicMock that behaves like a SQLAlchemy Session."""
    return MagicMock()


def _setup_query_chain(db, return_value):
    """Wire db.query(...).filter(...).first() to return *return_value*."""
    mock_filter = MagicMock()
    mock_filter.first.return_value = return_value
    db.query.return_value.filter.return_value = mock_filter
    return mock_filter


# ---------------------------------------------------------------------------
# Tests – release_recipe_version
# ---------------------------------------------------------------------------

class TestReleaseDraftVersion:
    def test_release_draft_version(self):
        db = _make_db()
        version_id = uuid.uuid4()
        user = SimpleNamespace(user_id=uuid.uuid4())

        version = SimpleNamespace(
            recipe_version_id=version_id,
            status="Draft",
            released_at=None,
            released_by_user_id=None,
        )
        _setup_query_chain(db, version)

        result = release_recipe_version(db, version_id, user)

        assert result.status == "Released"
        assert result.released_at is not None
        assert result.released_by_user_id == user.user_id
        db.flush.assert_called_once()


class TestCannotReleaseAlreadyReleased:
    def test_cannot_release_already_released(self):
        db = _make_db()
        version_id = uuid.uuid4()
        user = SimpleNamespace(user_id=uuid.uuid4())

        version = SimpleNamespace(
            recipe_version_id=version_id,
            status="Released",
            released_at=None,
            released_by_user_id=None,
        )
        _setup_query_chain(db, version)

        with pytest.raises(BusinessError) as exc_info:
            release_recipe_version(db, version_id, user)
        assert exc_info.value.error_code == "INVALID_STATUS"


# ---------------------------------------------------------------------------
# Tests – retire_recipe_version
# ---------------------------------------------------------------------------

class TestRetireReleasedVersion:
    def test_retire_released_version(self):
        db = _make_db()
        version_id = uuid.uuid4()
        user = SimpleNamespace(user_id=uuid.uuid4())

        version = SimpleNamespace(
            recipe_version_id=version_id,
            status="Released",
        )
        _setup_query_chain(db, version)

        result = retire_recipe_version(db, version_id, user)

        assert result.status == "Retired"
        db.flush.assert_called_once()


class TestCannotRetireDraft:
    def test_cannot_retire_draft(self):
        db = _make_db()
        version_id = uuid.uuid4()
        user = SimpleNamespace(user_id=uuid.uuid4())

        version = SimpleNamespace(
            recipe_version_id=version_id,
            status="Draft",
        )
        _setup_query_chain(db, version)

        with pytest.raises(BusinessError) as exc_info:
            retire_recipe_version(db, version_id, user)
        assert exc_info.value.error_code == "INVALID_STATUS"


class TestCannotRetireAlreadyRetired:
    def test_cannot_retire_already_retired(self):
        db = _make_db()
        version_id = uuid.uuid4()
        user = SimpleNamespace(user_id=uuid.uuid4())

        version = SimpleNamespace(
            recipe_version_id=version_id,
            status="Retired",
        )
        _setup_query_chain(db, version)

        with pytest.raises(BusinessError) as exc_info:
            retire_recipe_version(db, version_id, user)
        assert exc_info.value.error_code == "INVALID_STATUS"
