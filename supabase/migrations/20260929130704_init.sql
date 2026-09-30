-- Fit Check: initial schema
-- Profiles, digital closet, saved outfits, social feed (posts, tags, likes,
-- comments, community ratings, follows), safety (blocks, reports, auto-hide),
-- notifications, and photo storage.

-- ---------------------------------------------------------------------------
-- Profiles + sign-up (18+ age gate, terms acceptance)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,20}$'),
  display_name text check (char_length(display_name) <= 40),
  bio text check (char_length(bio) <= 160),
  avatar_path text,
  adult_confirmed_at timestamptz not null default now(),
  terms_accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Runs before the auth user row is written: enforces 18+ and terms acceptance,
-- then strips the date of birth so we never store it.
create or replace function public.validate_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  dob date;
  uname text;
begin
  uname := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  if uname !~ '^[a-z0-9_.]{3,20}$' then
    raise exception 'Username must be 3-20 characters: letters, numbers, _ or .';
  end if;

  begin
    dob := (new.raw_user_meta_data ->> 'date_of_birth')::date;
  exception when others then
    dob := null;
  end;
  if dob is null then
    raise exception 'A valid date of birth is required';
  end if;
  if dob > (current_date - interval '18 years')::date then
    raise exception 'You must be 18 or older to use Fit Check';
  end if;

  if coalesce((new.raw_user_meta_data ->> 'accepted_terms')::boolean, false) is not true then
    raise exception 'You must accept the Terms of Use and Privacy Policy';
  end if;

  new.raw_user_meta_data := (new.raw_user_meta_data - 'date_of_birth')
    || jsonb_build_object('username', uname, 'age_verified', true);
  return new;
end;
$$;

create trigger before_auth_user_created
  before insert on auth.users
  for each row execute function public.validate_new_user();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), new.raw_user_meta_data ->> 'username'), 40)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets the sign-up screen check a username before an account exists.
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.profiles where username = lower(p_username));
$$;

-- ---------------------------------------------------------------------------
-- Blocks (defined early; other policies depend on it)
-- ---------------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- ---------------------------------------------------------------------------
-- Digital closet + saved outfits (private to the owner)
-- ---------------------------------------------------------------------------

create table public.closet_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  image_path text,
  name text check (char_length(name) <= 60),
  category text not null check (category in
    ('top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory', 'bag', 'activewear', 'swimwear', 'other')),
  color text not null check (char_length(color) <= 20),
  secondary_color text check (char_length(secondary_color) <= 20),
  pattern text not null default 'solid' check (char_length(pattern) <= 20),
  formality smallint not null default 2 check (formality between 1 and 5),
  warmth smallint not null default 2 check (warmth between 1 and 5),
  notes text check (char_length(notes) <= 300),
  created_at timestamptz not null default now()
);
create index closet_items_user_idx on public.closet_items (user_id, created_at desc);

