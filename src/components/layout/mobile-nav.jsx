import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ChefHat,
  Factory,
  Package,
  MoreHorizontal,
} from 'lucide-react'
import { useState } from 'react'
import { ShoppingCart, BarChart3, FileText, Settings } from 'lucide-react'

const mainTabs = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/recipes', label: 'Recipes', icon: ChefHat },
  { to: '/production', label: 'Runs', icon: Factory },
  { to: '/inventory', label: 'Stock', icon: Package },
]

const moreTabs = [
  { to: '/products', label: 'Products', icon: ShoppingCart },
  { to: '/sales', label: 'Sales', icon: BarChart3 },
  { to: '/cms', label: 'CMS', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function MobileNav() {
  const [showMore, setShowMore] = useState(false)

  return (
    <>
      {showMore && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setShowMore(false)}>
          <div
            className="absolute bottom-16 left-0 right-0 bg-card border-t rounded-t-xl p-4 grid grid-cols-4 gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {moreTabs.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setShowMore(false)}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 rounded-md py-2 text-xs min-h-[44px]',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )
                }
              >
                <Icon className="h-5 w-5" />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
      <nav className="mobile-nav fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t bg-card safe-area-pb">
        {mainTabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs min-h-[56px] justify-center',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
        <button
          onClick={() => setShowMore(!showMore)}
          className={cn(
            'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs min-h-[56px] justify-center',
            showMore ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </button>
      </nav>
    </>
  )
}
