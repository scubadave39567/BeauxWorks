/*
  BeauxWorks — Phase 2: Foundations (Units, Lookups, Facilities)
  ==============================================================
  Run AFTER 01-phase-1-identity.sql

  Creates (in dependency order):
    1. dbo.facilities
    2. dbo.units
    3. dbo.unit_conversions
    4. dbo.run_statuses
    5. dbo.sales_channels
    6. dbo.recipe_categories
    7. dbo.product_categories
  Then: constraints, indexes, triggers, comprehensive seed data.

  Idempotent: uses IF NOT EXISTS checks.
*/

USE [BeauxWorks];
GO

------------------------------------------------------------------------
-- 1. TABLES
------------------------------------------------------------------------

-- 1.1 dbo.facilities
IF OBJECT_ID(N'dbo.facilities', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.facilities (
        facility_id   uniqueidentifier  NOT NULL
                      CONSTRAINT DF_facilities_pk DEFAULT NEWSEQUENTIALID(),
        name          nvarchar(200)     NOT NULL,
        code          nvarchar(50)      NULL,
        address       nvarchar(300)     NULL,
        timezone      nvarchar(100)     NULL,
        is_active     bit               NOT NULL
                      CONSTRAINT DF_facilities_active DEFAULT 1,
        created_at    datetime2(7)      NOT NULL
                      CONSTRAINT DF_facilities_created DEFAULT SYSUTCDATETIME(),
        updated_at    datetime2(7)      NOT NULL
                      CONSTRAINT DF_facilities_updated DEFAULT SYSUTCDATETIME(),
        is_deleted    bit               NOT NULL
                      CONSTRAINT DF_facilities_del DEFAULT 0,

        CONSTRAINT PK_facilities      PRIMARY KEY CLUSTERED (facility_id),
        CONSTRAINT UQ_facilities_code UNIQUE (code)
    );
    PRINT 'Created table dbo.facilities';
END
GO

-- 1.2 dbo.units
IF OBJECT_ID(N'dbo.units', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.units (
        unit_id       uniqueidentifier  NOT NULL
                      CONSTRAINT DF_units_pk DEFAULT NEWSEQUENTIALID(),
        name          nvarchar(100)     NOT NULL,
        abbreviation  nvarchar(20)      NOT NULL,
        unit_type     nvarchar(20)      NOT NULL,
        is_base_unit  bit               NOT NULL
                      CONSTRAINT DF_units_base DEFAULT 0,
        created_at    datetime2(7)      NOT NULL
                      CONSTRAINT DF_units_created DEFAULT SYSUTCDATETIME(),
        updated_at    datetime2(7)      NOT NULL
                      CONSTRAINT DF_units_updated DEFAULT SYSUTCDATETIME(),
        is_deleted    bit               NOT NULL
                      CONSTRAINT DF_units_del DEFAULT 0,

        CONSTRAINT PK_units              PRIMARY KEY CLUSTERED (unit_id),
        CONSTRAINT UQ_units_name         UNIQUE (name),
        CONSTRAINT UQ_units_abbreviation UNIQUE (abbreviation),
        CONSTRAINT CK_units_type         CHECK (unit_type IN ('mass', 'volume', 'each', 'temperature', 'other'))
    );
    PRINT 'Created table dbo.units';
END
GO

-- 1.3 dbo.unit_conversions
IF OBJECT_ID(N'dbo.unit_conversions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.unit_conversions (
        unit_conversion_id  uniqueidentifier  NOT NULL
                            CONSTRAINT DF_uc_pk DEFAULT NEWSEQUENTIALID(),
        from_unit_id        uniqueidentifier  NOT NULL,
        to_unit_id          uniqueidentifier  NOT NULL,
        multiplier          decimal(18,8)     NOT NULL,
        created_at          datetime2(7)      NOT NULL
                            CONSTRAINT DF_uc_created DEFAULT SYSUTCDATETIME(),
        updated_at          datetime2(7)      NOT NULL
                            CONSTRAINT DF_uc_updated DEFAULT SYSUTCDATETIME(),
        is_deleted          bit               NOT NULL
                            CONSTRAINT DF_uc_del DEFAULT 0,

        CONSTRAINT PK_unit_conversions      PRIMARY KEY CLUSTERED (unit_conversion_id),
        CONSTRAINT FK_uc_from_unit          FOREIGN KEY (from_unit_id) REFERENCES dbo.units (unit_id),
        CONSTRAINT FK_uc_to_unit            FOREIGN KEY (to_unit_id)   REFERENCES dbo.units (unit_id),
        CONSTRAINT UQ_uc_from_to            UNIQUE (from_unit_id, to_unit_id),
        CONSTRAINT CK_uc_multiplier_pos     CHECK (multiplier > 0),
        CONSTRAINT CK_uc_not_self           CHECK (from_unit_id <> to_unit_id)
    );
    PRINT 'Created table dbo.unit_conversions';
END
GO

-- 1.4 dbo.run_statuses (lookup)
IF OBJECT_ID(N'dbo.run_statuses', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.run_statuses (
        run_status_id  uniqueidentifier  NOT NULL
                       CONSTRAINT DF_rs_pk DEFAULT NEWSEQUENTIALID(),
        code           nvarchar(50)      NOT NULL,
        name           nvarchar(100)     NOT NULL,
        sort_order     int               NOT NULL
                       CONSTRAINT DF_rs_sort DEFAULT 0,
        created_at     datetime2(7)      NOT NULL
                       CONSTRAINT DF_rs_created DEFAULT SYSUTCDATETIME(),
        updated_at     datetime2(7)      NOT NULL
                       CONSTRAINT DF_rs_updated DEFAULT SYSUTCDATETIME(),
        is_deleted     bit               NOT NULL
                       CONSTRAINT DF_rs_del DEFAULT 0,

        CONSTRAINT PK_run_statuses      PRIMARY KEY CLUSTERED (run_status_id),
        CONSTRAINT UQ_run_statuses_code UNIQUE (code)
    );
    PRINT 'Created table dbo.run_statuses';
END
GO

-- 1.5 dbo.sales_channels
IF OBJECT_ID(N'dbo.sales_channels', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.sales_channels (
        sales_channel_id  uniqueidentifier  NOT NULL
                          CONSTRAINT DF_sc_pk DEFAULT NEWSEQUENTIALID(),
        code              nvarchar(50)      NOT NULL,
        name              nvarchar(100)     NOT NULL,
        description       nvarchar(500)     NULL,
        is_active         bit               NOT NULL
                          CONSTRAINT DF_sc_active DEFAULT 1,
        created_at        datetime2(7)      NOT NULL
                          CONSTRAINT DF_sc_created DEFAULT SYSUTCDATETIME(),
        updated_at        datetime2(7)      NOT NULL
                          CONSTRAINT DF_sc_updated DEFAULT SYSUTCDATETIME(),
        is_deleted        bit               NOT NULL
                          CONSTRAINT DF_sc_del DEFAULT 0,

        CONSTRAINT PK_sales_channels      PRIMARY KEY CLUSTERED (sales_channel_id),
        CONSTRAINT UQ_sales_channels_code UNIQUE (code)
    );
    PRINT 'Created table dbo.sales_channels';
END
GO

-- 1.6 dbo.recipe_categories
IF OBJECT_ID(N'dbo.recipe_categories', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.recipe_categories (
        recipe_category_id  uniqueidentifier  NOT NULL
                            CONSTRAINT DF_rc_pk DEFAULT NEWSEQUENTIALID(),
        name                nvarchar(200)     NOT NULL,
        description         nvarchar(500)     NULL,
        sort_order          int               NOT NULL
                            CONSTRAINT DF_rc_sort DEFAULT 0,
        created_at          datetime2(7)      NOT NULL
                            CONSTRAINT DF_rc_created DEFAULT SYSUTCDATETIME(),
        updated_at          datetime2(7)      NOT NULL
                            CONSTRAINT DF_rc_updated DEFAULT SYSUTCDATETIME(),
        is_deleted          bit               NOT NULL
                            CONSTRAINT DF_rc_del DEFAULT 0,

        CONSTRAINT PK_recipe_categories      PRIMARY KEY CLUSTERED (recipe_category_id),
        CONSTRAINT UQ_recipe_categories_name UNIQUE (name)
    );
    PRINT 'Created table dbo.recipe_categories';
END
GO

-- 1.7 dbo.product_categories
IF OBJECT_ID(N'dbo.product_categories', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.product_categories (
        product_category_id  uniqueidentifier  NOT NULL
                             CONSTRAINT DF_pc_pk DEFAULT NEWSEQUENTIALID(),
        name                 nvarchar(200)     NOT NULL,
        description          nvarchar(500)     NULL,
        sort_order           int               NOT NULL
                             CONSTRAINT DF_pc_sort DEFAULT 0,
        created_at           datetime2(7)      NOT NULL
                             CONSTRAINT DF_pc_created DEFAULT SYSUTCDATETIME(),
        updated_at           datetime2(7)      NOT NULL
                             CONSTRAINT DF_pc_updated DEFAULT SYSUTCDATETIME(),
        is_deleted           bit               NOT NULL
                             CONSTRAINT DF_pc_del DEFAULT 0,

        CONSTRAINT PK_product_categories      PRIMARY KEY CLUSTERED (product_category_id),
        CONSTRAINT UQ_product_categories_name UNIQUE (name)
    );
    PRINT 'Created table dbo.product_categories';
END
GO


------------------------------------------------------------------------
-- 2. INDEXES
------------------------------------------------------------------------

-- units
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_units_type' AND object_id = OBJECT_ID(N'dbo.units'))
    CREATE NONCLUSTERED INDEX IX_units_type
        ON dbo.units (unit_type)
        INCLUDE (name, abbreviation)
        WHERE is_deleted = 0;
GO

-- unit_conversions
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_uc_from_unit' AND object_id = OBJECT_ID(N'dbo.unit_conversions'))
    CREATE NONCLUSTERED INDEX IX_uc_from_unit
        ON dbo.unit_conversions (from_unit_id)
        INCLUDE (to_unit_id, multiplier)
        WHERE is_deleted = 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_uc_to_unit' AND object_id = OBJECT_ID(N'dbo.unit_conversions'))
    CREATE NONCLUSTERED INDEX IX_uc_to_unit
        ON dbo.unit_conversions (to_unit_id)
        INCLUDE (from_unit_id, multiplier)
        WHERE is_deleted = 0;
GO

-- facilities
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_facilities_active' AND object_id = OBJECT_ID(N'dbo.facilities'))
    CREATE NONCLUSTERED INDEX IX_facilities_active
        ON dbo.facilities (is_active)
        WHERE is_deleted = 0;
GO


------------------------------------------------------------------------
-- 3. TRIGGERS (updated_at)
------------------------------------------------------------------------

CREATE OR ALTER TRIGGER dbo.TR_facilities_updated_at
ON dbo.facilities AFTER UPDATE
AS BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.facilities t INNER JOIN inserted i ON t.facility_id = i.facility_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_units_updated_at
ON dbo.units AFTER UPDATE
AS BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.units t INNER JOIN inserted i ON t.unit_id = i.unit_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_unit_conversions_updated_at
ON dbo.unit_conversions AFTER UPDATE
AS BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.unit_conversions t INNER JOIN inserted i ON t.unit_conversion_id = i.unit_conversion_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_run_statuses_updated_at
ON dbo.run_statuses AFTER UPDATE
AS BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.run_statuses t INNER JOIN inserted i ON t.run_status_id = i.run_status_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_sales_channels_updated_at
ON dbo.sales_channels AFTER UPDATE
AS BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.sales_channels t INNER JOIN inserted i ON t.sales_channel_id = i.sales_channel_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_recipe_categories_updated_at
ON dbo.recipe_categories AFTER UPDATE
AS BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.recipe_categories t INNER JOIN inserted i ON t.recipe_category_id = i.recipe_category_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_product_categories_updated_at
ON dbo.product_categories AFTER UPDATE
AS BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.product_categories t INNER JOIN inserted i ON t.product_category_id = i.product_category_id;
END;
GO

------------------------------------------------------------------------
-- 4. VALIDATION TRIGGER: unit_conversions same-type enforcement
------------------------------------------------------------------------

CREATE OR ALTER TRIGGER dbo.TR_unit_conversions_validate_type
ON dbo.unit_conversions
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.units uf ON i.from_unit_id = uf.unit_id
        INNER JOIN dbo.units ut ON i.to_unit_id   = ut.unit_id
        WHERE uf.unit_type <> ut.unit_type
    )
    BEGIN
        RAISERROR('Unit conversion error: from_unit and to_unit must have the same unit_type.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
GO


------------------------------------------------------------------------
-- 5. SEED DATA
------------------------------------------------------------------------

-- =====================================================================
-- 5.1  Default facility
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.facilities WHERE code = 'MAIN')
    INSERT INTO dbo.facilities (name, code, address, timezone)
    VALUES (
        N'Beaux''s Bistro — Main Kitchen',
        'MAIN',
        NULL,           -- fill in when known
        'America/New_York'
    );
GO

-- =====================================================================
-- 5.2  Units
-- =====================================================================

-- Mass units
IF NOT EXISTS (SELECT 1 FROM dbo.units WHERE abbreviation = 'g')
    INSERT INTO dbo.units (name, abbreviation, unit_type, is_base_unit) VALUES ('gram',     'g',   'mass', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.units WHERE abbreviation = 'kg')
    INSERT INTO dbo.units (name, abbreviation, unit_type, is_base_unit) VALUES ('kilogram', 'kg',  'mass', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.units WHERE abbreviation = 'oz')
    INSERT INTO dbo.units (name, abbreviation, unit_type, is_base_unit) VALUES ('ounce',    'oz',  'mass', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.units WHERE abbreviation = 'lb')
    INSERT INTO dbo.units (name, abbreviation, unit_type, is_base_unit) VALUES ('pound',    'lb',  'mass', 0);

-- Volume units
IF NOT EXISTS (SELECT 1 FROM dbo.units WHERE abbreviation = 'ml')
    INSERT INTO dbo.units (name, abbreviation, unit_type, is_base_unit) VALUES ('milliliter', 'ml',  'volume', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.units WHERE abbreviation = 'L')
    INSERT INTO dbo.units (name, abbreviation, unit_type, is_base_unit) VALUES ('liter',      'L',   'volume', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.units WHERE abbreviation = 'tsp')
    INSERT INTO dbo.units (name, abbreviation, unit_type, is_base_unit) VALUES ('teaspoon',   'tsp', 'volume', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.units WHERE abbreviation = 'Tbsp')
    INSERT INTO dbo.units (name, abbreviation, unit_type, is_base_unit) VALUES ('tablespoon', 'Tbsp','volume', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.units WHERE abbreviation = 'cup')
    INSERT INTO dbo.units (name, abbreviation, unit_type, is_base_unit) VALUES ('cup',        'cup', 'volume', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.units WHERE abbreviation = 'pt')
    INSERT INTO dbo.units (name, abbreviation, unit_type, is_base_unit) VALUES ('pint',       'pt',  'volume', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.units WHERE abbreviation = 'qt')
    INSERT INTO dbo.units (name, abbreviation, unit_type, is_base_unit) VALUES ('quart',      'qt',  'volume', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.units WHERE abbreviation = 'gal')
    INSERT INTO dbo.units (name, abbreviation, unit_type, is_base_unit) VALUES ('gallon',     'gal', 'volume', 0);

-- Count / discrete
IF NOT EXISTS (SELECT 1 FROM dbo.units WHERE abbreviation = 'ea')
    INSERT INTO dbo.units (name, abbreviation, unit_type, is_base_unit) VALUES ('each',       'ea',  'each', 1);
GO

PRINT 'Units seeded.';
GO


-- =====================================================================
-- 5.3  Unit Conversions (all pairwise, same-type only)
--      Exact US customary and metric definitions.
--      multiplier: amount_to = amount_from * multiplier
-- =====================================================================

-- Grab unit IDs into variables for readable inserts
DECLARE @g    uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'g');
DECLARE @kg   uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'kg');
DECLARE @oz   uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'oz');
DECLARE @lb   uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'lb');
DECLARE @ml   uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'ml');
DECLARE @L    uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'L');
DECLARE @tsp  uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'tsp');
DECLARE @Tbsp uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'Tbsp');
DECLARE @cup  uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'cup');
DECLARE @pt   uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'pt');
DECLARE @qt   uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'qt');
DECLARE @gal  uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'gal');

