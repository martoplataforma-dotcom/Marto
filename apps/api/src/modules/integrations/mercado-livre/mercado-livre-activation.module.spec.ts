import type {
  Type,
} from '@nestjs/common';

import {
  readFileSync,
} from 'node:fs';

import {
  join,
} from 'node:path';

type ActivationModuleContract = {
  MercadoLivreActivationModule:
    Type<unknown>;

  MARTO_MERCADO_LIVRE_ENABLED:
    string;
};

type EnvValues =
  Record<
    string,
    string | undefined
  >;

type ActivationInspection = {
  coordinatorPresent:
    boolean;

  exportedFlag:
    string;

  fetchCalls:
    number;

  prismaFindCalls:
    number;

  prismaUpdateCalls:
    number;
};

const ENV_KEYS = [
  'MARTO_MERCADO_LIVRE_ENABLED',
  'MARTO_MERCADO_LIVRE_CLIENT_ID',
  'MARTO_MERCADO_LIVRE_CLIENT_SECRET',
  'MARTO_MERCADO_LIVRE_REFRESH_SAFETY_WINDOW_MS',
  'MARTO_MERCADO_LIVRE_TRANSIENT_RETRY_DELAY_MS',
  'MARTO_MERCADO_LIVRE_REFRESH_STALE_AFTER_MS',
  'MARTO_CREDENTIAL_ENCRYPTION_CURRENT_KEY_VERSION',
  'MARTO_CREDENTIAL_ENCRYPTION_KEYS',
] as const;

