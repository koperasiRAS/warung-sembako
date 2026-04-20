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
  { href: '/reports', label: 'Laporan', icon: TrendingUp, roles: ['owner', 'cashier'] },
  { href: '/cashiers', label: 'Manajemen Kasir', icon: Users, roles: ['owner'] },
];

export default function Sidebar({ role = 'owner' }: { role?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const supabase = createClient();

  // Real-time clock — Jakarta timezone, updates every second
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const jakarta = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
      const dateStr = jakarta.toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
      const timeStr = jakarta.toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
      setCurrentTime(`${dateStr} • ${timeStr}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

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
        { event: '*', schema: 'public', table: 'categories' },
        () => { router.refresh(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/pin');
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{
          display: 'none',
          position: 'fixed',
          top: 'var(--space-4)',
          left: 'var(--space-4)',
          zIndex: 'var(--z-sticky)',
          padding: 'var(--space-2)',
          backgroundColor: 'var(--color-surface-container-lowest)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          border: 'none',
          cursor: 'pointer',
        }}
        className="lg:hidden"
      >
        {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Backdrop */}
      {mobileOpen && (
        <button
          style={{
            display: 'none',
            position: 'fixed',
            inset: '0',
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 'var(--z-raised)',
            cursor: 'default',
            border: 'none',
          }}
          className="lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          position: 'fixed',
          top: '0',
          left: '0',
          height: '100dvh',
          width: '16rem',
          backgroundColor: 'var(--color-surface-container-lowest)',
          borderRight: '1px solid var(--color-outline-variant)',
          zIndex: 'var(--z-sticky)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        className={`
          transform transition-transform duration-150 ease-out
          lg:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Logo + Clock */}
          <div style={{
            padding: 'var(--space-6)',
            borderBottom: '1px solid var(--color-outline-variant)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
          }}>
            <img
              src="/logo-ras.png"
              alt="Warung Sembako by RAS"
              style={{ height: '3.5rem', width: 'auto', objectFit: 'contain' }}
            />
            {currentTime && (
              <p style={{
                textAlign: 'center',
                fontSize: 'var(--text-label-sm)',
                color: 'var(--color-outline)',
                fontFamily: 'var(--font-mono)',
                lineHeight: 'var(--leading-relaxed)',
                marginTop: 'var(--space-2)',
              }}>
                {currentTime}
              </p>
            )}
          </div>

          {/* Navigation */}
          <nav style={{
            flex: '1',
            overflowY: 'auto',
            padding: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)',
            paddingBottom: '6rem',
          }}>
            {navItems
              .filter(item => item.roles.includes(role))
              .map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-lg)',
                    transition: 'all var(--transition-base)',
                    backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                    color: isActive ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: '500',
                    fontSize: 'var(--text-body-md)',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'var(--color-surface-container)';
                      e.currentTarget.style.transform = 'scale(0.98)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.transform = 'scale(1)';
                    }
                  }}
                  prefetch={true}
                >
                  <item.icon style={{ width: '1.25rem', height: '1.25rem' }} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout - fixed at bottom */}
          <div style={{
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            padding: 'var(--space-4)',
            borderTop: '1px solid var(--color-outline-variant)',
            backgroundColor: 'var(--color-surface-container-lowest)',
          }}>
            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                width: '100%',
                color: 'var(--color-error)',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontWeight: '500',
                fontSize: 'var(--text-body-md)',
                transition: 'all var(--transition-base)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-error-container)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <LogOut style={{ width: '1.25rem', height: '1.25rem' }} />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
