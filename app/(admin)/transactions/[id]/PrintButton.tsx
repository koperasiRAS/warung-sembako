'use client';

import { Printer } from 'lucide-react';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        padding: 'var(--space-2) var(--space-4)',
        background: 'var(--gradient-primary)',
        color: 'var(--color-on-primary)',
        border: 'none', borderRadius: 'var(--radius-lg)',
        fontFamily: 'var(--font-label)', fontWeight: '600',
        fontSize: 'var(--text-body-sm)',
        cursor: 'pointer',
        transition: 'opacity var(--transition-fast)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
    >
      <Printer style={{ width: '1.25rem', height: '1.25rem' }} />
      Cetak
    </button>
  );
}
