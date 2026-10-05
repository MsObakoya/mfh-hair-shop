"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient as createSupabaseClient } from "../lib/supabase/client";
import { products, productCategories } from "../lib/products";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const validSupabaseUrl = (() => {
  if (!supabaseUrl || supabaseUrl !== supabaseUrl.trim()) return false;
  try {
    const parsed = new URL(supabaseUrl);
    return ["https:", "http:"].includes(parsed.protocol) && Boolean(parsed.hostname);
  } catch {
    return false;
  }
})();
const liveMode = validSupabaseUrl && Boolean(supabaseAnonKey);
const money = (n) => `₦${n.toLocaleString("en-NG")}`;
const cartProducts = (items) => items.flatMap((item) => {
  const product = products.find((candidate) => candidate.id === item.id);
  return product && Number.isInteger(item.qty) && item.qty > 0 ? [{ ...product, qty: item.qty }] : [];
});
const mergeCarts = (local, remote) => {
  const merged = new Map();
  for (const item of [...local, ...remote]) {
    const previous = merged.get(item.id);
    merged.set(item.id, { ...item, qty: Math.max(previous?.qty || 0, item.qty) });
  }
  return [...merged.values()];
};

export default function Home() {
  const [cart, setCart] = useState([]);
  const [cartSyncReady, setCartSyncReady] = useState(false);
  const [cartSyncEnabled, setCartSyncEnabled] = useState(false);
  const [view, setView] = useState("shop");
  const [filter, setFilter] = useState("All pieces");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("mfh-cart") || "[]");
      if (Array.isArray(saved)) setCart(saved.map((item) => {
        const currentProduct = products.find((product) => product.id === item.id);
        return currentProduct && Number.isInteger(item.qty) && item.qty > 0 ? { ...currentProduct, qty: item.qty } : null;
      }).filter(Boolean));
    } catch { /* Start with an empty cart if browser storage is unavailable. */ }
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
    if (!liveMode || view !== "orders" || !user) return;
    const controller = new AbortController();
    setOrders([]);
    setOrdersLoading(true);
    setCheckoutError("");
    fetch("/api/checkout", { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load orders.");
        const loadedOrders = Array.isArray(data.orders) ? data.orders : [];
        setOrders(loadedOrders.map((order) => ({
          ...order,
          order_items: Array.isArray(order.order_items) ? order.order_items : order.order_items ? [order.order_items] : [],
        })));
      })
      .catch((error) => {
        if (error.name !== "AbortError") setCheckoutError(error.message || "Could not load orders. Please try again.");
      })
      .finally(() => { if (!controller.signal.aborted) setOrdersLoading(false); });
    return () => controller.abort();
  }, [view, user]);
  useEffect(() => { if (hydrated) localStorage.setItem("mfh-cart", JSON.stringify(cart)); }, [cart, hydrated]);

  const refreshRemoteCart = useCallback(async (merge = false) => {
    if (!user || !liveMode) return;
    const supabase = createSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Your session expired. Sign in again to sync your bag.");
    const response = await fetch("/api/cart", { headers: { Authorization: `Bearer ${session.access_token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not sync your bag.");
    const remote = cartProducts(data.items || []);
    setCart((current) => merge ? mergeCarts(current, remote) : remote);
    return remote;
  }, [user]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      setCartSyncReady(true);
      setCartSyncEnabled(false);
      return;
    }
    let active = true;
    setCartSyncReady(false);
    setCartSyncEnabled(false);
    refreshRemoteCart(true)
      .then(() => { if (active) { setCartSyncEnabled(true); setCartSyncReady(true); } })
      .catch((error) => { if (active) { setCheckoutError(error.message); setCartSyncReady(true); } });
    return () => { active = false; };
  }, [hydrated, user, refreshRemoteCart]);

  useEffect(() => {
    if (!user || !cartSyncReady || !cartSyncEnabled) return;
    const sync = async () => {
      const { data: { session } } = await createSupabaseClient().auth.getSession();
      if (!session?.access_token) return;
      const response = await fetch("/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ items: cart.map(({ id, qty }) => ({ id, qty })) }),
      });
      if (!response.ok) {
        const data = await response.json();
        setCheckoutError(data.error || "Your bag could not sync to other devices.");
        setCartSyncEnabled(false);
      }
    };
    const timer = setTimeout(sync, 300);
    return () => clearTimeout(timer);
  }, [cart, user, cartSyncReady, cartSyncEnabled]);

  useEffect(() => {
    if (!user || !cartSyncEnabled) return;
    let active = true;
    const syncFromOtherDevice = () => refreshRemoteCart(false).catch((error) => { if (active) setCheckoutError(error.message); });
    const onVisibility = () => { if (document.visibilityState === "visible") syncFromOtherDevice(); };
    window.addEventListener("focus", syncFromOtherDevice);
    document.addEventListener("visibilitychange", onVisibility);
    const timer = setInterval(syncFromOtherDevice, 4000);
    return () => {
      active = false;
      window.removeEventListener("focus", syncFromOtherDevice);
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(timer);
    };
  }, [user, cartSyncEnabled, refreshRemoteCart]);

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
    if (!liveMode) { setCheckoutError("Account access is temporarily unavailable. Please try again shortly."); return; }
    const supabase = createSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    if (error) setCheckoutError(error.message);
  };
  const viewOrders = () => {
    setOrders([]);
    setOrdersLoading(Boolean(liveMode && user));
    setCheckoutError("");
    setView("orders");
  };
  const placeOrder = async (event) => {
    event.preventDefault();
    if (!cart.length) return;
    if (!liveMode) { setCheckoutError("Online checkout is temporarily unavailable. Please try again shortly."); return; }
    if (!user) { await signIn("/?view=checkout"); return; }
    setCheckoutError("");
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, phone: form.phone, address: form.address, items: cart.map((i) => ({ id: i.id, qty: i.qty })) }) });
      const data = await response.json();
      if (!response.ok) { setCheckoutError(data.error || "Order could not be submitted."); return; }
      setOrders((old) => [data.order, ...old]); setEmailSent(data.emailSent); setCart([]); localStorage.removeItem("mfh-cart"); setView("success");
    } catch { setCheckoutError("We could not reach the shop server. Please try again."); }
  };

  return <>
    {checkoutError && view === "shop" && <div className="form-error page-alert" role="alert">{checkoutError}</div>}
    <header className="site-header">
      <button className="wordmark" onClick={() => setView("shop")} aria-label="MFH Hair home"><img src="/images/mfh-hair-mark.jpeg" alt="MFH Hair"/></button>
      <nav className="desktop-nav"><a href="#shop">Shop all</a><a href="#story">Our story</a><a href="#care">Hair care</a></nav>
      <div className="header-actions"><button className="text-action" onClick={() => liveMode && !user ? signIn("/?view=orders") : viewOrders()}>{liveMode && !user ? "Sign in" : "My orders"}</button><button className="bag-button" onClick={() => setView("bag")}>Bag <span>{count}</span></button></div>
    </header>

    {view === "shop" && <main>
      <section className="hero">
        <div className="hero-copy"><p className="eyebrow">A GOOD HAIR DAY, EVERY DAY</p><h1>Your hair.<br/><em>Your moment.</em></h1><p className="hero-sub">Thoughtfully chosen wigs, ponytails and extensions to help you show up feeling like yourself.</p><a className="button button-dark" href="#shop">Find your look <span>↗</span></a><p className="hero-note">Soft textures · Easy styling · All you</p></div>
        <div className="hero-image"><img src="/images/mfh-hair-campaign.jpeg" alt="MFH Hair branded ponytail extension and care accessories"/><div className="image-caption">THE MFH FINISH <span>01 / 03</span></div></div>
        <div className="hero-index">MFH HAIR — YOUR EVERYDAY EDIT</div>
      </section>
      <div className="promise-row"><span>✳ Curated textures</span><span>✳ Easy everyday wear</span><span>✳ A little extra confidence</span></div>
      <section className="collection" id="shop"><div className="section-heading"><div><p className="eyebrow">THE COLLECTION</p><h2>Find your <em>feeling.</em></h2></div><p>Little changes, lovely transformations.<br/>Meet your next go-to.</p></div>
        <div className="filters" role="group" aria-label="Filter products">{productCategories.map((f) => <button key={f} className={filter === f ? "filter active" : "filter"} onClick={() => setFilter(f)}>{f}</button>)}</div>
        <div className="product-grid">{shown.map((p) => <article className="product-card" key={p.id}><div className="product-art"><img src={p.photo} alt={`${p.name} product photo`} loading="lazy"/><span className="product-badge">{p.badge}</span><span className="art-label">MFH <small>HAIR</small></span><button className="quick-add" onClick={() => add(p)} aria-label={`Add ${p.name} to bag`}>＋</button></div><div className="product-info"><div><p className="product-type">{p.material}</p><h3>{p.name}</h3></div><strong>{money(p.price)}</strong></div><p className="product-short">{p.short}</p><a className="photo-credit" href={p.photoLink} target="_blank" rel="noreferrer">Demo photo: {p.photoSource}</a></article>)}</div>
        <p className="catalog-note">Demo product photos link to third-party listings. Prices and product details are samples for the project; MFH Hair must confirm them before accepting real sales.</p>
      </section>
      <section className="story" id="story"><div className="story-image"><img src="/images/mfh-hair-campaign.jpeg" alt="MFH Hair ponytail packaging in rich espresso and copper tones"/></div><div className="story-copy"><p className="eyebrow">A LITTLE MFH MAGIC</p><h2>Made for the way <em>you move.</em></h2><p>From soft everyday texture to a full-on moment, find a style that feels like you. Pick your piece, make it yours, and step out with a little extra confidence.</p><a href="#shop" className="underlink">Explore the collection ↗</a></div></section>
      <section className="care-strip" id="care"><span>MFH HAIR</span><p>Good hair deserves a little love. <em>Care for your piece and enjoy the moment.</em></p><a href="#shop">SHOP HAIRCARE ↗</a></section>
    </main>}

    {view === "bag" && <main className="inner-page"><button className="back-link" onClick={() => setView("shop")}>← Continue shopping</button><p className="eyebrow">YOUR MFH EDIT</p><h1>Your bag</h1>{cart.length === 0 ? <div className="empty-state"><p>Your bag is waiting for something lovely.</p><button className="button button-dark" onClick={() => setView("shop")}>Explore the collection</button></div> : <div className="checkout-layout"><div className="bag-list">{cart.map((i) => <div className="bag-item" key={i.id}><div className="bag-art"><img src={i.photo} alt=""/></div><div className="bag-desc"><p className="product-type">{i.material}</p><h3>{i.name}</h3><div className="qty-control"><button onClick={() => changeQty(i.id, -1)} aria-label="Decrease quantity">−</button><span>{i.qty}</span><button onClick={() => changeQty(i.id, 1)} aria-label="Increase quantity">＋</button></div></div><strong>{money(i.price * i.qty)}</strong></div>)}</div><aside className="order-summary"><h2>Order summary</h2><div><span>Subtotal</span><strong>{money(total)}</strong></div><div><span>Delivery</span><span>Confirmed after order</span></div><div className="summary-total"><span>Total</span><strong>{money(total)}</strong></div><button className="button button-dark full" onClick={() => setView("checkout")}>Continue to checkout <span>→</span></button><p>Shipping and final pricing will be confirmed by MFH Hair.</p></aside></div>}</main>}

    {view === "checkout" && <main className="inner-page"><button className="back-link" onClick={() => setView("bag")}>← Back to bag</button><p className="eyebrow">ALMOST YOURS</p><h1>Checkout</h1>{liveMode && !user && <p className="form-explainer">Sign in with Google to continue securely. Your bag will stay saved.</p>}{!liveMode && <p className="form-error" role="alert">Online checkout is temporarily unavailable. Please try again shortly.</p>}<div className="checkout-layout"><form className="checkout-form" onSubmit={placeOrder}><h2>Delivery details</h2><p className="form-explainer">Tell us where to reach you about this order.</p>{[["name", "Full name", "text"], ["email", "Email address", "email"], ["phone", "Phone number", "tel"], ["address", "Delivery address", "text"]].map(([key, label, type]) => <label key={key}>{label}<input required type={type} value={key === "email" && liveMode && user ? user.email : form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={key === "address" ? "Street, area, city" : ""}/></label>)}{checkoutError && <p className="form-error" role="alert">{checkoutError}</p>}<button className="button button-dark full" type="submit" disabled={!liveMode}>{user ? `Place order · ${money(total)}` : "Sign in with Google to order"}</button></form><aside className="order-summary"><h2>In your bag</h2>{cart.map((i) => <div key={i.id}><span>{i.name} × {i.qty}</span><strong>{money(i.price * i.qty)}</strong></div>)}<div className="summary-total"><span>Subtotal</span><strong>{money(total)}</strong></div></aside></div></main>}

    {view === "success" && <main className="inner-page centered"><div className="success-mark">✦</div><p className="eyebrow">THANK YOU, {form.name.split(" ")[0]?.toUpperCase()}</p><h1>Your order is <em>noted.</em></h1><p className="success-copy">Your order <strong>{orders[0]?.id?.slice(0, 8)?.toUpperCase()}</strong> is saved to your account. {emailSent ? "A confirmation email has been sent." : "MFH Hair will follow up about delivery."}</p><button className="button button-dark" onClick={viewOrders}>View my orders</button><button className="underlink button-link" onClick={() => setView("shop")}>Back to the shop ↗</button></main>}

    {view === "orders" && <main className="inner-page">
      <button className="back-link" onClick={() => setView("shop")}>← Back to shop</button>
      <p className="eyebrow">YOUR MFH HISTORY</p>
      <h1>My orders</h1>
      {!liveMode && <p className="form-error" role="alert">Account access is temporarily unavailable. Please try again shortly.</p>}
      {checkoutError && <p className="form-error" role="alert">{checkoutError}</p>}
      {ordersLoading ? <div className="empty-state"><p>Loading your orders…</p></div> : orders.length ? orders.map((o) => {
        const items = Array.isArray(o.order_items) ? o.order_items : o.order_items ? [o.order_items] : [];
        const orderDate = o.created_at ? new Date(o.created_at).toLocaleDateString("en-NG") : "Date unavailable";
        return <div className="history-order" key={o.id}>
          <div>
            <span className="product-type">{orderDate} · {o.id}</span>
            <h3>{items.length ? items.map((i) => `${i.product_name} × ${i.quantity}`).join(", ") : "Order details unavailable"}</h3>
            <span>{o.customer_name}</span>
          </div>
          <strong>{money(Number(o.total_kobo || 0) / 100)}</strong>
        </div>;
      }) : <div className="empty-state"><p>You haven’t placed any orders yet.</p><button className="button button-dark" onClick={() => setView("shop")}>Find your first piece</button></div>}
      {liveMode && user && <button className="text-action signout" onClick={async () => { await createSupabaseClient().auth.signOut(); setUser(null); setView("shop"); }}>Sign out</button>}
    </main>}

    <footer className="footer"><div className="footer-brand"><img src="/images/mfh-hair-mark.jpeg" alt="MFH Hair"/></div><div><p>YOUR HAIR, YOUR MOMENT.</p><span>MFH Hair · Made for your moment</span></div><span className="footer-copy">© 2026 MFH Hair</span></footer>
    {notice && <div className="toast" role="status">{notice} <span>✓</span></div>}
  </>;
}
