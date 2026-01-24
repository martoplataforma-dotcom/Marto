export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export const ASSETS_URL = API_URL.replace(/\/api\/?$/, '');

export function resolveAsset(pathOrUrl?: string | null) {
  const v = String(pathOrUrl ?? '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith('/uploads/')) return `${ASSETS_URL}${v}`;
  return null;
}
