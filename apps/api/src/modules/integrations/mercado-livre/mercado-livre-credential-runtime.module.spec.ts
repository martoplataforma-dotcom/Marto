import type {
  Type,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import {
  Test,
  type TestingModule,
} from '@nestjs/testing';

import {
  readFileSync,
} from 'node:fs';

import {
  join,
} from 'node:path';

import {
  PrismaService,
} from '../../../common/prisma/prisma.service';

import {
  SalesChannelCredentialCryptoService,
} from '../credentials/sales-channel-credential-crypto.service';

import {
  MercadoLivreAccessTokenCoordinator,
} from './mercado-livre-access-token-coordinator';

import {
  MercadoLivreOAuthClient,
} from './mercado-livre.oauth-client';

import {
  MercadoLivreOAuthFetchTransport,
} from './mercado-livre.oauth-fetch-transport';

import {
  MercadoLivrePrismaCredentialStore,
} from './mercado-livre-prisma-credential.store';

type RuntimeModuleContract = {
  MercadoLivreCredentialRuntimeModule:
    Type<unknown>;

  MERCADO_LIVRE_CREDENTIAL_CLOCK:
    symbol;

  MERCADO_LIVRE_REFRESH_ATTEMPT_ID_GENERATOR:
    symbol;

  MERCADO_LIVRE_ACCESS_TOKEN_COORDINATOR_CONFIG:
    symbol;
};

type RuntimeConfig =
  Record<string, string | undefined>;

type RuntimeClock = {
  now(): Date;
};

type RuntimeIdGenerator = {
  generate(): string;
};

type CoordinatorDependencies = {
  store:
    MercadoLivrePrismaCredentialStore;

  crypto:
    SalesChannelCredentialCryptoService;

  oauthClient:
    MercadoLivreOAuthClient;

  clock:
    RuntimeClock;

  refreshAttemptIdGenerator:
    RuntimeIdGenerator;

  config: {
    clientId: string;
    clientSecret: string;
    refreshSafetyWindowMs: number;
    transientRetryDelayMs: number;
    refreshStaleAfterMs: number;
  };
};

const CONFIG = {
  clientId:
    'MARTO_MERCADO_LIVRE_CLIENT_ID',

  clientSecret:
    'MARTO_MERCADO_LIVRE_CLIENT_SECRET',

  refreshSafetyWindowMs:
    'MARTO_MERCADO_LIVRE_REFRESH_SAFETY_WINDOW_MS',

  transientRetryDelayMs:
    'MARTO_MERCADO_LIVRE_TRANSIENT_RETRY_DELAY_MS',

  refreshStaleAfterMs:
    'MARTO_MERCADO_LIVRE_REFRESH_STALE_AFTER_MS',

  encryptionCurrentVersion:
    'MARTO_CREDENTIAL_ENCRYPTION_CURRENT_KEY_VERSION',

  encryptionKeys:
    'MARTO_CREDENTIAL_ENCRYPTION_KEYS',
} as const;

function validConfig():
RuntimeConfig {
  return {
    [CONFIG.clientId]:
      'synthetic-client-id',

    [CONFIG.clientSecret]:
      'synthetic-client-secret',

    [CONFIG.refreshSafetyWindowMs]:
      '300000',

    [CONFIG.transientRetryDelayMs]:
      '60000',

    [CONFIG.refreshStaleAfterMs]:
      '120000',

    [CONFIG.encryptionCurrentVersion]:
      'synthetic-v1',

    [CONFIG.encryptionKeys]:
      JSON.stringify({
        'synthetic-v1':
          Buffer
            .alloc(
              32,
              7,
            )
            .toString(
              'base64',
            ),
      }),
  };
}

function loadRuntimeModule():
RuntimeModuleContract {
  return jest.requireActual<
    RuntimeModuleContract
  >(
    './mercado-livre-credential-runtime.module',
  );
}

function createConfigService(
  values:
    RuntimeConfig,
): {
  get:
    jest.Mock<
      string | undefined,
      [string]
    >;
} {
  return {
    get:
      jest.fn(
        (
          key:
            string,
        ) =>
          values[key],
      ),
  };
}

function createPrismaMock() {
  return {
    salesChannelCredential: {
      findUnique:
        jest.fn(),

      updateMany:
        jest.fn(),
    },
  };
}

async function compileRuntime(
  overrides:
    RuntimeConfig = {},
): Promise<{
  moduleRef: TestingModule;
  runtime: RuntimeModuleContract;
  configService:
    ReturnType<
      typeof createConfigService
    >;
  prisma:
    ReturnType<
      typeof createPrismaMock
    >;
}> {
  const runtime =
    loadRuntimeModule();

  const configService =
    createConfigService({
      ...validConfig(),
      ...overrides,
    });

  const prisma =
    createPrismaMock();

  const builder =
    Test.createTestingModule({
      imports: [
        runtime
          .MercadoLivreCredentialRuntimeModule,
      ],
    })
      .overrideProvider(
        ConfigService,
      )
      .useValue(
        configService,
      )
      .overrideProvider(
        PrismaService,
      )
      .useValue(
        prisma,
      );

  const moduleRef =
    await builder.compile();

  await moduleRef.init();

  return {
    moduleRef,
    runtime,
    configService,
    prisma,
  };
}

function dependenciesOf(
  coordinator:
    MercadoLivreAccessTokenCoordinator,
): CoordinatorDependencies {
  return (
    coordinator as unknown as {
      dependencies:
        CoordinatorDependencies;
    }
  ).dependencies;
}

describe(
  'MercadoLivreCredentialRuntimeModule',
  () => {
    it(
      'compiles with synthetic configuration and provides the access token coordinator',
      async () => {
        const {
          moduleRef,
        } =
          await compileRuntime();

        try {
          expect(
            moduleRef.get(
              MercadoLivreAccessTokenCoordinator,
            ),
          ).toBeInstanceOf(
            MercadoLivreAccessTokenCoordinator,
          );
        } finally {
          await moduleRef.close();
        }
      },
    );

    it(
      'exports the coordinator for a parent consumer module',
      async () => {
        const runtime =
          loadRuntimeModule();

        const configService =
          createConfigService(
            validConfig(),
          );

        const prisma =
          createPrismaMock();

        const builder =
          Test.createTestingModule({
            imports: [
              runtime
                .MercadoLivreCredentialRuntimeModule,
            ],

            providers: [
              {
                provide:
                  'synthetic-consumer',

                inject: [
                  MercadoLivreAccessTokenCoordinator,
                ],

                useFactory: (
                  coordinator:
                    MercadoLivreAccessTokenCoordinator,
                ) =>
                  coordinator,
              },
            ],
          })
            .overrideProvider(
              ConfigService,
            )
            .useValue(
              configService,
            )
            .overrideProvider(
              PrismaService,
            )
            .useValue(
              prisma,
            );

        const moduleRef =
          await builder.compile();

        await moduleRef.init();

        try {
          expect(
            moduleRef.get(
              'synthetic-consumer',
            ),
          ).toBeInstanceOf(
            MercadoLivreAccessTokenCoordinator,
          );
        } finally {
          await moduleRef.close();
        }
      },
    );

    it(
      'provides the concrete Prisma credential store',
      async () => {
        const {
          moduleRef,
        } =
          await compileRuntime();

        try {
          expect(
            moduleRef.get(
              MercadoLivrePrismaCredentialStore,
            ),
          ).toBeInstanceOf(
            MercadoLivrePrismaCredentialStore,
          );
        } finally {
          await moduleRef.close();
        }
      },
    );

    it(
      'provides the existing credential crypto service',
      async () => {
        const {
          moduleRef,
        } =
          await compileRuntime();

        try {
          expect(
            moduleRef.get(
              SalesChannelCredentialCryptoService,
            ),
          ).toBeInstanceOf(
            SalesChannelCredentialCryptoService,
          );
        } finally {
          await moduleRef.close();
        }
      },
    );

    it(
      'provides the concrete OAuth fetch transport',
      async () => {
        const {
          moduleRef,
        } =
          await compileRuntime();

        try {
          expect(
            moduleRef.get(
              MercadoLivreOAuthFetchTransport,
            ),
          ).toBeInstanceOf(
            MercadoLivreOAuthFetchTransport,
          );
        } finally {
          await moduleRef.close();
        }
      },
    );

    it(
      'provides the OAuth client over the concrete OAuth transport',
      async () => {
        const {
          moduleRef,
        } =
          await compileRuntime();

        try {
          expect(
            moduleRef.get(
              MercadoLivreOAuthClient,
            ),
          ).toBeInstanceOf(
            MercadoLivreOAuthClient,
          );
        } finally {
          await moduleRef.close();
        }
      },
    );

    it(
      'wires the same Prisma store instance into the coordinator',
      async () => {
        const {
          moduleRef,
        } =
          await compileRuntime();

        try {
          const coordinator =
            moduleRef.get(
              MercadoLivreAccessTokenCoordinator,
            );

          const store =
            moduleRef.get(
              MercadoLivrePrismaCredentialStore,
            );

          expect(
            dependenciesOf(
              coordinator,
            ).store,
          ).toBe(
            store,
          );
        } finally {
          await moduleRef.close();
        }
      },
    );

    it(
      'wires the same crypto service instance into the coordinator',
      async () => {
        const {
          moduleRef,
        } =
          await compileRuntime();

        try {
          const coordinator =
            moduleRef.get(
              MercadoLivreAccessTokenCoordinator,
            );

          const crypto =
            moduleRef.get(
              SalesChannelCredentialCryptoService,
            );

          expect(
            dependenciesOf(
              coordinator,
            ).crypto,
          ).toBe(
            crypto,
          );
        } finally {
          await moduleRef.close();
        }
      },
    );

    it(
      'wires the same OAuth client instance into the coordinator',
      async () => {
        const {
          moduleRef,
        } =
          await compileRuntime();

        try {
          const coordinator =
            moduleRef.get(
              MercadoLivreAccessTokenCoordinator,
            );

          const oauthClient =
            moduleRef.get(
              MercadoLivreOAuthClient,
            );

          expect(
            dependenciesOf(
              coordinator,
            ).oauthClient,
          ).toBe(
            oauthClient,
          );
        } finally {
          await moduleRef.close();
        }
      },
    );

    it(
      'passes client id and client secret from backend configuration',
      async () => {
        const {
          moduleRef,
        } =
          await compileRuntime();

        try {
          const config =
            dependenciesOf(
              moduleRef.get(
                MercadoLivreAccessTokenCoordinator,
              ),
            ).config;

          expect(
            config.clientId,
          ).toBe(
            'synthetic-client-id',
          );

          expect(
            config.clientSecret,
          ).toBe(
            'synthetic-client-secret',
          );
        } finally {
          await moduleRef.close();
        }
      },
    );

    it(
      'parses all coordinator durations from milliseconds configuration',
      async () => {
        const {
          moduleRef,
        } =
          await compileRuntime();

        try {
          const config =
            dependenciesOf(
              moduleRef.get(
                MercadoLivreAccessTokenCoordinator,
              ),
            ).config;

          expect(
            config,
          ).toEqual(
            expect.objectContaining({
              refreshSafetyWindowMs:
                300000,

              transientRetryDelayMs:
                60000,

              refreshStaleAfterMs:
                120000,
            }),
          );
        } finally {
          await moduleRef.close();
        }
      },
    );

    it(
      'provides a clock that returns a valid Date',
      async () => {
        const {
          moduleRef,
          runtime,
        } =
          await compileRuntime();

        try {
          const clock =
            moduleRef.get<RuntimeClock>(
              runtime
                .MERCADO_LIVRE_CREDENTIAL_CLOCK,
            );

          const now =
            clock.now();

          expect(
            now,
          ).toBeInstanceOf(
            Date,
          );

          expect(
            Number.isFinite(
              now.getTime(),
            ),
          ).toBe(true);
        } finally {
          await moduleRef.close();
        }
      },
    );

    it(
      'provides a UUID refresh-attempt generator without collisions in consecutive calls',
      async () => {
        const {
          moduleRef,
          runtime,
        } =
          await compileRuntime();

        try {
          const generator =
            moduleRef.get<RuntimeIdGenerator>(
              runtime
                .MERCADO_LIVRE_REFRESH_ATTEMPT_ID_GENERATOR,
            );

          const first =
            generator.generate();

          const second =
            generator.generate();

          const uuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

          expect(
            first,
          ).toMatch(uuid);

          expect(
            second,
          ).toMatch(uuid);

          expect(
            second,
          ).not.toBe(
            first,
          );
        } finally {
          await moduleRef.close();
        }
      },
    );

    it(
      'does not call fetch while the runtime module is bootstrapped',
      async () => {
        const originalFetch =
          globalThis.fetch;

        const fetchSpy =
          jest.fn();

        globalThis.fetch =
          fetchSpy as unknown as
            typeof globalThis.fetch;

        try {
          const {
            moduleRef,
          } =
            await compileRuntime();

          try {
            expect(
              fetchSpy,
            ).not.toHaveBeenCalled();
          } finally {
            await moduleRef.close();
          }
        } finally {
          globalThis.fetch =
            originalFetch;
        }
      },
    );

    it(
      'does not read or mutate credentials in Prisma during bootstrap',
      async () => {
        const {
          moduleRef,
          prisma,
        } =
          await compileRuntime();

        try {
          expect(
            prisma
              .salesChannelCredential
              .findUnique,
          ).not.toHaveBeenCalled();

          expect(
            prisma
              .salesChannelCredential
              .updateMany,
          ).not.toHaveBeenCalled();
        } finally {
          await moduleRef.close();
        }
      },
    );

    it(
      'rejects missing Mercado Livre client id',
      async () => {
        await expect(
          compileRuntime({
            [CONFIG.clientId]:
              undefined,
          }),
        ).rejects.toThrow(
          'mercado_livre_runtime_config_invalid',
        );
      },
    );

    it(
      'rejects missing Mercado Livre client secret',
      async () => {
        await expect(
          compileRuntime({
            [CONFIG.clientSecret]:
              undefined,
          }),
        ).rejects.toThrow(
          'mercado_livre_runtime_config_invalid',
        );
      },
    );

    it(
      'rejects missing refresh safety window',
      async () => {
        await expect(
          compileRuntime({
            [CONFIG.refreshSafetyWindowMs]:
              undefined,
          }),
        ).rejects.toThrow(
          'mercado_livre_runtime_config_invalid',
        );
      },
    );

    it(
      'rejects missing transient retry delay',
      async () => {
        await expect(
          compileRuntime({
            [CONFIG.transientRetryDelayMs]:
              undefined,
          }),
        ).rejects.toThrow(
          'mercado_livre_runtime_config_invalid',
        );
      },
    );

    it(
      'rejects missing refresh stale threshold',
      async () => {
        await expect(
          compileRuntime({
            [CONFIG.refreshStaleAfterMs]:
              undefined,
          }),
        ).rejects.toThrow(
          'mercado_livre_runtime_config_invalid',
        );
      },
    );

    it(
      'rejects malformed millisecond configuration',
      async () => {
        await expect(
          compileRuntime({
            [CONFIG.refreshSafetyWindowMs]:
              '30 seconds',
          }),
        ).rejects.toThrow(
          'mercado_livre_runtime_config_invalid',
        );
      },
    );

    it(
      'rejects zero refresh stale threshold',
      async () => {
        await expect(
          compileRuntime({
            [CONFIG.refreshStaleAfterMs]:
              '0',
          }),
        ).rejects.toThrow(
          'mercado_livre_runtime_config_invalid',
        );
      },
    );

    it(
      'rejects surrounding whitespace in a secret instead of trimming it silently',
      async () => {
        await expect(
          compileRuntime({
            [CONFIG.clientSecret]:
              ' synthetic-secret ',
          }),
        ).rejects.toThrow(
          'mercado_livre_runtime_config_invalid',
        );
      },
    );

    it(
      'keeps the runtime module free of AppModule routes direct env PrismaClient Redis BullMQ and Math.random',
      () => {
        loadRuntimeModule();

        const source =
          readFileSync(
            join(
              __dirname,
              'mercado-livre-credential-runtime.module.ts',
            ),
            'utf8',
          );

        for (
          const forbidden
          of [
            'AppModule',
            '@Controller',
            'Controller(',
            'process.env',
            'new PrismaClient',
            "from '@prisma/client'",
            'redis',
            'bullmq',
            'Math.random',
          ]
        ) {
          expect(
            source.toLowerCase(),
          ).not.toContain(
            forbidden.toLowerCase(),
          );
        }

        for (
          const required
          of [
            'ConfigService',
            'PrismaModule',
            'SalesChannelCredentialModule',
            'MARTO_MERCADO_LIVRE_CLIENT_ID',
            'MARTO_MERCADO_LIVRE_CLIENT_SECRET',
            'MARTO_MERCADO_LIVRE_REFRESH_SAFETY_WINDOW_MS',
            'MARTO_MERCADO_LIVRE_TRANSIENT_RETRY_DELAY_MS',
            'MARTO_MERCADO_LIVRE_REFRESH_STALE_AFTER_MS',
          ]
        ) {
          expect(
            source,
          ).toContain(
            required,
          );
        }
      },
    );
  },
);
describe('MercadoLivreCredentialRuntimeModule adversarial', () => {
  it(
    'wires the exact clock provider instance into the coordinator',
    async () => {
      const {
        moduleRef,
        runtime,
      } =
        await compileRuntime();

      try {
        const clock =
          moduleRef.get<RuntimeClock>(
            runtime
              .MERCADO_LIVRE_CREDENTIAL_CLOCK,
          );

        const coordinator =
          moduleRef.get(
            MercadoLivreAccessTokenCoordinator,
          );

        expect(
          dependenciesOf(
            coordinator,
          ).clock,
        ).toBe(
          clock,
        );
      } finally {
        await moduleRef.close();
      }
    },
  );

  it(
    'wires the exact refresh-attempt generator instance into the coordinator',
    async () => {
      const {
        moduleRef,
        runtime,
      } =
        await compileRuntime();

      try {
        const generator =
          moduleRef.get<RuntimeIdGenerator>(
            runtime
              .MERCADO_LIVRE_REFRESH_ATTEMPT_ID_GENERATOR,
          );

        const coordinator =
          moduleRef.get(
            MercadoLivreAccessTokenCoordinator,
          );

        expect(
          dependenciesOf(
            coordinator,
          ).refreshAttemptIdGenerator,
        ).toBe(
          generator,
        );
      } finally {
        await moduleRef.close();
      }
    },
  );

  it(
    'wires the exact parsed config object into the coordinator',
    async () => {
      const {
        moduleRef,
        runtime,
      } =
        await compileRuntime();

      try {
        const config =
          moduleRef.get<
            CoordinatorDependencies[
              'config'
            ]
          >(
            runtime
              .MERCADO_LIVRE_ACCESS_TOKEN_COORDINATOR_CONFIG,
          );

        const coordinator =
          moduleRef.get(
            MercadoLivreAccessTokenCoordinator,
          );

        expect(
          dependenciesOf(
            coordinator,
          ).config,
        ).toBe(
          config,
        );
      } finally {
        await moduleRef.close();
      }
    },
  );

  it(
    'constructs the Prisma credential store over the injected PrismaService instance',
    async () => {
      const {
        moduleRef,
        prisma,
      } =
        await compileRuntime();

      try {
        const store =
          moduleRef.get(
            MercadoLivrePrismaCredentialStore,
          );

        const internalPrisma =
          (
            store as unknown as {
              prisma:
                unknown;
            }
          ).prisma;

        expect(
          internalPrisma,
        ).toBe(
          prisma,
        );
      } finally {
        await moduleRef.close();
      }
    },
  );

  it(
    'constructs the OAuth client over the same concrete OAuth transport instance',
    async () => {
      const {
        moduleRef,
      } =
        await compileRuntime();

      try {
        const client =
          moduleRef.get(
            MercadoLivreOAuthClient,
          );

        const transport =
          moduleRef.get(
            MercadoLivreOAuthFetchTransport,
          );

        const internalTransport =
          (
            client as unknown as {
              transport:
                unknown;
            }
          ).transport;

        expect(
          internalTransport,
        ).toBe(
          transport,
        );
      } finally {
        await moduleRef.close();
      }
    },
  );

  it(
    'accepts zero refresh safety window',
    async () => {
      const {
        moduleRef,
      } =
        await compileRuntime({
          [CONFIG.refreshSafetyWindowMs]:
            '0',
        });

      try {
        const config =
          dependenciesOf(
            moduleRef.get(
              MercadoLivreAccessTokenCoordinator,
            ),
          ).config;

        expect(
          config.refreshSafetyWindowMs,
        ).toBe(0);
      } finally {
        await moduleRef.close();
      }
    },
  );

  it(
    'accepts zero transient retry delay',
    async () => {
      const {
        moduleRef,
      } =
        await compileRuntime({
          [CONFIG.transientRetryDelayMs]:
            '0',
        });

      try {
        const config =
          dependenciesOf(
            moduleRef.get(
              MercadoLivreAccessTokenCoordinator,
            ),
          ).config;

        expect(
          config.transientRetryDelayMs,
        ).toBe(0);
      } finally {
        await moduleRef.close();
      }
    },
  );

  it(
    'rejects negative millisecond values',
    async () => {
      for (
        const key
        of [
          CONFIG.refreshSafetyWindowMs,
          CONFIG.transientRetryDelayMs,
          CONFIG.refreshStaleAfterMs,
        ]
      ) {
        await expect(
          compileRuntime({
            [key]:
              '-1',
          }),
        ).rejects.toThrow(
          'mercado_livre_runtime_config_invalid',
        );
      }
    },
  );

  it(
    'rejects decimal scientific signed and whitespace millisecond encodings',
    async () => {
      for (
        const value
        of [
          '1.5',
          '1e3',
          '+1000',
          ' 1000',
          '1000 ',
        ]
      ) {
        await expect(
          compileRuntime({
            [CONFIG.refreshSafetyWindowMs]:
              value,
          }),
        ).rejects.toThrow(
          'mercado_livre_runtime_config_invalid',
        );
      }
    },
  );

  it(
    'rejects non-canonical leading-zero millisecond values',
    async () => {
      for (
        const value
        of [
          '00',
          '01',
          '0001000',
        ]
      ) {
        await expect(
          compileRuntime({
            [CONFIG.transientRetryDelayMs]:
              value,
          }),
        ).rejects.toThrow(
          'mercado_livre_runtime_config_invalid',
        );
      }
    },
  );

  it(
    'rejects millisecond values outside the JavaScript safe integer range',
    async () => {
      const unsafe =
        String(
          Number.MAX_SAFE_INTEGER +
          1,
        );

      for (
        const key
        of [
          CONFIG.refreshSafetyWindowMs,
          CONFIG.transientRetryDelayMs,
          CONFIG.refreshStaleAfterMs,
        ]
      ) {
        await expect(
          compileRuntime({
            [key]:
              unsafe,
          }),
        ).rejects.toThrow(
          'mercado_livre_runtime_config_invalid',
        );
      }
    },
  );

  it(
    'rejects blank Mercado Livre client id',
    async () => {
      await expect(
        compileRuntime({
          [CONFIG.clientId]:
            '',
        }),
      ).rejects.toThrow(
        'mercado_livre_runtime_config_invalid',
      );
    },
  );

  it(
    'rejects surrounding whitespace in Mercado Livre client id',
    async () => {
      await expect(
        compileRuntime({
          [CONFIG.clientId]:
            ' synthetic-client-id ',
        }),
      ).rejects.toThrow(
        'mercado_livre_runtime_config_invalid',
      );
    },
  );

  it(
    'rejects blank Mercado Livre client secret',
    async () => {
      await expect(
        compileRuntime({
          [CONFIG.clientSecret]:
            '',
        }),
      ).rejects.toThrow(
        'mercado_livre_runtime_config_invalid',
      );
    },
  );

  it(
    'reads exactly the five namespaced Mercado Livre runtime configuration keys',
    async () => {
      const {
        moduleRef,
        configService,
      } =
        await compileRuntime();

      try {
        const mercadoLivreCalls =
          configService
            .get
            .mock
            .calls
            .map(
              (
                [key],
              ) =>
                key,
            )
            .filter(
              (
                key,
              ) =>
                key.startsWith(
                  'MARTO_MERCADO_LIVRE_',
                ),
            );

        expect(
          mercadoLivreCalls,
        ).toEqual([
          CONFIG.clientId,
          CONFIG.clientSecret,
          CONFIG.refreshSafetyWindowMs,
          CONFIG.transientRetryDelayMs,
          CONFIG.refreshStaleAfterMs,
        ]);
      } finally {
        await moduleRef.close();
      }
    },
  );

  it(
    'keeps invalid-config bootstrap free of OAuth network activity and logging dependencies',
    async () => {
      const originalFetch =
        globalThis.fetch;

      const fetchSpy =
        jest.fn();

      globalThis.fetch =
        fetchSpy as unknown as
          typeof globalThis.fetch;

      try {
        await expect(
          compileRuntime({
            [CONFIG.clientId]:
              undefined,
          }),
        ).rejects.toThrow(
          'mercado_livre_runtime_config_invalid',
        );

        expect(
          fetchSpy,
        ).not.toHaveBeenCalled();

        const source =
          readFileSync(
            join(
              __dirname,
              'mercado-livre-credential-runtime.module.ts',
            ),
            'utf8',
          );

        for (
          const forbidden
          of [
            'console.',
            'Logger',
            'MercadoLivreAuthorizationFlow',
            'mercado-livre-authorization-flow',
          ]
        ) {
          expect(
            source,
          ).not.toContain(
            forbidden,
          );
        }
      } finally {
        globalThis.fetch =
          originalFetch;
      }
    },
  );
});