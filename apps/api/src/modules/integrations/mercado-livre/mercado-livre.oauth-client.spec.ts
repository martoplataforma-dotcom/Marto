import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

type ExchangeAuthorizationCodeInput = {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
};

type RefreshAccessTokenInput = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

type MercadoLivreOAuthTokenResult = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  scope?: string;
  userId: string;
  refreshToken: string;
};

type MercadoLivreOAuthClientContract = {
  exchangeAuthorizationCode(
    input: ExchangeAuthorizationCodeInput,
  ): Promise<MercadoLivreOAuthTokenResult>;

  refreshAccessToken(
    input: RefreshAccessTokenInput,
  ): Promise<MercadoLivreOAuthTokenResult>;
};

type MercadoLivreOAuthClientModule = {
  MercadoLivreOAuthClient: new (
    transport: MercadoLivreOAuthHttpTransport,
  ) => MercadoLivreOAuthClientContract;

  MercadoLivreOAuthHttpError: typeof Error;
};

type TransportMock = {
  request: jest.MockedFunction<
    MercadoLivreOAuthHttpTransport['request']
  >;
};

const AUTHORIZATION_INPUT: ExchangeAuthorizationCodeInput = {
  clientId: 'synthetic-client-id',
  clientSecret: 'synthetic-client-secret',
  code: 'synthetic-authorization-code',
  redirectUri: 'https://example.test/oauth/callback',
};

const REFRESH_INPUT: RefreshAccessTokenInput = {
  clientId: 'synthetic-client-id',
  clientSecret: 'synthetic-client-secret',
  refreshToken: 'synthetic-old-refresh-token',
};

function loadOAuthModule(): MercadoLivreOAuthClientModule {
  return jest.requireActual<MercadoLivreOAuthClientModule>(
    './mercado-livre.oauth-client',
  );
}

function createTransport(
  response: MercadoLivreOAuthHttpResponse,
): TransportMock {
  const request: jest.MockedFunction<
    MercadoLivreOAuthHttpTransport['request']
  > = jest.fn();

  request.mockResolvedValue(response);

  return {
    request,
  };
}

function createRejectingTransport(
  error: Error,
): TransportMock {
  const request: jest.MockedFunction<
    MercadoLivreOAuthHttpTransport['request']
  > = jest.fn();

  request.mockRejectedValue(error);

  return {
    request,
  };
}

function createClient(
  transport: MercadoLivreOAuthHttpTransport,
): MercadoLivreOAuthClientContract {
  const module = loadOAuthModule();

  return new module.MercadoLivreOAuthClient(
    transport,
  );
}

function validOAuthResponse(
  overrides: Record<string, unknown> = {},
): MercadoLivreOAuthHttpResponse {
  return {
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
    body: {
      access_token: 'synthetic-new-access-token',
      token_type: 'Bearer',
      expires_in: 21600,
      scope: 'read write',
      user_id: 123456789,
      refresh_token: 'synthetic-new-refresh-token',
      ...overrides,
    },
  };
}

async function captureRejection(
  promise: Promise<unknown>,
): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error(
    'Expected promise to reject.',
  );
}

