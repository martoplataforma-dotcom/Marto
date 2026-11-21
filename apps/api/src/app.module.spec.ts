import {
  readFileSync,
} from 'node:fs';

import {
  join,
} from 'node:path';

type EnvValues =
  Record<
    string,
    string | undefined
  >;

type Inspection = {
  coordinatorPresent: boolean;
  fetchCalls: number;
  prismaFindCalls: number;
  prismaUpdateCalls: number;
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

const APP_MODULE_MOCKS = [
  ['./modules/identity/identity.module', 'IdentityModule'],
  ['./modules/catalog/catalog.module', 'CatalogModule'],
  ['./modules/orders/orders.module', 'OrdersModule'],
  ['./modules/payments/payments.module', 'PaymentsModule'],
  ['./modules/services/services.module', 'ServicesModule'],
  ['./modules/reviews/reviews.module', 'ReviewsModule'],
  ['./modules/factories/factories.module', 'FactoriesModule'],
  ['./modules/logistics/logistics.module', 'LogisticsModule'],
  ['./modules/social/social.module', 'SocialModule'],
  ['./modules/fund/fund.module', 'FundModule'],
  [
    './modules/factories/purchase-intents/purchase-intents.module',
    'PurchaseIntentsModule',
  ],
  [
    './modules/insights-advanced/insights-advanced.module',
    'InsightsAdvancedModule',
  ],
  ['./modules/wallet/wallet.module', 'WalletModule'],
  ['./modules/merchants/merchants.module', 'MerchantsModule'],
  [
    './modules/service-providers/service-providers.module',
    'ServiceProvidersModule',
  ],
  ['./modules/consumers/consumers.module', 'ConsumersModule'],
  [
    './modules/representatives/representatives.module',
    'RepresentativesModule',
  ],
  ['./modules/public/public.module', 'PublicModule'],
  ['./modules/short-links/short-links.module', 'ShortLinksModule'],
  ['./modules/transport/transport.module', 'TransportModule'],
] as const;

function validEnabledEnv(): EnvValues {
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
              17,
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
  values: EnvValues,
  callback: () => Promise<T>,
): Promise<T> {
  const before =
    new Map<
      string,
      string | undefined
    >();

  for (const key of ENV_KEYS) {
    before.set(
      key,
      process.env[key],
    );

    delete process.env[key];
  }

  for (
    const [key, value]
    of Object.entries(values)
  ) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] =
        value;
    }
  }

  try {
    return await callback();
  } finally {
    for (const key of ENV_KEYS) {
      const previous =
        before.get(key);

      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] =
          previous;
      }
    }
  }
}

async function inspectAppModule(
  values: EnvValues,
): Promise<Inspection> {
  return await withEnvironment(
    values,
    async () => {
      let result:
        Inspection | undefined;

      await jest.isolateModulesAsync(
        async () => {
          const common =
            jest.requireActual<
              typeof import('@nestjs/common')
            >(
              '@nestjs/common',
            );

          class EmptyModule {}

          common.Module({})(
            EmptyModule,
          );

          class EmptyController {}

          common.Controller()(
            EmptyController,
          );

          for (
            const [
              modulePath,
              exportName,
            ]
            of APP_MODULE_MOCKS
          ) {
            jest.doMock(
              modulePath,
              () => ({
                [exportName]:
                  EmptyModule,
              }),
            );
          }

          jest.doMock(
            './common/uploads/uploads.controller',
            () => ({
              UploadsController:
                EmptyController,
            }),
          );

          const {
            ConfigModule,
          } =
            jest.requireActual<
              typeof import('@nestjs/config')
            >(
              '@nestjs/config',
            );

          const originalForRoot =
            ConfigModule.forRoot.bind(
              ConfigModule,
            );

          const configSpy =
            jest
              .spyOn(
                ConfigModule,
                'forRoot',
              )
              .mockImplementation(
                (options) =>
                  originalForRoot({
                    ...(options ?? {}),
                    ignoreEnvFile:
                      true,
                  }),
              );

          const {
            Test,
          } =
            jest.requireActual<
              typeof import('@nestjs/testing')
            >(
              '@nestjs/testing',
            );

          const {
            PrismaService,
          } =
            jest.requireActual<
              typeof import(
                './common/prisma/prisma.service'
              )
            >(
              './common/prisma/prisma.service',
            );

          const {
            MercadoLivreAccessTokenCoordinator,
          } =
            jest.requireActual<
              typeof import(
                './modules/integrations/mercado-livre/mercado-livre-access-token-coordinator'
              )
            >(
              './modules/integrations/mercado-livre/mercado-livre-access-token-coordinator',
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
            const {
              AppModule,
            } =
              jest.requireActual<
                typeof import('./app.module')
              >(
                './app.module',
              );

            const moduleRef =
              await Test
                .createTestingModule({
                  imports: [
                    AppModule,
                  ],
                })
                .overrideProvider(
                  PrismaService,
                )
                .useValue(
                  prisma,
                )
                .compile();

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

                fetchCalls:
                  fetchSpy.mock.calls.length,

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

            configSpy.mockRestore();
          }
        },
      );

      if (!result) {
        throw new Error(
          'app_module_inspection_missing',
        );
      }

      return result;
    },
  );
}

