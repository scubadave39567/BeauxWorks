/*
  BeauxWorks — Phase 3: Recipes + Scaling Engine
  ================================================
  Run AFTER 02-phase-2-foundations.sql

  Creates (in dependency order):
    1. dbo.recipes
    2. dbo.recipe_versions  (with filtered unique index for is_current)
    3. dbo.ingredients
    4. dbo.recipe_version_ingredients  (with rounding check constraints)
    5. dbo.recipe_version_steps
  Then: indexes, triggers, stored procedure, sample data, demo calls.

  Idempotent: uses IF NOT EXISTS / IF OBJECT_ID checks.
*/

SET QUOTED_IDENTIFIER ON;
GO

USE [BeauxWorks];
GO

------------------------------------------------------------------------
-- 1. TABLES
------------------------------------------------------------------------

-- 1.1 dbo.recipes
IF OBJECT_ID(N'dbo.recipes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.recipes (
        recipe_id                 uniqueidentifier  NOT NULL
                                  CONSTRAINT DF_recipes_pk DEFAULT NEWSEQUENTIALID(),
        name                      nvarchar(200)     NOT NULL,
        description               nvarchar(max)     NULL,
        default_base_yield_value  decimal(18,4)     NOT NULL,
        default_base_yield_unit_id uniqueidentifier NOT NULL,
        is_active                 bit               NOT NULL
                                  CONSTRAINT DF_recipes_active DEFAULT 1,
        created_at                datetime2(7)      NOT NULL
                                  CONSTRAINT DF_recipes_created DEFAULT SYSUTCDATETIME(),
        updated_at                datetime2(7)      NOT NULL
                                  CONSTRAINT DF_recipes_updated DEFAULT SYSUTCDATETIME(),
        is_deleted                bit               NOT NULL
                                  CONSTRAINT DF_recipes_del DEFAULT 0,

        CONSTRAINT PK_recipes               PRIMARY KEY CLUSTERED (recipe_id),
        CONSTRAINT FK_recipes_yield_unit    FOREIGN KEY (default_base_yield_unit_id)
                                            REFERENCES dbo.units (unit_id)
    );
    PRINT 'Created table dbo.recipes';
END
GO

-- 1.2 dbo.recipe_versions
IF OBJECT_ID(N'dbo.recipe_versions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.recipe_versions (
        recipe_version_id   uniqueidentifier  NOT NULL
                            CONSTRAINT DF_rv_pk DEFAULT NEWSEQUENTIALID(),
        recipe_id           uniqueidentifier  NOT NULL,
        version_number      int               NOT NULL,
        title               nvarchar(200)     NULL,
        notes               nvarchar(max)     NULL,
        base_yield_value    decimal(18,4)     NOT NULL,
        base_yield_unit_id  uniqueidentifier  NOT NULL,
        is_current          bit               NOT NULL
                            CONSTRAINT DF_rv_current DEFAULT 0,
        created_at          datetime2(7)      NOT NULL
                            CONSTRAINT DF_rv_created DEFAULT SYSUTCDATETIME(),
        updated_at          datetime2(7)      NOT NULL
                            CONSTRAINT DF_rv_updated DEFAULT SYSUTCDATETIME(),
        is_deleted          bit               NOT NULL
                            CONSTRAINT DF_rv_del DEFAULT 0,

        CONSTRAINT PK_recipe_versions              PRIMARY KEY CLUSTERED (recipe_version_id),
        CONSTRAINT FK_rv_recipe                    FOREIGN KEY (recipe_id)
                                                   REFERENCES dbo.recipes (recipe_id),
        CONSTRAINT FK_rv_yield_unit                FOREIGN KEY (base_yield_unit_id)
                                                   REFERENCES dbo.units (unit_id),
        CONSTRAINT UQ_recipe_versions_recipe_ver   UNIQUE (recipe_id, version_number)
    );
    PRINT 'Created table dbo.recipe_versions';
END
GO

-- Filtered unique index: only one current version per recipe (among non-deleted)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_recipe_versions_current' AND object_id = OBJECT_ID(N'dbo.recipe_versions'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_recipe_versions_current
        ON dbo.recipe_versions (recipe_id)
        WHERE is_current = 1 AND is_deleted = 0;
GO

