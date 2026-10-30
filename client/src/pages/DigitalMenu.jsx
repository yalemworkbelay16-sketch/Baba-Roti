import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  ChefHat,
  UtensilsCrossed,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Star,
  MapPin,
  Heart,
  MessageSquare,
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
    orderHistoryTitle: 'Table Orders & Bill',
    runningBill: 'Running Bill',
    activeOrders: 'Active Orders',
    totalItems: 'Total Items',
    trackLive: 'Track Live',
    noOrdersYet: 'No previous orders yet for this table today.',
    statusKitchen: 'PREPARING IN KITCHEN',
    statusReady: 'READY • SERVING TO TABLE',
    statusBilled: 'BILLED • READY TO SETTLE',
    statusPaid: 'PAID & COMPLETED',
    preparingKitchenDesc: 'Our chefs and barista are preparing your food with fresh ingredients.',
    readyServingDesc: 'Your dishes are prepared and our waiter is bringing them to your table.',
    billedDesc: 'Your bill is prepared. Settle with your waiter or at the cashier counter.',
    paidDesc: 'Thank you for dining with us! Have a wonderful day.',
    orderMoreBtn: '+ Add More Food & Drinks',
    requestTotalBillBtn: 'Request Total Table Bill',
    orderPlacedAt: 'Placed at',
    liveKitchenBadge: 'Live Kitchen Tracking',
    aboutTitle: 'About Baba Roti Café',
    locationTitle: 'Visit Our Location',
    locationAddress: 'Around Bole Alem Cinema, Bole Road, Addis Ababa',
    locationHours: 'Open Daily: 07:00 AM - 11:00 PM',
    rateTitle: 'Rate Your Experience',
    rateSubtitle: 'How was your food and service today?',
    submitRating: 'Submit Rating',
    ratingSuccess: 'Thank you for your rating!',
    ratingSuccessSub: 'Your feedback inspires our chef & barista team.',
    leaveComment: 'Share your thoughts or compliments for our team...',
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
    orderHistoryTitle: 'የጠረጴዛው ትዕዛዞች እና ሂሳብ',
    runningBill: 'ወቅታዊ ሂሳብ',
    activeOrders: 'ወቅታዊ ትዕዛዞች',
    totalItems: 'ጠቅላላ እቃዎች',
    trackLive: 'በቀጥታ ተከታተል',
    noOrdersYet: 'ለዚህ ጠረጴዛ ዛሬ የተላለፈ ትዕዛዝ የለም።',
    statusKitchen: 'ወጥ ቤት እየተዘጋጀ ነው',
    statusReady: 'ዝግጁ ነው • እየቀረበ ነው',
    statusBilled: 'ሂሳብ ተዘጋጅቷል',
    statusPaid: 'ተከፍሏል • ተጠናቋል',
    preparingKitchenDesc: 'ሼፎቻችን እና ባሪስታችን ትኩስ ምግቦችን በማዘጋጀት ላይ ናቸው።',
    readyServingDesc: 'ምግቦችዎ ተዘጋጅተዋል፤ አስተናጋጅ ወደ ጠረጴዛዎ እያመጣቸው ነው።',
    billedDesc: 'ሂሳብዎ ዝግጁ ነው፤ ከአስተናጋጅ ወይም በካሸር ጋር መክፈል ይችላሉ።',
    paidDesc: 'ስለመረጡን እናመሰግናለን! መልካም ቀን።',
    orderMoreBtn: '+ ተጨማሪ ምግብ እና መጠጥ እዘዝ',
    requestTotalBillBtn: 'የጠቅላላ ጠረጴዛ ሂሳብ ጥራ',
    orderPlacedAt: 'የታዘዘበት ሰዓት',
    liveKitchenBadge: 'የቀጥታ ወጥ ቤት ክትትል',
    aboutTitle: 'ስለ ባባ ሮቲ ካፌ',
    locationTitle: 'አድራሻችንን ይጎብኙ',
    locationAddress: 'ቦሌ ዓለም ሲኒማ አካባቢ፣ ቦሌ መንገድ፣ አዲስ አበባ',
    locationHours: 'በየቀኑ ክፍት: ከጠዋቱ 1:00 - ማታ 5:00',
    rateTitle: 'አገልግሎታችንን ይገምግሙ',
    rateSubtitle: 'የዛሬው ምግብና መስተንግዷችን እንዴት ነበር?',
    submitRating: 'ግምገማ አስገባ',
    ratingSuccess: 'ስለ ግምገማዎ እናመሰግናለን!',
    ratingSuccessSub: 'አስተያየትዎ አገልግሎታችንን ይበልጥ ለማሻሻል ይረዳናል።',
    leaveComment: 'አስተያየትዎን ወይም ምስጋናዎን እዚህ ያካፍሉን...',
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

  // Service Request Banner & Success Modal
  const [serviceAlert, setServiceAlert] = useState(null);
  const [serviceSuccessModal, setServiceSuccessModal] = useState(null);
  const [waiterModalOpen, setWaiterModalOpen] = useState(false);
  const [submittingService, setSubmittingService] = useState(false);

  // Selected Product for Details Modal
  const [detailProduct, setDetailProduct] = useState(null);

  // Confirmed Order Info
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Table Order History & Live Tracking States
  const [tableOrdersHistory, setTableOrdersHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [activeTrackingOrder, setActiveTrackingOrder] = useState(null);
  const [liveTrackingData, setLiveTrackingData] = useState(null);
  const liveOrderData = liveTrackingData;

  // Customer Review & Subsystem Licensing States
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewHoverRating, setReviewHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewTags, setReviewTags] = useState([]);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [menuLicensed, setMenuLicensed] = useState(true);

  // ── Fetch Table History (Orders today for this table) ──────────────────
  const fetchTableHistory = useCallback(async () => {
    if (!tableNo) return;
    try {
      const res = await axios.get(`${API_BASE}/captain-orders/table-history?tableNo=${encodeURIComponent(tableNo)}`);
      if (res.data?.success) {
        setTableOrdersHistory(res.data.orders || []);
      }
    } catch (_) { }
  }, [tableNo]);

  useEffect(() => {
    fetchTableHistory();
  }, [fetchTableHistory]);

  // ── Fetch Live Tracking for Active Order ────────────────────────────────
  const fetchLiveTracking = useCallback(async (orderNo) => {
    if (!orderNo) return;
    try {
      const res = await axios.get(`${API_BASE}/captain-orders/track/${encodeURIComponent(orderNo)}`);
      if (res.data?.success && res.data.order) {
        setLiveTrackingData(res.data.order);
      }
    } catch (_) { }
  }, []);

  // Poll live tracking when tracker is open or on confirmed screen
  useEffect(() => {
    const targetOrderNo = activeTrackingOrder?.orderNo || confirmedOrder?.orderNo;
    if (!targetOrderNo) return;

    fetchLiveTracking(targetOrderNo);
    const interval = setInterval(() => {
      fetchLiveTracking(targetOrderNo);
    }, 4500);
    return () => clearInterval(interval);
  }, [activeTrackingOrder, confirmedOrder, fetchLiveTracking]);

  // ── Fetch Public Menu ──────────────────────────────────────────────────
  const fetchMenu = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/products/public-menu`);
      if (res.data) {
        if (res.data.isLicensed === false) {
          setMenuLicensed(false);
        }
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

  // ── Status Stepper & Progress Helpers ──────────────────────────────────
  const getStatusStep = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'billed' || s === 'paid') return 4;
    if (s === 'ready') return 3;
    if (s === 'sent_to_kitchen') return 2;
    return 1;
  };

  const getStatusInfo = (status) => {
    const step = getStatusStep(status);
    switch (step) {
      case 4:
        return {
          label: t.statusBilled,
          desc: t.billedDesc,
          badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          icon: '💵',
        };
      case 3:
        return {
          label: t.statusReady,
          desc: t.readyServingDesc,
          badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
          icon: '🍽️',
        };
      case 2:
        return {
          label: t.statusKitchen,
          desc: t.preparingKitchenDesc,
          badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
          icon: '🍳',
        };
      default:
        return {
          label: t.statusSent,
          desc: t.waitingWaiter,
          badgeColor: 'bg-amber-50 text-amber-900 border-amber-300',
          icon: '🛎️',
        };
    }
  };

  const renderTrackingStepper = (status) => {
    const step = getStatusStep(status);
    const steps = [
      { num: 1, label: 'Sent', icon: '🛎️' },
      { num: 2, label: 'Kitchen', icon: '🍳' },
      { num: 3, label: 'Ready', icon: '🍽️' },
      { num: 4, label: 'Billed', icon: '💵' },
    ];

    return (
      <div className="py-2.5 px-2">
        <div className="relative flex items-center justify-between">
          <div className="absolute top-4 inset-x-6 h-1 bg-slate-200 -z-0">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-500 rounded-full"
              style={{
                width: step === 1 ? '5%' : step === 2 ? '36%' : step === 3 ? '68%' : '100%',
              }}
            />
          </div>

          {steps.map((st) => {
            const isCompleted = step > st.num;
            const isCurrent = step === st.num;
            return (
              <div key={st.num} className="flex flex-col items-center text-center z-10 w-16">
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-black transition-all shadow-xs ${isCurrent
                    ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-200 animate-pulse scale-110'
                    : isCompleted
                      ? 'bg-emerald-500 text-white ring-2 ring-emerald-100'
                      : 'bg-slate-200 text-slate-500'
                    }`}
                >
                  {isCompleted ? <Check size={14} className="stroke-[3]" /> : st.icon}
                </div>
                <span
                  className={`text-[10px] mt-1.5 font-extrabold ${isCurrent ? 'text-amber-900 font-black' : isCompleted ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                >
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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
        const orderData = {
          orderNo: res.data.orderNo,
          tableNo,
          itemsCount: cartTotalCount,
          totalAmount: res.data.order?.grandTotal || cartTotalAmount,
          orderedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: res.data.order?.status || 'sent_to_kitchen',
          order: res.data.order,
        };
        setConfirmedOrder(orderData);
        setActiveTrackingOrder(orderData);
        setCart([]);
        setViewState('confirmed');
        // Refresh table orders history
        fetchTableHistory();
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
          tableNo: res.data.tableNo || tableNo,
          message:
            action === 'request_bill'
              ? `${t.billBanner} (${res.data.time})`
              : `${t.waiterBanner} (${res.data.time})`,
        });
        setServiceSuccessModal({
          type: action,
          time: res.data.time,
          tableNo: res.data.tableNo || tableNo,
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

  // Submit Customer Review / Rating
  const handleReviewSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (reviewSubmitting) return;
    setReviewSubmitting(true);
    try {
      await axios.post(`${API_BASE}/settings/menu-reviews`, {
        customerName: customerName || 'Valued Guest',
        tableNo: tableNo || '',
        rating: reviewRating,
        comment: reviewComment,
        tags: reviewTags,
      });
      setReviewSubmitted(true);
    } catch (_) {
      setReviewSubmitted(true);
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (menuLicensed === false) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex flex-col justify-between max-w-md mx-auto shadow-2xl relative text-slate-800">
        {/* Café Top Brand Bar */}
        <div className="bg-[#271406] text-white px-5 py-4 flex items-center justify-between border-b border-amber-900/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-xl shadow-inner">
              🥐
            </div>
            <div>
              <h1 className="font-serif font-black text-sm tracking-wide text-amber-100 uppercase">
                Baba Roti Café
              </h1>
              <p className="text-[10px] text-amber-300 font-bold tracking-wider">
                Fresh Buns &bull; Specialty Coffee
              </p>
            </div>
          </div>
          {tableNo && (
            <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-stone-950 shadow-sm border border-amber-300">
              {tableNo}
            </span>
          )}
        </div>

        {/* Positive Hospitality Card */}
        <div className="p-6 flex-1 flex flex-col items-center justify-center text-center space-y-5">
          <div className="relative">
            <div className="h-24 w-24 rounded-3xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-200 text-stone-950 flex items-center justify-center text-5xl shadow-xl shadow-amber-900/10 border-4 border-white">
              ✨
            </div>
            <div className="absolute -bottom-2 -right-2 h-10 w-10 rounded-2xl bg-[#271406] text-white flex items-center justify-center text-lg border-2 border-amber-300 shadow">
              ☕
            </div>
          </div>

          <div className="space-y-2 max-w-xs">
            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
              A Warm Welcome to Our Café!
            </span>
            <h2 className="font-serif text-2xl font-black text-stone-900 leading-tight">
              We're Delighted You're Here!
            </h2>
            <p className="text-xs text-stone-600 leading-relaxed pt-1">
              Our digital self-ordering is taking a brief rest while our chefs prepare today's fresh delicacies.
            </p>
            <p className="text-xs font-semibold text-amber-900 bg-amber-50/80 p-3 rounded-2xl border border-amber-200/80 leading-relaxed">
              👋 Our friendly waiter will be right at your table in just a moment to present our menu and take your order in person!
            </p>
          </div>

          {/* Quick Waiter Call Button */}
          <div className="w-full max-w-xs pt-2 space-y-2">
            <button
              onClick={() => handleServiceRequest('call_waiter')}
              disabled={submittingService}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-black text-xs shadow-md transition flex items-center justify-center gap-2 active:scale-98"
            >
              <Bell size={16} />
              <span>{submittingService ? 'Calling Waiter...' : `Call Waiter to ${tableNo || 'My Table'}`}</span>
            </button>
            <p className="text-[10px] text-stone-400 font-medium">
              Tap above to notify our team immediately &bull; Table alert is instant
            </p>
          </div>

          {/* Service Alert Toast if called */}
          {serviceAlert && (
            <div className="w-full max-w-xs p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold shadow-sm flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{serviceAlert.message}</span>
            </div>
          )}
        </div>

        {/* Location & Hospitality Footer */}
        <div className="p-4 bg-white border-t border-stone-200/80 text-center space-y-1">
          <p className="text-[11px] font-bold text-stone-700">
            📍 Bole, Around Alem Cinema &bull; Addis Ababa
          </p>
          <p className="text-[10px] text-stone-400">
            Enjoy our world-famous freshly baked coffee buns &amp; handcrafted beverages
          </p>
        </div>
      </div>
    );
  }

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

            {/* Live 4-Step Animated Tracking Stepper */}
            <div className="py-1">
              {renderTrackingStepper(liveTrackingData?.status || confirmedOrder.status || 'sent_to_kitchen')}
            </div>

            {/* Orange Button: CHECK YOUR ORDER STATUS (Opens interactive Live Tracker) */}
            <button
              onClick={() => {
                setActiveTrackingOrder(confirmedOrder);
                setStatusSheetOpen(true);
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs shadow-md transition flex items-center justify-center gap-2 active:scale-98"
            >
              <Clock size={15} />
              <span>{t.checkStatus}</span>
            </button>

            {/* View Table History & Running Bill Button */}
            <button
              onClick={() => setHistoryOpen(true)}
              className="w-full py-2.5 rounded-2xl bg-amber-50 border border-amber-300/80 hover:bg-amber-100 text-amber-950 font-extrabold text-xs transition flex items-center justify-center gap-1.5"
            >
              <Receipt size={14} className="text-amber-700" />
              <span>{t.orderHistoryTitle}</span>
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
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-bold text-amber-300">
                MENU &bull; <span className="underline cursor-pointer" onClick={() => {
                  const newT = prompt('Change Table Number:', tableNo);
                  if (newT) setTableNo(newT);
                }}>{tableNo}</span>
              </p>
              {tableOrdersHistory.length > 0 && (
                <button
                  onClick={() => setHistoryOpen(true)}
                  className="rounded-full bg-amber-500/25 hover:bg-amber-500/40 text-amber-300 border border-amber-400/30 px-1.5 py-0.2 text-[9px] font-black flex items-center gap-0.5 transition"
                  title="View active orders for this table"
                >
                  <Receipt size={9} />
                  <span>{tableOrdersHistory.length}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1.5">
          {tableOrdersHistory.length > 0 && (
            <button
              onClick={() => setHistoryOpen(true)}
              className="px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-amber-200 font-bold text-xs flex items-center gap-1 transition border border-white/10"
              title="Table Orders & Bill"
            >
              <Receipt size={12} className="text-amber-300" />
              <span>Bill</span>
            </button>
          )}

          {/* Call Waiter Button (Exact Match) */}
          <button
            onClick={() => setWaiterModalOpen(true)}
            className="px-3 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-xs shadow-sm flex items-center gap-1 transition active:scale-95"
          >
            <PhoneCall size={12} className="stroke-[2.5]" />
            <span>{t.callWaiter}</span>
          </button>
        </div>
      </header>

      {/* ── 2. SERVICE STATUS BOX UI (Attractive Rounded Box Card) ── */}
      {serviceAlert && (
        <div className="px-3 pt-2.5 pb-1">
          <div className="relative rounded-2xl border-2 border-emerald-300/90 bg-gradient-to-r from-emerald-50 via-[#f0fbf4] to-teal-50/80 p-3.5 shadow-sm shadow-emerald-500/10 flex items-start justify-between gap-2.5 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-8 w-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs shadow-emerald-500/30">
                <Check size={16} className="stroke-[3]" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-black text-xs text-emerald-950 tracking-tight">
                    {serviceAlert.type === 'request_bill'
                      ? (lang === 'am' ? 'የሒሳብ መጠየቂያ ተልኳል' : 'Bill Requested')
                      : (lang === 'am' ? 'አስተናጋጅ ተጠርቷል' : 'Waiter Called')}
                  </span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                </div>
                <p className="text-[11px] font-semibold text-emerald-800 leading-snug">
                  {serviceAlert.type === 'request_bill'
                    ? (lang === 'am' ? 'አስተናጋጅ የሒሳብ ደረሰኝ ይዞ ወደ ጠረጴዛዎ እየመጣ ነው' : 'A waiter is coming to your table with the bill')
                    : (lang === 'am' ? 'አስተናጋጅ ወደ ጠረጴዛዎ እየመጣ ነው' : 'A waiter is on the way to assist your table')}
                </p>
                <p className="text-[10px] text-emerald-700/80 font-medium">
                  {lang === 'am' ? 'የተጠየቀበት ሰዓት' : 'Requested at'} {serviceAlert.time} • <span className="font-bold">{serviceAlert.tableNo || tableNo}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setServiceAlert(null)}
              className="h-6 w-6 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-800 flex items-center justify-center text-xs font-bold transition shrink-0"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
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
          const cartItem = cart.find((item) => item.productId === p._id);
          const qtyInCart = cartItem ? cartItem.quantity : 0;

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

              {/* Price & Add Button Row (Interactive +/- Stepper from User Sketch) */}
              <div className="px-2.5 pb-2.5 pt-1 flex items-center justify-between">
                <span className="font-black text-xs text-slate-900">
                  {price.toFixed(0)} ETB
                </span>

                {isOut ? (
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-400 border border-slate-200">
                    {t.soldOut}
                  </span>
                ) : qtyInCart > 0 ? (
                  <div className="flex items-center rounded-xl bg-slate-50 border border-emerald-500/40 p-0.5 shadow-2xs">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateQuantity(p._id, -1);
                      }}
                      className="h-6 w-6 rounded-lg bg-white text-slate-700 hover:bg-slate-100 flex items-center justify-center font-black text-xs shadow-2xs border border-slate-200/80 active:scale-90 transition"
                      title="Decrease"
                    >
                      <Minus size={11} className="stroke-[3]" />
                    </button>
                    <span className="w-5 text-center font-black text-xs text-slate-950 tabular-nums">
                      {qtyInCart}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(p);
                      }}
                      className="h-6 w-6 rounded-lg bg-[#059669] hover:bg-[#047857] text-white flex items-center justify-center font-black text-xs shadow-2xs active:scale-90 transition"
                      title="Increase"
                    >
                      <Plus size={11} className="stroke-[3]" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => addToCart(p)}
                    className="px-3 py-1 rounded-lg text-xs font-extrabold shadow-xs transition active:scale-95 flex items-center gap-1 bg-[#d97706] hover:bg-[#b45309] text-white"
                  >
                    <span>+</span>
                    <span>{t.add}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 6. ABOUT US, LOCATION (BOLE ALEM CINEMA) & EXPERIENCE SECTION ── */}
      <div className="px-3 pt-6 pb-28 space-y-5">
        {/* Section Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px bg-amber-200 flex-1" />
          <span className="text-[11px] font-black text-amber-900 uppercase tracking-widest bg-amber-100/70 px-3 py-1 rounded-full border border-amber-200">
            {t.aboutTitle}
          </span>
          <div className="h-px bg-amber-200 flex-1" />
        </div>

        {/* 1. About Us Card */}
        <div className="rounded-3xl bg-gradient-to-br from-[#271406] via-[#3b2219] to-[#1c0d04] text-white p-5 shadow-xl relative overflow-hidden space-y-3">
          <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🥐</span>
            <div>
              <h3 className="font-serif text-lg font-black text-amber-200 leading-tight">
                Baba Roti Café &amp; Restaurant
              </h3>
              <p className="text-[11px] text-amber-300/80 font-medium">Bole Road &bull; Addis Ababa, Ethiopia</p>
            </div>
          </div>
          <p className="text-xs text-amber-100/80 leading-relaxed font-sans">
            {lang === 'am'
              ? 'በልዩ ጥራትና ፍቅር የሚዘጋጁ ትኩስ የካራሜል ቡኖች፣ በእደ-ጥበብ የተጠበሱ ምርጥ የባሪስታ ቡናዎች፣ ጣፋጭ በርገሮች እና የድንጋይ ምድጃ ፒሳዎች ከሞቅ ያለ እንግዳ ተቀባይነት ጋር።'
              : 'Famous for our freshly baked signature Mexican coffee buns with crisp caramelized butter crust, specialty coffee hand-crafted by master baristas, and gourmet dining in a warm, welcoming ambience.'}
          </p>

          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="p-2 rounded-xl bg-white/5 border border-white/10">
              <span className="text-base block">☕</span>
              <span className="text-[10px] font-extrabold text-amber-200 block mt-0.5">Specialty Coffee</span>
            </div>
            <div className="p-2 rounded-xl bg-white/5 border border-white/10">
              <span className="text-base block">🥐</span>
              <span className="text-[10px] font-extrabold text-amber-200 block mt-0.5">Fresh Buns</span>
            </div>
            <div className="p-2 rounded-xl bg-white/5 border border-white/10">
              <span className="text-base block">👨‍🍳</span>
              <span className="text-[10px] font-extrabold text-amber-200 block mt-0.5">Master Chefs</span>
            </div>
          </div>
        </div>

        {/* 2. Restaurant, Barista & Chef Showcase Gallery */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              <ChefHat size={15} className="text-amber-600" />
              <span>{lang === 'am' ? 'የካፌው ድባብ እና የእጅ ሙያ' : 'Our Baristas, Chefs & Atmosphere'}</span>
            </h4>
            <span className="text-[10px] text-slate-400 font-bold">Baba Roti Gallery</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="relative rounded-2xl overflow-hidden shadow-sm h-36 bg-slate-900 group">
              <img
                src="https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80"
                alt="Barista Latte Art"
                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-2.5">
                <span className="text-[10px] font-black text-white leading-tight">☕ Barista Latte Craft</span>
              </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden shadow-sm h-36 bg-slate-900 group">
              <img
                src="https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80"
                alt="Signature Buns"
                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-2.5">
                <span className="text-[10px] font-black text-white leading-tight">🥐 Fresh Caramel Buns</span>
              </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden shadow-sm h-36 bg-slate-900 group">
              <img
                src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80"
                alt="Master Chef Culinary"
                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-2.5">
                <span className="text-[10px] font-black text-white leading-tight">👨‍🍳 Chef Kitchen Plating</span>
              </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden shadow-sm h-36 bg-slate-900 group">
              <img
                src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80"
                alt="Cozy Atmosphere"
                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-2.5">
                <span className="text-[10px] font-black text-white leading-tight">✨ Cozy Dining Ambiance</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Location & Google Map Card (Around Bole Alem Cinema) */}
        <div className="rounded-3xl border border-amber-200/90 bg-white p-4 shadow-md space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                <MapPin size={15} className="text-amber-600 shrink-0" />
                <span>{t.locationTitle}</span>
              </div>
              <p className="text-[11px] font-bold text-amber-900">
                {t.locationAddress}
              </p>
              <p className="text-[10px] text-slate-500">
                {t.locationHours}
              </p>
            </div>
            <a
              href="https://maps.google.com/?q=Alem+Cinema+Bole+Addis+Ababa"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 text-[10px] font-extrabold flex items-center gap-1 transition shrink-0"
            >
              <span>Map</span>
              <ExternalLink size={11} />
            </a>
          </div>

          {/* Embedded Google Map */}
          <div className="rounded-2xl overflow-hidden border border-slate-200 h-44 relative bg-slate-100 shadow-inner">
            <iframe
              title="Baba Roti Location - Bole Alem Cinema"
              src="https://maps.google.com/maps?q=Alem%20Cinema,%20Bole,%20Addis%20Ababa,%20Ethiopia&t=&z=16&ie=UTF8&iwloc=&output=embed"
              className="w-full h-full border-0"
              loading="lazy"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <a
              href="https://maps.google.com/?q=Alem+Cinema+Bole+Addis+Ababa"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded-xl bg-[#271406] hover:bg-[#3b2219] text-amber-200 font-extrabold text-xs shadow-sm transition flex items-center justify-center gap-1.5"
            >
              <MapPin size={13} className="text-amber-400" />
              <span>{lang === 'am' ? 'በጉግል ካርታ ይክፈቱ (ቦሌ ዓለም ሲኒማ)' : 'Open in Google Maps (Around Alem Cinema)'}</span>
            </a>
          </div>
        </div>

        {/* 4. Interactive "Rate Us" Component */}
        <div className="rounded-3xl border-2 border-amber-300/80 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/40 p-5 shadow-md space-y-3.5">
          {reviewSubmitted ? (
            <div className="text-center py-4 space-y-2 animate-in zoom-in-95 duration-200">
              <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xl shadow-md shadow-emerald-500/20">
                ✓
              </div>
              <h4 className="font-serif text-base font-black text-slate-900">
                {t.ratingSuccess}
              </h4>
              <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
                {t.ratingSuccessSub}
              </p>
              <div className="flex justify-center gap-1 text-amber-500 pt-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={18}
                    className={s <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
                  />
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleReviewSubmit} className="space-y-3">
              <div className="text-center space-y-0.5">
                <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider block">
                  {lang === 'am' ? 'አስተያየት እና ደረጃ' : 'Customer Feedback'}
                </span>
                <h4 className="font-serif text-base font-black text-slate-900">
                  {t.rateTitle}
                </h4>
                <p className="text-xs text-slate-500">
                  {t.rateSubtitle}
                </p>
              </div>

              {/* 5-Star Interactive Rating Selector */}
              <div className="flex items-center justify-center gap-2 py-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onMouseEnter={() => setReviewHoverRating(s)}
                    onMouseLeave={() => setReviewHoverRating(0)}
                    onClick={() => setReviewRating(s)}
                    className="p-1 transition-transform hover:scale-125 active:scale-95 focus:outline-none"
                  >
                    <Star
                      size={28}
                      className={`transition-colors duration-200 ${
                        s <= (reviewHoverRating || reviewRating)
                          ? 'fill-amber-400 text-amber-400 drop-shadow-xs'
                          : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {/* Quick Feedback Tags */}
              <div className="flex flex-wrap gap-1.5 justify-center pt-0.5">
                {[
                  { id: 'delicious', label: '🥐 Delicious Food' },
                  { id: 'coffee', label: '☕ Great Coffee' },
                  { id: 'fast', label: '⚡ Fast Service' },
                  { id: 'friendly', label: '🛎️ Friendly Staff' },
                  { id: 'ambience', label: '✨ Cozy Ambience' },
                ].map((tag) => {
                  const selected = reviewTags.includes(tag.label);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() =>
                        setReviewTags((prev) =>
                          selected ? prev.filter((t) => t !== tag.label) : [...prev, tag.label]
                        )
                      }
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-all ${
                        selected
                          ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300 shadow-2xs'
                          : 'bg-white border border-amber-200 text-slate-600 hover:bg-amber-50'
                      }`}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>

              {/* Comment Textarea */}
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder={t.leaveComment}
                rows={2}
                className="w-full rounded-2xl border border-amber-200 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />

              <button
                type="submit"
                disabled={reviewSubmitting}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs shadow-md transition active:scale-98 flex items-center justify-center gap-1.5"
              >
                {reviewSubmitting ? (
                  <RefreshCw size={13} className="animate-spin text-slate-950" />
                ) : (
                  <Star size={13} className="fill-slate-950" />
                )}
                <span>{t.submitRating}</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── 7. FLOATING ORDER STATUS BAR (Dynamic: Review Cart OR Track Active Order) ── */}
      {cart.length > 0 ? (
        <div className="fixed bottom-3 inset-x-3 max-w-md mx-auto z-40">
          <div
            onClick={() => setViewState('review')}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-2xl p-3 shadow-2xl flex items-center justify-between cursor-pointer active:scale-98 transition-all"
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-950 animate-pulse"></span>
              <span>
                {t.orderStatus} &bull; {cartTotalCount} {t.items}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-extrabold">{cartTotalAmount.toFixed(0)} ETB</span>
              <span className="text-sm">^</span>
            </div>
          </div>
        </div>
      ) : tableOrdersHistory.length > 0 ? (
        <div className="fixed bottom-3 inset-x-3 max-w-md mx-auto z-40">
          <div
            onClick={() => {
              setActiveTrackingOrder(tableOrdersHistory[0]);
              setStatusSheetOpen(true);
            }}
            className="bg-[#271406] hover:bg-[#3b2219] border-2 border-amber-500/50 text-amber-200 font-black rounded-2xl p-3 shadow-2xl flex items-center justify-between cursor-pointer active:scale-98 transition-all"
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="font-mono text-amber-300">#{tableOrdersHistory[0]?.orderNo}</span>
              <span className="text-white/60">•</span>
              <span className="text-white font-extrabold">
                {tableOrdersHistory[0]?.status === 'sent_to_kitchen'
                  ? '🍳 In Kitchen'
                  : tableOrdersHistory[0]?.status === 'ready'
                    ? '🍽️ Ready & Serving'
                    : tableOrdersHistory[0]?.status === 'billed'
                      ? '💵 Billed'
                      : '🛎️ Sent'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <span className="font-extrabold">{t.trackLive}</span>
              <span className="text-sm">^</span>
            </div>
          </div>
        </div>
      ) : null}

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

      {/* ── SERVICE SUCCESS POPUP MODAL (BOX) ── */}
      {serviceSuccessModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-amber-100 text-center space-y-4 animate-in zoom-in-95 duration-200 relative">
            <button
              onClick={() => setServiceSuccessModal(null)}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold transition"
            >
              ✕
            </button>
            <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center text-3xl shadow-lg shadow-emerald-500/30">
              {serviceSuccessModal.type === 'request_bill' ? '💵' : '🛎️'}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 font-serif">
                {serviceSuccessModal.type === 'request_bill'
                  ? (lang === 'am' ? 'የሒሳብ መጠየቂያ ተልኳል!' : 'Bill Requested Successfully!')
                  : (lang === 'am' ? 'አስተናጋጅ ተጠርቷል!' : 'Waiter Called Successfully!')}
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {serviceSuccessModal.type === 'request_bill'
                  ? (lang === 'am'
                      ? `ለጠረጴዛ ${serviceSuccessModal.tableNo || tableNo} የሒሳብ ደረሰኝ ይዞ አስተናጋጅ በደቂቃዎች ውስጥ ወደ እርስዎ ይመጣል።`
                      : `A waiter is on the way with the bill for ${serviceSuccessModal.tableNo || tableNo}.`)
                  : (lang === 'am'
                      ? `ለጠረጴዛ ${serviceSuccessModal.tableNo || tableNo} እርዳታ የሚሰጥ አስተናጋጅ እየመጣ ነው።`
                      : `Assistance is on the way to ${serviceSuccessModal.tableNo || tableNo}.`)}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/90 text-left flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                <Check size={16} className="stroke-[3]" />
              </div>
              <div className="text-[11px] leading-tight">
                <p className="font-extrabold text-emerald-950">
                  {serviceSuccessModal.type === 'request_bill' ? 'Table Bill Request Dispatched' : 'Staff Notified'}
                </p>
                <p className="text-emerald-700 mt-0.5 font-medium">
                  <strong>{serviceSuccessModal.tableNo || tableNo}</strong> • Requested at <strong>{serviceSuccessModal.time}</strong>
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {serviceSuccessModal.type === 'request_bill' && (
                <button
                  onClick={() => {
                    setServiceSuccessModal(null);
                    setHistoryOpen(true);
                  }}
                  className="w-full py-2.5 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-300/80 text-amber-950 font-black text-xs transition flex items-center justify-center gap-1.5"
                >
                  <Receipt size={14} className="text-amber-700" />
                  <span>{t.orderHistoryTitle}</span>
                </button>
              )}
              <button
                onClick={() => setServiceSuccessModal(null)}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs shadow-md transition active:scale-98"
              >
                {lang === 'am' ? 'እሺ (ተረድቻለሁ)' : 'OK, Got It!'}
              </button>
            </div>
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

      {/* ── LIVE ORDER STATUS MODAL / SHEET ── */}
      {statusSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setStatusSheetOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-3xl sm:rounded-3xl max-h-[90vh] w-full max-w-md overflow-y-auto no-scrollbar shadow-2xl p-5 space-y-4 animate-in slide-in-from-bottom duration-200"
          >
            {/* Top Close & Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                <h3 className="font-black text-sm text-slate-900 font-serif">
                  {t.liveStatusTitle}
                </h3>
              </div>
              <button
                onClick={() => setStatusSheetOpen(false)}
                className="text-slate-400 hover:text-slate-700 h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs transition"
              >
                ✕
              </button>
            </div>

            {/* Current Active Order Card */}
            {activeTrackingOrder && (
              <div className="space-y-4">
                {/* Order Meta Header */}
                <div className="rounded-2xl bg-amber-50/70 border border-amber-200 p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                      Order Reference
                    </span>
                    <h4 className="font-black text-base font-mono text-slate-900">
                      #{activeTrackingOrder.orderNo}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activeTrackingOrder.tableNo} &bull; {activeTrackingOrder.orderedAt || (activeTrackingOrder.createdAt ? new Date(activeTrackingOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Total</span>
                    <span className="text-base font-black text-amber-900 font-serif">
                      {Number(activeTrackingOrder.totalAmount || activeTrackingOrder.grandTotal || 0).toFixed(0)} ETB
                    </span>
                  </div>
                </div>

                {/* 4-Step Animated Stepper */}
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-2 px-1">
                    <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      {t.liveKitchenBadge}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Auto-syncing
                    </span>
                  </div>
                  {renderTrackingStepper(liveTrackingData?.status || activeTrackingOrder.status || 'sent_to_kitchen')}

                  {/* Step Description Box */}
                  {(() => {
                    const info = getStatusInfo(liveTrackingData?.status || activeTrackingOrder.status || 'sent_to_kitchen');
                    return (
                      <div className="mt-3 p-3 rounded-xl bg-white border border-slate-200/90 text-center space-y-1">
                        <div className="flex items-center justify-center gap-1.5 text-xs font-black text-slate-900">
                          <span>{info.icon}</span>
                          <span>{info.label}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          {info.desc}
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {/* Items in this order */}
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider px-1">
                    Ordered Dishes
                  </h5>
                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs">
                    {(liveTrackingData?.items || activeTrackingOrder.items || activeTrackingOrder.order?.items || []).map((it, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <span className="font-extrabold text-slate-900">
                            {it.productName || it.name}
                          </span>
                          <span className="text-amber-800 font-bold ml-1.5 text-[11px]">
                            x{it.quantity}
                          </span>
                          {it.notes && (
                            <p className="text-[10px] text-amber-700 italic">
                              Note: {it.notes}
                            </p>
                          )}
                        </div>
                        <span className="font-black text-slate-900">
                          {Number(it.totalPrice || (it.unitPrice * it.quantity) || 0).toFixed(0)} ETB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => {
                      setStatusSheetOpen(false);
                      setHistoryOpen(true);
                    }}
                    className="w-full py-3 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-300/80 text-amber-950 font-black text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <Receipt size={14} className="text-amber-700" />
                    <span>{t.orderHistoryTitle}</span>
                  </button>

                  <button
                    onClick={() => setStatusSheetOpen(false)}
                    className="w-full py-3 rounded-2xl bg-[#271406] hover:bg-[#3b2219] text-amber-200 font-extrabold text-xs transition"
                  >
                    {t.backToMenu}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TABLE ORDER HISTORY & RUNNING BILL DRAWER ── */}
      {historyOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-3xl sm:rounded-3xl max-h-[88vh] w-full max-w-md overflow-y-auto no-scrollbar shadow-2xl p-5 space-y-4 animate-in slide-in-from-bottom duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Receipt size={17} className="text-amber-700" />
                <h3 className="font-black text-sm text-slate-900 font-serif">
                  {t.orderHistoryTitle} &bull; {tableNo}
                </h3>
              </div>
              <button
                onClick={() => setHistoryOpen(false)}
                className="text-slate-400 hover:text-slate-700 h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs transition"
              >
                ✕
              </button>
            </div>

            {/* Running Bill Card */}
            <div className="rounded-2xl bg-gradient-to-br from-[#271406] to-[#451e0e] text-white p-4 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">
                    {t.runningBill} ({tableNo})
                  </span>
                  <strong className="text-2xl font-black text-amber-200 font-serif">
                    {tableOrdersHistory.reduce((s, o) => s + (o.grandTotal || 0), 0).toFixed(0)} ETB
                  </strong>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-amber-300/80 block uppercase font-bold">
                    {t.totalItems}
                  </span>
                  <span className="text-sm font-black text-white">
                    {tableOrdersHistory.reduce((s, o) => s + (o.items?.reduce((cnt, i) => cnt + (i.quantity || 0), 0) || 0), 0)} items
                  </span>
                </div>
              </div>

              {serviceAlert?.type === 'request_bill' && (
                <div className="rounded-xl bg-emerald-500/20 border border-emerald-400/50 p-2.5 text-center text-xs font-bold text-emerald-200 flex items-center justify-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>{lang === 'am' ? 'የሒሳብ መጠየቂያ ተልኳል (አስተናጋጅ በመምጣት ላይ)' : `Bill requested at ${serviceAlert.time} • Waiter on the way`}</span>
                </div>
              )}

              <div className="pt-1 flex gap-2">
                <button
                  onClick={() => {
                    handleServiceRequest('request_bill');
                    setHistoryOpen(false);
                  }}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-amber-950 font-black text-xs shadow-md transition flex items-center justify-center gap-1.5 active:scale-98"
                >
                  <Receipt size={14} />
                  <span>{t.requestTotalBillBtn}</span>
                </button>
                <button
                  onClick={() => {
                    handleServiceRequest('call_waiter');
                    setHistoryOpen(false);
                  }}
                  className="px-3.5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 active:scale-98"
                >
                  <PhoneCall size={14} />
                  <span>{t.callWaiter}</span>
                </button>
              </div>
            </div>

            {/* Order History Rounds */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                Order History (Today)
              </h4>

              {tableOrdersHistory.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <ShoppingBag size={36} className="mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">{t.noOrdersYet}</p>
                </div>
              ) : (
                tableOrdersHistory.map((o) => {
                  const info = getStatusInfo(o.status);
                  const orderDate = new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={o._id}
                      className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs space-y-2.5 hover:border-amber-300 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-xs text-slate-900">
                            #{o.orderNo}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-[11px] text-slate-500 font-semibold">{orderDate}</span>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${info.badgeColor} flex items-center gap-1`}>
                          <span>{info.icon}</span>
                          <span>{info.label.split('•')[0].trim()}</span>
                        </span>
                      </div>

                      {/* Items */}
                      <div className="space-y-1 bg-slate-50/70 rounded-xl p-2.5 text-xs text-slate-800">
                        {o.items?.map((it, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[11px]">
                            <span>
                              {it.productName} <strong className="text-amber-800">x{it.quantity}</strong>
                            </span>
                            <span className="font-semibold text-slate-900">
                              {(it.totalPrice || it.unitPrice * it.quantity || 0).toFixed(0)} ETB
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                        <span className="font-bold text-slate-500">Order Total</span>
                        <div className="flex items-center gap-3">
                          <strong className="font-black text-slate-950 font-serif">
                            {Number(o.grandTotal || 0).toFixed(0)} ETB
                          </strong>
                          <button
                            onClick={() => {
                              setActiveTrackingOrder(o);
                              setHistoryOpen(false);
                              setStatusSheetOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 font-bold text-[10px] flex items-center gap-1 transition"
                          >
                            <span>{t.trackLive}</span>
                            <ArrowRight size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Back Button */}
            <div className="pt-2">
              <button
                onClick={() => setHistoryOpen(false)}
                className="w-full py-3 rounded-2xl bg-[#271406] hover:bg-[#3b2219] text-amber-200 font-black text-xs transition"
              >
                {t.orderMoreBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
