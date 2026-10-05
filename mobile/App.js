import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './src/supabase';

WebBrowser.maybeCompleteAuthSession();

const API_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://mfh-hair-shop.vercel.app').replace(/\/$/, '');
const money = (amount) => `₦${Number(amount || 0).toLocaleString('en-NG')}`;

async function apiRequest(path, { token, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The shop could not complete that request.');
  return data;
}

function ActionButton({ title, onPress, light = false, disabled = false }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.actionButton, light && styles.actionButtonLight, disabled && styles.disabled]}>
      <Text style={[styles.actionButtonText, light && styles.actionButtonTextLight]}>{title}</Text>
    </Pressable>
  );
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['All pieces']);
  const [category, setCategory] = useState('All pieces');
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState('shop');
  const [loading, setLoading] = useState(true);
  const [cartReady, setCartReady] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [delivery, setDelivery] = useState({ name: '', phone: '', address: '' });

  const filteredProducts = useMemo(() => category === 'All pieces' ? products : products.filter((item) => item.type === category), [products, category]);
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const total = cart.reduce((sum, item) => sum + item.qty * item.price, 0);

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  }, []);

  const loadCart = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const data = await apiRequest('/api/cart', { token });
    setCart(data.items || []);
  }, [getToken]);

  const loadOrders = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const data = await apiRequest('/api/checkout', { token });
    setOrders(data.orders || []);
  }, [getToken]);

  useEffect(() => {
    let mounted = true;
    const appStateListener = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    supabase.auth.startAutoRefresh();
    Promise.all([
      apiRequest('/api/products'),
      supabase.auth.getSession(),
    ]).then(([catalog, sessionResult]) => {
      if (!mounted) return;
      setProducts(catalog.products || []);
      setCategories(catalog.categories || ['All pieces']);
      setUser(sessionResult.data.session?.user || null);
      setLoading(false);
    }).catch((error) => {
      if (mounted) { setMessage(error.message); setLoading(false); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (!session) setCartReady(false);
    });
    return () => { mounted = false; subscription.unsubscribe(); appStateListener.remove(); supabase.auth.stopAutoRefresh(); };
  }, []);

  useEffect(() => {
    if (!user) { setCartReady(false); return; }
    let active = true;
    setCartReady(false);
    loadCart().then(() => { if (active) setCartReady(true); }).catch((error) => {
      if (active) { setMessage(error.message); setCartReady(true); }
    });
    const syncCart = () => loadCart().catch((error) => { if (active) setMessage(error.message); });
    const interval = setInterval(syncCart, 4000);
    const stateListener = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncCart();
    });
    return () => { active = false; clearInterval(interval); stateListener.remove(); };
  }, [user, loadCart]);

  useEffect(() => {
    if (!user || !cartReady) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const token = await getToken();
        if (token) await apiRequest('/api/cart', { token, method: 'PUT', body: JSON.stringify({ items: cart.map(({ id, qty }) => ({ id, qty })) }) });
      } catch (error) { if (active) setMessage(error.message); }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [user, cartReady, cart, getToken]);

  useEffect(() => {
    if (screen !== 'orders' || !user) return;
    setBusy(true);
    loadOrders().catch((error) => setMessage(error.message)).finally(() => setBusy(false));
  }, [screen, user, loadOrders]);

  async function signIn() {
    setBusy(true); setMessage('');
    try {
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('Google sign-in did not return a login page.');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success' || !result.url) return;
      const callback = new URL(result.url);
      const authError = callback.searchParams.get('error_description') || callback.searchParams.get('error');
      if (authError) throw new Error(authError);
      const code = callback.searchParams.get('code');
      if (!code) throw new Error('Google did not return a sign-in code. Please try again.');
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
      setMessage('Signed in. Your bag is shared with the MFH Hair website.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  function addToBag(product) {
    setCart((current) => current.some((item) => item.id === product.id)
      ? current.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
      : [...current, { ...product, qty: 1 }]);
    setMessage(`${product.name} added to your bag.`);
  }

  function changeQty(id, delta) {
    setCart((current) => current.map((item) => item.id === id ? { ...item, qty: item.qty + delta } : item).filter((item) => item.qty > 0));
  }

  async function placeOrder() {
    if (!delivery.name.trim() || !delivery.phone.trim() || !delivery.address.trim()) {
      setMessage('Please complete your name, phone number, and delivery address.'); return;
    }
    setBusy(true); setMessage('');
    try {
      const token = await getToken();
      const data = await apiRequest('/api/checkout', {
        token,
        method: 'POST',
        body: JSON.stringify({ ...delivery, items: cart.map(({ id, qty }) => ({ id, qty })) }),
      });
      setCart([]);
      setCheckoutOpen(false);
      setScreen('orders');
      setMessage(`Order ${data.order.id.slice(0, 8).toUpperCase()} saved.${data.emailSent ? ' Confirmation email sent.' : ''}`);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  if (loading) return <SafeAreaView style={styles.loading}><ActivityIndicator color="#8e5034" size="large"/><Text style={styles.muted}>Opening MFH Hair…</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fbf8f4" />
      <View style={styles.topBar}>
        <Image source={require('./assets/icon.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.topActions}>
          {user ? <Pressable onPress={() => supabase.auth.signOut()}><Text style={styles.linkText}>Sign out</Text></Pressable> : <Pressable onPress={signIn} disabled={busy}><Text style={styles.linkText}>Sign in</Text></Pressable>}
          <Pressable style={styles.bagPill} onPress={() => setScreen('bag')}><Text style={styles.bagPillText}>Bag {itemCount}</Text></Pressable>
        </View>
      </View>

      <View style={styles.pageHeading}>
        <Text style={styles.kicker}>YOUR HAIR, YOUR MOMENT</Text>
        <Text style={styles.heading}>{screen === 'shop' ? 'Find your feeling.' : screen === 'bag' ? 'Your bag' : 'My orders'}</Text>
        <Text style={styles.subheading}>{screen === 'shop' ? 'Wigs, ponytails and extensions for your everyday edit.' : screen === 'bag' ? 'Your selected MFH pieces.' : 'Your order history stays with your account.'}</Text>
      </View>

      {message ? <Pressable onPress={() => setMessage('')} style={styles.notice}><Text style={styles.noticeText}>{message}</Text><Text style={styles.dismiss}>×</Text></Pressable> : null}

      {screen === 'shop' && <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.filter, category === item && styles.filterActive]}><Text style={[styles.filterText, category === item && styles.filterTextActive]}>{item}</Text></Pressable>)}
        </ScrollView>
        <FlatList
          data={filteredProducts}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.productList}
          columnWrapperStyle={styles.productRow}
          renderItem={({ item }) => <View style={styles.productCard}>
            <Image source={{ uri: item.photo }} style={styles.productImage} resizeMode="cover" />
            <Text style={styles.productTag}>{item.badge}</Text>
            <Text style={styles.productMaterial}>{item.material}</Text>
            <Text numberOfLines={2} style={styles.productName}>{item.name}</Text>
            <View style={styles.productFooter}><Text style={styles.price}>{money(item.price)}</Text><Pressable onPress={() => addToBag(item)} style={styles.addButton}><Text style={styles.addButtonText}>＋</Text></Pressable></View>
          </View>}
          ListFooterComponent={<Text style={styles.catalogNote}>Sample prices and product photos. Confirm product details with MFH Hair before placing real orders.</Text>}
        />
      </>}

      {screen === 'bag' && <>
        <ScrollView contentContainerStyle={styles.contentPad}>
          {!cart.length ? <View style={styles.emptyCard}><Text style={styles.emptyText}>Your bag is waiting for something lovely.</Text><ActionButton title="Explore the collection" onPress={() => setScreen('shop')} /></View> : <>
            {cart.map((item) => <View key={item.id} style={styles.cartLine}>
              <Image source={{ uri: item.photo }} style={styles.cartImage} />
              <View style={styles.cartDetails}><Text style={styles.productName}>{item.name}</Text><Text style={styles.price}>{money(item.price * item.qty)}</Text><View style={styles.quantity}><Pressable onPress={() => changeQty(item.id, -1)} style={styles.quantityButton}><Text>−</Text></Pressable><Text>{item.qty}</Text><Pressable onPress={() => changeQty(item.id, 1)} style={styles.quantityButton}><Text>＋</Text></Pressable></View></View>
            </View>)}
            <View style={styles.totalLine}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalAmount}>{money(total)}</Text></View>
            <Text style={styles.deliveryNote}>Delivery will be confirmed by MFH Hair.</Text>
            <ActionButton title="Continue to checkout" onPress={() => user ? setCheckoutOpen(true) : signIn()} />
            {!user && <Text style={styles.muted}>Sign in with Google to save your bag across devices and check out.</Text>}
          </>}
        </ScrollView>
      </>}

      {screen === 'orders' && <ScrollView contentContainerStyle={styles.contentPad}>
        {!user ? <View style={styles.emptyCard}><Text style={styles.emptyText}>Sign in to see your saved orders.</Text><ActionButton title="Sign in with Google" onPress={signIn} /></View> : busy ? <ActivityIndicator color="#8e5034" size="large" /> : !orders.length ? <View style={styles.emptyCard}><Text style={styles.emptyText}>No orders yet.</Text><ActionButton title="Browse the collection" onPress={() => setScreen('shop')} /></View> : orders.map((order) => <View key={order.id} style={styles.orderCard}>
          <View style={styles.orderTop}><Text style={styles.productTag}>{new Date(order.created_at).toLocaleDateString()}</Text><Text style={styles.orderStatus}>{order.status || 'received'}</Text></View>
          <Text style={styles.orderRef}>Order {order.id.slice(0, 8).toUpperCase()}</Text>
          {(order.order_items || []).map((item, index) => <Text key={`${order.id}-${index}`} style={styles.orderItem}>{item.product_name} × {item.quantity}</Text>)}
          <Text style={styles.totalAmount}>{money(order.total_kobo / 100)}</Text>
        </View>)}
      </ScrollView>}

      <View style={styles.tabBar}>
        <Tab label="Shop" selected={screen === 'shop'} onPress={() => setScreen('shop')} />
        <Tab label={`Bag${itemCount ? ` (${itemCount})` : ''}`} selected={screen === 'bag'} onPress={() => setScreen('bag')} />
        <Tab label="My orders" selected={screen === 'orders'} onPress={() => user ? setScreen('orders') : signIn()} />
      </View>

      <Modal visible={checkoutOpen} animationType="slide" onRequestClose={() => setCheckoutOpen(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}><Pressable onPress={() => setCheckoutOpen(false)}><Text style={styles.linkText}>← Bag</Text></Pressable><Text style={styles.modalTitle}>Checkout</Text><View style={{ width: 42 }} /></View>
          <ScrollView contentContainerStyle={styles.checkoutContent}>
            <Text style={styles.kicker}>ALMOST YOURS</Text>
            <Text style={styles.heading}>Delivery details</Text>
            <TextInput value={delivery.name} onChangeText={(name) => setDelivery({ ...delivery, name })} placeholder="Full name" style={styles.input} />
            <TextInput value={delivery.phone} onChangeText={(phone) => setDelivery({ ...delivery, phone })} placeholder="Phone number" keyboardType="phone-pad" style={styles.input} />
            <TextInput value={delivery.address} onChangeText={(address) => setDelivery({ ...delivery, address })} placeholder="Delivery address" multiline style={[styles.input, styles.addressInput]} />
            <View style={styles.totalLine}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalAmount}>{money(total)}</Text></View>
            <ActionButton title={busy ? 'Saving order…' : `Place order · ${money(total)}`} onPress={placeOrder} disabled={busy} />
            <Text style={styles.deliveryNote}>The same authenticated checkout endpoint as the MFH Hair website is used.</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Tab({ label, selected, onPress }) {
  return <Pressable onPress={onPress} style={styles.tab}><Text style={[styles.tabText, selected && styles.tabTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fbf8f4' },
  loading: { flex: 1, backgroundColor: '#fbf8f4', alignItems: 'center', justifyContent: 'center', gap: 12 },
  topBar: { height: 66, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#eee5dc', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { width: 84, height: 54 }, topActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  linkText: { color: '#60331f', fontSize: 13, fontWeight: '600' }, bagPill: { borderWidth: 1, borderColor: '#c8b7a7', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 13 }, bagPillText: { color: '#32170f', fontSize: 12 },
  pageHeading: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 12 }, kicker: { color: '#8e5034', letterSpacing: 2, fontSize: 10, fontWeight: '700', marginBottom: 8 }, heading: { color: '#32170f', fontFamily: 'Georgia', fontSize: 31 }, subheading: { color: '#786d64', fontSize: 12, lineHeight: 19, marginTop: 6 },
  notice: { marginHorizontal: 18, marginBottom: 10, padding: 11, borderRadius: 8, backgroundColor: '#f1e7dc', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, noticeText: { color: '#543625', fontSize: 11, flex: 1, lineHeight: 17 }, dismiss: { fontSize: 20, color: '#8e5034', paddingLeft: 10 },
  filters: { paddingHorizontal: 18, paddingVertical: 12, gap: 8 }, filter: { borderRadius: 20, borderWidth: 1, borderColor: '#dfd4ca', paddingHorizontal: 13, paddingVertical: 8 }, filterActive: { backgroundColor: '#32170f', borderColor: '#32170f' }, filterText: { color: '#6a5b51', fontSize: 11 }, filterTextActive: { color: '#fff' },
  productList: { paddingHorizontal: 14, paddingBottom: 92 }, productRow: { gap: 12 }, productCard: { width: '48%', marginBottom: 19, backgroundColor: '#fffdfa' }, productImage: { width: '100%', aspectRatio: 0.82, backgroundColor: '#eee4db' }, productTag: { color: '#92796b', fontSize: 9, letterSpacing: 1, marginTop: 9, marginHorizontal: 9, textTransform: 'uppercase' }, productMaterial: { color: '#92796b', fontSize: 9, marginHorizontal: 9, marginTop: 6 }, productName: { color: '#32170f', fontFamily: 'Georgia', fontSize: 15, lineHeight: 19, marginHorizontal: 9, marginTop: 4 }, productFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 9, marginTop: 8 }, price: { fontSize: 12, color: '#32170f', fontWeight: '700' }, addButton: { width: 29, height: 29, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#32170f' }, addButtonText: { color: '#fff', fontSize: 20, lineHeight: 22 }, catalogNote: { color: '#887b72', fontSize: 10, lineHeight: 16, textAlign: 'center', marginHorizontal: 12, marginBottom: 15 },
  contentPad: { padding: 18, paddingBottom: 100 }, emptyCard: { padding: 26, alignItems: 'center', backgroundColor: '#f4eee8', gap: 14 }, emptyText: { color: '#786d64', fontSize: 13, textAlign: 'center', lineHeight: 20 }, actionButton: { borderRadius: 3, backgroundColor: '#32170f', paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', marginTop: 8 }, actionButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' }, actionButtonLight: { backgroundColor: '#f5eee8', borderWidth: 1, borderColor: '#cbb8a7' }, actionButtonTextLight: { color: '#32170f' }, disabled: { opacity: 0.5 },
  cartLine: { flexDirection: 'row', gap: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#e8ded4' }, cartImage: { width: 82, height: 96, backgroundColor: '#eee4db' }, cartDetails: { flex: 1, justifyContent: 'center', gap: 8 }, quantity: { flexDirection: 'row', alignItems: 'center', gap: 12 }, quantityButton: { width: 27, height: 27, borderWidth: 1, borderColor: '#d8cabe', borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, totalLine: { borderTopWidth: 1, borderTopColor: '#dacec1', paddingTop: 16, marginTop: 18, flexDirection: 'row', justifyContent: 'space-between' }, totalLabel: { color: '#32170f', fontSize: 13 }, totalAmount: { color: '#32170f', fontSize: 14, fontWeight: '700' }, deliveryNote: { color: '#897c72', fontSize: 10, lineHeight: 16, marginTop: 10 },
  orderCard: { backgroundColor: '#fffdfa', padding: 17, marginBottom: 13 }, orderTop: { flexDirection: 'row', justifyContent: 'space-between' }, orderStatus: { color: '#8e5034', fontSize: 10, textTransform: 'capitalize' }, orderRef: { color: '#32170f', fontSize: 15, fontFamily: 'Georgia', marginTop: 11, marginBottom: 8 }, orderItem: { color: '#786d64', fontSize: 11, lineHeight: 18 },
  tabBar: { height: 62, paddingBottom: 5, backgroundColor: '#fffdfa', borderTopWidth: 1, borderTopColor: '#eee5dc', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }, tab: { padding: 12 }, tabText: { color: '#86776c', fontSize: 11 }, tabTextActive: { color: '#32170f', fontWeight: '700' }, muted: { color: '#897c72', fontSize: 10, marginTop: 12, textAlign: 'center' },
  modalSafe: { flex: 1, backgroundColor: '#fbf8f4' }, modalHeader: { height: 56, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#eee5dc' }, modalTitle: { color: '#32170f', fontFamily: 'Georgia', fontSize: 18 }, checkoutContent: { padding: 22, paddingBottom: 50 }, input: { backgroundColor: '#fffdfa', borderWidth: 1, borderColor: '#dfd4ca', padding: 13, marginTop: 13, color: '#32170f', fontSize: 13 }, addressInput: { height: 86, textAlignVertical: 'top' },
});
