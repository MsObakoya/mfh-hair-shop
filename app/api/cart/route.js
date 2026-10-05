import { NextResponse } from "next/server";
import { products as catalog } from "../../../lib/products";
import { createClientForRequest } from "../../../lib/supabase/server";

function unavailable() {
  return NextResponse.json({ error: "Shared cart is not set up yet. Run supabase/cart_sync.sql in the Supabase SQL Editor." }, { status: 503 });
}

function normalizeItems(items, databaseProducts) {
  const byId = new Map(databaseProducts.map((product) => [product.id, product]));
  return items.flatMap(({ id, qty }) => {
    const stored = byId.get(id);
    const displayed = catalog.find((product) => product.id === id);
    if (!stored || !stored.active || !displayed) return [];
    return [{ ...displayed, price: Number(stored.price_kobo) / 100, qty }];
  });
}

export async function GET(request) {
  const { supabase, user } = await createClientForRequest(request);
  if (!user) return NextResponse.json({ error: "Sign in to sync your bag." }, { status: 401 });
  const { data: cart, error } = await supabase.from("carts").select("items").eq("user_id", user.id).maybeSingle();
  if (error) return unavailable();
  const ids = Array.isArray(cart?.items) ? [...new Set(cart.items.map((item) => item.id))] : [];
  if (!ids.length) return NextResponse.json({ items: [] });
  const { data: dbProducts, error: productError } = await supabase.from("products").select("id,price_kobo,active").in("id", ids);
  if (productError) return unavailable();
  const quantities = new Map(cart.items.map((item) => [item.id, item.qty]));
  return NextResponse.json({ items: normalizeItems(dbProducts.map((product) => ({ ...product, qty: quantities.get(product.id) })), dbProducts) });
}

export async function PUT(request) {
  const { supabase, user } = await createClientForRequest(request);
  if (!user) return NextResponse.json({ error: "Sign in to sync your bag." }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Send a valid bag." }, { status: 400 }); }
  if (!Array.isArray(body.items) || body.items.length > 30 || body.items.some((item) => !item || typeof item.id !== "string" || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 30)) {
    return NextResponse.json({ error: "Check the items and quantities in your bag." }, { status: 400 });
  }
  const totals = new Map();
  for (const item of body.items) totals.set(item.id, (totals.get(item.id) || 0) + item.qty);
  if ([...totals.values()].some((qty) => qty > 30)) return NextResponse.json({ error: "A product quantity cannot exceed 30." }, { status: 400 });
  const items = [...totals].map(([id, qty]) => ({ id, qty }));
  const ids = items.map((item) => item.id);
  const { data: dbProducts, error: productError } = ids.length
    ? await supabase.from("products").select("id,price_kobo,active").in("id", ids).eq("active", true)
    : { data: [], error: null };
  if (productError) return unavailable();
  if (dbProducts.length !== ids.length) return NextResponse.json({ error: "One or more products are unavailable. Refresh the shop and try again." }, { status: 400 });
  const { error } = await supabase.from("carts").upsert({ user_id: user.id, items, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return unavailable();
  return NextResponse.json({ items: normalizeItems(items, dbProducts) });
}
