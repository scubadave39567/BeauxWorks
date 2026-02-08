/*
  BeauxWorks — Phase 1: Identity & Access Control
  ================================================
  Run AFTER 00-create-database.sql

  Creates (in dependency order):
    1. dbo.users
    2. dbo.roles
    3. dbo.user_roles
    4. dbo.user_mfa
    5. dbo.user_recovery_codes
    6. dbo.user_refresh_tokens
    7. dbo.audit_log
  Then: indexes, triggers, seed data.

  Idempotent: uses IF NOT EXISTS checks so script can be re-run safely.
*/

USE [BeauxWorks];
GO

------------------------------------------------------------------------
-- 1. TABLES (dependency order)
------------------------------------------------------------------------

-- 1.1 dbo.users
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.users (
        user_id              uniqueidentifier  NOT NULL
                             CONSTRAINT DF_users_pk DEFAULT NEWSEQUENTIALID(),
        email                nvarchar(320)     NOT NULL,
        display_name         nvarchar(200)     NOT NULL,
        password_hash        nvarchar(500)     NOT NULL,
        password_algo        nvarchar(50)      NOT NULL
                             CONSTRAINT DF_users_algo DEFAULT 'argon2id',
        password_updated_at  datetime2(7)      NOT NULL
                             CONSTRAINT DF_users_pwd_upd DEFAULT SYSUTCDATETIME(),
        is_active            bit               NOT NULL
                             CONSTRAINT DF_users_active DEFAULT 1,
        failed_login_count   int               NOT NULL
                             CONSTRAINT DF_users_fail_ct DEFAULT 0,
        locked_until         datetime2(7)      NULL,
        last_login_at        datetime2(7)      NULL,
        created_at           datetime2(7)      NOT NULL
                             CONSTRAINT DF_users_created DEFAULT SYSUTCDATETIME(),
        updated_at           datetime2(7)      NOT NULL
                             CONSTRAINT DF_users_updated DEFAULT SYSUTCDATETIME(),
        is_deleted           bit               NOT NULL
                             CONSTRAINT DF_users_del DEFAULT 0,

        CONSTRAINT PK_users       PRIMARY KEY CLUSTERED (user_id),
        CONSTRAINT UQ_users_email UNIQUE (email)
    );
    PRINT 'Created table dbo.users';
END
GO

-- 1.2 dbo.roles (lookup)
IF OBJECT_ID(N'dbo.roles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.roles (
        role_id       uniqueidentifier  NOT NULL
                      CONSTRAINT DF_roles_pk DEFAULT NEWSEQUENTIALID(),
        name          nvarchar(100)     NOT NULL,
        description   nvarchar(500)     NULL,
        created_at    datetime2(7)      NOT NULL
                      CONSTRAINT DF_roles_created DEFAULT SYSUTCDATETIME(),
        updated_at    datetime2(7)      NOT NULL
                      CONSTRAINT DF_roles_updated DEFAULT SYSUTCDATETIME(),
        is_deleted    bit               NOT NULL
                      CONSTRAINT DF_roles_del DEFAULT 0,

        CONSTRAINT PK_roles      PRIMARY KEY CLUSTERED (role_id),
        CONSTRAINT UQ_roles_name UNIQUE (name)
    );
    PRINT 'Created table dbo.roles';
END
GO

-- 1.3 dbo.user_roles (junction)
IF OBJECT_ID(N'dbo.user_roles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_roles (
        user_role_id  uniqueidentifier  NOT NULL
                      CONSTRAINT DF_user_roles_pk DEFAULT NEWSEQUENTIALID(),
        user_id       uniqueidentifier  NOT NULL,
        role_id       uniqueidentifier  NOT NULL,
        created_at    datetime2(7)      NOT NULL
                      CONSTRAINT DF_user_roles_created DEFAULT SYSUTCDATETIME(),
        updated_at    datetime2(7)      NOT NULL
                      CONSTRAINT DF_user_roles_updated DEFAULT SYSUTCDATETIME(),
        is_deleted    bit               NOT NULL
                      CONSTRAINT DF_user_roles_del DEFAULT 0,

        CONSTRAINT PK_user_roles           PRIMARY KEY CLUSTERED (user_role_id),
        CONSTRAINT FK_user_roles_user      FOREIGN KEY (user_id) REFERENCES dbo.users (user_id),
        CONSTRAINT FK_user_roles_role      FOREIGN KEY (role_id) REFERENCES dbo.roles (role_id),
        CONSTRAINT UQ_user_roles_user_role UNIQUE (user_id, role_id)
    );
    PRINT 'Created table dbo.user_roles';
