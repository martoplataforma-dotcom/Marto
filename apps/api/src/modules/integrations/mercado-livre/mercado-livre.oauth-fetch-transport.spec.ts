type MercadoLivreOAuthHttpRequest = {
  method: 'POST';
  path: string;
  headers: Record<string, string>;
  form: Record<string, string>;
};

type MercadoLivreOAuthHttpResponse = {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
};

type MercadoLivreOAuthHttpTransport = {
  request(
    input: MercadoLivreOAuthHttpRequest,
  ): Promise<MercadoLivreOAuthHttpResponse>;
};

type FakeFetchHeaders = {
  forEach(
    callback: (
      value: string,
      name: string,
    ) => void,
  ): void;
};

type FakeFetchResponse = {
  status: number;
  headers: FakeFetchHeaders;
  text(): Promise<string>;
};

type FakeFetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

type FakeFetch = (
  url: string,
  init?: FakeFetchInit,
) => Promise<FakeFetchResponse>;

type OAuthFetchTransportConstructor = new (
  fetchImpl?: FakeFetch,
  baseUrl?: string,
) => MercadoLivreOAuthHttpTransport;

function loadTransport():
OAuthFetchTransportConstructor {
  const module = jest.requireActual<{
    MercadoLivreOAuthFetchTransport:
      OAuthFetchTransportConstructor;
  }>(
    './mercado-livre.oauth-fetch-transport',
  );

  return module
    .MercadoLivreOAuthFetchTransport;
}

function createResponse(
  input?: {
    status?: number;
    headers?: Record<string, string>;
    body?: string;
  },
): {
  response: FakeFetchResponse;
  text: jest.Mock<
    Promise<string>,
    []
  >;
} {
  const status =
    input?.status ?? 200;

  const headers =
    input?.headers ?? {};

  const body =
    input?.body ?? '';

  const text =
    jest.fn<
      Promise<string>,
      []
    >(
      () =>
        Promise.resolve(body),
    );

  return {
    response: {
      status,

      headers: {
        forEach(callback) {
          for (
            const [name, value]
            of Object.entries(headers)
          ) {
            callback(
              value,
              name,
            );
          }
        },
      },

      text,
    },

    text,
  };
}

function createTransport(
  fetchImpl: FakeFetch,
  baseUrl?: string,
): MercadoLivreOAuthHttpTransport {
  const Transport =
    loadTransport();

  return new Transport(
    fetchImpl,
    baseUrl,
  );
}

function oauthRequest(
  overrides:
    Partial<
      MercadoLivreOAuthHttpRequest
    > = {},
): MercadoLivreOAuthHttpRequest {
  return {
    method:
      'POST',

    path:
      '/oauth/token',

    headers: {
      accept:
        'application/json',

      'content-type':
        'application/x-www-form-urlencoded',
    },

    form: {
      grant_type:
        'refresh_token',

      client_id:
        'synthetic-client-id',

      client_secret:
        'synthetic-client-secret',

      refresh_token:
        'synthetic-refresh-token',
    },

    ...overrides,
  };
}

function formFromFetchCall(
  fetchImpl:
    jest.MockedFunction<FakeFetch>,
): URLSearchParams {
  const [, init] =
    fetchImpl.mock.calls[0];

  if (
    !init ||
    typeof init.body !== 'string'
  ) {
    throw new Error(
      'Expected a string fetch body.',
    );
  }

  return new URLSearchParams(
    init.body,
  );
}