create table public.saved_outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  item_ids uuid[] not null check (cardinality(item_ids) between 1 and 8),
  occasion text check (char_length(occasion) <= 60),
  explanation text check (char_length(explanation) <= 2000),
  source text not null check (source in ('ai', 'rules')),
  created_at timestamptz not null default now()
);
create index saved_outfits_user_idx on public.saved_outfits (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Social: posts, tags, likes, comments, community ratings, follows
-- ---------------------------------------------------------------------------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  image_path text not null,
  caption text check (char_length(caption) <= 500),
  occasion text check (char_length(occasion) <= 60),
  -- Produced on the poster's device (Gemini Nano or the style-rules fallback).
  ai_rating smallint check (ai_rating between 1 and 5),
  ai_feedback text check (char_length(ai_feedback) <= 2000),
  ai_source text check (ai_source in ('gemini_nano', 'rules')),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index posts_user_idx on public.posts (user_id, created_at desc);
create index posts_created_idx on public.posts (created_at desc);

create table public.post_tags (
  post_id uuid not null references public.posts (id) on delete cascade,
  tagged_user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (post_id, tagged_user_id)
);
create index post_tags_user_idx on public.post_tags (tagged_user_id);

create table public.likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index likes_user_idx on public.likes (user_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);
create index comments_user_idx on public.comments (user_id);

create table public.post_ratings (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_ratings_user_idx on public.post_ratings (user_id);

create table public.follows (
  follower_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_idx on public.follows (following_id);

-- ---------------------------------------------------------------------------
-- Reports + automatic hiding (Play Store UGC / child-safety requirements)
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid default auth.uid() references public.profiles (id) on delete set null,
  target_type text not null check (target_type in ('post', 'comment', 'user', 'ai_response')),
  target_id uuid,
  reason text not null check (reason in
    ('spam', 'harassment', 'nudity', 'hate', 'violence', 'self_harm', 'minor_safety', 'offensive_ai', 'other')),
  details text check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index reports_target_idx on public.reports (target_type, target_id);
create index reports_status_idx on public.reports (status, created_at);

-- A post/comment is hidden immediately on a child-safety report, or after
-- 3 different people report it. A moderator reviews it in the dashboard.
create or replace function public.auto_hide_reported()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reporter_count int;
begin
  if new.target_type not in ('post', 'comment') or new.target_id is null then
    return new;
  end if;

  select count(distinct reporter_id) into reporter_count
  from public.reports
  where target_type = new.target_type and target_id = new.target_id;

  if new.reason = 'minor_safety' or reporter_count >= 3 then
    if new.target_type = 'post' then
      update public.posts set is_hidden = true where id = new.target_id;
    else
      update public.comments set is_hidden = true where id = new.target_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger reports_auto_hide
  after insert on public.reports
  for each row execute function public.auto_hide_reported();

-- ---------------------------------------------------------------------------
-- Notifications (likes, comments, tags, follows, ratings)
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('like', 'comment', 'tag', 'follow', 'rating')),
  post_id uuid references public.posts (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_actor_idx on public.notifications (actor_id);
create index notifications_post_idx on public.notifications (post_id);

create or replace function public.notify(p_user uuid, p_actor uuid, p_type text, p_post uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user is null or p_user = p_actor or public.is_blocked_between(p_user, p_actor) then
    return;
  end if;
  insert into public.notifications (user_id, actor_id, type, post_id)
  values (p_user, p_actor, p_type, p_post);
end;
$$;

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
    perform public.notify(new.following_id, new.follower_id, 'follow', null);
    return new;
  end if;

  select user_id into owner from public.posts where id = new.post_id;

  if tg_table_name = 'likes' then
    perform public.notify(owner, new.user_id, 'like', new.post_id);
  elsif tg_table_name = 'comments' then
    perform public.notify(owner, new.user_id, 'comment', new.post_id);
  elsif tg_table_name = 'post_ratings' then
    perform public.notify(owner, new.user_id, 'rating', new.post_id);
  elsif tg_table_name = 'post_tags' then
    perform public.notify(new.tagged_user_id, owner, 'tag', new.post_id);
  end if;
  return new;
end;
$$;

create trigger likes_notify after insert on public.likes
  for each row execute function public.on_social_insert();
create trigger comments_notify after insert on public.comments
  for each row execute function public.on_social_insert();
create trigger ratings_notify after insert on public.post_ratings
  for each row execute function public.on_social_insert();
create trigger tags_notify after insert on public.post_tags
  for each row execute function public.on_social_insert();
create trigger follows_notify after insert on public.follows
  for each row execute function public.on_social_insert();

-- ---------------------------------------------------------------------------
-- Feed view (runs with the caller's permissions, so RLS still applies)
-- ---------------------------------------------------------------------------

create view public.post_feed with (security_invoker = true) as
select
  p.id,
  p.user_id,
  p.image_path,
  p.caption,
  p.occasion,
  p.ai_rating,
  p.ai_feedback,
  p.ai_source,
  p.is_hidden,
  p.created_at,
  pr.username,
  pr.display_name,
  pr.avatar_path,
  (select count(*) from public.likes l where l.post_id = p.id) as like_count,
  (select count(*) from public.comments c where c.post_id = p.id and not c.is_hidden) as comment_count,
  (select round(avg(r.stars)::numeric, 1) from public.post_ratings r where r.post_id = p.id) as avg_rating,
  (select count(*) from public.post_ratings r where r.post_id = p.id) as rating_count,
  exists (select 1 from public.likes l where l.post_id = p.id and l.user_id = (select auth.uid())) as liked_by_me,
  (select r.stars from public.post_ratings r where r.post_id = p.id and r.user_id = (select auth.uid())) as my_rating
from public.posts p
join public.profiles pr on pr.id = p.user_id;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.blocks enable row level security;
alter table public.closet_items enable row level security;
alter table public.saved_outfits enable row level security;
alter table public.posts enable row level security;
alter table public.post_tags enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.post_ratings enable row level security;
alter table public.follows enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;

-- Only signed-in users can use the API; anonymous visitors see nothing.
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

grant select, insert, update, delete on
  public.blocks, public.closet_items, public.saved_outfits, public.post_tags,
  public.likes, public.comments, public.post_ratings, public.follows, public.notifications
  to authenticated;
grant select, insert, delete on public.posts to authenticated;
grant update (caption, occasion) on public.posts to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, bio, avatar_path) on public.profiles to authenticated;
grant insert on public.reports to authenticated;
grant select on public.post_feed to authenticated;
revoke update on public.comments from authenticated;
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- profiles
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);
create policy "users update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- blocks
create policy "users see own blocks" on public.blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
create policy "users block others" on public.blocks
  for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "users unblock" on public.blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

-- closet_items + saved_outfits: owner only
create policy "owner manages closet" on public.closet_items
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "owner manages outfits" on public.saved_outfits
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- posts
create policy "visible posts" on public.posts
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (not is_hidden and not public.is_blocked_between((select auth.uid()), user_id))
  );
create policy "users create own posts" on public.posts
  for insert to authenticated with check (user_id = (select auth.uid()) and not is_hidden);
create policy "users edit own posts" on public.posts
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users delete own posts" on public.posts
  for delete to authenticated using (user_id = (select auth.uid()));

-- post_tags: the post owner tags people; tagged people can remove themselves
create policy "tags on visible posts" on public.post_tags
  for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "post owner tags" on public.post_tags
  for insert to authenticated
  with check (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = (select auth.uid()))
    and not public.is_blocked_between((select auth.uid()), tagged_user_id)
  );
create policy "owner or tagged user removes tag" on public.post_tags
  for delete to authenticated
  using (
    tagged_user_id = (select auth.uid())
    or exists (select 1 from public.posts p where p.id = post_id and p.user_id = (select auth.uid()))
  );

-- likes
create policy "likes readable" on public.likes
  for select to authenticated using (true);
create policy "users like visible posts" on public.likes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy "users unlike" on public.likes
  for delete to authenticated using (user_id = (select auth.uid()));

-- comments
create policy "visible comments" on public.comments
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      not is_hidden
      and not public.is_blocked_between((select auth.uid()), user_id)
      and exists (select 1 from public.posts p where p.id = post_id)
    )
  );
