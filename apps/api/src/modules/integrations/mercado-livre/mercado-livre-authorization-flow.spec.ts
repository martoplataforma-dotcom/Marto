import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type AuthorizationMode =
  | 'CONNECT'
  | 'RECONNECT';

type BeginAuthorizationInput = {
  initiatorUserId: string;
  merchantId: string;
  mode: AuthorizationMode;
  salesChannelId?: string;
};

type CompleteAuthorizationInput = {
  state: string;
  code: string;
};

type MercadoLivreAuthorizationIntent = {
  state: string;
  initiatorUserId: string;
  merchantId: string;
  mode: AuthorizationMode;
  salesChannelId?: string;
  expectedExternalAccountId?: string;
  codeVerifier?: string;
  expiresAt: Date;
};

type MercadoLivreAuthorizationTargetContext = {
  initiatorUserId: string;
  merchantId: string;
  mode: AuthorizationMode;
  salesChannelId?: string;
  expectedExternalAccountId?: string;
};

type RevalidateReconnectInput = {
  initiatorUserId: string;
  merchantId: string;
  salesChannelId: string;
  expectedExternalAccountId: string;
};

type MercadoLivreOAuthTokenResult = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  scope?: string;
  userId: string;
  refreshToken: string;
};

type ExchangeAuthorizationCodeInput = {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
};

type MercadoLivreAuthorizationResult = {
  initiatorUserId: string;
  merchantId: string;
  mode: AuthorizationMode;
  salesChannelId?: string;
  authorizedExternalAccountId: string;
  token: MercadoLivreOAuthTokenResult;
};

type MercadoLivreAuthorizationStateGenerator = {
  generate(): string;
};

type MercadoLivreAuthorizationStateStore = {
  save(
    intent: MercadoLivreAuthorizationIntent,
  ): Promise<void>;

  consume(
    state: string,
  ): Promise<
    MercadoLivreAuthorizationIntent | undefined
  >;
};

type MercadoLivrePkceGenerator = {
  generate(): {
    codeVerifier: string;
    codeChallenge: string;
  };
};

type MercadoLivreAuthorizationTargetPort = {
  resolveForBegin(
    input: BeginAuthorizationInput,
  ): Promise<MercadoLivreAuthorizationTargetContext>;

  revalidateReconnect(
    input: RevalidateReconnectInput,
  ): Promise<void>;
};

type MercadoLivreOAuthClientPort = {
  exchangeAuthorizationCode(
    input: ExchangeAuthorizationCodeInput,
  ): Promise<MercadoLivreOAuthTokenResult>;
};

type MercadoLivreAuthorizationClock = {
  now(): Date;
};

type MercadoLivreAuthorizationConfig = {
  authorizationUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  stateTtlMs: number;
  pkceEnabled: boolean;
};

type MercadoLivreAuthorizationDependencies = {
  stateGenerator:
    MercadoLivreAuthorizationStateGenerator;
  stateStore:
    MercadoLivreAuthorizationStateStore;
  pkceGenerator:
    MercadoLivrePkceGenerator;
  target:
    MercadoLivreAuthorizationTargetPort;
  oauthClient:
    MercadoLivreOAuthClientPort;
  clock:
    MercadoLivreAuthorizationClock;
  config:
    MercadoLivreAuthorizationConfig;
};

type BeginAuthorizationResult = {
  state: string;
  authorizationUrl: string;
};

type MercadoLivreAuthorizationFlowContract = {
  beginAuthorization(
    input: BeginAuthorizationInput,
  ): Promise<BeginAuthorizationResult>;

  completeAuthorization(
    input: CompleteAuthorizationInput,
  ): Promise<MercadoLivreAuthorizationResult>;
};

type MercadoLivreAuthorizationFlowModule = {
  MercadoLivreAuthorizationFlow: new (
    dependencies:
      MercadoLivreAuthorizationDependencies,
  ) => MercadoLivreAuthorizationFlowContract;

  MercadoLivreAuthorizationFlowError:
    new (...args: unknown[]) => Error;
};

type TestDependencies = {
  dependencies:
    MercadoLivreAuthorizationDependencies;

  stateGenerator: {
    generate: jest.MockedFunction<
      MercadoLivreAuthorizationStateGenerator['generate']
    >;
  };

  stateStore: {
    save: jest.MockedFunction<
      MercadoLivreAuthorizationStateStore['save']
    >;

    consume: jest.MockedFunction<
      MercadoLivreAuthorizationStateStore['consume']
    >;
  };

  pkceGenerator: {
    generate: jest.MockedFunction<
      MercadoLivrePkceGenerator['generate']
    >;
  };

  target: {
    resolveForBegin: jest.MockedFunction<
      MercadoLivreAuthorizationTargetPort['resolveForBegin']
    >;

    revalidateReconnect: jest.MockedFunction<
      MercadoLivreAuthorizationTargetPort['revalidateReconnect']
    >;
  };

  oauthClient: {
    exchangeAuthorizationCode:
      jest.MockedFunction<
        MercadoLivreOAuthClientPort['exchangeAuthorizationCode']
      >;
  };

  clock: {
    now: jest.MockedFunction<
      MercadoLivreAuthorizationClock['now']
    >;
  };

  config:
    MercadoLivreAuthorizationConfig;
};

const NOW =
  new Date(
    '2026-11-08T15:00:00.000Z',
  );

const OPAQUE_STATE =
  'opaque-random-state-7bb21fdc';

const CODE_VERIFIER =
  'synthetic-server-side-code-verifier';

