/*
  BeauxWorks — Phase 5: Inventory + Ingredient Lot Genealogy
  ===========================================================
  Run AFTER 04-phase-4-production-runs.sql

  Creates (in dependency order):
    1.  dbo.suppliers
    2.  dbo.ingredient_inventory        (materialized stock per ingredient per facility)
    3.  dbo.ingredient_lots             (received lots with supplier + expiry)
    4.  dbo.inventory_transactions      (ledger: purchase/usage/waste/adjustment)
    5.  dbo.production_run_ingredient_consumption  (lot-level consumption per run)
    6.  dbo.product_lots                (finished goods lots — product_id FK deferred to Phase 6)
  Then: indexes, triggers, recall queries, verification view, demo.

  Signed-quantity convention:
    inventory_transactions.quantity is SIGNED.
      Positive = stock IN  (purchase, adjustment_in)
      Negative = stock OUT (usage, waste, adjustment_out)
    ingredient_inventory.quantity_on_hand is maintained by application logic.
    A verification view computes expected stock from the ledger.

  Idempotent: IF NOT EXISTS / IF OBJECT_ID checks.
*/

SET QUOTED_IDENTIFIER ON;
GO

USE [BeauxWorks];
GO

------------------------------------------------------------------------
-- 1. TABLES
------------------------------------------------------------------------

-- 1.1 dbo.suppliers
IF OBJECT_ID(N'dbo.suppliers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.suppliers (
        supplier_id    uniqueidentifier  NOT NULL
                       CONSTRAINT DF_sup_pk DEFAULT NEWSEQUENTIALID(),
        name           nvarchar(200)     NOT NULL,
        contact_name   nvarchar(200)     NULL,
        contact_email  nvarchar(320)     NULL,
        contact_phone  nvarchar(50)      NULL,
        address        nvarchar(500)     NULL,
        notes          nvarchar(max)     NULL,
        is_active      bit               NOT NULL
                       CONSTRAINT DF_sup_active DEFAULT 1,
        created_at     datetime2(7)      NOT NULL
                       CONSTRAINT DF_sup_created DEFAULT SYSUTCDATETIME(),
        updated_at     datetime2(7)      NOT NULL
                       CONSTRAINT DF_sup_updated DEFAULT SYSUTCDATETIME(),
        is_deleted     bit               NOT NULL
                       CONSTRAINT DF_sup_del DEFAULT 0,

        CONSTRAINT PK_suppliers      PRIMARY KEY CLUSTERED (supplier_id),
        CONSTRAINT UQ_suppliers_name UNIQUE (name)
    );
    PRINT 'Created table dbo.suppliers';
END
GO