function validEnabledEnv():
EnvValues {
  return {
    MARTO_MERCADO_LIVRE_ENABLED:
      'true',

    MARTO_MERCADO_LIVRE_CLIENT_ID:
      'synthetic-client-id',

    MARTO_MERCADO_LIVRE_CLIENT_SECRET:
      'synthetic-client-secret',

    MARTO_MERCADO_LIVRE_REFRESH_SAFETY_WINDOW_MS:
      '300000',

    MARTO_MERCADO_LIVRE_TRANSIENT_RETRY_DELAY_MS:
      '60000',

    MARTO_MERCADO_LIVRE_REFRESH_STALE_AFTER_MS:
      '120000',

    MARTO_CREDENTIAL_ENCRYPTION_CURRENT_KEY_VERSION:
      'synthetic-v1',

    MARTO_CREDENTIAL_ENCRYPTION_KEYS:
      JSON.stringify({
        'synthetic-v1':
          Buffer
            .alloc(
              32,
              11,
            )
            .toString(
              'base64',
            ),
      }),
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

async function withEnvironment<T>(
  values:
    EnvValues,

  callback:
    () => Promise<T>,
): Promise<T> {
  const before =
    new Map<
      string,
      string | undefined
    >();

  for (
    const key
    of ENV_KEYS
  ) {
    before.set(
      key,
      process.env[key],
    );

    delete process.env[key];
  }

  for (
    const [key, value]
    of Object.entries(
      values,
    )
  ) {
    if (
      value === undefined
    ) {
      delete process.env[key];
    } else {
      process.env[key] =
        value;
    }
  }

  try {
    return await callback();
  } finally {
    for (
      const key
      of ENV_KEYS
    ) {
      const previous =
        before.get(
          key,
        );

      if (
        previous === undefined
      ) {
        delete process.env[key];
      } else {
        process.env[key] =
          previous;
      }
    }
  }
}

async function inspectActivation(
  values:
    EnvValues,
): Promise<ActivationInspection> {
  return await withEnvironment(
    values,

    async () => {
      let result:
        ActivationInspection | undefined;

      await jest.isolateModulesAsync(
        async () => {
          const {
            ConfigModule,
          } =
            jest.requireActual<
              typeof import(
                '@nestjs/config'
              )
            >(
              '@nestjs/config',
            );

          const {
            Test,
          } =
            jest.requireActual<
              typeof import(
                '@nestjs/testing'
              )
            >(
              '@nestjs/testing',
            );

          const {
            PrismaService,
          } =
            jest.requireActual<
              typeof import(
                '../../../common/prisma/prisma.service'
              )
            >(
              '../../../common/prisma/prisma.service',
            );

          const {
            MercadoLivreAccessTokenCoordinator,
          } =
            jest.requireActual<
              typeof import(
                './mercado-livre-access-token-coordinator'
              )
            >(
              './mercado-livre-access-token-coordinator',
            );

          const configRoot =
            ConfigModule.forRoot({
              isGlobal:
                true,

              ignoreEnvFile:
                true,
            });

          const activation =
            jest.requireActual<
              ActivationModuleContract
            >(
              './mercado-livre-activation.module',
            );

          const prisma =
            createPrismaMock();

          const fetchSpy =
            jest.fn();

          const originalFetch =
            globalThis.fetch;

          globalThis.fetch =
            fetchSpy as unknown as
              typeof globalThis.fetch;

          try {
            const builder =
              Test.createTestingModule({
                imports: [
                  configRoot,
                  activation
                    .MercadoLivreActivationModule,
                ],
              })
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
              let coordinatorPresent =
                false;

              try {
                moduleRef.get(
                  MercadoLivreAccessTokenCoordinator,
                  {
                    strict:
                      false,
                  },
                );

                coordinatorPresent =
                  true;
              } catch {
                coordinatorPresent =
                  false;
              }

              result = {
                coordinatorPresent,

                exportedFlag:
                  activation
                    .MARTO_MERCADO_LIVRE_ENABLED,

                fetchCalls:
                  fetchSpy.mock
                    .calls
                    .length,

                prismaFindCalls:
                  prisma
                    .salesChannelCredential
                    .findUnique
                    .mock
                    .calls
                    .length,

                prismaUpdateCalls:
                  prisma
                    .salesChannelCredential
                    .updateMany
                    .mock
                    .calls
                    .length,
              };
            } finally {
              await moduleRef.close();
            }
          } finally {
            globalThis.fetch =
              originalFetch;
          }
        },
      );

      if (!result) {
        throw new Error(
          'activation_inspection_missing',
        );
      }

      return result;
    },
  );
}

describe(
  'MercadoLivreActivationModule',
  () => {
    it(
      'defaults to disabled when MARTO_MERCADO_LIVRE_ENABLED is absent',
      async () => {
        const result =
          await inspectActivation(
            {},
          );

        expect(
          result.coordinatorPresent,
        ).toBe(false);
      },
    );

    it(
      'stays disabled when the activation flag is exactly false',
      async () => {
        const result =
          await inspectActivation({
            MARTO_MERCADO_LIVRE_ENABLED:
              'false',
          });

        expect(
          result.coordinatorPresent,
        ).toBe(false);
      },
    );

    it(
      'enables the credential runtime when the activation flag is exactly true',
      async () => {
        const result =
          await inspectActivation(
            validEnabledEnv(),
          );

        expect(
          result.coordinatorPresent,
        ).toBe(true);
      },
    );

    it(
      'exports the exact namespaced activation flag',
      async () => {
        const result =
          await inspectActivation(
            {},
          );

        expect(
          result.exportedFlag,
        ).toBe(
          'MARTO_MERCADO_LIVRE_ENABLED',
        );
      },
    );

    it(
      'does not require Mercado Livre or encryption secrets while disabled',
      async () => {
        await expect(
          inspectActivation({
            MARTO_MERCADO_LIVRE_ENABLED:
              'false',
          }),
        ).resolves.toEqual(
          expect.objectContaining({
            coordinatorPresent:
              false,
          }),
        );
      },
    );

    it(
      'does not accidentally enable when runtime secrets exist but the activation flag is absent',
      async () => {
        const env =
          validEnabledEnv();

        delete env
          .MARTO_MERCADO_LIVRE_ENABLED;

        const result =
          await inspectActivation(
            env,
          );

        expect(
          result.coordinatorPresent,
        ).toBe(false);
      },
    );

    it(
      'does not perform OAuth network activity while disabled',
      async () => {
        const result =
          await inspectActivation({
            MARTO_MERCADO_LIVRE_ENABLED:
              'false',
          });

        expect(
          result.fetchCalls,
        ).toBe(0);
      },
    );

    it(
      'does not touch credential persistence while disabled',
      async () => {
        const result =
          await inspectActivation({
            MARTO_MERCADO_LIVRE_ENABLED:
              'false',
          });

        expect(
          result.prismaFindCalls,
        ).toBe(0);

        expect(
          result.prismaUpdateCalls,
        ).toBe(0);
      },
    );

    it(
      'does not perform OAuth network activity merely by enabling and bootstrapping the runtime',
      async () => {
        const result =
          await inspectActivation(
            validEnabledEnv(),
          );

        expect(
          result.fetchCalls,
        ).toBe(0);
      },
    );

    it(
      'does not read or mutate credentials merely by enabling and bootstrapping the runtime',
      async () => {
        const result =
          await inspectActivation(
            validEnabledEnv(),
          );

        expect(
          result.prismaFindCalls,
        ).toBe(0);

        expect(
          result.prismaUpdateCalls,
        ).toBe(0);
      },
    );

    it(
      'enabled mode rejects missing Mercado Livre client id through the runtime boundary',
      async () => {
        const env =
          validEnabledEnv();

        delete env
          .MARTO_MERCADO_LIVRE_CLIENT_ID;

        await expect(
          inspectActivation(
            env,
          ),
        ).rejects.toThrow(
          'mercado_livre_runtime_config_invalid',
        );
      },
    );

    it(
      'enabled mode rejects missing Mercado Livre client secret through the runtime boundary',
      async () => {
        const env =
          validEnabledEnv();

        delete env
          .MARTO_MERCADO_LIVRE_CLIENT_SECRET;

        await expect(
          inspectActivation(
            env,
          ),
        ).rejects.toThrow(
          'mercado_livre_runtime_config_invalid',
        );
      },
    );

    it(
      'rejects an empty activation flag instead of silently disabling',
      async () => {
        await expect(
          inspectActivation({
            MARTO_MERCADO_LIVRE_ENABLED:
              '',
          }),
        ).rejects.toThrow(
          'mercado_livre_activation_config_invalid',
        );
      },
    );

    it(
      'rejects non-canonical activation values instead of guessing',
      async () => {
        for (
          const value
          of [
            'TRUE',
            'False',
            'yes',
            '1',
            ' true ',
          ]
        ) {
          await expect(
            inspectActivation({
              MARTO_MERCADO_LIVRE_ENABLED:
                value,
            }),
          ).rejects.toThrow(
            'mercado_livre_activation_config_invalid',
          );
        }
      },
    );

    it(
      'keeps the activation boundary limited to conditional module loading',
      () => {
        const source =
          readFileSync(
            join(
              __dirname,
              'mercado-livre-activation.module.ts',
            ),
            'utf8',
          );

        for (
          const required
          of [
            'ConditionalModule',
            'registerWhen',
            'MercadoLivreCredentialRuntimeModule',
            'MARTO_MERCADO_LIVRE_ENABLED',
            'mercado_livre_activation_config_invalid',
          ]
        ) {
          expect(
            source,
          ).toContain(
            required,
          );
        }

        for (
          const forbidden
          of [
            'AppModule',
            '@Controller',
            'Controller(',
            'ConfigService',
            'process.env',
            'PrismaService',
            'globalThis.fetch',
            'MARTO_MERCADO_LIVRE_CLIENT_ID',
            'MARTO_MERCADO_LIVRE_CLIENT_SECRET',
            'MARTO_CREDENTIAL_ENCRYPTION_KEYS',
          ]
        ) {
          expect(
            source.toLowerCase(),
          ).not.toContain(
            forbidden.toLowerCase(),
          );
        }
      },
    );
  },
);
describe('MercadoLivreActivationModule adversarial', () => {
  it(
    'keeps the integration disabled even when every runtime configuration value is malformed',
    async () => {
      const result =
        await inspectActivation({
          MARTO_MERCADO_LIVRE_ENABLED:
            'false',

          MARTO_MERCADO_LIVRE_CLIENT_ID:
            '',

          MARTO_MERCADO_LIVRE_CLIENT_SECRET:
            ' invalid-secret ',

          MARTO_MERCADO_LIVRE_REFRESH_SAFETY_WINDOW_MS:
            'not-a-number',

          MARTO_MERCADO_LIVRE_TRANSIENT_RETRY_DELAY_MS:
            '-1',

          MARTO_MERCADO_LIVRE_REFRESH_STALE_AFTER_MS:
            '0',

          MARTO_CREDENTIAL_ENCRYPTION_CURRENT_KEY_VERSION:
            '',

          MARTO_CREDENTIAL_ENCRYPTION_KEYS:
            'not-json',
        });

      expect(
        result.coordinatorPresent,
      ).toBe(false);

      expect(
        result.fetchCalls,
      ).toBe(0);

      expect(
        result.prismaFindCalls,
      ).toBe(0);

      expect(
        result.prismaUpdateCalls,
      ).toBe(0);
    },
  );

  it(
    'enabled mode rejects a missing refresh safety window',
    async () => {
      const env =
        validEnabledEnv();

      delete env
        .MARTO_MERCADO_LIVRE_REFRESH_SAFETY_WINDOW_MS;

      await expect(
        inspectActivation(
          env,
        ),
      ).rejects.toThrow(
        'mercado_livre_runtime_config_invalid',
      );
    },
  );

  it(
    'enabled mode rejects a missing transient retry delay',
    async () => {
      const env =
        validEnabledEnv();

      delete env
        .MARTO_MERCADO_LIVRE_TRANSIENT_RETRY_DELAY_MS;

      await expect(
        inspectActivation(
          env,
        ),
      ).rejects.toThrow(
        'mercado_livre_runtime_config_invalid',
      );
    },
  );

  it(
    'enabled mode rejects a missing refresh stale threshold',
    async () => {
      const env =
        validEnabledEnv();

      delete env
        .MARTO_MERCADO_LIVRE_REFRESH_STALE_AFTER_MS;

      await expect(
        inspectActivation(
          env,
        ),
      ).rejects.toThrow(
        'mercado_livre_runtime_config_invalid',
      );
    },
  );

  it(
    'enabled mode preserves strict runtime numeric validation',
    async () => {
      const env =
        validEnabledEnv();

      env
        .MARTO_MERCADO_LIVRE_REFRESH_SAFETY_WINDOW_MS =
        '1e3';

      await expect(
        inspectActivation(
          env,
        ),
      ).rejects.toThrow(
        'mercado_livre_runtime_config_invalid',
      );
    },
  );

  it(
    'enabled mode rejects a missing credential encryption key version',
    async () => {
      const env =
        validEnabledEnv();

      delete env
        .MARTO_CREDENTIAL_ENCRYPTION_CURRENT_KEY_VERSION;

      await expect(
        inspectActivation(
          env,
        ),
      ).rejects.toThrow(
        'credential_keyring_config_invalid',
      );
    },
  );

  it(
    'enabled mode rejects malformed credential encryption keys',
    async () => {
      const env =
        validEnabledEnv();

      env
        .MARTO_CREDENTIAL_ENCRYPTION_KEYS =
        'not-json';

      await expect(
        inspectActivation(
          env,
        ),
      ).rejects.toThrow(
        'credential_keyring_config_invalid',
      );
    },
  );

  it(
    'enabled mode rejects a current key version absent from the configured keyring',
    async () => {
      const env =
        validEnabledEnv();

      env
        .MARTO_CREDENTIAL_ENCRYPTION_CURRENT_KEY_VERSION =
        'missing-version';

      await expect(
        inspectActivation(
          env,
        ),
      ).rejects.toThrow(
        'credential_keyring_current_key_not_found',
      );
    },
  );

  it(
    'enabled mode accepts zero safety window and zero transient retry delay through the activation boundary',
    async () => {
      const env =
        validEnabledEnv();

      env
        .MARTO_MERCADO_LIVRE_REFRESH_SAFETY_WINDOW_MS =
        '0';

      env
        .MARTO_MERCADO_LIVRE_TRANSIENT_RETRY_DELAY_MS =
        '0';

      const result =
        await inspectActivation(
          env,
        );

      expect(
        result.coordinatorPresent,
      ).toBe(true);

      expect(
        result.fetchCalls,
      ).toBe(0);

      expect(
        result.prismaFindCalls,
      ).toBe(0);

      expect(
        result.prismaUpdateCalls,
      ).toBe(0);
    },
  );

  it(
    'keeps the activation source free of logging timers persistence and direct environment access',
    () => {
      const source =
        readFileSync(
          join(
            __dirname,
            'mercado-livre-activation.module.ts',
          ),
          'utf8',
        );

      for (
        const forbidden
        of [
          'console.',
          'Logger',
          'setTimeout',
          'setInterval',
          'PrismaService',
          'process.env',
          'globalThis.fetch',
          'MercadoLivreOAuthClient',
          'MercadoLivrePrismaCredentialStore',
          'SalesChannelCredentialCryptoService',
          'MercadoLivreAccessTokenCoordinator',
        ]
      ) {
        expect(
          source.toLowerCase(),
        ).not.toContain(
          forbidden.toLowerCase(),
        );
      }

      expect(
        (
          source.match(
            /ConditionalModule\.registerWhen/g,
          ) ?? []
        ).length,
      ).toBe(1);
    },
  );
});