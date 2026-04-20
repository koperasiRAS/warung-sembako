import { Product } from '@/types';

export interface ProductGridProps {
  products: Product[];
  onProductClick: (product: Product) => void;
  isLoading?: boolean;
}

export function ProductGrid({ products, onProductClick, isLoading }: ProductGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {[...Array(10)].map((_, i) => (
          <div key={i} style={{ aspectRatio: '1', backgroundColor: 'var(--color-surface-container)', borderRadius: 'var(--radius-lg)' }} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 'var(--space-12)', color: 'var(--color-outline)' }}>
        <svg style={{ width: '3rem', height: '3rem', marginBottom: 'var(--space-3)', color: 'var(--color-outline-variant)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-outline)' }}>No products found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      {products.map((product) => (
        <button
          key={product.id}
          onClick={() => onProductClick(product)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-surface-container-lowest)',
            border: '1px solid var(--color-outline-variant)',
            borderRadius: 'var(--radius-lg)',
            cursor: 'pointer',
            transition: 'all var(--transition-base)',
            borderColor: 'transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-tertiary)';
            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            e.currentTarget.style.transform = 'scale(0.98)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-outline-variant)';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)'; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
        >
          <div style={{ width: '100%', aspectRatio: '1', backgroundColor: 'var(--color-surface-container)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 'var(--space-2)', flexShrink: '0' }}>
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-outline)' }}>
                <svg style={{ width: '2rem', height: '2rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            )}
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '600', color: 'var(--color-on-surface)', textAlign: 'center', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', width: '100%' }}>
            {product.name}
          </p>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-body-sm)', fontWeight: '700', color: 'var(--color-tertiary)', marginTop: 'var(--space-1)' }}>
            Rp {Number(product.price).toLocaleString('id-ID')}
          </p>
        </button>
      ))}
    </div>
  );
}