import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUser, getProfile } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowLeft, Receipt } from 'lucide-react';
import PrintButton from './PrintButton';

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
    redirect('/pin');
  }

  const profile = await getProfile(user.id);

  if (!['owner', 'cashier'].includes(profile?.role || '')) {
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
      hutang: 'Hutang',
    };
    return labels[method] || method;
  };

  return (
    <div style={{ padding: 'var(--space-4)' }} className="lg:p-8">
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 'var(--space-6)',
      }}>
        <Link
          href="/transactions"
          style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-md)',
            color: 'var(--color-on-surface-variant)',
            transition: 'color var(--transition-fast)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-on-surface)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-on-surface-variant)'; }}
        >
          <ArrowLeft style={{ width: '1.25rem', height: '1.25rem' }} />
          Kembali ke Transaksi
        </Link>
        <PrintButton />
      </div>

      {/* Receipt */}
      <div style={{
        backgroundColor: 'var(--color-surface-container-lowest)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-outline-variant)',
        maxWidth: '28rem',
        margin: '0 auto',
        padding: 'var(--space-6)',
      }} id="receipt">
        <div style={{
          textAlign: 'center',
          borderBottom: '1.5px dashed var(--color-outline-variant)',
          paddingBottom: 'var(--space-4)',
          marginBottom: 'var(--space-4)',
        }}>
          <p style={{
            fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)',
            fontWeight: '700', color: 'var(--color-on-surface)',
          }}>
            WARUNG SEMBAKO BY RAS
          </p>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)',
            color: 'var(--color-outline)', marginTop: 'var(--space-1)',
          }}>
            Jl. Boulevard Grand Depok City
          </p>
        </div>

        <div style={{
          fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)',
          display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
          marginBottom: 'var(--space-4)',
        }}>
          {[
            ['Tanggal:', formatDate(transaction.created_at)],
            ['ID Transaksi:', transaction.id.slice(0, 8)],
            ['Kasir:', transaction.cashier?.full_name || 'Tidak diketahui'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
              <span style={{
                fontFamily: label === 'ID Transaksi:' ? 'var(--font-mono)' : 'var(--font-body)',
                color: 'var(--color-on-surface)',
              }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{
          borderTop: '1px solid var(--color-outline-variant)',
          borderBottom: '1px solid var(--color-outline-variant)',
          paddingTop: 'var(--space-2)',
          paddingBottom: 'var(--space-2)',
          marginBottom: 'var(--space-4)',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)',
            fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-xs)',
            fontWeight: '600', color: 'var(--color-on-surface-variant)',
          }}>
            <div style={{ gridColumn: 'span 6' }}>Item</div>
            <div style={{ gridColumn: 'span 2', textAlign: 'center' }}>Qty</div>
            <div style={{ gridColumn: 'span 4', textAlign: 'right' }}>Harga</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          {(transaction.items ?? []).map((item: any) => (
            <div key={item.id} style={{
              display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)',
              fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)',
              color: 'var(--color-on-surface)',
            }}>
              <div style={{ gridColumn: 'span 6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.product?.name}
              </div>
              <div style={{ gridColumn: 'span 2', textAlign: 'center' }}>{item.qty}</div>
              <div style={{ gridColumn: 'span 4', textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: '700' }}>
                {formatCurrency(item.price * item.qty)}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          borderTop: '1px solid var(--color-outline-variant)',
          paddingTop: 'var(--space-4)',
          marginBottom: 'var(--space-4)',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)',
            fontWeight: '700', color: 'var(--color-on-surface)',
          }}>
            <span>TOTAL</span>
            <span>{formatCurrency(transaction.total)}</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)',
            marginTop: 'var(--space-2)', color: 'var(--color-on-surface-variant)',
          }}>
            <span>Metode Pembayaran:</span>
            <span style={{ textTransform: 'capitalize' }}>
              {getPaymentMethodLabel(transaction.payment_method)}
            </span>
          </div>
        </div>

        <div style={{
          textAlign: 'center',
          borderTop: '1.5px dashed var(--color-outline-variant)',
          paddingTop: 'var(--space-4)',
        }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-outline)' }}>
            Terima kasih atas kunjungan Anda!
          </p>
        </div>
      </div>
    </div>
  );
}