create policy "users comment on visible posts" on public.comments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not is_hidden
    and exists (select 1 from public.posts p
                where p.id = post_id and not public.is_blocked_between((select auth.uid()), p.user_id))
  );
create policy "author or post owner deletes comment" on public.comments
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.posts p where p.id = post_id and p.user_id = (select auth.uid()))
  );

-- community ratings: can't rate your own fit
create policy "ratings readable" on public.post_ratings
  for select to authenticated using (true);
create policy "users rate others' visible posts" on public.post_ratings
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id and p.user_id <> (select auth.uid()))
  );
create policy "users change own rating" on public.post_ratings
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users remove own rating" on public.post_ratings
  for delete to authenticated using (user_id = (select auth.uid()));

-- follows
create policy "follows readable" on public.follows
  for select to authenticated using (true);
create policy "users follow" on public.follows
  for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and not public.is_blocked_between(follower_id, following_id)
  );
create policy "users unfollow" on public.follows
  for delete to authenticated using (follower_id = (select auth.uid()));

-- reports: write-only for users; moderators use the dashboard
create policy "users file reports" on public.reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));

-- notifications
create policy "users read own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users mark own notifications read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users clear own notifications" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

-- Blocking someone also removes follows in both directions.
create or replace function public.on_block_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end;
$$;

create trigger blocks_cleanup after insert on public.blocks
  for each row execute function public.on_block_insert();

-- ---------------------------------------------------------------------------
-- Photo storage (all private; files live under <user id>/...)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('closet', 'closet', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('posts', 'posts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "closet photos: owner only" on storage.objects
  for select to authenticated
  using (bucket_id = 'closet' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "post and avatar photos: signed-in users can view" on storage.objects
  for select to authenticated
  using (bucket_id in ('posts', 'avatars'));

create policy "users upload to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('closet', 'posts', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users replace own files" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('closet', 'posts', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users delete own files" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('closet', 'posts', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
