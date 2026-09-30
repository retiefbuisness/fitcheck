-- Internal helper functions should not be callable through the public API.
-- Trigger functions don't need EXECUTE grants to run as triggers.
revoke execute on function public.validate_new_user() from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.auto_hide_reported() from anon, authenticated, public;
revoke execute on function public.on_social_insert() from anon, authenticated, public;
revoke execute on function public.on_block_insert() from anon, authenticated, public;
revoke execute on function public.notify(uuid, uuid, text, uuid) from anon, authenticated, public;

-- The block check is needed by RLS policies, so it moves to a private schema
-- that the API doesn't expose. It only answers for the signed-in user.
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_blocked_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = (select auth.uid()) and blocked_id = other)
       or (blocker_id = other and blocked_id = (select auth.uid()))
  );
$$;
revoke execute on function private.is_blocked_with(uuid) from public, anon;
grant execute on function private.is_blocked_with(uuid) to authenticated;

drop policy "visible posts" on public.posts;
create policy "visible posts" on public.posts
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (not is_hidden and not private.is_blocked_with(user_id))
  );

drop policy "post owner tags" on public.post_tags;
create policy "post owner tags" on public.post_tags
  for insert to authenticated
  with check (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = (select auth.uid()))
    and not private.is_blocked_with(tagged_user_id)
  );

drop policy "visible comments" on public.comments;
create policy "visible comments" on public.comments
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      not is_hidden
      and not private.is_blocked_with(user_id)
      and exists (select 1 from public.posts p where p.id = post_id)
    )
  );

drop policy "users comment on visible posts" on public.comments;
create policy "users comment on visible posts" on public.comments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not is_hidden
    and exists (select 1 from public.posts p
                where p.id = post_id and not private.is_blocked_with(p.user_id))
  );

drop policy "users follow" on public.follows;
create policy "users follow" on public.follows
  for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and not private.is_blocked_with(following_id)
  );

-- notify() keeps using the two-argument check internally (runs as owner).
revoke execute on function public.is_blocked_between(uuid, uuid) from anon, authenticated, public;
alter function public.is_blocked_between(uuid, uuid) set schema private;

create or replace function public.notify(p_user uuid, p_actor uuid, p_type text, p_post uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user is null or p_user = p_actor or private.is_blocked_between(p_user, p_actor) then
    return;
  end if;
  insert into public.notifications (user_id, actor_id, type, post_id)
  values (p_user, p_actor, p_type, p_post);
end;
$$;
revoke execute on function public.notify(uuid, uuid, text, uuid) from anon, authenticated, public;
alter function public.notify(uuid, uuid, text, uuid) set schema private;

create or replace function public.on_social_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  if tg_table_name = 'follows' then
    perform private.notify(new.following_id, new.follower_id, 'follow', null);
    return new;
  end if;

  select user_id into owner from public.posts where id = new.post_id;

  if tg_table_name = 'likes' then
    perform private.notify(owner, new.user_id, 'like', new.post_id);
  elsif tg_table_name = 'comments' then
    perform private.notify(owner, new.user_id, 'comment', new.post_id);
  elsif tg_table_name = 'post_ratings' then
    perform private.notify(owner, new.user_id, 'rating', new.post_id);
  elsif tg_table_name = 'post_tags' then
    perform private.notify(new.tagged_user_id, owner, 'tag', new.post_id);
  end if;
  return new;
end;
$$;
revoke execute on function public.on_social_insert() from anon, authenticated, public;

-- Move the remaining trigger functions out of the API schema too.
alter function public.validate_new_user() set schema private;
alter function public.handle_new_user() set schema private;
alter function public.auto_hide_reported() set schema private;
alter function public.on_social_insert() set schema private;
alter function public.on_block_insert() set schema private;

-- username_available stays public on purpose (sign-up screen), but only
-- returns true/false for one exact name.
