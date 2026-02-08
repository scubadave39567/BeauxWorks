/*
  BeauxWorks — Phase 4: Production Runs + Quality & Process Logging
  ==================================================================
  Run AFTER 03-phase-3-recipes.sql

  Creates (in dependency order):
    1.  dbo.product_types              (lookup)
    2.  dbo.quality_metric_types       (lookup, references units)
    3.  dbo.production_runs            (core)
    4.  dbo.production_run_codes       (QR/barcode)
    5.  dbo.production_run_ingredients (snapshot)
    6.  dbo.quality_templates          (per product type)
    7.  dbo.quality_template_items     (required logging points)
    8.  dbo.production_run_quality_logs (actual measurements)
    9.  dbo.production_run_deviations  (deviations + corrective actions)
    10. dbo.production_run_distribution (initial distribution tracking)
    11. dbo.api_idempotency_keys       (offline queue support)
  Then: additional units, indexes, triggers, views, seed data, demo.

  Idempotent: IF NOT EXISTS / IF OBJECT_ID checks throughout.

  NOTE: product_id column on production_runs is nullable with no FK.
        FK will be added in Phase 6 when dbo.products is created.
*/

SET QUOTED_IDENTIFIER ON;
GO

USE [BeauxWorks];
GO

------------------------------------------------------------------------
-- 0. ADDITIONAL UNITS (temperature, time, percentage for quality metrics)
------------------------------------------------------------------------

IF NOT EXISTS (SELECT 1 FROM dbo.units WHERE abbreviation = N'°F')
    INSERT INTO dbo.units (name, abbreviation, unit_type, is_base_unit)
    VALUES ('degree Fahrenheit', N'°F', 'temperature', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.units WHERE abbreviation = N'°C')
    INSERT INTO dbo.units (name, abbreviation, unit_type, is_base_unit)
    VALUES ('degree Celsius', N'°C', 'temperature', 0);

IF NOT EXISTS (SELECT 1 FROM dbo.units WHERE abbreviation = 'min')
    INSERT INTO dbo.units (name, abbreviation, unit_type, is_base_unit)
    VALUES ('minute', 'min', 'other', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.units WHERE abbreviation = 'hr')
    INSERT INTO dbo.units (name, abbreviation, unit_type, is_base_unit)
    VALUES ('hour', 'hr', 'other', 0);

IF NOT EXISTS (SELECT 1 FROM dbo.units WHERE abbreviation = '%')
    INSERT INTO dbo.units (name, abbreviation, unit_type, is_base_unit)
    VALUES ('percent', '%', 'other', 1);
GO

-- Add time conversions
DECLARE @min_id uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'min');
DECLARE @hr_id  uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'hr');

IF @min_id IS NOT NULL AND @hr_id IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @min_id AND to_unit_id = @hr_id)
        INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@min_id, @hr_id, 0.01666667);
    IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @hr_id AND to_unit_id = @min_id)
        INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@hr_id, @min_id, 60.00000000);
END

-- Temperature conversions are non-linear (require offset), so we do NOT add them
-- to unit_conversions. Temperature conversion is handled in application code:
--   °C = (°F - 32) × 5/9
--   °F = °C × 9/5 + 32
GO

PRINT 'Additional units seeded (°F, °C, min, hr, %).';
GO


------------------------------------------------------------------------
-- 1. TABLES
------------------------------------------------------------------------

