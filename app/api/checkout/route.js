import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

function htmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in with Google to place an order." }, { status: 401 });
  const body = await request.json();
  const { name, phone, address, items } = body;
  if (!name?.trim() || !phone?.trim() || !address?.trim() || !Array.isArray(items) || !items.length) return NextResponse.json({ error: "Please complete your delivery details and add an item." }, { status: 400 });
  if (items.length > 30 || items.some((i) => !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 30)) return NextResponse.json({ error: "Please check the quantities in your bag." }, { status: 400 });

  const ids = [...new Set(items.map((i) => i.id))];
  const { data: products, error: productError } = await supabase.from("products").select("id,name,price_kobo,active").in("id", ids).eq("active", true);
  if (productError || !products || products.length !== ids.length) return NextResponse.json({ error: "One or more pieces are unavailable. Please refresh your bag." }, { status: 400 });
  const rows = items.map((item) => {
    const p = products.find((product) => product.id === item.id);
    return { product_id: p.id, product_name: p.name, unit_price_kobo: p.price_kobo, quantity: item.qty, line_total_kobo: p.price_kobo * item.qty };
  });
  const total = rows.reduce((sum, row) => sum + row.line_total_kobo, 0);
  const email = user.email;
  if (!email) return NextResponse.json({ error: "Your Google account needs an email address to order." }, { status: 400 });
  const { data: order, error: orderError } = await supabase.from("orders").insert({ user_id: user.id, customer_name: name.trim(), email, phone: phone.trim(), delivery_address: address.trim(), total_kobo: total }).select("id,created_at").single();
  if (orderError) return NextResponse.json({ error: "We could not save the order. Please try again." }, { status: 500 });
  const { error: itemError } = await supabase.from("order_items").insert(rows.map((row) => ({ ...row, order_id: order.id })));
  if (itemError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: "We could not save the full order. Please try again." }, { status: 500 });
  }

  let emailSent = false;
  if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN && process.env.MAILGUN_FROM) {
    try {
      const rowsHtml = rows.map((row) => `<tr><td style="padding:10px;border-bottom:1px solid #eee">${htmlEscape(row.product_name)} × ${row.quantity}</td><td style="padding:10px;border-bottom:1px solid #eee;text-align:right">₦${(row.line_total_kobo / 100).toLocaleString("en-NG")}</td></tr>`).join("");
      const form = new FormData();
      form.set("from", process.env.MAILGUN_FROM);
      form.set("to", email);
      form.set("subject", `MFH Hair order ${order.id.slice(0, 8).toUpperCase()} received`);
      form.set("html", `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#32170f"><h1 style="font-family:Georgia,serif">Thank you, ${htmlEscape(name)}.</h1><p>Your MFH Hair order has been received. We’ll be in touch about delivery.</p><p><strong>Order reference:</strong> ${order.id.slice(0, 8).toUpperCase()}</p><table style="width:100%;border-collapse:collapse">${rowsHtml}<tr><td style="padding:14px 10px"><strong>Total</strong></td><td style="padding:14px 10px;text-align:right"><strong>₦${(total / 100).toLocaleString("en-NG")}</strong></td></tr></table><p style="color:#786d64;font-size:13px">MFH Hair · Your hair, your moment.</p></div>`);
      const resp = await fetch(`https://api.mailgun.net/v3/${encodeURIComponent(process.env.MAILGUN_DOMAIN)}/messages`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString("base64")}` }, body: form });
      emailSent = resp.ok;
      if (!resp.ok) console.error("Mailgun rejected the order email", resp.status, await resp.text());
    } catch (error) { console.error("Mailgun order email failed", error); }
  } else {
    console.info("Order persisted; Mailgun is not configured, so no email was sent.");
  }
  return NextResponse.json({ order: { id: order.id, created_at: order.created_at, total_kobo: total }, emailSent });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to see your orders." }, { status: 401 });
  const { data, error } = await supabase.from("orders").select("id,created_at,total_kobo,status,customer_name,order_items(product_name,unit_price_kobo,quantity,line_total_kobo)").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "We could not load your orders." }, { status: 500 });
  const orders = (data || []).map((order) => ({
    ...order,
    order_items: Array.isArray(order.order_items) ? order.order_items : order.order_items ? [order.order_items] : [],
  }));
  return NextResponse.json({ orders });
}
