type EncryptionKeyMaterial = {
  version: string;
  key: Buffer;
};

type SalesChannelCredentialKeyring = {
  current(): EncryptionKeyMaterial;
  resolve(version: string): Buffer | undefined;
};

type EncryptResult = {
  encryptedValue: string;
  keyVersion: string;
};

type DecryptInput = {
  encryptedValue: string;
  keyVersion: string;
};

type SalesChannelCredentialCryptoContract = {
  encrypt(plaintext: string): EncryptResult;
  decrypt(input: DecryptInput): string;
};

type CryptoModule = {
  SalesChannelCredentialCryptoService: new (
    keyring: SalesChannelCredentialKeyring,
  ) => SalesChannelCredentialCryptoContract;
};

const KEY_V1 = Buffer.alloc(32, 0x11);
const KEY_V2 = Buffer.alloc(32, 0x22);

function createKeyring(
  currentVersion = 'key-v1',
  keys: Record<string, Buffer> = {
    'key-v1': KEY_V1,
  },
): SalesChannelCredentialKeyring {
  return {
    current() {
      const key = keys[currentVersion];

      if (!key) {
        throw new Error('test_key_missing');
      }

      return {
        version: currentVersion,
        key,
      };
    },

    resolve(version: string) {
      return keys[version];
    },
  };
}

function createService(
  keyring: SalesChannelCredentialKeyring = createKeyring(),
): SalesChannelCredentialCryptoContract {
  const module = jest.requireActual<CryptoModule>(
    './sales-channel-credential-crypto.service',
  );

  return new module.SalesChannelCredentialCryptoService(keyring);
}

function tamperSegment(value: string): string {
  if (!value) {
    throw new Error('test_segment_empty');
  }

  const replacement = value[0] === 'A' ? 'B' : 'A';

  return replacement + value.slice(1);
}

