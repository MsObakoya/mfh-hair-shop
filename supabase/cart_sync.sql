-- Run in Supabase Dashboard > SQL Editor before trying cross-device cart sync.
-- Each signed-in user may only see and change their own cart.
create table if not exists public.carts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.carts enable row level security;
grant select, insert, update on public.carts to authenticated;

drop policy if exists "Customers can read their own cart" on public.carts;
create policy "Customers can read their own cart" on public.carts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Customers can create their own cart" on public.carts;
create policy "Customers can create their own cart" on public.carts
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Customers can update their own cart" on public.carts;
create policy "Customers can update their own cart" on public.carts
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
