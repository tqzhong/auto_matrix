-- Run once in the dedicated FREE Supabase project's SQL editor.
-- Only the game's server secret can read/write these saves.
create table if not exists public.matrix_checkpoints (
  id text primary key check (id = 'world'),
  revision integer not null check (revision > 0),
  payload text not null,
  updated_at timestamptz not null default now()
);
-- A new instance waits for the previous writer's final save before starting the world.
alter table public.matrix_checkpoints add column if not exists lease_until timestamptz;
alter table public.matrix_checkpoints enable row level security;
revoke all on public.matrix_checkpoints from anon, authenticated;
grant select, insert, update on public.matrix_checkpoints to service_role;