-- Helper: only insert if not already present
-- We use NOT EXISTS per row to keep the script idempotent.

-- -----------------------------------------------------------------
-- MASS conversions (4 units × 3 peers = 12 rows)
-- Exact definitions:
--   1 kg  = 1000 g
--   1 oz  = 28.34952313 g  (avoirdupois, exact: 28.349523125)
--   1 lb  = 453.59237 g    (exact)
--   1 lb  = 16 oz          (exact)
-- -----------------------------------------------------------------

IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @g AND to_unit_id = @kg)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@g,  @kg, 0.00100000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @g AND to_unit_id = @oz)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@g,  @oz, 0.03527396);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @g AND to_unit_id = @lb)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@g,  @lb, 0.00220462);

IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @kg AND to_unit_id = @g)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@kg, @g,  1000.00000000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @kg AND to_unit_id = @oz)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@kg, @oz, 35.27396195);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @kg AND to_unit_id = @lb)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@kg, @lb, 2.20462262);

IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @oz AND to_unit_id = @g)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@oz, @g,  28.34952313);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @oz AND to_unit_id = @kg)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@oz, @kg, 0.02834952);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @oz AND to_unit_id = @lb)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@oz, @lb, 0.06250000);

IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @lb AND to_unit_id = @g)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@lb, @g,  453.59237000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @lb AND to_unit_id = @kg)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@lb, @kg, 0.45359237);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @lb AND to_unit_id = @oz)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@lb, @oz, 16.00000000);


