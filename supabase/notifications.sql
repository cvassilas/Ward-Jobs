-- Ward Jobs: push notifications (run once, after setup.sql). Safe to run more than once.
-- Stores which phones want a "your team list changed" alert. No patient data is stored here.

create table if not exists public.ward_push_subs (
  endpoint  text primary key,
  space_id  text not null,
  p256dh    text not null,
  auth      text not null,
  created   timestamptz not null default now(),
  last_sent timestamptz
);
create index if not exists ward_push_subs_space on public.ward_push_subs (space_id);
alter table public.ward_push_subs enable row level security;
revoke all on public.ward_push_subs from anon, authenticated;

create or replace function public.ward_subscribe(p_space text, p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(p_space) < 20 or p_endpoint !~ '^https://' then raise exception 'bad subscription'; end if;
  insert into public.ward_push_subs (endpoint, space_id, p256dh, auth)
  values (p_endpoint, p_space, p_p256dh, p_auth)
  on conflict (endpoint) do update set space_id = excluded.space_id, p256dh = excluded.p256dh, auth = excluded.auth;
end; $$;

create or replace function public.ward_unsubscribe(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.ward_push_subs where endpoint = p_endpoint;
$$;

revoke all on function public.ward_subscribe(text, text, text, text) from public;
revoke all on function public.ward_unsubscribe(text) from public;
grant execute on function public.ward_subscribe(text, text, text, text) to anon, authenticated;
grant execute on function public.ward_unsubscribe(text) to anon, authenticated;
