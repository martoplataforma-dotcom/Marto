import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';

import {
  SalesChannelCredentialCryptoService,
  type SalesChannelCredentialKeyring,
} from './sales-channel-credential-crypto.service';

import {
  SalesChannelCredentialConfigKeyring,
} from './sales-channel-credential-config.keyring';

type CredentialTokensModule = {
  SALES_CHANNEL_CREDENTIAL_KEYRING: symbol;
};

type CredentialModuleExports = {
  SalesChannelCredentialModule: Function;
};

type FactoryProviderLike = {
  provide: unknown;
  inject?: unknown[];
  useFactory?: (...args: unknown[]) => unknown;
};

const CURRENT_KEY_CONFIG =
  'MARTO_CREDENTIAL_ENCRYPTION_CURRENT_KEY_VERSION';

const KEYS_CONFIG =
  'MARTO_CREDENTIAL_ENCRYPTION_KEYS';

const KEY_V1 =
  Buffer.alloc(32, 0x11);

const KEY_V2 =
  Buffer.alloc(32, 0x22);

const KEY_V1_BASE64 =
  KEY_V1.toString('base64');

const KEY_V2_BASE64 =
  KEY_V2.toString('base64');

function loadTokens(): CredentialTokensModule {
  return jest.requireActual<CredentialTokensModule>(
    './sales-channel-credential.tokens',
  );
}

function loadCredentialModule(): CredentialModuleExports {
  return jest.requireActual<CredentialModuleExports>(
    './sales-channel-credential.module',
  );
}

function moduleMetadata<T>(
  moduleClass: Function,
  key: string,
  fallback: T,
): T {
  return (
    Reflect.getMetadata(
      key,
      moduleClass,
    ) ?? fallback
  ) as T;
}

function requireFactoryProvider(
  providers: FactoryProviderLike[],
  token: unknown,
): FactoryProviderLike & {
  useFactory: (...args: unknown[]) => unknown;
} {
  const provider =
    providers.find(
      (candidate) =>
        candidate &&
        typeof candidate === 'object' &&
        candidate.provide === token,
    );

  if (
    !provider ||
    typeof provider.useFactory !== 'function'
  ) {
    throw new Error(
      'credential_factory_provider_not_found',
    );
  }

  return provider as FactoryProviderLike & {
    useFactory: (...args: unknown[]) => unknown;
  };
}

function loadWiring() {
  const {
    SalesChannelCredentialModule,
  } = loadCredentialModule();

  const {
    SALES_CHANNEL_CREDENTIAL_KEYRING,
  } = loadTokens();

  const providers =
    moduleMetadata<FactoryProviderLike[]>(
      SalesChannelCredentialModule,
      'providers',
      [],
    );

  const exports =
    moduleMetadata<unknown[]>(
      SalesChannelCredentialModule,
      'exports',
      [],
    );

  const imports =
    moduleMetadata<unknown[]>(
      SalesChannelCredentialModule,
      'imports',
      [],
    );

  const controllers =
    moduleMetadata<unknown[]>(
      SalesChannelCredentialModule,
      'controllers',
      [],
    );

  return {
    SalesChannelCredentialModule,
    SALES_CHANNEL_CREDENTIAL_KEYRING,
    providers,
    exports,
    imports,
    controllers,
  };
}

function createConfigService(
  values: Record<string, string | undefined>,
) {
  const get =
    jest.fn(
      (
        key: string,
      ): string | undefined =>
        values[key],
    );

  return {
    service: {
      get,
    } as unknown as ConfigService,
    get,
  };
}

function validConfigValues(
  currentKeyVersion = 'key-v1',
): Record<string, string> {
  return {
    [CURRENT_KEY_CONFIG]:
      currentKeyVersion,

    [KEYS_CONFIG]:
      JSON.stringify({
        'key-v1': KEY_V1_BASE64,
        'key-v2': KEY_V2_BASE64,
      }),
  };
}