-- -----------------------------------------------------------------
-- VOLUME conversions (8 units × 7 peers = 56 rows)
-- Exact US customary definitions (all derive from 1 gal = 3785.411784 ml):
--   1 gal  = 3785.411784 ml    (exact, US liquid gallon)
--   1 qt   = 946.352946  ml    (gal / 4)
--   1 pt   = 473.176473  ml    (gal / 8)
--   1 cup  = 236.5882365 ml    (gal / 16)
--   1 Tbsp = 14.78676478 ml    (gal / 256)
--   1 tsp  = 4.92892159  ml    (gal / 768)
--   1 L    = 1000        ml    (exact, metric)
-- -----------------------------------------------------------------

-- From ml
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @ml AND to_unit_id = @L)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@ml, @L,    0.00100000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @ml AND to_unit_id = @tsp)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@ml, @tsp,  0.20288414);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @ml AND to_unit_id = @Tbsp)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@ml, @Tbsp, 0.06762805);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @ml AND to_unit_id = @cup)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@ml, @cup,  0.00422675);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @ml AND to_unit_id = @pt)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@ml, @pt,   0.00211338);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @ml AND to_unit_id = @qt)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@ml, @qt,   0.00105669);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @ml AND to_unit_id = @gal)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@ml, @gal,  0.00026417);

