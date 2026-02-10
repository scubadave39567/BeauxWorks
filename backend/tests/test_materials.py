"""Unit tests for app.services.materials_service."""

import json
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch, PropertyMock

from app.services.materials_service import (
    generate_materials_plan,
    consume_material,
    consume_remaining,
    get_material_summary,
)
from app.exceptions import BusinessError, NotFoundError


class TestGenerateMaterialsPlan(unittest.TestCase):
    """Tests for generate_materials_plan."""

    def setUp(self):
        self.db = MagicMock()
        self.user_id = uuid.uuid4()

    def test_generate_materials_plan_requires_in_progress(self):
        """Run with status 'Planned' must raise BusinessError INVALID_RUN_STATUS."""
        run = SimpleNamespace(
            production_run_id=uuid.uuid4(),
            status="Planned",
            snapshot_json=None,
            scaling_json=None,
        )

        with self.assertRaises(BusinessError) as ctx:
            generate_materials_plan(self.db, run, self.user_id)

        self.assertEqual(ctx.exception.error_code, "INVALID_RUN_STATUS")

    @patch("app.services.materials_service.write_audit_log")
    def test_generate_materials_plan_creates_rows(self, mock_audit):
        """Plan generation creates RunMaterial rows with planned_qty = base_amount * multiplier."""
        ingredient_id = str(uuid.uuid4())
        unit_id = str(uuid.uuid4())
        run_id = uuid.uuid4()

        run = SimpleNamespace(
            production_run_id=run_id,
            status="InProgress",
            snapshot_json=json.dumps({
                "ingredients": [
                    {
                        "ingredient_id": ingredient_id,
                        "base_amount": 10,
                        "unit_id": unit_id,
                        "sort_order": 1,
                    }
                ]
            }),
            scaling_json=json.dumps({"multiplier": 2.0}),
        )

        # Mock db.query(RunMaterial).filter(...).all() to return empty list
        mock_query = MagicMock()
        mock_query.filter.return_value.all.return_value = []
        self.db.query.return_value = mock_query

        materials = generate_materials_plan(self.db, run, self.user_id)

        # Verify db.add was called for the new RunMaterial
        self.assertTrue(self.db.add.called)
        added_obj = self.db.add.call_args_list[0][0][0]
        self.assertEqual(added_obj.planned_qty, 20.0)  # 10 * 2.0
        self.assertEqual(added_obj.production_run_id, run_id)
        self.assertEqual(added_obj.item_id, uuid.UUID(ingredient_id))
        self.assertEqual(added_obj.planned_uom_id, uuid.UUID(unit_id))
        self.assertEqual(added_obj.sort_order, 1)

        # Verify one material returned
        self.assertEqual(len(materials), 1)
        self.assertEqual(materials[0].planned_qty, 20.0)

        # Verify audit log was written
        mock_audit.assert_called_once()


class TestConsumeMaterial(unittest.TestCase):
    """Tests for consume_material."""

    def setUp(self):
        self.db = MagicMock()
        self.user_id = uuid.uuid4()
        self.run_material_id = uuid.uuid4()
        self.run_id = uuid.uuid4()
        self.item_id = uuid.uuid4()
        self.uom_id = uuid.uuid4()
        self.facility_id = uuid.uuid4()

    @patch("app.services.materials_service.write_audit_log")
    def test_consume_material_creates_negative_txn(self, mock_audit):
        """Consuming material creates an InventoryTransaction with negative quantity."""
        mat = SimpleNamespace(
            run_material_id=self.run_material_id,
            item_id=self.item_id,
            production_run=SimpleNamespace(
                production_run_id=self.run_id,
                status="InProgress",
                facility_id=self.facility_id,
            ),
            is_deleted=False,
        )

        # db.query(RunMaterial).filter(...).first() returns our mock material
        self.db.query.return_value.filter.return_value.first.return_value = mat

        txn = consume_material(
            self.db,
            run_material_id=self.run_material_id,
            location_id=None,
            qty=7.5,
            uom_id=self.uom_id,
            lot_id=None,
            notes="Test consume",
            user_id=self.user_id,
        )

        # Verify db.add was called with the transaction
        self.assertTrue(self.db.add.called)
        added_txn = self.db.add.call_args_list[0][0][0]
        self.assertEqual(added_txn.quantity, -7.5)  # negative for consumption
        self.assertEqual(added_txn.transaction_type, "Consume")
        self.assertEqual(added_txn.ingredient_id, self.item_id)
        self.assertEqual(added_txn.facility_id, self.facility_id)
        self.assertEqual(added_txn.unit_id, self.uom_id)

        mock_audit.assert_called_once()

    def test_consume_material_requires_in_progress(self):
        """Consuming from a completed run must raise BusinessError INVALID_RUN_STATUS."""
        mat = SimpleNamespace(
            run_material_id=self.run_material_id,
            item_id=self.item_id,
            production_run=SimpleNamespace(
                production_run_id=self.run_id,
                status="Completed",
                facility_id=self.facility_id,
            ),
            is_deleted=False,
        )

        self.db.query.return_value.filter.return_value.first.return_value = mat

        with self.assertRaises(BusinessError) as ctx:
            consume_material(
                self.db,
                run_material_id=self.run_material_id,
                location_id=None,
                qty=5.0,
                uom_id=self.uom_id,
                lot_id=None,
                notes=None,
                user_id=self.user_id,
            )

        self.assertEqual(ctx.exception.error_code, "INVALID_RUN_STATUS")


class TestConsumeRemaining(unittest.TestCase):
    """Tests for consume_remaining."""

    def setUp(self):
        self.db = MagicMock()
        self.user_id = uuid.uuid4()
        self.run_material_id = uuid.uuid4()
        self.uom_id = uuid.uuid4()

    @patch("app.services.materials_service.consume_material")
    @patch("app.services.materials_service.get_material_summary")
    def test_consume_remaining_computes_delta(self, mock_summary, mock_consume):
        """consume_remaining reads summary.remaining and forwards it to consume_material."""
        mock_summary.return_value = {
            "run_material_id": str(self.run_material_id),
            "item_id": str(uuid.uuid4()),
            "item_name": "Sugar",
            "planned": 10.0,
            "consumed": 5.0,
            "remaining": 5.0,
            "waste": 0.0,
            "unit_id": str(self.uom_id),
            "sort_order": 0,
        }

        # db.query(RunMaterial).filter(...).first() returns a mock material
        mat = SimpleNamespace(
            run_material_id=self.run_material_id,
            planned_uom_id=self.uom_id,
        )
        self.db.query.return_value.filter.return_value.first.return_value = mat

        mock_consume.return_value = SimpleNamespace(
            inventory_transaction_id=uuid.uuid4(),
            quantity=-5.0,
        )

        consume_remaining(
            self.db,
            run_material_id=self.run_material_id,
            location_id=None,
            lot_id=None,
            user_id=self.user_id,
        )

        # Verify consume_material was called with qty=5.0 (the remaining amount)
        mock_consume.assert_called_once()
        call_kwargs = mock_consume.call_args
        self.assertEqual(call_kwargs.kwargs["qty"], 5.0)
        self.assertEqual(call_kwargs.kwargs["uom_id"], self.uom_id)
        self.assertEqual(call_kwargs.kwargs["notes"], "Auto consume remaining")


if __name__ == "__main__":
    unittest.main()
