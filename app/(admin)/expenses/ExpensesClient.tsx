'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Expense } from '@/lib/supabase/types';
import { Plus, Search, Edit, Trash2, Wallet, X, Loader2, Banknote } from 'lucide-react';
import toast from 'react-hot-toast';

interface PaginationInfo {
  page: number;
  total: number;
  totalPages: number;
  pageSize: number;
}

interface ExpensesClientProps {
  initialExpenses: Expense[];
  pagination?: PaginationInfo;
}

export default function ExpensesClient({ initialExpenses, pagination }: ExpensesClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [expenses, setExpenses] = useState(initialExpenses);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    payment_method: 'cash' as 'cash' | 'bank',
    note: '',
  });

  const filteredExpenses = expenses.filter((expense) =>
    expense.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('expenses-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'expenses' },
        async () => {
          const { data } = await supabase
            .from('expenses')
            .select('*')
            .order('created_at', { ascending: false });
          if (data) setExpenses(data as Expense[]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'expenses' },
        async () => {
          const { data } = await supabase
            .from('expenses')
            .select('*')
            .order('created_at', { ascending: false });
          if (data) setExpenses(data as Expense[]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'expenses' },
        async () => {
          const { data } = await supabase
            .from('expenses')
            .select('*')
            .order('created_at', { ascending: false });
          if (data) setExpenses(data as Expense[]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const cashExpenses = expenses
    .filter((e) => e.payment_method === 'cash')
    .reduce((sum, e) => sum + e.amount, 0);
  const bankExpenses = expenses
    .filter((e) => e.payment_method === 'bank')
    .reduce((sum, e) => sum + e.amount, 0);

  const openModal = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        title: expense.title,
        amount: expense.amount.toString(),
        payment_method: expense.payment_method,
        note: expense.note || '',
      });
    } else {
      setEditingExpense(null);
      setFormData({ title: '', amount: '', payment_method: 'cash', note: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
  };

  const handlePageChange = (newPage: number) => {
    if (!pagination || newPage < 1 || newPage > pagination.totalPages) return;
    const params = new URLSearchParams(window.location.search);
    params.set('page', newPage.toString());
    router.push(`/expenses?${params.toString()}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const title = formData.title.trim();
    const amount = parseFloat(formData.amount);

    if (!title || title.length < 2) {
      toast.error('Judul pengeluaran minimal 2 karakter!');
      setLoading(false);
      return;
    }

    if (isNaN(amount) || amount <= 0) {
      toast.error('Jumlah pengeluaran harus lebih dari 0!');
      setLoading(false);
      return;
    }

    if (amount > 1000000000) {
      toast.error('Jumlah pengeluaran terlalu besar! Maksimal Rp 1.000.000.000');
      setLoading(false);
      return;
    }

    try {
      const expenseData = {
        title: title,
        amount: amount,
        payment_method: formData.payment_method,
        note: formData.note || null,
      };

      if (editingExpense) {
        const oldExpense = expenses.find(ex => ex.id === editingExpense.id);

        const { error: rpcNewError } = await supabase.rpc('reverse_balance_after_expense', {
          p_payment_method: expenseData.payment_method,
          p_amount: expenseData.amount,
        });
        if (rpcNewError) throw rpcNewError;

        if (oldExpense) {
          await supabase.rpc('reverse_balance_after_expense', {
            p_payment_method: oldExpense.payment_method,
            p_amount: -oldExpense.amount,
          });
        }

        const { error } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', editingExpense.id);

        if (error) throw error;

        setExpenses(
          (expenses ?? []).map((ex) =>
            ex.id === editingExpense.id ? { ...ex, ...expenseData } : ex
          )
        );
      } else {
        const { error: rpcError } = await supabase.rpc('reverse_balance_after_expense', {
          p_payment_method: expenseData.payment_method,
          p_amount: expenseData.amount,
        });
        if (rpcError) throw rpcError;

        const { data, error } = await supabase
          .from('expenses')
          .insert(expenseData)
          .select()
          .single();

        if (error) throw error;
        setExpenses([data, ...expenses]);
      }

      closeModal();
      toast.success('Pengeluaran berhasil disimpan!');
    } catch (error: any) {
      console.error('Error saving expense:', error);
      const msg = error?.message || '';
      if (msg.includes('INSUFFICIENT_BALANCE')) {
        const readable = msg.split('INSUFFICIENT_BALANCE:')[1] || 'Saldo tidak mencukupi!';
        toast.error(readable);
      } else {
        toast.error('Gagal menyimpan pengeluaran!');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      const expense = expenses.find(ex => ex.id === id);

      if (!expense) {
        toast.error('Data pengeluaran tidak ditemukan!');
        setLoading(false);
        return;
      }

      const { error: rpcError } = await supabase.rpc('reverse_balance_after_expense', {
        p_payment_method: expense.payment_method,
        p_amount: -expense.amount,
      });
      if (rpcError) {
        toast.error('Gagal hapus: tidak bisa mengembalikan saldo!');
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;

      setExpenses(expenses.filter((ex) => ex.id !== id));
      setDeleteConfirm(null);
      toast.success('Pengeluaran berhasil dihapus!');
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('Gagal menghapus pengeluaran!');
    } finally {
      setLoading(false);
    }
  };

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
    });
  };

  return (
    <div style={{ padding: 'var(--space-4)' }} className="lg:p-8">
      {/* Header */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }} className="lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'var(--text-headline-sm)',
            fontWeight: '700',
            color: 'var(--color-on-surface)',
          }}>
            Pengeluaran
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-body-md)',
            color: 'var(--color-outline)',
            marginTop: 'var(--space-1)',
          }}>
            Catat pengeluaran usaha
          </p>
        </div>
        <button
          onClick={() => openModal()}
          style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-4)',
            background: 'var(--gradient-primary)',
            color: 'var(--color-on-primary)',
            border: 'none', borderRadius: 'var(--radius-lg)',
            fontFamily: 'var(--font-label)', fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          <Plus style={{ width: '1.25rem', height: '1.25rem' }} />
          Tambah Pengeluaran
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}>
        {[
          { label: 'Total Pengeluaran', value: totalExpenses },
          { label: 'Pengeluaran Tunai', value: cashExpenses },
          { label: 'Pengeluaran Bank', value: bankExpenses },
        ].map((card) => (
          <div key={card.label} style={{
            backgroundColor: 'var(--color-surface-container-lowest)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-4)',
            border: '1px solid var(--color-outline-variant)',
          }}>
            <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-outline)' }}>
              {card.label}
            </p>
            <p style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: '700',
              fontSize: 'var(--text-title-lg)',
              color: 'var(--color-error)',
              marginTop: 'var(--space-1)',
            }}>
              {formatCurrency(card.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 'var(--space-6)' }}>
        <Search style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', width: '1.25rem', height: '1.25rem', color: 'var(--color-outline)' }} />
        <input
          type="text"
          placeholder="Cari pengeluaran..."
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

      {/* Expenses List */}
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
                {['Tanggal', 'Judul', 'Catatan', 'Metode', 'Jumlah', 'Aksi'].map((header) => (
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
              {(filteredExpenses ?? []).map((expense) => (
                <tr key={expense.id} style={{ borderBottom: '1px solid var(--color-outline-variant)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-container)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface-variant)' }}>
                    {formatDate(expense.created_at)}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-body)', fontWeight: '600', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface)' }}>
                    {expense.title}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-outline)' }}>
                    {expense.note || '-'}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)',
                      padding: 'var(--space-1) var(--space-2)',
                      borderRadius: 'var(--radius-full)',
                      fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', fontWeight: '600',
                      backgroundColor: expense.payment_method === 'cash' ? 'var(--color-tertiary-fixed)' : '#dbeafe',
                      color: expense.payment_method === 'cash' ? 'var(--color-tertiary)' : 'var(--color-bank, #2563eb)',
                    }}>
                      {expense.payment_method === 'cash' ? (
                        <Banknote style={{ width: '0.75rem', height: '0.75rem' }} />
                      ) : (
                        <Wallet style={{ width: '0.75rem', height: '0.75rem' }} />
                      )}
                      {expense.payment_method === 'cash' ? 'Tunai' : 'Bank'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-heading)', fontWeight: '700', fontSize: 'var(--text-body-sm)', color: 'var(--color-error)', textAlign: 'right' }}>
                    {formatCurrency(expense.amount)}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-1)' }}>
                      <button
                        onClick={() => openModal(expense)}
                        style={{ padding: 'var(--space-2)', color: 'var(--color-outline)', backgroundColor: 'transparent', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                      >
                        <Edit style={{ width: '1rem', height: '1rem' }} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(expense.id)}
                        style={{ padding: 'var(--space-2)', color: 'var(--color-outline)', backgroundColor: 'transparent', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                      >
                        <Trash2 style={{ width: '1rem', height: '1rem' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredExpenses.length === 0 && (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
            <Wallet style={{ width: '3rem', height: '3rem', color: 'var(--color-outline-variant)', margin: '0 auto var(--space-4)' }} />
            <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-outline)' }}>Pengeluaran tidak ditemukan</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-3) var(--space-4)',
          borderTop: '1px solid var(--color-outline-variant)',
          backgroundColor: 'var(--color-surface-container-lowest)',
          borderRadius: '0 0 var(--radius-xl) var(--radius-xl)',
        }}>
          <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-outline)' }}>
            Menampilkan {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} dari {pagination.total} pengeluaran
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              style={{
                padding: 'var(--space-1) var(--space-3)',
                border: '1px solid var(--color-outline-variant)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)',
                color: 'var(--color-on-surface-variant)',
                backgroundColor: 'transparent',
                cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                opacity: pagination.page <= 1 ? '0.4' : '1',
              }}
            >
              ←
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => {
              const isActive = p === pagination.page;
              return (
                <button
                  key={p}
                  onClick={() => handlePageChange(p)}
                  style={{
                    padding: 'var(--space-1) var(--space-3)',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                    borderRadius: 'var(--radius-md)',
                    fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)',
                    backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                    color: isActive ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
                    cursor: 'pointer',
                  }}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              style={{
                padding: 'var(--space-1) var(--space-3)',
                border: '1px solid var(--color-outline-variant)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)',
                color: 'var(--color-on-surface-variant)',
                backgroundColor: 'transparent',
                cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                opacity: pagination.page >= pagination.totalPages ? '0.4' : '1',
              }}
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div style={{
            backgroundColor: 'var(--color-surface-container-lowest)',
            borderRadius: 'var(--radius-xl)',
            width: '100%', maxWidth: '28rem',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-overlay)',
          }}>
            <div style={{ padding: 'var(--space-6)', borderBottom: '1px solid var(--color-outline-variant)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)', fontWeight: '600', color: 'var(--color-on-surface)' }}>
                  {editingExpense ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}
                </h2>
                <button
                  onClick={closeModal}
                  style={{ padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', cursor: 'pointer', backgroundColor: 'transparent', border: 'none', color: 'var(--color-outline)' }}
                >
                  <X style={{ width: '1.25rem', height: '1.25rem' }} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>
                  Judul *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  style={{
                    width: '100%', padding: 'var(--space-2) var(--space-4)',
                    border: '1.5px solid var(--color-outline-variant)',
                    borderRadius: 'var(--radius-lg)', outline: 'none',
                    backgroundColor: 'var(--color-surface-container-high)',
                    color: 'var(--color-on-surface)', fontFamily: 'var(--font-body)',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>
                  Jumlah *
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  style={{
                    width: '100%', padding: 'var(--space-2) var(--space-4)',
                    border: '1.5px solid var(--color-outline-variant)',
                    borderRadius: 'var(--radius-lg)', outline: 'none',
                    backgroundColor: 'var(--color-surface-container-high)',
                    color: 'var(--color-on-surface)', fontFamily: 'var(--font-body)',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                  required min="0" step="100"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>
                  Metode Pembayaran
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}>
                  {[
                    { key: 'cash', label: 'Tunai', Icon: Banknote },
                    { key: 'bank', label: 'Bank', Icon: Wallet },
                  ].map(({ key, label, Icon }) => {
                    const isActive = formData.payment_method === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormData({ ...formData, payment_method: key as 'cash' | 'bank' })}
                        style={{
                          padding: 'var(--space-3)',
                          borderRadius: 'var(--radius-lg)',
                          border: '1.5px solid',
                          borderColor: isActive ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                          backgroundColor: isActive ? 'var(--color-primary-fixed)' : 'transparent',
                          color: isActive ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
                          cursor: 'pointer', fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', fontWeight: '600',
                        }}
                      >
                        <Icon style={{ width: '1rem', height: '1rem' }} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>
                  Catatan
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  style={{
                    width: '100%', padding: 'var(--space-2) var(--space-4)',
                    border: '1.5px solid var(--color-outline-variant)',
                    borderRadius: 'var(--radius-lg)', outline: 'none',
                    backgroundColor: 'var(--color-surface-container-high)',
                    color: 'var(--color-on-surface)', fontFamily: 'var(--font-body)',
                    resize: 'none',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; }}
                  rows={2}
                />
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', paddingTop: 'var(--space-4)' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    flex: 1,
                    padding: 'var(--space-2) var(--space-4)',
                    border: '1px solid var(--color-outline-variant)',
                    color: 'var(--color-on-surface-variant)',
                    borderRadius: 'var(--radius-lg)',
                    fontFamily: 'var(--font-label)', fontWeight: '600',
                    cursor: 'pointer', backgroundColor: 'transparent',
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: 'var(--space-2) var(--space-4)',
                    backgroundColor: loading ? 'var(--color-surface-container)' : 'var(--color-primary)',
                    color: loading ? 'var(--color-outline)' : 'var(--color-on-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontFamily: 'var(--font-label)', fontWeight: '600',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading && <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 0.6s linear infinite' }} />}
                  {editingExpense ? 'Simpan' : 'Buat Baru'}
                </button>
              </div>
            </form>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div style={{
            backgroundColor: 'var(--color-surface-container-lowest)',
            borderRadius: 'var(--radius-xl)',
            width: '100%', maxWidth: '24rem',
            padding: 'var(--space-6)',
            boxShadow: 'var(--shadow-overlay)',
          }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)', fontWeight: '600', color: 'var(--color-on-surface)', marginBottom: 'var(--space-2)' }}>
              Hapus Pengeluaran?
            </h3>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-md)', color: 'var(--color-outline)', marginBottom: 'var(--space-6)' }}>
              Tindakan ini tidak dapat dibatalkan.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  flex: 1,
                  padding: 'var(--space-2) var(--space-4)',
                  border: '1px solid var(--color-outline-variant)',
                  color: 'var(--color-on-surface-variant)',
                  borderRadius: 'var(--radius-lg)',
                  fontFamily: 'var(--font-label)', fontWeight: '600',
                  cursor: 'pointer', backgroundColor: 'transparent',
                }}
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: 'var(--space-2) var(--space-4)',
                  backgroundColor: 'var(--color-error)',
                  color: 'var(--color-on-error)',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontFamily: 'var(--font-label)', fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? '0.5' : '1',
                }}
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}