type SalesChannelCredentialEncryptionKey = {
  version: string;
  key: Buffer;
};

type SalesChannelCredentialKeyring = {
  current(): SalesChannelCredentialEncryptionKey;
  resolve(version: string): Buffer | undefined;
};

type SalesChannelCredentialConfigKeyringInput = {
  currentKeyVersion?: string;
  serializedKeys?: string;
};

type ConfigKeyringModule = {
  SalesChannelCredentialConfigKeyring: new (
    input?: SalesChannelCredentialConfigKeyringInput,
  ) => SalesChannelCredentialKeyring;
};

const KEY_V1 = Buffer.alloc(32, 0x11);
const KEY_V2 = Buffer.alloc(32, 0x22);

const KEY_V1_BASE64 = KEY_V1.toString('base64');
const KEY_V2_BASE64 = KEY_V2.toString('base64');

function serializeKeys(
  keys: Record<string, string>,
): string {
  return JSON.stringify(keys);
}

function validInput(
  overrides: Partial<SalesChannelCredentialConfigKeyringInput> = {},
): SalesChannelCredentialConfigKeyringInput {
  return {
    currentKeyVersion: 'key-v1',
    serializedKeys: serializeKeys({
      'key-v1': KEY_V1_BASE64,
      'key-v2': KEY_V2_BASE64,
    }),
    ...overrides,
  };
}

function createKeyring(
  input?: SalesChannelCredentialConfigKeyringInput,
): SalesChannelCredentialKeyring {
  const module = jest.requireActual<ConfigKeyringModule>(
    './sales-channel-credential-config.keyring',
  );

  return new module.SalesChannelCredentialConfigKeyring(input);
}

