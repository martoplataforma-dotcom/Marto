import {
  readFileSync,
} from 'node:fs';

import {
  join,
} from 'node:path';

type CredentialStatus =
  | 'ACTIVE'
  | 'REFRESHING'
  | 'TRANSIENT_ERROR'
  | 'ROTATION_UNCERTAIN'
  | 'REAUTH_REQUIRED';

type SalesChannelType =
  | 'MERCADO_LIVRE'
  | 'SHOPEE'
  | 'SITE';

type SalesChannelStatus =
  | 'ACTIVE'
  | 'DISCONNECTED'
  | 'PAUSED'
  | 'ERROR';

type CredentialSnapshot = {
  salesChannelId: string;
  salesChannelType: SalesChannelType;
  salesChannelStatus: SalesChannelStatus;

  externalAccountId: string;

  credentialStatus:
    CredentialStatus;

  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  encryptionKeyVersion: string;

  tokenType?: string;
  scope?: string;

  accessTokenExpiresAt: Date;

  authorizedExternalAccountId:
    string;

  tokenGeneration: number;

  refreshAttemptId?: string;
  refreshStartedAt?: Date;

  lastErrorCode?: string;
  lastErrorAt?: Date;
};

type RefreshClaimInput = {
  salesChannelId: string;
  expectedTokenGeneration: number;
  expectedStatus:
    | 'ACTIVE'
    | 'TRANSIENT_ERROR';
  refreshAttemptId: string;
  refreshStartedAt: Date;
};

type RefreshClaimResult = {
  claimed: boolean;
  current?: CredentialSnapshot;
};

type CompleteRefreshInput = {
  salesChannelId: string;
  expectedTokenGeneration: number;
  refreshAttemptId: string;

  status: 'ACTIVE';

  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  encryptionKeyVersion: string;

  tokenType: string;
  scope?: string;

  accessTokenExpiresAt: Date;

  authorizedExternalAccountId:
    string;

  newTokenGeneration: number;

  refreshAttemptIdAfterCommit: null;
  refreshStartedAtAfterCommit: null;

  lastRotatedAt: Date;

  lastErrorCodeAfterCommit: null;
  lastErrorAtAfterCommit: null;
};

type FailRefreshInput = {
  salesChannelId: string;
  expectedTokenGeneration: number;
  refreshAttemptId: string;

  expectedRefreshStartedAt?: Date;

  targetStatus:
    | 'TRANSIENT_ERROR'
    | 'ROTATION_UNCERTAIN'
    | 'REAUTH_REQUIRED';

  lastErrorCode: string;
  errorAt: Date;
};

type RefreshMutationResult = {
  committed: boolean;
  current?: CredentialSnapshot;
};

type MercadoLivreCredentialStorePort = {
  load(
    salesChannelId: string,
  ): Promise<
    CredentialSnapshot | undefined
  >;

  tryClaimRefresh(
    input: RefreshClaimInput,
  ): Promise<RefreshClaimResult>;

  completeRefresh(
    input: CompleteRefreshInput,
  ): Promise<RefreshMutationResult>;

  failRefresh(
    input: FailRefreshInput,
  ): Promise<RefreshMutationResult>;
};

type CryptoDecryptInput = {
  encryptedValue: string;
  keyVersion: string;
};

type CryptoEncryptResult = {
  encryptedValue: string;
  keyVersion: string;
};

