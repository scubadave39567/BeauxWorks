-- Add is_fermented to recipe_categories
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.recipe_categories') AND name = 'is_fermented'
)
BEGIN
    ALTER TABLE dbo.recipe_categories ADD is_fermented bit NOT NULL DEFAULT 0;
END
GO

-- Add recipe_category_id FK to recipes
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.recipes') AND name = 'recipe_category_id'
)
BEGIN
    ALTER TABLE dbo.recipes ADD recipe_category_id uniqueidentifier NULL;
    ALTER TABLE dbo.recipes ADD CONSTRAINT FK_recipes_recipe_category
        FOREIGN KEY (recipe_category_id) REFERENCES dbo.recipe_categories(recipe_category_id);
END
GO

-- Add profile fields to users
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.users') AND name = 'phone'
)
BEGIN
    ALTER TABLE dbo.users ADD phone nvarchar(50) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.users') AND name = 'address'
)
BEGIN
    ALTER TABLE dbo.users ADD address nvarchar(500) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.users') AND name = 'profile_photo_attachment_id'
)
BEGIN
    ALTER TABLE dbo.users ADD profile_photo_attachment_id uniqueidentifier NULL;
END
GO

-- Seed recipe categories
IF NOT EXISTS (SELECT 1 FROM dbo.recipe_categories WHERE name = 'Hot Sauces')
BEGIN
    INSERT INTO dbo.recipe_categories (recipe_category_id, name, description, sort_order, is_fermented)
    VALUES
        (NEWID(), 'Hot Sauces',          'Hot sauce recipes',              1, 0),
        (NEWID(), 'Pickles',             'Pickle recipes',                 2, 1),
        (NEWID(), 'Krauts',              'Sauerkraut and kraut recipes',   3, 1),
        (NEWID(), 'Spice Powders',       'Ground spice blends',            4, 0),
        (NEWID(), 'Breads',              'Bread and baked goods',           5, 0),
        (NEWID(), 'BBQ Sauces',          'Barbecue sauce recipes',          6, 0),
        (NEWID(), 'Other Sauces',        'Miscellaneous sauces',            7, 0),
        (NEWID(), 'Dehydrated Products', 'Dried and dehydrated products',   8, 0);
END
GO
