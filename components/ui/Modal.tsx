'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: '24rem',
  md: '28rem',
  lg: '32rem',
};

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: '0', zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
      <div
        style={{
          position: 'absolute',
          inset: '0',
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: sizeMap[size],
        backgroundColor: 'var(--color-surface-container-lowest)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-overlay)',
        overflow: 'hidden',
        animation: 'fadeIn 200ms ease',
      }}>
        {title && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: 'var(--space-4) var(--space-6)',
            borderBottom: '1px solid var(--color-outline-variant)',
          }}>
            <h3 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--text-title-lg)',
              fontWeight: '600',
              color: 'var(--color-on-surface)',
            }}>
              {title}
            </h3>
            <button
              onClick={onClose}
              style={{
                padding: 'var(--space-1)',
                color: 'var(--color-outline)',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-surface-container)';
                e.currentTarget.style.color = 'var(--color-on-surface-variant)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--color-outline)';
              }}
            >
              <X style={{ width: '1.25rem', height: '1.25rem' }} />
            </button>
          </div>
        )}
        <div style={{ padding: 'var(--space-6)' }}>{children}</div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}