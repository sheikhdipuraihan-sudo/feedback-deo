-- Feedback Deo custom auth migration
-- Safe additive migration: creates only new auth tables and does not alter or delete existing data.

create table if not exists public.auth_users (
  id text primary key,
  email text not null,
  password_hash text,
  firebase_uid text unique,
  google_sub text unique,
  role text not null default 'authenticated' check (role in ('authenticated', 'admin')),
  email_verified boolean not null default false,
  business_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists auth_users_email_lower_idx on public.auth_users (lower(email));
create index if not exists auth_users_firebase_uid_idx on public.auth_users (firebase_uid);
create index if not exists auth_users_google_sub_idx on public.auth_users (google_sub);

create table if not exists public.auth_sessions (
  token_hash text primary key,
  user_id text not null references public.auth_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists auth_sessions_user_idx on public.auth_sessions(user_id);
create index if not exists auth_sessions_expiry_idx on public.auth_sessions(expires_at);

create table if not exists public.auth_verification_tokens (
  token_hash text primary key,
  user_id text not null references public.auth_users(id) on delete cascade,
  purpose text not null check (purpose in ('email_verification', 'password_reset')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists auth_verification_user_purpose_idx on public.auth_verification_tokens(user_id, purpose, created_at desc);

alter table public.auth_users enable row level security;
alter table public.auth_sessions enable row level security;
alter table public.auth_verification_tokens enable row level security;
revoke all on public.auth_users, public.auth_sessions, public.auth_verification_tokens from anon, authenticated;

-- All access is server-side through the service role; no client can read these tables directly.