-- 1.3 dbo.ingredients
IF OBJECT_ID(N'dbo.ingredients', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ingredients (
        ingredient_id    uniqueidentifier  NOT NULL
                         CONSTRAINT DF_ingredients_pk DEFAULT NEWSEQUENTIALID(),
        name             nvarchar(200)     NOT NULL,
        default_unit_id  uniqueidentifier  NULL,
        ingredient_type  nvarchar(50)      NULL,
        is_active        bit               NOT NULL
                         CONSTRAINT DF_ingredients_active DEFAULT 1,
        created_at       datetime2(7)      NOT NULL
                         CONSTRAINT DF_ingredients_created DEFAULT SYSUTCDATETIME(),
        updated_at       datetime2(7)      NOT NULL
                         CONSTRAINT DF_ingredients_updated DEFAULT SYSUTCDATETIME(),
        is_deleted       bit               NOT NULL
                         CONSTRAINT DF_ingredients_del DEFAULT 0,

        CONSTRAINT PK_ingredients          PRIMARY KEY CLUSTERED (ingredient_id),
        CONSTRAINT FK_ingredients_unit     FOREIGN KEY (default_unit_id)
                                           REFERENCES dbo.units (unit_id),
        CONSTRAINT UQ_ingredients_name     UNIQUE (name)
    );
    PRINT 'Created table dbo.ingredients';
END
GO

-- 1.4 dbo.recipe_version_ingredients
IF OBJECT_ID(N'dbo.recipe_version_ingredients', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.recipe_version_ingredients (
        recipe_version_ingredient_id  uniqueidentifier  NOT NULL
                                      CONSTRAINT DF_rvi_pk DEFAULT NEWSEQUENTIALID(),
        recipe_version_id             uniqueidentifier  NOT NULL,
        ingredient_id                 uniqueidentifier  NOT NULL,
        base_amount                   decimal(18,6)     NOT NULL,
        unit_id                       uniqueidentifier  NOT NULL,
        sort_order                    int               NOT NULL
                                      CONSTRAINT DF_rvi_sort DEFAULT 1000,

        -- Rounding fields
        rounding_mode                 nvarchar(20)      NULL,
        rounding_decimals             int               NULL,
        rounding_increment            decimal(18,6)     NULL,

        notes                         nvarchar(max)     NULL,
        created_at                    datetime2(7)      NOT NULL
                                      CONSTRAINT DF_rvi_created DEFAULT SYSUTCDATETIME(),
        updated_at                    datetime2(7)      NOT NULL
                                      CONSTRAINT DF_rvi_updated DEFAULT SYSUTCDATETIME(),
        is_deleted                    bit               NOT NULL
                                      CONSTRAINT DF_rvi_del DEFAULT 0,

        CONSTRAINT PK_rvi                  PRIMARY KEY CLUSTERED (recipe_version_ingredient_id),
        CONSTRAINT FK_rvi_version          FOREIGN KEY (recipe_version_id)
                                           REFERENCES dbo.recipe_versions (recipe_version_id),
        CONSTRAINT FK_rvi_ingredient       FOREIGN KEY (ingredient_id)
                                           REFERENCES dbo.ingredients (ingredient_id),
        CONSTRAINT FK_rvi_unit             FOREIGN KEY (unit_id)
                                           REFERENCES dbo.units (unit_id),
        CONSTRAINT UQ_rvi_version_ingr     UNIQUE (recipe_version_id, ingredient_id),

        -- Rounding validation
        CONSTRAINT CK_rvi_rounding_mode
            CHECK (rounding_mode IS NULL OR rounding_mode IN ('none', 'decimals', 'increment')),
        CONSTRAINT CK_rvi_rounding_decimals
            CHECK (rounding_mode <> 'decimals' OR rounding_decimals IS NOT NULL),
        CONSTRAINT CK_rvi_rounding_increment
            CHECK (rounding_mode <> 'increment' OR rounding_increment IS NOT NULL)
    );
    PRINT 'Created table dbo.recipe_version_ingredients';
END
GO

-- 1.5 dbo.recipe_version_steps
IF OBJECT_ID(N'dbo.recipe_version_steps', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.recipe_version_steps (
        recipe_version_step_id  uniqueidentifier  NOT NULL
                                CONSTRAINT DF_rvs_pk DEFAULT NEWSEQUENTIALID(),
        recipe_version_id       uniqueidentifier  NOT NULL,
        step_number             int               NOT NULL,
        instruction             nvarchar(max)     NOT NULL,
        critical_control_point  bit               NOT NULL
                                CONSTRAINT DF_rvs_ccp DEFAULT 0,
        notes                   nvarchar(max)     NULL,
        created_at              datetime2(7)      NOT NULL
                                CONSTRAINT DF_rvs_created DEFAULT SYSUTCDATETIME(),
        updated_at              datetime2(7)      NOT NULL
                                CONSTRAINT DF_rvs_updated DEFAULT SYSUTCDATETIME(),
        is_deleted              bit               NOT NULL
                                CONSTRAINT DF_rvs_del DEFAULT 0,

        CONSTRAINT PK_rvs                  PRIMARY KEY CLUSTERED (recipe_version_step_id),
        CONSTRAINT FK_rvs_version          FOREIGN KEY (recipe_version_id)
                                           REFERENCES dbo.recipe_versions (recipe_version_id),
        CONSTRAINT UQ_rvs_version_step     UNIQUE (recipe_version_id, step_number)
    );
    PRINT 'Created table dbo.recipe_version_steps';
END
GO


------------------------------------------------------------------------
-- 2. INDEXES
------------------------------------------------------------------------

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_recipes_name' AND object_id = OBJECT_ID(N'dbo.recipes'))
    CREATE NONCLUSTERED INDEX IX_recipes_name
        ON dbo.recipes (name)
        WHERE is_deleted = 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_recipes_yield_unit' AND object_id = OBJECT_ID(N'dbo.recipes'))
    CREATE NONCLUSTERED INDEX IX_recipes_yield_unit
        ON dbo.recipes (default_base_yield_unit_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_rv_recipe_id' AND object_id = OBJECT_ID(N'dbo.recipe_versions'))
    CREATE NONCLUSTERED INDEX IX_rv_recipe_id
        ON dbo.recipe_versions (recipe_id)
        INCLUDE (version_number, is_current)
        WHERE is_deleted = 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ingredients_name' AND object_id = OBJECT_ID(N'dbo.ingredients'))
    CREATE NONCLUSTERED INDEX IX_ingredients_name
        ON dbo.ingredients (name)
        WHERE is_deleted = 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_rvi_recipe_version_id' AND object_id = OBJECT_ID(N'dbo.recipe_version_ingredients'))
    CREATE NONCLUSTERED INDEX IX_rvi_recipe_version_id
        ON dbo.recipe_version_ingredients (recipe_version_id)
        INCLUDE (ingredient_id, base_amount, unit_id, sort_order)
        WHERE is_deleted = 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_rvi_ingredient_id' AND object_id = OBJECT_ID(N'dbo.recipe_version_ingredients'))
    CREATE NONCLUSTERED INDEX IX_rvi_ingredient_id
        ON dbo.recipe_version_ingredients (ingredient_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_rvs_recipe_version_id' AND object_id = OBJECT_ID(N'dbo.recipe_version_steps'))
    CREATE NONCLUSTERED INDEX IX_rvs_recipe_version_id
        ON dbo.recipe_version_steps (recipe_version_id, step_number)
        WHERE is_deleted = 0;
GO


------------------------------------------------------------------------
-- 3. TRIGGERS (updated_at)
------------------------------------------------------------------------

CREATE OR ALTER TRIGGER dbo.TR_recipes_updated_at
ON dbo.recipes AFTER UPDATE
AS BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.recipes t INNER JOIN inserted i ON t.recipe_id = i.recipe_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_recipe_versions_updated_at
ON dbo.recipe_versions AFTER UPDATE
AS BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.recipe_versions t INNER JOIN inserted i ON t.recipe_version_id = i.recipe_version_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_ingredients_updated_at
ON dbo.ingredients AFTER UPDATE
AS BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.ingredients t INNER JOIN inserted i ON t.ingredient_id = i.ingredient_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_rvi_updated_at
ON dbo.recipe_version_ingredients AFTER UPDATE
AS BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.recipe_version_ingredients t INNER JOIN inserted i ON t.recipe_version_ingredient_id = i.recipe_version_ingredient_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_rvs_updated_at
ON dbo.recipe_version_steps AFTER UPDATE
AS BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.recipe_version_steps t INNER JOIN inserted i ON t.recipe_version_step_id = i.recipe_version_step_id;
END;
GO


------------------------------------------------------------------------
-- 4. STORED PROCEDURE: dbo.sp_get_scaled_recipe
------------------------------------------------------------------------

CREATE OR ALTER PROCEDURE dbo.sp_get_scaled_recipe
    @recipe_version_id   uniqueidentifier,
    @target_yield_value  decimal(18,4),
    @target_yield_unit_id uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    -- Validate target yield > 0
    IF @target_yield_value <= 0
    BEGIN
        RAISERROR('target_yield_value must be greater than zero.', 16, 1);
        RETURN 1;
    END

    -- Validate recipe version exists and is not deleted
    DECLARE @recipe_id         uniqueidentifier;
    DECLARE @recipe_name       nvarchar(200);
    DECLARE @version_number    int;
    DECLARE @base_yield_value  decimal(18,4);
    DECLARE @base_yield_unit_id uniqueidentifier;

    SELECT
        @recipe_id         = rv.recipe_id,
        @version_number    = rv.version_number,
        @base_yield_value  = rv.base_yield_value,
        @base_yield_unit_id = rv.base_yield_unit_id
    FROM dbo.recipe_versions rv
    WHERE rv.recipe_version_id = @recipe_version_id
      AND rv.is_deleted = 0;

    IF @recipe_id IS NULL
    BEGIN
        RAISERROR('Recipe version not found or is deleted.', 16, 1);
        RETURN 1;
    END

    SELECT @recipe_name = r.name
    FROM dbo.recipes r
    WHERE r.recipe_id = @recipe_id;

    -- Phase 3 constraint: target unit must match base yield unit
    IF @target_yield_unit_id <> @base_yield_unit_id
    BEGIN
        RAISERROR('Phase 3: target_yield_unit_id must match the recipe version base_yield_unit_id. Cross-unit scaling is not yet supported.', 16, 1);
        RETURN 1;
    END

    -- Compute scale factor
    DECLARE @scale_factor decimal(18,8);
    SET @scale_factor = CAST(@target_yield_value AS decimal(18,8)) / CAST(@base_yield_value AS decimal(18,8));

    ---------------------------------------------------------------
    -- Result Set 1: Header metadata
    ---------------------------------------------------------------
    SELECT
        @recipe_id              AS recipe_id,
        @recipe_name            AS recipe_name,
        @recipe_version_id      AS recipe_version_id,
        @version_number         AS version_number,
        @base_yield_value       AS base_yield_value,
        @base_yield_unit_id     AS base_yield_unit_id,
        bu.abbreviation         AS base_yield_unit,
        @target_yield_value     AS target_yield_value,
        @target_yield_unit_id   AS target_yield_unit_id,
        tu.abbreviation         AS target_yield_unit,
        @scale_factor           AS scale_factor
    FROM dbo.units bu
    CROSS JOIN dbo.units tu
    WHERE bu.unit_id = @base_yield_unit_id
      AND tu.unit_id = @target_yield_unit_id;

    ---------------------------------------------------------------
    -- Result Set 2: Scaled ingredient lines
    ---------------------------------------------------------------
    SELECT
        rvi.recipe_version_ingredient_id,
        rvi.ingredient_id,
        ing.name                        AS ingredient_name,
        rvi.base_amount,
        rvi.unit_id,
        u.abbreviation                  AS unit_abbrev,
        @scale_factor                   AS scale_factor,

        -- Raw scaled amount
        CAST(rvi.base_amount * @scale_factor AS decimal(18,6))
            AS scaled_amount_raw,

        -- Rounded scaled amount
        CASE
            WHEN rvi.rounding_mode IS NULL OR rvi.rounding_mode = 'none'
                THEN CAST(rvi.base_amount * @scale_factor AS decimal(18,6))

            WHEN rvi.rounding_mode = 'decimals'
                THEN ROUND(
                        CAST(rvi.base_amount * @scale_factor AS decimal(18,6)),
                        rvi.rounding_decimals
                     )

            WHEN rvi.rounding_mode = 'increment'
                THEN CAST(
                        ROUND(
                            CAST(rvi.base_amount * @scale_factor AS decimal(18,6))
                                / rvi.rounding_increment,
                            0
                        ) * rvi.rounding_increment
                     AS decimal(18,6))
        END AS scaled_amount_rounded,

        rvi.rounding_mode,
        rvi.rounding_decimals,
        rvi.rounding_increment,
        rvi.sort_order
    FROM dbo.recipe_version_ingredients rvi
    INNER JOIN dbo.ingredients ing ON rvi.ingredient_id = ing.ingredient_id
    INNER JOIN dbo.units u         ON rvi.unit_id       = u.unit_id
    WHERE rvi.recipe_version_id = @recipe_version_id
      AND rvi.is_deleted = 0
    ORDER BY rvi.sort_order, ing.name;

    ---------------------------------------------------------------
    -- Result Set 3: Steps
    ---------------------------------------------------------------
    SELECT
        rvs.step_number,
        rvs.instruction,
        rvs.critical_control_point,
        rvs.notes
    FROM dbo.recipe_version_steps rvs
    WHERE rvs.recipe_version_id = @recipe_version_id
      AND rvs.is_deleted = 0
    ORDER BY rvs.step_number;

    RETURN 0;
END;
GO

PRINT 'Created stored procedure dbo.sp_get_scaled_recipe';
GO


------------------------------------------------------------------------
-- 5. SAMPLE DATA: "Beaux''s Signature Hot Sauce" (1 gallon base)
------------------------------------------------------------------------

-- Get gallon unit ID
DECLARE @gal_id uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'gal');
DECLARE @oz_id  uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'oz');
DECLARE @lb_id  uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'lb');
DECLARE @cup_id uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'cup');
DECLARE @tbsp_id uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'Tbsp');
DECLARE @tsp_id uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'tsp');
DECLARE @g_id   uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'g');
DECLARE @ea_id  uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'ea');

