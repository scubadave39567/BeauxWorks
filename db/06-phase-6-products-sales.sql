/*
  BeauxWorks — Phase 6: Products + Sales + Compliance + Attachments
  ==================================================================
  Run AFTER 05-phase-5-inventory.sql

  Creates (in dependency order):
    1.  dbo.products
    2.  dbo.product_compliance_profiles
    3.  dbo.scheduled_process_documents
    4.  dbo.sales
    5.  dbo.attachments             (FILESTREAM via BWFiles filegroup)
    6.  dbo.attachment_links        (polymorphic entity linking)
  Then: deferred FK constraints, indexes, triggers, seed data, demo.

  FILESTREAM: Uses existing BWFiles filegroup detected on CHAMBERLAIN-PC.
  Idempotent: IF NOT EXISTS / IF OBJECT_ID checks.
*/

SET QUOTED_IDENTIFIER ON;
GO

USE [BeauxWorks];
GO

------------------------------------------------------------------------
-- 1. TABLES
------------------------------------------------------------------------

-- 1.1 dbo.products
IF OBJECT_ID(N'dbo.products', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.products (
        product_id            uniqueidentifier  NOT NULL
                              CONSTRAINT DF_prod_pk DEFAULT NEWSEQUENTIALID(),
        name                  nvarchar(200)     NOT NULL,
        description           nvarchar(max)     NULL,
        product_type_id       uniqueidentifier  NOT NULL,
        product_category_id   uniqueidentifier  NULL,
        sku                   nvarchar(100)     NULL,
        default_price         decimal(18,2)     NULL,
        default_unit_id       uniqueidentifier  NULL,
        is_active             bit               NOT NULL
                              CONSTRAINT DF_prod_active DEFAULT 1,
        created_at            datetime2(7)      NOT NULL
                              CONSTRAINT DF_prod_created DEFAULT SYSUTCDATETIME(),
        updated_at            datetime2(7)      NOT NULL
                              CONSTRAINT DF_prod_updated DEFAULT SYSUTCDATETIME(),
        is_deleted            bit               NOT NULL
                              CONSTRAINT DF_prod_del DEFAULT 0,

        CONSTRAINT PK_products              PRIMARY KEY CLUSTERED (product_id),
        CONSTRAINT FK_prod_type             FOREIGN KEY (product_type_id)
                                            REFERENCES dbo.product_types (product_type_id),
        CONSTRAINT FK_prod_category         FOREIGN KEY (product_category_id)
                                            REFERENCES dbo.product_categories (product_category_id),
        CONSTRAINT FK_prod_unit             FOREIGN KEY (default_unit_id)
                                            REFERENCES dbo.units (unit_id),
        CONSTRAINT UQ_products_name         UNIQUE (name)
    );
    PRINT 'Created table dbo.products';
END
GO

-- Optional: unique SKU (only when not null)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_products_sku' AND object_id = OBJECT_ID(N'dbo.products'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_products_sku
        ON dbo.products (sku)
        WHERE sku IS NOT NULL AND is_deleted = 0;
GO

-- 1.2 dbo.product_compliance_profiles
IF OBJECT_ID(N'dbo.product_compliance_profiles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.product_compliance_profiles (
        product_compliance_profile_id  uniqueidentifier  NOT NULL
            CONSTRAINT DF_pcp_pk DEFAULT NEWSEQUENTIALID(),
        product_id                     uniqueidentifier  NOT NULL,
        classification_code            nvarchar(50)      NOT NULL,
        requires_scheduled_process     bit               NOT NULL CONSTRAINT DF_pcp_sched DEFAULT 0,
        requires_ph_logging            bit               NOT NULL CONSTRAINT DF_pcp_ph DEFAULT 0,
        requires_temp_logging          bit               NOT NULL CONSTRAINT DF_pcp_temp DEFAULT 0,
        requires_aw_logging            bit               NOT NULL CONSTRAINT DF_pcp_aw DEFAULT 0,
        requires_salinity_logging      bit               NOT NULL CONSTRAINT DF_pcp_sal DEFAULT 0,
        notes                          nvarchar(max)     NULL,
        created_at                     datetime2(7)      NOT NULL
                                       CONSTRAINT DF_pcp_created DEFAULT SYSUTCDATETIME(),
        updated_at                     datetime2(7)      NOT NULL
                                       CONSTRAINT DF_pcp_updated DEFAULT SYSUTCDATETIME(),
        is_deleted                     bit               NOT NULL
                                       CONSTRAINT DF_pcp_del DEFAULT 0,

        CONSTRAINT PK_pcp                  PRIMARY KEY CLUSTERED (product_compliance_profile_id),
        CONSTRAINT FK_pcp_product          FOREIGN KEY (product_id)
                                           REFERENCES dbo.products (product_id),
        CONSTRAINT UQ_pcp_product          UNIQUE (product_id),
        CONSTRAINT CK_pcp_classification   CHECK (classification_code IN (
            'acidified', 'low_acid_canned', 'refrigerated', 'dehydrated',
            'bakery', 'spice_powder', 'fermented', 'beverage', 'other'
        ))
    );
    PRINT 'Created table dbo.product_compliance_profiles';
END
GO

-- 1.3 dbo.scheduled_process_documents
IF OBJECT_ID(N'dbo.scheduled_process_documents', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.scheduled_process_documents (
        scheduled_process_document_id  uniqueidentifier  NOT NULL
            CONSTRAINT DF_spd_pk DEFAULT NEWSEQUENTIALID(),
        product_id                     uniqueidentifier  NOT NULL,
        recipe_version_id              uniqueidentifier  NULL,
        authority_name                 nvarchar(200)     NULL,
        authority_contact              nvarchar(200)     NULL,
        authority_location_state       nvarchar(2)       NULL,
        document_date                  date              NULL,
        process_summary                nvarchar(max)     NULL,
        process_identifier             nvarchar(100)     NULL,
        valid_from                     date              NULL,
        valid_to                       date              NULL,
        is_active                      bit               NOT NULL
                                       CONSTRAINT DF_spd_active DEFAULT 1,
        created_at                     datetime2(7)      NOT NULL
                                       CONSTRAINT DF_spd_created DEFAULT SYSUTCDATETIME(),
        updated_at                     datetime2(7)      NOT NULL
                                       CONSTRAINT DF_spd_updated DEFAULT SYSUTCDATETIME(),
        is_deleted                     bit               NOT NULL
                                       CONSTRAINT DF_spd_del DEFAULT 0,

        CONSTRAINT PK_spd                  PRIMARY KEY CLUSTERED (scheduled_process_document_id),
        CONSTRAINT FK_spd_product          FOREIGN KEY (product_id)
                                           REFERENCES dbo.products (product_id),
        CONSTRAINT FK_spd_recipe_version   FOREIGN KEY (recipe_version_id)
                                           REFERENCES dbo.recipe_versions (recipe_version_id)
    );
    PRINT 'Created table dbo.scheduled_process_documents';
END
GO

-- 1.4 dbo.sales
IF OBJECT_ID(N'dbo.sales', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.sales (
        sale_id               uniqueidentifier  NOT NULL
                              CONSTRAINT DF_sale_pk DEFAULT NEWSEQUENTIALID(),
        product_id            uniqueidentifier  NOT NULL,
        facility_id           uniqueidentifier  NOT NULL,
        sales_channel_id      uniqueidentifier  NOT NULL,
        sale_date             datetime2(7)      NOT NULL,
        quantity              decimal(18,4)     NOT NULL,
        unit_id               uniqueidentifier  NOT NULL,
        unit_price            decimal(18,2)     NOT NULL,
        total_price           AS (CAST(quantity * unit_price AS decimal(18,2))) PERSISTED,
        customer_name         nvarchar(200)     NULL,
        notes                 nvarchar(max)     NULL,
        recorded_by_user_id   uniqueidentifier  NULL,
        created_at            datetime2(7)      NOT NULL
                              CONSTRAINT DF_sale_created DEFAULT SYSUTCDATETIME(),
        updated_at            datetime2(7)      NOT NULL
                              CONSTRAINT DF_sale_updated DEFAULT SYSUTCDATETIME(),
        is_deleted            bit               NOT NULL
                              CONSTRAINT DF_sale_del DEFAULT 0,

        CONSTRAINT PK_sales                PRIMARY KEY CLUSTERED (sale_id),
        CONSTRAINT FK_sale_product         FOREIGN KEY (product_id)
                                           REFERENCES dbo.products (product_id),
        CONSTRAINT FK_sale_facility        FOREIGN KEY (facility_id)
                                           REFERENCES dbo.facilities (facility_id),
        CONSTRAINT FK_sale_channel         FOREIGN KEY (sales_channel_id)
                                           REFERENCES dbo.sales_channels (sales_channel_id),
        CONSTRAINT FK_sale_unit            FOREIGN KEY (unit_id)
                                           REFERENCES dbo.units (unit_id),
        CONSTRAINT FK_sale_recorded_by     FOREIGN KEY (recorded_by_user_id)
                                           REFERENCES dbo.users (user_id),
        CONSTRAINT CK_sale_quantity_pos    CHECK (quantity > 0),
        CONSTRAINT CK_sale_price_pos       CHECK (unit_price >= 0)
    );
    PRINT 'Created table dbo.sales';
END
GO

-- 1.5 dbo.attachments (FILESTREAM)
IF OBJECT_ID(N'dbo.attachments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.attachments (
        attachment_id         uniqueidentifier  NOT NULL
                              CONSTRAINT DF_att_pk DEFAULT NEWSEQUENTIALID(),
        file_rowguid          uniqueidentifier  ROWGUIDCOL NOT NULL
                              CONSTRAINT DF_att_rowguid DEFAULT NEWSEQUENTIALID()
                              UNIQUE,
        file_blob             varbinary(max)    FILESTREAM NULL,
        file_name             nvarchar(260)     NOT NULL,
        content_type          nvarchar(100)     NOT NULL,
        file_size_bytes       bigint            NOT NULL,
        sha256_hash           varbinary(32)     NULL,
        uploaded_by_user_id   uniqueidentifier  NOT NULL,
        facility_id           uniqueidentifier  NULL,
        uploaded_at           datetime2(7)      NOT NULL
                              CONSTRAINT DF_att_uploaded DEFAULT SYSUTCDATETIME(),
        created_at            datetime2(7)      NOT NULL
                              CONSTRAINT DF_att_created DEFAULT SYSUTCDATETIME(),
        updated_at            datetime2(7)      NOT NULL
                              CONSTRAINT DF_att_updated DEFAULT SYSUTCDATETIME(),
        is_deleted            bit               NOT NULL
                              CONSTRAINT DF_att_del DEFAULT 0,

        CONSTRAINT PK_attachments          PRIMARY KEY CLUSTERED (attachment_id),
        CONSTRAINT FK_att_uploaded_by      FOREIGN KEY (uploaded_by_user_id)
                                           REFERENCES dbo.users (user_id),
        CONSTRAINT FK_att_facility         FOREIGN KEY (facility_id)
                                           REFERENCES dbo.facilities (facility_id)
    );
    PRINT 'Created table dbo.attachments (FILESTREAM)';
END
GO

-- 1.6 dbo.attachment_links (polymorphic entity linking)
IF OBJECT_ID(N'dbo.attachment_links', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.attachment_links (
        attachment_link_id    uniqueidentifier  NOT NULL
                              CONSTRAINT DF_al_pk DEFAULT NEWSEQUENTIALID(),
        attachment_id         uniqueidentifier  NOT NULL,
        entity_type           nvarchar(100)     NOT NULL,
        entity_id             uniqueidentifier  NOT NULL,
        link_notes            nvarchar(500)     NULL,
        created_at            datetime2(7)      NOT NULL
                              CONSTRAINT DF_al_created DEFAULT SYSUTCDATETIME(),
        updated_at            datetime2(7)      NOT NULL
                              CONSTRAINT DF_al_updated DEFAULT SYSUTCDATETIME(),
        is_deleted            bit               NOT NULL
                              CONSTRAINT DF_al_del DEFAULT 0,

        CONSTRAINT PK_attachment_links         PRIMARY KEY CLUSTERED (attachment_link_id),
        CONSTRAINT FK_al_attachment            FOREIGN KEY (attachment_id)
                                               REFERENCES dbo.attachments (attachment_id),
        CONSTRAINT UQ_al_entity               UNIQUE (attachment_id, entity_type, entity_id),
        CONSTRAINT CK_al_entity_type          CHECK (entity_type IN (
            'production_run', 'production_run_deviation', 'product',
            'scheduled_process_document', 'ingredient_lot', 'product_lot', 'recipe_version'
        ))
    );
    PRINT 'Created table dbo.attachment_links';
END
GO


------------------------------------------------------------------------
-- 2. DEFERRED FK CONSTRAINTS (from earlier phases)
------------------------------------------------------------------------

-- production_runs.product_id → products
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_pr_product'
)
BEGIN
    ALTER TABLE dbo.production_runs
        ADD CONSTRAINT FK_pr_product
        FOREIGN KEY (product_id) REFERENCES dbo.products (product_id);
    PRINT 'Added FK_pr_product on production_runs.product_id';
END
GO

-- product_lots.product_id → products
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_pl_product'
)
BEGIN
    ALTER TABLE dbo.product_lots
        ADD CONSTRAINT FK_pl_product
        FOREIGN KEY (product_id) REFERENCES dbo.products (product_id);
    PRINT 'Added FK_pl_product on product_lots.product_id';
END
GO


------------------------------------------------------------------------
-- 3. INDEXES
------------------------------------------------------------------------

-- products
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_prod_type' AND object_id = OBJECT_ID(N'dbo.products'))
    CREATE NONCLUSTERED INDEX IX_prod_type
        ON dbo.products (product_type_id) WHERE is_deleted = 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_prod_category' AND object_id = OBJECT_ID(N'dbo.products'))
    CREATE NONCLUSTERED INDEX IX_prod_category
        ON dbo.products (product_category_id) WHERE is_deleted = 0 AND product_category_id IS NOT NULL;
GO

-- compliance profiles
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_pcp_classification' AND object_id = OBJECT_ID(N'dbo.product_compliance_profiles'))
    CREATE NONCLUSTERED INDEX IX_pcp_classification
        ON dbo.product_compliance_profiles (classification_code) WHERE is_deleted = 0;
GO

-- scheduled process documents
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_spd_product' AND object_id = OBJECT_ID(N'dbo.scheduled_process_documents'))
    CREATE NONCLUSTERED INDEX IX_spd_product
        ON dbo.scheduled_process_documents (product_id)
        WHERE is_active = 1 AND is_deleted = 0;
GO

-- sales
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_sale_product' AND object_id = OBJECT_ID(N'dbo.sales'))
    CREATE NONCLUSTERED INDEX IX_sale_product
        ON dbo.sales (product_id, sale_date) WHERE is_deleted = 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_sale_channel' AND object_id = OBJECT_ID(N'dbo.sales'))
    CREATE NONCLUSTERED INDEX IX_sale_channel
        ON dbo.sales (sales_channel_id, sale_date) WHERE is_deleted = 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_sale_facility' AND object_id = OBJECT_ID(N'dbo.sales'))
    CREATE NONCLUSTERED INDEX IX_sale_facility
        ON dbo.sales (facility_id, sale_date) WHERE is_deleted = 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_sale_date' AND object_id = OBJECT_ID(N'dbo.sales'))
    CREATE NONCLUSTERED INDEX IX_sale_date
        ON dbo.sales (sale_date DESC) WHERE is_deleted = 0;
GO

-- attachments
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_att_uploaded_by' AND object_id = OBJECT_ID(N'dbo.attachments'))
    CREATE NONCLUSTERED INDEX IX_att_uploaded_by
        ON dbo.attachments (uploaded_by_user_id) WHERE is_deleted = 0;
GO

-- attachment_links
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_al_entity' AND object_id = OBJECT_ID(N'dbo.attachment_links'))
    CREATE NONCLUSTERED INDEX IX_al_entity
        ON dbo.attachment_links (entity_type, entity_id) WHERE is_deleted = 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_al_attachment' AND object_id = OBJECT_ID(N'dbo.attachment_links'))
    CREATE NONCLUSTERED INDEX IX_al_attachment
        ON dbo.attachment_links (attachment_id) WHERE is_deleted = 0;
GO


------------------------------------------------------------------------
-- 4. TRIGGERS (updated_at)
------------------------------------------------------------------------

CREATE OR ALTER TRIGGER dbo.TR_products_updated_at
ON dbo.products AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.products t INNER JOIN inserted i ON t.product_id = i.product_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_pcp_updated_at
ON dbo.product_compliance_profiles AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.product_compliance_profiles t INNER JOIN inserted i ON t.product_compliance_profile_id = i.product_compliance_profile_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_spd_updated_at
ON dbo.scheduled_process_documents AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.scheduled_process_documents t INNER JOIN inserted i ON t.scheduled_process_document_id = i.scheduled_process_document_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_sales_updated_at
ON dbo.sales AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.sales t INNER JOIN inserted i ON t.sale_id = i.sale_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_attachments_updated_at
ON dbo.attachments AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.attachments t INNER JOIN inserted i ON t.attachment_id = i.attachment_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_al_updated_at
ON dbo.attachment_links AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.attachment_links t INNER JOIN inserted i ON t.attachment_link_id = i.attachment_link_id;
END;
GO


------------------------------------------------------------------------
-- 5. VIEWS
------------------------------------------------------------------------

-- 5.1 Sales summary by product + channel
CREATE OR ALTER VIEW dbo.vw_sales_summary
AS
SELECT
    p.product_id,
    p.name                  AS product_name,
    sc.code                 AS channel_code,
    sc.name                 AS channel_name,
    f.name                  AS facility_name,
    CAST(s.sale_date AS date) AS sale_day,
    COUNT(*)                AS transaction_count,
    SUM(s.quantity)         AS total_quantity,
    u.abbreviation          AS unit,
    SUM(s.total_price)      AS total_revenue
FROM dbo.sales s
INNER JOIN dbo.products p       ON s.product_id      = p.product_id
INNER JOIN dbo.sales_channels sc ON s.sales_channel_id = sc.sales_channel_id
INNER JOIN dbo.facilities f     ON s.facility_id      = f.facility_id
INNER JOIN dbo.units u          ON s.unit_id          = u.unit_id
WHERE s.is_deleted = 0
GROUP BY p.product_id, p.name, sc.code, sc.name, f.name,
         CAST(s.sale_date AS date), u.abbreviation;
GO

-- 5.2 Product compliance overview
CREATE OR ALTER VIEW dbo.vw_product_compliance
AS
SELECT
    p.product_id,
    p.name                          AS product_name,
    pt.code                         AS product_type_code,
    pcp.classification_code,
    pcp.requires_scheduled_process,
    pcp.requires_ph_logging,
    pcp.requires_temp_logging,
    pcp.requires_aw_logging,
    pcp.requires_salinity_logging,
    -- Latest active scheduled process document
    spd.scheduled_process_document_id AS active_spd_id,
    spd.authority_name,
    spd.process_identifier,
    spd.valid_from                  AS spd_valid_from,
    spd.valid_to                    AS spd_valid_to,
    CASE
        WHEN pcp.requires_scheduled_process = 1 AND spd.scheduled_process_document_id IS NULL
        THEN 0 ELSE 1
    END AS has_required_spd
FROM dbo.products p
INNER JOIN dbo.product_types pt ON p.product_type_id = pt.product_type_id
LEFT JOIN  dbo.product_compliance_profiles pcp
    ON pcp.product_id = p.product_id AND pcp.is_deleted = 0
LEFT JOIN  dbo.scheduled_process_documents spd
    ON spd.product_id = p.product_id AND spd.is_active = 1 AND spd.is_deleted = 0
WHERE p.is_deleted = 0;
GO

PRINT 'Views created (vw_sales_summary, vw_product_compliance).';
GO


------------------------------------------------------------------------
-- 6. SEED / DEMO DATA
------------------------------------------------------------------------

DECLARE @demo_user  uniqueidentifier = (SELECT user_id FROM dbo.users WHERE email = 'demo@beauxbistro.local');
DECLARE @facility   uniqueidentifier = (SELECT facility_id FROM dbo.facilities WHERE code = 'MAIN');
DECLARE @ea_id      uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'ea');
DECLARE @gal_id     uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'gal');
DECLARE @pt_hot     uniqueidentifier = (SELECT product_type_id FROM dbo.product_types WHERE code = 'hot_sauces');
DECLARE @cat_sauce  uniqueidentifier = (SELECT product_category_id FROM dbo.product_categories WHERE name = 'Sauces & Condiments');
DECLARE @ch_fm      uniqueidentifier = (SELECT sales_channel_id FROM dbo.sales_channels WHERE code = 'farmers_market');
DECLARE @ch_direct  uniqueidentifier = (SELECT sales_channel_id FROM dbo.sales_channels WHERE code = 'direct');

