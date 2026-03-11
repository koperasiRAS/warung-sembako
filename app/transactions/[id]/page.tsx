import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUser, getProfile } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowLeft, Printer, Receipt } from 'lucide-react';

interface TransactionDetailPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

async function getTransaction(id: string) {
  const supabase = await createClient();

  const { data: transaction } = await supabase
    .from('transactions')
    .select(`
      *,
      cashier:profiles!cashier_id(full_name),
      items:transaction_items(*, product:products(*))
    `)
    .eq('id', id)
    .single();

  return transaction;
}

export default async function TransactionDetailPage({ params }: TransactionDetailPageProps) {
  const { id } = await params;
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const profile = await getProfile(user.id);

  if (profile?.role !== 'owner') {
    redirect('/pos');
  }

  const transaction = await getTransaction(id);

  if (!transaction) {
    redirect('/transactions');
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: 'Tunai',
      qris: 'QRIS',
      transfer: 'Transfer',
    };
    return labels[method] || method;
  };

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/transactions"
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Transactions
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition"
        >
          <Printer className="w-5 h-5" />
          Print
        </button>
      </div>

      {/* Receipt */}
      <div className="bg-white rounded-xl border border-slate-200 max-w-md mx-auto p-6 receipt-container" id="receipt">
        <div className="text-center border-b-2 border-dashed border-slate-300 pb-4 mb-4">
          <h2 className="text-xl font-bold text-slate-800">
            WARUNG SEMBAKO
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Jl. Contoh No. 123
          </p>
        </div>

        <div className="text-sm space-y-2 mb-4">
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{formatDate(transaction.created_at)}</span>
          </div>
          <div className="flex justify-between">
            <span>Transaction ID:</span>
            <span className="font-mono">{transaction.id.slice(0, 8)}</span>
          </div>
          <div className="flex justify-between">
            <span>Cashier:</span>
            <span>{transaction.cashier?.full_name || 'Unknown'}</span>
          </div>
        </div>

        <div className="border-t border-b border-slate-200 py-2 mb-4">
          <div className="grid grid-cols-12 text-xs font-medium text-slate-600">
            <div className="col-span-6">Item</div>
            <div className="col-span-2 text-center">Qty</div>
            <div className="col-span-4 text-right">Price</div>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {transaction.items?.map((item: any) => (
            <div key={item.id} className="grid grid-cols-12 text-sm">
              <div className="col-span-6 truncate">
                {item.product?.name}
              </div>
              <div className="col-span-2 text-center">{item.qty}</div>
              <div className="col-span-4 text-right">
                {formatCurrency(item.price * item.qty)}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200 pt-4 mb-4">
          <div className="flex justify-between text-lg font-bold">
            <span>TOTAL</span>
            <span>{formatCurrency(transaction.total)}</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span>Payment Method:</span>
            <span className="capitalize">
              {getPaymentMethodLabel(transaction.payment_method)}
            </span>
          </div>
        </div>

        <div className="text-center text-sm text-slate-500 border-t-2 border-dashed border-slate-300 pt-4">
          <p>Thank you for your purchase!</p>
        </div>
      </div>
    </div>
  );
}
