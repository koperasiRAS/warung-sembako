'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  Archive,
  Tags,
  Receipt,
  BookUser,
  Wallet,
  TrendingUp,
  Users,
  ShoppingCart,
  Settings,
  LogOut,
  Menu,
  X,
  Store,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: ('owner' | 'cashier')[];
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner', 'cashier'] },
  { href: '/products', label: 'Products', icon: Package, roles: ['owner'] },
  { href: '/inventory', label: 'Restock', icon: Archive, roles: ['owner', 'cashier'] },
  { href: '/categories', label: 'Categories', icon: Tags, roles: ['owner'] },
  { href: '/transactions', label: 'Transactions', icon: Receipt, roles: ['owner', 'cashier'] },
  { href: '/debts', label: 'Debt Book', icon: BookUser, roles: ['owner', 'cashier'] },
  { href: '/expenses', label: 'Expenses', icon: Wallet, roles: ['owner'] },
  { href: '/reports', label: 'Reports', icon: TrendingUp, roles: ['owner', 'cashier'] },
  { href: '/cashiers', label: 'Cashiers', icon: Users, roles: ['owner'] },
  { href: '/pos', label: 'POS', icon: ShoppingCart, roles: ['owner', 'cashier'] },
];

interface SidebarProps {
  role?: 'owner' | 'cashier';
}

export default function Sidebar({ role = 'owner' }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const supabase = createClient();

  // Realtime clock — Jakarta timezone
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

  // Dashboard realtime refresh
  useEffect(() => {
    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => { router.refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => { router.refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_balances' }, () => { router.refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'debts' }, () => { router.refresh(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'expenses' }, () => { router.refresh(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/pin');
  };

  const filteredNav = navItems.filter(item => item.roles.includes(role));

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className={cn(
          "fixed top-4 left-4 z-[60] p-2 rounded-2xl bg-surface-container-lowest shadow-ambient",
          "flex lg:hidden items-center justify-center cursor-pointer border-none",
          "text-on-surface transition-colors hover:bg-surface-container-low"
        )}
      >
        {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-[55] lg:hidden cursor-default border-none"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          x: mobileOpen ? 0 : 0,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          "fixed left-0 top-0 h-full w-64 flex flex-col z-[50]",
          "bg-surface-container-low border-r-none",
          "hidden md:flex",
          // Mobile: slide in/out
          "lg:translate-x-0"
        )}
      >
        {/* Logo + Clock */}
        <div className="px-6 py-8 flex flex-col items-center gap-2 border-b border-outline-variant/15">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shadow-lg">
            <Store className="w-6 h-6 text-on-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-black text-on-surface font-headline tracking-tight leading-tight">
              Warung Sembako
            </h1>
            <p className="text-xs text-secondary font-label mt-0.5">Efficient Atelier</p>
          </div>
          {currentTime && (
            <p className="text-center text-[10px] text-outline font-mono leading-relaxed mt-1">
              {currentTime}
            </p>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-full",
                  "font-headline text-sm font-medium transition-all duration-200",
                  "scale-[0.98] active:scale-[0.95]",
                  isActive
                    ? "bg-surface-container-lowest text-primary font-bold shadow-[0px_2px_8px_rgba(13,12,34,0.04)]"
                    : "text-secondary hover:text-on-surface hover:bg-surface-container-lowest/50"
                )}
              >
                <Icon
                  className={cn(
                    "w-[20px] h-[20px]",
                    isActive ? "fill-primary" : ""
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-outline-variant/15 px-3 py-4 mt-auto">
          <Link
            href="#"
            className="flex items-center gap-3 px-4 py-3 rounded-full text-secondary hover:text-on-surface hover:bg-surface-container-lowest/50 font-headline text-sm font-medium transition-all duration-200 scale-[0.98] active:scale-[0.95]"
          >
            <Settings className="w-[20px] h-[20px]" />
            <span>Settings</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-full text-red-500 hover:bg-error-container/30 font-headline text-sm font-medium transition-all duration-200 scale-[0.98] active:scale-[0.95] cursor-pointer border-none"
          >
            <LogOut className="w-[20px] h-[20px]" />
            <span>Logout</span>
          </button>
        </div>
      </motion.aside>
    </>
  );
}