-- From L
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @L AND to_unit_id = @ml)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@L, @ml,   1000.00000000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @L AND to_unit_id = @tsp)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@L, @tsp,  202.88413535);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @L AND to_unit_id = @Tbsp)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@L, @Tbsp, 67.62804512);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @L AND to_unit_id = @cup)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@L, @cup,  4.22675284);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @L AND to_unit_id = @pt)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@L, @pt,   2.11337642);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @L AND to_unit_id = @qt)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@L, @qt,   1.05668821);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @L AND to_unit_id = @gal)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@L, @gal,  0.26417205);

-- From tsp
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @tsp AND to_unit_id = @ml)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@tsp, @ml,   4.92892159);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @tsp AND to_unit_id = @L)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@tsp, @L,    0.00492892);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @tsp AND to_unit_id = @Tbsp)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@tsp, @Tbsp, 0.33333333);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @tsp AND to_unit_id = @cup)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@tsp, @cup,  0.02083333);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @tsp AND to_unit_id = @pt)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@tsp, @pt,   0.01041667);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @tsp AND to_unit_id = @qt)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@tsp, @qt,   0.00520833);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @tsp AND to_unit_id = @gal)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@tsp, @gal,  0.00130208);

-- From Tbsp
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @Tbsp AND to_unit_id = @ml)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@Tbsp, @ml,   14.78676478);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @Tbsp AND to_unit_id = @L)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@Tbsp, @L,    0.01478676);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @Tbsp AND to_unit_id = @tsp)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@Tbsp, @tsp,  3.00000000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @Tbsp AND to_unit_id = @cup)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@Tbsp, @cup,  0.06250000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @Tbsp AND to_unit_id = @pt)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@Tbsp, @pt,   0.03125000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @Tbsp AND to_unit_id = @qt)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@Tbsp, @qt,   0.01562500);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @Tbsp AND to_unit_id = @gal)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@Tbsp, @gal,  0.00390625);

