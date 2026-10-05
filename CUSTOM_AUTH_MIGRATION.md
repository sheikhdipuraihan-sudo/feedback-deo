# Feedback Deo custom authentication migration

This migration replaces the normal login/signup/session flow with:

- bcrypt password hashes
- database-backed sessions in an HttpOnly cookie
- short-lived Supabase JWTs signed by `SUPABASE_JWT_SECRET`
- Nodemailer password reset and email confirmation

## Data safety

The migration is additive. It does not delete or rewrite existing `workspaces`, `feedback`, payment, QR, or Telegram records. Existing Firebase account UIDs remain valid as `owner_id` values.

An existing Firebase user is migrated on the first successful login:

1. The custom login endpoint notices that no custom password record exists.
2. The browser verifies the old password through Firebase one final time.
3. The server creates an `auth_users` record using the existing Firebase UID.
4. The submitted password is stored only as a bcrypt hash.
5. A custom HttpOnly session is issued.

After that first login, the account uses custom auth. Firebase remains only as a compatibility bridge for accounts that have not migrated yet.

## Required setup

1. Run [`supabase_custom_auth.sql`](./supabase_custom_auth.sql) in the Supabase SQL editor. It only creates new `auth_*` tables.
2. Add `SUPABASE_JWT_SECRET` to the deployment environment. Use the JWT secret from the Supabase project settings; do not use the service-role key.
3. Keep the existing `NEXT_PUBLIC_SUPABASE_URL`, Supabase publishable/anon key, and `SUPABASE_SERVICE_ROLE_KEY` values.
4. Keep the existing Gmail/Nodemailer variables for password reset and account confirmation.

Do not remove Firebase credentials until all old users have logged in at least once and have been migrated. The application does not bulk-export or alter Firebase passwords because Firebase never exposes password hashes.
