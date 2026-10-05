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
('p1','The Everyday Kinky Pony','Soft-volume drawstring ponytail listing preview. Confirm exact product details with MFH Hair.','Ponytails','Drawstring ponytail · sample listing',1250000),
('p2','Sleek Wrap Ponytail','Straight wrap ponytail listing preview. Confirm exact product details with MFH Hair.','Ponytails','Wrap ponytail · sample listing',1450000),
('p3','Kinky Curly Ponytail','Textured ponytail listing preview. Confirm exact product details with MFH Hair.','Ponytails','Textured ponytail · sample listing',12350000),
('p4','Natural Black Bundle Set','Straight bundle listing preview. Confirm material and set contents with MFH Hair.','Bundles','Straight bundles · sample listing',14500000),
('p5','Afro Kinky Curl Lace Wig','Kinky curl wig listing preview. Confirm material, lace and length with MFH Hair.','Wigs','Kinky curl wig · sample listing',15500000),
('p6','Soft Curl Clip-ins','Curly clip-in listing preview. Confirm material and set contents with MFH Hair.','Extensions','Curly clip-ins · sample listing',1850000),
('p7','Chocolate Straight Bundles','Straight bundle listing preview. Confirm material and bundle count with MFH Hair.','Bundles','Straight bundles · sample listing',9800000),
('p8','Natural Black Weft Set','Straight weft listing preview. Confirm material and set contents with MFH Hair.','Bundles','Straight wefts · sample listing',11200000),
('p9','Curly Lace Frontal Wig','Curly wig listing preview. Confirm material, lace and length with MFH Hair.','Wigs','Curly lace wig · sample listing',16800000),
('p10','Glueless Curly Bob','Curly bob wig listing preview. Confirm material, lace and length with MFH Hair.','Wigs','Curly bob wig · sample listing',14200000),
('p11','Curly Volume Clip-ins','Curly clip-in listing preview. Confirm material and set contents with MFH Hair.','Extensions','Curly clip-in set · sample listing',2650000),
('p12','Pre-stretched Braid Pack','Braiding hair listing preview. Confirm brand, pack size and fiber with MFH Hair.','Braiding hair','Braiding hair · sample listing',850000)
on conflict (id) do update set name=excluded.name, description=excluded.description, category=excluded.category, material=excluded.material, price_kobo=excluded.price_kobo, active=true;
