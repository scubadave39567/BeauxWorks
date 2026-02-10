"""Unit tests for app.services.qc_entry_service."""

import json
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.exceptions import BusinessError, NotFoundError
from app.services.qc_entry_service import record_entry, amend_entry, evaluate_requirements


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


def _setup_query_chain_all(db, return_value):
    """Wire db.query(...).filter(...).all() to return *return_value*."""
    mock_filter = MagicMock()
    mock_filter.all.return_value = return_value
    db.query.return_value.filter.return_value = mock_filter
    return mock_filter


# ---------------------------------------------------------------------------
# Tests – record_entry
# ---------------------------------------------------------------------------

class TestRecordEntryRequiresInProgress:
    def test_record_entry_requires_in_progress(self):
        db = _make_db()
        run = SimpleNamespace(
            production_run_id=uuid.uuid4(),
            status="Completed",
            is_deleted=False,
        )
        _setup_query_chain(db, run)

        with pytest.raises(BusinessError) as exc_info:
            record_entry(
                db,
                run_id=run.production_run_id,
                metric_type_id=uuid.uuid4(),
                stage="Mixing",
                user_id=uuid.uuid4(),
            )
        assert exc_info.value.error_code == "INVALID_RUN_STATUS"


class TestRecordEntryValidatesNumericValue:
    def test_record_entry_validates_numeric_value(self):
        db = _make_db()
        run_id = uuid.uuid4()
        metric_id = uuid.uuid4()

        run = SimpleNamespace(
            production_run_id=run_id,
            status="InProgress",
            is_deleted=False,
        )
        metric = SimpleNamespace(
            quality_metric_type_id=metric_id,
            data_type="Number",
            requires_notes=False,
            is_deleted=False,
        )

        # First query → ProductionRun, second query → QualityMetricType
        filter_run = MagicMock()
        filter_run.first.return_value = run

        filter_metric = MagicMock()
        filter_metric.first.return_value = metric

        db.query.return_value.filter.side_effect = [filter_run, filter_metric]

        with pytest.raises(BusinessError) as exc_info:
            record_entry(
                db,
                run_id=run_id,
                metric_type_id=metric_id,
                stage="Mixing",
                # value_number intentionally omitted
                user_id=uuid.uuid4(),
            )
        assert exc_info.value.error_code == "VALUE_REQUIRED"


class TestRecordEntryRequiresNotesWhenMetricSaysSo:
    def test_record_entry_requires_notes_when_metric_says_so(self):
        db = _make_db()
        run_id = uuid.uuid4()
        metric_id = uuid.uuid4()

        run = SimpleNamespace(
            production_run_id=run_id,
            status="InProgress",
            is_deleted=False,
        )
        metric = SimpleNamespace(
            quality_metric_type_id=metric_id,
            data_type="Number",
            requires_notes=True,
            is_deleted=False,
        )

        filter_run = MagicMock()
        filter_run.first.return_value = run

        filter_metric = MagicMock()
        filter_metric.first.return_value = metric

        db.query.return_value.filter.side_effect = [filter_run, filter_metric]

        with pytest.raises(BusinessError) as exc_info:
            record_entry(
                db,
                run_id=run_id,
                metric_type_id=metric_id,
                stage="Mixing",
                value_number=7.0,
                # notes intentionally omitted
                user_id=uuid.uuid4(),
            )
        assert exc_info.value.error_code == "NOTES_REQUIRED"


class TestRecordEntrySuccess:
    @patch("app.services.qc_entry_service._check_acceptance", return_value=None)
    @patch("app.services.qc_entry_service.write_audit_log")
    def test_record_entry_success(self, mock_audit, mock_check):
        db = _make_db()
        run_id = uuid.uuid4()
        metric_id = uuid.uuid4()
        user_id = uuid.uuid4()

        run = SimpleNamespace(
            production_run_id=run_id,
            status="InProgress",
            is_deleted=False,
            snapshot_json=None,
        )
        metric = SimpleNamespace(
            quality_metric_type_id=metric_id,
            data_type="Number",
            requires_notes=False,
            is_deleted=False,
        )

        filter_run = MagicMock()
        filter_run.first.return_value = run

        filter_metric = MagicMock()
        filter_metric.first.return_value = metric

        db.query.return_value.filter.side_effect = [filter_run, filter_metric]

        entry = record_entry(
            db,
            run_id=run_id,
            metric_type_id=metric_id,
            stage="Mixing",
            value_number=7.5,
            user_id=user_id,
        )

        db.add.assert_called_once()
        assert entry.value_number == 7.5
        assert entry.production_run_id == run_id
        assert entry.stage == "Mixing"


