import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  Search,
  X,
  Plus,
  Minus,
  ChevronLeft,
  ChevronRight,
  PhoneCall,
  CheckCircle2,
  Clock,
  Send,
  AlertTriangle,
  RefreshCw,
  Bell,
  Receipt,
  Check,
  ShoppingBag,
  Info,
} from 'lucide-react';
import { normalizeFileUrl } from '../utils/fileUrl';

// Base API URL
const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Multilingual Dictionary (English <-> Amharic)
const TRANSLATIONS = {
  en: {
    callWaiter: 'Waiter',
    callWaiterTitle: 'Call Table Waiter',
    requestBill: 'Request Bill',
    billBanner: 'Bill requested • a waiter is coming to your table',
    waiterBanner: 'Waiter called • assistance is on the way to your table',
    searchPlaceholder: 'Search drinks, meals, pastries...',
    allItems: 'All Items',
    details: 'Details',
    add: 'Add',
    soldOut: 'Sold Out',
    shortage: 'Shortage',
    orderStatus: 'ORDER STATUS',
    reviewOrder: 'Review Your Order',
    remove: 'Remove',
    notePlaceholder: 'Note: No Sugar, Less Ice, Extra Mayo...',
    submitOrder: 'SUBMIT ORDER',
    orderSentTitle: 'Your order is sent successfully',
    statusSent: 'SENT •••',
    waitingWaiter: 'Waiting for your waiter to confirm',
    checkStatus: 'CHECK YOUR ORDER STATUS',
    addMoreNotice: "Want to add more? You can order again anytime, it joins your table's bill automatically.",
    backToMenu: '← Back to Menu',
    nowAvailable: 'Now Available',
    items: 'ITEM(S)',
    switchLang: 'አማርኛ ⇄',
  },
  am: {
    callWaiter: 'አስተናጋጅ',
    callWaiterTitle: 'አስተናጋጅ ጥራ',
    requestBill: 'ሂሳብ አምጣ',
    billBanner: 'የሂሳብ ጥያቄ ደርሷል • አስተናጋጅ ወደ ጠረጴዛዎ እየመጣ ነው',
    waiterBanner: 'አስተናጋጅ ተጠርቷል • እርዳታ ወደ ጠረጴዛዎ እየመጣ ነው',
    searchPlaceholder: 'ምግቦች፣ መጠጦች፣ ኬኮች ፈልግ...',
    allItems: 'ሁሉም ምግቦች',
    details: 'ዝርዝር',
    add: 'ጨምር',
    soldOut: 'አልቋል',
    shortage: 'እጥረት አለ',
    orderStatus: 'የትዕዛዝ ሁኔታ',
    reviewOrder: 'ትዕዛዝዎን ይመልከቱ',
    remove: 'አስወግድ',
    notePlaceholder: 'ማስታወሻ፡ ያለ ስኳር፣ በረዶ ቀንሶ...',
    submitOrder: 'እዘዝ (SUBMIT)',
    orderSentTitle: 'ትዕዛዝዎ በተሳካ ሁኔታ ተልኳል',
    statusSent: 'ተልኳል •••',
    waitingWaiter: 'አስተናጋጅ እስኪያረጋግጥ በመጠበቅ ላይ',
    checkStatus: 'የትዕዛዝ ሁኔታን ይመልከቱ',
    addMoreNotice: 'ተጨማሪ ማዘዝ ይፈልጋሉ? በፈለጉት ሰዓት ማዘዝ ይችላሉ፤ ሂሳቡ ከጠረጴዛዎ ጋር ይያያዛል።',
    backToMenu: '← ወደ ሜኑ ተመለስ',
    nowAvailable: 'አሁን ዝግጁ ነው',
    items: 'እቃዎች',
    switchLang: 'English ⇄',
  },
};