const CODE_CHALLENGE =
  'synthetic-s256-code-challenge';

const CONNECT_INPUT: BeginAuthorizationInput = {
  initiatorUserId:
    'user-synthetic-1',
  merchantId:
    'merchant-synthetic-1',
  mode:
    'CONNECT',
};

const RECONNECT_INPUT: BeginAuthorizationInput = {
  initiatorUserId:
    'user-synthetic-1',
  merchantId:
    'merchant-synthetic-1',
  mode:
    'RECONNECT',
  salesChannelId:
    'channel-synthetic-1',
};

const TOKEN_RESULT: MercadoLivreOAuthTokenResult = {
  accessToken:
    'synthetic-access-token',
  tokenType:
    'Bearer',
  expiresIn:
    21600,
  scope:
    'read write',
  userId:
    'external-account-123',
  refreshToken:
    'synthetic-refresh-token',
};

const DEFAULT_CONFIG:
  MercadoLivreAuthorizationConfig = {
    authorizationUrl:
      'https://auth.example.test/authorization',
    clientId:
      'synthetic-client-id',
    clientSecret:
      'synthetic-client-secret',
    redirectUri:
      'https://marto.example.test/oauth/callback',
    stateTtlMs:
      10 * 60 * 1000,
    pkceEnabled:
      false,
  };

function loadFlowModule():
  MercadoLivreAuthorizationFlowModule {
  return jest.requireActual<
    MercadoLivreAuthorizationFlowModule
  >(
    './mercado-livre-authorization-flow',
  );
}

function connectIntent(
  overrides:
    Partial<MercadoLivreAuthorizationIntent> = {},
): MercadoLivreAuthorizationIntent {
  return {
    state:
      OPAQUE_STATE,
    initiatorUserId:
      CONNECT_INPUT.initiatorUserId,
    merchantId:
      CONNECT_INPUT.merchantId,
    mode:
      'CONNECT',
    expiresAt:
      new Date(
        NOW.getTime() +
        DEFAULT_CONFIG.stateTtlMs,
      ),
    ...overrides,
  };
}

function reconnectIntent(
  overrides:
    Partial<MercadoLivreAuthorizationIntent> = {},
): MercadoLivreAuthorizationIntent {
  return {
    state:
      OPAQUE_STATE,
    initiatorUserId:
      RECONNECT_INPUT.initiatorUserId,
    merchantId:
      RECONNECT_INPUT.merchantId,
    mode:
      'RECONNECT',
    salesChannelId:
      'channel-synthetic-1',
    expectedExternalAccountId:
      'external-account-123',
    expiresAt:
      new Date(
        NOW.getTime() +
        DEFAULT_CONFIG.stateTtlMs,
      ),
    ...overrides,
  };
}

function createDependencies(
  overrides: {
    config?:
      Partial<MercadoLivreAuthorizationConfig>;
    consumedIntent?:
      MercadoLivreAuthorizationIntent | undefined;
    tokenResult?:
      MercadoLivreOAuthTokenResult;
  } = {},
): TestDependencies {
  const stateGenerator = {
    generate:
      jest.fn<
        ReturnType<
          MercadoLivreAuthorizationStateGenerator['generate']
        >,
        Parameters<
          MercadoLivreAuthorizationStateGenerator['generate']
        >
      >(),
  };

  stateGenerator.generate
    .mockReturnValue(
      OPAQUE_STATE,
    );

  const stateStore = {
    save:
      jest.fn<
        ReturnType<
          MercadoLivreAuthorizationStateStore['save']
        >,
        Parameters<
          MercadoLivreAuthorizationStateStore['save']
        >
      >(),

    consume:
      jest.fn<
        ReturnType<
          MercadoLivreAuthorizationStateStore['consume']
        >,
        Parameters<
          MercadoLivreAuthorizationStateStore['consume']
        >
      >(),
  };

  stateStore.save
    .mockResolvedValue(undefined);

  if (
    Object.prototype.hasOwnProperty.call(
      overrides,
      'consumedIntent',
    )
  ) {
    stateStore.consume
      .mockResolvedValue(
        overrides.consumedIntent,
      );
  } else {
    stateStore.consume
      .mockResolvedValue(
        connectIntent(),
      );
  }

  const pkceGenerator = {
    generate:
      jest.fn<
        ReturnType<
          MercadoLivrePkceGenerator['generate']
        >,
        Parameters<
          MercadoLivrePkceGenerator['generate']
        >
      >(),
  };

  pkceGenerator.generate
    .mockReturnValue({
      codeVerifier:
        CODE_VERIFIER,
      codeChallenge:
        CODE_CHALLENGE,
    });

  const target = {
    resolveForBegin:
      jest.fn<
        ReturnType<
          MercadoLivreAuthorizationTargetPort['resolveForBegin']
        >,
        Parameters<
          MercadoLivreAuthorizationTargetPort['resolveForBegin']
        >
      >(),

    revalidateReconnect:
      jest.fn<
        ReturnType<
          MercadoLivreAuthorizationTargetPort['revalidateReconnect']
        >,
        Parameters<
          MercadoLivreAuthorizationTargetPort['revalidateReconnect']
        >
      >(),
  };

  target.resolveForBegin
    .mockImplementation(
      async (
        input:
          BeginAuthorizationInput,
      ) => {
        if (
          input.mode ===
          'RECONNECT'
        ) {
          return {
            initiatorUserId:
              input.initiatorUserId,
            merchantId:
              input.merchantId,
            mode:
              'RECONNECT',
            salesChannelId:
              input.salesChannelId,
            expectedExternalAccountId:
              'external-account-123',
          };
        }

        return {
          initiatorUserId:
            input.initiatorUserId,
          merchantId:
            input.merchantId,
          mode:
            'CONNECT',
        };
      },
    );

  target.revalidateReconnect
    .mockResolvedValue(undefined);

  const oauthClient = {
    exchangeAuthorizationCode:
      jest.fn<
        ReturnType<
          MercadoLivreOAuthClientPort['exchangeAuthorizationCode']
        >,
        Parameters<
          MercadoLivreOAuthClientPort['exchangeAuthorizationCode']
        >
      >(),
  };

  oauthClient.exchangeAuthorizationCode
    .mockResolvedValue(
      overrides.tokenResult ??
      TOKEN_RESULT,
    );

  const clock = {
    now:
      jest.fn<
        ReturnType<
          MercadoLivreAuthorizationClock['now']
        >,
        Parameters<
          MercadoLivreAuthorizationClock['now']
        >
      >(),
  };

  clock.now
    .mockReturnValue(
      new Date(NOW),
    );

  const config = {
    ...DEFAULT_CONFIG,
    ...overrides.config,
  };

  return {
    dependencies: {
      stateGenerator,
      stateStore,
      pkceGenerator,
      target,
      oauthClient,
      clock,
      config,
    },
    stateGenerator,
    stateStore,
    pkceGenerator,
    target,
    oauthClient,
    clock,
    config,
  };
}