-- Insert recipe (idempotent)
IF NOT EXISTS (SELECT 1 FROM dbo.recipes WHERE name = N'Beaux''s Signature Hot Sauce')
BEGIN
    DECLARE @recipe_id uniqueidentifier = NEWID();

    INSERT INTO dbo.recipes (recipe_id, name, description, default_base_yield_value, default_base_yield_unit_id)
    VALUES (
        @recipe_id,
        N'Beaux''s Signature Hot Sauce',
        N'A bold habanero-forward hot sauce with garlic, vinegar, and a touch of brown sugar. Beaux''s flagship product.',
        1.0000,
        @gal_id
    );

    -- Insert version 1 (current)
    DECLARE @rv_id uniqueidentifier = NEWID();

    INSERT INTO dbo.recipe_versions (recipe_version_id, recipe_id, version_number, title, base_yield_value, base_yield_unit_id, is_current)
    VALUES (
        @rv_id,
        @recipe_id,
        1,
        N'v1 - Original',
        1.0000,
        @gal_id,
        1
    );

    -- Insert ingredients first (idempotent via IGNORE_DUP_KEY won't work here, use merge)
    -- We need to ensure each ingredient exists, then reference it.
    DECLARE @ing_habanero uniqueidentifier, @ing_garlic uniqueidentifier, @ing_onion uniqueidentifier,
            @ing_vinegar uniqueidentifier, @ing_lime uniqueidentifier, @ing_salt uniqueidentifier,
            @ing_sugar uniqueidentifier, @ing_cumin uniqueidentifier;

    -- Habanero Peppers
    IF NOT EXISTS (SELECT 1 FROM dbo.ingredients WHERE name = N'Habanero Peppers')
        INSERT INTO dbo.ingredients (name, default_unit_id, ingredient_type) VALUES (N'Habanero Peppers', @lb_id, 'produce');
    SET @ing_habanero = (SELECT ingredient_id FROM dbo.ingredients WHERE name = N'Habanero Peppers');

    -- Garlic Cloves
    IF NOT EXISTS (SELECT 1 FROM dbo.ingredients WHERE name = N'Garlic Cloves')
        INSERT INTO dbo.ingredients (name, default_unit_id, ingredient_type) VALUES (N'Garlic Cloves', @ea_id, 'produce');
    SET @ing_garlic = (SELECT ingredient_id FROM dbo.ingredients WHERE name = N'Garlic Cloves');

    -- Yellow Onion
    IF NOT EXISTS (SELECT 1 FROM dbo.ingredients WHERE name = N'Yellow Onion')
        INSERT INTO dbo.ingredients (name, default_unit_id, ingredient_type) VALUES (N'Yellow Onion', @lb_id, 'produce');
    SET @ing_onion = (SELECT ingredient_id FROM dbo.ingredients WHERE name = N'Yellow Onion');

    -- White Distilled Vinegar
    IF NOT EXISTS (SELECT 1 FROM dbo.ingredients WHERE name = N'White Distilled Vinegar')
        INSERT INTO dbo.ingredients (name, default_unit_id, ingredient_type) VALUES (N'White Distilled Vinegar', @cup_id, 'liquid');
    SET @ing_vinegar = (SELECT ingredient_id FROM dbo.ingredients WHERE name = N'White Distilled Vinegar');

    -- Lime Juice
    IF NOT EXISTS (SELECT 1 FROM dbo.ingredients WHERE name = N'Lime Juice')
        INSERT INTO dbo.ingredients (name, default_unit_id, ingredient_type) VALUES (N'Lime Juice', @tbsp_id, 'liquid');
    SET @ing_lime = (SELECT ingredient_id FROM dbo.ingredients WHERE name = N'Lime Juice');

    -- Kosher Salt
    IF NOT EXISTS (SELECT 1 FROM dbo.ingredients WHERE name = N'Kosher Salt')
        INSERT INTO dbo.ingredients (name, default_unit_id, ingredient_type) VALUES (N'Kosher Salt', @tsp_id, 'spice');
    SET @ing_salt = (SELECT ingredient_id FROM dbo.ingredients WHERE name = N'Kosher Salt');

    -- Brown Sugar
    IF NOT EXISTS (SELECT 1 FROM dbo.ingredients WHERE name = N'Brown Sugar')
        INSERT INTO dbo.ingredients (name, default_unit_id, ingredient_type) VALUES (N'Brown Sugar', @tbsp_id, 'dry');
    SET @ing_sugar = (SELECT ingredient_id FROM dbo.ingredients WHERE name = N'Brown Sugar');

    -- Ground Cumin
    IF NOT EXISTS (SELECT 1 FROM dbo.ingredients WHERE name = N'Ground Cumin')
        INSERT INTO dbo.ingredients (name, default_unit_id, ingredient_type) VALUES (N'Ground Cumin', @tsp_id, 'spice');
    SET @ing_cumin = (SELECT ingredient_id FROM dbo.ingredients WHERE name = N'Ground Cumin');

    -- Insert recipe version ingredients (for 1 gallon base yield)
    -- Using realistic hot sauce proportions
    INSERT INTO dbo.recipe_version_ingredients
        (recipe_version_id, ingredient_id, base_amount, unit_id, sort_order, rounding_mode, rounding_decimals, rounding_increment)
    VALUES
        -- 3 lbs habaneros, round to 0.25 lb increments
        (@rv_id, @ing_habanero, 3.000000, @lb_id,  100, 'increment', NULL, 0.250000),
        -- 12 cloves garlic, round to whole numbers
        (@rv_id, @ing_garlic,  12.000000, @ea_id,  200, 'decimals',  0,    NULL),
        -- 1.5 lbs yellow onion, round to 0.25 lb increments
        (@rv_id, @ing_onion,    1.500000, @lb_id,  300, 'increment', NULL, 0.250000),
        -- 6 cups vinegar, round to 2 decimals
        (@rv_id, @ing_vinegar,  6.000000, @cup_id, 400, 'decimals',  2,    NULL),
        -- 4 Tbsp lime juice, round to 1 decimal
        (@rv_id, @ing_lime,     4.000000, @tbsp_id,500, 'decimals',  1,    NULL),
        -- 2.5 tsp kosher salt, round to 0.5 tsp increments
        (@rv_id, @ing_salt,     2.500000, @tsp_id, 600, 'increment', NULL, 0.500000),
        -- 3 Tbsp brown sugar, round to whole Tbsp
        (@rv_id, @ing_sugar,    3.000000, @tbsp_id,700, 'decimals',  0,    NULL),
        -- 1.5 tsp ground cumin, round to 0.25 tsp increments
        (@rv_id, @ing_cumin,    1.500000, @tsp_id, 800, 'increment', NULL, 0.250000);

    -- Insert recipe steps
    INSERT INTO dbo.recipe_version_steps (recipe_version_id, step_number, instruction, critical_control_point)
    VALUES
        (@rv_id, 1, N'Wash and stem habanero peppers. Wear gloves.', 0),
        (@rv_id, 2, N'Rough chop onion and garlic.', 0),
        (@rv_id, 3, N'Combine habaneros, onion, and garlic in a large pot with vinegar. Bring to a boil.', 0),
        (@rv_id, 4, N'Reduce heat and simmer for 20 minutes until peppers are soft.', 0),
        (@rv_id, 5, N'Add lime juice, salt, brown sugar, and cumin. Stir to combine.', 0),
        (@rv_id, 6, N'Blend until smooth using an immersion blender or transfer to a blender in batches.', 0),
        (@rv_id, 7, N'Return to pot and simmer 10 more minutes. Check pH — must be below 3.5.', 1),
        (@rv_id, 8, N'Hot-fill into sterilized bottles. Cap immediately.', 1),
        (@rv_id, 9, N'Cool bottles and label. Record lot code and yield.', 0);

    PRINT 'Sample recipe "Beaux''s Signature Hot Sauce" created with 8 ingredients and 9 steps.';
END
ELSE
BEGIN
    PRINT 'Sample recipe already exists — skipping.';
END
GO


------------------------------------------------------------------------
-- 6. DEMO: Scaling calls at standard batch sizes + custom
------------------------------------------------------------------------

-- Retrieve the sample recipe version ID
DECLARE @demo_rv_id uniqueidentifier;
DECLARE @demo_gal_id uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'gal');

