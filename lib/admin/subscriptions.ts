export type PaymentStatus = 'pending' | 'approved' | 'rejected'
export type WorkspacePlan = 'free' | 'pro'
export type WorkspaceStatus = 'active' | 'banned'

export type AdminPayment = {
  id: string
  workspace_id: string
  workspace_name: string
  workspace_slug: string
  submitted_by: string
  amount: number
  bkash_number: string
  transaction_id: string
  status: PaymentStatus
  admin_note: string | null
  created_at: string
  reviewed_at: string | null
}

export type AdminWorkspace = {
  id: string
  name: string
  slug: string
  plan: WorkspacePlan
  status: WorkspaceStatus
  owner_id: string
  created_at: string
}

export type PaymentStatusFilter = PaymentStatus | 'all'
export type WorkspacePlanFilter = WorkspacePlan | 'all'
export type WorkspaceStatusFilter = WorkspaceStatus | 'all'

export type AdminSummary = {
  totalWorkspaces: number
  activeWorkspaces: number
  activeProWorkspaces: number
  pendingPayments: number
  bannedWorkspaces: number
}

export const ADMIN_PAGE_SIZE = 10

function normalizedTerm(search: string) {
  return search.trim().toLocaleLowerCase()
}

function containsTerm(term: string, fields: string[]) {
  return !term || fields.join(' ').toLocaleLowerCase().includes(term)
}

function timestamp(value: string) {
  const result = Date.parse(value)
  return Number.isFinite(result) ? result : 0
}

export function getAdminSummary(workspaces: AdminWorkspace[], payments: AdminPayment[]): AdminSummary {
  const activeWorkspaces = workspaces.filter(workspace => workspace.status === 'active')
  return {
    totalWorkspaces: workspaces.length,
    activeWorkspaces: activeWorkspaces.length,
    activeProWorkspaces: activeWorkspaces.filter(workspace => workspace.plan === 'pro').length,
    pendingPayments: payments.filter(payment => payment.status === 'pending').length,
    bannedWorkspaces: workspaces.filter(workspace => workspace.status === 'banned').length,
  }
}

export function filterPayments(payments: AdminPayment[], search = '', status: PaymentStatusFilter = 'all') {
  const term = normalizedTerm(search)
  const statusRank: Record<PaymentStatus, number> = { pending: 0, approved: 1, rejected: 2 }
  return payments
    .filter(payment => status === 'all' || payment.status === status)
    .filter(payment => containsTerm(term, [payment.workspace_name, payment.workspace_slug, payment.transaction_id, payment.submitted_by, payment.status]))
    .slice()
    .sort((a, b) => statusRank[a.status] - statusRank[b.status] || timestamp(b.created_at) - timestamp(a.created_at))
}

export function filterWorkspaces(
  workspaces: AdminWorkspace[],
  search = '',
  plan: WorkspacePlanFilter = 'all',
  status: WorkspaceStatusFilter = 'all',
) {
  const term = normalizedTerm(search)
  return workspaces
    .filter(workspace => plan === 'all' || workspace.plan === plan)
    .filter(workspace => status === 'all' || workspace.status === status)
    .filter(workspace => containsTerm(term, [workspace.name, workspace.slug, workspace.id, workspace.owner_id, workspace.plan, workspace.status]))
    .slice()
    .sort((a, b) => timestamp(b.created_at) - timestamp(a.created_at))
}

export function paginateItems<T>(items: T[], requestedPage = 1, pageSize = ADMIN_PAGE_SIZE) {
  const safePageSize = Math.max(1, Math.floor(pageSize) || ADMIN_PAGE_SIZE)
  const pageCount = Math.max(1, Math.ceil(items.length / safePageSize))
  const page = Math.min(Math.max(1, Math.floor(requestedPage) || 1), pageCount)
  const offset = (page - 1) * safePageSize
  return {
    items: items.slice(offset, offset + safePageSize),
    page,
    pageCount,
    start: items.length ? offset + 1 : 0,
    end: Math.min(offset + safePageSize, items.length),
    total: items.length,
  }
}
