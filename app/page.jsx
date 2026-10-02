"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient as createSupabaseClient } from "../lib/supabase/client";

const products = [
  { id: "p1", name: "The Everyday Kinky Pony", type: "Ponytails", material: "Synthetic · Drawstring", price: 12500, badge: "BESTSELLER", style: "product-art art-curls", short: "Soft volume, ready in minutes." },
  { id: "p2", name: "Sleek Wrap Ponytail", type: "Ponytails", material: "Synthetic · Yaki straight", price: 14500, badge: "EASY STYLE", style: "product-art art-sleek", short: "A smooth, polished finish." },
  { id: "p3", name: "Kinky Straight Ponytail", type: "Human hair", material: "Human hair · Natural texture", price: 123500, badge: "HUMAN HAIR", style: "product-art art-human", short: "Natural movement with a soft feel." },
  { id: "p4", name: "Body Wave Bundle Duo", type: "Bundles", material: "Human hair · 2 bundle set", price: 145000, badge: "BUNDLE SET", style: "product-art art-wave", short: "Flowing waves for your next look." },
  { id: "p5", name: "Body Wave Lace Wig", type: "Wigs", material: "Human hair · Lace front", price: 155000, badge: "READY TO GLOW", style: "product-art art-wig", short: "An effortless, full-bodied finish." },
  { id: "p6", name: "Soft Curl Clip-ins", type: "Extensions", material: "Synthetic · Clip-in set", price: 18500, badge: "QUICK CHANGE", style: "product-art art-clip", short: "Add texture and fullness in a snap." },
];
const liveMode = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const money = (n) => `₦${n.toLocaleString("en-NG")}`;

