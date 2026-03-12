// Thermal Receipt Component
// 58mm width for thermal printers

interface TransactionItem {
  product?: { name: string };
  qty: number;
  price: number;
}

interface ReceiptProps {
  transaction: {
    id: string;
    created_at: string;
    total: number;
    payment_method: string;
    cashier?: { full_name: string | null };
    items?: TransactionItem[];
  };
  cashReceived?: number;
  change?: number;
  storeName?: string;
  storeAddress?: string;
}

export function ThermalReceipt({
  transaction,
  cashReceived = 0,
  change = 0,
  storeName = 'WARUNG SEMBAKO BY RAS',
  storeAddress = 'Jl. Contoh No. 123',
}: ReceiptProps) {
  const formatCurrency = (amount: number) => {
    return Math.round(amount).toLocaleString('id-ID');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const paymentLabels: Record<string, string> = {
    cash: 'CASH',
    qris: 'QRIS',
    transfer: 'TRANSFER',
  };

  return (
    <div className="receipt-container" style={receiptStyles.container}>
      {/* Header */}
      <div style={receiptStyles.header}>
        <h2 style={receiptStyles.storeName}>{storeName}</h2>
        <p style={receiptStyles.storeAddress}>{storeAddress}</p>
      </div>

      <div style={receiptStyles.divider} />

      {/* Transaction Info */}
      <div style={receiptStyles.info}>
        <div style={receiptStyles.infoRow}>
          <span>DATE:</span>
          <span>{formatDate(transaction.created_at)}</span>
        </div>
        <div style={receiptStyles.infoRow}>
          <span>TRX:</span>
          <span style={receiptStyles.mono}>{transaction.id.slice(0, 12)}</span>
        </div>
        <div style={receiptStyles.infoRow}>
          <span>CASHIER:</span>
          <span>{transaction.cashier?.full_name || 'Kasir'}</span>
        </div>
      </div>

      <div style={receiptStyles.divider} />

      {/* Items Header */}
      <div style={receiptStyles.itemsHeader}>
        <span style={{ flex: 3 }}>ITEM</span>
        <span style={{ flex: 1, textAlign: 'center' }}>QTY</span>
        <span style={{ flex: 1, textAlign: 'right' }}>PRICE</span>
      </div>

      <div style={receiptStyles.divider} />

      {/* Items */}
      <div style={receiptStyles.items}>
        {transaction.items?.map((item, index) => (
          <div key={index} style={receiptStyles.itemRow}>
            <span style={{ flex: 3, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.product?.name || 'Produk'}
            </span>
            <span style={{ flex: 1, textAlign: 'center' }}>{item.qty}</span>
            <span style={{ flex: 1, textAlign: 'right' }}>
              {formatCurrency(item.price * item.qty)}
            </span>
          </div>
        ))}
      </div>

      <div style={receiptStyles.divider} />

      {/* Total */}
      <div style={receiptStyles.totalRow}>
        <span style={receiptStyles.totalLabel}>TOTAL</span>
        <span style={receiptStyles.totalValue}>
          {formatCurrency(transaction.total)}
        </span>
      </div>

      {/* Payment Details */}
      <div style={receiptStyles.paymentInfo}>
        <div style={receiptStyles.infoRow}>
          <span>PAYMENT:</span>
          <span>{paymentLabels[transaction.payment_method] || transaction.payment_method.toUpperCase()}</span>
        </div>
        {transaction.payment_method === 'cash' && (
          <>
            <div style={receiptStyles.infoRow}>
              <span>CASH:</span>
              <span>{formatCurrency(cashReceived)}</span>
            </div>
            <div style={receiptStyles.infoRow}>
              <span>CHANGE:</span>
              <span>{formatCurrency(change)}</span>
            </div>
          </>
        )}
      </div>

      <div style={receiptStyles.divider} />

      {/* Footer */}
      <div style={receiptStyles.footer}>
        <p>Terima Kasih</p>
        <p style={receiptStyles.footerSub}>Silahkan datang lagi</p>
      </div>

      <div style={receiptStyles.divider} />
    </div>
  );
}

// Receipt print styles - invisible until print
export function ThermalReceiptPrint(props: ReceiptProps) {
  return (
    <>
      <style>{printStyles}</style>
      <div className="print-only">
        <ThermalReceipt {...props} />
      </div>
    </>
  );
}

const receiptStyles = {
  container: {
    width: '58mm',
    padding: '4px',
    fontFamily: '"Courier New", monospace',
    fontSize: '10px',
    lineHeight: '1.2',
    color: '#000',
    backgroundColor: '#fff',
  },
  header: {
    textAlign: 'center' as const,
    paddingBottom: '4px',
  },
  storeName: {
    fontSize: '12px',
    fontWeight: 'bold' as const,
    margin: 0,
    padding: 0,
  },
  storeAddress: {
    fontSize: '9px',
    margin: '2px 0 0 0',
  },
  divider: {
    borderBottom: '1px dashed #000',
    margin: '4px 0',
  },
  info: {
    fontSize: '9px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '2px',
  },
  mono: {
    fontFamily: 'monospace',
  },
  itemsHeader: {
    display: 'flex',
    fontSize: '9px',
    fontWeight: 'bold' as const,
    marginBottom: '2px',
  },
  items: {
    fontSize: '9px',
  },
  itemRow: {
    display: 'flex',
    marginBottom: '1px',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontWeight: 'bold' as const,
    fontSize: '11px',
    marginTop: '4px',
  },
  totalLabel: {
    fontSize: '11px',
  },
  totalValue: {
    fontSize: '11px',
  },
  paymentInfo: {
    fontSize: '9px',
    marginTop: '4px',
  },
  footer: {
    textAlign: 'center' as const,
    fontSize: '10px',
    fontWeight: 'bold' as const,
    paddingTop: '4px',
  },
  footerSub: {
    fontSize: '8px',
    fontWeight: 'normal' as const,
    marginTop: '2px',
  },
};

const printStyles = `
  @media print {
    @page {
      size: 58mm auto;
      margin: 0;
    }

    body {
      margin: 0;
      padding: 0;
    }

    .print-only {
      display: block !important;
      width: 58mm;
      position: absolute;
      top: 0;
      left: 0;
    }

    .print-only * {
      visibility: visible;
    }

    /* Hide everything else */
    body > *:not(.print-only) {
      display: none !important;
    }

    /* Remove background colors when printing */
    .print-only {
      background: white !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }

  /* Hide by default */
  .print-only {
    display: none;
  }
`;