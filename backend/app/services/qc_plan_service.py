import uuid
from sqlalchemy.orm import Session
from app.exceptions import NotFoundError
from app.models.qc import QcPlan, QcPlanRequirement
from app.models.recipes import RecipeVersion


def resolve_qc_plan(db: Session, recipe_version: RecipeVersion) -> QcPlan | None:
    """Priority: version-specific > recipe-specific > category > default."""
    plan = (
        db.query(QcPlan)
        .filter(QcPlan.applies_to_recipe_version_id == recipe_version.recipe_version_id,
                QcPlan.is_active == True, QcPlan.is_deleted == False)
        .first()
    )
    if plan:
        return plan
    plan = (
        db.query(QcPlan)
        .filter(QcPlan.applies_to_recipe_id == recipe_version.recipe_id,
                QcPlan.applies_to_recipe_version_id == None,
                QcPlan.is_active == True, QcPlan.is_deleted == False)
        .first()
    )
    if plan:
        return plan
    if recipe_version.recipe_category:
        plan = (
            db.query(QcPlan)
            .filter(QcPlan.applies_to_recipe_category == recipe_version.recipe_category,
                    QcPlan.applies_to_recipe_id == None,
                    QcPlan.applies_to_recipe_version_id == None,
                    QcPlan.is_active == True, QcPlan.is_deleted == False)
            .first()
        )
        if plan:
            return plan
    # Default (all null)
    return (
        db.query(QcPlan)
        .filter(QcPlan.applies_to_recipe_category == None,
                QcPlan.applies_to_recipe_id == None,
                QcPlan.applies_to_recipe_version_id == None,
                QcPlan.is_active == True, QcPlan.is_deleted == False)
        .first()
    )


def get_plan_requirements(db: Session, qc_plan_id: uuid.UUID) -> list[QcPlanRequirement]:
    return (
        db.query(QcPlanRequirement)
        .filter(QcPlanRequirement.qc_plan_id == qc_plan_id, QcPlanRequirement.is_deleted == False)
        .order_by(QcPlanRequirement.sort_order)
        .all()
    )


def list_plans(db: Session) -> list[QcPlan]:
    return db.query(QcPlan).filter(QcPlan.is_deleted == False).order_by(QcPlan.name).all()


def get_plan(db: Session, plan_id: uuid.UUID) -> QcPlan:
    plan = db.query(QcPlan).filter(QcPlan.qc_plan_id == plan_id, QcPlan.is_deleted == False).first()
    if not plan:
        raise NotFoundError("QC plan not found")
    return plan


def create_plan(db: Session, **kwargs) -> QcPlan:
    plan = QcPlan(**kwargs)
    db.add(plan)
    db.flush()
    return plan


def update_plan(db: Session, plan: QcPlan, **kwargs) -> QcPlan:
    for k, v in kwargs.items():
        if v is not None:
            setattr(plan, k, v)
    db.flush()
    return plan


def delete_plan(db: Session, plan: QcPlan) -> None:
    plan.is_deleted = True
    db.flush()


def create_requirement(db: Session, **kwargs) -> QcPlanRequirement:
    req = QcPlanRequirement(**kwargs)
    db.add(req)
    db.flush()
    return req


def delete_requirement(db: Session, req_id: uuid.UUID) -> None:
    req = db.query(QcPlanRequirement).filter(QcPlanRequirement.qc_plan_requirement_id == req_id).first()
    if not req:
        raise NotFoundError("Requirement not found")
    req.is_deleted = True
    db.flush()
