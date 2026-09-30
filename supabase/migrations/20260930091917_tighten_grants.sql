-- Supabase grants ALL on new tables to `authenticated` by default, which
-- overrides column-level grants. Revoke the table-level rights first, then
-- grant back only what the app needs.

-- Nobody should be able to TRUNCATE (it bypasses row level security).
revoke truncate, references, trigger on all tables in schema public from authenticated, anon;

-- posts: owners may edit caption/occasion only (not is_hidden, ratings, owner).
revoke update on public.posts from authenticated;
grant update (caption, occasion) on public.posts to authenticated;

-- profiles: created by the sign-up trigger; users edit display name, bio, photo.
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name, bio, avatar_path) on public.profiles to authenticated;

-- comments can't be edited, only deleted.
revoke update on public.comments from authenticated;

-- notifications are written by triggers; users can only mark them read.
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- reports are write-only for users.
revoke all on public.reports from authenticated;
grant insert on public.reports to authenticated;

-- closet/outfits/likes/ratings/follows/blocks/tags keep full rights, limited by RLS.
