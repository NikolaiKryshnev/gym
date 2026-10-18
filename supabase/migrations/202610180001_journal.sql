begin;

create table if not exists public.training_journals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 8388608),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.training_journals enable row level security;
revoke all on public.training_journals from public,anon,authenticated;
grant select, insert, update on public.training_journals to authenticated;

drop policy if exists journal_select_own on public.training_journals;
create policy journal_select_own on public.training_journals for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists journal_insert_own on public.training_journals;
create policy journal_insert_own on public.training_journals for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists journal_update_own on public.training_journals;
create policy journal_update_own on public.training_journals for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.save_training_journal(p_payload jsonb, p_expected_revision bigint, p_user_id uuid)
returns table(revision bigint, updated_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare affected integer;
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_expected_revision = 0 then
    insert into public.training_journals(user_id,payload)
      values(auth.uid(),p_payload) on conflict (user_id) do nothing;
  else
    update public.training_journals j
      set payload=p_payload, revision=j.revision+1, updated_at=now()
      where j.user_id=auth.uid() and j.revision=p_expected_revision;
  end if;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Journal changed on another device' using errcode = '40001'; end if;
  return query select j.revision,j.updated_at from public.training_journals j where j.user_id=auth.uid();
end;
$$;

revoke all on function public.save_training_journal(jsonb,bigint,uuid) from public,anon;
grant execute on function public.save_training_journal(jsonb,bigint,uuid) to authenticated;
commit;
