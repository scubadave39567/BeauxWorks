import { useAuth } from './use-auth'

const ROLE_ACTIONS = {
  admin: ['manage_recipes', 'manage_runs', 'manage_inventory', 'manage_qc', 'manage_deviations', 'close_deviations', 'adjust_inventory', 'void_transactions', 'manage_qc_plans', 'amend_qc'],
  qa: ['manage_recipes', 'manage_runs', 'manage_inventory', 'manage_qc', 'manage_deviations', 'close_deviations', 'adjust_inventory', 'void_transactions', 'manage_qc_plans', 'amend_qc'],
  operator: ['manage_runs', 'manage_inventory', 'manage_qc', 'manage_deviations'],
  production_manager: ['manage_recipes', 'manage_runs', 'manage_inventory', 'manage_qc', 'manage_deviations'],
  inventory_manager: ['manage_inventory', 'adjust_inventory'],
  viewer: [],
}

export function usePermissions() {
  const { user } = useAuth()

  const roles = (user?.roles || []).map((r) => (typeof r === 'string' ? r : r.name || r.role?.name)).filter(Boolean)

  function can(action) {
    return roles.some((role) => ROLE_ACTIONS[role]?.includes(action))
  }

  function hasRole(...roleNames) {
    return roles.some((r) => roleNames.includes(r))
  }

  return { roles, can, hasRole }
}
