'use client';

import { useEffect, useRef, useCallback } from 'react';

export interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  enabled?: boolean;
}

export function BarcodeScanner({ onScan, enabled = true }: BarcodeScannerProps) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    const now = Date.now();
    const timeDiff = now - lastKeyTimeRef.current;

    // Reset buffer if more than 100ms passed between keys
    // (barcode scanners typically input very fast, <50ms between characters)
    if (timeDiff > 100) {
      bufferRef.current = '';
    }

    lastKeyTimeRef.current = now;

    // Only process printable characters
    if (event.key.length === 1) {
      bufferRef.current += event.key;
    }

    // Check for Enter key (most barcode scanners end with Enter)
    if (event.key === 'Enter' && bufferRef.current.length >= 8) {
      const barcode = bufferRef.current.trim();
      bufferRef.current = '';

      if (barcode.length >= 8 && barcode.length <= 20) {
        onScan(barcode);
      }
    }
  }, [enabled, onScan]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return null;
}