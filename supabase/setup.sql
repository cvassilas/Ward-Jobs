-- Ward Jobs: encrypted team sync.
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.
-- The server only ever stores encrypted records. Phones encrypt with a key that never leaves them.

create table if not exists public.ward_records (
  space_id text not null,
  id       text not null,
  seq      bigint not null default 0,
  iv       text not null,
  data     text not null,
  updated  timestamptz not null default now(),
  primary key (space_id, id)
);
create sequence if not exists public.ward_seq;
create index if not exists ward_records_space_seq on public.ward_records (space_id, seq);

-- No direct table access: everything goes through the two functions below.
alter table public.ward_records enable row level security;
revoke all on public.ward_records from anon, authenticated;

create or replace function public.ward_pull(p_space text, p_since bigint)
returns table (id text, seq bigint, iv text, data text)
language sql security definer set search_path = public as $$
  select r.id, r.seq, r.iv, r.data from public.ward_records r
  where length(p_space) >= 20 and r.space_id = p_space and r.seq > p_since
  order by r.seq limit 500;
$$;

create or replace function public.ward_push(p_space text, p_rows jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare r jsonb; n bigint := 0;
begin
  if length(p_space) < 20 then raise exception 'bad space'; end if;
  if jsonb_array_length(p_rows) > 500 then raise exception 'too many rows'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    if length(r->>'data') > 200000 then continue; end if;
    insert into public.ward_records (space_id, id, seq, iv, data, updated)
    values (p_space, r->>'id', nextval('public.ward_seq'), r->>'iv', r->>'data', now())
    on conflict (space_id, id) do update
      set seq = nextval('public.ward_seq'), iv = excluded.iv, data = excluded.data, updated = now();
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.ward_pull(text, bigint) from public;
revoke all on function public.ward_push(text, jsonb) from public;
grant execute on function public.ward_pull(text, bigint) to anon, authenticated;
grant execute on function public.ward_push(text, jsonb) to anon, authenticated;

-- Tidy-up: encrypted records not touched for 30 days are removed (needs the pg_cron extension;
-- skip this block if it errors – it is optional).
-- create extension if not exists pg_cron;
-- select cron.schedule('ward-jobs-tidy', '0 3 * * *', $$delete from public.ward_records where updated < now() - interval '30 days'$$);
