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
    <div style={{ padding: 'var(--space-4)' }} className="lg:p-8">
      {/* Header */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }} className="lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 style={{
            fontFamily: 'var(--font-heading)', fontSize: 'var(--text-headline-sm)',
            fontWeight: '700', color: 'var(--color-on-surface)',
          }}>
            Transaksi
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-md)',
            color: 'var(--color-outline)', marginTop: 'var(--space-1)',
          }}>
            Lihat dan kelola riwayat transaksi
          </p>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 'var(--space-6)' }}>
        <Search style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', width: '1.25rem', height: '1.25rem', color: 'var(--color-outline)' }} />
        <input
          type="text"
          placeholder="Cari berdasarkan ID Transaksi..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            paddingLeft: '2.5rem',
            paddingRight: 'var(--space-4)',
            paddingTop: 'var(--space-2)',
            paddingBottom: 'var(--space-2)',
            border: '1.5px solid var(--color-outline-variant)',
            borderRadius: 'var(--radius-lg)',
            outline: 'none',
            backgroundColor: 'var(--color-surface-container-high)',
            color: 'var(--color-on-surface)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-body-md)',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
        />
      </div>

      {/* Summary */}
      <div style={{
        backgroundColor: 'var(--color-surface-container-lowest)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-4)',
        border: '1px solid var(--color-outline-variant)',
        marginBottom: 'var(--space-6)',
      }}>
        <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-outline)' }}>
          Menampilkan {transactions.length} dari {total} transaksi
        </p>
      </div>

      {/* Transactions List */}
      <div style={{
        backgroundColor: 'var(--color-surface-container-lowest)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-outline-variant)',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%' }}>
            <thead style={{ backgroundColor: 'var(--color-surface-container)', borderBottom: '1px solid var(--color-outline-variant)' }}>
              <tr>
                {['Tanggal', 'ID Transaksi', 'Kasir', 'Total', 'Pembayaran', 'Aksi'].map((header) => (
                  <th key={header} style={{
                    padding: 'var(--space-3) var(--space-4)',
                    textAlign: 'left',
                    fontFamily: 'var(--font-label)',
                    fontSize: 'var(--text-label-sm)',
                    fontWeight: '600',
                    color: 'var(--color-on-surface-variant)',
                    letterSpacing: 'var(--tracking-wide)',
                  }}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(filteredTransactions ?? []).map((transaction) => (
                <tr
                  key={transaction.id}
                  style={{ borderBottom: '1px solid var(--color-outline-variant)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-container)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface-variant)' }}>
                    {formatDate(transaction.created_at)}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface)' }}>
                    {transaction.id.slice(0, 8)}...
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface)' }}>
                    {transaction.cashier?.full_name || 'Tidak diketahui'}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-heading)', fontWeight: '700', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface)' }}>
                    {formatCurrency(transaction.total)}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{
                      padding: 'var(--space-1) var(--space-2)',
                      borderRadius: 'var(--radius-full)',
                      fontFamily: 'var(--font-label)',
                      fontSize: 'var(--text-label-sm)',
                      fontWeight: '600',
                      backgroundColor: transaction.payment_method === 'cash' ? 'var(--color-tertiary-fixed)' : (transaction.payment_method === 'qris' ? 'var(--color-bank-fixed)' : 'var(--color-secondary-fixed)'),
                      color: transaction.payment_method === 'cash' ? 'var(--color-tertiary)' : (transaction.payment_method === 'qris' ? 'var(--color-bank)' : 'var(--color-secondary)'),
                    }}>
                      {getPaymentMethodLabel(transaction.payment_method)}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                    <Link
                      href={`/transactions/${transaction.id}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)',
                        padding: 'var(--space-1) var(--space-3)',
                        fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)',
                        fontWeight: '600',
                        color: 'var(--color-primary)',
                        backgroundColor: 'transparent',
                        borderRadius: 'var(--radius-lg)',
                        transition: 'background-color var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-primary-fixed)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
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
          <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
            <Receipt style={{ width: '3rem', height: '3rem', color: 'var(--color-outline-variant)', margin: '0 auto var(--space-4)' }} />
            <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-outline)' }}>Transaksi tidak ditemukan</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 'var(--space-6)',
        }}>
          <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-outline)' }}>
            Halaman {currentPage} dari {totalPages}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {currentPage > 1 && (
              <Link
                href={`/transactions?page=${currentPage - 1}`}
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: 'var(--space-2) var(--space-3)',
                  border: '1px solid var(--color-outline-variant)',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)',
                  color: 'var(--color-on-surface-variant)',
                  backgroundColor: 'transparent',
                  transition: 'background-color var(--transition-fast)',
                }}
              >
                <ChevronLeft style={{ width: '1rem', height: '1rem' }} />
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={`/transactions?page=${currentPage + 1}`}
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: 'var(--space-2) var(--space-3)',
                  border: '1px solid var(--color-outline-variant)',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)',
                  color: 'var(--color-on-surface-variant)',
                  backgroundColor: 'transparent',
                  transition: 'background-color var(--transition-fast)',
                }}
              >
                <ChevronRight style={{ width: '1rem', height: '1rem' }} />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