-- 1.1 dbo.product_types (lookup)
IF OBJECT_ID(N'dbo.product_types', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.product_types (
        product_type_id  uniqueidentifier  NOT NULL
                         CONSTRAINT DF_pt_pk DEFAULT NEWSEQUENTIALID(),
        code             nvarchar(50)      NOT NULL,
        name             nvarchar(200)     NOT NULL,
        description      nvarchar(500)     NULL,
        created_at       datetime2(7)      NOT NULL
                         CONSTRAINT DF_pt_created DEFAULT SYSUTCDATETIME(),
        updated_at       datetime2(7)      NOT NULL
                         CONSTRAINT DF_pt_updated DEFAULT SYSUTCDATETIME(),
        is_deleted       bit               NOT NULL
                         CONSTRAINT DF_pt_del DEFAULT 0,

        CONSTRAINT PK_product_types      PRIMARY KEY CLUSTERED (product_type_id),
        CONSTRAINT UQ_product_types_code UNIQUE (code)
    );
    PRINT 'Created table dbo.product_types';
END
GO

-- 1.2 dbo.quality_metric_types (lookup)
IF OBJECT_ID(N'dbo.quality_metric_types', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.quality_metric_types (
        quality_metric_type_id  uniqueidentifier  NOT NULL
                                CONSTRAINT DF_qmt_pk DEFAULT NEWSEQUENTIALID(),
        code                    nvarchar(50)      NOT NULL,
        name                    nvarchar(200)     NOT NULL,
        unit_id                 uniqueidentifier  NULL,
        value_type              nvarchar(20)      NOT NULL,
        min_value               decimal(18,6)     NULL,
        max_value               decimal(18,6)     NULL,
        notes                   nvarchar(max)     NULL,
        created_at              datetime2(7)      NOT NULL
                                CONSTRAINT DF_qmt_created DEFAULT SYSUTCDATETIME(),
        updated_at              datetime2(7)      NOT NULL
                                CONSTRAINT DF_qmt_updated DEFAULT SYSUTCDATETIME(),
        is_deleted              bit               NOT NULL
                                CONSTRAINT DF_qmt_del DEFAULT 0,

        CONSTRAINT PK_quality_metric_types      PRIMARY KEY CLUSTERED (quality_metric_type_id),
        CONSTRAINT UQ_qmt_code                  UNIQUE (code),
        CONSTRAINT FK_qmt_unit                  FOREIGN KEY (unit_id) REFERENCES dbo.units (unit_id),
        CONSTRAINT CK_qmt_value_type            CHECK (value_type IN ('numeric', 'text', 'boolean'))
    );
    PRINT 'Created table dbo.quality_metric_types';
END
GO

-- 1.3 dbo.production_runs (core)
IF OBJECT_ID(N'dbo.production_runs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.production_runs (
        production_run_id     uniqueidentifier  NOT NULL
                              CONSTRAINT DF_pr_pk DEFAULT NEWSEQUENTIALID(),
        recipe_version_id     uniqueidentifier  NOT NULL,
        run_status_id         uniqueidentifier  NOT NULL,
        facility_id           uniqueidentifier  NOT NULL,
        operator_user_id      uniqueidentifier  NULL,
        product_type_id       uniqueidentifier  NULL,
        product_id            uniqueidentifier  NULL,   -- FK added in Phase 6
        planned_start_at      datetime2(7)      NULL,
        started_at            datetime2(7)      NULL,
        completed_at          datetime2(7)      NULL,
        target_yield_value    decimal(18,4)     NOT NULL,
        target_yield_unit_id  uniqueidentifier  NOT NULL,
        actual_yield_value    decimal(18,4)     NULL,
        actual_yield_unit_id  uniqueidentifier  NULL,
        lot_code              nvarchar(64)      NULL,
        notes                 nvarchar(max)     NULL,
        created_at            datetime2(7)      NOT NULL
                              CONSTRAINT DF_pr_created DEFAULT SYSUTCDATETIME(),
        updated_at            datetime2(7)      NOT NULL
                              CONSTRAINT DF_pr_updated DEFAULT SYSUTCDATETIME(),
        is_deleted            bit               NOT NULL
                              CONSTRAINT DF_pr_del DEFAULT 0,

        CONSTRAINT PK_production_runs          PRIMARY KEY CLUSTERED (production_run_id),
        CONSTRAINT FK_pr_recipe_version        FOREIGN KEY (recipe_version_id)
                                               REFERENCES dbo.recipe_versions (recipe_version_id),
        CONSTRAINT FK_pr_run_status            FOREIGN KEY (run_status_id)
                                               REFERENCES dbo.run_statuses (run_status_id),
        CONSTRAINT FK_pr_facility              FOREIGN KEY (facility_id)
                                               REFERENCES dbo.facilities (facility_id),
        CONSTRAINT FK_pr_operator              FOREIGN KEY (operator_user_id)
                                               REFERENCES dbo.users (user_id),
        CONSTRAINT FK_pr_product_type          FOREIGN KEY (product_type_id)
                                               REFERENCES dbo.product_types (product_type_id),
        CONSTRAINT FK_pr_target_yield_unit     FOREIGN KEY (target_yield_unit_id)
                                               REFERENCES dbo.units (unit_id),
        CONSTRAINT FK_pr_actual_yield_unit     FOREIGN KEY (actual_yield_unit_id)
                                               REFERENCES dbo.units (unit_id)
    );
    PRINT 'Created table dbo.production_runs';
END
GO

-- 1.4 dbo.production_run_codes (QR/barcode scanning)
IF OBJECT_ID(N'dbo.production_run_codes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.production_run_codes (
        production_run_code_id  uniqueidentifier  NOT NULL
                                CONSTRAINT DF_prc_pk DEFAULT NEWSEQUENTIALID(),
        production_run_id       uniqueidentifier  NOT NULL,
        code_value              nvarchar(128)     NOT NULL,
        code_type               nvarchar(20)      NOT NULL
                                CONSTRAINT DF_prc_type DEFAULT 'qr',
        issued_at               datetime2(7)      NOT NULL
                                CONSTRAINT DF_prc_issued DEFAULT SYSUTCDATETIME(),
        created_at              datetime2(7)      NOT NULL
                                CONSTRAINT DF_prc_created DEFAULT SYSUTCDATETIME(),
        updated_at              datetime2(7)      NOT NULL
                                CONSTRAINT DF_prc_updated DEFAULT SYSUTCDATETIME(),
        is_deleted              bit               NOT NULL
                                CONSTRAINT DF_prc_del DEFAULT 0,

        CONSTRAINT PK_production_run_codes      PRIMARY KEY CLUSTERED (production_run_code_id),
        CONSTRAINT FK_prc_run                   FOREIGN KEY (production_run_id)
                                                REFERENCES dbo.production_runs (production_run_id),
        CONSTRAINT UQ_prc_run                   UNIQUE (production_run_id),
        CONSTRAINT UQ_prc_code_value            UNIQUE (code_value),
        CONSTRAINT CK_prc_code_type             CHECK (code_type IN ('qr', 'code128', 'code39'))
    );
    PRINT 'Created table dbo.production_run_codes';
END
GO

-- 1.5 dbo.production_run_ingredients (snapshot at run creation)
IF OBJECT_ID(N'dbo.production_run_ingredients', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.production_run_ingredients (
        production_run_ingredient_id  uniqueidentifier  NOT NULL
                                      CONSTRAINT DF_pri_pk DEFAULT NEWSEQUENTIALID(),
        production_run_id             uniqueidentifier  NOT NULL,
        ingredient_id                 uniqueidentifier  NOT NULL,
        scaled_amount                 decimal(18,6)     NOT NULL,
        unit_id                       uniqueidentifier  NOT NULL,
        rounding_applied              nvarchar(50)      NULL,
        created_at                    datetime2(7)      NOT NULL
                                      CONSTRAINT DF_pri_created DEFAULT SYSUTCDATETIME(),
        updated_at                    datetime2(7)      NOT NULL
                                      CONSTRAINT DF_pri_updated DEFAULT SYSUTCDATETIME(),
        is_deleted                    bit               NOT NULL
                                      CONSTRAINT DF_pri_del DEFAULT 0,

        CONSTRAINT PK_pri                  PRIMARY KEY CLUSTERED (production_run_ingredient_id),
        CONSTRAINT FK_pri_run              FOREIGN KEY (production_run_id)
                                           REFERENCES dbo.production_runs (production_run_id),
        CONSTRAINT FK_pri_ingredient       FOREIGN KEY (ingredient_id)
                                           REFERENCES dbo.ingredients (ingredient_id),
        CONSTRAINT FK_pri_unit             FOREIGN KEY (unit_id)
                                           REFERENCES dbo.units (unit_id)
    );
    PRINT 'Created table dbo.production_run_ingredients';
END
GO

-- 1.6 dbo.quality_templates (per product type)
IF OBJECT_ID(N'dbo.quality_templates', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.quality_templates (
        quality_template_id  uniqueidentifier  NOT NULL
                             CONSTRAINT DF_qt_pk DEFAULT NEWSEQUENTIALID(),
        product_type_id      uniqueidentifier  NOT NULL,
        name                 nvarchar(200)     NOT NULL,
        is_active            bit               NOT NULL
                             CONSTRAINT DF_qt_active DEFAULT 1,
        notes                nvarchar(max)     NULL,
        created_at           datetime2(7)      NOT NULL
                             CONSTRAINT DF_qt_created DEFAULT SYSUTCDATETIME(),
        updated_at           datetime2(7)      NOT NULL
                             CONSTRAINT DF_qt_updated DEFAULT SYSUTCDATETIME(),
        is_deleted           bit               NOT NULL
                             CONSTRAINT DF_qt_del DEFAULT 0,

        CONSTRAINT PK_quality_templates      PRIMARY KEY CLUSTERED (quality_template_id),
        CONSTRAINT FK_qt_product_type        FOREIGN KEY (product_type_id)
                                             REFERENCES dbo.product_types (product_type_id)
    );
    PRINT 'Created table dbo.quality_templates';
END
GO

-- 1.7 dbo.quality_template_items (logging points per template)
IF OBJECT_ID(N'dbo.quality_template_items', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.quality_template_items (
        quality_template_item_id  uniqueidentifier  NOT NULL
                                  CONSTRAINT DF_qti_pk DEFAULT NEWSEQUENTIALID(),
        quality_template_id       uniqueidentifier  NOT NULL,
        quality_metric_type_id    uniqueidentifier  NOT NULL,
        required                  bit               NOT NULL
                                  CONSTRAINT DF_qti_required DEFAULT 1,
        target_min                decimal(18,6)     NULL,
        target_max                decimal(18,6)     NULL,
        sort_order                int               NOT NULL
                                  CONSTRAINT DF_qti_sort DEFAULT 0,
        guidance_text             nvarchar(max)     NULL,
        stage_code                nvarchar(50)      NULL,
        created_at                datetime2(7)      NOT NULL
                                  CONSTRAINT DF_qti_created DEFAULT SYSUTCDATETIME(),
        updated_at                datetime2(7)      NOT NULL
                                  CONSTRAINT DF_qti_updated DEFAULT SYSUTCDATETIME(),
        is_deleted                bit               NOT NULL
                                  CONSTRAINT DF_qti_del DEFAULT 0,

        CONSTRAINT PK_quality_template_items     PRIMARY KEY CLUSTERED (quality_template_item_id),
        CONSTRAINT FK_qti_template               FOREIGN KEY (quality_template_id)
                                                 REFERENCES dbo.quality_templates (quality_template_id),
        CONSTRAINT FK_qti_metric_type            FOREIGN KEY (quality_metric_type_id)
                                                 REFERENCES dbo.quality_metric_types (quality_metric_type_id)
    );
    PRINT 'Created table dbo.quality_template_items';
END
GO

-- 1.8 dbo.production_run_quality_logs (actual measurements)
IF OBJECT_ID(N'dbo.production_run_quality_logs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.production_run_quality_logs (
        production_run_quality_log_id  uniqueidentifier  NOT NULL
                                       CONSTRAINT DF_prql_pk DEFAULT NEWSEQUENTIALID(),
        production_run_id              uniqueidentifier  NOT NULL,
        quality_template_item_id       uniqueidentifier  NULL,  -- NULL for ad-hoc logs
        quality_metric_type_id         uniqueidentifier  NOT NULL,
        measured_at                    datetime2(7)      NOT NULL
                                       CONSTRAINT DF_prql_measured DEFAULT SYSUTCDATETIME(),
        measured_by_user_id            uniqueidentifier  NOT NULL,
        value_numeric                  decimal(18,6)     NULL,
        value_text                     nvarchar(500)     NULL,
        value_bool                     bit               NULL,
        unit_id                        uniqueidentifier  NULL,
        notes                          nvarchar(max)     NULL,
        created_at                     datetime2(7)      NOT NULL
                                       CONSTRAINT DF_prql_created DEFAULT SYSUTCDATETIME(),
        updated_at                     datetime2(7)      NOT NULL
                                       CONSTRAINT DF_prql_updated DEFAULT SYSUTCDATETIME(),
        is_deleted                     bit               NOT NULL
                                       CONSTRAINT DF_prql_del DEFAULT 0,

        CONSTRAINT PK_prql                     PRIMARY KEY CLUSTERED (production_run_quality_log_id),
        CONSTRAINT FK_prql_run                 FOREIGN KEY (production_run_id)
                                               REFERENCES dbo.production_runs (production_run_id),
        CONSTRAINT FK_prql_template_item       FOREIGN KEY (quality_template_item_id)
                                               REFERENCES dbo.quality_template_items (quality_template_item_id),
        CONSTRAINT FK_prql_metric_type         FOREIGN KEY (quality_metric_type_id)
                                               REFERENCES dbo.quality_metric_types (quality_metric_type_id),
        CONSTRAINT FK_prql_measured_by         FOREIGN KEY (measured_by_user_id)
                                               REFERENCES dbo.users (user_id),
        CONSTRAINT FK_prql_unit                FOREIGN KEY (unit_id)
                                               REFERENCES dbo.units (unit_id)
    );
    PRINT 'Created table dbo.production_run_quality_logs';
END
GO

-- 1.9 dbo.production_run_deviations
IF OBJECT_ID(N'dbo.production_run_deviations', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.production_run_deviations (
        production_run_deviation_id  uniqueidentifier  NOT NULL
                                     CONSTRAINT DF_prd_pk DEFAULT NEWSEQUENTIALID(),
        production_run_id            uniqueidentifier  NOT NULL,
        detected_at                  datetime2(7)      NOT NULL
                                     CONSTRAINT DF_prd_detected DEFAULT SYSUTCDATETIME(),
        detected_by_user_id          uniqueidentifier  NOT NULL,
        deviation_type               nvarchar(100)     NOT NULL,
        details                      nvarchar(max)     NOT NULL,
        corrective_action            nvarchar(max)     NULL,
        resolved_at                  datetime2(7)      NULL,
        resolved_by_user_id          uniqueidentifier  NULL,
        created_at                   datetime2(7)      NOT NULL
                                     CONSTRAINT DF_prd_created DEFAULT SYSUTCDATETIME(),
        updated_at                   datetime2(7)      NOT NULL
                                     CONSTRAINT DF_prd_updated DEFAULT SYSUTCDATETIME(),
        is_deleted                   bit               NOT NULL
                                     CONSTRAINT DF_prd_del DEFAULT 0,

        CONSTRAINT PK_prd                      PRIMARY KEY CLUSTERED (production_run_deviation_id),
        CONSTRAINT FK_prd_run                  FOREIGN KEY (production_run_id)
                                               REFERENCES dbo.production_runs (production_run_id),
        CONSTRAINT FK_prd_detected_by          FOREIGN KEY (detected_by_user_id)
                                               REFERENCES dbo.users (user_id),
        CONSTRAINT FK_prd_resolved_by          FOREIGN KEY (resolved_by_user_id)
                                               REFERENCES dbo.users (user_id),
        CONSTRAINT CK_prd_deviation_type       CHECK (deviation_type IN (
            'ph_out_of_range', 'temp_out_of_range', 'time_overrun',
            'seal_issue', 'contamination', 'equipment_failure', 'other'
        ))
    );
    PRINT 'Created table dbo.production_run_deviations';
END
GO

-- 1.10 dbo.production_run_distribution (initial distribution / recall readiness)
IF OBJECT_ID(N'dbo.production_run_distribution', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.production_run_distribution (
        production_run_distribution_id  uniqueidentifier  NOT NULL
                                        CONSTRAINT DF_prdist_pk DEFAULT NEWSEQUENTIALID(),
        production_run_id               uniqueidentifier  NOT NULL,
        distributed_at                  datetime2(7)      NOT NULL
                                        CONSTRAINT DF_prdist_at DEFAULT SYSUTCDATETIME(),
        channel_id                      uniqueidentifier  NULL,
        customer_name                   nvarchar(200)     NULL,
        location                        nvarchar(200)     NULL,
        quantity                        decimal(18,4)     NOT NULL,
        unit_id                         uniqueidentifier  NOT NULL,
        notes                           nvarchar(max)     NULL,
        created_at                      datetime2(7)      NOT NULL
                                        CONSTRAINT DF_prdist_created DEFAULT SYSUTCDATETIME(),
        updated_at                      datetime2(7)      NOT NULL
                                        CONSTRAINT DF_prdist_updated DEFAULT SYSUTCDATETIME(),
        is_deleted                      bit               NOT NULL
                                        CONSTRAINT DF_prdist_del DEFAULT 0,

        CONSTRAINT PK_prdist                   PRIMARY KEY CLUSTERED (production_run_distribution_id),
        CONSTRAINT FK_prdist_run               FOREIGN KEY (production_run_id)
                                               REFERENCES dbo.production_runs (production_run_id),
        CONSTRAINT FK_prdist_channel           FOREIGN KEY (channel_id)
                                               REFERENCES dbo.sales_channels (sales_channel_id),
        CONSTRAINT FK_prdist_unit              FOREIGN KEY (unit_id)
                                               REFERENCES dbo.units (unit_id)
    );
    PRINT 'Created table dbo.production_run_distribution';
END
GO

-- 1.11 dbo.api_idempotency_keys (offline queue support)
IF OBJECT_ID(N'dbo.api_idempotency_keys', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.api_idempotency_keys (
        api_idempotency_key_id  uniqueidentifier  NOT NULL
                                CONSTRAINT DF_aik_pk DEFAULT NEWSEQUENTIALID(),
        user_id                 uniqueidentifier  NOT NULL,
        idempotency_key         nvarchar(100)     NOT NULL,
        request_hash            varbinary(32)     NULL,
        response_metadata_json  nvarchar(max)     NULL,
        created_at              datetime2(7)      NOT NULL
                                CONSTRAINT DF_aik_created DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_aik                      PRIMARY KEY CLUSTERED (api_idempotency_key_id),
        CONSTRAINT FK_aik_user                 FOREIGN KEY (user_id)
                                               REFERENCES dbo.users (user_id),
        CONSTRAINT UQ_aik_user_key             UNIQUE (user_id, idempotency_key)
    );
    PRINT 'Created table dbo.api_idempotency_keys';
END
GO


------------------------------------------------------------------------
-- 2. INDEXES
------------------------------------------------------------------------

-- production_runs
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_pr_recipe_version' AND object_id = OBJECT_ID(N'dbo.production_runs'))
    CREATE NONCLUSTERED INDEX IX_pr_recipe_version
        ON dbo.production_runs (recipe_version_id)
        WHERE is_deleted = 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_pr_status' AND object_id = OBJECT_ID(N'dbo.production_runs'))
    CREATE NONCLUSTERED INDEX IX_pr_status
        ON dbo.production_runs (run_status_id)
        INCLUDE (facility_id, planned_start_at)
        WHERE is_deleted = 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_pr_facility' AND object_id = OBJECT_ID(N'dbo.production_runs'))
    CREATE NONCLUSTERED INDEX IX_pr_facility
        ON dbo.production_runs (facility_id)
        WHERE is_deleted = 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_pr_operator' AND object_id = OBJECT_ID(N'dbo.production_runs'))
    CREATE NONCLUSTERED INDEX IX_pr_operator
        ON dbo.production_runs (operator_user_id)
        WHERE is_deleted = 0 AND operator_user_id IS NOT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_pr_lot_code' AND object_id = OBJECT_ID(N'dbo.production_runs'))
    CREATE NONCLUSTERED INDEX IX_pr_lot_code
        ON dbo.production_runs (lot_code)
        WHERE lot_code IS NOT NULL AND is_deleted = 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_pr_product_type' AND object_id = OBJECT_ID(N'dbo.production_runs'))
    CREATE NONCLUSTERED INDEX IX_pr_product_type
        ON dbo.production_runs (product_type_id)
        WHERE is_deleted = 0 AND product_type_id IS NOT NULL;
GO

-- production_run_ingredients
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_pri_run' AND object_id = OBJECT_ID(N'dbo.production_run_ingredients'))
    CREATE NONCLUSTERED INDEX IX_pri_run
        ON dbo.production_run_ingredients (production_run_id)
        WHERE is_deleted = 0;
GO

-- quality_templates
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_qt_product_type' AND object_id = OBJECT_ID(N'dbo.quality_templates'))
    CREATE NONCLUSTERED INDEX IX_qt_product_type
        ON dbo.quality_templates (product_type_id)
        WHERE is_active = 1 AND is_deleted = 0;
GO

-- quality_template_items
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_qti_template' AND object_id = OBJECT_ID(N'dbo.quality_template_items'))
    CREATE NONCLUSTERED INDEX IX_qti_template
        ON dbo.quality_template_items (quality_template_id, sort_order)
        WHERE is_deleted = 0;
GO

-- production_run_quality_logs
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_prql_run' AND object_id = OBJECT_ID(N'dbo.production_run_quality_logs'))
    CREATE NONCLUSTERED INDEX IX_prql_run
        ON dbo.production_run_quality_logs (production_run_id, measured_at)
        WHERE is_deleted = 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_prql_metric' AND object_id = OBJECT_ID(N'dbo.production_run_quality_logs'))
    CREATE NONCLUSTERED INDEX IX_prql_metric
        ON dbo.production_run_quality_logs (quality_metric_type_id)
        WHERE is_deleted = 0;
GO

-- deviations
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_prd_run' AND object_id = OBJECT_ID(N'dbo.production_run_deviations'))
    CREATE NONCLUSTERED INDEX IX_prd_run
        ON dbo.production_run_deviations (production_run_id)
        WHERE is_deleted = 0;
GO

-- distribution
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_prdist_run' AND object_id = OBJECT_ID(N'dbo.production_run_distribution'))
    CREATE NONCLUSTERED INDEX IX_prdist_run
        ON dbo.production_run_distribution (production_run_id)
        WHERE is_deleted = 0;
GO

-- idempotency keys (TTL cleanup)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_aik_created' AND object_id = OBJECT_ID(N'dbo.api_idempotency_keys'))
    CREATE NONCLUSTERED INDEX IX_aik_created
        ON dbo.api_idempotency_keys (created_at);
GO


------------------------------------------------------------------------
-- 3. TRIGGERS (updated_at)
------------------------------------------------------------------------

CREATE OR ALTER TRIGGER dbo.TR_product_types_updated_at
ON dbo.product_types AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.product_types t INNER JOIN inserted i ON t.product_type_id = i.product_type_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_quality_metric_types_updated_at
ON dbo.quality_metric_types AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.quality_metric_types t INNER JOIN inserted i ON t.quality_metric_type_id = i.quality_metric_type_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_production_runs_updated_at
ON dbo.production_runs AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.production_runs t INNER JOIN inserted i ON t.production_run_id = i.production_run_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_prc_updated_at
ON dbo.production_run_codes AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.production_run_codes t INNER JOIN inserted i ON t.production_run_code_id = i.production_run_code_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_pri_updated_at
ON dbo.production_run_ingredients AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.production_run_ingredients t INNER JOIN inserted i ON t.production_run_ingredient_id = i.production_run_ingredient_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_qt_updated_at
ON dbo.quality_templates AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.quality_templates t INNER JOIN inserted i ON t.quality_template_id = i.quality_template_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_qti_updated_at
ON dbo.quality_template_items AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.quality_template_items t INNER JOIN inserted i ON t.quality_template_item_id = i.quality_template_item_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_prql_updated_at
ON dbo.production_run_quality_logs AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.production_run_quality_logs t INNER JOIN inserted i ON t.production_run_quality_log_id = i.production_run_quality_log_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_prd_updated_at
ON dbo.production_run_deviations AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.production_run_deviations t INNER JOIN inserted i ON t.production_run_deviation_id = i.production_run_deviation_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_prdist_updated_at
ON dbo.production_run_distribution AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.production_run_distribution t INNER JOIN inserted i ON t.production_run_distribution_id = i.production_run_distribution_id;
END;
GO


------------------------------------------------------------------------
-- 4. SEED DATA
------------------------------------------------------------------------

-- =====================================================================
-- 4.1  Product types (11 required)
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.product_types WHERE code = 'breads')
    INSERT INTO dbo.product_types (code, name, description) VALUES ('breads', 'Breads', 'Breads, rolls, and baked goods');
IF NOT EXISTS (SELECT 1 FROM dbo.product_types WHERE code = 'pickles')
    INSERT INTO dbo.product_types (code, name, description) VALUES ('pickles', 'Pickles', 'Pickled vegetables — vinegar or brine');
IF NOT EXISTS (SELECT 1 FROM dbo.product_types WHERE code = 'hot_sauces')
    INSERT INTO dbo.product_types (code, name, description) VALUES ('hot_sauces', 'Hot Sauces', 'Hot sauces and pepper-based condiments');
IF NOT EXISTS (SELECT 1 FROM dbo.product_types WHERE code = 'sauerkraut')
    INSERT INTO dbo.product_types (code, name, description) VALUES ('sauerkraut', 'Sauerkraut', 'Fermented cabbage');
IF NOT EXISTS (SELECT 1 FROM dbo.product_types WHERE code = 'kimchi')
    INSERT INTO dbo.product_types (code, name, description) VALUES ('kimchi', 'Kimchi', 'Korean-style fermented vegetables');
IF NOT EXISTS (SELECT 1 FROM dbo.product_types WHERE code = 'ground_spice_powders')
    INSERT INTO dbo.product_types (code, name, description) VALUES ('ground_spice_powders', 'Ground Spice Powders', 'Ground spice blends, rubs, and seasonings');
IF NOT EXISTS (SELECT 1 FROM dbo.product_types WHERE code = 'bbq_sauces')
    INSERT INTO dbo.product_types (code, name, description) VALUES ('bbq_sauces', 'BBQ Sauces', 'Barbecue sauces and glazes');
IF NOT EXISTS (SELECT 1 FROM dbo.product_types WHERE code = 'beverages_non_alcoholic')
    INSERT INTO dbo.product_types (code, name, description) VALUES ('beverages_non_alcoholic', 'Beverages (Non-Alcoholic)', 'Non-alcoholic beverages');
IF NOT EXISTS (SELECT 1 FROM dbo.product_types WHERE code = 'worcestershire_sauces')
    INSERT INTO dbo.product_types (code, name, description) VALUES ('worcestershire_sauces', 'Worcestershire Sauces', 'Worcestershire and similar fermented condiments');
IF NOT EXISTS (SELECT 1 FROM dbo.product_types WHERE code = 'dehydrated_fruit_slices')
    INSERT INTO dbo.product_types (code, name, description) VALUES ('dehydrated_fruit_slices', 'Dehydrated Fruit Slices', 'Dehydrated fruits, vegetables, and snacks');
IF NOT EXISTS (SELECT 1 FROM dbo.product_types WHERE code = 'fermented_other')
    INSERT INTO dbo.product_types (code, name, description) VALUES ('fermented_other', 'Fermented — Other', 'Other fermented products not otherwise categorized');
GO

PRINT 'Product types seeded (11).';
GO

-- =====================================================================
-- 4.2  Quality metric types
-- =====================================================================
DECLARE @f_id  uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = N'°F');
DECLARE @c_id  uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = N'°C');
DECLARE @pct_id uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = '%');
DECLARE @min2  uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'min');
DECLARE @g2    uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'g');

IF NOT EXISTS (SELECT 1 FROM dbo.quality_metric_types WHERE code = 'temp')
    INSERT INTO dbo.quality_metric_types (code, name, unit_id, value_type, notes)
    VALUES ('temp', 'Temperature', @f_id, 'numeric', 'Default unit °F. App converts °C as needed.');

IF NOT EXISTS (SELECT 1 FROM dbo.quality_metric_types WHERE code = 'ph')
    INSERT INTO dbo.quality_metric_types (code, name, unit_id, value_type, min_value, max_value, notes)
    VALUES ('ph', 'pH', NULL, 'numeric', 0.000000, 14.000000, 'Logarithmic acidity scale. Unitless.');

IF NOT EXISTS (SELECT 1 FROM dbo.quality_metric_types WHERE code = 'salinity')
    INSERT INTO dbo.quality_metric_types (code, name, unit_id, value_type, min_value, max_value, notes)
    VALUES ('salinity', 'Salinity %', @pct_id, 'numeric', 0.000000, 100.000000, 'Salt concentration as percentage by weight.');

IF NOT EXISTS (SELECT 1 FROM dbo.quality_metric_types WHERE code = 'brix')
    INSERT INTO dbo.quality_metric_types (code, name, unit_id, value_type, min_value, max_value, notes)
    VALUES ('brix', 'Brix (°Bx)', NULL, 'numeric', 0.000000, 100.000000, 'Sugar content by refractometer. Unitless scale.');

IF NOT EXISTS (SELECT 1 FROM dbo.quality_metric_types WHERE code = 'water_activity')
    INSERT INTO dbo.quality_metric_types (code, name, unit_id, value_type, min_value, max_value, notes)
    VALUES ('water_activity', 'Water Activity (aw)', NULL, 'numeric', 0.000000, 1.000000, 'Water activity scale 0–1.');

IF NOT EXISTS (SELECT 1 FROM dbo.quality_metric_types WHERE code = 'time_minutes')
    INSERT INTO dbo.quality_metric_types (code, name, unit_id, value_type, notes)
    VALUES ('time_minutes', 'Time (minutes)', @min2, 'numeric', 'Elapsed time checkpoint in minutes.');

IF NOT EXISTS (SELECT 1 FROM dbo.quality_metric_types WHERE code = 'humidity')
    INSERT INTO dbo.quality_metric_types (code, name, unit_id, value_type, min_value, max_value, notes)
    VALUES ('humidity', 'Humidity %', @pct_id, 'numeric', 0.000000, 100.000000, 'Relative humidity.');

IF NOT EXISTS (SELECT 1 FROM dbo.quality_metric_types WHERE code = 'weight')
    INSERT INTO dbo.quality_metric_types (code, name, unit_id, value_type, notes)
    VALUES ('weight', 'Weight', @g2, 'numeric', 'Weight measurement. Default unit grams.');

IF NOT EXISTS (SELECT 1 FROM dbo.quality_metric_types WHERE code = 'visual_check')
    INSERT INTO dbo.quality_metric_types (code, name, unit_id, value_type, notes)
    VALUES ('visual_check', 'Visual Check', NULL, 'boolean', 'Pass/fail visual inspection.');

IF NOT EXISTS (SELECT 1 FROM dbo.quality_metric_types WHERE code = 'notes_observation')
    INSERT INTO dbo.quality_metric_types (code, name, unit_id, value_type, notes)
    VALUES ('notes_observation', 'Notes / Observation', NULL, 'text', 'Free-text observation or note.');
GO

PRINT 'Quality metric types seeded (10).';
GO


-- =====================================================================
-- 4.3  Quality templates + items (1 per product type)
-- =====================================================================

-- Helper variables for metric type IDs
DECLARE @m_temp  uniqueidentifier = (SELECT quality_metric_type_id FROM dbo.quality_metric_types WHERE code = 'temp');
DECLARE @m_ph    uniqueidentifier = (SELECT quality_metric_type_id FROM dbo.quality_metric_types WHERE code = 'ph');
DECLARE @m_sal   uniqueidentifier = (SELECT quality_metric_type_id FROM dbo.quality_metric_types WHERE code = 'salinity');
DECLARE @m_brix  uniqueidentifier = (SELECT quality_metric_type_id FROM dbo.quality_metric_types WHERE code = 'brix');
DECLARE @m_aw    uniqueidentifier = (SELECT quality_metric_type_id FROM dbo.quality_metric_types WHERE code = 'water_activity');
DECLARE @m_time  uniqueidentifier = (SELECT quality_metric_type_id FROM dbo.quality_metric_types WHERE code = 'time_minutes');
DECLARE @m_wt    uniqueidentifier = (SELECT quality_metric_type_id FROM dbo.quality_metric_types WHERE code = 'weight');

DECLARE @tid uniqueidentifier;  -- template ID reused per block

-- ── Breads ──────────────────────────────────────────────────────────
DECLARE @pt_breads uniqueidentifier = (SELECT product_type_id FROM dbo.product_types WHERE code = 'breads');
IF NOT EXISTS (SELECT 1 FROM dbo.quality_templates WHERE product_type_id = @pt_breads AND is_active = 1 AND is_deleted = 0)
BEGIN
    SET @tid = NEWID();
    INSERT INTO dbo.quality_templates (quality_template_id, product_type_id, name, notes)
    VALUES (@tid, @pt_breads, 'Breads — Default QC Template', 'Temperature checks for dough and oven. Time checkpoints optional.');

    INSERT INTO dbo.quality_template_items (quality_template_id, quality_metric_type_id, required, target_min, target_max, sort_order, guidance_text, stage_code) VALUES
    (@tid, @m_temp, 1, 75.0, 82.0,  10, 'Record dough temperature after mixing.',          'mix'),
    (@tid, @m_temp, 1, 350.0, 500.0, 20, 'Record oven temperature at load.',                'bake'),
    (@tid, @m_time, 0, NULL, NULL,   30, 'Record total bake time in minutes.',               'bake'),
    (@tid, @m_temp, 1, 190.0, 210.0, 40, 'Record internal bread temp at pull (done check).', 'bake');
END

-- ── Pickles ─────────────────────────────────────────────────────────
DECLARE @pt_pickles uniqueidentifier = (SELECT product_type_id FROM dbo.product_types WHERE code = 'pickles');
IF NOT EXISTS (SELECT 1 FROM dbo.quality_templates WHERE product_type_id = @pt_pickles AND is_active = 1 AND is_deleted = 0)
BEGIN
    SET @tid = NEWID();
    INSERT INTO dbo.quality_templates (quality_template_id, product_type_id, name, notes)
    VALUES (@tid, @pt_pickles, 'Pickles — Default QC Template', 'pH and temperature required. Salinity optional.');

    INSERT INTO dbo.quality_template_items (quality_template_id, quality_metric_type_id, required, target_min, target_max, sort_order, guidance_text, stage_code) VALUES
    (@tid, @m_ph,   1, NULL,  4.6,   10, 'Record pH of brine at pack. Must be ≤ 4.6.',       'pack'),
    (@tid, @m_temp, 1, 180.0, 212.0, 20, 'Record brine temperature at fill.',                 'fill'),
    (@tid, @m_sal,  0, 3.0,   10.0,  30, 'Record salinity % if measured.',                    'pack'),
    (@tid, @m_ph,   0, NULL,  4.6,   40, 'Record equilibrium pH after 24h if applicable.',    'post_24h');
END

-- ── Hot Sauces ──────────────────────────────────────────────────────
DECLARE @pt_hot uniqueidentifier = (SELECT product_type_id FROM dbo.product_types WHERE code = 'hot_sauces');
IF NOT EXISTS (SELECT 1 FROM dbo.quality_templates WHERE product_type_id = @pt_hot AND is_active = 1 AND is_deleted = 0)
BEGIN
    SET @tid = NEWID();
    INSERT INTO dbo.quality_templates (quality_template_id, product_type_id, name, notes)
    VALUES (@tid, @pt_hot, 'Hot Sauces — Default QC Template', 'pH + temperature at cook and cool. Optional Brix.');

    INSERT INTO dbo.quality_template_items (quality_template_id, quality_metric_type_id, required, target_min, target_max, sort_order, guidance_text, stage_code) VALUES
    (@tid, @m_temp, 1, 180.0, 212.0, 10, 'Record temperature at full boil / cook.',          'cook'),
    (@tid, @m_ph,   1, NULL,  3.5,   20, 'Record pH during cook. Target ≤ 3.5.',             'cook'),
    (@tid, @m_temp, 1, NULL,  140.0, 30, 'Record temperature at fill / bottling.',            'fill'),
    (@tid, @m_ph,   1, NULL,  3.5,   40, 'Record final pH at bottling.',                      'fill'),
    (@tid, @m_brix, 0, NULL,  NULL,  50, 'Record Brix if sweetened (refractometer).',          'fill');
END

-- ── Sauerkraut ──────────────────────────────────────────────────────
DECLARE @pt_kraut uniqueidentifier = (SELECT product_type_id FROM dbo.product_types WHERE code = 'sauerkraut');
IF NOT EXISTS (SELECT 1 FROM dbo.quality_templates WHERE product_type_id = @pt_kraut AND is_active = 1 AND is_deleted = 0)
BEGIN
    SET @tid = NEWID();
    INSERT INTO dbo.quality_templates (quality_template_id, product_type_id, name, notes)
    VALUES (@tid, @pt_kraut, 'Sauerkraut — Default QC Template', 'pH + temp throughout fermentation. Salinity at pack.');

    INSERT INTO dbo.quality_template_items (quality_template_id, quality_metric_type_id, required, target_min, target_max, sort_order, guidance_text, stage_code) VALUES
    (@tid, @m_sal,  1, 2.0, 3.5,    10, 'Record salinity % at initial salt pack.',            'pack'),
    (@tid, @m_temp, 1, 65.0, 75.0,  20, 'Record fermentation environment temp.',              'ferment'),
    (@tid, @m_ph,   1, NULL, 4.6,   30, 'Record pH at ferment check (day 3–7).',              'ferment'),
    (@tid, @m_ph,   1, NULL, 4.6,   40, 'Record final pH before packaging.',                  'final');
END

-- ── Kimchi ──────────────────────────────────────────────────────────
DECLARE @pt_kimchi uniqueidentifier = (SELECT product_type_id FROM dbo.product_types WHERE code = 'kimchi');
IF NOT EXISTS (SELECT 1 FROM dbo.quality_templates WHERE product_type_id = @pt_kimchi AND is_active = 1 AND is_deleted = 0)
BEGIN
    SET @tid = NEWID();
    INSERT INTO dbo.quality_templates (quality_template_id, product_type_id, name, notes)
    VALUES (@tid, @pt_kimchi, 'Kimchi — Default QC Template', 'pH + temp throughout fermentation. Salinity at pack.');

    INSERT INTO dbo.quality_template_items (quality_template_id, quality_metric_type_id, required, target_min, target_max, sort_order, guidance_text, stage_code) VALUES
    (@tid, @m_sal,  1, 2.5, 4.0,    10, 'Record salinity % at initial brine/paste.',          'pack'),
    (@tid, @m_temp, 1, 60.0, 72.0,  20, 'Record fermentation environment temp.',              'ferment'),
    (@tid, @m_ph,   1, NULL, 4.6,   30, 'Record pH at ferment check.',                        'ferment'),
    (@tid, @m_ph,   1, NULL, 4.6,   40, 'Record final pH before packaging.',                  'final');
END

-- ── BBQ Sauces ──────────────────────────────────────────────────────
DECLARE @pt_bbq uniqueidentifier = (SELECT product_type_id FROM dbo.product_types WHERE code = 'bbq_sauces');
IF NOT EXISTS (SELECT 1 FROM dbo.quality_templates WHERE product_type_id = @pt_bbq AND is_active = 1 AND is_deleted = 0)
BEGIN
    SET @tid = NEWID();
    INSERT INTO dbo.quality_templates (quality_template_id, product_type_id, name, notes)
    VALUES (@tid, @pt_bbq, 'BBQ Sauces — Default QC Template', 'Temperature at cook/cool. pH optional if acidified. Brix optional.');

    INSERT INTO dbo.quality_template_items (quality_template_id, quality_metric_type_id, required, target_min, target_max, sort_order, guidance_text, stage_code) VALUES
    (@tid, @m_temp, 1, 180.0, 212.0, 10, 'Record temperature at cook/simmer.',                'cook'),
    (@tid, @m_temp, 1, NULL, 140.0,  20, 'Record temperature at fill.',                        'fill'),
    (@tid, @m_ph,   0, NULL, 4.6,    30, 'Record pH if acidified product.',                    'fill'),
    (@tid, @m_brix, 0, NULL, NULL,   40, 'Record Brix if measured.',                            'fill');
END

-- ── Beverages (non-alcoholic) ───────────────────────────────────────
DECLARE @pt_bev uniqueidentifier = (SELECT product_type_id FROM dbo.product_types WHERE code = 'beverages_non_alcoholic');
IF NOT EXISTS (SELECT 1 FROM dbo.quality_templates WHERE product_type_id = @pt_bev AND is_active = 1 AND is_deleted = 0)
BEGIN
    SET @tid = NEWID();
    INSERT INTO dbo.quality_templates (quality_template_id, product_type_id, name, notes)
    VALUES (@tid, @pt_bev, 'Beverages — Default QC Template', 'Temperature at pasteurization or chill. pH optional.');

    INSERT INTO dbo.quality_template_items (quality_template_id, quality_metric_type_id, required, target_min, target_max, sort_order, guidance_text, stage_code) VALUES
    (@tid, @m_temp, 1, 160.0, 212.0, 10, 'Record pasteurization temperature.',                'pasteurize'),
    (@tid, @m_temp, 1, 33.0, 40.0,   20, 'Record chill temperature before fill.',              'chill'),
    (@tid, @m_ph,   0, NULL, NULL,    30, 'Record pH if applicable per recipe.',                'fill');
END

-- ── Worcestershire Sauces ───────────────────────────────────────────
DECLARE @pt_worc uniqueidentifier = (SELECT product_type_id FROM dbo.product_types WHERE code = 'worcestershire_sauces');
IF NOT EXISTS (SELECT 1 FROM dbo.quality_templates WHERE product_type_id = @pt_worc AND is_active = 1 AND is_deleted = 0)
BEGIN
    SET @tid = NEWID();
    INSERT INTO dbo.quality_templates (quality_template_id, product_type_id, name, notes)
    VALUES (@tid, @pt_worc, 'Worcestershire — Default QC Template', 'pH + temperature at cook and cool. Optional Brix.');

    INSERT INTO dbo.quality_template_items (quality_template_id, quality_metric_type_id, required, target_min, target_max, sort_order, guidance_text, stage_code) VALUES
    (@tid, @m_temp, 1, 180.0, 212.0, 10, 'Record temperature at cook/simmer.',                'cook'),
    (@tid, @m_ph,   1, NULL, 4.0,    20, 'Record pH during cook.',                             'cook'),
    (@tid, @m_temp, 1, NULL, 140.0,  30, 'Record temperature at fill/bottle.',                 'fill'),
    (@tid, @m_ph,   1, NULL, 4.0,    40, 'Record final pH at bottling.',                        'fill'),
    (@tid, @m_brix, 0, NULL, NULL,   50, 'Record Brix if applicable.',                          'fill');
END

-- ── Ground Spice Powders ────────────────────────────────────────────
DECLARE @pt_spice uniqueidentifier = (SELECT product_type_id FROM dbo.product_types WHERE code = 'ground_spice_powders');
IF NOT EXISTS (SELECT 1 FROM dbo.quality_templates WHERE product_type_id = @pt_spice AND is_active = 1 AND is_deleted = 0)
BEGIN
    SET @tid = NEWID();
    INSERT INTO dbo.quality_templates (quality_template_id, product_type_id, name, notes)
    VALUES (@tid, @pt_spice, 'Spice Powders — Default QC Template', 'Temperature optional. Water activity and weight optional.');

    INSERT INTO dbo.quality_template_items (quality_template_id, quality_metric_type_id, required, target_min, target_max, sort_order, guidance_text, stage_code) VALUES
    (@tid, @m_temp, 0, NULL, NULL,   10, 'Record roast/toast temperature if applicable.',      'roast'),
    (@tid, @m_aw,   0, NULL, 0.60,  20, 'Record water activity (aw). Target < 0.60.',          'grind'),
    (@tid, @m_wt,   0, NULL, NULL,   30, 'Record weight per package fill.',                    'package');
END

-- ── Dehydrated Fruit Slices ─────────────────────────────────────────
DECLARE @pt_dehy uniqueidentifier = (SELECT product_type_id FROM dbo.product_types WHERE code = 'dehydrated_fruit_slices');
IF NOT EXISTS (SELECT 1 FROM dbo.quality_templates WHERE product_type_id = @pt_dehy AND is_active = 1 AND is_deleted = 0)
BEGIN
    SET @tid = NEWID();
    INSERT INTO dbo.quality_templates (quality_template_id, product_type_id, name, notes)
    VALUES (@tid, @pt_dehy, 'Dehydrated Fruit — Default QC Template', 'Dehydration temp/time + endpoint weight. Water activity optional.');

    INSERT INTO dbo.quality_template_items (quality_template_id, quality_metric_type_id, required, target_min, target_max, sort_order, guidance_text, stage_code) VALUES
    (@tid, @m_temp, 1, 125.0, 165.0, 10, 'Record dehydrator temperature at start.',           'dehydrate'),
    (@tid, @m_time, 1, NULL, NULL,   20, 'Record total dehydration time (minutes).',           'dehydrate'),
    (@tid, @m_wt,   1, NULL, NULL,   30, 'Record endpoint weight of batch.',                   'dehydrate'),
    (@tid, @m_aw,   0, NULL, 0.60,  40, 'Record water activity if measured. Target < 0.60.',   'final');
END

-- ── Fermented — Other ───────────────────────────────────────────────
DECLARE @pt_ferm uniqueidentifier = (SELECT product_type_id FROM dbo.product_types WHERE code = 'fermented_other');
IF NOT EXISTS (SELECT 1 FROM dbo.quality_templates WHERE product_type_id = @pt_ferm AND is_active = 1 AND is_deleted = 0)
BEGIN
    SET @tid = NEWID();
    INSERT INTO dbo.quality_templates (quality_template_id, product_type_id, name, notes)
    VALUES (@tid, @pt_ferm, 'Fermented Other — Default QC Template', 'pH + temperature required. Salinity optional.');

    INSERT INTO dbo.quality_template_items (quality_template_id, quality_metric_type_id, required, target_min, target_max, sort_order, guidance_text, stage_code) VALUES
    (@tid, @m_ph,   1, NULL, 4.6,   10, 'Record pH at ferment check.',                        'ferment'),
    (@tid, @m_temp, 1, 60.0, 75.0,  20, 'Record fermentation environment temp.',              'ferment'),
    (@tid, @m_sal,  0, NULL, NULL,   30, 'Record salinity % if applicable.',                   'pack'),
    (@tid, @m_ph,   1, NULL, 4.6,   40, 'Record final pH before packaging.',                  'final');
END
GO

PRINT 'Quality templates seeded (11 templates with items).';
GO


------------------------------------------------------------------------
-- 5. VIEWS
------------------------------------------------------------------------

-- 5.1 Run compliance status: required template items vs logged items
CREATE OR ALTER VIEW dbo.vw_run_compliance_status
AS
SELECT
    pr.production_run_id,
    pr.lot_code,
    r.name                      AS recipe_name,
    rv.version_number,
    rs.code                     AS run_status,
    pt.code                     AS product_type_code,
    qt.name                     AS template_name,
    qti.quality_template_item_id,
    qmt.code                    AS metric_code,
    qmt.name                    AS metric_name,
    qti.required,
    qti.target_min,
    qti.target_max,
    qti.stage_code,
    -- Count of logs matching this template item
    (SELECT COUNT(*)
     FROM dbo.production_run_quality_logs ql
     WHERE ql.production_run_id = pr.production_run_id
       AND ql.quality_template_item_id = qti.quality_template_item_id
       AND ql.is_deleted = 0
    ) AS log_count,
    qti.sort_order,
    -- Is satisfied? (required items need at least 1 log)
    CASE
        WHEN qti.required = 0 THEN 1
        WHEN (SELECT COUNT(*)
              FROM dbo.production_run_quality_logs ql
              WHERE ql.production_run_id = pr.production_run_id
                AND ql.quality_template_item_id = qti.quality_template_item_id
                AND ql.is_deleted = 0) > 0 THEN 1
        ELSE 0
    END AS is_satisfied
FROM dbo.production_runs pr
INNER JOIN dbo.recipe_versions rv  ON pr.recipe_version_id = rv.recipe_version_id
INNER JOIN dbo.recipes r           ON rv.recipe_id = r.recipe_id
INNER JOIN dbo.run_statuses rs     ON pr.run_status_id = rs.run_status_id
LEFT JOIN  dbo.product_types pt    ON pr.product_type_id = pt.product_type_id
LEFT JOIN  dbo.quality_templates qt
    ON qt.product_type_id = pr.product_type_id
    AND qt.is_active = 1 AND qt.is_deleted = 0
LEFT JOIN  dbo.quality_template_items qti
    ON qti.quality_template_id = qt.quality_template_id
    AND qti.is_deleted = 0
LEFT JOIN  dbo.quality_metric_types qmt
    ON qti.quality_metric_type_id = qmt.quality_metric_type_id
WHERE pr.is_deleted = 0;
GO

-- 5.2 Latest quality log values per run per metric
CREATE OR ALTER VIEW dbo.vw_run_latest_quality_logs
AS
WITH ranked AS (
    SELECT
        ql.production_run_id,
        ql.quality_metric_type_id,
        qmt.code AS metric_code,
        qmt.name AS metric_name,
        ql.value_numeric,
        ql.value_text,
        ql.value_bool,
        ql.unit_id,
        u.abbreviation AS unit_abbrev,
        ql.measured_at,
        usr.display_name AS measured_by,
        ql.notes,
        ROW_NUMBER() OVER (
            PARTITION BY ql.production_run_id, ql.quality_metric_type_id
            ORDER BY ql.measured_at DESC
        ) AS rn
    FROM dbo.production_run_quality_logs ql
    INNER JOIN dbo.quality_metric_types qmt ON ql.quality_metric_type_id = qmt.quality_metric_type_id
    INNER JOIN dbo.users usr               ON ql.measured_by_user_id = usr.user_id
    LEFT JOIN  dbo.units u                 ON ql.unit_id = u.unit_id
    WHERE ql.is_deleted = 0
)
SELECT
    production_run_id,
    quality_metric_type_id,
    metric_code,
    metric_name,
    value_numeric,
    value_text,
    value_bool,
    unit_id,
    unit_abbrev,
    measured_at,
    measured_by,
    notes
FROM ranked
WHERE rn = 1;
GO

-- 5.3 Batch Record view (run metadata + compliance + deviations)
CREATE OR ALTER VIEW dbo.vw_batch_record
AS
SELECT
    pr.production_run_id,
    pr.lot_code,
    r.name                  AS recipe_name,
    rv.version_number,
    rv.recipe_version_id,
    rs.code                 AS run_status,
    f.name                  AS facility_name,
    op.display_name         AS operator_name,
    pt.code                 AS product_type_code,
    pr.planned_start_at,
    pr.started_at,
    pr.completed_at,
    pr.target_yield_value,
    tu.abbreviation         AS target_yield_unit,
    pr.actual_yield_value,
    au.abbreviation         AS actual_yield_unit,
    pr.notes                AS run_notes,
    -- Deviation count
    (SELECT COUNT(*) FROM dbo.production_run_deviations d
     WHERE d.production_run_id = pr.production_run_id AND d.is_deleted = 0
    ) AS deviation_count,
    -- Unresolved deviation count
    (SELECT COUNT(*) FROM dbo.production_run_deviations d
     WHERE d.production_run_id = pr.production_run_id AND d.is_deleted = 0 AND d.resolved_at IS NULL
    ) AS unresolved_deviation_count,
    -- Quality log count
    (SELECT COUNT(*) FROM dbo.production_run_quality_logs ql
     WHERE ql.production_run_id = pr.production_run_id AND ql.is_deleted = 0
    ) AS quality_log_count,
    -- Distribution record count
    (SELECT COUNT(*) FROM dbo.production_run_distribution dist
     WHERE dist.production_run_id = pr.production_run_id AND dist.is_deleted = 0
    ) AS distribution_count,
    pr.created_at,
    pr.updated_at
FROM dbo.production_runs pr
INNER JOIN dbo.recipe_versions rv  ON pr.recipe_version_id = rv.recipe_version_id
INNER JOIN dbo.recipes r           ON rv.recipe_id = r.recipe_id
INNER JOIN dbo.run_statuses rs     ON pr.run_status_id = rs.run_status_id
INNER JOIN dbo.facilities f        ON pr.facility_id = f.facility_id
LEFT JOIN  dbo.users op            ON pr.operator_user_id = op.user_id
LEFT JOIN  dbo.product_types pt    ON pr.product_type_id = pt.product_type_id
LEFT JOIN  dbo.units tu            ON pr.target_yield_unit_id = tu.unit_id
LEFT JOIN  dbo.units au            ON pr.actual_yield_unit_id = au.unit_id
WHERE pr.is_deleted = 0;
GO

PRINT 'Views created (vw_run_compliance_status, vw_run_latest_quality_logs, vw_batch_record).';
GO


------------------------------------------------------------------------
-- 6. DEMO: Full production run transaction flow
------------------------------------------------------------------------

-- We need a user for logging. Create a demo operator if none exists.
IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = 'demo@beauxbistro.local')
    INSERT INTO dbo.users (email, display_name, password_hash, password_algo)
    VALUES ('demo@beauxbistro.local', 'Demo Operator', 'NOT_A_REAL_HASH_demo_only', 'argon2id');
GO

DECLARE @demo_user_id uniqueidentifier = (SELECT user_id FROM dbo.users WHERE email = 'demo@beauxbistro.local');
DECLARE @demo_gal uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'gal');
DECLARE @demo_f   uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = N'°F');
DECLARE @facility  uniqueidentifier = (SELECT facility_id FROM dbo.facilities WHERE code = 'MAIN');
DECLARE @status_planned uniqueidentifier = (SELECT run_status_id FROM dbo.run_statuses WHERE code = 'planned');
DECLARE @status_inprog  uniqueidentifier = (SELECT run_status_id FROM dbo.run_statuses WHERE code = 'in_progress');
DECLARE @status_done    uniqueidentifier = (SELECT run_status_id FROM dbo.run_statuses WHERE code = 'completed');

