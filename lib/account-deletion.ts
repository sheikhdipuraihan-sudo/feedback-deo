export const ACCOUNT_DELETION_PHRASE = 'DELETE ACCOUNT'
export const ACCOUNT_DELETION_REAUTH_WINDOW_SECONDS = 10 * 60

export type AccountDeletionInput = {
  password: string
  email: string
  confirmationPhrase: string
  acknowledged: boolean
}

export function normalizeAccountEmail(email: string) {
  return email.trim().toLowerCase()
}

export function validateAccountDeletionInput(input: AccountDeletionInput, accountEmail: string) {
  const expectedEmail = normalizeAccountEmail(accountEmail)
  const suppliedEmail = normalizeAccountEmail(input.email)
  if (!input.password.trim()) return 'Enter your current password.'
  if (!suppliedEmail || suppliedEmail !== expectedEmail) return 'Enter the exact email address on this account.'
  if (input.confirmationPhrase.trim() !== ACCOUNT_DELETION_PHRASE) return `Type ${ACCOUNT_DELETION_PHRASE} to confirm.`
  if (!input.acknowledged) return 'Confirm that you understand this action is permanent.'
  return null
}

export function isRecentReauthentication(authTime: number | undefined, nowSeconds = Math.floor(Date.now() / 1000)) {
  return typeof authTime === 'number' && authTime > 0 && nowSeconds - authTime >= 0 && nowSeconds - authTime <= ACCOUNT_DELETION_REAUTH_WINDOW_SECONDS
}