SELECT @demo_rv_id = rv.recipe_version_id
FROM dbo.recipe_versions rv
INNER JOIN dbo.recipes r ON rv.recipe_id = r.recipe_id
WHERE r.name = N'Beaux''s Signature Hot Sauce'
  AND rv.is_current = 1
  AND rv.is_deleted = 0;

IF @demo_rv_id IS NOT NULL
BEGIN
    PRINT '';
    PRINT '=== DEMO: 0.5 gallon ===';
    EXEC dbo.sp_get_scaled_recipe @demo_rv_id, 0.5, @demo_gal_id;

    PRINT '';
    PRINT '=== DEMO: 1 gallon (base) ===';
    EXEC dbo.sp_get_scaled_recipe @demo_rv_id, 1.0, @demo_gal_id;

    PRINT '';
    PRINT '=== DEMO: 5 gallons ===';
    EXEC dbo.sp_get_scaled_recipe @demo_rv_id, 5.0, @demo_gal_id;

    PRINT '';
    PRINT '=== DEMO: 10 gallons ===';
    EXEC dbo.sp_get_scaled_recipe @demo_rv_id, 10.0, @demo_gal_id;

    PRINT '';
    PRINT '=== DEMO: 20 gallons ===';
    EXEC dbo.sp_get_scaled_recipe @demo_rv_id, 20.0, @demo_gal_id;

    PRINT '';
    PRINT '=== DEMO: 2.75 gallons (custom) ===';
    EXEC dbo.sp_get_scaled_recipe @demo_rv_id, 2.75, @demo_gal_id;
END
ELSE
BEGIN
    PRINT 'Sample recipe version not found — demo skipped.';
END
GO


------------------------------------------------------------------------
-- 7. VERIFICATION QUERIES
------------------------------------------------------------------------

-- Show Phase 3 tables
SELECT
    s.name AS [schema],
    t.name AS [table],
    t.create_date
FROM sys.tables t
INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = 'dbo'
  AND t.name IN (
    'recipes', 'recipe_versions', 'ingredients',
    'recipe_version_ingredients', 'recipe_version_steps'
  )
ORDER BY t.name;
GO

-- Show indexes
SELECT
    OBJECT_NAME(i.object_id) AS table_name,
    i.name AS index_name,
    i.type_desc,
    i.is_unique,
    i.has_filter
FROM sys.indexes i
INNER JOIN sys.tables t ON i.object_id = t.object_id
INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = 'dbo'
  AND t.name IN (
    'recipes', 'recipe_versions', 'ingredients',
    'recipe_version_ingredients', 'recipe_version_steps'
  )
  AND i.name IS NOT NULL
ORDER BY t.name, i.name;
GO

PRINT '=== Phase 3 — Recipes + Scaling Engine: Script complete ===';
GO
