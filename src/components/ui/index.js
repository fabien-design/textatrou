import React, { useEffect } from 'react';

const cx = (...c) => c.filter(Boolean).join(' ');

const VARIANTS = {
  primary: 'bg-sun',
  white: 'bg-white',
  coral: 'bg-coral',
  mint: 'bg-mint',
  cyan: 'bg-cyan text-white',
  grape: 'bg-grape text-white',
};

export function Button({ variant = 'primary', disabled, onClick, children, className, ...rest }) {
  return React.createElement(
    'button',
    {
      type: 'button',
      ...rest,
      disabled,
      onClick,
      className: cx(
        'rounded-2xl border-2 border-ink shadow-brutal font-display font-bold px-5 py-3 text-ink transition-all select-none',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'active:translate-x-[2px] active:translate-y-[2px] active:shadow-brutal-sm',
        VARIANTS[variant] || VARIANTS.primary,
        className
      ),
    },
    children
  );
}

export function Card({ className, children, ...rest }) {
  return React.createElement(
    'div',
    { ...rest, className: cx('rounded-2xl border-2 border-ink shadow-brutal bg-white p-4', className) },
    children
  );
}

export function Toggle({ checked, onChange, label }) {
  return React.createElement(
    'button',
    {
      type: 'button',
      role: 'switch',
      'aria-checked': checked ? 'true' : 'false',
      onClick: () => onChange(!checked),
      className: 'flex w-full items-center justify-between gap-3 font-body text-ink',
    },
    React.createElement('span', null, label),
    React.createElement(
      'span',
      {
        'aria-hidden': 'true',
        className: cx(
          'relative inline-block h-7 w-12 shrink-0 rounded-full border-2 border-ink transition-colors',
          checked ? 'bg-mint' : 'bg-white'
        ),
      },
      React.createElement('span', {
        className: cx(
          'absolute top-0.5 left-0.5 h-5 w-5 rounded-full border-2 border-ink bg-ink transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0'
        ),
      })
    )
  );
}

export function Modal({ open, onClose, title, children }) {
  const titleId = React.useId();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose && onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return React.createElement(
    'div',
    { className: 'fixed inset-0 z-50 flex items-center justify-center p-4' },
    React.createElement('div', {
      'data-testid': 'modal-backdrop',
      className: 'absolute inset-0 bg-ink/50',
      onClick: onClose,
    }),
    React.createElement(
      'div',
      {
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': titleId,
        className:
          'relative w-full max-w-md bg-cream rounded-2xl border-2 border-ink shadow-brutal p-4',
      },
      React.createElement(
        'div',
        { className: 'mb-3 flex items-center justify-between gap-3' },
        React.createElement('h2', { id: titleId, className: 'font-display text-xl font-bold text-ink' }, title),
        React.createElement(
          'button',
          {
            type: 'button',
            'aria-label': 'Fermer',
            onClick: onClose,
            className: 'rounded-full border-2 border-ink bg-white px-2 font-display font-bold text-ink',
          },
          '✕'
        )
      ),
      children
    )
  );
}

const PILL_COLORS = {
  mint: 'bg-mint',
  coral: 'bg-coral',
  sun: 'bg-sun',
  cyan: 'bg-cyan',
  grape: 'bg-grape',
  white: 'bg-white',
};

export function Pill({ color = 'mint', children, className }) {
  return React.createElement(
    'span',
    {
      className: cx(
        'inline-flex rounded-full border-2 border-ink px-3 py-0.5 font-display font-semibold text-sm text-ink',
        PILL_COLORS[color] || PILL_COLORS.mint,
        className
      ),
    },
    children
  );
}