class TestRecordEntryFailRequiresDeviation:
    @patch("app.services.qc_entry_service.write_audit_log")
    def test_record_entry_fail_requires_deviation(self, mock_audit):
        db = _make_db()
        run_id = uuid.uuid4()
        metric_id = uuid.uuid4()
        user_id = uuid.uuid4()

        snapshot = {
            "qc_requirements": [
                {
                    "metric_type_id": str(metric_id),
                    "stage": "Mixing",
                    "fail_requires_deviation": True,
                    "min_value": 5.0,
                    "max_value": 10.0,
                }
            ]
        }

        run = SimpleNamespace(
            production_run_id=run_id,
            status="InProgress",
            is_deleted=False,
            snapshot_json=json.dumps(snapshot),
        )
        metric = SimpleNamespace(
            quality_metric_type_id=metric_id,
            data_type="Number",
            requires_notes=False,
            is_deleted=False,
        )

        filter_run = MagicMock()
        filter_run.first.return_value = run

        filter_metric = MagicMock()
        filter_metric.first.return_value = metric

        db.query.return_value.filter.side_effect = [filter_run, filter_metric]

        with pytest.raises(BusinessError) as exc_info:
            record_entry(
                db,
                run_id=run_id,
                metric_type_id=metric_id,
                stage="Mixing",
                value_number=15.0,  # above max_value of 10.0
                user_id=user_id,
            )
        assert exc_info.value.error_code == "QC_FAIL_REQUIRES_DEVIATION"


# ---------------------------------------------------------------------------
# Tests – amend_entry
# ---------------------------------------------------------------------------

class TestAmendEntrySetsAmendedFields:
    @patch("app.services.qc_entry_service.write_audit_log")
    def test_amend_entry_sets_amended_fields(self, mock_audit):
        db = _make_db()
        entry_id = uuid.uuid4()
        user_id = uuid.uuid4()

        entry = SimpleNamespace(
            run_qc_entry_id=entry_id,
            value_number=5.0,
            value_text=None,
            is_amended=False,
            amended_at=None,
            amended_by_user_id=None,
            amended_reason=None,
            is_deleted=False,
        )
        _setup_query_chain(db, entry)

        result = amend_entry(
            db,
            entry_id=entry_id,
            value_number=6.0,
            reason="Correction",
            user_id=user_id,
        )

        assert result.is_amended is True
        assert result.value_number == 6.0
        assert result.amended_reason == "Correction"
        assert result.amended_by_user_id == user_id
        mock_audit.assert_called_once()


# ---------------------------------------------------------------------------
# Tests – evaluate_requirements
# ---------------------------------------------------------------------------

class TestEvaluateRequirementsReturnsStatus:
    def test_evaluate_requirements_returns_status(self):
        db = _make_db()
        run_id = uuid.uuid4()
        metric_id = uuid.uuid4()

        snapshot = {
            "qc_requirements": [
                {
                    "metric_type_id": str(metric_id),
                    "metric_type_name": "pH",
                    "stage": "Mixing",
                    "required": True,
                    "min_value": 5.0,
                    "max_value": 7.0,
                    "fail_requires_deviation": True,
                }
            ]
        }

        run = SimpleNamespace(
            production_run_id=run_id,
            status="InProgress",
            is_deleted=False,
            snapshot_json=json.dumps(snapshot),
        )

        entry = SimpleNamespace(
            metric_type_id=metric_id,
            stage="Mixing",
            value_number=6.0,
            is_deleted=False,
        )

        # First query → ProductionRun (filter().first())
        # Second query → RunQcEntry list (filter().all())
        filter_run = MagicMock()
        filter_run.first.return_value = run

        filter_entries = MagicMock()
        filter_entries.all.return_value = [entry]

        db.query.return_value.filter.side_effect = [filter_run, filter_entries]

        results = evaluate_requirements(db, run_id)

        assert len(results) == 1
        req_status = results[0]
        assert req_status["metric_type_id"] == str(metric_id)
        assert req_status["metric_type_name"] == "pH"
        assert req_status["stage"] == "Mixing"
        assert req_status["fulfilled"] is True
        assert req_status["in_range"] is True
        assert req_status["fail_requires_deviation"] is True
        assert req_status["entry_count"] == 1
