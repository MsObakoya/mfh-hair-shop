-- Run in Supabase SQL Editor to add the expanded sample catalog before testing checkout.
-- Amounts are kobo (e.g. 1,250,000 = ₦12,500). Prices and specifications are examples,
-- not MFH Hair quotes. Confirm every item with the business owner before real sales.
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
