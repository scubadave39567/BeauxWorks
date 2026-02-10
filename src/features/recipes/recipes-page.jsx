import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getRecipes } from '@/api/recipes'
import { useLookups } from '@/hooks/use-lookups'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable } from '@/components/shared/data-table'
import { SearchInput } from '@/components/shared/search-input'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { Badge } from '@/components/ui/badge'
import { Plus, ChefHat } from 'lucide-react'
import { formatDate } from '@/lib/format'

export default function RecipesPage() {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const { recipeCategoriesMap } = useLookups()

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ['recipes'],
    queryFn: getRecipes,
  })

  const columns = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'recipe_category_id',
      header: 'Category',
      cell: ({ row }) => {
        const cat = row.original.recipe_category_id
          ? recipeCategoriesMap.get(row.original.recipe_category_id)
          : null
        return cat ? (
          <Badge variant="secondary">{cat.name}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => (
        <span className="text-muted-foreground line-clamp-1">
          {row.original.description || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? 'success' : 'outline'}>
          {row.original.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) => formatDate(row.original.created_at),
    },
  ]

  if (isLoading) return <LoadingSpinner />

  return (
    <div>
      <PageHeader title="Recipes" description="Manage your recipe catalog">
        <Button onClick={() => navigate('/recipes/new')}>
          <Plus className="h-4 w-4" />
          New Recipe
        </Button>
      </PageHeader>

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search recipes..."
        />
      </div>

      <DataTable
        columns={columns}
        data={recipes}
        searchKey="name"
        searchValue={search}
        onRowClick={(row) => navigate(`/recipes/${row.recipe_id}`)}
        renderCard={(recipe) => {
          const cat = recipe.recipe_category_id
            ? recipeCategoriesMap.get(recipe.recipe_category_id)
            : null
          return (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ChefHat className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{recipe.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {cat ? cat.name : formatDate(recipe.created_at)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={recipe.is_active ? 'success' : 'outline'}>
                    {recipe.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )
        }}
      />
    </div>
  )
}
