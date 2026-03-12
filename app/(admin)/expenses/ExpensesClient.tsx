'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Expense } from '@/lib/supabase/types';
import { Plus, Search, Edit, Trash2, Wallet, X, Loader2, Banknote } from 'lucide-react';

interface ExpensesClientProps {
  initialExpenses: Expense[];
}

export default function ExpensesClient({ initialExpenses }: ExpensesClientProps) {
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
      setFormData({
        title: '',
        amount: '',
        payment_method: 'cash',
        note: '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const expenseData = {
        title: formData.title,
        amount: parseFloat(formData.amount),
        payment_method: formData.payment_method,
        note: formData.note || null,
      };

      if (editingExpense) {
        // Get old expense to calculate balance difference
        const oldExpense = expenses.find(ex => ex.id === editingExpense.id);

        const { error } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', editingExpense.id);

        if (error) throw error;

        // Reverse old expense balance (add back)
        if (oldExpense) {
          await supabase.rpc('reverse_balance_after_expense', {
            p_payment_method: oldExpense.payment_method,
            p_amount: -oldExpense.amount,
          });
        }

        // Apply new expense balance (subtract)
        await supabase.rpc('reverse_balance_after_expense', {
          p_payment_method: expenseData.payment_method,
          p_amount: expenseData.amount,
        });

        setExpenses(
          (expenses ?? []).map((ex) =>
            ex.id === editingExpense.id ? { ...ex, ...expenseData } : ex
          )
        );
      } else {
        const { data, error } = await supabase
          .from('expenses')
          .insert(expenseData)
          .select()
          .single();

        if (error) throw error;

        // Update balance after creating expense
        await supabase.rpc('reverse_balance_after_expense', {
          p_payment_method: expenseData.payment_method,
          p_amount: expenseData.amount,
        });

        setExpenses([data, ...expenses]);
      }

      closeModal();
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Gagal menyimpan pengeluaran');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      // Get expense to reverse balance
      const expense = expenses.find(ex => ex.id === id);

      const { error } = await supabase.from('expenses').delete().eq('id', id);

      if (error) throw error;

      // Reverse the balance (add back the amount)
      if (expense) {
        await supabase.rpc('reverse_balance_after_expense', {
          p_payment_method: expense.payment_method,
          p_amount: -expense.amount,
        });
      }

      setExpenses(expenses.filter((ex) => ex.id !== id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting expense:', error);
      alert('Gagal menghapus pengeluaran');
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
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pengeluaran</h1>
          <p className="text-slate-500 mt-1">Catat pengeluaran usaha</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition"
        >
          <Plus className="w-5 h-5" />
          Tambah Pengeluaran
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">Total Pengeluaran</p>
          <p className="text-xl font-bold text-red-600 mt-1">
            {formatCurrency(totalExpenses)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">Pengeluaran Tunai</p>
          <p className="text-xl font-bold text-red-600 mt-1">
            {formatCurrency(cashExpenses)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">Pengeluaran Bank</p>
          <p className="text-xl font-bold text-red-600 mt-1">
            {formatCurrency(bankExpenses)}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Cari pengeluaran..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        />
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                  Tanggal
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                  Judul
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                  Catatan
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                  Metode
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">
                  Jumlah
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(filteredExpenses ?? []).map((expense) => (
                <tr key={expense.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {formatDate(expense.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">
                    {expense.title}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {expense.note || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${
                        expense.payment_method === 'cash'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {expense.payment_method === 'cash' ? (
                        <Banknote className="w-3 h-3" />
                      ) : (
                        <Wallet className="w-3 h-3" />
                      )}
                      {expense.payment_method === 'cash' ? 'Tunai' : 'Bank'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-red-600 text-right">
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openModal(expense)}
                        className="p-1.5 text-slate-500 hover:text-primary hover:bg-slate-100 rounded"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(expense.id)}
                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredExpenses.length === 0 && (
          <div className="p-12 text-center">
            <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Pengeluaran tidak ditemukan</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">
                  {editingExpense ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Judul *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Jumlah *
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  required
                  min="0"
                  step="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, payment_method: 'cash' })
                    }
                    className={`p-3 border rounded-lg flex items-center justify-center gap-2 transition ${
                      formData.payment_method === 'cash'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    Tunai
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, payment_method: 'bank' })
                    }
                    className={`p-3 border rounded-lg flex items-center justify-center gap-2 transition ${
                      formData.payment_method === 'bank'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <Wallet className="w-4 h-4" />
                    Bank
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Catatan
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) =>
                    setFormData({ ...formData, note: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingExpense ? 'Simpan' : 'Buat Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              Hapus Pengeluaran?
            </h3>
            <p className="text-slate-500 mb-6">
              Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50"
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
