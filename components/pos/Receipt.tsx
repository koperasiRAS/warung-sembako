import { Transaction, TransactionItem } from '@/types';

export interface ReceiptProps {
  transaction: Transaction;
  items: TransactionItem[];
  cashierName: string;
}

export function Receipt({ transaction, items, cashierName }: ReceiptProps) {
  const formatCurrency = (amount: number) => {
    return Number(amount).toLocaleString('id-ID');
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const paymentMethodLabel = {
    cash: 'CASH',
    qris: 'QRIS',
    transfer: 'TRANSFER',
    hutang: 'HUTANG'
  };

  return (
    <div className="bg-white p-2 text-black text-sm font-sans font-bold" style={{ width: '100%', maxWidth: '58mm', WebkitFontSmoothing: 'none' }}>
      <div className="text-center border-b-2 border-dashed border-black pb-3 mb-3">
        <h1 className="font-extrabold text-base">WARUNG SEMBAKO BY RAS</h1>
        <p className="text-sm mt-1">Jl. Boulevard Grand Depok City</p>
      </div>

      <div className="border-b-2 border-dashed border-black pb-2 mb-3">
        <p>DATE: {formatDate(transaction.created_at)}</p>
        <p>TRX: {transaction.id.slice(0, 12)}</p>
        <p>CASHIER: {cashierName}</p>
      </div>

      <div className="border-b border-slate-300 pb-2 mb-3">
        <div className="grid grid-cols-12 gap-1 mb-1 font-semibold">
          <span className="col-span-6">ITEM</span>
          <span className="col-span-2 text-center">QTY</span>
          <span className="col-span-4 text-right">PRICE</span>
        </div>
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-12 gap-1">
            <span className="col-span-6 truncate">{item.product?.name || item.product_name || '-'}</span>
            <span className="col-span-2 text-center">{item.qty}</span>
            <span className="col-span-4 text-right">{formatCurrency(item.price * item.qty)}</span>
          </div>
        ))}
      </div>

      <div className="border-b-2 border-dashed border-slate-300 pb-3 mb-3">
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAL</span>
          <span>{formatCurrency(transaction.total)}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>PAYMENT: {paymentMethodLabel[transaction.payment_method as keyof typeof paymentMethodLabel] || transaction.payment_method.toUpperCase()}</span>
        </div>
      </div>

      <div className="text-center">
        <p className="font-semibold">Terima Kasih</p>
      </div>
    </div>
  );
}

// Hidden component for printing
export function ReceiptPrint({ transaction, items, cashierName }: ReceiptProps) {
  return (
    <div className="hidden print:block">
      <Receipt transaction={transaction} items={items} cashierName={cashierName} />
      <style>{`
        @media print {
          @page {
            margin: 0;
          }
          body * {
            visibility: hidden;
          }
          .print\\:block, .print\\:block * {
            visibility: visible;
          }
          .print\\:block {
            position: absolute;
            left: 0;
            top: 0;
          }
        }
      `}</style>
    </div>
  );
}