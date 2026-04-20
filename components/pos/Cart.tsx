import { CartItem } from '@/types';
import { Button } from '@/components/ui';

export interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
}

export function Cart({ items, onUpdateQuantity, onRemoveItem, onClearCart }: CartProps) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (items.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-outline)', paddingTop: 'var(--space-8)' }}>
        <svg style={{ width: '4rem', height: '4rem', marginBottom: 'var(--space-3)', color: 'var(--color-outline-variant)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-outline)' }}>Cart is empty</p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-outline)', marginTop: 'var(--space-1)' }}>Tap products to add</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--color-outline-variant)' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: '600', color: 'var(--color-on-surface)' }}>Cart ({items.length})</h3>
        <Button variant="ghost" size="sm" onClick={onClearCart}>Clear</Button>
      </div>

      <div style={{ flex: '1', overflowY: 'auto', paddingTop: 'var(--space-3)', paddingBottom: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {items.map((item) => (
          <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2)', backgroundColor: 'var(--color-surface-container)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ flex: '1', minWidth: '0' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '600', color: 'var(--color-on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.product_name}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-outline)' }}>
                Rp {Number(item.price).toLocaleString('id-ID')}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <button onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)} style={{ width: '1.75rem', height: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)', border: 'none', cursor: 'pointer', transition: 'background-color var(--transition-fast)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-outline-variant)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
              >
                -
              </button>
              <span style={{ width: '2rem', textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '600', color: 'var(--color-on-surface)' }}>
                {item.quantity}
              </span>
              <button onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)} style={{ width: '1.75rem', height: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)', border: 'none', cursor: 'pointer', transition: 'background-color var(--transition-fast)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-outline-variant)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
              >
                +
              </button>
            </div>

            <button onClick={() => onRemoveItem(item.product_id)} style={{ padding: 'var(--space-1)', color: 'var(--color-outline)', backgroundColor: 'transparent', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all var(--transition-fast)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-error)'; e.currentTarget.style.backgroundColor = 'var(--color-error-container)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-outline)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <svg style={{ width: '1rem', height: '1rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-outline-variant)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)', fontWeight: '600', color: 'var(--color-on-surface)' }}>Total</span>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)', fontWeight: '700', color: 'var(--color-tertiary)' }}>
            Rp {total.toLocaleString('id-ID')}
          </span>
        </div>
      </div>
    </div>
  );
}