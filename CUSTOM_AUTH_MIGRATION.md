# Feedback Deo custom authentication migration

This migration replaces the normal login/signup/session flow with:

- bcrypt password hashes
- database-backed sessions in an HttpOnly cookie
- short-lived Supabase JWTs signed by `SUPABASE_JWT_SECRET`
- Nodemailer password reset and email confirmation

## Data safety

The migration is additive. It does not delete or rewrite existing `workspaces`, `feedback`, payment, QR, or Telegram records. Existing Firebase account UIDs remain valid as `owner_id` values.

Firebase account metadata is imported in bulk through the protected endpoint documented below. New `auth_users` rows retain each Firebase UID as their primary ID, so existing workspace ownership remains attached. Existing accounts found by verified email are linked to their canonical auth row, and their legacy workspaces are mapped to that row if its ID differs.

Firebase password hashes are not exportable. Imported accounts therefore need to continue with Google using their verified email or request a reset link to set a new custom password. Firebase remains available during the transition for any accounts that have not yet been imported or completed their credential change.

## Required setup

1. Run [`supabase_custom_auth.sql`](./supabase_custom_auth.sql) in the Supabase SQL editor. It only creates new `auth_*` tables.
2. Add `SUPABASE_JWT_SECRET` to the deployment environment. Use the JWT secret from the Supabase project settings; do not use the service-role key.
3. Keep the existing `NEXT_PUBLIC_SUPABASE_URL`, Supabase publishable/anon key, and `SUPABASE_SERVICE_ROLE_KEY` values.
4. Keep the existing Gmail/Nodemailer variables for password reset and account confirmation.
5. Set the Firebase Admin credentials and a strong `FIREBASE_ACCOUNT_IMPORT_SECRET` for the one-time import endpoint.
6. Configure a Google OAuth client with `https://feedback-deo.vercel.app/api/auth/google/callback` as an authorized redirect URI, then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
7. Run the bulk import below and retain Firebase Admin credentials during the transition. Do not remove Firebase credentials until the transition is complete; Firebase never exposes password hashes.

## Bulk-import Firebase account metadata

After the new `auth_*` tables and deployment secrets are configured, import the Firebase account metadata once by calling the protected endpoint from a trusted terminal (never expose the import secret in browser code):

```sh
curl --fail-with-body -X POST \
  -H "x-firebase-import-secret: $FIREBASE_ACCOUNT_IMPORT_SECRET" \
  https://feedback-deo.vercel.app/api/auth/import-firebase
```

The endpoint pages through Firebase users and imports their UID, normalized email, email-verification status, and display name. New auth rows use the Firebase UID as their primary ID, keeping existing `owner_id` values intact. If an account with the same verified email already exists under another ID, the importer links the Firebase UID and reassigns that UID's existing workspaces to the canonical account ID. Unverified email collisions are skipped instead of merged. The operation is safe to retry; review the `imported`, `linked`, and `skipped` counts returned by the endpoint.

Firebase does not expose password hashes, so the import does not move passwords. Afterward, users can continue with Google using the same verified email, or request a password-reset link to set a custom password. Keep Firebase credentials available until users have transitioned and the compatibility period is over.
