"""Tests for RBAC enforcement via app.api.deps.require_roles."""

import json
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.api.deps import require_roles
from app.exceptions import ForbiddenError


class TestRequireRoles:
    """Unit tests for the require_roles dependency factory."""

    @staticmethod
    def _make_user(*role_names: str) -> SimpleNamespace:
        """Build a mock user with the given role names attached."""
        user_roles = []
        for name in role_names:
            mock_role = SimpleNamespace(name=name, is_deleted=False)
            mock_user_role = SimpleNamespace(role=mock_role, is_deleted=False)
            user_roles.append(mock_user_role)

        return SimpleNamespace(
            user_id=uuid.uuid4(),
            user_roles=user_roles,
        )

    def test_require_roles_admin_passes(self):
        """An admin user satisfies a checker that accepts admin or qa."""
        user = self._make_user("admin")
        checker = require_roles("admin", "qa")
        result = checker(user)
        assert result is user

    def test_require_roles_no_match_raises(self):
        """A viewer should be rejected when only admin/qa are allowed."""
        user = self._make_user("viewer")
        checker = require_roles("admin", "qa")

        with pytest.raises(ForbiddenError):
            checker(user)

    def test_require_roles_operator_in_operator_plus(self):
        """An operator passes when operator is in the accepted set."""
        user = self._make_user("operator")
        checker = require_roles("admin", "qa", "operator")
        result = checker(user)
        assert result is user

    def test_require_roles_empty_roles_raises(self):
        """A user with no roles at all must be rejected."""
        user = SimpleNamespace(
            user_id=uuid.uuid4(),
            user_roles=[],
        )
        checker = require_roles("admin", "qa")

        with pytest.raises(ForbiddenError):
            checker(user)
