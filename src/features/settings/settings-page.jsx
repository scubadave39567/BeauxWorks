import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { cn } from '@/lib/utils'
import { Beaker, Tag, FolderTree, ChefHat, ClipboardCheck } from 'lucide-react'
import { IngredientsManager } from './ingredients-manager'
import { ItemTypesManager } from './item-types-manager'
import { IngredientCategoriesManager } from './ingredient-categories-manager'
import { RecipeCategoriesManager } from './recipe-categories-manager'
import { QcPlansManager } from './qc-plans-manager'

const sections = [
  { key: 'ingredients', label: 'Ingredients', icon: Beaker, component: IngredientsManager },
  { key: 'item-types', label: 'Item Types', icon: Tag, component: ItemTypesManager },
  { key: 'ingredient-categories', label: 'Ingredient Categories', icon: FolderTree, component: IngredientCategoriesManager },
  { key: 'recipe-categories', label: 'Recipe Categories', icon: ChefHat, component: RecipeCategoriesManager },
  { key: 'qc-plans', label: 'QC Plans', icon: ClipboardCheck, component: QcPlansManager },
]

export default function SettingsPage() {
  const [active, setActive] = useState('ingredients')

  const ActiveComponent = sections.find((s) => s.key === active)?.component

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage code tables and lookup values used across the system"
      />

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sub-menu */}
        <nav className="md:w-56 shrink-0">
          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
            {sections.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActive(key)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap min-h-[44px]',
                  active === key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </nav>

        {/* Active section */}
        <div className="flex-1 min-w-0">
          {ActiveComponent && <ActiveComponent />}
        </div>
      </div>
    </div>
  )
}
