import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../api/axios";
import { posPrint } from "../utils/posPrint";
import { dispatchPrint } from "../utils/localPrintDispatcher";
import { triggerNewOrderAlert } from "../utils/audioAlert";
import {
  Search, Plus, Minus, Trash2, ChevronDown, X, Clock,
  UtensilsCrossed, ReceiptText, Printer, Check, CreditCard,
  Smartphone, Banknote, RefreshCw, ShoppingBag, User,
  Users, Table2, Layers, AlertCircle, MessageSquare,
  History, ArrowRight, CheckCircle2, FileText, ArrowDownLeft,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { normalizeFileUrl } from "../utils/fileUrl";

const ETB = (n) => `ETB ${Number(n || 0).toFixed(2)}`;

// Built-in tables
const ALL_TABLES = [
  ...Array.from({ length: 20 }, (_, i) => ({ id: `T-${i + 1}`, label: `Table ${i + 1}`, section: "Main Hall" })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `VIP-${i + 1}`, label: `VIP ${i + 1}`, section: "VIP Lounge" })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `P-${i + 1}`, label: `Patio ${i + 1}`, section: "Outdoor Patio" })),
];

function Toast({ msg, type = "success", onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  const bg = type === "error" ? "#ef4444" : type === "info" ? "#3b82f6" : "#10b981";
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        background: bg,
        color: "#fff",
        padding: "12px 20px",
        borderRadius: 12,
        fontWeight: 600,
        fontSize: 14,
        boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
        animation: "slideInRight 0.3s ease",
        maxWidth: 360,
      }}
    >
      {msg}
    </div>
  );
}

