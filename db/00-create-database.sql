/*
  BeauxWorks — Database Creation + FILESTREAM Setup
  Target: CHAMBERLAIN-PC (local SQL Server)

  PREREQUISITES (manual, one-time):
  ---------------------------------------------------------------
  1. Open SQL Server Configuration Manager
  2. Right-click SQL Server service → Properties → FILESTREAM tab
  3. Check all three boxes:
       [x] Enable FILESTREAM for Transact-SQL access
       [x] Enable FILESTREAM for file I/O streaming access
       [x] Allow remote clients access to streaming data
  4. Restart the SQL Server service
  ---------------------------------------------------------------

  After those steps, run this script in SSMS as sa on CHAMBERLAIN-PC.

  NOTE: Adjust the FILESTREAM container path below if needed.
        The default uses C:\SQLData\BeauxWorks_FS
        The directory must NOT already exist — SQL Server creates it.
*/

USE [master];
GO

------------------------------------------------------------------------
-- 1. Enable FILESTREAM access at the instance level
------------------------------------------------------------------------
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;
GO

EXEC sp_configure 'filestream access level', 2;   -- 0=off, 1=T-SQL only, 2=T-SQL + streaming
RECONFIGURE;
GO

------------------------------------------------------------------------
-- 2. Create database if it does not exist
------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'BeauxWorks')
BEGIN
    CREATE DATABASE [BeauxWorks];
    PRINT 'Database [BeauxWorks] created.';
END
ELSE
BEGIN
    PRINT 'Database [BeauxWorks] already exists.';
END
GO

------------------------------------------------------------------------
-- 3. Add FILESTREAM filegroup (if not present)
------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM [BeauxWorks].sys.filegroups
    WHERE name = N'BeauxWorks_FS' AND type_desc = 'FILESTREAM_DATA_FILEGROUP'
)
BEGIN
    ALTER DATABASE [BeauxWorks]
        ADD FILEGROUP [BeauxWorks_FS] CONTAINS FILESTREAM;
    PRINT 'FILESTREAM filegroup [BeauxWorks_FS] added.';
END
ELSE
BEGIN
    PRINT 'FILESTREAM filegroup [BeauxWorks_FS] already exists.';
END
GO

------------------------------------------------------------------------
-- 4. Add FILESTREAM container file (if not present)
--    IMPORTANT: Change the path below to suit your environment.
--    The folder must NOT already exist; SQL Server creates it.
------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM [BeauxWorks].sys.database_files df
    INNER JOIN [BeauxWorks].sys.filegroups fg
        ON df.data_space_id = fg.data_space_id
    WHERE fg.name = N'BeauxWorks_FS'
      AND df.type_desc = 'FILESTREAM'
)
BEGIN
    ALTER DATABASE [BeauxWorks]
        ADD FILE (
            NAME = N'BeauxWorks_FileStream',
            FILENAME = N'C:\SQLData\BeauxWorks_FS'     -- << ADJUST PATH IF NEEDED
        ) TO FILEGROUP [BeauxWorks_FS];
    PRINT 'FILESTREAM container added at C:\SQLData\BeauxWorks_FS';
END
ELSE
BEGIN
    PRINT 'FILESTREAM container already exists.';
END
GO

------------------------------------------------------------------------
-- 5. Verify setup
------------------------------------------------------------------------
USE [BeauxWorks];
GO

SELECT
    fg.name          AS filegroup_name,
    fg.type_desc     AS filegroup_type,
    df.name          AS file_name,
    df.physical_name AS file_path,
    df.type_desc     AS file_type
FROM sys.filegroups fg
LEFT JOIN sys.database_files df
    ON df.data_space_id = fg.data_space_id
ORDER BY fg.type_desc, fg.name;
GO

PRINT '=== 00-create-database.sql complete ===';
GO
