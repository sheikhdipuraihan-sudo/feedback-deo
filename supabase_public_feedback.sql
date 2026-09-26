

create or replace function public.get_public_workspace(workspace_slug text)
returns table (id uuid, name text, slug text)
language sql security definer set search_path = public
as $$ select w.id, w.name, w.slug from public.workspaces w where w.slug = workspace_slug and w.status = 'active' limit 1; $$;
grant execute on function public.get_public_workspace(text) to anon, authenticated;

drop function if exists public.get_admin_workspaces();
create function public.get_admin_workspaces()
returns table (id uuid, name text, slug text, plan text, status text, owner_id uuid, created_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_subscription_admin() then raise exception 'admin access required'; end if;
  return query select w.id, w.name, w.slug, w.plan, w.status, w.owner_id, w.created_at from public.workspaces w order by w.created_at desc;
end;
$$;
grant execute on function public.get_admin_workspaces() to authenticated;
