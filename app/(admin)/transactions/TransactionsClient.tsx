'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Transaction } from '@/lib/supabase/types';
import { Search, ChevronLeft, ChevronRight, Receipt, Eye } from 'lucide-react';

interface TransactionsClientProps {
  initialTransactions: Transaction[];
  currentPage: number;
  totalPages: number;
  total: number;
}

export default function TransactionsClient({
  initialTransactions,
  currentPage,
  totalPages,
  total,
}: TransactionsClientProps) {
  const [transactions] = useState(initialTransactions || []);
  const [searchQuery, setSearchQuery] = useState('');

  const safeSearch = searchQuery ?? '';
  const filteredTransactions = (transactions || []).filter((t) =>
    (t?.id ?? '').toLowerCase().includes(safeSearch.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: 'Tunai',
      qris: 'QRIS',
      transfer: 'Transfer',
      hutang: 'Hutang',
    };
    return labels[method] || method;
  };

  const getPaymentMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      cash: 'bg-green-100 text-green-700',
      qris: 'bg-blue-100 text-blue-700',
      transfer: 'bg-purple-100 text-purple-700',
      hutang: 'bg-orange-100 text-orange-700',
    };
    return colors[method] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Transaksi</h1>
          <p className="text-slate-500 mt-1">
            Lihat dan kelola riwayat transaksi
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Cari berdasarkan ID Transaksi..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        />
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <p className="text-sm text-slate-500">
          Menampilkan {transactions.length} dari {total} transaksi
        </p>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                  Tanggal
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                  ID Transaksi
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                  Kasir
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                  Pembayaran
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(filteredTransactions ?? []).map((transaction) => (
                <tr
                  key={transaction.id}
                  className="hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {formatDate(transaction.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-800">
                    {transaction.id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-800">
                    {transaction.cashier?.full_name || 'Tidak diketahui'}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                    {formatCurrency(transaction.total)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${getPaymentMethodColor(
                        transaction.payment_method
                      )}`}
                    >
                      {getPaymentMethodLabel(transaction.payment_method)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/transactions/${transaction.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 rounded-lg transition"
                    >
                      <Eye className="w-4 h-4" />
                      Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTransactions.length === 0 && (
          <div className="p-12 text-center">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Transaksi tidak ditemukan</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-slate-500">
            Halaman {currentPage} dari {totalPages}
          </p>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={`/transactions?page=${currentPage - 1}`}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={`/transactions?page=${currentPage + 1}`}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
