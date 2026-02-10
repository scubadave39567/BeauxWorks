import { createBrowserRouter } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { AuthGuard } from '@/features/auth/auth-guard'
import { LoadingSpinner } from '@/components/shared/loading-spinner'

// Lazy-load all page components
const LoginPage = lazy(() => import('@/features/auth/login-page'))
const MfaVerifyPage = lazy(() => import('@/features/auth/mfa-verify-page'))
const DashboardPage = lazy(() => import('@/features/dashboard/dashboard-page'))
const RecipesPage = lazy(() => import('@/features/recipes/recipes-page'))
const RecipeDetailPage = lazy(() => import('@/features/recipes/recipe-detail-page'))
const RecipeFormPage = lazy(() => import('@/features/recipes/recipe-form-page'))
const ProductionRunsPage = lazy(() => import('@/features/production/production-runs-page'))
const ProductionRunDetailPage = lazy(() => import('@/features/production/production-run-detail-page'))
const ProductionRunFormPage = lazy(() => import('@/features/production/production-run-form-page'))
const InventoryPage = lazy(() => import('@/features/inventory/inventory-page'))
const TransactionLogPage = lazy(() => import('@/features/inventory/transaction-log-page'))
const RecallPage = lazy(() => import('@/features/inventory/recall-page'))
const ProductsPage = lazy(() => import('@/features/products/products-page'))
const ProductDetailPage = lazy(() => import('@/features/products/product-detail-page'))
const ProductFormPage = lazy(() => import('@/features/products/product-form-page'))
const SalesPage = lazy(() => import('@/features/sales/sales-page'))
const RecordSaleForm = lazy(() => import('@/features/sales/record-sale-form'))
const CmsPage = lazy(() => import('@/features/cms/cms-page'))
const CmsEditorPage = lazy(() => import('@/features/cms/cms-editor-page'))
const MyRunsPage = lazy(() => import('@/features/production/my-runs-page'))
const ProfilePage = lazy(() => import('@/features/settings/profile-page'))

function SuspenseWrap({ children }) {
  return <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <SuspenseWrap><LoginPage /></SuspenseWrap>,
  },
  {
    path: '/mfa-verify',
    element: <SuspenseWrap><MfaVerifyPage /></SuspenseWrap>,
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppShell />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <SuspenseWrap><DashboardPage /></SuspenseWrap>,
      },
      {
        path: 'recipes',
        element: <SuspenseWrap><RecipesPage /></SuspenseWrap>,
      },
      {
        path: 'recipes/new',
        element: <SuspenseWrap><RecipeFormPage /></SuspenseWrap>,
      },
      {
        path: 'recipes/:id',
        element: <SuspenseWrap><RecipeDetailPage /></SuspenseWrap>,
      },
      {
        path: 'recipes/:id/edit',
        element: <SuspenseWrap><RecipeFormPage /></SuspenseWrap>,
      },
      {
        path: 'my-runs',
        element: <SuspenseWrap><MyRunsPage /></SuspenseWrap>,
      },
      {
        path: 'production',
        element: <SuspenseWrap><ProductionRunsPage /></SuspenseWrap>,
      },
      {
        path: 'production/new',
        element: <SuspenseWrap><ProductionRunFormPage /></SuspenseWrap>,
      },
      {
        path: 'production/:id',
        element: <SuspenseWrap><ProductionRunDetailPage /></SuspenseWrap>,
      },
      {
        path: 'production/:id/edit',
        element: <SuspenseWrap><ProductionRunFormPage /></SuspenseWrap>,
      },
      {
        path: 'inventory',
        element: <SuspenseWrap><InventoryPage /></SuspenseWrap>,
      },
      {
        path: 'inventory/transactions',
        element: <SuspenseWrap><TransactionLogPage /></SuspenseWrap>,
      },
      {
        path: 'inventory/recall',
        element: <SuspenseWrap><RecallPage /></SuspenseWrap>,
      },
      {
        path: 'products',
        element: <SuspenseWrap><ProductsPage /></SuspenseWrap>,
      },
      {
        path: 'products/new',
        element: <SuspenseWrap><ProductFormPage /></SuspenseWrap>,
      },
      {
        path: 'products/:id',
        element: <SuspenseWrap><ProductDetailPage /></SuspenseWrap>,
      },
      {
        path: 'products/:id/edit',
        element: <SuspenseWrap><ProductFormPage /></SuspenseWrap>,
      },
      {
        path: 'sales',
        element: <SuspenseWrap><SalesPage /></SuspenseWrap>,
      },
      {
        path: 'sales/new',
        element: <SuspenseWrap><RecordSaleForm /></SuspenseWrap>,
      },
      {
        path: 'cms',
        element: <SuspenseWrap><CmsPage /></SuspenseWrap>,
      },
      {
        path: 'cms/new',
        element: <SuspenseWrap><CmsEditorPage /></SuspenseWrap>,
      },
      {
        path: 'cms/:id/edit',
        element: <SuspenseWrap><CmsEditorPage /></SuspenseWrap>,
      },
      {
        path: 'settings',
        element: <SuspenseWrap><ProfilePage /></SuspenseWrap>,
      },
    ],
  },
])