-- From cup
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @cup AND to_unit_id = @ml)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@cup, @ml,   236.58823650);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @cup AND to_unit_id = @L)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@cup, @L,    0.23658824);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @cup AND to_unit_id = @tsp)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@cup, @tsp,  48.00000000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @cup AND to_unit_id = @Tbsp)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@cup, @Tbsp, 16.00000000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @cup AND to_unit_id = @pt)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@cup, @pt,   0.50000000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @cup AND to_unit_id = @qt)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@cup, @qt,   0.25000000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @cup AND to_unit_id = @gal)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@cup, @gal,  0.06250000);

-- From pint
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @pt AND to_unit_id = @ml)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@pt, @ml,   473.17647300);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @pt AND to_unit_id = @L)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@pt, @L,    0.47317647);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @pt AND to_unit_id = @tsp)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@pt, @tsp,  96.00000000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @pt AND to_unit_id = @Tbsp)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@pt, @Tbsp, 32.00000000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @pt AND to_unit_id = @cup)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@pt, @cup,  2.00000000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @pt AND to_unit_id = @qt)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@pt, @qt,   0.50000000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @pt AND to_unit_id = @gal)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@pt, @gal,  0.12500000);

-- From quart
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @qt AND to_unit_id = @ml)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@qt, @ml,   946.35294600);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @qt AND to_unit_id = @L)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@qt, @L,    0.94635295);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @qt AND to_unit_id = @tsp)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@qt, @tsp,  192.00000000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @qt AND to_unit_id = @Tbsp)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@qt, @Tbsp, 64.00000000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @qt AND to_unit_id = @cup)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@qt, @cup,  4.00000000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @qt AND to_unit_id = @pt)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@qt, @pt,   2.00000000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @qt AND to_unit_id = @gal)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@qt, @gal,  0.25000000);

