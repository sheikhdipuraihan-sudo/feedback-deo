import assert from 'node:assert/strict'
import test from 'node:test'

const { filterPayments, filterWorkspaces, getAdminSummary, paginateItems } = await import('../lib/admin/subscriptions.ts')

const workspaces = [
  { id: 'w-1', name: 'Texmart', slug: 'texmart', plan: 'pro', status: 'active', owner_id: 'owner-1', created_at: '2026-09-25T12:00:00Z' },
  { id: 'w-2', name: 'North Salon', slug: 'north-salon', plan: 'free', status: 'active', owner_id: 'owner-2', created_at: '2026-09-27T12:00:00Z' },
  { id: 'w-3', name: 'Old Gym', slug: 'old-gym', plan: 'pro', status: 'banned', owner_id: 'owner-3', created_at: '2026-09-26T12:00:00Z' },
]

const payments = [
  { id: 'p-1', workspace_id: 'w-1', workspace_name: 'Texmart', workspace_slug: 'texmart', submitted_by: 'owner-1', amount: 49, bkash_number: '01***', transaction_id: 'TX-APPROVED', status: 'approved', admin_note: null, created_at: '2026-09-28T08:00:00Z', reviewed_at: '2026-09-28T08:05:00Z' },
  { id: 'p-2', workspace_id: 'w-2', workspace_name: 'North Salon', workspace_slug: 'north-salon', submitted_by: 'owner-2', amount: 49, bkash_number: '01***', transaction_id: 'TX-PENDING-NEW', status: 'pending', admin_note: null, created_at: '2026-09-27T08:00:00Z', reviewed_at: null },
  { id: 'p-3', workspace_id: 'w-2', workspace_name: 'North Salon', workspace_slug: 'north-salon', submitted_by: 'owner-2', amount: 49, bkash_number: '01***', transaction_id: 'TX-PENDING-OLD', status: 'pending', admin_note: null, created_at: '2026-09-26T08:00:00Z', reviewed_at: null },
  { id: 'p-4', workspace_id: 'w-3', workspace_name: 'Old Gym', workspace_slug: 'old-gym', submitted_by: 'owner-3', amount: 49, bkash_number: '01***', transaction_id: 'TX-REJECTED', status: 'rejected', admin_note: null, created_at: '2026-09-25T08:00:00Z', reviewed_at: '2026-09-25T09:00:00Z' },
]

test('admin summary counts active businesses, active Pro, pending requests, and banned businesses', () => {
  assert.deepEqual(getAdminSummary(workspaces, payments), {
    totalWorkspaces: 3,
    activeWorkspaces: 2,
    activeProWorkspaces: 1,
    pendingPayments: 2,
    bannedWorkspaces: 1,
  })
})

test('payment filters match transaction identifiers and prioritize pending newest-first', () => {
  assert.deepEqual(filterPayments(payments).map(payment => payment.id), ['p-2', 'p-3', 'p-1', 'p-4'])
  assert.deepEqual(filterPayments(payments, 'tx-pending', 'pending').map(payment => payment.id), ['p-2', 'p-3'])
  assert.deepEqual(filterPayments(payments, 'texmart', 'approved').map(payment => payment.id), ['p-1'])
})

test('workspace filters combine plan, status, and business-neutral search fields', () => {
  assert.deepEqual(filterWorkspaces(workspaces, 'OWNER-2', 'free', 'active').map(workspace => workspace.id), ['w-2'])
  assert.deepEqual(filterWorkspaces(workspaces, '', 'pro', 'active').map(workspace => workspace.id), ['w-1'])
  assert.deepEqual(filterWorkspaces(workspaces, 'salon').map(workspace => workspace.id), ['w-2'])
})

test('pagination reports correct ranges and clamps invalid or stale page numbers', () => {
  const items = Array.from({ length: 23 }, (_, index) => index + 1)
  assert.deepEqual(paginateItems(items, 2, 10), { items: items.slice(10, 20), page: 2, pageCount: 3, start: 11, end: 20, total: 23 })
  assert.deepEqual(paginateItems(items, 99, 10), { items: [21, 22, 23], page: 3, pageCount: 3, start: 21, end: 23, total: 23 })
  assert.deepEqual(paginateItems([], 4, 10), { items: [], page: 1, pageCount: 1, start: 0, end: 0, total: 0 })
})
