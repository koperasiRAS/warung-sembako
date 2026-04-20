'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

const PIN_LENGTH = 6;

interface PinPadProps {
  onComplete: (pin: string) => void;
  disabled?: boolean;
  error?: boolean;
}

export function PinPad({ onComplete, disabled = false, error = false }: PinPadProps) {
  const [digits, setDigits] = useState<string[]>([]);
  const [shaking, setShaking] = useState(false);
  const prevError = useRef(false);

  // Shake when error transitions from false → true
  useEffect(() => {
    if (error && !prevError.current) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      setTimeout(() => setDigits([]), 300);
    }
    prevError.current = error;
  }, [error]);

  const handleDigit = useCallback((digit: string) => {
    if (disabled || digits.length >= PIN_LENGTH) return;
    const next = [...digits, digit];
    setDigits(next);
    if (next.length === PIN_LENGTH) {
      onComplete(next.join(''));
    }
  }, [disabled, digits, onComplete]);

  const handleBackspace = useCallback(() => {
    if (disabled) return;
    setDigits(prev => prev.slice(0, -1));
  }, [disabled]);

  const handleClear = useCallback(() => {
    if (disabled) return;
    setDigits([]);
  }, [disabled]);

  const dotBorderColor = error ? 'var(--color-error)' : 'var(--color-outline)';
  const dotBgColor = error
    ? 'var(--color-error)'
    : (digits.length > 0 ? 'var(--color-primary)' : 'transparent');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-8)',
        padding: 'var(--space-8)',
        animation: shaking ? 'pinpad-shake 0.4s ease' : 'none',
      }}
      onKeyDown={(e) => {
        if (e.key === 'Backspace') handleBackspace();
        if (e.key === 'Escape') handleClear();
      }}
      tabIndex={0}
    >
      {/* Dot indicators */}
      <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              border: `2px solid ${dotBorderColor}`,
              backgroundColor: i < digits.length ? dotBgColor : 'transparent',
              transition: 'background-color var(--transition-fast), border-color var(--transition-fast)',
            }}
          />
        ))}
      </div>

      {/* Numpad */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--space-3)',
          width: '260px',
        }}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((key) => {
          if (key === null) {
            return <div key="empty" style={{ width: '72px', height: '72px' }} />;
          }

          const isDel = key === 'del';
          const btnBg = disabled ? 'var(--color-surface-container)' : (isDel ? 'var(--color-surface-container)' : 'var(--color-surface-container-lowest)');
          const btnColor = disabled ? 'var(--color-outline)' : (isDel ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface)');

          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => isDel ? handleBackspace() : handleDigit(String(key))}
              style={{
                width: '72px',
                height: '72px',
                borderRadius: isDel ? 'var(--radius-lg)' : 'var(--radius-full)',
                border: 'none',
                backgroundColor: btnBg,
                color: btnColor,
                fontFamily: 'var(--font-heading)',
                fontSize: '1.25rem',
                fontWeight: '600',
                cursor: disabled ? 'not-allowed' : 'pointer',
                boxShadow: disabled || isDel ? 'none' : 'var(--shadow-sm)',
                transition: 'background-color var(--transition-fast), transform var(--transition-fast), opacity var(--transition-fast)',
                opacity: disabled ? 0.5 : 1,
              }}
              onMouseDown={(e) => {
                if (disabled) return;
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)';
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
              }}
            >
              {isDel ? (
                <span style={{
                  fontFamily: 'var(--font-label)',
                  fontSize: '0.75rem',
                  letterSpacing: 'var(--tracking-wide)',
                  fontWeight: '500',
                }}>
                  HAPUS
                </span>
              ) : key}
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes pinpad-shake {
          0%   { transform: translateX(0); }
          15%  { transform: translateX(-8px); }
          30%  { transform: translateX(8px); }
          45%  { transform: translateX(-6px); }
          60%  { transform: translateX(6px); }
          75%  { transform: translateX(-3px); }
          90%  { transform: translateX(3px); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
