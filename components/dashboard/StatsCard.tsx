import { Card } from '@/components/ui';

export interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'error';
}

const variantValueColors = {
  default: 'var(--color-on-surface)',
  success: 'var(--color-tertiary)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)',
};

export function StatsCard({ title, value, subtitle, icon, trend, variant = 'default' }: StatsCardProps) {
  return (
    <Card style={{
      backgroundColor: 'var(--color-surface-container-lowest)',
      borderRadius: 'var(--radius-xl)',
      padding: '1.5rem',
      boxShadow: 'var(--shadow-sm)',
      border: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <p style={{
            fontFamily: 'var(--font-label)',
            fontSize: 'var(--text-label-md)',
            color: 'var(--color-on-surface-variant)',
            letterSpacing: 'var(--tracking-wide)',
            textTransform: 'uppercase',
          }}>
            {title}
          </p>
          <p style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'var(--text-headline-md)',
            fontWeight: '700',
            color: variantValueColors[variant],
            marginTop: '0.25rem',
            letterSpacing: 'var(--tracking-tight)',
          }}>
            {value}
          </p>
          {subtitle && (
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-body-sm)',
              color: 'var(--color-outline)',
              marginTop: '0.25rem',
            }}>
              {subtitle}
            </p>
          )}
          {trend && (
            <div style={{
              display: 'flex', alignItems: 'center', marginTop: '0.5rem',
              color: trend.isPositive ? 'var(--color-tertiary)' : 'var(--color-error)',
              fontFamily: 'var(--font-label)',
              fontSize: 'var(--text-label-sm)',
            }}>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: trend.isPositive ? 'rotate(0deg)' : 'rotate(180deg)', marginRight: '4px' }}
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
        {icon && (
          <div style={{
            padding: '0.75rem',
            backgroundColor: 'var(--color-surface-container)',
            borderRadius: 'var(--radius-lg)',
          }}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
