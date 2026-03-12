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
  storeAddress = 'Jl. Boulevard Grand Depok City',
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
    width: '100%',
    padding: '0',
    fontFamily: 'Arial, Helvetica, sans-serif',
    WebkitFontSmoothing: 'none',
    color: '#000',
    backgroundColor: '#fff',
  },
  header: {
    textAlign: 'center' as const,
    paddingBottom: '4px',
  },
  storeName: {
    fontSize: '16px',
    fontWeight: 'bold' as const,
    margin: 0,
    padding: 0,
    color: '#000',
  },
  storeAddress: {
    fontSize: '12px',
    fontWeight: 'bold' as const,
    margin: '2px 0 0 0',
    color: '#000',
  },
  divider: {
    borderBottom: '2px dashed #000',
    margin: '4px 0',
  },
  info: {
    fontSize: '12px',
    fontWeight: 'bold' as const,
    color: '#000',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '2px',
  },
  mono: {
    fontFamily: 'Arial, Helvetica, sans-serif',
  },
  itemsHeader: {
    display: 'flex',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    marginBottom: '2px',
    color: '#000',
  },
  items: {
    fontSize: '12px',
    fontWeight: 'bold' as const,
    color: '#000',
  },
  itemRow: {
    display: 'flex',
    marginBottom: '1px',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontWeight: 'bold' as const,
    fontSize: '15px',
    marginTop: '4px',
    color: '#000',
  },
  totalLabel: {
    fontSize: '15px',
  },
  totalValue: {
    fontSize: '15px',
  },
  paymentInfo: {
    fontSize: '12px',
    fontWeight: 'bold' as const,
    marginTop: '4px',
    color: '#000',
  },
  footer: {
    textAlign: 'center' as const,
    fontSize: '14px',
    fontWeight: 'bold' as const,
    paddingTop: '4px',
    color: '#000',
  },
  footerSub: {
    fontSize: '12px',
    fontWeight: 'bold' as const,
    marginTop: '2px',
    color: '#000',
  },
};

const printStyles = `
  @media print {
    @page {
      margin: 0;
    }

    body {
      margin: 0;
      padding: 0;
      background: #fff;
    }

    .print-only {
      display: block !important;
      width: 100%;
      margin: 0;
      padding: 2mm;
      box-sizing: border-box;
    }

    .print-only * {
      visibility: visible;
      color: #000 !important;
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