export default function POS() {
  const { user } = useAuth();
  // Instant Cache Restoration (0ms initial load)
  const [products, setProducts] = useState(() => {
    try {
      const cached = localStorage.getItem("baba_roti_pos_products_cache_v2");
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  });
  const [categories, setCategories] = useState(() => {
    try {
      const cached = localStorage.getItem("baba_roti_pos_categories_cache");
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  });

  const [activeCategory, setActiveCategory] = useState("All");
  const [items, setItems] = useState([]);
  const [orderType, setOrderType] = useState("dine_in");
  const [selectedTable, setSelectedTable] = useState("");
  const [selectedWaiter, setSelectedWaiter] = useState(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [waiters, setWaiters] = useState(() => {
    try {
      const cached = localStorage.getItem("baba_roti_pos_waiters_cache");
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  });

  // Automatically assign logged-in waiter for phone ordering
  useEffect(() => {
    if (user?.role === 'waiter' && user && (!selectedWaiter || selectedWaiter._id !== user._id)) {
      setSelectedWaiter({
        _id: user._id,
        name: user.name,
        role: 'Waiter',
        code: user.phone || '',
      });
    }
  }, [user, selectedWaiter]);
  const [refreshingWaiters, setRefreshingWaiters] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [discountPct, setDiscountPct] = useState(0);
  const [serviceChargePct, setServiceChargePct] = useState(0);
  const [serviceCharge, setServiceCharge] = useState(0);
  const [editingNoteIdx, setEditingNoteIdx] = useState(null);
  const [noteText, setNoteText] = useState("");

  // If we have cached products, start with loading=false so the UI appears instantly
  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem("baba_roti_pos_products_cache_v2");
      return !cached || JSON.parse(cached).length === 0;
    } catch (_) {
      return true;
    }
  });

  const [settings, setSettings] = useState(() => {
    try {
      const cached = localStorage.getItem("baba_roti_pos_settings_cache");
      return cached
        ? JSON.parse(cached)
        : {
          taxRate: 15,
          currency: "ETB",
          enableServiceCharge: false,
          serviceChargeRate: 10,
          serviceChargePresets: [5, 10, 15],
          autoApplyServiceChargeDineIn: false,
        };
    } catch (_) {
      return {
        taxRate: 15,
        currency: "ETB",
        enableServiceCharge: false,
        serviceChargeRate: 10,
        serviceChargePresets: [5, 10, 15],
        autoApplyServiceChargeDineIn: false,
      };
    }
  });

  const [searchQ, setSearchQ] = useState("");

  // Retrieval & Held Order tracking
  const [heldOrderId, setHeldOrderId] = useState(null);
  const [heldOrderNo, setHeldOrderNo] = useState("");
  const [heldOrdersList, setHeldOrdersList] = useState([]);
  const [pendingApprovalOrders, setPendingApprovalOrders] = useState([]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRefModal, setShowRefModal] = useState(false);
  const [refSearchQ, setRefSearchQ] = useState("");

  const [showPayModal, setShowPayModal] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [showWaiterPicker, setShowWaiterPicker] = useState(false);
  const [tableSectionFilter, setTableSectionFilter] = useState("All");
  const [waiterSearchQ, setWaiterSearchQ] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [placing, setPlacing] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [toast, setToast] = useState(null);
  const [clock, setClock] = useState(new Date());

  const searchRef = useRef(null);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  // Clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Table busy check (table has active held order)
  const isTableBusy = useCallback(
    (tableId) => heldOrdersList.some((o) => o.tableNo === tableId),
    [heldOrdersList]
  );

  // Parse active waiters from raw employee directory
  const parseWaitersFromEmployees = useCallback((allEmployees) => {
    const parsedWaiters = [];
    const seen = new Set();
    allEmployees.forEach((emp) => {
      const isActive = !emp.status || String(emp.status).toLowerCase() === "active";
      if (!isActive) return;

      const dept = String(emp.department || "").trim().toLowerCase();
      const pos = String(emp.position || "").trim().toLowerCase();
      const isWaiter =
        dept === "waiter" ||
        pos === "waiter" ||
        dept.includes("waiter") ||
        pos.includes("waiter");
      if (!isWaiter) return;
      const fullName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim();
      if (fullName && !seen.has(fullName.toLowerCase())) {
        seen.add(fullName.toLowerCase());
        parsedWaiters.push({
          _id: emp._id,
          name: fullName,
          role: emp.position || emp.department || "Waiter",
          code: emp.employeeId || "",
        });
      }
    });
    return parsedWaiters;
  }, []);

  // Dedicated function to refresh waiters list
  const refreshWaiters = useCallback(async (notify = false) => {
    try {
      setRefreshingWaiters(true);
      const empRes = await api.get("/employees");
      const allEmployees = Array.isArray(empRes.data) ? empRes.data : [];
      const parsedWaiters = parseWaitersFromEmployees(allEmployees);
      setWaiters(parsedWaiters);
      try {
        localStorage.setItem("baba_roti_pos_waiters_cache", JSON.stringify(parsedWaiters));
      } catch (_) { }
      if (notify) showToast(`Found ${parsedWaiters.length} waiter(s)`);
      return parsedWaiters;
    } catch (_) {
      if (notify) showToast("Failed to refresh waiters", "error");
    } finally {
      setRefreshingWaiters(false);
    }
  }, [parseWaitersFromEmployees]);

  // Auto-refresh waiters whenever picker opens to capture freshly added staff
  useEffect(() => {
    if (showWaiterPicker) {
      refreshWaiters(false);
    }
  }, [showWaiterPicker, refreshWaiters]);

  // Real-time automatic detection: detect when staff are registered or edited in other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "baba_roti_employees_updated" || e.key === "baba_roti_pos_waiters_cache") {
        refreshWaiters(false);
      }
    };
    const handleFocus = () => {
      refreshWaiters(false);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("focus", handleFocus);

    // Silent periodic background check (every 10 seconds)
    const interval = setInterval(() => {
      refreshWaiters(false);
    }, 10000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, [refreshWaiters]);

  // Load products, settings, waiters (Fast POS queries, non-blocking)
  const loadData = useCallback(async () => {
    try {
      // Use lightweight pos=true endpoint and avoid unauthorized calls
      const [prodRes, settRes, empRes] = await Promise.all([
        api.get("/products?pos=true").catch(() => ({ data: [] })),
        api.get("/settings").catch(() => ({ data: {} })),
        api.get("/employees").catch(() => ({ data: [] })),
      ]);

      const prods = Array.isArray(prodRes.data)
        ? prodRes.data
        : prodRes.data?.products || [];

      if (prods.length > 0) {
        setProducts(prods);
        const cats = ["All", ...new Set(prods.map((p) => p.category || "General").filter(Boolean))];
        setCategories(cats);
        try {
          localStorage.setItem("baba_roti_pos_products_cache_v2", JSON.stringify(prods));
          localStorage.setItem("baba_roti_pos_categories_cache", JSON.stringify(cats));
        } catch (_) { }
      }

      if (settRes.data) {
        const newSettings = {
          taxRate: Number(settRes.data?.taxRate ?? 15),
          currency: settRes.data?.currencySymbol || "ETB",
          enableServiceCharge: Boolean(settRes.data?.enableServiceCharge),
          serviceChargeRate: Number(settRes.data?.serviceChargeRate ?? 10),
          serviceChargePresets: Array.isArray(settRes.data?.serviceChargePresets) && settRes.data.serviceChargePresets.length > 0
            ? settRes.data.serviceChargePresets
            : [5, 10, 15],
          autoApplyServiceChargeDineIn: Boolean(settRes.data?.autoApplyServiceChargeDineIn),
        };
        setSettings(newSettings);
        try {
          localStorage.setItem("baba_roti_pos_settings_cache", JSON.stringify(newSettings));
        } catch (_) { }

        // Auto-initialize service charge if enabled and not already explicitly set
        if (newSettings.enableServiceCharge && serviceChargePct === 0) {
          if (!newSettings.autoApplyServiceChargeDineIn || orderType === 'dine_in') {
            setServiceChargePct(newSettings.serviceChargeRate || 10);
          }
        }
      }

      const allEmployees = Array.isArray(empRes.data) ? empRes.data : [];
      const parsedWaiters = parseWaitersFromEmployees(allEmployees);
      setWaiters(parsedWaiters);
      try {
        localStorage.setItem("baba_roti_pos_waiters_cache", JSON.stringify(parsedWaiters));
      } catch (_) { }
    } catch (e) {
      // Soft fail: cached data remains intact
    } finally {
      setLoading(false);
    }
  }, [parseWaitersFromEmployees]);

  // Track known orders to alert cashier when a new customer order arrives
  const knownOrderIdsRef = useRef(null);

  // Load active held orders
  const loadHeldOrders = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await api.get(`/captain-orders?date=${today}&limit=200`);
      const all = res.data || [];
      const pending = all.filter((o) => o.status === "pending_approval");
      setPendingApprovalOrders(pending);
      // Only open/held/sent_to_kitchen/ready orders
      const active = all.filter((o) => ["held", "open", "sent_to_kitchen", "ready", "billed"].includes(o.status));
      setHeldOrdersList(active);

      // Sound & Voice Alert for Cashier on newly arriving QR orders
      if (knownOrderIdsRef.current !== null) {
        const newPending = pending.filter((o) => !knownOrderIdsRef.current.has(o._id));
        newPending.forEach((o) => {
          triggerNewOrderAlert({
            orderId: o._id,
            orderNo: o.orderNo,
            tableNo: o.tableNo,
            itemsCount: o.items?.length,
            totalAmount: o.grandTotal,
          });
          setToast({
            msg: `🛎️ New QR Order at ${o.tableNo || 'Table'} awaiting waiter verification!`,
            type: 'info',
          });
        });
      }

      knownOrderIdsRef.current = new Set([...active.map((o) => o._id), ...pending.map((o) => o._id)]);
    } catch (_) { }
  }, []);

  const handleApprovePendingOrder = async (orderId) => {
    try {
      const res = await api.post(`/captain-orders/${orderId}/approve-order`);
      setToast({ msg: res.data?.message || "Order approved & sent to kitchen!", type: "success" });
      loadHeldOrders();
    } catch (e) {
      setToast({ msg: e.response?.data?.message || "Failed to approve order", type: "error" });
    }
  };

  const handleRejectPendingOrder = async (orderId) => {
    const reason = window.prompt("Reason for declining order (e.g. Table empty / False order):", "Customer not at table");
    if (reason === null) return;
    try {
      const res = await api.post(`/captain-orders/${orderId}/reject-order`, { reason });
      setToast({ msg: res.data?.message || "Order declined.", type: "info" });
      loadHeldOrders();
    } catch (e) {
      setToast({ msg: e.response?.data?.message || "Failed to decline order", type: "error" });
    }
  };

  useEffect(() => {
    loadData();
    loadHeldOrders();
    const interval = setInterval(loadHeldOrders, 10000); // 10s fallback auto-refresh

    // Instant Real-Time SSE listener for customer order submissions & waiter calls
    let es = null;
    let reconnectTimeout = null;

    const connectSSE = () => {
      try {
        const streamUrl = `/api/captain-orders/stream`;
        es = new EventSource(streamUrl);

        es.addEventListener("new_order", (event) => {
          try {
            const parsed = JSON.parse(event.data);
            const o = parsed.data;
            if (o) {
              triggerNewOrderAlert({
                orderId: o._id,
                orderNo: o.orderNo,
                tableNo: o.tableNo,
                itemsCount: o.items?.length,
                totalAmount: o.grandTotal,
              });
              setToast({
                msg: `🛎️ New QR Order at ${o.tableNo || 'Table'}!`,
                type: 'info',
              });
              loadHeldOrders();
            }
          } catch (_) {}
        });

        es.addEventListener("call_waiter", (event) => {
          try {
            const parsed = JSON.parse(event.data);
            const d = parsed.data;
            if (d) {
              triggerNewOrderAlert({
                orderId: Date.now(),
                orderNo: d.action === 'request_bill' ? 'BILL' : 'ASSIST',
                tableNo: d.tableNo,
                itemsCount: 0,
                totalAmount: 0,
              });
              setToast({
                msg: d.action === 'request_bill'
                  ? `💵 Bill requested by ${d.tableNo}!`
                  : `🛎️ Waiter called to ${d.tableNo}!`,
                type: 'info',
              });
            }
          } catch (_) {}
        });

        es.onerror = () => {
          if (es) es.close();
          reconnectTimeout = setTimeout(connectSSE, 5000);
        };
      } catch (_) {}
    };

    connectSSE();

    // BroadcastChannel for instant zero-latency cross-tab notification
    let channel = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('baba_roti_orders_channel');
      channel.onmessage = (msg) => {
        if (msg.data?.type === 'new_order') {
          const o = msg.data.order;
          if (o) {
            triggerNewOrderAlert({
              orderId: o._id,
              orderNo: o.orderNo,
              tableNo: o.tableNo,
              itemsCount: o.items?.length,
              totalAmount: o.grandTotal,
            });
            loadHeldOrders();
          }
        }
      };
    }

    return () => {
      clearInterval(interval);
      if (es) es.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (channel) channel.close();
    };
  }, [loadData, loadHeldOrders]);

  // Computed
  const subtotal = items.reduce((s, i) => s + i.totalPrice, 0);
  const discountAmt = discountPct > 0 ? Math.round((subtotal * discountPct) / 100 * 100) / 100 : 0;
  const taxable = Math.max(0, subtotal - discountAmt);
  const taxAmt = Math.round((taxable * settings.taxRate) / 100 * 100) / 100;
  const serviceChargeAmt = serviceChargePct > 0
    ? Math.round((subtotal * serviceChargePct) / 100 * 100) / 100
    : (Number(serviceCharge) || 0);
  const grandTotal = Math.round((taxable + taxAmt + serviceChargeAmt) * 100) / 100;
  const change = Math.max(0, (Number(amountPaid) || 0) - grandTotal);

  const filteredProducts = products.filter((p) => {
    const matchCat = activeCategory === "All" || p.category === activeCategory;
    const matchQ =
      !searchQ ||
      p.name.toLowerCase().includes(searchQ.toLowerCase()) ||
      (p.code || "").toLowerCase().includes(searchQ.toLowerCase());
    return matchCat && matchQ;
  });

  // Add / modify items in cart
  const addItem = (product) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.product === product._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          quantity: next[idx].quantity + 1,
          totalPrice: (next[idx].quantity + 1) * next[idx].unitPrice,
        };
        return next;
      }
      return [
        ...prev,
        {
          product: product._id,
          productName: product.name,
          productCode: product.code || "",
          category: product.category || "General",
          parentCategory: product.parentCategory || "FOOD",
          unitPrice: Number(product.sellingPrice) || 0,
          quantity: 1,
          totalPrice: Number(product.sellingPrice) || 0,
          notes: "",
          hasRecipe: (product.ingredients?.length || 0) > 0,
        },
      ];
    });
  };

  const changeQty = (idx, delta) => {
    setItems((prev) => {
      const next = [...prev];
      const newQty = next[idx].quantity + delta;
      if (newQty <= 0) {
        next.splice(idx, 1);
        return next;
      }
      next[idx] = { ...next[idx], quantity: newQty, totalPrice: newQty * next[idx].unitPrice };
      return next;
    });
  };

  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const saveItemNote = (idx) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], notes: noteText };
      return next;
    });
    setEditingNoteIdx(null);
    setNoteText("");
  };

  // ── RETRIEVE AN ORDER INTO THE SIDEBAR CART ──────────────────────
  const retrieveOrderToSidebar = (order) => {
    setHeldOrderId(order._id);
    setHeldOrderNo(order.orderNo);
    setSelectedTable(order.tableNo || "");
    setOrderType(order.orderType || "dine_in");
    setCustomerName(order.customerName || "");
    setDiscountPct(order.discountPercent || 0);
    setServiceChargePct(order.serviceChargePercent || 0);
    setServiceCharge(order.serviceCharge || 0);

    const matchedWaiter = waiters.find((w) => w._id === order.waiter || w.name === order.waiterName);
    setSelectedWaiter(matchedWaiter || (order.waiterName ? { _id: order.waiter, name: order.waiterName } : null));

    const retrievedItems = (order.items || []).map((it) => ({
      product: it.product,
      productName: it.productName,
      productCode: it.productCode || "",
      category: it.category || "General",
      parentCategory: it.parentCategory || "FOOD",
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: it.totalPrice,
      notes: it.notes || "",
    }));

    setItems(retrievedItems);
    setShowRefModal(false);
    showToast(`Order #${order.orderNo} (${order.tableNo || "Table"}) retrieved to cart!`);
  };

  // Release / clear retrieved order
  const releaseRetrievedOrder = () => {
    setHeldOrderId(null);
    setHeldOrderNo("");
    setItems([]);
    setSelectedTable("");
    setSelectedWaiter(null);
    setCustomerName("");
    setDiscountPct(0);
    setServiceChargePct(0);
    setServiceCharge(0);
    showToast("Cart cleared. Ready for next order.", "info");
  };

  // ── UNIFIED NETWORK & RELAY PRINTER FIRE ──────────────────────────
  // Dispatches print job to local bridge (127.0.0.1:9101) or central server / relay.
  // Errors are non-blocking — ordering always continues smoothly.
  const firePrinter = async (type, order, opts = {}) => {
    try {
      await dispatchPrint(type, order, { ...opts, fallbackBrowser: false });
    } catch (_) {
      // silent — printer errors must never block ordering
    }
  };

  // ── "ORDER" ACTION: BY DEFAULT PLACES ORDER AS "HELD" ───────────
  const handleOrder = async () => {
    if (!items.length) {
      showToast("Add items to place order", "error");
      return;
    }
    setPlacing(true);
    try {
      const payload = {
        tableNo: selectedTable || "Counter",
        tableLabel: selectedTable || "Counter",
        customerName: customerName || "Guest",
        guestCount: 1,
        orderType,
        waiter: selectedWaiter?._id || null,
        waiterName: selectedWaiter?.name || user?.name || "Staff",
        items: items.map((i) => ({
          product: i.product,
          productName: i.productName,
          productCode: i.productCode || "",
          category: i.category,
          parentCategory: i.parentCategory,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          notes: i.notes || "",
        })),
        discountPercent: discountPct,
        serviceCharge: serviceChargeAmt,
        serviceChargePercent: serviceChargePct,
        status: "held", // Default status is held as requested
      };

      let savedOrder;
      if (heldOrderId) {
        const res = await api.patch(`/captain-orders/${heldOrderId}`, payload);
        savedOrder = res.data.order;
        showToast(`Order #${savedOrder.orderNo} updated & held for ${selectedTable || "Counter"}!`);
      } else {
        const res = await api.post("/captain-orders", payload);
        savedOrder = res.data.order;
        showToast(`Order #${savedOrder.orderNo} placed & held for ${selectedTable || "Counter"}!`);
      }

      // Print KOT on browser (browser print dialog fallback)
      posPrint.printKOT(savedOrder, { businessName: "Baba Roti Café" });

      // Auto-fire to network thermal printer (silent, non-blocking)
      firePrinter('kot', savedOrder, { businessName: "Baba Roti Café" });

      // Reset cart
      setHeldOrderId(null);
      setHeldOrderNo("");
      setItems([]);
      setDiscountPct(0);
      setServiceChargePct(0);
      setServiceCharge(0);
      setCustomerName("");
      setMobileCartOpen(false);
      loadHeldOrders();
    } catch (e) {
      showToast(e.response?.data?.message || "Failed to submit order", "error");
    } finally {
      setPlacing(false);
    }
  };

  // ── "CHECKOUT": CONVERTS TO CASH SALE & DEDUCTS STOCK ────────────
  const placeOrder = async () => {
    if (!items.length) {
      showToast("Add at least one item", "error");
      return;
    }
    if (orderType === "dine_in" && !selectedTable) {
      showToast("Please select a table", "error");
      return;
    }
    setPlacing(true);
    try {
      const payload = {
        orderType,
        tableNo: selectedTable,
        customerName: customerName || "Walk-in Guest",
        waiter: selectedWaiter?._id,
        waiterName: selectedWaiter?.name || "",
        captainOrderRef: heldOrderId || null,
        items: items.map((i) => ({
          product: i.product,
          productName: i.productName,
          productCode: i.productCode,
          category: i.category,
          parentCategory: i.parentCategory,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          notes: i.notes,
        })),
        discountPercent: discountPct,
        serviceCharge: serviceChargeAmt,
        serviceChargePercent: serviceChargePct,
        paymentMethod: payMethod,
        amountPaid: Number(amountPaid) || grandTotal,
        paymentStatus: "paid",
      };

      const res = await api.post("/pos/orders", payload);
      const savedSale = res.data.order;
      setLastOrder(savedSale);

      // Automatically change captain order status from "held" to "paid" (Cash Sales)
      if (heldOrderId) {
        try {
          await api.patch(`/captain-orders/${heldOrderId}`, {
            status: "paid",
            cashSaleRef: savedSale._id,
          });
        } catch (_) { }
      }

      showToast(`Sale #${savedSale.orderNo} completed & converted to Cash Sales! Stock deducted.`);

      // Print receipt in browser (browser print dialog fallback)
      posPrint.printReceipt(savedSale, {
        hotelName: "Baba Roti Café",
        taxRate: settings.taxRate,
      });

      // Auto-fire to network thermal printer (silent, non-blocking)
      firePrinter('receipt', savedSale, {
        hotelName: "Baba Roti Café",
        taxRate: settings.taxRate,
        currency: "ETB",
      });

      // Clear cart
      setHeldOrderId(null);
      setHeldOrderNo("");
      setItems([]);
      setDiscountPct(0);
      setServiceChargePct(0);
      setServiceCharge(0);
      setCustomerName("");
      setAmountPaid("");
      setShowPayModal(false);
      setMobileCartOpen(false);
      loadHeldOrders();
    } catch (e) {
      showToast(e.response?.data?.message || "Failed to complete sale", "error");
    } finally {
      setPlacing(false);
    }
  };

  if (loading && products.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#f8fafc",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <RefreshCw size={36} color="#2563eb" style={{ animation: "spin 1s linear infinite" }} />
          <p style={{ color: "#64748b", marginTop: 12, fontWeight: 700, fontSize: 14 }}>Loading POS Terminal...</p>
        </div>
      </div>
    );
  }

  // Filtered reference modal orders
  const filteredRefOrders = heldOrdersList.filter((o) => {
    if (!refSearchQ) return true;
    const q = refSearchQ.toLowerCase();
    return (
      (o.orderNo || "").toLowerCase().includes(q) ||
      (o.tableNo || "").toLowerCase().includes(q) ||
      (o.waiterName || "").toLowerCase().includes(q) ||
      (o.items || []).some((it) => (it.productName || "").toLowerCase().includes(q))
    );
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "100%",
        flex: 1,
        minHeight: 0,
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideInRight { from { transform: translateX(120%); opacity:0 } to { transform: translateX(0); opacity:1 } }
        @keyframes fadeInUp { from { transform: translateY(10px); opacity:0 } to { transform: translateY(0); opacity:1 } }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(37,99,235,0.4) } 50% { box-shadow: 0 0 0 8px rgba(37,99,235,0) } }
        .pos-product-grid {
          scrollbar-gutter: stable;
        }
        .product-card {
          min-height: 154px !important;
          flex-shrink: 0 !important;
          transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
          animation: fadeInUp 0.25s ease both;
          user-select: none;
        }
        .product-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 28px rgba(37,99,235,0.14), 0 0 0 1.5px #3b82f6 !important;
          border-color: #3b82f6 !important;
        }
        .product-card:active { transform: scale(0.97); }
        .qbtn { transition: all 0.15s; }
        .qbtn:hover { background: #e2e8f0 !important; color: #0f172a !important; transform: scale(1.08); }
        .checkout-btn { transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .checkout-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(16,185,129,0.4) !important; }
        .checkout-btn:active { transform: scale(0.98); }
        .order-btn { transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .order-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(245,158,11,0.35) !important; }
        .ref-card { transition: all 0.15s ease; }
        .ref-card:hover { background: #eff6ff !important; border-color: #3b82f6 !important; transform: translateY(-2px); }
        .cat-pill { transition: all 0.2s ease; }
        .cat-pill:hover { transform: scale(1.04); }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .cart-item { transition: all 0.15s ease; }
        .cart-item:hover { background: #f8fafc !important; }
        @media (max-width: 1023px) {
          .pos-cart-aside {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-width: 100% !important;
            z-index: 100 !important;
            display: none !important;
          }
          .pos-cart-aside.pos-cart-open {
            display: flex !important;
          }
          .pos-mobile-cart-bar {
            display: flex !important;
          }
          .pos-product-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            padding-bottom: 140px !important;
          }
        }
        @media (min-width: 1024px) {
          .pos-cart-aside {
            display: flex !important;
            width: 380px !important;
          }
          .pos-mobile-cart-bar {
            display: none !important;
          }
        }
      `}</style>

      {/* ── TOPBAR HEADER ────────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 18px",
          borderBottom: "1px solid #e2e8f0",
          background: "#ffffff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          flexWrap: "wrap",
          gap: 10,
          zIndex: 20,
          flexShrink: 0,
        }}
      >
        {/* Left: Branding & Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              color: "#fff",
              fontSize: 15,
              letterSpacing: 0.5,
              boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
            }}
          >
            BB
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", letterSpacing: 0.3 }}>
                Baba Roti Café
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: 20,
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  color: "#059669",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                ● POS Station Active
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>Order &amp; Kitchen Dispatch Terminal</div>
          </div>
        </div>

        {/* Center: Dining Options + REFERENCE BUTTON */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Order Types */}
          <div
            style={{
              display: "flex",
              background: "#f1f5f9",
              padding: 3,
              borderRadius: 12,
              border: "1px solid #e2e8f0",
            }}
          >
            {[
              ["dine_in", "Dine In"],
              ["takeaway", "Takeaway"],
              ["delivery", "Delivery"],
            ].map(([val, label]) => {
              const active = orderType === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setOrderType(val);
                    if (val !== "dine_in") {
                      setSelectedTable("");
                    } else if (settings?.autoApplyServiceChargeDineIn && settings?.enableServiceCharge && serviceChargePct === 0) {
                      setServiceChargePct(settings.serviceChargeRate || 10);
                    }
                  }}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 9,
                    border: "none",
                    background: active
                      ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                      : "transparent",
                    color: active ? "#ffffff" : "#475569",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: active ? "0 2px 8px rgba(37,99,235,0.25)" : "none",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Table Button */}
          {orderType === "dine_in" && (
            <button
              type="button"
              onClick={() => setShowTablePicker(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "7px 14px",
                borderRadius: 10,
                border: selectedTable
                  ? "1.5px solid #10b981"
                  : "1.5px solid #cbd5e1",
                background: selectedTable ? "#ecfdf5" : "#ffffff",
                color: selectedTable ? "#059669" : "#334155",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                transition: "all 0.15s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              }}
            >
              <Table2 size={14} />
              <span>{selectedTable ? `Table: ${selectedTable}` : "Table #"}</span>
              <ChevronDown size={12} />
            </button>
          )}

          {/* Waiter Selector */}
          <button
            type="button"
            onClick={() => setShowWaiterPicker(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "7px 14px",
              borderRadius: 10,
              border: selectedWaiter
                ? "1.5px solid #8b5cf6"
                : "1.5px solid #cbd5e1",
              background: selectedWaiter ? "#f5f3ff" : "#ffffff",
              color: selectedWaiter ? "#7c3aed" : "#334155",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
              transition: "all 0.15s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <User size={14} />
            <span>{selectedWaiter ? selectedWaiter.name : "Assign Waiter"}</span>
            <ChevronDown size={12} />
          </button>

          {/* ── REFERENCE BUTTON ── */}
          <button
            type="button"
            onClick={() => {
              loadHeldOrders();
              setShowRefModal(true);
            }}
            title="Click to view all active & held table orders and retrieve any order to the sidebar"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "7px 14px",
              borderRadius: 10,
              border: heldOrdersList.length > 0 ? "1.5px solid #93c5fd" : "1.5px solid #cbd5e1",
              background: heldOrdersList.length > 0 ? "#eff6ff" : "#ffffff",
              color: heldOrdersList.length > 0 ? "#1d4ed8" : "#64748b",
              fontWeight: 800,
              fontSize: 12,
              cursor: "pointer",
              transition: "all 0.15s",
              boxShadow: heldOrdersList.length > 0 ? "0 2px 10px rgba(37,99,235,0.12)" : "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <FileText size={14} />
            <span>Reference</span>
            {heldOrdersList.length > 0 && (
              <span
                style={{
                  background: "#2563eb",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "1px 6px",
                  borderRadius: 10,
                }}
              >
                {heldOrdersList.length}
              </span>
            )}
          </button>

          {/* ── PENDING QR ORDERS BUTTON ── */}
          {pendingApprovalOrders.length > 0 && (
            <button
              type="button"
              onClick={() => setShowApprovalModal(true)}
              title="Click to view and approve customer QR orders awaiting table check"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 13px",
                borderRadius: 10,
                border: "1.5px solid #fde68a",
                background: "#fffbeb",
                color: "#b45309",
                fontWeight: 800,
                fontSize: 12,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(245,158,11,0.25)",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
              <span>{pendingApprovalOrders.length} QR Awaiting Approval</span>
            </button>
          )}
          <a
            href="/menu"
            target="_blank"
            rel="noopener noreferrer"
            title="Open customer-facing QR Digital Menu in new tab"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "7px 12px",
              borderRadius: 10,
              border: "1.5px solid #a7f3d0",
              background: "#ecfdf5",
              color: "#047857",
              fontWeight: 800,
              fontSize: 12,
              textDecoration: "none",
              transition: "all 0.15s",
            }}
          >
            <span>📱 QR Menu</span>
          </a>
        </div>

        {/* Right: Clock & User info */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Live Clock */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "#f8fafc",
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 12,
              fontWeight: 700,
              color: "#0284c7",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <Clock size={13} />
            {clock.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>

          {/* Current User */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#eff6ff",
              padding: "4px 10px 4px 6px",
              borderRadius: 20,
              border: "1px solid #bfdbfe",
            }}
          >
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 800,
                color: "#fff",
              }}
            >
              {user?.name?.[0]?.toUpperCase() || "A"}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#1e40af" }}>
              {user?.name || "Cashier"}
            </span>
          </div>

          {/* Mobile Cart Trigger Button */}
          <button
            type="button"
            className="lg:hidden"
            onClick={() => setMobileCartOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: items.length > 0 ? "linear-gradient(135deg, #2563eb, #1d4ed8)" : "#f1f5f9",
              color: items.length > 0 ? "#ffffff" : "#475569",
              border: items.length > 0 ? "none" : "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: items.length > 0 ? "0 4px 12px rgba(37,99,235,0.3)" : "none",
            }}
          >
            <ShoppingBag size={14} />
            <span>Cart</span>
            {items.length > 0 && (
              <span
                style={{
                  background: "#ffffff",
                  color: "#2563eb",
                  fontSize: 10,
                  fontWeight: 900,
                  borderRadius: "50%",
                  width: 18,
                  height: 18,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {items.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── MAIN 2-COLUMN VIEWPORT: CART ON LEFT | PRODUCTS ON RIGHT ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0, height: "100%" }}>

        {/* ══════════════════════════════════════════════════════════
            LEFT PANEL: CURRENT ORDER CART (Width ~ 380px)
           ══════════════════════════════════════════════════════════ */}
        <aside
          className={`pos-cart-aside ${mobileCartOpen ? "pos-cart-open" : ""}`}
          style={{
            width: 380,
            display: "flex",
            flexDirection: "column",
            background: "#ffffff",
            borderRight: "1px solid #e2e8f0",
            flexShrink: 0,
            zIndex: 10,
            height: "100%",
            maxHeight: "100%",
            minHeight: 0,
            overflow: "hidden",
            boxShadow: "2px 0 10px rgba(0,0,0,0.02)",
          }}
        >
          {/* Order Header */}
          <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #e2e8f0", flexShrink: 0, background: "#ffffff" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ReceiptText size={17} color="#2563eb" />
                <span style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Current Order
                </span>
                <span
                  style={{
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    color: "#2563eb",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 12,
                  }}
                >
                  {items.length} item{items.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Header Actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {/* Mobile Close Button */}
                <button
                  type="button"
                  className="lg:hidden"
                  onClick={() => setMobileCartOpen(false)}
                  title="Close cart and return to menu"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    color: "#334155",
                    padding: "4px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <X size={13} />
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    loadHeldOrders();
                    setShowRefModal(true);
                  }}
                  title="View active held orders"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: 8,
                    color: "#1d4ed8",
                    padding: "4px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <FileText size={11} />
                  Ref ({heldOrdersList.length})
                </button>

                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={releaseRetrievedOrder}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: 8,
                      color: "#ef4444",
                      padding: "4px 8px",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={11} />
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* RETRIEVED HELD ORDER NOTIFICATION BANNER */}
            {heldOrderId && (
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: 8,
                  padding: "6px 10px",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "#b45309",
                  fontWeight: 600,
                }}
              >
                <span>
                  🟡 <strong>Retrieved #{heldOrderNo}</strong> ({selectedTable || "Counter"})
                </span>
                <button
                  type="button"
                  onClick={releaseRetrievedOrder}
                  style={{
                    background: "#fef3c7",
                    border: "1px solid #fde68a",
                    borderRadius: 5,
                    color: "#b45309",
                    padding: "2px 6px",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ✕ Release
                </button>
              </div>
            )}

            {/* Optional Guest Name Input */}
            <div style={{ position: "relative", marginBottom: 8 }}>
              <User
                size={13}
                color="#64748b"
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Guest Name (optional)"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "#f8fafc",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "7px 10px 7px 30px",
                  fontSize: 12,
                  color: "#0f172a",
                  outline: "none",
                }}
              />
            </div>

            {/* Quick Table & Waiter Selectors directly inside Cart Sidebar */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 4 }}>
              <button
                type="button"
                onClick={() => setShowTablePicker(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 6,
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: selectedTable ? "1.5px solid #10b981" : "1.5px solid #e2e8f0",
                  background: selectedTable ? "#ecfdf5" : "#f8fafc",
                  color: selectedTable ? "#059669" : "#334155",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                title="Click to select table"
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <Table2 size={13} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selectedTable ? `Table: ${selectedTable}` : "🪑 Table #"}
                  </span>
                </div>
                <ChevronDown size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
              </button>

              <button
                type="button"
                onClick={() => setShowWaiterPicker(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 6,
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: selectedWaiter ? "1.5px solid #8b5cf6" : "1.5px solid #e2e8f0",
                  background: selectedWaiter ? "#f5f3ff" : "#f8fafc",
                  color: selectedWaiter ? "#7c3aed" : "#334155",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                title="Click to assign waiter"
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <User size={13} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selectedWaiter ? selectedWaiter.name : "👤 Waiter"}
                  </span>
                </div>
                <ChevronDown size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
              </button>
            </div>
          </div>

          {/* Cart Items List */}
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "10px 14px", background: "#f8fafc" }}>
            {items.length === 0 ? (
              <div
                style={{
                  height: "100%",
                  minHeight: 180,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  padding: "24px 16px",
                  color: "#64748b",
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: "#ffffff",
                    border: "1.5px dashed #cbd5e1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                  }}
                >
                  <ShoppingBag size={24} style={{ opacity: 0.6, color: "#94a3b8" }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Your cart is empty</p>
                <p style={{ fontSize: 11, color: "#64748b", marginTop: 4, maxWidth: 220, lineHeight: 1.4 }}>
                  Click items from the menu or click <strong style={{ color: "#2563eb" }}>Reference</strong> to recall a held order
                </p>
              </div>
            ) : (
              items.map((item, idx) => (
                <div
                  key={item.product + idx}
                  className="cart-item"
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: "11px 13px",
                    marginBottom: 8,
                    transition: "all 0.15s",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
                  }}
                >
                  {/* Top row: Name + Line Total */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontWeight: 700,
                          fontSize: 13,
                          color: "#0f172a",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          margin: 0,
                        }}
                      >
                        {item.productName}
                      </p>
                      <p style={{ fontSize: 11, color: "#64748b", marginTop: 2, margin: 0 }}>
                        {ETB(item.unitPrice)} / unit
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: "#0284c7" }}>
                        {ETB(item.totalPrice)}
                      </span>
                    </div>
                  </div>

                  {/* Note display or edit */}
                  {item.notes && editingNoteIdx !== idx && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "#b45309",
                        background: "#fffbeb",
                        border: "1px solid #fde68a",
                        padding: "3px 8px",
                        borderRadius: 6,
                        marginTop: 6,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span>💬 {item.notes}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteIdx(idx);
                          setNoteText(item.notes);
                        }}
                        style={{ background: "none", border: "none", color: "#b45309", cursor: "pointer", marginLeft: "auto", fontSize: 10, fontWeight: 700 }}
                      >
                        Edit
                      </button>
                    </div>
                  )}

                  {editingNoteIdx === idx && (
                    <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                      <input
                        type="text"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Add kitchen note (e.g. less spicy)..."
                        style={{
                          flex: 1,
                          background: "#ffffff",
                          border: "1.5px solid #f59e0b",
                          borderRadius: 6,
                          padding: "4px 8px",
                          fontSize: 11,
                          color: "#0f172a",
                          outline: "none",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => saveItemNote(idx)}
                        style={{
                          background: "#f59e0b",
                          border: "none",
                          borderRadius: 6,
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 11,
                          padding: "4px 10px",
                          cursor: "pointer",
                        }}
                      >
                        OK
                      </button>
                    </div>
                  )}

                  {/* Actions row: Note trigger + Stepper */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: 8,
                      paddingTop: 6,
                      borderTop: "1px solid #f1f5f9",
                    }}
                  >
                    {!item.notes && editingNoteIdx !== idx ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteIdx(idx);
                          setNoteText("");
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#64748b",
                          fontSize: 11,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                          padding: 0,
                          fontWeight: 600,
                        }}
                      >
                        <Plus size={11} /> Add note
                      </button>
                    ) : (
                      <div />
                    )}

                    {/* Stepper + Delete */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                      <button
                        type="button"
                        className="qbtn"
                        onClick={() => changeQty(idx, -1)}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          border: "1px solid #e2e8f0",
                          background: "#f1f5f9",
                          color: "#0f172a",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Minus size={11} />
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", minWidth: 20, textAlign: "center" }}>
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        className="qbtn"
                        onClick={() => changeQty(idx, 1)}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          border: "1px solid #e2e8f0",
                          background: "#f1f5f9",
                          color: "#0f172a",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Plus size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ef4444",
                          cursor: "pointer",
                          opacity: 0.8,
                          padding: "2px 4px",
                          marginLeft: 4,
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── CART FOOTER: TOTALS & SIDE-TO-SIDE BUTTONS [ Order ] & [ Checkout > ] ── */}
          <div
            style={{
              borderTop: "1px solid #e2e8f0",
              background: "#ffffff",
              padding: "14px 16px",
              flexShrink: 0,
              boxShadow: "0 -2px 10px rgba(0,0,0,0.02)",
            }}
          >
            {/* Discount selector */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                Discount:
              </span>
              <div style={{ display: "flex", gap: 5 }}>
                {[0, 5, 10, 15].map((d) => {
                  const active = discountPct === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDiscountPct(d)}
                      style={{
                        padding: "3px 10px",
                        borderRadius: 6,
                        border: active ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                        background: active ? "#2563eb" : "#f8fafc",
                        color: active ? "#ffffff" : "#64748b",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {d === 0 ? "None" : `${d}%`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Service Charge selector - matching discount mode exactly */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                Service Charge:
              </span>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {Array.from(new Set([0, ...(settings.serviceChargePresets || [5, 10, 15]), ...(serviceChargePct > 0 ? [serviceChargePct] : [])])).sort((a, b) => a - b).map((s) => {
                  const active = serviceChargePct === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setServiceChargePct(s);
                        if (s === 0) setServiceCharge(0);
                      }}
                      style={{
                        padding: "3px 10px",
                        borderRadius: 6,
                        border: active ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                        background: active ? "#2563eb" : "#f8fafc",
                        color: active ? "#ffffff" : "#64748b",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {s === 0 ? "None" : `${s}%`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Line calculations */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                <span>Subtotal</span>
                <span style={{ fontVariantNumeric: "tabular-nums", color: "#0f172a", fontWeight: 600 }}>{ETB(subtotal)}</span>
              </div>
              {discountAmt > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "#b45309" }}>
                  <span>Discount ({discountPct}%)</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>- {ETB(discountAmt)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                <span>VAT / Tax ({settings.taxRate}%)</span>
                <span style={{ fontVariantNumeric: "tabular-nums", color: "#0f172a", fontWeight: 600 }}>{ETB(taxAmt)}</span>
              </div>
              {serviceChargeAmt > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "#2563eb" }}>
                  <span>Service Charge {serviceChargePct > 0 ? `(${serviceChargePct}%)` : ""}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: "#0f172a", fontWeight: 600 }}>+ {ETB(serviceChargeAmt)}</span>
                </div>
              )}
            </div>

            {/* TOTAL PAYABLE — matching requested visual */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                paddingTop: 8,
                borderTop: "1.5px dashed #e2e8f0",
                marginBottom: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.5, color: "#059669", textTransform: "uppercase" }}>
                  TOTAL PAYABLE
                </div>
                <div style={{ fontSize: 10, color: "#64748b" }}>Tax &amp; Service Included</div>
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#0f172a",
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: -0.5,
                }}
              >
                {ETB(grandTotal)}
              </div>
            </div>

            {/* ── SIDE-TO-SIDE BUTTONS ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button
                type="button"
                className="order-btn"
                disabled={placing}
                onClick={handleOrder}
                title="Save order as held and print KOT for kitchen"
                style={{
                  padding: "13px 12px",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: placing ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  boxShadow: "0 4px 14px rgba(245,158,11,0.25)",
                  letterSpacing: 0.3,
                }}
              >
                <UtensilsCrossed size={16} />
                {heldOrderId ? "Update" : "🍽 Order"}
              </button>

              <button
                type="button"
                className="checkout-btn"
                disabled={placing}
                onClick={() => {
                  if (!items.length) { showToast("Please add items to cart", "error"); return; }
                  setShowPayModal(true);
                }}
                title="Pay now and automatically convert to Cash Sales"
                style={{
                  padding: "13px 12px",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  boxShadow: "0 6px 18px rgba(16,185,129,0.35)",
                  letterSpacing: 0.3,
                }}
              >
                <ReceiptText size={16} />
                Checkout ›
              </button>
            </div>

            {/* Reprint actions if lastOrder exists */}
            {lastOrder && (
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    posPrint.printReceipt(lastOrder, {
                      hotelName: "Baba Roti Café",
                      taxRate: settings.taxRate,
                    });
                    firePrinter('receipt', lastOrder, {
                      hotelName: "Baba Roti Café",
                      taxRate: settings.taxRate,
                      isReprint: true,
                    });
                  }}
                  style={{
                    flex: 1,
                    padding: "7px",
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: 8,
                    color: "#2563eb",
                    fontWeight: 700,
                    fontSize: 11,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  <Printer size={12} />
                  Receipt
                </button>
                <button
                  type="button"
                  onClick={() => {
                    posPrint.printKOT(lastOrder, { businessName: "Baba Roti Café" });
                    firePrinter('kot', lastOrder, { businessName: "Baba Roti Café", isReprint: true });
                  }}
                  style={{
                    flex: 1,
                    padding: "7px",
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    borderRadius: 8,
                    color: "#d97706",
                    fontWeight: 700,
                    fontSize: 11,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  <UtensilsCrossed size={12} />
                  KOT
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ══════════════════════════════════════════════════════════
            RIGHT PANEL: PRODUCT CATALOG (Search + Categories + Grid)
           ══════════════════════════════════════════════════════════ */}
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: "#f8fafc",
            height: "100%",
            maxHeight: "100%",
            minHeight: 0,
          }}
        >
          {/* Search bar */}
          <div style={{ padding: "12px 18px 6px", display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Search
                size={16}
                color="#64748b"
                style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                ref={searchRef}
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search products by name or code (e.g. Coffee, Burger, Roll)..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "#ffffff",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: 12,
                  padding: "10px 14px 10px 42px",
                  color: "#0f172a",
                  fontSize: 13,
                  outline: "none",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  fontWeight: 500,
                }}
              />
            </div>
            {searchQ && (
              <button
                type="button"
                onClick={() => setSearchQ("")}
                style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 8, padding: 6, color: "#64748b", cursor: "pointer" }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Categories Pill Strip */}
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "8px 18px",
              overflowX: "auto",
              borderBottom: "1px solid #e2e8f0",
              scrollbarWidth: "none",
              flexShrink: 0,
              background: "#ffffff",
            }}
          >
            {categories.map((cat) => {
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  className="cat-pill"
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 20,
                    border: active ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                    background: active
                      ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                      : "#f8fafc",
                    color: active ? "#ffffff" : "#475569",
                    fontWeight: active ? 800 : 600,
                    fontSize: 12,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    boxShadow: active ? "0 2px 10px rgba(37,99,235,0.25)" : "none",
                    letterSpacing: 0.3,
                  }}
                >
                  {cat === "All" ? "All Items" : cat}
                </button>
              );
            })}
          </div>

          {/* Product Cards Grid */}
          <div
            className="pos-product-grid"
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))",
              gridAutoRows: "minmax(154px, max-content)",
              gap: 14,
              padding: "16px 18px 24px",
              overflowY: "auto",
              alignContent: "start",
              minHeight: 0,
            }}
          >
            {filteredProducts.length === 0 ? (
              <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
                <UtensilsCrossed size={36} style={{ marginBottom: 10, opacity: 0.4 }} />
                <p style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>No products found</p>
                <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  Try a different search term or category
                </p>
              </div>
            ) : (
              filteredProducts.map((p) => {
                const inCart = items.find(
                  (item) => (item.product?._id || item.product) === p._id
                );
                const isSelected = !!inCart;

                // Dynamic Category Icon & Color Theme
                const rawCat = (p.category || "").toLowerCase();
                const getCatTheme = () => {
                  if (rawCat.includes("break")) return { bg: "#ecfdf5", border: "#a7f3d0", color: "#059669", emoji: "☀️" };
                  if (rawCat.includes("lunch") || rawCat.includes("dinner")) return { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8", emoji: "🍽️" };
                  if (rawCat.includes("drink") || rawCat.includes("bever") || rawCat.includes("juice") || rawCat.includes("cocktail")) return { bg: "#ecfeff", border: "#a5f3fc", color: "#0891b2", emoji: "🥤" };
                  if (rawCat.includes("coffee") || rawCat.includes("tea") || rawCat.includes("cafe")) return { bg: "#fef3c7", border: "#fde68a", color: "#b45309", emoji: "☕" };
                  if (rawCat.includes("dessert") || rawCat.includes("sweet") || rawCat.includes("cake") || rawCat.includes("pastr")) return { bg: "#fdf2f8", border: "#fbcfe8", color: "#db2777", emoji: "🍰" };
                  if (rawCat.includes("starter") || rawCat.includes("salad") || rawCat.includes("soup")) return { bg: "#f5f3ff", border: "#ddd6fe", color: "#7c3aed", emoji: "🥗" };
                  if (rawCat.includes("snack") || rawCat.includes("bun") || rawCat.includes("bakery")) return { bg: "#fefce8", border: "#fef08a", color: "#ca8a04", emoji: "🥐" };
                  if (rawCat.includes("burger") || rawCat.includes("sandwich")) return { bg: "#fff7ed", border: "#fed7aa", color: "#c2410c", emoji: "🍔" };
                  if (rawCat.includes("pizza") || rawCat.includes("pasta") || rawCat.includes("italian")) return { bg: "#fff1f2", border: "#fecdd3", color: "#e11d48", emoji: "🍕" };
                  return { bg: "#f8fafc", border: "#e2e8f0", color: "#475569", emoji: "🍴" };
                };
                const cc = getCatTheme();

                return (
                  <div
                    key={p._id}
                    className="product-card"
                    onClick={() => addItem(p)}
                    style={{
                      background: isSelected ? "#f0f7ff" : "#ffffff",
                      border: isSelected ? "2px solid #2563eb" : "1.5px solid #e2e8f0",
                      borderRadius: 18,
                      padding: "14px 14px 12px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      minHeight: 154,
                      boxSizing: "border-box",
                      flexShrink: 0,
                      position: "relative",
                      overflow: "hidden",
                      boxShadow: isSelected
                        ? "0 8px 24px rgba(37,99,235,0.18)"
                        : "0 2px 8px rgba(0,0,0,0.03)",
                    }}
                  >
                    {/* Top shimmer/accent line */}
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 3.5,
                      background: isSelected
                        ? "linear-gradient(90deg, #2563eb, #3b82f6)"
                        : "linear-gradient(90deg, #cbd5e1, transparent)",
                      borderRadius: "18px 18px 0 0",
                    }} />

                    {/* Product Photo & Category Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexShrink: 0 }}>
                      <div style={{
                        width: 46, height: 46, borderRadius: 12,
                        background: cc.bg,
                        border: `1.5px solid ${cc.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        overflow: "hidden",
                        flexShrink: 0,
                        position: "relative",
                        boxShadow: "0 2px 5px rgba(0,0,0,0.06)",
                      }}>
                        {p.imageUrl ? (
                          <img
                            src={normalizeFileUrl(p.imageUrl)}
                            alt={p.name}
                            loading="lazy"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              if (e.currentTarget.nextElementSibling) {
                                e.currentTarget.nextElementSibling.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div style={{
                          display: p.imageUrl ? 'none' : 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '100%',
                          height: '100%',
                          fontSize: 20,
                        }}>
                          {cc.emoji}
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
                        <span style={{
                          fontSize: 9.5, fontWeight: 800, textTransform: "uppercase",
                          color: cc.color, letterSpacing: 0.5,
                          background: cc.bg, border: `1px solid ${cc.border}`,
                          padding: "2px 7.5px", borderRadius: 20,
                          maxWidth: "105px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {p.category || "General"}
                        </span>
                        <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", fontWeight: 700 }}>
                          #{p.code || "—"}
                        </span>
                      </div>
                    </div>

                    {/* Product Name Area */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-start", marginBottom: 6, minHeight: 38, flexShrink: 0 }}>
                      <div
                        style={{
                          fontWeight: 800, fontSize: 13.5, color: "#0f172a",
                          lineHeight: 1.25, paddingRight: isSelected ? 24 : 0,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={p.name}
                      >
                        {p.name}
                      </div>
                    </div>

                    {/* Price + Recipe/Direct Tag Footer */}
                    <div style={{
                      display: "flex", alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: 8,
                      borderTop: "1px solid #f1f5f9",
                      marginTop: "auto",
                      flexShrink: 0,
                    }}>
                      <span style={{
                        fontWeight: 900, fontSize: 13.5, color: "#059669",
                        background: "#ecfdf5",
                        padding: "3.5px 10px", borderRadius: 20,
                        border: "1px solid #a7f3d0",
                        letterSpacing: -0.3,
                        boxShadow: "0 1px 2px rgba(5,150,105,0.06)",
                      }}>
                        {Number(p.sellingPrice || 0).toFixed(0)} ETB
                      </span>
                      {(p.ingredients?.length || 0) > 0 ? (
                        <span style={{
                          fontSize: 9.5, color: "#b45309", fontWeight: 800,
                          background: "#fffbeb", padding: "2.5px 7.5px",
                          borderRadius: 20, border: "1px solid #fde68a",
                        }}>⚡ Recipe</span>
                      ) : (
                        <span style={{
                          fontSize: 9.5, color: "#64748b", fontWeight: 700,
                          background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "2.5px 7.5px", borderRadius: 20,
                        }}>Direct</span>
                      )}
                    </div>

                    {/* Cart quantity badge */}
                    {isSelected && (
                      <span style={{
                        position: "absolute", top: 10, right: 10,
                        width: 24, height: 24, borderRadius: "50%",
                        background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                        color: "#fff", fontSize: 11, fontWeight: 900,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 3px 10px rgba(37,99,235,0.4)",
                        animation: "pulse-glow 2s infinite",
                      }}>
                        {inCart.quantity}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Floating Mobile Sticky Order / Cart Bar (only visible on mobile screens) */}
          <div
            className="pos-mobile-cart-bar"
            style={{
              position: "fixed",
              bottom: 64,
              left: 12,
              right: 12,
              background: "linear-gradient(135deg, #1e293b, #0f172a)",
              color: "#ffffff",
              padding: "10px 14px",
              borderRadius: 16,
              boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
              zIndex: 40,
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div
              onClick={() => setMobileCartOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1 }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  flexShrink: 0,
                }}
              >
                <ShoppingBag size={18} color="#fff" />
                {items.length > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      background: "#ef4444",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 900,
                      borderRadius: 10,
                      minWidth: 16,
                      height: 16,
                      padding: "0 4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {items.reduce((s, i) => s + (i.quantity || 1), 0)}
                  </span>
                )}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800 }}>
                  {items.length === 0 ? "Cart Empty" : `${items.length} Item${items.length > 1 ? "s" : ""} · ${ETB(grandTotal)}`}
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>
                  {selectedTable ? `Table: ${selectedTable}` : "No Table Selected"} {selectedWaiter ? `· Waiter: ${selectedWaiter.name}` : ""}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setMobileCartOpen(true)}
                style={{
                  background: "#334155",
                  border: "1px solid #475569",
                  color: "#f8fafc",
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                View Cart
              </button>
              {items.length > 0 && (
                <button
                  type="button"
                  disabled={placing}
                  onClick={handleOrder}
                  style={{
                    background: "linear-gradient(135deg, #f59e0b, #d97706)",
                    border: "none",
                    color: "#ffffff",
                    borderRadius: 10,
                    padding: "8px 14px",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: placing ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 4px 12px rgba(245,158,11,0.4)",
                  }}
                >
                  <UtensilsCrossed size={14} />
                  <span>Send</span>
                </button>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ══════════════════════════════════════════════════════════
          REFERENCE MODAL: SHOWS ALL ACTIVE ORDERS & RETRIEVES TO SIDEBAR
         ══════════════════════════════════════════════════════════ */}
      {showRefModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 600,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setShowRefModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 20,
              padding: 24,
              width: "100%",
              maxWidth: 700,
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 60px rgba(0,0,0,0.18)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FileText size={18} color="#2563eb" />
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", margin: 0 }}>
                    Active &amp; Held Table Orders (Reference)
                  </h3>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  Click any table order below to retrieve it into the sidebar cart for billing / checkout.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRefModal(false)}
                style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, color: "#64748b", cursor: "pointer", padding: 6 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Search filter in modal */}
            <div style={{ position: "relative", marginBottom: 14 }}>
              <Search size={14} color="#64748b" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input
                value={refSearchQ}
                onChange={(e) => setRefSearchQ(e.target.value)}
                placeholder="Search by Table #, Waiter, or Order #..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "9px 12px 9px 36px",
                  background: "#f8fafc",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: 10,
                  color: "#0f172a",
                  fontSize: 12,
                  outline: "none",
                }}
              />
            </div>

            {/* List of Held Orders */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredRefOrders.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  <UtensilsCrossed size={36} style={{ opacity: 0.4, marginBottom: 8 }} />
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>No active held orders found</p>
                </div>
              ) : (
                filteredRefOrders.map((o) => (
                  <div
                    key={o._id}
                    className="ref-card"
                    onClick={() => retrieveOrderToSidebar(o)}
                    style={{
                      background: "#ffffff",
                      border: "1.5px solid #e2e8f0",
                      borderRadius: 14,
                      padding: "12px 16px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 800, fontSize: 13, color: "#1e40af" }}>#{o.orderNo}</span>
                        <span
                          style={{
                            background: "#ecfdf5",
                            border: "1px solid #a7f3d0",
                            color: "#059669",
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          🪑 {o.tableNo || "Counter"}
                        </span>
                        {o.waiterName && (
                          <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 700, background: "#f5f3ff", padding: "2px 6px", borderRadius: 6 }}>
                            👤 {o.waiterName}
                          </span>
                        )}
                        <span
                          style={{
                            background: o.status === "held" ? "#f5f3ff" : "#fffbeb",
                            border: o.status === "held" ? "1px solid #ddd6fe" : "1px solid #fde68a",
                            color: o.status === "held" ? "#7c3aed" : "#b45309",
                            padding: "2px 7px",
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 800,
                            textTransform: "uppercase",
                          }}
                        >
                          {o.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {(o.items || []).map((it) => `${it.productName} (x${it.quantity})`).join(", ")}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 14 }}>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 16, color: "#059669" }}>
                          {ETB(o.grandTotal)}
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          retrieveOrderToSidebar(o);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "8px 14px",
                          borderRadius: 8,
                          border: "none",
                          background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
                        }}
                      >
                        <ArrowDownLeft size={13} />
                        Retrieve
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOMER QR ORDERS WAITING APPROVAL MODAL ───────────── */}
      {showApprovalModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 510,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setShowApprovalModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1.5px solid #fde68a",
              borderRadius: 22,
              padding: 24,
              width: "100%",
              maxWidth: 620,
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: "#fffbeb", border: "1.5px solid #fde68a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  ⏳
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 900, color: "#92400e", margin: 0 }}>
                    Customer QR Orders Awaiting Verification
                  </h3>
                  <p style={{ fontSize: 12, color: "#b45309", margin: "2px 0 0" }}>
                    Confirm customer presence at the table to prevent prank or remote orders.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, color: "#64748b", cursor: "pointer", padding: 6 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              {pendingApprovalOrders.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  <CheckCircle2 size={36} color="#10b981" style={{ marginBottom: 8 }} />
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>No pending QR orders</p>
                  <p style={{ fontSize: 12, color: "#94a3b8" }}>All customer orders have been verified and processed.</p>
                </div>
              ) : (
                pendingApprovalOrders.map((o) => (
                  <div
                    key={o._id}
                    style={{
                      background: "#fffbeb",
                      border: "1.5px solid #fde68a",
                      borderRadius: 14,
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", padding: "2px 8px", borderRadius: 6, fontFamily: "monospace" }}>
                          #{o.orderNo}
                        </span>
                        <h4 style={{ margin: "5px 0 2px", fontSize: 15, fontWeight: 900, color: "#0f172a" }}>
                          🪑 {o.tableNo || "Table"}
                        </h4>
                        <p style={{ margin: 0, fontSize: 11.5, color: "#64748b" }}>
                          👤 {o.customerName || "Walk-in Guest"} {o.customerPhone ? `(${o.customerPhone})` : ""}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: "#059669" }}>
                          {ETB(o.grandTotal)}
                        </span>
                        <span style={{ display: "block", fontSize: 11, color: "#94a3b8" }}>
                          {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12, color: "#334155", maxHeight: 90, overflowY: "auto" }}>
                      {(o.items || []).map((it, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                          <span>{it.productName}</span>
                          <strong style={{ color: "#b45309" }}>x{it.quantity} ({ETB(it.totalPrice)})</strong>
                        </div>
                      ))}
                      {o.tableNotes && (
                        <div style={{ fontSize: 11, color: "#d97706", fontStyle: "italic", marginTop: 4, paddingTop: 4, borderTop: "1px solid #f1f5f9" }}>
                          Note: {o.tableNotes}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => handleApprovePendingOrder(o._id)}
                        style={{
                          flex: 1,
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: "none",
                          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                          color: "#ffffff",
                          fontWeight: 800,
                          fontSize: 12.5,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          boxShadow: "0 2px 8px rgba(16,185,129,0.3)",
                        }}
                      >
                        <CheckCircle2 size={15} />
                        Verify & Send to Kitchen
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectPendingOrder(o._id)}
                        style={{
                          padding: "10px 16px",
                          borderRadius: 10,
                          border: "1px solid #fecdd3",
                          background: "#fff1f2",
                          color: "#e11d48",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PAYMENT MODAL ────────────────────────────────────────── */}
      {showPayModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 500,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setShowPayModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 20,
              padding: 26,
              width: "100%",
              maxWidth: 420,
              boxShadow: "0 25px 60px rgba(0,0,0,0.18)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div>
                <h3 style={{ fontWeight: 800, fontSize: 18, color: "#0f172a", margin: 0 }}>
                  Payment &amp; Settlement
                </h3>
                {heldOrderId && (
                  <span style={{ fontSize: 11, color: "#b45309", fontWeight: 700, background: "#fffbeb", padding: "2px 6px", borderRadius: 6, display: "inline-block", marginTop: 4 }}>
                    Converting #{heldOrderNo} to Cash Sales
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                style={{
                  background: "#f1f5f9",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  color: "#64748b",
                  cursor: "pointer",
                  padding: 6,
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Total display */}
            <div
              style={{
                background: "#ecfdf5",
                border: "1.5px solid #a7f3d0",
                borderRadius: 14,
                padding: "14px 16px",
                marginBottom: 18,
                textAlign: "center",
              }}
            >
              <p style={{ color: "#047857", fontSize: 11, marginBottom: 4, textTransform: "uppercase", fontWeight: 800 }}>
                Total Payable
              </p>
              <p style={{ fontWeight: 900, fontSize: 30, color: "#059669", margin: 0 }}>
                {ETB(grandTotal)}
              </p>
            </div>

            {/* Payment Methods */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 18 }}>
              {[
                ["Cash", Banknote, "#059669"],
                ["Telebirr", Smartphone, "#2563eb"],
                ["Card", CreditCard, "#d97706"],
              ].map(([m, Icon, clr]) => {
                const active = payMethod === m;
                return (
                  <button
                    key={m}
                    type="button"
                    style={{
                      padding: "10px 6px",
                      borderRadius: 12,
                      border: active ? `2px solid ${clr}` : "1.5px solid #e2e8f0",
                      background: active ? `${clr}15` : "#f8fafc",
                      color: active ? clr : "#64748b",
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 5,
                      transition: "all 0.15s ease",
                    }}
                    onClick={() => setPayMethod(m)}
                  >
                    <Icon size={18} />
                    {m}
                  </button>
                );
              })}
            </div>

            {/* Cash Tender Input */}
            {payMethod === "Cash" && (
              <div style={{ marginBottom: 18 }}>
                <p style={{ fontSize: 11, color: "#475569", marginBottom: 6, fontWeight: 700, textTransform: "uppercase" }}>
                  Cash Tendered (ETB)
                </p>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder={String(grandTotal)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 14px",
                    background: "#ffffff",
                    border: "1.5px solid #cbd5e1",
                    borderRadius: 10,
                    color: "#0f172a",
                    fontSize: 16,
                    fontWeight: 700,
                    outline: "none",
                  }}
                />
                {change > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 8,
                      padding: "8px 12px",
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 800,
                      color: "#1d4ed8",
                    }}
                  >
                    <span>Change Due:</span>
                    <span>{ETB(change)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Confirm button */}
            <button
              type="button"
              disabled={placing}
              onClick={placeOrder}
              style={{
                width: "100%",
                padding: 14,
                background: placing ? "#cbd5e1" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                border: "none",
                borderRadius: 14,
                color: "#fff",
                fontWeight: 800,
                fontSize: 15,
                cursor: placing ? "not-allowed" : "pointer",
                letterSpacing: 0.3,
                transition: "all 0.2s",
                boxShadow: "0 6px 20px rgba(16,185,129,0.35)",
              }}
            >
              {placing ? "Processing Sale & Deducting Stock..." : "Confirm & Complete Cash Sale"}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TABLE PICKER MODAL (Dedicated full overlay, zero click bleeding)
         ══════════════════════════════════════════════════════════ */}
      {showTablePicker && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 900,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowTablePicker(false)}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 20,
              padding: 24,
              width: "100%",
              maxWidth: 580,
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 60px rgba(0,0,0,0.18)",
              color: "#0f172a",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#059669",
                  }}
                >
                  <Table2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>Select Dining Table</h3>
                  <p style={{ margin: 0, fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    Click table to assign. If it has a held order, it will be recalled automatically.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTablePicker(false)}
                style={{
                  background: "#f1f5f9",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  color: "#64748b",
                  cursor: "pointer",
                  padding: 7,
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Section Filter Pills */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
              {["All", "Main Hall", "VIP Lounge", "Outdoor Patio"].map((sec) => {
                const active = tableSectionFilter === sec;
                return (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setTableSectionFilter(sec)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 16,
                      fontSize: 11,
                      fontWeight: 700,
                      border: active ? "1.5px solid #10b981" : "1px solid #e2e8f0",
                      background: active ? "#ecfdf5" : "#f8fafc",
                      color: active ? "#059669" : "#64748b",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {sec}
                  </button>
                );
              })}
            </div>

            {/* Tables Grid */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(95px, 1fr))",
                gap: 8,
                padding: "4px 2px",
                maxHeight: 340,
              }}
            >
              {ALL_TABLES.filter(
                (t) => tableSectionFilter === "All" || t.section === tableSectionFilter
              ).map((t) => {
                const busy = isTableBusy(t.id);
                const isSel = selectedTable === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedTable(t.id);
                      setShowTablePicker(false);
                      const tableOrder = heldOrdersList.find((o) => o.tableNo === t.id);
                      if (tableOrder) {
                        retrieveOrderToSidebar(tableOrder);
                      }
                    }}
                    style={{
                      padding: "12px 6px",
                      borderRadius: 10,
                      border: isSel
                        ? "2px solid #10b981"
                        : busy
                          ? "1.5px solid #fde68a"
                          : "1.5px solid #e2e8f0",
                      background: isSel
                        ? "#ecfdf5"
                        : busy
                          ? "#fffbeb"
                          : "#ffffff",
                      color: isSel ? "#059669" : busy ? "#d97706" : "#0f172a",
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: "pointer",
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      transition: "all 0.15s ease",
                      boxShadow: isSel ? "0 2px 10px rgba(16,185,129,0.2)" : "0 1px 3px rgba(0,0,0,0.02)",
                    }}
                  >
                    <Table2 size={16} />
                    <span>{t.id}</span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "1px 5px",
                        borderRadius: 4,
                        background: isSel
                          ? "#a7f3d0"
                          : busy
                            ? "#fde68a"
                            : "#f1f5f9",
                        color: isSel ? "#047857" : busy ? "#b45309" : "#64748b",
                      }}
                    >
                      {isSel ? "Selected" : busy ? "Held Order" : "Free"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Footer with Clear table */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 14,
                paddingTop: 12,
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedTable("");
                  setShowTablePicker(false);
                }}
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  padding: "6px 12px",
                  color: "#ef4444",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Clear Table (Counter)
              </button>

              <button
                type="button"
                onClick={() => setShowTablePicker(false)}
                style={{
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "6px 16px",
                  color: "#0f172a",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          WAITER PICKER MODAL (Dedicated full overlay, zero click bleeding)
         ══════════════════════════════════════════════════════════ */}
      {showWaiterPicker && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 900,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowWaiterPicker(false)}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 20,
              padding: 24,
              width: "100%",
              maxWidth: 440,
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 60px rgba(0,0,0,0.18)",
              color: "#0f172a",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "#f5f3ff",
                    border: "1px solid #ddd6fe",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#7c3aed",
                  }}
                >
                  <User size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>Assign Waiter / Server</h3>
                  <p style={{ margin: 0, fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    Select staff handling this table or order.
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => refreshWaiters(true)}
                  title="Refresh Waiters from Employee Directory"
                  style={{
                    background: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    color: "#64748b",
                    cursor: "pointer",
                    padding: 7,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <RefreshCw size={15} style={{ transform: refreshingWaiters ? "rotate(180deg)" : "none", transition: "transform 0.3s" }} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowWaiterPicker(false)}
                  style={{
                    background: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    color: "#64748b",
                    cursor: "pointer",
                    padding: 7,
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Waiter Search Box */}
            <div style={{ position: "relative", marginBottom: 12 }}>
              <Search
                size={14}
                color="#64748b"
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                value={waiterSearchQ}
                onChange={(e) => setWaiterSearchQ(e.target.value)}
                placeholder="Search staff name..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "9px 12px 9px 36px",
                  background: "#f8fafc",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "#0f172a",
                  outline: "none",
                }}
              />
            </div>

            {/* Waiter List */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, maxHeight: 300 }}>
              {/* Option: No Waiter */}
              <button
                type="button"
                onClick={() => {
                  setSelectedWaiter(null);
                  setShowWaiterPicker(false);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: !selectedWaiter ? "1.5px solid #8b5cf6" : "1px solid #e2e8f0",
                  background: !selectedWaiter ? "#f5f3ff" : "#f8fafc",
                  color: !selectedWaiter ? "#7c3aed" : "#64748b",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>— No Waiter (Counter / Self) —</span>
                {!selectedWaiter && <Check size={14} />}
              </button>

              {waiters.length === 0 && (
                <div style={{ textAlign: "center", padding: "20px 14px", color: "#64748b", fontSize: 12, background: "#f8fafc", borderRadius: 10, border: "1px dashed #cbd5e1", marginTop: 4 }}>
                  <p style={{ margin: "0 0 4px", fontWeight: 700, color: "#334155" }}>No Registered Waiters Found</p>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>
                    Only staff registered with <strong>Department: Waiter</strong> appear here. Register waiters in Employee Management.
                  </span>
                </div>
              )}

              {waiters
                .filter((w) => !waiterSearchQ || w.name.toLowerCase().includes(waiterSearchQ.toLowerCase()))
                .map((w) => {
                  const isSel = selectedWaiter?._id === w._id || selectedWaiter?.name === w.name;
                  return (
                    <button
                      key={w._id || w.name}
                      type="button"
                      onClick={() => {
                        setSelectedWaiter(w);
                        setShowWaiterPicker(false);
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: isSel ? "1.5px solid #8b5cf6" : "1px solid #e2e8f0",
                        background: isSel ? "#f5f3ff" : "#ffffff",
                        color: "#0f172a",
                        cursor: "pointer",
                        fontSize: 13,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #2563eb, #8b5cf6)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 800,
                          color: "#fff",
                          flexShrink: 0,
                        }}
                      >
                        {w.name?.[0]?.toUpperCase()}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: isSel ? "#7c3aed" : "#0f172a" }}>
                          {w.name}
                        </div>
                        <div style={{ fontSize: 10, color: "#64748b" }}>{w.role || "Staff"}</div>
                      </div>
                      {isSel && <Check size={16} color="#7c3aed" />}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
