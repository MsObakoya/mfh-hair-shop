-- Run in Supabase Dashboard > SQL Editor after creating your project.
-- Prices are in naira kobo (NGN minor units): ₦12,500 = 1250000.
create table if not exists public.products (
  id text primary key,
  name text not null,
  description text not null default '',
  category text not null,
  material text not null,
  price_kobo integer not null check (price_kobo >= 0),
  active boolean not null default true
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  email text not null,
  phone text not null,
  delivery_address text not null,
  total_kobo integer not null check (total_kobo >= 0),
  status text not null default 'received' check (status in ('received','processing','fulfilled','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text references public.products(id) on delete set null,
  product_name text not null,
  unit_price_kobo integer not null check (unit_price_kobo >= 0),
  quantity integer not null check (quantity > 0),
  line_total_kobo integer not null check (line_total_kobo >= 0)
);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Anyone can view active products" on public.products;
create policy "Anyone can view active products" on public.products for select using (active = true);
drop policy if exists "Customers can read their own orders" on public.orders;
create policy "Customers can read their own orders" on public.orders for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Customers can create their own orders" on public.orders;
create policy "Customers can create their own orders" on public.orders for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Customers can remove their own incomplete order" on public.orders;
create policy "Customers can remove their own incomplete order" on public.orders for delete to authenticated using (auth.uid() = user_id);
drop policy if exists "Customers can read items from their orders" on public.order_items;
create policy "Customers can read items from their orders" on public.order_items for select to authenticated using (
  exists (select 1 from public.orders where orders.id = order_items.order_id and orders.user_id = auth.uid())
);
drop policy if exists "Customers can add items to their orders" on public.order_items;
create policy "Customers can add items to their orders" on public.order_items for insert to authenticated with check (
  exists (select 1 from public.orders where orders.id = order_items.order_id and orders.user_id = auth.uid())
);

insert into public.products (id,name,description,category,material,price_kobo) values
('p1','The Everyday Kinky Pony','Soft-volume drawstring ponytail for a quick everyday style.','Ponytails','Synthetic · Drawstring',1250000),
('p2','Sleek Wrap Ponytail','A smooth, polished straight-look ponytail.','Ponytails','Synthetic · Yaki straight',1450000),
('p3','Kinky Straight Ponytail','Natural-texture human hair ponytail. Confirm length and grade with MFH Hair.','Ponytails','Human hair · Natural texture',12350000),
('p4','Body Wave Bundle Duo','Two body-wave bundles. Confirm length and weight with MFH Hair.','Bundles','Human hair · 2 bundle set',14500000),
('p5','Body Wave Lace Wig','Body-wave lace-front wig. Confirm length, density and lace details with MFH Hair.','Wigs','Human hair · Lace front',15500000),
('p6','Soft Curl Clip-ins','Clip-in set for an easy textured style. Confirm material and set contents with MFH Hair.','Extensions','Synthetic · Clip-in set',1850000)
on conflict (id) do update set name=excluded.name, description=excluded.description, category=excluded.category, material=excluded.material, price_kobo=excluded.price_kobo, active=true;
