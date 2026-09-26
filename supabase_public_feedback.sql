

drop function if exists public.get_admin_workspaces();
create function public.get_admin_workspaces()
returns table (id uuid, name text, slug text, plan text, status text, owner_id text, created_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_subscription_admin() then raise exception 'admin access required'; end if;
  return query select w.id, w.name, w.slug, w.plan, w.status, w.owner_id, w.created_at from public.workspaces w order by w.created_at desc;
end;
$$;
grant execute on function public.get_admin_workspaces() to authenticated;

drop function if exists public.get_subscription_payments();
create function public.get_subscription_payments()
returns table (id uuid, workspace_id uuid, workspace_name text, workspace_slug text, submitted_by text, amount integer, bkash_number text, transaction_id text, status text, admin_note text, created_at timestamptz, reviewed_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_subscription_admin() then raise exception 'admin access required'; end if;
  return query select p.id, p.workspace_id, w.name, w.slug, p.submitted_by, p.amount, p.bkash_number, p.transaction_id, p.status, p.admin_note, p.created_at, p.reviewed_at from public.subscription_payments p join public.workspaces w on w.id = p.workspace_id order by p.created_at desc;
end;
$$;
grant execute on function public.get_subscription_payments() to authenticated;

create or replace function public.review_subscription_payment(payment_id uuid, decision text, note text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare target_workspace uuid;
begin
  if not public.is_subscription_admin() then raise exception 'admin access required'; end if;
  if decision not in ('approved', 'rejected') then raise exception 'invalid payment decision'; end if;
  select workspace_id into target_workspace from public.subscription_payments where id = payment_id;
  if target_workspace is null then raise exception 'payment not found'; end if;
  update public.subscription_payments set status = decision, admin_note = nullif(trim(coalesce(note, '')), ''), reviewed_by = (auth.jwt() ->> 'sub'), reviewed_at = now() where id = payment_id;
  if decision = 'approved' then update public.workspaces set plan = 'pro' where id = target_workspace; end if;
end;
$$;
grant execute on function public.review_subscription_payment(uuid, text, text) to authenticated;

-- Firebase third-party auth admin mapping.
alter table public.subscription_admins add column if not exists firebase_uid text;
update public.subscription_admins set firebase_uid = 'nyiJyjhI1DNchm5kuU6nkgDfVLG2' where lower(email) = lower('contact.anidaku@gmail.com');
create or replace function public.is_subscription_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscription_admins a
    where a.firebase_uid = (auth.jwt() ->> 'sub')
       or lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', auth.jwt() ->> 'user_email', ''))
  );
$$;

-- Pro Telegram notifications: one connection per workspace.
create table if not exists public.telegram_link_tokens (
  token text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.telegram_connections (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  chat_id text not null,
  telegram_username text,
  webhook_url text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.telegram_link_tokens enable row level security;
alter table public.telegram_connections enable row level security;
revoke all on public.telegram_link_tokens from anon, authenticated;
revoke all on public.telegram_connections from anon, authenticated;
create or replace function public.create_telegram_link_token()
returns text language plpgsql security definer set search_path = public
as $$
declare current_workspace uuid; new_token text;
begin
  select id into current_workspace from public.workspaces where owner_id = (auth.jwt() ->> 'sub') and status = 'active' order by created_at asc limit 1;
  if current_workspace is null then raise exception 'workspace not found'; end if;
  if not exists (select 1 from public.workspaces where id = current_workspace and plan = 'pro') then raise exception 'telegram notifications require pro'; end if;
  delete from public.telegram_link_tokens where workspace_id = current_workspace or expires_at < now();
  new_token := replace(gen_random_uuid()::text, '-', '');
  insert into public.telegram_link_tokens(token, workspace_id) values (new_token, current_workspace);
  return new_token;
end;
$$;
grant execute on function public.create_telegram_link_token() to authenticated;
create or replace function public.get_telegram_connection()
returns table(connected boolean, telegram_username text, connected_at timestamptz)
language sql security definer set search_path = public
as $$
  select (c.workspace_id is not null), c.telegram_username, c.connected_at
  from public.workspaces w left join public.telegram_connections c on c.workspace_id = w.id
  where w.owner_id = (auth.jwt() ->> 'sub') and w.status = 'active'
  order by w.created_at asc limit 1;
$$;
grant execute on function public.get_telegram_connection() to authenticated;
create or replace function public.claim_telegram_connection(link_token text, telegram_chat_id text, telegram_username text, notification_webhook_url text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare target_workspace uuid;
begin
  if length(coalesce(telegram_chat_id, '')) < 1 or length(coalesce(notification_webhook_url, '')) < 20 then raise exception 'invalid telegram connection'; end if;
  select workspace_id into target_workspace from public.telegram_link_tokens t join public.workspaces w on w.id = t.workspace_id where t.token = link_token and t.used_at is null and t.expires_at > now() and w.plan = 'pro' and w.status = 'active' limit 1;
  if target_workspace is null then raise exception 'invalid or expired connection code'; end if;
  insert into public.telegram_connections(workspace_id, chat_id, telegram_username, webhook_url) values (target_workspace, telegram_chat_id, nullif(telegram_username, ''), notification_webhook_url)
  on conflict (workspace_id) do update set chat_id = excluded.chat_id, telegram_username = excluded.telegram_username, webhook_url = excluded.webhook_url, updated_at = now();
  update public.telegram_link_tokens set used_at = now() where token = link_token;
  return jsonb_build_object('workspace_id', target_workspace);
end;
$$;
grant execute on function public.claim_telegram_connection(text, text, text, text) to anon, authenticated;
create or replace function public.get_telegram_notification_target(workspace_slug text)
returns table(webhook_url text)
language sql security definer set search_path = public
as $$
  select c.webhook_url from public.workspaces w join public.telegram_connections c on c.workspace_id = w.id where w.slug = workspace_slug and w.plan = 'pro' and w.status = 'active' limit 1;
$$;
grant execute on function public.get_telegram_notification_target(text) to anon, authenticated;