describe('MercadoLivreOAuthClient', () => {
  it('uses POST for authorization code exchange', async () => {
    const transport =
      createTransport(
        validOAuthResponse(),
      );

    const client =
      createClient(transport);

    await client.exchangeAuthorizationCode(
      AUTHORIZATION_INPUT,
    );

    expect(
      transport.request,
    ).toHaveBeenCalledTimes(1);

    expect(
      transport.request,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('uses exactly /oauth/token for authorization code exchange', async () => {
    const transport =
      createTransport(
        validOAuthResponse(),
      );

    const client =
      createClient(transport);

    await client.exchangeAuthorizationCode(
      AUTHORIZATION_INPUT,
    );

    expect(
      transport.request,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/oauth/token',
      }),
    );
  });

  it('sends accept application/json', async () => {
    const transport =
      createTransport(
        validOAuthResponse(),
      );

    const client =
      createClient(transport);

    await client.exchangeAuthorizationCode(
      AUTHORIZATION_INPUT,
    );

    expect(
      transport.request,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: 'application/json',
        }),
      }),
    );
  });

  it('sends content-type application/x-www-form-urlencoded', async () => {
    const transport =
      createTransport(
        validOAuthResponse(),
      );

    const client =
      createClient(transport);

    await client.exchangeAuthorizationCode(
      AUTHORIZATION_INPUT,
    );

    expect(
      transport.request,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'content-type':
            'application/x-www-form-urlencoded',
        }),
      }),
    );
  });

  it('uses authorization_code as the authorization grant type', async () => {
    const transport =
      createTransport(
        validOAuthResponse(),
      );

    const client =
      createClient(transport);

    await client.exchangeAuthorizationCode(
      AUTHORIZATION_INPUT,
    );

    expect(
      transport.request,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        form: expect.objectContaining({
          grant_type:
            'authorization_code',
        }),
      }),
    );
  });

  it('sends the expected authorization code form fields', async () => {
    const transport =
      createTransport(
        validOAuthResponse(),
      );

    const client =
      createClient(transport);

    await client.exchangeAuthorizationCode(
      AUTHORIZATION_INPUT,
    );

    expect(
      transport.request,
    ).toHaveBeenCalledWith({
      method: 'POST',
      path: '/oauth/token',
      headers: {
        accept: 'application/json',
        'content-type':
          'application/x-www-form-urlencoded',
      },
      form: {
        grant_type:
          'authorization_code',
        client_id:
          'synthetic-client-id',
        client_secret:
          'synthetic-client-secret',
        code:
          'synthetic-authorization-code',
        redirect_uri:
          'https://example.test/oauth/callback',
      },
    });
  });

  it('includes code_verifier when provided', async () => {
    const transport =
      createTransport(
        validOAuthResponse(),
      );

    const client =
      createClient(transport);

    await client.exchangeAuthorizationCode({
      ...AUTHORIZATION_INPUT,
      codeVerifier:
        'synthetic-code-verifier',
    });

    expect(
      transport.request,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        form: expect.objectContaining({
          code_verifier:
            'synthetic-code-verifier',
        }),
      }),
    );
  });

  it('omits code_verifier when absent', async () => {
    const transport =
      createTransport(
        validOAuthResponse(),
      );

    const client =
      createClient(transport);

    await client.exchangeAuthorizationCode(
      AUTHORIZATION_INPUT,
    );

    const request =
      transport.request.mock.calls[0][0];

    expect(
      request.form,
    ).not.toHaveProperty(
      'code_verifier',
    );
  });

  it('uses POST /oauth/token for refresh', async () => {
    const transport =
      createTransport(
        validOAuthResponse(),
      );

    const client =
      createClient(transport);

    await client.refreshAccessToken(
      REFRESH_INPUT,
    );

    expect(
      transport.request,
    ).toHaveBeenCalledTimes(1);

    expect(
      transport.request,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/oauth/token',
      }),
    );
  });

  it('uses refresh_token as the refresh grant type', async () => {
    const transport =
      createTransport(
        validOAuthResponse(),
      );

    const client =
      createClient(transport);

    await client.refreshAccessToken(
      REFRESH_INPUT,
    );

    expect(
      transport.request,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        form: expect.objectContaining({
          grant_type:
            'refresh_token',
        }),
      }),
    );
  });

  it('sends only the expected OAuth fields for refresh', async () => {
    const transport =
      createTransport(
        validOAuthResponse(),
      );

    const client =
      createClient(transport);

    await client.refreshAccessToken(
      REFRESH_INPUT,
    );

    expect(
      transport.request,
    ).toHaveBeenCalledWith({
      method: 'POST',
      path: '/oauth/token',
      headers: {
        accept: 'application/json',
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
          'synthetic-old-refresh-token',
      },
    });
  });

  it('does not send OAuth secrets through query parameters', async () => {
    const transport =
      createTransport(
        validOAuthResponse(),
      );

    const client =
      createClient(transport);

    await client.exchangeAuthorizationCode(
      AUTHORIZATION_INPUT,
    );

    const request =
      transport.request.mock.calls[0][0];

    expect(
      request,
    ).not.toHaveProperty(
      'query',
    );

    expect(
      request.path,
    ).toBe('/oauth/token');
  });

  it('normalizes a valid OAuth token response', async () => {
    const transport =
      createTransport(
        validOAuthResponse(),
      );

    const client =
      createClient(transport);

    const result =
      await client.exchangeAuthorizationCode(
        AUTHORIZATION_INPUT,
      );

    expect(result).toEqual({
      accessToken:
        'synthetic-new-access-token',
      tokenType:
        'Bearer',
      expiresIn:
        21600,
      scope:
        'read write',
      userId:
        '123456789',
      refreshToken:
        'synthetic-new-refresh-token',
    });
  });

  it('normalizes numeric user_id to string', async () => {
    const transport =
      createTransport(
        validOAuthResponse({
          user_id: 987654321,
        }),
      );

    const client =
      createClient(transport);

    const result =
      await client.exchangeAuthorizationCode(
        AUTHORIZATION_INPUT,
      );

    expect(
      result.userId,
    ).toBe(
      '987654321',
    );
  });

  it('preserves the expires_in returned by the provider without hardcoding it', async () => {
    const transport =
      createTransport(
        validOAuthResponse({
          expires_in: 12345,
        }),
      );

    const client =
      createClient(transport);

    const result =
      await client.exchangeAuthorizationCode(
        AUTHORIZATION_INPUT,
      );

    expect(
      result.expiresIn,
    ).toBe(12345);
  });

  it('returns the new refresh_token to the caller', async () => {
    const transport =
      createTransport(
        validOAuthResponse({
          refresh_token:
            'synthetic-rotated-refresh-token',
        }),
      );

    const client =
      createClient(transport);

    const result =
      await client.refreshAccessToken(
        REFRESH_INPUT,
      );

    expect(
      result.refreshToken,
    ).toBe(
      'synthetic-rotated-refresh-token',
    );
  });

  it('fails invalid OAuth payloads with a sanitized error', async () => {
    const transport =
      createTransport({
        status: 200,
        body: {
          access_token:
            'must-not-leak-access-token',
          token_type:
            'Bearer',
          expires_in:
            0,
          user_id:
            123,
        },
      });

    const client =
      createClient(transport);

    const error =
      await captureRejection(
        client.exchangeAuthorizationCode(
          AUTHORIZATION_INPUT,
        ),
      );

    expect(error).toBeInstanceOf(
      Error,
    );

    expect(
      (error as Error).message,
    ).toBe(
      'Mercado Livre OAuth returned an invalid token payload.',
    );

    expect(
      (error as Error).message,
    ).not.toContain(
      'must-not-leak-access-token',
    );

    expect(
      (error as Error).message,
    ).not.toContain(
      AUTHORIZATION_INPUT.clientSecret,
    );
  });

  it('uses MercadoLivreOAuthHttpError for unsuccessful HTTP responses', async () => {
    const module =
      loadOAuthModule();

    const transport =
      createTransport({
        status: 400,
        body: {
          error:
            'bad_request',
          error_description:
            'synthetic-sensitive-description',
        },
      });

    const client =
      new module.MercadoLivreOAuthClient(
        transport,
      );

    const error =
      await captureRejection(
        client.exchangeAuthorizationCode(
          AUTHORIZATION_INPUT,
        ),
      );

    expect(error).toBeInstanceOf(
      module.MercadoLivreOAuthHttpError,
    );

    expect(
      (error as { status?: unknown }).status,
    ).toBe(400);

    expect(
      (error as Error).message,
    ).not.toContain(
      'synthetic-sensitive-description',
    );
  });

  it('exposes invalid_grant only as a sanitized OAuth code', async () => {
    const module =
      loadOAuthModule();

    const transport =
      createTransport({
        status: 400,
        body: {
          error:
            'invalid_grant',
          error_description:
            'authorization code or refresh token details must not leak',
        },
      });

    const client =
      new module.MercadoLivreOAuthClient(
        transport,
      );

    const error =
      await captureRejection(
        client.refreshAccessToken(
          REFRESH_INPUT,
        ),
      );

    expect(error).toBeInstanceOf(
      module.MercadoLivreOAuthHttpError,
    );

    expect(
      (error as { oauthCode?: unknown }).oauthCode,
    ).toBe(
      'invalid_grant',
    );

    expect(
      (error as Error).message,
    ).not.toContain(
      'authorization code or refresh token details must not leak',
    );

    expect(
      (error as Error).message,
    ).not.toContain(
      REFRESH_INPUT.refreshToken,
    );
  });

  it('keeps 429 and 5xx as HTTP errors without reauthorization decisions', async () => {
    const module =
      loadOAuthModule();

    for (const status of [429, 500]) {
      const transport =
        createTransport({
          status,
          body: {
            error:
              'temporarily_unavailable',
          },
        });

      const client =
        new module.MercadoLivreOAuthClient(
          transport,
        );

      const error =
        await captureRejection(
          client.refreshAccessToken(
            REFRESH_INPUT,
          ),
        );

      expect(error).toBeInstanceOf(
        module.MercadoLivreOAuthHttpError,
      );

      expect(
        (error as { status?: unknown }).status,
      ).toBe(status);

      expect(
        error,
      ).not.toHaveProperty(
        'reauthRequired',
      );
    }
  });

  it('propagates transport network errors without retrying', async () => {
    const networkError =
      new Error(
        'synthetic-network-failure',
      );

    const transport =
      createRejectingTransport(
        networkError,
      );

    const client =
      createClient(transport);

    await expect(
      client.exchangeAuthorizationCode(
        AUTHORIZATION_INPUT,
      ),
    ).rejects.toBe(
      networkError,
    );

    expect(
      transport.request,
    ).toHaveBeenCalledTimes(1);
  });

  it('calls the transport exactly once per public operation', async () => {
    const authorizationTransport =
      createTransport(
        validOAuthResponse(),
      );

    const authorizationClient =
      createClient(
        authorizationTransport,
      );

    await authorizationClient
      .exchangeAuthorizationCode(
        AUTHORIZATION_INPUT,
      );

    expect(
      authorizationTransport.request,
    ).toHaveBeenCalledTimes(1);

    const refreshTransport =
      createTransport(
        validOAuthResponse(),
      );

    const refreshClient =
      createClient(
        refreshTransport,
      );

    await refreshClient
      .refreshAccessToken(
        REFRESH_INPUT,
      );

    expect(
      refreshTransport.request,
    ).toHaveBeenCalledTimes(1);
  });

  it('keeps the OAuth client free of Prisma, ConfigService, process.env, crypto service, fetch and logs', () => {
    createClient(
      createTransport(
        validOAuthResponse(),
      ),
    );

    const source =
      readFileSync(
        join(
          __dirname,
          'mercado-livre.oauth-client.ts',
        ),
        'utf8',
      );

    for (const forbidden of [
      'Prisma',
      'ConfigService',
      'process.env',
      'SalesChannelCredentialCryptoService',
      'console.log',
      'console.error',
      'Logger',
      'fetch(',
      'axios',
      '@nestjs/',
    ]) {
      expect(
        source,
      ).not.toContain(
        forbidden,
      );
    }
  });

  it('keeps the existing MercadoLivreClient and GET transport separate from OAuth', () => {
    createClient(
      createTransport(
        validOAuthResponse(),
      ),
    );

    const currentClientSource =
      readFileSync(
        join(
          __dirname,
          'mercado-livre.client.ts',
        ),
        'utf8',
      );

    const currentFetchSource =
      readFileSync(
        join(
          __dirname,
          'mercado-livre.fetch-transport.ts',
        ),
        'utf8',
      );

    expect(
      currentClientSource,
    ).not.toContain(
      'MercadoLivreOAuthClient',
    );

    expect(
      currentClientSource,
    ).not.toContain(
      '/oauth/token',
    );

    expect(
      currentFetchSource,
    ).not.toContain(
      'MercadoLivreOAuthHttpTransport',
    );

    expect(
      currentFetchSource,
    ).not.toContain(
      '/oauth/token',
    );
  });
});

