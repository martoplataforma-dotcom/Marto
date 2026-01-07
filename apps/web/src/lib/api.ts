export type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

function extractMessage(data: unknown): string | undefined {
  if (typeof data === 'object' && data !== null && 'message' in data) {
    const msg = (data as Record<string, unknown>).message;
    if (typeof msg === 'string') return msg;
  }
  return undefined;
}

function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('marto_access');
}

export async function fetchJSON<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  // ✅ Monta URL final (se BASE_URL estiver vazio, vira só o path)
  const url = joinUrl(BASE_URL, path);

  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // ✅ PONTO-CHAVE: manda Authorization sempre que tiver token
  const token = getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (e) {
    throw {
      status: 0,
      message: 'Falha de rede (API offline, CORS ou URL errada).',
      details: e,
    } as ApiError;
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  const data: unknown = isJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => '');

  if (!res.ok) {
    throw {
      status: res.status,
      message: extractMessage(data) ?? res.statusText ?? 'Erro na API',
      details: data,
    } as ApiError;
  }

  return data as T;
}