DECLARE @demo_rv uniqueidentifier;
SELECT @demo_rv = rv.recipe_version_id
FROM dbo.recipe_versions rv
INNER JOIN dbo.recipes r ON rv.recipe_id = r.recipe_id
WHERE r.name = N'Beaux''s Signature Hot Sauce' AND rv.is_current = 1;

DECLARE @pt_hot_id uniqueidentifier = (SELECT product_type_id FROM dbo.product_types WHERE code = 'hot_sauces');

IF @demo_rv IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.production_runs WHERE lot_code = 'HS-20260208-001')
BEGIN
    PRINT '';
    PRINT '=== DEMO: Production Run Transaction Flow ===';

    -- Step 1: Create run (planned)
    DECLARE @run_id uniqueidentifier = NEWID();
    INSERT INTO dbo.production_runs (
        production_run_id, recipe_version_id, run_status_id, facility_id,
        operator_user_id, product_type_id, planned_start_at,
        target_yield_value, target_yield_unit_id, lot_code, notes
    ) VALUES (
        @run_id, @demo_rv, @status_planned, @facility,
        @demo_user_id, @pt_hot_id, '2026-02-08 08:00:00',
        5.0000, @demo_gal, 'HS-20260208-001',
        'Demo 5-gallon hot sauce run for Phase 4 verification.'
    );
    PRINT '  1. Created run (planned) — lot HS-20260208-001, 5 gal target';

    -- Step 1b: Generate QR code
    INSERT INTO dbo.production_run_codes (production_run_id, code_value, code_type)
    VALUES (@run_id, 'BW-RUN-' + REPLACE(CAST(@run_id AS nvarchar(36)), '-', ''), 'qr');
    PRINT '  1b. QR code generated';

    -- Step 2: Snapshot scaled ingredients (5-gal batch = scale factor 5.0)
    INSERT INTO dbo.production_run_ingredients (production_run_id, ingredient_id, scaled_amount, unit_id, rounding_applied)
    SELECT
        @run_id,
        rvi.ingredient_id,
        CASE
            WHEN rvi.rounding_mode = 'increment'
                THEN CAST(ROUND(CAST(rvi.base_amount * 5.0 AS decimal(18,6)) / rvi.rounding_increment, 0) * rvi.rounding_increment AS decimal(18,6))
            WHEN rvi.rounding_mode = 'decimals'
                THEN ROUND(CAST(rvi.base_amount * 5.0 AS decimal(18,6)), rvi.rounding_decimals)
            ELSE CAST(rvi.base_amount * 5.0 AS decimal(18,6))
        END,
        rvi.unit_id,
        COALESCE(rvi.rounding_mode, 'none')
    FROM dbo.recipe_version_ingredients rvi
    WHERE rvi.recipe_version_id = @demo_rv AND rvi.is_deleted = 0;
    PRINT '  2. Ingredients snapshot created (5x scale)';

    -- Step 3: Start run
    UPDATE dbo.production_runs
    SET run_status_id = @status_inprog, started_at = '2026-02-08 08:15:00'
    WHERE production_run_id = @run_id;
    PRINT '  3. Run started (in_progress)';

    -- Step 4: Log temperature at cook stage
    DECLARE @m_temp2 uniqueidentifier = (SELECT quality_metric_type_id FROM dbo.quality_metric_types WHERE code = 'temp');
    DECLARE @m_ph2   uniqueidentifier = (SELECT quality_metric_type_id FROM dbo.quality_metric_types WHERE code = 'ph');

    -- Find template items for hot_sauces
    DECLARE @qti_cook_temp uniqueidentifier, @qti_cook_ph uniqueidentifier,
            @qti_fill_temp uniqueidentifier, @qti_fill_ph uniqueidentifier;

    SELECT @qti_cook_temp = qti.quality_template_item_id
    FROM dbo.quality_template_items qti
    INNER JOIN dbo.quality_templates qt ON qti.quality_template_id = qt.quality_template_id
    WHERE qt.product_type_id = @pt_hot_id AND qt.is_active = 1 AND qt.is_deleted = 0
      AND qti.quality_metric_type_id = @m_temp2 AND qti.stage_code = 'cook' AND qti.is_deleted = 0;

    SELECT @qti_cook_ph = qti.quality_template_item_id
    FROM dbo.quality_template_items qti
    INNER JOIN dbo.quality_templates qt ON qti.quality_template_id = qt.quality_template_id
    WHERE qt.product_type_id = @pt_hot_id AND qt.is_active = 1 AND qt.is_deleted = 0
      AND qti.quality_metric_type_id = @m_ph2 AND qti.stage_code = 'cook' AND qti.is_deleted = 0;

    SELECT @qti_fill_temp = qti.quality_template_item_id
    FROM dbo.quality_template_items qti
    INNER JOIN dbo.quality_templates qt ON qti.quality_template_id = qt.quality_template_id
    WHERE qt.product_type_id = @pt_hot_id AND qt.is_active = 1 AND qt.is_deleted = 0
      AND qti.quality_metric_type_id = @m_temp2 AND qti.stage_code = 'fill' AND qti.is_deleted = 0;

    SELECT @qti_fill_ph = qti.quality_template_item_id
    FROM dbo.quality_template_items qti
    INNER JOIN dbo.quality_templates qt ON qti.quality_template_id = qt.quality_template_id
    WHERE qt.product_type_id = @pt_hot_id AND qt.is_active = 1 AND qt.is_deleted = 0
      AND qti.quality_metric_type_id = @m_ph2 AND qti.stage_code = 'fill' AND qti.is_deleted = 0;

    -- Log cook temp: 204°F
    INSERT INTO dbo.production_run_quality_logs
        (production_run_id, quality_template_item_id, quality_metric_type_id, measured_at, measured_by_user_id, value_numeric, unit_id, notes)
    VALUES (@run_id, @qti_cook_temp, @m_temp2, '2026-02-08 08:35:00', @demo_user_id, 204.0, @demo_f, 'Full rolling boil reached.');
    PRINT '  4a. Logged cook temp: 204°F';

    -- Log cook pH: 3.2
    INSERT INTO dbo.production_run_quality_logs
        (production_run_id, quality_template_item_id, quality_metric_type_id, measured_at, measured_by_user_id, value_numeric, notes)
    VALUES (@run_id, @qti_cook_ph, @m_ph2, '2026-02-08 08:36:00', @demo_user_id, 3.2, 'pH measured with calibrated meter.');
    PRINT '  4b. Logged cook pH: 3.2';

    -- Log fill temp: 195°F
    INSERT INTO dbo.production_run_quality_logs
        (production_run_id, quality_template_item_id, quality_metric_type_id, measured_at, measured_by_user_id, value_numeric, unit_id, notes)
    VALUES (@run_id, @qti_fill_temp, @m_temp2, '2026-02-08 09:10:00', @demo_user_id, 195.0, @demo_f, 'Hot-fill temperature at bottling.');
    PRINT '  4c. Logged fill temp: 195°F';

    -- Log fill pH: 3.1
    INSERT INTO dbo.production_run_quality_logs
        (production_run_id, quality_template_item_id, quality_metric_type_id, measured_at, measured_by_user_id, value_numeric, notes)
    VALUES (@run_id, @qti_fill_ph, @m_ph2, '2026-02-08 09:11:00', @demo_user_id, 3.1, 'Final pH at bottling confirmed.');
    PRINT '  4d. Logged fill pH: 3.1';

    -- Step 5: Complete run with actual yield
    UPDATE dbo.production_runs
    SET run_status_id = @status_done,
        completed_at = '2026-02-08 09:30:00',
        actual_yield_value = 4.7500,
        actual_yield_unit_id = @demo_gal
    WHERE production_run_id = @run_id;
    PRINT '  5. Run completed — actual yield 4.75 gal';

    -- Show compliance status for this run
    PRINT '';
    PRINT '--- Compliance check for demo run ---';
    SELECT
        metric_code,
        metric_name,
        stage_code,
        required,
        log_count,
        CASE WHEN is_satisfied = 1 THEN 'YES' ELSE 'NO' END AS satisfied
    FROM dbo.vw_run_compliance_status
    WHERE production_run_id = @run_id
      AND quality_template_item_id IS NOT NULL
    ORDER BY sort_order;

    -- Show batch record summary
    PRINT '';
    PRINT '--- Batch record summary ---';
    SELECT * FROM dbo.vw_batch_record WHERE production_run_id = @run_id;

    -- Show quality logs
    PRINT '';
    PRINT '--- Quality logs for run ---';
    SELECT
        metric_code,
        value_numeric,
        unit_abbrev,
        measured_at,
        measured_by,
        notes
    FROM dbo.vw_run_latest_quality_logs
    WHERE production_run_id = @run_id
    ORDER BY measured_at;

    PRINT '';
    PRINT '=== DEMO Complete ===';