-- From gallon
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @gal AND to_unit_id = @ml)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@gal, @ml,   3785.41178400);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @gal AND to_unit_id = @L)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@gal, @L,    3.78541178);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @gal AND to_unit_id = @tsp)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@gal, @tsp,  768.00000000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @gal AND to_unit_id = @Tbsp)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@gal, @Tbsp, 256.00000000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @gal AND to_unit_id = @cup)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@gal, @cup,  16.00000000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @gal AND to_unit_id = @pt)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@gal, @pt,   8.00000000);
IF NOT EXISTS (SELECT 1 FROM dbo.unit_conversions WHERE from_unit_id = @gal AND to_unit_id = @qt)
    INSERT INTO dbo.unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES (@gal, @qt,   4.00000000);
GO

PRINT 'Unit conversions seeded (68 rows: 12 mass + 56 volume).';
GO


-- =====================================================================
-- 5.4  Run statuses
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.run_statuses WHERE code = 'planned')
    INSERT INTO dbo.run_statuses (code, name, sort_order) VALUES ('planned',     'Planned',     1);
IF NOT EXISTS (SELECT 1 FROM dbo.run_statuses WHERE code = 'in_progress')
    INSERT INTO dbo.run_statuses (code, name, sort_order) VALUES ('in_progress', 'In Progress', 2);
