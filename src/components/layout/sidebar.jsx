import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ChefHat,
  Factory,
  ClipboardList,
  Package,
  ShoppingCart,
  BarChart3,
  FileText,
  Settings,
} from 'lucide-react'
import logo from '@/assets/logo.png'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/recipes', label: 'Recipes', icon: ChefHat },
  { to: '/my-runs', label: 'My Runs', icon: ClipboardList },
  { to: '/production', label: 'Production', icon: Factory },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/products', label: 'Products', icon: ShoppingCart },
  { to: '/sales', label: 'Sales', icon: BarChart3 },
  { to: '/cms', label: 'CMS', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  return (
    <aside
      data-sidebar
      className="hidden md:flex md:flex-col md:w-64 bg-sidebar text-sidebar-foreground min-h-screen"
    >
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <img src={logo} alt="Beaux's Bistro" className="w-10 h-10 rounded-full object-cover" />
        <div>
          <h1 className="font-heading text-lg font-semibold text-sidebar-foreground">
            Beaux&apos;s Bistro
          </h1>
          <p className="text-xs text-sidebar-foreground/60">Production Manager</p>
        </div>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