export default function DigitalMenu() {
  const [searchParams] = useSearchParams();

  // Active table detection from URL query (?table=36 or ?table=Table 05)
  const initialTable = searchParams.get('table') || searchParams.get('t') || 'Table 36';

  // ── States ─────────────────────────────────────────────────────────────
  const [lang, setLang] = useState('en'); // 'en' | 'am'
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  const [loading, setLoading] = useState(true);
  const [menuData, setMenuData] = useState({
    products: [],
    categories: [],
    cafeName: 'Baba Roti Café',
    tagline: 'Good Food • Good Mood',
    taxRate: 15,
    serviceChargeRate: 10,
    enableServiceCharge: false,
    digitalMenuSettings: {},
  });

  const [tableNo, setTableNo] = useState(initialTable);
  const [customerName, setCustomerName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All Items');

  // Featured Carousel Index
  const [featuredIndex, setFeaturedIndex] = useState(0);

  // Cart: Array of { product, name, price, quantity, note, imageUrl }
  const [cart, setCart] = useState([]);
  const [viewState, setViewState] = useState('menu'); // 'menu' | 'review' | 'confirmed' | 'status'

  // Service Request Banner: { type: 'bill'|'waiter', time: '08:12', message: '...' }
  const [serviceAlert, setServiceAlert] = useState(null);
  const [waiterModalOpen, setWaiterModalOpen] = useState(false);
  const [submittingService, setSubmittingService] = useState(false);

  // Selected Product for Details Modal
  const [detailProduct, setDetailProduct] = useState(null);

  // Confirmed Order Info
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // ── Fetch Public Menu ──────────────────────────────────────────────────
  const fetchMenu = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/products/public-menu`);
      if (res.data) {
        setMenuData({
          products: res.data.products || [],
          categories: res.data.categories || [],
          cafeName: res.data.cafeName || 'Baba Roti Café',
          tagline: res.data.tagline || 'Good Food • Good Mood',
          taxRate: Number(res.data.taxRate ?? 15),
          serviceChargeRate: Number(res.data.serviceChargeRate ?? 10),
          enableServiceCharge: !!res.data.enableServiceCharge,
          digitalMenuSettings: res.data.digitalMenuSettings || {},
        });
      }
    } catch (err) {
      console.error('Menu load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  // Update table if query param changes
  useEffect(() => {
    if (initialTable) {
      setTableNo(initialTable.startsWith('Table') ? initialTable : `Table ${initialTable}`);
    }
  }, [initialTable]);

  // ── Filtered Food Items ────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    return menuData.products.filter((p) => {
      const matchCat =
        activeCategory === 'All Items' ||
        (p.category || '').toLowerCase() === activeCategory.toLowerCase();
      const matchSearch =
        !searchQuery.trim() ||
        (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.nameAmharic || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [menuData.products, activeCategory, searchQuery]);

  // Featured Carousel Items
  const featuredProducts = useMemo(() => {
    const feat = menuData.products.filter((p) => p.isFeatured);
    return feat.length > 0 ? feat : menuData.products.slice(0, 3);
  }, [menuData.products]);

  // ── Cart Operations ────────────────────────────────────────────────────
  const addToCart = (product) => {
    if (product.isOutOfStock) return;
    setCart((prev) => {
      const exists = prev.find((item) => item.productId === product._id);
      if (exists) {
        return prev.map((item) =>
          item.productId === product._id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          productId: product._id,
          name: lang === 'am' && product.nameAmharic ? product.nameAmharic : product.name,
          price: Number(product.sellingPrice) || 0,
          quantity: 1,
          note: '',
          imageUrl: product.imageUrl,
        },
      ];
    });
  };

  const updateQuantity = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const updateItemNote = (productId, note) => {
    setCart((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, note } : item))
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const cartTotalAmount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const cartTotalCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // ── Submit Order ───────────────────────────────────────────────────────
  const handleSubmitOrder = async () => {
    if (!cart.length) return;
    setSubmittingOrder(true);
    try {
      const itemsPayload = cart.map((item) => ({
        product: item.productId,
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        notes: (item.note || '').trim(),
      }));

      const payload = {
        tableNo,
        tableLabel: tableNo,
        customerName: customerName.trim() || 'Guest',
        orderType: 'dine_in',
        items: itemsPayload,
        tableNotes: '',
      };

      const res = await axios.post(`${API_BASE}/captain-orders/customer-order`, payload);
      if (res.data?.success) {
        setConfirmedOrder({
          orderNo: res.data.orderNo,
          tableNo,
          itemsCount: cartTotalCount,
          totalAmount: res.data.order?.grandTotal || cartTotalAmount,
          orderedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
        setCart([]);
        setViewState('confirmed');
      }
    } catch (err) {
      console.error('Order error:', err);
      alert(err.response?.data?.message || 'Could not place order. Please try again.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // ── Call Waiter / Request Bill ─────────────────────────────────────────
  const handleServiceRequest = async (action) => {
    setSubmittingService(true);
    try {
      const res = await axios.post(`${API_BASE}/captain-orders/call-waiter`, {
        tableNo,
        action,
        customerName,
      });
      if (res.data?.success) {
        setServiceAlert({
          type: action,
          time: res.data.time,
          message:
            action === 'request_bill'
              ? `${t.billBanner} (${res.data.time})`
              : `${t.waiterBanner} (${res.data.time})`,
        });
        setWaiterModalOpen(false);
      }
    } catch (err) {
      alert('Could not notify waiter. Please try again.');
    } finally {
      setSubmittingService(false);
    }
  };

  // Toggle Language English <-> Amharic
  const toggleLanguage = () => {
    setLang((prev) => (prev === 'en' ? 'am' : 'en'));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbf9f4] flex flex-col items-center justify-center space-y-3">
        <RefreshCw size={32} className="animate-spin text-amber-900" />
        <p className="text-xs font-bold text-amber-900 tracking-wide">Loading Baba Roti Menu...</p>
      </div>
    );
  }

  // ── VIEW: REVIEW YOUR ORDER (Image 1 reference) ────────────────────────
  if (viewState === 'review') {
    return (
      <div className="min-h-screen bg-[#fbf9f4] text-slate-800 flex flex-col justify-between max-w-md mx-auto shadow-2xl relative">
        {/* Dark Top Header */}
        <header className="bg-[#271406] text-white px-4 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-md">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setViewState('menu')}
              className="text-amber-300 hover:text-white p-1 text-sm font-bold"
            >
              ✕
            </button>
            <h1 className="text-sm font-black tracking-tight font-serif">
              {t.reviewOrder} &bull; {tableNo}
            </h1>
          </div>
        </header>

        {/* Order Items Body */}
        <div className="flex-1 p-4 space-y-3 overflow-y-auto pb-28">
          {cart.length === 0 ? (
            <div className="py-20 text-center space-y-3 text-slate-400">
              <ShoppingBag size={48} className="mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">Your order is empty</p>
              <button
                onClick={() => setViewState('menu')}
                className="px-4 py-2 rounded-xl bg-amber-900 text-white font-bold text-xs"
              >
                {t.backToMenu}
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.productId}
                className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3"
              >
                {/* Title & Price Header */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-extrabold text-sm text-slate-900">{item.name}</h3>
                  <span className="font-black text-sm text-slate-900 shrink-0">
                    {(item.price * item.quantity).toFixed(0)} ETB
                  </span>
                </div>

                {/* Stepper & Remove */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-sm flex items-center justify-center transition"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="font-extrabold text-sm w-4 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, 1)}
                      className="h-8 w-8 rounded-lg bg-[#d97706] hover:bg-[#b45309] text-white font-black text-sm flex items-center justify-center shadow-xs transition"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="text-xs font-bold text-red-500 hover:text-red-700"
                  >
                    {t.remove}
                  </button>
                </div>

                {/* Note Field (Matches Reference Screenshot) */}
                <div className="bg-[#fefce8] border border-amber-200/80 rounded-xl px-3 py-2 flex items-center gap-2">
                  <span className="text-amber-700 text-xs">📝</span>
                  <input
                    type="text"
                    value={item.note}
                    onChange={(e) => updateItemNote(item.productId, e.target.value)}
                    placeholder={t.notePlaceholder}
                    className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 outline-none"
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sticky Bottom Bar (Exact match to reference screenshot) */}
        {cart.length > 0 && (
          <div className="fixed bottom-0 inset-x-0 max-w-md mx-auto z-40 bg-[#271406] text-white p-3.5 flex items-center justify-between shadow-2xl">
            <div>
              <span className="text-[10px] text-amber-300 font-bold uppercase block tracking-wider">
                {cartTotalCount} {t.items}
              </span>
              <strong className="text-base font-black text-amber-200 font-serif">
                {cartTotalAmount.toFixed(0)} ETB
              </strong>
            </div>

            <button
              onClick={handleSubmitOrder}
              disabled={submittingOrder}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1.5 active:scale-95"
            >
              {submittingOrder ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send size={13} className="fill-slate-950" />
                  <span>{t.submitOrder}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── VIEW: ORDER SENT CONFIRMATION (Image 2 reference) ──────────────────
  if (viewState === 'confirmed' && confirmedOrder) {
    return (
      <div className="min-h-screen bg-[#fbf9f4] p-4 flex flex-col justify-between max-w-md mx-auto relative select-none">
        <div className="my-auto w-full">
          {/* Card with Golden Border (Matches Screenshot) */}
          <div className="bg-white rounded-3xl border-2 border-amber-300/80 p-6 sm:p-7 shadow-lg text-center space-y-4">
            {/* Green Circle Checkmark */}
            <div className="h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl mx-auto shadow-inner">
              <CheckCircle2 size={36} className="stroke-[2.5]" />
            </div>

            {/* Title (Serif Style) */}
            <h2 className="text-xl font-black text-slate-900 font-serif leading-snug">
              {t.orderSentTitle}
            </h2>

            {/* Pill Box: SENT ••• Waiting for waiter */}
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/50 p-3 space-y-1">
              <div className="flex items-center justify-center gap-2 text-amber-900 font-black text-xs tracking-wider">
                <span className="h-2 w-2 rounded-full bg-amber-600 animate-ping"></span>
                <span>{t.statusSent}</span>
              </div>
              <p className="text-[11px] font-bold text-amber-800">{t.waitingWaiter}</p>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Order <strong className="text-slate-900 font-mono">{confirmedOrder.orderNo}</strong> for{' '}
              <strong className="text-slate-900">{confirmedOrder.tableNo}</strong> is sent to the kitchen.
            </p>

            {/* Orange Button: CHECK YOUR ORDER STATUS */}
            <button
              onClick={() => {
                alert(`Order #${confirmedOrder.orderNo} for ${confirmedOrder.tableNo} is received by the kitchen.\nTotal: ${confirmedOrder.totalAmount} ETB\nTime: ${confirmedOrder.orderedAt}`);
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs shadow-md transition"
            >
              {t.checkStatus}
            </button>

            {/* Sub-notice */}
            <p className="text-[11px] text-slate-400 leading-relaxed px-2">
              {t.addMoreNotice}
            </p>

            {/* Dark Brown Button: Back to Menu */}
            <button
              onClick={() => setViewState('menu')}
              className="w-full py-3 rounded-2xl bg-[#271406] hover:bg-[#3b2219] text-amber-200 font-extrabold text-xs shadow-sm transition"
            >
              {t.backToMenu}
            </button>
          </div>
        </div>

        {/* Floating Language Switcher */}
        <div className="pb-3 flex justify-end">
          <button
            onClick={toggleLanguage}
            className="px-3.5 py-1.5 rounded-full bg-[#271406] text-amber-200 font-extrabold text-xs shadow-md border border-amber-600/40 flex items-center gap-1.5 active:scale-95 transition"
          >
            <span>🌐</span>
            <span>{t.switchLang}</span>
          </button>
        </div>
      </div>
    );
  }

  // ── MAIN MENU VIEW (Images 3, 4, 5 reference) ──────────────────────────
  return (
    <div className="min-h-screen bg-[#fbf9f4] text-slate-800 pb-28 max-w-md mx-auto shadow-2xl relative">
      {/* ── 1. DARK ROAST BROWN TOP HEADER (Matches Screenshots) ── */}
      <header className="bg-[#271406] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-full bg-white text-[#271406] flex items-center justify-center text-lg font-black shadow-inner shrink-0">
            🥐
          </div>
          <div>
            <h1 className="text-xs font-black text-white leading-tight uppercase tracking-tight">
              {menuData.cafeName}
            </h1>
            <p className="text-[10px] font-bold text-amber-300">
              MENU &bull; <span className="underline cursor-pointer" onClick={() => {
                const newT = prompt('Change Table Number:', tableNo);
                if (newT) setTableNo(newT);
              }}>{tableNo}</span>
            </p>
          </div>
        </div>

        {/* Call Waiter Button (Exact Match) */}
        <button
          onClick={() => setWaiterModalOpen(true)}
          className="px-3 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-xs shadow-sm flex items-center gap-1 transition active:scale-95"
        >
          <PhoneCall size={12} className="stroke-[2.5]" />
          <span>{t.callWaiter}</span>
        </button>
      </header>

      {/* ── 2. SERVICE BANNER (Bill Requested / Waiter Coming) ── */}
      {serviceAlert && (
        <div className="bg-[#e6f4ea] border-b border-emerald-200 text-emerald-900 px-4 py-2.5 text-xs font-bold flex items-center justify-between animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2">
            <span className="text-emerald-700">✓</span>
            <span>{serviceAlert.message}</span>
          </div>
          <button
            onClick={() => setServiceAlert(null)}
            className="text-emerald-700 hover:text-emerald-900 p-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── 3. FEATURED CAROUSEL (Lasagna Now Available reference) ── */}
      {featuredProducts.length > 0 && (
        <div className="p-3">
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 text-white shadow-md h-48 flex items-end">
            {/* Background Image */}
            <div className="absolute inset-0">
              {featuredProducts[featuredIndex]?.imageUrl ? (
                <img
                  src={normalizeFileUrl(featuredProducts[featuredIndex].imageUrl)}
                  alt="Featured"
                  className="w-full h-full object-cover opacity-80"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-amber-950 to-amber-800 flex items-center justify-center text-7xl">
                  🥐
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            </div>

            {/* Prev/Next Arrow Pills */}
            {featuredProducts.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setFeaturedIndex((prev) => (prev > 0 ? prev - 1 : featuredProducts.length - 1))
                  }
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/50 text-white flex items-center justify-center text-xs hover:bg-black/75 z-10"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() =>
                    setFeaturedIndex((prev) => (prev < featuredProducts.length - 1 ? prev + 1 : 0))
                  }
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/50 text-white flex items-center justify-center text-xs hover:bg-black/75 z-10"
                >
                  <ChevronRight size={16} />
                </button>
              </>
            )}

            {/* Carousel Content */}
            <div className="relative z-10 p-3.5 w-full">
              <h2 className="text-lg font-black text-white font-serif leading-tight">
                {lang === 'am' && featuredProducts[featuredIndex]?.nameAmharic
                  ? featuredProducts[featuredIndex].nameAmharic
                  : featuredProducts[featuredIndex]?.name}
              </h2>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-xs text-amber-300 font-semibold">{t.nowAvailable}</span>
                <span className="text-xs font-black text-amber-400">
                  {Number(featuredProducts[featuredIndex]?.sellingPrice || 0).toFixed(0)} ETB
                </span>
              </div>
            </div>

            {/* Pagination Dots */}
            {featuredProducts.length > 1 && (
              <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5 z-10">
                {featuredProducts.map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-1.5 rounded-full transition-all ${idx === featuredIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                      }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 4. SEARCH INPUT (Exact match) ── */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full bg-white rounded-full border border-slate-200/90 pl-10 pr-9 py-2 text-xs text-slate-800 placeholder-slate-400 shadow-xs outline-none focus:border-amber-700"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── 5. CATEGORY PILLS (Exact match) ── */}
      <div className="px-3 pb-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
        <button
          onClick={() => setActiveCategory('All Items')}
          className={`px-3.5 py-1.5 rounded-full font-bold whitespace-nowrap transition-all shadow-xs ${activeCategory === 'All Items'
              ? 'bg-[#3b2219] text-white border-b-2 border-amber-400'
              : 'bg-white text-slate-700 border border-slate-200'
            }`}
        >
          {t.allItems}
        </button>

        {menuData.categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full font-bold whitespace-nowrap transition-all shadow-xs ${activeCategory.toLowerCase() === cat.toLowerCase()
                ? 'bg-[#3b2219] text-white border-b-2 border-amber-400'
                : 'bg-white text-slate-700 border border-slate-200'
              }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── 6. 2-COLUMN PRODUCT GRID (Exact match to reference screenshots) ── */}
      <div className="px-3 grid grid-cols-2 gap-2.5">
        {filteredProducts.map((p) => {
          const isOut = !!p.isOutOfStock;
          const price = Number(p.sellingPrice || 0);
          const safeImg = p.imageUrl ? normalizeFileUrl(p.imageUrl) : null;
          const displayName = lang === 'am' && p.nameAmharic ? p.nameAmharic : p.name;
          const displayDesc =
            lang === 'am' && p.descriptionAmharic ? p.descriptionAmharic : p.description;

          return (
            <div
              key={p._id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col justify-between relative group hover:border-amber-300 transition"
            >
              <div>
                {/* Photo with Overlaid "🔍 Details" button */}
                <div className="relative h-32 w-full bg-[#f4ece1] flex items-center justify-center overflow-hidden">
                  {safeImg ? (
                    <img src={safeImg} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-4xl select-none">🥐</span>
                  )}

                  {/* Overlaid Details button on bottom right of photo */}
                  <button
                    onClick={() => setDetailProduct(p)}
                    className="absolute bottom-1.5 right-1.5 bg-black/70 hover:bg-black/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm backdrop-blur-xs transition"
                  >
                    <span>🔍</span> {t.details}
                  </button>

                  {/* Shortage / Out of Stock Banner */}
                  {isOut && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center">
                      <span className="bg-red-600 text-white font-black text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                        {t.soldOut}
                      </span>
                    </div>
                  )}
                </div>

                {/* Details Section */}
                <div className="p-2.5">
                  <h3 className="font-extrabold text-slate-900 text-xs leading-tight line-clamp-1">
                    {displayName}
                  </h3>
                  {displayDesc && (
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {displayDesc}
                    </p>
                  )}
                </div>
              </div>

              {/* Price & Add Button Row */}
              <div className="px-2.5 pb-2.5 pt-1 flex items-center justify-between">
                <span className="font-black text-xs text-slate-900">
                  {price.toFixed(0)} ETB
                </span>

                <button
                  disabled={isOut}
                  onClick={() => addToCart(p)}
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold shadow-xs transition active:scale-95 flex items-center gap-1 ${isOut
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-[#d97706] hover:bg-[#b45309] text-white'
                    }`}
                >
                  <span>+</span>
                  <span>{t.add}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 7. FLOATING ORDER STATUS BAR (Exact match to reference screenshots) ── */}
      {cart.length > 0 && (
        <div className="fixed bottom-3 inset-x-3 max-w-md mx-auto z-40">
          <div
            onClick={() => setViewState('review')}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-2xl p-3 shadow-2xl flex items-center justify-between cursor-pointer active:scale-98 transition-all"
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-950 animate-pulse"></span>
              <span>
                {t.orderStatus} &bull; {cartTotalCount}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-extrabold">{cartTotalAmount.toFixed(0)} ETB</span>
              <span className="text-sm">^</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. FLOATING AMHARIC/ENGLISH SWITCHER (Exact match to reference screenshots) ── */}
      <div className="fixed bottom-16 right-3 z-30">
        <button
          onClick={toggleLanguage}
          className="px-3.5 py-1.5 rounded-full bg-[#271406] hover:bg-[#3b2219] text-amber-200 font-extrabold text-xs shadow-xl border border-amber-600/40 flex items-center gap-1.5 active:scale-95 transition"
        >
          <span>🌐</span>
          <span>{t.switchLang}</span>
        </button>
      </div>

      {/* ── CALL WAITER / REQUEST BILL MODAL ── */}
      {waiterModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setWaiterModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-sm space-y-4 shadow-2xl text-center"
          >
            <div className="h-14 w-14 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center text-2xl mx-auto shadow-inner">
              🛎️
            </div>

            <div>
              <h3 className="font-black text-base text-slate-900">{t.callWaiterTitle}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Need service or ready to settle for <strong>{tableNo}</strong>?
              </p>
            </div>

            <div className="space-y-2 pt-1 text-xs font-extrabold">
              <button
                disabled={submittingService}
                onClick={() => handleServiceRequest('call_waiter')}
                className="w-full py-3 rounded-2xl bg-[#271406] hover:bg-[#3b2219] text-amber-200 transition flex items-center justify-center gap-2 shadow-sm"
              >
                <PhoneCall size={15} />
                <span>Call Waiter to Table</span>
              </button>

              <button
                disabled={submittingService}
                onClick={() => handleServiceRequest('request_bill')}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 transition flex items-center justify-center gap-2 shadow-sm"
              >
                <Receipt size={15} />
                <span>{t.requestBill}</span>
              </button>
            </div>

            <button
              onClick={() => setWaiterModalOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── PRODUCT DETAILS MODAL ── */}
      {detailProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setDetailProduct(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-3xl sm:rounded-3xl max-h-[85vh] w-full max-w-md overflow-y-auto no-scrollbar shadow-2xl animate-in slide-in-from-bottom duration-200"
          >
            <div className="relative h-48 bg-[#f4ece1] flex items-center justify-center overflow-hidden">
              {detailProduct.imageUrl ? (
                <img
                  src={normalizeFileUrl(detailProduct.imageUrl)}
                  alt={detailProduct.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-6xl">🥐</span>
              )}
              <button
                onClick={() => setDetailProduct(null)}
                className="absolute top-3 left-3 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-extrabold text-base text-slate-900">{detailProduct.name}</h3>
                <span className="font-black text-base text-slate-900">
                  {Number(detailProduct.sellingPrice || 0).toFixed(0)} ETB
                </span>
              </div>

              {detailProduct.description && (
                <p className="text-xs text-slate-500 leading-relaxed">
                  {detailProduct.description}
                </p>
              )}

              <button
                disabled={detailProduct.isOutOfStock}
                onClick={() => {
                  addToCart(detailProduct);
                  setDetailProduct(null);
                }}
                className={`w-full py-3.5 rounded-2xl font-black text-xs shadow-md transition ${detailProduct.isOutOfStock
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950'
                  }`}
              >
                {detailProduct.isOutOfStock
                  ? t.soldOut
                  : `${t.add} • ${Number(detailProduct.sellingPrice || 0).toFixed(0)} ETB`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
