'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Tags,
  Receipt,
  Wallet,
  LogOut,
  Menu,
  X,
  Archive,
  TrendingUp,
  ShoppingCart,
  Users,
  Clock,
  BookUser,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/pos', label: 'Kasir (POS)', icon: ShoppingCart, roles: ['owner', 'cashier'] },
  { href: '/dashboard', label: 'Beranda Admin', icon: LayoutDashboard, roles: ['owner', 'cashier'] },
  { href: '/products', label: 'Produk', icon: Package, roles: ['owner'] },
  { href: '/inventory', label: 'Restock / Gudang', icon: Archive, roles: ['owner', 'cashier'] },
  { href: '/categories', label: 'Kategori', icon: Tags, roles: ['owner'] },
  { href: '/transactions', label: 'Transaksi', icon: Receipt, roles: ['owner', 'cashier'] },
  { href: '/debts', label: 'Buku Utang', icon: BookUser, roles: ['owner', 'cashier'] },
  { href: '/expenses', label: 'Pengeluaran', icon: Wallet, roles: ['owner'] },
  { href: '/shifts', label: 'Laporan Shift', icon: Clock, roles: ['owner'] },
  { href: '/reports', label: 'Laporan', icon: TrendingUp, roles: ['owner', 'cashier'] },
  { href: '/cashiers', label: 'Manajemen Kasir', icon: Users, roles: ['owner'] },
];

export default function Sidebar({ role = 'owner' }: { role?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const supabase = createClient();

  // Realtime dashboard refresh — subscribe to database changes and trigger router.refresh()
  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions' },
        () => { router.refresh(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => { router.refresh(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_balances' },
        () => { router.refresh(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'debts' },
        () => { router.refresh(); }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'expenses' },
        () => { router.refresh(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts' },
        () => { router.refresh(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
      >
        {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Backdrop */}
      {mobileOpen && (
        <button
          className="lg:hidden fixed inset-0 bg-black/50 z-40 cursor-default"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-[100dvh] w-64 bg-white border-r border-slate-200 z-50
          transform transition-transform duration-150 ease-out
          lg:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-center">
            <img
              src="/logo-ras.png"
              alt="Warung Sembako by RAS"
              className="h-14 sm:h-16 w-auto object-contain"
            />
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1 pb-24">
            {navItems
              .filter(item => item.roles.includes(role))
              .map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-150
                    ${isActive
                      ? 'bg-primary text-white'
                      : 'text-slate-600 hover:bg-slate-100 active:scale-[0.98]'
                    }
                  `}
                  prefetch={true}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout - fixed at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100 bg-white">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 w-full text-red-600 hover:bg-red-50 rounded-lg transition active:scale-[0.98]"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Keluar</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