type SalesChannelCredentialCryptoPort = {
  decrypt(
    input: CryptoDecryptInput,
  ): string;

  encrypt(
    plaintext: string,
  ): CryptoEncryptResult;
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

type MercadoLivreOAuthRefreshClientPort = {
  refreshAccessToken(
    input: RefreshAccessTokenInput,
  ): Promise<MercadoLivreOAuthTokenResult>;
};

type MercadoLivreCredentialClock = {
  now(): Date;
};

type MercadoLivreRefreshAttemptIdGenerator = {
  generate(): string;
};

type MercadoLivreAccessTokenCoordinatorConfig = {
  clientId: string;
  clientSecret: string;
  refreshSafetyWindowMs: number;
  transientRetryDelayMs: number;
  refreshStaleAfterMs: number;
};

type MercadoLivreAccessTokenCoordinatorDependencies = {
  store:
    MercadoLivreCredentialStorePort;

  crypto:
    SalesChannelCredentialCryptoPort;

  oauthClient:
    MercadoLivreOAuthRefreshClientPort;

  clock:
    MercadoLivreCredentialClock;

  refreshAttemptIdGenerator:
    MercadoLivreRefreshAttemptIdGenerator;

  config:
    MercadoLivreAccessTokenCoordinatorConfig;
};

type GetAccessTokenInput = {
  salesChannelId: string;
};

type AccessTokenResult = {
  accessToken: string;
  tokenType?: string;
  accessTokenExpiresAt: Date;
  authorizedExternalAccountId:
    string;
  tokenGeneration: number;
  source:
    | 'CACHED'
    | 'REFRESHED';
};

type MercadoLivreAccessTokenCoordinatorContract = {
  getAccessToken(
    input: GetAccessTokenInput,
  ): Promise<AccessTokenResult>;
};

type MercadoLivreAccessTokenCoordinatorModule = {
  MercadoLivreAccessTokenCoordinator:
    new (
      dependencies:
        MercadoLivreAccessTokenCoordinatorDependencies,
    ) =>
      MercadoLivreAccessTokenCoordinatorContract;

  MercadoLivreAccessTokenCoordinatorError:
    new (...args: unknown[]) => Error;
};

type TestDependencies = {
  dependencies:
    MercadoLivreAccessTokenCoordinatorDependencies;

  store: {
    load:
      jest.MockedFunction<
        MercadoLivreCredentialStorePort['load']
      >;

    tryClaimRefresh:
      jest.MockedFunction<
        MercadoLivreCredentialStorePort['tryClaimRefresh']
      >;

    completeRefresh:
      jest.MockedFunction<
        MercadoLivreCredentialStorePort['completeRefresh']
      >;

    failRefresh:
      jest.MockedFunction<
        MercadoLivreCredentialStorePort['failRefresh']
      >;
  };

  crypto: {
    decrypt:
      jest.MockedFunction<
        SalesChannelCredentialCryptoPort['decrypt']
      >;

    encrypt:
      jest.MockedFunction<
        SalesChannelCredentialCryptoPort['encrypt']
      >;
  };

  oauthClient: {
    refreshAccessToken:
      jest.MockedFunction<
        MercadoLivreOAuthRefreshClientPort['refreshAccessToken']
      >;
  };

  clock: {
    now:
      jest.MockedFunction<
        MercadoLivreCredentialClock['now']
      >;
  };

  refreshAttemptIdGenerator: {
    generate:
      jest.MockedFunction<
        MercadoLivreRefreshAttemptIdGenerator['generate']
      >;
  };

  config:
    MercadoLivreAccessTokenCoordinatorConfig;
};

const NOW =
  new Date(
    '2026-11-16T20:00:00.000Z',
  );

const RESPONSE_AT =
  new Date(
    '2026-11-16T20:00:07.000Z',
  );

const SALES_CHANNEL_ID =
  'sales-channel-synthetic-1';

const EXTERNAL_ACCOUNT_ID =
  'seller-123456';

const ATTEMPT_ID =
  'refresh-attempt-synthetic-1';

const SAFETY_WINDOW_MS =
  5 * 60 * 1000;

const TRANSIENT_RETRY_DELAY_MS =
  60 * 1000;

const REFRESH_STALE_AFTER_MS =
  2 * 60 * 1000;

const DEFAULT_CONFIG:
  MercadoLivreAccessTokenCoordinatorConfig = {
    clientId:
      'synthetic-client-id',

    clientSecret:
      'synthetic-client-secret',

    refreshSafetyWindowMs:
      SAFETY_WINDOW_MS,

    transientRetryDelayMs:
      TRANSIENT_RETRY_DELAY_MS,

    refreshStaleAfterMs:
      REFRESH_STALE_AFTER_MS,
  };

const TOKEN_RESULT:
  MercadoLivreOAuthTokenResult = {
    accessToken:
      'new-access-token',

    tokenType:
      'Bearer',

    expiresIn:
      3600,

    scope:
      'read write',

    userId:
      EXTERNAL_ACCOUNT_ID,

    refreshToken:
      'new-refresh-token',
  };

function loadCoordinatorModule():
  MercadoLivreAccessTokenCoordinatorModule {
  return jest.requireActual<
    MercadoLivreAccessTokenCoordinatorModule
  >(
    './mercado-livre-access-token-coordinator',
  );
}

function snapshot(
  overrides:
    Partial<CredentialSnapshot> = {},
): CredentialSnapshot {
  return {
    salesChannelId:
      SALES_CHANNEL_ID,

    salesChannelType:
      'MERCADO_LIVRE',

    salesChannelStatus:
      'ACTIVE',

    externalAccountId:
      EXTERNAL_ACCOUNT_ID,

    credentialStatus:
      'ACTIVE',

    accessTokenEncrypted:
      'enc-access',

    refreshTokenEncrypted:
      'enc-refresh',

    encryptionKeyVersion:
      'key-v1',

    tokenType:
      'Bearer',

    scope:
      'read write',

    accessTokenExpiresAt:
      new Date(
        NOW.getTime() +
        SAFETY_WINDOW_MS +
        60_000,
      ),

    authorizedExternalAccountId:
      EXTERNAL_ACCOUNT_ID,

    tokenGeneration:
      7,

    ...overrides,
  };
}

function refreshNeededSnapshot(
  overrides:
    Partial<CredentialSnapshot> = {},
): CredentialSnapshot {
  return snapshot({
    accessTokenExpiresAt:
      new Date(
        NOW.getTime() +
        SAFETY_WINDOW_MS,
      ),

    ...overrides,
  });
}

function refreshingSnapshot(
  overrides:
    Partial<CredentialSnapshot> = {},
): CredentialSnapshot {
  return refreshNeededSnapshot({
    credentialStatus:
      'REFRESHING',

    refreshAttemptId:
      ATTEMPT_ID,

    refreshStartedAt:
      new Date(NOW),

    ...overrides,
  });
}

function transientSnapshot(
  overrides:
    Partial<CredentialSnapshot> = {},
): CredentialSnapshot {
  return refreshNeededSnapshot({
    credentialStatus:
      'TRANSIENT_ERROR',

    lastErrorCode:
      'synthetic-transient',

    lastErrorAt:
      new Date(
        NOW.getTime() -
        TRANSIENT_RETRY_DELAY_MS,
      ),

    ...overrides,
  });
}

function createDependencies(
  options: {
    snapshot?:
      CredentialSnapshot | undefined;

    config?:
      Partial<
        MercadoLivreAccessTokenCoordinatorConfig
      >;

    claimResult?:
      RefreshClaimResult;

    completeResult?:
      RefreshMutationResult;

    failResult?:
      RefreshMutationResult;

    tokenResult?:
      MercadoLivreOAuthTokenResult;
  } = {},
): TestDependencies {
  const store = {
    load:
      jest.fn<
        ReturnType<
          MercadoLivreCredentialStorePort['load']
        >,
        Parameters<
          MercadoLivreCredentialStorePort['load']
        >
      >(),

    tryClaimRefresh:
      jest.fn<
        ReturnType<
          MercadoLivreCredentialStorePort['tryClaimRefresh']
        >,
        Parameters<
          MercadoLivreCredentialStorePort['tryClaimRefresh']
        >
      >(),

    completeRefresh:
      jest.fn<
        ReturnType<
          MercadoLivreCredentialStorePort['completeRefresh']
        >,
        Parameters<
          MercadoLivreCredentialStorePort['completeRefresh']
        >
      >(),

    failRefresh:
      jest.fn<
        ReturnType<
          MercadoLivreCredentialStorePort['failRefresh']
        >,
        Parameters<
          MercadoLivreCredentialStorePort['failRefresh']
        >
      >(),
  };

  if (
    Object.prototype.hasOwnProperty.call(
      options,
      'snapshot',
    )
  ) {
    store.load.mockResolvedValue(
      options.snapshot,
    );
  } else {
    store.load.mockResolvedValue(
      snapshot(),
    );
  }

  store.tryClaimRefresh
    .mockResolvedValue(
      options.claimResult ?? {
        claimed:
          true,
      },
    );

  store.completeRefresh
    .mockResolvedValue(
      options.completeResult ?? {
        committed:
          true,
      },
    );

  store.failRefresh
    .mockResolvedValue(
      options.failResult ?? {
        committed:
          true,
      },
    );

  const crypto = {
    decrypt:
      jest.fn<
        ReturnType<
          SalesChannelCredentialCryptoPort['decrypt']
        >,
        Parameters<
          SalesChannelCredentialCryptoPort['decrypt']
        >
      >(),

    encrypt:
      jest.fn<
        ReturnType<
          SalesChannelCredentialCryptoPort['encrypt']
        >,
        Parameters<
          SalesChannelCredentialCryptoPort['encrypt']
        >
      >(),
  };

  crypto.decrypt
    .mockImplementation(
      (
        input:
          CryptoDecryptInput,
      ) => {
        if (
          input.encryptedValue ===
          'enc-access'
        ) {
          return 'plain-access-token';
        }

        if (
          input.encryptedValue ===
          'enc-refresh'
        ) {
          return 'plain-refresh-token';
        }

        if (
          input.encryptedValue ===
          'enc-access-newer'
        ) {
          return 'plain-newer-access-token';
        }

        return 'synthetic-plaintext';
      },
    );

  crypto.encrypt
    .mockImplementation(
      (
        plaintext:
          string,
      ) => {
        if (
          plaintext ===
          'new-access-token'
        ) {
          return {
            encryptedValue:
              'enc-new-access',

            keyVersion:
              'key-v1',
          };
        }

        if (
          plaintext ===
          'new-refresh-token'
        ) {
          return {
            encryptedValue:
              'enc-new-refresh',

            keyVersion:
              'key-v1',
          };
        }

        return {
          encryptedValue:
            'enc-synthetic',

          keyVersion:
            'key-v1',
        };
      },
    );

  const oauthClient = {
    refreshAccessToken:
      jest.fn<
        ReturnType<
          MercadoLivreOAuthRefreshClientPort['refreshAccessToken']
        >,
        Parameters<
          MercadoLivreOAuthRefreshClientPort['refreshAccessToken']
        >
      >(),
  };

  oauthClient.refreshAccessToken
    .mockResolvedValue(
      options.tokenResult ??
      TOKEN_RESULT,
    );

  const clock = {
    now:
      jest.fn<
        ReturnType<
          MercadoLivreCredentialClock['now']
        >,
        Parameters<
          MercadoLivreCredentialClock['now']
        >
      >(),
  };

  clock.now.mockReturnValue(
    new Date(NOW),
  );

  const refreshAttemptIdGenerator = {
    generate:
      jest.fn<
        ReturnType<
          MercadoLivreRefreshAttemptIdGenerator['generate']
        >,
        Parameters<
          MercadoLivreRefreshAttemptIdGenerator['generate']
        >
      >(),
  };

  refreshAttemptIdGenerator.generate
    .mockReturnValue(
      ATTEMPT_ID,
    );

  const config = {
    ...DEFAULT_CONFIG,
    ...options.config,
  };

  return {
    dependencies: {
      store,
      crypto,
      oauthClient,
      clock,
      refreshAttemptIdGenerator,
      config,
    },

    store,
    crypto,
    oauthClient,
    clock,
    refreshAttemptIdGenerator,
    config,
  };
}

function createCoordinator(
  test:
    TestDependencies,
): {
  module:
    MercadoLivreAccessTokenCoordinatorModule;

  coordinator:
    MercadoLivreAccessTokenCoordinatorContract;
} {
  const module =
    loadCoordinatorModule();

  return {
    module,

    coordinator:
      new module
        .MercadoLivreAccessTokenCoordinator(
          test.dependencies,
        ),
  };
}

async function captureRejection(
  promise:
    Promise<unknown>,
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

async function expectCoordinatorError(
  promise:
    Promise<unknown>,

  module:
    MercadoLivreAccessTokenCoordinatorModule,

  expectedCode:
    string,
): Promise<unknown> {
  const error =
    await captureRejection(
      promise,
    );

  expect(error)
    .toBeInstanceOf(
      module
        .MercadoLivreAccessTokenCoordinatorError,
    );

  expect(
    (
      error as {
        code?: unknown;
      }
    ).code,
  ).toBe(
    expectedCode,
  );

  return error;
}

function oauthError(
  status:
    number,

  oauthCode?:
    string,
): Error & {
  status: number;
  oauthCode?: string;
} {
  const error =
    new Error(
      'synthetic-oauth-error',
    ) as Error & {
      status: number;
      oauthCode?: string;
    };

  error.status =
    status;

  if (
    oauthCode !== undefined
  ) {
    error.oauthCode =
      oauthCode;
  }

  return error;
}

describe(
  'MercadoLivreAccessTokenCoordinator RED contracts',
  () => {
    it('1. rejects blank salesChannelId before consulting the store', async () => {
      const test =
        createDependencies();

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            '   ',
        }),
        module,
        'credential_input_invalid',
      );

      expect(
        test.store.load,
      ).not.toHaveBeenCalled();

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).not.toHaveBeenCalled();
    });

    it('2. loads the credential snapshot at most once on the normal cached path', async () => {
      const test =
        createDependencies();

      const {
        coordinator,
      } =
        createCoordinator(test);

      await coordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

      expect(
        test.store.load,
      ).toHaveBeenCalledTimes(1);

      expect(
        test.store.load,
      ).toHaveBeenCalledWith(
        SALES_CHANNEL_ID,
      );
    });

    it('3. missing credential fails without crypto or OAuth', async () => {
      const test =
        createDependencies({
          snapshot:
            undefined,
        });

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_not_found',
      );

      expect(
        test.crypto.decrypt,
      ).not.toHaveBeenCalled();

      expect(
        test.crypto.encrypt,
      ).not.toHaveBeenCalled();

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).not.toHaveBeenCalled();
    });

    it('4. channel type other than MERCADO_LIVRE does not provide a token', async () => {
      const test =
        createDependencies({
          snapshot:
            snapshot({
              salesChannelType:
                'SHOPEE',
            }),
        });

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_channel_unavailable',
      );

      expect(
        test.crypto.decrypt,
      ).not.toHaveBeenCalled();

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).not.toHaveBeenCalled();
    });

    it('5. channel that is not ACTIVE does not provide a token', async () => {
      const test =
        createDependencies({
          snapshot:
            snapshot({
              salesChannelStatus:
                'PAUSED',
            }),
        });

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_channel_unavailable',
      );

      expect(
        test.crypto.decrypt,
      ).not.toHaveBeenCalled();
    });

    it('6. externalAccountId mismatch blocks the credential', async () => {
      const test =
        createDependencies({
          snapshot:
            snapshot({
              externalAccountId:
                'seller-other',
            }),
        });

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_identity_mismatch',
      );

      expect(
        test.crypto.decrypt,
      ).not.toHaveBeenCalled();

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).not.toHaveBeenCalled();
    });

    it('7. ACTIVE credential beyond the safety window returns the cached access token', async () => {
      const test =
        createDependencies();

      const {
        coordinator,
      } =
        createCoordinator(test);

      const result =
        await coordinator
          .getAccessToken({
            salesChannelId:
              SALES_CHANNEL_ID,
          });

      expect(result).toEqual({
        accessToken:
          'plain-access-token',

        tokenType:
          'Bearer',

        accessTokenExpiresAt:
          snapshot()
            .accessTokenExpiresAt,

        authorizedExternalAccountId:
          EXTERNAL_ACCOUNT_ID,

        tokenGeneration:
          7,

        source:
          'CACHED',
      });

      expect(
        test.store
          .tryClaimRefresh,
      ).not.toHaveBeenCalled();
    });

    it('8. cached path decrypts only the access token and never the refresh token', async () => {
      const test =
        createDependencies();

      const {
        coordinator,
      } =
        createCoordinator(test);

      await coordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

      expect(
        test.crypto.decrypt,
      ).toHaveBeenCalledTimes(1);

      expect(
        test.crypto.decrypt,
      ).toHaveBeenCalledWith({
        encryptedValue:
          'enc-access',

        keyVersion:
          'key-v1',
      });

      expect(
        test.crypto.decrypt,
      ).not.toHaveBeenCalledWith({
        encryptedValue:
          'enc-refresh',

        keyVersion:
          'key-v1',
      });
    });

    it('9. cached validity uses the injected clock', async () => {
      const test =
        createDependencies();

      const {
        coordinator,
      } =
        createCoordinator(test);

      await coordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

      expect(
        test.clock.now,
      ).toHaveBeenCalled();
    });

    it('10. cached validity uses configured refreshSafetyWindowMs', async () => {
      const test =
        createDependencies({
          snapshot:
            snapshot({
              accessTokenExpiresAt:
                new Date(
                  NOW.getTime() +
                  2 * 60 * 1000,
                ),
            }),

          config: {
            refreshSafetyWindowMs:
              60 * 1000,
          },
        });

      const {
        coordinator,
      } =
        createCoordinator(test);

      const result =
        await coordinator
          .getAccessToken({
            salesChannelId:
              SALES_CHANNEL_ID,
          });

      expect(
        result.source,
      ).toBe(
        'CACHED',
      );

      expect(
        test.store
          .tryClaimRefresh,
      ).not.toHaveBeenCalled();
    });

    it('11. exact safety-window boundary enters refresh', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      const {
        coordinator,
      } =
        createCoordinator(test);

      await coordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

      expect(
        test.store
          .tryClaimRefresh,
      ).toHaveBeenCalledTimes(1);
    });

    it('12. cached decision uses persisted expiry rather than a hardcoded provider lifetime', async () => {
      const test =
        createDependencies({
          snapshot:
            snapshot({
              accessTokenExpiresAt:
                new Date(
                  NOW.getTime() +
                  10 * 60 * 1000,
                ),
            }),
        });

      const {
        coordinator,
      } =
        createCoordinator(test);

      const result =
        await coordinator
          .getAccessToken({
            salesChannelId:
              SALES_CHANNEL_ID,
          });

      expect(
        result.source,
      ).toBe(
        'CACHED',
      );

      expect(
        test.store
          .tryClaimRefresh,
      ).not.toHaveBeenCalled();
    });

    it('13. REAUTH_REQUIRED blocks before crypto and OAuth', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot({
              credentialStatus:
                'REAUTH_REQUIRED',
            }),
        });

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_reauth_required',
      );

      expect(
        test.crypto.decrypt,
      ).not.toHaveBeenCalled();

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).not.toHaveBeenCalled();
    });

    it('14. ROTATION_UNCERTAIN blocks before crypto and OAuth', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot({
              credentialStatus:
                'ROTATION_UNCERTAIN',
            }),
        });

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_rotation_uncertain',
      );

      expect(
        test.crypto.decrypt,
      ).not.toHaveBeenCalled();

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).not.toHaveBeenCalled();
    });

    it('15. recent REFRESHING returns refresh-in-progress without OAuth', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshingSnapshot(),
        });

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_refresh_in_progress',
      );

      expect(
        test.crypto.decrypt,
      ).not.toHaveBeenCalled();

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).not.toHaveBeenCalled();
    });

    it('16. stale REFRESHING at the exact boundary attempts atomic transition to ROTATION_UNCERTAIN', async () => {
      const startedAt =
        new Date(
          NOW.getTime() -
          REFRESH_STALE_AFTER_MS,
        );

      const test =
        createDependencies({
          snapshot:
            refreshingSnapshot({
              refreshStartedAt:
                startedAt,
            }),
        });

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_rotation_uncertain',
      );

      expect(
        test.store.failRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          salesChannelId:
            SALES_CHANNEL_ID,

          expectedTokenGeneration:
            7,

          refreshAttemptId:
            ATTEMPT_ID,

          expectedRefreshStartedAt:
            startedAt,

          targetStatus:
            'ROTATION_UNCERTAIN',
        }),
      );
    });

    it('17. stale REFRESHING never reuses the refresh token and never calls OAuth', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshingSnapshot({
              refreshStartedAt:
                new Date(
                  NOW.getTime() -
                  REFRESH_STALE_AFTER_MS,
                ),
            }),
        });

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_rotation_uncertain',
      );

      expect(
        test.crypto.decrypt,
      ).not.toHaveBeenCalled();

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).not.toHaveBeenCalled();
    });

    it('18. malformed REFRESHING without attempt metadata does not call OAuth', async () => {
      const malformed =
        refreshingSnapshot();

      delete malformed
        .refreshAttemptId;

      delete malformed
        .refreshStartedAt;

      const test =
        createDependencies({
          snapshot:
            malformed,
        });

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_state_invalid',
      );

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).not.toHaveBeenCalled();
    });

    it('19. TRANSIENT_ERROR with still-usable access token may return cached token', async () => {
      const test =
        createDependencies({
          snapshot:
            snapshot({
              credentialStatus:
                'TRANSIENT_ERROR',

              lastErrorCode:
                'synthetic-transient',

              lastErrorAt:
                new Date(NOW),
            }),
        });

      const {
        coordinator,
      } =
        createCoordinator(test);

      const result =
        await coordinator
          .getAccessToken({
            salesChannelId:
              SALES_CHANNEL_ID,
          });

      expect(
        result.source,
      ).toBe(
        'CACHED',
      );

      expect(
        test.store
          .tryClaimRefresh,
      ).not.toHaveBeenCalled();
    });

    it('20. TRANSIENT_ERROR that needs refresh respects transientRetryDelayMs', async () => {
      const test =
        createDependencies({
          snapshot:
            transientSnapshot({
              lastErrorAt:
                new Date(
                  NOW.getTime() -
                  TRANSIENT_RETRY_DELAY_MS +
                  1,
                ),
            }),
        });

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_refresh_backoff',
      );

      expect(
        test.store
          .tryClaimRefresh,
      ).not.toHaveBeenCalled();

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).not.toHaveBeenCalled();
    });

    it('21. TRANSIENT_ERROR at the exact backoff boundary becomes claim-eligible', async () => {
      const test =
        createDependencies({
          snapshot:
            transientSnapshot({
              lastErrorAt:
                new Date(
                  NOW.getTime() -
                  TRANSIENT_RETRY_DELAY_MS,
                ),
            }),
        });

      const {
        coordinator,
      } =
        createCoordinator(test);

      await coordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

      expect(
        test.store
          .tryClaimRefresh,
      ).toHaveBeenCalledTimes(1);
    });

    it('22. ACTIVE inside the refresh margin becomes claim-eligible', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      const {
        coordinator,
      } =
        createCoordinator(test);

      await coordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

      expect(
        test.store
          .tryClaimRefresh,
      ).toHaveBeenCalledTimes(1);
    });

    it('23. refreshAttemptId is generated only when refresh is actually necessary', async () => {
      const test =
        createDependencies();

      const {
        coordinator,
      } =
        createCoordinator(test);

      await coordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

      expect(
        test.refreshAttemptIdGenerator
          .generate,
      ).not.toHaveBeenCalled();
    });

    it('24. refreshAttemptId generator is called at most once per refresh attempt', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      const {
        coordinator,
      } =
        createCoordinator(test);

      await coordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

      expect(
        test.refreshAttemptIdGenerator
          .generate,
      ).toHaveBeenCalledTimes(1);
    });

    it('25. claim receives expected generation, attempt id and start time', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      const {
        coordinator,
      } =
        createCoordinator(test);

      await coordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

      expect(
        test.store
          .tryClaimRefresh,
      ).toHaveBeenCalledWith({
        salesChannelId:
          SALES_CHANNEL_ID,

        expectedTokenGeneration:
          7,

        expectedStatus:
          'ACTIVE',

        refreshAttemptId:
          ATTEMPT_ID,

        refreshStartedAt:
          NOW,
      });
    });

    it('26. claim only uses eligible ACTIVE or TRANSIENT_ERROR expected statuses', async () => {
      const activeTest =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      const {
        coordinator:
          activeCoordinator,
      } =
        createCoordinator(
          activeTest,
        );

      await activeCoordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

      expect(
        activeTest.store
          .tryClaimRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedStatus:
            'ACTIVE',
        }),
      );

      const transientTest =
        createDependencies({
          snapshot:
            transientSnapshot(),
        });

      const {
        coordinator:
          transientCoordinator,
      } =
        createCoordinator(
          transientTest,
        );

      await transientCoordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

      expect(
        transientTest.store
          .tryClaimRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedStatus:
            'TRANSIENT_ERROR',
        }),
      );
    });

    it('27. refresh token is not decrypted before the refresh claim is obtained', async () => {
      const current =
        refreshingSnapshot();

      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),

          claimResult: {
            claimed:
              false,

            current,
          },
        });

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_refresh_in_progress',
      );

      expect(
        test.crypto.decrypt,
      ).not.toHaveBeenCalledWith({
        encryptedValue:
          'enc-refresh',

        keyVersion:
          'key-v1',
      });

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).not.toHaveBeenCalled();
    });

    it('28. losing the claim never calls OAuth with the old generation', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),

          claimResult: {
            claimed:
              false,

            current:
              refreshingSnapshot(),
          },
        });

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_refresh_in_progress',
      );

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).not.toHaveBeenCalled();
    });

    it('29. losing the claim to a newer usable ACTIVE generation may return that newer token', async () => {
      const newer =
        snapshot({
          accessTokenEncrypted:
            'enc-access-newer',

          tokenGeneration:
            8,

          accessTokenExpiresAt:
            new Date(
              NOW.getTime() +
              SAFETY_WINDOW_MS +
              60_000,
            ),
        });

      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),

          claimResult: {
            claimed:
              false,

            current:
              newer,
          },
        });

      const {
        coordinator,
      } =
        createCoordinator(test);

      const result =
        await coordinator
          .getAccessToken({
            salesChannelId:
              SALES_CHANNEL_ID,
          });

      expect(result).toEqual(
        expect.objectContaining({
          accessToken:
            'plain-newer-access-token',

          tokenGeneration:
            8,

          source:
            'CACHED',
        }),
      );

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).not.toHaveBeenCalled();
    });

    it('30. losing the claim to REFRESHING returns refresh-in-progress', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),

          claimResult: {
            claimed:
              false,

            current:
              refreshingSnapshot(),
          },
        });

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_refresh_in_progress',
      );
    });

    it('31. losing the claim respects ROTATION_UNCERTAIN and REAUTH_REQUIRED current states', async () => {
      const cases:
        Array<{
          status:
            CredentialStatus;

          code:
            string;
        }> = [
          {
            status:
              'ROTATION_UNCERTAIN',

            code:
              'credential_rotation_uncertain',
          },
          {
            status:
              'REAUTH_REQUIRED',

            code:
              'credential_reauth_required',
          },
        ];

      for (
        const item
        of cases
      ) {
        const test =
          createDependencies({
            snapshot:
              refreshNeededSnapshot(),

            claimResult: {
              claimed:
                false,

              current:
                refreshNeededSnapshot({
                  credentialStatus:
                    item.status,
                }),
            },
          });

        const {
          module,
          coordinator,
        } =
          createCoordinator(test);

        await expectCoordinatorError(
          coordinator.getAccessToken({
            salesChannelId:
              SALES_CHANNEL_ID,
          }),
          module,
          item.code,
        );

        expect(
          test.oauthClient
            .refreshAccessToken,
        ).not.toHaveBeenCalled();
      }
    });

    it('32. coordinator does not loop trying to reacquire a lost refresh claim', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),

          claimResult: {
            claimed:
              false,

            current:
              refreshingSnapshot(),
          },
        });

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_refresh_in_progress',
      );

      expect(
        test.store
          .tryClaimRefresh,
      ).toHaveBeenCalledTimes(1);
    });

    it('33. OAuth refresh receives only client id, client secret and claimed-generation refresh token', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      const {
        coordinator,
      } =
        createCoordinator(test);

      await coordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).toHaveBeenCalledTimes(1);

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).toHaveBeenCalledWith({
        clientId:
          'synthetic-client-id',

        clientSecret:
          'synthetic-client-secret',

        refreshToken:
          'plain-refresh-token',
      });
    });

    it('34. OAuth refresh receives no old access token or internal Marto coordination context', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      const {
        coordinator,
      } =
        createCoordinator(test);

      await coordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

      const oauthInput =
        test.oauthClient
          .refreshAccessToken
          .mock.calls[0][0];

      expect(
        Object.keys(oauthInput)
          .sort(),
      ).toEqual([
        'clientId',
        'clientSecret',
        'refreshToken',
      ]);

      expect(oauthInput)
        .not.toHaveProperty(
          'accessToken',
        );

      expect(oauthInput)
        .not.toHaveProperty(
          'salesChannelId',
        );

      expect(oauthInput)
        .not.toHaveProperty(
          'tokenGeneration',
        );

      expect(oauthInput)
        .not.toHaveProperty(
          'refreshAttemptId',
        );
    });

    it('35. each public execution makes at most one OAuth refresh call', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      const {
        coordinator,
      } =
        createCoordinator(test);

      await coordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).toHaveBeenCalledTimes(1);
    });

    it('36. valid cached path makes zero OAuth refresh calls', async () => {
      const test =
        createDependencies();

      const {
        coordinator,
      } =
        createCoordinator(test);

      await coordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).not.toHaveBeenCalled();
    });

    it('37. refresh response userId must match authorizedExternalAccountId', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),

          tokenResult: {
            ...TOKEN_RESULT,

            userId:
              'seller-different',
          },
        });

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_identity_mismatch',
      );

      expect(
        test.store
          .completeRefresh,
      ).not.toHaveBeenCalled();
    });

    it('38. successful refresh keeps OAuth userId aligned with SalesChannel.externalAccountId', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      const {
        coordinator,
      } =
        createCoordinator(test);

      await coordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

      expect(
        test.store
          .completeRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          authorizedExternalAccountId:
            EXTERNAL_ACCOUNT_ID,
        }),
      );
    });

    it('39. identity mismatch attempts to mark the claimed generation REAUTH_REQUIRED', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),

          tokenResult: {
            ...TOKEN_RESULT,

            userId:
              'seller-different',
          },
        });

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_identity_mismatch',
      );

      expect(
        test.store.failRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          salesChannelId:
            SALES_CHANNEL_ID,

          expectedTokenGeneration:
            7,

          refreshAttemptId:
            ATTEMPT_ID,

          targetStatus:
            'REAUTH_REQUIRED',
        }),
      );
    });

    it('40. identity mismatch never persists newly received tokens', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),

          tokenResult: {
            ...TOKEN_RESULT,

            userId:
              'seller-different',
          },
        });

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_identity_mismatch',
      );

      expect(
        test.store
          .completeRefresh,
      ).not.toHaveBeenCalled();

      expect(
        test.crypto.encrypt,
      ).not.toHaveBeenCalled();
    });

    it('41. new expiration uses the clock after the OAuth response plus expiresIn', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      let currentNow =
        new Date(NOW);

      test.clock.now
        .mockImplementation(
          () =>
            new Date(
              currentNow,
            ),
        );

      test.oauthClient
        .refreshAccessToken
        .mockImplementation(
          async () => {
            currentNow =
              new Date(
                RESPONSE_AT,
              );

            return TOKEN_RESULT;
          },
        );

      const {
        coordinator,
      } =
        createCoordinator(test);

      await coordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

      expect(
        test.store
          .completeRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          accessTokenExpiresAt:
            new Date(
              RESPONSE_AT.getTime() +
              TOKEN_RESULT
                .expiresIn *
              1000,
            ),

          lastRotatedAt:
            RESPONSE_AT,
        }),
      );
    });

    it('42. new expiration uses exactly the returned expiresIn and no hardcoded duration', async () => {
      const expiresIn =
        777;

      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),

          tokenResult: {
            ...TOKEN_RESULT,

            expiresIn,
          },
        });

      const {
        coordinator,
      } =
        createCoordinator(test);

      await coordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

      expect(
        test.store
          .completeRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          accessTokenExpiresAt:
            new Date(
              NOW.getTime() +
              expiresIn * 1000,
            ),
        }),
      );
    });

    it('43. new access and refresh tokens are encrypted only after identity validation', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),

          tokenResult: {
            ...TOKEN_RESULT,

            userId:
              'identity-mismatch',
          },
        });

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_identity_mismatch',
      );

      expect(
        test.crypto.encrypt,
      ).not.toHaveBeenCalled();
    });

    it('44. encrypted access and refresh tokens must use the same encryptionKeyVersion', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      test.crypto.encrypt
        .mockReset();

      test.crypto.encrypt
        .mockReturnValueOnce({
          encryptedValue:
            'enc-new-access',

          keyVersion:
            'key-v1',
        })
        .mockReturnValueOnce({
          encryptedValue:
            'enc-new-refresh',

          keyVersion:
            'key-v2',
        });

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_rotation_uncertain',
      );

      expect(
        test.store
          .completeRefresh,
      ).not.toHaveBeenCalled();

      expect(
        test.store.failRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          targetStatus:
            'ROTATION_UNCERTAIN',
        }),
      );
    });

    it('45. successful commit uses CAS with expected generation and refreshAttemptId', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      const {
        coordinator,
      } =
        createCoordinator(test);

      await coordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

      expect(
        test.store
          .completeRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          salesChannelId:
            SALES_CHANNEL_ID,

          expectedTokenGeneration:
            7,

          refreshAttemptId:
            ATTEMPT_ID,
        }),
      );
    });

    it('46. successful commit increments tokenGeneration by exactly one', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot({
              tokenGeneration:
                41,
            }),
        });

      const {
        coordinator,
      } =
        createCoordinator(test);

      const result =
        await coordinator
          .getAccessToken({
            salesChannelId:
              SALES_CHANNEL_ID,
          });

      expect(
        test.store
          .completeRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedTokenGeneration:
            41,

          newTokenGeneration:
            42,
        }),
      );

      expect(
        result.tokenGeneration,
      ).toBe(
        42,
      );
    });

    it('47. successful refresh returns ACTIVE state and clears refresh/error metadata in the atomic commit', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      const {
        coordinator,
      } =
        createCoordinator(test);

      await coordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

      expect(
        test.store
          .completeRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          status:
            'ACTIVE',

          refreshAttemptIdAfterCommit:
            null,

          refreshStartedAtAfterCommit:
            null,

          lastErrorCodeAfterCommit:
            null,

          lastErrorAtAfterCommit:
            null,
        }),
      );
    });

    it('48. successful refresh persists access, refresh, metadata and expiry as one logical generation', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      const {
        coordinator,
      } =
        createCoordinator(test);

      await coordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

      expect(
        test.store
          .completeRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          accessTokenEncrypted:
            'enc-new-access',

          refreshTokenEncrypted:
            'enc-new-refresh',

          encryptionKeyVersion:
            'key-v1',

          tokenType:
            'Bearer',

          scope:
            'read write',

          authorizedExternalAccountId:
            EXTERNAL_ACCOUNT_ID,

          newTokenGeneration:
            8,
        }),
      );
    });

    it('49. new refresh token replaces the previous one and the old refresh token is never returned or reused', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      const {
        coordinator,
      } =
        createCoordinator(test);

      const result =
        await coordinator
          .getAccessToken({
            salesChannelId:
              SALES_CHANNEL_ID,
          });

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).toHaveBeenCalledTimes(1);

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken:
            'plain-refresh-token',
        }),
      );

      expect(
        test.store
          .completeRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshTokenEncrypted:
            'enc-new-refresh',
        }),
      );

      expect(result)
        .not.toHaveProperty(
          'refreshToken',
        );
    });

    it('50. public result exposes access-token metadata but never refresh token', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      const {
        coordinator,
      } =
        createCoordinator(test);

      const result =
        await coordinator
          .getAccessToken({
            salesChannelId:
              SALES_CHANNEL_ID,
          });

      expect(result).toEqual(
        expect.objectContaining({
          accessToken:
            'new-access-token',

          tokenType:
            'Bearer',

          tokenGeneration:
            8,

          source:
            'REFRESHED',
        }),
      );

      expect(result)
        .not.toHaveProperty(
          'refreshToken',
        );

      expect(
        JSON.stringify(result),
      ).not.toContain(
        'new-refresh-token',
      );
    });

    it('51. invalid_grant moves the claimed generation to REAUTH_REQUIRED without internal retry', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      test.oauthClient
        .refreshAccessToken
        .mockRejectedValue(
          oauthError(
            400,
            'invalid_grant',
          ),
        );

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_reauth_required',
      );

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).toHaveBeenCalledTimes(1);

      expect(
        test.store.failRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedTokenGeneration:
            7,

          refreshAttemptId:
            ATTEMPT_ID,

          targetStatus:
            'REAUTH_REQUIRED',
        }),
      );
    });

    it('52. HTTP 429 moves the claimed generation to TRANSIENT_ERROR without immediate retry', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      test.oauthClient
        .refreshAccessToken
        .mockRejectedValue(
          oauthError(
            429,
          ),
        );

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_refresh_failed',
      );

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).toHaveBeenCalledTimes(1);

      expect(
        test.store.failRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          targetStatus:
            'TRANSIENT_ERROR',
        }),
      );
    });

    it('53. other non-invalid_grant HTTP 4xx becomes controlled TRANSIENT_ERROR', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      test.oauthClient
        .refreshAccessToken
        .mockRejectedValue(
          oauthError(
            400,
            'invalid_request',
          ),
        );

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_refresh_failed',
      );

      expect(
        test.store.failRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          targetStatus:
            'TRANSIENT_ERROR',
        }),
      );
    });

    it('54. HTTP 5xx becomes ROTATION_UNCERTAIN', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      test.oauthClient
        .refreshAccessToken
        .mockRejectedValue(
          oauthError(
            500,
          ),
        );

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_rotation_uncertain',
      );

      expect(
        test.store.failRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          targetStatus:
            'ROTATION_UNCERTAIN',
        }),
      );

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).toHaveBeenCalledTimes(1);
    });

    it('55. unknown ambiguous network failure becomes ROTATION_UNCERTAIN', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      test.oauthClient
        .refreshAccessToken
        .mockRejectedValue(
          new Error(
            'synthetic-network-failure',
          ),
        );

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_rotation_uncertain',
      );

      expect(
        test.store.failRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          targetStatus:
            'ROTATION_UNCERTAIN',
        }),
      );

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).toHaveBeenCalledTimes(1);
    });

    it('56. refresh-token decryption failure before OAuth does not call OAuth and ends the attempt safely', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      test.crypto.decrypt
        .mockImplementation(
          (
            input:
              CryptoDecryptInput,
          ) => {
            if (
              input.encryptedValue ===
              'enc-refresh'
            ) {
              throw new Error(
                'credential_decryption_failed',
              );
            }

            return 'plain-access-token';
          },
        );

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_crypto_unavailable',
      );

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).not.toHaveBeenCalled();

      expect(
        test.store.failRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedTokenGeneration:
            7,

          refreshAttemptId:
            ATTEMPT_ID,

          targetStatus:
            'TRANSIENT_ERROR',
        }),
      );
    });

    it('57. encryption failure after successful OAuth becomes ROTATION_UNCERTAIN', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),
        });

      test.crypto.encrypt
        .mockImplementation(
          () => {
            throw new Error(
              'credential_encryption_failed',
            );
          },
        );

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_rotation_uncertain',
      );

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).toHaveBeenCalledTimes(1);

      expect(
        test.store
          .completeRefresh,
      ).not.toHaveBeenCalled();

      expect(
        test.store.failRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          targetStatus:
            'ROTATION_UNCERTAIN',
        }),
      );
    });

    it('58. failed or stale atomic commit after successful OAuth never returns to the old generation and becomes rotation-uncertain', async () => {
      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),

          completeResult: {
            committed:
              false,

            current:
              refreshingSnapshot(),
          },
        });

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_rotation_uncertain',
      );

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).toHaveBeenCalledTimes(1);

      expect(
        test.store
          .completeRefresh,
      ).toHaveBeenCalledTimes(1);

      expect(
        test.store.failRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedTokenGeneration:
            7,

          refreshAttemptId:
            ATTEMPT_ID,

          targetStatus:
            'ROTATION_UNCERTAIN',
        }),
      );

      expect(
        test.oauthClient
          .refreshAccessToken,
      ).not.toHaveBeenCalledTimes(2);
    });

    it('59. failure transition is CAS-bound to generation and attempt id and cannot overwrite a newer generation', async () => {
      const newer =
        snapshot({
          tokenGeneration:
            8,

          accessTokenEncrypted:
            'enc-access-newer',
        });

      const test =
        createDependencies({
          snapshot:
            refreshNeededSnapshot(),

          failResult: {
            committed:
              false,

            current:
              newer,
          },
        });

      test.oauthClient
        .refreshAccessToken
        .mockRejectedValue(
          oauthError(
            400,
            'invalid_grant',
          ),
        );

      const {
        module,
        coordinator,
      } =
        createCoordinator(test);

      await expectCoordinatorError(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
        module,
        'credential_refresh_conflict',
      );

      expect(
        test.store.failRefresh,
      ).toHaveBeenCalledTimes(1);

      expect(
        test.store.failRefresh,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedTokenGeneration:
            7,

          refreshAttemptId:
            ATTEMPT_ID,
        }),
      );

      expect(
        test.store
          .completeRefresh,
      ).not.toHaveBeenCalled();
    });

    it('60. coordinator remains free of Prisma, Nest, ConfigService, process.env, fetch, axios, Redis, BullMQ, logs, sleep, polling and retry loops', () => {
      const test =
        createDependencies();

      createCoordinator(test);

      const source =
        readFileSync(
          join(
            __dirname,
            'mercado-livre-access-token-coordinator.ts',
          ),
          'utf8',
        );

      for (
        const forbidden
        of [
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
          'setTimeout(',
          'setInterval(',
          'sleep(',
        ]
      ) {
        expect(source)
          .not.toContain(
            forbidden,
          );
      }
    });
  },
);
describe('MercadoLivreAccessTokenCoordinator adversarial audit', () => {
  it('61. lost claim cannot switch to a different salesChannelId', async () => {
    const test =
      createDependencies({
        snapshot:
          refreshNeededSnapshot(),

        claimResult: {
          claimed:
            false,

          current:
            snapshot({
              salesChannelId:
                'sales-channel-attacker',

              tokenGeneration:
                8,

              accessTokenEncrypted:
                'enc-access-newer',
            }),
        },
      });

    const {
      module,
      coordinator,
    } =
      createCoordinator(test);

    await expectCoordinatorError(
      coordinator.getAccessToken({
        salesChannelId:
          SALES_CHANNEL_ID,
      }),
      module,
      'credential_refresh_conflict',
    );

    expect(
      test.oauthClient
        .refreshAccessToken,
    ).not.toHaveBeenCalled();
  });

  it('62. lost claim cannot silently switch to a different external account identity', async () => {
    const test =
      createDependencies({
        snapshot:
          refreshNeededSnapshot(),

        claimResult: {
          claimed:
            false,

          current:
            snapshot({
              externalAccountId:
                'seller-attacker',

              authorizedExternalAccountId:
                'seller-attacker',

              tokenGeneration:
                8,

              accessTokenEncrypted:
                'enc-access-newer',
            }),
        },
      });

    const {
      module,
      coordinator,
    } =
      createCoordinator(test);

    await expectCoordinatorError(
      coordinator.getAccessToken({
        salesChannelId:
          SALES_CHANNEL_ID,
      }),
      module,
      'credential_identity_mismatch',
    );

    expect(
      test.oauthClient
        .refreshAccessToken,
    ).not.toHaveBeenCalled();
  });

  it('63. lost claim cannot treat the same tokenGeneration as a newer successful generation', async () => {
    const test =
      createDependencies({
        snapshot:
          refreshNeededSnapshot({
            tokenGeneration:
              7,
          }),

        claimResult: {
          claimed:
            false,

          current:
            snapshot({
              tokenGeneration:
                7,

              accessTokenEncrypted:
                'enc-access-newer',

              accessTokenExpiresAt:
                new Date(
                  NOW.getTime() +
                  SAFETY_WINDOW_MS +
                  60_000,
                ),
            }),
        },
      });

    const {
      module,
      coordinator,
    } =
      createCoordinator(test);

    await expectCoordinatorError(
      coordinator.getAccessToken({
        salesChannelId:
          SALES_CHANNEL_ID,
      }),
      module,
      'credential_refresh_conflict',
    );

    expect(
      test.oauthClient
        .refreshAccessToken,
    ).not.toHaveBeenCalled();
  });

  it('64. lost claim may return a genuinely newer ACTIVE generation for the same channel and identity', async () => {
    const test =
      createDependencies({
        snapshot:
          refreshNeededSnapshot({
            tokenGeneration:
              7,
          }),

        claimResult: {
          claimed:
            false,

          current:
            snapshot({
              tokenGeneration:
                8,

              accessTokenEncrypted:
                'enc-access-newer',

              accessTokenExpiresAt:
                new Date(
                  NOW.getTime() +
                  SAFETY_WINDOW_MS +
                  60_000,
                ),
            }),
        },
      });

    const {
      coordinator,
    } =
      createCoordinator(test);

    const result =
      await coordinator
        .getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        });

    expect(result).toEqual(
      expect.objectContaining({
        accessToken:
          'plain-newer-access-token',

        authorizedExternalAccountId:
          EXTERNAL_ACCOUNT_ID,

        tokenGeneration:
          8,

        source:
          'CACHED',
      }),
    );

    expect(
      test.oauthClient
        .refreshAccessToken,
    ).not.toHaveBeenCalled();
  });

  it('65. ambiguous OAuth failure sanitizes secret-bearing transport errors', async () => {
    const test =
      createDependencies({
        snapshot:
          refreshNeededSnapshot(),
      });

    test.oauthClient
      .refreshAccessToken
      .mockRejectedValue(
        new Error(
          'raw-body must-not-leak-access must-not-leak-refresh synthetic-client-secret',
        ),
      );

    const {
      module,
      coordinator,
    } =
      createCoordinator(test);

    const error =
      await captureRejection(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
      );

    expect(error)
      .toBeInstanceOf(
        module
          .MercadoLivreAccessTokenCoordinatorError,
      );

    expect(
      (
        error as {
          code?: unknown;
        }
      ).code,
    ).toBe(
      'credential_rotation_uncertain',
    );

    const message =
      (error as Error).message;

    for (
      const secret
      of [
        'raw-body',
        'must-not-leak-access',
        'must-not-leak-refresh',
        'synthetic-client-secret',
      ]
    ) {
      expect(message)
        .not.toContain(
          secret,
        );
    }
  });

  it('66. refresh-token crypto failure sanitizes the underlying secret-bearing error', async () => {
    const test =
      createDependencies({
        snapshot:
          refreshNeededSnapshot(),
      });

    test.crypto.decrypt
      .mockImplementation(
        (
          input:
            CryptoDecryptInput,
        ) => {
          if (
            input.encryptedValue ===
            'enc-refresh'
          ) {
            throw new Error(
              'must-not-leak-refresh-token must-not-leak-encrypted-token',
            );
          }

          return 'plain-access-token';
        },
      );

    const {
      module,
      coordinator,
    } =
      createCoordinator(test);

    const error =
      await captureRejection(
        coordinator.getAccessToken({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
      );

    expect(error)
      .toBeInstanceOf(
        module
          .MercadoLivreAccessTokenCoordinatorError,
      );

    expect(
      (
        error as {
          code?: unknown;
        }
      ).code,
    ).toBe(
      'credential_crypto_unavailable',
    );

    const message =
      (error as Error).message;

    expect(message)
      .not.toContain(
        'must-not-leak-refresh-token',
      );

    expect(message)
      .not.toContain(
        'must-not-leak-encrypted-token',
      );
  });
});
