import { fetchJSON, type ApiError } from './api';

type Tokens = {
  accessToken: string;
  refreshToken?: string;
};

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;

  if (typeof window !== 'undefined') {
    if (token) window.localStorage.setItem('marto_access', token);
    else window.localStorage.removeItem('marto_access');
  }
}

export function getAccessToken() {
  if (accessToken) return accessToken;

  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('marto_access');
    if (stored) {
      accessToken = stored;
      return stored;
    }
  }

  return null;
}

export function logout() {
  setAccessToken(null);
}

/**
 * Login usando seus endpoints atuais
 * (ajuste o path se seu backend usa outro)
 */
export async function login(body: { email: string; password: string }) {
  const tokens = await fetchJSON<Tokens>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  setAccessToken(tokens.accessToken);
  return tokens;
}

/**
 * Register usando seus endpoints atuais
 * (ajuste o path se seu backend usa outro)
 */
export async function register(body: {
  email: string;
  password: string;
  name?: string;
}) {
  const tokens = await fetchJSON<Tokens>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  setAccessToken(tokens.accessToken);
  return tokens;
}

export async function authFetchJSON<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);

  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  try {
    return await fetchJSON<T>(path, { ...init, headers });
  } catch (e) {
    const a = e as ApiError;
    if (a.status === 401) logout();
    throw e;
  }
}
