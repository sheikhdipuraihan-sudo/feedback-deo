

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