IF NOT EXISTS (SELECT 1 FROM dbo.run_statuses WHERE code = 'completed')
    INSERT INTO dbo.run_statuses (code, name, sort_order) VALUES ('completed',   'Completed',   3);
IF NOT EXISTS (SELECT 1 FROM dbo.run_statuses WHERE code = 'canceled')
    INSERT INTO dbo.run_statuses (code, name, sort_order) VALUES ('canceled',    'Canceled',    4);
GO

PRINT 'Run statuses seeded.';
GO


-- =====================================================================
-- 5.5  Sales channels
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.sales_channels WHERE code = 'farmers_market')
    INSERT INTO dbo.sales_channels (code, name, description) VALUES ('farmers_market', 'Farmers Market',  'Local farmers market booth sales');
IF NOT EXISTS (SELECT 1 FROM dbo.sales_channels WHERE code = 'festival')
    INSERT INTO dbo.sales_channels (code, name, description) VALUES ('festival',       'Festival',        'Food festivals and event sales');
IF NOT EXISTS (SELECT 1 FROM dbo.sales_channels WHERE code = 'direct')
    INSERT INTO dbo.sales_channels (code, name, description) VALUES ('direct',         'Direct',          'Direct to consumer (online, in-person)');
IF NOT EXISTS (SELECT 1 FROM dbo.sales_channels WHERE code = 'wholesale')
    INSERT INTO dbo.sales_channels (code, name, description) VALUES ('wholesale',      'Wholesale',       'Wholesale / consignment to retailers');
GO

PRINT 'Sales channels seeded.';
GO


-- =====================================================================
-- 5.6  Recipe categories
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.recipe_categories WHERE name = 'BBQ Sauces')
    INSERT INTO dbo.recipe_categories (name, description, sort_order) VALUES ('BBQ Sauces',          'Barbecue sauces and glazes',                  1);
IF NOT EXISTS (SELECT 1 FROM dbo.recipe_categories WHERE name = 'Hot Sauces')
    INSERT INTO dbo.recipe_categories (name, description, sort_order) VALUES ('Hot Sauces',          'Hot sauces and pepper-based condiments',      2);
IF NOT EXISTS (SELECT 1 FROM dbo.recipe_categories WHERE name = 'Pickles & Ferments')
    INSERT INTO dbo.recipe_categories (name, description, sort_order) VALUES ('Pickles & Ferments',  'Pickled vegetables, sauerkraut, kimchi',      3);
IF NOT EXISTS (SELECT 1 FROM dbo.recipe_categories WHERE name = 'Breads & Bakery')
    INSERT INTO dbo.recipe_categories (name, description, sort_order) VALUES ('Breads & Bakery',     'Breads, rolls, and baked goods',              4);
IF NOT EXISTS (SELECT 1 FROM dbo.recipe_categories WHERE name = 'Beverages')
    INSERT INTO dbo.recipe_categories (name, description, sort_order) VALUES ('Beverages',           'Non-alcoholic beverages',                     5);
IF NOT EXISTS (SELECT 1 FROM dbo.recipe_categories WHERE name = 'Spice Blends')
    INSERT INTO dbo.recipe_categories (name, description, sort_order) VALUES ('Spice Blends',        'Ground spice blends, rubs, and seasonings',   6);
IF NOT EXISTS (SELECT 1 FROM dbo.recipe_categories WHERE name = 'Dehydrated Products')
    INSERT INTO dbo.recipe_categories (name, description, sort_order) VALUES ('Dehydrated Products', 'Dehydrated fruits, vegetables, and snacks',   7);
IF NOT EXISTS (SELECT 1 FROM dbo.recipe_categories WHERE name = 'Worcestershire & Condiments')
    INSERT INTO dbo.recipe_categories (name, description, sort_order) VALUES ('Worcestershire & Condiments', 'Worcestershire, mustards, and other condiments', 8);
GO

