"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  getDashboard,
  getTransactions,
  getCategories,
  isAuthenticated,
} from "../lib/api";
import Navbar from "../components/Navbar";
import { DatePicker } from "../components/DatePicker";
import { format } from "date-fns";
import TransactionModal from "../components/TransactionModal";
import { useToast } from "../components/Toast";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const CHART_COLORS = [
  "#38bdf8", "#818cf8", "#fb923c", "#34d399", "#f472b6",
  "#ef4444", "#22d3ee", "#a78bfa", "#84cc16", "#fbbf24",
];

function formatMoney(num) {
  return Number(num).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Export Utilities ───
function exportToCSV(transactions) {
  const headers = ["ชื่อรายการ", "ประเภท", "หมวดหมู่", "จำนวนเงิน", "วันที่", "หมายเหตุ"];
  const rows = transactions.map((tx) => [
    tx.title,
    tx.type === "INCOME" ? "รายรับ" : "รายจ่าย",
    tx.category?.name || "ไม่ระบุ",
    tx.amount,
    new Date(tx.date).toLocaleDateString("th-TH"),
    tx.note || "",
  ]);
  const BOM = "\uFEFF";
  const csvContent =
    BOM +
    [headers.join(","), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `รายการล่าสุด_${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToExcel(transactions) {
  const rows = transactions.map(
    (tx) => `<tr><td>${tx.title}</td><td>${tx.type === "INCOME" ? "รายรับ" : "รายจ่าย"}</td><td>${tx.category?.name || "ไม่ระบุ"}</td><td>${tx.amount}</td><td>${new Date(tx.date).toLocaleDateString("th-TH")}</td><td>${tx.note || ""}</td></tr>`,
  );
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr><th>ชื่อรายการ</th><th>ประเภท</th><th>หมวดหมู่</th><th>จำนวนเงิน</th><th>วันที่</th><th>หมายเหตุ</th></tr></thead><tbody>${rows.join("")}</tbody></table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `รายการล่าสุด_${format(new Date(), "yyyy-MM-dd")}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

const EMPTY_FORM = {
  title: "",
  amount: "",
  type: "EXPENSE",
  categoryName: "",
  date: "",
  note: "",
};

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();

  // Data State
  const [summary, setSummary] = useState(null);
  const [pieData, setPieData] = useState([]);
  const [recentTx, setRecentTx] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter & Modal State
  const [startDate, setStartDate] = useState(undefined);
  const [endDate, setEndDate] = useState(undefined);
  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [chartType, setChartType] = useState("EXPENSE");

  // Export Menu
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    const fetchCats = async () => {
      try {
        const res = await getCategories();
        setCategories(res.data || []);
      } catch (err) {
        console.error("Failed to load categories", err);
      }
    };
    fetchCats();
    fetchData();
  }, []);

  useEffect(() => {
    fetchData();
  }, [chartType, selectedCategory]);

  // Close export menu on outside click
  useEffect(() => {
    const handleClick = () => setShowExportMenu(false);
    if (showExportMenu) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [showExportMenu]);

  const openCreate = () => {
    setEditingTx(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const commonFilter = {
        startDate: startDate ? format(startDate, "yyyy-MM-dd") : "",
        endDate: endDate ? format(endDate, "yyyy-MM-dd") : "",
        categoryId: selectedCategory,
      };
      const dashFilters = { ...commonFilter, type: chartType };
      const txFilters = { ...commonFilter };

      const [dashRes, txRes] = await Promise.all([
        getDashboard(dashFilters),
        getTransactions(txFilters),
      ]);

      setSummary(dashRes.data.summary);
      setPieData(dashRes.data.pieChartData || []);
      setRecentTx((txRes.data || []).slice(0, 5));
    } catch (err) {
      console.error(err);
      toast.error("โหลดข้อมูล Dashboard ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    fetchData();
  };

  const handleClearFilter = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedCategory("ALL");
    setTimeout(() => {
      getDashboard({ type: chartType }).then((res) => {
        setSummary(res.data.summary);
        setPieData(res.data.pieChartData || []);
      });
      getTransactions({}).then((res) => {
        setRecentTx((res.data || []).slice(0, 5));
      });
    }, 0);
  };

  const totalPie = useMemo(() => {
    return pieData.reduce((sum, d) => sum + Number(d.total || d.value || 0), 0);
  }, [pieData]);

  // ─── Export Handlers ───
  const handleExportCSV = () => {
    if (recentTx.length === 0) { toast.warning("ไม่มีข้อมูลให้ส่งออก"); return; }
    exportToCSV(recentTx);
    toast.success("ส่งออก CSV สำเร็จ! 📥");
  };

  const handleExportExcel = () => {
    if (recentTx.length === 0) { toast.warning("ไม่มีข้อมูลให้ส่งออก"); return; }
    exportToExcel(recentTx);
    toast.success("ส่งออก Excel สำเร็จ! 📥");
  };

  if (loading && !summary) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#e8f4fd] via-[#f0f7ff] to-white">
        <Navbar />
        <div className="pt-24 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <svg className="animate-spin h-10 w-10 text-sky-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-slate-500">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e8f4fd] via-[#f0f7ff] to-white">
      <Navbar />
      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 animate-fade-in gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
              Dashboard
            </h1>
            <p className="text-slate-500 mt-1">ภาพรวมค่าใช้จ่ายของคุณ</p>
          </div>

          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 text-white font-medium hover:from-sky-400 hover:to-blue-400 transition-all shadow-lg shadow-sky-500/20 whitespace-nowrap"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            เพิ่มรายการ
          </button>
        </div>

        {/* Filters Section */}
        <div className="bg-white/70 backdrop-blur-xl border border-sky-200/50 rounded-2xl p-4 mb-8 animate-fade-in flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">วันเริ่มต้น</label>
            <DatePicker date={startDate} setDate={setStartDate} label="วว/ดด/ปปปป" />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">วันสิ้นสุด</label>
            <DatePicker date={endDate} setDate={setEndDate} label="วว/ดด/ปปปป" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">หมวดหมู่</label>
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full appearance-none bg-white border border-slate-200 text-slate-700 py-2 px-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
              >
                <option value="ALL">ทั้งหมด</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.type === "INCOME" ? "รายรับ" : "รายจ่าย"})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
          </div>
          <button onClick={handleFilter} className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 text-white text-sm font-medium hover:from-sky-400 hover:to-blue-400 transition-all shadow-lg shadow-sky-500/20">
            กรอง
          </button>
          <button onClick={handleClearFilter} className="px-5 py-2 rounded-xl bg-white/80 border border-sky-200/50 text-slate-500 text-sm font-medium hover:text-slate-700 hover:bg-white transition-all">
            ล้าง
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Income Card */}
          <div className="group bg-white/70 backdrop-blur-xl border border-sky-200/50 rounded-2xl p-6 hover:bg-white/90 hover:shadow-lg hover:shadow-sky-100/50 transition-all duration-300 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-500 text-sm font-medium">รายรับ</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-emerald-500">+฿{formatMoney(summary?.totalIncome || 0)}</p>
          </div>

          {/* Expense Card */}
          <div className="group bg-white/70 backdrop-blur-xl border border-sky-200/50 rounded-2xl p-6 hover:bg-white/90 hover:shadow-lg hover:shadow-sky-100/50 transition-all duration-300 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-500 text-sm font-medium">รายจ่าย</span>
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-red-500">-฿{formatMoney(summary?.totalExpense || 0)}</p>
          </div>

          {/* Balance Card */}
          <div className="group bg-white/70 backdrop-blur-xl border border-sky-200/50 rounded-2xl p-6 hover:bg-white/90 hover:shadow-lg hover:shadow-sky-100/50 transition-all duration-300 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-500 text-sm font-medium">ยอดคงเหลือ</span>
              <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
            </div>
            <p className={`text-2xl font-bold ${(summary?.balance || 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              ฿{formatMoney(summary?.balance || 0)}
            </p>
          </div>
        </div>

        {/* Bottom Section: Pie Chart + Recent */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <div className="bg-white/70 backdrop-blur-xl border border-sky-200/50 rounded-2xl p-6 animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-800">
                สัดส่วน{chartType === "EXPENSE" ? "รายจ่าย" : "รายรับ"}
                {selectedCategory !== "ALL"
                  ? ` (หมวด ${categories.find((c) => c.id == selectedCategory)?.name || ""})`
                  : " ตามหมวดหมู่"}
              </h2>
              <div className="flex bg-slate-100 rounded-lg p-1 border border-sky-200/30">
                <button
                  onClick={() => setChartType("EXPENSE")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${chartType === "EXPENSE" ? "bg-red-50 text-red-500 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  รายจ่าย
                </button>
                <button
                  onClick={() => setChartType("INCOME")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${chartType === "INCOME" ? "bg-emerald-50 text-emerald-500 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  รายรับ
                </button>
              </div>
            </div>

            {pieData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 h-[300px]">
                <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
                <p>ยังไม่มีข้อมูล{chartType === "EXPENSE" ? "รายจ่าย" : "รายรับ"}</p>
              </div>
            ) : (
              <div className="relative h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="total" nameKey="category" stroke="none">
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => `฿${formatMoney(value)}`}
                      contentStyle={{ backgroundColor: "#ffffff", borderColor: "rgba(186, 230, 253, 0.5)", borderRadius: "12px", color: "#1e293b", boxShadow: "0 4px 12px rgba(56, 189, 248, 0.1)" }}
                      itemStyle={{ color: "#334155" }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => (<span className="text-slate-600 ml-1 text-sm">{value}</span>)}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -mt-6 text-center pointer-events-none">
                  <p className="text-xs text-slate-500">รวม{chartType === "EXPENSE" ? "จ่าย" : "รับ"}</p>
                  <p className={`text-lg font-bold ${chartType === "EXPENSE" ? "text-red-500" : "text-emerald-500"}`}>
                    ฿{formatMoney(totalPie)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Modal */}
          <TransactionModal
            isOpen={showModal}
            onClose={() => { setShowModal(false); setEditingTx(null); }}
            onSuccess={fetchData}
            editingTx={editingTx}
          />

          {/* Recent Transactions */}
          <div className="bg-white/70 backdrop-blur-xl border border-sky-200/50 rounded-2xl p-6 animate-slide-up" style={{ animationDelay: "0.4s" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-800">
                รายการล่าสุด
              </h2>
              <div className="flex items-center gap-2">
                {/* Export Dropdown */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowExportMenu(!showExportMenu); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/80 border border-sky-200/50 text-slate-500 text-xs font-medium hover:text-slate-700 hover:bg-white transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    ส่งออก
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 mt-1 w-40 bg-white border border-sky-200/50 rounded-xl shadow-xl shadow-sky-100/30 py-1 z-20 animate-fade-in">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleExportCSV(); setShowExportMenu(false); }}
                        className="w-full px-3 py-2 text-left text-xs text-slate-600 hover:bg-sky-50 hover:text-slate-800 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        CSV
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleExportExcel(); setShowExportMenu(false); }}
                        className="w-full px-3 py-2 text-left text-xs text-slate-600 hover:bg-sky-50 hover:text-slate-800 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-3.5 h-3.5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Excel
                      </button>
                    </div>
                  )}
                </div>

                <a href="/transactions" className="text-sm text-sky-500 hover:text-sky-600 transition-colors">
                  ดูทั้งหมด →
                </a>
              </div>
            </div>
            {recentTx.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p>ยังไม่มีรายการ</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTx.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-sky-50/50 hover:bg-sky-100/50 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === "INCOME" ? "bg-emerald-50" : "bg-red-50"}`}>
                        {tx.type === "INCOME" ? (
                          <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="text-slate-800 text-sm font-medium">{tx.title}</p>
                        <p className="text-slate-500 text-xs">
                          {tx.category?.name || "ไม่ระบุ"} • {new Date(tx.date).toLocaleDateString("th-TH")}
                        </p>
                      </div>
                    </div>
                    <p className={`text-sm font-semibold ${tx.type === "INCOME" ? "text-emerald-500" : "text-red-500"}`}>
                      {tx.type === "INCOME" ? "+" : "-"}฿{formatMoney(tx.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
