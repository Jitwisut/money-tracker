"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getTransactions, isAuthenticated } from "../lib/api";
import Navbar from "../components/Navbar";
import { DatePicker } from "../components/DatePicker";
import { format } from "date-fns";
import TransactionModal from "../components/TransactionModal";
import { useToast } from "../components/Toast";

function formatMoney(num) {
  return Number(num).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(d) {
  return new Date(d).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
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
    [headers.join(","), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join(
      "\n",
    );

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `รายการค่าใช้จ่าย_${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToExcel(transactions) {
  const rows = transactions.map(
    (tx) => `
    <tr>
      <td>${tx.title}</td>
      <td>${tx.type === "INCOME" ? "รายรับ" : "รายจ่าย"}</td>
      <td>${tx.category?.name || "ไม่ระบุ"}</td>
      <td>${tx.amount}</td>
      <td>${new Date(tx.date).toLocaleDateString("th-TH")}</td>
      <td>${tx.note || ""}</td>
    </tr>`,
  );

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head><meta charset="UTF-8"></head>
    <body>
      <table border="1">
        <thead>
          <tr>
            <th>ชื่อรายการ</th>
            <th>ประเภท</th>
            <th>หมวดหมู่</th>
            <th>จำนวนเงิน</th>
            <th>วันที่</th>
            <th>หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    </body></html>`;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `รายการค่าใช้จ่าย_${format(new Date(), "yyyy-MM-dd")}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TransactionsPage() {
  const router = useRouter();
  const toast = useToast();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter & Sort State
  const [startDate, setStartDate] = useState(undefined);
  const [endDate, setEndDate] = useState(undefined);
  const [filterType, setFilterType] = useState("ALL");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState(null);

  // Export Dropdown State
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    fetchTransactions();
  }, []);

  // Close export menu on outside click
  useEffect(() => {
    const handleClick = () => setShowExportMenu(false);
    if (showExportMenu) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [showExportMenu]);

  const buildFilters = (sd = startDate, ed = endDate, t = filterType) => ({
    startDate: sd ? format(sd, "yyyy-MM-dd") : "",
    endDate: ed ? format(ed, "yyyy-MM-dd") : "",
    type: t,
  });

  const fetchTransactions = async (f) => {
    setLoading(true);
    try {
      const res = await getTransactions(f || buildFilters());
      setTransactions(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    fetchTransactions(buildFilters());
  };

  const handleClearFilter = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setFilterType("ALL");
    fetchTransactions({ startDate: "", endDate: "", type: "ALL" });
  };

  // Sort Logic
  const sortedTransactions = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => {
      if (sortBy === "date") {
        return sortDir === "desc"
          ? new Date(b.date) - new Date(a.date)
          : new Date(a.date) - new Date(b.date);
      }
      if (sortBy === "amount") {
        return sortDir === "desc"
          ? Number(b.amount) - Number(a.amount)
          : Number(a.amount) - Number(b.amount);
      }
      return 0;
    });
    return sorted;
  }, [transactions, sortBy, sortDir]);

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  };

  const openCreate = () => {
    setEditingTx(null);
    setShowModal(true);
  };

  const openEdit = (tx) => {
    setEditingTx(tx);
    setShowModal(true);
  };

  const handleSuccess = () => {
    fetchTransactions(buildFilters());
  };

  // ─── Export Handlers ───
  const handleExportCSV = () => {
    if (sortedTransactions.length === 0) {
      toast.warning("ไม่มีข้อมูลให้ส่งออก");
      return;
    }
    exportToCSV(sortedTransactions);
    toast.success("ส่งออก CSV สำเร็จ! 📥");
  };

  const handleExportExcel = () => {
    if (sortedTransactions.length === 0) {
      toast.warning("ไม่มีข้อมูลให้ส่งออก");
      return;
    }
    exportToExcel(sortedTransactions);
    toast.success("ส่งออก Excel สำเร็จ! 📥");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e8f4fd] via-[#f0f7ff] to-white">
      <Navbar />
      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
              รายการทั้งหมด
            </h1>
            <p className="text-slate-500 mt-1">จัดการรายรับ-รายจ่ายของคุณ</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Export Button with Dropdown */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExportMenu(!showExportMenu);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/80 border border-sky-200/50 text-slate-600 font-medium hover:bg-white hover:text-slate-800 transition-all shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                ส่งออก
                <svg className={`w-4 h-4 transition-transform ${showExportMenu ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-sky-200/50 rounded-xl shadow-xl shadow-sky-100/30 py-1 z-20 animate-fade-in">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportCSV();
                      setShowExportMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-600 hover:bg-sky-50 hover:text-slate-800 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    ส่งออก CSV
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportExcel();
                      setShowExportMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-600 hover:bg-sky-50 hover:text-slate-800 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    ส่งออก Excel
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 text-white font-medium hover:from-sky-400 hover:to-blue-400 transition-all shadow-lg shadow-sky-500/20"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              เพิ่มรายการ
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/70 backdrop-blur-xl border border-sky-200/50 rounded-2xl p-4 mb-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="w-full sm:flex-1 sm:min-w-[140px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                วันเริ่มต้น
              </label>
              <DatePicker
                date={startDate}
                setDate={setStartDate}
                label="วว/ดด/ปปปป"
              />
            </div>
            <div className="w-full sm:flex-1 sm:min-w-[140px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                วันสิ้นสุด
              </label>
              <DatePicker
                date={endDate}
                setDate={setEndDate}
                label="วว/ดด/ปปปป"
              />
            </div>
            <div className="w-full sm:min-w-[140px] sm:w-auto">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                ประเภท
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-sky-50/50 border border-sky-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/50 transition-all appearance-none"
              >
                <option value="ALL">
                  ทั้งหมด
                </option>
                <option value="INCOME">
                  รายรับ
                </option>
                <option value="EXPENSE">
                  รายจ่าย
                </option>
              </select>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={handleFilter}
                className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 text-white text-sm font-medium hover:from-sky-400 hover:to-blue-400 transition-all shadow-lg shadow-sky-500/20"
              >
                กรอง
              </button>
              <button
                onClick={handleClearFilter}
                className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-white/80 border border-sky-200/50 text-slate-500 text-sm font-medium hover:text-slate-700 hover:bg-white transition-all"
              >
                ล้าง
              </button>
            </div>
          </div>
        </div>

        {/* Sort Buttons */}
        <div className="flex gap-2 mb-4 animate-fade-in">
          <button
            onClick={() => toggleSort("date")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sortBy === "date" ? "bg-sky-100 text-sky-600" : "bg-white/60 text-slate-500 hover:text-slate-700"}`}
          >
            วันที่
            {sortBy === "date" && (
              <svg
                className={`w-3 h-3 transition-transform ${sortDir === "asc" ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            )}
          </button>
          <button
            onClick={() => toggleSort("amount")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sortBy === "amount" ? "bg-sky-100 text-sky-600" : "bg-white/60 text-slate-500 hover:text-slate-700"}`}
          >
            จำนวนเงิน
            {sortBy === "amount" && (
              <svg
                className={`w-3 h-3 transition-transform ${sortDir === "asc" ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Transactions List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg
              className="animate-spin h-10 w-10 text-sky-500"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        ) : sortedTransactions.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-xl border border-sky-200/50 rounded-2xl p-12 text-center animate-fade-in">
            <svg
              className="w-20 h-20 mx-auto mb-4 text-slate-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-slate-500 text-lg mb-2">ยังไม่มีรายการ</p>
            <p className="text-slate-400 text-sm">
              คลิก &quot;เพิ่มรายการ&quot; เพื่อเริ่มบันทึกค่าใช้จ่าย
            </p>
          </div>
        ) : (
          <div className="space-y-3 animate-fade-in">
            {sortedTransactions.map((tx) => (
              <div
                key={tx.id}
                onClick={() => openEdit(tx)}
                className="bg-white/70 backdrop-blur-xl border border-sky-200/50 rounded-2xl p-4 hover:bg-white/90 hover:shadow-lg hover:shadow-sky-100/50 transition-all duration-200 group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${tx.type === "INCOME" ? "bg-emerald-50" : "bg-red-50"}`}
                    >
                      {tx.type === "INCOME" ? (
                        <svg
                          className="w-6 h-6 text-emerald-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 11l5-5m0 0l5 5m-5-5v12"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-6 h-6 text-red-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 13l-5 5m0 0l-5-5m5 5V6"
                          />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-slate-800 font-medium group-hover:text-sky-600 transition-colors">
                        {tx.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${tx.type === "INCOME" ? "bg-emerald-50 text-emerald-500" : "bg-red-50 text-red-500"}`}
                        >
                          {tx.type === "INCOME" ? "รายรับ" : "รายจ่าย"}
                        </span>
                        <span className="text-slate-400 text-xs">
                          {tx.category?.name || "ไม่ระบุ"}
                        </span>
                        <span className="text-slate-300 text-xs">•</span>
                        <span className="text-slate-400 text-xs">
                          {formatDate(tx.date)}
                        </span>
                      </div>
                      {tx.note && (
                        <p className="text-slate-400 text-xs mt-1 line-clamp-1">
                          📝 {tx.note}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p
                      className={`text-lg font-bold ${tx.type === "INCOME" ? "text-emerald-500" : "text-red-500"}`}
                    >
                      {tx.type === "INCOME" ? "+" : "-"}฿
                      {formatMoney(tx.amount)}
                    </p>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
        editingTx={editingTx}
      />
    </div>
  );
}
