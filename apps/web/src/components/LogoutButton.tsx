'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

type Props = {
  redirectTo?: string; // default: /login
  label?: string; // default: Sair
  className?: string;
  disabled?: boolean;
};

function clearMartoAuth() {
  if (typeof window === 'undefined') return;

  // ✅ remove somente tokens de autenticação
  localStorage.removeItem('marto_access');
  localStorage.removeItem('marto_refresh');

  // ❗ NÃO remover marto_home aqui
  // porque seu app usa isso pra decidir o dashboard pós-login
  // localStorage.removeItem('marto_home');
}

export function LogoutButton({
  redirectTo = '/login',
  label = 'Sair',
  className,
  disabled,
}: Props) {
  const router = useRouter();

  const onLogout = useCallback(() => {
    try {
      clearMartoAuth();
    } finally {
      router.replace(redirectTo);
      router.refresh();
    }
  }, [router, redirectTo]);

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={disabled}
      className={
        className ??
        'text-sm text-red-600 hover:underline disabled:opacity-50'
      }
    >
      {label}
    </button>
  );
}