describe(
  'MercadoLivreOAuthFetchTransport',
  () => {
    it(
      'uses the official Mercado Livre API base URL by default',
      async () => {
        const { response } =
          createResponse({
            body: '{}',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        await transport.request(
          oauthRequest(),
        );

        expect(
          fetchImpl,
        ).toHaveBeenCalledTimes(1);

        const [url] =
          fetchImpl.mock.calls[0];

        expect(url).toBe(
          'https://api.mercadolibre.com/oauth/token',
        );
      },
    );

    it(
      'combines a test base URL with exactly /oauth/token',
      async () => {
        const { response } =
          createResponse({
            body: '{}',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
            'https://mercado-livre.test',
          );

        await transport.request(
          oauthRequest(),
        );

        const [url] =
          fetchImpl.mock.calls[0];

        expect(url).toBe(
          'https://mercado-livre.test/oauth/token',
        );
      },
    );

    it(
      'forwards POST to fetch',
      async () => {
        const { response } =
          createResponse({
            body: '{}',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        await transport.request(
          oauthRequest(),
        );

        expect(
          fetchImpl,
        ).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            method:
              'POST',
          }),
        );
      },
    );

    it(
      'forwards the supplied OAuth headers',
      async () => {
        const { response } =
          createResponse({
            body: '{}',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        await transport.request(
          oauthRequest(),
        );

        expect(
          fetchImpl,
        ).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: {
              accept:
                'application/json',

              'content-type':
                'application/x-www-form-urlencoded',
            },
          }),
        );
      },
    );

    it(
      'serializes every form field into the request body',
      async () => {
        const { response } =
          createResponse({
            body: '{}',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        await transport.request(
          oauthRequest(),
        );

        const form =
          formFromFetchCall(
            fetchImpl,
          );

        expect(
          form.get(
            'grant_type',
          ),
        ).toBe(
          'refresh_token',
        );

        expect(
          form.get(
            'client_id',
          ),
        ).toBe(
          'synthetic-client-id',
        );

        expect(
          form.get(
            'client_secret',
          ),
        ).toBe(
          'synthetic-client-secret',
        );

        expect(
          form.get(
            'refresh_token',
          ),
        ).toBe(
          'synthetic-refresh-token',
        );
      },
    );

    it(
      'uses a string body compatible with application/x-www-form-urlencoded',
      async () => {
        const { response } =
          createResponse({
            body: '{}',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        await transport.request(
          oauthRequest(),
        );

        const [, init] =
          fetchImpl.mock.calls[0];

        expect(
          typeof init?.body,
        ).toBe(
          'string',
        );

        expect(
          init?.body,
        ).toContain(
          'grant_type=refresh_token',
        );
      },
    );

    it(
      'percent-encodes reserved form values instead of concatenating them unsafely',
      async () => {
        const { response } =
          createResponse({
            body: '{}',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        await transport.request(
          oauthRequest({
            form: {
              grant_type:
                'authorization_code',

              client_id:
                'client+id',

              client_secret:
                'secret&value=1',

              code:
                'code / value',

              redirect_uri:
                'https://example.test/callback?a=1&b=2',
            },
          }),
        );

        const form =
          formFromFetchCall(
            fetchImpl,
          );

        expect(
          form.get(
            'client_id',
          ),
        ).toBe(
          'client+id',
        );

        expect(
          form.get(
            'client_secret',
          ),
        ).toBe(
          'secret&value=1',
        );

        expect(
          form.get('code'),
        ).toBe(
          'code / value',
        );

        expect(
          form.get(
            'redirect_uri',
          ),
        ).toBe(
          'https://example.test/callback?a=1&b=2',
        );
      },
    );

    it(
      'keeps client_secret out of the request URL',
      async () => {
        const { response } =
          createResponse({
            body: '{}',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        await transport.request(
          oauthRequest(),
        );

        const [url] =
          fetchImpl.mock.calls[0];

        expect(url).not.toContain(
          'synthetic-client-secret',
        );

        expect(
          new URL(url)
            .search,
        ).toBe('');
      },
    );

    it(
      'keeps refresh_token out of the request URL',
      async () => {
        const { response } =
          createResponse({
            body: '{}',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        await transport.request(
          oauthRequest(),
        );

        const [url] =
          fetchImpl.mock.calls[0];

        expect(url).not.toContain(
          'synthetic-refresh-token',
        );

        expect(
          new URL(url)
            .searchParams
            .toString(),
        ).toBe('');
      },
    );

    it(
      'performs exactly one fetch call per OAuth request',
      async () => {
        const { response } =
          createResponse({
            body: '{}',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        await transport.request(
          oauthRequest(),
        );

        expect(
          fetchImpl,
        ).toHaveBeenCalledTimes(1);
      },
    );

    it(
      'preserves the HTTP status returned by fetch',
      async () => {
        const { response } =
          createResponse({
            status:
              429,

            body:
              '{"error":"too_many_requests"}',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        const result =
          await transport.request(
            oauthRequest(),
          );

        expect(
          result.status,
        ).toBe(429);
      },
    );

    it(
      'normalizes response header names to lowercase',
      async () => {
        const { response } =
          createResponse({
            headers: {
              'Content-Type':
                'application/json',

              'X-Request-Id':
                'request-123',
            },

            body:
              '{}',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        const result =
          await transport.request(
            oauthRequest(),
          );

        expect(
          result.headers,
        ).toEqual({
          'content-type':
            'application/json',

          'x-request-id':
            'request-123',
        });
      },
    );

    it(
      'parses a JSON object response body',
      async () => {
        const { response } =
          createResponse({
            body:
              '{"access_token":"synthetic-access-token","expires_in":21600}',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        const result =
          await transport.request(
            oauthRequest(),
          );

        expect(
          result.body,
        ).toEqual({
          access_token:
            'synthetic-access-token',

          expires_in:
            21600,
        });
      },
    );

    it(
      'parses a JSON array response body without reshaping it',
      async () => {
        const { response } =
          createResponse({
            body:
              '[{"error":"one"},{"error":"two"}]',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        const result =
          await transport.request(
            oauthRequest(),
          );

        expect(
          result.body,
        ).toEqual([
          {
            error:
              'one',
          },
          {
            error:
              'two',
          },
        ]);
      },
    );

    it(
      'returns an absent body for an empty response text',
      async () => {
        const {
          response,
          text,
        } =
          createResponse({
            status:
              204,

            body:
              '',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        const result =
          await transport.request(
            oauthRequest(),
          );

        expect(
          result.body,
        ).toBeUndefined();

        expect(
          text,
        ).toHaveBeenCalledTimes(1);
      },
    );

    it(
      'preserves a non-JSON response body as text',
      async () => {
        const { response } =
          createResponse({
            status:
              502,

            body:
              'upstream unavailable',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        const result =
          await transport.request(
            oauthRequest(),
          );

        expect(
          result.body,
        ).toBe(
          'upstream unavailable',
        );
      },
    );

    it(
      'propagates network failures without retrying',
      async () => {
        const networkError =
          new Error(
            'synthetic network failure',
          );

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.reject(
                networkError,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        await expect(
          transport.request(
            oauthRequest(),
          ),
        ).rejects.toBe(
          networkError,
        );

        expect(
          fetchImpl,
        ).toHaveBeenCalledTimes(1);
      },
    );

    it(
      'rejects an absolute HTTPS path before fetch',
      async () => {
        const { response } =
          createResponse({
            body:
              '{}',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        await expect(
          transport.request(
            oauthRequest({
              path:
                'https://evil.example/oauth/token',
            }),
          ),
        ).rejects.toThrow();

        expect(
          fetchImpl,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects a protocol-relative path before fetch',
      async () => {
        const { response } =
          createResponse({
            body:
              '{}',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        await expect(
          transport.request(
            oauthRequest({
              path:
                '//evil.example/oauth/token',
            }),
          ),
        ).rejects.toThrow();

        expect(
          fetchImpl,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects a non-relative path before fetch',
      async () => {
        const { response } =
          createResponse({
            body:
              '{}',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        await expect(
          transport.request(
            oauthRequest({
              path:
                'oauth/token',
            }),
          ),
        ).rejects.toThrow();

        expect(
          fetchImpl,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects any relative API resource path other than /oauth/token',
      async () => {
        const { response } =
          createResponse({
            body:
              '{}',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        await expect(
          transport.request(
            oauthRequest({
              path:
                '/users/me',
            }),
          ),
        ).rejects.toThrow();

        expect(
          fetchImpl,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects /oauth/token with a query string before fetch',
      async () => {
        const { response } =
          createResponse({
            body:
              '{}',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        await expect(
          transport.request(
            oauthRequest({
              path:
                '/oauth/token?client_secret=forbidden',
            }),
          ),
        ).rejects.toThrow();

        expect(
          fetchImpl,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects /oauth/token with a fragment before fetch',
      async () => {
        const { response } =
          createResponse({
            body:
              '{}',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        await expect(
          transport.request(
            oauthRequest({
              path:
                '/oauth/token#fragment',
            }),
          ),
        ).rejects.toThrow();

        expect(
          fetchImpl,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'does not invent authorization headers',
      async () => {
        const { response } =
          createResponse({
            body:
              '{}',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        await transport.request(
          oauthRequest({
            headers: {
              accept:
                'application/json',

              'content-type':
                'application/x-www-form-urlencoded',
            },
          }),
        );

        const [, init] =
          fetchImpl.mock.calls[0];

        expect(
          init?.headers,
        ).not.toHaveProperty(
          'authorization',
        );

        expect(
          init?.headers,
        ).not.toHaveProperty(
          'Authorization',
        );
      },
    );

    it(
      'does not mutate the caller form object while serializing it',
      async () => {
        const { response } =
          createResponse({
            body:
              '{}',
          });

        const fetchImpl =
          jest.fn<FakeFetch>(
            () =>
              Promise.resolve(
                response,
              ),
          );

        const transport =
          createTransport(
            fetchImpl,
          );

        const form = {
          grant_type:
            'refresh_token',

          client_id:
            'synthetic-client-id',

          client_secret:
            'synthetic-secret',

          refresh_token:
            'synthetic-refresh-token',
        };

        const before =
          JSON.stringify(form);

        await transport.request(
          oauthRequest({
            form,
          }),
        );

        expect(
          JSON.stringify(form),
        ).toBe(before);
      },
    );
  },
);
describe('MercadoLivreOAuthFetchTransport adversarial', () => {
  it(
    'sends only method, headers and body in the fetch init object',
    async () => {
      const { response } =
        createResponse({
          body: '{}',
        });

      const fetchImpl =
        jest.fn<FakeFetch>(
          () =>
            Promise.resolve(
              response,
            ),
        );

      const transport =
        createTransport(
          fetchImpl,
        );

      await transport.request(
        oauthRequest(),
      );

      const [, init] =
        fetchImpl.mock.calls[0];

      expect(
        Object.keys(
          init ?? {},
        ).sort(),
      ).toEqual([
        'body',
        'headers',
        'method',
      ]);
    },
  );

  it(
    'does not serialize inherited properties from the form object',
    async () => {
      const { response } =
        createResponse({
          body: '{}',
        });

      const fetchImpl =
        jest.fn<FakeFetch>(
          () =>
            Promise.resolve(
              response,
            ),
        );

      const transport =
        createTransport(
          fetchImpl,
        );

      const prototype = {
        inherited_secret:
          'must-not-be-sent',
      };

      const form =
        Object.create(
          prototype,
        ) as Record<
          string,
          string
        >;

      form.grant_type =
        'refresh_token';

      form.client_id =
        'client-id';

      form.client_secret =
        'client-secret';

      form.refresh_token =
        'refresh-token';

      await transport.request(
        oauthRequest({
          form,
        }),
      );

      const encoded =
        formFromFetchCall(
          fetchImpl,
        );

      expect(
        encoded.get(
          'inherited_secret',
        ),
      ).toBeNull();

      expect(
        encoded.get(
          'refresh_token',
        ),
      ).toBe(
        'refresh-token',
      );
    },
  );

  it(
    'serializes an own __proto__ form key without prototype mutation',
    async () => {
      const { response } =
        createResponse({
          body: '{}',
        });

      const fetchImpl =
        jest.fn<FakeFetch>(
          () =>
            Promise.resolve(
              response,
            ),
        );

      const transport =
        createTransport(
          fetchImpl,
        );

      const form =
        Object.create(
          null,
        ) as Record<
          string,
          string
        >;

      form.grant_type =
        'refresh_token';

      form.client_id =
        'client-id';

      form.client_secret =
        'client-secret';

      form.refresh_token =
        'refresh-token';

      form['__proto__'] =
        'synthetic-value';

      await transport.request(
        oauthRequest({
          form,
        }),
      );

      const encoded =
        formFromFetchCall(
          fetchImpl,
        );

      expect(
        encoded.get(
          '__proto__',
        ),
      ).toBe(
        'synthetic-value',
      );
    },
  );

  it(
    'round-trips unicode and reserved characters through form encoding',
    async () => {
      const { response } =
        createResponse({
          body: '{}',
        });

      const fetchImpl =
        jest.fn<FakeFetch>(
          () =>
            Promise.resolve(
              response,
            ),
        );

      const transport =
        createTransport(
          fetchImpl,
        );

      await transport.request(
        oauthRequest({
          form: {
            grant_type:
              'authorization_code',

            client_id:
              'cliente-á+1',

            client_secret:
              'segredo & valor=✓',

            code:
              'código/ação ? + & =',

            redirect_uri:
              'https://example.test/callback?x=ação&y=1',
          },
        }),
      );

      const encoded =
        formFromFetchCall(
          fetchImpl,
        );

      expect(
        encoded.get(
          'client_id',
        ),
      ).toBe(
        'cliente-á+1',
      );

      expect(
        encoded.get(
          'client_secret',
        ),
      ).toBe(
        'segredo & valor=✓',
      );

      expect(
        encoded.get(
          'code',
        ),
      ).toBe(
        'código/ação ? + & =',
      );

      expect(
        encoded.get(
          'redirect_uri',
        ),
      ).toBe(
        'https://example.test/callback?x=ação&y=1',
      );
    },
  );

  it(
    'preserves explicitly empty form values instead of dropping their keys',
    async () => {
      const { response } =
        createResponse({
          body: '{}',
        });

      const fetchImpl =
        jest.fn<FakeFetch>(
          () =>
            Promise.resolve(
              response,
            ),
        );

      const transport =
        createTransport(
          fetchImpl,
        );

      await transport.request(
        oauthRequest({
          form: {
            grant_type:
              'authorization_code',

            client_id:
              'client-id',

            client_secret:
              '',

            code:
              '',

            redirect_uri:
              '',
          },
        }),
      );

      const encoded =
        formFromFetchCall(
          fetchImpl,
        );

      expect(
        encoded.has(
          'client_secret',
        ),
      ).toBe(true);

      expect(
        encoded.get(
          'client_secret',
        ),
      ).toBe('');

      expect(
        encoded.has(
          'code',
        ),
      ).toBe(true);

      expect(
        encoded.has(
          'redirect_uri',
        ),
      ).toBe(true);
    },
  );

  it(
    'does not mutate the caller headers object',
    async () => {
      const { response } =
        createResponse({
          body: '{}',
        });

      const fetchImpl =
        jest.fn<FakeFetch>(
          () =>
            Promise.resolve(
              response,
            ),
        );

      const transport =
        createTransport(
          fetchImpl,
        );

      const headers = {
        accept:
          'application/json',

        'content-type':
          'application/x-www-form-urlencoded',

        'x-synthetic':
          'preserve-me',
      };

      const before =
        JSON.stringify(
          headers,
        );

      await transport.request(
        oauthRequest({
          headers,
        }),
      );

      expect(
        JSON.stringify(
          headers,
        ),
      ).toBe(before);
    },
  );

  it(
    'works with a frozen request, frozen headers and frozen form',
    async () => {
      const { response } =
        createResponse({
          body: '{}',
        });

      const fetchImpl =
        jest.fn<FakeFetch>(
          () =>
            Promise.resolve(
              response,
            ),
        );

      const transport =
        createTransport(
          fetchImpl,
        );

      const headers =
        Object.freeze({
          accept:
            'application/json',

          'content-type':
            'application/x-www-form-urlencoded',
        });

      const form =
        Object.freeze({
          grant_type:
            'refresh_token',

          client_id:
            'client-id',

          client_secret:
            'client-secret',

          refresh_token:
            'refresh-token',
        });

      const request =
        Object.freeze({
          method:
            'POST' as const,

          path:
            '/oauth/token',

          headers,
          form,
        });

      await expect(
        transport.request(
          request,
        ),
      ).resolves.toEqual(
        expect.objectContaining({
          status:
            200,
        }),
      );
    },
  );

  it(
    'rejects a trailing slash variant of the token path',
    async () => {
      const { response } =
        createResponse({
          body: '{}',
        });

      const fetchImpl =
        jest.fn<FakeFetch>(
          () =>
            Promise.resolve(
              response,
            ),
        );

      const transport =
        createTransport(
          fetchImpl,
        );

      await expect(
        transport.request(
          oauthRequest({
            path:
              '/oauth/token/',
          }),
        ),
      ).rejects.toThrow();

      expect(
        fetchImpl,
      ).not.toHaveBeenCalled();
    },
  );

  it(
    'rejects a case-changed token path',
    async () => {
      const { response } =
        createResponse({
          body: '{}',
        });

      const fetchImpl =
        jest.fn<FakeFetch>(
          () =>
            Promise.resolve(
              response,
            ),
        );

      const transport =
        createTransport(
          fetchImpl,
        );

      await expect(
        transport.request(
          oauthRequest({
            path:
              '/OAuth/token',
          }),
        ),
      ).rejects.toThrow();

      expect(
        fetchImpl,
      ).not.toHaveBeenCalled();
    },
  );

  it(
    'rejects a percent-encoded equivalent token path',
    async () => {
      const { response } =
        createResponse({
          body: '{}',
        });

      const fetchImpl =
        jest.fn<FakeFetch>(
          () =>
            Promise.resolve(
              response,
            ),
        );

      const transport =
        createTransport(
          fetchImpl,
        );

      await expect(
        transport.request(
          oauthRequest({
            path:
              '/oauth/%74oken',
          }),
        ),
      ).rejects.toThrow();

      expect(
        fetchImpl,
      ).not.toHaveBeenCalled();
    },
  );

  it(
    'rejects token paths with leading or trailing whitespace',
    async () => {
      const { response } =
        createResponse({
          body: '{}',
        });

      const fetchImpl =
        jest.fn<FakeFetch>(
          () =>
            Promise.resolve(
              response,
            ),
        );

      const transport =
        createTransport(
          fetchImpl,
        );

      for (
        const path of [
          ' /oauth/token',
          '/oauth/token ',
          "`t/oauth/token",
        ]
      ) {
        await expect(
          transport.request(
            oauthRequest({
              path,
            }),
          ),
        ).rejects.toThrow();
      }

      expect(
        fetchImpl,
      ).not.toHaveBeenCalled();
    },
  );

  it(
    'discards base URL path and query when resolving the fixed token endpoint',
    async () => {
      const { response } =
        createResponse({
          body: '{}',
        });

      const fetchImpl =
        jest.fn<FakeFetch>(
          () =>
            Promise.resolve(
              response,
            ),
        );

      const transport =
        createTransport(
          fetchImpl,
          'https://mercado-livre.test/base/path?leak=1',
        );

      await transport.request(
        oauthRequest(),
      );

      const [rawUrl] =
        fetchImpl.mock.calls[0];

      const url =
        new URL(
          rawUrl,
        );

      expect(
        url.origin,
      ).toBe(
        'https://mercado-livre.test',
      );

      expect(
        url.pathname,
      ).toBe(
        '/oauth/token',
      );

      expect(
        url.search,
      ).toBe('');
    },
  );

  it(
    'parses a JSON primitive response without wrapping it',
    async () => {
      const { response } =
        createResponse({
          body:
            '123',
        });

      const fetchImpl =
        jest.fn<FakeFetch>(
          () =>
            Promise.resolve(
              response,
            ),
        );

      const transport =
        createTransport(
          fetchImpl,
        );

      const result =
        await transport.request(
          oauthRequest(),
        );

      expect(
        result.body,
      ).toBe(123);
    },
  );

  it(
    'parses JSON null as null',
    async () => {
      const { response } =
        createResponse({
          body:
            'null',
        });

      const fetchImpl =
        jest.fn<FakeFetch>(
          () =>
            Promise.resolve(
              response,
            ),
        );

      const transport =
        createTransport(
          fetchImpl,
        );

      const result =
        await transport.request(
          oauthRequest(),
        );

      expect(
        result.body,
      ).toBeNull();
    },
  );

  it(
    'propagates a synchronous fetch failure without retrying',
    async () => {
      const failure =
        new Error(
          'synthetic synchronous fetch failure',
        );

      const fetchImpl =
        jest.fn<FakeFetch>(
          () => {
            throw failure;
          },
        );

      const transport =
        createTransport(
          fetchImpl,
        );

      await expect(
        transport.request(
          oauthRequest(),
        ),
      ).rejects.toBe(
        failure,
      );

      expect(
        fetchImpl,
      ).toHaveBeenCalledTimes(1);
    },
  );
});