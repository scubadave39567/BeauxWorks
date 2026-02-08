/*
  BeauxWorks — Run-All Schema Build Script
  =========================================
  Execute this AFTER running 00-create-database.sql
  (which must be run separately since it operates on master).

  This script runs all phase scripts in dependency order.
  Execute in SSMS connected to CHAMBERLAIN-PC, database: BeauxWorks.

  Add new phase scripts below as they are completed.
*/

USE [BeauxWorks];
GO

PRINT '========================================';
PRINT 'BeauxWorks — Full Schema Build';
PRINT 'Started: ' + CONVERT(nvarchar(30), SYSUTCDATETIME(), 126);
PRINT '========================================';
GO

-- Phase 1: Identity & Access Control
:r "01-phase-1-identity.sql"
GO

-- Phase 2: Foundations (Units, Lookups, Facilities)
:r "02-phase-2-foundations.sql"
GO

-- Phase 3: Recipes + Scaling Engine
:r "03-phase-3-recipes.sql"
GO

-- Phase 4: Production Runs + Quality Logging
:r "04-phase-4-production-runs.sql"
GO

-- Phase 5: Inventory + Lot Genealogy
:r "05-phase-5-inventory.sql"
GO

-- Phase 6: Products + Sales + Compliance + Attachments
:r "06-phase-6-products-sales.sql"
GO

-- Phase 7: Website CMS
:r "07-phase-7-cms.sql"
GO

PRINT '========================================';
PRINT 'BeauxWorks — Build Complete';
PRINT 'Finished: ' + CONVERT(nvarchar(30), SYSUTCDATETIME(), 126);
PRINT '========================================';
GO
