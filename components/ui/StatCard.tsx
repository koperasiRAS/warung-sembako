'use client';

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  trend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
    label?: string;
  };
  icon?: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  variant?: 'default' | 'alert';
  className?: string;
}

export default function StatCard({
  label,
  value,
  trend,
  icon: Icon,
  iconBg = 'bg-primary-fixed',
  iconColor = 'text-primary',
  variant = 'default',
  className,
}: StatCardProps) {
  const TrendIcon =
    trend?.direction === 'up'
      ? TrendingUp
      : trend?.direction === 'down'
      ? TrendingDown
      : Minus;

  const trendColor =
    trend?.direction === 'up'
      ? 'text-primary'
      : trend?.direction === 'down'
      ? 'text-error'
      : 'text-on-surface-variant';

  if (variant === 'alert') {
    return (
      <div
        className={cn(
          'bg-error-container rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden',
          'ambient-shadow',
          className
        )}
      >
        {/* Decorative bg element */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-error/10 rounded-full blur-xl" />

        <div className="flex justify-between items-start relative z-10">
          <span className="text-[13px] font-medium font-body text-on-error-container">{label}</span>
          {Icon && (
            <div className="p-2 bg-white/50 rounded-full text-error">
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>

        <div className="relative z-10">
          <h3 className="text-3xl font-extrabold font-headline text-on-error-container mb-1">{value}</h3>
          {trend && (
            <p className="text-sm font-medium flex items-center gap-1 font-body text-error">
              <TrendIcon className={cn('w-4 h-4', trendColor)} />
              {trend.value}
              {trend.label && <span className="text-on-error-container/80">{trend.label}</span>}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-surface-container-lowest rounded-2xl p-6 flex flex-col justify-between',
        'relative overflow-hidden group ambient-shadow',
        className
      )}
    >
      {/* Ambient glow on hover */}
      <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:scale-110 transition-transform" />

      <div className="flex justify-between items-start mb-4 relative z-10">
        <span className="text-[13px] font-medium font-body text-on-surface-variant">{label}</span>
        {Icon && (
          <div className={cn('p-2 rounded-full', iconBg)}>
            <Icon className={cn('w-4 h-4', iconColor)} />
          </div>
        )}
      </div>

      <div className="relative z-10">
        <h3 className="text-3xl font-extrabold font-headline text-on-surface mb-1">{value}</h3>
        {trend && (
          <p className={cn('text-sm font-medium flex items-center gap-1 font-body', trendColor)}>
            <TrendIcon className="w-4 h-4" />
            {trend.value}
            {trend.label && <span className="text-on-surface-variant">{trend.label}</span>}
          </p>
        )}
      </div>
    </div>
  );
}
