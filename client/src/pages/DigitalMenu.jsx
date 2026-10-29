import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ShoppingBag,
  ShoppingCart,
  Search,
  X,
  Plus,
  Minus,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  User,
  Phone,
  Utensils,
  Sparkles,
  ChevronRight,
  Trash2,
  Share2,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { normalizeFileUrl } from '../utils/fileUrl';

// Base API URL for public calls
const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Fallback culinary icons by category
const CATEGORY_EMOJIS = {
  all: '🔥',
  bun: '🥐',
  buns: '🥐',
  bakery: '🥐',
  pastry: '🥐',
  coffee: '☕',
  hot: '☕',
  beverage: '☕',
  drink: '🥤',
  drinks: '🥤',
  cold: '🧊',
  juice: '🧃',
  smoothie: '🧃',
  shake: '🧃',
  meal: '🥪',
  meals: '🥪',
  sandwich: '🥪',
  burger: '🍔',
  pizza: '🍕',
  breakfast: '🍳',
  dessert: '🍰',
  default: '🍽️',
};

function getCategoryEmoji(catName = '') {
  const lower = String(catName || '').toLowerCase();
  for (const [key, emoji] of Object.entries(CATEGORY_EMOJIS)) {
    if (lower.includes(key)) return emoji;
  }
  return CATEGORY_EMOJIS.default;
}

