/*  Phase 9 – Extended Manufacturing Execution Schema
    Adds: storage_locations, qc_plans, run_materials, run_qc_entries,
          run_attachments, and ALTER columns for recipes, production_runs,
          inventory_transactions, quality_metric_types, deviations, audit_log,
          ingredient_lots.
    Convention: UUID PKs via NEWSEQUENTIALID() matching existing 38 tables.
*/

SET NOCOUNT ON;

-- ============================================================
-- 1. storage_locations
-- ============================================================
IF OBJECT_ID('dbo.storage_locations', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.storage_locations (
        storage_location_id     UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        facility_id             UNIQUEIDENTIFIER NOT NULL
            REFERENCES dbo.facilities(facility_id),
        code                    VARCHAR(50)      NOT NULL,
        name                    VARCHAR(200)     NOT NULL,
        is_active               BIT              NOT NULL DEFAULT 1,
        created_at              DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at              DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        is_deleted              BIT              NOT NULL DEFAULT 0,

        CONSTRAINT UQ_storage_locations_code UNIQUE (facility_id, code)
    );

    CREATE NONCLUSTERED INDEX IX_storage_locations_facility
        ON dbo.storage_locations(facility_id) WHERE is_deleted = 0;
END;
GO

-- ============================================================
-- 2. ALTER dbo.ingredients – add item_type, sku, item_guid
-- ============================================================
IF COL_LENGTH('dbo.ingredients', 'item_type') IS NULL
    ALTER TABLE dbo.ingredients ADD item_type VARCHAR(50) NOT NULL DEFAULT 'Material';
GO

IF COL_LENGTH('dbo.ingredients', 'sku') IS NULL
    ALTER TABLE dbo.ingredients ADD sku VARCHAR(100) NULL;
GO

IF COL_LENGTH('dbo.ingredients', 'item_guid') IS NULL
    ALTER TABLE dbo.ingredients ADD item_guid UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID();
GO

-- ============================================================
-- 3. ALTER dbo.recipe_versions – add status, snapshot, release
-- ============================================================
IF COL_LENGTH('dbo.recipe_versions', 'status') IS NULL
    ALTER TABLE dbo.recipe_versions ADD status VARCHAR(20) NOT NULL DEFAULT 'Draft';
GO

IF COL_LENGTH('dbo.recipe_versions', 'snapshot_json') IS NULL
    ALTER TABLE dbo.recipe_versions ADD snapshot_json NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH('dbo.recipe_versions', 'released_at') IS NULL
    ALTER TABLE dbo.recipe_versions ADD released_at DATETIME2 NULL;
GO

IF COL_LENGTH('dbo.recipe_versions', 'released_by_user_id') IS NULL
    ALTER TABLE dbo.recipe_versions ADD released_by_user_id UNIQUEIDENTIFIER NULL
        REFERENCES dbo.users(user_id);
GO

IF COL_LENGTH('dbo.recipe_versions', 'recipe_category') IS NULL
    ALTER TABLE dbo.recipe_versions ADD recipe_category VARCHAR(100) NULL;
GO

-- ============================================================
-- 4. ALTER dbo.production_runs – add inline status, snapshot, scaling, guid, created_by
-- ============================================================
IF COL_LENGTH('dbo.production_runs', 'status') IS NULL
    ALTER TABLE dbo.production_runs ADD status VARCHAR(20) NOT NULL DEFAULT 'Planned';
GO

IF COL_LENGTH('dbo.production_runs', 'snapshot_json') IS NULL
    ALTER TABLE dbo.production_runs ADD snapshot_json NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH('dbo.production_runs', 'scaling_json') IS NULL
    ALTER TABLE dbo.production_runs ADD scaling_json NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH('dbo.production_runs', 'production_run_guid') IS NULL
    ALTER TABLE dbo.production_runs ADD production_run_guid UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID();
GO

IF COL_LENGTH('dbo.production_runs', 'created_by_user_id') IS NULL
    ALTER TABLE dbo.production_runs ADD created_by_user_id UNIQUEIDENTIFIER NULL
        REFERENCES dbo.users(user_id);
GO

-- Migrate existing data from run_status_id to inline status
-- (run_statuses table: planned/in_progress/completed/canceled)
UPDATE pr
SET    pr.status = CASE rs.code
           WHEN 'planned'    THEN 'Planned'
           WHEN 'in_progress' THEN 'InProgress'
           WHEN 'completed'  THEN 'Completed'
           WHEN 'canceled'   THEN 'Canceled'
           ELSE 'Planned'
       END
FROM   dbo.production_runs pr
JOIN   dbo.run_statuses rs ON pr.run_status_id = rs.run_status_id
WHERE  pr.status = 'Planned' AND rs.code <> 'planned';
GO

-- ============================================================
-- 5. ALTER dbo.inventory_transactions – add location, reference, void
-- ============================================================
IF COL_LENGTH('dbo.inventory_transactions', 'location_id') IS NULL
    ALTER TABLE dbo.inventory_transactions ADD location_id UNIQUEIDENTIFIER NULL;
GO

IF COL_LENGTH('dbo.inventory_transactions', 'reference_type') IS NULL
    ALTER TABLE dbo.inventory_transactions ADD reference_type VARCHAR(100) NULL;
GO

IF COL_LENGTH('dbo.inventory_transactions', 'reference_id') IS NULL
    ALTER TABLE dbo.inventory_transactions ADD reference_id UNIQUEIDENTIFIER NULL;
GO

IF COL_LENGTH('dbo.inventory_transactions', 'reference_line_id') IS NULL
    ALTER TABLE dbo.inventory_transactions ADD reference_line_id UNIQUEIDENTIFIER NULL;
GO

IF COL_LENGTH('dbo.inventory_transactions', 'reason_code') IS NULL
    ALTER TABLE dbo.inventory_transactions ADD reason_code VARCHAR(100) NULL;
GO

IF COL_LENGTH('dbo.inventory_transactions', 'voided_at') IS NULL
    ALTER TABLE dbo.inventory_transactions ADD voided_at DATETIME2 NULL;
GO

IF COL_LENGTH('dbo.inventory_transactions', 'voided_by_user_id') IS NULL
    ALTER TABLE dbo.inventory_transactions ADD voided_by_user_id UNIQUEIDENTIFIER NULL
        REFERENCES dbo.users(user_id);
GO

IF COL_LENGTH('dbo.inventory_transactions', 'void_reason') IS NULL
    ALTER TABLE dbo.inventory_transactions ADD void_reason VARCHAR(500) NULL;
GO

-- ============================================================
-- 6. ALTER dbo.quality_metric_types – rename value_type -> data_type, add requires_notes
-- ============================================================
IF COL_LENGTH('dbo.quality_metric_types', 'value_type') IS NOT NULL
   AND COL_LENGTH('dbo.quality_metric_types', 'data_type') IS NULL
BEGIN
    EXEC sp_rename 'dbo.quality_metric_types.value_type', 'data_type', 'COLUMN';
END;
GO

IF COL_LENGTH('dbo.quality_metric_types', 'requires_notes') IS NULL
    ALTER TABLE dbo.quality_metric_types ADD requires_notes BIT NOT NULL DEFAULT 0;
GO

-- ============================================================
-- 7. ALTER dbo.production_run_deviations – add severity, preventive_action, status, closed
-- ============================================================
IF COL_LENGTH('dbo.production_run_deviations', 'severity') IS NULL
    ALTER TABLE dbo.production_run_deviations ADD severity VARCHAR(10) NOT NULL DEFAULT 'Med';
GO

IF COL_LENGTH('dbo.production_run_deviations', 'preventive_action') IS NULL
    ALTER TABLE dbo.production_run_deviations ADD preventive_action NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH('dbo.production_run_deviations', 'status') IS NULL
    ALTER TABLE dbo.production_run_deviations ADD status VARCHAR(20) NOT NULL DEFAULT 'Open';
GO

IF COL_LENGTH('dbo.production_run_deviations', 'closed_at') IS NULL
    ALTER TABLE dbo.production_run_deviations ADD closed_at DATETIME2 NULL;
GO

IF COL_LENGTH('dbo.production_run_deviations', 'closed_by_user_id') IS NULL
    ALTER TABLE dbo.production_run_deviations ADD closed_by_user_id UNIQUEIDENTIFIER NULL
        REFERENCES dbo.users(user_id);
GO

-- ============================================================
-- 8. ALTER dbo.audit_log – add event_type, details_json
-- ============================================================
IF COL_LENGTH('dbo.audit_log', 'event_type') IS NULL
    ALTER TABLE dbo.audit_log ADD event_type VARCHAR(100) NULL;
GO

IF COL_LENGTH('dbo.audit_log', 'details_json') IS NULL
    ALTER TABLE dbo.audit_log ADD details_json NVARCHAR(MAX) NULL;
GO

-- ============================================================
-- 9. ALTER dbo.ingredient_lots – add vendor_lot_code
-- ============================================================
IF COL_LENGTH('dbo.ingredient_lots', 'vendor_lot_code') IS NULL
    ALTER TABLE dbo.ingredient_lots ADD vendor_lot_code VARCHAR(200) NULL;
GO

-- ============================================================
-- 10. qc_plans
-- ============================================================
IF OBJECT_ID('dbo.qc_plans', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.qc_plans (
        qc_plan_id                      UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        name                            VARCHAR(200)     NOT NULL,
        applies_to_recipe_category      VARCHAR(100)     NULL,
        applies_to_recipe_id            UNIQUEIDENTIFIER NULL
            REFERENCES dbo.recipes(recipe_id),
        applies_to_recipe_version_id    UNIQUEIDENTIFIER NULL
            REFERENCES dbo.recipe_versions(recipe_version_id),
        is_active                       BIT              NOT NULL DEFAULT 1,
        created_at                      DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at                      DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        is_deleted                      BIT              NOT NULL DEFAULT 0
    );

    CREATE NONCLUSTERED INDEX IX_qc_plans_category
        ON dbo.qc_plans(applies_to_recipe_category) WHERE is_deleted = 0 AND is_active = 1;
    CREATE NONCLUSTERED INDEX IX_qc_plans_recipe
        ON dbo.qc_plans(applies_to_recipe_id) WHERE is_deleted = 0 AND is_active = 1;
    CREATE NONCLUSTERED INDEX IX_qc_plans_version
        ON dbo.qc_plans(applies_to_recipe_version_id) WHERE is_deleted = 0 AND is_active = 1;
END;
GO

-- ============================================================
-- 11. qc_plan_requirements
-- ============================================================
IF OBJECT_ID('dbo.qc_plan_requirements', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.qc_plan_requirements (
        qc_plan_requirement_id  UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        qc_plan_id              UNIQUEIDENTIFIER NOT NULL
            REFERENCES dbo.qc_plans(qc_plan_id),
        metric_type_id          UNIQUEIDENTIFIER NOT NULL
            REFERENCES dbo.quality_metric_types(quality_metric_type_id),
        stage                   VARCHAR(50)      NOT NULL
            CHECK (stage IN ('PreProduction','InProcess','PostProduction')),
        required                BIT              NOT NULL DEFAULT 1,
        min_value               NUMERIC(18,6)    NULL,
        max_value               NUMERIC(18,6)    NULL,
        fail_requires_deviation BIT              NOT NULL DEFAULT 0,
        sort_order              INT              NOT NULL DEFAULT 0,
        created_at              DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at              DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        is_deleted              BIT              NOT NULL DEFAULT 0
    );

    CREATE NONCLUSTERED INDEX IX_qc_plan_requirements_plan
        ON dbo.qc_plan_requirements(qc_plan_id) WHERE is_deleted = 0;
END;
GO

-- ============================================================
-- 12. run_materials
-- ============================================================
IF OBJECT_ID('dbo.run_materials', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.run_materials (
        run_material_id         UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        production_run_id       UNIQUEIDENTIFIER NOT NULL
            REFERENCES dbo.production_runs(production_run_id),
        item_id                 UNIQUEIDENTIFIER NOT NULL
            REFERENCES dbo.ingredients(ingredient_id),
        planned_qty             NUMERIC(18,6)    NOT NULL,
        planned_uom_id          UNIQUEIDENTIFIER NOT NULL
            REFERENCES dbo.units(unit_id),
        waste_qty               NUMERIC(18,6)    NOT NULL DEFAULT 0,
        sort_order              INT              NOT NULL DEFAULT 0,
        snapshot_line_json      NVARCHAR(MAX)    NULL,
        created_at              DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at              DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        is_deleted              BIT              NOT NULL DEFAULT 0
    );

    CREATE NONCLUSTERED INDEX IX_run_materials_run
        ON dbo.run_materials(production_run_id) WHERE is_deleted = 0;
    CREATE NONCLUSTERED INDEX IX_run_materials_item
        ON dbo.run_materials(item_id) WHERE is_deleted = 0;
END;
GO

-- ============================================================
-- 13. run_qc_entries
-- ============================================================
IF OBJECT_ID('dbo.run_qc_entries', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.run_qc_entries (
        run_qc_entry_id         UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        production_run_id       UNIQUEIDENTIFIER NOT NULL
            REFERENCES dbo.production_runs(production_run_id),
        metric_type_id          UNIQUEIDENTIFIER NOT NULL
            REFERENCES dbo.quality_metric_types(quality_metric_type_id),
        stage                   VARCHAR(50)      NOT NULL
            CHECK (stage IN ('PreProduction','InProcess','PostProduction')),
        value_number            NUMERIC(18,6)    NULL,
        value_text              VARCHAR(500)     NULL,
        uom_id                  UNIQUEIDENTIFIER NULL
            REFERENCES dbo.units(unit_id),
        observed_at             DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        notes                   NVARCHAR(MAX)    NULL,
        is_amended              BIT              NOT NULL DEFAULT 0,
        amended_at              DATETIME2        NULL,
        amended_by_user_id      UNIQUEIDENTIFIER NULL
            REFERENCES dbo.users(user_id),
        amended_reason          VARCHAR(500)     NULL,
        created_by_user_id      UNIQUEIDENTIFIER NOT NULL
            REFERENCES dbo.users(user_id),
        created_at              DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at              DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        is_deleted              BIT              NOT NULL DEFAULT 0
    );

    CREATE NONCLUSTERED INDEX IX_run_qc_entries_run
        ON dbo.run_qc_entries(production_run_id) WHERE is_deleted = 0;
    CREATE NONCLUSTERED INDEX IX_run_qc_entries_metric
        ON dbo.run_qc_entries(metric_type_id) WHERE is_deleted = 0;
    CREATE NONCLUSTERED INDEX IX_run_qc_entries_stage
        ON dbo.run_qc_entries(production_run_id, stage) WHERE is_deleted = 0;
END;
GO

-- ============================================================
-- 14. run_attachments
-- ============================================================
IF OBJECT_ID('dbo.run_attachments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.run_attachments (
        run_attachment_id       UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        production_run_id       UNIQUEIDENTIFIER NOT NULL
            REFERENCES dbo.production_runs(production_run_id),
        file_id                 UNIQUEIDENTIFIER NOT NULL
            REFERENCES dbo.attachments(attachment_id),
        related_type            VARCHAR(50)      NULL
            CHECK (related_type IN ('Deviation','QcEntry','General')),
        related_id              UNIQUEIDENTIFIER NULL,
        caption                 VARCHAR(500)     NULL,
        created_at              DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at              DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        is_deleted              BIT              NOT NULL DEFAULT 0
    );

    CREATE NONCLUSTERED INDEX IX_run_attachments_run
        ON dbo.run_attachments(production_run_id) WHERE is_deleted = 0;
END;
GO

-- ============================================================
-- 15. Additional indexes on altered tables
-- ============================================================
-- production_runs.status
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_production_runs_status' AND object_id = OBJECT_ID('dbo.production_runs'))
    CREATE NONCLUSTERED INDEX IX_production_runs_status
        ON dbo.production_runs(status) WHERE is_deleted = 0;
GO

-- recipe_versions.status
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_recipe_versions_status' AND object_id = OBJECT_ID('dbo.recipe_versions'))
    CREATE NONCLUSTERED INDEX IX_recipe_versions_status
        ON dbo.recipe_versions(status) WHERE is_deleted = 0;
GO

-- inventory_transactions voided_at for ledger queries
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_inventory_transactions_onhand' AND object_id = OBJECT_ID('dbo.inventory_transactions'))
    CREATE NONCLUSTERED INDEX IX_inventory_transactions_onhand
        ON dbo.inventory_transactions(ingredient_id, facility_id)
        INCLUDE (quantity)
        WHERE is_deleted = 0 AND voided_at IS NULL;
GO

-- audit_log event_type
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_log_event_type' AND object_id = OBJECT_ID('dbo.audit_log'))
    CREATE NONCLUSTERED INDEX IX_audit_log_event_type
        ON dbo.audit_log(event_type);
GO

PRINT 'Phase 9 migration complete.';
GO
