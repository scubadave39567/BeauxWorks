-- 10-item-types-and-ingredient-categories.sql
-- Creates the item_types and ingredient_categories lookup tables with seed data.

-- ── Item Types ──────────────────────────────────────────────────────
IF OBJECT_ID('dbo.item_types', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.item_types (
        item_type_id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        name         VARCHAR(100)     NOT NULL,
        description  VARCHAR(500)     NULL,
        sort_order   INT              NOT NULL DEFAULT 0,
        is_deleted   BIT              NOT NULL DEFAULT 0,
        created_at   DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at   DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_item_types PRIMARY KEY (item_type_id),
        CONSTRAINT UQ_item_types_name UNIQUE (name)
    );

    INSERT INTO dbo.item_types (name, description, sort_order)
    VALUES
        ('Material',  'Raw materials and ingredients', 0),
        ('Product',   'Finished products',             1),
        ('Packaging', 'Packaging materials',            2);
END;
GO

-- ── Ingredient Categories ───────────────────────────────────────────
IF OBJECT_ID('dbo.ingredient_categories', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ingredient_categories (
        ingredient_category_id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        name                   VARCHAR(100)     NOT NULL,
        description            VARCHAR(500)     NULL,
        sort_order             INT              NOT NULL DEFAULT 0,
        is_deleted             BIT              NOT NULL DEFAULT 0,
        created_at             DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at             DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ingredient_categories PRIMARY KEY (ingredient_category_id),
        CONSTRAINT UQ_ingredient_categories_name UNIQUE (name)
    );

    -- Seed from existing ingredient_type values
    INSERT INTO dbo.ingredient_categories (name, sort_order)
    VALUES
        ('Produce',  0),
        ('Liquid',   1),
        ('Spice',    2),
        ('Dry',      3);
END;
GO