describe(
  'AppModule Mercado Livre wiring',
  () => {
    it(
      'declares MercadoLivreActivationModule as an AppModule dependency',
      () => {
        const source =
          readFileSync(
            join(
              __dirname,
              'app.module.ts',
            ),
            'utf8',
          );

        expect(
          source,
        ).toContain(
          './modules/integrations/mercado-livre/mercado-livre-activation.module',
        );

        expect(
          source,
        ).toContain(
          'MercadoLivreActivationModule',
        );
      },
    );

    it(
      'keeps principal startup working when activation flag is absent',
      async () => {
        const result =
          await inspectAppModule({});

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
      'keeps principal startup working when activation flag is false',
      async () => {
        const result =
          await inspectAppModule({
            MARTO_MERCADO_LIVRE_ENABLED:
              'false',
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
      'connects Mercado Livre runtime when activation flag is true',
      async () => {
        const result =
          await inspectAppModule(
            validEnabledEnv(),
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
      'fails closed when enabled with incomplete runtime configuration',
      async () => {
        const env =
          validEnabledEnv();

        delete env
          .MARTO_MERCADO_LIVRE_CLIENT_ID;

        await expect(
          inspectAppModule(env),
        ).rejects.toThrow(
          'mercado_livre_runtime_config_invalid',
        );
      },
    );

    it(
      'preserves activation validation at principal startup',
      async () => {
        await expect(
          inspectAppModule({
            MARTO_MERCADO_LIVRE_ENABLED:
              'TRUE',
          }),
        ).rejects.toThrow(
          'mercado_livre_activation_config_invalid',
        );
      },
    );
  },
);
describe(
  'AppModule Mercado Livre wiring adversarial',
  () => {
    it(
      'keeps the principal graph disabled when the flag is absent even if every runtime value is malformed',
      async () => {
        const result =
          await inspectAppModule({
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
      'keeps the principal graph disabled when the flag is false even if every runtime value is malformed',
      async () => {
        const result =
          await inspectAppModule({
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
      'does not activate the principal graph merely because runtime secrets exist',
      async () => {
        const env =
          validEnabledEnv();

        delete env
          .MARTO_MERCADO_LIVRE_ENABLED;

        const result =
          await inspectAppModule(
            env,
          );

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
      'preserves runtime failure for a missing refresh safety window through principal startup',
      async () => {
        const env =
          validEnabledEnv();

        delete env
          .MARTO_MERCADO_LIVRE_REFRESH_SAFETY_WINDOW_MS;

        await expect(
          inspectAppModule(
            env,
          ),
        ).rejects.toThrow(
          'mercado_livre_runtime_config_invalid',
        );
      },
    );

    it(
      'preserves credential keyring failure through principal startup',
      async () => {
        const env =
          validEnabledEnv();

        env
          .MARTO_CREDENTIAL_ENCRYPTION_KEYS =
          'not-json';

        await expect(
          inspectAppModule(
            env,
          ),
        ).rejects.toThrow(
          'credential_keyring_config_invalid',
        );
      },
    );
  },
);