describe('SalesChannelCredentialConfigKeyring', () => {
  it('returns the configured current key and version', () => {
    const keyring = createKeyring(validInput());

    const current = keyring.current();

    expect(current.version).toBe('key-v1');
    expect(current.key).toEqual(KEY_V1);
  });

  it('resolves a historical key by version', () => {
    const keyring = createKeyring(validInput());

    expect(keyring.resolve('key-v2')).toEqual(KEY_V2);
  });

  it('returns undefined for an unknown historical key version', () => {
    const keyring = createKeyring(validInput());

    expect(keyring.resolve('missing-key')).toBeUndefined();
  });

  it('changes only the current selection when a new snapshot declares a new current version', () => {
    const beforeRotation = createKeyring(
      validInput({
        currentKeyVersion: 'key-v1',
      }),
    );

    const afterRotation = createKeyring(
      validInput({
        currentKeyVersion: 'key-v2',
      }),
    );

    expect(beforeRotation.current()).toEqual({
      version: 'key-v1',
      key: KEY_V1,
    });

    expect(afterRotation.current()).toEqual({
      version: 'key-v2',
      key: KEY_V2,
    });

    expect(afterRotation.resolve('key-v1')).toEqual(KEY_V1);
    expect(afterRotation.resolve('key-v2')).toEqual(KEY_V2);
  });

  it('keeps an old key resolvable after the current version rotates', () => {
    const keyring = createKeyring(
      validInput({
        currentKeyVersion: 'key-v2',
      }),
    );

    expect(keyring.current().version).toBe('key-v2');
    expect(keyring.resolve('key-v1')).toEqual(KEY_V1);
  });

  it('rejects absent serialized key configuration', () => {
    expect(() =>
      createKeyring({
        currentKeyVersion: 'key-v1',
      }),
    ).toThrow('credential_keyring_config_invalid');
  });

  it('rejects invalid JSON key configuration', () => {
    expect(() =>
      createKeyring(
        validInput({
          serializedKeys: '{"key-v1":',
        }),
      ),
    ).toThrow('credential_keyring_config_invalid');
  });

  it('rejects a JSON array instead of a key-version object', () => {
    expect(() =>
      createKeyring(
        validInput({
          serializedKeys: JSON.stringify([
            KEY_V1_BASE64,
          ]),
        }),
      ),
    ).toThrow('credential_keyring_config_invalid');
  });

  it('rejects an empty key-version object', () => {
    expect(() =>
      createKeyring(
        validInput({
          serializedKeys: '{}',
        }),
      ),
    ).toThrow('credential_keyring_config_invalid');
  });

  it('rejects an absent or blank current key version', () => {
    expect(() =>
      createKeyring(
        validInput({
          currentKeyVersion: undefined,
        }),
      ),
    ).toThrow('credential_keyring_config_invalid');

    expect(() =>
      createKeyring(
        validInput({
          currentKeyVersion: '   ',
        }),
      ),
    ).toThrow('credential_keyring_config_invalid');
  });

  it('rejects a current key version that is not present in the keyring', () => {
    expect(() =>
      createKeyring(
        validInput({
          currentKeyVersion: 'key-v3',
        }),
      ),
    ).toThrow('credential_keyring_current_key_not_found');
  });

  it('rejects non-canonical Base64 key material', () => {
    const withoutRequiredPadding =
      KEY_V1_BASE64.replace(/=+$/, '');

    expect(withoutRequiredPadding).not.toBe(KEY_V1_BASE64);

    expect(() =>
      createKeyring(
        validInput({
          serializedKeys: serializeKeys({
            'key-v1': withoutRequiredPadding,
          }),
        }),
      ),
    ).toThrow('credential_keyring_config_invalid');
  });

  it('rejects key material that does not decode to exactly 32 bytes', () => {
    const shortKey =
      Buffer.alloc(31, 0x11).toString('base64');

    const longKey =
      Buffer.alloc(33, 0x11).toString('base64');

    expect(() =>
      createKeyring(
        validInput({
          serializedKeys: serializeKeys({
            'key-v1': shortKey,
          }),
        }),
      ),
    ).toThrow('credential_keyring_config_invalid');

    expect(() =>
      createKeyring(
        validInput({
          serializedKeys: serializeKeys({
            'key-v1': longKey,
          }),
        }),
      ),
    ).toThrow('credential_keyring_config_invalid');
  });

  it('does not expose configured secret material in validation errors', () => {
    const secretMaterial =
      'this-must-never-appear-in-an-error';

    let thrown: unknown;

    try {
      createKeyring(
        validInput({
          serializedKeys: serializeKeys({
            'key-v1': secretMaterial,
          }),
        }),
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);

    const message =
      thrown instanceof Error
        ? thrown.message
        : String(thrown);

    expect(message).toBe(
      'credential_keyring_config_invalid',
    );

    expect(message).not.toContain(secretMaterial);
  });

  it('returns a defensive Buffer copy from current()', () => {
    const keyring = createKeyring(validInput());

    const first = keyring.current();

    first.key.fill(0xff);

    const second = keyring.current();

    expect(second.key).toEqual(KEY_V1);
    expect(second.key).not.toBe(first.key);
  });

  it('returns a defensive Buffer copy from resolve()', () => {
    const keyring = createKeyring(validInput());

    const first = keyring.resolve('key-v2');

    expect(first).toBeDefined();

    first?.fill(0xff);

    const second = keyring.resolve('key-v2');

    expect(second).toEqual(KEY_V2);
    expect(second).not.toBe(first);
  });

  it('rejects a null or primitive JSON root', () => {
    for (const serializedKeys of [
      'null',
      '"key-v1"',
      '123',
      'true',
    ]) {
      expect(() =>
        createKeyring(
          validInput({
            serializedKeys,
          }),
        ),
      ).toThrow('credential_keyring_config_invalid');
    }
  });

  it('rejects non-string key material', () => {
    expect(() =>
      createKeyring(
        validInput({
          serializedKeys: JSON.stringify({
            'key-v1': 123,
          }),
        }),
      ),
    ).toThrow('credential_keyring_config_invalid');
  });

  it('rejects registered key versions with surrounding whitespace', () => {
    expect(() =>
      createKeyring(
        validInput({
          serializedKeys: serializeKeys({
            'key-v1': KEY_V1_BASE64,
            ' key-v2 ': KEY_V2_BASE64,
          }),
        }),
      ),
    ).toThrow('credential_keyring_config_invalid');
  });

  it('rejects Base64 key material containing whitespace', () => {
    expect(() =>
      createKeyring(
        validInput({
          serializedKeys: serializeKeys({
            'key-v1': `${KEY_V1_BASE64} `,
          }),
        }),
      ),
    ).toThrow('credential_keyring_config_invalid');
  });

  it('rejects Base64URL when canonical standard Base64 is required', () => {
    const standardBase64 =
      Buffer.alloc(32, 0xff).toString('base64');

    const base64Url =
      standardBase64
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    expect(base64Url).not.toBe(standardBase64);

    expect(() =>
      createKeyring(
        validInput({
          serializedKeys: serializeKeys({
            'key-v1': base64Url,
          }),
        }),
      ),
    ).toThrow('credential_keyring_config_invalid');
  });
});