describe('MercadoLivreOAuthClient adversarial audit', () => {
  it('omits scope from the normalized result when the provider omits it', async () => {
    const transport =
      createTransport({
        status: 200,
        body: {
          access_token:
            'synthetic-access-token',
          token_type:
            'Bearer',
          expires_in:
            3600,
          user_id:
            123456,
          refresh_token:
            'synthetic-refresh-token',
        },
      });

    const client =
      createClient(transport);

    const result =
      await client.exchangeAuthorizationCode(
        AUTHORIZATION_INPUT,
      );

    expect(result).toEqual({
      accessToken:
        'synthetic-access-token',
      tokenType:
        'Bearer',
      expiresIn:
        3600,
      userId:
        '123456',
      refreshToken:
        'synthetic-refresh-token',
    });

    expect(result).not.toHaveProperty(
      'scope',
    );
  });

  it('preserves a valid string user_id as the external account identity', async () => {
    const transport =
      createTransport(
        validOAuthResponse({
          user_id:
            'external-user-123',
        }),
      );

    const client =
      createClient(transport);

    const result =
      await client.exchangeAuthorizationCode(
        AUTHORIZATION_INPUT,
      );

    expect(result.userId).toBe(
      'external-user-123',
    );
  });

  it('rejects malformed token payload variants with the same sanitized error', async () => {
    const invalidBodies: unknown[] = [
      null,
      [],
      {},
      {
        access_token: '   ',
        token_type: 'Bearer',
        expires_in: 3600,
        user_id: 123,
        refresh_token: 'refresh',
      },
      {
        access_token: 'access',
        token_type: '   ',
        expires_in: 3600,
        user_id: 123,
        refresh_token: 'refresh',
      },
      {
        access_token: 'access',
        token_type: 'Bearer',
        expires_in: 0,
        user_id: 123,
        refresh_token: 'refresh',
      },
      {
        access_token: 'access',
        token_type: 'Bearer',
        expires_in: Number.POSITIVE_INFINITY,
        user_id: 123,
        refresh_token: 'refresh',
      },
      {
        access_token: 'access',
        token_type: 'Bearer',
        expires_in: 3600,
        user_id: '   ',
        refresh_token: 'refresh',
      },
      {
        access_token: 'access',
        token_type: 'Bearer',
        expires_in: 3600,
        user_id: 123,
        refresh_token: '   ',
      },
      {
        access_token: 'access',
        token_type: 'Bearer',
        expires_in: 3600,
        user_id: 123,
        refresh_token: 'refresh',
        scope: 123,
      },
    ];

    for (const body of invalidBodies) {
      const transport =
        createTransport({
          status: 200,
          body,
        });

      const client =
        createClient(transport);

      const error =
        await captureRejection(
          client.exchangeAuthorizationCode(
            AUTHORIZATION_INPUT,
          ),
        );

      expect(error).toBeInstanceOf(
        Error,
      );

      expect(
        (error as Error).message,
      ).toBe(
        'Mercado Livre OAuth returned an invalid token payload.',
      );

      expect(
        (error as Error).message,
      ).not.toContain(
        AUTHORIZATION_INPUT.clientSecret,
      );

      expect(
        transport.request,
      ).toHaveBeenCalledTimes(1);
    }
  });

  it('keeps oauthCode undefined when an HTTP error body is not an object', async () => {
    const module =
      loadOAuthModule();

    const transport =
      createTransport({
        status: 502,
        body:
          'synthetic-upstream-body',
      });

    const client =
      new module.MercadoLivreOAuthClient(
        transport,
      );

    const error =
      await captureRejection(
        client.refreshAccessToken(
          REFRESH_INPUT,
        ),
      );

    expect(error).toBeInstanceOf(
      module.MercadoLivreOAuthHttpError,
    );

    expect(
      (error as { status?: unknown }).status,
    ).toBe(502);

    expect(
      (error as { oauthCode?: unknown }).oauthCode,
    ).toBeUndefined();

    expect(
      (error as Error).message,
    ).not.toContain(
      'synthetic-upstream-body',
    );
  });

  it('ignores blank or non-string OAuth error codes', async () => {
    const module =
      loadOAuthModule();

    for (const oauthCode of [
      '',
      '   ',
      123,
      null,
    ]) {
      const transport =
        createTransport({
          status: 400,
          body: {
            error:
              oauthCode,
          },
        });

      const client =
        new module.MercadoLivreOAuthClient(
          transport,
        );

      const error =
        await captureRejection(
          client.refreshAccessToken(
            REFRESH_INPUT,
          ),
        );

      expect(error).toBeInstanceOf(
        module.MercadoLivreOAuthHttpError,
      );

      expect(
        (error as { oauthCode?: unknown }).oauthCode,
      ).toBeUndefined();
    }
  });

  it('never places request secrets or OAuth response descriptions in HTTP error messages', async () => {
    const module =
      loadOAuthModule();

    const sensitiveDescription =
      'synthetic description containing sensitive context';

    const transport =
      createTransport({
        status: 400,
        body: {
          error:
            'invalid_grant',
          error_description:
            sensitiveDescription,
          access_token:
            'must-not-leak-access',
          refresh_token:
            'must-not-leak-refresh',
        },
      });

    const client =
      new module.MercadoLivreOAuthClient(
        transport,
      );

    const error =
      await captureRejection(
        client.exchangeAuthorizationCode(
          AUTHORIZATION_INPUT,
        ),
      );

    const message =
      (error as Error).message;

    expect(message).toBe(
      'Mercado Livre OAuth failed with HTTP 400.',
    );

    for (const secret of [
      AUTHORIZATION_INPUT.clientSecret,
      AUTHORIZATION_INPUT.code,
      sensitiveDescription,
      'must-not-leak-access',
      'must-not-leak-refresh',
    ]) {
      expect(message).not.toContain(
        secret,
      );
    }
  });

  it('sends exactly the planned authorization fields when code_verifier is present', async () => {
    const transport =
      createTransport(
        validOAuthResponse(),
      );

    const client =
      createClient(transport);

    await client.exchangeAuthorizationCode({
      ...AUTHORIZATION_INPUT,
      codeVerifier:
        'synthetic-code-verifier',
    });

    expect(
      transport.request,
    ).toHaveBeenCalledWith({
      method: 'POST',
      path: '/oauth/token',
      headers: {
        accept:
          'application/json',
        'content-type':
          'application/x-www-form-urlencoded',
      },
      form: {
        grant_type:
          'authorization_code',
        client_id:
          'synthetic-client-id',
        client_secret:
          'synthetic-client-secret',
        code:
          'synthetic-authorization-code',
        redirect_uri:
          'https://example.test/oauth/callback',
        code_verifier:
          'synthetic-code-verifier',
      },
    });
  });

  it('does not expose orchestration, persistence or operational refresh state in the OAuth client source', () => {
    const source =
      readFileSync(
        join(
          __dirname,
          'mercado-livre.oauth-client.ts',
        ),
        'utf8',
      );

    for (const forbidden of [
      'REAUTH_REQUIRED',
      'ROTATION_UNCERTAIN',
      'REFRESHING',
      'refreshAttemptId',
      'tokenGeneration',
      'accessTokenExpiresAt',
      'SalesChannel',
      'merchantId',
      'salesChannelId',
      'PrismaService',
      'Redis',
      'BullMQ',
      'setTimeout',
    ]) {
      expect(source).not.toContain(
        forbidden,
      );
    }
  });
});