'use client';

import { ToastProvider } from './ToastProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ToastProvider />
      {children}
    </>
  );
}