PRINT 'Recipe categories seeded.';
GO


-- =====================================================================
-- 5.7  Product categories
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.product_categories WHERE name = 'Sauces & Condiments')
    INSERT INTO dbo.product_categories (name, description, sort_order) VALUES ('Sauces & Condiments',  'Hot sauces, BBQ sauces, worcestershire, etc.', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.product_categories WHERE name = 'Pickled & Fermented')
    INSERT INTO dbo.product_categories (name, description, sort_order) VALUES ('Pickled & Fermented',  'Pickles, sauerkraut, kimchi, etc.',            2);
IF NOT EXISTS (SELECT 1 FROM dbo.product_categories WHERE name = 'Breads & Bakery')
    INSERT INTO dbo.product_categories (name, description, sort_order) VALUES ('Breads & Bakery',      'Breads, rolls, and baked goods',               3);
IF NOT EXISTS (SELECT 1 FROM dbo.product_categories WHERE name = 'Beverages')
    INSERT INTO dbo.product_categories (name, description, sort_order) VALUES ('Beverages',            'Non-alcoholic beverages',                      4);
IF NOT EXISTS (SELECT 1 FROM dbo.product_categories WHERE name = 'Spices & Seasonings')
    INSERT INTO dbo.product_categories (name, description, sort_order) VALUES ('Spices & Seasonings',  'Spice blends, rubs, and ground powders',       5);
IF NOT EXISTS (SELECT 1 FROM dbo.product_categories WHERE name = 'Dehydrated Snacks')
    INSERT INTO dbo.product_categories (name, description, sort_order) VALUES ('Dehydrated Snacks',    'Dehydrated fruit slices and vegetables',       6);
GO

PRINT 'Product categories seeded.';
GO


------------------------------------------------------------------------
-- 6. VERIFICATION QUERIES
------------------------------------------------------------------------

-- Show all Phase 2 tables
SELECT
    s.name AS [schema],
    t.name AS [table],
    t.create_date
FROM sys.tables t
INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = 'dbo'
  AND t.name IN (
    'facilities', 'units', 'unit_conversions', 'run_statuses',
    'sales_channels', 'recipe_categories', 'product_categories'
  )
ORDER BY t.name;
GO

-- Show unit counts by type
SELECT unit_type, COUNT(*) AS unit_count
FROM dbo.units
WHERE is_deleted = 0
GROUP BY unit_type;
GO

-- Show conversion count
SELECT COUNT(*) AS conversion_count FROM dbo.unit_conversions WHERE is_deleted = 0;
GO

-- Spot check: 1 gallon = ? cups (should be 16)
SELECT
    uf.name AS from_unit,
    ut.name AS to_unit,
    uc.multiplier
FROM dbo.unit_conversions uc
INNER JOIN dbo.units uf ON uc.from_unit_id = uf.unit_id
INNER JOIN dbo.units ut ON uc.to_unit_id   = ut.unit_id
WHERE uf.abbreviation = 'gal' AND ut.abbreviation = 'cup';
GO

-- Spot check: 1 lb = ? oz (should be 16)
SELECT
    uf.name AS from_unit,
    ut.name AS to_unit,
    uc.multiplier
FROM dbo.unit_conversions uc
INNER JOIN dbo.units uf ON uc.from_unit_id = uf.unit_id
INNER JOIN dbo.units ut ON uc.to_unit_id   = ut.unit_id
WHERE uf.abbreviation = 'lb' AND ut.abbreviation = 'oz';
GO

-- Show seeded lookups
SELECT 'run_statuses' AS lookup, code, name FROM dbo.run_statuses ORDER BY sort_order;
SELECT 'sales_channels' AS lookup, code, name FROM dbo.sales_channels ORDER BY code;
SELECT 'recipe_categories' AS lookup, name FROM dbo.recipe_categories ORDER BY sort_order;
SELECT 'product_categories' AS lookup, name FROM dbo.product_categories ORDER BY sort_order;
SELECT 'facilities' AS lookup, code, name, timezone FROM dbo.facilities;
GO

PRINT '=== Phase 2 — Foundations: Script complete ===';
GO
