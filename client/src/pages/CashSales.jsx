import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../api/axios";
import { posPrint } from "../utils/posPrint";
import { dispatchPrint } from "../utils/localPrintDispatcher";
import { exportToExcel, exportToCSV, exportToPDF } from "../utils/exportUtils";
import {
  Search, X, Clock, Printer, CreditCard, Smartphone, Banknote,
  ReceiptText, RefreshCw, CheckCircle2, AlertCircle, Eye,
  ArrowRight, ShoppingBag, ChevronDown, Layers, Filter,
  BadgeDollarSign, UtensilsCrossed, Calendar, FileText, Ban,
  User, Table2, ArrowUpRight, DollarSign, RotateCcw,
  Download, FileSpreadsheet,
} from "lucide-react";

const ETB = (n) => `ETB ${Number(n || 0).toFixed(2)}`;

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

export default function CashSales() {
  const [activeTab, setActiveTab] = useState("report"); // "report" | "settle"
  const [paidOrders, setPaidOrders] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateVal, setDateVal] = useState(new Date().toISOString().slice(0, 10));
  const [searchQ, setSearchQ] = useState("");
  const [payMethodFilter, setPayMethodFilter] = useState("all");

  // Reference Modal State (Displays products & details)
  const [refOrder, setRefOrder] = useState(null);

  // Settlement Modal State (For settling pending captain orders)
  const [settleOrder, setSettleOrder] = useState(null);
  const [settleMethod, setSettleMethod] = useState("Cash");
  const [settleAmountPaid, setSettleAmountPaid] = useState("");
  const [settling, setSettling] = useState(false);

  const [toast, setToast] = useState(null);
  const [clock, setClock] = useState(new Date());
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef(null);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  useEffect(() => {
    const handleOutside = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showExportMenu]);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load Completed Sales (ONLY Sales Status: Paid / Completed - no void/held in sales figures)
  const loadPaidOrders = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/pos/orders?paymentStatus=paid&limit=300`;
      if (dateVal) url += `&date=${dateVal}`;
      const res = await api.get(url);
      setPaidOrders(res.data || []);
    } catch (e) {
      showToast("Failed to load cash sales", "error");
    } finally {
      setLoading(false);
    }
  }, [dateVal]);

  // Load Pending/Held Captain Orders for settlement
  const loadPendingOrders = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await api.get(`/captain-orders?date=${today}&limit=200`);
      const all = res.data || [];
      // Only include active orders that have not been paid, voided, or cancelled
      setPendingOrders(all.filter((o) => ["open", "held", "sent_to_kitchen", "ready", "billed"].includes(o.status)));
    } catch (_) { }
  }, []);

  useEffect(() => {
    loadPaidOrders();
    loadPendingOrders();

    // Auto-refresh pending table orders every 4.5s so new incoming table orders show up immediately
    const pollInterval = setInterval(() => {
      loadPendingOrders();
    }, 4500);
    return () => clearInterval(pollInterval);
  }, [loadPaidOrders, loadPendingOrders]);


  // Convert pending captain order -> paid cash sale (deducts stock!)
  const handleSettleOrder = async () => {
    if (!settleOrder) return;
    setSettling(true);
    try {
      const o = settleOrder;
      const payload = {
        orderType: o.orderType || "dine_in",
        tableNo: o.tableNo || "",
        customerName: o.customerName || "Walk-in Guest",
        waiter: o.waiter || null,
        waiterName: o.waiterName || "",
        captainOrderRef: o._id,
        items: (o.items || []).map((it) => ({
          product: it.product,
          productName: it.productName,
          productCode: it.productCode || "",
          category: it.category || "General",
          parentCategory: it.parentCategory || "FOOD",
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          notes: it.notes || "",
        })),
        discountPercent: o.discountPercent || 0,
        serviceCharge: o.serviceCharge || 0,
        paymentMethod: settleMethod,
        amountPaid: Number(settleAmountPaid) || o.grandTotal,
        paymentStatus: "paid",
      };

      const res = await api.post("/pos/orders", payload);
      const posOrder = res.data.order;

      // Mark captain order as billed / paid
      try {
        await api.patch(`/captain-orders/${o._id}`, { status: "billed" });
      } catch (_) { }

      // Print thermal receipt via network dispatcher + browser fallback
      dispatchPrint('receipt', posOrder, {
        hotelName: "Baba Roti Café",
        taxRate: 15,
      });

      showToast(`Sale #${posOrder.orderNo} completed & stock deducted!`);
      setSettleOrder(null);
      setSettleAmountPaid("");
      loadPendingOrders();
      loadPaidOrders();
      setActiveTab("report");
    } catch (e) {
      showToast(e.response?.data?.message || "Failed to settle sale", "error");
    } finally {
      setSettling(false);
    }
  };

  // Filtered sales records (only sales status, strictly paid)
  const filteredSales = paidOrders.filter((o) => {
    if (payMethodFilter !== "all" && o.paymentMethod !== payMethodFilter) return false;
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    const matchNo = (o.orderNo || "").toLowerCase().includes(q);
    const matchTable = (o.tableNo || "").toLowerCase().includes(q);
    const matchCashier = (o.cashierName || "").toLowerCase().includes(q);
    const matchWaiter = (o.waiterName || "").toLowerCase().includes(q);
    const matchCustomer = (o.customerName || "").toLowerCase().includes(q);
    const matchItem = (o.items || []).some(
      (it) =>
        (it.productName || "").toLowerCase().includes(q) ||
        (it.productCode || "").toLowerCase().includes(q)
    );
    return matchNo || matchTable || matchCashier || matchWaiter || matchCustomer || matchItem;
  });

  // KPI calculations (strictly sales status)
  const totalRevenue = filteredSales.reduce((s, o) => s + (o.grandTotal || 0), 0);
  const totalCash = filteredSales.filter((o) => o.paymentMethod === "Cash").reduce((s, o) => s + (o.grandTotal || 0), 0);
  const totalTelebirr = filteredSales.filter((o) => o.paymentMethod === "Telebirr").reduce((s, o) => s + (o.grandTotal || 0), 0);
  const totalCard = filteredSales.filter((o) => o.paymentMethod === "Card").reduce((s, o) => s + (o.grandTotal || 0), 0);
  const totalTxnCount = filteredSales.length;

  // Export handlers
  const handleExportExcel = () => {
    if (!filteredSales.length) { showToast("No sales to export", "info"); return; }
    const rows = filteredSales.map((s) => ({
      "Order No": s.orderNo,
      "Date": new Date(s.createdAt).toLocaleDateString(),
      "Time": new Date(s.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      "Payment Method": s.paymentMethod || "Cash",
      "Table": s.tableNo || "Counter",
      "Cashier": s.cashierName || "—",
      "Waiter": s.waiterName || "—",
      "Customer": s.customerName || "Walk-in Guest",
      "Items Count": (s.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0),
      "Items Detail": (s.items || []).map((it) => `${it.productName} (x${it.quantity})`).join("; "),
      "Subtotal (ETB)": Number(s.subtotal || 0).toFixed(2),
      "Tax 15% (ETB)": Number(s.taxAmount || 0).toFixed(2),
      "Discount (ETB)": Number(s.discountAmount || 0).toFixed(2),
      "Grand Total (ETB)": Number(s.grandTotal || 0).toFixed(2),
      "Amount Paid (ETB)": Number(s.amountPaid || s.grandTotal || 0).toFixed(2),
    }));
    exportToExcel(rows, `cash_sales_${dateVal || "report"}`, "Cash Sales");
    showToast("Exported to Excel successfully!");
  };

  const handleExportCSV = () => {
    if (!filteredSales.length) { showToast("No sales to export", "info"); return; }
    const rows = filteredSales.map((s) => ({
      "Order No": s.orderNo,
      "Date": new Date(s.createdAt).toLocaleDateString(),
      "Time": new Date(s.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      "Payment Method": s.paymentMethod || "Cash",
      "Table": s.tableNo || "Counter",
      "Cashier": s.cashierName || "—",
      "Waiter": s.waiterName || "—",
      "Customer": s.customerName || "Walk-in Guest",
      "Items Count": (s.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0),
      "Items Detail": (s.items || []).map((it) => `${it.productName} (x${it.quantity})`).join("; "),
      "Subtotal (ETB)": Number(s.subtotal || 0).toFixed(2),
      "Tax 15% (ETB)": Number(s.taxAmount || 0).toFixed(2),
      "Discount (ETB)": Number(s.discountAmount || 0).toFixed(2),
      "Grand Total (ETB)": Number(s.grandTotal || 0).toFixed(2),
      "Amount Paid (ETB)": Number(s.amountPaid || s.grandTotal || 0).toFixed(2),
    }));
    exportToCSV(rows, `cash_sales_${dateVal || "report"}`);
    showToast("Exported to CSV successfully!");
  };

  const handleExportPDF = () => {
    if (!filteredSales.length) { showToast("No sales to export", "info"); return; }
    const columns = [
      { header: "Order #", accessor: "orderNo" },
      { header: "Time", accessor: (r) => new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      { header: "Method", accessor: "paymentMethod" },
      { header: "Table", accessor: (r) => r.tableNo || "Counter" },
      { header: "Cashier", accessor: (r) => r.cashierName || "—" },
      { header: "Items", accessor: (r) => (r.items || []).map((it) => `${it.productName} x${it.quantity}`).join(", ") },
      { header: "Grand Total", accessor: (r) => ETB(r.grandTotal), align: "right" },
    ];
    exportToPDF({
      title: `Cash Sales & Revenue Report (${dateVal || "All Dates"})`,
      columns,
      data: filteredSales,
      hotelName: "Baba Roti Café",
      summary: [
        { label: "Total Paid Sales", value: filteredSales.length },
        { label: "Total Revenue", value: ETB(totalRevenue) },
        { label: "Cash Sales", value: ETB(totalCash) },
        { label: "Telebirr Sales", value: ETB(totalTelebirr) },
      ],
    });
  };

  const settleChange = settleOrder
    ? Math.max(0, (Number(settleAmountPaid) || 0) - (settleOrder.grandTotal || 0))
    : 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: "100vh",
        background: "transparent",
        color: "#0f172a",
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideInRight { from { transform: translateX(120%); opacity:0 } to { transform: translateX(0); opacity:1 } }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeInUp { from { transform: translateY(10px); opacity:0 } to { transform: translateY(0); opacity:1 } }
        @keyframes shimmer { 0% { background-position: -200% center } 100% { background-position: 200% center } }
        .sale-row { transition: all 0.15s ease; }
        .sale-row:hover { background: #f8fafc !important; transform: translateX(2px); }
        .kpi-card { animation: fadeInUp 0.3s ease both; transition: all 0.2s ease; }
        .kpi-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(0,0,0,0.08) !important; }
        .ref-btn:hover { background: #d1fae5 !important; border-color: #059669 !important; transform: scale(1.02); }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      {/* ── TOPBAR HEADER ────────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 22px",
          border: "1px solid #e2e8f0",
          borderRadius: 18,
          background: "#ffffff",
          boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
          margin: "12px 20px 0",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 900,
              boxShadow: "0 6px 16px rgba(16,185,129,0.3)",
            }}
          >
            <BadgeDollarSign size={22} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                Cash Sales &amp; Revenue Report
              </h2>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "3px 10px",
                  borderRadius: 20,
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  color: "#059669",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                ● Paid Sales Only
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Settled revenue records, tender breakdown, stock deduction history, and receipt audit
            </div>
          </div>
        </div>

        {/* Tab switchers + Date + Refresh */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Tabs */}
          <div
            style={{
              display: "flex",
              background: "#f1f5f9",
              padding: 4,
              borderRadius: 12,
              border: "1px solid #e2e8f0",
            }}
          >
            <button
              onClick={() => setActiveTab("report")}
              style={{
                padding: "7px 15px",
                borderRadius: 9,
                border: "none",
                background: activeTab === "report" ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "transparent",
                color: activeTab === "report" ? "#fff" : "#475569",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                boxShadow: activeTab === "report" ? "0 2px 6px rgba(16,185,129,0.25)" : "none",
              }}
            >
              Sales Report ({filteredSales.length})
            </button>
            <button
              onClick={() => setActiveTab("settle")}
              style={{
                padding: "7px 15px",
                borderRadius: 9,
                border: "none",
                background: activeTab === "settle" ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" : "transparent",
                color: activeTab === "settle" ? "#fff" : "#475569",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                boxShadow: activeTab === "settle" ? "0 2px 6px rgba(217,119,6,0.25)" : "none",
              }}
            >
              Settle Pending Orders ({pendingOrders.length})
            </button>
          </div>

          {/* Date Picker */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#f8fafc",
              border: "1.5px solid #e2e8f0",
              padding: "6px 12px",
              borderRadius: 10,
            }}
          >
            <Calendar size={14} color="#64748b" />
            <input
              type="date"
              value={dateVal}
              onChange={(e) => setDateVal(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                color: "#0f172a",
                fontSize: 12,
                fontWeight: 600,
                outline: "none",
                cursor: "pointer",
              }}
            />
          </div>

          <button
            onClick={() => {
              loadPaidOrders();
              loadPendingOrders();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 10,
              border: "1.5px solid #e2e8f0",
              background: "#f8fafc",
              color: "#475569",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={13} />
            Refresh
          </button>

          {/* Export Dropdown */}
          <div ref={exportRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowExportMenu(!showExportMenu)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 10,
                border: "1.5px solid #bfdbfe",
                background: "#eff6ff",
                color: "#1d4ed8",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                transition: "all 0.15s",
                boxShadow: "0 1px 3px rgba(37,99,235,0.08)",
              }}
              title="Export Cash Sales Report"
            >
              <Download size={13} />
              <span>Export</span>
              <ChevronDown size={12} style={{ transform: showExportMenu ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            </button>

            {showExportMenu && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 6px)",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                  padding: "6px",
                  zIndex: 100,
                  minWidth: 175,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false);
                    handleExportExcel();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "none",
                    background: "transparent",
                    color: "#0f172a",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <FileSpreadsheet size={15} color="#059669" />
                  <span>Export to Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false);
                    handleExportPDF();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "none",
                    background: "transparent",
                    color: "#0f172a",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <FileText size={15} color="#dc2626" />
                  <span>Export to PDF (.pdf)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false);
                    handleExportCSV();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "none",
                    background: "transparent",
                    color: "#0f172a",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Download size={15} color="#2563eb" />
                  <span>Export to CSV (.csv)</span>
                </button>
              </div>
            )}
          </div>

          <div style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#059669",
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            padding: "5px 12px",
            borderRadius: 8,
            fontVariantNumeric: "tabular-nums",
          }}>
            {clock.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
        </div>
      </header>

      {/* ── PREMIUM KPI METRICS CARDS ── */}
      {activeTab === "report" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
            padding: "16px 20px 0",
          }}
        >
          {[
            {
              label: "Total Cash Sales", value: ETB(totalRevenue),
              sub: `${totalTxnCount} completed sales`,
              color: "#059669", glow: "rgba(5,150,105,0.12)",
              bg: "#ffffff",
              border: "#e2e8f0", icon: "💰",
              stripe: "linear-gradient(90deg, #10b981, #047857)",
            },
            {
              label: "Cash Tendered", value: ETB(totalCash),
              sub: "Physical cash in drawer",
              color: "#0d9488", glow: "rgba(13,148,136,0.12)",
              bg: "#ffffff",
              border: "#e2e8f0", icon: "💵",
              stripe: "linear-gradient(90deg, #14b8a6, #0f766e)",
            },
            {
              label: "Telebirr Sales", value: ETB(totalTelebirr),
              sub: "Digital wallet settlement",
              color: "#2563eb", glow: "rgba(37,99,235,0.12)",
              bg: "#ffffff",
              border: "#e2e8f0", icon: "📱",
              stripe: "linear-gradient(90deg, #3b82f6, #1d4ed8)",
            },
            {
              label: "Card / POS Terminal", value: ETB(totalCard),
              sub: "Bank credit/debit card",
              color: "#d97706", glow: "rgba(217,119,6,0.12)",
              bg: "#ffffff",
              border: "#e2e8f0", icon: "💳",
              stripe: "linear-gradient(90deg, #f59e0b, #b45309)",
            },
          ].map((k, i) => (
            <div
              key={i}
              className="kpi-card"
              style={{
                background: k.bg,
                border: `1.5px solid ${k.border}`,
                borderRadius: 18,
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                position: "relative",
                overflow: "hidden",
                boxShadow: `0 4px 18px ${k.glow}, 0 1px 3px rgba(0,0,0,0.03)`,
                animationDelay: `${i * 0.07}s`,
              }}
            >
              {/* Top shimmer line */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 3,
                background: k.stripe,
                borderRadius: "18px 18px 0 0",
              }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8 }}>
                  {k.label}
                </span>
                <span style={{ fontSize: 22 }}>{k.icon}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: k.color, fontVariantNumeric: "tabular-nums", letterSpacing: -0.5 }}>
                {k.value}
              </div>
              <span style={{
                fontSize: 11.5, color: "#64748b",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: k.color, display: "inline-block" }} />
                {k.sub}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── FILTER & SEARCH TOOLBAR ── */}
      {activeTab === "report" && (
        <div style={{ padding: "14px 20px 0", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: 260, position: "relative" }}>
            <Search
              size={16}
              color="#94a3b8"
              style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search by Product Code, Name, Table #, Waiter, Cashier, or Reference #..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 14px 10px 40px",
                background: "#ffffff",
                border: "1.5px solid #cbd5e1",
                borderRadius: 12,
                color: "#0f172a",
                fontSize: 13,
                outline: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              }}
            />
            {searchQ && (
              <button
                onClick={() => setSearchQ("")}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Payment Method filter pills */}
          <div style={{ display: "flex", gap: 6 }}>
            {["all", "Cash", "Telebirr", "Card"].map((m) => {
              const active = payMethodFilter === m;
              return (
                <button
                  key={m}
                  onClick={() => setPayMethodFilter(m)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 50,
                    border: active ? "1.5px solid #059669" : "1.5px solid #e2e8f0",
                    background: active ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "#ffffff",
                    color: active ? "#ffffff" : "#475569",
                    fontWeight: active ? 800 : 600,
                    fontSize: 11.5,
                    cursor: "pointer",
                    boxShadow: active ? "0 2px 8px rgba(16,185,129,0.25)" : "none",
                  }}
                >
                  {m === "all" ? "All Methods" : m}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT VIEWPORT ─────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {/* ══════════════════════════════════════════════════════════
            TAB 1: COMPLETED CASH SALES REPORT (Excludes void & held)
           ══════════════════════════════════════════════════════════ */}
        {activeTab === "report" && (
          loading ? (
            <div style={{ textAlign: "center", padding: "70px 0" }}>
              <RefreshCw size={34} color="#10b981" style={{ animation: "spin 1s linear infinite" }} />
              <p style={{ marginTop: 12, color: "#64748b", fontSize: 13, fontWeight: 600 }}>Loading Sales Report...</p>
            </div>
          ) : filteredSales.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "64px 20px",
                background: "#ffffff",
                borderRadius: 20,
                border: "2px dashed #cbd5e1",
                boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <ReceiptText size={30} color="#059669" />
              </div>
              <p style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                No Completed Sales Found
              </p>
              <p style={{ fontSize: 13, color: "#64748b", marginTop: 6, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
                This report only includes paid/completed sales. Held or voided orders are excluded.
              </p>
            </div>
          ) : (
            <div
              style={{
                background: "#ffffff",
                border: "1.5px solid #e2e8f0",
                borderRadius: 18,
                overflow: "hidden",
                boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12.5 }}>
                  <thead>
                    <tr
                      style={{
                        background: "#f8fafc",
                        borderBottom: "2px solid #e2e8f0",
                        color: "#475569",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                        fontSize: 11,
                      }}
                    >
                      <th style={{ padding: "13px 16px" }}>Reference #</th>
                      <th style={{ padding: "13px 16px" }}>Products Sold (Code &amp; Name)</th>
                      <th style={{ padding: "13px 16px" }}>Table</th>
                      <th style={{ padding: "13px 16px" }}>Waiter</th>
                      <th style={{ padding: "13px 16px" }}>Cashier</th>
                      <th style={{ padding: "13px 16px" }}>Time</th>
                      <th style={{ padding: "13px 16px" }}>Method</th>
                      <th style={{ padding: "13px 16px", textAlign: "right" }}>Total</th>
                      <th style={{ padding: "13px 16px", textAlign: "center" }}>Sales Status</th>
                      <th style={{ padding: "13px 16px", textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((s) => {
                      const items = s.items || [];
                      const totalQty = items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
                      const itemsTooltip = items.map((it) => `• ${it.productCode ? `[#${it.productCode}] ` : ''}${it.productName} x${it.quantity}`).join('\n');

                      return (
                        <tr
                          key={s._id}
                          className="sale-row"
                          style={{
                            borderBottom: "1px solid #f1f5f9",
                            transition: "background 0.15s",
                          }}
                        >
                          {/* Reference Button */}
                          <td style={{ padding: "12px 16px", verticalAlign: "middle" }}>
                            <button
                              type="button"
                              className="ref-btn"
                              onClick={() => setRefOrder(s)}
                              title="Click code to view all products and order details"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "5px 12px",
                                borderRadius: 8,
                                background: "#ecfdf5",
                                border: "1.5px solid #a7f3d0",
                                color: "#047857",
                                fontWeight: 800,
                                fontSize: 12,
                                cursor: "pointer",
                                transition: "all 0.15s",
                              }}
                            >
                              <FileText size={13} />
                              #{s.orderNo}
                            </button>
                          </td>

                          {/* Products Sold - Clean Single-Line with Click to Expand */}
                          <td style={{ padding: "12px 16px", verticalAlign: "middle", maxWidth: 320 }}>
                            {items.length === 0 ? (
                              <span style={{ color: "#94a3b8", fontSize: 12, fontStyle: "italic" }}>No items</span>
                            ) : (
                              <div
                                onClick={() => setRefOrder(s)}
                                title={`Click to view breakdown:\n${itemsTooltip}`}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: 600,
                                    color: "#0f172a",
                                    fontSize: 12,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    maxWidth: 180,
                                  }}
                                >
                                  {items[0].productName}
                                  <span style={{ color: "#059669", fontWeight: 800, marginLeft: 4 }}>
                                    x{items[0].quantity}
                                  </span>
                                </span>
                                {items.length > 1 && (
                                  <span
                                    style={{
                                      background: "#eff6ff",
                                      border: "1px solid #bfdbfe",
                                      color: "#1d4ed8",
                                      fontWeight: 800,
                                      fontSize: 11,
                                      padding: "1.5px 7px",
                                      borderRadius: 12,
                                      whiteSpace: "nowrap",
                                      flexShrink: 0,
                                    }}
                                  >
                                    +{items.length - 1} more ({totalQty} items)
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Table */}
                          <td style={{ padding: "13px 16px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                background: "#eff6ff",
                                border: "1px solid #bfdbfe",
                                color: "#1d4ed8",
                                fontWeight: 700,
                                fontSize: 11.5,
                                padding: "4px 10px",
                                borderRadius: 6,
                              }}
                            >
                              🪑 {s.tableNo || "Counter"}
                            </span>
                          </td>

                          {/* Waiter */}
                          <td style={{ padding: "13px 16px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            <span style={{ color: "#6d28d9", fontWeight: 700, background: "#f5f3ff", border: "1px solid #ddd6fe", padding: "3px 9px", borderRadius: 6 }}>
                              👤 {s.waiterName || "—"}
                            </span>
                          </td>

                          {/* Cashier */}
                          <td style={{ padding: "13px 16px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            <span style={{ color: "#475569", fontWeight: 600 }}>
                              {s.cashierName || "Staff"}
                            </span>
                          </td>

                          {/* Time */}
                          <td style={{ padding: "13px 16px", verticalAlign: "middle", whiteSpace: "nowrap", color: "#64748b", fontWeight: 500 }}>
                            {new Date(s.createdAt).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </td>

                          {/* Payment Method */}
                          <td style={{ padding: "13px 16px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                background:
                                  s.paymentMethod === "Cash"
                                    ? "#ecfdf5"
                                    : s.paymentMethod === "Telebirr"
                                      ? "#eff6ff"
                                      : "#fffbeb",
                                border: `1px solid ${s.paymentMethod === "Cash"
                                    ? "#a7f3d0"
                                    : s.paymentMethod === "Telebirr"
                                      ? "#bfdbfe"
                                      : "#fde68a"
                                  }`,
                                color:
                                  s.paymentMethod === "Cash"
                                    ? "#047857"
                                    : s.paymentMethod === "Telebirr"
                                      ? "#1d4ed8"
                                      : "#b45309",
                                fontWeight: 800,
                                fontSize: 11,
                                padding: "3px 9px",
                                borderRadius: 6,
                              }}
                            >
                              {s.paymentMethod}
                            </span>
                          </td>

                          {/* Grand Total */}
                          <td style={{ padding: "13px 16px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>
                            <span style={{ fontWeight: 900, color: "#059669", fontSize: 13.5 }}>
                              {ETB(s.grandTotal)}
                            </span>
                          </td>

                          {/* Sales Status (Only Paid/Completed) */}
                          <td style={{ padding: "13px 16px", verticalAlign: "middle", textAlign: "center", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                background: "#ecfdf5",
                                border: "1.5px solid #a7f3d0",
                                color: "#047857",
                                padding: "4px 12px",
                                borderRadius: 20,
                                fontSize: 11,
                                fontWeight: 800,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              <CheckCircle2 size={12} />
                              Paid / Sold
                            </span>
                          </td>

                          {/* Action Buttons */}
                          <td style={{ padding: "13px 16px", verticalAlign: "middle", textAlign: "center", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                              <button
                                type="button"
                                onClick={() => setRefOrder(s)}
                                title="View Reference Details"
                                style={{
                                  padding: "6px 11px",
                                  borderRadius: 8,
                                  border: "1px solid #cbd5e1",
                                  background: "#ffffff",
                                  color: "#334155",
                                  fontWeight: 600,
                                  fontSize: 11.5,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                                }}
                              >
                                <Eye size={13} />
                                Ref
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  dispatchPrint('receipt', s, {
                                    hotelName: "Baba Roti Café",
                                    taxRate: s.taxPercent || 15,
                                    isReprint: true,
                                  })
                                }
                                title="Reprint Thermal Receipt"
                                style={{
                                  padding: "6px 9px",
                                  borderRadius: 8,
                                  border: "1px solid #bfdbfe",
                                  background: "#eff6ff",
                                  color: "#1d4ed8",
                                  fontWeight: 600,
                                  fontSize: 11.5,
                                  cursor: "pointer",
                                }}
                              >
                                <Printer size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 2: SETTLE PENDING CAPTAIN / HELD ORDERS
           ══════════════════════════════════════════════════════════ */}
        {activeTab === "settle" && (
          pendingOrders.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "64px 20px",
                background: "#ffffff",
                borderRadius: 20,
                border: "2px dashed #cbd5e1",
                boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <CheckCircle2 size={30} color="#059669" />
              </div>
              <p style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0 }}>All Orders Settled</p>
              <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
                No active held or open dining table orders awaiting payment.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 14,
              }}
            >
              {pendingOrders.map((o) => (
                <div
                  key={o._id}
                  style={{
                    background: "#ffffff",
                    border: "1.5px solid #e2e8f0",
                    borderRadius: 18,
                    padding: 18,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    boxShadow: "0 4px 18px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: "#2563eb" }}>#{o.orderNo}</span>
                    <span
                      style={{
                        background: o.status === "held" ? "#f5f3ff" : "#fffbeb",
                        border: `1px solid ${o.status === "held" ? "#ddd6fe" : "#fde68a"}`,
                        color: o.status === "held" ? "#7c3aed" : "#d97706",
                        padding: "3px 9px",
                        borderRadius: 6,
                        fontSize: 10.5,
                        fontWeight: 800,
                        textTransform: "uppercase",
                      }}
                    >
                      {o.status}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#64748b", fontWeight: 500 }}>
                    <span>🪑 {o.tableNo || "Counter"}</span>
                    <span>👤 {o.waiterName || "Staff"}</span>
                    <span>👥 {o.guestCount || 1} Guests</span>
                  </div>

                  {/* Items list */}
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      padding: "10px 12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 5,
                      maxHeight: 120,
                      overflowY: "auto",
                      fontSize: 11.5,
                    }}
                  >
                    {(o.items || []).map((it, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#0f172a" }}>
                          {it.productCode && <span style={{ color: "#2563eb", marginRight: 5, fontWeight: 700 }}>#{it.productCode}</span>}
                          {it.productName} <strong style={{ color: "#b45309" }}>x{it.quantity}</strong>
                        </span>
                        <span style={{ color: "#64748b", fontWeight: 600 }}>{ETB(it.totalPrice)}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", paddingTop: 4 }}>
                    <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>Payable Amount:</span>
                    <span style={{ fontSize: 19, fontWeight: 900, color: "#059669" }}>{ETB(o.grandTotal)}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSettleOrder(o);
                      setSettleMethod("Cash");
                      setSettleAmountPaid(String(o.grandTotal));
                    }}
                    style={{
                      width: "100%",
                      padding: 12,
                      borderRadius: 12,
                      border: "none",
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      boxShadow: "0 4px 14px rgba(16,185,129,0.3)",
                    }}
                  >
                    <BadgeDollarSign size={16} />
                    Settle &amp; Convert to Cash Sale
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          REFERENCE SALE DETAILS MODAL: Displays Products & Financial Details
         ══════════════════════════════════════════════════════════ */}
      {refOrder && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 600,
            background: "rgba(15,23,42,0.55)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setRefOrder(null)}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 22,
              padding: 26,
              width: "100%",
              maxWidth: 640,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 60px rgba(15,23,42,0.18)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", margin: 0 }}>
                    Sale Reference #{refOrder.orderNo}
                  </h3>
                  <span
                    style={{
                      background: "#ecfdf5",
                      border: "1px solid #a7f3d0",
                      color: "#059669",
                      padding: "3px 10px",
                      borderRadius: 14,
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    ✓ Paid / Completed
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  Table: <strong style={{ color: "#2563eb" }}>{refOrder.tableNo || "Counter"}</strong> | Waiter:{" "}
                  <strong style={{ color: "#7c3aed" }}>{refOrder.waiterName || "—"}</strong> | Cashier:{" "}
                  <strong style={{ color: "#0f172a" }}>{refOrder.cashierName}</strong> | Method:{" "}
                  <strong style={{ color: "#d97706" }}>{refOrder.paymentMethod}</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setRefOrder(null)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: 10,
                  color: "#64748b",
                  cursor: "pointer",
                  padding: 8,
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Ordered Products Table */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                marginBottom: 16,
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #e2e8f0", color: "#475569", fontWeight: 700 }}>
                    <th style={{ padding: "10px 14px" }}>Product Code</th>
                    <th style={{ padding: "10px 14px" }}>Product Name</th>
                    <th style={{ padding: "10px 14px", textAlign: "center" }}>Qty</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Unit Price</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(refOrder.items || []).map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", color: "#2563eb", fontWeight: 700 }}>
                        #{it.productCode || "—"}
                      </td>
                      <td style={{ padding: "10px 14px", color: "#0f172a", fontWeight: 600 }}>
                        {it.productName}
                        {it.notes && (
                          <div style={{ fontSize: 11, color: "#d97706", fontStyle: "italic", marginTop: 2 }}>
                            ↳ {it.notes}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, color: "#0f172a" }}>
                        {it.quantity}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "#64748b" }}>
                        {ETB(it.unitPrice)}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "#059669" }}>
                        {ETB(it.totalPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Details */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 12.5, color: "#64748b" }}>
                <span>Subtotal: <strong style={{ color: "#0f172a" }}>{ETB(refOrder.subtotal)}</strong></span>
                {refOrder.discountAmount > 0 && (
                  <span style={{ marginLeft: 12, color: "#d97706" }}>Discount: -{ETB(refOrder.discountAmount)}</span>
                )}
                <span style={{ marginLeft: 12 }}>Tax: <strong style={{ color: "#0f172a" }}>{ETB(refOrder.taxAmount)}</strong></span>
                {refOrder.serviceCharge > 0 && (
                  <span style={{ marginLeft: 12, color: "#2563eb" }}>Service: <strong style={{ color: "#2563eb" }}>+{ETB(refOrder.serviceCharge)}</strong></span>
                )}
                {refOrder.amountPaid > 0 && (
                  <span style={{ marginLeft: 12, color: "#2563eb" }}>Tendered: <strong style={{ color: "#0f172a" }}>{ETB(refOrder.amountPaid)}</strong></span>
                )}
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#059669" }}>
                TOTAL: {ETB(refOrder.grandTotal)}
              </div>
            </div>

            {/* Action Buttons: REPRINT RECEIPT & CLOSE */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() =>
                  dispatchPrint('receipt', refOrder, {
                    hotelName: "Baba Roti Café",
                    taxRate: refOrder.taxPercent || 15,
                    isReprint: true,
                  })
                }
                style={{
                  padding: "9px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 2px 6px rgba(16,185,129,0.3)",
                }}
              >
                <Printer size={14} />
                Reprint Receipt
              </button>

              <button
                type="button"
                onClick={() => setRefOrder(null)}
                style={{
                  padding: "9px 18px",
                  borderRadius: 10,
                  border: "1.5px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          SETTLEMENT MODAL (Settle pending captain order into sale)
         ══════════════════════════════════════════════════════════ */}
      {settleOrder && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 600,
            background: "rgba(15,23,42,0.55)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setSettleOrder(null)}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 22,
              padding: 26,
              width: "100%",
              maxWidth: 440,
              boxShadow: "0 25px 60px rgba(15,23,42,0.18)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", margin: 0 }}>
                  Settle Order #{settleOrder.orderNo}
                </h3>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  Table: <strong style={{ color: "#2563eb" }}>{settleOrder.tableNo || "Counter"}</strong> | Waiter: <strong style={{ color: "#7c3aed" }}>{settleOrder.waiterName || "Staff"}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettleOrder(null)}
                style={{ background: "#f1f5f9", border: "none", borderRadius: 8, color: "#64748b", cursor: "pointer", padding: 6 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Total */}
            <div
              style={{
                background: "#ecfdf5",
                border: "1.5px solid #a7f3d0",
                borderRadius: 16,
                padding: "14px 18px",
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              <p style={{ color: "#047857", fontSize: 11, marginBottom: 4, textTransform: "uppercase", fontWeight: 800, letterSpacing: 0.5 }}>
                Total Payable
              </p>
              <p style={{ fontWeight: 900, fontSize: 28, color: "#059669", margin: 0 }}>
                {ETB(settleOrder.grandTotal)}
              </p>
            </div>

            {/* Methods */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
              {[
                ["Cash", Banknote, "#059669"],
                ["Telebirr", Smartphone, "#2563eb"],
                ["Card", CreditCard, "#d97706"],
              ].map(([m, Icon, clr]) => (
                <button
                  key={m}
                  type="button"
                  style={{
                    padding: "12px 6px",
                    borderRadius: 12,
                    border: settleMethod === m ? `2px solid ${clr}` : "1.5px solid #e2e8f0",
                    background:
                      settleMethod === m
                        ? `${clr}14`
                        : "#ffffff",
                    color: settleMethod === m ? clr : "#64748b",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: settleMethod === m ? `0 2px 8px ${clr}25` : "none",
                  }}
                  onClick={() => setSettleMethod(m)}
                >
                  <Icon size={19} />
                  {m}
                </button>
              ))}
            </div>

            {/* Cash Tender */}
            {settleMethod === "Cash" && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, color: "#475569", marginBottom: 6, fontWeight: 700, textTransform: "uppercase" }}>
                  Cash Tendered (ETB)
                </p>
                <input
                  type="number"
                  value={settleAmountPaid}
                  onChange={(e) => setSettleAmountPaid(e.target.value)}
                  placeholder={String(settleOrder.grandTotal)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 14px",
                    background: "#f8fafc",
                    border: "1.5px solid #cbd5e1",
                    borderRadius: 10,
                    color: "#0f172a",
                    fontSize: 16,
                    fontWeight: 700,
                    outline: "none",
                  }}
                />
                {settleChange > 0 && (
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
                      fontWeight: 700,
                      color: "#1d4ed8",
                    }}
                  >
                    <span>Change Due:</span>
                    <span>{ETB(settleChange)}</span>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              disabled={settling}
              onClick={handleSettleOrder}
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 14,
                border: "none",
                background: settling ? "#94a3b8" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 15,
                cursor: settling ? "not-allowed" : "pointer",
                boxShadow: "0 6px 20px rgba(16,185,129,0.35)",
              }}
            >
              {settling ? "Deducting Stock & Completing Sale..." : "Confirm & Print Receipt"}
            </button>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