END
ELSE
BEGIN
    PRINT 'Demo run already exists or prerequisites missing — skipping.';
END
GO


------------------------------------------------------------------------
-- 7. SAMPLE: Idempotent insert (offline queue pattern)
------------------------------------------------------------------------
PRINT '';
PRINT '--- Sample idempotent insert pattern ---';
PRINT 'Application code would call:';
PRINT '  1. Check api_idempotency_keys for (user_id, key)';
PRINT '  2. If exists: return cached response_metadata_json';
PRINT '  3. If not: execute insert, then INSERT into api_idempotency_keys';
PRINT '  4. Return new result';
GO


------------------------------------------------------------------------
-- 8. VERIFICATION
------------------------------------------------------------------------

SELECT
    s.name AS [schema],
    t.name AS [table],
    t.create_date
FROM sys.tables t
INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = 'dbo'
  AND t.name IN (
    'product_types', 'quality_metric_types', 'production_runs',
    'production_run_codes', 'production_run_ingredients',
    'quality_templates', 'quality_template_items',
    'production_run_quality_logs', 'production_run_deviations',
    'production_run_distribution', 'api_idempotency_keys'
  )
ORDER BY t.name;
GO

SELECT 'product_types' AS seed, COUNT(*) AS cnt FROM dbo.product_types WHERE is_deleted = 0;
SELECT 'quality_metric_types' AS seed, COUNT(*) AS cnt FROM dbo.quality_metric_types WHERE is_deleted = 0;
SELECT 'quality_templates' AS seed, COUNT(*) AS cnt FROM dbo.quality_templates WHERE is_deleted = 0;
SELECT 'quality_template_items' AS seed, COUNT(*) AS cnt FROM dbo.quality_template_items WHERE is_deleted = 0;
GO

PRINT '=== Phase 4 — Production Runs + Quality Logging: Script complete ===';
GO
