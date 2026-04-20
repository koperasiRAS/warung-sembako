'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PinPad } from '@/components/PinPad';

export default function PinLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handlePinComplete(pin: string) {
    if (loading) return;
    setLoading(true);
    setError(false);

    try {
      const res = await fetch('/api/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      if (!res.ok) {
        setError(true);
        setTimeout(() => setError(false), 1000);
        return;
      }

      router.push('/pos');
      router.refresh();
    } catch {
      setError(true);
      setTimeout(() => setError(false), 1000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-background)',
        gap: 'var(--space-8)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'var(--text-title-lg)',
          fontWeight: '600',
          color: 'var(--color-on-background)',
          letterSpacing: 'var(--tracking-tight)',
        }}
      >
        Warung Sembako POS
      </div>

      <PinPad onComplete={handlePinComplete} disabled={loading} error={error} />

      <p
        style={{
          fontFamily: 'var(--font-label)',
          fontSize: 'var(--text-label-sm)',
          color: 'var(--color-outline)',
        }}
      >
        &copy; 2026 Warung Sembako POS
      </p>
    </main>
  );
}
