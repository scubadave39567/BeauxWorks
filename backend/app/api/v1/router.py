from fastapi import APIRouter

from app.api.v1 import (
    attachments,
    auth,
    cms,
    deviations,
    inventory,
    inventory_v2,
    lookups,
    production_runs,
    products,
    qc_plans,
    recipes,
    run_materials,
    run_qc,
    runs,
    sales,
    scaling,
    traceability,
    users,
)

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(auth.router)
api_v1_router.include_router(users.router)
api_v1_router.include_router(lookups.router)
api_v1_router.include_router(recipes.router)
api_v1_router.include_router(production_runs.router)
api_v1_router.include_router(runs.router)
api_v1_router.include_router(run_materials.router)
api_v1_router.include_router(run_qc.router)
api_v1_router.include_router(deviations.router)
api_v1_router.include_router(scaling.router)
api_v1_router.include_router(traceability.router)
api_v1_router.include_router(qc_plans.router)
api_v1_router.include_router(inventory.router)
api_v1_router.include_router(inventory_v2.router)
api_v1_router.include_router(products.router)
api_v1_router.include_router(sales.router)
api_v1_router.include_router(cms.router)
api_v1_router.include_router(attachments.router)