END
GO

-- 1.4 dbo.user_mfa
IF OBJECT_ID(N'dbo.user_mfa', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_mfa (
        user_mfa_id       uniqueidentifier  NOT NULL
                          CONSTRAINT DF_user_mfa_pk DEFAULT NEWSEQUENTIALID(),
        user_id           uniqueidentifier  NOT NULL,
        mfa_type          nvarchar(50)      NOT NULL
                          CONSTRAINT DF_user_mfa_type DEFAULT 'totp',
        secret_encrypted  varbinary(max)    NOT NULL,
        is_enabled        bit               NOT NULL
                          CONSTRAINT DF_user_mfa_enabled DEFAULT 0,
        enabled_at        datetime2(7)      NULL,
        created_at        datetime2(7)      NOT NULL
                          CONSTRAINT DF_user_mfa_created DEFAULT SYSUTCDATETIME(),
        updated_at        datetime2(7)      NOT NULL
                          CONSTRAINT DF_user_mfa_updated DEFAULT SYSUTCDATETIME(),
        is_deleted        bit               NOT NULL
                          CONSTRAINT DF_user_mfa_del DEFAULT 0,

        CONSTRAINT PK_user_mfa      PRIMARY KEY CLUSTERED (user_mfa_id),
        CONSTRAINT FK_user_mfa_user FOREIGN KEY (user_id) REFERENCES dbo.users (user_id),
        CONSTRAINT CK_user_mfa_type CHECK (mfa_type IN ('totp', 'webauthn'))
    );
    PRINT 'Created table dbo.user_mfa';
END
GO

-- 1.5 dbo.user_recovery_codes
IF OBJECT_ID(N'dbo.user_recovery_codes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_recovery_codes (
        recovery_code_id  uniqueidentifier  NOT NULL
                          CONSTRAINT DF_recovery_pk DEFAULT NEWSEQUENTIALID(),
        user_id           uniqueidentifier  NOT NULL,
        code_hash         varbinary(64)     NOT NULL,
        used_at           datetime2(7)      NULL,
        created_at        datetime2(7)      NOT NULL
                          CONSTRAINT DF_recovery_created DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_user_recovery_codes      PRIMARY KEY CLUSTERED (recovery_code_id),
        CONSTRAINT FK_user_recovery_codes_user FOREIGN KEY (user_id) REFERENCES dbo.users (user_id)
    );
    PRINT 'Created table dbo.user_recovery_codes';
END
GO

-- 1.6 dbo.user_refresh_tokens
IF OBJECT_ID(N'dbo.user_refresh_tokens', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_refresh_tokens (
        refresh_token_id  uniqueidentifier  NOT NULL
                          CONSTRAINT DF_refresh_pk DEFAULT NEWSEQUENTIALID(),
        user_id           uniqueidentifier  NOT NULL,
        token_hash        varbinary(64)     NOT NULL,
        issued_at         datetime2(7)      NOT NULL
                          CONSTRAINT DF_refresh_issued DEFAULT SYSUTCDATETIME(),
        expires_at        datetime2(7)      NOT NULL,
        revoked_at        datetime2(7)      NULL,
        last_used_at      datetime2(7)      NULL,
        device_info       nvarchar(500)     NULL,
        created_at        datetime2(7)      NOT NULL
                          CONSTRAINT DF_refresh_created DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_user_refresh_tokens      PRIMARY KEY CLUSTERED (refresh_token_id),
        CONSTRAINT FK_user_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES dbo.users (user_id)
    );
    PRINT 'Created table dbo.user_refresh_tokens';
END
GO

-- 1.7 dbo.audit_log (append-only — no updated_at, no is_deleted)
IF OBJECT_ID(N'dbo.audit_log', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.audit_log (
        audit_log_id    uniqueidentifier  NOT NULL
                        CONSTRAINT DF_audit_pk DEFAULT NEWSEQUENTIALID(),
        occurred_at     datetime2(7)      NOT NULL
                        CONSTRAINT DF_audit_occurred DEFAULT SYSUTCDATETIME(),
        actor_user_id   uniqueidentifier  NULL,
        action          nvarchar(100)     NOT NULL,
        entity_type     nvarchar(100)     NULL,
        entity_id       uniqueidentifier  NULL,
        ip_address      nvarchar(64)      NULL,
        user_agent      nvarchar(500)     NULL,
        metadata_json   nvarchar(max)     NULL,

        CONSTRAINT PK_audit_log       PRIMARY KEY CLUSTERED (audit_log_id),
        CONSTRAINT FK_audit_log_actor FOREIGN KEY (actor_user_id) REFERENCES dbo.users (user_id)
    );
    PRINT 'Created table dbo.audit_log';
END
GO


------------------------------------------------------------------------
-- 2. INDEXES
------------------------------------------------------------------------

-- users: email already covered by UQ_users_email
-- filtered index for active, non-deleted users
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_users_active' AND object_id = OBJECT_ID(N'dbo.users'))
    CREATE NONCLUSTERED INDEX IX_users_active
        ON dbo.users (is_active, email)
        WHERE is_deleted = 0;
GO

-- user_roles
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_user_roles_user_id' AND object_id = OBJECT_ID(N'dbo.user_roles'))
    CREATE NONCLUSTERED INDEX IX_user_roles_user_id
        ON dbo.user_roles (user_id)
        INCLUDE (role_id)
        WHERE is_deleted = 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_user_roles_role_id' AND object_id = OBJECT_ID(N'dbo.user_roles'))
    CREATE NONCLUSTERED INDEX IX_user_roles_role_id
        ON dbo.user_roles (role_id)
        INCLUDE (user_id)
        WHERE is_deleted = 0;
GO

-- user_mfa
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_user_mfa_user_id' AND object_id = OBJECT_ID(N'dbo.user_mfa'))
    CREATE NONCLUSTERED INDEX IX_user_mfa_user_id
        ON dbo.user_mfa (user_id)
        WHERE is_enabled = 1 AND is_deleted = 0;
GO

-- user_recovery_codes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_recovery_codes_user_id' AND object_id = OBJECT_ID(N'dbo.user_recovery_codes'))
    CREATE NONCLUSTERED INDEX IX_recovery_codes_user_id
        ON dbo.user_recovery_codes (user_id)
        WHERE used_at IS NULL;
GO

-- user_refresh_tokens
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_refresh_tokens_user_id' AND object_id = OBJECT_ID(N'dbo.user_refresh_tokens'))
    CREATE NONCLUSTERED INDEX IX_refresh_tokens_user_id
        ON dbo.user_refresh_tokens (user_id)
        WHERE revoked_at IS NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_refresh_tokens_expires' AND object_id = OBJECT_ID(N'dbo.user_refresh_tokens'))
    CREATE NONCLUSTERED INDEX IX_refresh_tokens_expires
        ON dbo.user_refresh_tokens (expires_at)
        WHERE revoked_at IS NULL;
GO

-- audit_log
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_audit_log_occurred' AND object_id = OBJECT_ID(N'dbo.audit_log'))
    CREATE NONCLUSTERED INDEX IX_audit_log_occurred
        ON dbo.audit_log (occurred_at DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_audit_log_actor' AND object_id = OBJECT_ID(N'dbo.audit_log'))
    CREATE NONCLUSTERED INDEX IX_audit_log_actor
        ON dbo.audit_log (actor_user_id)
        WHERE actor_user_id IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_audit_log_action' AND object_id = OBJECT_ID(N'dbo.audit_log'))
    CREATE NONCLUSTERED INDEX IX_audit_log_action
        ON dbo.audit_log (action);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_audit_log_entity' AND object_id = OBJECT_ID(N'dbo.audit_log'))
    CREATE NONCLUSTERED INDEX IX_audit_log_entity
        ON dbo.audit_log (entity_type, entity_id)
        WHERE entity_type IS NOT NULL;
GO


------------------------------------------------------------------------
-- 3. TRIGGERS (updated_at auto-maintenance)
------------------------------------------------------------------------

-- dbo.users
CREATE OR ALTER TRIGGER dbo.TR_users_updated_at
ON dbo.users
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    UPDATE u
    SET    updated_at = SYSUTCDATETIME()
    FROM   dbo.users u
    INNER JOIN inserted i ON u.user_id = i.user_id;
END;
GO

-- dbo.roles
CREATE OR ALTER TRIGGER dbo.TR_roles_updated_at
ON dbo.roles
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    UPDATE r
    SET    updated_at = SYSUTCDATETIME()
    FROM   dbo.roles r
    INNER JOIN inserted i ON r.role_id = i.role_id;
END;
GO

-- dbo.user_roles
CREATE OR ALTER TRIGGER dbo.TR_user_roles_updated_at
ON dbo.user_roles
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    UPDATE ur
    SET    updated_at = SYSUTCDATETIME()
    FROM   dbo.user_roles ur
    INNER JOIN inserted i ON ur.user_role_id = i.user_role_id;
END;
GO

-- dbo.user_mfa
CREATE OR ALTER TRIGGER dbo.TR_user_mfa_updated_at
ON dbo.user_mfa
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    UPDATE m
    SET    updated_at = SYSUTCDATETIME()
    FROM   dbo.user_mfa m
    INNER JOIN inserted i ON m.user_mfa_id = i.user_mfa_id;
END;
GO


------------------------------------------------------------------------
-- 4. SEED DATA (idempotent)
------------------------------------------------------------------------

-- 4.1 Seed roles
IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE name = 'admin')
    INSERT INTO dbo.roles (name, description)
    VALUES ('admin', 'Full system access — user management, configuration, all modules');

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE name = 'production_manager')
    INSERT INTO dbo.roles (name, description)
    VALUES ('production_manager', 'Manage recipes, production runs, quality logs, and compliance');

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE name = 'inventory_manager')
    INSERT INTO dbo.roles (name, description)
    VALUES ('inventory_manager', 'Manage ingredients, stock levels, suppliers, and lot tracking');

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE name = 'sales_manager')
    INSERT INTO dbo.roles (name, description)
    VALUES ('sales_manager', 'Manage products, sales entries, channels, and website content');

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE name = 'viewer')
    INSERT INTO dbo.roles (name, description)
    VALUES ('viewer', 'Read-only access to all modules');
