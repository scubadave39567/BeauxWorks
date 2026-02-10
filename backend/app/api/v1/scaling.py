import uuid
from pydantic import BaseModel
from fastapi import APIRouter
from app.api.deps import DbSession, OperatorPlus
from app.schemas.api_response import ApiResponse
from app.services.scaling_service import preview_scale, apply_scale, get_print_data

router = APIRouter(tags=["scaling"])


class ScalePreviewRequest(BaseModel):
    target_yield_qty: float
    target_yield_uom_id: uuid.UUID


class ScaleApplyRequest(BaseModel):
    target_yield_qty: float
    target_yield_uom_id: uuid.UUID


@router.post("/recipes/{recipe_version_id}/scale/preview", response_model=ApiResponse[dict])
def api_preview_scale(recipe_version_id: uuid.UUID, body: ScalePreviewRequest, db: DbSession, user: OperatorPlus):
    data = preview_scale(db, recipe_version_id, body.target_yield_qty, body.target_yield_uom_id)
    return ApiResponse.ok(data)


@router.post("/runs/{run_id}/scale/apply", response_model=ApiResponse[dict])
def api_apply_scale(run_id: uuid.UUID, body: ScaleApplyRequest, db: DbSession, user: OperatorPlus):
    run = apply_scale(
        db, run_id=run_id,
        target_yield_qty=body.target_yield_qty,
        target_yield_uom_id=body.target_yield_uom_id,
        user_id=user.user_id,
    )
    db.commit()
    return ApiResponse.ok({"scaled": True, "production_run_id": str(run.production_run_id)})


@router.get("/runs/{run_id}/scale/print", response_model=ApiResponse[dict])
def api_print_data(run_id: uuid.UUID, db: DbSession, user: OperatorPlus):
    data = get_print_data(db, run_id)
    return ApiResponse.ok(data)