-- 1.2 dbo.ingredient_inventory (materialized stock per ingredient per facility)
IF OBJECT_ID(N'dbo.ingredient_inventory', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ingredient_inventory (
        ingredient_inventory_id  uniqueidentifier  NOT NULL
                                 CONSTRAINT DF_ii_pk DEFAULT NEWSEQUENTIALID(),
        ingredient_id            uniqueidentifier  NOT NULL,
        facility_id              uniqueidentifier  NOT NULL,
        quantity_on_hand         decimal(18,6)     NOT NULL
                                 CONSTRAINT DF_ii_qty DEFAULT 0,
        unit_id                  uniqueidentifier  NOT NULL,
        low_stock_threshold      decimal(18,6)     NULL,
        created_at               datetime2(7)      NOT NULL
                                 CONSTRAINT DF_ii_created DEFAULT SYSUTCDATETIME(),
        updated_at               datetime2(7)      NOT NULL
                                 CONSTRAINT DF_ii_updated DEFAULT SYSUTCDATETIME(),
        is_deleted               bit               NOT NULL
                                 CONSTRAINT DF_ii_del DEFAULT 0,

        CONSTRAINT PK_ingredient_inventory       PRIMARY KEY CLUSTERED (ingredient_inventory_id),
        CONSTRAINT FK_ii_ingredient              FOREIGN KEY (ingredient_id)
                                                 REFERENCES dbo.ingredients (ingredient_id),
        CONSTRAINT FK_ii_facility                FOREIGN KEY (facility_id)
                                                 REFERENCES dbo.facilities (facility_id),
        CONSTRAINT FK_ii_unit                    FOREIGN KEY (unit_id)
                                                 REFERENCES dbo.units (unit_id),
        CONSTRAINT UQ_ii_ingredient_facility     UNIQUE (ingredient_id, facility_id)
    );
    PRINT 'Created table dbo.ingredient_inventory';
END
GO

-- 1.3 dbo.ingredient_lots (received lots)
IF OBJECT_ID(N'dbo.ingredient_lots', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ingredient_lots (
        ingredient_lot_id    uniqueidentifier  NOT NULL
                             CONSTRAINT DF_il_pk DEFAULT NEWSEQUENTIALID(),
        ingredient_id        uniqueidentifier  NOT NULL,
        facility_id          uniqueidentifier  NOT NULL,
        supplier_id          uniqueidentifier  NULL,
        lot_number           nvarchar(100)     NOT NULL,
        received_at          datetime2(7)      NOT NULL
                             CONSTRAINT DF_il_received DEFAULT SYSUTCDATETIME(),
        expires_at           datetime2(7)      NULL,
        quantity_received    decimal(18,6)     NOT NULL,
        unit_id              uniqueidentifier  NOT NULL,
        notes                nvarchar(max)     NULL,
        created_at           datetime2(7)      NOT NULL
                             CONSTRAINT DF_il_created DEFAULT SYSUTCDATETIME(),
        updated_at           datetime2(7)      NOT NULL
                             CONSTRAINT DF_il_updated DEFAULT SYSUTCDATETIME(),
        is_deleted           bit               NOT NULL
                             CONSTRAINT DF_il_del DEFAULT 0,

        CONSTRAINT PK_ingredient_lots        PRIMARY KEY CLUSTERED (ingredient_lot_id),
        CONSTRAINT FK_il_ingredient          FOREIGN KEY (ingredient_id)
                                             REFERENCES dbo.ingredients (ingredient_id),
        CONSTRAINT FK_il_facility            FOREIGN KEY (facility_id)
                                             REFERENCES dbo.facilities (facility_id),
        CONSTRAINT FK_il_supplier            FOREIGN KEY (supplier_id)
                                             REFERENCES dbo.suppliers (supplier_id),
        CONSTRAINT FK_il_unit                FOREIGN KEY (unit_id)
                                             REFERENCES dbo.units (unit_id)
    );
    PRINT 'Created table dbo.ingredient_lots';
END
GO

-- 1.4 dbo.inventory_transactions (ledger)
IF OBJECT_ID(N'dbo.inventory_transactions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.inventory_transactions (
        inventory_transaction_id  uniqueidentifier  NOT NULL
                                  CONSTRAINT DF_it_pk DEFAULT NEWSEQUENTIALID(),
        ingredient_id             uniqueidentifier  NOT NULL,
        facility_id               uniqueidentifier  NOT NULL,
        ingredient_lot_id         uniqueidentifier  NULL,
        production_run_id         uniqueidentifier  NULL,
        transaction_type          nvarchar(50)      NOT NULL,
        quantity                  decimal(18,6)     NOT NULL,   -- SIGNED: + = in, - = out
        unit_id                   uniqueidentifier  NOT NULL,
        reference_notes           nvarchar(500)     NULL,
        transacted_at             datetime2(7)      NOT NULL
                                  CONSTRAINT DF_it_at DEFAULT SYSUTCDATETIME(),
        transacted_by_user_id     uniqueidentifier  NULL,
        created_at                datetime2(7)      NOT NULL
                                  CONSTRAINT DF_it_created DEFAULT SYSUTCDATETIME(),
        updated_at                datetime2(7)      NOT NULL
                                  CONSTRAINT DF_it_updated DEFAULT SYSUTCDATETIME(),
        is_deleted                bit               NOT NULL
                                  CONSTRAINT DF_it_del DEFAULT 0,

        CONSTRAINT PK_inventory_transactions     PRIMARY KEY CLUSTERED (inventory_transaction_id),
        CONSTRAINT FK_it_ingredient              FOREIGN KEY (ingredient_id)
                                                 REFERENCES dbo.ingredients (ingredient_id),
        CONSTRAINT FK_it_facility                FOREIGN KEY (facility_id)
                                                 REFERENCES dbo.facilities (facility_id),
        CONSTRAINT FK_it_lot                     FOREIGN KEY (ingredient_lot_id)
                                                 REFERENCES dbo.ingredient_lots (ingredient_lot_id),
        CONSTRAINT FK_it_run                     FOREIGN KEY (production_run_id)
                                                 REFERENCES dbo.production_runs (production_run_id),
        CONSTRAINT FK_it_unit                    FOREIGN KEY (unit_id)
                                                 REFERENCES dbo.units (unit_id),
        CONSTRAINT FK_it_user                    FOREIGN KEY (transacted_by_user_id)
                                                 REFERENCES dbo.users (user_id),
        CONSTRAINT CK_it_type                    CHECK (transaction_type IN (
            'purchase', 'usage', 'waste', 'adjustment_in', 'adjustment_out'
        ))
    );
    PRINT 'Created table dbo.inventory_transactions';
END
GO

-- 1.5 dbo.production_run_ingredient_consumption (lot-level traceability)
IF OBJECT_ID(N'dbo.production_run_ingredient_consumption', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.production_run_ingredient_consumption (
        production_run_ingredient_consumption_id  uniqueidentifier  NOT NULL
            CONSTRAINT DF_pric_pk DEFAULT NEWSEQUENTIALID(),
        production_run_id    uniqueidentifier  NOT NULL,
        ingredient_lot_id    uniqueidentifier  NOT NULL,
        quantity_used        decimal(18,6)     NOT NULL,
        unit_id              uniqueidentifier  NOT NULL,
        consumed_at          datetime2(7)      NOT NULL
                             CONSTRAINT DF_pric_consumed DEFAULT SYSUTCDATETIME(),
        notes                nvarchar(max)     NULL,
        created_at           datetime2(7)      NOT NULL
                             CONSTRAINT DF_pric_created DEFAULT SYSUTCDATETIME(),
        updated_at           datetime2(7)      NOT NULL
                             CONSTRAINT DF_pric_updated DEFAULT SYSUTCDATETIME(),
        is_deleted           bit               NOT NULL
                             CONSTRAINT DF_pric_del DEFAULT 0,

        CONSTRAINT PK_pric                   PRIMARY KEY CLUSTERED (production_run_ingredient_consumption_id),
        CONSTRAINT FK_pric_run               FOREIGN KEY (production_run_id)
                                             REFERENCES dbo.production_runs (production_run_id),
        CONSTRAINT FK_pric_lot               FOREIGN KEY (ingredient_lot_id)
                                             REFERENCES dbo.ingredient_lots (ingredient_lot_id),
        CONSTRAINT FK_pric_unit              FOREIGN KEY (unit_id)
                                             REFERENCES dbo.units (unit_id)
    );
    PRINT 'Created table dbo.production_run_ingredient_consumption';
END
GO

-- 1.6 dbo.product_lots (finished goods lots)
--     product_id FK deferred to Phase 6 when dbo.products is created.
IF OBJECT_ID(N'dbo.product_lots', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.product_lots (
        product_lot_id       uniqueidentifier  NOT NULL
                             CONSTRAINT DF_pl_pk DEFAULT NEWSEQUENTIALID(),
        product_id           uniqueidentifier  NULL,    -- FK added in Phase 6
        production_run_id    uniqueidentifier  NOT NULL,
        facility_id          uniqueidentifier  NOT NULL,
        lot_code             nvarchar(64)      NOT NULL,
        quantity_produced    decimal(18,6)     NOT NULL,
        unit_id              uniqueidentifier  NOT NULL,
        produced_at          datetime2(7)      NOT NULL
                             CONSTRAINT DF_pl_produced DEFAULT SYSUTCDATETIME(),
        created_at           datetime2(7)      NOT NULL
                             CONSTRAINT DF_pl_created DEFAULT SYSUTCDATETIME(),
        updated_at           datetime2(7)      NOT NULL
                             CONSTRAINT DF_pl_updated DEFAULT SYSUTCDATETIME(),
        is_deleted           bit               NOT NULL
                             CONSTRAINT DF_pl_del DEFAULT 0,

        CONSTRAINT PK_product_lots           PRIMARY KEY CLUSTERED (product_lot_id),
        CONSTRAINT FK_pl_run                 FOREIGN KEY (production_run_id)
                                             REFERENCES dbo.production_runs (production_run_id),
        CONSTRAINT FK_pl_facility            FOREIGN KEY (facility_id)
                                             REFERENCES dbo.facilities (facility_id),
        CONSTRAINT FK_pl_unit                FOREIGN KEY (unit_id)
                                             REFERENCES dbo.units (unit_id)
    );
    PRINT 'Created table dbo.product_lots';
END
GO


------------------------------------------------------------------------
-- 2. INDEXES
------------------------------------------------------------------------

-- suppliers
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_sup_name' AND object_id = OBJECT_ID(N'dbo.suppliers'))
    CREATE NONCLUSTERED INDEX IX_sup_name ON dbo.suppliers (name) WHERE is_deleted = 0;
GO

-- ingredient_inventory
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ii_ingredient' AND object_id = OBJECT_ID(N'dbo.ingredient_inventory'))
    CREATE NONCLUSTERED INDEX IX_ii_ingredient
        ON dbo.ingredient_inventory (ingredient_id)
        INCLUDE (facility_id, quantity_on_hand, unit_id)
        WHERE is_deleted = 0;
GO

-- ingredient_lots
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_il_ingredient' AND object_id = OBJECT_ID(N'dbo.ingredient_lots'))
    CREATE NONCLUSTERED INDEX IX_il_ingredient
        ON dbo.ingredient_lots (ingredient_id) WHERE is_deleted = 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_il_lot_number' AND object_id = OBJECT_ID(N'dbo.ingredient_lots'))
    CREATE NONCLUSTERED INDEX IX_il_lot_number
        ON dbo.ingredient_lots (lot_number) WHERE is_deleted = 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_il_supplier' AND object_id = OBJECT_ID(N'dbo.ingredient_lots'))
    CREATE NONCLUSTERED INDEX IX_il_supplier
        ON dbo.ingredient_lots (supplier_id) WHERE is_deleted = 0 AND supplier_id IS NOT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_il_expires' AND object_id = OBJECT_ID(N'dbo.ingredient_lots'))
    CREATE NONCLUSTERED INDEX IX_il_expires
        ON dbo.ingredient_lots (expires_at)
        INCLUDE (ingredient_id, lot_number)
        WHERE is_deleted = 0 AND expires_at IS NOT NULL;
GO

-- inventory_transactions
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_it_ingredient_facility' AND object_id = OBJECT_ID(N'dbo.inventory_transactions'))
    CREATE NONCLUSTERED INDEX IX_it_ingredient_facility
        ON dbo.inventory_transactions (ingredient_id, facility_id, transacted_at)
        WHERE is_deleted = 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_it_run' AND object_id = OBJECT_ID(N'dbo.inventory_transactions'))
    CREATE NONCLUSTERED INDEX IX_it_run
        ON dbo.inventory_transactions (production_run_id)
        WHERE is_deleted = 0 AND production_run_id IS NOT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_it_lot' AND object_id = OBJECT_ID(N'dbo.inventory_transactions'))
    CREATE NONCLUSTERED INDEX IX_it_lot
        ON dbo.inventory_transactions (ingredient_lot_id)
        WHERE is_deleted = 0 AND ingredient_lot_id IS NOT NULL;
GO

-- production_run_ingredient_consumption
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_pric_run' AND object_id = OBJECT_ID(N'dbo.production_run_ingredient_consumption'))
    CREATE NONCLUSTERED INDEX IX_pric_run
        ON dbo.production_run_ingredient_consumption (production_run_id) WHERE is_deleted = 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_pric_lot' AND object_id = OBJECT_ID(N'dbo.production_run_ingredient_consumption'))
    CREATE NONCLUSTERED INDEX IX_pric_lot
        ON dbo.production_run_ingredient_consumption (ingredient_lot_id) WHERE is_deleted = 0;
GO

-- product_lots
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_pl_run' AND object_id = OBJECT_ID(N'dbo.product_lots'))
    CREATE NONCLUSTERED INDEX IX_pl_run
        ON dbo.product_lots (production_run_id) WHERE is_deleted = 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_pl_lot_code' AND object_id = OBJECT_ID(N'dbo.product_lots'))
    CREATE NONCLUSTERED INDEX IX_pl_lot_code
        ON dbo.product_lots (lot_code) WHERE is_deleted = 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_pl_product' AND object_id = OBJECT_ID(N'dbo.product_lots'))
    CREATE NONCLUSTERED INDEX IX_pl_product
        ON dbo.product_lots (product_id) WHERE is_deleted = 0 AND product_id IS NOT NULL;
GO


------------------------------------------------------------------------
-- 3. TRIGGERS (updated_at)
------------------------------------------------------------------------

CREATE OR ALTER TRIGGER dbo.TR_suppliers_updated_at
ON dbo.suppliers AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.suppliers t INNER JOIN inserted i ON t.supplier_id = i.supplier_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_ii_updated_at
ON dbo.ingredient_inventory AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.ingredient_inventory t INNER JOIN inserted i ON t.ingredient_inventory_id = i.ingredient_inventory_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_il_updated_at
ON dbo.ingredient_lots AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.ingredient_lots t INNER JOIN inserted i ON t.ingredient_lot_id = i.ingredient_lot_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_it_updated_at
ON dbo.inventory_transactions AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.inventory_transactions t INNER JOIN inserted i ON t.inventory_transaction_id = i.inventory_transaction_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_pric_updated_at
ON dbo.production_run_ingredient_consumption AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.production_run_ingredient_consumption t INNER JOIN inserted i ON t.production_run_ingredient_consumption_id = i.production_run_ingredient_consumption_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_pl_updated_at
ON dbo.product_lots AFTER UPDATE AS BEGIN
    SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSUTCDATETIME()
    FROM dbo.product_lots t INNER JOIN inserted i ON t.product_lot_id = i.product_lot_id;
END;
GO


------------------------------------------------------------------------
-- 4. VIEWS
------------------------------------------------------------------------

-- 4.1 Computed stock from ledger (verification against materialized inventory)
CREATE OR ALTER VIEW dbo.vw_inventory_computed
AS
SELECT
    it.ingredient_id,
    ing.name                 AS ingredient_name,
    it.facility_id,
    f.name                   AS facility_name,
    it.unit_id,
    u.abbreviation           AS unit_abbrev,
    SUM(it.quantity)         AS computed_on_hand,
    COUNT(*)                 AS transaction_count
FROM dbo.inventory_transactions it
INNER JOIN dbo.ingredients ing ON it.ingredient_id = ing.ingredient_id
INNER JOIN dbo.facilities f    ON it.facility_id   = f.facility_id
INNER JOIN dbo.units u         ON it.unit_id       = u.unit_id
WHERE it.is_deleted = 0
GROUP BY it.ingredient_id, ing.name, it.facility_id, f.name, it.unit_id, u.abbreviation;
GO

-- 4.2 Inventory status with low-stock flag
CREATE OR ALTER VIEW dbo.vw_inventory_status
AS
SELECT
    ii.ingredient_inventory_id,
    ii.ingredient_id,
    ing.name                    AS ingredient_name,
    ii.facility_id,
    f.name                      AS facility_name,
    ii.quantity_on_hand,
    u.abbreviation              AS unit_abbrev,
    ii.low_stock_threshold,
    CASE
        WHEN ii.low_stock_threshold IS NOT NULL
             AND ii.quantity_on_hand <= ii.low_stock_threshold
        THEN 1 ELSE 0
    END AS is_low_stock
FROM dbo.ingredient_inventory ii
INNER JOIN dbo.ingredients ing ON ii.ingredient_id = ing.ingredient_id
INNER JOIN dbo.facilities f    ON ii.facility_id   = f.facility_id
INNER JOIN dbo.units u         ON ii.unit_id       = u.unit_id
WHERE ii.is_deleted = 0;
GO

-- 4.3 Lot genealogy: ingredient lot → runs → product lots
CREATE OR ALTER VIEW dbo.vw_lot_genealogy
AS
SELECT
    il.ingredient_lot_id,
    il.lot_number               AS ingredient_lot_number,
    ing.name                    AS ingredient_name,
    s.name                      AS supplier_name,
    il.received_at,
    il.expires_at,
    pric.production_run_id,
    pr.lot_code                 AS run_lot_code,
    pric.quantity_used,
    u_used.abbreviation         AS quantity_used_unit,
    pric.consumed_at,
    pl.product_lot_id,
    pl.lot_code                 AS product_lot_code,
    pl.quantity_produced,
    u_prod.abbreviation         AS quantity_produced_unit,
    pl.produced_at
FROM dbo.ingredient_lots il
INNER JOIN dbo.ingredients ing ON il.ingredient_id = ing.ingredient_id
LEFT JOIN  dbo.suppliers s     ON il.supplier_id   = s.supplier_id
LEFT JOIN  dbo.production_run_ingredient_consumption pric
    ON pric.ingredient_lot_id = il.ingredient_lot_id AND pric.is_deleted = 0
LEFT JOIN  dbo.production_runs pr
    ON pric.production_run_id = pr.production_run_id AND pr.is_deleted = 0
LEFT JOIN  dbo.product_lots pl
    ON pl.production_run_id = pr.production_run_id AND pl.is_deleted = 0
LEFT JOIN  dbo.units u_used ON pric.unit_id = u_used.unit_id
LEFT JOIN  dbo.units u_prod ON pl.unit_id   = u_prod.unit_id
WHERE il.is_deleted = 0;
GO

PRINT 'Views created (vw_inventory_computed, vw_inventory_status, vw_lot_genealogy).';
GO


------------------------------------------------------------------------
-- 5. RECALL TRACEABILITY STORED PROCEDURES
------------------------------------------------------------------------

-- 5.1 Given a finished goods lot_code, list ingredient lots consumed
CREATE OR ALTER PROCEDURE dbo.sp_recall_by_product_lot
    @product_lot_code nvarchar(64)
AS
BEGIN
    SET NOCOUNT ON;

    -- Find the product lot and its production run
    DECLARE @run_id uniqueidentifier;
    SELECT @run_id = pl.production_run_id
    FROM dbo.product_lots pl
    WHERE pl.lot_code = @product_lot_code AND pl.is_deleted = 0;

    IF @run_id IS NULL
    BEGIN
        RAISERROR('Product lot code not found.', 16, 1);
        RETURN 1;
    END

    -- Result 1: Product lot info
    SELECT
        pl.product_lot_id, pl.lot_code, pl.quantity_produced,
        u.abbreviation AS unit, pl.produced_at,
        pr.lot_code AS run_lot_code, pr.production_run_id
    FROM dbo.product_lots pl
    INNER JOIN dbo.production_runs pr ON pl.production_run_id = pr.production_run_id
    INNER JOIN dbo.units u ON pl.unit_id = u.unit_id
    WHERE pl.lot_code = @product_lot_code AND pl.is_deleted = 0;

    -- Result 2: Ingredient lots consumed in that run
    SELECT
        pric.ingredient_lot_id,
        il.lot_number        AS ingredient_lot_number,
        ing.name             AS ingredient_name,
        s.name               AS supplier_name,
        pric.quantity_used,
        u.abbreviation       AS unit,
        il.received_at,
        il.expires_at
    FROM dbo.production_run_ingredient_consumption pric
    INNER JOIN dbo.ingredient_lots il ON pric.ingredient_lot_id = il.ingredient_lot_id
    INNER JOIN dbo.ingredients ing    ON il.ingredient_id       = ing.ingredient_id
    LEFT JOIN  dbo.suppliers s        ON il.supplier_id         = s.supplier_id
    INNER JOIN dbo.units u            ON pric.unit_id           = u.unit_id
    WHERE pric.production_run_id = @run_id AND pric.is_deleted = 0
    ORDER BY ing.name;

    -- Result 3: Distribution records for that run
    SELECT
        dist.distributed_at,
        sc.name             AS channel,
        dist.customer_name,
        dist.location,
        dist.quantity,
        u.abbreviation      AS unit,
        dist.notes
    FROM dbo.production_run_distribution dist
    LEFT JOIN dbo.sales_channels sc ON dist.channel_id = sc.sales_channel_id
    INNER JOIN dbo.units u          ON dist.unit_id    = u.unit_id
    WHERE dist.production_run_id = @run_id AND dist.is_deleted = 0
    ORDER BY dist.distributed_at;

    RETURN 0;
END;
GO

-- 5.2 Given an ingredient lot_number, list all affected runs and product lots
CREATE OR ALTER PROCEDURE dbo.sp_recall_by_ingredient_lot
    @ingredient_lot_number nvarchar(100)
AS
BEGIN
    SET NOCOUNT ON;

    -- Result 1: Ingredient lot info
    SELECT
        il.ingredient_lot_id, il.lot_number, ing.name AS ingredient_name,
        s.name AS supplier_name, il.received_at, il.expires_at,
        il.quantity_received, u.abbreviation AS unit
    FROM dbo.ingredient_lots il
    INNER JOIN dbo.ingredients ing ON il.ingredient_id = ing.ingredient_id
    LEFT JOIN  dbo.suppliers s     ON il.supplier_id   = s.supplier_id
    INNER JOIN dbo.units u         ON il.unit_id       = u.unit_id
    WHERE il.lot_number = @ingredient_lot_number AND il.is_deleted = 0;

    -- Result 2: All production runs that consumed this lot
    SELECT
        pric.production_run_id,
        pr.lot_code          AS run_lot_code,
        r.name               AS recipe_name,
        rs.code              AS run_status,
        pr.started_at,
        pr.completed_at,
        pric.quantity_used,
        u.abbreviation       AS unit
    FROM dbo.production_run_ingredient_consumption pric
    INNER JOIN dbo.ingredient_lots il  ON pric.ingredient_lot_id = il.ingredient_lot_id
    INNER JOIN dbo.production_runs pr  ON pric.production_run_id = pr.production_run_id
    INNER JOIN dbo.recipe_versions rv  ON pr.recipe_version_id   = rv.recipe_version_id
    INNER JOIN dbo.recipes r           ON rv.recipe_id           = r.recipe_id
    INNER JOIN dbo.run_statuses rs     ON pr.run_status_id       = rs.run_status_id
    INNER JOIN dbo.units u             ON pric.unit_id           = u.unit_id
    WHERE il.lot_number = @ingredient_lot_number
      AND pric.is_deleted = 0 AND il.is_deleted = 0
    ORDER BY pr.started_at;

    -- Result 3: Product lots from those runs
    SELECT
        pl.product_lot_id,
        pl.lot_code          AS product_lot_code,
        pl.quantity_produced,
        u.abbreviation       AS unit,
        pl.produced_at,
        pr.lot_code          AS run_lot_code
    FROM dbo.product_lots pl
    INNER JOIN dbo.production_runs pr ON pl.production_run_id = pr.production_run_id
    INNER JOIN dbo.units u            ON pl.unit_id           = u.unit_id
    WHERE pl.production_run_id IN (
        SELECT pric2.production_run_id
        FROM dbo.production_run_ingredient_consumption pric2
        INNER JOIN dbo.ingredient_lots il2 ON pric2.ingredient_lot_id = il2.ingredient_lot_id
        WHERE il2.lot_number = @ingredient_lot_number
          AND pric2.is_deleted = 0 AND il2.is_deleted = 0
    )
    AND pl.is_deleted = 0
    ORDER BY pl.produced_at;

    -- Result 4: Distribution records from those runs
    SELECT
        dist.production_run_distribution_id,
        pr.lot_code          AS run_lot_code,
        dist.distributed_at,
        sc.name              AS channel,
        dist.customer_name,
        dist.location,
        dist.quantity,
        u.abbreviation       AS unit
    FROM dbo.production_run_distribution dist
    INNER JOIN dbo.production_runs pr  ON dist.production_run_id = pr.production_run_id
    LEFT JOIN  dbo.sales_channels sc   ON dist.channel_id        = sc.sales_channel_id
    INNER JOIN dbo.units u             ON dist.unit_id           = u.unit_id
    WHERE dist.production_run_id IN (
        SELECT pric3.production_run_id
        FROM dbo.production_run_ingredient_consumption pric3
        INNER JOIN dbo.ingredient_lots il3 ON pric3.ingredient_lot_id = il3.ingredient_lot_id
        WHERE il3.lot_number = @ingredient_lot_number
          AND pric3.is_deleted = 0 AND il3.is_deleted = 0
    )
    AND dist.is_deleted = 0
    ORDER BY dist.distributed_at;

    RETURN 0;
END;
GO

PRINT 'Recall stored procedures created (sp_recall_by_product_lot, sp_recall_by_ingredient_lot).';
GO


------------------------------------------------------------------------
-- 6. DEMO: Purchase → Usage → Lot Genealogy
------------------------------------------------------------------------

DECLARE @demo_user   uniqueidentifier = (SELECT user_id     FROM dbo.users      WHERE email = 'demo@beauxbistro.local');
DECLARE @facility    uniqueidentifier = (SELECT facility_id  FROM dbo.facilities WHERE code = 'MAIN');
DECLARE @demo_run_id uniqueidentifier = (SELECT production_run_id FROM dbo.production_runs WHERE lot_code = 'HS-20260208-001');
DECLARE @lb_id       uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'lb');
DECLARE @cup_id      uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'cup');
DECLARE @gal_id      uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'gal');
DECLARE @ea_id       uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'ea');
DECLARE @tsp_id      uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'tsp');
DECLARE @tbsp_id     uniqueidentifier = (SELECT unit_id FROM dbo.units WHERE abbreviation = 'Tbsp');

