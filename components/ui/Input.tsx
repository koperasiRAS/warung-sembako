export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <label style={{
          display: 'block',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-body-sm)',
          fontWeight: '500',
          color: 'var(--color-on-surface-variant)',
          marginBottom: 'var(--space-2)',
        }}>
          {label}
        </label>
      )}
      <input
        className={className}
        style={{
          width: '100%',
          padding: 'var(--input-padding-y) var(--input-padding-x)',
          backgroundColor: props.disabled
            ? 'var(--color-surface-container)'
            : 'var(--color-surface-container-high)',
          color: props.disabled ? 'var(--color-outline)' : 'var(--color-on-surface)',
          border: `1.5px solid ${error ? 'var(--color-error)' : 'var(--color-outline-variant)'}`,
          borderRadius: 'var(--radius-lg)',
          outline: 'none',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-body-md)',
          transition: 'border-color var(--transition-fast)',
          cursor: props.disabled ? 'not-allowed' : 'text',
        }}
        onFocus={(e) => {
          if (!props.disabled) {
            e.currentTarget.style.borderColor = error ? 'var(--color-error)' : 'var(--color-primary)';
            e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)';
          }
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? 'var(--color-error)' : 'var(--color-outline-variant)';
          e.currentTarget.style.backgroundColor = props.disabled ? 'var(--color-surface-container)' : 'var(--color-surface-container-high)';
        }}
        {...props}
      />
      {error && (
        <p style={{
          marginTop: 'var(--space-2)',
          fontFamily: 'var(--font-label)',
          fontSize: 'var(--text-label-sm)',
          color: 'var(--color-error)',
        }}>
          {error}
        </p>
      )}
    </div>
  );
}
