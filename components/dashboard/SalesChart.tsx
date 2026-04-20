'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

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
    <div className="bg-surface-container-lowest rounded-2xl p-6 ambient-shadow">
      <h3 className="font-headline text-base font-semibold text-on-surface mb-6">
        {title}
      </h3>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: '4rem 1fr', height: '160px', marginBottom: '0.5rem' }}
      >
        {/* Y-axis */}
        <div className="flex flex-col justify-between h-full pb-10">
          <span className="font-label text-xs text-outline text-right">
            {formatCurrency(maxValue)}
          </span>
          <span className="font-label text-xs text-outline text-right">
            {formatCurrency(midValue)}
          </span>
          <span className="font-label text-xs text-outline text-right">Rp 0</span>
        </div>

        {/* Bars */}
        <div
          className="relative flex items-end justify-between gap-2 h-full pb-10"
        >
          {/* Grid lines */}
          <div className="absolute top-0 left-0 right-0 h-px bg-outline-variant" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-outline-variant opacity-50" />
          <div className="absolute bottom-10 left-0 right-0 h-px bg-outline-variant opacity-30" />

          {data.map((item, index) => {
            const height = (item.value / maxValue) * 100;
            return (
              <div
                key={index}
                className="flex-1 flex flex-col items-center h-full relative group"
              >
                {item.value > 0 && (
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-2 py-1 rounded-lg font-label text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {formatCurrency(item.value)}
                  </span>
                )}
                <div
                  className="w-full bg-gradient-to-t from-primary to-primary-container rounded-t-md transition-all duration-400 cursor-pointer hover:opacity-80"
                  style={{ height: `${height}%`, minHeight: item.value > 0 ? '4px' : '0' }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between pl-16 gap-2">
        {data.map((item, index) => (
          <span
            key={index}
            className="flex-1 text-center font-label text-xs text-outline"
          >
            {formatDay(item.date)}
          </span>
        ))}
      </div>
    </div>
  );
}