IF @demo_run_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.suppliers WHERE name = 'Peach State Peppers')
BEGIN
    PRINT '';
    PRINT '=== DEMO: Inventory Purchase → Usage → Lot Genealogy ===';

    -- Step 1: Create supplier
    DECLARE @sup_id uniqueidentifier = NEWID();
    INSERT INTO dbo.suppliers (supplier_id, name, contact_name, notes)
    VALUES (@sup_id, 'Peach State Peppers', 'Mike Grower', 'Local habanero farm, GA');
    PRINT '  1. Supplier created: Peach State Peppers';

    -- Step 2: Receive habanero lot
    DECLARE @ing_hab uniqueidentifier = (SELECT ingredient_id FROM dbo.ingredients WHERE name = 'Habanero Peppers');
    DECLARE @lot_hab uniqueidentifier = NEWID();
    INSERT INTO dbo.ingredient_lots (ingredient_lot_id, ingredient_id, facility_id, supplier_id, lot_number, received_at, expires_at, quantity_received, unit_id, notes)
    VALUES (@lot_hab, @ing_hab, @facility, @sup_id, 'PSP-2026-0208A', '2026-02-07 14:00:00', '2026-02-21 00:00:00', 25.000000, @lb_id, 'Fresh habaneros, 25 lb case');
    PRINT '  2. Ingredient lot received: PSP-2026-0208A (25 lb habaneros)';

    -- Step 3: Create inventory record + purchase transaction
    IF NOT EXISTS (SELECT 1 FROM dbo.ingredient_inventory WHERE ingredient_id = @ing_hab AND facility_id = @facility)
        INSERT INTO dbo.ingredient_inventory (ingredient_id, facility_id, quantity_on_hand, unit_id, low_stock_threshold)
        VALUES (@ing_hab, @facility, 0, @lb_id, 5.0);

    -- Record purchase transaction (+25 lb)
    INSERT INTO dbo.inventory_transactions (ingredient_id, facility_id, ingredient_lot_id, transaction_type, quantity, unit_id, reference_notes, transacted_by_user_id)
    VALUES (@ing_hab, @facility, @lot_hab, 'purchase', 25.000000, @lb_id, 'Received lot PSP-2026-0208A from Peach State Peppers', @demo_user);

    -- Update materialized stock
    UPDATE dbo.ingredient_inventory SET quantity_on_hand = quantity_on_hand + 25.000000
    WHERE ingredient_id = @ing_hab AND facility_id = @facility;
    PRINT '  3. Purchase recorded: +25 lb habaneros (stock = 25 lb)';

    -- Step 4: Record usage for demo run (-15 lb for 5-gal batch)
    INSERT INTO dbo.inventory_transactions (ingredient_id, facility_id, ingredient_lot_id, production_run_id, transaction_type, quantity, unit_id, reference_notes, transacted_by_user_id)
    VALUES (@ing_hab, @facility, @lot_hab, @demo_run_id, 'usage', -15.000000, @lb_id, 'Usage for run HS-20260208-001', @demo_user);

    UPDATE dbo.ingredient_inventory SET quantity_on_hand = quantity_on_hand - 15.000000
    WHERE ingredient_id = @ing_hab AND facility_id = @facility;
    PRINT '  4. Usage recorded: -15 lb habaneros for run HS-20260208-001 (stock = 10 lb)';

    -- Step 5: Record lot-level consumption (traceability)
    INSERT INTO dbo.production_run_ingredient_consumption (production_run_id, ingredient_lot_id, quantity_used, unit_id, notes)
    VALUES (@demo_run_id, @lot_hab, 15.000000, @lb_id, 'Habanero lot PSP-2026-0208A used in run');
    PRINT '  5. Lot consumption recorded for traceability';

    -- Step 6: Create a product lot from the run
    DECLARE @fm_channel uniqueidentifier = (SELECT sales_channel_id FROM dbo.sales_channels WHERE code = 'farmers_market');

    INSERT INTO dbo.product_lots (production_run_id, facility_id, lot_code, quantity_produced, unit_id, produced_at)
    VALUES (@demo_run_id, @facility, 'HS-20260208-001', 4.750000, @gal_id, '2026-02-08 09:30:00');
    PRINT '  6. Product lot created: HS-20260208-001 (4.75 gal)';

    -- Step 7: Record initial distribution
    INSERT INTO dbo.production_run_distribution (production_run_id, distributed_at, channel_id, customer_name, location, quantity, unit_id, notes)
    VALUES (@demo_run_id, '2026-02-09 07:00:00', @fm_channel, NULL, 'Downtown Farmers Market', 2.000000, @gal_id, 'Initial market allocation — 2 gal (approx 25 bottles)');
    PRINT '  7. Distribution recorded: 2 gal to Downtown Farmers Market';

    -- Show results
    PRINT '';
    PRINT '--- Inventory status ---';
    SELECT ingredient_name, facility_name, quantity_on_hand, unit_abbrev, is_low_stock
    FROM dbo.vw_inventory_status
    WHERE ingredient_name = 'Habanero Peppers';

    PRINT '';
    PRINT '--- Computed vs materialized stock ---';
    SELECT
        ic.ingredient_name,
        ic.computed_on_hand   AS ledger_computed,
        ii.quantity_on_hand   AS materialized,
        ic.unit_abbrev,
        ic.transaction_count
    FROM dbo.vw_inventory_computed ic
    INNER JOIN dbo.ingredient_inventory ii
        ON ic.ingredient_id = ii.ingredient_id AND ic.facility_id = ii.facility_id
    WHERE ic.ingredient_name = 'Habanero Peppers';

    PRINT '';
    PRINT '--- Lot genealogy for ingredient lot PSP-2026-0208A ---';
    SELECT
        ingredient_lot_number, ingredient_name, supplier_name,
        run_lot_code, quantity_used, quantity_used_unit,
        product_lot_code, quantity_produced, quantity_produced_unit
    FROM dbo.vw_lot_genealogy
    WHERE ingredient_lot_number = 'PSP-2026-0208A';

    PRINT '';
    PRINT '--- Recall by product lot HS-20260208-001 ---';
    EXEC dbo.sp_recall_by_product_lot 'HS-20260208-001';

    PRINT '';
    PRINT '--- Recall by ingredient lot PSP-2026-0208A ---';
    EXEC dbo.sp_recall_by_ingredient_lot 'PSP-2026-0208A';

    PRINT '';
    PRINT '=== DEMO Complete ===';
END
ELSE
BEGIN
    PRINT 'Demo data already exists or prerequisites missing — skipping.';
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
    'suppliers', 'ingredient_inventory', 'ingredient_lots',
    'inventory_transactions', 'production_run_ingredient_consumption',
    'product_lots'
  )
ORDER BY t.name;
GO

PRINT '=== Phase 5 — Inventory + Lot Genealogy: Script complete ===';
GO
