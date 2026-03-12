export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6'
  };

  return (
    <div className={`
      bg-white border border-slate-200 rounded-xl shadow-sm
      ${paddingStyles[padding]}
      ${className}
    `}>
      {children}
    </div>
  );
}