export default function Home() {
  const [cart, setCart] = useState([]);
  const [view, setView] = useState("shop");
  const [filter, setFilter] = useState("All pieces");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [orders, setOrders] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    try {
      setCart(JSON.parse(localStorage.getItem("mfh-cart") || "[]"));
      setOrders(JSON.parse(localStorage.getItem("mfh-orders-demo") || "[]"));
    } catch { /* Start with an empty demo cart if browser storage is unavailable. */ }
    setHydrated(true);
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialView = params.get("view");
    if (["checkout", "orders"].includes(initialView)) setView(initialView);
    if (params.get("auth_error") === "google") setCheckoutError("Google sign-in didn’t finish. Please check the OAuth setup and try again.");
    if (!liveMode) return;
    const supabase = createSupabaseClient();
    supabase.auth.getUser().then(({ data }) => { setUser(data.user || null); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user || null); });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (liveMode && view === "orders" && user) fetch("/api/checkout").then((r) => r.json()).then((data) => setOrders(data.orders || [])).catch(() => setCheckoutError("Could not load orders. Please try again."));
  }, [view, user]);
  useEffect(() => { if (hydrated) localStorage.setItem("mfh-cart", JSON.stringify(cart)); }, [cart, hydrated]);

  const shown = useMemo(() => filter === "All pieces" ? products : products.filter((p) => p.type === filter), [filter]);
  const count = cart.reduce((n, i) => n + i.qty, 0);
  const total = cart.reduce((n, i) => n + i.price * i.qty, 0);
  const add = (product) => {
    setCart((old) => old.some((i) => i.id === product.id) ? old.map((i) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i) : [...old, { ...product, qty: 1 }]);
    setNotice(`${product.name} added to your bag`);
    setTimeout(() => setNotice(""), 2200);
  };
  const changeQty = (id, delta) => setCart((old) => old.map((i) => i.id === id ? { ...i, qty: i.qty + delta } : i).filter((i) => i.qty > 0));
  const signIn = async (next = "/?view=orders") => {
    if (!liveMode) { setView("orders"); setCheckoutError("Google sign-in becomes available after Supabase and Google OAuth are configured."); return; }
    const supabase = createSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    if (error) setCheckoutError(error.message);
  };
  const placeOrder = async (event) => {
    event.preventDefault();
    if (!cart.length) return;
    if (liveMode && !user) { await signIn("/?view=checkout"); return; }
    setCheckoutError("");
    if (liveMode) {
      try {
        const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, phone: form.phone, address: form.address, items: cart.map((i) => ({ id: i.id, qty: i.qty })) }) });
        const data = await response.json();
        if (!response.ok) { setCheckoutError(data.error || "Order could not be submitted."); return; }
        setOrders((old) => [data.order, ...old]); setEmailSent(data.emailSent); setCart([]); localStorage.removeItem("mfh-cart"); setView("success"); return;
      } catch { setCheckoutError("We could not reach the shop server. Please try again."); return; }
    }
    const order = { id: `MFH-${Date.now().toString().slice(-6)}`, date: new Date().toLocaleDateString("en-NG"), items: cart, total, customer: form.name };
    const next = [order, ...orders];
    setOrders(next); localStorage.setItem("mfh-orders-demo", JSON.stringify(next));
    setCart([]); localStorage.removeItem("mfh-cart"); setView("success");
  };

  return <>
    <div className="demo-bar">PREVIEW SHOP · Sample prices &amp; demo checkout <span>Confirm details before launch</span></div>
    {checkoutError && view === "shop" && <div className="form-error page-alert" role="alert">{checkoutError}</div>}
    <header className="site-header">
      <button className="wordmark" onClick={() => setView("shop")} aria-label="MFH Hair home"><img src="/images/mfh-hair-mark.jpeg" alt="MFH Hair"/></button>
      <nav className="desktop-nav"><a href="#shop">Shop all</a><a href="#story">Our story</a><a href="#care">Hair care</a></nav>
      <div className="header-actions"><button className="text-action" onClick={() => liveMode && !user ? signIn("/?view=orders") : setView("orders")}>{liveMode && !user ? "Sign in" : "My orders"}</button><button className="bag-button" onClick={() => setView("bag")}>Bag <span>{count}</span></button></div>
    </header>

    {view === "shop" && <main>
      <section className="hero">
        <div className="hero-copy"><p className="eyebrow">A GOOD HAIR DAY, EVERY DAY</p><h1>Your hair.<br/><em>Your moment.</em></h1><p className="hero-sub">Thoughtfully chosen wigs, ponytails and extensions to help you show up feeling like yourself.</p><a className="button button-dark" href="#shop">Find your look <span>↗</span></a><p className="hero-note">Soft textures · Easy styling · All you</p></div>
        <div className="hero-image"><img src="/images/mfh-hair-campaign.jpeg" alt="MFH Hair branded ponytail extension and care accessories"/><div className="image-caption">THE MFH FINISH <span>01 / 03</span></div></div>
        <div className="hero-index">MFH HAIR — YOUR EVERYDAY EDIT</div>
      </section>
      <div className="promise-row"><span>✳ Curated textures</span><span>✳ Easy everyday wear</span><span>✳ A little extra confidence</span></div>
      <section className="collection" id="shop"><div className="section-heading"><div><p className="eyebrow">THE COLLECTION</p><h2>Find your <em>feeling.</em></h2></div><p>Little changes, lovely transformations.<br/>Meet your next go-to.</p></div>
        <div className="filters" role="group" aria-label="Filter products">{["All pieces", "Ponytails", "Wigs", "Bundles", "Extensions", "Human hair"].map((f) => <button key={f} className={filter === f ? "filter active" : "filter"} onClick={() => setFilter(f === "Human hair" ? "Human hair" : f)}>{f}</button>)}</div>
        <div className="product-grid">{shown.map((p, i) => <article className="product-card" key={p.id}><div className={`${p.style} art-${i % 3}`}><span className="product-badge">{p.badge}</span><span className="strand strand-one"/><span className="strand strand-two"/><span className="strand strand-three"/><span className="art-label">MFH <small>HAIR</small></span><button className="quick-add" onClick={() => add(p)} aria-label={`Add ${p.name} to bag`}>＋</button></div><div className="product-info"><div><p className="product-type">{p.material}</p><h3>{p.name}</h3></div><strong>{money(p.price)}</strong></div><p className="product-short">{p.short}</p></article>)}</div>
        <p className="price-note">Illustrative product previews and sample prices in NGN. MFH Hair must confirm the actual items, materials, lengths, availability and final prices before real orders can be taken.</p>
      </section>
      <section className="story" id="story"><div className="story-image"><img src="/images/mfh-hair-campaign.jpeg" alt="MFH Hair ponytail packaging in rich espresso and copper tones"/></div><div className="story-copy"><p className="eyebrow">A LITTLE MFH MAGIC</p><h2>Made for the way <em>you move.</em></h2><p>From soft everyday texture to a full-on moment, find a style that feels like you. Pick your piece, make it yours, and step out with a little extra confidence.</p><a href="#shop" className="underlink">Explore the collection ↗</a></div></section>
      <section className="care-strip" id="care"><span>MFH HAIR</span><p>Good hair deserves a little love. <em>Care for your piece and enjoy the moment.</em></p><a href="#shop">SHOP HAIRCARE ↗</a></section>
    </main>}

    {view === "bag" && <main className="inner-page"><button className="back-link" onClick={() => setView("shop")}>← Continue shopping</button><p className="eyebrow">YOUR MFH EDIT</p><h1>Your bag</h1>{cart.length === 0 ? <div className="empty-state"><p>Your bag is waiting for something lovely.</p><button className="button button-dark" onClick={() => setView("shop")}>Explore the collection</button></div> : <div className="checkout-layout"><div className="bag-list">{cart.map((i) => <div className="bag-item" key={i.id}><div className={`${i.style} bag-art`}><span className="art-label">MFH</span></div><div className="bag-desc"><p className="product-type">{i.material}</p><h3>{i.name}</h3><div className="qty-control"><button onClick={() => changeQty(i.id, -1)} aria-label="Decrease quantity">−</button><span>{i.qty}</span><button onClick={() => changeQty(i.id, 1)} aria-label="Increase quantity">＋</button></div></div><strong>{money(i.price * i.qty)}</strong></div>)}</div><aside className="order-summary"><h2>Order summary</h2><div><span>Subtotal</span><strong>{money(total)}</strong></div><div><span>Delivery</span><span>Confirmed after order</span></div><div className="summary-total"><span>Total</span><strong>{money(total)}</strong></div><button className="button button-dark full" onClick={() => setView("checkout")}>Continue to checkout <span>→</span></button><p>Shipping and final pricing will be confirmed by MFH Hair.</p></aside></div>}</main>}

    {view === "checkout" && <main className="inner-page"><button className="back-link" onClick={() => setView("bag")}>← Back to bag</button><p className="eyebrow">ALMOST YOURS</p><h1>Checkout</h1>{liveMode && !user && <div className="demo-explainer inline-explain">Sign in with Google to continue securely. Your bag will stay saved.</div>}<div className="checkout-layout"><form className="checkout-form" onSubmit={placeOrder}><h2>Delivery details</h2><p className="form-explainer">Tell us where to reach you about this order.</p>{[["name", "Full name", "text"], ["email", "Email address", "email"], ["phone", "Phone number", "tel"], ["address", "Delivery address", "text"]].map(([key, label, type]) => <label key={key}>{label}<input required type={type} value={key === "email" && liveMode && user ? user.email : form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={key === "address" ? "Street, area, city" : ""}/></label>)}{checkoutError && <p className="form-error" role="alert">{checkoutError}</p>}<button className="button button-dark full" type="submit">{liveMode ? user ? `Place order · ${money(total)}` : "Sign in with Google to order" : `Place demo order · ${money(total)}`}</button>{!liveMode && <p className="demo-explainer">Demo only: this records an order in this browser. Supabase, Google sign-in and confirmation email are not configured yet.</p>}</form><aside className="order-summary"><h2>In your bag</h2>{cart.map((i) => <div key={i.id}><span>{i.name} × {i.qty}</span><strong>{money(i.price * i.qty)}</strong></div>)}<div className="summary-total"><span>Subtotal</span><strong>{money(total)}</strong></div></aside></div></main>}

    {view === "success" && <main className="inner-page centered"><div className="success-mark">✦</div><p className="eyebrow">THANK YOU, {form.name.split(" ")[0]?.toUpperCase()}</p><h1>Your order is <em>noted.</em></h1><p className="success-copy">{liveMode ? <>Order <strong>{orders[0]?.id?.slice(0, 8)?.toUpperCase()}</strong> is saved to your account. {emailSent ? "A confirmation email has been sent." : "Email confirmation is not configured yet; MFH Hair will need to follow up."}</> : <>Demo order <strong>{orders[0]?.id}</strong> is saved in this browser only. It is not a real submission.</>}</p><button className="button button-dark" onClick={() => setView("orders")}>View my orders</button><button className="underlink button-link" onClick={() => setView("shop")}>Back to the shop ↗</button></main>}

    {view === "orders" && <main className="inner-page"><button className="back-link" onClick={() => setView("shop")}>← Back to shop</button><p className="eyebrow">YOUR MFH HISTORY</p><h1>My orders</h1>{!liveMode && <div className="demo-explainer inline-explain">Demo mode: orders appear here only on the browser where they were placed. Supabase and Google sign-in are not configured yet.</div>}{checkoutError && <p className="form-error" role="alert">{checkoutError}</p>}{orders.length ? orders.map((o) => <div className="history-order" key={o.id}><div><span className="product-type">{o.created_at ? new Date(o.created_at).toLocaleDateString("en-NG") : o.date} · {o.id}</span><h3>{o.order_items ? o.order_items.map((i) => `${i.product_name} × ${i.quantity}`).join(", ") : o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}</h3><span>{o.customer_name || o.customer}</span></div><strong>{money(o.total_kobo != null ? o.total_kobo / 100 : o.total)}</strong></div>) : <div className="empty-state"><p>You haven’t placed any orders yet.</p><button className="button button-dark" onClick={() => setView("shop")}>Find your first piece</button></div>}{liveMode && user && <button className="text-action signout" onClick={async () => { await createSupabaseClient().auth.signOut(); setUser(null); setView("shop"); }}>Sign out</button>}</main>}

    <footer className="footer"><div className="footer-brand"><img src="/images/mfh-hair-mark.jpeg" alt="MFH Hair"/></div><div><p>YOUR HAIR, YOUR MOMENT.</p><span>MFH Hair · Made for your moment</span></div><span className="footer-copy">© 2026 MFH Hair</span></footer>
    {notice && <div className="toast" role="status">{notice} <span>✓</span></div>}
  </>;
}
