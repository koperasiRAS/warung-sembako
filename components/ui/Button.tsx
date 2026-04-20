export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const variantStyles = {
  primary: {
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-on-primary)',
    hoverBg: 'var(--color-primary-container)',
    focusRing: 'var(--color-primary)',
  },
  secondary: {
    backgroundColor: 'var(--color-surface-container)',
    color: 'var(--color-on-surface)',
    hoverBg: 'var(--color-surface-dim)',
    focusRing: 'var(--color-primary)',
  },
  danger: {
    backgroundColor: 'var(--color-error-container)',
    color: 'var(--color-error)',
    hoverBg: 'var(--color-error)',
    focusRing: 'var(--color-error)',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--color-on-surface-variant)',
    hoverBg: 'var(--color-surface-container)',
    focusRing: 'var(--color-primary)',
  },
};

const sizeStyles = {
  sm: { padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-body-sm)' },
  md: { padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-body-md)' },
  lg: { padding: 'var(--space-3) var(--space-6)', fontSize: 'var(--text-body-lg)' },
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];

  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-label)',
        fontWeight: '600',
        borderRadius: 'var(--radius-lg)',
        border: 'none',
        cursor: (disabled || isLoading) ? 'not-allowed' : 'pointer',
        opacity: (disabled || isLoading) ? '0.5' : '1',
        transition: 'background-color var(--transition-fast)',
        backgroundColor: v.backgroundColor,
        color: v.color,
        padding: `${s.padding}`,
        fontSize: s.fontSize,
        letterSpacing: 'var(--tracking-wide)',
        ...(props.style || {}),
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.backgroundColor = v.hoverBg;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = v.backgroundColor;
      }}
      className={className}
    >
      {isLoading && (
        <svg
          style={{ width: '1rem', height: '1rem', marginRight: '0.5rem', animation: 'spin 0.6s linear infinite' }}
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle style={{ opacity: '0.25' }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: '0.75' }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}
