"""Tests for app.services.traceability_service -- trace_by_lot & trace_by_run."""

import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.models.inventory import IngredientLot, InventoryTransaction
from app.models.production import ProductionRun
from app.models.recipes import Ingredient
from app.services.traceability_service import trace_by_lot, trace_by_run


# ---------------------------------------------------------------------------
# trace_by_lot
# ---------------------------------------------------------------------------

class TestTraceByLot:
    """Unit tests for trace_by_lot."""

    def test_trace_by_lot_returns_affected_runs(self):
        """Consumption transactions should map to affected_runs with totals."""
        lot_id = uuid.uuid4()
        ing_id = uuid.uuid4()
        run_id_1 = uuid.uuid4()

        mock_lot = SimpleNamespace(
            ingredient_lot_id=lot_id,
            lot_number="LOT-001",
            ingredient_id=ing_id,
            ingredient=SimpleNamespace(name="Rose Water"),
        )

        mock_txn_1 = SimpleNamespace(
            production_run_id=run_id_1,
            reference_id=run_id_1,
            quantity=-3.5,
        )
        mock_txn_2 = SimpleNamespace(
            production_run_id=run_id_1,
            reference_id=run_id_1,
            quantity=-1.5,
        )

        mock_run = SimpleNamespace(
            production_run_id=run_id_1,
            status="InProgress",
            lot_code="RUN-2025-042",
            started_at=None,
        )

        def query_router(model):
            q = MagicMock()
            if model is IngredientLot:
                q.filter.return_value.first.return_value = mock_lot
            elif model is InventoryTransaction:
                q.filter.return_value.all.return_value = [mock_txn_1, mock_txn_2]
            elif model is ProductionRun:
                q.filter.return_value.first.return_value = mock_run
            return q

        db = MagicMock()
        db.query = MagicMock(side_effect=query_router)

        result = trace_by_lot(db, lot_id)

        assert result["lot"] is not None
        assert result["lot"]["lot_number"] == "LOT-001"
        assert result["lot"]["ingredient_name"] == "Rose Water"

        assert len(result["affected_runs"]) == 1
        run_entry = result["affected_runs"][0]
        assert run_entry["production_run_id"] == str(run_id_1)
        assert run_entry["status"] == "InProgress"
        # 3.5 + 1.5 = 5.0  (absolute values)
        assert run_entry["consumed_qty"] == 5.0

    def test_trace_by_lot_no_transactions(self):
        """When no consumption exists for a lot, affected_runs is empty."""
        lot_id = uuid.uuid4()
        ing_id = uuid.uuid4()

        mock_lot = SimpleNamespace(
            ingredient_lot_id=lot_id,
            lot_number="LOT-EMPTY",
            ingredient_id=ing_id,
            ingredient=SimpleNamespace(name="Aloe"),
        )

        def query_router(model):
            q = MagicMock()
            if model is IngredientLot:
                q.filter.return_value.first.return_value = mock_lot
            elif model is InventoryTransaction:
                q.filter.return_value.all.return_value = []
            elif model is ProductionRun:
                q.filter.return_value.first.return_value = None
            return q

        db = MagicMock()
        db.query = MagicMock(side_effect=query_router)

        result = trace_by_lot(db, lot_id)

        assert result["lot"] is not None
        assert result["affected_runs"] == []


# ---------------------------------------------------------------------------
# trace_by_run
# ---------------------------------------------------------------------------

class TestTraceByRun:
    """Unit tests for trace_by_run."""

    def test_trace_by_run_groups_by_item(self):
        """Consumption transactions should be grouped by ingredient with lot detail."""
        run_id = uuid.uuid4()
        ing_id_a = uuid.uuid4()
        ing_id_b = uuid.uuid4()
        lot_id_1 = uuid.uuid4()
        lot_id_2 = uuid.uuid4()

        mock_run = SimpleNamespace(
            production_run_id=run_id,
            status="Completed",
            lot_code="RUN-2025-100",
        )

        mock_txn_a = SimpleNamespace(
            ingredient_id=ing_id_a,
            ingredient_lot_id=lot_id_1,
            quantity=-2.0,
        )
        mock_txn_b = SimpleNamespace(
            ingredient_id=ing_id_b,
            ingredient_lot_id=lot_id_2,
            quantity=-4.5,
        )

        mock_ingredient_a = SimpleNamespace(
            ingredient_id=ing_id_a,
            name="Beeswax",
        )
        mock_ingredient_b = SimpleNamespace(
            ingredient_id=ing_id_b,
            name="Shea Butter",
        )

        mock_lot_1 = SimpleNamespace(
            ingredient_lot_id=lot_id_1,
            lot_number="LOT-BW-01",
        )
        mock_lot_2 = SimpleNamespace(
            ingredient_lot_id=lot_id_2,
            lot_number="LOT-SB-01",
        )

        def query_router(model):
            q = MagicMock()
            if model is ProductionRun:
                q.filter.return_value.first.return_value = mock_run
            elif model is InventoryTransaction:
                q.filter.return_value.all.return_value = [mock_txn_a, mock_txn_b]
            elif model is Ingredient:
                # Called twice -- once per unique ingredient_id
                def ingredient_filter_side_effect(*_args, **_kwargs):
                    inner = MagicMock()
                    # We need to return the right ingredient based on the call
                    return inner

                # Simple approach: return ingredients in call order
                first_mock = MagicMock()
                first_mock.first.return_value = mock_ingredient_a
                second_mock = MagicMock()
                second_mock.first.return_value = mock_ingredient_b
                q.filter = MagicMock(side_effect=[first_mock, second_mock])
            elif model is IngredientLot:
                first_lot = MagicMock()
                first_lot.first.return_value = mock_lot_1
                second_lot = MagicMock()
                second_lot.first.return_value = mock_lot_2
                q.filter = MagicMock(side_effect=[first_lot, second_lot])
            return q

        db = MagicMock()
        db.query = MagicMock(side_effect=query_router)

        result = trace_by_run(db, run_id)

        assert result["run"] is not None
        assert result["run"]["status"] == "Completed"
        assert result["run"]["lot_code"] == "RUN-2025-100"

        consumption = result["consumption"]
        assert len(consumption) == 2

        # Build a lookup by item_id for deterministic assertions
        by_item = {c["item_id"]: c for c in consumption}
        assert str(ing_id_a) in by_item
        assert str(ing_id_b) in by_item

        item_a = by_item[str(ing_id_a)]
        assert item_a["item_name"] == "Beeswax"
        assert item_a["total_consumed"] == 2.0
        assert len(item_a["lots"]) == 1
        assert item_a["lots"][0]["lot_number"] == "LOT-BW-01"

        item_b = by_item[str(ing_id_b)]
        assert item_b["item_name"] == "Shea Butter"
        assert item_b["total_consumed"] == 4.5

    def test_trace_by_run_no_consumption(self):
        """A run with no consumption transactions yields an empty list."""
        run_id = uuid.uuid4()

        mock_run = SimpleNamespace(
            production_run_id=run_id,
            status="Planned",
            lot_code="RUN-2025-999",
        )

        def query_router(model):
            q = MagicMock()
            if model is ProductionRun:
                q.filter.return_value.first.return_value = mock_run
            elif model is InventoryTransaction:
                q.filter.return_value.all.return_value = []
            return q

        db = MagicMock()
        db.query = MagicMock(side_effect=query_router)

        result = trace_by_run(db, run_id)

        assert result["run"] is not None
        assert result["consumption"] == []
