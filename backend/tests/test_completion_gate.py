"""Unit tests for completion gating in app.services.run_lifecycle_service."""

import json
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.exceptions import BusinessError, NotFoundError
from app.services.run_lifecycle_service import transition_status


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
# Tests
# ---------------------------------------------------------------------------

class TestCompleteWithoutYieldRejected:
    def test_complete_without_yield_rejected(self):
        db = _make_db()
        run_id = uuid.uuid4()
        user_id = uuid.uuid4()

        run = SimpleNamespace(
            production_run_id=run_id,
            status="InProgress",
            is_deleted=False,
            target_yield_unit_id=uuid.uuid4(),
        )
        _setup_query_chain(db, run)

        with pytest.raises(BusinessError) as exc_info:
            transition_status(
                db,
                run_id=run_id,
                target_status="Completed",
                user_id=user_id,
                # final_yield_qty intentionally omitted
            )
        assert exc_info.value.error_code == "FINAL_YIELD_REQUIRED"


class TestCompleteWithYieldSucceeds:
    @patch("app.services.run_lifecycle_service.write_audit_log")
    def test_complete_with_yield_succeeds(self, mock_audit):
        db = _make_db()
        run_id = uuid.uuid4()
        user_id = uuid.uuid4()
        target_uom_id = uuid.uuid4()

        run = SimpleNamespace(
            production_run_id=run_id,
            status="InProgress",
            is_deleted=False,
            target_yield_unit_id=target_uom_id,
            actual_yield_value=None,
            actual_yield_unit_id=None,
            completed_at=None,
            run_status_id=None,
        )

        # First query: ProductionRun, second query: RunStatus for "completed"
        filter_run = MagicMock()
        filter_run.first.return_value = run

        completed_status = SimpleNamespace(run_status_id=uuid.uuid4())
        filter_status = MagicMock()
        filter_status.first.return_value = completed_status

        db.query.return_value.filter.side_effect = [filter_run, filter_status]

        result = transition_status(
            db,
            run_id=run_id,
            target_status="Completed",
            user_id=user_id,
            final_yield_qty=100.0,
        )

        assert result.status == "Completed"
        assert result.actual_yield_value == 100.0
        assert result.completed_at is not None
        mock_audit.assert_called_once()


class TestCannotCompleteFromPlanned:
    def test_cannot_complete_from_planned(self):
        db = _make_db()
        run_id = uuid.uuid4()
        user_id = uuid.uuid4()

        run = SimpleNamespace(
            production_run_id=run_id,
            status="Planned",
            is_deleted=False,
        )
        _setup_query_chain(db, run)

        with pytest.raises(BusinessError) as exc_info:
            transition_status(
                db,
                run_id=run_id,
                target_status="Completed",
                user_id=user_id,
            )
        assert exc_info.value.error_code == "INVALID_STATUS_TRANSITION"