function createFlow(
  testDependencies:
    TestDependencies,
): MercadoLivreAuthorizationFlowContract {
  const module =
    loadFlowModule();

  return new module
    .MercadoLivreAuthorizationFlow(
      testDependencies.dependencies,
    );
}

function parseAuthorizationUrl(
  value: string,
): URL {
  return new URL(value);
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

describe(
  'MercadoLivreAuthorizationFlow RED contracts',
  () => {
    it('1. CONNECT validates trusted backend context before generating authorization state', async () => {
      const test =
        createDependencies();

      const flow =
        createFlow(test);

      await flow.beginAuthorization(
        CONNECT_INPUT,
      );

      expect(
        test.target.resolveForBegin,
      ).toHaveBeenCalledWith(
        CONNECT_INPUT,
      );

      expect(
        test.target.resolveForBegin
          .mock.invocationCallOrder[0],
      ).toBeLessThan(
        test.stateGenerator.generate
          .mock.invocationCallOrder[0],
      );
    });

    it('2. CONNECT does not require salesChannelId', async () => {
      const test =
        createDependencies();

      const flow =
        createFlow(test);

      await expect(
        flow.beginAuthorization(
          CONNECT_INPUT,
        ),
      ).resolves.toEqual(
        expect.objectContaining({
          state:
            OPAQUE_STATE,
        }),
      );

      expect(
        test.target.resolveForBegin,
      ).toHaveBeenCalledWith(
        expect.not.objectContaining({
          salesChannelId:
            expect.anything(),
        }),
      );
    });

    it('3. RECONNECT requires salesChannelId', async () => {
      const test =
        createDependencies();

      const flow =
        createFlow(test);

      await expect(
        flow.beginAuthorization({
          initiatorUserId:
            'user-synthetic-1',
          merchantId:
            'merchant-synthetic-1',
          mode:
            'RECONNECT',
        }),
      ).rejects.toBeInstanceOf(
        Error,
      );

      expect(
        test.target.resolveForBegin,
      ).not.toHaveBeenCalled();
    });

    it('4. RECONNECT obtains expectedExternalAccountId from the target port rather than browser input', async () => {
      const test =
        createDependencies();

      const flow =
        createFlow(test);

      await flow.beginAuthorization({
        ...RECONNECT_INPUT,
        ...({
          expectedExternalAccountId:
            'attacker-controlled-account',
        } as Record<string, unknown>),
      } as BeginAuthorizationInput);

      expect(
        test.stateStore.save,
      ).toHaveBeenCalledTimes(1);

      const saved =
        test.stateStore.save
          .mock.calls[0][0];

      expect(
        saved.expectedExternalAccountId,
      ).toBe(
        'external-account-123',
      );

      expect(
        saved.expectedExternalAccountId,
      ).not.toBe(
        'attacker-controlled-account',
      );
    });

    it('5. invalid target context prevents authorization intent creation', async () => {
      const test =
        createDependencies();

      const targetError =
        new Error(
          'synthetic-target-invalid',
        );

      test.target.resolveForBegin
        .mockRejectedValue(
          targetError,
        );

      const flow =
        createFlow(test);

      await expect(
        flow.beginAuthorization(
          CONNECT_INPUT,
        ),
      ).rejects.toBe(
        targetError,
      );

      expect(
        test.stateGenerator.generate,
      ).not.toHaveBeenCalled();

      expect(
        test.stateStore.save,
      ).not.toHaveBeenCalled();
    });

    it('6. state generator is called exactly once for a valid authorization attempt', async () => {
      const test =
        createDependencies();

      const flow =
        createFlow(test);

      await flow.beginAuthorization(
        CONNECT_INPUT,
      );

      expect(
        test.stateGenerator.generate,
      ).toHaveBeenCalledTimes(1);
    });

    it('7. generated state is preserved as an opaque identifier', async () => {
      const test =
        createDependencies();

      test.stateGenerator.generate
        .mockReturnValue(
          'opaque-only-3a819f',
        );

      const flow =
        createFlow(test);

      const result =
        await flow.beginAuthorization(
          CONNECT_INPUT,
        );

      expect(result.state).toBe(
        'opaque-only-3a819f',
      );

      expect(
        test.stateStore.save,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          state:
            'opaque-only-3a819f',
        }),
      );
    });

    it('8. flow does not derive state from merchant, user or channel identifiers', async () => {
      const test =
        createDependencies();

      test.stateGenerator.generate
        .mockReturnValue(
          'independent-opaque-state',
        );

      const flow =
        createFlow(test);

      const result =
        await flow.beginAuthorization(
          RECONNECT_INPUT,
        );

      const url =
        parseAuthorizationUrl(
          result.authorizationUrl,
        );

      expect(result.state).toBe(
        'independent-opaque-state',
      );

      expect(
        url.searchParams.get(
          'state',
        ),
      ).toBe(
        'independent-opaque-state',
      );

      expect(result.state).not.toContain(
        RECONNECT_INPUT.merchantId,
      );

      expect(result.state).not.toContain(
        RECONNECT_INPUT.initiatorUserId,
      );

      expect(result.state).not.toContain(
        RECONNECT_INPUT.salesChannelId!,
      );
    });

    it('9. saved intent contains trusted initiator, merchant, mode and expiration', async () => {
      const test =
        createDependencies();

      const flow =
        createFlow(test);

      await flow.beginAuthorization(
        CONNECT_INPUT,
      );

      expect(
        test.stateStore.save,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          state:
            OPAQUE_STATE,
          initiatorUserId:
            CONNECT_INPUT.initiatorUserId,
          merchantId:
            CONNECT_INPUT.merchantId,
          mode:
            'CONNECT',
          expiresAt:
            new Date(
              NOW.getTime() +
              DEFAULT_CONFIG.stateTtlMs,
            ),
        }),
      );
    });

    it('10. state expiration uses injected clock and configured TTL rather than a hardcoded duration', async () => {
      const customNow =
        new Date(
          '2031-04-05T06:07:08.000Z',
        );

      const test =
        createDependencies({
          config: {
            stateTtlMs:
              123456,
          },
        });

      test.clock.now.mockReturnValue(
        customNow,
      );

      const flow =
        createFlow(test);

      await flow.beginAuthorization(
        CONNECT_INPUT,
      );

      const saved =
        test.stateStore.save
          .mock.calls[0][0];

      expect(
        saved.expiresAt.getTime(),
      ).toBe(
        customNow.getTime() +
        123456,
      );
    });

    it('11. authorization URL uses response_type=code', async () => {
      const test =
        createDependencies();

      const flow =
        createFlow(test);

      const result =
        await flow.beginAuthorization(
          CONNECT_INPUT,
        );

      const url =
        parseAuthorizationUrl(
          result.authorizationUrl,
        );

      expect(
        url.searchParams.get(
          'response_type',
        ),
      ).toBe('code');
    });

    it('12. authorization URL uses configured client_id', async () => {
      const test =
        createDependencies();

      const flow =
        createFlow(test);

      const result =
        await flow.beginAuthorization(
          CONNECT_INPUT,
        );

      const url =
        parseAuthorizationUrl(
          result.authorizationUrl,
        );

      expect(
        url.searchParams.get(
          'client_id',
        ),
      ).toBe(
        DEFAULT_CONFIG.clientId,
      );
    });

    it('13. authorization URL uses exactly the configured redirect_uri', async () => {
      const test =
        createDependencies();

      const flow =
        createFlow(test);

      const result =
        await flow.beginAuthorization(
          CONNECT_INPUT,
        );

      const url =
        parseAuthorizationUrl(
          result.authorizationUrl,
        );

      expect(
        url.searchParams.get(
          'redirect_uri',
        ),
      ).toBe(
        DEFAULT_CONFIG.redirectUri,
      );
    });

    it('14. authorization URL contains the generated state', async () => {
      const test =
        createDependencies();

      const flow =
        createFlow(test);

      const result =
        await flow.beginAuthorization(
          CONNECT_INPUT,
        );

      const url =
        parseAuthorizationUrl(
          result.authorizationUrl,
        );

      expect(
        url.searchParams.get(
          'state',
        ),
      ).toBe(
        OPAQUE_STATE,
      );
    });

    it('15. authorization URL never contains client_secret', async () => {
      const test =
        createDependencies();

      const flow =
        createFlow(test);

      const result =
        await flow.beginAuthorization(
          CONNECT_INPUT,
        );

      const url =
        parseAuthorizationUrl(
          result.authorizationUrl,
        );

      expect(
        url.searchParams.has(
          'client_secret',
        ),
      ).toBe(false);

      expect(
        result.authorizationUrl,
      ).not.toContain(
        DEFAULT_CONFIG.clientSecret,
      );
    });

    it('16. authorization URL excludes code verifier and internal Marto context', async () => {
      const test =
        createDependencies({
          config: {
            pkceEnabled:
              true,
          },
        });

      const flow =
        createFlow(test);

      const result =
        await flow.beginAuthorization(
          RECONNECT_INPUT,
        );

      const url =
        parseAuthorizationUrl(
          result.authorizationUrl,
        );

      expect(
        url.searchParams.has(
          'code_verifier',
        ),
      ).toBe(false);

      expect(
        result.authorizationUrl,
      ).not.toContain(
        CODE_VERIFIER,
      );

      expect(
        result.authorizationUrl,
      ).not.toContain(
        RECONNECT_INPUT.merchantId,
      );

      expect(
        result.authorizationUrl,
      ).not.toContain(
        RECONNECT_INPUT.salesChannelId!,
      );

      expect(
        result.authorizationUrl,
      ).not.toContain(
        'external-account-123',
      );
    });

    it('17. enabled PKCE adds code_challenge with S256 only', async () => {
      const test =
        createDependencies({
          config: {
            pkceEnabled:
              true,
          },
        });

      const flow =
        createFlow(test);

      const result =
        await flow.beginAuthorization(
          CONNECT_INPUT,
        );

      const url =
        parseAuthorizationUrl(
          result.authorizationUrl,
        );

      expect(
        test.pkceGenerator.generate,
      ).toHaveBeenCalledTimes(1);

      expect(
        url.searchParams.get(
          'code_challenge',
        ),
      ).toBe(
        CODE_CHALLENGE,
      );

      expect(
        url.searchParams.get(
          'code_challenge_method',
        ),
      ).toBe('S256');
    });

    it('18. disabled PKCE omits all PKCE authorization parameters', async () => {
      const test =
        createDependencies({
          config: {
            pkceEnabled:
              false,
          },
        });

      const flow =
        createFlow(test);

      const result =
        await flow.beginAuthorization(
          CONNECT_INPUT,
        );

      const url =
        parseAuthorizationUrl(
          result.authorizationUrl,
        );

      expect(
        test.pkceGenerator.generate,
      ).not.toHaveBeenCalled();

      expect(
        url.searchParams.has(
          'code_challenge',
        ),
      ).toBe(false);

      expect(
        url.searchParams.has(
          'code_challenge_method',
        ),
      ).toBe(false);
    });

    it('19. PKCE verifier is stored only in the server-side intent', async () => {
      const test =
        createDependencies({
          config: {
            pkceEnabled:
              true,
          },
        });

      const flow =
        createFlow(test);

      const result =
        await flow.beginAuthorization(
          CONNECT_INPUT,
        );

      const saved =
        test.stateStore.save
          .mock.calls[0][0];

      expect(
        saved.codeVerifier,
      ).toBe(
        CODE_VERIFIER,
      );

      expect(
        result.authorizationUrl,
      ).not.toContain(
        CODE_VERIFIER,
      );
    });

    it('20. callback consumes state before any OAuth exchange', async () => {
      const test =
        createDependencies({
          consumedIntent:
            connectIntent(),
        });

      const flow =
        createFlow(test);

      await flow.completeAuthorization({
        state:
          OPAQUE_STATE,
        code:
          'synthetic-code',
      });

      expect(
        test.stateStore.consume,
      ).toHaveBeenCalledTimes(1);

      expect(
        test.stateStore.consume
          .mock.invocationCallOrder[0],
      ).toBeLessThan(
        test.oauthClient
          .exchangeAuthorizationCode
          .mock.invocationCallOrder[0],
      );
    });

    it('21. nonexistent state fails without calling OAuth', async () => {
      const test =
        createDependencies({
          consumedIntent:
            undefined,
        });

      const flow =
        createFlow(test);

      await expect(
        flow.completeAuthorization({
          state:
            'missing-state',
          code:
            'synthetic-code',
        }),
      ).rejects.toBeInstanceOf(
        Error,
      );

      expect(
        test.oauthClient
          .exchangeAuthorizationCode,
      ).not.toHaveBeenCalled();
    });

    it('22. expired state fails without calling OAuth', async () => {
      const test =
        createDependencies({
          consumedIntent:
            connectIntent({
              expiresAt:
                new Date(
                  NOW.getTime() -
                  1,
                ),
            }),
        });

      const flow =
        createFlow(test);

      await expect(
        flow.completeAuthorization({
          state:
            OPAQUE_STATE,
          code:
            'synthetic-code',
        }),
      ).rejects.toBeInstanceOf(
        Error,
      );

      expect(
        test.oauthClient
          .exchangeAuthorizationCode,
      ).not.toHaveBeenCalled();
    });

    it('23. consumed state cannot be reused', async () => {
      const test =
        createDependencies();

      test.stateStore.consume
        .mockResolvedValueOnce(
          connectIntent(),
        )
        .mockResolvedValueOnce(
          undefined,
        );

      const flow =
        createFlow(test);

      await flow.completeAuthorization({
        state:
          OPAQUE_STATE,
        code:
          'first-code',
      });

      await expect(
        flow.completeAuthorization({
          state:
            OPAQUE_STATE,
          code:
            'second-code',
        }),
      ).rejects.toBeInstanceOf(
        Error,
      );

      expect(
        test.oauthClient
          .exchangeAuthorizationCode,
      ).toHaveBeenCalledTimes(1);
    });

    it('24. callback derives merchant, channel and external identity context only from consumed state', async () => {
      const intent =
        reconnectIntent();

      const test =
        createDependencies({
          consumedIntent:
            intent,
        });

      const flow =
        createFlow(test);

      const result =
        await flow.completeAuthorization({
          state:
            OPAQUE_STATE,
          code:
            'synthetic-code',
          ...({
            merchantId:
              'browser-attacker-merchant',
            salesChannelId:
              'browser-attacker-channel',
            expectedExternalAccountId:
              'browser-attacker-account',
          } as Record<string, unknown>),
        } as CompleteAuthorizationInput);

      expect(
        test.target.revalidateReconnect,
      ).toHaveBeenCalledWith({
        initiatorUserId:
          intent.initiatorUserId,
        merchantId:
          intent.merchantId,
        salesChannelId:
          intent.salesChannelId,
        expectedExternalAccountId:
          intent.expectedExternalAccountId,
      });

      expect(result.merchantId).toBe(
        intent.merchantId,
      );

      expect(result.salesChannelId).toBe(
        intent.salesChannelId,
      );
    });

    it('25. RECONNECT revalidates trusted target before OAuth exchange', async () => {
      const test =
        createDependencies({
          consumedIntent:
            reconnectIntent(),
        });

      const flow =
        createFlow(test);

      await flow.completeAuthorization({
        state:
          OPAQUE_STATE,
        code:
          'synthetic-code',
      });

      expect(
        test.target.revalidateReconnect,
      ).toHaveBeenCalledTimes(1);

      expect(
        test.target.revalidateReconnect
          .mock.invocationCallOrder[0],
      ).toBeLessThan(
        test.oauthClient
          .exchangeAuthorizationCode
          .mock.invocationCallOrder[0],
      );
    });

    it('26. changed or invalid RECONNECT target prevents OAuth exchange', async () => {
      const test =
        createDependencies({
          consumedIntent:
            reconnectIntent(),
        });

      test.target.revalidateReconnect
        .mockRejectedValue(
          new Error(
            'synthetic-target-changed',
          ),
        );

      const flow =
        createFlow(test);

      await expect(
        flow.completeAuthorization({
          state:
            OPAQUE_STATE,
          code:
            'synthetic-code',
        }),
      ).rejects.toBeInstanceOf(
        Error,
      );

      expect(
        test.oauthClient
          .exchangeAuthorizationCode,
      ).not.toHaveBeenCalled();
    });

    it('27. OAuth exchange receives backend clientId, clientSecret, callback code and configured redirectUri', async () => {
      const test =
        createDependencies({
          consumedIntent:
            connectIntent(),
        });

      const flow =
        createFlow(test);

      await flow.completeAuthorization({
        state:
          OPAQUE_STATE,
        code:
          'callback-code-123',
      });

      expect(
        test.oauthClient
          .exchangeAuthorizationCode,
      ).toHaveBeenCalledWith({
        clientId:
          DEFAULT_CONFIG.clientId,
        clientSecret:
          DEFAULT_CONFIG.clientSecret,
        code:
          'callback-code-123',
        redirectUri:
          DEFAULT_CONFIG.redirectUri,
      });
    });

    it('28. PKCE exchange uses only codeVerifier recovered from the consumed intent', async () => {
      const test =
        createDependencies({
          config: {
            pkceEnabled:
              true,
          },
          consumedIntent:
            connectIntent({
              codeVerifier:
                'trusted-stored-verifier',
            }),
        });

      const flow =
        createFlow(test);

      await flow.completeAuthorization({
        state:
          OPAQUE_STATE,
        code:
          'callback-code',
        ...({
          codeVerifier:
            'attacker-browser-verifier',
        } as Record<string, unknown>),
      } as CompleteAuthorizationInput);

      expect(
        test.oauthClient
          .exchangeAuthorizationCode,
      ).toHaveBeenCalledWith({
        clientId:
          DEFAULT_CONFIG.clientId,
        clientSecret:
          DEFAULT_CONFIG.clientSecret,
        code:
          'callback-code',
        redirectUri:
          DEFAULT_CONFIG.redirectUri,
        codeVerifier:
          'trusted-stored-verifier',
      });
    });

    it('29. non-PKCE exchange omits codeVerifier', async () => {
      const test =
        createDependencies({
          config: {
            pkceEnabled:
              false,
          },
          consumedIntent:
            connectIntent(),
        });

      const flow =
        createFlow(test);

      await flow.completeAuthorization({
        state:
          OPAQUE_STATE,
        code:
          'callback-code',
      });

      const exchangeInput =
        test.oauthClient
          .exchangeAuthorizationCode
          .mock.calls[0][0];

      expect(
        exchangeInput,
      ).not.toHaveProperty(
        'codeVerifier',
      );
    });

    it('30. valid callback performs at most one OAuth exchange', async () => {
      const test =
        createDependencies({
          consumedIntent:
            connectIntent(),
        });

      const flow =
        createFlow(test);

      await flow.completeAuthorization({
        state:
          OPAQUE_STATE,
        code:
          'callback-code',
      });

      expect(
        test.oauthClient
          .exchangeAuthorizationCode,
      ).toHaveBeenCalledTimes(1);
    });

    it('31. CONNECT returns OAuth userId as authorizedExternalAccountId', async () => {
      const test =
        createDependencies({
          consumedIntent:
            connectIntent(),
          tokenResult: {
            ...TOKEN_RESULT,
            userId:
              'new-external-account',
          },
        });

      const flow =
        createFlow(test);

      const result =
        await flow.completeAuthorization({
          state:
            OPAQUE_STATE,
          code:
            'callback-code',
        });

      expect(
        result.authorizedExternalAccountId,
      ).toBe(
        'new-external-account',
      );

      expect(result.mode).toBe(
        'CONNECT',
      );
    });

    it('32. RECONNECT accepts the same external account identity', async () => {
      const test =
        createDependencies({
          consumedIntent:
            reconnectIntent({
              expectedExternalAccountId:
                'external-account-123',
            }),
          tokenResult: {
            ...TOKEN_RESULT,
            userId:
              'external-account-123',
          },
        });

      const flow =
        createFlow(test);

      await expect(
        flow.completeAuthorization({
          state:
            OPAQUE_STATE,
          code:
            'callback-code',
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          mode:
            'RECONNECT',
          salesChannelId:
            'channel-synthetic-1',
          authorizedExternalAccountId:
            'external-account-123',
        }),
      );
    });

    it('33. RECONNECT identity mismatch fails with a sanitized authorization flow error', async () => {
      const module =
        loadFlowModule();

      const test =
        createDependencies({
          consumedIntent:
            reconnectIntent({
              expectedExternalAccountId:
                'expected-private-account',
            }),
          tokenResult: {
            ...TOKEN_RESULT,
            userId:
              'different-private-account',
            accessToken:
              'must-not-leak-access',
            refreshToken:
              'must-not-leak-refresh',
          },
        });

      const flow =
        new module
          .MercadoLivreAuthorizationFlow(
            test.dependencies,
          );

      const error =
        await captureRejection(
          flow.completeAuthorization({
            state:
              OPAQUE_STATE,
            code:
              'must-not-leak-code',
          }),
        );

      expect(error).toBeInstanceOf(
        module
          .MercadoLivreAuthorizationFlowError,
      );

      expect(
        (error as {
          code?: unknown;
        }).code,
      ).toBe(
        'authorization_identity_mismatch',
      );

      const message =
        (error as Error).message;

      for (const secret of [
        'expected-private-account',
        'different-private-account',
        'must-not-leak-access',
        'must-not-leak-refresh',
        'must-not-leak-code',
      ]) {
        expect(message).not.toContain(
          secret,
        );
      }
    });

    it('34. identity mismatch does not introduce channel mutation or credential persistence responsibilities', async () => {
      const test =
        createDependencies({
          consumedIntent:
            reconnectIntent({
              expectedExternalAccountId:
                'expected-account',
            }),
          tokenResult: {
            ...TOKEN_RESULT,
            userId:
              'different-account',
          },
        });

      const flow =
        createFlow(test);

      await expect(
        flow.completeAuthorization({
          state:
            OPAQUE_STATE,
          code:
            'callback-code',
        }),
      ).rejects.toBeInstanceOf(
        Error,
      );

      const source =
        readFileSync(
          join(
            __dirname,
            'mercado-livre-authorization-flow.ts',
          ),
          'utf8',
        );

      expect(source).not.toContain(
        'SalesChannelCredential',
      );

      expect(source).not.toContain(
        'Prisma',
      );

      expect(source).not.toContain(
        'externalAccountId:',
      );
    });

    it('35. OAuth or network failure propagates without retry and consumed state is not restored', async () => {
      const networkError =
        new Error(
          'synthetic-network-error',
        );

      const test =
        createDependencies({
          consumedIntent:
            connectIntent(),
        });

      test.oauthClient
        .exchangeAuthorizationCode
        .mockRejectedValue(
          networkError,
        );

      const flow =
        createFlow(test);

      await expect(
        flow.completeAuthorization({
          state:
            OPAQUE_STATE,
          code:
            'callback-code',
        }),
      ).rejects.toBe(
        networkError,
      );

      expect(
        test.oauthClient
          .exchangeAuthorizationCode,
      ).toHaveBeenCalledTimes(1);

      expect(
        test.stateStore.consume,
      ).toHaveBeenCalledTimes(1);

      expect(
        test.stateStore.save,
      ).not.toHaveBeenCalled();
    });

    it('36. flow remains free of Prisma, Nest, ConfigService, process.env, fetch, Redis, logs and persistence', () => {
      createFlow(
        createDependencies(),
      );

      const source =
        readFileSync(
          join(
            __dirname,
            'mercado-livre-authorization-flow.ts',
          ),
          'utf8',
        );

      for (const forbidden of [
        'Prisma',
        '@nestjs/',
        'ConfigService',
        'process.env',
        'fetch(',
        'axios',
        'Redis',
        'BullMQ',
        'console.log',
        'console.error',
        'Logger',
        'SalesChannelCredential',
      ]) {
        expect(source).not.toContain(
          forbidden,
        );
      }
    });
  },
);
describe('MercadoLivreAuthorizationFlow adversarial audit', () => {
  it('37. rejects a begin target that changes the requested initiator or merchant context', async () => {
    const module =
      loadFlowModule();

    const test =
      createDependencies();

    test.target.resolveForBegin
      .mockResolvedValue({
        initiatorUserId:
          'different-user',
        merchantId:
          'different-merchant',
        mode:
          'CONNECT',
      });

    const flow =
      new module
        .MercadoLivreAuthorizationFlow(
          test.dependencies,
        );

    const error =
      await captureRejection(
        flow.beginAuthorization(
          CONNECT_INPUT,
        ),
      );

    expect(error).toBeInstanceOf(
      module
        .MercadoLivreAuthorizationFlowError,
    );

    expect(
      (error as {
        code?: unknown;
      }).code,
    ).toBe(
      'authorization_target_invalid',
    );

    expect(
      test.stateGenerator.generate,
    ).not.toHaveBeenCalled();

    expect(
      test.stateStore.save,
    ).not.toHaveBeenCalled();
  });

  it('38. rejects a RECONNECT target that resolves a different salesChannelId', async () => {
    const module =
      loadFlowModule();

    const test =
      createDependencies();

    test.target.resolveForBegin
      .mockResolvedValue({
        initiatorUserId:
          RECONNECT_INPUT.initiatorUserId,
        merchantId:
          RECONNECT_INPUT.merchantId,
        mode:
          'RECONNECT',
        salesChannelId:
          'different-channel',
        expectedExternalAccountId:
          'external-account-123',
      });

    const flow =
      new module
        .MercadoLivreAuthorizationFlow(
          test.dependencies,
        );

    const error =
      await captureRejection(
        flow.beginAuthorization(
          RECONNECT_INPUT,
        ),
      );

    expect(error).toBeInstanceOf(
      module
        .MercadoLivreAuthorizationFlowError,
    );

    expect(
      (error as {
        code?: unknown;
      }).code,
    ).toBe(
      'authorization_target_invalid',
    );

    expect(
      test.stateGenerator.generate,
    ).not.toHaveBeenCalled();

    expect(
      test.stateStore.save,
    ).not.toHaveBeenCalled();
  });

  it('39. rejects a blank generated state without saving an authorization intent', async () => {
    const module =
      loadFlowModule();

    const test =
      createDependencies();

    test.stateGenerator.generate
      .mockReturnValue('   ');

    const flow =
      new module
        .MercadoLivreAuthorizationFlow(
          test.dependencies,
        );

    const error =
      await captureRejection(
        flow.beginAuthorization(
          CONNECT_INPUT,
        ),
      );

    expect(error).toBeInstanceOf(
      module
        .MercadoLivreAuthorizationFlowError,
    );

    expect(
      (error as {
        code?: unknown;
      }).code,
    ).toBe(
      'authorization_state_invalid',
    );

    expect(
      test.stateStore.save,
    ).not.toHaveBeenCalled();
  });

  it('40. rejects malformed PKCE output before saving the authorization intent', async () => {
    const module =
      loadFlowModule();

    const test =
      createDependencies({
        config: {
          pkceEnabled:
            true,
        },
      });

    test.pkceGenerator.generate
      .mockReturnValue({
        codeVerifier:
          '   ',
        codeChallenge:
          CODE_CHALLENGE,
      });

    const flow =
      new module
        .MercadoLivreAuthorizationFlow(
          test.dependencies,
        );

    const error =
      await captureRejection(
        flow.beginAuthorization(
          CONNECT_INPUT,
        ),
      );

    expect(error).toBeInstanceOf(
      module
        .MercadoLivreAuthorizationFlowError,
    );

    expect(
      (error as {
        code?: unknown;
      }).code,
    ).toBe(
      'authorization_input_invalid',
    );

    expect(
      test.stateStore.save,
    ).not.toHaveBeenCalled();
  });

  it('41. rejects a consumed intent whose embedded state differs from the callback state', async () => {
    const module =
      loadFlowModule();

    const test =
      createDependencies({
        consumedIntent:
          connectIntent({
            state:
              'different-stored-state',
          }),
      });

    const flow =
      new module
        .MercadoLivreAuthorizationFlow(
          test.dependencies,
        );

    const error =
      await captureRejection(
        flow.completeAuthorization({
          state:
            OPAQUE_STATE,
          code:
            'synthetic-code',
        }),
      );

    expect(error).toBeInstanceOf(
      module
        .MercadoLivreAuthorizationFlowError,
    );

    expect(
      (error as {
        code?: unknown;
      }).code,
    ).toBe(
      'authorization_state_invalid',
    );

    expect(
      test.target.revalidateReconnect,
    ).not.toHaveBeenCalled();

    expect(
      test.oauthClient
        .exchangeAuthorizationCode,
    ).not.toHaveBeenCalled();
  });

  it('42. treats state as expired exactly at the expiration boundary', async () => {
    const module =
      loadFlowModule();

    const test =
      createDependencies({
        consumedIntent:
          connectIntent({
            expiresAt:
              new Date(NOW),
          }),
      });

    const flow =
      new module
        .MercadoLivreAuthorizationFlow(
          test.dependencies,
        );

    const error =
      await captureRejection(
        flow.completeAuthorization({
          state:
            OPAQUE_STATE,
          code:
            'synthetic-code',
        }),
      );

    expect(error).toBeInstanceOf(
      module
        .MercadoLivreAuthorizationFlowError,
    );

    expect(
      (error as {
        code?: unknown;
      }).code,
    ).toBe(
      'authorization_state_expired',
    );

    expect(
      test.oauthClient
        .exchangeAuthorizationCode,
    ).not.toHaveBeenCalled();
  });

  it('43. CONNECT completion never invokes RECONNECT target revalidation', async () => {
    const test =
      createDependencies({
        consumedIntent:
          connectIntent(),
      });

    const flow =
      createFlow(test);

    await flow.completeAuthorization({
      state:
        OPAQUE_STATE,
      code:
        'synthetic-code',
    });

    expect(
      test.target.revalidateReconnect,
    ).not.toHaveBeenCalled();

    expect(
      test.oauthClient
        .exchangeAuthorizationCode,
    ).toHaveBeenCalledTimes(1);
  });

  it('44. invalid blank callback input is rejected before state consumption', async () => {
    const module =
      loadFlowModule();

    for (const input of [
      {
        state: '   ',
        code: 'synthetic-code',
      },
      {
        state: OPAQUE_STATE,
        code: '   ',
      },
    ]) {
      const test =
        createDependencies();

      const flow =
        new module
          .MercadoLivreAuthorizationFlow(
            test.dependencies,
          );

      const error =
        await captureRejection(
          flow.completeAuthorization(
            input,
          ),
        );

      expect(error).toBeInstanceOf(
        module
          .MercadoLivreAuthorizationFlowError,
      );

      expect(
        (error as {
          code?: unknown;
        }).code,
      ).toBe(
        'authorization_input_invalid',
      );

      expect(
        test.stateStore.consume,
      ).not.toHaveBeenCalled();

      expect(
        test.oauthClient
          .exchangeAuthorizationCode,
      ).not.toHaveBeenCalled();
    }
  });
});
