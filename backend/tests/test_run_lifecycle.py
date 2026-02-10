"""
Unit tests for ``app.services.run_lifecycle_service``.

Every test mocks the SQLAlchemy session so that no real MSSQL connection is
required.  The three external helpers (``write_audit_log``,
``build_run_snapshot``, ``build_scaling_json``) are patched at module level
so they never touch the database either.
"""

import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.exceptions import BusinessError, NotFoundError
from app.services.run_lifecycle_service import (
    VALID_TRANSITIONS,
    create_run,
    transition_status,
)

# ---------------------------------------------------------------------------
# Module-level patch targets
# ---------------------------------------------------------------------------
_SVC = "app.services.run_lifecycle_service"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _stub_query_side_effect(mapping: dict):
    """Return a ``side_effect`` callable for ``db.query``.

    *mapping* maps SQLAlchemy model classes to the value that
    ``.filter(...).first()`` should return.  Every ``.filter()`` call
    returns the same chainable mock so that arbitrary filter expressions
    work transparently.

    Usage::

        db.query.side_effect = _stub_query_side_effect({
            RecipeVersion: mock_recipe_version,
            RunStatus: mock_run_status,
        })
    """

    def _side_effect(model_cls):
        chain = MagicMock()
        chain.filter.return_value = chain          # .filter() returns self
        chain.first.return_value = mapping.get(model_cls)
        return chain

    return _side_effect


# ===================================================================
# create_run
# ===================================================================

class TestCreateRun:

    @patch(f"{_SVC}.write_audit_log")
    def test_create_run_requires_released_version(
        self, _audit, mock_db, make_recipe_version, mock_user
    ):
        """A recipe version that is *not* Released must be rejected."""
        draft_rv = make_recipe_version(status="Draft")

        from app.models.recipes import RecipeVersion

        mock_db.query.side_effect = _stub_query_side_effect({
            RecipeVersion: draft_rv,
        })

        with pytest.raises(BusinessError) as exc_info:
            create_run(
                mock_db,
                recipe_version_id=draft_rv.recipe_version_id,
                facility_id=uuid4(),
                target_yield_qty=500,
                target_yield_uom_id=uuid4(),
                user_id=mock_user.user_id,
            )

        assert exc_info.value.error_code == "RECIPE_NOT_RELEASED"

    @patch(f"{_SVC}.write_audit_log")
    def test_create_run_success(
        self, _audit, mock_db, make_recipe_version, mock_user
    ):
        """A Released recipe version produces a Planned ProductionRun."""
        released_rv = make_recipe_version(status="Released")
        planned_status = SimpleNamespace(run_status_id=uuid4())

        from app.models.foundations import RunStatus
        from app.models.recipes import RecipeVersion

        mock_db.query.side_effect = _stub_query_side_effect({
            RecipeVersion: released_rv,
            RunStatus: planned_status,
        })

        facility_id = uuid4()
        uom_id = uuid4()

        run = create_run(
            mock_db,
            recipe_version_id=released_rv.recipe_version_id,
            facility_id=facility_id,
            target_yield_qty=500,
            target_yield_uom_id=uom_id,
            user_id=mock_user.user_id,
        )

        # The service calls db.add(run) then db.flush()
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()

        added_run = mock_db.add.call_args[0][0]
        assert added_run.status == "Planned"
        assert added_run.recipe_version_id == released_rv.recipe_version_id
        assert added_run.facility_id == facility_id
        assert added_run.target_yield_value == 500
        assert added_run.target_yield_unit_id == uom_id
        assert added_run.run_status_id == planned_status.run_status_id


# ===================================================================
# transition_status
# ===================================================================

