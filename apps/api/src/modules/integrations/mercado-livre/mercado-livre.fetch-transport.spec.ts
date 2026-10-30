import type {
  MercadoLivreHttpRequest,
  MercadoLivreHttpResponse,
} from './mercado-livre.client';

type TransportPort = {
  request(input: MercadoLivreHttpRequest): Promise<MercadoLivreHttpResponse>;
};

type FakeFetchInit = {
  method?: string;
  headers?: Record<string, string>;
};

type FakeHeaders = {
  forEach(callback: (value: string, name: string) => void): void;
};

type FakeFetchResponse = {
  status: number;
  headers: FakeHeaders;
  text(): Promise<string>;
};

type FakeFetch = (
  url: string,
  init?: FakeFetchInit,
) => Promise<FakeFetchResponse>;

function createResponse(input?: {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
}) {
  const status = input?.status ?? 200;
  const headers = input?.headers ?? {};
  const body = input?.body ?? '';

  const text = jest.fn(() => Promise.resolve(body));

  const response: FakeFetchResponse = {
    status,
    headers: {
      forEach(callback) {
        for (const [name, value] of Object.entries(headers)) {
          callback(value, name);
        }
      },
    },
    text,
  };

  return {
    response,
    text,
  };
}

function createTransport(
  fetchImpl: FakeFetch,
  baseUrl?: string,
): TransportPort {
  const module = jest.requireActual<{
    MercadoLivreFetchTransport: new (
      fetchImpl: FakeFetch,
      baseUrl?: string,
    ) => TransportPort;
  }>('./mercado-livre.fetch-transport');

  return new module.MercadoLivreFetchTransport(fetchImpl, baseUrl);
}

function basicRequest(
  overrides: Partial<MercadoLivreHttpRequest> = {},
): MercadoLivreHttpRequest {
  return {
    method: 'GET',
    path: '/orders/123',
    headers: {},
    ...overrides,
  };
}

