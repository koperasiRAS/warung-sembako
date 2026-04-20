'use client';

import { Card } from '@/components/ui';

export interface SalesData {
  date: string;
  value: number;
}

export interface SalesChartProps {
  data: SalesData[];
  title?: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(amount);
}

function formatDay(date: string) {
  return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export function SalesChart({ data, title = 'Grafik Penjualan' }: SalesChartProps) {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const midValue = Math.round(maxValue / 2);

  return (
    <div style={{
      backgroundColor: 'var(--color-surface-container-lowest)',
      borderRadius: 'var(--radius-xl)',
      padding: '1.5rem',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <h3 style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 'var(--text-title-md)',
        fontWeight: '600',
        color: 'var(--color-on-surface)',
        marginBottom: '1.5rem',
      }}>
        {title}
      </h3>

      {/* Y-axis labels */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '4rem 1fr',
        alignItems: 'flex-end',
        gap: '0.5rem',
        height: '160px',
        marginBottom: '0.5rem',
      }}>
        {/* Y-axis */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', paddingBottom: '1.5rem' }}>
          <span style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-outline)', textAlign: 'right' }}>
            {formatCurrency(maxValue)}
          </span>
          <span style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-outline)', textAlign: 'right' }}>
            {formatCurrency(midValue)}
          </span>
          <span style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-outline)', textAlign: 'right' }}>
            Rp 0
          </span>
        </div>

        {/* Bars */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.5rem', height: '100%', paddingBottom: '1.5rem', position: 'relative' }}>
          {/* Grid line at top */}
          <div style={{ position: 'absolute', top: '0', left: '0', right: '0', height: '1px', backgroundColor: 'var(--color-outline-variant)' }} />
          {/* Grid line at mid */}
          <div style={{ position: 'absolute', top: '50%', left: '0', right: '0', height: '1px', backgroundColor: 'var(--color-outline-variant)', opacity: '0.5' }} />
          {/* Grid line at bottom */}
          <div style={{ position: 'absolute', bottom: '1.5rem', left: '0', right: '0', height: '1px', backgroundColor: 'var(--color-outline-variant)', opacity: '0.3' }} />

          {data.map((item, index) => {
            const height = (item.value / maxValue) * 100;
            return (
              <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', position: 'relative' }}>
                {/* Tooltip */}
                {item.value > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--font-label)',
                    fontSize: 'var(--text-label-sm)',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    opacity: '0',
                    transition: 'opacity 150ms ease',
                    cursor: 'default',
                    zIndex: 10,
                  }} className={`chart-tooltip-${index}`}>
                    {formatCurrency(item.value)}
                  </div>
                )}
                {/* Bar */}
                <div
                  style={{
                    width: '100%',
                    height: `${height}%`,
                    minHeight: item.value > 0 ? '4px' : '0',
                    background: 'linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary-container) 100%)',
                    borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                    marginTop: 'auto',
                    transition: 'height 400ms ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    const tip = document.querySelector(`.chart-tooltip-${index}`) as HTMLElement;
                    if (tip) tip.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    const tip = document.querySelector(`.chart-tooltip-${index}`) as HTMLElement;
                    if (tip) tip.style.opacity = '0';
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* X-axis labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '4rem', gap: '0.5rem' }}>
        {data.map((item, index) => (
          <span key={index} style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: 'var(--font-label)',
            fontSize: 'var(--text-label-sm)',
            color: 'var(--color-outline)',
          }}>
            {formatDay(item.date)}
          </span>
        ))}
      </div>
    </div>
  );
}