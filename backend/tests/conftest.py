"""
Shared pytest fixtures for BeauxWorks backend unit tests.

All fixtures use SimpleNamespace objects instead of real SQLAlchemy models
so that tests can run without an MSSQL connection.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest


# ---------------------------------------------------------------------------
# Mock database session
# ---------------------------------------------------------------------------

@pytest.fixture()
def mock_db():
    """Return a MagicMock that behaves like a SQLAlchemy Session.

    The mock supports the chained-call pattern used throughout the service
    layer::

        db.query(Model).filter(...).first()

    Individual tests are expected to configure the return values of
    ``.first()`` / ``.all()`` on the mock's query chain as needed.
    """
    db = MagicMock(spec_set=["query", "add", "flush", "commit", "refresh",
                             "rollback", "close", "execute"])
    # .query() returns a chainable mock by default (MagicMock chaining).
    return db


# ---------------------------------------------------------------------------
# Mock authenticated user
# ---------------------------------------------------------------------------

@pytest.fixture()
def mock_user():
    """A minimal user-like object carrying only ``user_id``."""
    return SimpleNamespace(user_id=uuid4())


# ---------------------------------------------------------------------------
# Factory: RecipeVersion
# ---------------------------------------------------------------------------

@pytest.fixture()
def make_recipe_version():
    """Factory that creates a SimpleNamespace mimicking a RecipeVersion row.

    Keyword arguments override any default value.
    """

    def _factory(
        *,
        status="Released",
        recipe_version_id=None,
        base_yield_value=1000.0,
        base_yield_unit_id=None,
        is_deleted=False,
        ingredients=None,
        steps=None,
        recipe_name="Test Recipe",
    ):
        return SimpleNamespace(
            recipe_version_id=recipe_version_id or uuid4(),
            status=status,
            base_yield_value=base_yield_value,
            base_yield_unit_id=base_yield_unit_id or uuid4(),
            is_deleted=is_deleted,
            ingredients=ingredients if ingredients is not None else [],
            steps=steps if steps is not None else [],
            recipe=SimpleNamespace(name=recipe_name),
        )

    return _factory


# ---------------------------------------------------------------------------
# Factory: ProductionRun
# ---------------------------------------------------------------------------

@pytest.fixture()
def make_run(make_recipe_version):
    """Factory that creates a SimpleNamespace mimicking a ProductionRun row.

    Automatically creates a linked ``recipe_version`` via
    ``make_recipe_version`` unless one is provided explicitly.
    """

    def _factory(
        *,
        production_run_id=None,
        recipe_version_id=None,
        facility_id=None,
        status="Planned",
        target_yield_value=500.0,
        target_yield_unit_id=None,
        snapshot_json=None,
        scaling_json=None,
        is_deleted=False,
        recipe_version=None,
        lot_code=None,
        started_at=None,
        completed_at=None,
        actual_yield_value=None,
        actual_yield_unit_id=None,
        notes=None,
        facility_name="Test Facility",
        run_materials=None,
        run_status_id=None,
    ):
        rv = recipe_version or make_recipe_version()
        return SimpleNamespace(
            production_run_id=production_run_id or uuid4(),
            recipe_version_id=recipe_version_id or rv.recipe_version_id,
            facility_id=facility_id or uuid4(),
            status=status,
            target_yield_value=target_yield_value,
            target_yield_unit_id=target_yield_unit_id or uuid4(),
            snapshot_json=snapshot_json,
            scaling_json=scaling_json,
            is_deleted=is_deleted,
            recipe_version=rv,
            lot_code=lot_code,
            started_at=started_at,
            completed_at=completed_at,
            actual_yield_value=actual_yield_value,
            actual_yield_unit_id=actual_yield_unit_id,
            notes=notes,
            facility=SimpleNamespace(name=facility_name),
            run_materials=run_materials if run_materials is not None else [],
            run_status_id=run_status_id or uuid4(),
        )

    return _factory


# ---------------------------------------------------------------------------
# Factory: RunMaterial
# ---------------------------------------------------------------------------

@pytest.fixture()
def make_run_material(make_run):
    """Factory that creates a SimpleNamespace mimicking a RunMaterial row.

    Automatically creates a linked ``production_run`` via ``make_run``
    unless one is provided explicitly.
    """

    def _factory(
        *,
        run_material_id=None,
        production_run_id=None,
        item_id=None,
        planned_qty=10.0,
        planned_uom_id=None,
        waste_qty=0,
        sort_order=1,
        is_deleted=False,
        item_name="Test Ingredient",
        production_run=None,
    ):
        run = production_run or make_run()
        return SimpleNamespace(
            run_material_id=run_material_id or uuid4(),
            production_run_id=production_run_id or run.production_run_id,
            item_id=item_id or uuid4(),
            planned_qty=planned_qty,
            planned_uom_id=planned_uom_id or uuid4(),
            waste_qty=waste_qty,
            sort_order=sort_order,
            is_deleted=is_deleted,
            item=SimpleNamespace(name=item_name),
            production_run=run,
        )

    return _factory
