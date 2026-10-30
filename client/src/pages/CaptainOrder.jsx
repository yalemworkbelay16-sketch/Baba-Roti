import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../api/axios";
import { posPrint } from "../utils/posPrint";
import { dispatchPrint } from "../utils/localPrintDispatcher";
import { exportToExcel, exportToCSV, exportToPDF } from "../utils/exportUtils";
import { triggerNewOrderAlert } from "../utils/audioAlert";
import {
  Search, Plus, Minus, Trash2, ChevronDown, X, Clock,
  UtensilsCrossed, ShoppingBag, Printer, User, TableProperties,
  RefreshCw, Send, AlertCircle, CheckCircle2, Eye, Edit3,
  ChevronRight, Coffee, Users, Hash, Layers, ReceiptText,
  Calendar, Filter, FileText, Ban, ArrowUpRight, DollarSign,
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

const STATUS_CONFIG = {
  all: { label: "All Orders", bg: "#f1f5f9", border: "#cbd5e1", color: "#475569" },
  held: { label: "Held", bg: "#f5f3ff", border: "#ddd6fe", color: "#7c3aed" },
  open: { label: "Open", bg: "#eff6ff", border: "#bfdbfe", color: "#2563eb" },
  sent_to_kitchen: { label: "In Kitchen", bg: "#fffbeb", border: "#fde68a", color: "#d97706" },
  ready: { label: "Ready", bg: "#f0fdf4", border: "#bbf7d0", color: "#16a34a" },
  billed: { label: "Billed", bg: "#eef2ff", border: "#c7d2fe", color: "#4f46e5" },
  paid: { label: "Paid", bg: "#ecfdf5", border: "#a7f3d0", color: "#059669" },
  voided: { label: "Voided", bg: "#fff1f2", border: "#fecdd3", color: "#e11d48" },
};

export default function CaptainOrder() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [dateVal, setDateVal] = useState(new Date().toISOString().slice(0, 10));
  const [refOrder, setRefOrder] = useState(null); // active order in Reference Details modal
  const [voidModalOrder, setVoidModalOrder] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);
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

  const knownOrderIdsRef = useRef(null);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/captain-orders?limit=300`;
      if (dateVal) url += `&date=${dateVal}`;
      if (statusFilter && statusFilter !== "all") url += `&status=${statusFilter}`;
      const res = await api.get(url);
      const data = res.data || [];
      setOrders(data);

      // Sound & Voice Alert on newly arriving orders
      if (knownOrderIdsRef.current !== null) {
        const newOrders = data.filter((o) => !knownOrderIdsRef.current.has(o._id));
        newOrders.forEach((o) => {
          triggerNewOrderAlert({
            orderId: o._id,
            orderNo: o.orderNo,
            tableNo: o.tableNo,
            itemsCount: o.items?.length,
            totalAmount: o.grandTotal,
          });
        });
      }

      knownOrderIdsRef.current = new Set(data.map((o) => o._id));
    } catch (e) {
      showToast("Failed to load captain orders", "error");
    } finally {
      setLoading(false);
    }
  }, [dateVal, statusFilter]);

  useEffect(() => {
    loadOrders();
    // Auto-poll every 10 seconds for incoming customer QR orders
    const interval = setInterval(loadOrders, 10000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  // Send to kitchen
  const handleSendToKitchen = async (orderId) => {
    try {
      const res = await api.post(`/captain-orders/${orderId}/send-to-kitchen`);
      dispatchPrint('kot', res.data.order, { businessName: "Baba Roti Café" });
      showToast("Order sent to Kitchen & KOT printed!");
      loadOrders();
      if (refOrder?._id === orderId) {
        setRefOrder(res.data.order);
      }
    } catch (e) {
      showToast(e.response?.data?.message || "Failed to send to kitchen", "error");
    }
  };

  // Void order
  const handleVoidOrder = async () => {
    if (!voidModalOrder) return;
    setVoiding(true);
    try {
      const res = await api.post(`/captain-orders/${voidModalOrder._id}/void`, {
        reason: voidReason.trim() || "Voided by Captain / Manager",
      });
      showToast(`Captain Order #${voidModalOrder.orderNo} voided.`, "info");
      setVoidModalOrder(null);
      setVoidReason("");
      if (refOrder?._id === voidModalOrder._id) {
        setRefOrder(res.data.order);
      }
      loadOrders();
    } catch (e) {
      showToast(e.response?.data?.message || "Failed to void order", "error");
    } finally {
      setVoiding(false);
    }
  };

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    const matchNo = (o.orderNo || "").toLowerCase().includes(q);
    const matchTable = (o.tableNo || "").toLowerCase().includes(q);
    const matchWaiter = (o.waiterName || "").toLowerCase().includes(q);
    const matchCustomer = (o.customerName || "").toLowerCase().includes(q);
    const matchItem = (o.items || []).some(
      (it) =>
        (it.productName || "").toLowerCase().includes(q) ||
        (it.productCode || "").toLowerCase().includes(q)
    );
    return matchNo || matchTable || matchWaiter || matchCustomer || matchItem;
  });

  // KPI Calculations
  const totalCount = orders.length;
  const heldCount = orders.filter((o) => o.status === "held").length;
  const kitchenCount = orders.filter((o) => o.status === "sent_to_kitchen").length;
  const readyCount = orders.filter((o) => o.status === "ready").length;
  const voidCount = orders.filter((o) => o.status === "voided").length;
  const totalValue = orders.reduce((s, o) => s + (o.grandTotal || 0), 0);

  // Export handlers
  const handleExportExcel = () => {
    if (!filteredOrders.length) { showToast("No orders to export", "info"); return; }
    const rows = filteredOrders.map((o) => ({
      "Order No": o.orderNo,
      "Date": new Date(o.createdAt).toLocaleDateString(),
      "Time": new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      "Table": o.tableNo || "Counter",
      "Waiter": o.waiterName || "—",
      "Customer": o.customerName || "Walk-in Guest",
      "Status": (o.status || "").toUpperCase(),
      "Items Count": (o.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0),
      "Items Detail": (o.items || []).map((it) => `${it.productName} (x${it.quantity})`).join("; "),
      "Subtotal (ETB)": Number(o.subtotal || 0).toFixed(2),
      "Discount (ETB)": Number(o.discountAmount || 0).toFixed(2),
      "Grand Total (ETB)": Number(o.grandTotal || 0).toFixed(2),
    }));
    exportToExcel(rows, `captain_orders_${dateVal || "report"}`, "Captain Orders");
    showToast("Exported to Excel successfully!");
  };

  const handleExportCSV = () => {
    if (!filteredOrders.length) { showToast("No orders to export", "info"); return; }
    const rows = filteredOrders.map((o) => ({
      "Order No": o.orderNo,
      "Date": new Date(o.createdAt).toLocaleDateString(),
      "Time": new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      "Table": o.tableNo || "Counter",
      "Waiter": o.waiterName || "—",
      "Customer": o.customerName || "Walk-in Guest",
      "Status": (o.status || "").toUpperCase(),
      "Items Count": (o.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0),
      "Items Detail": (o.items || []).map((it) => `${it.productName} (x${it.quantity})`).join("; "),
      "Subtotal (ETB)": Number(o.subtotal || 0).toFixed(2),
      "Discount (ETB)": Number(o.discountAmount || 0).toFixed(2),
      "Grand Total (ETB)": Number(o.grandTotal || 0).toFixed(2),
    }));
    exportToCSV(rows, `captain_orders_${dateVal || "report"}`);
    showToast("Exported to CSV successfully!");
  };

  const handleExportPDF = () => {
    if (!filteredOrders.length) { showToast("No orders to export", "info"); return; }
    const columns = [
      { header: "Order #", accessor: "orderNo" },
      { header: "Time", accessor: (r) => new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      { header: "Table", accessor: (r) => r.tableNo || "Counter" },
      { header: "Waiter", accessor: (r) => r.waiterName || "—" },
      { header: "Status", accessor: (r) => (r.status || "").toUpperCase() },
      { header: "Items", accessor: (r) => (r.items || []).map((it) => `${it.productName} x${it.quantity}`).join(", ") },
      { header: "Grand Total", accessor: (r) => ETB(r.grandTotal), align: "right" },
    ];
    exportToPDF({
      title: `Captain Orders Report (${dateVal || "All Dates"})`,
      columns,
      data: filteredOrders,
      hotelName: "Baba Roti Café",
      summary: [
        { label: "Total Orders", value: filteredOrders.length },
        { label: "Total Revenue", value: ETB(totalValue) },
      ],
    });
  };

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
        .order-row { transition: all 0.15s ease; }
        .order-row:hover { background: #f8fafc !important; transform: translateX(2px); }
        .kpi-card { animation: fadeInUp 0.3s ease both; transition: all 0.2s ease; }
        .kpi-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(0,0,0,0.08) !important; }
        .ref-btn:hover { background: #dbeafe !important; border-color: #3b82f6 !important; transform: scale(1.02); }
        .status-pill { transition: all 0.15s; }
        .status-pill:hover { transform: scale(1.04); }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      {/* ── HEADER & TOPBAR ────────────────────────────────────────── */}
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
              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 900,
              boxShadow: "0 6px 16px rgba(245,158,11,0.3)",
            }}
          >
            <UtensilsCrossed size={20} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                Captain Orders Status &amp; Tracking Report
              </h2>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "3px 10px",
                  borderRadius: 20,
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  color: "#d97706",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                ● Floor Dispatch
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Active table orders, KOT status, held tickets, and floor tracking
            </div>
          </div>
        </div>

        {/* Date & Refresh */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
            onClick={() => loadOrders()}
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
              transition: "all 0.15s",
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
              title="Export Captain Orders"
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
            color: "#d97706",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            padding: "5px 12px",
            borderRadius: 8,
            fontVariantNumeric: "tabular-nums",
          }}>
            {clock.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
        </div>
      </header>

      {/* ── PREMIUM KPI METRICS SUMMARY ROW ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 14,
          padding: "16px 20px 0",
        }}
      >
        {[
          {
            label: "Total Orders", count: totalCount, extra: ETB(totalValue),
            color: "#2563eb", glow: "rgba(37,99,235,0.12)",
            bg: "#ffffff",
            border: "#e2e8f0", icon: "📊",
            stripe: "linear-gradient(90deg, #3b82f6, #1d4ed8)",
          },
          {
            label: "Held Orders", count: heldCount,
            color: "#7c3aed", glow: "rgba(124,58,237,0.12)",
            bg: "#ffffff",
            border: "#e2e8f0", icon: "⏸️",
            stripe: "linear-gradient(90deg, #8b5cf6, #6d28d9)",
          },
          {
            label: "In Kitchen (KOT)", count: kitchenCount,
            color: "#d97706", glow: "rgba(217,119,6,0.12)",
            bg: "#ffffff",
            border: "#e2e8f0", icon: "🔥",
            stripe: "linear-gradient(90deg, #f59e0b, #b45309)",
          },
          {
            label: "Ready to Serve", count: readyCount,
            color: "#059669", glow: "rgba(5,150,105,0.12)",
            bg: "#ffffff",
            border: "#e2e8f0", icon: "✅",
            stripe: "linear-gradient(90deg, #10b981, #047857)",
          },
          {
            label: "Voided Orders", count: voidCount,
            color: "#e11d48", glow: "rgba(225,29,72,0.12)",
            bg: "#ffffff",
            border: "#e2e8f0", icon: "❌",
            stripe: "linear-gradient(90deg, #f43f5e, #be123c)",
          },
        ].map((k, i) => (
          <div
            key={i}
            className="kpi-card"
            style={{
              background: k.bg,
              border: `1.5px solid ${k.border}`,
              borderRadius: 18,
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              position: "relative",
              overflow: "hidden",
              boxShadow: `0 4px 18px ${k.glow}, 0 1px 3px rgba(0,0,0,0.03)`,
              animationDelay: `${i * 0.06}s`,
            }}
          >
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 3,
              background: k.stripe,
              borderRadius: "18px 18px 0 0",
            }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8 }}>
                {k.label}
              </span>
              <span style={{ fontSize: 20 }}>{k.icon}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.count}</span>
              {k.extra && <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", opacity: 0.85 }}>{k.extra}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── SEARCH & STATUS FILTER TABS ──────────────────────────── */}
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
            placeholder="Search by Product Code, Name, Table #, Waiter, or Order #..."
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

        {/* Status filter pills */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {Object.keys(STATUS_CONFIG).map((s) => {
            const active = statusFilter === s;
            const cfg = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                className="status-pill"
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: "7px 15px",
                  borderRadius: 50,
                  border: active ? "1.5px solid #2563eb" : "1.5px solid #e2e8f0",
                  background: active ? "linear-gradient(135deg, #2563eb, #1d4ed8)" : "#ffffff",
                  color: active ? "#ffffff" : "#475569",
                  fontWeight: active ? 800 : 600,
                  fontSize: 11.5,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: active ? "0 4px 12px rgba(37,99,235,0.25)" : "0 1px 2px rgba(0,0,0,0.02)",
                }}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── REPORT TABLE ─────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "70px 0" }}>
            <RefreshCw size={34} color="#f59e0b" style={{ animation: "spin 1s linear infinite" }} />
            <p style={{ marginTop: 12, color: "#64748b", fontSize: 13, fontWeight: 600 }}>Loading Orders Report...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
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
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <FileText size={30} color="#2563eb" />
            </div>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0 }}>
              No Captain Orders Found
            </p>
            <p style={{ fontSize: 13, color: "#64748b", marginTop: 6, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
              Orders created from POS Ordering or Captain Order will be tracked and displayed here.
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
                    <th style={{ padding: "13px 16px" }}>Ordered Products (Code &amp; Name)</th>
                    <th style={{ padding: "13px 16px" }}>Table</th>
                    <th style={{ padding: "13px 16px" }}>Waiter</th>
                    <th style={{ padding: "13px 16px" }}>Time</th>
                    <th style={{ padding: "13px 16px", textAlign: "right" }}>Total</th>
                    <th style={{ padding: "13px 16px", textAlign: "center" }}>Status</th>
                    <th style={{ padding: "13px 16px", textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => {
                    const sc = STATUS_CONFIG[o.status] || STATUS_CONFIG.open;
                    const itemsSummary = (o.items || []).map((it) => (
                      <span
                        key={it.product + it.productName}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          padding: "3px 9px",
                          borderRadius: 8,
                          marginRight: 6,
                          marginBottom: 4,
                          fontSize: 11.5,
                        }}
                      >
                        {it.productCode && (
                          <span style={{ color: "#2563eb", fontWeight: 700 }}>#{it.productCode}</span>
                        )}
                        <span style={{ color: "#0f172a", fontWeight: 600 }}>{it.productName}</span>
                        <span style={{ color: "#b45309", fontWeight: 800 }}>x{it.quantity}</span>
                      </span>
                    ));

                    return (
                      <tr
                        key={o._id}
                        className="order-row"
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          transition: "background 0.15s",
                        }}
                      >
                        {/* Reference Button */}
                        <td style={{ padding: "13px 16px", verticalAlign: "middle" }}>
                          <button
                            type="button"
                            className="ref-btn"
                            onClick={() => setRefOrder(o)}
                            title="Click to view all ordered products and order details"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "5px 12px",
                              borderRadius: 8,
                              background: "#eff6ff",
                              border: "1.5px solid #bfdbfe",
                              color: "#1d4ed8",
                              fontWeight: 800,
                              fontSize: 12,
                              cursor: "pointer",
                              transition: "all 0.15s",
                            }}
                          >
                            <FileText size={13} />
                            #{o.orderNo}
                          </button>
                        </td>

                        {/* Ordered Products (Code & Name) */}
                        <td style={{ padding: "13px 16px", verticalAlign: "middle", maxWidth: 360 }}>
                          <div style={{ display: "flex", flexWrap: "wrap" }}>{itemsSummary}</div>
                        </td>

                        {/* Table */}
                        <td style={{ padding: "13px 16px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              background: "#ecfdf5",
                              border: "1px solid #a7f3d0",
                              color: "#047857",
                              fontWeight: 700,
                              fontSize: 11.5,
                              padding: "4px 10px",
                              borderRadius: 6,
                            }}
                          >
                            🪑 {o.tableNo || "Counter"}
                          </span>
                        </td>

                        {/* Waiter */}
                        <td style={{ padding: "13px 16px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                          <span style={{ color: "#6d28d9", fontWeight: 700, background: "#f5f3ff", border: "1px solid #ddd6fe", padding: "3px 9px", borderRadius: 6 }}>
                            👤 {o.waiterName || "Staff"}
                          </span>
                        </td>

                        {/* Time */}
                        <td style={{ padding: "13px 16px", verticalAlign: "middle", whiteSpace: "nowrap", color: "#64748b", fontWeight: 500 }}>
                          {new Date(o.createdAt).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>

                        {/* Total */}
                        <td style={{ padding: "13px 16px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>
                          <span style={{ fontWeight: 900, color: "#059669", fontSize: 13.5 }}>
                            {ETB(o.grandTotal)}
                          </span>
                        </td>

                        {/* Status */}
                        <td style={{ padding: "13px 16px", verticalAlign: "middle", textAlign: "center", whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              background: sc.bg,
                              border: `1.5px solid ${sc.border}`,
                              color: sc.color,
                              padding: "4px 12px",
                              borderRadius: 20,
                              fontSize: 11,
                              fontWeight: 800,
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                            }}
                          >
                            {sc.label}
                          </span>
                        </td>

                        {/* Action buttons */}
                        <td style={{ padding: "13px 16px", verticalAlign: "middle", textAlign: "center", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                            {/* View Reference Button */}
                            <button
                              type="button"
                              onClick={() => setRefOrder(o)}
                              title="View Ordered Products & Details"
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

                            {/* Send to Kitchen if Held or Open */}
                            {["held", "open"].includes(o.status) && (
                              <button
                                type="button"
                                onClick={() => handleSendToKitchen(o._id)}
                                title="Send to Kitchen & Print KOT"
                                style={{
                                  padding: "6px 11px",
                                  borderRadius: 8,
                                  border: "none",
                                  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                                  color: "#ffffff",
                                  fontWeight: 800,
                                  fontSize: 11.5,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  boxShadow: "0 2px 6px rgba(217,119,6,0.3)",
                                }}
                              >
                                <Send size={11} />
                                KOT
                              </button>
                            )}

                            {/* Void button */}
                            {!["paid", "voided", "cancelled"].includes(o.status) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setVoidModalOrder(o);
                                  setVoidReason("");
                                }}
                                title="Void Order"
                                style={{
                                  padding: "6px 9px",
                                  borderRadius: 8,
                                  border: "1px solid #fecdd3",
                                  background: "#fff1f2",
                                  color: "#e11d48",
                                  fontWeight: 600,
                                  fontSize: 11.5,
                                  cursor: "pointer",
                                }}
                              >
                                <Ban size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          REFERENCE DETAILS MODAL: Displays All Ordered Products
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
                    Order Reference #{refOrder.orderNo}
                  </h3>
                  <span
                    style={{
                      background: STATUS_CONFIG[refOrder.status]?.bg || "#f1f5f9",
                      border: `1px solid ${STATUS_CONFIG[refOrder.status]?.border || "#cbd5e1"}`,
                      color: STATUS_CONFIG[refOrder.status]?.color || "#0f172a",
                      padding: "3px 10px",
                      borderRadius: 14,
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: "uppercase",
                    }}
                  >
                    {STATUS_CONFIG[refOrder.status]?.label || refOrder.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  Table: <strong style={{ color: "#047857" }}>{refOrder.tableNo || "Counter"}</strong> | Waiter:{" "}
                  <strong style={{ color: "#6d28d9" }}>{refOrder.waiterName || "Staff"}</strong> | Created:{" "}
                  {new Date(refOrder.createdAt).toLocaleTimeString()}
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

            {/* Products Table */}
            <div style={{ flex: 1, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 14, marginBottom: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #e2e8f0", color: "#475569", fontWeight: 700 }}>
                    <th style={{ padding: "10px 14px" }}>Product Code</th>
                    <th style={{ padding: "10px 14px" }}>Product Name</th>
                    <th style={{ padding: "10px 14px", textAlign: "center" }}>Qty</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Unit Price</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>Total</th>
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

            {/* Financial breakdown */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, color: "#64748b" }}>
                <span>Subtotal: <strong style={{ color: "#0f172a" }}>{ETB(refOrder.subtotal)}</strong></span>
                {refOrder.discountAmount > 0 && <span style={{ marginLeft: 12, color: "#d97706" }}>Discount: -{ETB(refOrder.discountAmount)}</span>}
                <span style={{ marginLeft: 12 }}>Tax: <strong style={{ color: "#0f172a" }}>{ETB(refOrder.taxAmount)}</strong></span>
                {refOrder.serviceCharge > 0 && <span style={{ marginLeft: 12, color: "#2563eb" }}>Service: <strong style={{ color: "#2563eb" }}>+{ETB(refOrder.serviceCharge)}</strong></span>}
              </div>
              <div style={{ fontSize: 19, fontWeight: 900, color: "#059669" }}>
                TOTAL: {ETB(refOrder.grandTotal)}
              </div>
            </div>

            {/* Modal action buttons */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              {/* Void option */}
              {!["paid", "voided", "cancelled"].includes(refOrder.status) && (
                <button
                  type="button"
                  onClick={() => {
                    setVoidModalOrder(refOrder);
                    setVoidReason("");
                  }}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 10,
                    border: "1.5px solid #fecdd3",
                    background: "#fff1f2",
                    color: "#e11d48",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Ban size={14} />
                  Void This Order
                </button>
              )}

              {/* Print KOT */}
              <button
                type="button"
                onClick={() => dispatchPrint('kot', refOrder, { businessName: "Baba Roti Café", isReprint: true })}
                style={{
                  padding: "9px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 2px 6px rgba(217,119,6,0.3)",
                }}
              >
                <Printer size={14} />
                Reprint KOT
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
          VOID ORDER REASON MODAL
         ══════════════════════════════════════════════════════════ */}
      {voidModalOrder && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 700,
            background: "rgba(15,23,42,0.6)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setVoidModalOrder(null)}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #fecdd3",
              borderRadius: 20,
              padding: 24,
              width: "100%",
              maxWidth: 440,
              boxShadow: "0 25px 70px rgba(15,23,42,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "#fff1f2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#e11d48",
                }}
              >
                <Ban size={18} />
              </div>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                Void Captain Order #{voidModalOrder.orderNo}
              </h4>
            </div>

            <p style={{ fontSize: 12.5, color: "#64748b", marginBottom: 12 }}>
              Are you sure you want to void this order? Please state a reason for restaurant audit logs.
            </p>

            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason for voiding (e.g. Guest cancelled, wrong table, mistake)..."
              rows={3}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#f8fafc",
                border: "1.5px solid #cbd5e1",
                borderRadius: 10,
                padding: "10px 12px",
                color: "#0f172a",
                fontSize: 12.5,
                outline: "none",
                resize: "none",
                marginBottom: 16,
              }}
            />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setVoidModalOrder(null)}
                style={{
                  padding: "9px 16px",
                  borderRadius: 10,
                  border: "1.5px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#64748b",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={voiding}
                onClick={handleVoidOrder}
                style={{
                  padding: "9px 18px",
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(135deg,#ef4444,#dc2626)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: voiding ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 6px rgba(239,68,68,0.3)",
                }}
              >
                {voiding ? "Voiding..." : "Confirm Void"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
