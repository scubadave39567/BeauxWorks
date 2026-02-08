from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SupplierResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    supplier_id: UUID
    name: str
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    is_active: bool


class InventoryStatusResponse(BaseModel):
    ingredient_id: UUID
    ingredient_name: str
    facility_id: UUID
    facility_name: str
    quantity_on_hand: float
    unit_abbreviation: str
    low_stock_threshold: float | None = None
    is_low_stock: bool = False


class TransactionCreate(BaseModel):
    ingredient_id: UUID
    facility_id: UUID
    ingredient_lot_id: UUID | None = None
    production_run_id: UUID | None = None
    transaction_type: str
    quantity: float
    unit_id: UUID
    reference_notes: str | None = None


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    inventory_transaction_id: UUID
    ingredient_id: UUID
    facility_id: UUID
    ingredient_lot_id: UUID | None = None
    production_run_id: UUID | None = None
    transaction_type: str
    quantity: float
    unit_id: UUID
    reference_notes: str | None = None
    transacted_at: datetime


class IngredientLotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ingredient_lot_id: UUID
    ingredient_id: UUID
    facility_id: UUID
    supplier_id: UUID | None = None
    lot_number: str
    received_at: datetime
    expires_at: datetime | None = None
    quantity_received: float
    unit_id: UUID


class GenealogyEntry(BaseModel):
    ingredient_lot_number: str
    ingredient_name: str
    supplier_name: str | None = None
    run_lot_code: str | None = None
    product_lot_code: str | None = None
    quantity_used: float | None = None


class RecallResponse(BaseModel):
    affected_runs: list[dict] = []
    affected_product_lots: list[dict] = []
    distribution_records: list[dict] = []