GO

PRINT 'Seed roles inserted.';
GO


------------------------------------------------------------------------
-- 5. VERIFICATION QUERIES
------------------------------------------------------------------------

-- Show all Phase 1 tables
SELECT
    s.name AS [schema],
    t.name AS [table],
    t.create_date
FROM sys.tables t
INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = 'dbo'
  AND t.name IN (
    'users', 'roles', 'user_roles', 'user_mfa',
    'user_recovery_codes', 'user_refresh_tokens', 'audit_log'
  )
ORDER BY t.name;
GO

-- Show seeded roles
SELECT role_id, name, description FROM dbo.roles ORDER BY name;
GO

-- Show all indexes on Phase 1 tables
SELECT
    OBJECT_NAME(i.object_id) AS table_name,
    i.name                   AS index_name,
    i.type_desc,
    i.is_unique,
    i.has_filter,
    i.filter_definition
FROM sys.indexes i
INNER JOIN sys.tables t ON i.object_id = t.object_id
INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE s.name = 'dbo'
  AND t.name IN (
    'users', 'roles', 'user_roles', 'user_mfa',
    'user_recovery_codes', 'user_refresh_tokens', 'audit_log'
  )
  AND i.name IS NOT NULL
ORDER BY t.name, i.name;
GO

-- Show triggers
SELECT
    OBJECT_NAME(parent_id) AS table_name,
    name                   AS trigger_name,
    type_desc
FROM sys.triggers
WHERE OBJECT_NAME(parent_id) IN (
    'users', 'roles', 'user_roles', 'user_mfa'
)
ORDER BY table_name;
GO

PRINT '=== Phase 1 — Identity & Access Control: Script complete ===';
GO
