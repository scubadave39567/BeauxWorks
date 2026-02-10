import uuid
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session, selectinload

from app.exceptions import BusinessError, NotFoundError
from app.models.recipes import (
    Ingredient,
    Recipe,
    RecipeVersion,
    RecipeVersionIngredient,
    RecipeVersionStep,
)


def list_recipes(db: Session) -> list[Recipe]:
    return (
        db.query(Recipe)
        .options(selectinload(Recipe.versions))
        .filter(Recipe.is_deleted == False)
        .order_by(Recipe.name)
        .all()
    )


def get_recipe(db: Session, recipe_id: uuid.UUID) -> Recipe:
    recipe = (
        db.query(Recipe)
        .filter(Recipe.recipe_id == recipe_id, Recipe.is_deleted == False)
        .first()
    )
    if not recipe:
        raise NotFoundError("Recipe not found")
    return recipe


def create_recipe(db: Session, *, name: str, description: str | None, default_base_yield_value: float, default_base_yield_unit_id: uuid.UUID) -> Recipe:
    recipe = Recipe(
        name=name,
        description=description,
        default_base_yield_value=default_base_yield_value,
        default_base_yield_unit_id=default_base_yield_unit_id,
    )
    db.add(recipe)
    db.flush()
    return recipe


def update_recipe(db: Session, recipe: Recipe, **kwargs) -> Recipe:
    for key, value in kwargs.items():
        if value is not None:
            setattr(recipe, key, value)
    db.flush()
    return recipe


def delete_recipe(db: Session, recipe: Recipe) -> None:
    recipe.is_deleted = True
    db.flush()


def release_recipe_version(db: Session, version_id: uuid.UUID, user) -> RecipeVersion:
    version = db.query(RecipeVersion).filter(RecipeVersion.recipe_version_id == version_id).first()
    if not version:
        raise NotFoundError("Recipe version not found")
    if version.status != "Draft":
        raise BusinessError(f"Cannot release a version with status '{version.status}'", error_code="INVALID_STATUS")
    version.status = "Released"
    version.released_at = datetime.now(timezone.utc)
    version.released_by_user_id = user.user_id
    db.flush()
    return version


def retire_recipe_version(db: Session, version_id: uuid.UUID, user) -> RecipeVersion:
    version = db.query(RecipeVersion).filter(RecipeVersion.recipe_version_id == version_id).first()
    if not version:
        raise NotFoundError("Recipe version not found")
    if version.status != "Released":
        raise BusinessError(f"Cannot retire a version with status '{version.status}'", error_code="INVALID_STATUS")
    version.status = "Retired"
    db.flush()
    return version


def get_scaled_recipe(
    db: Session,
    recipe_version_id: uuid.UUID,
    target_yield_value: float,
    target_yield_unit_id: uuid.UUID,
) -> dict:
    """Call sp_get_scaled_recipe and return the three result sets."""
    conn = db.connection()
    raw = conn.connection.cursor()
    raw.execute(
        "EXEC dbo.sp_get_scaled_recipe ?, ?, ?",
        [str(recipe_version_id), target_yield_value, str(target_yield_unit_id)],
    )

    # Result Set 1: Header
    header_cols = [col[0] for col in raw.description]
    header_row = raw.fetchone()
    header = dict(zip(header_cols, header_row)) if header_row else {}

    # Result Set 2: Ingredients
    raw.nextset()
    ing_cols = [col[0] for col in raw.description]
    ingredients = [dict(zip(ing_cols, row)) for row in raw.fetchall()]

    # Result Set 3: Steps
    raw.nextset()
    step_cols = [col[0] for col in raw.description]
    steps = [dict(zip(step_cols, row)) for row in raw.fetchall()]

    return {"header": header, "ingredients": ingredients, "steps": steps}
