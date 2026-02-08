from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ProductionRunCreate(BaseModel):
    recipe_version_id: UUID
    run_status_id: UUID
    facility_id: UUID
    operator_user_id: UUID | None = None
    product_type_id: UUID | None = None
    product_id: UUID | None = None
    planned_start_at: datetime | None = None
    target_yield_value: float
    target_yield_unit_id: UUID
    lot_code: str | None = None
    notes: str | None = None


class ProductionRunUpdate(BaseModel):
    run_status_id: UUID | None = None
    operator_user_id: UUID | None = None
    product_type_id: UUID | None = None
    product_id: UUID | None = None
    planned_start_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    actual_yield_value: float | None = None
    actual_yield_unit_id: UUID | None = None
    lot_code: str | None = None
    notes: str | None = None


class ProductionRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    production_run_id: UUID
    recipe_version_id: UUID
    run_status_id: UUID
    facility_id: UUID
    operator_user_id: UUID | None = None
    product_type_id: UUID | None = None
    product_id: UUID | None = None
    planned_start_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    target_yield_value: float
    target_yield_unit_id: UUID
    actual_yield_value: float | None = None
    actual_yield_unit_id: UUID | None = None
    lot_code: str | None = None
    notes: str | None = None
    created_at: datetime


class QualityLogCreate(BaseModel):
    quality_template_item_id: UUID | None = None
    quality_metric_type_id: UUID
    measured_at: datetime | None = None
    value_numeric: float | None = None
    value_text: str | None = None
    value_bool: bool | None = None
    unit_id: UUID | None = None
    notes: str | None = None


class QualityLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    production_run_quality_log_id: UUID
    production_run_id: UUID
    quality_template_item_id: UUID | None = None
    quality_metric_type_id: UUID
    measured_at: datetime
    measured_by_user_id: UUID
    value_numeric: float | None = None
    value_text: str | None = None
    value_bool: bool | None = None
    unit_id: UUID | None = None
    notes: str | None = None


class DeviationCreate(BaseModel):
    deviation_type: str
    details: str
    corrective_action: str | None = None


class DeviationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    production_run_deviation_id: UUID
    production_run_id: UUID
    detected_at: datetime
    detected_by_user_id: UUID
    deviation_type: str
    details: str
    corrective_action: str | None = None
    resolved_at: datetime | None = None
    resolved_by_user_id: UUID | None = None


class ScanResponse(BaseModel):
    production_run_id: UUID
    lot_code: str | None = None
    run_status: str | None = None


class BatchRecordResponse(BaseModel):
    production_run_id: UUID
    lot_code: str | None = None
    recipe_name: str = ""
    version_number: int = 0
    run_status: str = ""
    facility_name: str = ""
    operator_name: str | None = None
    target_yield_value: float
    actual_yield_value: float | None = None
    quality_logs: list[QualityLogResponse] = []
    deviations: list[DeviationResponse] = []
