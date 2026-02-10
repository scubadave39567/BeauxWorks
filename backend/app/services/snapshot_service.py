import json
from sqlalchemy.orm import Session
from app.models.production import ProductionRun
from app.models.recipes import RecipeVersion
from app.models.qc import QcPlan, QcPlanRequirement

def build_run_snapshot(db: Session, run: ProductionRun) -> dict:
    """Build snapshot JSON from recipe version ingredients/steps + QC plan."""
    rv = run.recipe_version
    recipe = rv.recipe

    ingredients = []
    for rvi in sorted(rv.ingredients, key=lambda x: x.sort_order):
        if rvi.is_deleted:
            continue
        ingredients.append({
            "ingredient_id": str(rvi.ingredient_id),
            "ingredient_name": rvi.ingredient.name if rvi.ingredient else None,
            "base_amount": float(rvi.base_amount),
            "unit_id": str(rvi.unit_id),
            "unit_abbreviation": rvi.unit.abbreviation if rvi.unit else None,
            "sort_order": rvi.sort_order,
            "rounding_mode": rvi.rounding_mode,
            "rounding_decimals": rvi.rounding_decimals,
            "rounding_increment": float(rvi.rounding_increment) if rvi.rounding_increment else None,
            "notes": rvi.notes,
        })

    steps = []
    for step in sorted(rv.steps, key=lambda x: x.step_number):
        if step.is_deleted:
            continue
        steps.append({
            "step_number": step.step_number,
            "instruction": step.instruction,
            "critical_control_point": step.critical_control_point,
            "notes": step.notes,
        })

    # Resolve QC plan
    qc_requirements = _resolve_qc_requirements(db, rv)

    snapshot = {
        "recipe_id": str(rv.recipe_id),
        "recipe_name": recipe.name if recipe else None,
        "recipe_version_id": str(rv.recipe_version_id),
        "version_number": rv.version_number,
        "base_yield_value": float(rv.base_yield_value),
        "base_yield_unit_id": str(rv.base_yield_unit_id),
        "ingredients": ingredients,
        "steps": steps,
        "qc_requirements": qc_requirements,
    }
    return snapshot


def _resolve_qc_requirements(db: Session, rv: RecipeVersion) -> list[dict]:
    """Priority: version-specific > recipe-specific > category > default (no filter)."""
    # Try version-specific
    plan = (
        db.query(QcPlan)
        .filter(QcPlan.applies_to_recipe_version_id == rv.recipe_version_id,
                QcPlan.is_active == True, QcPlan.is_deleted == False)
        .first()
    )
    if not plan:
        # Try recipe-specific
        plan = (
            db.query(QcPlan)
            .filter(QcPlan.applies_to_recipe_id == rv.recipe_id,
                    QcPlan.applies_to_recipe_version_id == None,
                    QcPlan.is_active == True, QcPlan.is_deleted == False)
            .first()
        )
    if not plan and rv.recipe_category:
        # Try category
        plan = (
            db.query(QcPlan)
            .filter(QcPlan.applies_to_recipe_category == rv.recipe_category,
                    QcPlan.applies_to_recipe_id == None,
                    QcPlan.applies_to_recipe_version_id == None,
                    QcPlan.is_active == True, QcPlan.is_deleted == False)
            .first()
        )
    if not plan:
        # Try default (all None)
        plan = (
            db.query(QcPlan)
            .filter(QcPlan.applies_to_recipe_category == None,
                    QcPlan.applies_to_recipe_id == None,
                    QcPlan.applies_to_recipe_version_id == None,
                    QcPlan.is_active == True, QcPlan.is_deleted == False)
            .first()
        )
    if not plan:
        return []

    reqs = (
        db.query(QcPlanRequirement)
        .filter(QcPlanRequirement.qc_plan_id == plan.qc_plan_id,
                QcPlanRequirement.is_deleted == False)
        .order_by(QcPlanRequirement.sort_order)
        .all()
    )
    result = []
    for r in reqs:
        result.append({
            "qc_plan_requirement_id": str(r.qc_plan_requirement_id),
            "metric_type_id": str(r.metric_type_id),
            "metric_type_code": r.metric_type.code if r.metric_type else None,
            "metric_type_name": r.metric_type.name if r.metric_type else None,
            "stage": r.stage,
            "required": r.required,
            "min_value": float(r.min_value) if r.min_value is not None else None,
            "max_value": float(r.max_value) if r.max_value is not None else None,
            "fail_requires_deviation": r.fail_requires_deviation,
        })
    return result


def build_scaling_json(run: ProductionRun, multiplier: float) -> dict:
    """Build scaling_json for the run."""
    return {
        "multiplier": multiplier,
        "target_yield_value": float(run.target_yield_value),
        "target_yield_unit_id": str(run.target_yield_unit_id),
        "base_yield_value": float(run.recipe_version.base_yield_value) if run.recipe_version else None,
        "base_yield_unit_id": str(run.recipe_version.base_yield_unit_id) if run.recipe_version else None,
    }
