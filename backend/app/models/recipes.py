"""Phase 3: Recipes + Scaling Engine models."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, text
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, pk_column


class Recipe(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "recipes"

    recipe_id: Mapped[uuid.UUID] = pk_column()
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    recipe_category_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("recipe_categories.recipe_category_id"), nullable=True
    )
    default_base_yield_value: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    default_base_yield_unit_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("units.unit_id"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("1"))

    versions: Mapped[list["RecipeVersion"]] = relationship(back_populates="recipe")
    default_base_yield_unit = relationship("Unit", foreign_keys=[default_base_yield_unit_id])
    recipe_category = relationship("RecipeCategory", foreign_keys=[recipe_category_id])


class RecipeVersion(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "recipe_versions"

    recipe_version_id: Mapped[uuid.UUID] = pk_column()
    recipe_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("recipes.recipe_id"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    base_yield_value: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    base_yield_unit_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("units.unit_id"), nullable=False
    )
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("0"))

    # New status workflow columns
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'Draft'")
    )
    snapshot_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    released_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    released_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("users.user_id"), nullable=True
    )
    recipe_category: Mapped[str | None] = mapped_column(String(100), nullable=True)

    recipe: Mapped["Recipe"] = relationship(back_populates="versions")
    base_yield_unit = relationship("Unit", foreign_keys=[base_yield_unit_id])
    released_by = relationship("User", foreign_keys=[released_by_user_id])
    ingredients: Mapped[list["RecipeVersionIngredient"]] = relationship(
        back_populates="recipe_version"
    )
    steps: Mapped[list["RecipeVersionStep"]] = relationship(back_populates="recipe_version")


class Ingredient(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "ingredients"

    ingredient_id: Mapped[uuid.UUID] = pk_column()
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    default_unit_id: Mapped[uuid.UUID | None] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("units.unit_id"), nullable=True
    )
    ingredient_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("1"))

    # Extended item fields
    item_type: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default=text("'Material'")
    )
    sku: Mapped[str | None] = mapped_column(String(100), nullable=True)
    item_guid: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, nullable=False, server_default=text("NEWID()"), default=uuid.uuid4
    )

    default_unit = relationship("Unit", foreign_keys=[default_unit_id])


# Alias for semantic clarity — same table, same model
Item = Ingredient


class RecipeVersionIngredient(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "recipe_version_ingredients"

    recipe_version_ingredient_id: Mapped[uuid.UUID] = pk_column()
    recipe_version_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("recipe_versions.recipe_version_id"), nullable=False
    )
    ingredient_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("ingredients.ingredient_id"), nullable=False
    )
    base_amount: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    unit_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("units.unit_id"), nullable=False
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1000"))
    rounding_mode: Mapped[str | None] = mapped_column(String(20), nullable=True)
    rounding_decimals: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rounding_increment: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    recipe_version: Mapped["RecipeVersion"] = relationship(back_populates="ingredients")
    ingredient: Mapped["Ingredient"] = relationship()
    unit = relationship("Unit", foreign_keys=[unit_id])


class RecipeVersionStep(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "recipe_version_steps"

    recipe_version_step_id: Mapped[uuid.UUID] = pk_column()
    recipe_version_id: Mapped[uuid.UUID] = mapped_column(
        UNIQUEIDENTIFIER, ForeignKey("recipe_versions.recipe_version_id"), nullable=False
    )
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    instruction: Mapped[str] = mapped_column(Text, nullable=False)
    critical_control_point: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    recipe_version: Mapped["RecipeVersion"] = relationship(back_populates="steps")
