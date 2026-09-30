-- rls_auto_enable is an event-trigger helper (trigger "ensure_rls"); no app user should call it via the API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
