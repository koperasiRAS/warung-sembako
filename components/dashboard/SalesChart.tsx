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

export function SalesChart({ data, title = 'Sales Trend' }: SalesChartProps) {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <Card>
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      <div className="h-40 flex items-end justify-between gap-2">
        {data.map((item, index) => {
          const height = (item.value / maxValue) * 100;
          const date = new Date(item.date);
          const day = date.getDate();

          return (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div
                className="w-full bg-teal-500 rounded-t hover:bg-teal-600 transition-colors cursor-pointer relative group"
                style={{ height: `${height}%`, minHeight: item.value > 0 ? '4px' : '0' }}
              >
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  Rp {item.value.toLocaleString('id-ID')}
                </div>
              </div>
              <span className="text-xs text-slate-500 mt-2">{day}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}