-- Get the demo recipe version for linking scheduled process doc
DECLARE @demo_rv uniqueidentifier;
SELECT @demo_rv = rv.recipe_version_id
FROM dbo.recipe_versions rv
INNER JOIN dbo.recipes r ON rv.recipe_id = r.recipe_id
WHERE r.name = N'Beaux''s Signature Hot Sauce' AND rv.is_current = 1;

IF NOT EXISTS (SELECT 1 FROM dbo.products WHERE name = N'Beaux''s Signature Hot Sauce — 5 oz Bottle')
BEGIN
    PRINT '';
    PRINT '=== DEMO: Products, Compliance, and Sales ===';

    -- Step 1: Create product
    DECLARE @prod_id uniqueidentifier = NEWID();
    INSERT INTO dbo.products (product_id, name, description, product_type_id, product_category_id, sku, default_price, default_unit_id)
    VALUES (
        @prod_id,
        N'Beaux''s Signature Hot Sauce — 5 oz Bottle',
        N'Bold habanero-forward hot sauce. 5 oz woozy bottle.',
        @pt_hot, @cat_sauce, 'BHS-5OZ', 8.99, @ea_id
    );
    PRINT '  1. Product created: Beaux''s Signature Hot Sauce — 5 oz Bottle (SKU: BHS-5OZ)';

    -- Step 2: Create compliance profile (acidified product)
    INSERT INTO dbo.product_compliance_profiles
        (product_id, classification_code, requires_scheduled_process, requires_ph_logging, requires_temp_logging, notes)
    VALUES (
        @prod_id, 'acidified', 1, 1, 1,
        'Acidified food per 21 CFR 114. Finished pH must be ≤ 4.6 (target ≤ 3.5). Scheduled process required.'
    );
    PRINT '  2. Compliance profile: acidified, scheduled process + pH + temp required';

    -- Step 3: Create scheduled process document
    INSERT INTO dbo.scheduled_process_documents
        (product_id, recipe_version_id, authority_name, authority_contact, authority_location_state,
         document_date, process_summary, process_identifier, valid_from, valid_to, is_active)
    VALUES (
        @prod_id, @demo_rv,
        'UGA Food Science Extension', 'Dr. Process Authority', 'GA',
        '2026-01-15', 'Hot-fill hold at ≥ 185°F. Finished pH ≤ 3.5. Validated for 5 oz woozy bottle.',
        'PA-2026-0042', '2026-01-15', '2027-01-14', 1
    );
    PRINT '  3. Scheduled process document linked (PA-2026-0042, UGA)';

    -- Step 4: Link demo run to this product
    UPDATE dbo.production_runs SET product_id = @prod_id WHERE lot_code = 'HS-20260208-001';
    UPDATE dbo.product_lots    SET product_id = @prod_id WHERE lot_code = 'HS-20260208-001';
    PRINT '  4. Linked demo run and product lot to product';

    -- Step 5: Record some sales
    -- Farmers market: sold 18 bottles at $8.99
    INSERT INTO dbo.sales (product_id, facility_id, sales_channel_id, sale_date, quantity, unit_id, unit_price, recorded_by_user_id, notes)
    VALUES (@prod_id, @facility, @ch_fm, '2026-02-09 10:30:00', 18, @ea_id, 8.99, @demo_user, 'Downtown Farmers Market — morning rush');

    -- Farmers market: sold 7 more later
    INSERT INTO dbo.sales (product_id, facility_id, sales_channel_id, sale_date, quantity, unit_id, unit_price, recorded_by_user_id, notes)
    VALUES (@prod_id, @facility, @ch_fm, '2026-02-09 13:15:00', 7, @ea_id, 8.99, @demo_user, 'Downtown Farmers Market — afternoon');

    -- Direct sale: 3 bottles at $9.99
    INSERT INTO dbo.sales (product_id, facility_id, sales_channel_id, sale_date, quantity, unit_id, unit_price, customer_name, recorded_by_user_id)
    VALUES (@prod_id, @facility, @ch_direct, '2026-02-10 16:00:00', 3, @ea_id, 9.99, 'Jane Doe', @demo_user);

    PRINT '  5. Sales recorded: 25 farmers market + 3 direct = 28 bottles';

    -- Show results
    PRINT '';
    PRINT '--- Product compliance overview ---';
    SELECT product_name, product_type_code, classification_code,
           requires_scheduled_process, requires_ph_logging, requires_temp_logging,
           authority_name, process_identifier, spd_valid_from, spd_valid_to, has_required_spd
    FROM dbo.vw_product_compliance
    WHERE product_name LIKE '%Signature Hot Sauce%';

    PRINT '';
    PRINT '--- Sales summary ---';
    SELECT product_name, channel_name, sale_day, transaction_count,
           total_quantity, unit, total_revenue
    FROM dbo.vw_sales_summary
    WHERE product_name LIKE '%Signature Hot Sauce%'
    ORDER BY sale_day, channel_name;

    PRINT '';
    PRINT '=== DEMO Complete ===';
END
ELSE
BEGIN
    PRINT 'Demo data already exists — skipping.';
END
GO


------------------------------------------------------------------------
-- 7. VERIFICATION
------------------------------------------------------------------------

SELECT
    s.name AS [schema],
    t.name AS [table],
    t.create_date
FROM sys.tables t
INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = 'dbo'
  AND t.name IN (
    'products', 'product_compliance_profiles', 'scheduled_process_documents',
    'sales', 'attachments', 'attachment_links'
  )
ORDER BY t.name;
GO

-- Verify deferred FKs
SELECT
    fk.name AS fk_name,
    OBJECT_NAME(fk.parent_object_id) AS child_table,
    COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS child_column,
    OBJECT_NAME(fk.referenced_object_id) AS parent_table
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
WHERE fk.name IN ('FK_pr_product', 'FK_pl_product')
ORDER BY fk.name;
GO

-- Verify FILESTREAM column
SELECT
    c.name AS column_name,
    t.name AS data_type,
    c.is_filestream
FROM sys.columns c
INNER JOIN sys.types t ON c.system_type_id = t.system_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.attachments')
  AND c.name = 'file_blob';
GO

PRINT '=== Phase 6 — Products + Sales + Compliance + Attachments: Script complete ===';
GO
