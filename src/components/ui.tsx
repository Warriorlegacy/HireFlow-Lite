import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Check, Info, Loader2, X } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* Buttons                                                                    */
/* -------------------------------------------------------------------------- */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({ variant = 'secondary', size = 'md', loading, icon, children, className = '', ...rest }: ButtonProps) {
  const variants = {
    primary: 'bg-accent text-white border-accent hover:bg-accentDark disabled:bg-accent/50',
    secondary: 'bg-surface text-ink border-rule hover:bg-subtle/70 disabled:text-muted',
    ghost: 'bg-transparent text-graphite border-transparent hover:bg-subtle/70 hover:text-ink',
    danger: 'bg-negativeSoft text-negative border-negative/25 hover:bg-negative hover:text-white',
  };
  const sizes = { sm: 'h-8 px-2.5 text-[13px] gap-1.5', md: 'h-10 px-3.5 text-[14px] gap-2' };
  return (
    <button
      className={`inline-flex select-none items-center justify-center rounded-md border font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <Loader2 size={size === 'sm' ? 13 : 15} className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Form primitives                                                            */
/* -------------------------------------------------------------------------- */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-1 text-negative">*</span>}
      </label>
      {children}
      {hint && !error && <p className="hint">{hint}</p>}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`field ${props.className || ''}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`field min-h-[96px] resize-y ${props.className || ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`field ${props.className || ''}`} />;
}

export function Checkbox({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[13.5px] leading-relaxed text-graphite">
      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-rule accent-accent" {...rest} />
      <span>{label}</span>
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Status badges                                                              */
/* -------------------------------------------------------------------------- */
const badgeTones: Record<string, string> = {
  neutral: 'bg-subtle text-graphite border-rule',
  success: 'bg-positiveSoft text-positive border-positive/20',
  warning: 'bg-warningSoft text-warning border-warning/20',
  danger: 'bg-negativeSoft text-negative border-negative/20',
  accent: 'bg-accentSoft text-accentDark border-accent/20',
};

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: keyof typeof badgeTones;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[11.5px] font-medium ${badgeTones[tone]} ${className}`}>
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Page furniture                                                             */
/* -------------------------------------------------------------------------- */
export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="font-display text-[26px] font-medium leading-tight text-ink sm:text-[32px]">{title}</h1>
        {description && <div className="mt-2 max-w-2xl text-[14px] leading-relaxed text-graphite">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
  icon,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-subtle text-graphite">{icon}</div>}
      <h3 className="font-display text-xl text-ink">{title}</h3>
      {children && <div className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-14 w-full" />
      ))}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card card-pad flex flex-col items-start gap-3 border-negative/20 bg-negativeSoft/40">
      <div className="flex items-center gap-2 text-negative">
        <AlertCircle size={16} aria-hidden />
        <p className="text-[14px] font-medium">Something needs attention</p>
      </div>
      <p className="text-[13.5px] leading-relaxed text-graphite">{message}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const text = (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accentSoft font-medium text-accentDark"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {text || '?'}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const nodes = ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const list = Array.from(nodes).filter((n) => !n.hasAttribute('disabled'));
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const target = ref.current?.querySelector<HTMLElement>('input, textarea, select, button');
      target?.focus();
    }, 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 p-0 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`rise max-h-[92vh] w-full ${width} overflow-y-auto rounded-t-panel border border-rule bg-surface p-5 shadow-lift sm:rounded-panel sm:p-6`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="font-display text-[22px] leading-tight text-ink">
              {title}
            </h2>
            {description && <p className="mt-1.5 text-[13.5px] leading-relaxed text-graphite">{description}</p>}
          </div>
          <button
            type="button"
            className="-mr-1 -mt-1 rounded p-1.5 text-muted hover:bg-subtle hover:text-ink"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        {children}
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-rule pt-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------------------- */
/* Toasts                                                                     */
/* -------------------------------------------------------------------------- */
type Toast = { id: number; message: string; tone: 'success' | 'error' | 'info' };
const ToastContext = createContext<{ push: (message: string, tone?: Toast['tone']) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2.5 rounded-card border px-3.5 py-3 text-[13.5px] shadow-lift ${
              t.tone === 'error'
                ? 'border-negative/25 bg-negativeSoft text-negative'
                : t.tone === 'info'
                  ? 'border-rule bg-surface text-graphite'
                  : 'border-positive/20 bg-positiveSoft text-positive'
            }`}
          >
            {t.tone === 'error' ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : t.tone === 'info' ? <Info size={16} className="mt-0.5 shrink-0" /> : <Check size={16} className="mt-0.5 shrink-0" />}
            <span className="leading-relaxed">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                       */
/* -------------------------------------------------------------------------- */
export function DefinitionList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-[13.5px] sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-[12px] text-muted">{item.label}</dt>
          <dd className="mt-0.5 text-ink">{item.value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Meter({ value, max, tone = 'accent' }: { value: number; max: number; tone?: 'accent' | 'warning' | 'danger' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = tone === 'danger' ? 'bg-negative' : tone === 'warning' ? 'bg-warning' : 'bg-accent';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle" role="img" aria-label={`${value} of ${max}`}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