describe('MercadoLivreFetchTransport', () => {
  it('uses the official Mercado Livre API base URL by default', async () => {
    const { response } = createResponse({
      body: '{"id":123}',
    });

    const fetchImpl = jest.fn<FakeFetch>(() => Promise.resolve(response));

    const transport = createTransport(fetchImpl);

    await transport.request(basicRequest());

    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url] = fetchImpl.mock.calls[0];

    expect(url).toBe('https://api.mercadolibre.com/orders/123');
  });

  it('combines the configured base URL with the relative path', async () => {
    const { response } = createResponse({
      body: '{"id":123}',
    });

    const fetchImpl = jest.fn<FakeFetch>(() => Promise.resolve(response));

    const transport = createTransport(fetchImpl, 'https://mercado-livre.test');

    await transport.request(
      basicRequest({
        path: '/orders/456',
      }),
    );

    const [url] = fetchImpl.mock.calls[0];

    expect(url).toBe('https://mercado-livre.test/orders/456');
  });

  it('forwards the GET method to fetch', async () => {
    const { response } = createResponse({
      body: '{}',
    });

    const fetchImpl = jest.fn<FakeFetch>(() => Promise.resolve(response));

    const transport = createTransport(fetchImpl);

    await transport.request(basicRequest());

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('forwards request headers without creating authentication', async () => {
    const { response } = createResponse({
      body: '{}',
    });

    const fetchImpl = jest.fn<FakeFetch>(() => Promise.resolve(response));

    const transport = createTransport(fetchImpl);

    await transport.request(
      basicRequest({
        headers: {
          Authorization: 'Bearer access-token',
          'X-New-Domain': 'true',
        },
      }),
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer access-token',
          'X-New-Domain': 'true',
        },
      }),
    );
  });

  it('serializes query parameters into the request URL', async () => {
    const { response } = createResponse({
      body: '{}',
    });

    const fetchImpl = jest.fn<FakeFetch>(() => Promise.resolve(response));

    const transport = createTransport(fetchImpl);

    await transport.request(
      basicRequest({
        path: '/orders/search',
        query: {
          seller: '123456',
          limit: 50,
        },
      }),
    );

    const [rawUrl] = fetchImpl.mock.calls[0];
    const url = new URL(rawUrl);

    expect(url.pathname).toBe('/orders/search');
    expect(url.searchParams.get('seller')).toBe('123456');
    expect(url.searchParams.get('limit')).toBe('50');
  });

  it('preserves query parameter names containing dots', async () => {
    const { response } = createResponse({
      body: '{}',
    });

    const fetchImpl = jest.fn<FakeFetch>(() => Promise.resolve(response));

    const transport = createTransport(fetchImpl);

    await transport.request(
      basicRequest({
        path: '/orders/search',
        query: {
          'order.date_last_updated.from': '2026-10-27T00:00:00-03:00',
          'order.date_last_updated.to': '2026-10-27T23:59:59-03:00',
        },
      }),
    );

    const [rawUrl] = fetchImpl.mock.calls[0];
    const url = new URL(rawUrl);

    expect(url.searchParams.get('order.date_last_updated.from')).toBe(
      '2026-10-27T00:00:00-03:00',
    );

    expect(url.searchParams.get('order.date_last_updated.to')).toBe(
      '2026-10-27T23:59:59-03:00',
    );
  });

  it('serializes numeric query values as text', async () => {
    const { response } = createResponse({
      body: '{}',
    });

    const fetchImpl = jest.fn<FakeFetch>(() => Promise.resolve(response));

    const transport = createTransport(fetchImpl);

    await transport.request(
      basicRequest({
        path: '/orders/search',
        query: {
          offset: 100,
          limit: 25,
        },
      }),
    );

    const [rawUrl] = fetchImpl.mock.calls[0];
    const url = new URL(rawUrl);

    expect(url.searchParams.get('offset')).toBe('100');
    expect(url.searchParams.get('limit')).toBe('25');
  });

  it('performs exactly one fetch call per request', async () => {
    const { response } = createResponse({
      body: '{}',
    });

    const fetchImpl = jest.fn<FakeFetch>(() => Promise.resolve(response));

    const transport = createTransport(fetchImpl);

    await transport.request(basicRequest());

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('preserves the HTTP status returned by fetch', async () => {
    const { response } = createResponse({
      status: 206,
      body: '{"id":123}',
    });

    const fetchImpl = jest.fn<FakeFetch>(() => Promise.resolve(response));

    const transport = createTransport(fetchImpl);

    const result = await transport.request(basicRequest());

    expect(result.status).toBe(206);
  });

  it('normalizes response header names to lowercase', async () => {
    const { response } = createResponse({
      headers: {
        'X-Content-Missing': 'buyer',
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    const fetchImpl = jest.fn<FakeFetch>(() => Promise.resolve(response));

    const transport = createTransport(fetchImpl);

    const result = await transport.request(basicRequest());

    expect(result.headers).toEqual({
      'x-content-missing': 'buyer',
      'content-type': 'application/json',
    });
  });

  it('parses a JSON object response body', async () => {
    const { response } = createResponse({
      body: '{"id":123,"status":"paid"}',
    });

    const fetchImpl = jest.fn<FakeFetch>(() => Promise.resolve(response));

    const transport = createTransport(fetchImpl);

    const result = await transport.request(basicRequest());

    expect(result.body).toEqual({
      id: 123,
      status: 'paid',
    });
  });

  it('preserves a JSON array response body as an array', async () => {
    const { response } = createResponse({
      body: '[{"id":10},{"id":20}]',
    });

    const fetchImpl = jest.fn<FakeFetch>(() => Promise.resolve(response));

    const transport = createTransport(fetchImpl);

    const result = await transport.request(basicRequest());

    expect(result.body).toEqual([{ id: 10 }, { id: 20 }]);

    expect(Array.isArray(result.body)).toBe(true);
  });

  it('returns an absent body for HTTP 204 without reading text', async () => {
    const { response, text } = createResponse({
      status: 204,
      body: 'must-not-be-read',
    });

    const fetchImpl = jest.fn<FakeFetch>(() => Promise.resolve(response));

    const transport = createTransport(fetchImpl);

    const result = await transport.request(basicRequest());

    expect(result.status).toBe(204);
    expect(result.body).toBeUndefined();
    expect(text).not.toHaveBeenCalled();
  });

  it('returns an absent body when the response text is empty', async () => {
    const { response, text } = createResponse({
      status: 200,
      body: '',
    });

    const fetchImpl = jest.fn<FakeFetch>(() => Promise.resolve(response));

    const transport = createTransport(fetchImpl);

    const result = await transport.request(basicRequest());

    expect(result.body).toBeUndefined();
    expect(text).toHaveBeenCalledTimes(1);
  });

  it('preserves a non-JSON response body as text', async () => {
    const { response } = createResponse({
      status: 500,
      body: 'upstream temporarily unavailable',
    });

    const fetchImpl = jest.fn<FakeFetch>(() => Promise.resolve(response));

    const transport = createTransport(fetchImpl);

    const result = await transport.request(basicRequest());

    expect(result.status).toBe(500);
    expect(result.body).toBe('upstream temporarily unavailable');
  });

  it('propagates network failures without retrying', async () => {
    const networkError = new Error('socket failure');

    const fetchImpl = jest.fn<FakeFetch>(() => Promise.reject(networkError));

    const transport = createTransport(fetchImpl);

    await expect(transport.request(basicRequest())).rejects.toBe(networkError);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects unsafe absolute, protocol-relative, or non-relative paths before fetch', async () => {
    const { response } = createResponse({
      body: '{}',
    });

    const fetchImpl = jest.fn<FakeFetch>(() => Promise.resolve(response));

    const transport = createTransport(fetchImpl);

    const unsafePaths = [
      'https://evil.example/orders/1',
      'http://evil.example/orders/1',
      '//evil.example/orders/1',
      'orders/1',
      '',
    ];

    for (const path of unsafePaths) {
      await expect(
        transport.request(
          basicRequest({
            path,
          }),
        ),
      ).rejects.toThrow();
    }

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