export default function DigitalMenu() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Read table from query param: /menu?table=5 or /menu?table=T-07
  const initialTable = searchParams.get('table') || searchParams.get('t') || '';

  // ── States ─────────────────────────────────────────────────────────────
  const [showSplash, setShowSplash]       = useState(!initialTable);
  const [loading, setLoading]             = useState(true);
  const [menuData, setMenuData]           = useState({
    products: [],
    categories: [],
    cafeName: 'Baba Roti Café',
    tagline: 'Good Food • Good Mood',
    taxRate: 15,
    serviceChargeRate: 10,
    enableServiceCharge: false,
  });

  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery]       = useState('');

  // Cart: Array of { product, quantity, size, selectedExtras, notes, unitPrice, lineTotal }
  const [cart, setCart]                     = useState([]);
  const [cartOpen, setCartOpen]             = useState(false);
  const [checkoutOpen, setCheckoutOpen]     = useState(false);

  // Active item detail/customizer modal
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customSize, setCustomSize]           = useState('Regular');
  const [selectedExtras, setSelectedExtras]   = useState([]);
  const [itemNotes, setItemNotes]             = useState('');

  // Checkout Form
  const [orderType, setOrderType]         = useState('dine_in');
  const [tableNo, setTableNo]             = useState(initialTable || 'Table 01');
  const [customerName, setCustomerName]   = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [specialNotes, setSpecialNotes]   = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Placed Order Screen
  const [placedOrder, setPlacedOrder]     = useState(null);

  // ── Fetch Public Menu ──────────────────────────────────────────────────
  useEffect(() => {
    async function loadPublicMenu() {
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
          });
        }
      } catch (err) {
        console.error('Failed to load menu:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPublicMenu();
  }, []);

  // Update table if query param changes
  useEffect(() => {
    if (initialTable) {
      setTableNo(initialTable.startsWith('Table') ? initialTable : `Table ${initialTable}`);
      setShowSplash(false);
    }
  }, [initialTable]);

  // ── Filtered Products ──────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    return menuData.products.filter((p) => {
      const matchCat =
        activeCategory === 'All' ||
        (p.category || '').toLowerCase() === activeCategory.toLowerCase();
      const matchSearch =
        !searchQuery.trim() ||
        (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [menuData.products, activeCategory, searchQuery]);

  // ── Extras options available for customizer ────────────────────────────
  const standardExtras = useMemo(() => [
    { id: 'ex_choc', name: 'Extra Belgian Chocolate', price: 40 },
    { id: 'ex_cheese', name: 'Vanilla Cream Cheese', price: 35 },
    { id: 'ex_shot', name: 'Extra Espresso Shot', price: 30 },
    { id: 'ex_caramel', name: 'Rich Caramel Drizzle', price: 25 },
  ], []);

  // ── Open Item Customizer ───────────────────────────────────────────────
  const openCustomizer = (product) => {
    setSelectedProduct(product);
    setCustomSize('Regular');
    setSelectedExtras([]);
    setItemNotes('');
  };

  const toggleExtra = (extra) => {
    setSelectedExtras((prev) =>
      prev.some((e) => e.id === extra.id)
        ? prev.filter((e) => e.id !== extra.id)
        : [...prev, extra]
    );
  };

  const currentCustomPrice = useMemo(() => {
    if (!selectedProduct) return 0;
    const base = Number(selectedProduct.sellingPrice) || 0;
    const sizeMultiplier = customSize === 'Double' ? 1.8 : 1;
    const extrasTotal = selectedExtras.reduce((sum, e) => sum + e.price, 0);
    return Math.round((base * sizeMultiplier + extrasTotal) * 100) / 100;
  }, [selectedProduct, customSize, selectedExtras]);

  // ── Add Item to Cart ───────────────────────────────────────────────────
  const addConfiguredItemToCart = () => {
    if (!selectedProduct) return;
    const newItem = {
      cartId: `${selectedProduct._id}-${Date.now()}-${Math.random()}`,
      product: selectedProduct._id,
      productName: selectedProduct.name,
      category: selectedProduct.category,
      imageUrl: selectedProduct.imageUrl,
      unitPrice: currentCustomPrice,
      quantity: 1,
      size: customSize,
      extras: [...selectedExtras],
      notes: itemNotes.trim(),
    };

    setCart((prev) => [...prev, newItem]);
    setSelectedProduct(null);
  };

  // Quick 1-click add from list card
  const quickAddToCart = (e, product) => {
    e.stopPropagation();
    const newItem = {
      cartId: `${product._id}-${Date.now()}-${Math.random()}`,
      product: product._id,
      productName: product.name,
      category: product.category,
      imageUrl: product.imageUrl,
      unitPrice: Number(product.sellingPrice) || 0,
      quantity: 1,
      size: 'Regular',
      extras: [],
      notes: '',
    };
    setCart((prev) => [...prev, newItem]);
  };

  // Cart Qty updates
  const updateCartQty = (cartId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartId === cartId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  // ── Financial Calculations ─────────────────────────────────────────────
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const taxAmount = useMemo(() => {
    return Math.round((cartSubtotal * (menuData.taxRate / 100)) * 100) / 100;
  }, [cartSubtotal, menuData.taxRate]);

  const serviceChargeAmount = useMemo(() => {
    if (!menuData.enableServiceCharge && orderType !== 'dine_in') return 0;
    return Math.round((cartSubtotal * (menuData.serviceChargeRate / 100)) * 100) / 100;
  }, [cartSubtotal, menuData.enableServiceCharge, menuData.serviceChargeRate, orderType]);

  const cartGrandTotal = useMemo(() => {
    return Math.round((cartSubtotal + taxAmount + serviceChargeAmount) * 100) / 100;
  }, [cartSubtotal, taxAmount, serviceChargeAmount]);

  const totalCartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // ── Place Order to Backend (POS & Kitchen) ─────────────────────────────
  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!cart.length) return;
    if (orderType === 'dine_in' && !tableNo.trim()) {
      alert('Please enter or select your Table Number.');
      return;
    }

    setSubmittingOrder(true);
    try {
      const itemsPayload = cart.map((item) => {
        let lineNotes = item.notes || '';
        if (item.size && item.size !== 'Regular') lineNotes += ` [${item.size}]`;
        if (item.extras && item.extras.length > 0) {
          lineNotes += ` + ${item.extras.map((ex) => ex.name).join(', ')}`;
        }
        return {
          product: item.product,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          notes: lineNotes.trim(),
        };
      });

      const payload = {
        tableNo: orderType === 'dine_in' ? tableNo : 'Takeaway / Counter',
        tableLabel: orderType === 'dine_in' ? tableNo : 'Takeaway',
        customerName: customerName.trim() || 'Walk-in Guest',
        customerPhone: customerPhone.trim(),
        orderType,
        items: itemsPayload,
        tableNotes: specialNotes.trim(),
      };

      const res = await axios.post(`${API_BASE}/captain-orders/customer-order`, payload);
      if (res.data?.success) {
        setPlacedOrder({
          orderNo: res.data.orderNo,
          tableNo: payload.tableNo,
          customerName: payload.customerName,
          grandTotal: res.data.order?.grandTotal || cartGrandTotal,
          itemsCount: totalCartCount,
        });
        setCart([]);
        setCartOpen(false);
        setCheckoutOpen(false);
      }
    } catch (err) {
      console.error('Order submission failed:', err);
      alert(err.response?.data?.message || 'Could not place order. Please try again or inform our server.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // ── SCREEN 1: SPLASH SCREEN ────────────────────────────────────────────
  if (showSplash) {
    return (
      <div className="min-h-screen bg-[#064e3b] text-white flex flex-col justify-between p-6 sm:p-10 select-none">
        {/* Header */}
        <div className="pt-6 text-center space-y-2">
          <div className="h-16 w-16 mx-auto rounded-3xl bg-emerald-800/90 border border-emerald-500/30 flex items-center justify-center text-3xl shadow-xl">
            👨‍🍳
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
            {menuData.cafeName}
          </h1>
          <p className="text-xs sm:text-sm font-semibold tracking-wider text-emerald-300 uppercase">
            Digital Menu
          </p>
          <p className="text-xs text-emerald-200/80">{menuData.tagline}</p>
        </div>

        {/* Hero Culinary Graphic */}
        <div className="my-auto py-6 flex flex-col items-center justify-center text-center">
          <div className="relative">
            <div className="h-56 w-56 sm:h-64 sm:w-64 rounded-full bg-emerald-500/10 flex items-center justify-center animate-pulse">
              <div className="h-44 w-44 sm:h-52 sm:w-52 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-7xl sm:text-8xl shadow-2xl">
                🥐
              </div>
            </div>
            <span className="absolute -bottom-2 bg-amber-400 text-amber-950 font-black text-xs px-3.5 py-1 rounded-full shadow-lg">
              Fresh Daily
            </span>
          </div>
        </div>

        {/* Feature Pills */}
        <div className="space-y-4 max-w-md mx-auto w-full">
          <div className="grid grid-cols-4 gap-2 py-3 border-y border-emerald-700/50 text-[10px] text-emerald-200 text-center font-semibold">
            <div className="bg-emerald-900/60 p-2 rounded-xl">⚡ Quick Order</div>
            <div className="bg-emerald-900/60 p-2 rounded-xl">🛵 Fast Prep</div>
            <div className="bg-emerald-900/60 p-2 rounded-xl">🌱 Fresh Bun</div>
            <div className="bg-emerald-900/60 p-2 rounded-xl">✨ Clean Safe</div>
          </div>

          <button
            onClick={() => setShowSplash(false)}
            className="w-full py-4 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/25 transition-all transform active:scale-98 flex items-center justify-center gap-2"
          >
            <span>View Full Menu</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── SCREEN 6: ORDER CONFIRMATION ───────────────────────────────────────
  if (placedOrder) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-100 text-center space-y-5 animate-in fade-in duration-300">
          <div className="h-20 w-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-4xl mx-auto shadow-inner">
            <CheckCircle2 size={44} className="stroke-[2.5]" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Sent to Kitchen &amp; POS
            </span>
            <h2 className="text-xl font-black text-slate-900 mt-2">Order Confirmed!</h2>
            <p className="text-xs text-slate-500 mt-1">
              Order <strong className="text-emerald-800 font-mono text-sm">{placedOrder.orderNo}</strong> has been received by our kitchen &amp; barista team.
            </p>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 text-xs space-y-2 text-left">
            <div className="flex justify-between">
              <span className="text-slate-500">Destination:</span>
              <strong className="text-slate-900">{placedOrder.tableNo}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Customer Name:</span>
              <strong className="text-slate-900">{placedOrder.customerName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Items Ordered:</span>
              <strong className="text-slate-900">{placedOrder.itemsCount} items</strong>
            </div>
            <div className="flex justify-between pt-2 border-t border-emerald-200 text-sm font-black text-emerald-950">
              <span>Grand Total:</span>
              <span>ETB {Number(placedOrder.grandTotal).toFixed(2)}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            When you are ready to settle the bill, pay with the cashier or your table server via Cash or Telebirr.
          </p>

          <button
            onClick={() => setPlacedOrder(null)}
            className="w-full py-3.5 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs shadow-md transition"
          >
            Order More / Return to Menu
          </button>
        </div>
      </div>
    );
  }

  // ── MAIN MENU SCREEN ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 pb-24">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-900 text-white font-black flex items-center justify-center text-sm shadow-sm">
            BR
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
              {menuData.cafeName}
            </h1>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="font-semibold text-emerald-800">{tableNo}</span>
              <span>&bull;</span>
              <span>Digital Ordering</span>
            </div>
          </div>
        </div>

        {/* Right Side: Table Badge & Cart Icon */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              const newT = prompt('Enter your Table Number (e.g. Table 05, Patio 2):', tableNo);
              if (newT) setTableNo(newT);
            }}
            className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 transition"
          >
            {tableNo} ✎
          </button>

          <button
            onClick={() => setCartOpen(true)}
            className="relative p-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs transition"
            title="Open Cart"
          >
            <ShoppingCart size={18} />
            {totalCartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-amber-950 text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center shadow-sm">
                {totalCartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-4 space-y-4">
        {/* Promotional Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 p-5 sm:p-6 text-white shadow-md">
          <div className="relative z-10 space-y-1 max-w-md">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/30 text-emerald-200 uppercase tracking-wider">
              Freshly Baked
            </span>
            <h2 className="text-lg sm:text-xl font-black tracking-tight">
              Delicious Food Freshly Made
            </h2>
            <p className="text-xs text-emerald-200/90 leading-relaxed">
              Order directly to your table. Crisp signature buns, hot specialty coffee, and savory bites.
            </p>
          </div>
          <span className="absolute right-4 bottom-2 text-6xl opacity-20 pointer-events-none">
            🥐
          </span>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for buns, coffee, sandwiches..."
            className="w-full bg-white rounded-2xl border border-slate-200 pl-10 pr-9 py-2.5 text-xs text-slate-800 placeholder-slate-400 shadow-xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          <button
            onClick={() => setActiveCategory('All')}
            className={`px-4 py-2 rounded-2xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shadow-xs ${
              activeCategory === 'All'
                ? 'bg-emerald-800 text-white shadow-emerald-900/20'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>🔥</span>
            <span>All Items</span>
          </button>

          {menuData.categories.map((cat) => {
            const isActive = activeCategory.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-2 rounded-2xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shadow-xs ${
                  isActive
                    ? 'bg-emerald-800 text-white shadow-emerald-900/20'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{getCategoryEmoji(cat)}</span>
                <span>{cat}</span>
              </button>
            );
          })}
        </div>

        {/* Product Cards Grid */}
        {loading ? (
          <div className="py-16 text-center space-y-2">
            <RefreshCw size={24} className="animate-spin mx-auto text-emerald-800" />
            <p className="text-xs text-slate-500 font-medium">Loading delicious menu...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center space-y-2 bg-white rounded-3xl border border-slate-200 p-8">
            <span className="text-3xl">🔍</span>
            <p className="text-sm font-bold text-slate-800">No items found</p>
            <p className="text-xs text-slate-400">Try adjusting your search or category filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {filteredProducts.map((p) => {
              const emoji = getCategoryEmoji(p.category);
              const price = Number(p.sellingPrice) || 0;
              const safeImg = p.imageUrl ? normalizeFileUrl(p.imageUrl) : null;

              return (
                <div
                  key={p._id}
                  onClick={() => openCustomizer(p)}
                  className="bg-white rounded-3xl p-3.5 border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    {/* Thumbnail / Image container */}
                    <div className="h-36 w-full rounded-2xl bg-amber-50/70 border border-slate-100 flex items-center justify-center overflow-hidden relative">
                      {safeImg ? (
                        <img
                          src={safeImg}
                          alt={p.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <span className="text-5xl group-hover:scale-110 transition-transform duration-300 select-none">
                          {emoji}
                        </span>
                      )}
                      <span className="absolute top-2 left-2 bg-white/90 backdrop-blur-xs text-slate-700 font-bold text-[10px] px-2 py-0.5 rounded-lg shadow-xs">
                        {p.category || 'Specialty'}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="mt-2.5">
                      <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-emerald-900 transition-colors line-clamp-1">
                        {p.name}
                      </h3>
                      {p.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {p.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Price & Quick Add Button */}
                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Price</span>
                      <strong className="text-xs sm:text-sm font-black text-emerald-900">
                        ETB {price.toFixed(2)}
                      </strong>
                    </div>

                    <button
                      onClick={(e) => quickAddToCart(e, p)}
                      className="h-8 w-8 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white flex items-center justify-center text-sm font-bold shadow-xs active:scale-95 transition"
                      title="Quick Add to Cart"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar */}
      {totalCartCount > 0 && !cartOpen && !checkoutOpen && (
        <div className="fixed bottom-4 inset-x-4 max-w-lg mx-auto z-40 animate-in slide-in-from-bottom duration-300">
          <div
            onClick={() => setCartOpen(true)}
            className="bg-emerald-950 text-white rounded-2xl p-3.5 shadow-2xl border border-emerald-700/60 flex items-center justify-between cursor-pointer hover:bg-black transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                {totalCartCount}
              </div>
              <div>
                <p className="text-xs font-bold text-white">View Your Order Cart</p>
                <p className="text-[11px] text-emerald-300 font-semibold">
                  ETB {cartGrandTotal.toFixed(2)} &bull; {tableNo}
                </p>
              </div>
            </div>

            <button className="px-3.5 py-1.5 rounded-xl bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow-sm">
              <span>Checkout</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── ITEM CUSTOMIZER MODAL ─────────────────────────────────────── */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
          >
            {/* Modal Header Photo */}
            <div className="relative h-44 bg-amber-50 flex items-center justify-center text-7xl shrink-0">
              {selectedProduct.imageUrl ? (
                <img
                  src={normalizeFileUrl(selectedProduct.imageUrl)}
                  alt={selectedProduct.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{getCategoryEmoji(selectedProduct.category)}</span>
              )}

              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-3 left-3 h-8 w-8 rounded-full bg-white/90 text-slate-800 flex items-center justify-center shadow-md text-xs font-bold hover:bg-white"
              >
                <ArrowLeft size={14} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 flex-1">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    {selectedProduct.name}
                  </h3>
                  <span className="text-base font-black text-emerald-900 shrink-0">
                    ETB {Number(selectedProduct.sellingPrice).toFixed(2)}
                  </span>
                </div>
                {selectedProduct.description && (
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {selectedProduct.description}
                  </p>
                )}
              </div>

              {/* Portion Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Size / Portion</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setCustomSize('Regular')}
                    className={`p-2.5 rounded-xl border text-left transition font-semibold flex items-center justify-between ${
                      customSize === 'Regular'
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-950 font-bold'
                        : 'border-slate-200 text-slate-600 bg-slate-50'
                    }`}
                  >
                    <span>Regular</span>
                    <span className="text-[11px] text-slate-500">Standard</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomSize('Double')}
                    className={`p-2.5 rounded-xl border text-left transition font-semibold flex items-center justify-between ${
                      customSize === 'Double'
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-950 font-bold'
                        : 'border-slate-200 text-slate-600 bg-slate-50'
                    }`}
                  >
                    <span>Double / Large</span>
                    <span className="text-[11px] text-emerald-700 font-bold">+80%</span>
                  </button>
                </div>
              </div>

              {/* Add Extras Checklist */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Add Extras / Toppings</label>
                <div className="space-y-1.5 text-xs">
                  {standardExtras.map((ex) => {
                    const isChecked = selectedExtras.some((e) => e.id === ex.id);
                    return (
                      <label
                        key={ex.id}
                        onClick={() => toggleExtra(ex)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition select-none ${
                          isChecked
                            ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-bold'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="accent-emerald-700"
                          />
                          <span>{ex.name}</span>
                        </div>
                        <span className="text-emerald-800 font-bold">+ETB {ex.price.toFixed(2)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Special instructions */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Special Notes for Chef / Barista
                </label>
                <input
                  type="text"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="e.g. Less sweet, extra hot, no ice..."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-600"
                />
              </div>

              {/* Sticky Modal Add Button */}
              <button
                onClick={addConfiguredItemToCart}
                className="w-full py-3.5 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <span>Add to Cart</span>
                <span>&bull;</span>
                <span>ETB {currentCustomPrice.toFixed(2)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SCREEN 4: CART DRAWER ───────────────────────────────────────── */}
      {cartOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end"
          onClick={() => setCartOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white h-full flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200"
          >
            {/* Cart Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCartOpen(false)}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200"
                >
                  <ArrowLeft size={16} />
                </button>
                <h3 className="text-sm font-black text-slate-900">Your Cart</h3>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                  {totalCartCount}
                </span>
              </div>
              <button
                onClick={() => setCart([])}
                className="text-[11px] text-red-600 hover:text-red-700 font-bold"
              >
                Clear All
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {cart.length === 0 ? (
                <div className="py-20 text-center space-y-2 text-slate-400">
                  <ShoppingCart size={40} className="mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">Your cart is empty</p>
                  <p className="text-[11px]">Choose some tasty buns or hot coffee to start ordering.</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.cartId}
                    className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-3"
                  >
                    <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center text-2xl shrink-0">
                      {getCategoryEmoji(item.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-xs text-slate-900 truncate">
                        {item.productName}
                      </p>
                      {item.size && item.size !== 'Regular' && (
                        <p className="text-[10px] text-emerald-700 font-semibold">{item.size}</p>
                      )}
                      {item.extras && item.extras.length > 0 && (
                        <p className="text-[10px] text-slate-400 truncate">
                          +{item.extras.map((e) => e.name).join(', ')}
                        </p>
                      )}
                      <p className="text-xs font-black text-emerald-900 mt-0.5">
                        ETB {(item.unitPrice * item.quantity).toFixed(2)}
                      </p>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                      <button
                        onClick={() => updateCartQty(item.cartId, -1)}
                        className="h-6 w-6 rounded-lg bg-white flex items-center justify-center text-slate-700 hover:bg-slate-200 shadow-xs"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-5 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQty(item.cartId, 1)}
                        className="h-6 w-6 rounded-lg bg-emerald-800 text-white flex items-center justify-center shadow-xs"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bill Summary & Proceed to Checkout */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-3">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span>
                    <span>ETB {cartSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>VAT ({menuData.taxRate}%)</span>
                    <span>ETB {taxAmount.toFixed(2)}</span>
                  </div>
                  {serviceChargeAmount > 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>Service Charge ({menuData.serviceChargeRate}%)</span>
                      <span>ETB {serviceChargeAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                    <span>Grand Total</span>
                    <span className="text-emerald-900 font-black">
                      ETB {cartGrandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setCartOpen(false);
                    setCheckoutOpen(true);
                  }}
                  className="w-full py-3.5 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-1.5"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SCREEN 5: CHECKOUT & TABLE IDENTIFICATION ───────────────────── */}
      {checkoutOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setCheckoutOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto no-scrollbar shadow-2xl flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setCheckoutOpen(false);
                    setCartOpen(true);
                  }}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200"
                >
                  <ArrowLeft size={16} />
                </button>
                <h3 className="text-sm font-black text-slate-900">Checkout &bull; Table Info</h3>
              </div>
              <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                POS Direct
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handlePlaceOrder} className="p-5 space-y-4">
              {/* Order Type */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Order Type
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-bold text-center">
                  <button
                    type="button"
                    onClick={() => setOrderType('dine_in')}
                    className={`py-2.5 rounded-xl border transition ${
                      orderType === 'dine_in'
                        ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    🍽️ Dine-In (Table)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType('takeaway')}
                    className={`py-2.5 rounded-xl border transition ${
                      orderType === 'takeaway'
                        ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    🛍️ Takeaway / Counter
                  </button>
                </div>
              </div>

              {/* Table Selection for Dine-In */}
              {orderType === 'dine_in' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Your Table Number
                    </label>
                    <span className="text-[10px] text-emerald-700 font-semibold">Auto-Assigned</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={tableNo}
                    onChange={(e) => setTableNo(e.target.value)}
                    placeholder="e.g. Table 05 or Patio 2"
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-600"
                  />
                  {/* Quick table pills */}
                  <div className="flex items-center gap-1.5 mt-1.5 overflow-x-auto no-scrollbar">
                    {['Table 01', 'Table 02', 'Table 03', 'Table 05', 'Table 07', 'VIP 1', 'Patio 1'].map(
                      (t) => (
                        <button
                          type="button"
                          key={t}
                          onClick={() => setTableNo(t)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 border ${
                            tableNo === t
                              ? 'bg-emerald-800 text-white border-emerald-800'
                              : 'bg-white text-slate-600 border-slate-200'
                          }`}
                        >
                          {t}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Customer Information */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Guest Information
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
                    <User size={15} className="text-slate-400 shrink-0" />
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Your Name (e.g. Hilal Bey)"
                      className="w-full bg-transparent outline-none font-semibold text-slate-800"
                    />
                  </div>

                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
                    <Phone size={15} className="text-slate-400 shrink-0" />
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Phone Number (optional)"
                      className="w-full bg-transparent outline-none font-semibold text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Special Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Special Request (Optional)
                </label>
                <textarea
                  rows={2}
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  placeholder="e.g. extra napkins, serve coffee after meal..."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none resize-none focus:border-emerald-600"
                />
              </div>

              {/* Order Summary Box */}
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3 text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Items:</span>
                  <span className="font-bold">{totalCartCount}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-extrabold text-sm pt-1 border-t border-emerald-200">
                  <span>Grand Total:</span>
                  <span className="text-emerald-950">ETB {cartGrandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Place Order CTA */}
              <button
                type="submit"
                disabled={submittingOrder}
                className="w-full py-3.5 rounded-2xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                {submittingOrder ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Sending Order to Kitchen...</span>
                  </>
                ) : (
                  <>
                    <span>Place Order &bull; ETB {cartGrandTotal.toFixed(2)}</span>
                    <Check size={14} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
