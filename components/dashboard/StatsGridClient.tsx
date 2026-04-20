'use client';

import StatCard from '@/components/ui/StatCard';
import { Banknote, CreditCard, TrendingUp, Wallet } from 'lucide-react';

interface Stats {
  todaySales: number;
  todayTransactions: number;
  todayGrossProfit: number;
  todayExpenses: number;
  todayNetProfit: number;
  cashBalance: number;
  bankBalance: number;
  totalWarungBalance: number;
  totalPiutang: number;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(amount);
}

export function StatsGridClient({ s }: { s: Stats }) {
  return (
    <>
      {/* Row 1 — 4 cards */}
      <StatCard label="Omset Hari Ini" value={formatCurrency(s.todaySales)} />
      <StatCard label="Transaksi" value={s.todayTransactions.toString()} />
      <StatCard
        label="Saldo Tunai"
        value={formatCurrency(s.cashBalance)}
        icon={Banknote}
        iconBg="bg-primary-fixed"
        iconColor="text-primary"
      />
      <StatCard
        label="Saldo Bank"
        value={formatCurrency(s.bankBalance)}
        icon={CreditCard}
        iconBg="bg-primary-fixed"
        iconColor="text-primary"
      />

      {/* Row 2 — Total Warung (full-width gradient) */}
      <div
        className="col-span-2 bg-gradient-to-br from-primary to-primary-container rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden ambient-shadow"
        style={{ gridColumn: 'span 2' }}
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-xl" />
        <p className="text-[13px] font-medium font-body text-white/70">Total Saldo Warung</p>
        <div className="relative z-10">
          <h3 className="text-3xl font-extrabold font-headline text-white mb-1">
            {formatCurrency(s.totalWarungBalance)}
          </h3>
          <p className="text-sm font-medium font-body text-white/60">Kas + Bank</p>
        </div>
      </div>

      {/* Laba Kotor */}
      <StatCard
        label="Laba Kotor"
        value={formatCurrency(s.todayGrossProfit)}
        icon={TrendingUp}
        iconBg="bg-tertiary/10"
        iconColor="text-tertiary"
      />

      {/* Pengeluaran */}
      <StatCard
        label="Pengeluaran"
        value={formatCurrency(s.todayExpenses)}
        icon={Wallet}
        iconBg="bg-error-container"
        iconColor="text-error"
        variant="alert"
      />

      {/* Row 3 — Laba Bersih + Piutang */}
      <div
        className="col-span-2 bg-surface-container rounded-2xl p-6 flex flex-col justify-between ambient-shadow"
        style={{ gridColumn: 'span 2' }}
      >
        <p className="text-[13px] font-medium font-body text-on-surface-variant">Laba Bersih</p>
        <h3 className="text-3xl font-extrabold font-headline text-on-surface mb-1">
          {formatCurrency(s.todayNetProfit)}
        </h3>
        <p className="text-sm font-medium font-body text-outline">Laba Kotor − Pengeluaran</p>
      </div>

      <div
        className="col-span-2 bg-surface-container rounded-2xl p-6 flex flex-col justify-between ambient-shadow"
        style={{ gridColumn: 'span 2' }}
      >
        <p className="text-[13px] font-medium font-body text-on-surface-variant">Piutang</p>
        <h3 className="text-3xl font-extrabold font-headline text-on-surface mb-1">
          {formatCurrency(s.totalPiutang)}
        </h3>
        <p className="text-sm font-medium font-body text-outline">Kasbon pelanggan belum lunas</p>
      </div>
    </>
  );
}