function createKeyringThroughProvider(
  values:
    Record<string, string | undefined> =
      validConfigValues(),
) {
  const wiring =
    loadWiring();

  const provider =
    requireFactoryProvider(
      wiring.providers,
      wiring.SALES_CHANNEL_CREDENTIAL_KEYRING,
    );

  const config =
    createConfigService(values);

  const keyring =
    provider.useFactory(
      config.service,
    ) as SalesChannelCredentialKeyring;

  return {
    ...wiring,
    provider,
    keyring,
    configGet: config.get,
  };
}

describe('SalesChannelCredentialModule', () => {
  it('defines a dedicated runtime token for the credential keyring', () => {
    const {
      SALES_CHANNEL_CREDENTIAL_KEYRING,
    } = loadTokens();

    expect(
      SALES_CHANNEL_CREDENTIAL_KEYRING,
    ).toBeDefined();
  });

  it('uses a Symbol as the runtime keyring token', () => {
    const {
      SALES_CHANNEL_CREDENTIAL_KEYRING,
    } = loadTokens();

    expect(
      typeof SALES_CHANNEL_CREDENTIAL_KEYRING,
    ).toBe('symbol');
  });

  it('reads the exact current key version configuration through ConfigService', () => {
    const result =
      createKeyringThroughProvider();

    expect(
      result.imports,
    ).toContain(ConfigModule);

    expect(
      result.provider.inject,
    ).toEqual([
      ConfigService,
    ]);

    const requestedNames =
      result.configGet.mock.calls.map(
        ([name]) => name,
      );

    expect(
      requestedNames,
    ).toContain(
      CURRENT_KEY_CONFIG,
    );
  });

  it('reads the exact serialized keys configuration and no other configuration names', () => {
    const result =
      createKeyringThroughProvider();

    const requestedNames =
      result.configGet.mock.calls.map(
        ([name]) => name,
      );

    expect(
      requestedNames,
    ).toHaveLength(2);

    expect(
      [...requestedNames].sort(),
    ).toEqual(
      [
        CURRENT_KEY_CONFIG,
        KEYS_CONFIG,
      ].sort(),
    );
  });

  it('produces a functional ConfigKeyring from valid configuration', () => {
    const {
      keyring,
    } = createKeyringThroughProvider();

    expect(
      keyring,
    ).toBeInstanceOf(
      SalesChannelCredentialConfigKeyring,
    );

    expect(
      keyring.current(),
    ).toEqual({
      version: 'key-v1',
      key: KEY_V1,
    });
  });

  it('keeps historical key versions resolvable through the provider', () => {
    const {
      keyring,
    } = createKeyringThroughProvider(
      validConfigValues('key-v2'),
    );

    expect(
      keyring.current(),
    ).toEqual({
      version: 'key-v2',
      key: KEY_V2,
    });

    expect(
      keyring.resolve('key-v1'),
    ).toEqual(KEY_V1);
  });

  it('propagates credential_keyring_config_invalid when required configuration is absent', () => {
    expect(() =>
      createKeyringThroughProvider({
        [CURRENT_KEY_CONFIG]:
          'key-v1',
      }),
    ).toThrow(
      'credential_keyring_config_invalid',
    );
  });

  it('propagates credential_keyring_current_key_not_found for an unknown current version', () => {
    expect(() =>
      createKeyringThroughProvider({
        [CURRENT_KEY_CONFIG]:
          'key-v3',

        [KEYS_CONFIG]:
          JSON.stringify({
            'key-v1':
              KEY_V1_BASE64,
            'key-v2':
              KEY_V2_BASE64,
          }),
      }),
    ).toThrow(
      'credential_keyring_current_key_not_found',
    );
  });

  it('injects the crypto provider from the dedicated keyring token', () => {
    const wiring =
      loadWiring();

    const cryptoProvider =
      requireFactoryProvider(
        wiring.providers,
        SalesChannelCredentialCryptoService,
      );

    expect(
      cryptoProvider.inject,
    ).toEqual([
      wiring.SALES_CHANNEL_CREDENTIAL_KEYRING,
    ]);
  });

  it('produces a crypto service that performs a round-trip with synthetic credentials', () => {
    const {
      keyring,
      providers,
    } = createKeyringThroughProvider();

    const cryptoProvider =
      requireFactoryProvider(
        providers,
        SalesChannelCredentialCryptoService,
      );

    const crypto =
      cryptoProvider.useFactory(
        keyring,
      ) as SalesChannelCredentialCryptoService;

    expect(
      crypto,
    ).toBeInstanceOf(
      SalesChannelCredentialCryptoService,
    );

    const plaintext =
      'synthetic-credential-fixture';

    const encrypted =
      crypto.encrypt(plaintext);

    expect(
      encrypted.encryptedValue,
    ).not.toContain(plaintext);

    expect(
      crypto.decrypt({
        encryptedValue:
          encrypted.encryptedValue,
        keyVersion:
          encrypted.keyVersion,
      }),
    ).toBe(plaintext);
  });

  it('exports the dedicated keyring token', () => {
    const wiring =
      loadWiring();

    expect(
      wiring.exports,
    ).toContain(
      wiring.SALES_CHANNEL_CREDENTIAL_KEYRING,
    );
  });

  it('exports SalesChannelCredentialCryptoService', () => {
    const wiring =
      loadWiring();

    expect(
      wiring.exports,
    ).toContain(
      SalesChannelCredentialCryptoService,
    );
  });

  it('declares no controllers', () => {
    const wiring =
      loadWiring();

    expect(
      wiring.controllers,
    ).toEqual([]);
  });

  it('is not a global NestJS module', () => {
    const {
      SalesChannelCredentialModule,
    } = loadWiring();

    const isGlobal =
      Reflect.getMetadata(
        '__module:global__',
        SalesChannelCredentialModule,
      );

    expect(
      Boolean(isGlobal),
    ).toBe(false);
  });

  it('does not read process.env inside the NestJS wiring module', () => {
    loadCredentialModule();

    const source =
      readFileSync(
        join(
          __dirname,
          'sales-channel-credential.module.ts',
        ),
        'utf8',
      );

    expect(
      source,
    ).not.toContain(
      'process.env',
    );
  });

  it('does not duplicate JSON or Base64 parsing inside NestJS factories', () => {
    loadCredentialModule();

    const source =
      readFileSync(
        join(
          __dirname,
          'sales-channel-credential.module.ts',
        ),
        'utf8',
      );

    expect(
      source,
    ).not.toContain(
      'JSON.parse',
    );

    expect(
      source,
    ).not.toContain(
      'Buffer.from(',
    );

    expect(
      source.toLowerCase(),
    ).not.toContain(
      'base64',
    );
  });

  it('does not expose configured secret material in provider errors', () => {
    const secretMaterial =
      'synthetic-sensitive-material-that-must-not-leak';

    let thrown: unknown;

    try {
      createKeyringThroughProvider({
        [CURRENT_KEY_CONFIG]:
          'key-v1',

        [KEYS_CONFIG]:
          JSON.stringify({
            'key-v1':
              secretMaterial,
          }),
      });
    } catch (error) {
      thrown = error;
    }

    expect(
      thrown,
    ).toBeInstanceOf(Error);

    const message =
      thrown instanceof Error
        ? thrown.message
        : String(thrown);

    expect(
      message,
    ).toBe(
      'credential_keyring_config_invalid',
    );

    expect(
      message,
    ).not.toContain(
      secretMaterial,
    );
  });

  it('keeps AppModule disconnected from SalesChannelCredentialModule', () => {
    loadCredentialModule();

    const appModuleSource =
      readFileSync(
        join(
          __dirname,
          '../../../app.module.ts',
        ),
        'utf8',
      );

    expect(
      appModuleSource,
    ).not.toContain(
      'SalesChannelCredentialModule',
    );
  });

  it('declares exactly the two planned factory providers', () => {
    const wiring =
      loadWiring();

    expect(
      wiring.providers,
    ).toHaveLength(2);

    expect(
      wiring.providers.map(
        (provider) =>
          provider.provide,
      ),
    ).toEqual(
      expect.arrayContaining([
        wiring.SALES_CHANNEL_CREDENTIAL_KEYRING,
        SalesChannelCredentialCryptoService,
      ]),
    );
  });

  it('reads each configuration value exactly once without a default argument', () => {
    const result =
      createKeyringThroughProvider();

    expect(
      result.configGet,
    ).toHaveBeenCalledTimes(2);

    expect(
      result.configGet,
    ).toHaveBeenCalledWith(
      CURRENT_KEY_CONFIG,
    );

    expect(
      result.configGet,
    ).toHaveBeenCalledWith(
      KEYS_CONFIG,
    );

    for (
      const call of
        result.configGet.mock.calls
    ) {
      expect(
        call,
      ).toHaveLength(1);
    }
  });

  it('propagates credential_keyring_config_invalid for malformed JSON', () => {
    expect(() =>
      createKeyringThroughProvider({
        [CURRENT_KEY_CONFIG]:
          'key-v1',

        [KEYS_CONFIG]:
          '{"key-v1":',
      }),
    ).toThrow(
      'credential_keyring_config_invalid',
    );
  });

  it('propagates credential_keyring_config_invalid for a blank current version', () => {
    expect(() =>
      createKeyringThroughProvider({
        [CURRENT_KEY_CONFIG]:
          '   ',

        [KEYS_CONFIG]:
          JSON.stringify({
            'key-v1':
              KEY_V1_BASE64,
          }),
      }),
    ).toThrow(
      'credential_keyring_config_invalid',
    );
  });

  it('resolves the keyring and crypto service through a real Nest TestingModule', async () => {
    const testingPackage =
      jest.requireActual<
        typeof import('@nestjs/testing')
      >('@nestjs/testing');

    const wiring =
      loadWiring();

    const config =
      createConfigService(
        validConfigValues(),
      );

    const testingModule =
      await testingPackage.Test
        .createTestingModule({
          imports: [
            wiring.SalesChannelCredentialModule,
          ],
        })
        .overrideProvider(
          ConfigService,
        )
        .useValue(
          config.service,
        )
        .compile();

    try {
      const keyring =
        testingModule.get<SalesChannelCredentialKeyring>(
          wiring.SALES_CHANNEL_CREDENTIAL_KEYRING,
        );

      const crypto =
        testingModule.get(
          SalesChannelCredentialCryptoService,
        );

      expect(
        keyring,
      ).toBeInstanceOf(
        SalesChannelCredentialConfigKeyring,
      );

      expect(
        crypto,
      ).toBeInstanceOf(
        SalesChannelCredentialCryptoService,
      );

      expect(
        keyring.current(),
      ).toEqual({
        version: 'key-v1',
        key: KEY_V1,
      });

      const plaintext =
        'nest-testing-module-fixture';

      const encrypted =
        crypto.encrypt(plaintext);

      expect(
        crypto.decrypt({
          encryptedValue:
            encrypted.encryptedValue,
          keyVersion:
            encrypted.keyVersion,
        }),
      ).toBe(plaintext);
    } finally {
      await testingModule.close();
    }
  });

  it('keeps the runtime token file free of configuration and secret handling', () => {
    loadTokens();

    const source =
      readFileSync(
        join(
          __dirname,
          'sales-channel-credential.tokens.ts',
        ),
        'utf8',
      );

    expect(
      source,
    ).not.toContain(
      'MARTO_CREDENTIAL_ENCRYPTION_CURRENT_KEY_VERSION',
    );

    expect(
      source,
    ).not.toContain(
      'MARTO_CREDENTIAL_ENCRYPTION_KEYS',
    );

    expect(
      source,
    ).not.toContain(
      'process.env',
    );

    expect(
      source,
    ).not.toContain(
      'ConfigService',
    );

    expect(
      source,
    ).not.toContain(
      'Buffer',
    );
  });
});
