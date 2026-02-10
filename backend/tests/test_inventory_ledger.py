"""Unit tests for app.services.inventory_ledger_service."""

import unittest
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch, PropertyMock

from app.services.inventory_ledger_service import (
    get_onhand,
    receive_inventory,
    adjust_inventory,
    transfer_inventory,
    void_transaction,
)
from app.exceptions import BusinessError, NotFoundError


class TestReceiveInventory(unittest.TestCase):
    """Tests for receive_inventory."""

    def setUp(self):
        self.db = MagicMock()
        self.user_id = uuid.uuid4()
        self.facility_id = uuid.uuid4()
        self.item_id = uuid.uuid4()
        self.uom_id = uuid.uuid4()

    @patch("app.services.inventory_ledger_service.write_audit_log")
    def test_receive_creates_positive_txn(self, mock_audit):
        """Receiving inventory creates a transaction with positive quantity."""
        txn = receive_inventory(
            self.db,
            facility_id=self.facility_id,
            location_id=None,
            item_id=self.item_id,
            lot_id=None,
            qty=25.0,
            uom_id=self.uom_id,
            user_id=self.user_id,
        )

        # Verify db.add was called
        self.assertTrue(self.db.add.called)
        added_txn = self.db.add.call_args_list[0][0][0]
        self.assertEqual(added_txn.quantity, 25.0)  # abs(qty) -> positive
        self.assertEqual(added_txn.transaction_type, "Receive")
        self.assertEqual(added_txn.ingredient_id, self.item_id)
        self.assertEqual(added_txn.facility_id, self.facility_id)

        mock_audit.assert_called_once()


class TestAdjustInventory(unittest.TestCase):
    """Tests for adjust_inventory."""

    def setUp(self):
        self.db = MagicMock()
        self.user_id = uuid.uuid4()
        self.facility_id = uuid.uuid4()
        self.item_id = uuid.uuid4()

    @patch("app.services.inventory_ledger_service.write_audit_log")
    def test_adjust_allows_negative(self, mock_audit):
        """Adjustments allow negative quantities (e.g. write-down)."""
        txn = adjust_inventory(
            self.db,
            facility_id=self.facility_id,
            location_id=None,
            item_id=self.item_id,
            qty=-5,
            reason_code="DAMAGE",
            user_id=self.user_id,
        )

        self.assertTrue(self.db.add.called)
        added_txn = self.db.add.call_args_list[0][0][0]
        self.assertEqual(added_txn.quantity, -5)  # negative allowed
        self.assertEqual(added_txn.transaction_type, "Adjust")
        self.assertEqual(added_txn.reason_code, "DAMAGE")

        mock_audit.assert_called_once()


class TestTransferInventory(unittest.TestCase):
    """Tests for transfer_inventory."""

    def setUp(self):
        self.db = MagicMock()
        self.user_id = uuid.uuid4()
        self.from_facility_id = uuid.uuid4()
        self.to_facility_id = uuid.uuid4()
        self.item_id = uuid.uuid4()
        self.uom_id = uuid.uuid4()

    @patch("app.services.inventory_ledger_service.write_audit_log")
    def test_transfer_creates_paired_txns(self, mock_audit):
        """Transferring creates one TransferOut (negative) and one TransferIn (positive)."""
        txn_out, txn_in = transfer_inventory(
            self.db,
            from_facility_id=self.from_facility_id,
            from_location_id=None,
            to_facility_id=self.to_facility_id,
            to_location_id=None,
            item_id=self.item_id,
            lot_id=None,
            qty=10.0,
            uom_id=self.uom_id,
            user_id=self.user_id,
        )

        # db.add should be called twice: once for out, once for in
        self.assertEqual(self.db.add.call_count, 2)

        added_out = self.db.add.call_args_list[0][0][0]
        added_in = self.db.add.call_args_list[1][0][0]

        self.assertEqual(added_out.transaction_type, "TransferOut")
        self.assertEqual(added_out.quantity, -10.0)  # negative
        self.assertEqual(added_out.facility_id, self.from_facility_id)

        self.assertEqual(added_in.transaction_type, "TransferIn")
        self.assertEqual(added_in.quantity, 10.0)  # positive
        self.assertEqual(added_in.facility_id, self.to_facility_id)

        # Both share the same transfer reference
        self.assertEqual(added_out.reference_id, added_in.reference_id)

        mock_audit.assert_called_once()


class TestVoidTransaction(unittest.TestCase):
    """Tests for void_transaction."""

    def setUp(self):
        self.db = MagicMock()
        self.user_id = uuid.uuid4()
        self.txn_id = uuid.uuid4()

    @patch("app.services.inventory_ledger_service.write_audit_log")
    def test_void_sets_voided_at(self, mock_audit):
        """Voiding a transaction sets voided_at to a datetime."""
        existing_txn = SimpleNamespace(
            inventory_transaction_id=self.txn_id,
            voided_at=None,
            voided_by_user_id=None,
            void_reason=None,
            is_deleted=False,
        )

        self.db.query.return_value.filter.return_value.first.return_value = existing_txn

        result = void_transaction(
            self.db,
            txn_id=self.txn_id,
            reason="Entered in error",
            user_id=self.user_id,
        )

        self.assertIsNotNone(result.voided_at)
        self.assertEqual(result.voided_by_user_id, self.user_id)
        self.assertEqual(result.void_reason, "Entered in error")

        mock_audit.assert_called_once()

    def test_void_already_voided_raises(self):
        """Voiding an already-voided transaction must raise BusinessError ALREADY_VOIDED."""
        existing_txn = SimpleNamespace(
            inventory_transaction_id=self.txn_id,
            voided_at=datetime(2025, 1, 15, 12, 0, 0, tzinfo=timezone.utc),
            voided_by_user_id=uuid.uuid4(),
            void_reason="Previous void",
            is_deleted=False,
        )

        self.db.query.return_value.filter.return_value.first.return_value = existing_txn

        with self.assertRaises(BusinessError) as ctx:
            void_transaction(
                self.db,
                txn_id=self.txn_id,
                reason="Second attempt",
                user_id=self.user_id,
            )

        self.assertEqual(ctx.exception.error_code, "ALREADY_VOIDED")


class TestGetOnhand(unittest.TestCase):
    """Tests for get_onhand."""

    def setUp(self):
        self.db = MagicMock()
        self.facility_id = uuid.uuid4()

    def test_get_onhand_returns_sum(self):
        """get_onhand returns aggregated on-hand grouped by ingredient_id."""
        item_uuid = uuid.uuid4()
        mock_row = SimpleNamespace(ingredient_id=item_uuid, on_hand=100.0)

        # Chain: db.query(...).filter(...).group_by(...).all()
        mock_query = MagicMock()
        self.db.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.group_by.return_value = mock_query
        mock_query.all.return_value = [mock_row]

        result = get_onhand(self.db, self.facility_id)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["item_id"], str(item_uuid))
        self.assertEqual(result[0]["on_hand"], 100.0)


if __name__ == "__main__":
    unittest.main()
