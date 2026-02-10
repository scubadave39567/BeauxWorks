import uuid
from pydantic import BaseModel
from fastapi import APIRouter
from app.api.deps import DbSession, AdminOrQA
from app.schemas.api_response import ApiResponse
from app.services.qc_plan_service import (
    list_plans, get_plan, create_plan, update_plan, delete_plan,
    get_plan_requirements, create_requirement, delete_requirement,
)

router = APIRouter(prefix="/qc-plans", tags=["qc-plans"])


class PlanCreate(BaseModel):
    name: str
    applies_to_recipe_category: str | None = None
    applies_to_recipe_id: uuid.UUID | None = None
    applies_to_recipe_version_id: uuid.UUID | None = None
    is_active: bool = True


class PlanUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class RequirementCreate(BaseModel):
    metric_type_id: uuid.UUID
    stage: str
    required: bool = True
    min_value: float | None = None
    max_value: float | None = None
    fail_requires_deviation: bool = False
    sort_order: int = 0


@router.get("", response_model=ApiResponse[list[dict]])
def api_list_plans(db: DbSession, user: AdminOrQA):
    plans = list_plans(db)
    data = [
        {
            "qc_plan_id": str(p.qc_plan_id),
            "name": p.name,
            "applies_to_recipe_category": p.applies_to_recipe_category,
            "applies_to_recipe_id": str(p.applies_to_recipe_id) if p.applies_to_recipe_id else None,
            "applies_to_recipe_version_id": str(p.applies_to_recipe_version_id) if p.applies_to_recipe_version_id else None,
            "is_active": p.is_active,
        }
        for p in plans
    ]
    return ApiResponse.ok(data)


@router.get("/{plan_id}", response_model=ApiResponse[dict])
def api_get_plan(plan_id: uuid.UUID, db: DbSession, user: AdminOrQA):
    plan = get_plan(db, plan_id)
    reqs = get_plan_requirements(db, plan_id)
    return ApiResponse.ok({
        "qc_plan_id": str(plan.qc_plan_id),
        "name": plan.name,
        "applies_to_recipe_category": plan.applies_to_recipe_category,
        "is_active": plan.is_active,
        "requirements": [
            {
                "qc_plan_requirement_id": str(r.qc_plan_requirement_id),
                "metric_type_id": str(r.metric_type_id),
                "metric_type_name": r.metric_type.name if r.metric_type else None,
                "stage": r.stage,
                "required": r.required,
                "min_value": float(r.min_value) if r.min_value is not None else None,
                "max_value": float(r.max_value) if r.max_value is not None else None,
                "fail_requires_deviation": r.fail_requires_deviation,
                "sort_order": r.sort_order,
            }
            for r in reqs
        ],
    })


@router.post("", response_model=ApiResponse[dict])
def api_create_plan(body: PlanCreate, db: DbSession, user: AdminOrQA):
    plan = create_plan(db, **body.model_dump())
    db.commit()
    return ApiResponse.ok({"qc_plan_id": str(plan.qc_plan_id)})


@router.put("/{plan_id}", response_model=ApiResponse[dict])
def api_update_plan(plan_id: uuid.UUID, body: PlanUpdate, db: DbSession, user: AdminOrQA):
    plan = get_plan(db, plan_id)
    update_plan(db, plan, **body.model_dump(exclude_none=True))
    db.commit()
    return ApiResponse.ok({"qc_plan_id": str(plan.qc_plan_id)})


@router.delete("/{plan_id}", response_model=ApiResponse[dict])
def api_delete_plan(plan_id: uuid.UUID, db: DbSession, user: AdminOrQA):
    plan = get_plan(db, plan_id)
    delete_plan(db, plan)
    db.commit()
    return ApiResponse.ok({"deleted": True})


@router.post("/{plan_id}/requirements", response_model=ApiResponse[dict])
def api_create_requirement(plan_id: uuid.UUID, body: RequirementCreate, db: DbSession, user: AdminOrQA):
    get_plan(db, plan_id)  # validate plan exists
    req = create_requirement(db, qc_plan_id=plan_id, **body.model_dump())
    db.commit()
    return ApiResponse.ok({"qc_plan_requirement_id": str(req.qc_plan_requirement_id)})


@router.delete("/{plan_id}/requirements/{req_id}", response_model=ApiResponse[dict])
def api_delete_requirement(plan_id: uuid.UUID, req_id: uuid.UUID, db: DbSession, user: AdminOrQA):
    delete_requirement(db, req_id)
    db.commit()
    return ApiResponse.ok({"deleted": True})
