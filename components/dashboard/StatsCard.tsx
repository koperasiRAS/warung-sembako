import { cn } from '@/lib/utils';

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
  default: 'text-on-surface',
  success: 'text-tertiary',
  warning: 'text-warning',
  error: 'text-error',
};

export function StatsCard({ title, value, subtitle, icon, trend, variant = 'default' }: StatsCardProps) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-6 flex flex-col justify-between ambient-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[13px] font-medium font-label text-on-surface-variant uppercase tracking-wide">
            {title}
          </p>
          <p className={cn(
            'mt-1 font-headline text-2xl font-bold tracking-tight',
            variantValueColors[variant]
          )}>
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 font-body text-sm text-outline">{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              'mt-2 flex items-center font-label text-sm',
              trend.isPositive ? 'text-tertiary' : 'text-error'
            )}>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={cn('mr-1', !trend.isPositive && 'rotate-180')}
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-surface-container rounded-2xl">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}