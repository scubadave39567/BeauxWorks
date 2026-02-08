from fastapi import APIRouter

from app.api.v1 import (
    attachments,
    auth,
    cms,
    inventory,
    lookups,
    production_runs,
    products,
    recipes,
    sales,
    users,
)

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(auth.router)
api_v1_router.include_router(users.router)
api_v1_router.include_router(lookups.router)
api_v1_router.include_router(recipes.router)
api_v1_router.include_router(production_runs.router)
api_v1_router.include_router(inventory.router)
api_v1_router.include_router(products.router)
api_v1_router.include_router(sales.router)
api_v1_router.include_router(cms.router)
api_v1_router.include_router(attachments.router)
