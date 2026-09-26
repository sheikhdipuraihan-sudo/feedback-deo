alter table public.workspaces add column if not exists plan text not null default 'free';

DO $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workspaces_plan_check') then
    alter table public.workspaces add constraint workspaces_plan_check check (plan in ('free', 'pro'));
  end if;
end $$;

create or replace function public.get_public_workspace(workspace_slug text)
returns table (id uuid, name text, slug text)
language sql
security definer
set search_path = public
as $$
  select w.id, w.name, w.slug
  from public.workspaces w
  where w.slug = workspace_slug
  limit 1;
$$;

grant execute on function public.get_public_workspace(text) to anon, authenticated;

create or replace function public.submit_public_feedback(
  workspace_slug text,
  feedback_rating integer,
  feedback_comment text,
  feedback_table_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace uuid;
  target_plan text;
  month_count integer;
begin
  if feedback_rating < 1 or feedback_rating > 5 then
    raise exception 'rating must be between 1 and 5';
  end if;
  if length(trim(feedback_comment)) < 1 or length(trim(feedback_comment)) > 2000 then
    raise exception 'comment must be between 1 and 2000 characters';
  end if;

  select w.id, w.plan into target_workspace, target_plan
  from public.workspaces w
  where w.slug = workspace_slug;

  if target_workspace is null then
    raise exception 'workspace not found';
  end if;

  if feedback_table_id is not null and not exists (
    select 1 from public.tables t
    where t.id = feedback_table_id and t.workspace_id = target_workspace
  ) then
    raise exception 'table does not belong to workspace';
  end if;

  if target_plan = 'free' then
    select count(*) into month_count
    from public.feedback f
    where f.workspace_id = target_workspace
      and f.created_at >= date_trunc('month', now());
    if month_count >= 30 then
      raise exception 'free monthly feedback limit reached';
    end if;
  end if;

  insert into public.feedback (workspace_id, table_id, rating, comment)
  values (target_workspace, feedback_table_id, feedback_rating, trim(feedback_comment));
end;
$$;

grant execute on function public.submit_public_feedback(text, integer, text, uuid) to anon, authenticated;

create or replace function public.prevent_workspace_slug_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.slug is distinct from old.slug then
    raise exception 'workspace uid cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists workspace_slug_immutable on public.workspaces;
create trigger workspace_slug_immutable
before update on public.workspaces
for each row execute function public.prevent_workspace_slug_change();
