/*
  BeauxWorks — Phase 7: Website CMS / Product Content
  =====================================================
  Run AFTER 06-phase-6-products-sales.sql

  Light CMS layer for public-facing product listings.
  Separated from internal product data so public descriptions,
  images, pricing, and SEO fields can differ from operational records.

  Creates:
    1.  dbo.website_product_content   (public product listing info)
    2.  dbo.website_product_images    (image references per product)
  Then: indexes, triggers, views, seed data.

  Idempotent: IF NOT EXISTS / IF OBJECT_ID checks.
*/

SET QUOTED_IDENTIFIER ON;
GO

USE [BeauxWorks];
GO

------------------------------------------------------------------------
-- 1. TABLES
------------------------------------------------------------------------

-- 1.1 dbo.website_product_content
IF OBJECT_ID(N'dbo.website_product_content', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.website_product_content (
        website_product_content_id  uniqueidentifier  NOT NULL
            CONSTRAINT DF_wpc_pk DEFAULT NEWSEQUENTIALID(),
        product_id                  uniqueidentifier  NOT NULL,

        -- Public display fields (may differ from internal product record)
        slug                        nvarchar(200)     NOT NULL,
        public_name                 nvarchar(200)     NOT NULL,
        public_description          nvarchar(max)     NULL,
        short_description           nvarchar(500)     NULL,

        -- Pricing display
        display_price               decimal(18,2)     NULL,
        price_label                 nvarchar(100)     NULL,   -- e.g. "Starting at", "per bottle"

        -- Availability
        availability_status         nvarchar(50)      NOT NULL
            CONSTRAINT DF_wpc_avail DEFAULT 'in_stock',

        -- Publishing
        is_published                bit               NOT NULL
            CONSTRAINT DF_wpc_pub DEFAULT 0,
        is_featured                 bit               NOT NULL
            CONSTRAINT DF_wpc_feat DEFAULT 0,
        published_at                datetime2(7)      NULL,

        -- SEO
        meta_title                  nvarchar(200)     NULL,
        meta_description            nvarchar(500)     NULL,

        -- Ordering
        sort_order                  int               NOT NULL
            CONSTRAINT DF_wpc_sort DEFAULT 0,

        -- Audit
        created_at                  datetime2(7)      NOT NULL
            CONSTRAINT DF_wpc_created DEFAULT SYSUTCDATETIME(),
        updated_at                  datetime2(7)      NOT NULL
            CONSTRAINT DF_wpc_updated DEFAULT SYSUTCDATETIME(),
        is_deleted                  bit               NOT NULL
            CONSTRAINT DF_wpc_del DEFAULT 0,

        CONSTRAINT PK_wpc                  PRIMARY KEY CLUSTERED (website_product_content_id),
        CONSTRAINT FK_wpc_product          FOREIGN KEY (product_id)
                                           REFERENCES dbo.products (product_id),
        CONSTRAINT UQ_wpc_product          UNIQUE (product_id),
        CONSTRAINT UQ_wpc_slug             UNIQUE (slug),
        CONSTRAINT CK_wpc_availability     CHECK (availability_status IN (
            'in_stock', 'out_of_stock', 'coming_soon', 'seasonal', 'discontinued'
        ))
    );
    PRINT 'Created table dbo.website_product_content';
END
GO

-- 1.2 dbo.website_product_images
IF OBJECT_ID(N'dbo.website_product_images', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.website_product_images (
        website_product_image_id    uniqueidentifier  NOT NULL
            CONSTRAINT DF_wpi_pk DEFAULT NEWSEQUENTIALID(),
        website_product_content_id  uniqueidentifier  NOT NULL,

        -- Image source: either a FILESTREAM attachment or an external URL
        attachment_id               uniqueidentifier  NULL,
        image_url                   nvarchar(500)     NULL,

        alt_text                    nvarchar(300)     NULL,
        caption                     nvarchar(500)     NULL,
        is_primary                  bit               NOT NULL
            CONSTRAINT DF_wpi_primary DEFAULT 0,
        sort_order                  int               NOT NULL
            CONSTRAINT DF_wpi_sort DEFAULT 0,

        created_at                  datetime2(7)      NOT NULL
            CONSTRAINT DF_wpi_created DEFAULT SYSUTCDATETIME(),
        updated_at                  datetime2(7)      NOT NULL
            CONSTRAINT DF_wpi_updated DEFAULT SYSUTCDATETIME(),
        is_deleted                  bit               NOT NULL
            CONSTRAINT DF_wpi_del DEFAULT 0,

        CONSTRAINT PK_wpi                  PRIMARY KEY CLUSTERED (website_product_image_id),
        CONSTRAINT FK_wpi_content          FOREIGN KEY (website_product_content_id)
                                           REFERENCES dbo.website_product_content (website_product_content_id),
        CONSTRAINT FK_wpi_attachment       FOREIGN KEY (attachment_id)
                                           REFERENCES dbo.attachments (attachment_id),
        -- Must have at least one image source
        CONSTRAINT CK_wpi_source           CHECK (attachment_id IS NOT NULL OR image_url IS NOT NULL)
    );
    PRINT 'Created table dbo.website_product_images';
END
GO


------------------------------------------------------------------------
-- 2. INDEXES
------------------------------------------------------------------------

-- Published products for public listing queries
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wpc_published' AND object_id = OBJECT_ID(N'dbo.website_product_content'))
    CREATE NONCLUSTERED INDEX IX_wpc_published
        ON dbo.website_product_content (is_published, sort_order)
        INCLUDE (slug, public_name, short_description, display_price, availability_status, is_featured)
        WHERE is_published = 1 AND is_deleted = 0;
GO

-- Slug lookup (fast URL resolution)
-- Already covered by UQ_wpc_slug unique constraint

-- Featured products
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wpc_featured' AND object_id = OBJECT_ID(N'dbo.website_product_content'))
    CREATE NONCLUSTERED INDEX IX_wpc_featured
        ON dbo.website_product_content (is_featured)
        WHERE is_featured = 1 AND is_published = 1 AND is_deleted = 0;
GO

-- Images by content (for joining)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wpi_content' AND object_id = OBJECT_ID(N'dbo.website_product_images'))
    CREATE NONCLUSTERED INDEX IX_wpi_content
        ON dbo.website_product_images (website_product_content_id, sort_order)
        INCLUDE (attachment_id, image_url, alt_text, is_primary)
        WHERE is_deleted = 0;
GO


------------------------------------------------------------------------
-- 3. TRIGGERS (updated_at)
------------------------------------------------------------------------

CREATE OR ALTER TRIGGER dbo.TR_wpc_updated_at
ON dbo.website_product_content AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.website_product_content t INNER JOIN inserted i ON t.website_product_content_id = i.website_product_content_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_wpi_updated_at
ON dbo.website_product_images AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.website_product_images t INNER JOIN inserted i ON t.website_product_image_id = i.website_product_image_id;
END;
GO


------------------------------------------------------------------------
-- 4. VIEWS
------------------------------------------------------------------------

-- 4.1 Public product listing (what the website API serves)
CREATE OR ALTER VIEW dbo.vw_website_product_listing
AS
SELECT
    wpc.website_product_content_id,
    wpc.product_id,
    wpc.slug,
    wpc.public_name,
    wpc.short_description,
    wpc.display_price,
    wpc.price_label,
    wpc.availability_status,
    wpc.is_featured,
    wpc.sort_order,
    wpc.meta_title,
    wpc.meta_description,
    wpc.published_at,
    pt.code                     AS product_type_code,
    pt.name                     AS product_type_name,
    pc.name                     AS product_category_name,
    -- Primary image
    pi_img.image_url            AS primary_image_url,
    pi_img.attachment_id        AS primary_image_attachment_id,
    pi_img.alt_text             AS primary_image_alt,
    -- Image count
    (SELECT COUNT(*) FROM dbo.website_product_images wpi2
     WHERE wpi2.website_product_content_id = wpc.website_product_content_id
       AND wpi2.is_deleted = 0
    ) AS image_count
FROM dbo.website_product_content wpc
INNER JOIN dbo.products p          ON wpc.product_id        = p.product_id
INNER JOIN dbo.product_types pt    ON p.product_type_id     = pt.product_type_id
LEFT JOIN  dbo.product_categories pc ON p.product_category_id = pc.product_category_id
LEFT JOIN  dbo.website_product_images pi_img
    ON pi_img.website_product_content_id = wpc.website_product_content_id
    AND pi_img.is_primary = 1 AND pi_img.is_deleted = 0
WHERE wpc.is_published = 1
  AND wpc.is_deleted = 0
  AND p.is_deleted = 0;
GO

-- 4.2 Product detail (full content for product page)
CREATE OR ALTER VIEW dbo.vw_website_product_detail
AS
SELECT
    wpc.website_product_content_id,
    wpc.product_id,
    wpc.slug,
    wpc.public_name,
    wpc.public_description,
    wpc.short_description,
    wpc.display_price,
    wpc.price_label,
    wpc.availability_status,
    wpc.is_featured,
    wpc.meta_title,
    wpc.meta_description,
    wpc.published_at,
    pt.code                     AS product_type_code,
    pt.name                     AS product_type_name,
    pc.name                     AS product_category_name,
    p.sku
FROM dbo.website_product_content wpc
INNER JOIN dbo.products p          ON wpc.product_id        = p.product_id
INNER JOIN dbo.product_types pt    ON p.product_type_id     = pt.product_type_id
LEFT JOIN  dbo.product_categories pc ON p.product_category_id = pc.product_category_id
WHERE wpc.is_deleted = 0 AND p.is_deleted = 0;
GO

PRINT 'Views created (vw_website_product_listing, vw_website_product_detail).';
GO


------------------------------------------------------------------------
-- 5. SEED / DEMO DATA
------------------------------------------------------------------------

DECLARE @prod_id uniqueidentifier;
SELECT @prod_id = product_id FROM dbo.products WHERE name = N'Beaux''s Signature Hot Sauce — 5 oz Bottle';

IF @prod_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.website_product_content WHERE product_id = @prod_id)
BEGIN
    PRINT '';
    PRINT '=== DEMO: Website Product Content ===';

    DECLARE @wpc_id uniqueidentifier = NEWID();

    INSERT INTO dbo.website_product_content (
        website_product_content_id, product_id,
        slug, public_name, public_description, short_description,
        display_price, price_label,
        availability_status, is_published, is_featured, published_at,
        meta_title, meta_description, sort_order
    ) VALUES (
        @wpc_id, @prod_id,
        'beauxs-signature-hot-sauce',
        N'Beaux''s Signature Hot Sauce',
        N'Our flagship habanero hot sauce — bold, bright, and unapologetically hot. ' +
        N'Made with fresh Georgia-grown habanero peppers, garlic, onion, and a splash of lime. ' +
        N'Slow-cooked and hand-bottled in small batches at Beaux''s Bistro.' + CHAR(13) + CHAR(10) +
        CHAR(13) + CHAR(10) +
        N'**Heat Level:** 🔥🔥🔥🔥 (Hot)' + CHAR(13) + CHAR(10) +
        N'**Pairs with:** Wings, tacos, eggs, pizza, everything.' + CHAR(13) + CHAR(10) +
        N'**Ingredients:** Habanero peppers, white distilled vinegar, yellow onion, garlic, ' +
        N'lime juice, kosher salt, brown sugar, ground cumin.',
        N'Bold habanero hot sauce. Small-batch. Georgia-grown peppers.',
        8.99, 'per bottle',
        'in_stock', 1, 1, SYSUTCDATETIME(),
        N'Beaux''s Signature Hot Sauce | Beaux''s Bistro',
        N'Our flagship habanero hot sauce — bold, bright, and unapologetically hot. Made with fresh Georgia-grown peppers.',
        10
    );
    PRINT '  1. Website content created (published, featured)';

    -- Add a placeholder image (external URL — real images uploaded later via FILESTREAM)
    INSERT INTO dbo.website_product_images (
        website_product_content_id, image_url, alt_text, caption, is_primary, sort_order
    ) VALUES (
        @wpc_id,
        '/images/products/beauxs-signature-hot-sauce-hero.jpg',
        N'Beaux''s Signature Hot Sauce — 5 oz woozy bottle',
        N'Hand-bottled at Beaux''s Bistro',
        1, 10
    );
    PRINT '  2. Primary image placeholder added';

    -- Add a second image
    INSERT INTO dbo.website_product_images (
        website_product_content_id, image_url, alt_text, caption, is_primary, sort_order
    ) VALUES (
        @wpc_id,
        '/images/products/beauxs-signature-hot-sauce-ingredients.jpg',
        N'Fresh habaneros and ingredients for Beaux''s hot sauce',
        N'Georgia-grown habaneros',
        0, 20
    );
    PRINT '  3. Secondary image placeholder added';

    -- Show results
    PRINT '';
    PRINT '--- Public product listing ---';
    SELECT slug, public_name, short_description, display_price, price_label,
           availability_status, is_featured, product_type_name, product_category_name,
           primary_image_url, primary_image_alt, image_count
    FROM dbo.vw_website_product_listing
    WHERE slug = 'beauxs-signature-hot-sauce';

    PRINT '';
    PRINT '--- Product detail ---';
    SELECT slug, public_name, availability_status, sku, meta_title
    FROM dbo.vw_website_product_detail
    WHERE slug = 'beauxs-signature-hot-sauce';

    PRINT '';
    PRINT '=== DEMO Complete ===';
END
ELSE
BEGIN
    PRINT 'Demo data already exists or product not found — skipping.';
END
GO


------------------------------------------------------------------------
-- 6. VERIFICATION
------------------------------------------------------------------------

SELECT
    s.name AS [schema],
    t.name AS [table],
    t.create_date
FROM sys.tables t
INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = 'dbo'
  AND t.name IN ('website_product_content', 'website_product_images')
ORDER BY t.name;
GO

PRINT '=== Phase 7 — Website CMS / Product Content: Script complete ===';
GO
