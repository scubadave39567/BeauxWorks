"""Tests for app.services.scaling_service -- preview_scale & apply_scale."""

import json
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.exceptions import BusinessError, NotFoundError
from app.models.inventory import InventoryTransaction
from app.models.production import ProductionRun
from app.services.scaling_service import apply_scale, preview_scale


# ---------------------------------------------------------------------------
# preview_scale
# ---------------------------------------------------------------------------

class TestPreviewScale:
    """Unit tests for the preview_scale helper."""

    def test_preview_scale_computes_multiplier(self):
        """Doubling target yield produces multiplier=2 and doubled amounts."""
        rv_id = uuid.uuid4()
        unit_id = uuid.uuid4()
        ing_id = uuid.uuid4()

        mock_ingredient = SimpleNamespace(name="Sugar")
        mock_rvi = SimpleNamespace(
            ingredient_id=ing_id,
            ingredient=mock_ingredient,
            base_amount=5,
            unit_id=unit_id,
            sort_order=1,
            is_deleted=False,
        )
        mock_rv = SimpleNamespace(
            recipe_version_id=rv_id,
            base_yield_value=10,
            base_yield_unit_id=unit_id,
            ingredients=[mock_rvi],
            is_deleted=False,
        )

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = mock_rv

        result = preview_scale(
            db,
            recipe_version_id=rv_id,
            target_yield_qty=20,
            target_yield_uom_id=unit_id,
        )

        assert result["multiplier"] == 2.0
        assert len(result["scaled_ingredients"]) == 1
        assert result["scaled_ingredients"][0]["scaled_amount"] == 10.0
        assert result["base_yield_value"] == 10.0

    def test_preview_scale_zero_yield_raises(self):
        """A recipe version with base_yield_value=0 must raise ZERO_BASE_YIELD."""
        rv_id = uuid.uuid4()
        unit_id = uuid.uuid4()

        mock_rv = SimpleNamespace(
            recipe_version_id=rv_id,
            base_yield_value=0,
            base_yield_unit_id=unit_id,
            ingredients=[],
            is_deleted=False,
        )

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = mock_rv

        with pytest.raises(BusinessError) as exc_info:
            preview_scale(
                db,
                recipe_version_id=rv_id,
                target_yield_qty=20,
                target_yield_uom_id=unit_id,
            )

        assert exc_info.value.error_code == "ZERO_BASE_YIELD"


# ---------------------------------------------------------------------------
# apply_scale
# ---------------------------------------------------------------------------

class TestApplyScale:
    """Unit tests for the apply_scale mutation."""

    def _make_run(self, *, status="InProgress", base_yield=10):
        """Return a SimpleNamespace that looks like a ProductionRun."""
        run_id = uuid.uuid4()
        rv_unit_id = uuid.uuid4()
        snapshot = json.dumps({
            "ingredients": [
                {"base_amount": 5, "scaled_amount": 5},
                {"base_amount": 8, "scaled_amount": 8},
            ],
        })
        mock_recipe_version = SimpleNamespace(
            base_yield_value=base_yield,
            base_yield_unit_id=rv_unit_id,
        )
        mock_run = SimpleNamespace(
            production_run_id=run_id,
            status=status,
            snapshot_json=snapshot,
            scaling_json=None,
            target_yield_value=None,
            target_yield_unit_id=None,
            recipe_version=mock_recipe_version,
            is_deleted=False,
        )
        return mock_run

    @patch("app.services.scaling_service.generate_materials_plan")
    @patch("app.services.scaling_service.write_audit_log")
    def test_apply_scale_success(self, mock_audit, mock_materials):
        """Scaling with no prior consumption updates scaling_json."""
        mock_run = self._make_run(status="InProgress", base_yield=10)
        user_id = uuid.uuid4()
        uom_id = uuid.uuid4()
        consumption_count = 0

        def query_router(*args):
            q = MagicMock()
            if args and args[0] is ProductionRun:
                q.filter.return_value.first.return_value = mock_run
            else:
                q.filter.return_value.scalar.return_value = consumption_count
            return q

        db = MagicMock()
        db.query = MagicMock(side_effect=query_router)

        result = apply_scale(
            db,
            run_id=mock_run.production_run_id,
            target_yield_qty=30,
            target_yield_uom_id=uom_id,
            user_id=user_id,
        )

        assert result is mock_run

        # Verify scaling_json was written with correct multiplier (30/10 = 3)
        scaling = json.loads(mock_run.scaling_json)
        assert scaling["multiplier"] == 3.0
        assert scaling["target_yield_value"] == 30

        # Verify snapshot ingredients were rescaled
        snapshot = json.loads(mock_run.snapshot_json)
        assert snapshot["ingredients"][0]["scaled_amount"] == 15.0  # 5 * 3
        assert snapshot["ingredients"][1]["scaled_amount"] == 24.0  # 8 * 3

        db.flush.assert_called_once()
        mock_materials.assert_called_once()
        mock_audit.assert_called_once()

    @patch("app.services.scaling_service.generate_materials_plan")
    @patch("app.services.scaling_service.write_audit_log")
    def test_apply_scale_locked_after_consumption(self, mock_audit, mock_materials):
        """Scaling is forbidden when consumption transactions already exist."""
        mock_run = self._make_run(status="InProgress")
        user_id = uuid.uuid4()
        uom_id = uuid.uuid4()
        consumption_count = 3

        def query_router(*args):
            q = MagicMock()
            if args and args[0] is ProductionRun:
                q.filter.return_value.first.return_value = mock_run
            else:
                q.filter.return_value.scalar.return_value = consumption_count
            return q

        db = MagicMock()
        db.query = MagicMock(side_effect=query_router)

        with pytest.raises(BusinessError) as exc_info:
            apply_scale(
                db,
                run_id=mock_run.production_run_id,
                target_yield_qty=30,
                target_yield_uom_id=uom_id,
                user_id=user_id,
            )

        assert exc_info.value.error_code == "SCALING_LOCKED_AFTER_CONSUMPTION"
        mock_materials.assert_not_called()
        mock_audit.assert_not_called()

    def test_apply_scale_requires_in_progress(self):
        """Only InProgress runs may be scaled; Planned status must raise."""
        mock_run = self._make_run(status="Planned")
        user_id = uuid.uuid4()
        uom_id = uuid.uuid4()

        def query_router(*args):
            q = MagicMock()
            if args and args[0] is ProductionRun:
                q.filter.return_value.first.return_value = mock_run
            else:
                q.filter.return_value.scalar.return_value = 0
            return q

        db = MagicMock()
        db.query = MagicMock(side_effect=query_router)

        with pytest.raises(BusinessError) as exc_info:
            apply_scale(
                db,
                run_id=mock_run.production_run_id,
                target_yield_qty=30,
                target_yield_uom_id=uom_id,
                user_id=user_id,
            )

        assert exc_info.value.error_code == "INVALID_RUN_STATUS"
