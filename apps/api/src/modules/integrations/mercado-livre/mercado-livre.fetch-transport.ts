import type {
  MercadoLivreHttpRequest,
  MercadoLivreHttpResponse,
  MercadoLivreHttpTransport,
} from './mercado-livre.client';

type MercadoLivreFetchHeaders = {
  forEach(callback: (value: string, name: string) => void): void;
};

type MercadoLivreFetchResponse = {
  status: number;
  headers: MercadoLivreFetchHeaders;
  text(): Promise<string>;
};

type MercadoLivreFetchInit = {
  method?: string;
  headers?: Record<string, string>;
};

export type MercadoLivreFetch = (
  url: string,
  init?: MercadoLivreFetchInit,
) => Promise<MercadoLivreFetchResponse>;

const DEFAULT_BASE_URL = 'https://api.mercadolibre.com';

export class MercadoLivreFetchTransport implements MercadoLivreHttpTransport {
  constructor(
    private readonly fetchImpl: MercadoLivreFetch = globalThis.fetch,
    private readonly baseUrl: string = DEFAULT_BASE_URL,
  ) {}

  async request(
    input: MercadoLivreHttpRequest,
  ): Promise<MercadoLivreHttpResponse> {
    this.assertSafePath(input.path);

    const url = new URL(input.path, this.baseUrl);

    for (const [name, value] of Object.entries(input.query ?? {})) {
      url.searchParams.set(name, String(value));
    }

    const response = await this.fetchImpl(url.toString(), {
      method: input.method,
      headers: input.headers,
    });

    const headers: Record<string, string> = {};

    response.headers.forEach((value, name) => {
      headers[name.toLowerCase()] = value;
    });

    if (response.status === 204) {
      return {
        status: response.status,
        headers,
      };
    }

    const responseText = await response.text();

    if (responseText === '') {
      return {
        status: response.status,
        headers,
      };
    }

    return {
      status: response.status,
      headers,
      body: this.parseBody(responseText),
    };
  }

  private assertSafePath(path: string): void {
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw new Error(
        'Mercado Livre HTTP path must be a safe relative API path.',
      );
    }
  }

  private parseBody(responseText: string): unknown {
    try {
      return JSON.parse(responseText) as unknown;
    } catch {
      return responseText;
    }
  }
}