class TestTransitionStatus:

    # ---------------------------------------------------------------
    # Planned -> InProgress
    # ---------------------------------------------------------------

    @patch(f"{_SVC}.build_scaling_json", return_value={"multiplier": 1.0})
    @patch(
        f"{_SVC}.build_run_snapshot",
        return_value={"ingredients": [], "steps": [], "qc_requirements": []},
    )
    @patch(f"{_SVC}.write_audit_log")
    def test_transition_planned_to_in_progress(
        self, _audit, _snap, _scale, mock_db, make_run, mock_user
    ):
        """Planned -> InProgress sets snapshot_json and started_at."""
        run = make_run(status="Planned")
        in_progress_status = SimpleNamespace(run_status_id=uuid4())

        from app.models.foundations import RunStatus
        from app.models.production import ProductionRun

        mock_db.query.side_effect = _stub_query_side_effect({
            ProductionRun: run,
            RunStatus: in_progress_status,
        })

        result = transition_status(
            mock_db,
            run_id=run.production_run_id,
            target_status="InProgress",
            user_id=mock_user.user_id,
        )

        assert result.status == "InProgress"
        assert result.snapshot_json is not None
        assert result.started_at is not None
        assert result.scaling_json is not None

    # ---------------------------------------------------------------
    # Invalid transition (Completed -> InProgress)
    # ---------------------------------------------------------------

    @patch(f"{_SVC}.write_audit_log")
    def test_transition_invalid_rejected(
        self, _audit, mock_db, make_run, mock_user
    ):
        """Completed -> InProgress is not a valid transition."""
        run = make_run(status="Completed")

        from app.models.production import ProductionRun

        mock_db.query.side_effect = _stub_query_side_effect({
            ProductionRun: run,
        })

        with pytest.raises(BusinessError) as exc_info:
            transition_status(
                mock_db,
                run_id=run.production_run_id,
                target_status="InProgress",
                user_id=mock_user.user_id,
            )

        assert exc_info.value.error_code == "INVALID_STATUS_TRANSITION"

    # ---------------------------------------------------------------
    # InProgress -> Completed  (missing yield)
    # ---------------------------------------------------------------

    @patch(f"{_SVC}.write_audit_log")
    def test_transition_to_completed_requires_yield(
        self, _audit, mock_db, make_run, mock_user
    ):
        """Completing a run without a final yield quantity must fail."""
        run = make_run(status="InProgress")

        from app.models.production import ProductionRun

        mock_db.query.side_effect = _stub_query_side_effect({
            ProductionRun: run,
        })

        with pytest.raises(BusinessError) as exc_info:
            transition_status(
                mock_db,
                run_id=run.production_run_id,
                target_status="Completed",
                user_id=mock_user.user_id,
                # final_yield_qty intentionally omitted
            )

        assert exc_info.value.error_code == "FINAL_YIELD_REQUIRED"

    # ---------------------------------------------------------------
    # InProgress -> Completed  (success)
    # ---------------------------------------------------------------

    @patch(f"{_SVC}.write_audit_log")
    def test_transition_to_completed_success(
        self, _audit, mock_db, make_run, mock_user
    ):
        """Providing a final yield allows the run to complete."""
        run = make_run(status="InProgress")
        completed_status = SimpleNamespace(run_status_id=uuid4())

        from app.models.foundations import RunStatus
        from app.models.production import ProductionRun

        mock_db.query.side_effect = _stub_query_side_effect({
            ProductionRun: run,
            RunStatus: completed_status,
        })

        result = transition_status(
            mock_db,
            run_id=run.production_run_id,
            target_status="Completed",
            user_id=mock_user.user_id,
            final_yield_qty=100,
        )

        assert result.status == "Completed"
        assert result.actual_yield_value == 100
        assert result.completed_at is not None

    # ---------------------------------------------------------------
    # Planned -> Canceled
    # ---------------------------------------------------------------

    @patch(f"{_SVC}.write_audit_log")
    def test_transition_to_canceled(
        self, _audit, mock_db, make_run, mock_user
    ):
        """A Planned run can be canceled."""
        run = make_run(status="Planned")
        canceled_status = SimpleNamespace(run_status_id=uuid4())

        from app.models.foundations import RunStatus
        from app.models.production import ProductionRun

        mock_db.query.side_effect = _stub_query_side_effect({
            ProductionRun: run,
            RunStatus: canceled_status,
        })

        result = transition_status(
            mock_db,
            run_id=run.production_run_id,
            target_status="Canceled",
            user_id=mock_user.user_id,
        )

        assert result.status == "Canceled"
