import { PageHeader } from '@/components/layout/page-header'
import { FacilitiesManager } from './facilities-manager'
import { ItemTypesManager } from './item-types-manager'
import { IngredientCategoriesManager } from './ingredient-categories-manager'
import { IngredientsManager } from './ingredients-manager'
import { RecipeCategoriesManager } from './recipe-categories-manager'
import { QcPlansManager } from './qc-plans-manager'

export default function CodeTablesPage() {
  return (
    <div>
      <PageHeader
        title="Code Tables"
        description="Manage lookup values used across the system"
      />
      <div className="space-y-6">
        <FacilitiesManager />
        <IngredientsManager />
        <ItemTypesManager />
        <IngredientCategoriesManager />
        <RecipeCategoriesManager />
        <QcPlansManager />
      </div>
    </div>
  )
}
