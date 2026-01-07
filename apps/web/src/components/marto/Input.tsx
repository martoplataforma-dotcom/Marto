import * as React from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      className={
        'w-full rounded-xl border border-[var(--marto-border)] bg-white p-3 text-sm ' +
        'text-[var(--marto-text)] placeholder:text-zinc-500 outline-none ' +
        'focus:ring-2 focus:ring-[var(--marto-ring)] ' +
        className
      }
      {...props}
    />
  );
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
export function Textarea({ className = '', ...props }: TextareaProps) {
  return (
    <textarea
      className={
        'w-full rounded-xl border border-[var(--marto-border)] bg-white p-3 text-sm ' +
        'text-[var(--marto-text)] placeholder:text-zinc-500 outline-none ' +
        'focus:ring-2 focus:ring-[var(--marto-ring)] ' +
        className
      }
      {...props}
    />
  );
}
