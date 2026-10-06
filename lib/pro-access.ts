export type ProEntitlement = {
  plan?: string | null
  referral_pro_until?: string | null
}

export function hasProAccess(workspace: ProEntitlement | null | undefined, now = Date.now()): boolean {
  if (workspace?.plan === 'pro') return true
  const expiresAt = Date.parse(workspace?.referral_pro_until || '')
  return Number.isFinite(expiresAt) && expiresAt > now
}