describe('SalesChannelCredentialCryptoService', () => {
  it('encrypts and decrypts an opaque credential value', () => {
    const service = createService();

    const encrypted = service.encrypt('opaque-access-token');

    expect(
      service.decrypt({
        encryptedValue: encrypted.encryptedValue,
        keyVersion: encrypted.keyVersion,
      }),
    ).toBe('opaque-access-token');
  });

  it('returns the external key version used for encryption', () => {
    const service = createService(
      createKeyring('key-2026-10', {
        'key-2026-10': KEY_V1,
      }),
    );

    const encrypted = service.encrypt('opaque-refresh-token');

    expect(encrypted.keyVersion).toBe('key-2026-10');
  });

  it('uses a versioned authenticated envelope without plaintext', () => {
    const service = createService();

    const plaintext = 'super-secret-token-value';
    const encrypted = service.encrypt(plaintext);

    const parts = encrypted.encryptedValue.split('.');

    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v1');
    expect(encrypted.encryptedValue).not.toContain(plaintext);
    expect(encrypted.encryptedValue).not.toContain(KEY_V1.toString('hex'));
    expect(encrypted.encryptedValue).not.toContain(KEY_V1.toString('base64'));
  });

  it('uses a fresh nonce so the same plaintext does not produce the same envelope', () => {
    const service = createService();

    const first = service.encrypt('same-token');
    const second = service.encrypt('same-token');

    expect(first.keyVersion).toBe(second.keyVersion);
    expect(first.encryptedValue).not.toBe(second.encryptedValue);
  });

  it('can decrypt an older generation after the current encryption key changes', () => {
    const oldService = createService(
      createKeyring('key-v1', {
        'key-v1': KEY_V1,
      }),
    );

    const encrypted = oldService.encrypt('credential-created-with-v1');

    const rotatedService = createService(
      createKeyring('key-v2', {
        'key-v1': KEY_V1,
        'key-v2': KEY_V2,
      }),
    );

    expect(
      rotatedService.decrypt({
        encryptedValue: encrypted.encryptedValue,
        keyVersion: encrypted.keyVersion,
      }),
    ).toBe('credential-created-with-v1');
  });

  it('fails with a sanitized error when the requested key version does not exist', () => {
    const service = createService();

    const encrypted = service.encrypt('opaque-token');

    expect(() =>
      service.decrypt({
        encryptedValue: encrypted.encryptedValue,
        keyVersion: 'missing-key-version',
      }),
    ).toThrow('credential_encryption_key_not_found');
  });

  it('rejects a tampered authentication envelope', () => {
    const service = createService();

    const encrypted = service.encrypt('opaque-token');

    const parts = encrypted.encryptedValue.split('.');

    parts[2] = tamperSegment(parts[2]);

    expect(() =>
      service.decrypt({
        encryptedValue: parts.join('.'),
        keyVersion: encrypted.keyVersion,
      }),
    ).toThrow('credential_decryption_failed');
  });

  it('rejects ciphertext when the same key version resolves to different key material', () => {
    const writer = createService(
      createKeyring('key-v1', {
        'key-v1': KEY_V1,
      }),
    );

    const encrypted = writer.encrypt('opaque-token');

    const wrongReader = createService(
      createKeyring('key-v1', {
        'key-v1': KEY_V2,
      }),
    );

    expect(() =>
      wrongReader.decrypt({
        encryptedValue: encrypted.encryptedValue,
        keyVersion: encrypted.keyVersion,
      }),
    ).toThrow('credential_decryption_failed');
  });

  it('rejects malformed envelopes with a sanitized error', () => {
    const service = createService();

    expect(() =>
      service.decrypt({
        encryptedValue: 'not-a-valid-envelope',
        keyVersion: 'key-v1',
      }),
    ).toThrow('credential_decryption_failed');
  });

  it('rejects an empty plaintext instead of persisting an empty credential', () => {
    const service = createService();

    expect(() => service.encrypt('')).toThrow(
      'credential_plaintext_required',
    );
  });

  it('requires exactly 32 bytes of key material for AES-256', () => {
    expect(() =>
      createService(
        createKeyring('key-v1', {
          'key-v1': Buffer.alloc(31, 0x11),
        }),
      ),
    ).toThrow('credential_encryption_key_invalid');

    expect(() =>
      createService(
        createKeyring('key-v1', {
          'key-v1': Buffer.alloc(33, 0x11),
        }),
      ),
    ).toThrow('credential_encryption_key_invalid');
  });

  it('does not expose token or key material in authentication failure errors', () => {
    const writer = createService();

    const plaintext = 'never-leak-this-token';
    const encrypted = writer.encrypt(plaintext);

    const wrongReader = createService(
      createKeyring('key-v1', {
        'key-v1': KEY_V2,
      }),
    );

    let thrown: unknown;

    try {
      wrongReader.decrypt({
        encryptedValue: encrypted.encryptedValue,
        keyVersion: encrypted.keyVersion,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);

    const message =
      thrown instanceof Error
        ? thrown.message
        : String(thrown);

    expect(message).toBe('credential_decryption_failed');
    expect(message).not.toContain(plaintext);
    expect(message).not.toContain(KEY_V1.toString('hex'));
    expect(message).not.toContain(KEY_V2.toString('hex'));
  });

  it('rejects a tampered nonce', () => {
    const service = createService();

    const encrypted = service.encrypt('opaque-token');

    const parts = encrypted.encryptedValue.split('.');

    parts[1] = tamperSegment(parts[1]);

    expect(() =>
      service.decrypt({
        encryptedValue: parts.join('.'),
        keyVersion: encrypted.keyVersion,
      }),
    ).toThrow('credential_decryption_failed');
  });

  it('rejects a tampered authentication tag', () => {
    const service = createService();

    const encrypted = service.encrypt('opaque-token');

    const parts = encrypted.encryptedValue.split('.');

    parts[3] = tamperSegment(parts[3]);

    expect(() =>
      service.decrypt({
        encryptedValue: parts.join('.'),
        keyVersion: encrypted.keyVersion,
      }),
    ).toThrow('credential_decryption_failed');
  });

  it('rejects an unsupported envelope version', () => {
    const service = createService();

    const encrypted = service.encrypt('opaque-token');

    const parts = encrypted.encryptedValue.split('.');

    parts[0] = 'v2';

    expect(() =>
      service.decrypt({
        encryptedValue: parts.join('.'),
        keyVersion: encrypted.keyVersion,
      }),
    ).toThrow('credential_decryption_failed');
  });

  it('rejects empty nonce, ciphertext, or authentication tag segments', () => {
    const service = createService();

    const encrypted = service.encrypt('opaque-token');

    for (const segmentIndex of [1, 2, 3]) {
      const parts = encrypted.encryptedValue.split('.');

      parts[segmentIndex] = '';

      expect(() =>
        service.decrypt({
          encryptedValue: parts.join('.'),
          keyVersion: encrypted.keyVersion,
        }),
      ).toThrow('credential_decryption_failed');
    }
  });
});
